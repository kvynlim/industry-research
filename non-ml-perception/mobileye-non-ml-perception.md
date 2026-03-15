# Mobileye Non-ML and Hybrid-ML Perception Techniques: Exhaustive Deep Dive

*Last updated: March 2026*

---

## Table of Contents

1. [EyeQ Classical Vision Accelerators](#1-eyeq-classical-vision-accelerators)
2. [Mobileye's Classical CV Heritage](#2-mobileyes-classical-cv-heritage)
3. [RSS Formal Methods Deep Dive](#3-rss-formal-methods-deep-dive)
4. [REM Geometric Methods](#4-rem-geometric-methods)
5. [Sensor Processing](#5-sensor-processing)
6. [Depth Estimation Classical Methods](#6-depth-estimation-classical-methods)
7. [State Estimation](#7-state-estimation)
8. [Hybrid ML + Classical](#8-hybrid-ml--classical)
9. [Key References](#9-key-references)

---

## 1. EyeQ Classical Vision Accelerators

### 1.1 VMP (Vector Microcode Processor) -- Classical Vision Processing Unit

The VMP is Mobileye's longest-running accelerator lineage, present in every EyeQ generation from EyeQ2 (2010) onward. It is a dedicated classical vision processing unit purpose-built for vectorizable, regular-pattern computation on image data.

#### Architecture

- **ISA**: SIMD (Single-Instruction Multiple-Data) combined with VLIW (Very-Long Instruction Word)
- **Data parallelism**: Multiple operations packed into a single wide instruction word, each operating on vectors of data simultaneously
- **Data types**: Optimized for short integral types (8-bit, 16-bit) common in classical computer vision -- gradient magnitudes, histogram bins, filter coefficients, pixel intensities
- **Toolchain**: Fully proprietary, developed in-house over 15+ years, co-designed with Mobileye's ADAS software and SoCs

#### EyeQ Generational Deployment

| Generation | Year | VMP Core Count | Notes |
|------------|------|----------------|-------|
| EyeQ2 | 2010 | 3 VMPs | First generation with VMP; paired with 5 Vision Computing Engines |
| EyeQ3 | 2014 | 4 VMPs | New-generation VMP cores; 64 MAC units per core at 500 MHz |
| EyeQ4 | 2018 | 6 VMPs | Same VMP design carried from EyeQ2/3; proven, mature IP |
| EyeQ5 | 2021 | Multiple VMPs | Part of 18 next-generation vision processor cores |
| EyeQ6H | 2025 | VMPs included | Part of heterogeneous accelerator mix |
| EyeQ Ultra | 2025+ | Multiple VMPs | Among 64 total accelerator cores |

#### Classical Algorithms on VMP

The VMP's SIMD/VLIW architecture is specifically suited for:

- **FFT (Fast Fourier Transform)**: Core processing step for radar and ultrasonic sensor data; the VMP performs range-FFT and Doppler-FFT on raw FMCW radar antenna data
- **Digital beamforming**: The VMP computes spatial FFTs across virtual antenna channels to estimate direction of arrival (azimuth and elevation) for the imaging radar's 1,500+ virtual channels
- **Image filtering**: Convolutions with fixed kernels (Sobel, Gaussian, Laplacian) for edge detection and noise reduction -- regular data access patterns map efficiently to SIMD execution
- **Histogram computation**: HOG (Histogram of Oriented Gradients) descriptor computation requires binning gradient magnitudes and orientations across cells -- a vectorizable scatter-add pattern
- **Template matching**: Normalized cross-correlation between image patches and stored templates for sign recognition and landmark matching
- **Optical flow**: Lucas-Kanade or block-matching optical flow algorithms use sliding window gradient computations that align with VMP's vector processing model

The VMP is particularly critical for the radar/LiDAR subsystem: all FFT-based signal processing for the imaging radar runs on VMP accelerators, making the VMP the computational backbone of the non-camera True Redundancy channel.

#### Why VMP Persists Alongside Neural Accelerators

Even on EyeQ Ultra with 176 TOPS of neural compute (XNN), VMP remains essential because:

1. **Radar signal processing is inherently non-neural**: Range-Doppler processing, beamforming, and CFAR detection are mathematical transforms, not learned functions
2. **Deterministic latency**: VMP executes fixed algorithms with predictable timing -- critical for safety-certified signal processing pipelines
3. **Power efficiency**: Running FFTs on a purpose-built SIMD engine consumes far less power than repurposing a neural accelerator for the same operation
4. **ISP augmentation**: Some ISP preprocessing steps (debayering, demosaicing edge cases) overflow from the dedicated ISP block to VMP

### 1.2 MPC (Multithreaded Processing Cluster)

The MPC was introduced in EyeQ4 (2018) as a new accelerator class complementing VMP and PMA.

#### Architecture

- **Design**: Barrel-threaded (hardware multi-threaded) CPU cores
- **Thread switching**: Hardware switches between threads on every cycle, hiding memory latency and keeping execution units fully utilized
- **Specialization**: Handles control-flow-heavy algorithms that require complex conditional branching -- workloads unsuited for VMP's SIMD model or XNN's dataflow architecture

#### Classical Workloads on MPC

- **Object tracking state management**: Kalman filter updates, track creation/deletion, association logic (Hungarian algorithm, nearest-neighbor assignment) -- these require per-object conditional branching
- **Non-Maximum Suppression (NMS)**: Post-CNN detection cleanup involves sorting, threshold comparison, and overlap computation -- iterative algorithms with data-dependent control flow
- **Constellation formation**: For RSS, the MPC constructs pairwise ego-object "constellation" descriptors from the perception output list, computing geometric relationships (longitudinal distance, lateral distance, lane assignment, right-of-way status)
- **Data marshaling**: Moving data between accelerators (XNN output to MPC for post-processing, MPC output to VMP for radar integration)
- **RSS computation**: The RSS safety check is a rule-based computation with conditional logic (if distance < d_min, compute proper response) -- a control-flow-intensive workload ideal for MPC
- **Map tile management**: Loading, decoding, and indexing REM Roadbook tiles for the 200 m lookahead window

The MPC is described as "more versatile than a GPU or any other OpenCL accelerator, and with higher efficiency than any CPU." Its barrel-threading design means it achieves high throughput on heterogeneous workloads without the power overhead of out-of-order execution logic.

#### EyeQ4 Configuration

EyeQ4 includes 2 MPC cores alongside 6 VMPs and 2 PMAs, for a total of 10 specialized vector accelerators plus 4 MIPS CPU cores. The MPC handles the "glue logic" between detection (XNN) and action (planning).

### 1.3 PMA (Programmable Macro Array) -- CGRA

The PMA is a Coarse-Grained Reconfigurable Architecture (CGRA) -- a dataflow processing fabric.

#### Architecture

- **Design**: An array of processing elements connected by a configurable interconnect
- **Programming model**: Programmed at the macro-operation level (not individual instructions like a CPU, and not at the gate level like an FPGA)
- **Compute density**: Approaches fixed-function hardware accelerator efficiency while maintaining full programmability -- "unachievable in the classic DSP architecture, without sacrificing programmability"
- **EyeQ4**: 2 PMA cores
- **EyeQ5**: Multiple PMA cores among 18 vision processor cores
- **EyeQ Ultra**: 8 PMA CGRA cores

#### Classical and Hybrid Workloads on PMA

- **Feature pyramid construction**: Building multi-scale image representations (Gaussian pyramids, Laplacian pyramids) through successive filtering and downsampling -- dense, regular operations ideal for dataflow execution
- **Image normalization**: Mean subtraction, variance normalization, and histogram equalization across image tiles
- **Dense computer vision algorithms**: Feature extraction operations that are too regular for MPC (wasted branching logic) but too diverse for VMP (require more flexible interconnects)
- **ISP preprocessing overflow**: When the dedicated ISP cannot handle all preprocessing in real-time, PMA absorbs overflow tasks -- adaptive tone mapping, complex noise reduction, lens geometric distortion correction
- **Neural network execution**: PMA cores can also run deep neural networks "extremely efficiently," making them a swing resource that can be allocated to either classical or neural workloads depending on the processing phase

The PMA bridges the gap between fully fixed-function hardware (maximum efficiency but zero flexibility) and general-purpose processors (maximum flexibility but poor efficiency). For classical vision operations like feature pyramid construction, this is the optimal computational sweet spot.

### 1.4 Classical vs. Neural Workload Split

The EyeQ perception pipeline divides work between classical and neural processors based on the fundamental nature of each algorithm:

```
CLASSICAL PROCESSING (VMP, MPC, PMA)          NEURAL PROCESSING (XNN)
====================================          =========================
ISP: debayering, HDR, noise reduction         Object detection CNNs
Feature pyramids (PMA)                        Semantic segmentation
FFT for radar (VMP)                           Depth estimation networks
Beamforming (VMP)                             Lane detection (3D-LaneNet)
CFAR detection (VMP)                          Traffic sign classification
Kalman filter tracking (MPC)                  ViDAR point cloud prediction
NMS post-processing (MPC)                     BEV feature lifting
RSS computation (MPC/CPU)                     Appearance feature extraction
REM localization (MPC)                        Road type classification
Constellation formation (MPC)
Map tile management (MPC)
Ego-motion computation (MPC/CPU)
Self-calibration (MPC/CPU)
```

The ratio shifts dramatically across EyeQ generations:

- **EyeQ1-3** (2008-2014): ~90% classical, ~10% early ML (Adaboost classifiers, SVMs)
- **EyeQ4** (2018): ~50% classical, ~50% neural (first generation with dedicated XNN CNN accelerator)
- **EyeQ5-6** (2021-2025): ~30% classical, ~70% neural (deep learning dominates perception, but classical processing persists for radar, tracking, calibration, RSS)
- **EyeQ Ultra** (2025+): ~20% classical, ~80% neural -- but the 20% classical is irreducible: radar signal processing, formal safety checks, and state estimation cannot be replaced by neural networks while maintaining safety certification

The key insight is that Mobileye's architecture is not "neural networks with some classical leftovers" -- it is a principled co-design where each algorithm type runs on hardware specifically optimized for its computational pattern.

---

## 2. Mobileye's Classical CV Heritage

### 2.1 Pre-Deep-Learning ADAS (EyeQ1/2/3 Era, 2008-2017)

Mobileye shipped production ADAS -- lane departure warning, forward collision warning, pedestrian detection, traffic sign recognition -- for nearly a decade before deep learning became practical on embedded hardware. This entire period relied on classical computer vision algorithms running on purpose-built vision processors.

#### EyeQ1 (2008): Birth of Camera-Based ADAS

- **Process**: 180 nm
- **Architecture**: Proprietary vision processing cores (pre-VMP generation)
- **Capabilities**: Lane Departure Warning, Forward Collision Warning, Traffic Sign Recognition, Adaptive Headlight Control
- **Algorithms**: Hand-crafted vision algorithms -- edge detection for lane lines, template matching for signs, scale-change-based distance estimation for vehicles
- **Significance**: Proved that a single camera on a $50 chip could replace $500+ radar systems for basic ADAS. At the time, the automotive industry considered camera-only ADAS impossible.

#### EyeQ2 (2010): Pedestrian Detection

- **Process**: 90 nm CMOS at 332 MHz
- **Architecture**: 2 hyper-threaded MIPS 34K 64-bit RISC CPUs + 5 Vision Computing Engines (VCE) + 3 Vector Microcode Processors (VMP)
- **Memory**: 512 KB on-chip ISRAM, 128-bit internal Sonics interconnect, 64-bit Mobile DDR controller, 16 DMA channels
- **I/O**: 2 input video channels (up to 4000x2000 pixels), 1 output video channel with synthetic graphic overlay; 2x CAN, 2x UART, I2C, 32 GPIO
- **Key advance**: First reliable pedestrian detection from a monocular camera -- the critical enabler for AEB (Automatic Emergency Braking)
- **One CPU** manages the 5 VCEs, 3 VMPs, and DMA; the **second CPU** manages peripherals and host communication

The EyeQ2's pedestrian detection used the classical detection pipeline dominant in the 2008-2012 era:

1. **Feature extraction**: Histogram of Oriented Gradients (HOG) computed over dense grid cells across candidate image windows
2. **Classification**: Linear SVM or Adaboost classifier trained on positive (pedestrian) and negative (background) examples
3. **Multi-scale scanning**: Sliding window at multiple scales, with the image pyramid processed by the VCEs
4. **Non-maximum suppression**: Overlapping detections merged into single bounding boxes

#### EyeQ3 (2014): Multi-Camera Surround

- **Process**: 40 nm
- **Architecture**: 4 multi-threaded MIPS32 cores + 4 new-generation VMP cores (64 MAC units per core, 500 MHz)
- **Performance**: ~0.25 TOPS; 80% utilization efficiency; approximately 102 MMACS (million multiply-accumulate operations per second) per core
- **Key advance**: Multi-camera input (first surround-view capable EyeQ); L2 safety cocoon capability

By EyeQ3, Mobileye's classical detection pipeline had matured to include:
- **Deformable Part Models (DPMs)**: Extension of HOG+SVM that models objects as collections of parts with spatial relationships -- improved detection of partially occluded pedestrians and vehicles in unusual poses
- **Integral Channel Features (ICF)**: Generalization of Haar-like features to multiple channels (gradient magnitude, gradient orientation, LUV color) with boosted classifiers -- faster than HOG+SVM with comparable accuracy
- **Cascaded classifiers**: Multi-stage detection where cheap initial stages reject obvious negatives, and expensive later stages refine detections -- critical for real-time performance on 0.25 TOPS hardware

### 2.2 Lane Detection Classical Methods

Lane detection was Mobileye's founding capability, shipping on EyeQ1 in 2008. The classical pipeline evolved over three EyeQ generations:

#### Edge Detection and Gradient Analysis

The first stage identifies candidate lane marking pixels using classical edge detection:

1. **Directional Sobel filtering**: Horizontal and vertical gradient computation to find edges aligned with expected lane marking orientations
2. **Gradient thresholding**: Strong gradient responses in the lower half of the image (where road surface appears) are candidate lane pixels
3. **Color-based filtering**: Lane markings are typically white or yellow against dark asphalt -- simple color ratio thresholds in YUV or HSV space provide additional discrimination

#### Inverse Perspective Mapping (IPM)

The camera's perspective projection compresses distant lane markings into near-horizontal lines at the top of the image. IPM applies a homography to transform the image into a bird's-eye-view (BEV), where:

- Parallel lane markings become parallel lines (removing perspective foreshortening)
- Lane marking width becomes approximately constant
- Lane detection reduces to finding straight or gently curved lines in a rectified image

The IPM homography is computed from camera intrinsic parameters (focal length, principal point) and extrinsic parameters (height above road, pitch angle, yaw angle). Mobileye's self-calibration system (Section 7.3) continuously refines these parameters, ensuring accurate IPM even as the vehicle's suspension settles.

#### Hough Transform Lane Finding

After IPM, the classical Hough transform (or probabilistic Hough transform) detects line segments:

1. Each edge pixel votes in (rho, theta) parameter space
2. Accumulator peaks correspond to dominant line segments
3. Multiple peaks identify multiple lane boundaries

The Hough transform is robust to gaps in lane markings (dashed lines) because it accumulates votes from all contributing pixels regardless of continuity.

#### RANSAC Lane Fitting

For curved lanes (highway curves, ramps), the Hough transform's linear model is insufficient. RANSAC (Random Sample Consensus) fits polynomial or spline models:

1. Randomly sample a minimal set of lane candidate points
2. Fit a polynomial model (typically cubic: y = a0 + a1*x + a2*x^2 + a3*x^3)
3. Count inlier points within a threshold distance of the fitted curve
4. Iterate; accept the model with the most inliers
5. Refit using all inliers for the final lane curve

#### Polynomial Lane Model

Mobileye's classical lane representation uses 3rd-degree polynomials in the vehicle coordinate system:

```
Lateral_offset(x) = a0 + a1*x + a2*x^2 + a3*x^3
```

Where:
- **x**: longitudinal distance ahead of the vehicle
- **a0**: lateral offset at the vehicle (lane position)
- **a1**: heading angle relative to the lane
- **a2**: half the lane curvature (1/R)
- **a3**: curvature rate (clothoid parameter)

This representation is compact (4 coefficients per lane boundary), computationally efficient for downstream path planning, and suitable for highway driving where lanes follow smooth curves. The Mobileye 560/630 aftermarket systems output these polynomial coefficients directly.

#### Spline Fitting

For more complex road geometries (intersections, merges, S-curves), B-spline fitting replaces polynomials:

1. Control points are placed along detected lane marking points
2. A B-spline curve is fitted that passes near (not necessarily through) the control points
3. The spline's smoothness constraint prevents overfitting to noise
4. Multiple spline segments can be joined to represent long, complex lane geometries

#### Kalman Filter Lane Tracking

Between frames, a Kalman filter tracks the lane model parameters:

- **State vector**: [a0, a1, a2, a3, da0/dt, da1/dt] -- lane position coefficients and their time derivatives
- **Prediction**: Based on vehicle motion (ego-motion compensated) and expected road geometry evolution
- **Update**: New lane detections update the tracked model, with Kalman gain balancing measurement noise against prediction confidence
- **Benefits**: Smooths noisy per-frame detections, bridges gaps in dashed markings, maintains lane model through brief occlusions (vehicles crossing lane lines)

#### Evolution to Neural Lane Detection

Mobileye's 2019 3D-LaneNet (ICCV 2019) replaced the classical pipeline with an end-to-end neural network that includes an internal Inverse Perspective Mapping layer -- preserving the geometric insight of IPM while learning the feature extraction and fitting jointly. However, the polynomial lane representation in the output remains the same classical mathematical model, and Kalman filter tracking still operates on the neural network's output. The neural network replaced feature extraction and fitting; the geometric representation and temporal filtering remain classical.

### 2.3 Vehicle Detection Classical Methods

#### HOG+SVM Vehicle Detection (EyeQ1-3 Era)

The foundational vehicle detection pipeline on early EyeQ generations followed the Dalal-Triggs framework:

1. **Image pyramid**: Construct a multi-scale pyramid (typically 10-20 scales) to detect vehicles at various distances
2. **HOG feature extraction**: At each scale, slide a detection window across the image. For each window position:
   - Compute gradient magnitude and orientation at each pixel
   - Accumulate gradients into orientation histograms over 8x8 pixel cells
   - Normalize histograms over 2x2 cell blocks (128-dimensional descriptor per block)
   - Concatenate block descriptors into a feature vector (typically 3780 dimensions for a 64x128 window)
3. **SVM classification**: A pre-trained linear SVM classifies each window as "vehicle" or "non-vehicle"
4. **Non-maximum suppression**: Overlapping detections are merged

This pipeline ran at approximately 10-15 FPS on EyeQ2's 3 VMPs + 5 VCEs at 332 MHz -- sufficient for ADAS applications with 0.5-1 second response time requirements.

#### Sliding Window Efficiency

Brute-force sliding window at 20 scales x thousands of positions per scale is computationally prohibitive. Mobileye optimized this through:

- **Attention cascade**: Cheap features (simple edge presence, symmetry) rapidly reject 95%+ of candidate windows before expensive HOG computation
- **Region of interest (ROI)**: Lane detection provides a road mask; only windows overlapping the road surface are evaluated
- **Scale-space priors**: At each image row, the expected vehicle scale is known from camera geometry -- only nearby scales are evaluated
- **Integral histogram caching**: Precomputed integral histograms accelerate HOG computation for overlapping windows

#### Haar Cascades and Adaboost

Complementing HOG+SVM, Mobileye also deployed Viola-Jones-style cascaded classifiers:

1. **Haar-like features**: Simple rectangular features (difference of sums over image regions) computed efficiently via integral images
2. **Adaboost feature selection**: A boosted classifier selects the most discriminative Haar features from a large pool, building a cascade of increasingly selective stages
3. **Cascade rejection**: Early stages use few features to quickly reject non-vehicle windows; later stages use many features for fine discrimination
4. **Speed advantage**: The cascade rejects >99% of windows in the first few stages, achieving much faster throughput than HOG+SVM at a modest accuracy cost

The Haar cascade was typically used for initial candidate generation (high recall, modest precision), followed by HOG+SVM verification on candidate regions (high precision).

#### Transition to Deep Learning

EyeQ4 (2018) introduced the XNN deep learning accelerator, enabling CNN-based vehicle detection. The transition was not instant:

- **EyeQ4 early software**: Hybrid pipeline with classical candidate generation + CNN verification
- **EyeQ4 mature software**: Full CNN detection, with classical features retained as redundant backup
- **EyeQ5+**: CNN-only primary detection, but classical geometric verification (size consistency, motion plausibility) remains as a sanity check

### 2.4 Pedestrian Detection Classical Methods

Pedestrian detection was EyeQ2's (2010) flagship capability, arriving before deep learning was practical on embedded hardware.

#### Dalal-Triggs HOG+SVM for Pedestrians

The seminal Dalal-Triggs (CVPR 2005) pedestrian detector was the state-of-the-art when Mobileye developed EyeQ2:

1. **HOG descriptor**: Computed over a 64x128 pixel window, producing a 3780-dimensional feature vector
2. **Linear SVM**: Trained on INRIA pedestrian dataset and augmented with Mobileye's proprietary driving data
3. **Multi-scale scanning**: Image pyramid with ~1.2x scale factor between levels
4. **Key insight**: HOG captures the characteristic human silhouette (head-shoulder contour, leg separation, vertical symmetry) without requiring explicit body part modeling

#### Integral Channel Features (ICF) and Aggregated Channel Features (ACF)

Mobileye's later EyeQ2/3 software likely incorporated Integral Channel Features, the successor to HOG+SVM that offered better speed-accuracy tradeoff:

1. **Multiple channels**: Gradient magnitude, 6 gradient orientation channels, 3 LUV color channels = 10 channels total
2. **Boosted features**: Adaboost selects features defined as sums/differences over rectangular regions in any channel (computed via integral images for speed)
3. **Scale-space approximation**: ACF approximates the feature pyramid by rescaling features from nearby scales, reducing computation by ~10x
4. **Speed**: ACF achieves near-real-time (10-30 FPS) on modest hardware while matching or exceeding HOG+SVM accuracy

#### Deformable Part Models (DPMs)

For detecting partially occluded pedestrians (a critical ADAS requirement -- pedestrians stepping out from behind vehicles), DPMs extended the HOG framework:

1. **Root filter**: A coarse HOG template covering the full pedestrian
2. **Part filters**: Fine-resolution HOG templates for specific body parts (head, torso, legs)
3. **Deformation cost**: A spatial model allows parts to shift relative to the root, accommodating pose variation and partial occlusion
4. **Latent SVM training**: Parts are discovered automatically during training as latent variables

DPMs were computationally expensive but provided critical capability for detecting pedestrians visible only as a head above a vehicle hood, or legs visible beneath a truck.

#### Pedestrian Detection Accuracy in Classical Era

Mobileye's classical pedestrian detection achieved sufficient performance for production AEB:

- Detection range: 40-60 m (limited by image resolution and HOG feature sensitivity)
- Latency: 100-200 ms (including multi-frame confirmation)
- False positive rate: Low enough for automatic braking deployment (validated through extensive field testing with BMW, GM, Volvo)

The Insurance Institute for Highway Safety (IIHS) confirmed that AEB with Mobileye's classical pedestrian detection reduced pedestrian collision rates by over 25%.

---

## 3. RSS (Responsibility-Sensitive Safety) -- Formal Methods Deep Dive

RSS is the purest non-ML component in Mobileye's entire autonomous driving stack. It is a mathematical framework with zero learned components -- every computation is a closed-form formula derived from Newtonian kinematics and formal logic.

### 3.1 RSS Mathematical Framework

#### The Core Problem

RSS answers a precisely defined question: "Given the current state of the ego vehicle and all detected objects, what is the set of actions the ego vehicle can take such that it is mathematically guaranteed not to cause a collision?"

The answer is formulated as five rules, each providing:
1. A **safe distance** formula (the minimum separation that guarantees collision avoidance)
2. A definition of **dangerous situation** (when the safe distance is violated)
3. A **proper response** (the action the ego vehicle must take to restore safety)

#### Rule 1: Safe Longitudinal Distance (Same Direction)

The minimum safe longitudinal distance between a rear vehicle and a front vehicle, both traveling in the same direction, is:

```
d_min^long = [ v_r * rho + (1/2) * a_max_accel * rho^2
             + (v_r + rho * a_max_accel)^2 / (2 * a_min_brake)
             - v_f^2 / (2 * a_max_brake) ]^+
```

Where `[x]^+ = max(x, 0)` and:

| Symbol | Meaning | Typical Value |
|--------|---------|---------------|
| v_r | Rear (ego) vehicle velocity | measured |
| v_f | Front vehicle velocity | measured |
| rho | Response time | 1 s (ego AV), 2 s (assumed human other) |
| a_max_accel | Maximum acceleration during response time | 3.5 m/s^2 |
| a_min_brake | Minimum comfortable braking of ego | 4 m/s^2 |
| a_max_brake | Maximum braking of front vehicle | 8 m/s^2 |

**Derivation intuition**: The formula computes the worst-case stopping distance of the rear vehicle (assuming it accelerates maximally during response time rho, then brakes at minimum comfortable deceleration) minus the minimum stopping distance of the front vehicle (assuming it brakes maximally). If this quantity is positive, that distance must be maintained; if negative, safety is inherently satisfied regardless of distance.

**Physical interpretation of each term**:
- `v_r * rho`: Distance the rear vehicle travels at constant speed during response time
- `(1/2) * a_max_accel * rho^2`: Additional distance if the rear vehicle accelerates during response time
- `(v_r + rho * a_max_accel)^2 / (2 * a_min_brake)`: Stopping distance of the rear vehicle from its speed at end of response time
- `v_f^2 / (2 * a_max_brake)`: Minimum stopping distance of the front vehicle

**Numerical examples** (from Genesis GV80 calibration study):

| Speed (both vehicles) | d_min^long |
|----------------------|------------|
| 30 km/h | 6.07 m |
| 60 km/h | 29.27 m |
| 100 km/h | 83.37 m |
| 130 km/h | 139.42 m |

#### Rule 2: Safe Lateral Distance

The minimum safe lateral distance between two vehicles side by side is:

```
d_min^lat = [ mu + (c1_lat_dist) - (c2_lat_dist) ]^+
```

Where the lateral distance components account for lateral velocities, lateral acceleration during response time, and lateral braking capability. The key parameters are:

| Symbol | Meaning | Typical Value |
|--------|---------|---------------|
| a_min_brake^lat | Lateral braking deceleration | 0.8 m/s^2 |
| a_max_accel^lat | Maximum lateral acceleration | 0.2 m/s^2 |
| delta_min^lat | Lateral fluctuation margin | 0.1 m (10 cm) |
| mu | Vehicle width parameter | ~2.0 m |

The asymmetry between lateral braking (0.8 m/s^2) and lateral acceleration (0.2 m/s^2) is deliberate: it "allows for faster lane changes" while maintaining conservative safety margins. With standard 3-meter lane widths and 2-meter vehicle widths, the available lateral margin is approximately 0.5 meters, requiring precise lateral control.

A lane change requires at minimum a duration of twice the response time -- the vehicle must accelerate laterally for one response period, then decelerate for another.

#### Rule 3: Right of Way

"Right of way is given, not taken."

Even when the ego vehicle has legal right of way (green light, priority road), RSS requires it to respond safely if another vehicle violates right-of-way rules. Formally:

- The ego vehicle computes safe distances assuming the other vehicle will yield
- If the other vehicle does not yield (detected through velocity/trajectory analysis), the ego vehicle must initiate proper response as if right of way does not exist
- This rule prevents the ego vehicle from "legally but unsafely" maintaining course when another vehicle runs a red light or ignores a yield sign

#### Rule 4: Limited Visibility (Occlusion Handling)

When perception cannot see into an occluded region, RSS assumes a potential hazard exists:

```
v_max_limited = sqrt(2 * a_min_brake * d_visible)
```

Where d_visible is the distance into the occluded region that can be seen. The ego vehicle must limit its speed such that it could stop within the visible distance if a hazard appears at the visibility boundary.

**Practical implications**:
- Approaching a blind corner: speed is limited by the distance around the corner that can be seen
- Passing a parked truck: speed is limited by the sightline past the truck
- Near schools or parking areas: RSS parameters are tightened (shorter assumed response time for pedestrians, lower assumed maximum speed for appearing hazards)

This is a formal encoding of "absence of evidence is not evidence of absence" -- the system treats unseen regions conservatively regardless of how confident the perception is in the visible region.

#### Rule 5: Evasive Action

When a dangerous situation is imposed so suddenly that collision cannot be avoided by braking alone:

- The ego vehicle must take evasive action (steering) if it can safely do so
- Evasive action is permitted only if it does not cause a different collision
- The vehicle must steer to increase safety (lateral distance) while maintaining the best achievable longitudinal safety

### 3.2 RSS Parameters -- Calibration and Sensitivity

#### Parameter Categories

RSS parameters divide into two categories:

**Fixed parameters** (properties of the ego vehicle):
- Response time rho_ego: ~1 second for AV systems (perception latency + actuation latency)
- a_min_brake: Minimum comfortable braking -- typically 4 m/s^2 (what the vehicle can reliably achieve)
- a_max_brake_ego: Maximum emergency braking -- typically 8-10 m/s^2 (tire-road friction limited)

**Assumed parameters** (properties of other road users):
- rho_other: Response time of other vehicles -- conservatively 2 seconds (assumes human driver)
- a_max_accel: Maximum acceleration other vehicles might achieve -- 3.5 m/s^2 (standard car); higher for sports cars
- a_max_brake_other: Maximum braking of other vehicles -- 8 m/s^2 (modern vehicle capability)

#### Parameter Sensitivity

The RSS safe distance is highly sensitive to parameter choices:

- **Acceleration during response time**: Setting a_max_accel to 4 m/s^2 roughly doubles the required safety distance compared to 0 m/s^2 at city speeds (from ~40 m to ~80 m)
- **Response time**: Each 0.1 s increase in rho adds approximately v_r * 0.1 meters to the required safe distance
- **Braking asymmetry**: A large gap between a_min_brake and a_max_brake produces very conservative (defensive) driving; a small gap allows more aggressive following

#### Calibration Approaches

RSS parameters are "implemented as configuration values" and can be adjusted post-deployment:

1. **German driving school rule of thumb**: a_min_brake = 4 m/s^2 (comfortable), a_max_brake = 8 m/s^2 (emergency) -- these are the standard reference values
2. **Vehicle-specific calibration**: Using chassis dynamometer testing to determine actual braking capability (e.g., Genesis GV80 3.5T: a_max_accel = 5.05 m/s^2 from 0-100 km/h in 5.5 seconds)
3. **Naturalistic driving study calibration**: Using NSGA-II multi-objective optimization to find parameter sets that best match human driving behavior from large-scale naturalistic driving data
4. **Road-condition adjustment**: Parameters can be dynamically adjusted for wet roads (reduced a_max_brake), icy conditions (reduced all braking parameters), or construction zones (increased rho)

### 3.3 RSS Geometric Computation

#### Dangerous Situation Detection

A situation is classified as "dangerous" if AND only if:
1. The longitudinal distance is less than d_min^long AND
2. The lateral distance is less than d_min^lat

This is a purely geometric check: compute two distances from perception outputs, compare each against its formula-derived threshold, AND the results. No learning, no probability distributions -- a deterministic boolean decision.

#### Constellation Formation

For each detected object, RSS constructs a "constellation" -- a pairwise geometric description:

```
Constellation = {
    longitudinal_distance,   // metric distance along ego heading
    lateral_distance,        // metric distance perpendicular to ego heading
    relative_longitudinal_velocity,  // v_ego - v_object (along heading)
    relative_lateral_velocity,       // lateral velocity difference
    lane_relationship,       // {same_lane, adjacent, oncoming, crossing}
    right_of_way_status,     // {ego_priority, other_priority, unclear}
    visibility_status,       // {fully_visible, partially_occluded, in_blind_spot}
    object_classification,   // {vehicle, pedestrian, cyclist, ...}
    object_dimensions        // {length, width, height}
}
```

The MPC accelerator on EyeQ constructs these constellations from the perception output list. For N detected objects, N constellations are computed (one per object-ego pair).

#### Proper Response Computation

When a constellation enters the "dangerous" state, RSS computes acceleration limits:

```
Proper_Response = {
    a_lon_min,   // minimum allowed longitudinal acceleration (negative = must brake at least this hard)
    a_lon_max,   // maximum allowed longitudinal acceleration (may be negative = cannot accelerate)
    a_lat_min,   // minimum allowed lateral acceleration
    a_lat_max    // maximum allowed lateral acceleration
}
```

The proper response for each constellation is computed independently. The overall proper response is the intersection (most restrictive combination) of all per-object proper responses:

```
a_lon_min_total = max(a_lon_min for each constellation)
a_lon_max_total = min(a_lon_max for each constellation)
a_lat_min_total = max(a_lat_min for each constellation)
a_lat_max_total = min(a_lat_max for each constellation)
```

The planning layer must generate trajectories within this constraint envelope. Any trajectory satisfying all constraints is provably safe with respect to RSS.

### 3.4 RSS as Perception Consumer

RSS does not process raw sensor data. It consumes structured perception outputs and imposes rigid requirements on perception quality:

| Perception Requirement | Why RSS Needs It | Consequence of Failure |
|----------------------|-----------------|----------------------|
| Object position accuracy (< 0.5 m) | Directly enters d_min comparison | Overestimated distance -> insufficient braking |
| Object velocity accuracy (< 0.5 m/s) | Directly enters safe distance formula | Underestimated relative speed -> d_min too small |
| Object classification | Determines applicable RSS rule set | Wrong class -> wrong parameters (pedestrian vs. vehicle) |
| Lane model accuracy | Determines lane relationship in constellation | Wrong lane assignment -> wrong rule applied |
| Complete detection (recall > 99.99%) | Undetected object has no constellation | Missed hazard -> no RSS protection |
| Bounded latency (< 100 ms) | Enters response time rho | Higher latency -> larger rho -> more conservative driving |

True Redundancy directly addresses the recall requirement: if either the camera subsystem or the radar/LiDAR subsystem detects an object, an RSS constellation is created for it.

### 3.5 RSS Formal Verification

#### Mathematical Proofs

RSS's core claim is that compliance with all five rules guarantees that the ego vehicle will not cause a collision. This is established through mathematical proof:

**Theorem (informal)**: If the ego vehicle maintains safe longitudinal and lateral distances (as defined by the RSS formulas) relative to all detected objects, and follows the prescribed proper response whenever a dangerous situation arises, then the ego vehicle cannot be the cause of a collision.

**Proof structure**:
1. For each rule, the safe distance formula is derived from worst-case kinematic analysis (assuming adversarial behavior from other road users within physical limits)
2. If the ego vehicle follows the proper response, it is shown by kinematic calculation that it can always stop or maneuver to avoid the collision
3. The proper response aggregation (intersection of all per-object constraints) preserves this property -- satisfying the most restrictive constraint satisfies all constraints

**Key assumption**: The proofs assume that other road users obey physical laws (bounded acceleration, bounded braking) but may otherwise behave adversarially. RSS does NOT assume cooperative behavior from other drivers.

#### NHTSA Scenario Validation

Mobileye validated RSS against all 37 NHTSA pre-crash scenario types, demonstrating that RSS provides a provably safe response for each scenario category. This validation was published as a technical report and showed that RSS, when fed accurate perception data, prevents the ego vehicle from being at fault in every analyzed crash topology.

#### Open-Source Implementation

The `ad-rss-lib` C++ library (github.com/intel/ad-rss-lib, LGPL-2.1 license) provides a reference implementation:

- **Input**: Object list with position, velocity, dimensions, classification
- **Processing**: Constellation formation, safe distance computation, dangerous situation detection, proper response calculation
- **Output**: Longitudinal and lateral acceleration limits [a_min, a_max]
- **Scenarios implemented**: Multi-lane roads (longitudinal + lateral), intersections (right-of-way), unstructured roads, pedestrian interactions
- **Not implemented**: Occlusions (Rule 4), evasive maneuvers (Rule 5 partial)
- **Integration**: Can be used with the CARLA driving simulator for testing

---

## 4. REM (Road Experience Management) -- Geometric Methods

### 4.1 Landmark Detection

#### On-Vehicle Landmark Extraction

Every Mobileye-equipped vehicle's EyeQ chip performs real-time classical vision to identify and characterize map-relevant landmarks:

**Landmark categories and detection methods**:

| Landmark Type | Detection Approach | Representation |
|--------------|-------------------|----------------|
| Traffic signs | CNN detection + shape-based classification + OCR | Position (x,y,z), type, text, color, shape; condensed signature (< 100 bytes per sign) |
| Lane markings | Edge detection + IPM + line fitting | Line representations as polynomial curves |
| Directional arrows | Template matching + classification | Position, direction, lane assignment |
| Stop/yield lines | Edge detection + geometric fitting | Position, width, type |
| Traffic signals | Color blob detection + spatial reasoning | Position, type, number of lights |
| Poles and posts | Vertical edge detection + clustering | Position, height |
| Road edges | Gradient analysis + ground plane contrast | Line representation |
| Guardrails/barriers | Edge detection + continuity analysis | 3D polyline |

**Condensed signature representation**: The patent US9665100B2 describes landmarks stored using "a condensed signature representation" created by "mapping an image of the landmark to a sequence of numbers." For traffic signs, this requires 50 bytes or fewer; for general signs, 100 bytes or fewer. This signature enables re-recognition without storing the image itself.

#### Feature Descriptors for Localization

Landmarks used for localization must be re-identifiable across visits by different vehicles under varying conditions. Mobileye uses:

1. **Geometric descriptors**: Position relative to lane center, height above road, orientation -- these are viewpoint-invariant and weather-invariant
2. **Type descriptors**: Classification (sign type, pole type) provides categorical matching
3. **Appearance signatures**: Compact numerical signatures that encode visual appearance sufficiently for matching but discard irrelevant detail (illumination, shadows)

The key constraint is that descriptors must be compact enough to transmit at 10 KB/km while being discriminative enough for reliable matching.

### 4.2 Visual Odometry for REM

#### Camera-Based Ego-Motion Pipeline

Visual odometry provides the ego-motion estimate that ties landmark observations to their positions along the road:

1. **Feature detection**: Robust feature points (corners, blobs) detected in each camera frame
2. **Feature tracking**: Lucas-Kanade optical flow or descriptor matching tracks features across consecutive frames
3. **Motion estimation**: The Essential Matrix or Fundamental Matrix is estimated from feature correspondences using RANSAC, then decomposed into rotation and translation
4. **Scale recovery**: Monocular VO suffers from scale ambiguity. Mobileye resolves this through:
   - Known camera height above road (from calibration): constrains the scale via ground plane geometry
   - Vehicle odometry (wheel speed sensors): provides metric speed as a scale reference
   - Known landmark sizes (from map): when re-observing landmarks with known metric positions, the scale is directly recoverable
5. **Trajectory integration**: Frame-to-frame motion estimates are integrated to produce the vehicle's trajectory -- a 3D curve in world coordinates

#### Patent US8164628B2: Monocular Distance Estimation

This foundational Mobileye patent (Stein, Ferencz, 2006) describes the classical technique for metric distance estimation from monocular image sequences:

**Core formula**:
```
Z = f * W_v / w_i
```

Where:
- Z = distance to object
- f = camera focal length (pixels)
- W_v = real-world width of object (meters)
- w_i = measured image width (pixels)

**The problem**: W_v (the object's true width) is unknown for any individual frame. The patent solves this by tracking the object across frames and using a **Kalman filter to estimate the stable dimension**:

**Width estimation from single frame**:
```
W(t) = w_i(t) * H_c / y(t)
```

Where H_c is camera height and y(t) is the object's image position relative to the horizon.

**Kalman filter for width smoothing**: The filter estimates the true width as a hidden state, with time-dependent noise matrices:
- R(t) = R(0) + alpha * t (measurement noise increases with track age, accounting for slow dimensional changes)
- Q(t) = beta * w_i + chi * max(0, T_max - t) (process noise depends on image size and track maturity)

The filter converges fast initially (accepting large updates) and then stabilizes (rejecting noise), enabling rapid lock-on during initial detection while maintaining stable distance estimates afterward.

**Horizon estimation** combines multiple independent estimates through least-squares:
```
E = L1*(y-y0)^2 + L2*(y-yp)^2 + L3*(y-ym)^2 + L4*(y-(y_prev+dy))^2
```

Where y0 is calibrated horizon, yp is vanishing point from lane structure, ym is from ego-motion analysis, and dy is pitch angle compensation.

### 4.3 Map Compression -- 10 KB/km

The 10 KB/km figure is achieved through aggressive semantic abstraction:

#### What IS Transmitted (Road Segment Data packets)

| Data Element | Representation | Approximate Size |
|-------------|----------------|-----------------|
| Driving path | 3D polynomial spline (a few coefficients per segment) | ~2 KB/km |
| Lane markings | Line representations with type classification | ~2 KB/km |
| Landmarks | Position + type + condensed signature (50-100 bytes each) | ~3 KB/km |
| Road surface | Elevation profile (sparse samples + interpolation) | ~1 KB/km |
| Traffic patterns | Statistical summaries (mean speed, variance) | ~1 KB/km |
| Metadata | Timestamp, GPS anchor, vehicle ID (anonymized) | ~1 KB/km |

#### What is NOT Transmitted

- Raw images (megabytes per frame -- discarded after on-vehicle processing)
- Point clouds (megabytes per scan -- never generated in camera-only systems)
- Full feature descriptors (kilobytes per landmark -- replaced by condensed signatures)
- Video streams (the REM system has never transmitted video)

#### Geometric Compression Techniques

1. **Polynomial trajectory encoding**: A 3D driving path over 1 km can be represented by a few cubic polynomial coefficients instead of thousands of position samples
2. **Landmark quantization**: Positions are stored relative to the driving path (lateral offset + longitudinal position along path) rather than absolute coordinates, allowing smaller numeric ranges
3. **Landmark spacing constraint**: The patent specifies landmarks "spaced apart by at least 50 meters" (up to 2 km), limiting the number of landmarks per kilometer
4. **Type enumeration**: Landmark types are encoded as small integers (sign type, pole type), not free-text descriptions
5. **Delta encoding**: Successive road segments share geometric context; only changes from the predicted geometry need transmission

### 4.4 Map Alignment -- Crowdsourced Bundle Adjustment at Scale

#### The Alignment Problem

Millions of vehicles traverse the same roads, each producing slightly different RSD packets due to:
- GPS noise (3-10 m position error)
- Calibration differences between vehicles
- Lane position differences (vehicles in different lanes observe different viewpoints)
- Temporal changes (construction, sign replacement)

#### Cloud Alignment Pipeline

Mobileye's cloud infrastructure (500,000 peak CPU cores on AWS, Apache Spark on Amazon EKS) performs:

1. **Road segment matching**: Incoming RSD packets are matched to existing road segments using coarse GPS + heading + road signature comparison
2. **Trajectory clustering**: Multiple vehicle trajectories along the same road segment are clustered by lane. The patent describes "clustering vehicle trajectories along the common road segment and determining a target trajectory along the common road segment based on the clustered vehicle trajectories"
3. **Longitudinal alignment**: Within each cluster, trajectories are longitudinally aligned using landmark correspondences -- if two trajectories both observe the same traffic sign, the sign provides an alignment anchor. The system "segmenting the first set of drive data into first drive patches and segmenting the second set of drive data into second drive patches" then "longitudinally aligning the first set of drive data with the second set of drive data within corresponding patches"
4. **Landmark position averaging**: "Position measurements may be averaged to obtain the position of the at least one landmark." With hundreds of observations from different vehicles, the central limit theorem drives the averaged position toward the true position with error proportional to 1/sqrt(N)
5. **Change detection**: If new observations consistently disagree with the stored map (a sign has been removed, a lane marking has changed), the change is detected and the map is updated

This is effectively a crowdsourced bundle adjustment: many observations of the same landmarks from different viewpoints are jointly optimized to produce a consistent 3D map. Unlike traditional bundle adjustment (which optimizes camera poses and 3D points jointly), Mobileye's approach uses the averaged landmark positions as fixed reference points and derives the map geometry from these.

#### Scale Demonstration

Mapping Japan (25,000 km of roads) in 24 hours, with the entire map occupying 400 MB (~16 KB/km), demonstrates the pipeline's throughput. Map freshness is measured in hours/days for heavily traveled roads.

### 4.5 Localization Against the Roadbook

#### Real-Time Landmark Matching

In the consuming vehicle, the localization pipeline operates as follows:

1. **Map tile loading**: The vehicle loads Roadbook tiles for the 200 m ahead of its current position
2. **Landmark detection**: The vehicle's cameras detect landmarks in the current view using the same algorithms as the harvesting pipeline
3. **Landmark matching**: Detected landmarks are matched against expected landmarks from the Roadbook using:
   - Position proximity (coarse matching based on GPS-approximate position)
   - Type matching (a detected speed limit sign matches a stored speed limit sign)
   - Signature matching (condensed visual signatures are compared)
4. **Position computation**: With matched landmark correspondences (2D image observations matched to 3D map positions), the vehicle's precise position is computed through geometric solving

#### Perspective-n-Point (PnP) Solving

The localization problem is fundamentally a PnP problem: given N landmarks with known 3D positions (from the Roadbook) and their observed 2D positions in the camera image, solve for the camera's 6-DOF pose (3D position + 3D orientation).

Standard PnP algorithms (P3P with RANSAC, EPnP, iterative PnP) produce the camera pose from as few as 3-4 landmark correspondences. With typical landmark density of 1 per 50-200 m and multiple cameras providing overlapping views, the system typically has 5-20 correspondences at any time, providing robust over-determined solutions.

#### Achieved Accuracy

The Roadbook localizes vehicles to **5-10 cm accuracy** -- far superior to GPS alone (3-10 m). This accuracy is possible because:

- Landmark positions are averaged over hundreds of observations (reducing error by 10-20x vs. single-vehicle observation)
- PnP solving uses metric camera calibration (known focal length, distortion), providing precise angular measurements
- The short baseline between landmarks (50-200 m) keeps geometric errors bounded
- Multiple cameras provide redundant observations, improving robustness

---

## 5. Sensor Processing

### 5.1 Camera ISP (Image Signal Processor)

#### Dedicated ISP Hardware

Every EyeQ chip from EyeQ5 onward includes a dedicated ISP hardware block (not a software implementation on general-purpose cores). The EyeQ6H specifically integrates an ARM Mali-C78AE ISP for safety-capable image processing.

#### ISP Pipeline

The ISP transforms raw Bayer-pattern sensor data into the processed images consumed by perception networks:

```
Raw Bayer Data (RGGB)
    |
    v
[Defective Pixel Correction] -- Replace hot/dead pixels using neighbor interpolation
    |
    v
[Black Level Subtraction] -- Remove sensor-specific dark current offset
    |
    v
[Debayering/Demosaicing] -- Interpolate missing color channels at each pixel
    |                        (bilinear, adaptive gradient, or edge-aware algorithms)
    |
    v
[White Balance] -- Correct color temperature under varying illumination
    |
    v
[HDR Tone Mapping] -- Compress high dynamic range to displayable/processable range
    |                   Mobileye's dual HDR capture provides two exposures per frame
    |
    v
[Noise Reduction] -- Spatial and temporal denoising
    |                  (bilateral filtering, non-local means, or BM3D variants)
    |
    v
[Lens Distortion Correction] -- Remap pixels to correct barrel/pincushion distortion
    |                             using calibrated distortion coefficients
    |
    v
[Color Space Conversion] -- Convert to YUV or other space optimal for perception
    |
    v
[Gamma/Contrast] -- Perception-optimized tone curve (NOT display-optimized)
    |
    v
Processed Image --> Feature Extraction (PMA/XNN)
```

#### Dual HDR Capture Innovation

Mobileye developed a dual HDR approach where a single camera produces two HDR images at different exposures within the same frame time:

- **Short exposure**: Captures highlight detail (sky, oncoming headlights, reflections) without saturation
- **Long exposure**: Captures shadow detail (pedestrians in shade, dark vehicles at night)
- **Merging**: The two exposures are combined into a single HDR image with full dynamic range
- **Bandwidth optimization**: One frame is kept at full resolution while the other is downsampled, managing MIPI data bandwidth

**Performance improvements**:
- ~2x improvement in low-light image quality
- Up to ~5x reduction in nighttime motion blur
- Mitigation of LED flicker artifacts (critical for detecting LED traffic lights and brake lights that pulse at frequencies invisible to the human eye but visible to rolling-shutter cameras)

#### Perception-Optimized ISP Tuning

Mobileye's ISP is specifically tuned for machine perception rather than human viewing:

- **Tone curve**: Maximizes contrast in the intensity range where road features (markings, signs, vehicle silhouettes) have the most discriminative power -- not necessarily the range that looks best to a human viewer
- **Noise reduction**: Tuned to preserve edges and textures critical for perception (lane markings, pedestrian silhouettes) while removing noise that confuses classifiers
- **Sharpening**: Applied in a perception-aware manner -- over-sharpening creates ringing artifacts that can generate false edges

### 5.2 Imaging Radar Signal Processing

Mobileye's proprietary imaging radar is the most signal-processing-intensive component in the entire perception stack. Every step from antenna to point cloud is classical signal processing running on VMP accelerators and the dedicated 11 TOPS radar processor.

#### RFIC and Antenna Architecture

- **RFIC**: Mobileye-designed radio-frequency integrated circuits (not off-the-shelf radar transceiver ICs)
- **Architecture**: Massive MIMO (Multiple-Input Multiple-Output) transmit-and-receive
- **Virtual channels**: >1,500 virtual channels at 20 FPS (BSR forward-facing radar); >300 for corner-mounted BSRC radars
- **Virtual channel formation**: Each physical TX-RX antenna pair creates one virtual channel; MIMO uses orthogonal waveforms across TX antennas to multiply the effective aperture

#### Signal Processing Pipeline

```
TX Antennas emit FMCW chirps
    |
    v
RX Antennas receive reflected signals
    |
    v
[ADC Sampling] -- Digitize IF (intermediate frequency) signals at high bandwidth
    |               Mobileye's RFIC samples "the entire radar signal in a wide
    |               bandwidth while keeping noise at a low level"
    |
    v
[Range FFT (1D-FFT)] -- FFT along fast-time dimension
    |                     Converts beat frequency -> range bins
    |                     Each range bin = discrete distance interval
    |
    v
[Doppler FFT (2D-FFT)] -- FFT along slow-time dimension (across chirps)
    |                       Converts phase progression -> radial velocity bins
    |                       Output: Range-Doppler map per virtual channel
    |
    v
[CFAR Detection] -- Constant False Alarm Rate detector
    |                Adaptive thresholding: each cell compared against
    |                scaled estimate of local noise+clutter
    |                Target cells distinguished from noise
    |
    v
[Digital Beamforming] -- Spatial FFT across virtual channels
    |                     Estimates Direction of Arrival (azimuth + elevation)
    |                     for each detected target
    |                     Angular resolution: < 0.5 degrees
    |                     Sidelobe suppression: -40 dBc
    |
    v
[Point Cloud Generation] -- Convert (range, Doppler, azimuth, elevation)
    |                         bins to 3D Cartesian coordinates + velocity
    |                         Output: 4D point cloud (x, y, z, v_radial)
    |
    v
[Clustering & Object Formation] -- Group point cloud into object hypotheses
    |                                DBSCAN or connected-component clustering
    |
    v
[Tracking] -- Multi-target tracking with state estimation
               Extended Kalman Filter or Multi-Hypothesis Tracker
```

#### Key Signal Processing Achievements

**Angular super-resolution**: Mobileye achieved a 12x resolution increase without proportional compute increase through algorithmic innovation in beamforming:

- Standard FFT-based beamforming resolution is limited by the Rayleigh criterion: theta ~= lambda / D (wavelength / aperture)
- Super-resolution techniques (MUSIC, ESPRIT, or compressed sensing) exploit signal structure to resolve targets separated by less than the Rayleigh limit
- Mobileye's patents cover advanced beamforming for improved angular resolution

**Dynamic range (100 dB)**: The combination of Mobileye's custom RFIC (low noise floor) and signal processing (interference cancellation, sidelobe suppression) achieves 100 dB dynamic range -- detecting a child at 150 m while a bus is 10 m away requires the system to process reflections differing by >60 dB simultaneously.

**Sidelobe suppression (-40 dBc)**: Standard automotive radars achieve -20 to -30 dBc sidelobe levels, causing false detections from strong reflectors in sidelobes. Mobileye's -40 dBc (10-100x better) is achieved through:

- Precise antenna element calibration
- Windowing functions (Hamming, Blackman, Taylor) applied to beamforming weights
- Adaptive sidelobe cancellation algorithms

#### Patent Portfolio

Key imaging radar patents include:

| Patent | Innovation |
|--------|-----------|
| US12265150 | Radar tracking framework based on multi-target density functions |
| US11747457 | Multi-static radar system using distributed units to synthesize larger aperture |
| US12123937 | Compact transmitter architecture with DACs and analog beamforming |
| US12140696 | Synthetic radar scene generation for ML training |
| US10690770 | Combining radar with optical flow from cameras for motion refinement |

### 5.3 LiDAR Processing

#### Current Configuration (Innoviz Partnership, SOP 2026)

After discontinuing its in-house FMCW LiDAR program (September 2024), Mobileye uses third-party LiDAR from Innoviz (Drive platform) and Luminar (Chauffeur platform, e.g., Polestar 4).

#### LiDAR Signal Processing Pipeline

LiDAR point cloud processing on EyeQ follows classical geometric processing:

```
Raw LiDAR Returns (time-of-flight measurements)
    |
    v
[Range Computation] -- Convert time-of-flight to distance: d = c*t/2
    |
    v
[Point Cloud Construction] -- Combine range, azimuth, elevation into (x,y,z) points
    |
    v
[Ego-Motion Compensation] -- Correct for vehicle motion during scan rotation
    |                          Using ego-motion estimate from odometry
    |
    v
[Ground Plane Estimation] -- RANSAC-based plane fitting to identify road surface
    |                          Points consistent with the ground plane are classified as road
    |                          Points above the ground plane are candidate obstacles
    |
    v
[Ground Plane Removal] -- Subtract ground points from obstacle processing
    |
    v
[Clustering] -- DBSCAN or Euclidean clustering groups nearby above-ground points
    |              into object candidates
    |
    v
[Object Classification] -- Cluster features (size, shape, density) classify objects
    |                        as vehicle, pedestrian, cyclist, etc.
    |
    v
[Tracking] -- Multi-object tracking on LiDAR detections
               Independent of camera tracking (True Redundancy)
```

#### Ground Plane RANSAC

The ground plane estimation is a critical classical algorithm:

1. Randomly sample 3 points from the point cloud
2. Fit a plane: ax + by + cz + d = 0
3. Count inlier points within threshold distance of the plane (typically 10-15 cm)
4. Iterate N times; accept the plane with most inliers
5. Refine using all inliers

The ground plane provides:
- Road surface estimation for free-space detection
- Height above ground for each detected point (obstacle vs. road)
- Road slope and bank angle estimation

---

## 6. Depth Estimation Classical Methods

### 6.1 Monocular Depth Cues

Before neural depth estimation networks, Mobileye estimated depth from monocular cameras using purely geometric and photometric cues:

#### Known Object Size Priors

The most reliable monocular depth cue: if the system knows an object's real-world size, depth follows directly from its apparent (image) size:

```
Z = f * W_real / w_image
```

**For vehicles**: Standard vehicle widths (1.7-2.1 m for cars, 2.5 m for trucks) provide strong depth priors. Mobileye's patent US8164628B2 formalizes this with Kalman-filtered width estimation that converges on the specific vehicle's true width over multiple frames.

**For pedestrians**: Height (~1.7 m for adults) is used instead of width because "pedestrian width is dynamic (arm swing, turning) but height remains generally constant over time."

#### Ground Plane Geometry (Y-Position to Depth)

Given a flat-world assumption and known camera height, the y-position of an object's contact point with the road directly yields its distance:

```
Z = f * H_c / (y_object - y_horizon)
```

Where:
- H_c = camera height above road (known from calibration, typically 1.2-1.5 m)
- y_object = image row of the object's bottom edge (contact point with road)
- y_horizon = image row of the horizon (estimated from vanishing points)

**Accuracy**: This method provides metric depth for any object resting on the road surface. Accuracy degrades with:
- Pitch angle changes (suspension compression, road slope) -- Mobileye compensates via continuous pitch estimation
- Non-flat road surfaces (hills, dips) -- the flat-world assumption breaks down
- Objects not on the road surface (elevated signs, overhanging trees) -- the formula gives incorrect depth

**Sub-pixel accuracy**: At 100 m with an 8 MP camera, a pedestrian's feet occupy ~1 pixel in height. Mobileye's patented bottom-edge detection uses gradient-based methods with sub-pixel accuracy, including:
- Horizontal edge detection via grayscale mapping
- Vertical edge identification at endpoints
- Gaussian-weighted refinement centered on tracking predictions
- Shadow correction factors for daytime (F1) and nighttime illumination patterns (F2)

#### Texture Gradients

Road surface texture becomes denser with distance due to perspective projection. The rate of texture density change correlates with surface orientation and distance -- a classical depth cue from J.J. Gibson's ecological optics theory. While not used as a primary depth estimate, texture gradients provide consistency checks for other depth methods.

#### Atmospheric Perspective

Distant objects have reduced contrast and saturation due to atmospheric scattering. This provides a qualitative depth ordering (far vs. near) but not precise metric depth. Used as a supplementary cue in adverse weather conditions.

### 6.2 Structure from Motion (SfM)

#### Multi-Frame Depth from Vehicle Motion

As the vehicle moves forward, each camera captures the scene from progressively different viewpoints. This temporal baseline enables depth estimation through triangulation:

1. **Feature detection**: Detect robust features (FAST corners, Harris corners, or SIFT/SURF descriptors) in frame t
2. **Feature tracking**: Track features to frame t+1 using Lucas-Kanade optical flow or descriptor matching
3. **Ego-motion estimation**: From feature correspondences + vehicle odometry, compute the camera's 6-DOF motion between frames
4. **Triangulation**: For each tracked feature visible in both frames, triangulate its 3D position using the known baseline (camera motion between frames)

```
Depth formula for a tracked feature:
Z = f * B / d

Where:
- B = baseline (distance the camera moved between frames)
- d = disparity (pixel displacement of the feature between frames, corrected for rotation)
- f = focal length
```

#### Advantages over Monocular Depth

- **Metric depth**: SfM provides true metric depth (unlike monocular learning-based methods that require scale calibration)
- **No learned priors**: Works on any object type, even novel objects never seen in training
- **Independent of object recognition**: Does not require knowing what the object is to estimate its distance

#### Limitations

- **Moving objects**: SfM produces incorrect depth for objects that move independently (vehicles, pedestrians) because their apparent motion is a combination of ego-motion and independent motion
- **Texture requirement**: Featureless regions (blank walls, uniform sky) produce no depth estimates
- **Speed dependency**: At low vehicle speeds, the baseline is small, resulting in poor depth accuracy for distant objects
- **Static scenes only**: The "structure" in SfM refers to static scene elements; dynamic objects are outliers that must be detected and excluded

Mobileye uses SfM primarily for **static scene reconstruction** (road surface, buildings, infrastructure) and relies on monocular depth networks for **dynamic objects** -- a hybrid approach that leverages the strengths of each method.

### 6.3 Ground Plane Geometry

The ground plane assumption is one of the most powerful classical depth cues in driving scenarios:

#### Flat-World Model

```
For any point P on the road surface:
Z_P = H_c * f / (v_P - v_horizon)

Where:
- H_c = camera height above road (from calibration)
- f = focal length (from calibration)
- v_P = vertical image coordinate of point P
- v_horizon = vertical image coordinate of the vanishing point (horizon)
```

This single equation converts any pixel position on the road surface to a metric distance, with accuracy limited only by camera calibration quality and the flatness assumption.

#### Road Surface Model

Mobileye extends the flat-world model to a parametric road surface model that accounts for curvature, slope, and bank:

```
Road height model: h(x, y) = h0 + slope_x * x + slope_y * y + curvature * (x^2 + y^2) / 2
```

Parameters are estimated from:
- Lane marking perspective convergence (provides curvature)
- Horizon position changes (provides slope)
- Vehicle IMU (provides instantaneous pitch, roll)
- REM Roadbook elevation profile (provides pre-mapped road geometry)

#### Applications

Ground plane geometry enables:

- **Free-space detection**: Points consistent with the road plane are drivable; deviations indicate obstacles
- **Vehicle distance estimation**: Bottom edge of vehicles on the road surface gives distance via the ground plane formula
- **Pedestrian distance**: Contact point of pedestrian's feet with road gives distance
- **Object height estimation**: Given distance from ground plane, vertical extent in image gives metric height
- **Road slope estimation**: Deviation of the ground plane from horizontal gives road gradient

---

## 7. State Estimation

### 7.1 Kalman Filtering for Object Tracking

Every tracked object in Mobileye's perception system carries a Kalman filter (or Extended Kalman Filter) state:

#### State Vector

```
x = [px, py, pz, vx, vy, vz, ax, ay, heading, yaw_rate, width, length, height]
```

| State Component | Description | Units |
|----------------|-------------|-------|
| px, py, pz | 3D position in ego-vehicle frame | meters |
| vx, vy, vz | 3D velocity | m/s |
| ax, ay | Longitudinal and lateral acceleration | m/s^2 |
| heading | Heading angle relative to ego | radians |
| yaw_rate | Angular velocity | rad/s |
| width, length, height | Object dimensions | meters |

#### Process Model

The state prediction uses a constant-acceleration or constant-turn-rate kinematic model:

```
px(t+dt) = px(t) + vx(t)*dt + 0.5*ax(t)*dt^2
vx(t+dt) = vx(t) + ax(t)*dt
heading(t+dt) = heading(t) + yaw_rate(t)*dt
```

Process noise Q is tuned per object class:
- Vehicles: Low process noise on heading, moderate on acceleration (vehicles generally follow smooth trajectories)
- Pedestrians: High process noise on velocity and heading (pedestrians can change direction abruptly)
- Cyclists: Moderate process noise (more constrained than pedestrians, less than vehicles)

#### Measurement Model

Camera-based measurements include:
- 2D bounding box center and dimensions (from CNN detector)
- 3D position estimate (from monocular depth or stereo triangulation)
- Heading estimate (from appearance-based orientation estimation)

Radar-based measurements include:
- Range and range rate (direct radial velocity measurement)
- Azimuth and elevation angles

#### Association (Data Association Problem)

Matching new detections to existing tracks uses:

1. **Gating**: Only consider associations where the predicted track position is within a Mahalanobis distance threshold of the detection
2. **Cost matrix**: For M tracks and N detections, compute an M x N cost matrix using position distance, appearance similarity, and size consistency
3. **Hungarian algorithm**: Optimal assignment minimizing total cost
4. **Track management**: Unmatched detections initiate new tracks; unmatched tracks are maintained for a grace period (bridge through occlusion), then terminated

### 7.2 Road Model Estimation

#### Polynomial Road Model

The road ahead is modeled as a polynomial curve (or piecewise polynomial):

```
Lateral_position(s) = c0 + c1*s + c2*s^2 + c3*s^3
```

Where s is the arc length along the road and:
- c0: Lateral offset from vehicle center to lane center
- c1: Heading error (angle between vehicle heading and road tangent)
- c2: Half-curvature (1/R, where R is the road's radius of curvature)
- c3: Curvature rate (clothoid parameter -- how curvature changes with distance)

#### Clothoid Fitting

A clothoid (Euler spiral) has linearly changing curvature, making it the standard model for road geometry in highway engineering:

```
kappa(s) = kappa_0 + kappa_1 * s
```

Where kappa is curvature and s is arc length. This produces continuous lateral acceleration (constant jerk), matching how roads are actually designed (spiral transitions between straight sections and circular arcs).

#### Kalman Filter for Road Geometry

An adaptive Kalman filter tracks road geometry parameters:

- **State**: [c0, c1, c2, c3] (polynomial coefficients)
- **Process model**: Road geometry evolves smoothly; process noise models uncertainty in geometry change rate
- **Measurements**: Lane detection (from camera perception), vehicle lateral dynamics, GPS heading
- **Adaptation**: Process noise parameters are adjusted based on driving scenario:
  - Straight road: Low process noise (geometry changes slowly)
  - Approaching curve: Higher process noise (geometry changes rapidly)
  - Intersection: Maximum process noise (geometry may change abruptly)

Research by Lundquist and Schon (Chalmers University) demonstrated that modeling forward road geometry as **two contiguous clothoid segments** with continuous curvature across the transition provides better performance than single-segment models, with adaptive parameter tuning producing stable estimates during constant geometry and fast response during transitions.

### 7.3 Ego-Motion Estimation

#### Sensor Fusion Architecture

Mobileye estimates ego-motion by fusing multiple sensor sources:

```
[Visual Odometry] ----+
                      |
[Wheel Odometry]  ----+--> [Extended Kalman Filter / Factor Graph] --> 6-DOF Ego-Motion
                      |
[IMU Integration] ----+
                      |
[REM Localization] ---+
```

#### Visual Odometry

1. Feature detection (FAST/Harris corners) in camera images
2. Feature tracking across frames (KLT tracker)
3. Essential matrix estimation with RANSAC
4. Motion decomposition into rotation + translation
5. Scale from ground plane constraint or wheel odometry

#### Wheel Odometry

- Wheel speed sensors provide longitudinal velocity
- Steering angle sensor provides yaw rate
- Simple kinematic model: v = wheel_speed * wheel_radius; yaw_rate = v * tan(steering_angle) / wheelbase

#### IMU Integration

- 6-axis IMU (3-axis accelerometer + 3-axis gyroscope) provides:
  - Angular velocity (pitch rate, roll rate, yaw rate) at 100+ Hz
  - Linear acceleration at 100+ Hz
- IMU integration provides high-frequency (100 Hz) ego-motion estimates between camera frames (10 Hz)
- IMU suffers from drift -- corrected by visual odometry and wheel odometry at lower frequency

#### REM-Based Localization Correction

When the vehicle is localized against the Roadbook (Section 4.5), the localization provides:
- Absolute position (correcting drift in dead-reckoning)
- Heading relative to road geometry (correcting yaw estimation errors)
- Elevation from the stored road profile

#### Self-Calibration (Vanishing Point Method)

Mobileye's automatic self-calibration uses vanishing points to determine camera orientation:

1. **Lane marking vanishing point**: Parallel lane markings converge to a vanishing point that directly encodes the camera's pitch and yaw angles relative to the road
2. **Building/structure vanishing points**: Vertical building edges converge to a zenith vanishing point encoding camera roll
3. **Ego-motion vanishing point (FOE)**: The Focus of Expansion (direction of forward motion) provides heading calibration -- comparing the visual FOE with wheel odometry heading gives camera yaw offset

**Online refinement**: These vanishing points are detected continuously during normal driving (no calibration targets required). The calibration is refined every few seconds, compensating for:

- Suspension changes due to passenger/cargo loading
- Tire pressure variations
- Temperature-induced mechanical drift
- Windshield camera re-mounting after service

The self-calibration procedure requires only 5-15 minutes of normal driving to converge from scratch. Once converged, parameters are continuously refined with minimal latency.

---

## 8. Hybrid ML + Classical

### 8.1 ViDAR Classical Components

ViDAR (Vision Detection and Ranging) is primarily a deep learning system (encoder-decoder architecture predicting 3D point clouds from camera images). However, several classical components are essential to its operation:

#### Multi-View Geometry for Training Supervision

ViDAR is trained using paired camera + real LiDAR data. The geometric registration between camera and LiDAR coordinate systems uses:

- **Extrinsic calibration**: Classical calibration using known target patterns or natural features to establish the rigid body transform between camera and LiDAR
- **Temporal synchronization**: Aligning camera frame timestamps with LiDAR scan timestamps using hardware triggers and software interpolation
- **Ego-motion compensation**: Correcting for vehicle motion during LiDAR scan rotation using classical ego-motion estimation

#### Geometric Consistency Loss

The training loss includes geometric terms:

- **Chamfer distance**: Measures the geometric similarity between predicted and ground-truth point clouds -- a purely geometric metric
- **Depth error**: Per-pixel depth comparison between ViDAR prediction and LiDAR ground truth
- **Multi-view consistency**: If the same 3D point is visible in multiple cameras, its predicted depth from each camera must agree (enforced via reprojection geometry)

#### Ego-Motion Warping

ViDAR's temporal processing requires aligning features across frames. This alignment uses classical ego-motion estimation:

1. Estimate ego-motion between frame t and frame t+dt (from visual odometry + IMU)
2. Compute the 3D rigid body transform between the two camera poses
3. Warp BEV features from frame t into frame t+dt's coordinate system using this transform

This warping is a classical geometric operation -- no learning involved.

#### Camera Calibration Dependency

ViDAR's accuracy is directly limited by camera calibration quality:

- Intrinsic parameters (focal length, principal point, distortion) determine the mapping between image coordinates and 3D rays
- Extrinsic parameters (camera pose relative to vehicle) determine the position of each camera's viewing frustum
- Calibration errors propagate directly to depth errors in the ViDAR output

Mobileye's continuous self-calibration (Section 7.3) is therefore a critical enabler for ViDAR accuracy.

### 8.2 VLSA Classical Reasoning

Mobileye's Vision-Language-Semantic-Action (VLSA) model is a hybrid system combining a stochastic VLM with deterministic classical reasoning:

#### Architecture Separation

```
SLOW-THINK (VLSA, ~1 Hz)                    FAST-THINK (Classical, ~10 Hz)
================================             ================================
Vision-Language Model                        CNN Perception Pipeline
Scene semantic understanding                 Object detection/tracking
Complex situation interpretation             Lane detection
Edge case reasoning                          Free space estimation
Structured semantic guidance output          ViDAR depth estimation

       |                                             |
       v                                             v
  Semantic Context -----> [PLANNING] <----- Perception Outputs
                              |
                              v
                     [RSS SAFETY LAYER]  <-- Pure classical/formal
                              |
                              v
                     [ACTUATION COMMANDS]
```

#### Classical Components in the VLSA Pipeline

1. **RSS as inviolable safety layer**: Regardless of what VLSA recommends, RSS constraints cannot be overridden. If VLSA suggests an aggressive lane change but RSS determines the lateral safe distance would be violated, the maneuver is blocked. The formal mathematical guarantees of RSS (Section 3) operate as hard constraints on top of any AI-generated guidance.

2. **Rule-based traffic law encoding**: Traffic laws (stop at red light, yield at yield sign, speed limit compliance) are encoded as deterministic rules, not learned behaviors. VLSA may reason about whether a particular traffic light applies to the ego lane, but the response to a confirmed red light is a hard-coded rule.

3. **Geometric feasibility checking**: When VLSA suggests a maneuver (e.g., "merge left to avoid construction zone"), classical geometry verifies feasibility -- is there physically enough space? Is the turning radius achievable? Is the maneuver kinematically possible at current speed?

4. **Deterministic safety monitor**: The fast-think system continuously monitors whether the vehicle is in a safe state (all RSS distances satisfied). If VLSA is slow to respond or produces ambiguous guidance, the fast-think system maintains safety autonomously. VLSA "does not sit in the safety loop."

#### What VLSA Does NOT Do (Classical Responsibility)

- VLSA does NOT control the vehicle directly (trajectory generation is deterministic)
- VLSA does NOT override RSS (formal safety is inviolable)
- VLSA does NOT need to run in real-time (safety is maintained by the 10 Hz fast-think system)
- VLSA does NOT hallucinate into safety-critical decisions (its outputs are semantic guidance, not actuation commands)

### 8.3 Perception-RSS Interface -- Discretization

The interface between continuous perception outputs and binary RSS safety decisions is a critical hybrid boundary:

#### Continuous to Discrete Conversion

Perception outputs (position, velocity, dimensions) are continuous-valued and noisy. RSS requires discrete decisions (safe / dangerous). The conversion involves:

1. **Uncertainty propagation**: Perception provides position estimate with uncertainty bounds (e.g., x = 50 +/- 0.3 m). RSS must account for this uncertainty conservatively.

2. **Conservative interpretation**: When position uncertainty means the object could be anywhere in a range [x_min, x_max], RSS uses the value that produces the most conservative (safest) result:
   - For distance to an object ahead: use x_min (assume it's closer than measured)
   - For speed of an object ahead: use v_max (assume it's faster than measured, reducing available reaction time)

3. **Classification confidence handling**: If the classifier is uncertain between "vehicle" (wider, more constrained RSS parameters) and "pedestrian" (narrower, more conservative RSS parameters), RSS uses the more conservative parameter set.

4. **Track maturity gating**: New tracks (first few frames of detection) have high uncertainty. RSS treats new tracks conservatively -- even a tentative detection at long range may constrain the safe distance if its uncertainty envelope extends into the danger zone.

#### Multi-Subsystem Aggregation

In True Redundancy, both the camera subsystem and the radar/LiDAR subsystem produce independent object lists. The RSS interface must:

1. Independently compute RSS for the camera subsystem's object list
2. Independently compute RSS for the radar/LiDAR subsystem's object list
3. Take the more conservative response: "if either channel detects a hazard, the vehicle acts on it"

This aggregation is a classical logical operation: OR over hazard detection (any detection triggers response), intersection over allowed actions (only actions safe in both channels are permitted).

---

## 9. Key References

### Foundational Patents

| Patent | Title | Relevance |
|--------|-------|-----------|
| US7113867B1 | Obstacle detection and time-to-contact using image sequences | Classical monocular TTC via scale change measurement; optical flow affine model; brightness constancy constraint |
| US8164628B2 | Distance estimation using monocular camera sequences | Kalman-filtered constant-dimension tracking; ground plane depth formula; sub-pixel bottom-edge detection |
| US9665100B2 | Sparse map for autonomous vehicle navigation | Landmark-based localization; polynomial trajectory representation; condensed landmark signatures |
| US20180024568A1 | Crowdsourcing a sparse map | Trajectory clustering; longitudinal alignment; 3D spline road models; road signature profiles |
| US11086334 | Crowdsourced sparse map navigation | Fleet-scale data collection and alignment; road surface information; vehicle localization using lane measurements |
| US10690770 | Radar + optical flow fusion | Combining radar measurements with camera optical flow for motion refinement |
| US11747457 | Multi-static radar system | Distributed radar units synthesizing larger aperture for improved angular resolution |
| US12265150 | Radar tracking framework | Multi-target density function tracking for radar objects |

### Academic Papers

| Paper | Authors | Year | Venue |
|-------|---------|------|-------|
| On a Formal Model of Safe and Scalable Self-driving Cars | Shalev-Shwartz, Shammah, Shashua | 2017 | arXiv:1708.06374 |
| Responsibility-Sensitive Safety (extended) | Mobileye | 2022 | arXiv:2206.03418 |
| 3D-LaneNet: End-to-End 3D Multiple Lane Detection | Garnett, Cohen, Pe'er, Lahav, Levi | 2019 | ICCV |
| Forward Collision Warning with a Single Camera | Dagan, Mano, Stein, Shashua | 2004 | IEEE IV Symposium |
| A Monocular Vision Advance Warning System | Gat, Benady, Shashua | 2005 | SAE 2005-01-1470 |
| Projective Structure from Uncalibrated Images | Shashua | 1994 | IEEE TPAMI |
| Trilinearity of Three Perspective Views | Shashua, Werman | 1995 | ICCV |
| Towards Standardization of AV Safety: C++ Library for RSS | Mobileye/Intel | 2019 | IEEE IV Symposium |

### Open-Source Implementation

- **ad-rss-lib** (github.com/intel/ad-rss-lib): C++ implementation of RSS including situation analysis, safe distance computation, proper response calculation, and CARLA simulator integration. LGPL-2.1 license.

### Classical CV Foundations Referenced

| Technique | Original Paper | Role in Mobileye |
|-----------|---------------|-----------------|
| HOG + SVM | Dalal & Triggs, CVPR 2005 | EyeQ2-3 pedestrian/vehicle detection |
| Haar Cascades + Adaboost | Viola & Jones, CVPR 2001 | EyeQ1-3 rapid object candidate generation |
| Deformable Part Models | Felzenszwalb et al., CVPR 2008 | EyeQ3 occluded pedestrian detection |
| Integral Channel Features | Dollar et al., BMVC 2009 | EyeQ2-3 fast multi-channel detection |
| Hough Transform | Duda & Hart, 1972 | Lane detection (all EyeQ generations) |
| RANSAC | Fischler & Bolles, 1981 | Lane fitting, ground plane, calibration |
| Lucas-Kanade Optical Flow | Lucas & Kanade, 1981 | Feature tracking for VO, SfM, ego-motion |
| Kalman Filter | Kalman, 1960 | Object tracking, road model tracking, calibration |
| EPnP / PnP | Lepetit et al., 2009 | REM localization against Roadbook |
| Essential Matrix | Longuet-Higgins, 1981 | Visual odometry, camera motion estimation |
| Bundle Adjustment | Triggs et al., 2000 | REM crowdsourced map alignment |

---

*This document covers the non-ML and hybrid-ML techniques in Mobileye's perception stack. For the full ML-based perception pipeline (CNNs, transformers, ViDAR, semantic segmentation, 3D-LaneNet), see the companion document: mobileye-perception-deep-dive.md.*
