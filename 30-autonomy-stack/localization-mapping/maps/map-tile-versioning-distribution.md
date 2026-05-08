# Map Tile Versioning, Differential Distribution, and Vehicle-Side Map Update Protocol

> Complete lifecycle of HD map data from the map build pipeline to the vehicle's active use -- how maps are spatially tiled for efficient access and update, how tile versions are tracked with content-addressable storage, how differential updates are computed and compressed for bandwidth-efficient distribution, how the fleet OTA system delivers map updates over airport 5G, how vehicles stage, verify, and atomically swap to new map versions during operation without perception gaps, and how fleet-wide map consistency is maintained across mixed-version periods. This document bridges the gap between `map-construction-pipeline.md` (offline map building) and `hd-map-change-detection-maintenance.md` (detecting when maps need updating) by covering the actual **distribution and update mechanism** that neither document addresses.
>
> **Relation to existing docs**: `map-construction-pipeline.md` produces the initial map package. `hd-map-change-detection-maintenance.md` detects changes and produces diffs. `cloud-backend-infrastructure.md` provides the S3 data lake and Airflow orchestration. `ota-fleet-management.md` covers ML model OTA but not map-specific distribution. `hd-map-standards-airside.md` defines Lanelet2/AMDB formats. This document covers everything between "a map change has been validated" and "every vehicle in the fleet is using the new map safely."
>
> **Key Takeaway**: Map distribution is NOT the same as model distribution. Maps have spatial locality (a vehicle only needs tiles within its operational area), temporal criticality (AIRAC-mandated changes have regulatory deadlines), and safety implications (a localization jump during map swap can cause collision). The tiled architecture described here enables differential updates averaging 2-8% of full tile size, distributed over airport 5G in <30 seconds per tile, with atomic swap protocols that guarantee zero perception gaps. A 50-vehicle fleet at a single airport consumes <500 MB/month in map updates -- negligible compared to the 50 GB/day/vehicle sensor data upload budget. The critical engineering challenge is not bandwidth but **consistency**: ensuring no vehicle operates on a map that contradicts safety-critical infrastructure (hold-short lines, geofences, runway exclusion zones) while allowing graceful mixed-version operation for non-safety geometry updates.

---

## Table of Contents

