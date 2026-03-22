# Zoox Non-ML and Hybrid-ML Perception Techniques — Exhaustive Deep Dive

> Compiled March 2026 from Zoox Journal articles, Amazon Science publications, AWS re:Invent 2025 talks,
> NHTSA filings, Zoox patent filings (US11500385B2, US20200211394, US20210278853A1), Zoox Safety Reports,
> job postings, Teledyne FLIR and Hesai product documentation, academic literature, and trade press.

---

## Table of Contents

### Geometric Collision Avoidance (GCA)
1. [GCA Architecture](#1-gca-architecture)
2. [GCA Sensor Processing](#2-gca-sensor-processing)
3. [GCA Safety Guarantees](#3-gca-safety-guarantees)
4. [GCA Trigger Conditions](#4-gca-trigger-conditions)

### Sensor Signal Processing
5. [LiDAR Processing — Hesai AT128](#5-lidar-processing--hesai-at128)
6. [LWIR Thermal Processing — Teledyne FLIR Boson](#6-lwir-thermal-processing--teledyne-flir-boson)
7. [Radar Processing](#7-radar-processing)
8. [Camera ISP](#8-camera-isp)
9. [Acoustic Processing](#9-acoustic-processing)

### Calibration
10. [CLAMS — Infrastructure-Free Calibration](#10-clams--infrastructure-free-calibration)
11. [Factory Calibration](#11-factory-calibration)
12. [Thermal-to-RGB Calibration](#12-thermal-to-rgb-calibration)
13. [Online Calibration](#13-online-calibration)
14. [Time Synchronization](#14-time-synchronization)

### Sensor Staleness Framework
15. [Sensor Staleness Framework](#15-sensor-staleness-framework)

### State Estimation and Tracking
16. [Kalman Filtering and Data Association](#16-kalman-filtering-and-data-association)
17. [Multi-Modal Data Association](#17-multi-modal-data-association)
18. [State Vectors and Process Models](#18-state-vectors-and-process-models)

### Geometric Methods
19. [Ground Plane Segmentation, Voxelization, Spatial Indexing](#19-ground-plane-segmentation-voxelization-spatial-indexing)
20. [Free Space Estimation](#20-free-space-estimation)
21. [LiDAR-to-Map Scan Matching and Localization](#21-lidar-to-map-scan-matching-and-localization)

### Hybrid ML+Classical
22. [ML Detections to Classical Tracking Pipeline](#22-ml-detections-to-classical-tracking-pipeline)
23. [Classical Preprocessing to ML](#23-classical-preprocessing-to-ml)
24. [Safety Net — Classical Checks on ML Outputs](#24-safety-net--classical-checks-on-ml-outputs)
25. [QTP Prediction Classical Components](#25-qtp-prediction-classical-components)

---

## 1. GCA Architecture

### 1.1 System Position in the Triple-Redundant Stack

Zoox operates three independent, simultaneous perception systems to prevent common-cause failures. The Geometric Collision Avoidance (GCA) system is the second of these three, positioned as a fully non-ML safety-critical backup:

| System | Type | Primary Purpose |
|---|---|---|
| **Main AI System** | ML-based ensemble | Full scene understanding: detection, classification, tracking, segmentation |
| **Geometric Collision Avoidance (GCA)** | Non-ML, rule-based geometric | Detect physical obstructions in the planned trajectory corridor |
| **Safety Net** | ML-based (independent architecture) | Short-horizon detection + prediction, 360-degree collision probability |

RJ He (Director of Perception): *"[GCA uses] geometric, interpretable algorithms that operate on sensor data [to detect] objects in the vehicle's intended driving path."*

The GCA system is architecturally isolated from the Main AI System. It runs on a separate software stack, uses different algorithms, and processes different representations of sensor data. A bug, distribution shift, or adversarial input that defeats the Main AI System cannot, by design, affect GCA.

### 1.2 Trajectory Corridor Definition

The GCA system's core geometric primitive is the **trajectory corridor** — a bounded 2D or 3D volume surrounding the vehicle's planned path. The corridor defines the region of space the vehicle will physically occupy if it follows the planned trajectory.

**Corridor parameters** (from Zoox patent US11500385B2):

| Parameter | How It Is Determined |
|---|---|
| **Width** | Vehicle width + offset distance accounting for steering actuator tolerances, tire slippage, body roll, and lateral safety margin |
| **Length** | Function of current vehicle velocity and trajectory-specified velocity — faster speeds produce longer corridors because the stopping distance is greater |
| **Shape** | Follows the curvature of the planned trajectory — the corridor bends with turns, not a simple rectangle |
| **Dimensionality** | Can be 2D (top-down) or 3D (including height dimension for overpasses, low obstacles) |

The corridor is expanded conservatively — typically 110-115% of vehicle width or with a fixed-distance lateral margin — to account for real-world uncertainty in path execution.

The length of the corridor is directly tied to the **maximum stopping distance** of the vehicle at the current velocity. This stopping distance is calculated from:

- Current velocity (or trajectory-specified velocity)
- Environmental gradient (uphill vs. downhill)
- Static coefficient of friction associated with roadway surface condition (dry, wet, icy)
- An additional configurable safety margin

This means the corridor grows longer at higher speeds and shrinks at lower speeds, dynamically adapting to the vehicle's ability to stop.

### 1.3 Raw Sensor Return Projection

Rather than processing the entire sensor field of view, GCA extracts only the **subset of sensor data that falls within the trajectory corridor**. This is a critical computational optimization — by limiting processing to the corridor, GCA achieves very low latency.

**Projection process** (from patent US11500385B2):

1. **3D-to-2D mapping**: Three-dimensional LiDAR points and radar returns are projected into a two-dimensional space defined by:
   - **Abscissa (x-axis)**: Longitudinal position along the trajectory
   - **Ordinate (y-axis)**: Elevation (height above ground)

   This produces an **elevation profile** of the corridor — a side-view slice showing the height of every sensor return along the vehicle's path.

2. **Channel-based organization**: LiDAR returns are grouped by their originating sensor channel (the Hesai AT128 has 128 channels at different vertical angles). The number of channels providing valid returns within the corridor determines the resolution of the ground-fitting algorithm.

3. **Corridor boundary test**: Only sensor returns whose (x, y, z) coordinates fall within the corridor boundaries are retained for further processing. Returns outside the corridor are discarded.

### 1.4 Volumetric Occupancy Checking

Within the corridor, the GCA system performs binary classification: **ground** vs. **object**. This is accomplished through deterministic curve-fitting, not neural network classification.

**Ground classification algorithm** (from patent US11500385B2):

1. **Curve fitting**: A spline (B-spline, NURBS, or Bezier curve) is fit to the sensor data in the elevation profile. The number of control points and knots is determined by the number of LiDAR channels providing valid returns:
   - `control_points <= number_of_channels`
   - `knots = control_points + curve_degree + 1`
   - More channels enable finer spline resolution for complex terrain (hills, ramps, speed bumps)

2. **Weighted least squares optimization**: The spline is fit using a weighted least squares regression with an **asymmetric loss function**:
   - Points **below** the estimated curve receive **higher weight** (3-10x) because they are more likely to represent the actual ground surface
   - Points **above** the curve receive lower weight because they may be objects
   - This bias prevents false negatives (failing to detect ground), which is the safer error mode

3. **Pre-fitting operations**:
   - Outlier elimination via clustering/RANSAC
   - Data binning: partitions returns into 4+ bins based on channel count for equal-spacing or equal-point-count grouping
   - Elevation-based weighting: lower elevation points weighted more heavily

4. **Classification**:
   - **Ground**: Sensor data points within a threshold distance of the fitted curve, exhibiting smooth continuity and uniform spacing
   - **Object**: Sensor data points located above the fitted curve, with discontinuous spacing or angular displacement outside acceptable ranges

5. **Post-fitting refinement**:
   - Maximum elevation limiting: `max_elevation = average_elevation + buffer`
   - Knot spacing validation and adjustment
   - Translating the fitted curve laterally across the corridor width to classify the full corridor volume

### 1.5 Formal Verification Properties

While Zoox has not published formal verification proofs, the GCA system is designed with properties that make formal verification tractable:

| Property | Why It Enables Verification |
|---|---|
| **No learned parameters** | Behavior is fully deterministic given inputs — no weight matrices, no activation functions, no stochastic inference |
| **Bounded computation** | The corridor subset limits data volume; spline fitting has known computational complexity |
| **Interpretable decision boundary** | The ground/object classification is a geometric threshold (distance from fitted curve), not a high-dimensional decision surface |
| **Physics-based stopping distance** | The threshold distance is derived from Newtonian mechanics (v^2 / 2*mu*g + margin), not learned |
| **Binary output** | The system produces a binary decision: trajectory is safe (pass through) or unsafe (trigger CAS) |

The patent explicitly states: *"the accuracy of the collision avoidance system may also be higher than an accuracy of the primary perception system, thereby reducing an overall error rate of trajectories implemented by the autonomous vehicle by filtering out invalid trajectories."*

The secondary system is described as *"higher integrity and more verifiable than the primary system"* with techniques that are *"more easily verifiable."*

---

## 2. GCA Sensor Processing

### 2.1 Raw LiDAR Returns WITHOUT Classification

The GCA system processes raw LiDAR point returns — it does not consume the output of any neural network. Each LiDAR point is characterized by:

| Attribute | Source | Use in GCA |
|---|---|---|
| **(x, y, z) position** | LiDAR range + angle measurement | Corridor membership test, elevation profile construction |
| **Channel index** | Which of the 128 AT128 channels produced the return | Determines spline resolution (control points) |
| **Intensity** | Reflected laser power | May be used for outlier rejection (very low intensity = noise) |
| **Timestamp** | Per-point acquisition time | Ego-motion compensation |

Critically, GCA does not need to know **what** an object is. A pedestrian, a trash can, a traffic cone, and a parked car are all treated identically — as "sensor returns above the ground plane within the corridor." This is the fundamental insight: for the narrow question "will we hit something?", classification is unnecessary.

### 2.2 Raw Radar Returns WITHOUT Classification

Radar returns provide complementary data, particularly valuable in adverse weather:

| Attribute | Source | Use in GCA |
|---|---|---|
| **Range** | Time-of-flight | Distance to reflector within corridor |
| **Radial velocity (Doppler)** | Frequency shift | Closing speed — enables time-to-collision estimation |
| **RCS (Radar Cross Section)** | Reflected power | Rough indicator of object size; helps filter clutter |
| **SNR** | Signal-to-noise ratio | Confidence in detection |

Radar's key advantage for GCA is **direct velocity measurement** via Doppler — LiDAR must infer velocity from multi-frame tracking, but radar measures it instantaneously. This enables faster time-to-collision estimation.

### 2.3 No Object Classification Step

The GCA pipeline explicitly omits the classification step that is central to ML-based perception:

```
ML Pipeline:     Sensor Data → Feature Extraction → Classification → Tracking → Prediction → Planning
GCA Pipeline:    Sensor Data → Corridor Extraction → Ground Fitting → Obstruction? → CAS Trigger
```

This omission is deliberate. Classification errors — misidentifying a pedestrian as a trash bag, failing to recognize a novel object type, being confused by adversarial inputs — are among the most dangerous failure modes of ML perception. GCA sidesteps all of them by never attempting classification.

### 2.4 Purely Geometric Decision Making

Every decision in the GCA pipeline is a geometric operation:

1. **Is this point inside the corridor?** — Point-in-volume test
2. **Does this point represent ground?** — Distance from fitted curve < threshold
3. **Is the nearest non-ground point closer than the stopping distance?** — Scalar comparison
4. **Is the furthest ground point closer than the stopping distance?** — Scalar comparison (detects drop-offs, cliffs, missing road)

No probability distributions, no softmax outputs, no confidence thresholds — just geometry and physics.

---

## 3. GCA Safety Guarantees

### 3.1 Formal Methods Context

Zoox references multiple safety standards in its system design:

| Standard | Domain | Relevance to GCA |
|---|---|---|
| **ISO 26262** | Automotive functional safety | ASIL decomposition; GCA designed to higher integrity level than primary perception |
| **ISO 21448 (SOTIF)** | Safety of the Intended Functionality | Addresses perception failures and triggering conditions |
| **ARP4754A / ARP4761** | Aviation safety assessment | Zoox explicitly draws from aviation safety; GCA parallels flight envelope protection |
| **DO-178** | Airborne software | Referenced in Zoox job postings for safety-critical software |
| **ISO 12207** | Software lifecycle | Referenced for software process integrity |

### 3.2 Mathematical Guarantees

The GCA system provides guarantees that are conditional on sensor physics:

**Guarantee 1 — Stopping distance sufficiency**: If the nearest detected obstruction is at distance d from the vehicle, and the maximum stopping distance at velocity v on surface with friction coefficient mu and grade theta is:

```
d_stop = v^2 / (2 * mu * g * cos(theta) + 2 * g * sin(theta)) + margin
```

Then GCA triggers CAS if `d < d_stop`. This is a physics-based guarantee: given correct inputs (velocity, friction, grade), the vehicle will stop before reaching the obstruction.

**Guarantee 2 — Ground continuity**: If the furthest point classified as ground is at distance d_ground, and `d_ground < d_stop`, GCA triggers CAS. This catches scenarios where the road surface disappears (cliff edge, bridge out, road ends) even when no above-ground object is detected.

**Guarantee 3 — No learned-parameter dependency**: Because GCA uses no neural network weights, it is immune to:
- Training data distribution shift
- Adversarial perturbations
- Catastrophic forgetting
- Mode collapse
- Out-of-distribution inputs

### 3.3 Limitations and Failure Modes

GCA is not omniscient. Known limitations include:

| Limitation | Description |
|---|---|
| **Sensor physics** | If LiDAR and radar both fail to return echoes from an object (e.g., perfectly absorptive surface), GCA cannot detect it |
| **Flat obstacles** | Very thin objects lying on the road may not produce returns distinguishable from the ground plane |
| **Overhead clearance** | Low-hanging obstacles (branches, signs) may be missed if the corridor does not extend high enough |
| **Sensor noise** | Heavy rain, snow, or spray can produce false returns within the corridor, potentially causing unnecessary CAS triggers |
| **No context** | GCA cannot distinguish between a wall (permanent) and a crossing pedestrian (will move); it may trigger CAS when the main AI would simply wait |

These limitations are why GCA operates alongside the Main AI System and Safety Net — the three systems cover each other's blind spots.

---

## 4. GCA Trigger Conditions

### 4.1 When GCA Overrides the Main AI

The GCA system feeds into the **Collision Avoidance System (CAS)**, which can override the Planner's trajectory. The override hierarchy is:

```
Normal operation:    Main AI Perception → Prediction → Planner → Vehicle Control
GCA override:        GCA detects obstruction → CAS assumes control → Emergency brake/steer
Safety Net override: Safety Net detects collision probability > threshold → CAS → Emergency stop
```

**Trigger conditions** (from patent US11500385B2):

| Condition | Action |
|---|---|
| **Object detected within stopping distance** | CAS triggered: emergency braking, contingent trajectory, or safe-stop maneuver |
| **Ground surface terminates within stopping distance** | CAS triggered: same emergency response |
| **Object velocity (from Doppler) indicates closing collision** | Time-to-collision below threshold triggers CAS |
| **Both conditions clear** | Trajectory validated and passed through to vehicle controllers |

The CAS can execute multiple contingency actions:
- **Hard brake** — maximum deceleration
- **Safe-stop maneuver** — controlled deceleration to stop in a safe location
- **Contingent trajectory** — alternative path that avoids the obstruction
- **Trajectory re-planning request** — asks the Planner to generate a new trajectory

### 4.2 Latency Requirements

The GCA/CAS system is designed for **millisecond-level response times** — faster than the Main AI System's perception-prediction-planning pipeline, which updates multiple times per second. The patent describes operation using a *"receding horizon technique"* with horizons as short as microseconds.

| System | Typical Latency | Update Rate |
|---|---|---|
| **Main AI Perception** | ~100 ms end-to-end | 10 Hz |
| **Prediction (QTP)** | Recalculated every 100 ms | 10 Hz |
| **Planner** | Multiple times per second | 5-20 Hz |
| **GCA/CAS** | Millisecond-level | Continuous / per-frame |

The latency advantage comes from GCA's computational simplicity: corridor extraction, spline fitting, and threshold comparison are orders of magnitude cheaper than running multi-billion-parameter neural networks.

### 4.3 Relationship to Aviation Safety Systems

Zoox explicitly draws the analogy to **flight envelope protection** in commercial aviation. In a fly-by-wire aircraft, automated systems can override pilot inputs to prevent stalls, overspeed, and excessive bank angles. Similarly, CAS can override the Planner when GCA or Safety Net detect imminent danger.

This is a rare design choice in the autonomous vehicle industry. Most AV companies use a single ML-based perception system with no independent geometric safety layer.

---

## 5. LiDAR Processing — Hesai AT128

### 5.1 Hardware Specifications

| Specification | Value |
|---|---|
| **Type** | Hybrid solid-state (1D MEMS scanning + electronic) |
| **Channels** | 128 genuine channels (128 VCSEL arrays with electronic scanning) |
| **Range** | 200 m @ 10% reflectivity; 210 m maximum |
| **Points per second** | 1,536,000 (single return mode) |
| **FOV** | 120 deg horizontal x 25.4 deg vertical |
| **Angular resolution** | 0.1 deg horizontal x 0.2 deg vertical |
| **Pixel resolution** | 1200 x 128 |
| **Frame rate** | 10 Hz (typical for automotive) |
| **Wavelength** | 905 nm |
| **Eye safety** | Class 1 (IEC 60825-1) |
| **Functional safety** | ISO 26262 ASIL B certified |
| **Cybersecurity** | ISO/SAE 21434 compliant development |
| **Power** | 13.5 W |
| **Weight** | 940 g |
| **Dimensions** | 136 x 114 x 49 mm |

### 5.2 Multi-Return Processing

The AT128 supports both single-return and multi-return (dual-return) modes. Multi-return is critical for adverse weather and semi-transparent objects:

**Single return** (1.53M pts/sec): Returns the strongest echo per laser pulse. Optimal for clear weather; maximizes point density at a given scan rate.

**Dual return** (up to 3.07M pts/sec): Returns both the first and strongest (or first and last) echo per pulse. This enables:

| Scenario | First Return | Second Return | Interpretation |
|---|---|---|---|
| **Rain/spray** | Raindrop/water particle | Object behind rain | Separates weather noise from real objects |
| **Foliage** | Leaf surface | Ground/object behind tree | Sees through partial occlusion |
| **Dust/smoke** | Particle in air | Solid surface behind | Penetrates suspended particles |
| **Glass/mesh** | Partial reflection from surface | Object behind | Detects semi-transparent barriers |

Multi-return processing is a classical signal processing technique — no ML involved. The system simply retains both echoes and reasons about the pair.

### 5.3 Motion Compensation (Ego-Motion Correction)

Because the AT128 scans its 120-degree FOV over time (~100 ms per revolution at 10 Hz), points acquired at the beginning and end of a scan represent different moments. If the vehicle is moving, this temporal spread causes **motion distortion** — the point cloud is smeared.

**Correction process** (purely classical):

1. **Per-point timestamping**: Each LiDAR point carries a precise timestamp based on its acquisition time within the scan cycle. For the AT128, this is derived from the azimuth angle:
   ```
   t_point = t_scan_start + (azimuth / 360) * T_rotation
   ```

2. **IMU/odometry integration**: The vehicle's inertial measurement unit (IMU), wheel odometry, and steering angle sensors provide a continuous ego-motion estimate (position, orientation, velocity) at high rate (typically 200+ Hz).

3. **Point transformation**: Each point is transformed from the sensor frame at its acquisition time to a common reference frame (typically the sensor frame at the scan midpoint or end):
   ```
   P_corrected = T(t_ref, t_point) * P_raw
   ```
   where `T(t_ref, t_point)` is the rigid-body transformation (rotation + translation) representing the vehicle's motion between `t_point` and `t_ref`.

This is a standard rigid-body kinematics operation — no learning involved.

### 5.4 Intensity Calibration

LiDAR intensity (the strength of the returned laser pulse) depends on:

- **Object reflectivity** (material, color, surface finish)
- **Range** (intensity falls off with distance squared)
- **Angle of incidence** (oblique angles reduce return)
- **Atmospheric attenuation** (moisture, dust)

**Range normalization**: Raw intensity values are corrected for the inverse-square-law distance falloff:
```
I_corrected = I_raw * (range / range_ref)^2
```
where `range_ref` is a reference distance (typically 1 m or the calibration distance). This makes intensity values comparable across different ranges.

**Angle-of-incidence correction** is more complex and often estimated from the local surface normal (computed from neighboring points). Some systems apply lookup tables derived from factory calibration.

### 5.5 Rain and Spray Filtering

Rain, spray from other vehicles, and airborne particles produce LiDAR returns that are not real objects. Classical filtering techniques include:

**Statistical Outlier Removal (SOR)**: For each point, compute the mean distance to its k nearest neighbors. Points whose mean neighbor distance exceeds a threshold (mean + n * standard_deviation) are classified as outliers and removed.

**Dynamic Statistical Outlier Removal (DSOR)**: An extension of SOR that adapts the threshold based on range — farther points are naturally sparser, so the threshold is relaxed at long range.

**Low-Intensity Outlier Removal (LIOR)**: Rain and spray particles produce weak returns with low intensity. Points below an intensity threshold (range-normalized) are flagged as potential weather noise.

**Spatial clustering**: Rain returns are typically sparse and scattered, while real objects produce dense clusters. DBSCAN or radius-based clustering identifies and removes small, isolated point clusters.

**Multi-return discrimination**: In dual-return mode, if the first return has very short range (a few meters) and low intensity while the second return is at longer range with normal intensity, the first return is likely a raindrop or spray particle and can be discarded.

**Temporal consistency**: Real objects produce returns in consistent locations across multiple scans. Returns that appear in a single scan but not in adjacent scans (within motion-compensated comparison) are likely noise.

All of these are classical signal processing / computational geometry techniques with no ML dependency.

---

## 6. LWIR Thermal Processing — Teledyne FLIR Boson

### 6.1 Sensor Architecture

The Teledyne FLIR Boson is an uncooled microbolometer thermal imaging core:

| Component | Detail |
|---|---|
| **Detector type** | Uncooled microbolometer focal plane array (FPA) |
| **Detector material** | Vanadium oxide (VOx) on silicon substrate |
| **Resolution** | 640 x 512 pixels (VGA configuration) |
| **Pixel pitch** | 12 micrometers |
| **Spectral band** | 7.5 - 13.5 micrometers (LWIR) |
| **Frame rate** | 30 Hz or 60 Hz |
| **NETD** | < 40 mK (Boson 640); < 20 mK (Boson+) |
| **On-module processor** | Intel Movidius Myriad 2 VPU (12 SHAVE vector processors, ~1 TOPS, ~1 W) |
| **Form factor** | Compact OEM module |

### 6.2 Microbolometer Signal Chain

The signal chain from photon absorption to digital output is entirely classical analog/digital electronics and signal processing:

```
Incident LWIR    Pixel         ROIC          ADC         Digital
Photons    -->   Absorption --> Readout  --> Conversion --> Signal Processing
(7.5-13.5um)     (VOx heats)   (bias +      (14-16 bit)   (NUC, filtering,
                               amplify)                     AGC, BPR)
```

**Stage 1 — Photon absorption**: Incoming LWIR radiation (7.5-13.5 um) is absorbed by the VOx microbolometer pixel, causing its temperature to rise. The temperature change alters the pixel's electrical resistance (VOx has a high temperature coefficient of resistance, TCR ~ -2% to -3% per degree C).

**Stage 2 — Readout Integrated Circuit (ROIC)**: The ROIC biases each microbolometer pixel with a reference current/voltage and measures the resulting signal. The ROIC provides:
- Per-pixel bias current
- Self-heating compensation (the bias current itself heats the pixel)
- Mismatch compensation for manufacturing variations between pixels
- Column and row multiplexing for sequential readout
- Analog signal amplification

**Stage 3 — Analog-to-Digital Conversion (ADC)**: The analog signal from each pixel is digitized at 14-16 bit resolution, producing a raw digital frame.

**Stage 4 — Digital signal processing**: The digitized frame undergoes multiple correction and enhancement stages on the integrated Myriad 2 VPU.

### 6.3 Non-Uniformity Correction (NUC)

Microbolometer FPAs exhibit significant pixel-to-pixel non-uniformity due to manufacturing variations in VOx film thickness, pixel geometry, and thermal coupling. Without correction, the raw image would show fixed-pattern noise (FPN) — a static pattern of bright and dark pixels unrelated to the scene.

**Two-point NUC (factory calibration)**:

Each pixel's response is characterized by a gain (slope) and offset (intercept) measured by exposing the detector to two uniform temperature sources (blackbodies) at known temperatures T1 and T2:

```
Signal_corrected(i,j) = Gain(i,j) * Signal_raw(i,j) + Offset(i,j)
```

where:
- `Gain(i,j) = (T2 - T1) / (S2(i,j) - S1(i,j))`
- `Offset(i,j) = T1 - Gain(i,j) * S1(i,j)`
- `S1(i,j)` and `S2(i,j)` are the raw signals at temperatures T1 and T2

The gain and offset tables are stored in the module's non-volatile memory and applied in real-time to every frame.

**Shutter-based Flat Field Correction (FFC)**:

Even after factory NUC, the correction drifts as the camera's own internal temperature changes (the optics and housing emit LWIR radiation that contaminates the detector). The Boson's internal mechanical shutter periodically drops between the optics and detector:

1. Shutter closes, presenting a uniform thermal reference
2. Detector captures the shutter image (which should be perfectly uniform)
3. Any residual non-uniformity is measured and subtracted from subsequent frames
4. Shutter reopens (total interruption: ~250 ms)

FFC is triggered automatically based on:
- Elapsed time since last FFC (configurable, typically 1-5 minutes)
- Change in internal temperature exceeding a threshold
- Manual trigger via software command

**Silent Shutterless NUC (SSN)**:

FLIR's proprietary SSN technology performs NUC correction without the mechanical shutter, using scene-based algorithms:

1. The algorithm assumes the scene contains natural spatial variation (edges, gradients)
2. Over multiple frames with camera or scene motion, fixed-pattern noise can be separated from scene content because FPN is static while scene content moves
3. Temporal averaging and motion estimation are used to isolate FPN
4. The isolated FPN is subtracted from the live image

SSN requires scene motion to function — it relies on relative movement between the camera and scene to distinguish FPN from real thermal patterns. For an autonomous vehicle in motion, this requirement is naturally satisfied.

SSN reduces temporal noise and residual non-uniformity, but FLIR notes it *"should not be relied upon as a method to replace the Shutter/FFC, as regular FFCs are required for Boson to meet its sensitivity specifications."*

### 6.4 NETD (Noise Equivalent Temperature Difference)

NETD quantifies the minimum temperature difference the sensor can detect:

| Metric | Value | Significance |
|---|---|---|
| **Boson 640 NETD** | < 40 mK | Can distinguish temperature differences of 0.04 degrees C |
| **Boson+ NETD** | < 20 mK | Can distinguish 0.02 degrees C differences |
| **Human body vs. ambient** | Typically 10-20 degrees C contrast | SNR of ~250-500x NETD for pedestrian detection |

At < 40 mK NETD, a human body (~37 degrees C) against a 20 degrees C background produces a signal-to-noise ratio exceeding 400:1 — well above any reasonable detection threshold. This is why LWIR is so effective for pedestrian detection.

### 6.5 Bad Pixel Replacement

Manufacturing defects and aging cause some pixels to become non-responsive (dead), stuck at a fixed value, or excessively noisy. The Boson's signal processing pipeline includes:

**Bad pixel mapping**: A factory-generated map identifies defective pixels. This map is stored in non-volatile memory and can be updated in the field.

**Replacement algorithms**:
- **Nearest-neighbor interpolation**: The bad pixel's value is replaced with the average of its valid neighboring pixels (typically 8-connected neighborhood)
- **Bilinear interpolation**: For clusters of bad pixels, weighted interpolation from surrounding valid pixels
- **Temporal substitution**: For intermittently bad pixels, the previous frame's value may be used

These are standard image processing operations implemented on the Myriad 2 VPU.

### 6.6 Additional Processing on the Myriad 2 VPU

The Intel Movidius Myriad 2 VPU (12 SHAVE vector processors, ~1 TOPS at ~1 W) performs additional preprocessing before data reaches the main vehicle compute platform:

| Function | Description |
|---|---|
| **Spatial filtering** | Noise reduction via median or Gaussian filtering |
| **Temporal filtering** | Averaging across frames to reduce random noise |
| **Automatic Gain Control (AGC)** | Maps the 14-bit raw dynamic range to 8-bit output with adaptive histogram stretching |
| **Electronic zoom** | Digital zoom for region-of-interest processing |
| **Frame averaging** | Optional multi-frame averaging for improved SNR |

All of this processing happens at the sensor level, reducing bandwidth requirements between the sensor pod and the central compute platform.

---

## 7. Radar Processing

### 7.1 Radar Configuration

Zoox mounts radar units at each of the four vehicle corners, providing 360-degree coverage. The specific radar model is not publicly disclosed, but based on industry trends and Zoox's requirements, the system likely uses **77 GHz FMCW (Frequency-Modulated Continuous Wave)** automotive radar, potentially 4D imaging radar.

### 7.2 FMCW Signal Processing Pipeline

The radar signal processing pipeline from transmitted chirp to detected target is entirely classical:

```
TX Chirp → Reflect → RX Echo → Mix → IF Signal → ADC → Range FFT → Doppler FFT → CFAR → Detection List
```

**Step 1 — Chirp generation and transmission**: The radar transmits a linearly frequency-modulated "chirp" — a signal whose frequency increases linearly over time. A frame consists of multiple chirps (typically 128-256).

**Step 2 — Echo reception and mixing**: The reflected signal is received and mixed with the transmitted signal, producing an intermediate frequency (IF) signal whose frequency is proportional to the round-trip delay (range).

**Step 3 — Range FFT**: A Fast Fourier Transform is applied along the fast-time (within-chirp) dimension, converting the IF signal to a range spectrum. Each peak corresponds to a reflecting surface at a specific range.

**Step 4 — Doppler FFT**: A second FFT is applied along the slow-time (across-chirps) dimension, computing the phase change across chirps. This phase change is directly proportional to the radial velocity of the reflector via the Doppler effect:
```
v_radial = (delta_phase * c) / (4 * pi * f_c * T_chirp)
```
where `f_c` is the carrier frequency (77 GHz) and `T_chirp` is the chirp repetition interval.

**Step 5 — Range-Doppler map**: The result is a 2D map with range on one axis and velocity on the other. Each cell's magnitude indicates the strength of returns from that range-velocity combination.

**Step 6 — Angle estimation** (for 4D radar): With multiple TX and RX antennas forming a virtual array, a third FFT or beamforming operation along the antenna dimension estimates the azimuth and elevation angles of each detection.

### 7.3 CFAR Detection

**Constant False Alarm Rate (CFAR)** is the standard radar detection algorithm — it is an adaptive thresholding technique that maintains a constant probability of false alarm regardless of background noise level:

1. For each cell under test (CUT) in the Range-Doppler map, examine a window of surrounding cells (guard cells excluded)
2. Estimate the noise floor from the surrounding cells (using mean for CA-CFAR, or ordered statistics for OS-CFAR)
3. Set the detection threshold as: `threshold = alpha * noise_estimate`
4. If the CUT exceeds the threshold, declare a detection

**CA-CFAR (Cell-Averaging)**: Uses the arithmetic mean of reference cells. Fast but vulnerable to closely-spaced targets.

**OS-CFAR (Ordered-Statistics)**: Sorts reference cells by amplitude and selects the k-th largest. More robust to interfering targets and clutter edges.

**CFAR is entirely classical** — it is a statistical detection algorithm with no learned parameters.

### 7.4 Velocity Estimation

Radar provides **direct radial velocity measurement** via Doppler — this is one of radar's unique advantages over LiDAR and cameras:

- **Instantaneous velocity**: No need for multi-frame tracking; velocity is measured per detection per frame
- **Unambiguous velocity range**: Determined by chirp repetition rate; typically +/- 30-50 m/s for automotive radar
- **Velocity resolution**: Determined by frame duration (number of chirps * chirp period); typically 0.1-0.5 m/s

For GCA, the radial velocity enables direct computation of **time-to-collision**:
```
TTC = range / |v_radial|
```
when the vehicle and obstacle are on a collision course (radial velocity is negative, indicating closing).

### 7.5 Multi-Path and Ghost Rejection

Multipath reflections are a fundamental challenge for automotive radar. When the transmitted signal bounces off a flat surface (road, guardrail, wall) before or after hitting the target, it creates a **ghost detection** at an incorrect range and angle.

**Common multipath scenarios**:

| Scenario | Ghost Location | Characteristics |
|---|---|---|
| **Road bounce** | Appears below road surface (underground) | Same Doppler as real target; range ~2x actual |
| **Guardrail bounce** | Appears behind guardrail | Range is sum of TX-guardrail + guardrail-target paths |
| **Wall bounce** | Mirrored position behind wall | Same Doppler; appears in geometrically impossible location |

**Classical ghost rejection techniques**:

1. **Map-based filtering**: Detections appearing in geometrically impossible locations (underground, inside buildings, behind walls based on HD map data) are suppressed
2. **RCS consistency**: Ghost reflections typically have lower RCS than direct returns due to path loss; detections with anomalously low RCS at their range can be flagged
3. **Multi-frame consistency**: Real objects produce consistent detections across frames; ghosts may appear/disappear as the multipath geometry changes
4. **Cross-modal verification**: In the early fusion architecture, radar ghosts lacking corresponding LiDAR or camera evidence are suppressed
5. **Elevation filtering**: For 4D imaging radar, returns from below the ground plane elevation are rejected
6. **Doppler-range consistency**: For road-bounce ghosts, the apparent range is ~2x actual but Doppler is identical to the real target — this inconsistency can be detected

### 7.6 Clutter Filtering

Automotive radar sees returns from many non-target surfaces: road surface, guardrails, overpasses, signs, and other infrastructure. Classical clutter mitigation includes:

- **Doppler-based moving target indication (MTI)**: Suppress zero-Doppler (stationary) returns to highlight moving targets
- **Clutter maps**: Learned (in a non-ML sense — simply accumulated) maps of stationary returns in frequently-traversed areas
- **RCS thresholding**: Very weak returns below a minimum RCS are discarded
- **Spatial filtering**: Returns matching known infrastructure geometry (guardrail lines, overpass structures) are classified as clutter

---

## 8. Camera ISP

### 8.1 Camera Configuration

Zoox uses approximately **28 RGB cameras** across the vehicle, with both wide-angle (near-field) and telephoto (long-range) lenses, distributed across the four corner sensor pods. The camera supplier is not publicly disclosed.

### 8.2 Image Signal Processing Pipeline

Every camera frame passes through an ISP (Image Signal Processor) pipeline before reaching the perception neural networks. This pipeline is entirely classical signal processing:

```
Photon → Photodiode → ADC → RAW Bayer → Demosaic → White Balance → Denoise →
  Tone Map → Gamma → HDR Merge → Auto-Exposure Adjustment → Output Frame
```

**Demosaicing (debayering)**: Automotive cameras use Bayer color filter arrays (RGGB pattern). Each pixel captures only one color channel. Demosaicing algorithms (bilinear, Malvar-He-Cutler, or edge-adaptive) interpolate the missing color channels to produce a full RGB image. This is a classical interpolation problem.

**White balance**: Adjusts the relative gains of R, G, B channels to compensate for scene illumination color temperature. Automotive ISPs typically use gray-world algorithms, constrained illuminant estimation, or fixed daylight presets.

**Denoising**: Temporal and spatial noise reduction via:
- Bilateral filtering (preserves edges while smoothing noise)
- Non-local means (patches matching across the image)
- Temporal averaging across consecutive frames

**Tone mapping and gamma correction**: Maps the sensor's linear response to a perceptually uniform output. For perception (as opposed to display), linear output may be preferred — or a mild gamma curve applied to compress dynamic range while preserving detail.

### 8.3 HDR (High Dynamic Range)

Automotive environments present extreme dynamic range challenges: direct sunlight vs. tunnel shadows, headlight glare at night, reflections off wet roads. The ISP addresses this through:

**Multi-exposure HDR**: The sensor captures two or more exposures per frame:
- **Short exposure**: Captures highlights (bright sky, headlights) without saturation
- **Long exposure**: Captures shadows and dark regions with sufficient signal
- **HDR merge**: The exposures are combined into a single HDR frame using pixel-level weighting based on signal quality

**Split-pixel HDR**: Some automotive sensors (e.g., OmniVision, Sony) use split-pixel technology that captures different exposures simultaneously within the same pixel, avoiding motion artifacts between exposures.

**LED flicker mitigation (LFM)**: Modern traffic lights and LED signs flicker at frequencies that can cause them to appear off in individual camera frames. The ISP includes LFM algorithms that detect and compensate for LED flicker — critical for traffic light detection.

### 8.4 Auto-Exposure (AE) for Perception

Auto-exposure for autonomous driving differs fundamentally from consumer photography:

**Perception-optimized AE**: Rather than producing aesthetically pleasing images, the AE algorithm optimizes for maximum information content for the perception neural networks:
- Objects of interest (vehicles, pedestrians, traffic lights) should be well-exposed
- Road surface texture should be visible for lane detection
- The histogram should avoid large saturated (pure white) or crushed (pure black) regions

**Region-of-interest AE**: The exposure may be weighted toward the road ahead and expected pedestrian locations rather than uniformly across the frame.

**Coordinated wide+telephoto exposure**: For camera pairs (wide + telephoto viewing the same direction), exposure settings may be coordinated so that one captures near-field and the other long-range, maximizing information content across the depth range.

**Rapid adaptation**: When entering/exiting tunnels, the ISP must adjust exposure within 1-2 frames (100-200 ms) to avoid blind periods. This requires predictive exposure control — ramping exposure in anticipation of illumination changes based on map data (tunnel locations are known).

---

## 9. Acoustic Processing

### 9.1 Microphone Array Configuration

Zoox vehicles carry **directional microphone arrays** at locations that provide omnidirectional acoustic coverage. The arrays are designed primarily for **emergency vehicle siren detection**.

Zoox states that their microphone system can detect sirens *"even before they are visible"* — before the emergency vehicle enters line-of-sight of any optical sensor. This requires both robust detection in urban noise environments and accurate direction-of-arrival estimation.

### 9.2 Siren Frequency Characteristics

Emergency vehicle sirens in the US employ several standard waveforms, each with distinctive spectral signatures:

| Siren Type | Frequency Range | Modulation Pattern | Period |
|---|---|---|---|
| **Wail** | 600 - 1200 Hz | Slow rising/falling sweep | ~3-4 sec full cycle |
| **Yelp** | 600 - 1200 Hz | Rapid rising/falling sweep | ~0.33 sec full cycle (180 cycles/min) |
| **Hi-Lo** | Two fixed tones alternating | Alternating discrete tones | ~0.5-1 sec per tone |
| **Air Horn** | ~350-400 Hz fundamental | Sustained blast | Continuous |
| **Phaser/Priority** | ~500-1800 Hz | Complex multi-tone sweep | 0.38 sec |

### 9.3 FFT/Spectrogram Analysis

The acoustic processing pipeline uses classical spectral analysis:

**Step 1 — Short-Time Fourier Transform (STFT)**:
The raw audio waveform from each microphone is segmented into overlapping windows (typically 50 ms with 10-25 ms hop length) and transformed via FFT to produce a time-frequency representation (spectrogram).

```
S(f, t) = |FFT(x(t) * w(t - t_n))|^2
```

where `w` is a window function (Hann, Hamming) and `t_n` is the window center time.

**Step 2 — Frequency band filtering**:
The spectrogram energy is analyzed within the siren-relevant frequency bands (roughly 400-2000 Hz). Energy outside these bands is suppressed — this eliminates most traffic noise (tire noise is broadband but concentrated below 1 kHz, engine noise is concentrated below 500 Hz).

**Step 3 — Modulation detection**:
Siren signals have characteristic **frequency modulation patterns**:
- **Wail**: Linear frequency sweep from ~600 Hz to ~1200 Hz and back, with a ~3-4 second period. In the spectrogram, this appears as a sinusoidal frequency contour.
- **Yelp**: Same frequency range but 5-10x faster sweep rate. Appears as rapid oscillation in the spectrogram.
- **Hi-Lo**: Two distinct spectral peaks alternating at ~1 Hz.

Detection algorithms look for these specific modulation signatures — either through template matching in the spectrogram, autocorrelation analysis of the frequency contour, or harmonic analysis of the instantaneous frequency.

### 9.4 Direction-of-Arrival (DOA) Estimation

Knowing that a siren is present is insufficient — the vehicle must know **which direction** the emergency vehicle is approaching from. With a multi-microphone array, DOA estimation uses classical array processing:

**GCC-PHAT (Generalized Cross-Correlation with Phase Transform)**:

For each pair of microphones, the cross-correlation of their signals is computed with phase-transform weighting:

```
R_PHAT(tau) = IFFT{ X1(f) * conj(X2(f)) / |X1(f) * conj(X2(f))| }
```

The time delay `tau_peak` at which `R_PHAT` is maximized corresponds to the Time Difference of Arrival (TDOA) between the two microphones. GCC-PHAT is preferred over basic cross-correlation because the phase transform whitens the spectrum, sharpening the correlation peak and improving robustness to reverberation and noise.

Academic research on automotive siren localization using GCC-PHAT reports:
- Median angle error: ~9.6 degrees
- Median distance error: ~9.3 m (within the 10-50 m reaction range)
- Recall rate: 99.16%

**TDOA to angle mapping**:

Given the TDOA `tau` between a microphone pair separated by distance `d`:
```
theta = arcsin(tau * c / d)
```
where `c` is the speed of sound (~343 m/s at 20 degrees C).

With multiple microphone pairs at different orientations, the DOAs from each pair are combined to produce a 2D (azimuth + elevation) or at minimum azimuth estimate of the siren source direction.

**Beamforming**:

As an alternative or complement to GCC-PHAT, delay-and-sum beamforming steers the array toward different directions and measures the output power:
```
P(theta) = |sum_i w_i * x_i(t - tau_i(theta))|^2
```
The direction `theta` with maximum power `P` is the estimated DOA. MVDR (Minimum Variance Distortionless Response) or MUSIC (Multiple Signal Classification) beamforming provide sharper directional resolution at higher computational cost.

### 9.5 Integration with Vehicle Behavior

When a siren is detected and localized:
1. The acoustic detection feeds into the Prediction and Planning pipeline
2. The vehicle begins searching for the emergency vehicle visually (cameras, LiDAR)
3. The vehicle prepares to yield: slow down, pull over, clear intersections
4. As the emergency vehicle enters visual range, acoustic and visual tracking are fused for continuous localization

This is a classical sensor fusion problem — fusing acoustic DOA estimates with visual detections using, e.g., a Kalman filter or particle filter to track the emergency vehicle's position and trajectory.

---

## 10. CLAMS — Infrastructure-Free Calibration

### 10.1 Overview

**CLAMS** = **Calibration, Localization, and Mapping, Simultaneously**. The CLAMS system is responsible for:
1. Calibrating all sensors relative to each other (extrinsic calibration)
2. Localizing the vehicle within HD maps
3. Creating and maintaining HD maps

### 10.2 Infrastructure-Free Camera-LiDAR Calibration

Traditional sensor calibration requires controlled environments with known targets — checkerboard patterns, fiducial markers, structured calibration rooms. Zoox's innovation is performing calibration using **natural environmental features** encountered during normal driving.

**Mathematical formulation** (inferred from Zoox disclosures and targetless calibration literature):

The core idea is to find the rigid-body transformation `T = [R|t]` (rotation `R` and translation `t`) that maps points from the LiDAR frame to the camera frame such that:

1. **Image gradients** (edges detected in camera images) align with
2. **Depth discontinuities** (edges detected in LiDAR depth maps)

**Camera gradient extraction**:
- Compute image gradients using Sobel or Canny edge detection on the camera image
- Strong gradients occur at building edges, tree trunks, curb lines, posts — geometric features with sharp visual boundaries

**LiDAR depth edge extraction**:
- Project the LiDAR point cloud into the camera frame using the current calibration estimate
- Compute depth discontinuities where adjacent LiDAR points have large depth differences
- These depth edges correspond to object boundaries — the same building edges, tree trunks, and curbs visible in the camera image

**Optimization**:
The calibration parameters are refined by minimizing the misalignment between camera image gradients and projected LiDAR depth edges:

```
T* = argmin_T sum_i || grad_I(pi(T * P_i)) || * delta_D(P_i)
```

where:
- `P_i` is a LiDAR point near a depth discontinuity
- `pi(T * P_i)` projects the transformed LiDAR point to pixel coordinates using the camera intrinsic matrix
- `grad_I()` evaluates the image gradient magnitude at that pixel location
- `delta_D(P_i)` weights points near depth edges more heavily
- The optimization seeks `T*` that maximizes the correlation between LiDAR depth edges and camera image edges

In practice, this is solved iteratively using gradient descent or Gauss-Newton optimization, refining the 6-DOF extrinsic parameters (3 rotation angles + 3 translation components).

### 10.3 Why Infrastructure-Free Matters

The Zoox CLAMS team notes: *"every vehicle is a special snowflake in some way"* — manufacturing tolerances, thermal expansion, vibration, and impacts cause sensor positions to drift over the vehicle's lifetime. Infrastructure-free calibration enables:

- **Continuous in-field correction**: Calibration is refined every time the vehicle drives, not just at scheduled maintenance
- **No downtime**: The vehicle does not need to return to a calibration facility
- **Adaptation to environmental changes**: As features around the vehicle change (seasons, construction), the system automatically finds new calibration features
- **Scalability**: No per-vehicle calibration infrastructure needed

---

## 11. Factory Calibration

### 11.1 End-of-Line Calibration Bay

At the Hayward manufacturing facility, each vehicle passes through a dedicated **sensor calibration bay** as part of end-of-line testing:

**Equipment**:

| Component | Purpose |
|---|---|
| **Automated turntable** | Rotates the vehicle through 360 degrees to capture calibration data from all angles |
| **Specialized calibration boards** | Targets with known geometry for camera calibration |
| **Halogen lights** | Illuminate visible-spectrum calibration targets AND heat dots on calibration boards for LWIR |
| **Radar targets** | Known-RCS reflectors for radar calibration |

### 11.2 Dual-Purpose Halogen Calibration

The halogen lights serve a clever dual purpose:
1. **Visible-spectrum calibration**: Provide controlled illumination for camera intrinsic and extrinsic calibration using standard checkerboard or circle-grid patterns
2. **Thermal target creation**: The halogen lights heat specific dots on the calibration boards, creating thermal contrast patterns visible to the LWIR cameras on the **same surface** as the visible calibration targets

This means the LWIR cameras are calibrated relative to the same physical features as the RGB cameras, establishing a direct thermal-to-visible cross-modal calibration.

### 11.3 Turntable Process

1. Vehicle is placed on the automated turntable
2. The turntable rotates the vehicle through 360 degrees while calibration targets surround it
3. All sensors (LiDAR, cameras, LWIR, radar) simultaneously capture data from the targets
4. The vehicle performs a calibration *"dance"* involving rotation and tilting movements
5. Calibration parameters for all sensors are computed from the captured data
6. The process completes in **minutes** (per Zoox)

### 11.4 Camera Intrinsic Calibration

Camera intrinsic calibration (focal length, principal point, distortion coefficients) uses standard computer vision techniques:

**Zhang's method (or similar)**: Multiple images of a planar calibration pattern (checkerboard) at different orientations are captured. The corner points are detected using Harris or Shi-Tomasi corner detection, and the intrinsic parameters are estimated by solving a linear system followed by non-linear refinement (Levenberg-Marquardt optimization).

The classical calibration model for a pinhole camera with radial and tangential distortion:

```
[u, v] = K * [R|t] * [X, Y, Z, 1]^T

with distortion:
x_d = x * (1 + k1*r^2 + k2*r^4 + k3*r^6) + 2*p1*x*y + p2*(r^2 + 2*x^2)
y_d = y * (1 + k1*r^2 + k2*r^4 + k3*r^6) + p1*(r^2 + 2*y^2) + 2*p2*x*y
```

where `K` is the intrinsic matrix, `k1, k2, k3` are radial distortion coefficients, and `p1, p2` are tangential distortion coefficients.

### 11.5 Radar Calibration

Radar calibration uses **known-RCS targets** (corner reflectors) at known positions:
- Range calibration: Verify that measured range matches known target distance
- Angular calibration: Verify that measured angle matches known target azimuth/elevation
- RCS calibration: Verify that measured RCS matches known target RCS (typically a trihedral corner reflector with calculable RCS)

### 11.6 Additional End-of-Line Steps

Following sensor calibration:
- **Wheel alignment**: Both ends (bidirectional vehicle)
- **Active suspension calibration**: Height sensors and damping calibrated
- **Electronic steering zeroing**: Steering angles set to mechanical zero on both ends
- **Headlight alignment**: Both ends (bidirectional vehicle)

---

## 12. Thermal-to-RGB Calibration

### 12.1 The Cross-Modal Challenge

Calibrating LWIR thermal cameras to visible-spectrum RGB cameras is significantly harder than calibrating within the same spectral band, because:

| Challenge | Description |
|---|---|
| **Different physics** | RGB measures reflected light; LWIR measures emitted thermal radiation |
| **No shared features** | A painted checkerboard visible to RGB is invisible in LWIR (paint has uniform emissivity) |
| **Resolution mismatch** | LWIR: 640x512 pixels; RGB: likely 2-8 megapixels |
| **Different distortion models** | LWIR uses germanium optics with different distortion characteristics than visible-light glass optics |

### 12.2 Factory Cross-Modal Calibration

Zoox's factory calibration solves this by using halogen-heated dots on calibration boards. The heated dots are:
- **Visible to RGB cameras** as illuminated patterns
- **Visible to LWIR cameras** as thermal hotspots against the cooler board surface

Because the same physical features are visible to both modalities on the same surface, the standard extrinsic calibration procedure (finding correspondences between known 3D board coordinates and 2D image coordinates in each modality) can be applied to compute the relative pose between LWIR and RGB cameras.

### 12.3 In-Field Cross-Modal Alignment

After factory calibration, the CLAMS infrastructure-free approach can refine LWIR-RGB alignment using natural thermal edges:
- Building edges that have both visual and thermal contrast (sun-lit vs. shaded walls)
- Vehicle boundaries (warm engines/tires create thermal edges that correlate with visual edges)
- Human body outlines (strong thermal signature with corresponding visual edges)

The optimization is analogous to the camera-LiDAR alignment but uses LWIR thermal gradients instead of LiDAR depth edges.

---

## 13. Online Calibration

### 13.1 Continuous In-Field Refinement

Sensor alignment drifts over time due to:
- **Vibration**: Road roughness, speed bumps, potholes
- **Thermal expansion**: Temperature changes cause sensor mounts to expand/contract
- **Mechanical shock**: Impacts from debris, door closures, passenger loading
- **Age and wear**: Gradual loosening of fasteners, fatigue of mounting brackets

Zoox addresses this with continuous online calibration: *"the vehicle checks and re-checks the location of its sensors as it drives, ensuring these measurements are always accurate."*

### 13.2 Drift Detection

Online calibration monitoring detects when sensor alignment has drifted beyond acceptable tolerances:

**Reprojection error monitoring**: Continuously monitor the alignment between camera features and projected LiDAR points. If the mean reprojection error increases beyond a threshold, calibration drift is detected.

**Edge alignment score**: The infrastructure-free calibration objective function (correlation between camera gradients and LiDAR depth edges) can be evaluated continuously. A declining score indicates drift.

**Motion-based detection**: Recent research (FlowCalib, OCAMO) demonstrates that rotational miscalibration induces systematic bias in scene flow estimates. By analyzing the flow field of static objects, the system can detect and quantify rotational drift in pitch and yaw between sensors.

### 13.3 Online Correction Process

When drift is detected, the system performs in-field recalibration:

1. Accumulate correspondences between camera gradients and LiDAR depth edges over recent driving
2. Re-run the extrinsic calibration optimization (Section 10.2) using the accumulated data
3. If the new calibration parameters differ from the current parameters by more than the drift threshold but less than a maximum-change safety limit, update the calibration
4. If the change exceeds the safety limit, flag the sensor for maintenance rather than applying an untrusted correction

### 13.4 Multi-Sensor Online Calibration

Online calibration extends beyond camera-LiDAR pairs:
- **Camera-to-camera**: Feature correspondences in overlapping camera FOVs verify inter-camera alignment
- **LiDAR-to-LiDAR**: Points in overlapping LiDAR FOVs from adjacent sensor pods are cross-registered
- **Radar-to-LiDAR**: Detected targets visible to both sensors provide range and angle correspondences
- **LWIR-to-camera**: Thermal edges correlated with visual edges (as described in Section 12.3)

---

## 14. Time Synchronization

### 14.1 The Multi-Modal Timing Challenge

Zoox processes data from five sensor modalities with different frame rates, latencies, and acquisition patterns:

| Sensor | Typical Frame Rate | Acquisition Pattern | Latency Sources |
|---|---|---|---|
| **LiDAR (Hesai AT128)** | 10 Hz | Scanning (points acquired sequentially over ~100 ms sweep) | Sweep time, per-point variable |
| **Cameras (~28 RGB)** | 10-30 Hz | Rolling shutter (lines acquired sequentially over ~5-15 ms) | Exposure time, readout, ISP pipeline |
| **LWIR thermal** | 30-60 Hz | Rolling or global shutter on microbolometer FPA | Integration time, VPU processing |
| **Radar** | 10-20 Hz | Chirp-based (frame = multiple chirps over ~30-50 ms) | Chirp processing, FFT computation |
| **Microphones** | 16-48 kHz sample rate | Continuous streaming | Minimal (speed of sound propagation ~3 ms/m) |

Without precise time synchronization, sensor data from different modalities would represent different moments, causing misalignment in fused representations.

### 14.2 PTP (Precision Time Protocol)

Zoox vehicles use **IEEE 1588 PTP** (Precision Time Protocol) — specifically the automotive profile **IEEE 802.1AS (gPTP, generalized PTP)** — to synchronize all sensor clocks to a common time base.

**PTP architecture on the vehicle**:

```
GPS/GNSS Receiver (UTC reference)
        |
   PTP Grandmaster (IMU or central compute)
        |
   Automotive Ethernet backbone
        |
   +----+----+----+----+----+
   |    |    |    |    |    |
 LiDAR Cam  Cam  Cam LWIR Radar  (PTP Slaves)
```

**Hardware timestamping**: High-precision PTP implementations use **hardware timestamping** — timestamps are applied by the NIC or dedicated silicon at the physical layer, bypassing software jitter entirely. This achieves:
- Sub-50 nanosecond accuracy between PTP grandmaster and slaves
- Eliminates operating system scheduling jitter (which can be microseconds to milliseconds)

**GPS-disciplined reference**: The PTP grandmaster clock is disciplined to GPS/GNSS UTC time, providing an absolute time reference. The IMU typically synchronizes to UTC via GPS and serves as the PTP master within the vehicle.

### 14.3 Per-Sensor Timestamping

Each sensor modality stamps its data differently:

**LiDAR**: The Hesai AT128 implements PTP firmware, associating each point cloud frame (and ideally each point) with a GPS-synchronized timestamp. Per-point timestamps enable the motion compensation described in Section 5.3.

**Cameras**: Camera capture cards operate as PTP slaves. Each frame is timestamped at the start of exposure. For rolling-shutter cameras, per-line timestamps can be computed from the frame timestamp plus the line readout time.

**Radar**: Radar processing units timestamp the beginning of each chirp frame. The relatively slow radar update rate (10-20 Hz) makes frame-level timestamping sufficient.

**LWIR**: The Boson module timestamps frames via its VPU. Synchronization to the vehicle time base requires PTP or an external trigger signal.

**Microphones**: Audio samples are timestamped by the ADC capture system, synchronized to PTP. The high sample rate (16-48 kHz) provides inherent temporal precision.

### 14.4 Latency Compensation

Even with synchronized clocks, each sensor has **processing latency** — time between physical measurement and data availability at the central compute platform:

| Sensor | Typical Processing Latency |
|---|---|
| **LiDAR** | 5-20 ms (point cloud assembly) |
| **Camera** | 10-30 ms (exposure + ISP pipeline) |
| **Radar** | 20-50 ms (chirp processing + FFT + CFAR) |
| **LWIR** | 5-15 ms (VPU processing) |
| **Audio** | 1-5 ms (buffer + FFT) |

The fusion system must compensate for these latencies by:
1. Using the data timestamp (not arrival time) to determine when the measurement was taken
2. Ego-motion compensating each measurement to a common reference time
3. The sensor staleness framework (Section 15) provides explicit temporal awareness

---

## 15. Sensor Staleness Framework

### 15.1 Problem Statement

In a multi-sensor fusion system, different sensors have different processing latencies. When one sensor stream arrives late ("stale"), the fusion system has data from different moments in time. At urban driving speeds (e.g., 30 mph = 13.4 m/s), even 100 ms of staleness means an object has moved 1.34 meters — potentially the difference between a safe pass and a collision.

The traditional approach was to **discard stale data entirely**, which wastes useful information and creates sensor dropout gaps that degrade perception.

### 15.2 Per-Point Timestamp Offset Feature

Zoox's innovation (published as "Robust sensor fusion against on-vehicle sensor staleness," arXiv:2506.05780, by Meng Fan, Yifan Zuo, Patrick Blaes, Harley Montgomery, and Subhasis Das from Zoox Inc.) adds a **per-point timestamp offset feature** to every LiDAR and radar point:

```
Feature = T_C - T_i
```

where:
- `T_C` is the camera timestamp (reference modality)
- `T_i` is the individual LiDAR or radar point's timestamp

This scalar feature is appended to each point's existing feature vector (x, y, z, intensity, etc.) as an additional input to the perception model. It provides **fine-grained temporal awareness** — the model knows exactly how old each individual data point is relative to the camera frame.

### 15.3 Camera-LiDAR Synchronization Formula

For ideally synchronized data, the camera timestamp corresponding to a LiDAR point at azimuth angle theta_L is:

```
T_C = T_L - 0.1 * (theta_L - theta_C) / (2 * pi)
```

where:
- `T_L` is the LiDAR scan timestamp
- `theta_L` is the azimuth angle of the LiDAR point
- `theta_C` is the camera's azimuth center
- 0.1 represents the 100 ms rotation period (10 Hz)

This formula enables geometric estimation of expected alignment between per-point LiDAR timestamps and camera frame timestamps.

### 15.4 Synthetic Stale Data Augmentation

Training data with artificially introduced staleness is generated from real-world vehicle logs:

**Step 1 — Temporal jittering**: A random offset `delta_t` is sampled uniformly from `[-t_J_max, +t_J_max]` with `t_J_max = 0.1 s` (one frame period):
```
T'_C = T_C + delta_t
```

**Step 2 — Data fetching**: The closest available camera frame at the jittered timestamp is retrieved, potentially one frame older or newer than the perfectly synchronized frame.

**Step 3 — Training mixture**: Stale augmented data is mixed with original data using a stale-over-original ratio `P_S`. Optimal performance occurs at `P_S ~ 0.01` — a small fraction of stale data. Excessive staleness contamination (`P_S > 0.2`) degrades both synchronized and stale performance.

Radar follows a similar procedure but skips geometric synchronization since radar lacks the phase-locked scanning pattern of LiDAR.

Zoox describes this as *"like a vaccine — by training our model on a concentrated dose of stale data, we can prepare it to recognize and manage staleness in the real world."*

### 15.5 Staleness Profiles from On-Vehicle Logs

Analysis of 30-minute on-vehicle logs revealed:

| Observation | Detail |
|---|---|
| **Normal camera-LiDAR offset** | `T_C - T_L` within approximately [-0.1s, 0s] |
| **Out-of-distribution peaks** | Instances where either LiDAR or camera becomes stale by one frame |
| **Radar-LiDAR offset** | `T_R - T_L` remains within single-frame bounds |
| **Multi-sensor complexity** | Multiple peaks reflect mixed distributions across multiple cameras, LiDARs, and radars |

### 15.6 Quantitative Results

| Metric | Baseline (synchronized) | Baseline (100ms stale camera) | With Augmentation (100ms stale camera) |
|---|---|---|---|
| **Car precision** | 40.9% | 30.6% | 40.3% |
| **Car F1** | 52.8% | 36.6% | 52.1% |

The baseline suffered severe degradation under staleness (precision dropped from 40.9% to 30.6%), while the augmented model maintained near-synchronized performance (40.3%).

Zoox's public reporting (via Zoox Journal and Amazon Science) states even more dramatic improvements for vulnerable road users:

| Metric | Improvement |
|---|---|
| **Pedestrian detection precision** | **2x** (doubled) |
| **Pedestrian detection recall** | **~6x** (~600% increase) |
| **Latency impact** | Near-zero |

Smaller objects (pedestrians) showed greater vulnerability to misalignment and benefited most from the approach.

### 15.7 Layered Staleness Strategy

Zoox recommends a combined approach:
- **Staleness below threshold (~150 ms)**: Consume the stale data with timestamp features, letting the model compensate
- **Staleness above threshold**: Apply sensor dropout — discard the stale data entirely
- **This two-tier strategy** balances information preservation (using slightly stale data) with safety (not trusting very old data)

### 15.8 Model Architecture (Hybrid Context)

The staleness framework was validated on a **perspective-view mid-fusion Transformer architecture**:

| Component | Implementation |
|---|---|
| **LiDAR/Radar backbone** | PointPillar (perspective-view frustums) |
| **Camera backbone** | YoloX-PAFPN |
| **Fusion** | Dynamic fusion module at stride 8 |
| **Multi-scale** | Feature Pyramid Network (strides 8, 16, 32) |
| **Detection head** | DINO decoder with deformable cross-attention, adapted for 3D boxes (center, extents, yaw, velocity) |
| **Regularization** | Feature-level sensor dropout (20% probability during training) |

The **timestamp offset feature is model-agnostic** — it is a simple input augmentation (one extra scalar per point) that works with any architecture. This makes it a **hybrid classical-ML technique**: the temporal reasoning is classical (timestamp arithmetic), while the compensation is learned (the neural network learns to use the timestamp feature).

---

## 16. Kalman Filtering and Data Association

### 16.1 Multi-Object Tracking Architecture

While Zoox has not disclosed its exact tracking algorithm, the Main AI System maintains tracked states for all detected objects over time. Based on Zoox's described capabilities (track initiation, association, state estimation, lifecycle management) and standard practice, the tracking system likely uses a variant of the following classical pipeline:

```
Per-Frame Detections → Prediction Step → Data Association → Update Step → Track Management
```

### 16.2 Kalman Filter State Estimation

The Kalman filter (or Extended/Unscented variants for non-linear systems) is the standard approach for fusing noisy measurements with motion model predictions:

**Prediction step** (propagate state forward in time):
```
x_predicted = F * x_previous + B * u
P_predicted = F * P_previous * F^T + Q
```

**Update step** (incorporate new measurement):
```
K = P_predicted * H^T * (H * P_predicted * H^T + R)^(-1)
x_updated = x_predicted + K * (z - H * x_predicted)
P_updated = (I - K * H) * P_predicted
```

where:
- `x` = state vector (position, velocity, acceleration, heading, turn rate)
- `F` = state transition matrix (process model)
- `P` = state covariance matrix (uncertainty)
- `Q` = process noise covariance
- `H` = measurement matrix (maps state to measurement space)
- `R` = measurement noise covariance
- `K` = Kalman gain
- `z` = measurement vector

### 16.3 Data Association — Hungarian Algorithm

**Data association** matches new detections to existing tracks. The standard approach:

1. **Cost matrix construction**: For N existing tracks and M new detections, compute an NxM cost matrix where each entry represents the cost of associating track i with detection j. Cost metrics include:
   - **Mahalanobis distance**: Statistical distance accounting for uncertainty
   - **IoU (Intersection over Union)**: Overlap between predicted and detected bounding boxes
   - **Euclidean distance**: Simple spatial distance
   - **Appearance similarity**: Feature vector similarity from the detector

2. **Hungarian algorithm (Kuhn-Munkres)**: Solves the assignment problem optimally in O(n^3), finding the one-to-one matching of tracks to detections that minimizes total cost.

3. **Gating**: Before association, tracks and detections that are too far apart (exceeding a Mahalanobis distance threshold or maximum Euclidean distance) are excluded from consideration, reducing the assignment problem size and preventing obviously wrong associations.

**Global Nearest Neighbor (GNN)** is an alternative: for each track, find the nearest detection within the gate and associate them greedily, with conflict resolution. GNN is computationally cheaper than Hungarian but suboptimal for ambiguous cases.

### 16.4 Track Lifecycle Management

| Phase | Behavior |
|---|---|
| **Track initiation** | New detections not associated with existing tracks create tentative tracks. A tentative track is promoted to confirmed after being associated in M out of N consecutive frames (e.g., 3 out of 5). |
| **Track maintenance** | Confirmed tracks are propagated via Kalman prediction each frame. Association with a detection triggers Kalman update. |
| **Track coasting** | When a confirmed track has no associated detection (temporary occlusion, sensor miss), it coasts on Kalman prediction alone for up to K frames. The track's uncertainty (covariance) grows during coasting. |
| **Track termination** | If a track has not been associated with a detection for more than K consecutive frames, it is deleted. |
| **Track re-identification** | When an object reappears after occlusion, it may be re-associated with a coasting track if the Mahalanobis distance is within the gate. |

---

## 17. Multi-Modal Data Association

### 17.1 Early Fusion Simplification

Zoox's early fusion architecture significantly simplifies multi-modal data association compared to late fusion approaches.

**Late fusion challenge**: In late fusion, each sensor modality runs its own independent detection pipeline, producing separate detection lists. These must then be associated across modalities — a radar detection must be matched with a LiDAR detection and a camera detection of the same object. This is a hard problem because:
- Different modalities have different spatial resolutions, FOVs, and update rates
- A pedestrian might produce a strong camera detection but a weak or missing radar return
- A vehicle might produce a strong radar return but be partially occluded in camera
- Timing differences between modalities mean objects have moved between measurements

**Early fusion solution**: By fusing raw data from all modalities before detection, the early fusion backbone produces a single fused detection list. There is no need for cross-modal detection association because the detections already incorporate information from all sensors.

### 17.2 Cross-Modal Registration

Even though early fusion avoids detection-level association, the raw data from each modality must be **spatially registered** (aligned) before fusion. This requires:

1. **Extrinsic calibration**: The rigid-body transformation between each sensor pair (computed by CLAMS)
2. **Projection**: LiDAR 3D points projected to camera 2D image planes using calibrated projection matrices:
   ```
   [u, v, 1]^T = K * [R|t] * [X, Y, Z, 1]^T
   ```
3. **Time alignment**: Measurements from different modalities are ego-motion compensated to a common timestamp (Section 14)
4. **Feature-space alignment**: After spatial registration, features from different modalities are concatenated or fused in a shared feature space for the neural network backbone

### 17.3 Five-Modality Alignment

The five modalities require different alignment approaches:

| Pair | Alignment Method |
|---|---|
| **Camera-Camera** | Shared features in overlapping FOVs; known relative poses from calibration |
| **LiDAR-Camera** | 3D-to-2D projection using calibrated intrinsic + extrinsic matrices |
| **LiDAR-LiDAR** | Point cloud registration using extrinsic calibration between LiDAR units |
| **Radar-LiDAR** | Range/angle correspondences; radar detections associated with LiDAR point clusters |
| **LWIR-Camera** | Cross-modal calibration from factory (halogen dots) + in-field refinement (thermal edges) |
| **Audio** | Not spatially fused in the same sense; DOA estimates provide directional information that can be represented in the BEV coordinate frame |

---

## 18. State Vectors and Process Models

### 18.1 State Vectors

Different object types require different state representations:

**Vehicles (bicycle model)**:
```
x = [x, y, theta, v, omega, a, L]
```
where `(x, y)` = center position, `theta` = heading, `v` = speed, `omega` = yaw rate, `a` = longitudinal acceleration, `L` = wheelbase (for bicycle model dynamics).

**Pedestrians (constant velocity / constant acceleration)**:
```
x = [x, y, vx, vy, ax, ay]
```
where `(x, y)` = position, `(vx, vy)` = velocity components, `(ax, ay)` = acceleration components.

**Cyclists**:
```
x = [x, y, theta, v, omega]
```
Similar to vehicles but with different dynamics constraints (tighter turn radii, different acceleration limits).

### 18.2 Process Models

The process model (state transition function) predicts how each tracked object moves between frames:

**Constant Velocity (CV)**:
```
x(t+dt) = x(t) + vx * dt
y(t+dt) = y(t) + vy * dt
vx(t+dt) = vx(t)
vy(t+dt) = vy(t)
```
Simplest model; suitable for pedestrians walking at steady pace, vehicles at constant speed on straight roads.

**Constant Acceleration (CA)**:
```
x(t+dt) = x(t) + vx*dt + 0.5*ax*dt^2
y(t+dt) = y(t) + vy*dt + 0.5*ay*dt^2
vx(t+dt) = vx(t) + ax*dt
vy(t+dt) = vy(t) + ay*dt
```
Better for accelerating/decelerating agents. Pedestrians stopping/starting, vehicles braking.

**Constant Turn Rate and Velocity (CTRV)**:
```
x(t+dt) = x(t) + v/omega * (sin(theta + omega*dt) - sin(theta))
y(t+dt) = y(t) + v/omega * (cos(theta) - cos(theta + omega*dt))
theta(t+dt) = theta(t) + omega * dt
v(t+dt) = v(t)
omega(t+dt) = omega(t)
```
Suitable for vehicles and cyclists executing turns.

**Bicycle model**:
```
x(t+dt) = x(t) + v * cos(theta) * dt
y(t+dt) = y(t) + v * sin(theta) * dt
theta(t+dt) = theta(t) + v * tan(delta) / L * dt
v(t+dt) = v(t) + a * dt
```
where `delta` is the steering angle and `L` is the wheelbase. This model captures the non-holonomic constraints of wheeled vehicles — they cannot move sideways without turning.

### 18.3 Measurement Models per Sensor

Each sensor produces measurements in its own measurement space:

| Sensor | Measurement Model H | Measured Quantities |
|---|---|---|
| **LiDAR** | H maps state to 3D position | (x, y, z) center of detected point cluster; bounding box dimensions |
| **Camera** | H maps state to 2D pixel coordinates via projection | (u, v) bounding box center; width, height in pixels |
| **Radar** | H maps state to range and radial velocity | range, azimuth, radial velocity (Doppler) |
| **LWIR** | H maps state to 2D thermal image coordinates | (u, v) center of thermal blob |
| **Audio** | H maps state to DOA angle | azimuth angle of siren source |

For non-linear measurement models (e.g., radar range = sqrt(x^2 + y^2)), the **Extended Kalman Filter (EKF)** linearizes using the Jacobian, while the **Unscented Kalman Filter (UKF)** uses sigma points to propagate through the non-linearity without explicit Jacobians.

---

## 19. Ground Plane Segmentation, Voxelization, Spatial Indexing

### 19.1 Ground Plane Segmentation via RANSAC

Before the point cloud can be used for object detection (in both the ML pipeline and GCA), the ground plane must be identified and removed. RANSAC (Random Sample Consensus) is the standard approach:

**Algorithm**:
1. **Sample**: Randomly select 3 non-collinear LiDAR points
2. **Fit**: Fit a plane through the 3 points: `ax + by + cz + d = 0`
3. **Count inliers**: Count how many other points lie within a distance threshold of the plane
4. **Repeat**: Iterate steps 1-3 for N iterations (typically 100-1000)
5. **Select**: Choose the plane with the most inliers as the ground plane
6. **Refine**: Re-fit the plane using all inliers via least-squares

**Multi-region ground planes**: In practice, the ground surface is not a single flat plane (it has slopes, curbs, berms). Advanced approaches divide the space into angular sectors or radial zones and fit separate planes to each region. This is exactly what the GCA system does with its spline-based ground fitting (Section 1.4), but RANSAC-based methods may be used in other parts of the pipeline.

### 19.2 Voxelization

For ML processing, the continuous point cloud is discretized into regular 3D grid cells (voxels):

**PointPillars-style voxelization** (used in Zoox's staleness paper):
- The 3D space is divided into a grid of vertical columns ("pillars") in the BEV (x-y) plane
- Each pillar contains all points falling within its (x, y) boundaries
- Per-pillar features are computed: point count, mean (x, y, z), mean intensity, center offset
- This converts the irregular point cloud into a regular 2D grid amenable to 2D CNN processing

**3D voxelization** (VoxelNet-style):
- The 3D space is divided into a regular 3D grid
- Points within each voxel are aggregated into feature vectors
- 3D convolutions or sparse convolutions process the voxel grid

Voxelization is a purely geometric/arithmetic operation — no ML involved.

### 19.3 k-d Trees

**k-d trees** (k-dimensional trees) are binary space-partitioning data structures used for efficient nearest-neighbor search in point clouds:

**Construction**: The point cloud is recursively split along alternating dimensions (x, y, z) at the median point, creating a balanced binary tree.

**Query**: Finding the k nearest neighbors of a query point requires traversing only a fraction of the tree (average O(log n) for balanced trees), rather than checking all n points.

**Uses in Zoox's pipeline**:
- Nearest-neighbor search for Statistical Outlier Removal (rain filtering)
- Local surface normal estimation (for intensity correction and ground fitting)
- Point cluster association for detection
- Efficient range queries for spatial filtering

### 19.4 Octrees

**Octrees** are hierarchical 3D spatial data structures where each internal node has exactly 8 children, corresponding to the 8 octants of a cube subdivided at its center.

**Properties**:
- **Adaptive resolution**: Octrees subdivide finely in regions with dense data and coarsely in sparse regions
- **Memory efficiency**: Empty space is represented by a single leaf node, not individual voxels
- **Hierarchical queries**: Distance queries, collision checks, and ray casting can be performed at multiple levels of detail

**Uses**:
- **OctoMap representation**: Probabilistic occupancy mapping with octree storage (used for free space estimation)
- **Point cloud compression**: Storing and transmitting large point clouds efficiently
- **Multi-resolution processing**: Coarse processing at long range, fine processing at short range

---

## 20. Free Space Estimation

### 20.1 Ray-Casting for Free Space

**Ray casting** determines which regions of space are observable (free or occupied) from the sensor's viewpoint:

**Algorithm**:
1. For each LiDAR return at position P:
   - Cast a ray from the sensor origin O through the point P
   - All cells along the ray from O to P are marked as **free** (the laser beam passed through them)
   - The cell containing P is marked as **occupied** (the laser beam terminated there)
   - Cells beyond P along the ray are marked as **unknown** (occluded)

2. Repeat for every LiDAR return, accumulating evidence across all beams

This is purely geometric — testing ray-cell intersections requires no ML.

### 20.2 Bayesian Occupancy Grid with Log-Odds

The occupancy grid representation maintains a probability of occupancy for each cell, updated using Bayesian inference:

**Binary Bayes filter update**:
```
P(occupied | z_1:t) = 1 / (1 + exp(-L_t))
```

where the **log-odds** `L_t` is updated recursively:
```
L_t = L_{t-1} + log(P(z_t | occupied) / P(z_t | free)) - L_0
```

- `L_0 = log(P_prior / (1 - P_prior))` is the prior log-odds (typically 0 for P_prior = 0.5)
- `P(z_t | occupied)` and `P(z_t | free)` come from the **inverse sensor model**

**Inverse sensor model for LiDAR**:
- Cells along the ray before the return: high `P(z | free)`, low `P(z | occupied)` → log-odds decreases (more confident it's free)
- Cell at the return point: high `P(z | occupied)`, low `P(z | free)` → log-odds increases (more confident it's occupied)
- Cells beyond the return: no update (remain at prior)

**Log-odds advantages**:
- Avoids numerical issues with probabilities near 0 or 1
- Update is a simple addition (computationally cheap)
- Naturally handles conflicting evidence from multiple scans

### 20.3 Zoox's Occluded Region Handling

Zoox patent US20210278853A1 describes a system for determining occupancy of occluded regions:

1. **Occlusion grid**: The environment is discretized into an occlusion grid where each cell has both an **occlusion state** (visible, occluded, partially occluded) and an **occupancy state** (occupied, free, indeterminate).

2. **Temporal accumulation**: Over time, as the vehicle moves and gains different viewpoints, previously occluded regions may become visible. The system tracks which regions have been observed over time.

3. **Pseudo-visible state**: If an occluded region has been observed to be free over a sufficient time period, it transitions to "pseudo-visible" with a probability threshold (e.g., 51%, 75%, or 90% certainty that the region is free of dynamic objects).

4. **Speed-based reasoning**: The system considers the maximum speed at which an object could enter the occluded region. If insufficient time has elapsed for an object to traverse from the nearest entry point to the cell in question, the cell is more likely free.

5. **Vehicle control**: The occupancy state is used as a cost in trajectory planning — higher occupancy probability increases the cost of trajectories passing through that region.

---

## 21. LiDAR-to-Map Scan Matching and Localization

### 21.1 Localization Precision

Zoox achieves localization accuracy of:
- **Position**: within a few centimeters
- **Heading**: within a fraction of a degree
- **Update rate**: 200 times per second

This is achieved by matching real-time sensor data against pre-built HD maps.

### 21.2 ICP (Iterative Closest Point)

ICP is a classical algorithm for aligning two point clouds by iteratively:

1. **Find correspondences**: For each point in the current scan, find the closest point in the reference (map) point cloud
2. **Estimate transformation**: Compute the rigid-body transformation (rotation + translation) that minimizes the sum of squared distances between corresponding points:
   ```
   T* = argmin_T sum_i || p_i - T * q_i ||^2
   ```
   This has a closed-form solution using SVD decomposition.
3. **Apply transformation**: Transform the current scan by T*
4. **Iterate**: Repeat steps 1-3 until convergence (change in error below threshold)

**ICP limitations for AV localization**:
- Sensitive to initial pose estimate — can converge to local minima
- Computationally expensive for large point clouds (O(n * m) for nearest-neighbor search without spatial indexing)
- Sensitive to outliers (dynamic objects present in the current scan but not in the map)

### 21.3 NDT (Normal Distributions Transform)

NDT is an alternative to ICP that represents the reference point cloud as a set of Gaussian distributions rather than individual points:

1. **NDT map creation**: The reference point cloud is divided into cells. For each cell, a Gaussian distribution (mean and covariance) is computed from the points within it.
2. **Score function**: The current scan's quality of alignment is evaluated using the sum of likelihoods of each scan point under its corresponding cell's Gaussian:
   ```
   S(T) = sum_i -exp(-0.5 * (T*p_i - mu_j)^T * Sigma_j^(-1) * (T*p_i - mu_j))
   ```
3. **Optimization**: The transformation T that maximizes S is found using Newton's method or similar gradient-based optimization.

**NDT advantages over ICP**:
- Tolerates larger initial pose errors
- Faster convergence (fewer iterations)
- More compact representation (Gaussians vs. individual points)
- Less sensitive to outliers (Gaussians naturally down-weight points far from the cell center)

### 21.4 Particle Filter Localization

For robust localization, Zoox likely uses a **particle filter** (Monte Carlo Localization) that maintains a distribution of possible vehicle poses:

1. **Initialization**: Spread N particles across the possible pose space (centered on GPS estimate)
2. **Prediction**: Each particle is propagated forward using the vehicle's motion model (odometry from wheel encoders + IMU):
   ```
   x_i(t) = f(x_i(t-1), u(t)) + noise
   ```
3. **Update**: Each particle is weighted by how well the current sensor data matches the map at that particle's hypothesized pose (using scan matching or feature alignment)
4. **Resampling**: Particles with low weights are replaced by copies of high-weight particles (systematic resampling, stratified resampling, or residual resampling)

**Multi-sensor particle filter**: The update step can incorporate multiple sensor modalities:
- LiDAR scan matching provides strong geometric constraints
- Camera feature matching (recognized landmarks, signs) provides visual constraints
- GPS provides a coarse absolute position constraint
- The particle filter naturally handles multi-modal uncertainties (e.g., ambiguous road segments)

### 21.5 Map-to-Reality Discrepancy Detection (ZRN Monitor)

Zoox's ZRN (Zoox Road Network) Monitor detects when the real world differs from the map:
- Construction zones that move lane markings
- Temporary road closures
- New signage or removed signage
- Modified intersections

This is a classical change detection problem: comparing current sensor observations against the stored map and flagging statistically significant differences. The ZRN Monitor alerts both the fleet and engineering teams when discrepancies are detected.

---

## 22. ML Detections to Classical Tracking Pipeline

### 22.1 The Handoff Point

In Zoox's perception pipeline, the transition from ML to classical methods occurs at the **detection output**:

```
[ML Domain]                                    [Classical Domain]
Raw Sensor Data → Early Fusion Backbone →      3D Detections → Kalman Filter Tracking →
Feature Extraction → Detection Heads    →      Data Association → State Estimation →
                                               Track Management → Tracked Object List
```

The ML system produces per-frame **3D bounding box detections** with class labels, confidence scores, and initial velocity estimates. These detections are then consumed by the classical tracking pipeline (Section 16) that:

1. Associates detections to existing tracks (Hungarian algorithm)
2. Updates track states using Kalman filtering
3. Manages track lifecycles (initiation, maintenance, coasting, termination)
4. Produces a **tracked object list** with smoothed positions, velocities, and uncertainties

### 22.2 Why Classical Tracking After ML Detection

Classical tracking methods are preferred over end-to-end learned tracking for several reasons:

| Reason | Detail |
|---|---|
| **Interpretability** | Kalman filter state estimates have well-defined uncertainties (covariance matrices); learned trackers produce opaque representations |
| **Consistency guarantees** | Kalman filters provide optimal state estimates under Gaussian noise assumptions; violations are bounded and well-understood |
| **Robustness to detection noise** | Frame-to-frame detection jitter is smoothed by the filter's process model |
| **Occlusion handling** | Track coasting via Kalman prediction naturally handles temporary occlusions |
| **Memory efficiency** | A Kalman filter state is a small vector + covariance matrix; no large feature buffers |

### 22.3 Motion Model Selection

The tracking system likely uses **multiple motion models** (Interacting Multiple Model, IMM) that switch between process models based on the tracked object's behavior:

- Pedestrian standing still → Constant Velocity model with near-zero velocity
- Pedestrian walking → Constant Velocity model
- Pedestrian starting to run → Constant Acceleration model
- Vehicle in lane → Bicycle model or CTRV
- Vehicle braking → Constant Acceleration model
- Vehicle turning → CTRV or bicycle model

IMM runs multiple Kalman filters in parallel (one per motion model) and combines their outputs weighted by the likelihood that each model matches the current observations.

---

## 23. Classical Preprocessing to ML

### 23.1 LiDAR Preprocessing Chain

Before LiDAR data reaches any neural network, a chain of classical preprocessing steps is applied:

| Step | Method | Purpose |
|---|---|---|
| **Motion compensation** | Rigid-body transform using IMU/odometry (Section 5.3) | Correct for vehicle motion during scan |
| **Multi-sensor registration** | Extrinsic calibration from CLAMS (Section 10) | Merge point clouds from multiple LiDARs |
| **Rain/spray filtering** | SOR, DSOR, LIOR, multi-return discrimination (Section 5.5) | Remove weather noise |
| **Ground plane removal** | RANSAC plane fitting (Section 19.1) | Separate ground from objects |
| **Voxelization** | PointPillars or VoxelNet discretization (Section 19.2) | Convert to regular grid for CNN |
| **Range normalization** | Intensity correction (Section 5.4) | Make intensity comparable across ranges |
| **Timestamp injection** | Per-point timestamp offset feature (Section 15) | Enable temporal awareness |

Every step in this chain is classical. The ML system never sees raw sensor data — it receives a carefully preprocessed, registered, filtered, and discretized representation.

### 23.2 Camera Preprocessing Chain

| Step | Method | Purpose |
|---|---|---|
| **ISP pipeline** | Demosaic, white balance, denoise, tone map, HDR merge (Section 8) | Convert raw Bayer data to usable RGB |
| **Undistortion** | Lens distortion correction using calibrated intrinsic parameters (Section 11.4) | Remove barrel/pincushion distortion |
| **Rectification** | For stereo pairs: epipolar rectification to align image planes | Enable stereo matching |
| **Exposure normalization** | Auto-exposure compensation (Section 8.4) | Consistent brightness across cameras |

### 23.3 Radar Preprocessing Chain

| Step | Method | Purpose |
|---|---|---|
| **Range-Doppler FFT** | 2D FFT on chirp data (Section 7.2) | Extract range and velocity |
| **CFAR detection** | Adaptive thresholding (Section 7.3) | Detect targets above noise floor |
| **Ghost rejection** | Multipath filtering (Section 7.5) | Remove false detections |
| **Clutter filtering** | MTI, RCS thresholding (Section 7.6) | Remove infrastructure returns |
| **Coordinate transform** | Polar-to-Cartesian, sensor-to-vehicle frame | Align with other modalities |

### 23.4 LWIR Preprocessing Chain

| Step | Method | Purpose |
|---|---|---|
| **NUC** | Gain/offset correction, FFC, SSN (Section 6.3) | Remove fixed-pattern noise |
| **Bad pixel replacement** | Nearest-neighbor interpolation (Section 6.5) | Fix defective pixels |
| **Spatial/temporal filtering** | Median, Gaussian, frame averaging (Section 6.6) | Reduce noise |
| **AGC** | Adaptive histogram mapping (Section 6.6) | Map 14-bit to 8-bit dynamic range |

### 23.5 Audio Preprocessing Chain

| Step | Method | Purpose |
|---|---|---|
| **STFT** | Short-time Fourier transform (Section 9.3) | Convert time-domain to time-frequency |
| **Band filtering** | Focus on 400-2000 Hz siren band (Section 9.3) | Isolate siren frequencies |
| **DOA estimation** | GCC-PHAT / beamforming (Section 9.4) | Determine siren direction |

---

## 24. Safety Net — Classical Checks on ML Outputs

### 24.1 Safety Net Architecture

The Safety Net is the third perception system — ML-based but architecturally independent from the Main AI System. However, the broader CAS (Collision Avoidance System) incorporates **classical checks** on ML outputs:

| Check Type | Method | What It Catches |
|---|---|---|
| **Trajectory validation** | GCA geometric corridor check (Section 1) | ML planner trajectories that pass through occupied space |
| **Kinematic feasibility** | Physics-based constraints on planned trajectory | ML outputs that violate vehicle dynamics (impossible acceleration, turn rate) |
| **Stopping distance verification** | Newtonian mechanics calculation | Trajectories that approach obstacles faster than braking allows |
| **Perception consistency** | Cross-checking Main AI detections against GCA detections | Objects detected by one system but not the other |

### 24.2 Classical Validation of ML Trajectories

The GCA/CAS system validates trajectories produced by the ML-based Planner:

1. **Planner generates trajectory** using Main AI perception + QTP prediction
2. **GCA defines corridor** around the planned trajectory
3. **GCA checks corridor** against raw sensor returns (no ML)
4. **If corridor is clear**: Trajectory is passed to vehicle controllers
5. **If obstruction detected**: CAS overrides with emergency maneuver

This creates a **classical safety envelope** around the ML system — the ML can propose any trajectory it wants, but no trajectory can be executed if it would result in the vehicle entering occupied space (as determined by the classical GCA check).

### 24.3 The "Secondary System" Concept

From Zoox patent US20200211394, the secondary system (CAS) is explicitly designed to be **higher integrity and more verifiable** than the primary system:

- The secondary system **may lack an object classifier such as a neural network or decision tree** — it operates without classification
- It uses an **M-estimator** for robust fitting (a classical statistical technique resistant to outliers)
- It independently localizes the vehicle, detects objects, and evaluates trajectories
- It operates **relatively independently** from the primary system to avoid common-cause failures

### 24.4 Classical Reasonableness Checks

Beyond GCA, classical reasonableness checks on ML perception outputs likely include:

| Check | Criterion | Flags |
|---|---|---|
| **Physical plausibility** | Detected object size within realistic bounds | A "pedestrian" with a 10m bounding box |
| **Velocity sanity** | Estimated velocity within physical limits for object class | A pedestrian at 100 km/h |
| **Continuity** | Track state change within kinematic limits between frames | Instantaneous 90-degree heading change for a vehicle |
| **Map consistency** | Detected objects do not pass through mapped static structures | A vehicle trajectory through a building |
| **Sensor agreement** | Detections supported by multiple sensor modalities | A high-confidence detection seen by only one camera and no other sensor |

---

## 25. QTP Prediction Classical Components

### 25.1 QTP Architecture Overview

The QTP (Query-centric Trajectory Prediction) system is primarily ML-based (CNN + GNN), but it incorporates classical constraints and components:

### 25.2 Kinematic Feasibility Constraints

ML-predicted trajectories must satisfy vehicle kinematic constraints. Unconstrained ML models can predict physically impossible motions — a car moving sideways, a bicycle making an instantaneous U-turn, a pedestrian teleporting.

**Bicycle model constraints** (for vehicle predictions):
```
x'(t) = v(t) * cos(theta(t))
y'(t) = v(t) * sin(theta(t))
theta'(t) = v(t) * tan(delta(t)) / L

Subject to:
|delta| <= delta_max         (maximum steering angle)
|v| <= v_max                 (maximum speed)
|a| <= a_max                 (maximum acceleration/deceleration)
|d(delta)/dt| <= delta_dot_max  (maximum steering rate)
```

Predicted trajectories that violate these constraints are either:
- **Projected** onto the feasible set (closest kinematically feasible trajectory)
- **Penalized** with low probability in the trajectory distribution
- **Filtered** from the prediction output

**Pedestrian constraints**:
```
|v| <= v_max_ped             (maximum walking/running speed, ~3-8 m/s)
|a| <= a_max_ped             (maximum acceleration, ~3-5 m/s^2)
```

These are simple arithmetic checks — no ML required.

### 25.3 Road Geometry Constraints

Predicted trajectories are constrained by the road geometry from the ZRN (Zoox Road Network) semantic map:

| Constraint | Source | Effect |
|---|---|---|
| **Lane boundaries** | ZRN lane markings | Vehicle trajectories typically stay within lanes (soft constraint; violations are lower-probability) |
| **Road edges** | ZRN road boundary polygons | Vehicle trajectories cannot leave the drivable surface (hard constraint) |
| **Traffic direction** | ZRN one-way annotations | Predicted trajectories respect traffic direction (soft constraint; wrong-way is low-probability, not impossible) |
| **Speed limits** | ZRN speed limit annotations | Predicted velocities are biased toward posted speed limits |
| **Intersection geometry** | ZRN intersection topology | Turning trajectories follow intersection lane markings |
| **Crosswalk locations** | ZRN crosswalk polygons | Pedestrian crossing predictions are biased toward crosswalks |

These constraints are represented as **cost terms** in the prediction model's output:
- **Soft constraints**: Add penalty to trajectory probability for violations (driving slightly over the speed limit is possible but unlikely)
- **Hard constraints**: Assigned zero probability (driving through a building is impossible)

The cost computation is classical (geometric inclusion tests, distance calculations, speed comparisons), even though it modulates ML-predicted trajectory probabilities.

### 25.4 Prediction Horizon and Update Rate

| Parameter | Value | Nature |
|---|---|---|
| **Prediction horizon** | Up to 8 seconds | Classical parameter |
| **Update rate** | Every 100 ms (10 Hz) | Classical timing |
| **Trajectory representation** | Discrete waypoints at fixed time intervals | Classical representation |
| **Multi-modal output** | Multiple trajectory hypotheses with probabilities | ML generates; classical evaluates feasibility |

### 25.5 Conditional Prediction Classical Interface

QTP's action-conditioned prediction queries have a classical interface:

1. **Planner proposes candidate Zoox trajectories** (N candidate paths)
2. For each candidate, QTP predicts how other agents would respond
3. **Kinematic feasibility check**: Each predicted agent trajectory is checked against physical constraints
4. **Road geometry check**: Each prediction is checked against map constraints
5. **Collision check**: Predicted agent trajectories are checked for intersection with Zoox's candidate trajectory (a classical geometric intersection test between time-parameterized swept volumes)
6. The Planner selects the candidate that minimizes collision risk while meeting journey goals

Step 5 — checking whether two time-parameterized trajectories intersect in space-time — is a classical computational geometry problem. For each time step, the bounding boxes of Zoox and each predicted agent are checked for overlap:

```
collision(t) = BBox_zoox(t) INTERSECTS BBox_agent(t)
```

If `collision(t)` is true for any `t` in the prediction horizon, the candidate trajectory has a collision risk at time `t`. This computation is purely geometric.

---

## Summary: The Classical Backbone

Zoox's perception stack is often described as an ML system, but the non-ML and hybrid-ML components form the **structural backbone** that makes the ML system safe and deployable:

| Domain | Classical/Non-ML Role |
|---|---|
| **Safety** | GCA provides a non-ML safety layer that cannot be defeated by ML failure modes |
| **Calibration** | Classical optimization aligns all sensors; ML assumes good calibration |
| **Preprocessing** | Classical signal processing (NUC, CFAR, motion compensation, filtering) produces clean inputs for ML |
| **Tracking** | Classical Kalman filtering provides interpretable, consistent state estimates from ML detections |
| **Localization** | Classical scan matching + particle filtering provides centimeter-accurate pose |
| **Free space** | Classical ray-casting + Bayesian occupancy provides geometric free-space estimates |
| **Time synchronization** | PTP hardware timestamping ensures temporal consistency across all sensors |
| **Validation** | Classical feasibility checks prevent physically impossible ML predictions from reaching the vehicle controllers |

The GCA system is particularly significant — it represents one of the only fully non-ML, safety-critical perception systems deployed in a production autonomous vehicle. Its design principles (geometric reasoning, physics-based guarantees, architectural independence from ML) embody a fundamental insight: for the most safety-critical decision ("will we hit something?"), classical methods can provide stronger guarantees than any neural network.

---

## Sources

### Zoox Official
- [Zoox Journal: Perception](https://zoox.com/journal/perception) — Triple-redundant architecture, GCA, Safety Net, five sensor modalities
- [Zoox Journal: Sensor Staleness](https://zoox.com/journal/sensor-staleness-zoox) — Timestamp features, synthetic stale training
- [Zoox Journal: End-of-Line Testing](https://zoox.com/journal/zoox-end-of-line-testing-manufacturing) — Factory calibration bay, turntable, halogen lights
- [Zoox Journal: Putting Robots on the Map](https://zoox.com/journal/putting-our-robots-on-the-map) — CLAMS, mapping pipeline
- [Zoox Safety](https://zoox.com/safety) — Safety architecture overview
- [Zoox Safety Report Volume 2](https://www.datocms-assets.com/106048/1696536139-zoox_safety_report_volume2_2021_v2.pdf) — CAS architecture

### Amazon Science
- [How Zoox Vehicles Find Themselves](https://www.amazon.science/latest-news/how-zoox-vehicles-find-themselves-in-an-ever-changing-world) — CLAMS calibration, infrastructure-free alignment
- [How Zoox Predicts Everything](https://www.amazon.science/latest-news/how-the-zoox-robotaxi-predicts-everything-everywhere-all-at-once) — QTP prediction, BEV CNN, GNN
- [Scenario Diffusion](https://www.amazon.science/blog/scenario-diffusion-helps-zoox-vehicles-navigate-safety-critical-situations) — Synthetic scenario generation

### Zoox Patents
- [US11500385B2 — Collision avoidance perception system](https://patents.google.com/patent/US11500385B2/en) — Trajectory corridor, ground/object classification, spline fitting, weighted least squares
- [US20200211394 — Collision avoidance system](https://www.freepatentsonline.com/y2020/0211394.html) — Primary/secondary system architecture, M-estimator, corridor definition
- [US20210278853A1 — Determining occupancy of occluded regions](https://patents.google.com/patent/US20210278853A1/en) — Ray casting, occlusion grid, probabilistic free space
- [Zoox Patents (Justia)](https://patents.justia.com/assignee/zoox-inc) — Full patent portfolio

### Academic Papers
- [Robust sensor fusion against on-vehicle sensor staleness (arXiv:2506.05780)](https://arxiv.org/html/2506.05780) — Fan et al., Zoox Inc., per-point timestamp offset, staleness augmentation
- [Emergency Vehicles Audio Detection and Localization (arXiv:2109.14797)](https://arxiv.org/abs/2109.14797) — GCC-PHAT, TDOA, siren detection

### Sensor Suppliers
- [Hesai AT128 Product Page](https://www.hesaitech.com/product/at128/) — 128-ch LiDAR specifications
- [FLIR Boson Datasheet](https://groupgets-files.s3.amazonaws.com/boson/documents/Boson%20datasheet,%20102-2013-40,%20Rev%20340.pdf) — Boson signal processing pipeline
- [FLIR NUC Explanation](https://www.flir.com/discover/professional-tools/what-is-a-non-uniformity-correction-nuc/) — Non-uniformity correction
- [FLIR Boson FFC/NUC Control](https://tesscorn-thermalimaging.com/wp-content/uploads/2024/08/Boson-FFC-NUC-Control-AppNote-0918-2.pdf) — Shutterless NUC, FFC parameters

### Radar Processing
- [Advanced Signal Processing for Automotive Radar](https://www.sciencedirect.com/org/science/article/pii/S1526149225002267) — CFAR, range-Doppler, ghost rejection
- [Radar Ghost Dataset (arXiv:2404.01437)](https://arxiv.org/html/2404.01437v1) — Multipath analysis, ghost detection
- [Radars for Autonomous Driving (arXiv:2306.09304)](https://arxiv.org/pdf/2306.09304) — FMCW processing pipeline

### Time Synchronization
- [PTP for Sensor Synchronization](https://rd-datarespons.no/sensor-synchronization-and-ptp/) — IEEE 1588, hardware timestamping
- [PTP Wikipedia](https://en.wikipedia.org/wiki/Precision_Time_Protocol) — Protocol details

### Calibration
- [Aurora Continuous Recalibration](https://aurora.tech/newsroom/continuous-real-time-sensor-recalibration-a-long-range-perception-game-changer) — Online calibration monitoring
- [OCAMO — Online Calibration Monitoring](https://ieeexplore.ieee.org/document/10374278/) — Rotational drift tracking
- [RGB-Thermal Calibration (PST900)](https://ar5iv.labs.arxiv.org/html/1909.10980) — Cross-modal calibration methods

### Occupancy and Tracking
- [Bayesian Occupancy Grid Mapping (CMU)](https://www.cs.cmu.edu/~16831-f12/notes/F12/16831_lecture05_vh.pdf) — Log-odds updates, inverse sensor models
- [Kalman Filter Sensor Fusion](https://pmc.ncbi.nlm.nih.gov/articles/PMC11644892/) — LiDAR-camera fusion with Hungarian algorithm
- [3D Voxel-based Obstacle Detection](https://www.sciencedirect.com/science/article/abs/pii/S0921889016300483) — Multi-region ground planes

### Localization
- [ICP vs NDT Comparison](https://ieeexplore.ieee.org/document/8690819/) — 3D scan registration for autonomous vehicles
- [NDT Localization with Filtered LiDAR](https://hal.science/hal-03328993/document) — Normal Distributions Transform

### LiDAR Adverse Weather
- [Survey on LiDAR in Adverse Weather](https://arxiv.org/pdf/2304.06312) — Rain, fog, spray filtering
- [LIDSOR Rain/Snow Filter](https://isprs-archives.copernicus.org/articles/XLVIII-1-W2-2023/733/2023/isprs-archives-XLVIII-1-W2-2023-733-2023.pdf) — Point cloud noise removal

### Microbolometer Technology
- [Microbolometer — Wikipedia](https://en.wikipedia.org/wiki/Microbolometer) — VOx FPA architecture
- [ROIC Architectures for Uncooled FPAs](https://www.mdpi.com/1424-8220/23/5/2727) — Readout IC design, gain/offset compensation

### Hybrid Perception
- [Hybrid Multi-Sensor Fusion Framework](https://pmc.ncbi.nlm.nih.gov/articles/PMC6833089/) — ML detection + classical EKF tracking

---

*This document synthesizes information from 50+ sources including Zoox official publications, Amazon Science,
patent filings, sensor supplier specifications, academic papers, and trade press. Where specific technical
details are not publicly disclosed by Zoox, inferences are clearly contextualized and grounded in disclosed
architectural choices, patent claims, and established practices in the autonomous driving industry.*
