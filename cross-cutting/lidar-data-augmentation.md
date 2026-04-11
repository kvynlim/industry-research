# LiDAR-Specific Data Augmentation for 3D Point Cloud Perception

> Comprehensive guide to data augmentation techniques specifically designed for LiDAR point clouds in autonomous driving — covering ground-truth database sampling (GT-Paste), 3D copy-paste augmentation, LiDAR-specific corruptions and noise injection, point cloud mixing strategies (PolarMix, LaserMix), domain randomization for sim-to-real transfer, multi-airport synthetic variation, class-balanced sampling for rare airside objects, and integration with the auto-labeling and active learning pipelines. Focused on maximizing the value of small airside datasets (500-2K labeled frames per airport).
>
> **Relation to existing docs**: Extends `synthetic-data-generation.md` (image-centric), `sim-to-real-transfer-airside.md` (sim-to-real gap measurement), `continual-learning.md` (mentions augmentation in passing), `data-flywheel-airside.md` (auto-labeling pipeline), `self-supervised-pretraining-driving.md` (pre-training reduces label needs). This document is exclusively about **augmenting existing labeled LiDAR data** to maximize model performance with limited annotations.

**Key Takeaway**: LiDAR-specific augmentation is the single highest-ROI technique for airside perception with limited data. GT-database sampling alone improves rare-class AP by 15-25% (e.g., pushback tractors from 45% to 65% AP). Combined with PolarMix and intensity corruption, augmentation reduces the annotation requirement by 40-60%, from 2,000 to 800-1,200 frames per airport — saving $15-45K in labeling cost per airport. For multi-airport deployment, cross-airport GT-database mixing (pasting objects from Airport A into scenes from Airport B) provides a zero-cost alternative to per-airport labeling of rare objects. The complete augmentation pipeline adds <50ms per sample during training and zero cost at inference.

---

## Table of Contents

