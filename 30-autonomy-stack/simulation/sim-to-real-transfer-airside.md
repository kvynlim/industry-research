# Sim-to-Real Transfer for Airside Autonomous Vehicles

## Bridging the Domain Gap: From Simulated Aprons to Real Airport Operations

**Last updated:** 2026-04-11

---

## Table of Contents

1. [The Sim-to-Real Challenge for Airside](#1-the-sim-to-real-challenge-for-airside)
2. [Sources of Domain Gap](#2-sources-of-domain-gap)
3. [LiDAR Simulation Fidelity](#3-lidar-simulation-fidelity)
4. [Simulation Platforms for Airside](#4-simulation-platforms-for-airside)
5. [Domain Randomization](#5-domain-randomization)
6. [Domain Adaptation Methods](#6-domain-adaptation-methods)
7. [Neural Simulation (UniSim, LidarDM)](#7-neural-simulation)
8. [Curriculum Learning for Airside](#8-curriculum-learning-for-airside)
9. [Reality Gap Measurement](#9-reality-gap-measurement)
10. [Validation Methodology](#10-validation-methodology)
11. [Practical Pipeline](#11-practical-pipeline)
12. [Cost & Timeline](#12-cost--timeline)
13. [Recommended Strategy for Aurrigo](#13-recommended-strategy)
14. [References](#14-references)

---

## 1. The Sim-to-Real Challenge for Airside

### 1.1 Why Simulation is Essential for Airside AV

Collecting real airside driving data is uniquely constrained:

| Constraint | Impact |
|-----------|--------|
| **Restricted access** | Airside is secure zone — no public access, escort required |
| **Aircraft proximity** | Any incident near aircraft = potential $35M+ damage |
| **Limited operating hours** | Data collection windows during low-traffic periods only |
| **Multi-airport variation** | Each airport is geometrically unique — data from one doesn't generalize |
| **Rare events** | FOD, near-misses, emergency stops happen <0.01% of operating time |
| **Regulatory oversight** | Every test drive requires documented safety case |

Simulation addresses all these constraints: unlimited data, zero risk, configurable scenarios, every airport reproducible. But the **domain gap** — the distribution difference between simulated and real sensor data — can render sim-trained models useless on real vehicles.

### 1.2 Airside-Specific Domain Gap Factors

The airside environment creates domain gap factors absent from road driving:

| Factor | Road Sim Gap | Airside Sim Gap |
|--------|-------------|-----------------|
| Ground surface | Asphalt (uniform) | Concrete + paint markings + expansion joints |
| Large objects | Buildings (static) | Aircraft (30-80m, dynamic, reflective metal) |
| Lighting | Street lights, headlights | Apron flood lights, aircraft taxi lights, beacon strobes |
| Weather effects | Rain, fog | + jet blast heat shimmer, de-icing fluid spray |
| Reflectance | Car paint, glass | Aircraft aluminum (highly specular), hi-vis vests |
| Dynamic objects | Cars, pedestrians | GSE (15+ types), crew with tools, cargo containers |
| Height range | 0-5m | 0-18m (aircraft tail) |

---

## 2. Sources of Domain Gap

### 2.1 LiDAR Domain Gap Taxonomy

```
LiDAR Sim-to-Real Gap
│
├── Geometric gap
│   ├── Object shape fidelity (CAD model vs real surface detail)
│   ├── Point density distribution (simulated uniform vs real scan-pattern)
│   └── Occlusion patterns (raycasting approximation vs real multi-path)
│
├── Physical gap
│   ├── Raydrop (missing returns) modeling
│   ├── Multi-echo / secondary returns
│   ├── Blooming near reflective surfaces
│   ├── Motion distortion (rolling shutter of rotating LiDAR)
│   └── Intensity/reflectance calibration
│
├── Environmental gap
│   ├── Ground plane roughness and slope
│   ├── Rain scatter (false returns)
│   ├── Fog attenuation (range reduction)
│   ├── Dust/particulate (jet exhaust, construction)
│   └── Temperature effects on sensor noise
│
└── Semantic gap
    ├── Object class distribution (simulated vs real frequencies)
    ├── Behavior patterns (simulated agent policies vs real human behavior)
    └── Scene composition (scripted scenarios vs emergent real situations)
```

### 2.2 Quantifying the Gap

Research from Waabi ("Towards Zero Domain Gap", 2024) systematically measured LiDAR domain gap components:

| Gap Source | Detection AP Impact | Addressing Strategy |
|-----------|-------------------|---------------------|
| Raydrop modeling | -8.2% AP | Learned raydrop predictor |
| Intensity mismatch | -3.5% AP | Material-aware rendering |
| Point density | -4.1% AP | Sensor-specific beam pattern |
| Motion distortion | -2.3% AP | Rolling shutter simulation |
| Ground plane noise | -1.8% AP | Surface roughness model |
| **Total unaddressed** | **-15-20% AP** | — |
| **After correction** | **-2-3% AP** | Combined pipeline |

**Key insight**: Addressing raydrop and density alone recovers ~60% of the gap. These are the highest-ROI simulation improvements.

---

## 3. LiDAR Simulation Fidelity

### 3.1 Naive Raycasting (Baseline)

Most simulators (CARLA, LGSVL) use simple raycasting against mesh geometry:

```python
# Naive raycasting: cast rays according to LiDAR scan pattern
def naive_lidar_sim(scene_mesh, sensor_pose, beam_angles):
    """
    Problems with naive approach:
    1. Every ray returns a point → unrealistically dense
    2. No intensity simulation → model can't learn reflectance features
    3. No noise → model overfits to clean point clouds
    4. No multi-path → misses secondary returns
    """
    points = []
    for azimuth in np.arange(0, 360, 0.2):  # typical 0.2° resolution
        for elevation in beam_angles:         # e.g., 32 beams
            ray_dir = angles_to_direction(azimuth, elevation)
            hit = raycast(scene_mesh, sensor_pose, ray_dir)
            if hit:
                points.append(hit.position)   # always hits → too dense
    return np.array(points)
```

### 3.2 Physics-Based LiDAR Simulation

Realistic LiDAR simulation requires modeling the full optical chain:

```python
class RealisticLidarSim:
    """
    Physically-motivated LiDAR simulation with:
    - FPA (First Peak Averaging) raycasting
    - Learned raydrop prediction
    - Material-aware intensity
    - Rolling shutter motion distortion
    """
    
    def __init__(self, lidar_config):
        self.config = lidar_config
        self.raydrop_model = load_raydrop_model()  # trained on real data
        self.material_db = load_material_reflectances()
    
    def simulate_scan(self, scene, sensor_pose, ego_velocity):
        points = []
        intensities = []
        
        for beam_idx, (az, el, timestamp_offset) in enumerate(self.beam_pattern()):
            # 1. Motion compensation (rolling shutter)
            compensated_pose = self.apply_motion(
                sensor_pose, ego_velocity, timestamp_offset
            )
            
            # 2. FPA raycasting (models beam divergence)
            ray_dir = self.angles_to_direction(az, el)
            hits = self.fpa_raycast(scene, compensated_pose, ray_dir,
                                    beam_divergence=self.config.divergence_mrad)
            
            if not hits:
                continue
            
            primary_hit = hits[0]
            
            # 3. Material-aware intensity
            material = scene.get_material(primary_hit.face_id)
            intensity = self.compute_intensity(
                primary_hit.distance,
                primary_hit.incidence_angle,
                self.material_db[material]
            )
            
            # 4. Raydrop prediction (learned from real data)
            drop_prob = self.raydrop_model.predict(
                distance=primary_hit.distance,
                incidence_angle=primary_hit.incidence_angle,
                material=material,
                intensity=intensity
            )
            
            if np.random.random() > drop_prob:
                # 5. Add sensor noise
                noisy_point = primary_hit.position + np.random.normal(
                    0, self.range_noise_model(primary_hit.distance), size=3
                )
                points.append(noisy_point)
                intensities.append(intensity + np.random.normal(0, 2.0))
        
        return np.array(points), np.array(intensities)
    
    def range_noise_model(self, distance):
        """RoboSense RSHELIOS noise model (from datasheet)."""
        # ±2cm at 0-50m, ±3cm at 50-100m, ±5cm at 100-150m
        if distance < 50:
            return 0.02
        elif distance < 100:
            return 0.03
        else:
            return 0.05
    
    def compute_intensity(self, distance, angle, material_reflectance):
        """LiDAR range equation: received power ∝ ρ·cos(θ) / r²."""
        cos_factor = max(np.cos(angle), 0.1)
        return material_reflectance * cos_factor / (distance ** 2) * 1000
```

### 3.3 RoboSense-Specific Simulation Parameters

Since Aurrigo uses RoboSense RSHELIOS and RSBP, simulate their exact beam patterns:

```python
RSHELIOS_CONFIG = {
    'name': 'RoboSense RSHELIOS',
    'channels': 32,
    'vertical_fov': (-16.0, 15.0),        # degrees
    'horizontal_fov': (0.0, 360.0),
    'horizontal_resolution': 0.2,           # degrees
    'range': (0.2, 150.0),                  # meters
    'points_per_second': 640_000,
    'rotation_rate': 10,                     # Hz
    'beam_divergence_mrad': 0.18,           # horizontal
    'range_accuracy_m': 0.02,                # at 50m
    'return_mode': 'dual',                   # first + strongest
    'wavelength_nm': 905,
}

RSBP_CONFIG = {
    'name': 'RoboSense RS-BPEARL',
    'channels': 32,
    'vertical_fov': (-90.0, 30.0),          # wide FoV, dome-shaped
    'horizontal_fov': (0.0, 360.0),
    'horizontal_resolution': 0.2,
    'range': (0.1, 100.0),
    'points_per_second': 460_800,
    'rotation_rate': 10,
    'beam_divergence_mrad': 0.25,
    'range_accuracy_m': 0.03,
    'return_mode': 'single',
    'wavelength_nm': 905,
}
```

---

## 4. Simulation Platforms for Airside

### 4.1 Platform Comparison

| Platform | LiDAR Fidelity | Airside Assets | ROS Support | License | Cost |
|----------|---------------|----------------|-------------|---------|------|
| CARLA 0.9.16 | Good (UE5 raycast) | None built-in | ROS 1/2 bridge | MIT | Free |
| NVIDIA Isaac Sim | Best (RTX raytracing) | Airport pack available | ROS 1/2 native | NVIDIA | Free (non-commercial) |
| LGSVL (archived) | Good | None | ROS 1/2 | Apache 2.0 | Free (deprecated) |
| Gazebo (Ignition) | Basic (GPU raycast) | None | ROS 1/2 native | Apache 2.0 | Free |
| AirSim (deprecated) | Good | None | ROS 1 | MIT | Free (archived) |
| Applied Intuition | Best (commercial) | Custom airport | ROS 2 | Commercial | $500K+/yr |
| NVIDIA Cosmos | Neural | N/A (generative) | No direct | NVIDIA Open | Free |

### 4.2 Building an Airside Simulation Environment

No simulator ships with airport airside environments. Building one requires:

#### Asset Requirements

| Asset | Source | Cost |
|-------|--------|------|
| Airport geometry (taxiways, aprons, stands) | AMDB data (free from FAA) | $0 |
| Aircraft 3D models (A320, B737, B777) | TurboSquid / SketchFab | $500-2,000 |
| GSE models (tractor, belt loader, cargo loader) | Custom modeling | $5,000-10,000 |
| Ground crew (animated) | Mixamo + custom | $1,000-3,000 |
| Surface materials (concrete, markings) | PBR textures | $500 |
| Lighting (apron floods, aircraft beacons) | Simulator built-in | $0 |
| Weather effects (rain, fog, de-icing) | Simulator built-in | $0 |
| **Total** | | **$7,000-15,000** |

#### CARLA Airport Extension

```python
# carla_airport_builder.py
# Generate airport environment from AMDB data in CARLA

import carla
import xml.etree.ElementTree as ET

class AirportSceneBuilder:
    def __init__(self, carla_client, amdb_file):
        self.client = carla_client
        self.world = self.client.get_world()
        self.amdb = self._parse_amdb(amdb_file)
    
    def build_apron(self):
        """Build apron surface from AMDB apron polygons."""
        for apron in self.amdb['aprons']:
            # Create ground plane mesh from polygon vertices
            vertices = apron['geometry']
            mesh = self._polygon_to_mesh(vertices, material='concrete_apron')
            self.world.spawn_static_mesh(mesh)
        
        # Add taxiway center lines
        for taxiway in self.amdb['taxiways']:
            self._draw_taxiway_markings(taxiway)
        
        # Add stand markings
        for stand in self.amdb['stands']:
            self._draw_stand_markings(stand)
    
    def spawn_aircraft(self, stand_id, aircraft_type='A320'):
        """Spawn aircraft at specified stand."""
        stand = self.amdb['stands'][stand_id]
        transform = carla.Transform(
            carla.Location(x=stand['x'], y=stand['y'], z=0.0),
            carla.Rotation(yaw=stand['heading'])
        )
        
        bp = self.world.get_blueprint_library().find(
            f'static.prop.aircraft_{aircraft_type.lower()}'
        )
        return self.world.spawn_actor(bp, transform)
    
    def spawn_gse_fleet(self, stand_id, config):
        """Spawn GSE around a stand for turnaround scenario."""
        stand = self.amdb['stands'][stand_id]
        gse_actors = []
        
        for gse_type, offset in config.items():
            transform = carla.Transform(
                carla.Location(
                    x=stand['x'] + offset['dx'],
                    y=stand['y'] + offset['dy'],
                    z=0.0
                ),
                carla.Rotation(yaw=offset['heading'])
            )
            bp = self.world.get_blueprint_library().find(
                f'vehicle.gse.{gse_type}'
            )
            actor = self.world.spawn_actor(bp, transform)
            gse_actors.append(actor)
        
        return gse_actors
```

### 4.3 NVIDIA Isaac Sim for Airside

Isaac Sim with Omniverse offers the highest-fidelity LiDAR simulation via RTX raytracing:

```
Advantages for airside:
- RTX-accelerated LiDAR with physically-based reflectance
- Isaac ROS bridge (direct ROS 1/2 topic publishing)
- USD (Universal Scene Description) for modular asset management
- Digital twin capability with real-time sensor simulation
- Material database with metals (aircraft aluminum), glass, rubber

Pipeline:
  1. Import AMDB geometry as USD
  2. Add aircraft/GSE assets from NVIDIA asset library
  3. Configure RoboSense RSHELIOS beam pattern
  4. Run perception models in-loop with Isaac ROS
  5. Compare simulated vs real point clouds for gap measurement
```

---

## 5. Domain Randomization

### 5.1 Visual Domain Randomization for LiDAR

Randomize simulation parameters to force the model to learn domain-invariant features:

```python
class AirsideDomainRandomizer:
    """
    Randomize simulation parameters for robust sim-to-real transfer.
    Key insight: randomize what you CAN'T model accurately.
    """
    
    def __init__(self):
        self.params = {
            # Geometry randomization
            'ground_roughness': (0.0, 0.05),         # meters
            'ground_slope': (-2.0, 2.0),              # degrees
            'object_scale': (0.95, 1.05),             # ±5% size variation
            'object_position_noise': (0.0, 0.3),      # meters
            
            # Sensor randomization
            'lidar_noise_std': (0.01, 0.05),          # meters
            'raydrop_rate': (0.0, 0.15),              # 0-15% random drops
            'intensity_scale': (0.7, 1.3),             # ±30% intensity variation
            'beam_angle_noise': (0.0, 0.05),           # degrees
            'range_bias': (-0.1, 0.1),                 # meters systematic bias
            
            # Environmental randomization
            'num_objects': (3, 25),                     # GSE and crew count
            'weather': ['clear', 'rain', 'fog', 'de-icing'],
            'time_of_day': (0, 24),                    # hours
            'wind_speed': (0, 30),                     # knots
            
            # Airside-specific
            'aircraft_type': ['A320', 'B737', 'B777', 'A380', 'ATR72'],
            'stand_config': ['contact', 'remote', 'cargo'],
            'turnaround_phase': ['arrival', 'unload', 'load', 'departure'],
            'crew_count': (2, 12),
            'gse_count': (1, 8),
        }
    
    def randomize_scene(self, scene):
        """Apply randomization to a simulated scene."""
        # Ground plane
        scene.set_ground_roughness(
            np.random.uniform(*self.params['ground_roughness'])
        )
        scene.set_ground_slope(
            np.random.uniform(*self.params['ground_slope'])
        )
        
        # Sensor noise injection
        scene.lidar.set_noise_std(
            np.random.uniform(*self.params['lidar_noise_std'])
        )
        scene.lidar.set_raydrop_rate(
            np.random.uniform(*self.params['raydrop_rate'])
        )
        scene.lidar.set_intensity_scale(
            np.random.uniform(*self.params['intensity_scale'])
        )
        
        # Weather
        weather = np.random.choice(self.params['weather'])
        scene.set_weather(weather)
        
        # Spawn random aircraft and GSE
        aircraft = np.random.choice(self.params['aircraft_type'])
        scene.spawn_aircraft(aircraft)
        
        n_gse = np.random.randint(*self.params['gse_count'])
        for _ in range(n_gse):
            scene.spawn_random_gse()
        
        n_crew = np.random.randint(*self.params['crew_count'])
        for _ in range(n_crew):
            scene.spawn_crew_member()
        
        return scene
```

### 5.2 Dynamics Randomization for Planning

For RL-trained planners, randomize vehicle dynamics:

```python
DYNAMICS_RANDOMIZATION = {
    # Vehicle mass (GSE tractor with variable cargo load)
    'mass_kg': (2000, 8000),
    
    # Steering response delay
    'steering_delay_s': (0.05, 0.3),
    
    # Tire-surface friction
    'friction_coeff': {
        'dry_concrete': (0.6, 0.9),
        'wet_concrete': (0.3, 0.6),
        'icy_concrete': (0.1, 0.3),
        'painted_marking': (0.4, 0.7),  # lower friction on paint
    },
    
    # Braking performance
    'brake_delay_s': (0.1, 0.5),
    'max_decel_mps2': (2.0, 5.0),
    
    # Towing dynamics (when pulling dolly train)
    'tow_length_m': (2.0, 15.0),
    'tow_articulation_damping': (0.1, 0.9),
}
```

---

## 6. Domain Adaptation Methods

### 6.1 Unsupervised Domain Adaptation for LiDAR

When you have labeled sim data and unlabeled real data:

```python
import torch
import torch.nn.functional as F

class LidarDomainAdaptation:
    """
    Adversarial domain adaptation for LiDAR perception.
    
    Architecture:
      Shared encoder → Task head (detection/segmentation)
                     → Domain discriminator (sim vs real)
    
    Training: minimize task loss + maximize domain confusion
    """
    
    def __init__(self, encoder, task_head, domain_discriminator):
        self.encoder = encoder
        self.task_head = task_head
        self.discriminator = domain_discriminator
    
    def train_step(self, sim_points, sim_labels, real_points, lambda_adv=0.1):
        # Forward pass
        sim_features = self.encoder(sim_points)
        real_features = self.encoder(real_points)
        
        # Task loss (supervised on sim data only)
        sim_predictions = self.task_head(sim_features)
        task_loss = F.cross_entropy(sim_predictions, sim_labels)
        
        # Domain adversarial loss (confuse discriminator)
        sim_domain = self.discriminator(sim_features)
        real_domain = self.discriminator(real_features)
        
        # Labels: 0 = sim, 1 = real
        domain_loss = (
            F.binary_cross_entropy(sim_domain, torch.zeros_like(sim_domain)) +
            F.binary_cross_entropy(real_domain, torch.ones_like(real_domain))
        )
        
        # Gradient reversal: encoder learns to CONFUSE discriminator
        total_loss = task_loss - lambda_adv * domain_loss
        
        return total_loss, task_loss.item(), domain_loss.item()
```

### 6.2 Object-Level Domain Adaptation

Instead of adapting the full scene, adapt at the object level (more effective for LiDAR):

```
Object-Level Adaptation Pipeline:
  1. Extract object point clusters from sim (using GT boxes)
  2. Extract object clusters from real (using pre-trained detector)
  3. Train local domain adaptation on object-level features
  4. Fine-tune detection model with adapted features
  
  Advantage: Objects are more consistent across domains than full scenes
  Result: +8.2% AP improvement over scene-level adaptation
```

### 6.3 Self-Training with Pseudo-Labels

Use a sim-trained model to generate pseudo-labels on real data, then retrain:

```python
def self_training_loop(model, sim_data, real_unlabeled, num_rounds=5):
    """
    Iterative self-training for sim-to-real adaptation.
    
    Round 1: Train on sim labels → get noisy predictions on real
    Round 2: Train on sim labels + confident real pseudo-labels
    Round N: Progressively improve real-domain accuracy
    """
    for round_idx in range(num_rounds):
        # Generate pseudo-labels on real data
        model.eval()
        pseudo_labels = []
        confidences = []
        
        for real_batch in real_unlabeled:
            with torch.no_grad():
                pred = model(real_batch)
                conf = pred.softmax(dim=1).max(dim=1).values
                pseudo_labels.append(pred.argmax(dim=1))
                confidences.append(conf)
        
        # Filter: keep only high-confidence pseudo-labels
        threshold = 0.9 - round_idx * 0.05  # relax threshold each round
        confident_mask = torch.cat(confidences) > threshold
        
        # Combine sim labels + confident pseudo-labels
        combined_dataset = CombinedDataset(
            sim_data,           # always include (prevents forgetting)
            real_unlabeled,
            torch.cat(pseudo_labels),
            confident_mask
        )
        
        # Retrain
        model.train()
        train_model(model, combined_dataset, epochs=5)
        
        print(f"Round {round_idx}: {confident_mask.float().mean():.1%} "
              f"of real data above threshold {threshold:.2f}")
    
    return model
```

---

## 7. Neural Simulation {#7-neural-simulation}

### 7.1 UniSim (CVPR 2023)

UniSim generates photorealistic sensor data from neural scene representations:

- **Input**: Real driving logs + 3D scene reconstruction
- **Output**: Novel viewpoint LiDAR + camera data
- **Key result**: Models trained on UniSim data + lane shift augmentation **outperform** real-data-only training by 2-4% AP
- **Relevance for airside**: Could generate novel airside scenarios from limited real logs

### 7.2 LidarDM (ICRA 2025)

LidarDM generates realistic LiDAR point clouds using diffusion models:

- **Map-conditioned generation**: Given an HD map, generates realistic LiDAR scans
- **Sequence generation**: First generative method supporting temporal consistency
- **Domain gap**: Minimal gap when used for perception training vs real data
- **Airside application**: Generate synthetic airside LiDAR data from AMDB maps

```
Potential pipeline:
  1. Input: AMDB map of target airport (free from FAA)
  2. LidarDM generates thousands of realistic LiDAR scans
  3. Train perception models on generated data
  4. Fine-tune on small set of real airside scans (100-500)
  5. Expected: 80-90% of fully-supervised real-data performance
```

### 7.3 High-Fidelity Digital Twins (2025)

Recent work demonstrates that high-fidelity digital twins can **surpass real-data training**:

> "The high-fidelity-digital-twin-trained model outperformed its real-data-trained opponent by 4.8%" — arxiv 2509.02904

This is achieved through:
- Precise 3D scanning of real environments
- Material-accurate rendering (PBR with measured BRDF)
- Sensor-specific simulation (exact beam pattern, noise model)
- Unlimited scenario variation at zero marginal cost

**For Aurrigo**: Building a digital twin of 2-3 key airports would cost $50-100K but provide unlimited training data.

---

## 8. Curriculum Learning for Airside

### 8.1 Progressive Scenario Complexity

Train models on a curriculum from simple to complex:

```python
AIRSIDE_CURRICULUM = [
    # Level 1: Empty apron (weeks 1-2)
    {
        'description': 'Empty apron navigation',
        'aircraft': 0,
        'gse': 0,
        'crew': 0,
        'weather': 'clear',
        'time': 'day',
        'task': 'follow_taxiway',
    },
    
    # Level 2: Static obstacles (weeks 3-4)
    {
        'description': 'Navigate around parked GSE',
        'aircraft': 1,
        'gse': 3,  # static, parked
        'crew': 0,
        'weather': 'clear',
        'time': 'day',
        'task': 'navigate_to_stand',
    },
    
    # Level 3: Moving GSE (weeks 5-6)
    {
        'description': 'Share apron with moving vehicles',
        'aircraft': 1,
        'gse': 5,  # some moving
        'crew': 2,
        'weather': 'clear',
        'time': 'day',
        'task': 'turnaround_support',
    },
    
    # Level 4: Busy turnaround (weeks 7-8)
    {
        'description': 'Full turnaround scenario',
        'aircraft': 2,
        'gse': 8,
        'crew': 8,
        'weather': 'random',
        'time': 'random',
        'task': 'full_turnaround',
    },
    
    # Level 5: Adversarial (weeks 9-10)
    {
        'description': 'Edge cases and rare events',
        'aircraft': 3,
        'gse': 12,
        'crew': 12,
        'weather': 'adverse',
        'time': 'night',
        'task': 'edge_cases',
        'inject_faults': True,  # sensor failures, FOD, emergency vehicles
    },
]
```

### 8.2 Scenario Mining from Real Data

Use real driving logs to identify under-represented scenarios, then generate more of those in simulation:

```
Real data analysis → Scenario coverage heatmap
  - "Personnel crossing path" seen 15 times → need 500+ sim instances
  - "FOD on taxiway" seen 0 times → generate 1000 sim instances  
  - "Night + rain" seen 5 times → generate 2000 sim instances
  - "Dual aircraft pushback" seen 2 times → generate 500 sim instances
```

---

## 9. Reality Gap Measurement

### 9.1 Quantitative Metrics

```python
def measure_domain_gap(real_data, sim_data, model):
    """
    Measure sim-to-real domain gap across multiple dimensions.
    
    Returns metrics that indicate how well simulation matches reality.
    """
    metrics = {}
    
    # 1. Detection performance gap
    real_ap = evaluate_detection(model, real_data)
    sim_ap = evaluate_detection(model, sim_data)
    metrics['detection_gap'] = real_ap - sim_ap  # should be near 0
    
    # 2. Feature distribution gap (FID-like for point clouds)
    real_features = extract_features(model.backbone, real_data)
    sim_features = extract_features(model.backbone, sim_data)
    metrics['feature_mmd'] = maximum_mean_discrepancy(real_features, sim_features)
    
    # 3. Point cloud statistics
    metrics['point_density_ratio'] = (
        mean_points_per_frame(sim_data) / mean_points_per_frame(real_data)
    )
    metrics['intensity_distribution_kl'] = kl_divergence(
        intensity_histogram(sim_data), intensity_histogram(real_data)
    )
    metrics['range_distribution_kl'] = kl_divergence(
        range_histogram(sim_data), range_histogram(real_data)
    )
    
    # 4. Raydrop rate comparison
    metrics['raydrop_sim'] = compute_raydrop_rate(sim_data)
    metrics['raydrop_real'] = compute_raydrop_rate(real_data)
    
    return metrics

# Target thresholds for "good enough" simulation
GAP_THRESHOLDS = {
    'detection_gap': 3.0,           # <3% AP difference
    'feature_mmd': 0.1,            # low distributional distance
    'point_density_ratio': (0.9, 1.1),  # within 10% of real
    'intensity_distribution_kl': 0.05,   # similar intensity profile
    'raydrop_rate_diff': 0.02,     # within 2% of real raydrop rate
}
```

### 9.2 A/B Testing Protocol

```
Sim-to-Real Validation Protocol:
  1. Train Model A on real data only (100% real labels)
  2. Train Model B on sim data only (100% sim labels)
  3. Train Model C on sim + 10% real labels (fine-tuned)
  4. Evaluate all on held-out real test set

  Expected results:
    Model A: baseline (best possible)
    Model B: 10-20% below A (raw domain gap)
    Model C: within 2-5% of A (sim + fine-tune sweet spot)
    
  If B is >20% below A: simulation needs improvement
  If C is >5% below A: domain adaptation methods needed
  If C is within 2% of A: simulation is "good enough"
```

---

## 10. Validation Methodology

### 10.1 Closed-Loop vs Open-Loop Evaluation

| Evaluation Type | What It Tests | When to Use |
|----------------|---------------|-------------|
| **Open-loop** (detection AP) | Perception accuracy only | First validation step |
| **Replay** (offline on real bags) | Prediction accuracy | Before deployment |
| **Closed-loop sim** (CARLA/Isaac) | Full stack behavior | Scenario coverage |
| **Shadow mode** (real vehicle) | Real-world consistency | Before autonomous mode |
| **Autonomous mode** (safety driver) | Production readiness | Final validation |

### 10.2 Scenario-Based Validation

Define pass/fail criteria for airside-specific scenarios:

| Scenario | Metric | Threshold | Source |
|----------|--------|-----------|--------|
| Personnel detection @30m | Recall | >99.5% | Real + sim |
| FOD detection @20m | Recall | >95% | Sim (no real data) |
| Aircraft avoidance | Min clearance | >3m | Closed-loop sim |
| Emergency stop | Response time | <200ms | HiL test |
| Night operation | mAP drop vs day | <5% | Real night data |
| Rain operation | mAP drop vs clear | <10% | Sim + limited real |

---

## 11. Practical Pipeline

### 11.1 End-to-End Sim-to-Real Pipeline for Aurrigo

```
┌─────────────────────────────────────────────────┐
│              SIM-TO-REAL PIPELINE                 │
│                                                   │
│  Phase 1: Build Simulation (months 1-2)          │
│  ┌─────────────────────────────────────────┐     │
│  │ AMDB → CARLA/Isaac airport environment   │     │
│  │ Aircraft + GSE 3D assets                 │     │
│  │ RoboSense RSHELIOS beam pattern config   │     │
│  │ Weather + lighting randomization         │     │
│  └─────────────────────────────────────────┘     │
│                     ↓                             │
│  Phase 2: Generate Sim Data (months 2-3)         │
│  ┌─────────────────────────────────────────┐     │
│  │ Domain randomization (§5)                │     │
│  │ Curriculum scenarios (§8)                │     │
│  │ 50K-200K labeled LiDAR scans             │     │
│  │ 1000+ turnaround scenarios               │     │
│  └─────────────────────────────────────────┘     │
│                     ↓                             │
│  Phase 3: Train on Sim (month 3)                 │
│  ┌─────────────────────────────────────────┐     │
│  │ Pre-train perception on sim data         │     │
│  │ Domain adversarial adaptation            │     │
│  │ Measure gap metrics (§9)                 │     │
│  └─────────────────────────────────────────┘     │
│                     ↓                             │
│  Phase 4: Fine-Tune on Real (month 4)            │
│  ┌─────────────────────────────────────────┐     │
│  │ Collect 500-2000 real labeled scans      │     │
│  │ PointLoRA fine-tuning (rank 16)          │     │
│  │ Self-training with pseudo-labels         │     │
│  │ TTA for remaining gap                    │     │
│  └─────────────────────────────────────────┘     │
│                     ↓                             │
│  Phase 5: Validate (months 4-5)                  │
│  ┌─────────────────────────────────────────┐     │
│  │ Open-loop evaluation on real test set    │     │
│  │ Closed-loop in simulation                │     │
│  │ Shadow mode on real vehicle              │     │
│  │ Scenario-based acceptance testing        │     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

---

## 12. Cost & Timeline

### 12.1 Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| Airport 3D assets (aircraft, GSE, crew) | $7,000-15,000 | One-time, reusable across airports |
| CARLA/Isaac Sim airport environment | $10,000-20,000 | Engineering + asset integration |
| Real data collection (500 labeled scans) | $7,500 | Annotation at $15/scan |
| GPU compute (sim generation + training) | $3,000-5,000 | Cloud GPU rental |
| Engineering (pipeline, adaptation, validation) | $20,000-30,000 | 2-3 months FTE |
| Digital twin per additional airport | $20,000-40,000 | If high-fidelity twin needed |
| **Total (first airport)** | **$50,000-75,000** | |
| **Each additional airport** | **$25,000-50,000** | Reuse assets + pipeline |

### 12.2 Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Simulation environment build | 6-8 weeks | CARLA/Isaac airport scene |
| Sim data generation | 2-3 weeks | 50K-200K labeled scans |
| Model training + adaptation | 3-4 weeks | Sim-trained + adapted model |
| Real data collection + fine-tuning | 3-4 weeks | Fine-tuned production model |
| Validation + shadow mode | 4-6 weeks | Validated for deployment |
| **Total** | **4-6 months** | Production-ready perception |

### 12.3 ROI Justification

```
Without simulation:
  - Need 10,000+ real labeled scans per airport: $150,000 annotation
  - Need 3-6 months of restricted airside data collection
  - Each new airport: repeat from scratch

With simulation:
  - Need 500-2000 real labeled scans per airport: $7,500-30,000 annotation
  - Simulation generates unlimited scenarios
  - Each new airport: $25-50K (env build) + 500 real scans

Savings per airport: $100,000-120,000
Break-even: After 1st airport
```

---

## 13. Recommended Strategy for Aurrigo {#13-recommended-strategy}

### 13.1 Phased Approach

```
┌─────────────────────────────────────────────────┐
│         RECOMMENDED SIM-TO-REAL STRATEGY         │
├─────────────────────────────────────────────────┤
│                                                   │
│  Simulator:  NVIDIA Isaac Sim (best LiDAR sim)   │
│              or CARLA 0.9.16 (free, UE5)         │
│                                                   │
│  Environment: AMDB → USD/OpenDRIVE conversion     │
│               + purchased aircraft/GSE assets     │
│                                                   │
│  LiDAR sim:  RoboSense RSHELIOS/RSBP config      │
│              + learned raydrop model               │
│              + rolling shutter compensation        │
│                                                   │
│  Training:   Phase 1: Sim pre-training (50K scans)│
│              Phase 2: Domain adaptation (adversarial)│
│              Phase 3: Real fine-tune (500-2K scans)│
│              Phase 4: Self-training + TTA          │
│                                                   │
│  Validation: Gap metrics < thresholds              │
│              Scenario-based acceptance              │
│              Shadow mode (4 weeks minimum)          │
│                                                   │
│  Expected accuracy: Within 3-5% of fully real-     │
│  data-trained model, using 10x less real data      │
│                                                   │
│  Cost: $50-75K first airport, $25-50K each next   │
│  Timeline: 4-6 months to production-ready          │
└─────────────────────────────────────────────────┘
```

### 13.2 Quick Win: LidarDM + Fine-Tuning

For a faster path (if high-fidelity simulation is too expensive):

```
1. Collect 100 real airside scans (unlabeled)
2. Use LidarDM (ICRA 2025) to generate 10,000 realistic variations
3. Train perception model on generated + augmented data
4. Fine-tune on 200-500 manually labeled real scans
5. Expected: ~80% of fully-supervised performance in 2-3 months
```

---

## 14. References

### Sim-to-Real Transfer
- "Towards Zero Domain Gap: A Comprehensive Study of Realistic LiDAR Simulation" (Waabi, 2024) — [waabi.ai/research/lidar-dg](https://waabi.ai/research/lidar-dg)
- "A platform-agnostic deep RL framework for effective Sim2Real transfer" (Nature, 2024) — [nature.com/articles/s44172-024-00292-3](https://www.nature.com/articles/s44172-024-00292-3)
- "Understanding Domain Randomization for Sim-to-Real Transfer" (ICLR 2024) — OpenReview
- "Towards Minimizing the LiDAR Sim-to-Real Domain Shift" (Sensors 2023) — [mdpi.com/1424-8220/23/24/9913](https://www.mdpi.com/1424-8220/23/24/9913)

### LiDAR Simulation
- **LidarDM**: Zyrianov et al., "Generative LiDAR Simulation in a Generated World" (ICRA 2025) — [github.com/vzyrianov/LidarDM](https://github.com/vzyrianov/LidarDM)
- **PCGen**: Li et al., "Point Cloud Generator for LiDAR Simulation" (2022) — [arxiv.org/abs/2210.08738](https://arxiv.org/abs/2210.08738)
- **UniSim**: Yang et al., "Neural Closed-Loop Sensor Simulator" (CVPR 2023)

### Digital Twins
- "High-Fidelity Digital Twins for Bridging the Sim2Real Gap in LiDAR-Based ITS Perception" (2025) — [arxiv.org/abs/2509.02904](https://arxiv.org/abs/2509.02904)
- "From Failure To Fidelity: Enabling Scalable Sim2real Lidar Perception Through Realistic Digital Twins" (UCF 2024)

### Simulation Platforms
- **CARLA 0.9.16**: carla.org — UE5, new Digital Twin Tool, NVIDIA NuRec support
- **NVIDIA Isaac Sim**: developer.nvidia.com — RTX LiDAR, USD, Isaac ROS
- **Applied Intuition**: appliedintuition.com — commercial-grade simulation

### Domain Adaptation
- "Object Detection Using Sim2Real Domain Randomization for Robotic Applications" (IEEE TRO 2022)
- "WARM-3D: Weakly-Supervised Sim2Real Domain Adaptation for Roadside Monocular 3D Object Detection" (2024)
