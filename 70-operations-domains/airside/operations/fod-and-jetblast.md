# FOD Detection and Jet Blast Hazard Prediction for Airport Airside Autonomous Vehicles

## Executive Summary

Foreign Object Debris (FOD) and jet blast represent two critical hazard classes for autonomous vehicles (AVs) operating on the airport airside. FOD -- loose hardware, broken pavement, wildlife, luggage fragments -- causes an estimated USD 4 billion in annual damage to aircraft and poses direct collision/tire-puncture risk to ground vehicles. Jet blast from taxiing and departing aircraft generates hurricane-force winds (up to 100 kt at 60 m behind a widebody at 40% N1) that can overturn ground vehicles, damage equipment, and injure personnel. Both hazards must be detected, predicted, and integrated into the AV's planning stack as first-class occupancy/cost channels.

This document covers FOD detection technologies (commercial and research), LiDAR-based and camera-based FOD sensing applicable to an AV platform, jet blast hazard zone modeling, jet blast prediction from aircraft state, occupancy grid representation of both hazard types, and integration with the AV motion planner.

---

## 1. FOD Detection Technologies -- Commercial Systems

### 1.1 Overview of the FOD Problem

FOD includes any foreign material on the airfield movement area that may cause damage to aircraft or ground vehicles: metal fasteners, stones, plastic fragments, tool bits, catering supplies, luggage parts, wildlife, rubber deposits, and ice/snow contaminants. The FAA Advisory Circular AC 150/5220-24 defines requirements for automated FOD detection systems.

Key performance requirements for FOD systems:
- **Detection probability (Pd):** >= 90% for objects >= 3 cm (FAA recommendation)
- **False alarm rate:** sufficiently low to avoid alarm fatigue (< 1 false alarm per scan cycle)
- **Scan cycle time:** complete runway coverage in < 60 seconds
- **All-weather operation:** rain, fog, night, low-sun-angle conditions

### 1.2 Tarsier (QinetiQ / Moog)

Tarsier is a **94 GHz frequency-modulated continuous-wave (FMCW) millimeter-wave radar** system developed by QinetiQ and exclusively licensed to Moog.

| Parameter | Value |
|-----------|-------|
| Frequency | 94 GHz (W-band) |
| Modulation | FMCW |
| Range resolution | 0.3 m |
| Detection range | 100% detection to 965 m (3,168 ft) |
| Minimum object RCS | Adjustable; default 2 cm per FAA advisory |
| Location accuracy | < +/- 1 m |
| Weather capability | All-weather, including zero-visibility conditions |
| Sensor complement | MMW radar + MIL-SPEC day/night camera + IR illuminator |

Tarsier can detect a metal bolt-sized object at 2 km range. Each sensor unit provides a wedge-shaped coverage sector; multiple units are deployed along the runway edge to achieve full coverage. The camera provides visual confirmation of radar detections, enabling operators to classify the FOD before dispatching removal.

**Deployment sites:** Vancouver International Airport, London Heathrow (trial), several military airbases.

### 1.3 FODetect (Xsight Systems)

FODetect is a **dual-sensor system combining 76-77 GHz FMCW millimeter-wave radar with electro-optical high-definition imaging** and near-infrared (NIR) illumination.

| Parameter | Value |
|-----------|-------|
| Radar frequency | 76-77 GHz (W-band) |
| Modulation | FMCW |
| Sensor unit | Surface Detection Unit (SDU) -- radar head, HD camera, NIR illuminator, laser line pointer |
| Scan cycle | < 60 seconds for full runway |
| Day/night | 24/7 operation; automatic night-mode switching to NIR |
| Compliance | FAA AC 150/5220-24 |

SDUs are distributed along both runway edges. The radar detects changes on the ground surface (change-detection approach), and the camera provides classification imagery. The laser line pointer can be used to guide maintenance crews to the exact FOD location.

**Deployment sites:** Chicago O'Hare, Boston Logan, Tel Aviv Ben Gurion, Noi Bai and Tan Son Nhat (planned).

### 1.4 iFerret (Stratech Systems)

iFerret is a **purely electro-optical (EO) system** using high-definition cameras and proprietary image-processing software.

| Parameter | Value |
|-----------|-------|
| Sensor type | High-definition EO cameras |
| Minimum detectable object | 4 cm at 302 m range |
| Detection accuracy | > 95% in all weather conditions |
| Coverage | 4 km x 60 m runway from distributed sensor positions |
| Camera capability | Full HD, 70X zoom for visual assessment |
| Features | Self-calibrating cameras, automated scene analysis, configurable scan resolution |

iFerret uses temporal differencing and background modeling to detect new objects appearing on the runway surface. The 70X zoom enables operators to visually classify detected FOD remotely.

**Deployment sites:** Singapore Changi Airport (operational since ~2009), Hong Kong International Airport.

### 1.5 Pavemetrics LFOD (Laser FOD Detection)

The Pavemetrics LFOD system is a **vehicle-mounted laser profiling system** rather than a fixed infrastructure system.

| Parameter | Value |
|-----------|-------|
| Sensor type | 3D laser line profilers + 2D cameras |
| Minimum detectable object | 2 mm |
| Scanning resolution | 1 mm |
| Inspection speed | 0-100 km/h |
| Coverage | Full runway in a few passes |
| Lighting | Day and night; sun, shadow, all pavement types |

Two 3D laser sensors are mounted on a vehicle and scan the surface as the vehicle drives. The system acquires both 2D images and high-resolution 3D surface profiles, enabling detection of extremely small objects that are invisible to radar and camera at standoff ranges.

**Relevance to AV:** The LFOD concept is directly applicable to an AV platform. A similar laser profiler could be mounted on the AV itself for near-field FOD detection of the path directly ahead.

### 1.6 Navtech Radar

