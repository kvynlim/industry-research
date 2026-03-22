# Cruise Autonomous Vehicle: Perception Stack Deep Dive

> **Last Updated:** March 2026
> **Companion to:** cruise-av-tech-stack.md

---

## Table of Contents

1. [Sensor Fusion Architecture](#1-sensor-fusion-architecture)
2. [LiDAR Perception](#2-lidar-perception)
3. [Camera Perception](#3-camera-perception)
4. [Radar Perception](#4-radar-perception)
5. [3D Object Detection](#5-3d-object-detection)
6. [Object Tracking](#6-object-tracking)
7. [Semantic Segmentation](#7-semantic-segmentation)
8. [Occupancy Prediction](#8-occupancy-prediction)
9. [Prediction System](#9-prediction-system)
10. [Continuous Learning Machine (CLM)](#10-continuous-learning-machine-clm)
11. [Traffic Light and Sign Detection](#11-traffic-light-and-sign-detection)
12. [Pedestrian and VRU Detection](#12-pedestrian-and-vru-detection)
13. [Night and Adverse Weather Perception](#13-night-and-adverse-weather-perception)
14. [Coordinate Frames and Spatial Representations](#14-coordinate-frames-and-spatial-representations)
15. [Non-ML Components](#15-non-ml-components)
16. [Auto-Labeling and Training Data](#16-auto-labeling-and-training-data)
17. [Key Papers and Technical Publications](#17-key-papers-and-technical-publications)
18. [Key Patents](#18-key-patents)
19. [Perception Failures and Incident Analysis](#19-perception-failures-and-incident-analysis)
20. [Legacy for GM](#20-legacy-for-gm)

---

## 1. Sensor Fusion Architecture

### 1.1 Sensor Inventory

The Cruise AV (Chevrolet Bolt-based) deploys **42 sensors** providing 360-degree coverage:

| Sensor Type | Count | Role |
|---|---|---|
| LiDAR | 5 | 3D point cloud mapping, obstacle detection, localization |
| Cameras | 16 | Visual perception, traffic signal recognition, lane detection, classification |
| Radar | 21 | Velocity measurement, long-range detection, adverse weather robustness |
| **Total** | **42** | Full surround sensing with overlapping fields of view |

Additional non-imaging sensors include acoustic sensors (microphones) for emergency vehicle siren detection, GPS/GNSS receivers for coarse global positioning, and an IMU for dead-reckoning and inertial state estimation.

According to Cruise, **40% of the hardware** in the Cruise AV is unique to self-driving and not found in the standard Bolt EV. The combined sensor suite generates up to **10 gigabits of data per second**, all of which must be processed in real time with hard latency constraints.

### 1.2 Fusion Strategy: Late Fusion

Cruise employs a **late fusion** architecture. In this approach, each sensor modality -- LiDAR, camera, and radar -- processes its raw data through independent perception pipelines, producing per-modality detections and features before they are combined in a downstream fusion stage.

The pipeline operates as follows:

1. **Per-modality processing**: Each sensor stream runs through its own detection and feature extraction pipeline independently. Camera images go through 2D detection networks; LiDAR point clouds go through 3D detection networks; radar returns are processed for range, Doppler velocity, and angle.

2. **Projection and alignment**: 2D camera detections are combined with 3D LiDAR and radar features using camera extrinsic parameters that define the geometric relationship between sensors. This step projects detections from each sensor's native coordinate frame into a common reference frame.

3. **Fusion and association**: Aligned detections from multiple modalities are associated and merged to produce a unified set of tracked objects with high-confidence classifications, positions, velocities, and dimensions.

This contrasts with **early fusion** architectures (used by some competitors) that combine raw sensor data before any detection, and **mid-level fusion** approaches that merge intermediate feature representations. Late fusion provides Cruise with several advantages:

- **Modularity**: Individual perception pipelines can be developed, tested, and upgraded independently.
- **Graceful degradation**: If one sensor modality is compromised (e.g., camera blinded by sun glare, LiDAR degraded by heavy rain), the remaining modalities continue producing detections.
- **Interpretability**: Debugging is more straightforward because each pipeline's outputs can be inspected independently before fusion.

### 1.3 Fusion Stages

The overall perception pipeline follows a staged architecture:

```
Raw Sensor Data
    |
    +-- LiDAR Pipeline --> 3D Detections, Point Clouds
    |
    +-- Camera Pipeline --> 2D/3D Detections, Semantic Features
    |
    +-- Radar Pipeline --> Range/Doppler Detections, Velocity Estimates
    |
    v
Sensor Fusion (Late)
    |
    v
Unified Object List (Position, Velocity, Class, Dimensions, Confidence)
    |
    v
Multi-Object Tracker (MOT)
    |
    v
Scene Understanding / Semantic Map
    |
    v
Prediction --> Planning --> Control
```

### 1.4 Redundancy in Sensor Fusion

The sensor suite is designed with **no single point of failure** across sensing. Multiple overlapping sensor modalities provide redundant coverage of the same spatial regions. If one sensor fails, the system degrades gracefully rather than losing perception entirely. The AI-filtered sensor data enables smooth transitions between redundant sensors to maintain vehicle control.

This redundancy principle extends across all four critical domains: sensing, compute, networking, and power. The compute platform features dual-redundant processing with active hot standby, ensuring that even a compute hardware failure does not compromise perception.

---

## 2. LiDAR Perception

### 2.1 Hardware Evolution: Velodyne to Strobe

Cruise's LiDAR strategy evolved through several phases:

**Phase 1 -- Commercial Velodyne (2015--2019)**

Early Cruise AVs used commercial Velodyne spinning LiDAR sensors mounted on the rooftop sensor bar. The Velodyne VLP-16 (Puck) provides 16 channels with approximately 300,000 points per second, a 360-degree horizontal field of view, and a 30-degree vertical field of view, with a range of 100 meters. The higher-end Velodyne HDL-64E provides 64 laser channels, over 2.2 million points per second, and a 26.8-degree vertical field of view.

These spinning LiDAR sensors provided reliable 3D point cloud data but had significant drawbacks: high cost (the HDL-64E was priced at approximately $75,000 per unit at introduction), mechanical complexity from the spinning mechanism, vulnerability to vibration, and a large form factor unsuitable for consumer vehicles.

**Phase 2 -- Strobe Acquisition and FMCW LiDAR Development (2017--onward)**

In **October 2017**, Cruise acquired **Strobe Inc.**, a 12-person startup founded by Lute Maleki (previously of OEwaves) developing chip-scale FMCW (Frequency-Modulated Continuous Wave) solid-state LiDAR. This was a strategic bet on next-generation LiDAR technology.

**Strobe's FMCW Technology:**

Traditional time-of-flight (ToF) LiDAR sends short pulses of laser light and measures the round-trip time to determine distance. Strobe's FMCW approach is fundamentally different:

- The sensor produces brief **"chirps"** of frequency-modulated laser light, where the frequency within each chirp varies linearly over time.
- By measuring the **phase and frequency** of the returning chirp (the echo reflected from objects), the system simultaneously determines both the **distance** and **instantaneous velocity** of objects.
- This dual measurement capability eliminates the need for a separate computational step to derive velocity from successive distance measurements, reducing the processing load on the AV's compute stack and enabling faster decision-making.

**Key Advantages of FMCW LiDAR over ToF LiDAR:**

| Property | Time-of-Flight LiDAR | FMCW LiDAR (Strobe) |
|---|---|---|
| Measurement | Distance only | Distance + velocity simultaneously |
| Interference immunity | Susceptible to interference from other LiDAR systems and sunlight | Relatively immune -- coherent detection rejects ambient noise |
| Detector requirements | Requires highly sensitive (expensive) photodetectors | Does not require highly sensitive photodetectors |
| Cost target | $1,000--$75,000+ per unit | Target **99% cost reduction** (sub-$100 per unit) |
| Form factor | Spinning mechanical assembly or large solid-state units | Chip-scale -- entire sensor collapsed to a single chip |
| Sunlight robustness | Can be affected by strong sunlight | Robust to interference from sunlight, even in extreme cases |

**Hybrid Strategy:**

Cruise pursued a practical dual-track approach: deploying commercial LiDAR units (likely Velodyne) for near-term fleet operations while developing Strobe's proprietary solid-state FMCW LiDAR for future vehicle generations including the Cruise Origin. Kyle Vogt emphasized that when used together, cameras, LiDARs, and radars complement each other to create a robust and fault-tolerant sensing suite.

### 2.2 LiDAR Configuration

The 5 LiDAR units are mounted on the rooftop sensor bar in a configuration designed to maximize 360-degree coverage and minimize blind spots. The arrangement provides:

- **360-degree horizontal coverage**: The primary spinning LiDAR (or multiple units in aggregate) covers the full azimuth.
- **Vertical coverage**: Multiple LiDAR units with different mounting angles and beam patterns ensure adequate vertical field of view to detect objects from ground level (curbs, road debris, prone pedestrians) to elevated features (traffic lights, overpasses).
- **Overlapping fields of view**: Multiple units cover the same spatial regions from different vantage points, providing redundancy and enabling cross-validation of detections.

### 2.3 Point Cloud Processing

LiDAR point cloud processing in the Cruise pipeline involves several stages:

**Preprocessing:**
- Raw point cloud data is timestamped and motion-compensated to account for vehicle ego-motion during the LiDAR scan rotation.
- Points are filtered to remove noise, ground returns, and self-reflections from the vehicle body.
- Coordinate transformation converts points from the LiDAR sensor frame to the vehicle body frame using calibrated extrinsic parameters.

**Ground Segmentation:**
- Ground plane estimation separates ground points from above-ground points. This is critical for free-space estimation and for removing ground clutter before object detection.
- Road surface detection identifies the drivable surface, curbs, and road edges from the point cloud geometry.

**Voxelization and Feature Extraction:**
- The scattered LiDAR points are converted into a structured 3D grid through **voxelization** (dividing 3D space into volumetric pixels) or **pillarization** (dividing into vertical columns extending from the ground plane).
- Voxelized representations enable the use of 3D convolutional neural networks for feature extraction. Pillar-based representations allow the use of efficient 2D convolutions on a pseudo-image, significantly accelerating processing.
- Deep neural networks extract per-voxel or per-pillar features that encode the geometric and intensity properties of the points within each spatial cell.

**3D Object Detection:**
- Detection heads operating on the extracted features produce 3D bounding box proposals with associated class labels (vehicle, pedestrian, cyclist, etc.), confidence scores, dimensions, and orientations.
- The detection network outputs are fed into the late fusion stage for combination with camera and radar detections.

### 2.4 FMCW LiDAR Processing Advantages

Strobe's FMCW LiDAR provides direct velocity measurement at each point in the point cloud. This per-point velocity information has significant downstream benefits:

- **Moving object segmentation**: Points with non-zero radial velocity can be immediately identified as belonging to moving objects, simplifying the separation of dynamic and static elements.
- **Velocity cross-validation**: Per-point velocities from FMCW LiDAR can be cross-checked against radar Doppler measurements for redundancy.
- **Reduced computational burden**: Eliminating the need to compute velocity from frame-to-frame correspondence reduces processing latency and compute requirements.

---

## 3. Camera Perception

### 3.1 Camera Array

The Cruise AV employs **16 cameras** distributed around the vehicle, providing overlapping visual coverage in all directions. The cameras provide rich texture, color, and semantic information that complements the geometric precision of LiDAR.

Camera data is essential for:
- Traffic signal state recognition (color, arrow direction, flashing patterns)
- Lane marking detection and classification
- Signage recognition (speed limits, stop signs, construction signs)
- Object classification (distinguishing vehicle types, pedestrian attributes)
- Fine-grained scene understanding (double-parked vehicles, open car doors, construction zones)

### 3.2 Camera Processing Pipeline

Cruise implements a **5-step camera perception workflow**:

**Step 1 -- Camera Calibration**

- **Intrinsic calibration** removes optical distortion inherent to each camera lens (barrel distortion, pincushion distortion, chromatic aberration).
- **Extrinsic calibration** determines the precise position and orientation of each camera relative to the vehicle body frame and to other sensors. This is critical for enabling sensor fusion and accurate 3D projections.
- Cruise's Sensor Placement Tool enables virtual evaluation and iteration of camera layouts, including cameras with different fields of view and distortion characteristics, before physical installation.
- Calibration accounts for manufacturing tolerances, shipping vibrations, and in-service jostling that can cause small deviations between expected and actual sensor extrinsics.

**Step 2 -- Temporal Synchronization**

- **Phase locking** synchronizes LiDAR rotation timing with camera frame capture to ensure temporal alignment between modalities.
- Without precise time synchronization, the spatial correspondence between a LiDAR point and its corresponding camera pixel would be degraded, particularly for fast-moving objects.
- The synchronization system accounts for varying sensor frame rates and exposure times.

**Step 3 -- Labeling and Annotation**

- Training the camera perception models requires annotation of obstacles, lanes, traffic signals, hazard lights, and other scene elements.
- Cruise invested heavily in auto-labeling systems (detailed in Section 16) to scale annotation beyond what human annotators could achieve.
- Labels cover a wide taxonomy of object classes and attributes.

**Step 4 -- Data Management**

- The camera data pipeline processes hundreds of terabytes daily across the fleet.
- Apache Spark-based processing handles the scale of multi-camera video data.
- The Terra data processing platform (built on Apache Beam) manages dataset registration, lineage tracking, and feature discovery.

**Step 5 -- Perception Tasks**

- Deep neural network backbones extract feature representations from each camera image.
- Detection heads produce 2D bounding boxes with class labels and confidence scores.
- Some detection heads produce 3D estimates by leveraging monocular depth estimation or multi-view geometry.
- Semantic segmentation heads produce per-pixel class labels for road surface, lane markings, and other scene elements.

### 3.3 Backbone Architectures

While Cruise has not publicly disclosed its exact backbone architectures, the perception team's job postings and engineering publications indicate the use of deep learning approaches including:

- **Convolutional Neural Networks (CNNs)**: Standard backbone architectures (such as ResNet variants) for image feature extraction, optimized for real-time inference on the onboard GPU compute platform.
- **Multi-task learning**: A shared backbone with multiple output heads corresponding to different perception tasks (detection, segmentation, classification). This architecture allows the backbone to be shared among heads, reducing total compute while maintaining task-specific performance.
- **Heterogeneous input processing**: The perception model accepts heterogeneous sensory data from cameras (and potentially fused with LiDAR and radar features) and produces multiple output types including segmentation maps, object tracks, and attribute classifications.

### 3.4 2D to 3D Lifting

Camera-based detection occurs initially in 2D image space and is then lifted to 3D using:

- **Sensor fusion with LiDAR**: 2D camera detections are associated with 3D LiDAR point clusters to obtain depth information.
- **Extrinsic projection**: Known camera-to-world transformations allow rays from 2D detections to be projected into 3D space, with depth resolved by LiDAR or radar measurements.
- **Monocular depth estimation**: Neural networks estimate depth from single camera images, providing a fallback when LiDAR coverage is insufficient.

---

## 4. Radar Perception

### 4.1 Radar Configuration

The Cruise AV deploys **21 radar sensors** distributed around the vehicle. This large radar count enables comprehensive velocity and range measurement coverage, with radar serving as the most weather-robust sensing modality.

### 4.2 Articulating Radar Assemblies (ARAs)

One of Cruise's most distinctive sensor innovations is the **Articulating Radar Assembly (ARA)**. The current AV fleet features **three ARAs**, each consisting of a long-range radar sensor mounted on a motorized actuator:

**Mounting positions**: Two ARAs sit in front of the A-pillar on both sides of the vehicle. The third provides additional directional coverage.

**Mechanical design**: Each ARA houses a long-range radar on a motor that can rotate the radar left and right (and on the Origin, pivot 360 degrees) to point it in the optimal direction for the current driving maneuver.

**Field of view characteristics**: The long-range radar within each ARA has a narrow field of view but excellent range -- analogous to a telephoto lens on a camera. It can detect vehicles at distances where camera and LiDAR coverage may be insufficient.

**Control architecture**:
1. The self-driving software identifies upcoming traffic patterns and maneuver requirements.
2. A directional command is issued to the ARA Bridge software.
3. The ARA Bridge interprets the request using vehicle localization and pose data to calculate the optimal motor rotation angle.
4. Commands traverse the vehicle's electrical system via **CANOpen, Ethernet, and IPC protocols** across multiple electronic control units before reaching the motor.
5. The Embedded Systems team manages the first layer of software connecting the AV to reality, bridging sensors and actuators to the self-driving stack.

**Primary use case -- unprotected left turns**: During an unprotected left turn, the ARA points a long-range radar down the road to scan for approaching vehicles that have the right of way. This is especially valuable in adverse weather conditions where camera or LiDAR performance degrades.

**Diagnostics and safety monitoring**: Startup procedures include communication pathway verification, motor calibration checks, full-range motion testing, and resistance measurement. Runtime monitoring tracks communication loss, voltage irregularities, temperature deviations, and excessive operating currents. The system triggers graduated responses ranging from "return after ride ends" to "pull over immediately" depending on the severity of the fault.

### 4.3 Radar Processing

Radar processing in the Cruise pipeline provides:

- **Range measurements**: Distance to detected objects.
- **Doppler velocity**: Direct radial velocity measurement of targets, providing ground-truth velocity that can cross-validate LiDAR-derived or tracker-estimated velocities.
- **Angle estimation**: Bearing to detected objects (with resolution dependent on the radar array design).
- **Weather robustness**: Radar operates effectively in rain, fog, snow, and darkness where cameras and LiDAR degrade. This makes radar the critical perception backbone for adverse conditions.

### 4.4 Radar-Camera Fusion

Radar and camera data are fused to leverage the complementary strengths of each modality:

- Radar provides accurate range and velocity but has poor angular resolution compared to cameras.
- Cameras provide high angular resolution and rich semantic information but lack direct range and velocity measurement.
- Fused radar-camera detections combine accurate range/velocity from radar with precise angular localization and classification from cameras.
- This fusion is particularly important for long-range detection scenarios (highway merging, unprotected left turns) where LiDAR coverage may be sparse.

---

## 5. 3D Object Detection

### 5.1 Detection Architecture

Cruise's perception engineering group develops deep learning-based approaches for 3D object detection across the full sensor suite. The 3D detection system produces volumetric bounding boxes (oriented 3D boxes) for all detected objects in the scene.

The detection architecture operates on multiple input modalities:

**LiDAR-based 3D detection**:
- Point clouds are voxelized or pillarized into structured representations.
- 3D or 2D convolutional backbones extract spatial features.
- Detection heads regress 3D bounding box parameters: center position (x, y, z), dimensions (length, width, height), heading angle, and velocity.
- Architectures in this space (such as PointPillars, VoxelNet, and CenterPoint) represent the state of the art. PointPillars converts point clouds into vertical pillar representations processed by efficient 2D convolutions. CenterPoint predicts object centers and regresses box attributes from those center points, with joint detection and tracking by associating centers across frames.

**Camera-based 3D detection**:
- Monocular or multi-view camera images are processed by CNN backbones.
- 3D bounding box parameters are estimated from 2D image features using learned depth estimation and geometric reasoning.
- Camera 3D detection provides complementary coverage, especially for objects with strong visual signatures (vehicles with distinct shapes, pedestrians) but limited LiDAR returns.

**Fused detection**:
- Late fusion combines per-modality detections into a unified object list.
- Association algorithms match detections across modalities based on spatial proximity, velocity consistency, and classification agreement.
- Fused detections have higher confidence and more complete attribute estimates than any single modality.

### 5.2 Detection Classes

Cruise's 3D object detection system handles a comprehensive taxonomy of road objects:

| Class Category | Examples |
|---|---|
| Vehicles | Passenger cars, SUVs, trucks, buses, motorcycles, emergency vehicles |
| Pedestrians | Adults, children, people in wheelchairs, people with strollers |
| Cyclists | Bicyclists, e-scooter riders |
| Static objects | Parked vehicles, traffic cones, barriers, construction equipment |
| Road features | Curbs, medians, road edges |
| Other | Animals, debris, unclassified obstacles |

### 5.3 Detection Ranges

Detection ranges vary by sensor modality and object class:

- **LiDAR**: Effective detection range of ~100--200 meters for vehicles, shorter for smaller objects like pedestrians (~60--100 meters) depending on point density.
- **Radar (long-range ARA)**: Effective range exceeding 200 meters for vehicles, used primarily for unprotected left turn scenarios and highway-speed detection.
- **Camera**: Effective detection range depends on object size and resolution; vehicles detectable at 200+ meters, pedestrians at 100+ meters in good visibility.
- **Fused**: The combined sensor suite provides robust detection out to 200+ meters for vehicles and 100+ meters for pedestrians under nominal conditions.

### 5.4 Output Format

Detection outputs for each object include:

- 3D bounding box (center, dimensions, orientation)
- Object class label and confidence score
- Estimated velocity vector
- Uncertainty estimates for position and velocity
- Sensor modality source flags (which sensors contributed to this detection)

---

## 6. Object Tracking

### 6.1 Multi-Object Tracking (MOT)

Following detection, the **multi-object tracker** maintains persistent identity for each detected object across successive perception frames. This is critical for downstream prediction, which requires a temporal history of each agent's trajectory.

### 6.2 Tracking Architecture

Cruise's tracking system follows the **tracking-by-detection** paradigm, which consists of:

**State estimation**:
- **Kalman Filters** are used for state estimation, maintaining estimates of each tracked object's position, velocity, acceleration, and heading.
- The filter's prediction step propagates the state forward using a motion model (constant velocity, constant acceleration, or bicycle model for vehicles).
- The filter's update step incorporates new detections to refine the state estimate, weighing the predicted state against the measured detection based on their respective uncertainties.
- Cruise's engineering publications confirm the use of Kalman Filters as a core component of their state estimation pipeline.

**Data association**:
- The **Hungarian algorithm** (or similar optimal assignment algorithm) matches predicted track states to incoming detections based on spatial proximity, velocity agreement, and classification consistency.
- Association costs typically combine Mahalanobis distance (accounting for state uncertainty) with appearance similarity features from camera imagery.
- In the style of the SORT (Simple Online and Realtime Tracking) algorithm, detection-to-track matching is followed by track management (creation, maintenance, and deletion of tracks).

**Track lifecycle management**:
- New tracks are tentatively created when detections appear that do not match existing tracks.
- Tracks are promoted to confirmed status after consistent detections across multiple frames.
- Tracks are marked as lost when detections are missed for several consecutive frames, with the Kalman filter coasting the predicted state.
- Tracks are terminated after prolonged absence of matching detections.

### 6.3 Deep Learning Integration

While the core tracker uses classical Kalman filter and Hungarian matching algorithms, deep learning enhances several tracking components:

- **Appearance features**: CNN-extracted appearance embeddings help maintain identity through occlusions and across modalities.
- **Motion prediction**: Deep learning models can augment or replace simple linear motion models with learned non-linear trajectory predictions.
- **Velocity regression**: CenterPoint-style architectures regress object velocities directly from temporal point cloud data, enabling identity matching based on predicted object centers across frames using simple greedy spatial association.

Cruise's engineering publications noted that compared with Kalman Filters and Particle Filters, deep learning models adapt faster to sudden kinematic changes, which is vital for accident avoidance when encountering moving objects.

---

## 7. Semantic Segmentation

### 7.1 Role of Segmentation

Semantic segmentation assigns a class label to every pixel (in camera images) or every point (in LiDAR point clouds), producing dense scene understanding that complements object detection.

### 7.2 Segmentation Tasks

Cruise's perception group performs semantic segmentation for multiple purposes:

**Road surface segmentation**:
- Identifies drivable road surface versus non-drivable areas (sidewalks, grass, buildings).
- Detects lane markings, crosswalks, stop lines, and other road paint.
- Distinguishes road types and surface conditions.

**Drivable area estimation**:
- Computes the **free space** -- the region in front of and around the vehicle where it is safe to drive.
- This is sometimes called "general obstacle detection" or "occupancy grid mapping."
- The drivable surface includes road, crosswalks, lane markings, and other traversable areas.

**Per-point LiDAR segmentation**:
- Each LiDAR point is classified as ground, vegetation, building, vehicle, pedestrian, or other semantic class.
- Ground segmentation separates drivable surface from above-ground obstacles.
- This feeds into road edge detection and curb detection.

**Object-level segmentation**:
- Instance segmentation distinguishes individual objects of the same class (e.g., separating adjacent pedestrians).
- Panoptic segmentation combines semantic (stuff) and instance (things) segmentation into a unified representation.

### 7.3 Architecture

Cruise's perception group develops deep learning-based approaches for semantic segmentation as one of the core tasks alongside 3D object detection, tracking, and classification. The shared multi-task backbone architecture allows segmentation heads to share features with detection heads, reducing total compute requirements.

For LiDAR-based segmentation, 3D point clouds are processed through the voxelized backbone, and per-voxel segmentation predictions are projected back to individual points. For camera-based segmentation, encoder-decoder architectures (in the style of U-Net or DeepLab) produce dense per-pixel predictions.

---

## 8. Occupancy Prediction

### 8.1 Occupancy Grid Mapping

Cruise employs occupancy-based representations as part of its environmental modeling. Occupancy Grid Maps (OGMs) divide the environment around the vehicle into a grid of cells, where each cell represents a specific spatial region and is associated with a probability value indicating the likelihood of occupancy.

### 8.2 BEV Representations

The Bird's Eye View (BEV) representation is a foundational component of modern AV perception. BEV provides a top-down view of the surroundings that simplifies geometric reasoning:

- Camera images from the 16-camera array are transformed from perspective view to BEV using learned view transformation modules or explicit geometric projection.
- LiDAR point clouds are naturally projected into BEV by collapsing the vertical dimension.
- Radar detections are placed directly into BEV coordinates.
- The unified BEV representation enables straightforward spatial reasoning for planning -- the planner operates in the same top-down coordinate system.

### 8.3 Voxel Representations

For full 3D scene understanding, Cruise's perception system extends beyond 2D BEV grids to 3D voxel representations:

- The 3D space around the vehicle is divided into a regular grid of voxels (3D pixels).
- Each voxel is classified as occupied, free, or unknown, with semantic labels assigned to occupied voxels.
- 3D voxel representations capture vertical structure (overpasses, traffic lights above, pedestrians below signs) that 2D BEV cannot represent.
- Vision-based 3D occupancy prediction -- predicting occupancy and semantic information of 3D voxel space from 2D camera images -- has emerged as a key capability in the autonomous driving industry.

### 8.4 Dynamic Occupancy

Beyond static occupancy, the system models **dynamic occupancy** -- how occupied regions evolve over time:

- Moving objects create temporal occupancy traces.
- Predicted future occupancy helps the planner anticipate where other agents will be.
- This bridges the gap between detection/tracking (which operates on individual objects) and the planning system (which needs to reason about where space will be occupied in the future).

---

## 9. Prediction System

### 9.1 ML-First Approach

Cruise adopted a **machine-learning-first strategy** for behavior prediction, explicitly rejecting rule-based approaches. The rationale, as stated by Cruise engineers, is that "people don't necessarily follow the rules of the road" -- rule-based systems cannot capture the full diversity of human behavior in urban environments.

San Francisco's urban density compounds this challenge: an AV driving the streets of San Francisco experiences a challenging situation **46 times more often** than in suburban areas.

### 9.2 Prediction Architecture

Cruise's prediction system forecasts the future trajectories of all detected agents (vehicles, pedestrians, cyclists) over multiple seconds into the future. The system handles:

**Multi-modal trajectory prediction**:
- For each agent, the system generates **multiple possible future trajectories** with associated probabilities.
- For example, a vehicle approaching an intersection might have a 30% probability of turning right, 30% left, and 40% going straight.
- Each probability is associated with a likely trajectory path, enabling the planner to reason about uncertainty.

**Intent prediction**:
- Beyond trajectory forecasting, the system predicts discrete behavioral intents (lane change, yielding, parking, U-turn).
- **Recurrent Neural Networks (RNNs)** are used for sequential analysis of agent behavior over time. For example, identifying a double-parked vehicle by analyzing sequential frames for brake lights, hazard indicators, distance from road edges, and contextual cues (vehicle type, construction activity nearby).

**Interaction modeling**:
- The prediction system models interactions between agents -- how one agent's behavior affects another's.
- This is critical for scenarios like merging, yielding, and negotiating right-of-way at intersections.
- Spatiotemporal features capture how agents influence each other's trajectories.

### 9.3 Input Features

The prediction models consume:

- **Agent trajectories**: Historical position, velocity, and heading from the tracker.
- **Map context**: Lane geometry, intersection topology, traffic signal states, speed limits from the HD map.
- **Agent attributes**: Vehicle type, size, current turn signal state.
- **Scene context**: Nearby agents, traffic density, road geometry.

### 9.4 Architecture Details

Cruise employs **recurrent and transformer-based architectures** for trajectory prediction:

- RNNs (LSTM variants) capture temporal sequences of agent states.
- Attention mechanisms model interactions between agents and between agents and map features.
- Graph-based representations encode the spatial relationships between agents and road topology.
- The output is a set of predicted trajectories with associated likelihoods, typically covering a 3--8 second prediction horizon.

### 9.5 Self-Supervised Training

The prediction system leverages a **self-supervised learning framework** that uses future perception output compared against current predictions to create training labels:

- At time T, the prediction model forecasts agent trajectories for times T+1 through T+N.
- At times T+1 through T+N, the perception system observes where the agents actually went.
- The discrepancy between predicted and observed trajectories provides a supervision signal.
- This eliminates the need for human annotation of prediction labels, enabling continuous improvement at scale.

### 9.6 Intersection Handling

Cruise uses a **purely learning-based approach** for complex intersection scenarios, where the prediction and planning systems jointly reason about the appropriate behavior without relying on hand-coded rules for each intersection type.

---

## 10. Continuous Learning Machine (CLM)

### 10.1 Overview

The **Continuous Learning Machine (CLM)** is Cruise's most significant ML innovation -- an automated, self-serving pipeline that addresses the "long tail" challenge in autonomous driving. The long tail refers to the vast number of rare, unusual, and potentially dangerous scenarios that an AV encounters infrequently but must handle correctly.

The CLM combines a **self-supervised framework for auto-labeling data** with an **active learning data mining framework** to create an entirely self-serving loop that addresses the data sampling challenge and scales to meet even the most challenging long-tail problems.

### 10.2 Three-Step CLM Process

**Step 1 -- Error Mining (Active Learning)**

- The system automatically monitors model performance across all fleet driving data.
- It identifies scenarios where there is a **significant difference between prediction and reality** -- cases where the model's prediction diverged substantially from what actually happened.
- Only these problematic scenarios are added to the training dataset, avoiding bloating the dataset with "easy" examples that the model already handles well.
- This enables **extremely targeted data mining**: the system automatically upsamples rare error cases, ensuring that no valuable training signal is missed.
- The goal is to upsample data from any and all error scenarios using an auto-labeled approach that can identify and mine all errors from models.

**Step 2 -- Self-Supervised Labeling**

- All of Cruise's prediction data is automatically labeled by the self-supervised framework.
- The framework uses **future perception output as "ground truth"** for all prediction scenarios.
- Example: If the AV predicts that the car in front will turn left at an upcoming intersection, but later observes it went straight, the system automatically creates a corrective training label by comparing the prediction against the future perception output -- no human input required.
- Fully automating this labeling step enables significant scale, cost, and speed improvements compared to manual annotation.
- The core CLM structure can be extended to other ML problems where a human annotator can fill in, but the fully automated approach provides the most benefit for scalable prediction improvement.

**Step 3 -- Model Training and Evaluation**

- New models are trained on the augmented dataset with the mined error cases.
- The models undergo extensive testing through dedicated metrics pipelines that ensure each new model **exceeds the performance of the previous model** and generalizes well to the nearly infinite variety of real-world scenarios.
- Only models that pass comprehensive evaluation are approved for deployment.
- The deployment process follows Cruise's standard release pipeline, which includes simulation testing, road testing, and safety validation.

### 10.3 Example Workflow

If the initial prediction model poorly handles U-turn situations:

1. The CLM automatically identifies U-turn error cases from fleet data (active learning / error mining).
2. These cases are automatically labeled using future perception output (self-supervised labeling).
3. The dataset representation of U-turns is grown, and the model is retrained.
4. The new model is tested to verify it handles U-turns sufficiently while maintaining performance on all other scenarios.
5. The process repeats continuously, addressing whatever error mode is most prevalent at any given time.

### 10.4 ML Infrastructure

The CLM is supported by substantial ML infrastructure:

- **Training compute**: Hundreds of GPU-years every month consumed for model training across all AV subsystems (perception, prediction, planning).
- **Cloud platform**: Google Cloud Vertex AI for training hundreds of models simultaneously.
- **Data processing**: The Terra platform (built on Apache Beam) handles dataset registration, lineage tracking, timestamp synchronization, windowing, automatic schema inference, data validation, and feature discovery.
- **Distributed training architecture**: Novel distributed application orchestration approaches enhance scale, fault tolerance, and coordination of the distributed training process.
- **ML Platform**: Led by Principal Software Engineer Alexander Sidorov, the platform covers distributed training, data processing and loading, orchestration, model deployment, and related areas. The architecture follows a "One Platform with clean system layers" design philosophy.
- **Training data scale**: 5+ million miles of real-world driverless driving data, generating petabytes of heterogeneous data including time series sensor readings, human-labeled data, images, videos, audio clips, 3D LiDAR point clouds, rasterized and vectorized maps, ML predictions, and external datasets.

### 10.5 Applicability Beyond Prediction

While the CLM was initially developed for the prediction system, its architecture is generalizable to other ML subsystems:

- **Perception**: Mining hard detection examples (missed objects, false positives) and automatically generating corrective labels.
- **Planning**: Identifying planning failures and generating training data for learning-based planners.
- **Any ML problem with a measurable discrepancy between prediction and ground truth**.

---

## 11. Traffic Light and Sign Detection

### 11.1 Complexity of Traffic Signal Recognition

Traffic light detection and classification is described by Cruise engineers as a particularly **complex** perception task. The challenge extends far beyond simple red/yellow/green classification:

| Dimension | Variability |
|---|---|
| Color states | Red, yellow, green, red+yellow, dark/off |
| Arrow directions | Left, right, straight, U-turn, diagonal |
| Patterns | Solid, flashing, protected turn, permissive |
| Physical form | Vertical, horizontal, single-head, multi-head, LED, incandescent |
| Environmental conditions | Sun glare, rain drops on lens, night brightness contrast, partially occluded |
| Relevance | Determining which signal applies to the AV's lane and direction of travel |

### 11.2 Detection Approach

Traffic light detection relies primarily on the **camera pipeline** with HD map assistance:

- The HD map provides the known locations and types of traffic signals along the planned route, enabling the perception system to focus attention on the expected regions of interest (ROI).
- Camera-based deep learning classifiers identify the signal state (color, arrow direction, flashing pattern) from image crops centered on the expected signal locations.
- Multiple cameras may observe the same traffic signal from different angles, providing redundant observations.
- LiDAR assists with localizing the signal's 3D position relative to the vehicle.

### 11.3 Traffic Sign Recognition

Stop signs, speed limit signs, construction zone warnings, and other regulatory and informational signs are detected through:

- Camera-based detection and classification using trained CNN models.
- HD map correlation: known sign locations from the map are matched against real-time camera detections to confirm presence and state.
- Anomaly detection for temporary signs not in the map (construction zones, detours).

---

## 12. Pedestrian and VRU Detection

### 12.1 Pedestrian Detection Architecture

Pedestrian detection is among the most safety-critical perception tasks. Cruise's system detects pedestrians using all three sensor modalities:

- **LiDAR**: Provides reliable 3D detection of pedestrians as clusters of points with characteristic height, width, and motion patterns. LiDAR is particularly important for urban driving where pedestrian detection is critical and cameras alone may miss pedestrians in low-light conditions.
- **Camera**: Provides visual classification, body pose estimation, and intent cues (direction of gaze, arm gestures). Camera-based pedestrian detectors benefit from large training datasets with high visual variety.
- **Radar**: Detects pedestrian motion through Doppler velocity signatures, providing a weather-robust backup modality.

### 12.2 Small VRU (Vulnerable Road User) Detection Limitations

Internal Cruise documents and reporting by The Intercept revealed significant limitations in Cruise's ability to detect children and other small VRUs:

**Lack of high-precision classifier**: Cruise's system lacked a "high-precision Small VRU classifier" -- dedicated machine learning software that would automatically detect child-shaped objects around the car and command appropriate cautious behavior.

**Training data scarcity**: Internal materials stated that Cruise had "low exposure to small VRUs" -- meaning very few recorded events involving children in the fleet data -- resulting in insufficient training examples to build and validate reliable child detection models.

**Behavioral modeling gaps**: The system could not adequately account for unpredictable child behaviors -- sudden separation from adults, falling, cycling erratically, or wearing costumes that alter their visual appearance.

**Simulation test results**: In simulated scenarios, Cruise engineers could not rule out that a fully autonomous vehicle might strike a child. One test showed a vehicle detecting a toddler-sized dummy but still striking it with its side mirror at 28 mph.

**Mitigation strategy**: Rather than solving the underlying detection problem, Cruise reduced daytime operations in San Francisco to limit exposure to children. Internal data suggested collision probability with children at roughly once every 300 million fleet miles, though this fell short of matching typical rideshare driver safety rates. Human workers manually identified children in footage where automated detection failed.

These limitations highlight a fundamental challenge in AV perception: the training data distribution is biased toward adult pedestrians in predictable locations, leaving gaps for small, unpredictable, or unusual VRUs.

### 12.3 Pedestrian Intent Prediction

Beyond detection, Cruise's perception system attempts to predict pedestrian behavior:

- Crossing intent: Whether a pedestrian at a curb intends to cross the street.
- Trajectory prediction: Where the pedestrian will move over the next several seconds.
- Group behavior: How groups of pedestrians move together.
- Contextual cues: Proximity to crosswalks, traffic signal state, pedestrian signal state.

---

## 13. Night and Adverse Weather Perception

### 13.1 Operational Conditions

Cruise initially operated only during nighttime hours (10pm--6am) in San Francisco before expanding to 24/7 operations in August 2023. The nighttime-first strategy was deliberate: lower traffic density provided a safer operational envelope, while the sensor suite's LiDAR and radar capability provided perception advantages over human drivers in darkness.

### 13.2 Night Perception

**LiDAR advantage**: LiDAR operates by emitting its own laser light and measuring reflections, making it inherently independent of ambient lighting. LiDAR performance is essentially identical in complete darkness as in daylight, providing a significant advantage over camera-only systems at night.

**Radar advantage**: Radar similarly operates independent of ambient lighting, providing range and velocity measurements in pitch-black conditions.

**Camera limitations**: Visible-spectrum cameras degrade significantly in low-light conditions. Cruise compensated through:
- High-sensitivity camera sensors optimized for low-light performance.
- Reliance on LiDAR and radar as primary perception modalities during night operations.
- The vehicle's own headlights providing some illumination for near-field camera perception.

### 13.3 Fog and Rain

San Francisco's frequent fog presented specific perception challenges:

**LiDAR degradation in fog**: Fog causes light scattering that reduces LiDAR range and introduces noise. In heavy fog, LiDAR systems experience "range degradation" -- a reduction in the distance at which objects can be reliably detected and classified. Water droplets scatter the laser beam, creating false returns and reducing the signal-to-noise ratio.

**LiDAR degradation in rain**: Rain similarly affects LiDAR through scattering and absorption. Raindrops can create spurious point cloud returns that must be filtered.

**Camera degradation**: Rain on the camera lens, reduced visibility, and reflections from wet road surfaces degrade camera perception performance.

**Radar robustness**: Radar operates effectively in rain, fog, and snow, making it the critical perception backbone in adverse weather. The articulating radar assemblies are especially valuable during these conditions, as they can scan for approaching vehicles where camera and LiDAR-based solutions fall short.

**Operational restrictions**: Cruise initially excluded heavy rain from its operational design domain. When expanded operations were approved in August 2023, the company's permits explicitly included foggy and rainy conditions, but the system's performance under these conditions remained a concern.

### 13.4 Storm Incidents

Practical adverse weather failures included:
- Following rainstorms, some Cruise cars stalled on city streets.
- Cameras and sensors failed to detect cables that had come down in a storm, with vehicles becoming entangled in them.
- Vehicles failed to properly detect and avoid caution tape and downed bus wires.

These incidents demonstrated gaps between the perception system's theoretical adverse-weather capability and its real-world performance in San Francisco's challenging conditions.

### 13.5 Sensor Fusion for Weather Robustness

The multi-modal sensor suite provides weather robustness through complementary degradation profiles:

| Condition | Camera | LiDAR | Radar |
|---|---|---|---|
| Clear day | Excellent | Excellent | Excellent |
| Night (dark) | Poor | Excellent | Excellent |
| Light rain | Moderate | Good | Excellent |
| Heavy rain | Poor | Degraded | Excellent |
| Fog | Moderate | Degraded | Excellent |
| Sun glare | Poor | Excellent | Excellent |
| Snow | Moderate | Degraded | Excellent |

Radar serves as the all-weather fallback, maintaining detection capability across all conditions where camera and LiDAR degrade.

---

## 14. Coordinate Frames and Spatial Representations

### 14.1 Coordinate Frame Hierarchy

Cruise's perception system operates across multiple coordinate frames:

**Sensor frames**: Each of the 42 sensors has its own native coordinate frame defined by its physical mounting position and orientation on the vehicle. Camera frames define pixel coordinates; LiDAR frames define 3D point positions relative to the sensor origin; radar frames define range-angle measurements from the radar antenna.

**Vehicle body frame**: A common reference frame fixed to the vehicle chassis, with origin typically at the rear axle center or the vehicle centroid. All sensor measurements are transformed into this frame using calibrated extrinsic parameters.

**Ego-centric frame**: The perception system processes data in an ego-centric reference frame centered on the AV. All detected objects are represented relative to the AV's current position and heading. This is the native frame for the perception-to-prediction-to-planning pipeline.

**Map frame**: A global coordinate frame (typically UTM or a local map coordinate system) used for localization and HD map alignment. The vehicle's pose in the map frame is determined by LiDAR-to-map matching.

**BEV frame**: A 2D top-down projection of the ego-centric 3D coordinate frame, used for occupancy grids, BEV feature maps, and planning representations.

### 14.2 Coordinate Transformations

Sensor fusion requires precise coordinate transformations between frames:

- **Extrinsic calibration** provides the rigid-body transforms (rotation and translation) between each sensor and the vehicle body frame.
- **Ego-motion compensation** corrects for vehicle motion during sensor acquisition intervals. For spinning LiDAR, points captured at different rotation angles correspond to different vehicle poses, requiring per-point motion compensation.
- **Temporal alignment** ensures that measurements from different sensors are referenced to the same time instant, accounting for sensor latency and clock synchronization.

### 14.3 BEV Representation

The BEV representation is central to Cruise's perception and planning pipeline:

- Camera features from all 16 cameras are transformed into a shared BEV grid through learned view transformation modules.
- LiDAR features are projected into BEV by collapsing the height dimension.
- Radar detections are placed directly into BEV coordinates.
- The unified BEV grid encodes both geometric (positions, shapes) and semantic (class labels, attributes) information.
- The planning system operates on this BEV representation, reasoning about trajectories in the same top-down coordinate system.

---

## 15. Non-ML Components

### 15.1 Sensor Calibration

Calibration is a foundational non-ML component that determines the quality of all downstream perception:

**Intrinsic calibration**:
- Camera intrinsic calibration determines focal length, principal point, and distortion coefficients for each camera.
- LiDAR intrinsic calibration accounts for beam timing, intensity calibration, and mechanical alignment of the spinning assembly.
- Radar intrinsic calibration determines antenna patterns and range calibration.

**Extrinsic calibration**:
- Determines the precise 3D position and orientation of each sensor relative to the vehicle body frame.
- Cruise's process involves confirming each sensor's actual position and orientation on the vehicle -- called "extrinsics."
- Small differences due to manufacturing, shipping, placement, and road vibration cause deviations between expected and actual extrinsics.
- An accurate and efficient calibration process is essential for sensor fusion to combine information from different sensors correctly.

**Simulation-based calibration development**:
- Cruise uses simulation to virtually calibrate vehicles and accelerate calibration development.
- The Sensor Placement Tool enables engineers to evaluate calibration setups needed for proper sensor calibration without relying on physical hardware.
- Once a sensor setup is selected, calibration is performed on the physical vehicle before road deployment.
- Cruise has accurately modeled camera field of view and distortion, radar field of view, range and point cloud distribution, and LiDAR beam distribution and intensity in simulation, with simulated sensors refined through rigorous comparison against real-world sensor data.

### 15.2 Sensor Preprocessing

Before data enters the ML perception pipeline, several classical preprocessing steps are applied:

**LiDAR preprocessing**:
- Motion compensation: Correcting for vehicle ego-motion during the LiDAR scan.
- Ground removal: Classical algorithms (RANSAC plane fitting, height thresholding) separate ground points from above-ground points.
- Noise filtering: Removing spurious returns, multi-path reflections, and weather-induced noise.
- Range gating: Excluding returns beyond the reliable detection range.

**Camera preprocessing**:
- Lens distortion correction using calibrated distortion coefficients.
- Exposure normalization and white balance adjustment.
- Image rectification for stereo or multi-camera geometry.

**Radar preprocessing**:
- Clutter filtering: Removing ground clutter, multi-path returns, and interference.
- CFAR (Constant False Alarm Rate) detection: Classical signal processing to extract target detections from the radar return spectrum.
- Doppler processing: Extracting velocity information from frequency shifts.

### 15.3 Localization

Cruise's localization system is a critical non-ML component that determines the vehicle's precise pose (position and orientation) in the map frame:

- **LiDAR-to-map matching**: The vehicle scans its surroundings with LiDAR and compares the resulting point cloud against the pre-built HD map to determine position with centimeter-level accuracy.
- This approach is essential in urban environments like San Francisco where tall buildings create GPS "urban canyons" that degrade satellite-based positioning.
- Map-based localization provides a stable reference frame for all perception outputs and frees compute resources that would otherwise be spent on environmental understanding.

### 15.4 Time Synchronization

Precise time synchronization across all 42 sensors is critical:

- Hardware clock synchronization using PTP (Precision Time Protocol) or similar mechanisms.
- Software timestamp alignment accounting for sensor-specific latencies.
- Phase locking between LiDAR rotation and camera frame capture.

### 15.5 Sensor Health Monitoring

Runtime monitoring of sensor health ensures perception integrity:

- Self-diagnostic checks for each sensor (communication, data quality, operating parameters).
- Graduated response to sensor degradation (continue with reduced capability, pull over if critical sensors fail).
- The ARA system exemplifies this with monitoring of communication loss, voltage irregularities, temperature deviations, and excessive operating currents.

---

## 16. Auto-Labeling and Training Data

### 16.1 Scale of Data Collection

Cruise's fleet generates massive volumes of training data:

- **5+ million miles** of real-world driverless driving data.
- **Petabytes** of heterogeneous data including sensor time series, images, videos, audio, 3D point clouds, maps, and ML predictions.
- The data pipeline processes approximately **50 TB daily** using thousands of CPU cores and hundreds of GPUs.
- A few hundred engineers process exabytes of data across more than 20 million queries every month.

### 16.2 Auto-Labeling System

Cruise's auto-labeling system is a core competitive advantage that reduces dependence on manual human annotation:

**Self-supervised prediction labeling**:
- The CLM's self-supervised framework generates prediction labels automatically by comparing predictions at time T against perception observations at times T+1 through T+N.
- No human annotators are required for prediction training data.

**Perception auto-labeling**:
- Automated systems generate 3D bounding box labels from offline processing of LiDAR, camera, and radar data.
- Offline processing can use more compute-intensive algorithms (multi-frame accumulation, backward-looking temporal context) to produce higher-quality labels than real-time online processing.
- Auto-labeling reduces manual annotation costs by approximately **90%**.

**AI-based event extraction**:
- Advanced AI systems automatically label and tag many different classes of events from fleet driving data.
- Automation was necessary because at Cruise's scale, manual event identification was infeasible.

### 16.3 Data Processing Platform: Terra

Cruise built **Terra**, a custom data processing platform extending the Apache Beam SDK:

- Handles dataset registration, lineage tracking, timestamp synchronization, windowing, automatic schema inference, data validation, and feature discovery.
- Provides standard connectors to diverse data stores: raw car data, labeled data, map data, operational data.
- Improved feature engineering pipeline runtime by up to **100x**.
- Weekly usage: 70+ unique users submitting 2,000+ jobs.

### 16.4 Human-in-the-Loop for Edge Cases

Despite extensive auto-labeling, human annotators remain involved for:

- Validating auto-generated labels for quality assurance.
- Labeling novel object classes not covered by existing auto-labeling models.
- Resolving ambiguous cases where auto-labeling confidence is low.
- Manually identifying children in footage where automated detection failed (as documented in the small VRU detection limitations).

---

## 17. Key Papers and Technical Publications

### 17.1 Cruise Engineering Blog (Medium)

Cruise maintained an active engineering blog at **medium.com/cruise** with notable perception-relevant publications:

| Publication | Author(s) | Topic |
|---|---|---|
| "How We're Solving the LIDAR Problem" | Kyle Vogt | Strobe acquisition rationale, FMCW LiDAR advantages, sensor fusion philosophy |
| "Cruise's Continuous Learning Machine" | Sean Harris | CLM architecture, self-supervised labeling, active learning for prediction |
| "The Decision Behind Using Articulating Sensors on Cruise AVs" | JM Fischer | ARA design, embedded systems, servo control, radar integration |
| "How Cruise Uses Simulation to Speed Up Sensor Development" | Rico Stenson | Sensor Placement Tool, virtual calibration, sensor-in-the-loop simulation |
| "Introducing Terra" | Emmanuel Turlay | Custom data processing platform on Apache Beam |
| "Building a Container Platform at Cruise" | Karl Isenberg | Kubernetes-based PaaS architecture |
| "Data Warehousing for AV Simulation Analysis" | -- | Simulation data infrastructure with Avro tables |
| "3 Ways Cruise HD Maps Give Our Self-Driving Vehicles an Edge" | -- | HD mapping, LiDAR-to-map localization |

### 17.2 Conference Presentations

| Venue | Speaker | Topic |
|---|---|---|
| **MLconf** | Alexander Sidorov (Principal SWE, ML Platform) | "ML Infrastructure for Autonomous Vehicles @ Cruise" -- distributed training architecture, data processing, CLM, One Platform design |
| **MLconf** | -- | "Predicting the Unpredictable with Cruise's Continuous Learning Machine" -- CLM deep dive, self-supervised learning, active learning |
| **Google Cloud Next '19** | -- | "How to Run Millions of Self-Driving Car Simulations on GCP" |
| **At Scale Conference** | Alexander Sidorov | ML infrastructure for autonomous vehicles -- distributed data processing and training |
| **HashiCorp events** | -- | Terraform and Cruise case study |

### 17.3 Academic Output

Unlike Waymo, which has published extensively at CVPR, NeurIPS, ICCV, and ICRA, Cruise published comparatively fewer academic papers at major ML and robotics venues. Cruise's technical contributions were channeled primarily through:

- Engineering blog posts with practical implementation details.
- Conference talks at industry-focused venues (MLconf, At Scale, Google Cloud Next).
- Patent filings covering novel perception and planning approaches.

Former Cruise Head of Computer Vision **Peter Gao** described the perception problem as inherently challenging and unpredictable, reflecting the company's focus on practical engineering solutions over academic publication.

### 17.4 Key Research Personnel

| Name | Role | Area |
|---|---|---|
| Alexander Sidorov | Principal SWE, ML Platform TL | Distributed training, data processing, model deployment |
| Peter Gao | Head of Computer Vision | Camera perception, 3D detection |
| Carl Jenkins | VP Hardware | Sensor hardware, compute architecture |
| Brendan Hermalyn | Director, Autonomous Hardware Systems | Sensor systems integration |
| Sean Harris | (Blog author) | Prediction system, CLM |
| JM Fischer | Embedded Systems | Articulating radar, sensor-hardware interface |
| Rico Stenson | Sensor Development | Sensor simulation, Sensor Placement Tool |
| Emmanuel Turlay | Data Infrastructure | Terra platform |

---

## 18. Key Patents

### 18.1 Patent Portfolio Overview

GM Cruise Holdings LLC has been assigned approximately **79+ patents** covering the full autonomy stack. Perception-relevant patents span multiple categories:

### 18.2 Perception Patents

| Patent Area | Description |
|---|---|
| **Adverse weather perception** | Systems for determining how the perception stack of an autonomous vehicle responds to adverse weather conditions. Patents cover simulating features like water, snow, or ice and evaluating perception stack response. |
| **Camera calibration** | Systems for correcting lens distortion in onboard camera systems, ensuring accurate extrinsic and intrinsic calibration for multi-camera perception. |
| **Sensor event detection and fusion** | Methods for detecting events from multiple sensor modalities and fusing the detections into a unified representation (US Patent 10,802,450, issued October 2020). |
| **LiDAR detection and ranging** | A LiDAR sensor array incorporating a laser array, detector array, transmitting lens, receiving lens, and a linear resonant actuator arranged to oscillate portions of the LiDAR sensor (US Patent 11,604,258 B2, published March 2023). Inventors include Nathaniel W. Hart, Michelle M. Clem, Adam L. Wright, and Tzvi Philipp. |
| **Vision-based ML with adjustable virtual camera** | A vision-based machine learning model for autonomous driving with an adjustable virtual camera, enabling flexible viewpoint generation for perception training (US Patent Application 20230057509A1). |

### 18.3 Planning and Prediction Patents

| Patent Area | Description |
|---|---|
| **Path planning** | Searching for and updating optimal plans from a current pose to an end pose while avoiding obstacles. |
| **Fallback path planning** | Handling degraded operating conditions with failover path planners for minimal risk condition scenarios. |
| **Behavior prediction** | Systems for predicting behaviors of detected objects based on multi-sensor perception inputs. |
| **Adaptive dispatch** | Adaptive dispatch systems for autonomous vehicle fleet management. |

### 18.4 Simulation and Testing Patents

| Patent Area | Description |
|---|---|
| **Stress testing** | Purposeful stress testing of autonomous vehicle response time using simulation. |
| **Adverse weather simulation** | Simulating adverse weather features and evaluating perception stack responses. |
| **Sensor simulation** | Accurately modeling camera, radar, and LiDAR sensor characteristics for virtual testing. |

### 18.5 Fleet and Operations Patents

| Patent Area | Description |
|---|---|
| **Fleet parking** | Real-time autonomous vehicle fleet parking availability determination using perception sensors. |
| **Vehicle cleanliness** | Systems for maintaining cleanliness of autonomous fleet vehicles. |

---

## 19. Perception Failures and Incident Analysis

### 19.1 October 2, 2023: Pedestrian Dragging Incident

This is the most consequential perception failure in Cruise's history and arguably in the history of autonomous vehicles commercially deployed.

**Sequence of events**:
1. A human-driven vehicle traveling adjacent to the Cruise AV struck a pedestrian.
2. The pedestrian was propelled across the human-driven vehicle and onto the ground in the immediate path of the Cruise AV, nicknamed "Panini."
3. The Cruise AV biased rightward and braked aggressively but made contact with the pedestrian at **18.6 mph** -- approximately 0.78 seconds after the pedestrian entered the AV's path.
4. The AV came to an initial brief stop after impact.

**Collision Detection Subsystem failure**:
5. The Collision Detection Subsystem **misidentified the pedestrian's location at impact** -- it incorrectly identified the pedestrian as being located on the side of the AV rather than in front of it.
6. This caused the system to **inaccurately characterize the collision as a lateral (side) collision** rather than a frontal collision.
7. For a lateral collision, the AV's programmed response was to execute a pull-over maneuver (moving to the curb and stopping). For a frontal collision involving a pedestrian, the correct response would have been to remain stationary.

**Post-collision dragging**:
8. The AV's software commanded a pull-over maneuver, moving forward at up to **7.7 mph**.
9. The pedestrian was trapped underneath the vehicle and was dragged approximately **20 feet**.
10. The wheel-speed sensor eventually detected anomalous behavior (wheels moving at different speeds due to pedestrian contact), triggering an early stop at 20 feet rather than the programmed 100-foot pull-over distance.
11. The AV came to a stop with a tire resting on the pedestrian's leg, pinning her beneath the vehicle.

**Root causes**:
- The inaccuracy of the object track used by the collision detection system -- the tracked position of the pedestrian diverged from her actual position.
- The collision detection system could not recognize a pedestrian positioned low on the ground in the path of the AV.
- The system lacked what Dan Luu's analysis described as "scene understanding" -- the ability to recognize that a collision happening in an adjacent lane should prompt a defensive stop, a capability that human drivers typically exhibit.

**NHTSA Recall 23E-086** (filed November 7, 2023): Affected 950 ADS units. The defect was described as: "In certain circumstances, a collision may occur, after which the Collision Detection Subsystem may cause the Cruise AV to attempt to pull over out of traffic instead of remaining stationary when a pullover is not the desired post-collision response."

**Software fix**: The update improved the subsystem's ability to recognize when a person is down or low on the roadway and to determine that pulling over is not the appropriate post-collision response. Cruise estimated that a similar collision with risk of serious injury could recur every 10 million to 100 million miles prior to the fix.

### 19.2 Unexpected Hard Braking (NHTSA Investigation PE23018)

The second major perception-related failure mode involved unexpected hard braking:

**Investigation scope**: NHTSA examined **7,632 hard-braking events** involving Cruise vehicles, starting in December 2022.

**Root causes identified**:
1. **Inaccurate predictions of other vehicles' paths**: The prediction system misinterpreted the trajectories of nearby vehicles, causing the AV to perceive a collision threat that did not exist.
2. **Sensor interference from nearby cars**: Proximity of other vehicles corrupted the perception system's ability to accurately detect its environment.
3. The ADS could command an unexpected braking maneuver when a vehicle or cyclist suddenly approached from the rear -- a perception/prediction failure in handling close-following road actors.

**Crash data**: 10 crashes attributed to Cruise vehicles, with four resulting in injuries. Three rear-end collisions occurred when the Cruise ADS initiated a hard braking maneuver in response to a road user approaching from the rear.

**Software fix**: Cruise deployed software updates that improved perception, prediction, and planning capabilities. The company stated that after the updates, hard-braking rates were "much lower than a human driver." The fix was completed during the operations pause between October 26, 2023 and May 13, 2024.

**NHTSA Recall 23V-838**: Affected 1,194 vehicles (entire fleet). NHTSA closed its investigation in August 2024 following the recall.

### 19.3 Bus Collision (April 2023)

Cruise recalled 300 robotaxis and issued a software update after a Cruise vehicle collided with a San Francisco city bus. The incident involved a perception or prediction failure in detecting and yielding to a large transit vehicle.

### 19.4 Environmental Perception Failures

**Storm-related incidents (March 2023)**:
- Following a storm that downed trees and power lines, Cruise robotaxis blocked a road in San Francisco.
- Vehicle cameras and sensors failed to detect fallen cables and caution tape, with vehicles becoming entangled in the wires.
- This demonstrated that the perception system's training data did not adequately cover post-storm urban environments with unusual obstacles.

**Outside Lands Music Festival (August 2023)**:
- Multiple AVs stalled throughout San Francisco as festival attendees left the event.
- Cruise attributed the issue to wireless bandwidth constraints from the large crowd, which caused delayed connectivity to the vehicles. However, the incident also exposed the system's dependence on cloud connectivity and the perception system's difficulty with large crowds.

**Traffic blocking incidents**:
- Multiple incidents of Cruise vehicles blocking intersections, entering wet concrete at construction sites, and congregating in groups that blocked streets.
- These incidents reflect perception failures in recognizing and responding to novel urban situations (construction zones, unusual road conditions, traffic flow anomalies).

### 19.5 Reporting Failures

Beyond the perception failures themselves, Cruise's response compounded the crisis:
- Two NHTSA crash reports omitted the post-crash dragging details from the October 2023 incident.
- Cruise initially showed regulators a truncated video that excluded the dragging portion.
- Cruise admitted to submitting a false report to influence a federal investigation and paid a $500,000 criminal fine.
- This destroyed regulatory trust and was a primary factor in the CA DMV's permit suspension and Cruise's subsequent collapse.

---

## 20. Legacy for GM

### 20.1 Technology Transfer

Following GM's December 2024 decision to end Cruise's robotaxi program and the February 2025 absorption of Cruise into GM, Cruise's perception technology is being redirected toward GM's consumer autonomous driving systems.

**Assets transferred to GM**:
- Multimodal perception systems trained on 5+ million driverless miles
- AI/ML models and the Continuous Learning Machine pipeline
- Simulation framework (20+ billion simulated miles)
- Sensor fusion expertise and Strobe FMCW LiDAR intellectual property
- Patent portfolio (79+ patents)
- Cloud infrastructure and data processing pipelines

### 20.2 Super Cruise Evolution

GM's consumer autonomous driving roadmap leverages Cruise perception technology:

| System | Status | Perception Technology |
|---|---|---|
| **Super Cruise** (current) | Production since 2018 | Camera, radar, GPS; HD maps built with LiDAR but no onboard LiDAR. 700+ million hands-free miles, zero reported crashes. Available on 23 vehicle models. |
| **Enhanced Super Cruise** (2026 MY) | In development | Google Maps integration; automatic transition between steering assist and hands-free modes. |
| **Eyes-Off Super Cruise** (target 2028) | In development | **Adds onboard LiDAR** for the first time in a GM consumer vehicle. Lidar bump visible on roof. Enables SAE Level 3 eyes-off, hands-off driving. Debuts on Cadillac Escalade IQ. |
| **Hyper Cruise** (trademark filed) | Future | GM filed a trademark for "Hyper Cruise" -- likely the branding for the fully autonomous driving system incorporating Cruise's full perception stack. |

### 20.3 Sensor Fusion Integration

GM's next-generation autonomous driving system adopts Cruise's sensor fusion philosophy:

- **Multi-sensor redundancy**: Unlike vision-only approaches, GM's system uses LiDAR + radar + cameras, directly inheriting Cruise's triple-modality strategy.
- **Sensor fusion at the core**: LiDAR, radar, and cameras build the perception layer; real-world driving data trains the decision-making model; high-fidelity simulation validates performance across rare scenarios.
- **LiDAR supplier undisclosed**: GM has not publicly identified the LiDAR supplier for the eyes-off system. The Strobe FMCW LiDAR IP acquired through Cruise may inform the sensor selection, though GM may also use commercial LiDAR from suppliers like Cepton (which supplied earlier GM Ultra Cruise prototypes) or others.

### 20.4 Simulation and Validation

GM is applying Cruise's simulation infrastructure to validate the consumer autonomous driving system:

- Millions of high-fidelity closed-loop simulations run daily, equivalent to more than 10,000 times the daily time spent by an average U.S. driver.
- Simulations test interactions between the AI model, the car, actors in the scene, and the physical world.
- Scenarios are drawn from millions of miles of real-world driving data, national crash databases, and academic research.
- Engineers can replay actual events, modify real-world data to create new virtual scenarios, or design entirely new test scenarios from scratch.
- Each mile of real-world testing generates millions of data points capturing shadow effects, sensor performance variations, and behavioral scenarios.

### 20.5 Current Testing (2025--2026)

- GM is using Cruise Bolt AVs and other vehicles equipped with LiDAR on select highways in Michigan, Texas, and the San Francisco Bay Area.
- Vehicles are driven by trained human drivers (not driverless) while collecting data and running shadow-mode perception.
- Testing focuses on developing simulation models and advancing driver-assistance systems.
- Data collection vehicles include Cadillac Escalade IQ and GMC Yukon SUVs gathering driving data from across the U.S.
- Sterling Anderson (former Tesla Autopilot chief) leads GM's autonomous driving development, bringing additional perception system expertise.

### 20.6 Industry Significance

Cruise's perception stack represents one of the most extensively developed and tested urban AV perception systems ever built. Despite the company's collapse, the technology has significant value:

- **5+ million driverless miles** of real-world perception data in the most challenging urban environment (San Francisco).
- **42-sensor fusion** expertise that few organizations have matched.
- **Continuous Learning Machine** -- a production-proven automated ML pipeline for addressing long-tail perception challenges.
- **Comprehensive failure data** -- the detailed analysis of perception failures (pedestrian dragging, hard braking, weather degradation, child detection gaps) provides invaluable safety engineering lessons.

GM's $12.1 billion investment in Cruise, while it did not produce a viable robotaxi business, generated perception technology and lessons that are now being channeled into what could become the largest-scale deployment of advanced autonomous driving technology on consumer vehicles. The transition from L4 robotaxi perception to L2+/L3 consumer ADAS perception represents a fundamental shift in how Cruise's technical legacy will reach the public.

---

## Sources

- [Cruise Automation -- A Self-Driving Car Startup (ThinkAutonomous)](https://www.thinkautonomous.ai/blog/cruise-self-driving-car/)
- [How We're Solving the LIDAR Problem -- Kyle Vogt (Cruise Medium)](https://medium.com/cruise/how-were-solving-the-lidar-problem-8b4363ff30db)
- [Cruise's Continuous Learning Machine (Cruise Medium)](https://medium.com/cruise/cruise-continuous-learning-machine-30d60f4c691b)
- [The Decision Behind Using Articulating Sensors on Cruise AVs (Cruise Medium)](https://medium.com/cruise/cruise-embedded-systems-articulating-radars-7cae24642930)
- [Articulating Sensors on Cruise AVs (SelfDrivingCars360)](https://www.selfdrivingcars360.com/the-decision-behind-using-articulating-sensors-on-cruise-avs/)
- [Notes on Cruise's Pedestrian Accident (Dan Luu)](https://danluu.com/cruise-report/)
- [GM Cruise Snaps Up Solid-State Lidar Pioneer Strobe Inc (IEEE Spectrum)](https://spectrum.ieee.org/gm-cruise-snaps-up-solidstate-lidar-pioneer-strobe-inc)
- [Cruise Knew Its Self-Driving Cars Had Problems Recognizing Children (The Intercept)](https://theintercept.com/2023/11/06/cruise-self-driving-cars-children/)
- [ML Infrastructure for Autonomous Vehicles @ Cruise (MLconf)](https://mlconf.com/sessions/ml-infrastructure-for-autonomous-vehicles-cruise/)
- [Predicting the Unpredictable with Cruise's CLM (MLconf)](https://mlconf.com/sessions/predicting-the-unpredictable-with-cruises-continuous-learning-machine/)
- [NHTSA Consent Order with Cruise](https://www.nhtsa.gov/press-releases/consent-order-cruise-crash-reporting)
- [NHTSA Recall Report 23E-086](https://static.nhtsa.gov/odi/rcl/2023/RMISC-23E086-4326.pdf)
- [NHTSA Investigation Close Resume PE23018](https://static.nhtsa.gov/odi/inv/2023/INCLA-PE23018-11022.pdf)
- [Cruise Recalls Robotaxi Fleet (TechCrunch)](https://techcrunch.com/2024/08/22/cruise-recall-av-fleet-nhtsa-probe-closed/)
- [Cruise Recalls Entire Fleet After Pedestrian Dragging (TechCrunch)](https://techcrunch.com/2023/11/08/cruise-recalls-entire-fleet-after-robotaxi-ran-over-dragged-pedestrian/)
- [GM's Cruise Recalls Nearly 1,200 Vehicles (EV.com)](https://ev.com/news/gms-cruise-recalls-nearly-1200-autonomous-vehicles-amid-safety-concerns)
- [Cruise Pedestrian Safety Software Patch (The Register)](https://www.theregister.com/2023/11/08/cruise_selfdriving_software_update/)
- [Inside GM Cruise: What Really Happened (Fortune)](https://fortune.com/2024/05/16/inside-gm-cruise-self-driving-car-accident-san-francisco-what-really-happened/)
- [Cruise Robotaxis Blocked Road After Storm (CNBC)](https://www.cnbc.com/2023/03/22/cruise-robotaxis-blocked-a-road-in-san-francisco-after-storm.html)
- [GM's Super Cruise Eyes-Off with LIDAR by 2028 (InsideEVs)](https://insideevs.com/news/776525/gm-super-cruise-eyes-off-2028/)
- [GM's Path to Full Autonomy (GM News)](https://news.gm.com/home.detail.html/Pages/topic/us/en/2025/oct/1009-GMs-path-full-autonomy-Building-trust-step-by-step.html)
- [GM to Launch Eyes-Off Driving (GM News)](https://news.gm.com/home.detail.html/Pages/news/us/en/2025/oct/1022-AI-GM-launch-eyes-off-driving-conversational-AI.html)
- [GM Autonomous Driving Tech May Be Called Hyper Cruise (GM Authority)](https://gmauthority.com/blog/2025/06/gm-autonomous-driving-tech-may-be-called-hyper-cruise/)
- [GM Files Patent for LiDAR System (GM Authority)](https://gmauthority.com/blog/2023/03/gm-files-patent-for-lidar-system/)
- [How Cruise Uses Machine Learning (GM Authority)](https://gmauthority.com/blog/2020/09/how-cruise-uses-machine-learning-to-predict-the-unpredictable/)
- [Introducing Terra -- Cruise's Data Processing Platform (Cruise Medium)](https://medium.com/cruise/introducing-terra-cruises-data-processing-platform-c6a476bb5b72)
- [How Cruise Uses Simulation for Sensor Development (Cruise Medium)](https://medium.com/cruise/cruise-simulation-sensor-development-be57a5991fe6)
- [How Cruise Tests Its AVs on Google Cloud (Google Cloud Blog)](https://cloud.google.com/blog/products/containers-kubernetes/how-cruise-tests-its-avs-on-a-google-cloud-platform)
- [Cruise Safety Report 2022 (PDF)](https://assets.ctfassets.net/95kuvdv8zn1v/zKJHD7X22fNzpAJztpd5K/ac6cd2419f2665000e4eac3b7d16ad1c/Cruise_Safety_Report_2022_sm-optimized.pdf)
- [Patents Assigned to GM Cruise Holdings LLC (Justia)](https://patents.justia.com/assignee/gm-cruise-holdings-llc)
- [Cruise DOJ Settlement (DOJ)](https://www.justice.gov/usao-ndca/pr/cruise-admits-submitting-false-report-influence-federal-investigation-and-agrees-pay)
- [Cruise Co-Founder Vogt on LiDAR SPACs (The Robot Report)](https://www.therobotreport.com/cruise-co-founder-vogt-on-lidar-spacs/)
- [Cruise Wikipedia](https://en.wikipedia.org/wiki/Cruise_(autonomous_vehicle))
