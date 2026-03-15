# Pony.ai Perception Stack: Exhaustive Technical Deep Dive

> Last updated: March 15, 2026

---

## Table of Contents

1. [Dual Perception Architecture](#1-dual-perception-architecture)
2. [Sensor Fusion](#2-sensor-fusion)
3. [LiDAR Perception](#3-lidar-perception)
4. [Camera Perception](#4-camera-perception)
5. [Radar Perception](#5-radar-perception)
6. [3D Object Detection](#6-3d-object-detection)
7. [Object Tracking](#7-object-tracking)
8. [Prediction System](#8-prediction-system)
9. [Semantic Segmentation](#9-semantic-segmentation)
10. [Occupancy Representations](#10-occupancy-representations)
11. [Traffic Infrastructure Detection](#11-traffic-infrastructure-detection)
12. [PonyWorld Perception](#12-ponyworld-perception)
13. [Perception for Trucking (PonyTron)](#13-perception-for-trucking-ponytron)
14. [Sensor Cost Reduction](#14-sensor-cost-reduction)
15. [Domestic GPU Adaptation](#15-domestic-gpu-adaptation)
16. [Auto-Labeling](#16-auto-labeling)
17. [Calibration](#17-calibration)
18. [Key Patents](#18-key-patents)
19. [Key Publications](#19-key-publications)
20. [Perception for Chinese Road Conditions](#20-perception-for-chinese-road-conditions)

---

## 1. Dual Perception Architecture

### Overview

Pony.ai's Perception module is architected around a **dual-path design** that runs a heuristic (rule-based / classical) perception pipeline in parallel with a deep-learning perception pipeline. This is not a simple ensemble -- it is a safety-critical architectural decision rooted in ISO 26262 functional safety methodology and the company's core safety principle:

- **Single-point failure**: The vehicle can *continue to operate safely*.
- **Dual-point failure**: The vehicle can *park safely* (minimal risk condition).

### Heuristic Perception Path

The heuristic path uses classical algorithmic approaches to perception:

| Component | Approach |
|---|---|
| **Point cloud clustering** | Geometric segmentation, ground plane estimation, connected-component clustering |
| **Rule-based detection** | Bounding box fitting from clustered point clouds using principal component analysis and model fitting |
| **Geometric tracking** | Kalman filtering and nearest-neighbor data association |
| **Lane / boundary detection** | Edge detection, Hough transforms, model fitting on LiDAR ground returns and camera images |

Advantages of the heuristic path:

- **Predictable behavior**: No opaque neural network failure modes; failures are deterministic and analyzable.
- **No training data dependency**: Functions without requiring labeled datasets or GPU-intensive training.
- **Complementary failure modes**: When deep learning models fail (e.g., novel objects, adversarial conditions, distribution shift), the heuristic path may still produce valid detections.
- **Low-latency fallback**: Can serve as a fast fallback when DNN inference is delayed or degraded.

### Deep Learning Perception Path

The deep learning path uses multi-modal neural networks for high-accuracy perception:

| Component | Approach |
|---|---|
| **3D object detection** | Multi-modal DNNs operating on LiDAR point clouds and camera images, producing 3D bounding boxes with class labels and confidence scores |
| **Semantic segmentation** | Pixel-level and point-level classification of road surfaces, lane markings, drivable areas |
| **Instance segmentation** | Per-object masks combining LiDAR and camera modalities (covered by US Patent 11,250,240) |
| **Tracking** | Learned feature extraction for data association, deep-learning-enhanced state estimation |
| **Traffic element recognition** | CNN-based classification of traffic lights, signs, and signals |

Advantages of the deep learning path:

- **Higher accuracy**: Significantly outperforms heuristic methods on standard benchmarks for detection and classification.
- **Richer representations**: Produces dense semantic understanding, not just geometric primitives.
- **Generalization**: Learns to detect novel object appearances and handles greater visual diversity.

### Fusion of Dual Paths

The outputs of both paths are fused through an arbitration layer that:

1. Cross-validates detections between the two paths -- objects detected by both paths receive high confidence.
2. Flags discrepancies for downstream modules -- if one path detects an object the other misses, the system treats it conservatively (assumed present).
3. Provides **perception redundancy** -- even if the entire deep learning inference pipeline fails (GPU crash, model NaN, timeout), the heuristic path provides baseline perception to safely bring the vehicle to a stop.

This dual-path architecture is one of Pony.ai's **seven types of software system redundancy** documented in its safety architecture, alongside redundancies in localization, planning, control, and monitoring.

### Operational Modes

Pony.ai operates in three degradation levels:

| Mode | Condition | Perception Capability |
|---|---|---|
| **Normal Operation** | All systems healthy | Full dual-path perception, multi-sensor fusion |
| **Degraded Safe Mode** | Single-point failure (e.g., one LiDAR offline, DNN inference failure) | Reduced capability, heuristic path + remaining sensors maintain safe operation |
| **Minimal Risk Condition** | Dual-point failure (e.g., multiple sensor failures) | Emergency perception via MRCC (Minimum Risk Condition Controller), vehicle executes safe stop |

The MRCC maintains critical perception including blind-spot coverage and basic obstacle detection even when the main compute system has failed, using the redundant system to ensure safe vehicle control.

---

## 2. Sensor Fusion

### Gen-7 Sensor Suite Architecture

The 7th-generation robotaxi employs **34 sensors across six categories**, representing the most comprehensive sensor suite Pony.ai has deployed:

| Category | Count | Specifications |
|---|---|---|
| **LiDAR** | 9 | 4x Hesai AT128 (roof, 360-degree primary perception) + 5x near-range LiDAR (body-mounted, blind-spot coverage) |
| **Cameras** | 14 | 8-megapixel sensors; combination of wide-angle, super-wide-angle, mid-range, long-range, and traffic light detection cameras |
| **Millimeter-wave Radar** | 4 | 4D imaging millimeter-wave radar for velocity and range measurement |
| **Microphones** | 4 | Acoustic perception for emergency vehicles, horns, and ambient sound |
| **Water Sensors** | 2 | Detect precipitation for weather-aware perception adaptation |
| **Collision Sensor** | 1 | Impact detection for post-collision safety response |

**Combined capabilities:**
- 360-degree blind-spot-free coverage
- Detection range up to **650 meters**
- Six types of mass-production automotive-grade sensors

### Sensor Configuration Evolution

| Generation | Total Sensors | LiDAR | Cameras | Radar | Other | Key Change |
|---|---|---|---|---|---|---|
| Gen-5 and earlier | Variable | Mechanical spinning LiDAR (central) + near-range | 11 | 5 | -- | Mechanical LiDAR, large rooftop assembly |
| Gen-6 (2022) | 23 | 4 solid-state (roof) + 3 near-range (body) | 11 | 5 (4 short-range + 1 long-range) | -- | Eliminated central mechanical LiDAR; solid-state transition |
| Gen-7 (2025) | 34 | 4 AT128 (roof) + 5 near-range (body) | 14 | 4 (4D imaging) | 4 mic + 2 water + 1 collision | 68% LiDAR BOM reduction; 8MP cameras; 4D imaging radar; acoustic/weather sensing |

### Fusion Architecture

Pony.ai's sensor fusion operates at multiple levels within the perception pipeline:

#### Data-Level Processing

All raw sensor data flows through a synchronized processing pipeline:

```
Raw Sensor Streams (LiDAR packets, camera frames, radar returns)
    |
    v
Upstream Synchronization Module
(nanosecond-level time sync across all sensors)
    |
    v
Data Encapsulation (protobuf messages with GPU-resident payloads)
    |
    v
Downstream Perception Modules
(segmentation, classification, detection -- both heuristic and DNN)
```

The upstream synchronization module is critical: it collects raw sensor packets, applies time synchronization across modalities, and packages data into messages consumed by downstream perception algorithms. This module was originally FPGA-based, then migrated to NVIDIA DRIVE Orin SoC for production.

#### Feature-Level Fusion

Multiple sensor modalities contribute features to a shared representation:

- **LiDAR point clouds** provide precise 3D geometry, range, and reflectivity.
- **Camera images** provide rich texture, color, and semantic information.
- **Radar returns** provide velocity (via Doppler) and range, robust to weather.

These features are fused in a unified representation space (likely BEV -- Bird's Eye View) for downstream 3D detection and tracking. The fusion module is custom-designed by Pony.ai's engineers to "bring high-performance components together with cutting-edge software, resulting in a tightly integrated full-stack system."

#### Decision-Level Fusion

The dual-path architecture (Section 1) provides decision-level fusion, where independent perception outputs are compared and arbitrated.

### Intelligent Sensor Selection

A distinguishing feature of Pony.ai's fusion is **adaptive sensor weighting**: the system "intelligently leverages the reliable sensor data depending on different environmental or driving scenarios." This means:

- In **bright daylight**: Camera features receive higher weight for color-dependent tasks (traffic light state, lane marking color).
- In **darkness or low-light**: LiDAR and radar receive higher weight; cameras provide limited utility.
- In **rain, fog, or snow**: Radar maintains performance; LiDAR may be degraded; cameras are significantly degraded. The system adapts weights accordingly.
- In **glare conditions**: Active sensors (LiDAR, radar) are prioritized over cameras, which suffer from saturation.

### Data Flow Architecture (NVIDIA Technical Blog)

Pony.ai's data flow architecture, documented in detail on the NVIDIA Developer Blog, implements several key optimizations for fusion:

1. **GPU Direct RDMA**: Sensor data transfers directly from FPGA/Orin to GPU memory via PCIe, achieving ~6 GB/s bandwidth on PCIe Gen3 x8, eliminating CPU-GPU copy overhead.
2. **Custom Protobuf `GpuData` Field**: Camera frames and point cloud data reside in GPU memory throughout the pipeline. A custom protobuf extension enables zero-copy message passing between perception modules.
3. **YUV420 Native Format**: Camera data stays in YUV420 (native ISP output) rather than converting to RGB, saving ~0.3 ms conversion time and reducing GPU memory by 50%. Perception modules that need only luminance (e.g., feature extraction) use only the Y channel, saving 67% memory.
4. **Structure-of-Array (SoA) Layout**: LiDAR point cloud data uses SoA layout for coalesced GPU memory access, optimizing parallel processing throughput.
5. **Multi-GPU Communication**: A PCIe switch enables peer-to-peer GPU communication at line speed without CPU staging buffers.

---

## 3. LiDAR Perception

### Primary LiDAR: Hesai AT128

The Gen-7 robotaxi uses four Hesai AT128 hybrid solid-state LiDAR sensors as primary perception LiDAR, selected for all three Gen-7 vehicle models (Toyota bZ4X, BAIC ARCFOX Alpha T5, GAC Aion V).

#### Hesai AT128 Technical Specifications

| Parameter | Specification |
|---|---|
| **Type** | Hybrid solid-state (electronic scanning, no mechanical rotation in horizontal axis) |
| **Channels** | 128 genuine channels (128 VCSEL arrays) |
| **Scan Technology** | 128 high-power multi-junction VCSEL arrays, electronic scanning |
| **Horizontal FOV** | 120 degrees (unstitched) |
| **Vertical FOV** | 25.4 degrees |
| **Detection Range** | 210 m @ 10% reflectivity |
| **Ground Detection Range** | Up to 70 m effective ground detection |
| **Angular Resolution** | 0.1 deg (H) x 0.2 deg (V) |
| **Point Rate** | >1.53 million points/second (single return) |
| **Pixel Resolution** | 1,200 x 128 |
| **Range Accuracy** | +/- 3 cm |
| **Wavelength** | 905 nm |
| **Dimensions** | 136 x 114 x 49 mm (W x D x H) |
| **Weight** | 940 g |
| **Power Consumption** | 13.5 W |
| **Environmental Protection** | IP6K7 and IP6K9K (dust/water resistant) |
| **Functional Safety** | ISO 26262 ASIL-B certified |
| **Eye Safety** | Class 1 |
| **Cybersecurity** | ISO 21434 compliant development |

#### Key AT128 Design Advantages for Pony.ai

1. **Unstitched point cloud**: Unlike some competing LiDARs that stitch multiple smaller FOV scans, the AT128 provides a genuine unstitched 120-degree horizontal FOV from its 128 VCSEL channels, eliminating seam artifacts.
2. **No mechanical scanning**: Electronic scanning (VCSEL array) eliminates moving parts in the horizontal direction, improving reliability and lifespan for 600,000+ km automotive-grade durability.
3. **ASIC-based design**: Hesai's proprietary LiDAR ASICs simplify assembly, reduce cost, and improve manufacturing consistency -- critical for Pony.ai's volume deployment (1,000+ vehicles planned in 2026).
4. **Form factor**: At 136 x 114 x 49 mm and 940 g, the AT128 integrates cleanly into the compact Gen-7 rooftop assembly.

#### Four-LiDAR Roof Configuration

Four AT128 units are mounted on the rooftop assembly, each covering a 120-degree sector:

```
        AT128 #1 (Front-Left, 120 deg)
       /                              \
AT128 #4 -------- ROOF -------- AT128 #2
(Rear-Left)                    (Front-Right)
       \                              /
        AT128 #3 (Rear-Right, 120 deg)
```

With 120-degree FOV per sensor and four sensors, the combined coverage exceeds 360 degrees with significant overlap zones at the boundaries, providing:
- Redundant coverage in overlap regions for cross-validation
- No gaps in horizontal coverage
- Combined point rate of >6.12 million points/second from the four primary LiDARs

### Near-Range LiDAR

Five additional near-range LiDAR units are body-mounted (not on the roof) to cover **blind spots** that the roof-mounted AT128s cannot reach:

- Areas directly adjacent to the vehicle sides
- Low-height objects near the vehicle (curbs, small animals, road debris)
- Objects in the immediate near-field (within ~10 cm of the vehicle body)

In previous generations (Gen-5/6), Pony.ai used RoboSense Bpearl LiDAR for near-range coverage. The Bpearl provides:
- Super-small blind zone
- Very wide field of view
- Detection within 10 centimeters of the vehicle body
- Coverage of front, sides, and back areas

### LiDAR Point Cloud Processing Pipeline

Based on the NVIDIA Technical Blog documentation and patent filings, the LiDAR processing pipeline includes:

#### 1. Raw Data Ingestion
- LiDAR packets arrive via Ethernet (UDP)
- Upstream module performs packet collection and time synchronization
- Point cloud data is structured in **Structure-of-Array (SoA)** format for GPU-optimized processing

#### 2. Point Cloud Preprocessing on GPU
- **Ground plane estimation**: Separate ground returns from above-ground points
- **Noise filtering**: Remove spurious returns, multi-path reflections
- **Point cloud filtering**: NVIDIA CUB library scan/select operations provide ~58% faster filtering performance
- **Page-locked memory**: Used for CPU-GPU field exchanges during preprocessing

#### 3. Feature Encoding
- Point clouds are encoded into structured representations for neural network consumption
- Likely encodings include voxelization (VoxelNet-style), pillar-based encoding (PointPillars-style), or range-view projection
- SoA data layout enables coalesced GPU memory access for parallel voxelization

#### 4. 3D Detection Network
- Encoded point cloud features are processed by 3D object detection networks
- Output: 3D bounding boxes with class labels, confidence scores, and heading angles

#### 5. Pipeline Latency
- Overall LiDAR pipeline latency reduction of approximately **4 milliseconds** in the critical path achieved through GPU optimization
- Combined with the overall system achieving **>10 Hz** inference across all perception modules

---

## 4. Camera Perception

### Camera Hardware Configuration

#### Gen-7 (14 Cameras)

The Gen-7 system deploys 14 cameras -- an increase from 11 in Gen-6 -- with 8-megapixel resolution:

| Camera Type | Placement | Purpose |
|---|---|---|
| **Wide-angle cameras** | Roof, multiple directions | Near-to-mid range 360-degree coverage |
| **Super-wide-angle cameras** | Body-mounted | Near-field coverage, parking, low-speed maneuvers |
| **Mid-range cameras** | Roof | General perception at medium distances |
| **Long-range cameras** | Forward-facing | Distant object detection, highway scenarios |
| **Traffic light detection cameras** | Forward-facing, elevated | Dedicated traffic signal detection and classification |

#### Gen-6 (11 Cameras)

The 6th-generation system used 11 cameras in a combination of wide-angle, super-wide-angle, middle-range, long-range, and traffic light detection cameras deployed around the roof and body. The **self-developed traffic light camera** had a resolution 1.5x that of the previous generation.

### Camera Data Processing Pipeline

Pony.ai's camera processing pipeline, documented in the NVIDIA Technical Blog, is heavily GPU-optimized:

#### 1. Image Capture and Transfer

**Historical evolution:**
- **Phase 1 (CPU-based I/O)**: USB and Ethernet camera data routed through CPU, creating bottlenecks as camera resolution increased.
- **Phase 2 (FPGA Gateway)**: FPGA-based sensor gateway handled camera triggering and synchronization. DMA transfers moved data from FPGA to main memory via PCIe.
- **Phase 3 (GPU Direct RDMA)**: Direct DMA transfers from FPGA to GPU memory using kernel-space APIs, achieving ~6 GB/s bandwidth on PCIe Gen3 x8.
- **Phase 4 (DRIVE Orin SoC)**: Production migration to automotive-grade Orin, handling sensor signal processing, synchronization, and camera frame encoding via NvStreams.

#### 2. Color Space and Format

- Cameras natively output **YUV420** from the ISP (Image Signal Processor).
- Pony.ai adopted YUV420 throughout the pipeline, eliminating ~0.3 ms RGB conversion overhead.
- Memory savings: 50% reduction vs. RGB; 67% reduction for luminance-only processing (Y channel only).
- Perception modules that do not require chrominance information (e.g., edge detection, feature extraction) receive only the Y channel.

#### 3. Image Encoding

- **HEVC hardware encoding** using NVIDIA Video Codec's dedicated hardware encoders (~3 ms per FHD image).
- Avoids NvJPEG which required ~4 ms and caused CPU-GPU resource contention.
- Dedicated hardware encoders preserve CUDA cores and CPU resources for neural network inference.

#### 4. Neural Network Inference

Camera images are processed through deep neural networks for:
- **2D object detection**: Bounding boxes for vehicles, pedestrians, cyclists, and other road users
- **Image classification**: Traffic light states, sign recognition
- **Feature extraction**: Visual features for cross-modal fusion with LiDAR
- **Depth estimation**: Monocular or stereo depth for 3D understanding from cameras alone

#### 5. Camera Backbone Architecture

While Pony.ai has not publicly disclosed its specific CNN backbone, based on its technology era, compute constraints (NVIDIA DRIVE Orin), and industry context, the system likely employs:

- **Efficient backbone architectures** suitable for real-time inference on Orin (e.g., ResNet variants, EfficientNet, or proprietary architectures optimized for NVIDIA hardware)
- **Multi-scale feature pyramids** (FPN) for detecting objects at various distances
- **Attention mechanisms** for focusing on relevant image regions (traffic lights, distant vehicles)
- Networks optimized for **TensorRT** inference on NVIDIA Ampere/Orin GPU architectures

#### 6. GPU Memory Management for Camera Processing

- **Fixed slot-size GPU memory pool**: Pre-allocated GPU memory stacks matching camera frame sizes, eliminating ~0.1 ms malloc/free overhead per allocation.
- **CUDA 11.2 `cudaMemPool`**: Dynamic allocation with ~2 microsecond overhead, supporting cameras with varying resolutions.

---

## 5. Radar Perception

### Radar Hardware

#### Gen-7 Configuration: 4D Imaging Millimeter-Wave Radar

The Gen-7 system uses **four 4D imaging millimeter-wave radar** units, an upgrade from the Gen-6's five conventional radars (4 short-range + 1 long-range forward-facing). The transition to 4D imaging radar provides:

| Capability | Conventional mmWave Radar | 4D Imaging Radar (Gen-7) |
|---|---|---|
| **Range** | Yes | Yes |
| **Azimuth angle** | Limited | High resolution |
| **Elevation angle** | No | Yes |
| **Velocity (Doppler)** | Yes | Yes |
| **Point cloud density** | Sparse | Dense (approaching LiDAR-like) |
| **Height discrimination** | No | Yes (can distinguish overpass from vehicle) |

#### Gen-6 Configuration

- 4 short-range millimeter-wave radars at roof corners
- 1 long-range forward-facing millimeter-wave radar

### Radar's Role in Pony.ai's Perception Stack

Radar serves several critical functions in the multi-sensor fusion architecture:

1. **Velocity measurement**: Radar provides direct Doppler velocity measurements for moving objects, unlike LiDAR (which infers velocity from frame-to-frame displacement) or cameras (which estimate from optical flow).

2. **Weather robustness**: Millimeter-wave radar operates reliably in rain, fog, snow, and dust -- conditions that degrade both LiDAR and camera performance. This is critical for Pony.ai's 24/7 all-weather operations.

3. **Active sensing in darkness**: Like LiDAR, radar is an active sensor unaffected by ambient illumination, supporting nighttime operations where cameras have limited utility.

4. **Low-contrast object detection**: Radar can detect objects that are challenging for cameras (e.g., dark-clothed pedestrians at night) and provides complementary data to LiDAR for objects at the limits of reflectivity.

5. **Calibration reference**: Pony.ai holds a patent (US 11,454,701) for "Real-time and dynamic calibration of active sensors with angle-resolved Doppler information," which uses radar's Doppler measurements from stationary objects to continuously recalibrate active sensors during normal vehicle operation.

### Radar-LiDAR Fusion

The 4D imaging radar's dense point cloud enables tighter integration with LiDAR data:

- **Spatial alignment**: Both produce 3D point-like measurements that can be registered in the same coordinate frame.
- **Velocity augmentation**: Radar Doppler velocities can be associated with LiDAR-detected objects to provide instantaneous velocity estimates without temporal differencing.
- **Gap filling**: When LiDAR returns are sparse (distant objects, low-reflectivity surfaces), radar returns can supplement the detection.
- **Cross-validation**: Objects detected by both LiDAR and radar receive higher confidence in the fusion framework.

---

## 6. 3D Object Detection

### Detection Architecture

Pony.ai employs multi-modal 3D object detection operating on fused LiDAR and camera data. The system achieves what Pony.ai describes as **"zero critical missing" perception** -- the goal of detecting every safety-critical object in the scene with no missed detections.

#### Likely Architectural Components

Based on Pony.ai's disclosed technology, patent filings, compute platform (NVIDIA DRIVE Orin with 4x Orin-X at 1016 TOPS), and industry context:

| Component | Approach |
|---|---|
| **LiDAR encoding** | Voxel-based or pillar-based encoding of point clouds into structured grid representations |
| **Camera encoding** | CNN backbone with FPN for multi-scale 2D feature extraction |
| **Cross-modal fusion** | Projection of LiDAR features onto camera feature maps (or vice versa) for feature-level fusion |
| **BEV representation** | Bird's Eye View as the unified representation for multi-sensor fusion, detection, and downstream planning |
| **Detection head** | 3D bounding box regression with class prediction, orientation, and velocity estimation |

### BEV (Bird's Eye View) Representation

BEV has become the standard representation for autonomous driving perception, and Pony.ai's system operates in this paradigm:

- **Why BEV**: BEV provides a unified, occlusion-free representation where object locations, sizes, and orientations are well-defined. It naturally integrates with downstream planning modules that operate in the same coordinate frame.
- **LiDAR-to-BEV**: LiDAR point clouds are projected to a top-down grid, with height information encoded as features.
- **Camera-to-BEV**: Camera features are lifted to BEV using depth estimation and view transformation (following approaches like LSS, BEVDet, or BEVFormer).
- **Fusion in BEV**: Multi-sensor features are concatenated or attention-fused in the BEV space.

### Object Classes Detected

Pony.ai's perception system detects and classifies the following object categories:

| Category | Examples |
|---|---|
| **Vehicles** | Cars, buses, trucks, vans, motorcycles, three-wheelers |
| **Vulnerable Road Users (VRUs)** | Pedestrians, cyclists, e-bike riders, scooter riders |
| **Traffic infrastructure** | Traffic lights (with state), traffic signs, construction barriers, cones |
| **Road features** | Lane markings, road boundaries, curbs, crosswalks, drivable area boundaries |
| **Static obstacles** | Parked vehicles, road debris, construction equipment, bollards |
| **Dynamic special cases** | Emergency vehicles (with acoustic detection via microphones), animals |

### Detection Output Format

For each detected object, the system outputs:

- **3D bounding box**: Center position (x, y, z), dimensions (length, width, height), heading angle
- **Class label**: Object category with confidence score
- **Velocity vector**: Estimated velocity (vx, vy) from radar Doppler and/or temporal tracking
- **Tracking ID**: Persistent identifier for multi-frame tracking
- **Predicted trajectories**: Generated by the downstream prediction module

### Detection Range

The Gen-7 system achieves detection across a wide range:

| Range Zone | Distance | Primary Sensors |
|---|---|---|
| **Ultra-near field** | 0-10 cm | Near-range LiDAR (Bpearl), ultrasonic |
| **Near field** | 10 cm - 30 m | Near-range LiDAR, wide-angle cameras, radar |
| **Mid field** | 30 m - 200 m | Hesai AT128 LiDAR (primary), mid-range cameras, radar |
| **Far field** | 200 m - 650 m | Long-range cameras, radar |

The 650-meter maximum detection range is primarily achieved through long-range cameras and radar, extending well beyond the AT128 LiDAR's 210 m range.

### Compute Budget

With four NVIDIA Orin-X chips providing 1016 TOPS of deep-learning inference, the detection networks have substantial compute budget:

- ~80% GPU utilization across the multi-GPU system during normal operation
- Real-time inference at >10 Hz across all perception modules (detection, segmentation, tracking)
- Inference optimized through TensorRT, CUDA 11.2+ memory management, and hardware-accelerated encoding

---

## 7. Object Tracking

### Multi-Object Tracking Architecture

Pony.ai's tracking system operates as part of the dual-path perception architecture, with both heuristic and deep-learning tracking running in parallel.

#### Heuristic Tracking Path

The classical tracking path likely implements:

- **State estimation**: Extended Kalman Filter (EKF) or Unscented Kalman Filter (UKF) for maintaining object state (position, velocity, acceleration, heading, yaw rate)
- **Data association**: Hungarian algorithm or Joint Probabilistic Data Association (JPDA) for matching detections to existing tracks
- **Track management**: Birth/death logic for creating new tracks from unassociated detections and retiring tracks after sustained non-detection

#### Deep Learning Tracking Path

The learned tracking path leverages:

- **Feature-based association**: Deep feature embeddings from camera and LiDAR for appearance-based matching (re-identification)
- **Motion modeling**: Learned motion models that capture complex agent behaviors beyond constant-velocity assumptions
- **Occlusion handling**: Learned models for maintaining tracks through temporary occlusions

### Multi-Sensor Data Association

One of the most challenging aspects of tracking in Pony.ai's system is associating observations across nine LiDARs, 14 cameras, and four radars:

1. **Spatial association**: Objects observed by multiple sensors are associated based on 3D spatial proximity in the vehicle coordinate frame.
2. **Temporal association**: Frame-to-frame matching uses predicted positions from the state estimator.
3. **Cross-modal association**: LiDAR detections, camera detections, and radar returns for the same physical object are fused into a single track.
4. **Confidence fusion**: Each sensor's detection confidence is combined, with sensor-specific reliability weights that adapt to environmental conditions.

### Track Output

Each maintained track provides:

- Filtered position, velocity, and acceleration estimates
- Object classification (refined over time as more observations accumulate)
- Object dimensions (refined from multiple viewpoints)
- Track age and confidence
- Historical trajectory (used by the prediction module)
- Association with map elements (which lane the object occupies)

---

## 8. Prediction System

### Overview

The Prediction module projects how other vehicles, pedestrians, and objects may move based on multiple input streams:

| Input | Content |
|---|---|
| **Perception output** | Tracked objects with positions, velocities, dimensions, classifications |
| **Raw sensor data** | Direct sensor measurements for supplementary context |
| **Historical behavior data** | Previous decisions and trajectories of tracked road agents |
| **Map context** | HD map data including lane geometry, traffic rules, intersection topology |

### Output Format

For each tracked agent, the Prediction module produces:

- **Multiple predicted trajectories**: Not a single prediction, but a set of plausible future paths.
- **Probability assignment**: Each trajectory has an associated probability of occurrence.
- **Multi-modal behavior**: Captures the fact that a vehicle at an intersection may turn left, go straight, turn right, or stop -- each with different probability.
- **Time horizon**: Predictions extend several seconds into the future for planning purposes.

### Interaction Modeling

Pony.ai's prediction system models **agent interactions** -- the fact that road users' future trajectories depend on each other:

- A pedestrian stepping into a crosswalk changes the predicted trajectory of an approaching vehicle.
- A vehicle beginning to merge changes the predicted behavior of vehicles in the target lane.
- Multiple agents at an intersection negotiate priority through implicit interaction.

This interaction-aware prediction is critical for the complex Chinese urban environments where Pony.ai operates, with dense mixed traffic including e-bikes, pedestrians, and vehicles sharing road space.

### Technical Approach

Based on Pony.ai's disclosed capabilities, the prediction system likely employs:

- **Attention-based architectures**: Transformer-style attention for modeling agent-agent interactions and agent-map interactions.
- **Graph neural networks**: For representing the structured relationships between agents and road elements.
- **Conditional prediction**: Trajectories conditioned on the ego vehicle's planned action (e.g., "if we yield, how will the other agent behave?").
- **Temporal sequence modeling**: Processing historical trajectory sequences to infer intent and predict future motion.

### Integration with Planning

The prediction output feeds directly into the Planning and Control module, which uses the probabilistic trajectory predictions to:

- Evaluate the safety of candidate ego trajectories against predicted agent motions.
- Plan interactions (yielding, merging, passing) based on predicted agent intent.
- Handle uncertainty by planning conservatively when prediction confidence is low.

---

## 9. Semantic Segmentation

### Road and Drivable Area Segmentation

Pony.ai's perception system performs semantic segmentation at both the image level (2D) and point cloud level (3D):

#### Image-Level Segmentation
- **Lane marking detection**: Classification of lane markings by type (solid, dashed, double, yellow, white)
- **Road boundary detection**: Curbs, barriers, guardrails, road edges
- **Drivable area classification**: Free space vs. non-drivable area
- **Crosswalk detection**: Pedestrian crossing zones
- **Road surface classification**: Asphalt, concrete, unpaved, wet surface

#### Point Cloud Segmentation
- **Ground segmentation**: Separation of ground plane from above-ground objects, critical for 3D detection
- **3D semantic labeling**: Per-point classification of road surface, vegetation, buildings, and other static elements

### Cross-Modal Segmentation (Patented)

Pony.ai's patent US11,250,240 ("Instance segmentation using sensor data having different dimensionalities") describes a novel approach to leveraging LiDAR data for training camera-based segmentation models:

1. 3D LiDAR point clouds with labeled bounding boxes are projected onto 2D camera images using calibrated sensor extrinsics.
2. The projected points generate **sparse 2D instance segmentation masks** -- positive values at pixels containing labeled LiDAR points, negative values elsewhere.
3. These sparse masks serve as training labels for a 2D instance segmentation model, **eliminating the need for manual pixel-level annotation**.
4. The trained model can then perform 3D instance segmentation by projecting new LiDAR data onto images and using predicted masks to label individual 3D points.

This patent represents Pony.ai's approach to generating segmentation training data at scale without expensive manual annotation -- a key enabler for their auto-labeling pipeline.

---

## 10. Occupancy Representations

### Occupancy in Pony.ai's Architecture

While Pony.ai has not explicitly published details about occupancy grid usage, several aspects of their system strongly suggest occupancy-based representations are employed:

1. **BEV representation**: Pony.ai's use of Bird's Eye View representations inherently discretizes the world into a 2D grid, which can encode occupancy information (free, occupied, unknown).

2. **Drivable area detection**: The semantic segmentation of drivable space naturally produces a binary occupancy map distinguishing traversable from non-traversable areas.

3. **Near-field obstacle detection**: The near-range LiDARs (Bpearl and similar) that detect objects within 10 cm of the vehicle body produce dense local occupancy information critical for parking, narrow-passage navigation, and collision avoidance.

4. **Dynamic occupancy**: The tracking system maintains temporal occupancy predictions for moving objects, used by the planning module to evaluate trajectory safety.

### Grid-Centric Perception for General Obstacles

A key advantage of occupancy grid representations is handling **novel or unclassified objects** -- a critical capability for Chinese urban environments where Pony.ai encounters diverse and sometimes unusual road obstacles (construction materials, fallen cargo, unusual vehicle types). Occupancy grids represent these as "occupied space" regardless of classification, providing a safety-critical fallback when the object detector cannot classify an obstacle.

---

## 11. Traffic Infrastructure Detection

### Traffic Light Detection

Pony.ai has invested significantly in traffic light detection, including developing a **self-developed traffic light camera** for the Gen-6 system with 1.5x resolution compared to the previous generation. This dedicated camera addresses the unique challenges of traffic light detection in Chinese urban environments:

#### Chinese Traffic Light Challenges

| Challenge | Description |
|---|---|
| **Complex intersections** | Chinese cities have large multi-lane intersections (e.g., eight-lane) with multiple traffic light groups visible simultaneously |
| **Vertical and horizontal configurations** | Chinese traffic lights may be oriented vertically or horizontally, with varying form factors |
| **LED vs. incandescent** | Mix of LED and older incandescent signals with different appearance characteristics |
| **Arrow signals** | Directional arrows (left turn, right turn, U-turn) require fine-grained classification |
| **Countdown timers** | Some Chinese traffic lights display countdown timers requiring OCR capabilities |
| **Nighttime interference** | Neon signs, vehicle taillights, and other red/green/yellow light sources create false positives |
| **Distance** | Traffic lights must be detected at long range for safe deceleration planning |

#### Detection Approach

- **Dedicated high-resolution camera**: Forward-facing traffic light camera with elevated mounting for optimal viewing angle.
- **Multi-class classification**: Detection of red, yellow, green states; arrow directions; countdown timer values.
- **Temporal filtering**: State transitions are validated over multiple frames to prevent flicker-induced errors.
- **HD map association**: Detected traffic lights are matched to known signal positions in the HD map for disambiguation when multiple signals are visible.

### Traffic Sign Detection

Traffic sign recognition covers Chinese national standard signs including:

- Speed limit signs (numeric OCR)
- Directional signs
- Warning signs
- Prohibition signs
- Road name signs
- Construction zone signs

### Construction Zone Detection

Pony.ai's system handles construction zones -- a common occurrence in rapidly developing Chinese cities -- by detecting:

- Construction barriers and cones
- Temporary lane markings
- Flaggers and construction workers
- Modified road geometry

---

## 12. PonyWorld Perception

### World Model Architecture

PonyWorld is Pony.ai's proprietary unified model architecture that serves dual roles: as a simulation platform and as a training environment for the Virtual Driver. Its perception-related capabilities include:

#### Scenario Perception and Reconstruction

PonyWorld ingests real-world driving data from the fleet and reconstructs driving scenarios in high fidelity:

1. **Sensor log replay**: Raw sensor data from fleet vehicles is replayed through the perception stack to extract scene structure.
2. **Scene reconstruction**: 3D scenes are built from multi-sensor data, capturing road geometry, object positions, and dynamic behaviors.
3. **Scenario parameterization**: Key parameters of each scenario are extracted (agent positions, velocities, behaviors, traffic states) to enable variation.

#### Synthetic Sensor Data Generation

PonyWorld generates synthetic sensor data for perception training:

- **High-fidelity LiDAR simulation**: Simulated point clouds matching the characteristics of the Hesai AT128 sensors.
- **Camera rendering**: Photorealistic rendering of driving scenes for camera perception training.
- **Radar simulation**: Simulated radar returns for multi-sensor fusion training.
- **Weather and lighting variation**: Synthetic data under diverse weather (rain, fog, snow) and lighting (day, night, dawn/dusk, glare) conditions.

#### Scale

- **>10 billion kilometers** of simulated driving data generated per week.
- Hundreds to thousands of variations generated per high-risk scenario.
- This data volume enables training perception models on long-tail scenarios that are rare in real-world driving data.

### GAN-Based Scenario Generation (Patented)

Pony.ai holds patent US11,774,978 for a method using **Generative Adversarial Networks (GANs)** to create simulated 3D traffic environments for autonomous driving model training. The patent describes:

- Creating time-dependent 3D traffic environment data using real or simulated traffic element data.
- Using a GAN model to generate realistic variations of traffic scenarios.
- Simulated data includes vehicular sounds, pedestrian density and behavior, plant movement, brightness levels, walking patterns, vibrations from road conditions, and human sounds.
- The generated data trains autonomous driving models for virtual driving operations with dynamically changing routes.

### Dual-Spiral Co-Evolution

The perception system benefits from PonyWorld's dual-spiral development cycle:

1. Fleet perception data reveals edge cases and failure modes.
2. PonyWorld generates scenario variations targeting these specific weaknesses.
3. Perception models are retrained on the augmented data.
4. Improved perception is validated in simulation, then deployed via OTA.
5. New fleet data reveals the next set of challenges -- completing the loop.

---

## 13. Perception for Trucking (PonyTron)

### How Trucking Perception Differs from Robotaxi

PonyTron, Pony.ai's autonomous trucking division, faces fundamentally different perception challenges compared to PonyAlpha (robotaxi):

| Factor | PonyAlpha (Robotaxi) | PonyTron (Trucking) |
|---|---|---|
| **Operating domain** | Urban streets, complex intersections | Highways, expressways, some urban segments |
| **Speed** | 0-60 km/h typical | 60-120 km/h typical |
| **Detection range requirement** | ~200 m sufficient for urban speeds | >300 m required for highway braking distances |
| **Object diversity** | High (pedestrians, e-bikes, mixed traffic) | Lower (primarily vehicles, occasional pedestrians near exits) |
| **Vehicle dynamics** | Light passenger vehicle, agile | Heavy-duty truck (up to 49 tons), long stopping distance, trailer articulation |
| **Blind spots** | Standard passenger car blind spots | Massive blind spots: long trailer sides, rear of trailer |
| **Height considerations** | Standard | Must detect overpass height, bridge clearance, overhead signs |

### PonyTron Sensor Configuration

The PonyTron autonomous truck system uses a sensor suite optimized for highway operation:

| Sensor Type | Details |
|---|---|
| **LiDAR** | 2 LiDAR units (roof-mounted, long-range) |
| **Millimeter-wave radar** | Multiple units for long-range velocity detection |
| **High-precision cameras** | Multiple cameras including 1 km range long-range camera |
| **Rear-view cameras** | Dedicated rear cameras for safe lane merging |
| **Near-range LiDAR** | RoboSense Bpearl for blind-spot coverage around the truck body |

Key differences from the robotaxi sensor suite:

1. **Long-range camera (1 km)**: Highway speeds require detecting objects at extreme distances for safe braking. The long-range camera covers up to 1 kilometer, far beyond the robotaxi's needs.
2. **Rear-view cameras**: Critical for a truck to merge lanes safely, as the long trailer creates extensive rear blind spots.
3. **Fewer LiDARs**: Highway environments are more structured than urban streets, requiring less dense spatial coverage.
4. **Integrated arc design**: The sensor layout adopts an integrated arc design for aerodynamic efficiency at highway speeds.
5. **Sensor cleaning system**: A new sensor cleaning system maintains perception accuracy during extended highway operation.

### Gen-4 Autonomous Truck (November 2025)

The fourth-generation truck lineup, co-developed with SANY TRUCK and DFLZM, features:

- 100% automotive-grade components
- ~70% BOM cost reduction vs. previous generation
- Ultra-long-range and panoramic coverage sensing capabilities
- NVIDIA DRIVE Orin compute platform
- Designed for mass production at the thousand-unit scale

### Platooning Perception ("1+4" Model)

Pony.ai pioneered the "1+4" convoy model: 1 lead truck (with safety driver) and 4 fully driverless follower trucks. The perception requirements for platooning add:

- **V2V communication**: Follower trucks receive perception data from the lead truck for preview information about road conditions ahead.
- **Inter-vehicle tracking**: Each truck must precisely track the position and velocity of adjacent convoy members.
- **Gap management**: Perception must detect and respond to cut-in vehicles attempting to enter the convoy.

### Endurance Testing

PonyTron completed a nearly 6-hour autonomous drive transporting goods on highways through day and night, heavy rain, tunnels, and construction zones -- all without any disengagement -- demonstrating the robustness of the trucking perception system across diverse conditions.

---

## 14. Sensor Cost Reduction

### 68% LiDAR BOM Cost Reduction

The Gen-7 system achieved a **68% reduction in solid-state LiDAR BOM cost** compared to Gen-6. This was accomplished through multiple factors:

#### Supply-Side Factors (Hesai)

| Factor | Detail |
|---|---|
| **ASIC integration** | Hesai's proprietary LiDAR ASICs dramatically simplify the traditional complex assembly process |
| **VCSEL-based design** | All-VCSEL design achieves high affordability and automotive-grade reliability |
| **Manufacturing scale** | Hesai's new manufacturing center has planned capacity of >1 million units/year |
| **Volume pricing** | Pony.ai's commitment to 4 AT128 units per vehicle across all three Gen-7 models provides volume leverage |

#### Demand-Side Factors (Pony.ai)

| Factor | Detail |
|---|---|
| **Standardization** | Single LiDAR model (AT128) across all vehicle platforms reduces SKU complexity |
| **Transition from Luminar** | Shifted from Luminar Iris (US-manufactured, higher cost) to Hesai AT128 (Chinese-manufactured, lower cost) |
| **System-level optimization** | Reduced total LiDAR count from 7 (Gen-6: 4 solid-state + 3 near-range) while maintaining coverage |

### Perception Implications of Cost Reduction

The cost reduction enables perception-relevant benefits:

1. **Fleet scale**: Lower per-vehicle cost enables larger fleets (target: 3,000+ vehicles by end 2026), which generates more real-world training data for perception model improvement.
2. **Data diversity**: Larger fleet across four Tier-1 cities means more diverse training data (different weather, lighting, traffic patterns, road types).
3. **Faster iteration**: More vehicles means more edge case encounters per unit time, accelerating the dual-spiral improvement cycle.
4. **Unit economics**: BOM reduction was critical to achieving city-wide unit economics breakeven (Guangzhou Nov 2025, Shenzhen Mar 2026), validating the business model for continued R&D investment in perception.

### Total System BOM: $7,000-$10,000

Industry analysis estimates the Gen-7 autonomous driving system costs **$7,000-$10,000 per vehicle** -- down from $50,000+ for earlier generations. This represents a 70% total BOM reduction, with the ADC (compute) reduced by 80% and LiDAR by 68%.

---

## 15. Domestic GPU Adaptation

### Moore Threads Partnership (February 2026)

Pony.ai announced a strategic partnership with Moore Threads, a Chinese GPU developer, to adapt its perception training and inference pipelines to domestically developed AI computing hardware. This is the first adoption of domestically developed AI computing at scale for L4 autonomous driving.

### MTT S5000 Technical Specifications

| Parameter | Specification |
|---|---|
| **Architecture** | Moore Threads 4th-generation MUSA "Pinghu" |
| **AI Compute** | Up to 1,000 TFLOPS dense AI computing power |
| **Memory** | 80 GB |
| **Memory Bandwidth** | 1.6 TB/s |
| **Inter-card Bandwidth** | 784 GB/s |
| **Target Workloads** | Large-scale model training, inference, and HPC |
| **Model Scale** | Supports training models with hundreds of billions to trillions of parameters |

### Implications for Perception

The partnership has specific implications for Pony.ai's perception stack:

#### Training

- **Perception model training**: World model and in-vehicle perception models are being adapted to train on the MTT S5000 platform.
- **Large-scale training**: The KUAE intelligent computing cluster built on MTT S5000 supports training at scales competitive with NVIDIA-based clusters.
- **Algorithm-hardware co-optimization**: Joint adaptation and validation of training workloads to ensure equivalent model quality on domestic hardware.

#### Simulation

- **PonyWorld rendering**: The MTT S5000's graphics rendering capabilities support high-fidelity simulation, scenario reconstruction, and visualization for autonomous driving.
- **Sensor simulation**: Synthetic LiDAR, camera, and radar data generation for perception model training.

#### Supply Chain Diversification

- Reduces dependence on US-origin NVIDIA GPUs for training infrastructure.
- Provides resilience against potential export controls affecting high-end GPU availability.
- The KUAE cluster provides a domestic alternative for compute-intensive perception workloads.

#### Inference Considerations

- Onboard inference continues to use NVIDIA DRIVE Orin (automotive-grade, ASIL-rated), which has no domestic Chinese equivalent at the required performance and safety certification level.
- The Moore Threads partnership focuses on **cloud-side** training and simulation, not edge/onboard inference.

---

## 16. Auto-Labeling

### The Labeling Challenge

Training perception models at scale requires vast quantities of labeled sensor data -- 3D bounding boxes, instance segmentation masks, semantic labels, and tracking annotations. Manual labeling is prohibitively expensive and slow at the scale of Pony.ai's fleet data (>12 million km of real-world driving, >50 million km of autonomous testing).

### Cross-Modal Auto-Labeling (Patented)

Pony.ai's patent US11,250,240 ("Instance segmentation using sensor data having different dimensionalities") describes a key component of their auto-labeling pipeline:

#### Method

1. **Simultaneous capture**: LiDAR point clouds and camera images are captured concurrently.
2. **3D bounding box labeling**: Objects in the LiDAR point cloud are labeled with 3D bounding boxes (which is much faster than pixel-level annotation).
3. **Cross-modal projection**: Using calibrated sensor extrinsics, LiDAR points within each 3D box are projected onto the camera image.
4. **Sparse mask generation**: The projected points create sparse 2D instance segmentation masks.
5. **Metadata enrichment**: LiDAR-specific features (depth, intensity, height) are attached to projected points.
6. **Model training**: A 2D instance segmentation model is trained using these sparse masks for loss propagation.

#### Key Innovation

This approach **eliminates the need for manual pixel-level instance segmentation annotation** -- one of the most expensive labeling tasks in computer vision. Instead:
- 3D bounding boxes (relatively cheap to produce, can be partially automated) serve as the ground truth source.
- Cross-modal projection transfers the 3D labels to the 2D domain.
- The resulting sparse masks are sufficient for training accurate segmentation models.

### Fleet-Scale Data Pipeline

Pony.ai's auto-labeling pipeline operates at fleet scale:

```
Fleet Vehicles (1,159+ vehicles)
    |
    v
Raw Sensor Data Collection (LiDAR + camera + radar)
    |
    v
Offline Data Upload to Cloud (Tencent Cloud)
    |
    v
Automated Labeling Pipeline
    |-- 3D object detection (bootstrapped from existing models)
    |-- Cross-modal projection (LiDAR -> camera)
    |-- Sparse instance segmentation mask generation
    |-- Tracking annotation (from tracker output)
    |-- Active learning: flag uncertain/novel cases for human review
    |
    v
Human Review (for flagged cases and quality control)
    |
    v
Training Dataset
    |
    v
Model Training (Tencent Cloud / Moore Threads KUAE cluster)
    |
    v
Validation and Benchmarking
    |
    v
OTA Deployment to Fleet
```

### Simulation-Based Auto-Labeling

PonyWorld adds another dimension to auto-labeling:

- Simulated scenarios come with **perfect ground truth labels** -- every object position, velocity, class, and mask is known by construction.
- This provides unlimited labeled training data for perception models, particularly for rare scenarios that are hard to capture (and label) in the real world.
- The GAN-based scenario generation (patent US11,774,978) creates diverse, realistic training data at massive scale (>10 billion km/week).

---

## 17. Calibration

### Multi-Sensor Calibration Challenge

With 34 sensors (9 LiDARs, 14 cameras, 4 radars, and others), maintaining precise calibration across all sensor pairs is critical. Misalignment of even a fraction of a degree can cause fusion errors that compound in downstream perception.

### Calibration Types

#### Intrinsic Calibration
- **Camera intrinsics**: Focal length, principal point, lens distortion parameters for each of the 14 cameras.
- **LiDAR intrinsics**: Beam angle offsets, range corrections for each of the 128 channels in the AT128.
- Factory-calibrated by Hesai (for LiDAR) and the camera manufacturer; verified during vehicle integration.

#### Extrinsic Calibration
- **LiDAR-to-vehicle**: 6-DOF transformation (rotation + translation) from each LiDAR's coordinate frame to the vehicle body frame.
- **Camera-to-vehicle**: 6-DOF transformation for each camera.
- **Radar-to-vehicle**: 6-DOF transformation for each radar.
- **LiDAR-to-camera**: Cross-modal alignment enabling point cloud projection onto images.
- **Temporal calibration**: Time offsets between sensors operating at different frame rates and with different internal clocks.

### Real-Time Doppler-Based Calibration (Patented)

Pony.ai holds US Patent 11,454,701: "Real-time and dynamic calibration of active sensors with angle-resolved Doppler information for vehicles."

#### Method

1. During normal vehicle operation, radar sensors measure Doppler velocity of surrounding objects.
2. Stationary objects (buildings, poles, parked vehicles) should show Doppler velocity equal to the negative of the vehicle's own velocity, rotated by the sensor's mounting angle.
3. Any discrepancy between the expected and measured Doppler velocity indicates sensor misalignment.
4. The system automatically adjusts sensor parameters (mounting angles, angular offsets) in real time by analyzing how stationary objects appear in Doppler measurements.

#### Significance

This patent enables **continuous sensor recalibration during normal driving** -- eliminating the need for periodic manual calibration sessions. This is critical for:
- Large fleet operations (1,159+ vehicles) where manual calibration is impractical at scale.
- Maintaining perception accuracy over the 600,000+ km designed vehicle lifespan.
- Compensating for thermal expansion, vibration-induced drift, and minor impacts that gradually shift sensor alignment.

### Static Object-Based Calibration (Patented)

Pony.ai also holds a patent for vehicle sensor calibration using detected static objects:

- Captures point cloud data from LiDAR sensors.
- Detects static objects (poles, signs, building corners) in the environment.
- Iteratively adjusts the transformation matrix of a first sensor to align with a pre-calibrated second sensor.
- Achieves calibration to a global coordinate system using the HD map as reference.

### SLAM-Based Calibration (Patented)

Patent US11,908,198 describes a computing system for generating graphical illustrations of point cloud frames for SLAM (Simultaneous Localization and Mapping) algorithms, which relates to maintaining calibration accuracy through continuous map-relative positioning.

---

## 18. Key Patents

### Patent Portfolio Overview

| Metric | Value |
|---|---|
| **Total patents globally** | 277 |
| **Unique patent families** | 151 |
| **Active patents** | 259 (93% of portfolio) |
| **Granted patents** | 92 |
| **US patents filed** | 182 |
| **China patents filed** | 50 |
| **Hong Kong patents filed** | 23 |
| **USPTO grant rate** | 81.25% (39 of 59 direct applications) |
| **Peak filing year** | 2019 (87 applications) |
| **Key inventors** | Tiancheng Lou (93 patents), James Peng (81 patents) |
| **Legal counsel** | Sheppard Mullin Richter & Hampton |

### Technology Classification Focus

Pony.ai's patents concentrate in:

| IPC Code | Domain | Coverage |
|---|---|---|
| **G01S** | Sensing and positioning | LiDAR systems, radar, sensor calibration |
| **B60W** | Vehicle control | Autonomous driving control systems |
| **G05D** | Motion regulation | Path planning, trajectory control |
| **G06V** | Image/video recognition | Camera perception, object detection |
| **G06T** | Image processing | Point cloud processing, 3D reconstruction |

### Perception-Related Patents

#### Object Detection and Segmentation

| Patent Number | Title | Filed | Granted | Key Innovation |
|---|---|---|---|---|
| **US11,250,240B1** | Instance segmentation using sensor data having different dimensionalities | Jul 2020 | Feb 2022 | Cross-modal LiDAR-camera instance segmentation; sparse mask generation for auto-labeling |

#### Sensor Calibration

| Patent Number | Title | Filed | Granted | Key Innovation |
|---|---|---|---|---|
| **US11,454,701** | Real-time and dynamic calibration of active sensors with angle-resolved Doppler information | Feb 2020 | Sep 2022 | Continuous radar-based sensor recalibration during normal driving |
| **Granted (number TBD)** | Vehicle sensor calibration using detected static objects | -- | -- | Point cloud-based iterative calibration using environmental features |

#### Simulation and Training

| Patent Number | Title | Filed | Granted | Key Innovation |
|---|---|---|---|---|
| **US11,774,978B2** | Training autonomous driving model with simulated 3D traffic data | -- | -- | GAN-based generation of realistic 3D traffic environments for model training |

#### LiDAR Systems

| Patent Number | Title | Filed | Granted | Key Innovation |
|---|---|---|---|---|
| **US20230384451A1** | LiDAR sensor for object detection and ranging | -- | (Application) | FMCW LiDAR system using fiber optic ending with chirp signal for precise ranging |

#### Mapping and Localization

| Patent Number | Title | Filed | Granted | Key Innovation |
|---|---|---|---|---|
| **US11,908,198B2** | Generating graphical illustrations of point cloud frames for SLAM algorithms | -- | -- | Enhanced SLAM mapping using structured point cloud visualization |
| **US11,885,624B2** | Dynamic map updating system | -- | -- | System for predicting and managing changes in map entities over time |

#### Vehicle Safety and Control

| Patent Number | Title | Filed | Granted | Key Innovation |
|---|---|---|---|---|
| **US20190202467A1** | Emergency autonomous driving mode for assisted-driving vehicles | Jan 2018 | (Abandoned) | Dual-mode vehicle control for emergency scenarios; most-cited patent in portfolio (12 citations) |
| **US10,726,687B2** | Directed alert notification by autonomous-driving vehicle | Sep 2019 | Jul 2020 | Perceptibility-aware directed alerts to at-risk road users |
| **US10,578,716B1** | Sensor enclosure drainage | Oct 2018 | Mar 2020 | Self-cleaning sensor enclosure with drainage and optional spinning cover |
| **US10,647,250B1** | Directed acoustic alert from autonomous vehicles | Mar 2019 | May 2020 | Directed sound system for targeted pedestrian alerting |
| **US11,391,649** | Driving emulation system for autonomous vehicle | Sep 2019 | Jul 2022 | Motion platform synchronized with virtual driving simulation for training |
| **US11,676,236** | Systems and methods for autonomous passenger transport | Jul 2019 | Jun 2023 | Inter-vehicle coordination for autonomous fleet pickup management |

### Most-Cited Patents

| Patent Number | Citations | Citing Companies |
|---|---|---|
| US20190202467A1 | 12 | Mazda Motor Corp, Visteon Global Tech, Uber Technologies |
| US10,726,687B2 | 9 | Various automotive and technology companies |
| US10,578,716B1 | 9 | Various automotive companies |
| US20210026360A1 | 8 | Various |
| US10,647,250B1 | 6 | Various |

---

## 19. Key Publications

### NVIDIA Technical Blog (2022)

**"Accelerating the Pony AV Sensor Data Processing Pipeline"**

The most detailed public technical document about Pony.ai's perception infrastructure. Co-authored by Ke Li (Software Engineer, Pony.ai) and Petr Shepelev (Senior Systems Software Engineer, NVIDIA). Key disclosures:

- Complete sensor data processing pipeline architecture from raw sensor input to perception output
- GPU Direct RDMA implementation achieving ~6 GB/s FPGA-GPU bandwidth
- Custom protobuf `GpuData` field type for GPU-resident message passing
- GPU memory pool evolution: fixed-slot to CUDA 11.2 `cudaMemPool` (~2 us allocation)
- YUV420 native format adoption saving 50-67% GPU memory
- HEVC hardware encoding at ~3 ms per FHD image
- Structure-of-Array point cloud layout with CUB library optimization (~58% faster filtering)
- NVIDIA DRIVE Orin migration architecture
- ~4 ms critical path latency reduction
- ~80% GPU utilization across dual GPUs

### Pony.ai Safety Report (December 2020, updated March 2022)

Comprehensive safety documentation covering:

- Dual-path perception architecture (heuristic + deep learning)
- ISO 26262 functional safety methodology application
- Seven types of software redundancy
- Seven hardware component redundancies
- Five vehicle platform redundancies
- Over 1,000 monitoring mechanisms
- Over 20 safety redundancies
- Degraded operation and minimal risk condition procedures

### GTC Presentations

Pony.ai has presented at multiple NVIDIA GPU Technology Conferences, covering sensor data processing pipeline optimization and DRIVE Orin integration.

### SEC Filings (Form 20-F)

Pony.ai's annual report (filed April 25, 2025) contains technical descriptions of the Virtual Driver architecture, perception modules, and PonyWorld technology, though at a higher level than the NVIDIA Technical Blog.

### Industry Analysis

**maadaa.ai** published a two-part case study ("Towards BEV+Transformer based Autonomous Driving -- Case Study on Chinese Robotaxi") analyzing BEV-based perception architectures in Chinese robotaxi companies including Pony.ai, examining how the combination of BEV representation and Transformer architectures enables:
- Multi-source heterogeneous data fusion
- More accurate environmental perception
- Longer-term motion planning
- More comprehensive decision-making

### Academic Pedigree of Key Researchers

| Person | Background | Impact on Perception |
|---|---|---|
| **Tiancheng Lou (CTO)** | 2x Google Code Jam champion, Google X, Baidu AD (youngest T10 engineer), 93 patents | Elite algorithmic capability; drives perception algorithm design |
| **James Peng (CEO)** | PhD Stanford, Google Founder's Award, Baidu AD Chief Architect, 81 patents | Deep ML/systems research; shapes perception architecture |
| **Kevin Sheu** | Inventor on US11,250,240 (instance segmentation) | Cross-modal perception and auto-labeling |
| **Jie Mao** | Inventor on US11,250,240 | Cross-modal perception |
| **Cyrus F. Abari** | Inventor on US11,454,701 (sensor calibration) | Radar-based real-time calibration |

---

## 20. Perception for Chinese Road Conditions

### Unique Challenges

Pony.ai's perception system must handle traffic scenarios fundamentally different from those encountered in Western cities. The Chinese urban driving environment presents some of the most challenging perception problems in autonomous driving:

#### Mixed Traffic

| Road User | Perception Challenge |
|---|---|
| **E-bikes / electric scooters** | Small cross-section, high speed (20-40 km/h), erratic trajectory, often ignore traffic rules, ride on sidewalks and bike lanes interchangeably |
| **Three-wheelers** | Varied sizes and shapes, often loaded with oversized cargo that extends beyond vehicle boundaries |
| **Pedestrians** | Jaywalking common in many areas; groups cross outside crosswalks; distracted phone users |
| **Delivery riders** | Carry large packages that change vehicle silhouette; ride between lanes; stop unpredictably |
| **Loaded cargo vehicles** | Overloaded trucks with protruding cargo; agricultural vehicles with non-standard shapes |
| **Construction vehicles** | Moving construction equipment on public roads; novel vehicle types |

#### Road Environment

| Factor | Challenge |
|---|---|
| **Eight-lane intersections** | Massive intersections with complex signal phasing, multiple turning lanes, and heavy traffic |
| **Mixed-use roads** | Vehicles, bikes, e-bikes, and pedestrians sharing the same road space |
| **Narrow hutong/alley roads** | Extremely narrow passages in old city centers with limited maneuvering space |
| **Temporary road changes** | Frequent construction, road work, and temporary lane configurations in rapidly developing cities |
| **Non-standard markings** | Faded, partially obscured, or non-standard lane markings |
| **Underground parking** | GPS-denied environments requiring pure LiDAR/camera/radar perception |
| **Toll booths** | Complex narrow-lane navigation with overhead structures |

#### Weather and Lighting

| Condition | Challenge |
|---|---|
| **Monsoon rain** | Heavy rain degrades LiDAR and camera; radar becomes primary sensor |
| **Guangzhou heat/humidity** | Sensor fogging; thermal effects on LiDAR accuracy |
| **Beijing winter** | Snow coverage obscures lane markings and road boundaries |
| **Nighttime** | Darkness in poorly lit areas; headlight glare from oncoming traffic |
| **Dawn/dusk** | Rapidly changing lighting conditions; sun glare at low angles |

### How Pony.ai Addresses These Challenges

#### Multi-Sensor Redundancy for Active Sensing

Pony.ai explicitly differentiates from **vision-only** autonomous driving approaches (such as Tesla's camera-centric system). The company's position: active sensing technologies (LiDAR and radar) are essential for safe operation in Chinese urban environments because:

- **Pedestrians in dark clothing at night**: LiDAR detects them by geometry regardless of color/contrast. Cameras may miss them entirely.
- **E-bikes with minimal reflective surfaces**: LiDAR provides reliable detection. Radar provides velocity.
- **Headlight glare**: LiDAR and radar are unaffected by optical glare that can blind cameras.
- **Unlit roads**: Active sensors provide full perception capability independent of ambient illumination.

#### 24/7 All-Weather Operations

Pony.ai expanded from a 7am-11pm operating window to **full 24/7 operations** in Beijing, Guangzhou, and Shenzhen, demonstrating perception system robustness across:

- Bright daylight to pitch-black nighttime
- Heavy rain conditions
- Construction zone navigation
- Dense rush-hour traffic with mixed vehicle types

The fleet has logged **>500,000 hours of fully unmanned operations** and **>50 million kilometers of global autonomous testing**.

#### Self-Developed Sensor Cleaning System

The Gen-7 system includes Pony.ai's self-developed sensor cleaning solution that maintains perception accuracy in adverse conditions:

- Clears rain droplets, mud splashes, and road grime from LiDAR and camera lenses.
- Addresses a key operational challenge for 24/7 all-weather deployment.
- The Gen-6 sensor enclosure (patent US10,578,716) included a drainage ring plate with optional powered rotation to spin water off sensor covers.

#### Perception Performance Claims

Pony.ai claims its perception system achieves:

- **"Zero critical missing" perception**: The goal of detecting every safety-critical object.
- **"Anticipating all object trajectories with low latency"**: Real-time trajectory prediction for all detected agents.
- **"10x safer than human drivers"**: Based on comparative analysis of autonomous vs. human driving performance in equivalent conditions.
- Detection of **road features, signage, vehicles, and pedestrians from nearby blind spots to distances of up to 650 meters**.

#### Edge Case Handling

Specific challenging scenarios the system handles:

| Scenario | Perception Challenge | Approach |
|---|---|---|
| Narrow street stops | Tight spaces with obstacles on all sides | Near-range LiDAR (Bpearl) + ultrawide cameras |
| Emergency vehicle yielding | Detect and identify emergency vehicles by sound and visual cues | Microphones (4x) + camera detection of emergency lights |
| Sudden pedestrian intrusion | Jaywalking pedestrian appears from behind occlusion | Multi-sensor fusion with LiDAR for instant geometry detection |
| Low-light environments | Nighttime in unlit areas | LiDAR + radar primary; cameras secondary |
| Toll booth passages | Narrow lanes, overhead structures, complex geometry | Multi-sensor fusion with HD map priors |
| Construction zones | Temporary barriers, lane shifts, workers, equipment | Dynamic perception + HD map update pipeline |

---

## Sources

### Primary Sources (Pony.ai)
- [Pony.ai Technology Page](https://pony.ai/tech?lang=en)
- [Pony.ai Business Page](https://pony.ai/business?lang=en)
- [Pony.ai Safety Report (March 2022)](https://static.cdn.xiaomazhixing.com/file/1652065422385/ed5046fc-395a-46cf-a471-1728658f5001/Pony.ai%20safety%20report%20(Mar%2031%202022%20edit).pdf)
- [Pony.ai SEC Form 20-F (April 2025)](https://ir.pony.ai/static-files/fc31e148-b583-4234-a588-9853cdfbb47f)
- [Pony.ai Investor Relations](https://ir.pony.ai)

### NVIDIA Technical Documentation
- [Accelerating the Pony AV Sensor Data Processing Pipeline -- NVIDIA Developer Blog](https://developer.nvidia.com/blog/accelerating-the-pony-av-sensor-data-processing-pipeline/)
- [Van, Go: Pony.ai Robotaxi Fleet on DRIVE Orin -- NVIDIA Blog](https://blogs.nvidia.com/blog/pony-ai-robotaxi-fleet-drive-orin/)
- [Pony.ai: An NVIDIA Automotive Partner](https://www.nvidia.com/en-us/self-driving-cars/partners/pony-ai/)

### Sensor Technology
- [Four AT128 LiDAR from Hesai Selected for All Pony.ai Gen-7 Robotaxis -- Hesai](https://www.hesaitech.com/four-at128-lidar-sensors-from-hesai-selected-as-primary-lidar-for-all-pony-ai-seventh-generation-robotaxis/)
- [Hesai AT128 Product Page](https://www.hesaitech.com/product/at128/)
- [Hesai AT128 CES 2022 Showcase](https://www.prnewswire.com/news-releases/hesai-technology-showcases-new-automotive-grade-hybrid-solid-state-lidar-at128-at-ces-2022-301455561.html)
- [Pony.ai and RoboSense: Solving Safety Challenges for Long-Haul Trucking](https://www.robosense.ai/en/tech-show-143)
- [RoboSense Strategic Partnership with Pony.ai](https://www.businesswire.com/news/home/20221012005518/en/RoboSense-Reaches-Strategic-Partnership-with-Pony.ai-on-Full-Business-Chain)

### Press Releases and News
- [Gen-7 Robotaxi Lineup Unveil (April 2025)](https://ir.pony.ai/news-releases/news-release-details/pony-ai-inc-unveils-seventh-generation-robotaxi-lineup-targets)
- [Gen-7 Fleet Operations in Guangzhou/Shenzhen -- Gasgoo](https://autonews.gasgoo.com/articles/icv/70039684)
- [6th-Generation System Design -- Business Wire](https://www.businesswire.com/news/home/20220119006111/en/In-Its-Next-Significant-Milestone-for-L4-Robotaxis-Pony.ai-Debuts-Its-6th-Generation-Autonomous-Driving-System-Design)
- [24/7 Robotaxi Operation -- PR Newswire](https://www.prnewswire.com/news-releases/ponyai-kicks-off-247-robotaxi-operation-in-major-chinese-cities-302513843.html)
- [Moore Threads Partnership -- Gasgoo](https://autonews.gasgoo.com/articles/icv/ponyai-partners-with-moore-threads-to-accelerate-l4-autonomous-driving-with-domestic-ai-computing-2019659698460913665)
- [Pony.ai ADC on DRIVE Orin -- Business Wire](https://www.businesswire.com/news/home/20220622005809/en/Pony.ai-Autonomous-Driving-Controller-Built-on-NVIDIA-DRIVE-Orin-Set-for-Mass-Production)
- [Gen-7 1016 TOPS -- ChinaEVHome](https://chinaevhome.com/2025/11/10/pony-ai-debuts-seventh-gen-robotaxi-with-1016-tops-cuts-cost-70/)

### Patent Sources
- [Pony.ai Patents -- GreyB Analysis](https://insights.greyb.com/pony-ai-patents/)
- [Pony.ai Patent Filings -- USPTO Report](https://uspto.report/company/Pony-Ai-Inc/patents)
- [US11,250,240B1 -- Instance Segmentation -- Google Patents](https://patents.google.com/patent/US11250240B1/en)
- [US20190202467A1 -- Emergency Autonomous Driving -- Google Patents](https://patents.google.com/patent/US20190202467A1)
- [US10,726,687B2 -- Directed Alert Notification -- Google Patents](https://patents.google.com/patent/US10726687B2)
- [US10,578,716B1 -- Sensor Enclosure Drainage -- Google Patents](https://patents.google.com/patent/US10578716B1)
- [US10,647,250B1 -- Directed Acoustic Alert -- Google Patents](https://patents.google.com/patent/US10647250B1)
- [Patent for Training with Simulated 3D Traffic Data -- Verdict](https://www.verdict.co.uk/pony-ai-gets-grant-for-training-autonomous-driving-model-using-simulated-3d-traffic-data/)
- [Patent for LiDAR Sensor for Object Detection -- Verdict](https://www.verdict.co.uk/pony-ai-files-patent-for-lidar-sensor-for-object-detection-and-ranging/)
- [Patent for Vehicle Sensor Calibration -- Verdict](https://www.verdict.co.uk/pony-ai-gets-grant-for-vehicle-sensor-calibration-using-detected-static-objects/)
- [Pony.ai Patent Analysis -- Parola Analytics](https://parolaanalytics.com/parolanews/ponyai-robotaxi-patents-china/)

### Industry Analysis
- [Towards BEV+Transformer Autonomous Driving: Chinese Robotaxi Case Study -- maadaa.ai](https://maadaa-ai.medium.com/towards-bev-transformer-based-autonomous-driving-case-study-on-chinese-robotaxi-part-2-b459983bb49b)
- [Inside Pony.ai's Staying Power -- KrASIA](https://kr-asia.com/inside-pony-ais-staying-power-and-the-mindset-of-its-cto-lou-tiancheng)
- [Gen-7 Cost Analysis -- AInvest](https://www.ainvest.com/news/pony-ai-seventh-generation-robotaxi-cost-effective-leap-autonomous-driving-dominance-2504/)
- [IPO Analysis -- Futunn](https://news.futunn.com/en/post/64478832/behind-the-record-breaking-ipo-pony-ai-02026-hk-ponyus)