Navtech offers a **spinning radar sensor** with a 150 m detection radius that completes a full scan every 7 seconds, detecting objects as small as 3 cm x 3 cm x 3 cm. This is a more compact, lower-cost alternative to the runway-length fixed installations.

### 1.7 FOD Detection Research -- 93 GHz MMW Radar (Beijing study)

A research system operating at **93 GHz with 2 GHz bandwidth** demonstrated:

| Metric | CM CFAR | CA CFAR | GO CFAR | SO CFAR |
|--------|---------|---------|---------|---------|
| Detection probability (Pd) | 94.59% | 73.68% | 76.92% | 57.14% |
| False alarm probability (Pfa) | 0% | 2.63% | 5.13% | 41.27% |
| Kappa coefficient | 0.97 | 0.85 | 0.87 | 0.73 |

The Clutter Map (CM) CFAR algorithm, which exploits temporal stability of ground clutter, outperformed all spatial-domain CFAR methods. The system detected **golf balls (43 mm diameter, < -28 dBsm RCS) at > 660 m range**, substantially exceeding commercial system capabilities that typically require minimum RCS of -20 dBsm within 300 m.

### 1.8 Sensor Technology Comparison Summary

| Technology | Min Object | Range | Weather | Cost | AV-Mountable |
|-----------|-----------|-------|---------|------|-------------|
| MMW Radar (94 GHz) | ~2 cm | 1-2 km | Excellent | High (infrastructure) | Possible (smaller units) |
| MMW Radar (76-77 GHz) | ~3 cm | 300-500 m | Excellent | High (infrastructure) | Yes (automotive radar) |
| Electro-Optical | ~4 cm at 300 m | 300-500 m | Good (degraded in fog/rain) | Medium | Yes |
| 3D Laser Profiler | ~2 mm | Near-field (vehicle path) | Good | Medium | Yes |
| LiDAR (3D scanning) | ~1 cm (near) | 50-200 m | Moderate | Medium | Yes (standard AV sensor) |

---

## 2. FOD Detection from LiDAR

### 2.1 Challenge: Small Ground-Level Objects in Point Clouds

Detecting FOD from a vehicle-mounted LiDAR is fundamentally different from detecting cars or pedestrians. FOD objects are:
- **Small:** typically 1-30 cm in the largest dimension
- **Low-profile:** sitting flat on the ground surface, often only a few cm above pavement
- **Sparse in points:** at 50 m range, a 64-beam LiDAR at 0.2 deg vertical resolution produces beam spacing of ~17 cm, meaning a 5 cm object may receive 0-1 points
- **Ambiguous:** small clusters of points can be noise, ground texture, pavement joints, or actual FOD

### 2.2 Point Density vs. Range Analysis

For a typical 128-beam LiDAR (e.g., Ouster OS1-128) with 0.35 deg vertical resolution and 0.18 deg horizontal resolution:

| Range (m) | Vertical beam spacing (cm) | Horizontal point spacing (cm) | Min detectable height (cm) | Points on 10cm object |
|-----------|--------------------------|------------------------------|---------------------------|---------------------|
| 10 | 6.1 | 3.1 | ~3 | 5-10 |
| 25 | 15.3 | 7.9 | ~8 | 1-3 |
| 50 | 30.5 | 15.7 | ~15 | 0-1 |
| 100 | 61.1 | 31.4 | ~30 | 0 |

**Implication:** Reliable LiDAR-based FOD detection for objects < 10 cm is limited to approximately **25 m range** with a 128-beam LiDAR. Beyond 50 m, only objects > 15 cm can be reliably detected.

### 2.3 Ground Segmentation for FOD

Before FOD can be detected, ground points must be precisely separated from above-ground points. Standard approaches include:

1. **Grid-based elevation mapping:** Divide the ground plane into cells (e.g., 10 cm x 10 cm), compute min/max elevation per cell, flag cells where max - min exceeds a threshold delta
2. **RANSAC plane fitting:** Fit a ground plane model using RANSAC; points above the plane by more than a threshold are candidate objects
3. **Multi-region polar grid segmentation:** Divide the point cloud into concentric rings with adaptive grid density (dense near, coarse far) to handle LiDAR's non-uniform point distribution; apply piecewise plane fitting within each region
4. **GndNet / learned ground segmentation:** Neural network approaches that learn the ground surface model from data, providing more robust segmentation on uneven surfaces

For FOD detection, ground segmentation must be extremely precise -- the residual error between the fitted ground plane and actual ground surface must be < 1-2 cm to avoid false positives from pavement undulation.

### 2.4 Anomaly Detection / Change Detection Approach

Rather than training a detector on specific FOD classes (impractical given the open-set nature of debris), the preferred approach is **anomaly detection via map differencing:**

1. **Build a reference map:** Aggregate multiple LiDAR scans of the clean ground surface into a high-resolution elevation map (digital surface model at 5-10 cm grid resolution)
2. **Compare live scan to reference:** For each grid cell, compare the live scan elevation to the reference elevation; cells with significant positive deviation (> threshold, e.g., 3 cm) are flagged as potential FOD
3. **Temporal persistence filter:** Require an anomaly to persist across N consecutive scans (e.g., 3-5 frames) to suppress transient noise
4. **Spatial clustering:** Apply DBSCAN or connected-component analysis to group flagged cells into FOD candidates

This approach is sensor-agnostic (works with LiDAR, radar, or structured light) and class-agnostic (detects any new object, regardless of type).

### 2.5 Occupancy-Based FOD Detection

The world model's occupancy grid provides a natural framework for FOD detection:

1. **Expected occupancy layer:** From the HD map, certain cells are expected to be empty (pavement surface), while others contain known infrastructure (curbs, signs, lights)
2. **Observed occupancy layer:** The LiDAR-derived occupancy grid at each timestep
3. **Anomaly layer:** `anomaly = observed AND NOT expected` -- cells that are observed as occupied but should be empty according to the map