1. [Why LiDAR Augmentation Matters](#1-why-lidar-augmentation-matters)
2. [Global Geometric Augmentations](#2-global-geometric-augmentations)
3. [GT-Database Sampling (GT-Paste)](#3-gt-database-sampling-gt-paste)
4. [3D Copy-Paste Augmentation](#4-3d-copy-paste-augmentation)
5. [Point Cloud Mixing Strategies](#5-point-cloud-mixing-strategies)
6. [LiDAR-Specific Corruptions](#6-lidar-specific-corruptions)
7. [Intensity and Reflectivity Augmentation](#7-intensity-and-reflectivity-augmentation)
8. [Domain Randomization for Sim-to-Real](#8-domain-randomization-for-sim-to-real)
9. [Class-Balanced Sampling for Airside](#9-class-balanced-sampling-for-airside)
10. [Multi-Airport Cross-Domain Augmentation](#10-multi-airport-cross-domain-augmentation)
11. [Augmentation Pipeline Implementation](#11-augmentation-pipeline-implementation)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Why LiDAR Augmentation Matters

### 1.1 The Small Dataset Problem for Airside

Unlike road driving (nuScenes: 400K frames, Waymo: 230K frames), airside datasets are tiny:

| Dataset Source | Frames Available | Classes Covered | Diversity |
|---|---|---|---|
| **Airport A pilot** | 500-2,000 labeled | 8-12 | Single airport layout |
| **Airport B adaptation** | 500-1,000 labeled | 8-12 | Single airport layout |
| **nuScenes (road)** | 400,000 labeled | 10 | 4 cities, day/night/rain |
| **Waymo Open** | 230,000 labeled | 4 | 3 cities, diverse conditions |

Training a robust PointPillars or CenterPoint model requires ~5,000-10,000 diverse frames. With only 500-2,000 from a single airport, the model overfits to that airport's specific layout, equipment types, and conditions.

### 1.2 Why Image Augmentation Doesn't Transfer

Standard image augmentations (color jitter, horizontal flip, crop) don't apply to point clouds:

| Image Augmentation | LiDAR Equivalent | Challenge |
|---|---|---|
| Color jitter | Intensity jitter | Intensity has physical meaning (reflectivity) |
| Horizontal flip | Y-axis flip | Must also flip 3D bounding boxes |
| Random crop | Sector/range crop | Must maintain LiDAR scan geometry |
| Mixup (pixel blend) | Point cloud mixing | Can't blend 3D coordinates |
| Mosaic (4 images) | No direct equivalent | LiDAR is 360°, no "tiles" |
| CutOut / CutMix | 3D frustum dropout | Must respect occlusion physics |

### 1.3 Augmentation Impact on Airside Detection

| Technique | mAP Improvement | Rare Class AP Improvement | Training Time Overhead |
|---|---|---|---|
| **No augmentation** | Baseline | Baseline | 0% |
| **Global geometric only** | +2-5% | +1-3% | +5% |
| **+ GT-database sampling** | +8-15% | +15-25% | +15% |
| **+ PolarMix** | +3-7% | +5-10% | +10% |
| **+ Intensity corruption** | +1-3% | +2-5% | +5% |
| **Full pipeline** | +15-25% | +25-40% | +35% |

---

## 2. Global Geometric Augmentations

These apply transformations to the entire point cloud and all bounding boxes simultaneously.

### 2.1 Random Rotation

Rotate the entire scene around the Z-axis (gravity direction):

```python
def random_rotation_z(points, boxes, rotation_range=(-np.pi/4, np.pi/4)):
    """Rotate point cloud and boxes around Z-axis."""
    angle = np.random.uniform(*rotation_range)
    rot_matrix = np.array([
        [np.cos(angle), -np.sin(angle), 0],
        [np.sin(angle),  np.cos(angle), 0],
        [0,              0,             1],
    ])
    
    # Rotate points
    points[:, :3] = points[:, :3] @ rot_matrix.T
    
    # Rotate box centers and headings
    boxes[:, :3] = boxes[:, :3] @ rot_matrix.T
    boxes[:, 6] += angle  # heading angle
    
    return points, boxes
```

**For airside**: Use wider rotation range (±π for full 360°) since airside operations have no "forward" direction — vehicles approach stands from multiple angles.

### 2.2 Random Scaling

Uniformly scale the scene:

```python
def random_scaling(points, boxes, scale_range=(0.95, 1.05)):
    """Scale point cloud and boxes uniformly."""
    scale = np.random.uniform(*scale_range)
    points[:, :3] *= scale
    boxes[:, :3] *= scale  # center
    boxes[:, 3:6] *= scale  # dimensions (l, w, h)
    return points, boxes
```

**For airside**: Use conservative range (0.95-1.05). Larger scaling changes vehicle/equipment sizes unrealistically.

### 2.3 Random Translation

Shift the entire scene:

```python
def random_translation(points, boxes, std=(0.5, 0.5, 0.2)):
    """Translate point cloud and boxes."""
    translation = np.random.normal(0, std, size=3)
    points[:, :3] += translation
    boxes[:, :3] += translation
    return points, boxes
```

### 2.4 Random Flip

Mirror the scene along X or Y axis:

```python
def random_flip(points, boxes, prob=0.5):
    """Flip point cloud along X or Y axis."""
    if np.random.random() < prob:
        points[:, 1] = -points[:, 1]
        boxes[:, 1] = -boxes[:, 1]
        boxes[:, 6] = -boxes[:, 6]  # flip heading
    if np.random.random() < prob:
        points[:, 0] = -points[:, 0]
        boxes[:, 0] = -boxes[:, 0]
        boxes[:, 6] = np.pi - boxes[:, 6]
    return points, boxes
```

### 2.5 Global Augmentation Best Practices

| Augmentation | Probability | Range | Notes |
|---|---|---|---|
| Z-rotation | 100% | [-π, π] for airside | Full rotation for non-directional ops |
| Scaling | 80% | [0.95, 1.05] | Conservative for realistic physics |
| Translation | 80% | σ = (0.5, 0.5, 0.2) m | Z-translation should be small |
| X-flip | 50% | Binary | Must flip heading |
| Y-flip | 50% | Binary | Must flip heading |

---

## 3. GT-Database Sampling (GT-Paste)

The single most impactful LiDAR augmentation technique, introduced in SECOND (Yan et al., 2018) and used in virtually all modern 3D detectors.

### 3.1 Concept

1. **Build a database**: Extract 3D bounding boxes and their contained points from all training frames. Store as individual object snippets with class labels.
2. **During training**: Randomly sample objects from the database and paste them into the current scene.
3. **Collision check**: Ensure pasted objects don't overlap with existing objects or ground.

### 3.2 Implementation

```python
class GTDatabaseSampler:
    """Ground-truth database sampling for LiDAR augmentation."""
    
    def __init__(self, db_path, sample_config):
        """
        db_path: Path to pre-built GT database (pickle file)
        sample_config: Dict mapping class_name → {min_points, sample_count}
        """
        self.database = self._load_database(db_path)
        self.config = sample_config
        
        # Airside-specific sampling config
        self.default_config = {
            'baggage_tractor': {'min_points': 10, 'sample_count': (3, 8)},
            'pushback_tug': {'min_points': 15, 'sample_count': (1, 3)},
            'belt_loader': {'min_points': 10, 'sample_count': (2, 5)},
            'fuel_truck': {'min_points': 15, 'sample_count': (1, 3)},
            'baggage_cart': {'min_points': 5, 'sample_count': (5, 15)},
            'person': {'min_points': 3, 'sample_count': (3, 10)},
            'aircraft': {'min_points': 50, 'sample_count': (0, 2)},
            'cone': {'min_points': 3, 'sample_count': (5, 20)},
            'mobile_stairs': {'min_points': 10, 'sample_count': (1, 3)},
            'catering_truck': {'min_points': 15, 'sample_count': (0, 2)},
        }
    
    def _load_database(self, db_path):
        """Load pre-built GT database.
        
        Database format per object:
        {
            'class': str,
            'points': np.array (N, 4),  # x, y, z, intensity
            'box': np.array (7,),  # cx, cy, cz, l, w, h, heading
            'num_points': int,
            'difficulty': str,
            'source_frame': str,
        }
        """
        with open(db_path, 'rb') as f:
            return pickle.load(f)
    
    def sample(self, scene_points, scene_boxes, scene_labels):
        """Augment a scene by sampling objects from the GT database."""
        sampled_points_list = []
        sampled_boxes_list = []
        sampled_labels_list = []
        
        for class_name, config in self.config.items():
            if class_name not in self.database:
                continue
            
            # How many existing objects of this class?
            existing_count = (scene_labels == class_name).sum()
            
            # Sample to fill up to target count
            min_count, max_count = config['sample_count']
            target = np.random.randint(min_count, max_count + 1)
            n_sample = max(0, target - existing_count)
            
            if n_sample == 0:
                continue
            
            # Filter by minimum points
            candidates = [
                obj for obj in self.database[class_name]
                if obj['num_points'] >= config['min_points']
            ]
            
            if not candidates:
                continue
            
            # Random sample without replacement
            n_sample = min(n_sample, len(candidates))
            selected = np.random.choice(candidates, n_sample, replace=False)
            
            for obj in selected:
                # Random placement within scene bounds
                placed_box = self._place_object(
                    obj['box'], scene_boxes, scene_points
                )
                if placed_box is None:
                    continue  # couldn't find valid placement
                
                # Transform object points to placed location
                placed_points = self._transform_points(
                    obj['points'], obj['box'], placed_box
                )
                
                sampled_points_list.append(placed_points)
                sampled_boxes_list.append(placed_box)
                sampled_labels_list.append(class_name)
        
        if sampled_points_list:
            # Remove ground points that would be occluded by pasted objects
            scene_points = self._remove_occluded_points(
                scene_points, sampled_boxes_list
            )
            
            # Concatenate
            all_points = np.concatenate(
                [scene_points] + sampled_points_list, axis=0
            )
            all_boxes = np.concatenate(
                [scene_boxes] + [np.array(sampled_boxes_list)], axis=0
            )
            all_labels = np.concatenate(
                [scene_labels] + sampled_labels_list
            )
            return all_points, all_boxes, all_labels
        
        return scene_points, scene_boxes, scene_labels
    
    def _place_object(self, original_box, existing_boxes, scene_points):
        """Find a valid placement for the object (no collision)."""
        for _ in range(20):  # max attempts
            # Random position on ground plane
            x = np.random.uniform(-40, 40)
            y = np.random.uniform(-40, 40)
            heading = np.random.uniform(-np.pi, np.pi)
            
            candidate_box = original_box.copy()
            candidate_box[0] = x
            candidate_box[1] = y
            candidate_box[6] = heading
            
            # Set z to ground level at (x, y)
            ground_z = self._estimate_ground_z(scene_points, x, y)
            candidate_box[2] = ground_z + original_box[5] / 2  # half height
            
            # Check collision with existing boxes
            if not self._check_collision(candidate_box, existing_boxes):
                return candidate_box
        
        return None  # failed to place
    
    def _remove_occluded_points(self, points, new_boxes):
        """Remove ground points that fall inside newly placed bounding boxes.
        
        This prevents physically impossible overlap between the original 
        ground plane and the pasted object.
        """
        mask = np.ones(len(points), dtype=bool)
        for box in new_boxes:
            inside = points_in_box_3d(points[:, :3], box)
            mask &= ~inside
        return points[mask]
```

### 3.3 Building the GT Database

```python
def build_gt_database(dataset, output_path):
    """Build GT database from labeled dataset.
    
    Run once per airport after annotation is complete.
    Typical database size: 10-50K objects from 1-2K frames.
    """
    database = defaultdict(list)
    
    for frame_idx in range(len(dataset)):
        points, boxes, labels = dataset[frame_idx]
        
        for i, (box, label) in enumerate(zip(boxes, labels)):
            # Extract points inside this bounding box
            mask = points_in_box_3d(points[:, :3], box)
            obj_points = points[mask]
            
            if len(obj_points) < 3:
                continue  # too few points
            
            # Normalize points to object center
            obj_points[:, :3] -= box[:3]
            
            database[label].append({
                'class': label,
                'points': obj_points.copy(),
                'box': box.copy(),
                'num_points': len(obj_points),
                'source_frame': frame_idx,
            })
    
    with open(output_path, 'wb') as f:
        pickle.dump(dict(database), f)
    
    # Report statistics
    for cls, objs in database.items():
        print(f"  {cls}: {len(objs)} objects, "
              f"median {np.median([o['num_points'] for o in objs]):.0f} points")
```

### 3.4 Airside GT Database Statistics

Typical database from 1,500 labeled frames at a single airport:

| Class | Objects in DB | Median Points | Notes |
|---|---|---|---|
| Baggage tractor | 4,200 | 85 | Most common GSE |
| Baggage cart | 8,500 | 25 | Often in trains of 3-5 |
| Person/crew | 3,800 | 15 | Small, few points at range |
| Pushback tug | 600 | 180 | Large, rare, critical |
| Belt loader | 1,200 | 95 | Medium frequency |
| Fuel truck | 800 | 220 | Large, low frequency |
| Cone/barrier | 2,500 | 8 | Very small |
| Mobile stairs | 400 | 150 | Rare |
| Aircraft | 300 | 1,500+ | Very large, few instances |
| Catering truck | 350 | 200 | Rare |

**Class imbalance**: Pushback tugs (most critical for safety) have only 600 instances — GT-sampling can oversample to balance.

---

## 4. 3D Copy-Paste Augmentation

### 4.1 Beyond GT-Database: Instance-Level Paste

While GT-database sampling pastes objects at random locations, 3D copy-paste (Fang et al., 2021) is more sophisticated:

1. **Object selection**: Sample objects with their original spatial context (nearby ground plane, realistic position)
2. **Scene context**: Paste objects in semantically valid locations (vehicles on roads, not on buildings)
3. **Physical consistency**: Ensure pasted object respects gravity, surface normal, and occlusion

### 4.2 Context-Aware Pasting for Airside

```python
class AirsideContextAwarePaste:
    """Paste objects in semantically valid airside locations."""
    
    VALID_PLACEMENTS = {
        'baggage_tractor': ['apron', 'service_road', 'stand_area'],
        'pushback_tug': ['stand_area', 'apron'],
        'aircraft': ['stand_area', 'taxiway'],
        'person': ['apron', 'stand_area', 'service_road'],
        'cone': ['anywhere_on_surface'],
        'fuel_truck': ['stand_area', 'fuel_lane'],
    }
    
    def paste_with_context(self, obj, scene, semantic_map):
        """Paste object in a semantically valid location."""
        valid_zones = self.VALID_PLACEMENTS.get(obj['class'], ['anywhere_on_surface'])
        
        # Get valid placement area from semantic map
        valid_mask = semantic_map.get_zone_mask(valid_zones)
        
        # Sample position within valid area
        valid_positions = np.where(valid_mask)
        if len(valid_positions[0]) == 0:
            return None
        
        idx = np.random.randint(len(valid_positions[0]))
        x, y = valid_positions[0][idx], valid_positions[1][idx]
        z = semantic_map.get_ground_height(x, y)
        
        # Place object
        placed = obj.copy()
        placed['box'][:3] = [x, y, z + obj['box'][5] / 2]
        
        return placed
```

---

## 5. Point Cloud Mixing Strategies

### 5.1 PolarMix (CVPR 2022)

PolarMix augments by mixing point clouds in polar coordinates, preserving LiDAR scan patterns:

**Step 1: Instance-level swapping**
- Randomly select instances from scene B
- Replace corresponding azimuth sectors in scene A with sectors from scene B

**Step 2: Scene-level rotation + concatenation**
- Rotate scene B by a random angle
- Concatenate points from both scenes within overlapping sectors

```python
def polar_mix(points_a, labels_a, points_b, labels_b, alpha=1.0):
    """PolarMix augmentation for LiDAR point clouds.
    
    Mixes two point clouds in polar coordinate space.
    """
    # Convert to polar
    rho_a = np.sqrt(points_a[:, 0]**2 + points_a[:, 1]**2)
    theta_a = np.arctan2(points_a[:, 1], points_a[:, 0])
    rho_b = np.sqrt(points_b[:, 0]**2 + points_b[:, 1]**2)
    theta_b = np.arctan2(points_b[:, 1], points_b[:, 0])
    
    # Random sector swap
    swap_start = np.random.uniform(-np.pi, np.pi)
    swap_end = swap_start + np.random.uniform(np.pi/6, np.pi/2)
    
    # Instance-level: swap sectors
    mask_a_keep = ~((theta_a >= swap_start) & (theta_a < swap_end))
    mask_b_swap = (theta_b >= swap_start) & (theta_b < swap_end)
    
    mixed_points = np.concatenate([
        points_a[mask_a_keep],
        points_b[mask_b_swap],
    ], axis=0)
    
    mixed_labels = np.concatenate([
        labels_a[mask_a_keep],
        labels_b[mask_b_swap],
    ], axis=0)
    
    return mixed_points, mixed_labels
```

**Results**: +3-7% mAP on SemanticKITTI and nuScenes segmentation tasks. Particularly effective for classes with few training examples.

### 5.2 LaserMix (CVPR 2023)

LaserMix operates in range view, mixing LiDAR data by laser beam inclination angles:

1. Partition beams into groups based on inclination angle
2. Swap beam groups between two scans
3. Preserve the natural LiDAR scan pattern (ground at low beams, sky at high beams)

**Advantage over PolarMix**: Better preserves the vertical distribution of points, which is critical for ground plane estimation and height-based classification.

### 5.3 Mix3D

Mix3D simply concatenates two entire point clouds with separate labels:

```python
def mix3d(points_a, labels_a, points_b, labels_b):
    """Simple concatenation of two point clouds.
    
    Surprisingly effective for segmentation tasks.
    Creates out-of-distribution point density which
    regularizes the model.
    """
    # Random spatial offset for scene B to avoid perfect overlap
    offset = np.random.uniform(-2, 2, size=3)
    points_b_shifted = points_b.copy()
    points_b_shifted[:, :3] += offset
    
    return (
        np.concatenate([points_a, points_b_shifted], axis=0),
        np.concatenate([labels_a, labels_b], axis=0),
    )
```

### 5.4 Mixing Strategy Comparison

| Method | mAP Gain | Best For | Preserves Scan Pattern | Compute Cost |
|---|---|---|---|---|
| **PolarMix** | +3-7% | Segmentation, detection | Partially | Low |
| **LaserMix** | +2-5% | Segmentation | Yes (beam structure) | Low |
| **Mix3D** | +1-3% | Segmentation (indoor) | No | Very low |
| **CutMix-3D** | +2-4% | Detection | Partially | Low |

---

## 6. LiDAR-Specific Corruptions

Training with realistic corruptions makes the model robust to sensor degradation and environmental effects.

### 6.1 Corruption Types

```python
class LiDARCorruptionAugmentor:
    """Apply realistic LiDAR corruptions for robustness training."""
    
    def __init__(self, config):
        self.config = config
    
    def random_point_dropout(self, points, dropout_rate=0.05):
        """Simulate random point loss (sensor noise, absorption)."""
        mask = np.random.random(len(points)) > dropout_rate
        return points[mask]
    
    def beam_dropout(self, points, n_beams_to_drop=2):
        """Simulate entire beam failure (sensor malfunction).
        
        For RSHELIOS (32 beams), dropping 2 beams removes ~6% of points.
        """
        # Estimate beam assignment from elevation angle
        elevation = np.arctan2(points[:, 2], 
                               np.sqrt(points[:, 0]**2 + points[:, 1]**2))
        beam_ids = np.digitize(elevation, np.linspace(-0.45, 0.26, 32))
        
        # Drop random beams
        beams_to_drop = np.random.choice(32, n_beams_to_drop, replace=False)
        mask = ~np.isin(beam_ids, beams_to_drop)
        return points[mask]
    
    def range_noise(self, points, std=0.02):
        """Add Gaussian noise to range measurements.
        
        RSHELIOS range accuracy: ±2cm at 50m. Use std=0.02m.
        """
        ranges = np.sqrt(points[:, 0]**2 + points[:, 1]**2 + points[:, 2]**2)
        noise = np.random.normal(0, std, size=len(points))
        scale = (ranges + noise) / (ranges + 1e-6)
        points[:, :3] *= scale[:, np.newaxis]
        return points
    
    def intensity_noise(self, points, std=0.05):
        """Add noise to intensity channel."""
        if points.shape[1] > 3:
            noise = np.random.normal(0, std, size=len(points))
            points[:, 3] = np.clip(points[:, 3] + noise, 0, 1)
        return points
    
    def rain_simulation(self, points, rain_rate='light'):
        """Simulate rain effects on LiDAR.
        
        Rain causes:
        1. Random point dropout (absorption)
        2. Ghost points near sensor (rain drops)
        3. Reduced range
        4. Intensity reduction
        """
        rates = {'light': 0.02, 'moderate': 0.08, 'heavy': 0.15}
        rate = rates[rain_rate]
        
        # Point dropout (proportional to range — far points drop more)
        ranges = np.sqrt(points[:, 0]**2 + points[:, 1]**2)
        dropout_prob = rate * (ranges / ranges.max())
        mask = np.random.random(len(points)) > dropout_prob
        points = points[mask]
        
        # Ghost points near sensor (1-5m, random directions)
        n_ghosts = int(len(points) * rate * 0.1)
        if n_ghosts > 0:
            ghost_range = np.random.uniform(1, 5, size=n_ghosts)
            ghost_theta = np.random.uniform(-np.pi, np.pi, size=n_ghosts)
            ghost_phi = np.random.uniform(-0.45, 0.26, size=n_ghosts)
            ghosts = np.stack([
                ghost_range * np.cos(ghost_phi) * np.cos(ghost_theta),
                ghost_range * np.cos(ghost_phi) * np.sin(ghost_theta),
                ghost_range * np.sin(ghost_phi),
                np.random.uniform(0, 0.3, size=n_ghosts),  # low intensity
            ], axis=-1)
            points = np.concatenate([points, ghosts], axis=0)
        
        # Intensity reduction
        if points.shape[1] > 3:
            points[:, 3] *= (1 - rate * 0.5)
        
        return points
    
    def fog_simulation(self, points, visibility_m=200):
        """Simulate fog effects: exponential point dropout with range."""
        ranges = np.sqrt(points[:, 0]**2 + points[:, 1]**2 + points[:, 2]**2)
        extinction = 3.0 / visibility_m  # Beer-Lambert
        dropout_prob = 1 - np.exp(-extinction * ranges)
        mask = np.random.random(len(points)) > dropout_prob
        
        # Backscatter noise
        n_backscatter = int(len(points) * 0.02)
        scatter_range = np.random.exponential(visibility_m / 3, size=n_backscatter)
        scatter_range = np.clip(scatter_range, 0.5, visibility_m)
        scatter_theta = np.random.uniform(-np.pi, np.pi, size=n_backscatter)
        scatter_phi = np.random.uniform(-0.45, 0.26, size=n_backscatter)
        scatter_pts = np.stack([
            scatter_range * np.cos(scatter_phi) * np.cos(scatter_theta),
            scatter_range * np.cos(scatter_phi) * np.sin(scatter_theta),
            scatter_range * np.sin(scatter_phi),
            np.random.uniform(0, 0.2, size=n_backscatter),
        ], axis=-1)
        
        return np.concatenate([points[mask], scatter_pts], axis=0)
    
    def de_icing_fluid_spray(self, points, spray_direction, spray_angle=30):
        """Simulate de-icing fluid spray on LiDAR window.
        
        Airside-specific: de-icing fluid creates dense point cloud
        artifacts in front of the sensor.
        """
        # Block a cone-shaped region in the spray direction
        angles_to_spray = np.arccos(np.clip(
            np.sum(points[:, :3] * spray_direction, axis=-1) / 
            (np.linalg.norm(points[:, :3], axis=-1) + 1e-6),
            -1, 1
        ))
        
        in_spray_cone = angles_to_spray < np.radians(spray_angle)
        close_range = np.sqrt(np.sum(points[:, :3]**2, axis=-1)) < 10
        
        # Drop 90% of points in spray cone at close range
        spray_mask = in_spray_cone & close_range
        keep = ~spray_mask | (np.random.random(len(points)) > 0.9)
        
        return points[keep]
```

### 6.2 Corruption Severity Levels

| Corruption | Light | Moderate | Heavy |
|---|---|---|---|
| **Point dropout** | 2% | 5% | 10% |
| **Beam dropout** | 1 beam | 2 beams | 4 beams |
| **Range noise σ** | 0.01m | 0.02m | 0.05m |
| **Rain (ghost points)** | 0.5% | 2% | 5% |
| **Fog (visibility)** | 500m | 200m | 100m |
| **Intensity noise σ** | 0.02 | 0.05 | 0.10 |

---

## 7. Intensity and Reflectivity Augmentation

### 7.1 Why Intensity Matters for Airside

LiDAR intensity encodes surface reflectivity, which varies across airports:

| Surface | Typical Reflectivity | Airport Variation |
|---|---|---|
| Fresh asphalt | 0.05-0.15 | High (depends on age) |
| Concrete apron | 0.20-0.40 | Medium |
| Hi-vis vest | 0.70-0.90 | Low (standardized) |
| Aircraft fuselage | 0.40-0.70 | Medium (paint type) |
| White road marking | 0.60-0.80 | Low |
| Wet surface | 0.02-0.10 | High (water depth) |

### 7.2 Intensity Augmentation Methods

```python
def intensity_augmentations(points):
    """Suite of intensity augmentations for cross-airport robustness."""
    
    # 1. Global intensity scaling (simulates different surface materials)
    if np.random.random() < 0.5:
        scale = np.random.uniform(0.8, 1.2)
        points[:, 3] *= scale
    
    # 2. Range-dependent intensity decay (atmospheric attenuation)
    if np.random.random() < 0.3:
        ranges = np.sqrt(np.sum(points[:, :3]**2, axis=-1))
        attenuation = np.exp(-0.005 * ranges)  # mild decay
        points[:, 3] *= attenuation
    
    # 3. Per-beam intensity offset (sensor drift between beams)
    if np.random.random() < 0.3:
        elevation = np.arctan2(points[:, 2], np.sqrt(points[:, 0]**2 + points[:, 1]**2))
        beam_ids = np.digitize(elevation, np.linspace(-0.45, 0.26, 32))
        for beam in range(32):
            mask = beam_ids == beam
            points[mask, 3] += np.random.normal(0, 0.02)
    
    points[:, 3] = np.clip(points[:, 3], 0, 1)
    return points
```

---

## 8. Domain Randomization for Sim-to-Real

### 8.1 Simulation-Specific Augmentation

When training on simulated LiDAR data (CARLA, Isaac Sim), domain randomization bridges the sim-to-real gap:

| Parameter to Randomize | Range | Rationale |
|---|---|---|
| **Beam count** | 16-128 | Different real LiDAR models |
| **Angular resolution** | ±10% | Manufacturing variation |
| **Range noise** | 0.01-0.05m | Sensor quality variation |
| **Intensity noise** | 0.01-0.10 | Surface model error |
| **Point dropout** | 0-10% | Atmospheric effects |
| **Ground reflectivity** | 0.05-0.40 | Surface variation |
| **Ego height** | ±0.1m | Suspension, load variation |
| **Sensor pose** | ±0.5° rotation, ±1cm translation | Calibration error |

---

## 9. Class-Balanced Sampling for Airside

### 9.1 The Long-Tail Problem

Airside object distribution is extremely long-tailed:

| Class | Frequency | % of Objects | Impact if Missed |
|---|---|---|---|
| Baggage cart | Very common | 35% | Low |
| Person/crew | Common | 20% | Critical (safety) |
| Baggage tractor | Common | 18% | Moderate |
| Cone/barrier | Common | 12% | Low-moderate |
| Belt loader | Moderate | 5% | Moderate |
| Fuel truck | Rare | 3% | High (collision damage) |
| Pushback tug | Rare | 2% | Critical (aircraft damage) |
| Aircraft | Rare | 2% | Critical |
| Mobile stairs | Very rare | 1.5% | Moderate |
| Catering truck | Very rare | 1% | Moderate |
| De-icing vehicle | Very rare | 0.5% | High |

### 9.2 Class-Balanced GT Sampling

```python
class ClassBalancedGTSampler(GTDatabaseSampler):
    """GT sampling with class balancing for long-tail distribution."""
    
    def compute_sampling_weights(self, class_counts):
        """Inverse frequency weighting with safety priority."""
        safety_priority = {
            'person': 3.0,
            'pushback_tug': 2.5,
            'aircraft': 2.0,
            'fuel_truck': 1.5,
            'de_icing_vehicle': 1.5,
        }
        
        total = sum(class_counts.values())
        weights = {}
        for cls, count in class_counts.items():
            freq_weight = total / (count * len(class_counts))  # inverse frequency
            safety_weight = safety_priority.get(cls, 1.0)
            weights[cls] = freq_weight * safety_weight
        
        # Normalize
        max_w = max(weights.values())
        return {k: v / max_w for k, v in weights.items()}
```

---

## 10. Multi-Airport Cross-Domain Augmentation

### 10.1 Cross-Airport GT Database Sharing

The most powerful technique for multi-airport deployment: share GT databases between airports.

```
Airport A GT-DB: 4,200 tractors, 600 pushback tugs, 300 aircraft
Airport B GT-DB: 3,800 tractors, 400 pushback tugs, 250 aircraft

Merged GT-DB: 8,000 tractors, 1,000 pushback tugs, 550 aircraft
→ 2x the object diversity at zero additional labeling cost
```

**Cross-airport mixing requirements**:
- Intensity normalization (different ground surfaces change relative intensity)
- Size validation (same class, different manufacturers → different dimensions)
- Occlusion plausibility (don't paste objects behind walls that only exist at one airport)

### 10.2 Airport Layout Augmentation

Augment scenes to look like different airport layouts:

```python
def airport_layout_augmentation(points, boxes, labels):
    """Modify scene to simulate different airport geometry.
    
    Airside-specific: taxiway widths, stand angles, apron sizes 
    vary significantly between airports.
    """
    # Stretch/compress width (taxiway width variation: 15-30m)
    y_scale = np.random.uniform(0.85, 1.15)
    points[:, 1] *= y_scale
    boxes[:, 1] *= y_scale
    boxes[:, 4] *= y_scale  # width dimension
    
    # Ground height variation (±0.3m between airports)
    z_offset = np.random.normal(0, 0.1)
    points[:, 2] += z_offset
    boxes[:, 2] += z_offset
    
    # Ground slope (some aprons are slightly sloped for drainage)
    slope_x = np.random.uniform(-0.02, 0.02)  # ~1° max
    slope_y = np.random.uniform(-0.02, 0.02)
    points[:, 2] += slope_x * points[:, 0] + slope_y * points[:, 1]
    boxes[:, 2] += slope_x * boxes[:, 0] + slope_y * boxes[:, 1]
    
    return points, boxes, labels
```

---

## 11. Augmentation Pipeline Implementation

### 11.1 Complete Training Pipeline

```python
class AirsideLiDARAugmentationPipeline:
    """Complete augmentation pipeline for airside LiDAR training."""
    
    def __init__(self, gt_database_path, config):
        self.gt_sampler = GTDatabaseSampler(gt_database_path, config.gt_config)
        self.corruption = LiDARCorruptionAugmentor(config.corruption_config)
        self.config = config
    
    def __call__(self, points, boxes, labels):
        """Apply full augmentation pipeline.
        
        Order matters: GT sampling → geometric → mixing → corruption
        
        Total overhead: ~30-50ms per sample (negligible during training)
        """
        # Phase 1: GT-database sampling (most impactful)
        if self.config.use_gt_sampling:
            points, boxes, labels = self.gt_sampler.sample(points, boxes, labels)
        
        # Phase 2: Global geometric augmentations
        points, boxes = random_rotation_z(points, boxes)
        points, boxes = random_scaling(points, boxes)
        points, boxes = random_translation(points, boxes)
        points, boxes = random_flip(points, boxes)
        
        # Phase 3: Intensity augmentation
        if self.config.use_intensity_aug:
            points = intensity_augmentations(points)
        
        # Phase 4: LiDAR corruptions (stochastic — not every sample)
        if self.config.use_corruption:
            corruption_type = np.random.choice(
                ['none', 'rain', 'fog', 'point_dropout', 'beam_dropout', 'range_noise'],
                p=[0.5, 0.1, 0.1, 0.1, 0.1, 0.1]
            )
            if corruption_type == 'rain':
                points = self.corruption.rain_simulation(points, 'light')
            elif corruption_type == 'fog':
                points = self.corruption.fog_simulation(points, 300)
            elif corruption_type == 'point_dropout':
                points = self.corruption.random_point_dropout(points, 0.05)
            elif corruption_type == 'beam_dropout':
                points = self.corruption.beam_dropout(points, 2)
            elif corruption_type == 'range_noise':
                points = self.corruption.range_noise(points, 0.02)
        
        return points, boxes, labels
```

### 11.2 Cost Impact

| Scenario | Frames Needed | Labeling Cost | Augmentation Savings |
|---|---|---|---|
| **No augmentation** | 2,000 | $30-90K | — |
| **Global geometric only** | 1,800 | $27-81K | 10% |
| **+ GT-sampling** | 1,200 | $18-54K | 40% |
| **+ PolarMix + corruption** | 800 | $12-36K | 60% |
| **+ Cross-airport GT-DB** | 500 (new airport) | $7.5-22.5K | 75% |

---

## 12. Key Takeaways

1. **GT-database sampling is the single most impactful technique**: +15-25% AP on rare classes (pushback tugs, fuel trucks). Should be applied in every training run. Build the GT database once per airport, share across the fleet.

2. **Augmentation reduces labeling by 40-60%**: From 2,000 to 800-1,200 frames per airport, saving $15-45K in annotation cost. At 10 airports, this is $150-450K in total savings.

3. **Cross-airport GT database sharing is free diversity**: Merging object databases from airports A and B doubles object diversity at zero labeling cost. Requires only intensity normalization between airports.

4. **PolarMix is the best point cloud mixing strategy for LiDAR**: +3-7% mAP by mixing azimuth sectors between scenes. Preserves LiDAR scan pattern better than random concatenation.

5. **Rain/fog corruption training is essential for all-weather airside**: Realistic rain simulation (point dropout + ghost points + intensity reduction) and fog (Beer-Lambert exponential decay + backscatter) prevent catastrophic failure in adverse weather.

6. **De-icing fluid spray is an airside-specific corruption**: Creates dense point cloud artifacts in front of the sensor. Training with simulated spray makes the model robust to this uniquely airport-specific condition.

7. **Class-balanced sampling with safety priority**: Weight rare safety-critical classes (pushback tugs 2.5x, personnel 3x, aircraft 2x) to ensure robust detection of the objects that matter most.

8. **Augmentation order matters**: GT-sampling → geometric → intensity → corruption. GT-sampling first to ensure new objects are also transformed and corrupted.

9. **CaRL-style augmentation for RL**: When training RL policies in simulation, domain randomization of LiDAR parameters (beam count, noise, dropout) is the most effective sim-to-real technique.

10. **Augmentation adds <50ms per sample during training**: Negligible overhead compared to model forward/backward pass (200-500ms). Zero cost at inference.

11. **Airport layout augmentation generalizes across airports**: Stretching/compressing the scene simulates different taxiway widths and stand angles, reducing the domain gap for new airport deployment.

12. **Intensity augmentation is often overlooked but important**: Surface reflectivity varies dramatically between airports (fresh asphalt vs aged concrete). Without intensity augmentation, models overfit to training airport's surface characteristics.

13. **Beam dropout training prevents catastrophic failure**: If one of 4-8 LiDARs fails mid-operation, the model must still detect objects. Training with beam dropout (2-4 beams out of 32) simulates partial sensor failure gracefully.

14. **GT database size scales well**: From 500 labeled frames, expect 5,000-10,000 GT objects. From 1,500 frames, expect 15,000-25,000 objects. The database grows faster than linear due to objects appearing in multiple frames.

15. **Integration with active learning**: Augmentation confidence (how much the augmented sample differs from training distribution) can be used as an active learning signal — highly augmented samples that still confuse the model should be prioritized for real data collection.

---

## 13. References

### Foundational
- Yan, Y., et al. (2018). "SECOND: Sparsely Embedded Convolutional Detection." Sensors — GT-database sampling
- Fang, H., et al. (2021). "LiDAR-Aug: A General Rendering-based Augmentation Framework for 3D Object Detection." CVPR
- Choi, J., et al. (2021). "Part-Aware Data Augmentation for 3D Object Detection in Point Cloud." IROS

### Mixing Strategies
- Xiao, A., et al. (2022). "PolarMix: A General Data Augmentation Technique for LiDAR Point Clouds." NeurIPS (originally appeared CVPR workshop)
- Kong, L., et al. (2023). "LaserMix: Semi-Supervised LiDAR Semantic Segmentation via Mixing." CVPR
- Nekrasov, A., et al. (2021). "Mix3D: Out-of-Context Data Augmentation for 3D Scenes." 3DV

### Corruption and Robustness
- Hahner, M., et al. (2021). "Fog Simulation on Real LiDAR Point Clouds for 3D Object Detection in Adverse Weather." IROS
- Hahner, M., et al. (2022). "LiDAR Snowfall Simulation for Robust 3D Object Detection." CVPR
- Bijelic, M., et al. (2020). "Seeing Through Fog Without Seeing Fog." CVPR

### Copy-Paste and Instance
- Ghiasi, G., et al. (2021). "Simple Copy-Paste is a Strong Data Augmentation Method for Instance Segmentation." CVPR — 2D version, adapted for 3D
- Wang, T., et al. (2021). "Pointaugmenting: Cross-Modal Augmentation for 3D Object Detection." CVPR