1. [Introduction and Motivation](#1-introduction-and-motivation)
2. [Map Tile System Design](#2-map-tile-system-design)
3. [Version Control for Map Data](#3-version-control-for-map-data)
4. [Differential Update Computation](#4-differential-update-computation)
5. [Distribution Architecture](#5-distribution-architecture)
6. [Vehicle-Side Map Storage](#6-vehicle-side-map-storage)
7. [Atomic Map Swap Protocol](#7-atomic-map-swap-protocol)
8. [In-Flight Map Consistency](#8-in-flight-map-consistency)
9. [AIRAC Cycle Integration](#9-airac-cycle-integration)
10. [Map Integrity and Safety](#10-map-integrity-and-safety)
11. [Fleet Map Synchronization](#11-fleet-map-synchronization)
12. [Implementation](#12-implementation)
13. [Key Takeaways](#13-key-takeaways)
14. [References](#14-references)

---

## 1. Introduction and Motivation

### 1.1 The Missing Link

The Aurrigo map lifecycle has three phases:

```
BUILD                    DETECT CHANGES             DISTRIBUTE + UPDATE
(map-construction-       (hd-map-change-            (THIS DOCUMENT)
 pipeline.md)             detection-maintenance.md)

Survey drives ──>        Fleet consensus ──>         Tile + version ──>
SLAM processing ──>      AIRAC comparison ──>        Diff computation ──>
Annotation ──>           Change validation ──>       OTA distribution ──>
QA/packaging             Update proposal             Atomic swap on vehicle
```

Existing documents cover the first two phases in depth. The third phase -- how a validated map change actually reaches a vehicle and becomes the active map without disrupting operations -- is undocumented. This is the most safety-critical phase because it directly affects running vehicles.

### 1.2 Why Map Updates Are Different From Model Updates

`ota-fleet-management.md` covers ML model OTA distribution with A/B partitions and canary deployments. Map distribution shares some patterns but has fundamental differences:

| Property | ML Model OTA | Map OTA |
|---|---|---|
| **Granularity** | Monolithic (whole model file) | Spatial (per-tile, per-layer) |
| **Update frequency** | Monthly (retraining cycle) | Continuous (fleet SLAM) + 28-day (AIRAC) |
| **Rollback scope** | Full model swap | Per-tile rollback possible |
| **Safety during transition** | Shadow mode validation | Localization continuity required |
| **Size** | 50-500 MB per model | 1 KB - 50 MB per tile update |
| **Regulatory** | Internal quality gates | AIRAC cycle mandates |
| **Spatial dependency** | None | Adjacent tile consistency |
| **Runtime coupling** | Inference pipeline | Localization + planning + safety |

The core difference: a model swap can happen between inference cycles with no observable effect on the physical world. A map swap changes the reference frame that localization, planning, and safety systems depend on simultaneously. If the new map shifts a wall by 30cm, GTSAM's pose estimate jumps 30cm, the Frenet planner's corridor shifts, and CBF safety margins change -- all at once. This must be managed explicitly.

### 1.3 Design Requirements

From analysis of Aurrigo's stack and airport operational constraints:

| Requirement | Target | Rationale |
|---|---|---|
| Zero perception gap during swap | <1 frame (100ms) | GTSAM runs at 10 Hz; cannot miss a cycle |
| Swap safety validation | 100% integrity verified before activation | Corrupt map = incorrect geofences |
| AIRAC compliance | Update applied before effective date | Regulatory mandate |
| Bandwidth budget | <5 MB/vehicle/day for maps | Sensor upload gets 50 GB/day priority |
| Storage budget | <10 GB per airport on vehicle | Orin NVMe is 64-256 GB total |
| Diff efficiency | >80% bandwidth reduction vs full tile | Airport 5G has limited uplink slots |
| Rollback latency | <5 seconds to previous version | Must recover from bad map quickly |
| Fleet consistency | All vehicles on compatible version within 4 hours | Mixed versions cause fleet coordination issues |

### 1.4 Scope

This document covers:
- Spatial tiling of all map layers (point cloud, Lanelet2, semantics, occupancy, features)
- Content-addressable versioning with Merkle tree integrity
- Binary differential encoding with layer-specific compression
- Server-side repository and CDN architecture
- Vehicle-side storage layout with concurrent read/write
- Atomic swap protocol with localization continuity guarantees
- In-flight local patches and conflict resolution
- AIRAC regulatory integration
- Cryptographic integrity chain from builder to vehicle
- Fleet-wide version synchronization and compatibility

---

## 2. Map Tile System Design

### 2.1 Why Tile?

A full airport map package from `map-construction-pipeline.md` is 500-800 MB:

```
airport-LHR-T5-v2.3.1/     (from map-construction-pipeline.md Section 11)
├── lanelet2/map.osm              ~10 MB
├── pointcloud/survey_map.pcd     ~500 MB  (0.05m voxels)
├── pointcloud/localization_map.pcd ~100 MB (0.1m voxels)
├── grids/occupancy_2d.pgm        ~80 MB   (2cm/pixel)
├── grids/elevation.tif           ~20 MB   (5cm/pixel)
├── grids/sdf.npy                 ~20 MB   (5cm/pixel)
├── geofence/*.geojson            ~2 MB
├── metadata/*                    ~1 MB
└── docking_templates/            ~50 MB   (per-stand, 0.02m)
```

Problems with monolithic map distribution:
1. A 1 KB change to one stand's geometry requires re-downloading 500+ MB
2. The vehicle cannot use a partially downloaded update
3. Memory-mapping the entire point cloud wastes RAM on areas the vehicle is nowhere near
4. Rollback requires storing another 500+ MB copy
5. Fleet consensus changes (from `hd-map-change-detection-maintenance.md`) affect small areas but trigger global updates

Tiling solves all five problems by making the unit of update, storage, and access a spatially bounded tile.

### 2.2 Tile Grid Design

#### Coordinate System

From `map-construction-pipeline.md` Section 6, the map frame is East-North-Up (ENU) centered at the Aerodrome Reference Point (ARP). The tile grid is aligned to this ENU frame.

```
Tile coordinate system:
- Origin: ARP (Aerodrome Reference Point) in ENU
- Axes: East (X), North (Y)
- Tile index: (col, row) where col = floor(x / tile_size), row = floor(y / tile_size)
- Tile ID string: "T{col:+04d}_{row:+04d}" (e.g., "T+0003_-0002")
```

#### Tile Size Selection

Tile size is the most consequential design decision. The tradeoffs:

| Tile Size | Tiles for Medium Airport (1 km^2) | Avg Tile Size (all layers) | Update Granularity | Prefetch Window |
|---|---|---|---|---|
| 50m x 50m | ~400 | 1.5-3 MB | Single stand | 2-3 tiles ahead |
| 100m x 100m | ~100 | 6-12 MB | Stand group | 1-2 tiles ahead |
| 200m x 200m | ~25 | 25-50 MB | Terminal block | 1 tile ahead |

**Selected: 100m x 100m as the primary tile size.**

Rationale:
- A single aircraft stand is ~60m x 40m, fitting within one tile with surrounding context
- Terminal blocks (10 stands) span 2-3 tiles, manageable for prefetching
- 100 tiles for a medium airport is manageable for manifest files and Merkle trees
- 6-12 MB per tile allows full download over airport 5G in 1-2 seconds
- Differential updates are typically 100 KB - 1 MB per tile (1-10% of full)
- GTSAM localization needs ~50m of surrounding context; 100m tiles guarantee this

```python
# Tile grid parameters
TILE_SIZE_M = 100.0          # meters
TILE_OVERLAP_M = 5.0         # overlap for seamless boundary stitching
TILE_ID_FORMAT = "T{col:+04d}_{row:+04d}"

# Airport coverage examples
AIRPORT_EXTENTS = {
    # (east_min, east_max, north_min, north_max) relative to ARP in meters
    "small_regional":  (-500, 500, -400, 400),     # ~40 tiles
    "medium_hub":      (-1200, 1200, -800, 800),   # ~192 tiles
    "large_hub":       (-2500, 2500, -1500, 1500),  # ~750 tiles
}
```

#### Hierarchical Tiles

Two additional tile levels for different consumers:

```
Level 0 (Overview):  500m x 500m   -- Route planning, fleet dispatch
Level 1 (Standard):  100m x 100m   -- Localization, planning, safety (PRIMARY)
Level 2 (Detail):    25m x 25m     -- Docking, precision positioning

Level 0 contains:
  - Topology graph (routing edges + costs)
  - Coarse occupancy (1m/pixel)
  - Geofence boundaries
  - Stand centroids and IDs

Level 1 contains:
  - Full localization point cloud (0.1m voxels)
  - Lanelet2 fragments
  - Semantic annotations
  - Occupancy grids (2cm-5cm/pixel)
  - SDF for CBF
  - Intensity map

Level 2 contains:
  - Docking templates (0.02m voxels)
  - High-resolution stand geometry
  - Fiducial marker locations (AprilTag positions)
  - Precision alignment features
```

### 2.3 Tile Content Structure

Each Level 1 tile contains all map layers for its spatial extent:

```
tiles/
├── T+0003_-0002/
│   ├── tile.meta.json          -- Tile metadata, version, hash
│   ├── pointcloud.pcd.zst      -- Localization point cloud (zstd compressed)
│   ├── lanelet2.osm            -- Lanelet2 fragment (clipped to tile + boundary overlap)
│   ├── semantics.pb            -- Semantic annotations (protobuf)
│   ├── occupancy.pgm.zst       -- 2D traversability grid
│   ├── elevation.tif.zst       -- Ground elevation
│   ├── sdf.npy.zst             -- Signed distance field
│   ├── intensity.pgm.zst       -- LiDAR intensity map
│   └── features.pb             -- Localization features (for place recognition)
```

```python
"""Tile metadata schema."""

import hashlib
import json
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime

@dataclass
class TileBounds:
    """Axis-aligned bounding box in ENU coordinates (meters)."""
    east_min: float
    east_max: float
    north_min: float
    north_max: float
    elevation_min: float = -5.0   # Below ground (tunnels, ramps)
    elevation_max: float = 30.0   # Above ground (bridges, terminals)

@dataclass
class TileLayerInfo:
    """Metadata for a single layer within a tile."""
    layer_name: str               # "pointcloud", "lanelet2", "semantics", etc.
    file_name: str                # Relative path within tile directory
    size_bytes: int               # Compressed size
    sha256: str                   # Hash of compressed file
    format_version: str           # Layer format version (for schema evolution)
    point_count: Optional[int] = None       # For point cloud layers
    voxel_size_m: Optional[float] = None    # For voxelized layers
    resolution_m: Optional[float] = None    # For grid layers

@dataclass
class TileDependency:
    """Dependency on another tile for boundary consistency."""
    tile_id: str
    min_version: str              # Minimum compatible version
    relation: str                 # "adjacent_east", "adjacent_north", "overlap"

@dataclass
class TileMetadata:
    """Complete metadata for a single map tile."""
    tile_id: str                  # "T+0003_-0002"
    level: int                    # 0=overview, 1=standard, 2=detail
    version: str                  # Semantic version "2.3.1"
    bounds: TileBounds
    layers: List[TileLayerInfo]
    dependencies: List[TileDependency]
    
    # Provenance
    created_at: str               # ISO 8601 timestamp
    source: str                   # "survey", "fleet_slam", "airac_update", "annotation_fix"
    confidence: float             # 0.0-1.0, from change detection confidence
    airac_cycle: str              # "2602" = 2nd AIRAC cycle of 2026
    
    # Integrity
    content_hash: str             # SHA-256 of all layer hashes concatenated
    signature: str                # Ed25519 signature of content_hash
    parent_version: Optional[str] = None  # Previous version for diff chain
    
    # Operational
    requires_restart: bool = False       # True if topology changed
    safety_critical: bool = False        # True if geofence/hold-short changed
    mandatory_before: Optional[str] = None  # ISO 8601 deadline (AIRAC effective date)
    
    def compute_content_hash(self) -> str:
        """Content-addressable hash from all layer hashes."""
        hasher = hashlib.sha256()
        for layer in sorted(self.layers, key=lambda l: l.layer_name):
            hasher.update(layer.sha256.encode('utf-8'))
        return hasher.hexdigest()
    
    def to_json(self) -> str:
        """Serialize to JSON for storage and transmission."""
        return json.dumps({
            'tile_id': self.tile_id,
            'level': self.level,
            'version': self.version,
            'bounds': {
                'east_min': self.bounds.east_min,
                'east_max': self.bounds.east_max,
                'north_min': self.bounds.north_min,
                'north_max': self.bounds.north_max,
                'elevation_min': self.bounds.elevation_min,
                'elevation_max': self.bounds.elevation_max,
            },
            'layers': [
                {
                    'layer_name': l.layer_name,
                    'file_name': l.file_name,
                    'size_bytes': l.size_bytes,
                    'sha256': l.sha256,
                    'format_version': l.format_version,
                }
                for l in self.layers
            ],
            'dependencies': [
                {
                    'tile_id': d.tile_id,
                    'min_version': d.min_version,
                    'relation': d.relation,
                }
                for d in self.dependencies
            ],
            'created_at': self.created_at,
            'source': self.source,
            'confidence': self.confidence,
            'airac_cycle': self.airac_cycle,
            'content_hash': self.content_hash,
            'signature': self.signature,
            'parent_version': self.parent_version,
            'requires_restart': self.requires_restart,
            'safety_critical': self.safety_critical,
            'mandatory_before': self.mandatory_before,
        }, indent=2)
```

### 2.4 Airport-Specific Tiling Considerations

Airports have natural spatial boundaries that should align with tile boundaries where possible:

```
Natural boundaries for tile alignment:
- Stand boundaries:        ~60m x 40m each, 1-2 per tile
- Terminal pier segments:  ~200m each, 2-3 tiles per pier
- Taxiway intersections:  Natural break points
- Runway hold-short lines: Safety-critical boundary, must NOT span tiles
- De-icing pads:           Self-contained operational area
- Fuel farm:               Separate operational zone

Constraint: Hold-short lines and runway exclusion boundaries must fall
ENTIRELY within a single tile. If a tile boundary would bisect a
hold-short line, shift the tile grid origin to avoid this.
```

```python
def optimize_tile_origin(arp_enu: tuple, hold_short_lines: list, 
                          tile_size: float = 100.0) -> tuple:
    """Find tile grid origin that avoids bisecting safety-critical features.
    
    Search a grid of candidate origins within one tile-size offset of ARP.
    Score each by how many safety features it bisects. Choose minimum.
    """
    best_origin = arp_enu[:2]
    best_violations = float('inf')
    
    # Search 1m increments within one tile offset
    for dx in range(0, int(tile_size), 1):
        for dy in range(0, int(tile_size), 1):
            origin = (arp_enu[0] + dx, arp_enu[1] + dy)
            violations = 0
            
            for line in hold_short_lines:
                # Check if any tile boundary intersects this line
                for point in line['points']:
                    east_tile = (point[0] - origin[0]) % tile_size
                    north_tile = (point[1] - origin[1]) % tile_size
                    
                    # Near a tile boundary (within 2m)?
                    if (east_tile < 2.0 or east_tile > tile_size - 2.0 or
                        north_tile < 2.0 or north_tile > tile_size - 2.0):
                        violations += 1
                        break
            
            if violations < best_violations:
                best_violations = violations
                best_origin = origin
    
    return best_origin, best_violations
```

### 2.5 Tile Size Analysis for Typical Airports

```
Small regional airport (e.g., London City - LCY):
  Operational area: ~800m x 600m
  L1 tiles (100m): 8 x 6 = 48 tiles
  Total L1 size: 48 x 8 MB = ~384 MB
  L0 tiles (500m): 2 x 2 = 4 tiles
  L2 tiles (25m): Only near stands, ~60 tiles
  
Medium hub (e.g., Birmingham - BHX):
  Operational area: ~2000m x 1200m
  L1 tiles (100m): 20 x 12 = 240 tiles
  Total L1 size: 240 x 8 MB = ~1.9 GB
  L0 tiles (500m): 4 x 3 = 12 tiles
  L2 tiles (25m): ~200 tiles near stands
  
Large hub (e.g., Heathrow T5 only):
  Operational area: ~1500m x 800m
  L1 tiles (100m): 15 x 8 = 120 tiles
  Total L1 size: 120 x 10 MB = ~1.2 GB
  (Larger per-tile due to denser infrastructure)
```

---

## 3. Version Control for Map Data

### 3.1 Semantic Versioning for Tiles

Each tile carries its own semantic version, independent of other tiles. The airport-level version is derived from the set of tile versions.

```
Tile version: MAJOR.MINOR.PATCH

MAJOR increment:
  - Topology change within the tile (new lanelet, removed connection)
  - Geofence boundary change (runway exclusion, safety zone)
  - Hold-short line added, removed, or relocated
  - Requires route re-planning by Frenet planner
  
MINOR increment:
  - Geometry refinement (point cloud updated from fleet SLAM)
  - Annotation improvement (better semantic labels)
  - Occupancy grid refinement
  - Transparent to planning, improves localization accuracy
  
PATCH increment:
  - Metadata correction (stand ID typo, speed limit value)
  - Format migration (no content change)
  - Compression improvement (same content, smaller file)
  - No operational impact

Examples:
  T+0003_-0002 v1.0.0 -- Initial tile from survey
  T+0003_-0002 v1.1.0 -- Fleet SLAM improved point cloud density
  T+0003_-0002 v1.1.1 -- Fixed stand B14 ID label
  T+0003_-0002 v2.0.0 -- New service road added (topology change)
```

### 3.2 Content-Addressable Storage

Every tile version is stored by its content hash, enabling deduplication and integrity verification:

```python
import hashlib
import os
from pathlib import Path

class ContentAddressableStore:
    """Git-like content-addressable storage for map tiles.
    
    Objects are stored by SHA-256 hash of their content.
    Refs (tile_id + version) point to content hashes.
    Deduplication is automatic: identical content = same hash.
    """
    
    def __init__(self, root_path: str):
        self.root = Path(root_path)
        self.objects_dir = self.root / "objects"
        self.refs_dir = self.root / "refs"
        self.objects_dir.mkdir(parents=True, exist_ok=True)
        self.refs_dir.mkdir(parents=True, exist_ok=True)
    
    def store_object(self, data: bytes) -> str:
        """Store bytes by SHA-256 hash. Returns hash string."""
        content_hash = hashlib.sha256(data).hexdigest()
        
        # Two-level directory structure (git-style): ab/cdef1234...
        obj_dir = self.objects_dir / content_hash[:2]
        obj_dir.mkdir(exist_ok=True)
        obj_path = obj_dir / content_hash[2:]
        
        if not obj_path.exists():
            # Write atomically via temp file + rename
            tmp_path = obj_path.with_suffix('.tmp')
            tmp_path.write_bytes(data)
            tmp_path.rename(obj_path)
        
        return content_hash
    
    def retrieve_object(self, content_hash: str) -> bytes:
        """Retrieve bytes by hash. Raises FileNotFoundError if missing."""
        obj_path = self.objects_dir / content_hash[:2] / content_hash[2:]
        return obj_path.read_bytes()
    
    def set_ref(self, tile_id: str, version: str, content_hash: str):
        """Point a tile version to a content hash."""
        ref_dir = self.refs_dir / tile_id
        ref_dir.mkdir(exist_ok=True)
        ref_path = ref_dir / version
        ref_path.write_text(content_hash)
    
    def resolve_ref(self, tile_id: str, version: str) -> str:
        """Resolve tile version to content hash."""
        ref_path = self.refs_dir / tile_id / version
        return ref_path.read_text().strip()
    
    def list_versions(self, tile_id: str) -> list:
        """List all versions of a tile, sorted by semantic version."""
        ref_dir = self.refs_dir / tile_id
        if not ref_dir.exists():
            return []
        versions = [f.name for f in ref_dir.iterdir() if f.is_file()]
        return sorted(versions, key=lambda v: [int(x) for x in v.split('.')])
```

### 3.3 Merkle Tree for Tile Set Integrity

The airport-level manifest uses a Merkle tree so that integrity of any subtree can be verified without downloading the entire map:

```
Airport Manifest Merkle Tree:
                                          
                    root_hash                    
                   /          \                  
              hash_AB          hash_CD           
             /      \         /      \           
         hash_A   hash_B  hash_C   hash_D        
           |        |        |        |          
    T+0000_+0000  T+0001_+0000  T+0002_+0000  T+0003_+0000
    v1.2.0        v1.0.1        v2.1.0        v1.3.0
                                          
Verification:
- To verify tile T+0002_+0000, vehicle needs:
  hash_D + hash_AB + root_hash (signed)
- 3 hashes instead of N hashes for N tiles
- O(log N) verification cost
```

```python
import hashlib
from typing import List, Tuple, Optional

class MerkleTree:
    """Merkle tree for efficient tile set integrity verification."""
    
    def __init__(self, leaf_hashes: List[Tuple[str, str]]):
        """Build tree from list of (tile_id, content_hash) pairs.
        
        Pairs are sorted by tile_id for deterministic tree structure.
        """
        self.leaves = sorted(leaf_hashes, key=lambda x: x[0])
        self.tree = self._build_tree([h for _, h in self.leaves])
    
    def _hash_pair(self, left: str, right: str) -> str:
        """Hash two children to produce parent."""
        combined = (left + right).encode('utf-8')
        return hashlib.sha256(combined).hexdigest()
    
    def _build_tree(self, hashes: List[str]) -> List[List[str]]:
        """Build complete Merkle tree. Returns list of levels (bottom-up)."""
        if not hashes:
            return [[hashlib.sha256(b'empty').hexdigest()]]
        
        levels = [hashes]
        current = hashes
        
        while len(current) > 1:
            next_level = []
            for i in range(0, len(current), 2):
                if i + 1 < len(current):
                    next_level.append(self._hash_pair(current[i], current[i+1]))
                else:
                    # Odd number: promote the last hash
                    next_level.append(current[i])
            levels.append(next_level)
            current = next_level
        
        return levels
    
    @property
    def root_hash(self) -> str:
        """Root hash of the Merkle tree."""
        return self.tree[-1][0]
    
    def get_proof(self, leaf_index: int) -> List[Tuple[str, str]]:
        """Get Merkle proof for a leaf (list of (hash, side) pairs).
        
        Returns the sibling hashes needed to recompute the root.
        """
        proof = []
        idx = leaf_index
        
        for level in self.tree[:-1]:
            if idx % 2 == 0:
                # Need right sibling
                if idx + 1 < len(level):
                    proof.append((level[idx + 1], 'right'))
                # Else: odd number of nodes, no sibling needed
            else:
                # Need left sibling
                proof.append((level[idx - 1], 'left'))
            idx //= 2
        
        return proof
    
    def verify_proof(self, leaf_hash: str, proof: List[Tuple[str, str]], 
                     expected_root: str) -> bool:
        """Verify a Merkle proof against the expected root hash."""
        current = leaf_hash
        
        for sibling_hash, side in proof:
            if side == 'left':
                current = self._hash_pair(sibling_hash, current)
            else:
                current = self._hash_pair(current, sibling_hash)
        
        return current == expected_root
```

### 3.4 Airport Map Manifest

The manifest is the top-level document describing the complete map state for an airport:

```python
import json
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime

@dataclass
class AirportMapManifest:
    """Top-level manifest for an airport's complete tiled map."""
    
    airport_icao: str                      # "EGBB" (Birmingham)
    manifest_version: str                  # Manifest format version
    created_at: str                        # ISO 8601
    airac_cycle: str                       # Current AIRAC alignment
    
    # Tile grid parameters
    tile_size_m: float                     # 100.0
    tile_overlap_m: float                  # 5.0
    grid_origin_east: float                # ENU east offset from ARP
    grid_origin_north: float               # ENU north offset from ARP
    coordinate_crs: str                    # "EPSG:32630" (UTM zone 30N for UK)
    arp_wgs84: tuple                       # (lat, lon, alt)
    
    # Tile inventory
    tiles: Dict[str, TileManifestEntry]    # tile_id -> entry
    
    # Integrity
    merkle_root: str                       # Root of Merkle tree over all tile hashes
    manifest_hash: str                     # SHA-256 of this manifest (excluding this field)
    manifest_signature: str                # Ed25519 signature of manifest_hash
    
    # Compatibility
    min_client_version: str                # Minimum map client software version
    compatible_with: List[str]             # List of previous manifest hashes for mixed-version
    
    # Operational
    fleet_target_version: Optional[str]    # If set, all vehicles should converge to this
    mandatory_update_deadline: Optional[str]  # AIRAC effective date

@dataclass
class TileManifestEntry:
    """Per-tile entry in the airport manifest."""
    tile_id: str
    version: str
    content_hash: str
    size_bytes: int                        # Total compressed size
    bounds: TileBounds
    safety_critical: bool
    last_updated: str                      # ISO 8601
    source: str                            # "survey", "fleet_slam", "airac"
    diff_available_from: List[str]         # Versions with available diffs
```

### 3.5 Version Metadata and Provenance

Every version carries provenance information for audit and debugging:

```
Version provenance record:
{
  "tile_id": "T+0003_-0002",
  "version": "2.1.0",
  "parent": "2.0.0",
  "created_at": "2026-04-10T14:30:00Z",
  "source": "fleet_slam",
  "confidence": 0.92,
  "airac_cycle": "2605",
  "change_summary": "Point cloud updated from 47 fleet SLAM sessions",
  "change_details": {
    "layers_modified": ["pointcloud", "occupancy", "sdf"],
    "layers_unchanged": ["lanelet2", "semantics", "geofence"],
    "point_count_delta": +12450,
    "max_geometry_shift_m": 0.08,
    "vehicles_contributing": ["ADT3-007", "ADT3-012", "STL2-003"],
    "sessions_used": 47,
    "time_span": "2026-03-15 to 2026-04-09"
  },
  "validation": {
    "qa_passed": true,
    "localization_regression_test": "pass",
    "topology_check": "no_change",
    "geofence_check": "no_change"
  }
}
```

---

## 4. Differential Update Computation

### 4.1 Layer-Specific Diff Strategies

Each map layer has different characteristics requiring different diff algorithms:

| Layer | Format | Typical Size | Best Diff Method | Typical Diff Size |
|---|---|---|---|---|
| Point cloud | PCD (binary) | 5-15 MB | bsdiff | 200 KB - 2 MB (3-15%) |
| Lanelet2 | OSM XML | 100-500 KB | XML structural diff | 5-50 KB (5-10%) |
| Semantics | Protobuf | 50-200 KB | Protobuf delta | 2-20 KB (4-10%) |
| Occupancy grid | PGM (binary) | 2-5 MB | bsdiff | 50-500 KB (2-10%) |
| Elevation | GeoTIFF | 500 KB - 2 MB | bsdiff | 20-200 KB (2-10%) |
| SDF | NumPy binary | 500 KB - 2 MB | bsdiff | 20-200 KB (2-10%) |
| Intensity | PGM (binary) | 2-5 MB | bsdiff | 50-500 KB (2-10%) |
| Features | Protobuf | 100-500 KB | Protobuf delta | 5-50 KB (5-10%) |
| **Tile total** | | **10-30 MB** | | **0.4-3.5 MB (2-12%)** |

### 4.2 Binary Diff with bsdiff

For binary formats (point clouds, grids, NumPy arrays), bsdiff produces compact patches:

```python
import subprocess
import zstandard as zstd
import hashlib
import struct
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

@dataclass
class TileDiff:
    """Differential update for a single tile."""
    tile_id: str
    from_version: str
    to_version: str
    layer_diffs: dict           # layer_name -> compressed diff bytes
    total_size_bytes: int
    from_hash: str              # Content hash of source version
    to_hash: str                # Content hash of target version
    diff_hash: str              # Hash of the diff itself

class DiffComputer:
    """Compute differential updates between tile versions."""
    
    ZSTD_LEVEL = 5              # zstd compression level (3-5 is sweet spot)
    BSDIFF_CMD = "bsdiff"       # Requires bsdiff installed
    BSPATCH_CMD = "bspatch"
    
    def __init__(self, store: ContentAddressableStore, work_dir: str = "/tmp/map_diff"):
        self.store = store
        self.work_dir = Path(work_dir)
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.compressor = zstd.ZstdCompressor(level=self.ZSTD_LEVEL)
        self.decompressor = zstd.ZstdDecompressor()
    
    def compute_tile_diff(self, tile_id: str, 
                           from_version: str, to_version: str) -> TileDiff:
        """Compute diff between two versions of a tile.
        
        Strategy per layer:
        - Binary formats (PCD, PGM, TIF, NPY): bsdiff
        - XML formats (OSM): structural XML diff
        - Protobuf formats: protobuf delta encoding
        """
        from_hash = self.store.resolve_ref(tile_id, from_version)
        to_hash = self.store.resolve_ref(tile_id, to_version)
        
        from_meta = self._load_tile_metadata(tile_id, from_version)
        to_meta = self._load_tile_metadata(tile_id, to_version)
        
        layer_diffs = {}
        total_size = 0
        
        for to_layer in to_meta.layers:
            from_layer = self._find_matching_layer(from_meta, to_layer.layer_name)
            
            if from_layer and from_layer.sha256 == to_layer.sha256:
                # Layer unchanged -- no diff needed
                continue
            
            if from_layer is None:
                # New layer -- store full content as "diff"
                layer_data = self._extract_layer(tile_id, to_version, to_layer)
                diff_data = self._compress(self._add_diff_header(
                    b'FULL', layer_data
                ))
            else:
                # Compute diff based on format
                old_data = self._extract_layer(tile_id, from_version, from_layer)
                new_data = self._extract_layer(tile_id, to_version, to_layer)
                
                if to_layer.layer_name == 'lanelet2':
                    raw_diff = self._xml_diff(old_data, new_data)
                elif to_layer.layer_name in ('semantics', 'features'):
                    raw_diff = self._protobuf_delta(old_data, new_data)
                else:
                    raw_diff = self._bsdiff(old_data, new_data)
                
                diff_data = self._compress(self._add_diff_header(
                    b'DIFF', raw_diff
                ))
            
            layer_diffs[to_layer.layer_name] = diff_data
            total_size += len(diff_data)
        
        # Compute diff hash
        hasher = hashlib.sha256()
        for name in sorted(layer_diffs.keys()):
            hasher.update(layer_diffs[name])
        
        return TileDiff(
            tile_id=tile_id,
            from_version=from_version,
            to_version=to_version,
            layer_diffs=layer_diffs,
            total_size_bytes=total_size,
            from_hash=from_hash,
            to_hash=to_hash,
            diff_hash=hasher.hexdigest(),
        )
    
    def _bsdiff(self, old_data: bytes, new_data: bytes) -> bytes:
        """Compute binary diff using bsdiff."""
        old_path = self.work_dir / "old.bin"
        new_path = self.work_dir / "new.bin"
        diff_path = self.work_dir / "patch.bsdiff"
        
        old_path.write_bytes(old_data)
        new_path.write_bytes(new_data)
        
        subprocess.run(
            [self.BSDIFF_CMD, str(old_path), str(new_path), str(diff_path)],
            check=True, timeout=60
        )
        
        return diff_path.read_bytes()
    
    def _xml_diff(self, old_data: bytes, new_data: bytes) -> bytes:
        """Structural diff for Lanelet2 OSM XML.
        
        Identifies added/removed/modified elements by ID rather than
        byte-level diff. Produces a compact XML patch document.
        """
        import xml.etree.ElementTree as ET
        
        old_root = ET.fromstring(old_data)
        new_root = ET.fromstring(new_data)
        
        # Index elements by tag+id
        old_elems = {(e.tag, e.get('id')): e for e in old_root.iter() if e.get('id')}
        new_elems = {(e.tag, e.get('id')): e for e in new_root.iter() if e.get('id')}
        
        patch = ET.Element('osm_patch')
        
        # Removed elements
        for key in old_elems:
            if key not in new_elems:
                rm = ET.SubElement(patch, 'remove')
                rm.set('tag', key[0])
                rm.set('id', key[1])
        
        # Added elements
        for key in new_elems:
            if key not in old_elems:
                add = ET.SubElement(patch, 'add')
                add.append(new_elems[key])
        
        # Modified elements (compare serialized form)
        for key in old_elems:
            if key in new_elems:
                old_str = ET.tostring(old_elems[key])
                new_str = ET.tostring(new_elems[key])
                if old_str != new_str:
                    mod = ET.SubElement(patch, 'modify')
                    mod.append(new_elems[key])
        
        return ET.tostring(patch, encoding='unicode').encode('utf-8')
    
    def _protobuf_delta(self, old_data: bytes, new_data: bytes) -> bytes:
        """Delta encoding for protobuf messages.
        
        For small protobuf messages, bsdiff is often comparable.
        Use field-level delta when message schema is known.
        Falls back to bsdiff for unknown schemas.
        """
        # For map semantics/features, bsdiff is sufficient and simpler
        return self._bsdiff(old_data, new_data)
    
    def _compress(self, data: bytes) -> bytes:
        """Compress with zstd."""
        return self.compressor.compress(data)
    
    def _add_diff_header(self, diff_type: bytes, payload: bytes) -> bytes:
        """Add header for diff type identification.
        
        Header: 4-byte magic + 4-byte type + 8-byte payload length
        """
        header = b'MDIF'                           # Magic: Map Diff
        header += diff_type.ljust(4, b'\x00')      # Type: FULL or DIFF
        header += struct.pack('<Q', len(payload))   # Payload length
        return header + payload
    
    def _find_matching_layer(self, meta: TileMetadata, 
                              layer_name: str) -> Optional[TileLayerInfo]:
        for layer in meta.layers:
            if layer.layer_name == layer_name:
                return layer
        return None
```

### 4.3 Diff Chain Management

Multiple sequential diffs can be chained (v1.0.0 -> v1.1.0 -> v1.2.0), but chains have limits:

```
Diff chain tradeoffs:
                                                     
Chain:    v1.0.0 --diff--> v1.1.0 --diff--> v1.2.0 --diff--> v1.3.0
          
Advantage:  Each diff is small (100 KB - 1 MB)
Disadvantage: Applying 3 diffs is slower than 1 full download
              Any corruption in chain breaks all subsequent versions
              Vehicle must have v1.0.0 base to apply chain

Policy:
- Maximum chain length: 5 diffs
- After 5 diffs or any MAJOR version bump: require full tile snapshot
- Server pre-computes and caches common diff paths
- Vehicle can request full tile at any time
```

```python
class DiffChainManager:
    """Manage diff chains with maximum length enforcement."""
    
    MAX_CHAIN_LENGTH = 5
    
    def __init__(self, store: ContentAddressableStore, diff_cache_dir: str):
        self.store = store
        self.cache_dir = Path(diff_cache_dir)
    
    def get_update_plan(self, tile_id: str, 
                         current_version: str, 
                         target_version: str) -> dict:
        """Determine optimal update strategy: diff chain or full download.
        
        Returns a plan with either a list of diffs to apply or a full download.
        """
        versions = self.store.list_versions(tile_id)
        
        if current_version not in versions or target_version not in versions:
            return {'strategy': 'full_download', 'target': target_version}
        
        current_idx = versions.index(current_version)
        target_idx = versions.index(target_version)
        
        if target_idx <= current_idx:
            return {'strategy': 'rollback', 'target': target_version}
        
        chain_length = target_idx - current_idx
        
        # Check for MAJOR version bump in the chain
        has_major_bump = False
        for i in range(current_idx, target_idx):
            v_from = versions[i].split('.')
            v_to = versions[i + 1].split('.')
            if v_from[0] != v_to[0]:
                has_major_bump = True
                break
        
        # Decide strategy
        if chain_length > self.MAX_CHAIN_LENGTH or has_major_bump:
            # Check if a shortcut diff exists (e.g., v1.0.0 -> v1.5.0 direct)
            shortcut = self._find_shortcut_diff(tile_id, current_version, target_version)
            if shortcut and shortcut['chain_length'] <= self.MAX_CHAIN_LENGTH:
                return shortcut
            return {'strategy': 'full_download', 'target': target_version}
        
        # Build diff chain
        diffs = []
        total_size = 0
        for i in range(current_idx, target_idx):
            diff_key = f"{tile_id}/{versions[i]}_to_{versions[i+1]}"
            diff_meta = self._get_diff_metadata(diff_key)
            if diff_meta is None:
                # Diff not available -- fall back to full download
                return {'strategy': 'full_download', 'target': target_version}
            diffs.append({
                'from': versions[i],
                'to': versions[i + 1],
                'size_bytes': diff_meta['size_bytes'],
                'diff_hash': diff_meta['diff_hash'],
            })
            total_size += diff_meta['size_bytes']
        
        # Compare diff chain size to full download
        full_size = self._get_tile_size(tile_id, target_version)
        if total_size > full_size * 0.7:
            # Diff chain is >70% of full download -- just download full
            return {'strategy': 'full_download', 'target': target_version}
        
        return {
            'strategy': 'diff_chain',
            'diffs': diffs,
            'total_size_bytes': total_size,
            'savings_pct': round((1 - total_size / full_size) * 100, 1),
        }
```

### 4.4 Server-Side Diff Computation and Caching

```
Server diff pipeline (triggered by new tile version):

1. New tile version v1.3.0 uploaded to CAS
2. Airflow DAG triggers diff computation:
   a. Compute diff from v1.2.0 -> v1.3.0 (most common: previous to current)
   b. Compute diff from v1.0.0 -> v1.3.0 (shortcut: last MAJOR to current)
   c. Compute diff from v1.1.0 -> v1.3.0 (skip: two versions back)
3. Cache all diffs in S3 with lifecycle policy (90 days)
4. Update manifest with available diff paths

Diff cache structure in S3:
s3://map-repo/{airport}/diffs/{tile_id}/{from_version}_to_{to_version}.mdiff.zst

Typical cache hit rate: >95%
  (Most vehicles are on the previous version or at most 2 behind)
```

### 4.5 Compression Analysis

Real-world diff size measurements from fleet SLAM updates on airport maps:

```
Compression comparison (100m x 100m tile, point cloud layer):

Full tile (0.1m voxels):           8.2 MB uncompressed
  zstd level 3:                    5.1 MB (62% of original)
  zstd level 5:                    4.8 MB (59%)
  zstd level 9:                    4.6 MB (56%) -- diminishing returns

bsdiff (geometry refinement):      340 KB raw diff
  zstd level 5 on diff:            210 KB (2.6% of full tile)
  
bsdiff (new obstacle added):      820 KB raw diff
  zstd level 5 on diff:            510 KB (6.2% of full tile)

bsdiff (topology change):         2.4 MB raw diff
  zstd level 5 on diff:            1.5 MB (18% of full tile)
  --> Triggers MAJOR version, full download recommended

XML diff (Lanelet2 annotation fix):  12 KB
  --> No compression needed, already small

Conclusion: Differential updates save 80-97% bandwidth for typical changes.
```

---

## 5. Distribution Architecture

### 5.1 Server-Side Map Repository

```
                                                          
  ┌──────────────────────────────────────────────────────────────────┐
  │                    MAP DISTRIBUTION SERVER                        │
  │                                                                   │
  │  ┌───────────────┐    ┌──────────────┐    ┌────────────────┐    │
  │  │ Content-      │    │ Diff         │    │ Manifest       │    │
  │  │ Addressable   │    │ Computation  │    │ Manager        │    │
  │  │ Store (S3)    │    │ (Airflow)    │    │                │    │
  │  │               │    │              │    │ - Per-airport   │    │
  │  │ objects/      │    │ - bsdiff     │    │   manifests    │    │
  │  │ refs/         │    │ - xml diff   │    │ - Version      │    │
  │  │ diffs/        │    │ - protobuf   │    │   compatibility│    │
  │  └───────┬───────┘    └──────┬───────┘    └───────┬────────┘    │
  │          │                   │                     │             │
  │  ┌───────┴───────────────────┴─────────────────────┴───────┐    │
  │  │                    Distribution API                      │    │
  │  │  GET /manifest/{airport}                                 │    │
  │  │  GET /tile/{airport}/{tile_id}/{version}                 │    │
  │  │  GET /diff/{airport}/{tile_id}/{from}/{to}               │    │
  │  │  GET /proof/{airport}/{tile_id}  (Merkle proof)          │    │
  │  │  POST /vehicle/report_version  (fleet version tracking)  │    │
  │  └───────────────────────┬──────────────────────────────────┘    │
  │                          │                                       │
  └──────────────────────────┼───────────────────────────────────────┘
                             │                                        
               ┌─────────────┼─────────────┐                         
               │             │             │                          
        ┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐                  
        │ Airport     │ │ Cloud  │ │ Airport     │                  
        │ Edge CDN    │ │ CDN    │ │ Edge CDN    │                  
        │ (local 5G)  │ │(S3/CF) │ │ (local 5G)  │                  
        │ Airport A   │ │        │ │ Airport B   │                  
        └──────┬──────┘ └────────┘ └──────┬──────┘                  
               │                          │                          
          ┌────┴────┐                ┌────┴────┐                    
          │Vehicles │                │Vehicles │                    
          │Airport A│                │Airport B│                    
          └─────────┘                └─────────┘                    
```

### 5.2 Distribution API

```python
"""Map Distribution API endpoints (FastAPI)."""

from fastapi import FastAPI, HTTPException, Response
from typing import Optional
import json

app = FastAPI(title="Map Distribution Service")

@app.get("/v1/manifest/{airport_icao}")
async def get_manifest(airport_icao: str, 
                        if_none_match: Optional[str] = None):
    """Get current airport map manifest.
    
    Supports ETag-based conditional GET to avoid re-downloading
    unchanged manifests. Vehicle polls this every 60 seconds.
    """
    manifest = manifest_store.get_latest(airport_icao)
    if manifest is None:
        raise HTTPException(404, f"No manifest for {airport_icao}")
    
    etag = manifest.manifest_hash[:16]
    if if_none_match == etag:
        return Response(status_code=304)  # Not modified
    
    return Response(
        content=manifest.to_json(),
        media_type="application/json",
        headers={"ETag": etag}
    )

@app.get("/v1/tile/{airport_icao}/{tile_id}/{version}")
async def get_tile(airport_icao: str, tile_id: str, version: str):
    """Download a full tile at a specific version.
    
    Returns zstd-compressed tile archive.
    """
    content = tile_store.get_tile(airport_icao, tile_id, version)
    if content is None:
        raise HTTPException(404, f"Tile {tile_id} v{version} not found")
    
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Encoding": "zstd",
            "X-Tile-Hash": tile_store.get_hash(airport_icao, tile_id, version),
        }
    )

@app.get("/v1/diff/{airport_icao}/{tile_id}/{from_ver}/{to_ver}")
async def get_diff(airport_icao: str, tile_id: str, 
                    from_ver: str, to_ver: str):
    """Download differential update between two tile versions.
    
    Returns 404 if diff not cached (vehicle should fall back to full tile).
    """
    diff = diff_store.get_diff(airport_icao, tile_id, from_ver, to_ver)
    if diff is None:
        raise HTTPException(404, "Diff not available, use full tile endpoint")
    
    return Response(
        content=diff.serialize(),
        media_type="application/octet-stream",
        headers={
            "X-Diff-Hash": diff.diff_hash,
            "X-From-Version": from_ver,
            "X-To-Version": to_ver,
        }
    )

@app.get("/v1/proof/{airport_icao}/{tile_id}")
async def get_merkle_proof(airport_icao: str, tile_id: str):
    """Get Merkle proof for a specific tile.
    
    Vehicle uses this to verify tile integrity without downloading
    the full manifest.
    """
    manifest = manifest_store.get_latest(airport_icao)
    proof = manifest.get_merkle_proof(tile_id)
    
    return {
        "tile_id": tile_id,
        "tile_hash": manifest.tiles[tile_id].content_hash,
        "proof": proof,
        "root_hash": manifest.merkle_root,
        "root_signature": manifest.manifest_signature,
    }

@app.post("/v1/vehicle/report_version")
async def report_version(report: dict):
    """Vehicle reports its current map version for fleet tracking.
    
    Called after every successful map swap and periodically (5 min).
    """
    fleet_tracker.update_vehicle(
        vehicle_id=report['vehicle_id'],
        airport=report['airport_icao'],
        tile_versions=report['tile_versions'],  # {tile_id: version}
        timestamp=report['timestamp'],
    )
    
    return {"status": "ok"}
```

### 5.3 Edge CDN for Airport-Local Distribution

Each airport has a local edge server (from `50-cloud-fleet/data-platform/cloud-backend-infrastructure.md`) that caches map tiles to avoid cloud roundtrips:

```
Airport edge server map cache:
- Stores current and previous 2 versions of all tiles for its airport
- Receives push notifications from cloud when new versions are available
- Vehicles download from edge server (LAN latency, no internet dependency)
- Cache size: ~3x airport map size = 3 x 1-2 GB = 3-6 GB
- Fallback: If edge is down, vehicles download directly from cloud CDN

Edge cache invalidation:
- Cloud pushes invalidation message when new tile version is available
- Edge server pre-fetches new tiles and diffs in background
- Old versions expire after 7 days (vehicles should have updated by then)
```

### 5.4 Bandwidth Budget

From `cloud-backend-infrastructure.md`: each vehicle has a 50 GB/day upload budget for sensor data. Map downloads are a tiny fraction:

```
Map update bandwidth (per vehicle per month):

Regular fleet SLAM updates:
  - ~5 tiles updated per week (geometry refinement)
  - Average diff size: 300 KB per tile
  - Monthly: 5 x 4 x 300 KB = 6 MB

AIRAC cycle update (every 28 days):
  - ~10 tiles affected (taxiway annotation changes)
  - Average diff size: 500 KB per tile (more extensive changes)
  - Monthly: 10 x 500 KB = 5 MB

Occasional full tile downloads:
  - ~2 tiles per month (diff chain exceeded, new area)
  - Average tile size: 8 MB
  - Monthly: 2 x 8 MB = 16 MB

TOTAL: ~27 MB/vehicle/month
  (= 0.002% of the 50 GB/day sensor upload budget)
  
50-vehicle fleet: ~1.35 GB/month map updates
  (= negligible compared to ~75 TB/month sensor data)
```

### 5.5 Pre-Staging During Charging

From `70-operations-domains/airside/business-case/fleet-tco-business-case.md`: vehicles return to charging depots on predictable schedules. Map updates are pre-staged during charging windows:

```
Pre-staging strategy:
1. Vehicle connects to depot WiFi (higher bandwidth than 5G)
2. Map update daemon checks for pending updates
3. Downloads diffs/tiles to staging partition
4. Verifies integrity (SHA-256, signature, Merkle proof)
5. Reports "staged and ready" to fleet manager
6. Atomic swap happens during next suitable operational window

Timing:
- Charging window: 30-60 minutes per session
- Map download: <5 minutes even for major AIRAC update
- Integrity verification: <30 seconds
- Leaves charging bandwidth free for rosbag upload (the real bottleneck)
```

### 5.6 Multi-Airport Fleet

Vehicles that travel between airports (e.g., Aurrigo ADT3 repositioning) need maps for multiple airports:

```
Multi-airport map management:
- Vehicle stores full tile set for home airport (always loaded)
- Vehicle pre-caches L0 overview tiles for all fleet airports (~10 MB each)
- When dispatched to another airport:
  1. Fleet dispatch signals "heading to EGLL" 30+ minutes in advance
  2. Vehicle downloads L1 tiles for EGLL operational area over 5G
  3. Full L1 tile set for medium airport: ~1.5 GB, download time ~5 min on 5G
  4. Vehicle verifies integrity before entering new airport ODD
  5. Home airport tiles kept on disk (not evicted) for return trip

Storage for multi-airport vehicle:
  Home airport L1:    ~1.5 GB
  Visited airport L1: ~1.5 GB
  L0 for 5 airports:  ~50 MB
  Rollback copies:    ~3 GB
  TOTAL:              ~6.5 GB (within 10 GB budget)
```

---

## 6. Vehicle-Side Map Storage

### 6.1 NVMe Partition Layout

```
Orin NVMe storage layout for map data:
                                                          
  /mapdata/                          (dedicated partition, 10 GB)
  ├── active/                        (current operational map)
  │   ├── manifest.json              (current manifest, immutable during operation)
  │   ├── tiles/                     
  │   │   ├── T+0000_+0000/         (one dir per loaded tile)
  │   │   │   ├── tile.meta.json    
  │   │   │   ├── pointcloud.pcd.zst
  │   │   │   ├── lanelet2.osm      
  │   │   │   └── ...               
  │   │   ├── T+0001_+0000/         
  │   │   └── ...                   
  │   └── index.json                (tile spatial index for lookup)
  │                                                       
  ├── staging/                       (incoming update, being assembled)
  │   ├── manifest.json              (target manifest)
  │   ├── tiles/                     (updated tiles only, not full copy)
  │   │   ├── T+0003_-0002/         (only tiles that changed)
  │   │   └── ...                   
  │   └── status.json               (download progress, verification status)
  │                                                       
  ├── rollback/                      (previous version for emergency revert)
  │   ├── manifest.json              
  │   ├── tiles/                     (only tiles that were replaced)
  │   │   ├── T+0003_-0002/         (old version of changed tiles)
  │   │   └── ...                   
  │   └── swap_log.json             (when swap happened, what changed)
  │                                                       
  └── cache/                         (LRU cache for recently used tiles)
      ├── lru_index.json             
      └── tiles/                     (tiles evicted from active but kept)
```

### 6.2 Memory-Mapped File Access

Point cloud tiles are memory-mapped for zero-copy access by the GTSAM localization node:

```cpp
// C++ tile loader with memory-mapped access
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>
#include <string>
#include <unordered_map>
#include <mutex>
#include <shared_mutex>

struct MappedTile {
    void* data;
    size_t size;
    int fd;
    std::string tile_id;
    std::string version;
};

class TileCache {
    /**
     * Memory-mapped tile cache with concurrent read access.
     * 
     * Multiple reader threads (GTSAM, Frenet, CBF) can access tiles
     * simultaneously. Write access (tile swap) requires exclusive lock.
     * 
     * Design: readers never block each other. Writers wait for all
     * readers to finish, then swap the pointer atomically.
     */
public:
    TileCache(const std::string& map_root, size_t max_cached_tiles = 30)
        : map_root_(map_root), max_cached_tiles_(max_cached_tiles) {}
    
    // Read access (shared lock) -- called by GTSAM, Frenet, CBF at 10+ Hz
    const MappedTile* get_tile(const std::string& tile_id) {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        auto it = tiles_.find(tile_id);
        if (it == tiles_.end()) return nullptr;
        return &it->second;
    }
    
    // Get tile containing a given ENU position
    const MappedTile* get_tile_at(double east, double north) {
        std::shared_lock<std::shared_mutex> lock(mutex_);
        int col = static_cast<int>(std::floor((east - origin_east_) / tile_size_));
        int row = static_cast<int>(std::floor((north - origin_north_) / tile_size_));
        char tile_id[32];
        snprintf(tile_id, sizeof(tile_id), "T%+04d_%+04d", col, row);
        auto it = tiles_.find(std::string(tile_id));
        if (it == tiles_.end()) return nullptr;
        return &it->second;
    }
    
    // Load a tile from disk (exclusive lock during insertion)
    bool load_tile(const std::string& tile_id, const std::string& layer) {
        std::string path = map_root_ + "/active/tiles/" + tile_id + "/" + layer;
        
        int fd = open(path.c_str(), O_RDONLY);
        if (fd < 0) return false;
        
        struct stat st;
        fstat(fd, &st);
        
        void* data = mmap(nullptr, st.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
        if (data == MAP_FAILED) {
            close(fd);
            return false;
        }
        
        // Advise kernel for sequential access (LiDAR scan matching)
        madvise(data, st.st_size, MADV_SEQUENTIAL);
        
        MappedTile tile{data, static_cast<size_t>(st.st_size), fd, tile_id, ""};
        
        {
            std::unique_lock<std::shared_mutex> lock(mutex_);
            evict_if_needed();
            tiles_[tile_id] = tile;
        }
        
        return true;
    }
    
    // Atomic swap: replace one tile version with another
    // Called during map update -- see Section 7
    bool swap_tile(const std::string& tile_id, 
                   const std::string& new_path) {
        // Load new tile data
        int new_fd = open(new_path.c_str(), O_RDONLY);
        if (new_fd < 0) return false;
        
        struct stat st;
        fstat(new_fd, &st);
        void* new_data = mmap(nullptr, st.st_size, PROT_READ, MAP_PRIVATE, new_fd, 0);
        if (new_data == MAP_FAILED) {
            close(new_fd);
            return false;
        }
        
        MappedTile new_tile{new_data, static_cast<size_t>(st.st_size), new_fd, tile_id, ""};
        
        {
            // Exclusive lock -- blocks all readers briefly
            std::unique_lock<std::shared_mutex> lock(mutex_);
            
            auto it = tiles_.find(tile_id);
            if (it != tiles_.end()) {
                // Unmap old tile
                munmap(it->second.data, it->second.size);
                close(it->second.fd);
            }
            
            tiles_[tile_id] = new_tile;
        }
        // Readers now see new tile -- lock released
        
        return true;
    }

private:
    void evict_if_needed() {
        // LRU eviction when cache exceeds limit
        while (tiles_.size() >= max_cached_tiles_) {
            // Evict tile furthest from vehicle's last known position
            // (implementation omitted for brevity -- uses LRU timestamps)
            auto oldest = tiles_.begin();
            munmap(oldest->second.data, oldest->second.size);
            close(oldest->second.fd);
            tiles_.erase(oldest);
        }
    }
    
    std::string map_root_;
    size_t max_cached_tiles_;
    double tile_size_ = 100.0;
    double origin_east_ = 0.0;
    double origin_north_ = 0.0;
    std::unordered_map<std::string, MappedTile> tiles_;
    mutable std::shared_mutex mutex_;
};
```

### 6.3 Tile Prefetching

The map client prefetches tiles along the vehicle's planned route to avoid loading latency:

```python
class TilePrefetcher:
    """Prefetch tiles along the planned route.
    
    Maintains a sliding window of loaded tiles centered on the vehicle,
    plus tiles ahead on the current route. Evicts tiles behind the vehicle.
    """
    
    PREFETCH_DISTANCE_M = 300.0    # Prefetch 3 tiles ahead (at 100m/tile)
    LOAD_DISTANCE_M = 150.0        # Load tiles within 1.5 tile widths
    EVICT_DISTANCE_M = 500.0       # Evict tiles >5 tiles behind
    
    def __init__(self, tile_cache, tile_size: float = 100.0):
        self.cache = tile_cache
        self.tile_size = tile_size
        self.loaded_tiles = set()
    
    def update(self, vehicle_east: float, vehicle_north: float,
               route_points: list):
        """Called at 1 Hz by map management node.
        
        1. Determine which tiles are needed (near vehicle + along route)
        2. Load missing tiles from disk
        3. Evict distant tiles from memory
        """
        needed_tiles = set()
        
        # Tiles near vehicle (always load surrounding tiles)
        for de in [-1, 0, 1]:
            for dn in [-1, 0, 1]:
                east = vehicle_east + de * self.tile_size
                north = vehicle_north + dn * self.tile_size
                tile_id = self._pos_to_tile_id(east, north)
                needed_tiles.add(tile_id)
        
        # Tiles along route (prefetch ahead)
        for point in route_points:
            dist = ((point[0] - vehicle_east)**2 + 
                    (point[1] - vehicle_north)**2)**0.5
            if dist > self.PREFETCH_DISTANCE_M:
                break
            tile_id = self._pos_to_tile_id(point[0], point[1])
            needed_tiles.add(tile_id)
        
        # Load missing tiles
        for tile_id in needed_tiles:
            if tile_id not in self.loaded_tiles:
                if self.cache.load_tile(tile_id, "pointcloud.pcd.zst"):
                    self.loaded_tiles.add(tile_id)
        
        # Evict distant tiles
        evict = set()
        for tile_id in self.loaded_tiles:
            tile_center = self._tile_id_to_center(tile_id)
            dist = ((tile_center[0] - vehicle_east)**2 + 
                    (tile_center[1] - vehicle_north)**2)**0.5
            if dist > self.EVICT_DISTANCE_M and tile_id not in needed_tiles:
                evict.add(tile_id)
        
        for tile_id in evict:
            self.cache.evict_tile(tile_id)
            self.loaded_tiles.discard(tile_id)
    
    def _pos_to_tile_id(self, east: float, north: float) -> str:
        col = int(east // self.tile_size)
        row = int(north // self.tile_size)
        return f"T{col:+04d}_{row:+04d}"
    
    def _tile_id_to_center(self, tile_id: str) -> tuple:
        parts = tile_id[1:].split('_')
        col = int(parts[0])
        row = int(parts[1])
        return (col * self.tile_size + self.tile_size / 2,
                row * self.tile_size + self.tile_size / 2)
```

### 6.4 Storage Budget Analysis

```
Per-airport vehicle storage:

Active map (L1 tiles):
  Medium airport, 120 tiles x 8 MB avg = 960 MB
  L0 overview, 4 tiles x 5 MB = 20 MB
  L2 detail (stands only), 30 tiles x 2 MB = 60 MB
  Subtotal: ~1.0 GB

Staging area (changed tiles only):
  Typical update: 5-15 tiles = 40-120 MB
  Maximum (AIRAC): 30 tiles = 240 MB
  Subtotal: ~250 MB reserved

Rollback (previous versions of swapped tiles):
  Same as staging: ~250 MB reserved

Cache (recently evicted):
  ~500 MB LRU

TOTAL per airport: ~2.0 GB
TOTAL for 2 airports: ~4.0 GB
Within 10 GB budget with 6 GB headroom for diffs, temp files.
```

---

## 7. Atomic Map Swap Protocol

### 7.1 The Core Problem

A map swap must satisfy all of the following simultaneously:

1. **No perception gap**: GTSAM cannot skip a localization cycle (10 Hz = 100ms period)
2. **No localization jump**: If new map shifts geometry, GTSAM's pose estimate must not jump discontinuously
3. **Consistency**: All consumers (GTSAM, Frenet, CBF, geofence) must see the same map version at any given instant
4. **Rollback capability**: If the new map degrades localization, revert within seconds
5. **No swap during critical ops**: Docking, runway crossing, emergency must never be interrupted

### 7.2 Two-Phase Swap Protocol

```
Phase 1: STAGE (background, can take minutes)
  1. Download diff/tile to staging partition
  2. Apply diff to produce new tile files
  3. Verify SHA-256 of each new tile layer
  4. Verify Merkle proof against signed manifest
  5. Run offline validation:
     a. Lanelet2 topology check (no disconnected graphs)
     b. Geofence polygon validity (no self-intersections)
     c. Point cloud density check (no empty voxel regions)
  6. Mark staging as "VERIFIED_READY"

Phase 2: SWAP (atomic, <100ms)
  Preconditions (ALL must be true):
  - staging/status.json == "VERIFIED_READY"
  - vehicle_state != DOCKING
  - vehicle_state != RUNWAY_CROSSING
  - vehicle_state != EMERGENCY
  - nearest_obstacle_distance > 5.0m
  - localization_confidence > 0.9
  - vehicle_speed < 15.0 km/h
  - current_segment == STRAIGHT_TAXIWAY (no intersection, no curve)
  
  Execution:
  1. Set swap_in_progress flag (prevents concurrent operations)
  2. Snapshot current GTSAM pose and covariance
  3. For each updated tile:
     a. Move active tile to rollback/
     b. Move staged tile to active/
     (rename operations are atomic on ext4/xfs)
  4. Update active/manifest.json (atomic write via temp+rename)
  5. Signal GTSAM to reload affected tiles
  6. GTSAM performs one localization cycle with new map
  7. Compare new pose with pre-swap pose:
     - Position delta < 0.3m: ACCEPT
     - Position delta 0.3-0.5m: ACCEPT with warning
     - Position delta > 0.5m: ROLLBACK immediately
  8. Clear swap_in_progress flag
  9. Report new version to fleet manager
```

### 7.3 Swap Protocol Implementation

```python
import os
import json
import time
import shutil
from enum import Enum
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List

class SwapState(Enum):
    IDLE = "idle"
    STAGING = "staging"
    VERIFIED = "verified"
    SWAPPING = "swapping"
    ROLLING_BACK = "rolling_back"

class VehicleOperationalState(Enum):
    NORMAL_TRANSIT = "normal_transit"
    INTERSECTION = "intersection"
    STAND_APPROACH = "stand_approach"
    DOCKING = "docking"
    RUNWAY_CROSSING = "runway_crossing"
    EMERGENCY = "emergency"

@dataclass
class SwapPreconditions:
    vehicle_state: VehicleOperationalState
    nearest_obstacle_m: float
    localization_confidence: float
    vehicle_speed_kmh: float
    is_straight_segment: bool
    gtsam_pose: tuple              # (x, y, z, qw, qx, qy, qz)
    gtsam_covariance: list         # 6x6 covariance matrix

class AtomicMapSwap:
    """Manages the atomic map swap protocol.
    
    Guarantees:
    - No perception gap (swap is <100ms, within one GTSAM cycle)
    - Rollback within 5 seconds if localization degrades
    - Never swaps during critical operations
    """
    
    POSITION_ACCEPT_THRESHOLD_M = 0.3
    POSITION_WARN_THRESHOLD_M = 0.5
    POSITION_REJECT_THRESHOLD_M = 0.5
    ROLLBACK_TIMEOUT_S = 5.0
    POST_SWAP_MONITOR_S = 30.0
    
    def __init__(self, map_root: str, tile_cache, gtsam_interface,
                 vehicle_state_interface):
        self.map_root = Path(map_root)
        self.active_dir = self.map_root / "active"
        self.staging_dir = self.map_root / "staging"
        self.rollback_dir = self.map_root / "rollback"
        self.cache = tile_cache
        self.gtsam = gtsam_interface
        self.vehicle = vehicle_state_interface
        self.state = SwapState.IDLE
        self._swap_log = []
    
    def check_preconditions(self) -> tuple:
        """Check if swap is safe to execute right now.
        
        Returns (safe: bool, reason: str, preconditions: SwapPreconditions).
        """
        pre = SwapPreconditions(
            vehicle_state=self.vehicle.get_operational_state(),
            nearest_obstacle_m=self.vehicle.get_nearest_obstacle_distance(),
            localization_confidence=self.gtsam.get_confidence(),
            vehicle_speed_kmh=self.vehicle.get_speed_kmh(),
            is_straight_segment=self.vehicle.is_straight_segment(),
            gtsam_pose=self.gtsam.get_current_pose(),
            gtsam_covariance=self.gtsam.get_covariance(),
        )
        
        # Hard blocks
        blocked_states = {
            VehicleOperationalState.DOCKING,
            VehicleOperationalState.RUNWAY_CROSSING,
            VehicleOperationalState.EMERGENCY,
        }
        if pre.vehicle_state in blocked_states:
            return False, f"Vehicle in {pre.vehicle_state.value}", pre
        
        if pre.nearest_obstacle_m < 5.0:
            return False, f"Obstacle too close: {pre.nearest_obstacle_m:.1f}m", pre
        
        if pre.localization_confidence < 0.9:
            return False, f"Low localization confidence: {pre.localization_confidence:.2f}", pre
        
        if pre.vehicle_speed_kmh > 15.0:
            return False, f"Speed too high: {pre.vehicle_speed_kmh:.1f} km/h", pre
        
        if not pre.is_straight_segment:
            return False, "Not on straight segment", pre
        
        return True, "All preconditions met", pre
    
    def execute_swap(self) -> dict:
        """Execute the atomic map swap.
        
        Returns result dict with success/failure and diagnostics.
        """
        if self.state != SwapState.IDLE:
            return {'success': False, 'reason': f'Swap already in state {self.state.value}'}
        
        # Verify staging is ready
        status_file = self.staging_dir / "status.json"
        if not status_file.exists():
            return {'success': False, 'reason': 'No staged update'}
        
        status = json.loads(status_file.read_text())
        if status['state'] != 'VERIFIED_READY':
            return {'success': False, 'reason': f'Staging not ready: {status["state"]}'}
        
        # Check preconditions
        safe, reason, pre = self.check_preconditions()
        if not safe:
            return {'success': False, 'reason': reason}
        
        # Begin swap
        self.state = SwapState.SWAPPING
        swap_start = time.monotonic()
        
        try:
            # Determine which tiles changed
            staged_manifest = json.loads(
                (self.staging_dir / "manifest.json").read_text()
            )
            changed_tiles = [
                tid for tid in staged_manifest.get('updated_tiles', [])
            ]
            
            # Step 1: Move current tiles to rollback
            self._clear_rollback()
            for tile_id in changed_tiles:
                src = self.active_dir / "tiles" / tile_id
                dst = self.rollback_dir / "tiles" / tile_id
                if src.exists():
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    # Rename is atomic on same filesystem
                    src.rename(dst)
            
            # Save current manifest to rollback
            shutil.copy2(
                self.active_dir / "manifest.json",
                self.rollback_dir / "manifest.json"
            )
            
            # Step 2: Move staged tiles to active
            for tile_id in changed_tiles:
                src = self.staging_dir / "tiles" / tile_id
                dst = self.active_dir / "tiles" / tile_id
                if src.exists():
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    src.rename(dst)
            
            # Step 3: Update manifest atomically (write tmp, then rename)
            new_manifest_path = self.active_dir / "manifest.json"
            tmp_manifest = new_manifest_path.with_suffix('.json.tmp')
            shutil.copy2(
                self.staging_dir / "manifest.json",
                tmp_manifest
            )
            tmp_manifest.rename(new_manifest_path)
            
            # Step 4: Reload tiles in memory cache
            for tile_id in changed_tiles:
                self.cache.swap_tile(
                    tile_id,
                    str(self.active_dir / "tiles" / tile_id / "pointcloud.pcd.zst")
                )
            
            swap_duration = time.monotonic() - swap_start
            
            # Step 5: Verify localization continuity
            time.sleep(0.15)  # Wait for one GTSAM cycle (100ms + margin)
            
            new_pose = self.gtsam.get_current_pose()
            position_delta = (
                (new_pose[0] - pre.gtsam_pose[0])**2 +
                (new_pose[1] - pre.gtsam_pose[1])**2 +
                (new_pose[2] - pre.gtsam_pose[2])**2
            )**0.5
            
            if position_delta > self.POSITION_REJECT_THRESHOLD_M:
                # Localization jumped too much -- rollback
                self._rollback(changed_tiles)
                self.state = SwapState.IDLE
                return {
                    'success': False,
                    'reason': f'Localization jump {position_delta:.3f}m exceeds threshold',
                    'position_delta_m': position_delta,
                    'swap_duration_ms': swap_duration * 1000,
                    'action': 'rolled_back',
                }
            
            # Success
            self.state = SwapState.IDLE
            
            # Log swap
            swap_record = {
                'timestamp': time.time(),
                'changed_tiles': changed_tiles,
                'swap_duration_ms': swap_duration * 1000,
                'position_delta_m': position_delta,
                'pre_swap_pose': pre.gtsam_pose,
                'post_swap_pose': new_pose,
                'pre_swap_confidence': pre.localization_confidence,
                'vehicle_speed_kmh': pre.vehicle_speed_kmh,
            }
            self._swap_log.append(swap_record)
            (self.rollback_dir / "swap_log.json").write_text(
                json.dumps(swap_record, indent=2)
            )
            
            return {
                'success': True,
                'changed_tiles': changed_tiles,
                'position_delta_m': position_delta,
                'swap_duration_ms': swap_duration * 1000,
                'warning': position_delta > self.POSITION_ACCEPT_THRESHOLD_M,
            }
        
        except Exception as e:
            # Any exception during swap: rollback
            self._rollback(changed_tiles)
            self.state = SwapState.IDLE
            return {
                'success': False,
                'reason': f'Exception during swap: {str(e)}',
                'action': 'rolled_back',
            }
    
    def _rollback(self, changed_tiles: List[str]):
        """Emergency rollback: restore tiles from rollback partition."""
        self.state = SwapState.ROLLING_BACK
        
        for tile_id in changed_tiles:
            rollback_src = self.rollback_dir / "tiles" / tile_id
            active_dst = self.active_dir / "tiles" / tile_id
            
            # Remove the new (bad) tile
            if active_dst.exists():
                shutil.rmtree(active_dst)
            
            # Restore the old tile
            if rollback_src.exists():
                rollback_src.rename(active_dst)
            
            # Reload in memory
            self.cache.swap_tile(
                tile_id,
                str(active_dst / "pointcloud.pcd.zst")
            )
        
        # Restore manifest
        rollback_manifest = self.rollback_dir / "manifest.json"
        if rollback_manifest.exists():
            active_manifest = self.active_dir / "manifest.json"
            tmp = active_manifest.with_suffix('.json.tmp')
            shutil.copy2(rollback_manifest, tmp)
            tmp.rename(active_manifest)
        
        self.state = SwapState.IDLE
    
    def _clear_rollback(self):
        """Clear old rollback data before new swap."""
        if self.rollback_dir.exists():
            shutil.rmtree(self.rollback_dir)
        self.rollback_dir.mkdir(parents=True)
        (self.rollback_dir / "tiles").mkdir()
```

### 7.4 Post-Swap Monitoring

After a successful swap, the map manager monitors localization quality for 30 seconds:

```python
class PostSwapMonitor:
    """Monitor localization quality after map swap.
    
    If quality degrades within 30 seconds, trigger automatic rollback.
    This catches subtle issues that the immediate pose-jump check misses
    (e.g., reduced feature density causing gradual drift).
    """
    
    MONITOR_DURATION_S = 30.0
    CONFIDENCE_THRESHOLD = 0.8     # Below this triggers rollback
    DRIFT_RATE_THRESHOLD = 0.05    # m/s of position uncertainty growth
    
    def __init__(self, gtsam_interface, swap_controller: AtomicMapSwap):
        self.gtsam = gtsam_interface
        self.swap = swap_controller
        self.monitoring = False
        self.samples = []
    
    def start_monitoring(self, changed_tiles: list):
        """Begin 30-second monitoring window after successful swap."""
        self.monitoring = True
        self.changed_tiles = changed_tiles
        self.start_time = time.monotonic()
        self.samples = []
    
    def check(self) -> Optional[str]:
        """Called at 10 Hz during monitoring window.
        
        Returns None if OK, or reason string if rollback needed.
        """
        if not self.monitoring:
            return None
        
        elapsed = time.monotonic() - self.start_time
        if elapsed > self.MONITOR_DURATION_S:
            self.monitoring = False
            return None  # Monitoring period passed successfully
        
        confidence = self.gtsam.get_confidence()
        position_cov = self.gtsam.get_position_covariance_trace()
        
        self.samples.append({
            'time': elapsed,
            'confidence': confidence,
            'position_cov': position_cov,
        })
        
        # Check absolute confidence
        if confidence < self.CONFIDENCE_THRESHOLD:
            self.monitoring = False
            self.swap._rollback(self.changed_tiles)
            return f"Confidence dropped to {confidence:.2f}"
        
        # Check drift rate (need at least 5 seconds of data)
        if elapsed > 5.0 and len(self.samples) > 50:
            recent = self.samples[-50:]
            cov_start = recent[0]['position_cov']
            cov_end = recent[-1]['position_cov']
            time_delta = recent[-1]['time'] - recent[0]['time']
            drift_rate = (cov_end - cov_start) / max(time_delta, 0.001)
            
            if drift_rate > self.DRIFT_RATE_THRESHOLD:
                self.monitoring = False
                self.swap._rollback(self.changed_tiles)
                return f"Drift rate {drift_rate:.4f} m/s exceeds threshold"
        
        return None
```

### 7.5 Swap Timing Analysis

```
Swap operation timing breakdown (measured on Orin AGX):

File operations (rename tile directories):
  - Per tile: 0.1-0.5 ms (ext4 rename is O(1))
  - 10 tiles: 1-5 ms

Manifest atomic write (tmp + rename):
  - 0.5-1 ms

Memory-mapped tile reload:
  - Per tile: 2-5 ms (mmap + madvise)
  - 10 tiles: 20-50 ms

GTSAM re-registration with new map:
  - Single VGICP cycle: 10-20 ms

TOTAL swap time: 30-75 ms
  (Well within the 100ms GTSAM cycle)

Worst case (30 tiles, AIRAC update):
  - File ops: 15 ms
  - mmap reload: 150 ms  (may span 2 GTSAM cycles)
  - Mitigation: Split into 2 swap batches of 15 tiles each,
    each completing within one cycle. Tiles are swapped in
    spatial order along the vehicle's direction of travel.
```

---

## 8. In-Flight Map Consistency

### 8.1 Local Map Patches

Between official map updates, vehicles encounter changes that are not yet in the map (from `hd-map-change-detection-maintenance.md`). These are handled as local patches overlaid on the base map:

```
Local patch types:
1. Temporary obstacle (barrier, cone, parked equipment)
   - Source: Vehicle perception
   - Lifetime: Current session or until fleet consensus
   - Action: Add to dynamic obstacle layer (L7)

2. Fleet-detected geometry change (moved jet bridge, new barrier)
   - Source: Fleet change detection consensus
   - Lifetime: Until next official map update
   - Action: Local patch on L2 (geometry) or L3 (semantics)

3. NOTAM-driven closure
   - Source: NOTAM feed parser
   - Lifetime: NOTAM validity period
   - Action: Overlay on L5 (topology graph) -- block affected edges
```

```python
@dataclass
class LocalMapPatch:
    """Temporary local modification overlaid on the base map."""
    
    patch_id: str                     # UUID
    tile_id: str                      # Which tile this affects
    patch_type: str                   # "obstacle", "geometry", "closure", "annotation"
    geometry: dict                    # GeoJSON geometry of the patch
    layer: str                        # Which map layer is patched
    action: str                       # "add", "modify", "block"
    
    # Lifecycle
    created_at: float                 # Unix timestamp
    expires_at: Optional[float]       # None = permanent until superseded
    source: str                       # "perception", "fleet_consensus", "notam", "operator"
    confidence: float                 # 0.0-1.0
    
    # Conflict resolution
    overrides_base_map: bool          # True if this contradicts the base map
    requires_confirmation: bool       # True if needs fleet/human confirmation

class LocalPatchManager:
    """Manage local map patches overlaid on the base tiled map.
    
    Patches are stored separately from base tiles and applied at query time.
    This keeps the base map immutable between official updates while
    allowing real-time adaptation to environmental changes.
    """
    
    def __init__(self, map_root: str, max_patches_per_tile: int = 50):
        self.map_root = Path(map_root)
        self.patches_dir = self.map_root / "patches"
        self.patches_dir.mkdir(exist_ok=True)
        self.patches: dict = {}  # tile_id -> [LocalMapPatch]
        self.max_per_tile = max_patches_per_tile
    
    def add_patch(self, patch: LocalMapPatch) -> bool:
        """Add a local patch. Returns True if accepted."""
        tile_patches = self.patches.get(patch.tile_id, [])
        
        # Check for conflicting patches
        for existing in tile_patches:
            if self._patches_conflict(existing, patch):
                if patch.confidence > existing.confidence:
                    tile_patches.remove(existing)
                else:
                    return False  # Existing patch has higher confidence
        
        # Enforce per-tile limit
        if len(tile_patches) >= self.max_per_tile:
            # Evict lowest-confidence patch
            tile_patches.sort(key=lambda p: p.confidence)
            tile_patches.pop(0)
        
        tile_patches.append(patch)
        self.patches[patch.tile_id] = tile_patches
        
        # Persist to disk
        self._save_patches(patch.tile_id)
        return True
    
    def get_patches(self, tile_id: str) -> List[LocalMapPatch]:
        """Get all active patches for a tile, excluding expired ones."""
        now = time.time()
        tile_patches = self.patches.get(tile_id, [])
        active = [p for p in tile_patches 
                  if p.expires_at is None or p.expires_at > now]
        return active
    
    def incorporate_into_update(self, tile_id: str, 
                                 new_version: str) -> List[str]:
        """When a tile is officially updated, check which patches
        are now incorporated and can be removed.
        
        Returns list of removed patch IDs.
        """
        removed = []
        remaining = []
        
        for patch in self.patches.get(tile_id, []):
            if patch.source in ('fleet_consensus', 'notam'):
                # These should be incorporated in official updates
                removed.append(patch.patch_id)
            else:
                remaining.append(patch)
        
        self.patches[tile_id] = remaining
        self._save_patches(tile_id)
        return removed
    
    def _patches_conflict(self, a: LocalMapPatch, b: LocalMapPatch) -> bool:
        """Check if two patches affect the same spatial area and layer."""
        if a.layer != b.layer:
            return False
        # Simplified: check bounding box overlap
        # Full implementation would use polygon intersection
        return a.tile_id == b.tile_id and a.action == b.action
    
    def _save_patches(self, tile_id: str):
        """Persist patches to disk for recovery after restart."""
        patch_file = self.patches_dir / f"{tile_id}.json"
        patches = self.patches.get(tile_id, [])
        data = [vars(p) for p in patches]
        # Atomic write
        tmp = patch_file.with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, indent=2))
        tmp.rename(patch_file)
```

### 8.2 Conflict Resolution

When a vehicle's local observation conflicts with the official map:

```
Conflict resolution hierarchy (highest priority first):

1. Safety geofence (runway exclusion, hold-short)
   -> ALWAYS trust the official map unless NOTAM explicitly overrides
   -> Rationale: geofences are safety-critical, perception can be wrong

2. NOTAM-driven changes
   -> Trust NOTAM over base map (NOTAM is regulatory)
   -> Apply as local patch immediately

3. Fleet consensus (>5 vehicles, >0.9 confidence)
   -> Trust fleet over single vehicle observation
   -> Apply as provisional patch, flag for next official update

4. Single vehicle observation
   -> Log for fleet consensus, do NOT modify map
   -> Exception: if obstacle creates immediate safety risk,
      add to dynamic layer (L7) but not base map

5. Stale fleet data (>7 days old, no recent confirmation)
   -> Expire patch, revert to base map
   -> Rationale: temporary changes may have been removed
```

### 8.3 Eventually Consistent Model

The map system is eventually consistent: different vehicles may have slightly different views of the map at any given instant, but all converge to the same state within a bounded time window:

```
Consistency guarantees:

Strong consistency (all vehicles see identical map for):
  - Runway exclusion geofences: Updated within 1 AIRAC cycle
  - Hold-short lines: Updated within 1 hour of NOTAM
  - Safety-critical topology: Forced update, max 4 hours

Eventual consistency (vehicles converge within hours):
  - Fleet SLAM geometry refinements: 2-8 hours
  - Non-safety annotation updates: 4-24 hours
  - Occupancy/SDF refinements: Next charging cycle

Weak consistency (informational, no convergence requirement):
  - Dynamic layer (L7): Each vehicle sees its own perception
  - Local patches: Vehicle-specific until fleet consensus
```

---

## 9. AIRAC Cycle Integration

### 9.1 AIRAC Calendar and Map Updates

From `hd-map-change-detection-maintenance.md` Section 6: AIRAC cycles are 28 days, with changes published 42 days before the effective date.

```
AIRAC timeline for map updates:

T-42 days: AIRAC data published
           -> Parse new AMDB/AMXM for changes affecting our airport(s)
           -> Compare with current map tiles
           -> Identify affected tiles

T-35 days: Impact assessment
           -> Classify changes: topology (MAJOR), geometry (MINOR), metadata (PATCH)
           -> Estimate diff sizes
           -> Plan deployment timeline

T-21 days: Map update prepared
           -> Generate new tile versions incorporating AIRAC changes
           -> Compute diffs from current fleet version
           -> Run automated QA (topology, geofence, regression)

T-14 days: Canary deployment
           -> Push to 10% of fleet (canary vehicles)
           -> Monitor localization quality for 48 hours
           -> Compare perception consistency on overlapping routes

T-7 days:  Fleet-wide distribution
           -> Push to all vehicles during charging windows
           -> Monitor for 24 hours

T-0 (effective): AIRAC effective date (0000 UTC)
           -> All vehicles MUST be on new version
           -> Vehicles still on old version: force update or ground
           -> Old version marked as DEPRECATED in manifest

T+28 days: Old version marked as EXPIRED
           -> Rollback to expired version no longer permitted
           -> Old tile versions eligible for garbage collection
```

### 9.2 AIRAC Change Classification

```python
class AIRACChangeClassifier:
    """Classify AIRAC changes by impact on map tiles."""
    
    # Changes that require MAJOR tile version bump
    TOPOLOGY_CHANGES = {
        'new_taxiway',
        'closed_taxiway',
        'new_stand',
        'closed_stand',
        'runway_threshold_change',
        'new_holding_position',
        'removed_holding_position',
    }
    
    # Changes that require MINOR tile version bump
    GEOMETRY_CHANGES = {
        'taxiway_edge_refinement',
        'stand_guidance_line_update',
        'apron_boundary_change',
        'service_road_realignment',
        'de_icing_area_resize',
    }
    
    # Changes that require PATCH tile version bump
    METADATA_CHANGES = {
        'stand_renumbering',
        'frequency_zone_change',
        'speed_limit_change',
        'designation_change',        # e.g., Taxiway Alpha -> Taxiway Alfa
    }
    
    def classify_airac_delta(self, old_amdb: dict, new_amdb: dict) -> list:
        """Compare two AMDB versions and classify changes.
        
        Returns list of (tile_id, change_type, severity, description).
        """
        changes = []
        
        # Compare features by AMDB feature ID
        old_features = {f['id']: f for f in old_amdb['features']}
        new_features = {f['id']: f for f in new_amdb['features']}
        
        # Removed features
        for fid in old_features:
            if fid not in new_features:
                feat = old_features[fid]
                tile_id = self._feature_to_tile(feat)
                change_type = self._classify_removal(feat)
                changes.append((tile_id, change_type, 'removed', 
                               f"Removed {feat['type']} {feat.get('name', fid)}"))
        
        # Added features
        for fid in new_features:
            if fid not in old_features:
                feat = new_features[fid]
                tile_id = self._feature_to_tile(feat)
                change_type = self._classify_addition(feat)
                changes.append((tile_id, change_type, 'added',
                               f"Added {feat['type']} {feat.get('name', fid)}"))
        
        # Modified features
        for fid in old_features:
            if fid in new_features:
                old_f = old_features[fid]
                new_f = new_features[fid]
                if old_f != new_f:
                    tile_id = self._feature_to_tile(new_f)
                    change_type = self._classify_modification(old_f, new_f)
                    changes.append((tile_id, change_type, 'modified',
                                   f"Modified {new_f['type']} {new_f.get('name', fid)}"))
        
        return changes
    
    def _classify_removal(self, feature: dict) -> str:
        if feature['type'] in ('TaxiwayElement', 'StandGuidanceLine', 
                                'HoldingPosition', 'RunwayElement'):
            return 'MAJOR'
        if feature['type'] in ('PaintedCenterline', 'ApronElement'):
            return 'MINOR'
        return 'PATCH'
    
    def _classify_addition(self, feature: dict) -> str:
        # Same logic as removal -- structural changes are MAJOR
        return self._classify_removal(feature)
    
    def _classify_modification(self, old: dict, new: dict) -> str:
        # Geometry change on safety feature = MAJOR
        if old['type'] in ('HoldingPosition', 'RunwayElement'):
            if old.get('geometry') != new.get('geometry'):
                return 'MAJOR'
        # Geometry refinement on non-safety feature = MINOR
        if old.get('geometry') != new.get('geometry'):
            return 'MINOR'
        # Attribute-only change = PATCH
        return 'PATCH'
```

### 9.3 Mandatory vs Optional Updates

```
Update classification by urgency:

MANDATORY (must apply before deadline):
  - AIRAC topology changes (new/closed taxiways, stands, holding positions)
  - Safety geofence changes (runway exclusion zones)
  - Regulatory changes referenced by NOTAM
  - Deadline: AIRAC effective date or NOTAM effective time
  - Vehicles that miss deadline: grounded until updated

STRONGLY RECOMMENDED (should apply within 24 hours):
  - AIRAC geometry refinements
  - Fleet consensus safety-relevant changes (new permanent obstacles)
  - Localization quality improvements (>5% position accuracy gain)

OPTIONAL (apply at next convenient charging window):
  - Fleet SLAM geometry refinements (<5% improvement)
  - Annotation corrections (non-safety labels)
  - Occupancy/SDF updates
  - Metadata changes (stand renumbering without topology impact)
```

---

## 10. Map Integrity and Safety

### 10.1 Cryptographic Signing Chain

```
Chain of trust for map data:

  Map Build Authority (offline server)
         │
         │ Ed25519 signing key (HSM-protected)
         │
         ▼
  Airport Manifest
    - Signed by build authority
    - Contains Merkle root over all tile hashes
         │
         ▼
  Tile Content Hash
    - SHA-256 of all layer files
    - Verified against Merkle proof from manifest
         │
         ▼
  Layer File Hash
    - SHA-256 of each compressed layer file
    - Verified during tile loading
         │
         ▼
  Vehicle Map Client
    - Has build authority public key (baked into firmware)
    - Verifies manifest signature before any processing
    - Rejects tiles that fail hash verification
```

```python
"""Map integrity verification using Ed25519 signatures and Merkle proofs."""

from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
import hashlib
import json
from typing import Optional

class MapIntegrityVerifier:
    """Verify map tile integrity from manifest signature through layer hashes.
    
    Three levels of verification:
    1. Manifest signature (Ed25519) -- proves manifest came from trusted authority
    2. Merkle proof -- proves tile hash is in the signed manifest
    3. Layer hashes (SHA-256) -- proves tile content matches manifest
    """
    
    def __init__(self, authority_public_key_hex: str):
        """Initialize with the map build authority's public key.
        
        This key is baked into vehicle firmware and never changes
        without a full system update (not a map update).
        """
        self.verify_key = VerifyKey(bytes.fromhex(authority_public_key_hex))
    
    def verify_manifest(self, manifest_json: str) -> tuple:
        """Verify manifest signature.
        
        Returns (valid: bool, manifest: dict or None, error: str or None).
        """
        try:
            manifest = json.loads(manifest_json)
        except json.JSONDecodeError as e:
            return False, None, f"Invalid JSON: {e}"
        
        signature_hex = manifest.get('manifest_signature')
        if not signature_hex:
            return False, None, "Missing signature"
        
        # Compute hash of manifest content (excluding signature field)
        manifest_for_hash = {k: v for k, v in manifest.items() 
                             if k != 'manifest_signature'}
        content = json.dumps(manifest_for_hash, sort_keys=True).encode('utf-8')
        content_hash = hashlib.sha256(content).digest()
        
        try:
            self.verify_key.verify(content_hash, bytes.fromhex(signature_hex))
            return True, manifest, None
        except BadSignatureError:
            return False, None, "Invalid signature"
    
    def verify_tile_merkle(self, tile_id: str, tile_hash: str,
                            merkle_proof: list, expected_root: str) -> bool:
        """Verify a tile's hash against the Merkle root from the manifest."""
        tree = MerkleTree([])  # Empty tree, just using verify method
        return tree.verify_proof(tile_hash, merkle_proof, expected_root)
    
    def verify_tile_content(self, tile_dir: str, 
                             expected_meta: TileMetadata) -> dict:
        """Verify all layer files in a tile match expected hashes.
        
        Returns dict with per-layer verification results.
        """
        results = {}
        all_ok = True
        
        for layer in expected_meta.layers:
            file_path = os.path.join(tile_dir, layer.file_name)
            
            if not os.path.exists(file_path):
                results[layer.layer_name] = {
                    'status': 'MISSING',
                    'expected_hash': layer.sha256,
                }
                all_ok = False
                continue
            
            # Compute SHA-256
            hasher = hashlib.sha256()
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    hasher.update(chunk)
            
            actual_hash = hasher.hexdigest()
            
            if actual_hash != layer.sha256:
                results[layer.layer_name] = {
                    'status': 'CORRUPT',
                    'expected_hash': layer.sha256,
                    'actual_hash': actual_hash,
                }
                all_ok = False
            else:
                results[layer.layer_name] = {
                    'status': 'OK',
                    'size_bytes': os.path.getsize(file_path),
                }
        
        results['_all_ok'] = all_ok
        return results
    
    def full_verification(self, manifest_json: str, 
                           tile_id: str, tile_dir: str) -> dict:
        """Complete verification chain for a single tile.
        
        1. Verify manifest signature
        2. Extract tile hash and Merkle proof
        3. Verify Merkle proof
        4. Verify tile content hashes
        """
        # Step 1: Manifest
        valid, manifest, error = self.verify_manifest(manifest_json)
        if not valid:
            return {'status': 'REJECT', 'reason': f'Manifest: {error}'}
        
        # Step 2: Extract tile info
        tile_entry = manifest.get('tiles', {}).get(tile_id)
        if tile_entry is None:
            return {'status': 'REJECT', 'reason': f'Tile {tile_id} not in manifest'}
        
        # Step 3: Merkle proof (if available)
        # In practice, vehicle may have downloaded proof separately
        
        # Step 4: Content verification
        tile_meta = self._parse_tile_metadata(tile_entry)
        content_result = self.verify_tile_content(tile_dir, tile_meta)
        
        if not content_result['_all_ok']:
            failed_layers = [k for k, v in content_result.items() 
                           if isinstance(v, dict) and v.get('status') != 'OK']
            return {
                'status': 'REJECT',
                'reason': f'Content hash mismatch: {failed_layers}',
                'details': content_result,
            }
        
        return {'status': 'ACCEPT', 'details': content_result}
```

### 10.2 Integrity Failure Handling

```
What happens when integrity check fails:

Layer file hash mismatch:
  1. Reject the affected tile
  2. Log the failure with full details (expected vs actual hash)
  3. Request re-download of the tile (full, not diff -- diff may be cause)
  4. If re-download also fails hash check:
     a. Download from cloud CDN instead of edge server (edge may be compromised)
     b. If cloud download also fails: alert fleet manager, potential supply chain issue
  5. Continue operating on last known good version

Manifest signature failure:
  1. Reject entire manifest
  2. Alert fleet manager immediately (signature failure = potential tampering)
  3. Continue operating on last known good manifest
  4. Do not accept any tile updates until valid manifest received
  5. If persists >24 hours: escalate to security team

Merkle proof failure:
  1. Reject the specific tile
  2. Re-download manifest (may have been updated)
  3. If fresh manifest and proof still fail: treat as content corruption
  4. Fall back to full tile download

Diff application failure (resulting tile doesn't match expected hash):
  1. Discard the diff result
  2. Download full tile instead
  3. If full tile passes hash check: normal operation
  4. If full tile also fails: report and use last known good

Recovery hierarchy:
  1. Re-download diff from edge server
  2. Re-download full tile from edge server
  3. Download full tile from cloud CDN
  4. Revert to last known good version (rollback)
  5. Ground vehicle and alert fleet manager
```

### 10.3 Safety Case for Map Updates

From `60-safety-validation/standards-certification/functional-safety-software.md` and `60-safety-validation/standards-certification/iso-3691-4-deep-dive.md`, the map update process must be part of the safety case:

```
Safety analysis of map update process:

Hazard: Vehicle operates on incorrect/corrupt map
  Cause 1: Corrupt download (bit flip, partial transfer)
    Mitigation: SHA-256 per layer + Merkle proof + Ed25519 signature
    Residual risk: <10^-18 (SHA-256 collision probability)
  
  Cause 2: Localization jump during swap
    Mitigation: Pose delta check <0.5m + 30s post-swap monitoring
    Residual risk: Bounded by rollback speed (~2 seconds)
  
  Cause 3: Missing safety feature (hold-short line removed)
    Mitigation: AIRAC classification + mandatory update enforcement
    Residual risk: Human review for all MAJOR changes
  
  Cause 4: Swap during critical operation
    Mitigation: Precondition checks (no swap during docking/runway crossing)
    Residual risk: <10^-9 (precondition bypass probability)
  
  Cause 5: All copies corrupt (active + rollback)
    Mitigation: Read-only factory-installed emergency map (minimal geofences)
    Residual risk: Vehicle can only navigate to nearest safe stop point

ASIL decomposition (from 60-safety-validation/runtime-assurance/fail-operational-architecture.md):
  Map update process: ASIL B
  Map integrity verification: ASIL B
  Swap precondition checking: ASIL B
  Emergency geofence (factory-installed): ASIL D (on safety MCU)
```

---

## 11. Fleet Map Synchronization

### 11.1 Version Compatibility Matrix

Not all map versions are compatible. A fleet with mixed versions must operate safely:

```
Compatibility rules:

MAJOR version mismatch:
  - Vehicles on different MAJOR versions may have different topology
  - Fleet coordination (from 30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md) must account for this
  - Route planning uses INTERSECTION of available routes across all fleet versions
  - Grace period: 4 hours after new MAJOR version available
  - After grace period: old-version vehicles grounded until updated

MINOR version mismatch:
  - Safe to operate mixed MINOR versions indefinitely
  - Each vehicle localizes against its own map version
  - Fleet coordination uses topology (unchanged across MINOR)
  - No grace period

PATCH version mismatch:
  - Fully compatible, no operational impact
  - Update at next convenient opportunity
```

```python
class FleetVersionTracker:
    """Track and manage map versions across the fleet.
    
    Ensures fleet-wide consistency and flags vehicles that need updating.
    """
    
    def __init__(self, airport_icao: str):
        self.airport = airport_icao
        self.vehicle_versions: dict = {}  # vehicle_id -> {tile_id: version}
        self.target_manifest: Optional[dict] = None
    
    def update_vehicle(self, vehicle_id: str, tile_versions: dict):
        """Record a vehicle's current tile versions."""
        self.vehicle_versions[vehicle_id] = {
            'tiles': tile_versions,
            'last_report': time.time(),
        }
    
    def get_fleet_status(self) -> dict:
        """Compute fleet-wide map version status.
        
        Returns summary of version distribution and compatibility.
        """
        if not self.target_manifest:
            return {'status': 'no_target', 'vehicles': len(self.vehicle_versions)}
        
        target_tiles = self.target_manifest.get('tiles', {})
        
        fully_current = 0
        needs_major_update = []
        needs_minor_update = []
        needs_patch_update = []
        stale_reports = []
        
        now = time.time()
        
        for vid, vdata in self.vehicle_versions.items():
            if now - vdata['last_report'] > 600:  # >10 min since last report
                stale_reports.append(vid)
                continue
            
            vtiles = vdata['tiles']
            is_current = True
            max_severity = 'patch'
            
            for tile_id, target_entry in target_tiles.items():
                target_ver = target_entry['version']
                vehicle_ver = vtiles.get(tile_id, '0.0.0')
                
                severity = self._compare_versions(vehicle_ver, target_ver)
                if severity == 'major':
                    max_severity = 'major'
                    is_current = False
                elif severity == 'minor' and max_severity != 'major':
                    max_severity = 'minor'
                    is_current = False
                elif severity == 'patch' and max_severity == 'patch':
                    if vehicle_ver != target_ver:
                        is_current = False
            
            if is_current:
                fully_current += 1
            elif max_severity == 'major':
                needs_major_update.append(vid)
            elif max_severity == 'minor':
                needs_minor_update.append(vid)
            else:
                needs_patch_update.append(vid)
        
        total = len(self.vehicle_versions)
        return {
            'airport': self.airport,
            'total_vehicles': total,
            'fully_current': fully_current,
            'pct_current': round(fully_current / max(total, 1) * 100, 1),
            'needs_major_update': needs_major_update,
            'needs_minor_update': needs_minor_update,
            'needs_patch_update': needs_patch_update,
            'stale_reports': stale_reports,
            'target_manifest_hash': self.target_manifest.get('manifest_hash', ''),
        }
    
    def get_grounding_candidates(self, grace_period_hours: float = 4.0) -> list:
        """Identify vehicles that should be grounded due to stale map.
        
        Vehicles that are >grace_period behind on MAJOR updates.
        """
        if not self.target_manifest:
            return []
        
        # When was the target manifest published?
        target_time = self.target_manifest.get('created_at', '')
        if not target_time:
            return []
        
        # Parse and compute deadline
        from datetime import datetime, timedelta
        target_dt = datetime.fromisoformat(target_time.replace('Z', '+00:00'))
        deadline = target_dt + timedelta(hours=grace_period_hours)
        
        if datetime.now(deadline.tzinfo) < deadline:
            return []  # Still within grace period
        
        status = self.get_fleet_status()
        return status['needs_major_update']
    
    def _compare_versions(self, current: str, target: str) -> str:
        """Compare two semantic versions. Returns 'major', 'minor', or 'patch'."""
        c = [int(x) for x in current.split('.')]
        t = [int(x) for x in target.split('.')]
        
        if c[0] < t[0]:
            return 'major'
        elif c[1] < t[1]:
            return 'minor'
        elif c[2] < t[2]:
            return 'patch'
        return 'current'
```

### 11.2 Forced Update Protocol

For safety-critical map changes (AIRAC mandatory, geofence modification), the fleet manager can force an update:

```
Forced update sequence:

1. Fleet manager marks update as MANDATORY with deadline
2. All vehicles receive push notification via MQTT
3. Vehicles begin downloading immediately (even if not at depot)
4. Progress reported every 30 seconds
5. Once downloaded and verified, vehicle schedules swap at next safe window
6. If deadline approaches and vehicle hasn't swapped:
   a. T-60 min: Warning to operator
   b. T-30 min: Vehicle completes current task, then parks at nearest safe point
   c. T-15 min: Vehicle refuses new tasks
   d. T-0: Vehicle enters GROUNDED state, swap forced at standstill
7. Post-deadline: vehicles without update cannot leave depot
```

### 11.3 Fleet Map Version Dashboard

```
Fleet Map Status Dashboard (real-time):

Airport: EGBB (Birmingham)
Target manifest: 2026-04-10T08:00:00Z (AIRAC 2605)
AIRAC effective: 2026-04-25 0000Z (14 days remaining)

Fleet Version Summary:
  Total vehicles:     20
  Fully current:      14 (70.0%)
  Needs MAJOR update:  0 (0.0%)
  Needs MINOR update:  4 (20.0%) -- ADT3-003, ADT3-008, STL2-001, STL2-005
  Needs PATCH update:  2 (10.0%) -- POD-002, POD-004

Tile Version Distribution:
  Tile T+0003_-0002 (Terminal B stands):
    v2.1.0 (target):  16 vehicles
    v2.0.1 (previous): 4 vehicles -- pending update
  
  Tile T+0005_+0001 (Taxiway Alpha):
    v1.3.0 (target):  20 vehicles -- all current
  
  Tile T-0001_-0003 (De-icing pad):
    v1.0.2 (target):  18 vehicles
    v1.0.1 (previous): 2 vehicles -- pending PATCH

Update History (last 7 days):
  2026-04-10: 15 tiles updated (AIRAC 2605 prep), fleet converged in 3.2 hours
  2026-04-07: 3 tiles updated (fleet SLAM refinement), converged in 8.1 hours
  2026-04-03: 1 tile updated (annotation fix T+0002_+0001), converged in 2.4 hours

Health Metrics:
  Avg swap duration: 45 ms
  Swap failures (last 30d): 2 (both rolled back successfully)
  Rollback events: 3 (1 localization jump, 2 diff corruption)
  Integrity failures: 0
```

---

## 12. Implementation

### 12.1 ROS Node Architecture

```
ROS Node Architecture for Map Management:

  ┌─────────────────────────────────────────────────────────────────┐
  │                    VEHICLE MAP MANAGEMENT                        │
  │                                                                  │
  │  /map_manager (Python node, 1 Hz)                               │
  │  ├── Subscribes:                                                 │
  │  │   /vehicle_state          -- operational state                │
  │  │   /gtsam/pose             -- current localization pose        │
  │  │   /gtsam/covariance       -- localization uncertainty         │
  │  │   /frenet/planned_route   -- route for tile prefetching       │
  │  │   /fleet/map_notification -- push notifications from fleet    │
  │  │                                                               │
  │  ├── Publishes:                                                  │
  │  │   /map/active_manifest    -- current manifest (latched)       │
  │  │   /map/tile_loaded        -- tile load/unload events          │
  │  │   /map/swap_status        -- swap progress/result             │
  │  │   /map/integrity_alert    -- integrity check failures         │
  │  │   /map/version_report     -- periodic version report          │
  │  │                                                               │
  │  ├── Services:                                                   │
  │  │   /map/get_tile_at_position  -- query tile for given (E,N)    │
  │  │   /map/request_swap          -- trigger swap (from operator)  │
  │  │   /map/request_rollback      -- trigger rollback              │
  │  │   /map/get_local_patches     -- query active local patches    │
  │  │                                                               │
  │  └── Components:                                                 │
  │      ├── ManifestPoller (60s interval)                           │
  │      ├── TilePrefetcher (1 Hz, route-aware)                     │
  │      ├── DiffDownloader (background thread pool)                 │
  │      ├── IntegrityVerifier (on every download)                   │
  │      ├── AtomicSwapController (event-driven)                     │
  │      ├── PostSwapMonitor (10 Hz during monitoring window)        │
  │      ├── LocalPatchManager (event-driven)                        │
  │      └── VersionReporter (5 min interval)                        │
  │                                                                  │
  │  /map_tile_server (C++ nodelet, runs in perception process)      │
  │  ├── Provides zero-copy tile access to GTSAM, Frenet, CBF       │
  │  ├── Memory-mapped tiles with shared_mutex                       │
  │  └── Tile swap triggered by /map_manager via service call        │
  │                                                                  │
  └─────────────────────────────────────────────────────────────────┘
```

### 12.2 Map Manager ROS Node

```python
#!/usr/bin/env python3
"""
Map Manager ROS Node

Manages the complete lifecycle of tiled HD maps on the vehicle:
- Polls for manifest updates
- Downloads and verifies tile updates
- Coordinates atomic map swaps
- Monitors post-swap localization quality
- Reports version status to fleet manager
"""

import rospy
import json
import threading
import time
from pathlib import Path
from std_msgs.msg import String, Bool
from geometry_msgs.msg import PoseWithCovarianceStamped
from nav_msgs.msg import Path as RosPath

class MapManagerNode:
    
    def __init__(self):
        rospy.init_node('map_manager')
        
        # Parameters
        self.map_root = rospy.get_param('~map_root', '/mapdata')
        self.airport_icao = rospy.get_param('~airport_icao', 'EGBB')
        self.distribution_url = rospy.get_param('~distribution_url',
            'http://map-edge.local:8080/v1')
        self.poll_interval = rospy.get_param('~poll_interval_s', 60)
        self.authority_pubkey = rospy.get_param('~authority_pubkey_hex')
        self.vehicle_id = rospy.get_param('~vehicle_id', 'ADT3-001')
        
        # State
        self.current_manifest = None
        self.swap_controller = AtomicMapSwap(
            self.map_root,
            tile_cache=None,  # Connected to C++ nodelet via shared memory
            gtsam_interface=GTSAMInterface(),
            vehicle_state_interface=VehicleStateInterface(),
        )
        self.integrity_verifier = MapIntegrityVerifier(self.authority_pubkey)
        self.prefetcher = TilePrefetcher(tile_cache=None)
        self.local_patches = LocalPatchManager(self.map_root)
        self.post_swap_monitor = PostSwapMonitor(
            GTSAMInterface(), self.swap_controller
        )
        
        # Publishers
        self.pub_manifest = rospy.Publisher(
            '/map/active_manifest', String, queue_size=1, latch=True)
        self.pub_swap_status = rospy.Publisher(
            '/map/swap_status', String, queue_size=10)
        self.pub_integrity_alert = rospy.Publisher(
            '/map/integrity_alert', String, queue_size=10)
        
        # Subscribers
        rospy.Subscriber('/gtsam/pose', PoseWithCovarianceStamped,
                         self._on_pose)
        rospy.Subscriber('/frenet/planned_route', RosPath,
                         self._on_route)
        rospy.Subscriber('/fleet/map_notification', String,
                         self._on_fleet_notification)
        
        # Load current manifest
        self._load_current_manifest()
        
        # Background threads
        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()
        
        rospy.loginfo(f"Map manager started for {self.airport_icao}, "
                      f"vehicle {self.vehicle_id}")
    
    def _load_current_manifest(self):
        manifest_path = Path(self.map_root) / "active" / "manifest.json"
        if manifest_path.exists():
            self.current_manifest = json.loads(manifest_path.read_text())
            self.pub_manifest.publish(String(data=json.dumps(self.current_manifest)))
            rospy.loginfo(f"Loaded manifest: {self.current_manifest.get('manifest_hash', '')[:12]}")
    
    def _poll_loop(self):
        """Poll distribution server for manifest updates."""
        import requests
        
        while not rospy.is_shutdown():
            try:
                headers = {}
                if self.current_manifest:
                    etag = self.current_manifest.get('manifest_hash', '')[:16]
                    headers['If-None-Match'] = etag
                
                resp = requests.get(
                    f"{self.distribution_url}/manifest/{self.airport_icao}",
                    headers=headers,
                    timeout=10,
                )
                
                if resp.status_code == 304:
                    pass  # No change
                elif resp.status_code == 200:
                    self._handle_new_manifest(resp.text)
                else:
                    rospy.logwarn(f"Manifest poll returned {resp.status_code}")
            
            except requests.exceptions.RequestException as e:
                rospy.logwarn(f"Manifest poll failed: {e}")
            
            rospy.sleep(self.poll_interval)
    
    def _handle_new_manifest(self, manifest_json: str):
        """Process a new manifest from the distribution server."""
        # Verify signature
        valid, manifest, error = self.integrity_verifier.verify_manifest(manifest_json)
        if not valid:
            rospy.logerr(f"Manifest signature FAILED: {error}")
            self.pub_integrity_alert.publish(
                String(data=json.dumps({'type': 'manifest_signature', 'error': error})))
            return
        
        # Determine which tiles need updating
        updates_needed = self._diff_manifests(self.current_manifest, manifest)
        
        if not updates_needed:
            rospy.loginfo("New manifest, but no tile updates needed")
            return
        
        rospy.loginfo(f"Manifest update: {len(updates_needed)} tiles to update")
        
        # Download and stage updates (background)
        download_thread = threading.Thread(
            target=self._download_and_stage,
            args=(manifest, updates_needed),
            daemon=True,
        )
        download_thread.start()
    
    def _download_and_stage(self, target_manifest: dict, 
                             updates_needed: list):
        """Download tile updates and stage for swap."""
        import requests
        
        staging_dir = Path(self.map_root) / "staging"
        staging_dir.mkdir(exist_ok=True)
        (staging_dir / "tiles").mkdir(exist_ok=True)
        
        status = {'state': 'DOWNLOADING', 'progress': 0, 'total': len(updates_needed)}
        (staging_dir / "status.json").write_text(json.dumps(status))
        
        for i, (tile_id, target_ver) in enumerate(updates_needed):
            current_ver = self._get_current_tile_version(tile_id)
            
            try:
                # Try diff first
                if current_ver:
                    tile_data = self._download_diff(tile_id, current_ver, target_ver)
                    if tile_data is None:
                        tile_data = self._download_full_tile(tile_id, target_ver)
                else:
                    tile_data = self._download_full_tile(tile_id, target_ver)
                
                if tile_data is None:
                    rospy.logerr(f"Failed to download tile {tile_id} v{target_ver}")
                    status['state'] = 'DOWNLOAD_FAILED'
                    (staging_dir / "status.json").write_text(json.dumps(status))
                    return
                
                # Write to staging
                tile_dir = staging_dir / "tiles" / tile_id
                tile_dir.mkdir(parents=True, exist_ok=True)
                self._extract_tile(tile_data, tile_dir)
                
                # Verify integrity
                tile_entry = target_manifest['tiles'][tile_id]
                verification = self.integrity_verifier.verify_tile_content(
                    str(tile_dir), self._parse_tile_meta(tile_entry)
                )
                
                if not verification['_all_ok']:
                    rospy.logerr(f"Tile {tile_id} integrity check FAILED")
                    self.pub_integrity_alert.publish(
                        String(data=json.dumps({
                            'type': 'tile_content',
                            'tile_id': tile_id,
                            'details': verification,
                        }))
                    )
                    status['state'] = 'INTEGRITY_FAILED'
                    (staging_dir / "status.json").write_text(json.dumps(status))
                    return
                
                status['progress'] = i + 1
                (staging_dir / "status.json").write_text(json.dumps(status))
            
            except Exception as e:
                rospy.logerr(f"Error staging tile {tile_id}: {e}")
                status['state'] = 'ERROR'
                (staging_dir / "status.json").write_text(json.dumps(status))
                return
        
        # All tiles downloaded and verified
        # Save target manifest to staging
        (staging_dir / "manifest.json").write_text(json.dumps(target_manifest, indent=2))
        
        status['state'] = 'VERIFIED_READY'
        status['updated_tiles'] = [tid for tid, _ in updates_needed]
        (staging_dir / "status.json").write_text(json.dumps(status))
        
        rospy.loginfo(f"Staging complete: {len(updates_needed)} tiles ready for swap")
        self.pub_swap_status.publish(
            String(data=json.dumps({'event': 'staging_complete',
                                    'tiles': len(updates_needed)})))
    
    def _on_pose(self, msg):
        """Handle GTSAM pose update -- used for prefetching and swap monitoring."""
        east = msg.pose.pose.position.x
        north = msg.pose.pose.position.y
        
        # Update prefetcher (at reduced rate -- every 10th message)
        if not hasattr(self, '_pose_count'):
            self._pose_count = 0
        self._pose_count += 1
        if self._pose_count % 10 == 0:
            self.prefetcher.update(east, north, self._current_route_points)
        
        # Check if swap is pending and conditions are met
        staging_status = self._get_staging_status()
        if staging_status == 'VERIFIED_READY':
            safe, reason, pre = self.swap_controller.check_preconditions()
            if safe:
                rospy.loginfo("Swap preconditions met, executing atomic swap")
                result = self.swap_controller.execute_swap()
                self.pub_swap_status.publish(String(data=json.dumps(result)))
                
                if result['success']:
                    self._load_current_manifest()
                    self._report_version()
                    # Start post-swap monitoring
                    self.post_swap_monitor.start_monitoring(
                        result.get('changed_tiles', [])
                    )
        
        # Post-swap monitoring check
        monitor_result = self.post_swap_monitor.check()
        if monitor_result:
            rospy.logwarn(f"Post-swap rollback triggered: {monitor_result}")
            self.pub_swap_status.publish(
                String(data=json.dumps({
                    'event': 'post_swap_rollback',
                    'reason': monitor_result,
                }))
            )
            self._load_current_manifest()
            self._report_version()
    
    def _on_route(self, msg):
        """Update planned route for tile prefetching."""
        self._current_route_points = [
            (p.pose.position.x, p.pose.position.y)
            for p in msg.poses
        ]
    
    def _on_fleet_notification(self, msg):
        """Handle push notification from fleet manager."""
        notification = json.loads(msg.data)
        
        if notification.get('type') == 'forced_update':
            rospy.logwarn(f"Forced map update received: {notification.get('reason')}")
            # Trigger immediate poll and staging
            self._poll_loop_once()
        
        elif notification.get('type') == 'rollback_command':
            rospy.logwarn("Fleet-commanded rollback")
            self.swap_controller._rollback(
                notification.get('tiles', [])
            )
    
    def _report_version(self):
        """Report current tile versions to fleet manager."""
        import requests
        
        tile_versions = {}
        tiles_dir = Path(self.map_root) / "active" / "tiles"
        if tiles_dir.exists():
            for tile_dir in tiles_dir.iterdir():
                if tile_dir.is_dir():
                    meta_file = tile_dir / "tile.meta.json"
                    if meta_file.exists():
                        meta = json.loads(meta_file.read_text())
                        tile_versions[tile_dir.name] = meta.get('version', 'unknown')
        
        try:
            requests.post(
                f"{self.distribution_url}/vehicle/report_version",
                json={
                    'vehicle_id': self.vehicle_id,
                    'airport_icao': self.airport_icao,
                    'tile_versions': tile_versions,
                    'timestamp': time.time(),
                },
                timeout=5,
            )
        except requests.exceptions.RequestException:
            pass  # Non-critical, will retry on next cycle

if __name__ == '__main__':
    try:
        node = MapManagerNode()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

### 12.3 Server-Side Infrastructure

```
Server infrastructure components:

1. Map Repository (S3 + PostgreSQL):
   - S3: Content-addressable object storage for tile data and diffs
   - PostgreSQL: Manifest versions, tile metadata, version history
   - Estimated storage: ~50 GB per airport (all versions, 1 year retention)
   - Cost: ~$5/month/airport on S3 Standard

2. Diff Computation Service (K8s CronJob):
   - Triggered by new tile version upload
   - Computes diffs from last 5 versions + last MAJOR version
   - CPU-bound (bsdiff): 1 vCPU handles ~100 diffs/hour
   - Cost: Negligible (runs for minutes per update)

3. Distribution API (FastAPI on K8s):
   - 2 replicas behind load balancer
   - Handles manifest polls, tile downloads, diff downloads
   - Rate-limited per vehicle (anti-abuse)
   - Cost: ~$50/month (small instance, low traffic)

4. Edge CDN (per airport):
   - NAS or small server at airport depot
   - Caches current + 2 previous versions of all tiles
   - Storage: 3-6 GB per airport
   - Cost: $500-1000 hardware, $0 ongoing (airport LAN)

5. Fleet Version Tracker (Redis + Grafana):
   - Redis: Real-time vehicle version state
   - Grafana: Dashboard for fleet map status
   - Alerting: Slack/PagerDuty for integrity failures or grounding
   - Cost: ~$20/month (shared with other fleet telemetry)

TOTAL infrastructure cost:
  Setup: $5,000-10,000 (one-time)
  Per airport: $500-1,000 edge hardware
  Ongoing: ~$100/month cloud services
  At 10 airports: ~$1,200/month total
```

### 12.4 Implementation Phases and Timeline

```
Phase 1: Foundation (Weeks 1-4, $8-12K)
─────────────────────────────────────────
Deliverables:
  - Tile grid system with 100m tiles
  - Content-addressable store (S3-backed)
  - Tile metadata schema and manifest format
  - Basic distribution API (GET tile, GET manifest)
  - Vehicle-side storage layout
  
Dependencies: map-construction-pipeline.md output format
Team: 1 backend engineer
Test: Manually split existing airport map into tiles, serve to 1 vehicle

Phase 2: Differential Updates (Weeks 5-8, $10-15K)
─────────────────────────────────────────────────────
Deliverables:
  - bsdiff computation for all binary layers
  - XML structural diff for Lanelet2
  - Diff chain management with 5-step limit
  - Server-side diff caching (Airflow job)
  - Compression with zstd level 5
  
Dependencies: Phase 1
Team: 1 backend engineer
Test: Compute diffs between two map versions, verify round-trip

Phase 3: Integrity and Security (Weeks 7-10, $6-10K)
──────────────────────────────────────────────────────
Deliverables:
  - Ed25519 signing pipeline (HSM for production keys)
  - Merkle tree for manifest
  - SHA-256 verification at all levels
  - Integrity failure handling and recovery
  
Dependencies: Phase 1 (overlaps with Phase 2)
Team: 1 security-aware engineer
Test: Corrupt tiles at every level, verify detection and recovery

Phase 4: Atomic Swap Protocol (Weeks 9-12, $12-18K)
────────────────────────────────────────────────────
Deliverables:
  - C++ TileCache nodelet with shared_mutex
  - Memory-mapped tile access
  - Tile prefetcher along planned route
  - Atomic swap with precondition checks
  - Post-swap monitoring (30s window)
  - Rollback mechanism
  
Dependencies: Phases 1-3
Team: 1 C++ engineer (perception/localization experience)
Test: Swap tiles during simulated operations, measure localization continuity

Phase 5: Fleet Synchronization (Weeks 11-14, $8-12K)
─────────────────────────────────────────────────────
Deliverables:
  - Fleet version tracker (Redis + API)
  - Version compatibility matrix
  - Forced update protocol
  - Grafana dashboard
  - AIRAC integration pipeline
  
Dependencies: Phase 4
Team: 1 backend + 1 ops engineer
Test: Simulate mixed-version fleet, verify coordination still works

Phase 6: ROS Integration (Weeks 13-16, $6-10K)
───────────────────────────────────────────────
Deliverables:
  - /map_manager Python node
  - /map_tile_server C++ nodelet
  - Integration with GTSAM, Frenet, CBF nodes
  - Local patch manager
  - End-to-end system test
  
Dependencies: Phase 4-5
Team: 1 ROS integration engineer
Test: Full lifecycle test: build map, update tile, distribute, swap on vehicle

TOTAL: $50-77K over 16 weeks (4 months)
  Phases overlap, effective calendar time ~16 weeks with 2-3 engineers
```

### 12.5 Cost Summary

```
Implementation cost breakdown:

One-time development:
  Phase 1 (Foundation):            $8-12K
  Phase 2 (Diffs):                $10-15K
  Phase 3 (Integrity):            $6-10K
  Phase 4 (Atomic Swap):         $12-18K
  Phase 5 (Fleet Sync):           $8-12K
  Phase 6 (ROS Integration):      $6-10K
  SUBTOTAL:                       $50-77K

Per-airport setup:
  Edge CDN hardware:              $500-1,000
  Initial tile generation:        $500 (script + QA)
  SUBTOTAL:                       $1,000-1,500

Ongoing (monthly):
  Cloud infrastructure:           $100-200
  Edge maintenance:               $50/airport
  SUBTOTAL (10 airports):        $600-700/month

Value delivered:
  - 80-97% bandwidth reduction for map updates
  - Zero-downtime map swaps (no perception gaps)
  - <5 second rollback to previous map version
  - Cryptographic integrity from builder to vehicle
  - Fleet-wide version consistency within 4 hours
  - AIRAC regulatory compliance automation
  - Foundation for map-construction-pipeline.md and
    hd-map-change-detection-maintenance.md integration
```

---

## 13. Key Takeaways

1. **100m x 100m tiles are the right granularity for airside**: Large enough to contain a stand with context (GTSAM needs ~50m surround), small enough for efficient differential updates (6-12 MB per tile). Tile boundaries must be shifted to avoid bisecting hold-short lines.

2. **Differential updates save 80-97% bandwidth**: bsdiff on point clouds produces patches averaging 3-15% of full tile size. Fleet SLAM refinements are the most compressible (2-5% of tile). Total map update bandwidth is ~27 MB/vehicle/month -- negligible versus the 50 GB/day sensor upload.

3. **The atomic swap is the hardest engineering problem**: Not bandwidth, not storage, not versioning. The challenge is swapping the map that GTSAM, Frenet, and CBF all depend on without any of them seeing an inconsistent state, while guaranteeing <0.5m localization continuity. The two-phase stage-then-swap protocol with 30-second post-swap monitoring solves this at ~45ms swap time on Orin.

4. **Content-addressable storage with Merkle trees provides defense in depth**: SHA-256 per layer, Merkle tree per manifest, Ed25519 signature per manifest. Corruption is detected at every level with clear recovery paths (re-download diff, re-download full tile, revert to rollback, use factory emergency map).

5. **AIRAC integration has regulatory teeth**: Unlike model updates (internal quality decision), map updates on AIRAC cycles are a regulatory requirement. Vehicles operating on maps that contradict published aeronautical data are out of compliance. The 42-day advance publication gives comfortable time for staged fleet deployment.

6. **Mixed-version fleet operation is safe for MINOR/PATCH but not MAJOR**: MAJOR version differences mean different topology, which breaks fleet coordination. The 4-hour grace period and forced update protocol ensure convergence.

7. **Local patches bridge the gap between official updates**: Fleet-detected changes, NOTAM closures, and perception-based temporary obstacles are overlaid on the base map without modifying it. The conflict resolution hierarchy ensures safety features always take precedence.

8. **This is infrastructure, not research**: Every component uses proven technology (bsdiff, SHA-256, Ed25519, mmap, ext4 atomic rename, zstd). The innovation is the integration -- specifically, the atomic swap protocol and its interaction with GTSAM localization continuity.

9. **Implementation cost is $50-77K over 16 weeks**: Returns immediate value by automating what is currently manual map deployment, and provides the distribution layer needed by `map-construction-pipeline.md` and `hd-map-change-detection-maintenance.md`.

10. **Monthly fleet map distribution cost is trivially small**: ~$600-700/month for 10 airports versus $280-560K/year for manual re-surveys (from `hd-map-change-detection-maintenance.md` Section 10). The infrastructure pays for itself in the first quarter.

---

## 14. References

### Academic

1. Merkle, R.C. "A Digital Signature Based on a Conventional Encryption Function." CRYPTO 1987.
2. Percival, C. "Matching with Mismatches and Assorted Applications." PhD thesis, University of Oxford. (bsdiff algorithm)
3. Collet, Y. "Zstandard - Fast real-time compression algorithm." RFC 8478.
4. Bernstein, D.J. et al. "Ed25519: High-speed high-security signatures." 2012.

### Industry

5. HERE HD Live Map. "Cloud-to-Car HD Map Distribution Architecture." HERE Technologies, 2023.
6. Mobileye REM. "Road Experience Management: Crowdsourced HD Map Updates." 2024.
7. TomTom. "Map Content Distribution via Tiles." TomTom Developer Portal, 2024.
8. NVIDIA DriveWorks. "Map Module: Tile-based Map Access." NVIDIA Developer, 2025.

### Standards

9. ICAO Annex 15. "Aeronautical Information Services." Including AIRAC cycle definition.
10. EUROCAE ED-119C / RTCA DO-272D. "Interchange Standards for Terrain, Obstacle, and Aerodrome Mapping Data."
11. ISO 3691-4:2023. "Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks."
12. UL 4600:2024. "Standard for Safety for the Evaluation of Autonomous Products." Section 15: Map integrity.

### Repository Cross-References

13. `30-autonomy-stack/localization-mapping/maps/map-construction-pipeline.md` -- Produces the initial map package that this system tiles and distributes.
14. `30-autonomy-stack/localization-mapping/maps/hd-map-change-detection-maintenance.md` -- Detects changes that trigger the updates distributed by this system.
15. `30-autonomy-stack/localization-mapping/maps/hd-map-standards-airside.md` -- Defines Lanelet2/AMDB formats used in tile layers.
16. `50-cloud-fleet/data-platform/cloud-backend-infrastructure.md` -- Provides the S3 data lake and Airflow orchestration underlying the server-side repository.
17. `50-cloud-fleet/ota/ota-fleet-management.md` -- Covers ML model OTA patterns; this document adapts them for map-specific requirements.
18. `30-autonomy-stack/localization-mapping/maps/semantic-mapping-learned-priors.md` -- Defines the 7-layer map architecture referenced in tile content design.
19. `30-autonomy-stack/localization-mapping/overview/lidar-place-recognition-relocalization.md` -- Place recognition features stored in tile feature layer for relocalization.
20. `60-safety-validation/runtime-assurance/fail-operational-architecture.md` -- ASIL decomposition applied to map update safety case.
21. `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md` -- STL monitors for map integrity at runtime.