This produces a binary FOD candidate mask that can be further filtered by:
- Minimum cluster size (suppress single-cell noise)
- Maximum cluster size (large objects are not FOD but vehicles/aircraft)
- Height range (FOD is typically 1-30 cm above ground)
- Persistence (must appear in multiple frames)

### 2.6 Improving Detection with Multi-Frame Aggregation

A moving AV can exploit motion to improve FOD detection:
- **Accumulate points:** As the AV moves, aggregate point clouds from multiple frames into a single dense map. A 5 cm object at 30 m that receives 0 points per frame may receive 2-3 points across 5 frames from different viewing angles
- **Ray-casting for freespace:** If a LiDAR beam passes through a cell without hitting anything, that cell is confirmed empty; inconsistency between freespace evidence and occupied evidence strengthens detection confidence

### 2.7 LiDAR FOD Detection Research Results

Research on LiDAR FOD detection at airport aprons showed:
- A scanning LiDAR system could detect a **suitcase-sized object within 165 m radius in < 60 seconds**
- Coverage area: ~85,530 sq m (8.5 hectares) per sensor
- The system is effective for medium-to-large FOD but struggles with small metallic debris (bolts, rivets) at range due to sparse point density
- The US Air Force "FOD dog" robot combines an **Ouster 64-beam LiDAR with Intel RealSense camera and structured light projector** for near-field FOD detection with sensor fusion

---

## 3. FOD Detection from Camera

### 3.1 Deep Learning Object Detection Approaches

Camera-based FOD detection leverages the high spatial resolution of cameras (millions of pixels vs. thousands of LiDAR points) but faces challenges with depth estimation and varying illumination.

**Supervised detection models tested on FOD:**

| Model | Dataset | mAP@0.5 | mAP@0.5:0.95 | F-measure | Notes |
|-------|---------|---------|--------------|-----------|-------|
| YOLOv3 | FOD-A | 12.42% (cat. acc.) | -- | -- | Poor on diverse FOD categories |
| SSD | FOD-A | 71.81% (cat. acc.) | -- | -- | Better feature extraction |
| YOLOv5m | FOD-Runway | 91.1% | 86.8% | 0.894 | 71 classes, augmented dataset |
| YOLOv8x | FOD-Runway | 93.9% | 93.9% | 0.907 | Best supervised performance |
| Improved YOLOv8 | Custom | 94.0% | 93.0% | -- | Multi-attention + BiFPN |

**Key finding:** Performance is highly dependent on dataset quality and diversity. Small-scale FOD under varied lighting remains the hardest case.

### 3.2 FOD Datasets

#### FOD-A (Foreign Object Debris in Airports)
- **Source:** University of Nebraska Omaha
- **Size:** 31 object categories, > 30,000 annotation instances
- **Categories:** Aircraft fasteners, engine parts, tools, catering supplies, luggage items, runway materials, construction debris, plastic materials, natural debris, winter contaminants (selected based on FAA guidance)
- **Annotation format:** Bounding boxes (Pascal VOC format); environmental labels
- **Resolution:** Originally 2K-4K, resized to 400x400 for standardized modeling
- **Environmental labels:** Weather (dry: 26,647 instances; wet: 7,216 instances), Light level (bright: 17,012; dim: 12,464; dark: 4,387)
- **Collection method:** Video (MP4) from portable cameras and UAVs, extracted at 15 FPS
- **Expandable:** Command-line tool for automated video processing and dataset extension

#### FOD-Runway
- **Size:** 71 object classes, 33,286 images (augmented)
- **Focus:** Objects likely found on runway environments

#### Shanghai Hongqiao FOD Dataset
- **Size:** 3,470 images
- **Categories:** 3 material classes (metal, concrete, plastic)

#### IVFOD Dataset
- **Size:** 4,137 image pairs, 7,217 instances
- **Categories:** 4 classes (screw, nut, key, bottle)

### 3.3 Training Approaches

**Transfer learning** is the dominant paradigm: pre-train on COCO/ImageNet, fine-tune on FOD-specific datasets. Key considerations:

1. **Data augmentation:** Essential due to limited FOD training data. Techniques include random crop, rotation, color jitter, mosaic augmentation, and synthetic placement of FOD objects onto clean runway backgrounds
2. **Multi-scale detection:** FOD objects span a huge size range (1 cm bolt to 50 cm luggage piece). Feature Pyramid Networks (FPN) or Bi-directional FPN (BiFPN) are critical for multi-scale feature extraction
3. **Small object specialization:** Standard anchor sizes in YOLO/SSD are tuned for pedestrians/cars. FOD-specific anchor optimization (clustering on FOD bounding box statistics) substantially improves small-object detection
4. **Dual light mode:** Training with both visible and NIR images improves night-time performance. Some approaches use dual-input networks with separate feature extractors for each modality

### 3.4 Zero-Shot Detection with Foundation Models

The open-set nature of FOD (any arbitrary object could appear on the airfield) makes foundation models highly relevant:

#### Grounding DINO + SAM Pipeline
1. **Grounding DINO** (open-vocabulary detector): Given text prompts like "bolt", "metal debris", "plastic fragment", "stone", "tool", "foreign object on pavement", the model localizes candidate regions in the image. Achieves COCO zero-shot 52.5 AP without any COCO training data
2. **SAM 2** (Segment Anything Model): Segments the detected regions at pixel level for precise FOD boundary delineation
3. **Pipeline:** Grounding DINO detects candidates -> SAM segments each candidate -> post-processing filters by size, location (must be on pavement), and confidence

**Prompt engineering for FOD:**
```
Positive prompts: "debris", "bolt", "nut", "screw", "metal fragment", "stone",
    "plastic piece", "rubber fragment", "tool", "foreign object", "wire",
    "luggage piece", "broken part"
Negative context: "pavement marking", "runway light", "taxiway sign",
    "manhole cover" (known infrastructure to suppress)
```

