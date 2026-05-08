# HD Map Standards, Formats, and Pipelines for Airside Autonomous Vehicles

## From OpenDRIVE to AMDB: Bridging Automotive and Aviation Mapping

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Why Map Standards Matter for Airside AV](#1-why-map-standards-matter-for-airside-av)
2. [OpenDRIVE (ASAM)](#2-opendrive-asam)
3. [Lanelet2 and OSM](#3-lanelet2-and-osm)
4. [NDS — Navigation Data Standard](#4-nds----navigation-data-standard)
5. [AMDB / AMXM — Aerodrome Mapping](#5-amdb--amxm----aerodrome-mapping)
6. [AIXM — Aeronautical Information Exchange Model](#6-aixm----aeronautical-information-exchange-model)
7. [Format Comparison and Interoperability](#7-format-comparison-and-interoperability)
8. [Map Conversion Pipelines](#8-map-conversion-pipelines)
9. [Crowd-Sourced and Fleet-Built Mapping](#9-crowd-sourced-and-fleet-built-mapping)
10. [Map Maintenance and Freshness](#10-map-maintenance-and-freshness)
11. [Recommended Map Architecture for Airside](#11-recommended-map-architecture-for-airside)
12. [References](#12-references)

---

## 1. Why Map Standards Matter for Airside AV

### 1.1 The Two-World Problem

Airside autonomous vehicles exist at the intersection of two industries with completely different mapping traditions:

| Aspect | Automotive (Road) | Aviation (Airside) |
|--------|-------------------|-------------------|
| **Primary standard** | OpenDRIVE / Lanelet2 / NDS | AMDB (ED-119C / DO-272D) |
| **Resolution** | cm-level lane geometry | m-level feature outlines |
| **Maintained by** | Map providers (HERE, TomTom, Mobileye) | Aeronautical data providers (Jeppesen, LIDO) |
| **Update cycle** | Days-weeks (crowd-sourced) to months | 28-day AIRAC cycle (ICAO) |
| **Coverage** | Public roads, highways | Airfield movement areas |
| **Regulatory basis** | None mandated (de facto industry standards) | ICAO Annex 15, national AIPs |
| **Semantic model** | Lanes, traffic rules, signals | Taxiways, aprons, stands, runways |
| **Cost** | $500-1,000/km (HD), crowd-sourced lite maps emerging | Included in aeronautical data subscriptions |
| **Primary users** | Autonomous vehicles, ADAS | Pilots, ATC, A-SMGCS, EFBs |

**The fundamental challenge:** No single map standard was designed for autonomous GSE operating on airport aprons. Road standards lack aviation semantics (stands, taxiway designators, holding positions). Aviation standards lack the resolution needed for autonomous navigation (precise surface markings, 3D geometry, obstacle heights).

### 1.2 What an Airside AV Needs from a Map

| Requirement | Needed For | Available In |
|-------------|-----------|-------------|
| Navigable space boundaries | Path planning | AMDB (approximate), OpenDRIVE (precise) |
| Taxiway centerlines | Route following | AMDB ✓, AIXM ✓ |
| Stand positions + numbers | Dispatch/assignment | AMDB ✓, AIXM ✓ |
| Surface markings (paint lines) | Precise lane-keeping | None — must be perceived or surveyed |
| Holding position locations | Regulatory compliance | AMDB (geometry), NOTAM (status) |
| 3D obstacle geometry | Collision avoidance | None standard — must be LiDAR-surveyed |
| Speed zones | Velocity planning | Airport local rules (not in any standard) |
| Jet blast zones | Safety envelope | Not in any standard — must be computed |
| Dynamic restrictions | NOTAM compliance | AIXM/NOTAM ✓ |
| Equipment parking areas | Path planning | AMDB (partial) |
| Service road network | Transit routing | AMDB ✓ (service roads are mapped) |
| Elevation/gradient | Vehicle dynamics | AMDB (partial), surveyed DEM |

**Conclusion:** An airside AV needs a **composite map** that fuses aviation data (AMDB/AIXM) with automotive-grade precision (surveyed or perceived).

---

## 2. OpenDRIVE (ASAM)

### 2.1 Overview

OpenDRIVE is the dominant HD map format for autonomous driving simulation and development. Maintained by **ASAM e.V.** (Association for Standardisation of Automation and Measuring Systems), it describes road networks in an analytical reference-line-based format.

- **Current version:** 1.8.1 (2024); 1.9 expected 2026
- **Format:** XML
- **License:** Open standard, free to use
- **File extension:** `.xodr`
- **Companion standards:** OpenSCENARIO (scenarios), OpenCRG (road surfaces), OpenLABEL (annotations)

### 2.2 Data Model

OpenDRIVE represents roads as sequences of **reference lines** with lateral offsets for lanes:

```
Road (reference line = analytical geometry)
  ├── Geometry: line, arc, spiral (Euler), poly3, paramPoly3
  ├── Elevation profile: cubic polynomials along s-coordinate
  ├── Superelevation (banking) and crossfall
  ├── Lane sections (positions along s where lane config changes)
  │     ├── Center lane (reference, zero width)
  │     ├── Left lanes (numbered outward: 1, 2, 3...)
  │     └── Right lanes (numbered outward: -1, -2, -3...)
  ├── Objects: poles, signs, barriers, buildings (3D meshes)
  ├── Signals: traffic signs, traffic lights, speed limits
  └── Junctions: connect multiple roads at intersections
```

**Key coordinate system:**
- **s** = distance along reference line (longitudinal)
- **t** = lateral offset from reference line
- **h** = height above reference line
- Road geometry is defined analytically (spirals, arcs), not as discrete polylines — this enables infinite resolution

### 2.3 Lane Model Detail

Each lane has:
- **Width:** Polynomial function of s (varies along road length)
- **Type:** driving, shoulder, border, parking, biking, sidewalk, median, stop, restricted, none
- **Material:** friction, roughness
- **Speed:** Speed limit per lane
- **Access:** Vehicle type restrictions
- **Link:** Predecessor/successor lane IDs (for lane transitions)

### 2.4 Junction Model

Junctions in OpenDRIVE connect multiple roads:
```xml
<junction id="1" name="Intersection_1">
  <connection id="0" incomingRoad="1" connectingRoad="5" contactPoint="start">
    <laneLink from="-1" to="-1"/>
  </connection>
  <connection id="1" incomingRoad="2" connectingRoad="6" contactPoint="start">
    <laneLink from="-1" to="-1"/>
  </connection>
</junction>
```

Connecting roads define the actual geometry through the junction. Priority rules, traffic signal references, and right-of-way rules are attached to junctions.

### 2.5 Tooling Ecosystem

| Tool | Type | License | Notes |
|------|------|---------|-------|
| **RoadRunner** (MathWorks) | Editor/generator | Commercial ($$$) | Industry standard, exports OpenDRIVE, used by CARLA/LGSVL |
| **esmini** | Simulator/viewer | MIT | Lightweight OpenDRIVE + OpenSCENARIO player |
| **odrviewer** | Viewer | BSD | Quick visualization of .xodr files |
| **ODDLOT** (HLRS) | Editor | LGPL | Open-source OpenDRIVE editor from Stuttgart |
| **CommonRoad** | Converter | BSD | Converts OpenDRIVE → CommonRoad scenarios |
| **opendrive2lanelet** | Converter | MIT | OpenDRIVE → Lanelet2 conversion |
| **SUMO** | Traffic sim | EPL-2.0 | Imports/exports OpenDRIVE via netconvert |
| **CARLA** | Simulator | MIT | Native OpenDRIVE support for maps |
| **LGSVL/SVL** | Simulator | Various | OpenDRIVE import |

### 2.6 Industry Adoption

- **CARLA simulator:** Default map format
- **NVIDIA DRIVE Sim / Isaac Sim:** OpenDRIVE + OpenSCENARIO
- **Applied Intuition:** OpenDRIVE as a core import format
- **Bosch, Continental, ZF:** Internal HD maps often use OpenDRIVE or NDS
- **Waymo:** Internal format, but exports to OpenDRIVE for research partners
- **Autoware:** Uses Lanelet2 primarily but supports OpenDRIVE conversion
- **ASAM net membership:** 400+ companies worldwide (2024)

### 2.7 Limitations for Airside

| Limitation | Detail | Impact |
|-----------|--------|--------|
| **Road-centric model** | Everything is a "road" with lanes. Aprons and open areas don't have lanes | Cannot represent unconstrained 2D navigable space |
| **No aviation semantics** | No concept of stands, taxiways, holding positions, jet blast zones | Must be encoded as custom objects/signals |
| **Junction model** | Designed for road intersections, not open-area conflict points | Taxiway-taxiway, taxiway-apron transitions awkward |
| **1D reference lines** | Roads are defined by s-t coordinates along a reference line | Open apron areas have no natural "reference line" |
| **No NOTAM concept** | No built-in dynamic restriction layer | Must be handled externally |
| **File size** | Large airports produce very large XML files | Performance concern for real-time loading |

**Verdict:** OpenDRIVE works for airport service roads and structured taxiways but is a poor fit for open apron areas. It can be part of the solution (for road-like segments) but cannot be the sole map format.

---

## 3. Lanelet2 and OSM

Lanelet2 is covered in detail in `10-knowledge-base/robotics/lanelet2-maps.md`. Key points for airside:

### 3.1 Advantages for Airside

- **Flexible geometry:** Lanelet2 uses explicit polylines (not analytical curves), easily representing irregular apron boundaries
- **Regulatory elements:** Custom regulatory elements can encode airside rules (holding position, speed zone, jet blast zone)
- **Open-source:** BSD license, C++ library with Python bindings, Autoware integration
- **OSM storage:** Uses OpenStreetMap XML format — leverages mature tooling (JOSM editor, tile servers)
- **Multi-participant:** Same map serves vehicles, pedestrians, tugs — important for mixed GSE environments

### 3.2 Airport Extensions Needed

See `10-knowledge-base/robotics/lanelet2-maps.md` Section 7 for the proposed airside extension schema. Key additions:

| Extension | Purpose |
|-----------|---------|
| `subtype=taxiway` | Taxiway lanelets with designator (e.g., "Alpha") |
| `subtype=apron_lane` | Structured paths across aprons |
| `subtype=stand_approach` | Final approach to aircraft stand |
| `regulatory_element:jet_blast_zone` | Dynamic exclusion zone behind active engines |
| `regulatory_element:holding_position` | CAT I/II/III holding positions |
| `regulatory_element:speed_zone` | Airport-mandated speed limits per zone |
| `regulatory_element:notam_restriction` | Temporary restriction from active NOTAM |

### 3.3 Lanelet2 as the Integration Layer

Lanelet2's flexibility makes it the best candidate for the **final map representation** used by the planner:

```
Data Sources:           Conversion Pipeline:        Runtime Map:
                                                    
AMDB/AMXM  ──┐                                     ┌──────────────┐
              ├──→  [Converter]  ──→  Lanelet2  ──→ │   Planner    │
OpenDRIVE  ──┤      (Python)          .osm          │  (Frenet /   │
              │                                     │   lattice)   │
LiDAR survey ┤                                     └──────────────┘
              │                                     
Online mapping┘  (MapTR/StreamMapNet refine at runtime)
```

---

## 4. NDS — Navigation Data Standard

### 4.1 Overview

NDS (Navigation Data Standard) is the automotive industry's standard for in-vehicle map databases. Unlike OpenDRIVE (focused on simulation/development), NDS is designed for **production deployment** in embedded systems.

- **Maintainer:** NDS Association (HERE, Continental, BMW, Bosch, etc.)
- **Two versions:** NDS.Classic (SQLite-based) and NDS.Live (protobuf/cloud-native)
- **License:** Licensed standard (membership fee $5K-50K/year depending on tier)

### 4.2 NDS.Classic

- **Storage:** SQLite database with fixed schema
- **Tile system:** Morton-code-based spatial tiling for efficient loading
- **Data layers:** Routing, names, POIs, junctions, ADAS (lane model, road furniture), HD lanes
- **Used by:** BMW, Mercedes, Continental, Bosch, Hyundai, PSA

### 4.3 NDS.Live

The cloud-native evolution of NDS:

- **Format:** Protocol Buffers (protobuf) with a zserio schema compiler
- **Delivery:** Tile-based, incremental OTA updates via MQTT/REST
- **HD layer:** Full lane-level model with lane boundaries, markings, poles, barriers
- **Smart layer:** Machine-readable map objects for ADAS/AD
- **Update latency:** Near real-time for safety-critical layers

### 4.4 NDS vs OpenDRIVE

| Aspect | OpenDRIVE | NDS |
|--------|-----------|-----|
| **Primary use** | Simulation, development | Production deployment |
| **Format** | XML | SQLite (Classic) / Protobuf (Live) |
| **Geometry** | Analytical (spiral, arc) | Discrete polylines + shape points |
| **Tiling** | Monolithic file | Spatially tiled (efficient loading) |
| **Update model** | Replace entire file | Incremental tile updates |
| **Size efficiency** | Verbose (XML) | Compact (binary) |
| **Industry adoption** | Simulation toolchain | In-vehicle ECUs |
| **License** | Open | Licensed (membership) |
| **Airside relevance** | Low-medium | Low (road-focused) |

### 4.5 Airside Relevance

NDS is designed for road navigation and has the same fundamental limitations as OpenDRIVE for airside use. Its tile-based architecture and incremental update mechanism are instructive for designing an airside map delivery system, but the format itself is not suitable.

---

## 5. AMDB / AMXM — Aerodrome Mapping

### 5.1 What is AMDB?

The **Aerodrome Mapping Database (AMDB)** is the aviation industry's standard for describing the physical layout of airports. It is defined by two companion standards:

- **EUROCAE ED-119C** (European standard, maintained by EUROCAE WG-44)
- **RTCA DO-272D** (US standard, maintained by RTCA SC-217)
- **ICAO Annex 15:** Mandates AMDB provision for Terrain and Obstacle data

These standards define:
1. A **data model** (feature classes and attributes)
2. A **data quality specification** (accuracy, resolution, integrity)
3. An **exchange format** (GML-based XML)

### 5.2 AMXM — The Exchange Model

**AMXM (Aerodrome Mapping Exchange Model)** is the XML Schema that implements the AMDB data model for interchange:

- **Base:** ISO 19136 / OGC GML 3.2
- **Schema:** UML model → XML Schema Definition (XSD)
- **Namespace:** `http://www.amxm.aero/amxm`
- **Maintained by:** amxm.aero consortium

### 5.3 AMDB Feature Classes

| Feature Class | Geometry | Description | AV Relevance |
|--------------|----------|-------------|-------------|
| **RunwayElement** | Polygon | Runway surface areas | Exclusion zone (never enter) |
| **RunwayMarking** | Polygon | Runway painted markings | Visual reference |
| **RunwayThreshold** | Point | Runway threshold locations | Reference point |
| **TaxiwayElement** | Polygon | Taxiway surface areas | **Primary operating area** |
| **TaxiwayGuidanceLine** | Line | Taxiway centerline markings | **Route reference** |
| **TaxiwayHoldingPosition** | Line | Holding position markings | **Mandatory stop point** |
| **TaxiwayShoulder** | Polygon | Taxiway shoulder areas | Boundary reference |
| **ApronElement** | Polygon | Apron surface areas | **Primary operating area** |
| **StandGuidanceLine** | Line | Lead-in/lead-out lines to stands | **Navigation guide** |
| **AircraftStand** | Point | Aircraft parking position reference | **Destination node** |
| **ParkingStandArea** | Polygon | Area occupied by parked aircraft | **Exclusion zone** |
| **DeicingArea** | Polygon | De-icing pad locations | **Service destination** |
| **ServiceRoad** | Polygon | Airside service roads | **Transit routes** |
| **ConstructionArea** | Polygon | Active construction zones | **Dynamic exclusion** |
| **FrequencyArea** | Polygon | Radio frequency assignment zones | ATC context |
| **VerticalPolygonalStructure** | Polygon+height | Buildings, hangars, control towers | **3D obstacle** |
| **VerticalPointStructure** | Point+height | Light poles, antennas, signs | **3D obstacle** |
| **VerticalLineStructure** | Line+height | Fences, walls, jet bridges | **3D obstacle** |
| **BlastPad** | Polygon | Blast protection areas | Safety reference |
| **Stopway** | Polygon | Overrun areas beyond runway | Exclusion zone |
| **WaterFeature** | Polygon | Drainage, water bodies | Terrain reference |
| **PaintedCenterline** | Line | Centerline markings | **Precise lane reference** |
| **FinalApproachAndTakeoffArea** | Polygon | Helipad areas | Context awareness |

### 5.4 AMDB Data Quality Levels

ED-119C defines data quality levels that directly affect AV usability:

| Quality Level | Horizontal Accuracy | Vertical Accuracy | Typical Source |
|--------------|--------------------|--------------------|---------------|
| **1** (Survey) | ±0.5 m | ±0.5 m | Ground survey, photogrammetry |
| **2** (Measured) | ±2.5 m | ±1.0 m | Aerial imagery, satellite |
| **3** (Calculated) | ±5.0 m | ±3.0 m | Calculated from other features |
| **4** (Interpreted) | ±50 m | ±10 m | Interpreted from documents |

**Critical for AV:** Level 1 data (±0.5m) approaches but does not meet the cm-level accuracy needed for autonomous lane-keeping. AMDB provides a strong coarse prior but not a replacement for on-vehicle perception or LiDAR survey.

### 5.5 AMDB Data Availability

| Provider | Coverage | Format | Access |
|----------|---------|--------|--------|
| **FAA** (US) | ~500 US airports | AMDB GML (ED-119B compliant) | Free via FAA Aeronautical Data |
| **Jeppesen** (Boeing) | 500+ worldwide | AMDB + enhanced products | Commercial subscription |
| **Lufthansa Systems (LIDO)** | Major international | Proprietary + AMXM | Commercial subscription |
| **Navblue** (Airbus) | Major international | AMXM compliant | Commercial subscription |
| **EUROCONTROL EAD** | European airports | AIXM 5.1 (includes AMDB) | Institutional access |

**FAA AMDB:** The US FAA provides free AMDB datasets for US airports through the FAA Aeronautical Data portal. These are typically ED-119B quality level 1-2, making them directly usable as navigation priors. European data is available through EUROCONTROL's European AIS Database (EAD).

### 5.6 AMDB Limitations for AV

| Limitation | Detail | Mitigation |
|-----------|--------|-----------|
| **Accuracy** | ±0.5m at best (Level 1) | LiDAR survey or online mapping for cm-level |
| **No obstacle heights** | Vertical structures have position but not always accurate height | LiDAR survey for 3D obstacle model |
| **No dynamic objects** | GSE, temporary equipment not represented | Real-time perception |
| **28-day update cycle** | AIRAC cycle means delays to changes | NOTAM integration + perception |
| **Inconsistent coverage** | Quality varies enormously between airports | Validate quality before relying |
| **No speed zones** | Speed limits are local operational rules | Airport operator data / manual entry |
| **No jet blast data** | Blast zones are not mapped | Compute from engine data + aircraft type |

---

## 6. AIXM — Aeronautical Information Exchange Model

### 6.1 Overview

AIXM (Aeronautical Information Exchange Model) is the broader framework for aeronautical data exchange. AMXM is a specialized subset of AIXM focused on aerodrome mapping.

- **Current version:** AIXM 5.1.1
- **Maintained by:** EUROCONTROL + FAA (jointly)
- **Format:** GML 3.2-based XML
- **Scope:** All aeronautical information — airspace, routes, navaids, obstacles, aerodromes

### 6.2 AIXM Features Relevant to Airside AV

| AIXM Feature | AV Usage |
|-------------|---------|
| **Taxiway** | Route network with designators |
| **Apron** | Navigable areas |
| **AircraftStand** | Destinations with reference points |
| **TouchDownLiftOff** | Helipad locations (exclusion zones) |
| **SpecialNavigationStation** | GNSS reference stations |
| **ObstacleArea** | Obstacle limitation surfaces |
| **NOTAM** | Dynamic restrictions, closures, construction |
| **AirportHeliport** | Airport reference point, elevation, mag variation |

### 6.3 NOTAM Integration

NOTAMs (Notices to Air Missions) are the primary mechanism for communicating temporary changes to airport layout and operations. They are distributed in AIXM 5.1 Digital NOTAM format:

```xml
<!-- Example: Taxiway closure NOTAM in AIXM 5.1 -->
<event:Event gml:id="E_TWY_CLOSURE_1">
  <event:timeSlice>
    <event:EventTimeSlice gml:id="ETS_1">
      <gml:validTime>
        <gml:TimePeriod>
          <gml:beginPosition>2026-04-15T06:00:00Z</gml:beginPosition>
          <gml:endPosition>2026-04-20T18:00:00Z</gml:endPosition>
        </gml:TimePeriod>
      </gml:validTime>
      <event:scenario>AERODROME</event:scenario>
      <event:encoding>DIGITAL</event:encoding>
      <event:textNOTAM>TWY A CLSD BTN TWY B AND TWY C</event:textNOTAM>
    </event:EventTimeSlice>
  </event:timeSlice>
</event:Event>
```

**For AV integration:**
1. Parse AIXM Digital NOTAM feed (available via EUROCONTROL B2B services or FAA NOTAM API)
2. Geocode affected features (taxiway segments, apron areas)
3. Update navigation graph in real-time (mark closures, reroute)
4. Display restriction on operator interface

### 6.4 AIXM vs AMXM

| Aspect | AIXM | AMXM |
|--------|------|------|
| **Scope** | All aeronautical info | Aerodrome mapping only |
| **Geometry detail** | Coarse (point/polyline) | Detailed (polygons) |
| **Feature richness** | Airspace, routes, navaids, obstacles | Surface features, markings, structures |
| **Dynamic data** | NOTAMs, temporary restrictions | Static (28-day cycle) |
| **Best for AV** | Navigation graph + dynamic restrictions | Spatial boundaries + obstacles |

**Use both:** AMXM for the physical map, AIXM for the navigation graph and dynamic restrictions.

---

## 7. Format Comparison and Interoperability

### 7.1 Master Comparison

| Feature | OpenDRIVE | Lanelet2 | NDS | AMDB/AMXM | AIXM |
|---------|-----------|----------|-----|-----------|------|
| **Domain** | Road simulation | Road planning | Road navigation | Airport mapping | Aviation info |
| **Geometry model** | Analytical (spiral/arc) | Discrete polylines | Discrete + shape points | GML polygons/lines | GML points/lines |
| **Lane concept** | Yes (rich) | Yes (lanelet pairs) | Yes (HD lanes) | No (area-based) | No |
| **Traffic rules** | Signals, signs | Regulatory elements | Attributes | N/A | NOTAMs |
| **3D model** | Elevation + superelevation | 3D linestrings | 3D vertices | Height attributes | Obstacle heights |
| **Dynamic data** | No | Via custom tags | Real-time layer | No (28-day) | NOTAMs |
| **Tiling** | No (monolithic) | No (monolithic) | Morton tiles | No | No |
| **Typical accuracy** | mm (analytical) | cm (surveyed) | cm-dm | 0.5-5 m | Variable |
| **Open source** | Standard open, tools mixed | Fully open | Licensed | Standard $$$, data varies | Standard open, data varies |
| **Airside fit** | Poor (road-centric) | Good (flexible) | Poor (road-centric) | Medium (coarse) | Medium (dynamic) |

### 7.2 The Conversion Landscape

```
                    ┌─────────────┐
                    │  Lanelet2   │
                    │   (.osm)    │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌───────────┐   ┌───────────┐    ┌──────────┐
    │ OpenDRIVE │   │ CommonRoad│    │  SUMO    │
    │  (.xodr)  │   │  (.xml)   │    │  (.net)  │
    └───────────┘   └───────────┘    └──────────┘
    
    ┌───────────┐                    ┌──────────┐
    │ AMDB/AMXM │  ── (custom) ──►  │ Lanelet2 │
    │  (.gml)   │                    │  (.osm)  │
    └───────────┘                    └──────────┘
```

Existing conversion tools:
- **opendrive2lanelet** (GitHub: CommonRoad/commonroad-opendrive-converter) — OpenDRIVE → Lanelet2
- **lanelet2_to_opendrive** — reverse conversion (less mature)
- **SUMO netconvert** — OpenDRIVE ↔ SUMO .net.xml
- **CommonRoad** — OpenDRIVE → CommonRoad scenarios
- **No standard AMXM → Lanelet2 converter exists** — this is a gap that must be custom-built

---

## 8. Map Conversion Pipelines

### 8.1 OpenDRIVE → Lanelet2

The **opendrive2lanelet** tool (CommonRoad project, TUM) performs this conversion:

```python
# Using commonroad-opendrive-converter
from crdesigner.map_conversion.opendrive.opendrive_conversion.converter import (
    OpenDriveConverter,
)
from crdesigner.map_conversion.opendrive.opendrive_parser.parser import parse_opendrive

# Parse OpenDRIVE
opendrive = parse_opendrive("airport_service_road.xodr")

# Convert to CommonRoad scenario (intermediate)
scenario = OpenDriveConverter.create_scenario(opendrive)

# Export to Lanelet2
from crdesigner.map_conversion.lanelet2.cr2lanelet import CR2LaneletConverter
converter = CR2LaneletConverter()
converter.convert(scenario)
converter.write_to_file("airport_service_road.osm")
```

**Known issues:**
- Spiral geometry approximation introduces small errors
- Junction connecting roads sometimes produce degenerate lanelets
- Custom OpenDRIVE objects/signals are lost in conversion

### 8.2 AMXM → Lanelet2 (Custom Pipeline)

No standard tool exists. Here is the recommended approach:

```python
"""
AMXM to Lanelet2 Conversion Pipeline

Converts AMDB/AMXM GML features to Lanelet2 .osm format
for use by autonomous vehicle planners on airside.

Input: AMXM GML file (ED-119C/DO-272D compliant)
Output: Lanelet2 .osm file with airside extensions
"""

import geopandas as gpd
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize, linemerge
import lanelet2
from lanelet2.core import (
    AttributeMap, LaneletMap, getId, 
    Point3d, LineString3d, Lanelet
)
from lanelet2.io import write as write_lanelet2
from lxml import etree


def parse_amxm(amxm_path):
    """Parse AMXM GML into GeoDataFrames by feature type."""
    tree = etree.parse(amxm_path)
    root = tree.getroot()
    ns = {'amxm': 'http://www.amxm.aero/amxm',
          'gml': 'http://www.opengis.net/gml/3.2'}
    
    features = {}
    for feature_type in ['TaxiwayElement', 'ApronElement', 
                         'TaxiwayGuidanceLine', 'TaxiwayHoldingPosition',
                         'StandGuidanceLine', 'AircraftStand',
                         'ServiceRoad', 'VerticalPolygonalStructure']:
        elements = root.findall(f'.//amxm:{feature_type}', ns)
        if elements:
            features[feature_type] = parse_feature_collection(elements, ns)
    
    return features


def taxiway_to_lanelets(taxiway_polygons, guidance_lines, holding_positions):
    """
    Convert AMXM taxiway features to Lanelet2 lanelets.
    
    Strategy:
    1. Use TaxiwayGuidanceLine as lanelet centerline
    2. Offset left/right by half taxiway width (from TaxiwayElement polygon)
    3. Create regulatory elements for holding positions
    """
    lanelet_map = LaneletMap()
    
    for guideline in guidance_lines:
        # Get taxiway width from enclosing polygon
        width = estimate_width_from_polygon(guideline, taxiway_polygons)
        
        # Create left and right boundaries by offsetting centerline
        left_bound = offset_linestring(guideline.geometry, width / 2, side='left')
        right_bound = offset_linestring(guideline.geometry, width / 2, side='right')
        
        # Convert to Lanelet2 primitives
        left_ls = to_lanelet2_linestring(left_bound, {'type': 'line_thin', 
                                                       'subtype': 'solid',
                                                       'color': 'yellow'})
        right_ls = to_lanelet2_linestring(right_bound, {'type': 'line_thin',
                                                         'subtype': 'solid',
                                                         'color': 'yellow'})
        
        # Create lanelet
        ll = Lanelet(getId(), left_ls, right_ls)
        ll.attributes['type'] = 'lanelet'
        ll.attributes['subtype'] = 'taxiway'
        ll.attributes['designator'] = guideline.attributes.get('designator', '')
        ll.attributes['speed_limit'] = '30'  # km/h, airport default
        
        lanelet_map.add(ll)
    
    # Add holding position regulatory elements
    for hp in holding_positions:
        add_holding_position_regulation(lanelet_map, hp)
    
    return lanelet_map


def apron_to_lanelets(apron_polygons, stand_guidelines, stands):
    """
    Convert AMXM apron features to Lanelet2.
    
    Aprons are open areas — no natural "lane" structure.
    Strategy:
    1. StandGuidanceLines become lanelets (lead-in/lead-out paths)
    2. Open apron areas become Area primitives (Lanelet2 areas)
    3. AircraftStand points become destination nodes
    """
    # Stand approach lanelets (from guidance lines)
    for sgl in stand_guidelines:
        # Similar to taxiway guideline processing
        # but with subtype='stand_approach'
        pass
    
    # Open apron areas (Lanelet2 Area primitive)
    for apron in apron_polygons:
        # Convert polygon boundary to Lanelet2 linestrings
        # Create Area with navigable=True
        pass
    
    # Aircraft stands as destination points
    for stand in stands:
        # Add as point with stand designator
        pass
```

### 8.3 Hybrid Map Assembly Pipeline

The recommended pipeline for an airside AV:

```
Phase 1: Base Map (Offline, pre-deployment)
──────────────────────────────────────────
  AMXM data (free from FAA/EUROCONTROL)
    │
    ├── Parse GML features
    ├── Convert to Lanelet2 via custom pipeline
    ├── Add speed zones (manual, from airport ops)
    └── Add jet blast zones (computed from aircraft DB)
    
Phase 2: HD Map Refinement (One-time survey)
────────────────────────────────────────────
  LiDAR survey vehicle (1-2 days per airport)
    │
    ├── Run SLAM (KISS-ICP or LIO-SAM)
    ├── Build 3D point cloud map
    ├── Extract precise surface markings
    ├── Measure 3D obstacle geometry
    └── Refine Lanelet2 map boundaries to cm-level
    
Phase 3: Live Map Updates (Runtime)
───────────────────────────────────
  Online perception (MapTR/StreamMapNet on vehicle)
    │
    ├── Detect surface markings in real-time
    ├── Identify changes from base map
    ├── Flag temporary obstacles (parked GSE, cones)
    └── Integrate NOTAM restrictions via AIXM feed
    
Phase 4: Fleet-Sourced Updates (Continuous)
──────────────────────────────────────────
  Multi-vehicle map aggregation
    │
    ├── Upload map element observations from fleet
    ├── Statistical filtering (remove outliers)
    ├── Update base map with high-confidence changes
    └── Distribute updated map tiles to fleet
```

---

## 9. Crowd-Sourced and Fleet-Built Mapping

### 9.1 Mobileye REM (Road Experience Management)

Mobileye's REM is the most successful crowd-sourced mapping system, with data from 2M+ vehicles (2025).

**How it works:**
1. **On-vehicle:** Single camera processes road scene, extracts landmarks (lane markings, signs, poles, curbs)
2. **Compression:** Raw video → vectorized landmarks. ~10 KB/km transmitted (not video)
3. **Cloud aggregation:** Multiple passes from different vehicles fused to build and update map
4. **Map delivery:** Lightweight Road Segment Model (RSM) delivered back to vehicles

**Key metrics:**
- ~10 KB/km bandwidth (vs ~1 GB/km for raw LiDAR data)
- Map freshness: Hours (vs months for traditional survey)
- Coverage: 2M+ km mapped in 50+ countries (2024)
- Accuracy: ±10 cm laterally for lane boundaries

**Airside adaptation potential:**
- Same principle: multiple GSE vehicles contribute map observations
- On-vehicle: Extract apron markings, taxiway edges, obstacle positions
- Cloud: Aggregate multi-vehicle observations into unified airport map
- Bandwidth: Airside 5G provides ample bandwidth for richer-than-road data

### 9.2 Tesla's Auto-Labeling Pipeline

Tesla FSD v12+ effectively operates map-free, but uses fleet data to build what is conceptually an implicit map:

1. **Shadow mode data collection:** Every Tesla with HW3/HW4 collects perception data
2. **Auto-labeling:** Offline pipeline uses multi-trip aggregation + human review to label
3. **Training data:** Labeled data trains the neural network which encodes spatial knowledge implicitly
4. **No explicit map:** The network's weights ARE the map — it has "seen" every road millions of times

**Relevance for airside:** The auto-labeling pipeline concept (aggregate multi-trip data to build training labels) is directly applicable. Multiple GSE trips across the same apron yield accurate aggregated labels for training the online mapper.

### 9.3 comma.ai's Approach

comma.ai maps are built from fleet data using SLAM:

1. **Raw sensor logs uploaded** from 500K+ openpilot devices
2. **Visual-inertial SLAM** builds per-trip trajectories
3. **Multi-trip alignment** produces a consistent map
4. **Map features:** Lane positions, road geometry, curvature — stored in a custom format

**Key insight for airside:** Even a small fleet (10-50 GSE) making repeated trips across the same apron will build a very accurate map purely from sensor data, without any manual survey.

### 9.4 Fleet-Built Mapping Pipeline for Airside

```
Vehicle 1, Trip 1: [LiDAR scan] → [SLAM trajectory + landmarks] → Upload
Vehicle 1, Trip 2: [LiDAR scan] → [SLAM trajectory + landmarks] → Upload
Vehicle 2, Trip 1: [LiDAR scan] → [SLAM trajectory + landmarks] → Upload
...
Vehicle N, Trip M: [LiDAR scan] → [SLAM trajectory + landmarks] → Upload

Cloud Pipeline:
  1. Align all trajectories to common reference frame (RTK-GNSS anchored)
  2. Merge point clouds (statistical outlier removal)
  3. Extract features:
     - Ground plane → navigable surface boundary
     - Painted markings → taxiway/apron lines
     - Vertical structures → obstacles with height
     - Curbs/edges → boundary elements
  4. Vectorize into Lanelet2 format
  5. Compute confidence per feature (N observations, consistency score)
  6. Distribute as map tiles to fleet

Map Freshness Cycle:
  - Static features (buildings, taxiways): Monthly update
  - Semi-static (equipment parking, barriers): Daily update
  - Dynamic (construction, temporary closures): NOTAM feed + perception
```

### 9.5 Required Fleet Size Estimates

| Map Quality Target | Fleet Size | Trips/Day per Vehicle | Time to Full Coverage |
|-------------------|-----------|----------------------|---------------------|
| Basic navigable area map | 3-5 vehicles | 10+ | 1-2 weeks |
| Lane-level accuracy (±10 cm) | 5-10 vehicles | 20+ | 2-4 weeks |
| Full 3D obstacle model | 10-20 vehicles | 20+ | 1-2 months |
| Change detection capable | 20+ vehicles | Continuous | Ongoing |

---

## 10. Map Maintenance and Freshness

### 10.1 Change Detection from Sensor Data

Detecting changes between the stored map and current reality:

```
Stored Map (Lanelet2)  ←→  Online Perception (camera/LiDAR)
        │                           │
        ├── Expected markings       ├── Detected markings
        ├── Known obstacles         ├── Observed obstacles
        ├── Road boundaries         ├── Perceived boundaries
        └── Speed zones             └── Detected signs
                    │
                    ▼
            Change Detector
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Temporary Change          Persistent Change
  (parked GSE, cones)       (new construction, repainted)
        │                       │
  Perception handles it     Update base map
  (no map change needed)    (fleet aggregation confirms)
```

**Change types and update strategies:**

| Change Type | Detection Method | Update Latency | Action |
|------------|-----------------|---------------|--------|
| GSE parked in path | Real-time perception | Immediate | Plan around (no map update) |
| Construction zone | Multi-trip inconsistency | Hours | Flag as potential change |
| New marking painted | Multi-trip confirmation (>5 observations) | Days | Update base map |
| Building demolished/built | Multi-trip, large delta | Days | Survey team confirms, update |
| Taxiway closed (NOTAM) | AIXM Digital NOTAM feed | Minutes | Block in navigation graph |
| Gate reassignment | AODB/A-CDM feed | Real-time | Update stand availability |

### 10.2 NOTAM Integration Pipeline

```python
class NOTAMMapUpdater:
    """
    Monitors AIXM Digital NOTAM feed and updates 
    the live navigation map accordingly.
    """
    
    def __init__(self, base_map, notam_feed_url):
        self.base_map = base_map  # Lanelet2 map
        self.active_notams = {}
        self.notam_feed = AIXMDigitalNOTAMFeed(notam_feed_url)
    
    def process_notam(self, notam):
        """Process a single NOTAM and update map."""
        if notam.type == 'TAXIWAY_CLOSURE':
            affected_lanelets = self.base_map.find_by_designator(
                notam.affected_feature
            )
            for ll in affected_lanelets:
                if within_segment(ll, notam.start_point, notam.end_point):
                    ll.attributes['closed'] = 'true'
                    ll.attributes['notam_id'] = notam.id
                    ll.attributes['valid_until'] = notam.end_time.isoformat()
                    
        elif notam.type == 'CONSTRUCTION':
            # Add construction area as exclusion zone
            construction_area = notam.geometry  # GML polygon
            self.base_map.add_exclusion_zone(
                construction_area,
                attributes={'type': 'construction',
                           'notam_id': notam.id,
                           'valid_until': notam.end_time.isoformat()}
            )
        
        elif notam.type == 'HOLDING_POSITION_CHANGE':
            # Modify or add holding position
            pass
    
    def check_expiry(self):
        """Remove expired NOTAM restrictions."""
        now = datetime.utcnow()
        for notam_id, notam in list(self.active_notams.items()):
            if now > notam.end_time:
                self.revert_notam_changes(notam_id)
                del self.active_notams[notam_id]
```

### 10.3 AIRAC Cycle Management

Aviation data updates on a fixed 28-day **AIRAC (Aeronautical Information Regulation And Control)** cycle:

- **Published 42 days before effective date** — allows pre-validation
- **Effective dates are global** — every airport updates simultaneously
- **AIP amendments** describe changes in human-readable format
- **AMDB updates** include revised GML features

**For AV map management:**
1. Download new AMDB dataset 42 days before effective
2. Compare with current map (diff features)
3. Validate changes against fleet observations
4. Stage updated map in test environment
5. Deploy to fleet on effective date
6. Monitor for discrepancies post-deployment

---

## 11. Recommended Map Architecture for Airside

### 11.1 Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LAYER 3: LIVE MAP                      │
│  Source: Online perception + NOTAM feed + AODB            │
│  Update: Real-time                                        │
│  Content: Dynamic obstacles, active NOTAMs, gate status   │
│  Format: In-memory occupancy grid + object list           │
│  Accuracy: Sub-meter (perception-limited)                 │
└────────────────────────┬────────────────────────────────┘
                         │ Overrides Layer 2 where conflict
┌────────────────────────▼────────────────────────────────┐
│                    LAYER 2: HD MAP                        │
│  Source: LiDAR survey + fleet aggregation                 │
│  Update: Monthly (survey) + daily (fleet changes)         │
│  Content: Precise markings, 3D obstacles, surface model   │
│  Format: Lanelet2 .osm with 3D point cloud                │
│  Accuracy: cm-level (survey-grade)                        │
└────────────────────────┬────────────────────────────────┘
                         │ Fills in detail over Layer 1
┌────────────────────────▼────────────────────────────────┐
│                    LAYER 1: AVIATION BASE MAP             │
│  Source: AMDB/AMXM + AIXM                                 │
│  Update: 28-day AIRAC cycle                               │
│  Content: Taxiways, aprons, stands, navigation graph      │
│  Format: Lanelet2 .osm (converted from AMXM)              │
│  Accuracy: ±0.5-5m (AMDB quality dependent)               │
└─────────────────────────────────────────────────────────┘
```

### 11.2 Map Tile System

For efficient loading and updating, the airport map should be spatially tiled:

| Aspect | Recommendation | Rationale |
|--------|---------------|-----------|
| **Tile size** | 100m × 100m | Covers ~2-4 aircraft stands per tile |
| **Coordinate system** | UTM zone (local to airport) | Metric, manageable distortion |
| **Tile indexing** | Quadtree or simple grid | Fast spatial lookup |
| **Format per tile** | Lanelet2 .osm subset + 3D point cloud (LAZ) | Standard formats |
| **Update granularity** | Per-tile versioning | Only changed tiles redistributed |
| **Pre-load distance** | 300-500m ahead of vehicle | Sufficient for 30 km/h operation |

### 11.3 Integration with Aurrigo Stack

For the current ROS Noetic Aurrigo stack:

```
Current Aurrigo localization:
  GTSAM + GPU VGICP + IMU + RTK-GPS + wheel odom
  
Map integration points:
  1. GTSAM uses point cloud map for VGICP matching → Layer 2 HD map provides this
  2. Frenet planner uses waypoint route → Layer 1 provides navigation graph
  3. Obstacle avoidance uses occupancy grid → Layer 3 provides dynamic data
  
New map nodes needed (ROS Noetic):
  - /map_server: Serves Lanelet2 map to planner
  - /notam_client: Subscribes to NOTAM feed, updates map
  - /fleet_map_aggregator: Collects observations from fleet
  - /map_change_detector: Compares perception to stored map
```

### 11.4 Cost Estimates

| Component | One-Time Cost | Recurring (Annual) | Notes |
|-----------|-------------|-------------------|-------|
| AMXM data (FAA/EUROCONTROL) | Free | Free | US/European airports |
| AMXM data (Jeppesen worldwide) | $10K-50K | $10K-50K | Per-airport subscription |
| AMXM → Lanelet2 converter | $20K-50K dev | $5K maintenance | Custom software |
| LiDAR survey per airport | $30K-100K | $10K-30K refresh | Survey vehicle + processing |
| Fleet mapping infrastructure | $50K-100K | $20K cloud | Server + pipeline |
| NOTAM integration | $10K-20K dev | $5K API access | One-time development |
| **Total (self-built)** | **$120K-320K** | **$50K-110K** | Per airport |
| **Total (using Jeppesen data)** | **$90K-220K** | **$60K-130K** | Per airport |

---

## 12. References

### Standards
- EUROCAE ED-119C: Minimum Aviation System Performance Specification for Aerodrome Mapping Information
- RTCA DO-272D: User Requirements for Aerodrome Mapping Information
- ASAM OpenDRIVE 1.8: Road Network Description Standard
- ASAM OpenSCENARIO: Scenario Description Standard
- ICAO Annex 15: Aeronautical Information Services
- NDS.Live: Navigation Data Standard (NDS Association)
- ARINC 816: Aerodrome Mapping Database Format

### Tools and Libraries
- Lanelet2: `https://github.com/fzi-forschungszentrum-informatik/Lanelet2` (BSD)
- opendrive2lanelet: `https://github.com/CommonRoad/commonroad-opendrive-converter` (MIT)
- esmini: `https://github.com/esmini/esmini` (MPL-2.0) — OpenDRIVE/OpenSCENARIO player
- ODDLOT: `https://github.com/hlrs-vis/OpenPASS/tree/master/oddlot` (LGPL)
- MapTRv2: `https://github.com/hustvl/MapTR` (Apache 2.0)

### Data Sources
- FAA Aeronautical Data: `https://www.faa.gov/air_traffic/flight_info/aeronav/`
- EUROCONTROL EAD: `https://www.ead.eurocontrol.int/`
- AMXM.aero: `https://amxm.aero/`
- ICAO NOTAM Data Exchange: Digital NOTAM via AIXM 5.1

## Related Documents

| Topic | Document |
|-------|----------|
| Lanelet2 deep dive | `10-knowledge-base/robotics/lanelet2-maps.md` |
| Map-free driving | `technology/localization/map-free-driving.md` |
| Online neural mapping | `technology/localization/neural-online-mapping-sota.md` |
| Mapping and localization | `technology/localization/mapping-and-localization.md` |
| LiDAR SLAM algorithms | `technology/localization/lidar-slam-algorithms.md` |
| AIXM for synthetic data | `cross-cutting/synthetic-data-generation.md` §4 |
| Airport data integration | `operations/airside/airport-data-integration.md` |
| Airport digital twins | `technology/simulation/airport-digital-twins.md` |