#### Anomaly Detection with Vision-Language Models
- **AnomalyCLIP / AnomalyGPT:** Zero-shot anomaly detection using CLIP embeddings. The model learns what "normal" pavement looks like and flags deviations
- **CLIP-SAM cascade:** CLIP provides anomaly localization, SAM provides boundary segmentation
- **Advantage:** No FOD-specific training data required. The model generalizes to any foreign object type, including objects never seen before
- **Limitation:** Higher compute cost (transformer inference) and potential for false positives on legitimate pavement features (cracks, stains, markings)

### 3.5 Practical Camera FOD Detection for AV

For an AV platform, the recommended camera-based FOD pipeline:

1. **Forward-facing camera** (high resolution, e.g., 8 MP): primary FOD detection sensor at 10-50 m range
2. **Change detection backbone:** Compare current frame to a reference appearance model of the expected pavement. Use feature-level differencing (not pixel-level) for robustness to lighting changes
3. **Foundation model verification:** Run Grounding DINO on candidate regions for classification. Only fire alerts for high-confidence FOD classifications
4. **LiDAR cross-validation:** If camera detects a candidate, check corresponding LiDAR occupancy for confirmation (multi-modal fusion reduces false positives)

---

## 4. Jet Blast Hazard Zones

### 4.1 Physics of Jet Blast

Jet blast is the high-velocity exhaust gas stream from aircraft turbofan/turbojet engines. The exhaust velocity decays downstream following an exponential centerline decay model. Key physics:

- **Nozzle exit velocity:** 200-600+ knots depending on engine type and thrust setting
- **Centerline decay:** Velocity decreases approximately as V(x) ~ V0 * exp(-kx), where x is distance downstream and k depends on engine geometry and ambient conditions
- **Spreading angle:** The jet cone spreads at approximately 10-15 degrees half-angle
- **Ground effect:** When exhaust impinges on the ground surface, it spreads laterally, creating a wider but lower-velocity hazard zone

The Witze centerline decay model provides the foundational equation for jet blast prediction:

```
V_cl(x) / V_j = 1                                     for x < x_core
V_cl(x) / V_j = C1 * (rho_e/rho_j)^0.5 * (D/x)       for x > x_core
```

Where:
- `V_cl(x)` = centerline velocity at distance x
- `V_j` = jet exit velocity
- `rho_e/rho_j` = density ratio (ambient to jet)
- `D` = effective nozzle diameter
- `x_core` = potential core length (Kleinstein constant = 0.70)
- `C1` = proportionality constant (~6.0 for subsonic jets)

An operational jet blast model uses three coupled modules:
1. **Jet exhaust model:** Computes nozzle exit conditions (velocity, temperature, pressure) from engine thermodynamic cycle analysis or manufacturer data
2. **Centerline decay model:** 1-D exponential decay of a free jet into still air, using the Witze formulation
3. **Aircraft motion model:** Accounts for aircraft forward motion, which shifts and stretches the exhaust plume

### 4.2 Velocity Thresholds

ICAO and industry define velocity thresholds for different hazard levels:

| Velocity | Effect |
|----------|--------|
| 35 knots (65 km/h) | Threshold for personnel discomfort / light equipment displacement |
| 50 knots (93 km/h) | Risk of overturning light ground vehicles and equipment |
| 65 knots (120 km/h) | Structural damage risk to light aircraft and infrastructure |
| 100 knots (185 km/h) | Severe hazard -- can overturn heavy equipment, damage buildings |

The 35-knot contour is the standard safety boundary for ground operations. ICAO defines 56 km/h (approximately 30 knots) as the threshold for comfort of operations behind an aircraft.

### 4.3 Jet Blast Zones by Aircraft Type and Thrust Setting

The extent of jet blast hazard zones varies dramatically by aircraft type and thrust setting. Data compiled from Boeing Airport Planning documents, Airbus Aircraft Characteristics documents, and operational measurements:

#### Idle Thrust (Ground Idle, ~7% N1)

| Aircraft | Engine | 35-kt contour behind tail (m) | 50-kt contour (m) |
|----------|--------|-------------------------------|-------------------|
| B737-800 | CFM56-7B | ~30 | ~15 |
| A320-200 | CFM56-5B / V2500 | ~25 | ~12 |
| B777-300ER | GE90-115B | ~60 | ~35 |
| B747-400 | CF6-80C2 / PW4000 | ~50 | ~30 |
| A380-800 | Trent 900 / GP7200 | ~55 | ~32 |

#### Breakaway Thrust (~25-40% N1)

| Aircraft | Engine | 35-kt contour behind tail (m) | Reported contour (m) |
|----------|--------|-------------------------------|---------------------|
| B737-800 | CFM56-7B | ~148 | 148 m (airsight measurement) |
| A320-200 | CFM56-5B | ~29 | 29 m (airsight measurement) |
| B777-300ER | GE90-115B | ~200 | ~400 ft (Boeing) |
| B747-400 | CF6-80C2 | ~180 | Contours 2x more demanding than A380 |
| A380-800 | Trent 900 | ~90 | Declared contours smaller than B747-400 |

**Critical observation from airsight research:** The breakaway contours for B737-800 and A320-200 diverge enormously (148 m vs. 29 m) despite nearly identical aircraft dimensions, mass, and engine class. This is because there are **no standardized methods** for determining jet blast values -- manufacturers use non-comparable approaches, and values are inconsistent even within a single manufacturer's fleet. This means AV systems cannot blindly trust manufacturer-declared contours; operational safety margins must be applied.

#### Takeoff / Full Thrust

| Aircraft | 35-kt contour behind tail (m) | 100-mph zone (m) | Max hazard distance (m) |
|----------|-------------------------------|-------------------|------------------------|
| B737-800 | ~300 | ~40 (125 ft) | ~200 (650 ft) |
| B777-300ER | ~500 | ~90 (300 ft) | ~400 (1,300 ft) |
| B747-400 | ~450 | ~85 | ~580 (1,900 ft) |
| A380-800 | ~400 | ~80 | ~500 |

**Reference velocity decay data (B737-200 at takeoff thrust):**
- At tail: 300 mph
- 50 ft (15 m) behind: 200 mph
- 125 ft (38 m) behind: 100 mph
- 250 ft (76 m) behind: 70 mph

**Reference velocity decay (general high-bypass turbofan):**
- At nozzle exit: 375 mph (e.g., PW306A: 613 knots at 1052 deg F)
- 100 ft behind: > 230 mph
- 150 ft behind: ~100 knots, 94 deg F
- 200 ft behind: ~50 knots, 85 deg F

### 4.4 Engine Spool-Up Dynamics

Jet blast zones are not static -- they change as engines spool up or down. Key timing:
- **Idle to takeoff thrust:** approximately 6-8 seconds for most engines (CFM56-3: ~6 seconds max)
- **Larger fans spool slower** due to rotational inertia (GE90: ~8 seconds)
- **Breakaway thrust application:** Pilots typically increase from idle to breakaway briefly to initiate movement, then reduce back. Duration is 2-5 seconds

For an AV planner, the jet blast zone must be computed for the **anticipated future thrust setting**, not just the current one. When an aircraft is observed initiating pushback or receiving taxi clearance, the planner should proactively expand the hazard zone.

---

## 5. Jet Blast Prediction

### 5.1 Inputs for Jet Blast Prediction

To compute the jet blast hazard zone for a specific aircraft, the AV system needs:

1. **Aircraft type (ICAO type code):** Maps to engine model and thrust parameters
2. **Aircraft position:** GPS/ADS-B or LiDAR/camera tracking
3. **Aircraft heading:** Determines exhaust direction (exhaust is emitted aft along the aircraft longitudinal axis)
4. **Engine status:** Running/not running, approximate thrust setting
5. **Operational phase:** Parked (engines off), pushback (engines starting), taxi (idle/breakaway), runway (takeoff thrust)

### 5.2 ADS-B Integration for Aircraft Identification

ADS-B (Automatic Dependent Surveillance-Broadcast) provides the primary data source for aircraft identification and state estimation on the airside:

**ADS-B Out broadcasts (1 Hz update rate):**
- **ICAO 24-bit address:** Unique aircraft identifier, maps to registration/tail number
- **Aircraft type code:** 2-4 character ICAO type designator (e.g., B738, A320, B77W, A388)
- **Position:** GPS-derived latitude/longitude
- **Altitude:** Barometric and geometric
- **Ground speed and heading:** From GPS velocity
- **Air/ground status:** Binary flag indicating surface operations
- **Velocity:** Ground track and vertical rate

**Aircraft type to engine mapping database:**
```
B738 -> CFM56-7B26 or CFM56-7B27 (26,400-27,300 lbf thrust)
A320 -> CFM56-5B4 (27,000 lbf) or IAE V2527-A5 (27,000 lbf)
B77W -> GE90-115B (115,540 lbf thrust)
B744 -> CF6-80C2B5F (62,100 lbf) or PW4062 (62,000 lbf) or RB211-524H (60,600 lbf)
A388 -> Trent 972 (72,000 lbf) or GP7270 (70,000 lbf)
```

**ADS-B limitations for jet blast prediction:**
- ADS-B does not directly report engine thrust setting or N1/N2 RPM
- Ground speed can be used as a proxy: stationary = likely idle; accelerating from stop = breakaway; high acceleration on runway = takeoff thrust
- Update rate (1 Hz) is sufficient for jet blast zone computation since zones change on 5-10 second timescales

### 5.3 Supplementary Data Sources

| Source | Data Provided | Latency |
|--------|-------------|---------|
| ADS-B | Type, position, heading, ground speed | 1 second |
| Multilateration (MLAT) | Position (higher accuracy than ADS-B alone) | < 1 second |
| Airport CDMS (Collaborative Decision Making) | Gate assignment, pushback time, taxi route | Minutes |
| ATC radio (future: digital) | Taxi clearance, takeoff clearance | Real-time |
| Visual/LiDAR tracking | Position, heading, engine running (visual cue) | 100 ms |
| Thermal camera | Engine heat signature (running/not running) | 100 ms |

### 5.4 Jet Blast Zone Computation Algorithm

```
function compute_jet_blast_zone(aircraft):
    # Step 1: Identify aircraft and engine
    icao_type = lookup_type(aircraft.icao_address)
    engine = engine_database[icao_type]

    # Step 2: Estimate thrust setting from operational context
    if aircraft.ground_speed < 2 kt:
        if aircraft.phase == PARKED:
            thrust = ENGINE_OFF  # No hazard zone
        else:
            thrust = IDLE
    elif aircraft.ground_speed < 15 kt:
        if aircraft.acceleration > threshold:
            thrust = BREAKAWAY
        else:
            thrust = IDLE
    elif aircraft.on_runway and aircraft.acceleration > takeoff_threshold:
        thrust = TAKEOFF
    else:
        thrust = IDLE

    # Step 3: Look up exhaust parameters
    V_exit = engine.exhaust_velocity[thrust]
    T_exit = engine.exhaust_temperature[thrust]
    D_eff = engine.effective_nozzle_diameter

    # Step 4: Compute velocity contours using Witze decay
    for distance in range(0, max_distance, step):
        V_centerline = witze_decay(V_exit, D_eff, distance, rho_ambient, rho_exit)
        # Lateral spread: V(r) = V_centerline * exp(-r^2 / (2 * sigma(x)^2))
        # where sigma(x) ~ 0.1 * x (10% spread angle)
        for each velocity_threshold in [35, 50, 65, 100]:  # knots
            contour = compute_contour(V_centerline, sigma, velocity_threshold)
            zones[velocity_threshold].append(contour)

    # Step 5: Transform to world coordinates
    for zone in zones:
        zone.rotate(aircraft.heading + 180)  # Exhaust is aft
        zone.translate(aircraft.engine_positions)  # Account for wing-mounted engine offsets

    return zones
```

### 5.5 Safety Margins

Given the inconsistencies in manufacturer jet blast data (B737-800 vs. A320 breakaway contour divergence of 148 m vs. 29 m), the AV system should apply conservative safety margins:

1. **Use the larger of manufacturer-declared and empirically-measured contours** for each aircraft type
2. **Add a 20-30% distance buffer** beyond the 35-knot contour
3. **When thrust setting is uncertain, assume the worst case** for the current operational phase (e.g., if taxi speed suggests idle but aircraft just received takeoff clearance, use breakaway contour)
4. **Wind correction:** Crosswind shifts the exhaust plume laterally; headwind compresses the zone (shorter but higher velocity); tailwind extends the zone

---

## 6. Jet Blast as Occupancy

### 6.1 Representing Jet Blast in the Occupancy Grid

The AV's world model maintains a multi-channel occupancy grid. Jet blast zones are represented as a **hazard cost channel** alongside physical occupancy:

```
Occupancy Grid Channels:
  [0] Physical occupancy (0.0 = free, 1.0 = occupied by solid object)
  [1] FOD hazard (0.0 = clean, 1.0 = confirmed FOD)
  [2] Jet blast hazard (0.0 = safe, 0.1-1.0 = scaled by velocity/danger)
  [3] Prop wash hazard (similar to jet blast, for turboprops)
  [4] Aircraft ingestion zone (forward of engines -- intake hazard)
  [5] Dynamic obstacle probability (vehicles, personnel)
  [6] Restricted zone (construction, closed taxiway)
```

### 6.2 Jet Blast Channel Encoding

The jet blast channel uses a **continuous hazard value** rather than binary occupied/free:

```
hazard_value(cell) = max over all active aircraft of:
    velocity_at_cell / reference_velocity

where reference_velocity = 35 knots (minimum hazard threshold)
```

Mapping:
- 0.0: No jet blast (velocity < 35 kt)
- 0.3: Low hazard (35-50 kt velocity)
- 0.6: Medium hazard (50-65 kt velocity)
- 0.8: High hazard (65-100 kt velocity)
- 1.0: Extreme hazard (> 100 kt velocity)

### 6.3 Dynamic Update as Engines Spool

The jet blast layer must be updated dynamically as aircraft engine states change:

1. **Trigger events:**
   - Aircraft pushback initiated (engines will start within 1-3 minutes)
   - Aircraft begins moving (breakaway thrust applied)
   - Aircraft enters runway (anticipate takeoff thrust within 30-60 seconds)
   - Aircraft decelerates after landing (reverse thrust then idle)

2. **Predictive expansion:**
   - When pushback is detected, expand from ENGINE_OFF to IDLE zone over 60 seconds
   - When runway entry is detected, expand from IDLE to anticipated TAKEOFF zone with 30-second lead time
   - Use exponential smoothing to prevent jarring zone jumps

3. **Update rate:** Jet blast zones should be recomputed at **2-5 Hz** to match the AV's planning cycle. Since the underlying ADS-B data updates at 1 Hz, intermediate states are interpolated.

### 6.4 Grid Resolution Considerations

| Grid resolution | Jet blast modeling fidelity | Compute cost |
|----------------|---------------------------|-------------|
| 1.0 m | Adequate for zone boundaries | Low |
| 0.5 m | Good velocity gradient representation | Medium |
| 0.25 m | High fidelity, smooth contours | High |
| 0.1 m | Excessive for jet blast (needed for FOD) | Very high |

**Recommendation:** Use 0.5 m grid resolution for the jet blast hazard channel. This captures the gradual velocity gradient and provides sufficient spatial resolution for path planning. The FOD channel may use higher resolution (0.1-0.25 m) in the near-field around the AV.

### 6.5 Multi-Aircraft Superposition

When multiple aircraft are operating simultaneously (common on busy aprons), jet blast zones from all aircraft must be superimposed:

```
jet_blast_grid[cell] = max(
    jet_blast_from_aircraft_1[cell],
    jet_blast_from_aircraft_2[cell],
    ...
    jet_blast_from_aircraft_N[cell]
)
```

Using max (rather than sum) is appropriate because the hazard from a cell is dominated by the strongest jet blast affecting it.

---

## 7. Integration with AV Planning

### 7.1 Planner Architecture for Hazard Avoidance

The AV motion planner must treat jet blast zones and FOD locations as planning constraints:

```
Total cost(cell) = w_occ * physical_occupancy(cell)
                 + w_fod * fod_hazard(cell)
                 + w_jet * jet_blast_hazard(cell)
                 + w_dist * distance_to_goal_cost(cell)
                 + w_smooth * smoothness_cost(cell)
```

Where:
- `w_occ = infinity` (hard constraint: never enter physically occupied cells)
- `w_fod = very high` (strong avoidance of FOD cells; may be traversed only in emergency at low speed)
- `w_jet = high, velocity-dependent` (graduated avoidance: 35-50 kt zones are avoidable detour triggers; > 65 kt zones are hard constraints)
- Weights are tunable based on operational policy

### 7.2 Jet Blast Avoidance Behavior

The planner should exhibit the following behaviors:

1. **Route around jet blast zones:** When a taxiway behind an aircraft with running engines is affected, the planner should compute an alternative route that avoids the 35-knot contour. This may involve:
   - Waiting for the aircraft to move
   - Taking an alternative taxiway
   - Increasing lateral offset within the taxiway

2. **Speed adaptation in marginal zones:** If the AV must pass through the outer edge of a jet blast zone (e.g., 30-40 kt zone where avoidance would require an excessively long detour), reduce speed and increase stability margin. The AV should orient its broadest face perpendicular to minimize aerodynamic force.

3. **Predictive waiting:** If an aircraft is about to depart (runway entry detected), the planner should proactively stop at a safe distance and wait for the aircraft to clear the runway before proceeding. The hold point should be outside the anticipated takeoff-thrust 35-knot contour.

4. **Dynamic replanning:** As jet blast zones expand (engine spool-up) or contract (aircraft departure complete, engines at distance), the planner must replan in real-time. The planning cycle (2-5 Hz) must be fast enough to react to thrust changes that occur over 6-8 seconds.

### 7.3 FOD Avoidance Routing

FOD avoidance follows a simpler pattern:

1. **Hard avoidance in path:** If FOD is detected on the planned path, the planner computes a lateral offset or alternative route to avoid the FOD location
2. **Safety buffer:** Apply a 1-2 m buffer around detected FOD (FOD may have scattered fragments not individually detected)
3. **Speed reduction:** If FOD is detected near the path but not directly on it, reduce speed to allow more reaction time
4. **Continue-and-report vs. stop-and-alert:** Policy decision based on FOD severity:
   - Small debris (< 5 cm): log position, continue, report for manual pickup
   - Medium debris (5-30 cm): slow down, avoid, immediate alert to ops
   - Large debris (> 30 cm): stop, alert, wait for manual clearance

### 7.4 Alerting Pipeline

The alerting pipeline connects sensor detection to operational response:

```
Detection Layer:
  LiDAR anomaly detector  --\
  Camera FOD detector      --+--> Fusion & Confirmation --> FOD Alert
  Radar (if equipped)     --/

  ADS-B receiver          --\
  Visual aircraft tracker  --+--> Jet Blast Predictor --> Jet Blast Alert
  Operational context     --/

Alert Processing:
  FOD Alert:
    - Priority: HIGH
    - Action: log GPS coordinates, capture image, mark on occupancy grid
    - Notification: Airport Operations Control Center (AOCC) via API
    - AV behavior: avoid and continue, or stop if on runway

  Jet Blast Alert:
    - Priority: MEDIUM (idle) / HIGH (breakaway) / CRITICAL (takeoff)
    - Action: update hazard grid, trigger replanning
    - Notification: AV safety system; no external notification needed (normal ops)
    - AV behavior: route around or hold position

Alert Escalation:
  If FOD on active runway:
    -> CRITICAL alert to AOCC
    -> Recommend runway inspection / closure

  If AV cannot avoid jet blast zone:
    -> Emergency stop
    -> Apply parking brake and orient vehicle
    -> Alert to AOCC for manual intervention
```

### 7.5 System Integration Architecture

```
                    ┌──────────────┐
                    │   ADS-B Rx   │
                    │  (1 Hz)      │
                    └──────┬───────┘
                           │ aircraft type, pos, heading, speed
                           ▼
┌───────────┐     ┌──────────────────┐     ┌─────────────────┐
│  LiDAR    │────>│                  │────>│   Occupancy     │
│  Pipeline │     │   World Model    │     │   Grid          │
├───────────┤     │                  │     │   [0] Physical  │
│  Camera   │────>│  - FOD detector  │     │   [1] FOD       │
│  Pipeline │     │  - Jet blast     │     │   [2] Jet blast │
├───────────┤     │    predictor     │     │   [3] Prop wash │
│  Radar    │────>│  - Object tracker│     │   [4] Intake    │
│  (opt.)   │     │  - Map manager   │     │   [5] Dynamic   │
└───────────┘     └──────────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────┐
                                           │  Motion Planner  │
                                           │  - Cost map gen  │
                                           │  - A*/RRT/lattice│
                                           │  - Speed profile │
                                           │  - Safety checks │
                                           └────────┬────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────┐
                                           │  Vehicle Control │
                                           │  - Steering      │
                                           │  - Throttle/Brake│
                                           │  - E-stop        │
                                           └─────────────────┘
```

### 7.6 Operational Scenarios

**Scenario 1: FOD on Taxiway**
1. AV camera detects candidate at 40 m; LiDAR confirms occupied cell at ground level
2. FOD alert generated, GPS coordinates logged, image captured
3. Planner computes 2 m lateral offset to avoid FOD
4. Alert sent to AOCC with location and image
5. AOCC dispatches sweep vehicle

**Scenario 2: Taxiing Behind B777**
1. ADS-B identifies aircraft as B77W (GE90-115B engines) at idle thrust
2. Jet blast predictor computes 60 m aft zone at 35 kt contour
3. AV maintains > 70 m following distance (60 m + 10 m buffer)
4. If B777 applies breakaway thrust (detected via ground speed increase), zone expands to ~200 m
5. AV stops and waits until aircraft moves away

**Scenario 3: Aircraft Departing Nearby Runway**
1. ADS-B shows B738 entering runway 500 m away, heading perpendicular to AV's taxiway
2. Jet blast predictor anticipates takeoff thrust: 35-kt contour extends ~300 m aft
3. AV's taxiway intersects the predicted zone
4. Planner initiates hold at safe point before zone boundary
5. After B738 rotates and climbs, zone dissipates; AV resumes

**Scenario 4: Crowded Apron Operations**
1. Multiple aircraft at gates with engines running (idle)
2. Jet blast zones from multiple aircraft superimposed on occupancy grid
3. Planner finds corridor between jet blast zones
4. AV navigates through safe corridor at reduced speed
5. Continuous monitoring for any aircraft thrust increase

---

## 8. Implementation Recommendations

### 8.1 Phase 1: Foundation
- Implement ADS-B receiver and aircraft type database for jet blast zone prediction
- Build jet blast hazard channel in occupancy grid using lookup tables (aircraft type x thrust setting -> zone geometry)
- Deploy camera-based FOD detection using YOLOv8 fine-tuned on FOD-A dataset
- Integrate both hazard channels into the cost map for the motion planner

### 8.2 Phase 2: Enhancement
- Add LiDAR-based FOD detection via map differencing (reference map vs. live scan)
- Implement foundation model (Grounding DINO) as secondary FOD classifier
- Refine jet blast prediction with operational context (CDMS integration, taxi clearance awareness)
- Build temporal persistence filtering for FOD (reduce false positives)
- Validate jet blast zones against CFD simulation data for key aircraft types

### 8.3 Phase 3: Advanced
- Fuse camera + LiDAR + radar for multi-modal FOD detection with highest confidence
- Implement predictive jet blast (anticipate thrust changes from operational context)
- Add wind correction to jet blast zone computation
- Deploy near-field laser profiler for high-resolution FOD detection directly ahead of AV
- Build closed-loop alerting with AOCC for FOD reporting and removal tracking

### 8.4 Key Metrics to Track

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| FOD detection rate (Pd) | > 90% for objects > 5 cm | Controlled FOD placement tests |
| FOD false positive rate | < 2 per hour of operation | Operational logging |
| Jet blast zone accuracy | Zone encompasses actual 35-kt contour in > 95% of cases | CFD validation + field measurement |
| Planning latency | < 200 ms from hazard detection to replan | System timing instrumentation |
| Safety margin violation | 0 entries into > 50-kt jet blast zones | GPS logging vs. zone boundaries |

---

## References and Sources

### FOD Detection Systems
- [Moog Tarsier FOD Detection System](https://www.moog.com/markets/DigitalAirfieldSolutions/tarsier-fod.html)
- [Xsight Systems FODetect](https://xsightsys.com/fodetect/)
- [Stratech iFerret FOD Detection](http://www.thestratechgroup.com/iv_iferret.asp)
- [Pavemetrics LFOD System](https://www.pavemetrics.com/applications/airfield-inspection/laser-fod-detection-system/)
- [Navtech Radar FOD Detection](https://navtechradar.com/problems-we-solve/security-solutions/fod-detection/)

### FOD Detection Research
- [A Review of FOD Detection on Airport Runways: Sensors and Algorithms (Remote Sensing, 2025)](https://www.mdpi.com/2072-4292/17/2/225)
- [FOD Automatic Target Detection for MMW Radar (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8199731/)
- [FOD-A Dataset (arXiv)](https://arxiv.org/abs/2110.03072)
- [FOD-A Dataset GitHub](https://github.com/FOD-UNOmaha/FOD-data)
- [FOD Detection Using Deep Learning (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11784716/)
- [Small-Scale FOD Detection Using Deep Learning and Dual Light Modes (MDPI)](https://www.mdpi.com/2076-3417/14/5/2162)
- [Detection and Classification of FOD with Comparative Deep Learning (Springer)](https://link.springer.com/article/10.1007/s11760-025-03901-6)

### LiDAR Small Object Detection
- [LiDAR Point Clouds for FOD Detection on Airport Aprons (ACM)](https://dl.acm.org/doi/abs/10.1145/2899361.2899370)
- [Small Object Detection in LiDAR Point Clouds for AVs (MDPI Sensors)](https://www.mdpi.com/1424-8220/24/16/5423)
- [Smart Airport FOD Detection Rover Using LiDAR (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S2542660518300246)

### Foundation Models for Anomaly Detection
- [Grounding DINO (ECCV 2024)](https://arxiv.org/abs/2303.05499)
- [Grounded SAM 2 (GitHub)](https://github.com/IDEA-Research/Grounded-SAM-2)
- [AnomalyVFM -- Zero-Shot Anomaly Detection (arXiv)](https://arxiv.org/abs/2601.20524)
- [CLIP-SAM Anomaly Detection (ACM)](https://dl.acm.org/doi/10.1007/978-981-97-8490-5_4)

### Jet Blast
- [An Operational Model for the Prediction of Jet Blast (DOT)](https://rosap.ntl.bts.gov/view/dot/9528/dot_9528_DS1.pdf)
- [Jet Efflux Hazard -- SKYbrary](https://skybrary.aero/articles/jet-efflux-hazard)
- [Boeing Engine Hazard Areas](https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/faqs/enginehazardareas.pdf)
- [IATA Engine Danger Areas Newsletter](https://www.iata.org/contentassets/f135f60f52e9495d9a6bb09aab8e39e7/engine-danger-areas.pdf)
- [airsight Jet Blast Assessment at Aerodromes](https://www.airsight.de/projects/item/a-safety-based-approach-to-assess-jet-blast-at-aerodromes/)
- [NASA ASRS Ground Jet Blast Hazard](https://asrs.arc.nasa.gov/publications/directline/dl6_blast.htm)
- [Jet Blast Distance Analysis (Springer)](https://link.springer.com/article/10.1007/s44196-024-00529-1)
- [Airbus A380 Aircraft Characteristics](https://www.airbus.com/sites/g/files/jlcbta136/files/2021-11/Airbus-Aircraft-AC-A380.pdf)
- [CFD Analysis of A380 Jet Blast (Springer)](https://link.springer.com/chapter/10.1007/978-3-540-33287-9_19)

### ADS-B and Airport Operations
- [ADS-B Wikipedia](https://en.wikipedia.org/wiki/Automatic_Dependent_Surveillance%E2%80%93Broadcast)
- [FAA ADS-B Information](https://www.faa.gov/about/office_org/headquarters_offices/avs/offices/afx/afs/afs400/afs410/ads-b)
- [FAA Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FAA AC 150/5300-13 Airport Design](https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentnumber/150_5300-13)

### Occupancy Grid and Planning
- [Risk-Aware Path Planning with Occupancy Grids (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8622820/)
- [Multi-Layer Occupancy Grid Mapping (IEEE)](https://ieeexplore.ieee.org/document/8804556/)
- [Dynamic Occupancy Grid for Urban Driving (MathWorks)](https://www.mathworks.com/help/fusion/ug/motion-planning-in-urban-driving-environments-using-dynamic-occupancy-grid-map.html)
