# Motional Perception Stack: Non-ML and Hybrid-ML Techniques — Exhaustive Deep Dive

*Last updated: March 2026*

*Companion document to [perception.md](perception.md)*

---

## Table of Contents

### nuTonomy Formal Methods Heritage
1. [Formal Verification](#1-formal-verification)
2. [Rule-Based Planning Heritage (Rulebooks)](#2-rule-based-planning-heritage-rulebooks)
3. [Singapore Deployment Classical Components](#3-singapore-deployment-classical-components)

### Sensor Signal Processing
4. [Ouster Alpha Prime VLS-128 Processing](#4-ouster-alpha-prime-vls-128-processing)
5. [Hesai Short-Range LiDAR Processing](#5-hesai-short-range-lidar-processing)
6. [Radar Signal Processing](#6-radar-signal-processing)
7. [Camera ISP Pipeline](#7-camera-isp-pipeline)
8. [Time Synchronization](#8-time-synchronization)

### Calibration
9. [Multi-Sensor Calibration](#9-multi-sensor-calibration)
10. [nuScenes Calibration Architecture](#10-nuscenes-calibration-architecture)
11. [Online Calibration Monitoring](#11-online-calibration-monitoring)

### Classical Perception
12. [Point Cloud Preprocessing](#12-point-cloud-preprocessing)
13. [Free Space Estimation](#13-free-space-estimation)
14. [Road Geometry and Lane Detection](#14-road-geometry-and-lane-detection)
15. [LiDAR-Based Localization](#15-lidar-based-localization)

### State Estimation and Tracking
16. [Kalman Filtering and State Estimation](#16-kalman-filtering-and-state-estimation)
17. [Data Association](#17-data-association)
18. [Track Management](#18-track-management)

### nuScenes Classical Evaluation Metrics
19. [NDS (nuScenes Detection Score)](#19-nds-nuscenes-detection-score)
20. [Mean Average Precision](#20-mean-average-precision)
21. [Tracking Metrics (AMOTA, AMOTP)](#21-tracking-metrics-amota-amotp)
22. [Segmentation Metrics](#22-segmentation-metrics)

### Hybrid ML+Classical in the LDM Transition
23. [What Survived the LDM Pivot](#23-what-survived-the-ldm-pivot)
24. [Classical Safety Guardrails](#24-classical-safety-guardrails)
25. [Perception-Planning Interface](#25-perception-planning-interface)
26. [Geometric Post-Processing](#26-geometric-post-processing)

### Radar as Primary Sensor Research
27. [Radar-Only Perception](#27-radar-only-perception)
28. [Radar Point Cloud Processing](#28-radar-point-cloud-processing)

### Las Vegas Specific
29. [Night Perception on the Strip](#29-night-perception-on-the-strip)
30. [Pedestrian Detection in Crowded Environments](#30-pedestrian-detection-in-crowded-environments)

---

## 1. Formal Verification

### nuTonomy's Formal Methods Foundation

nuTonomy was founded in 2013 by **Dr. Emilio Frazzoli** (MIT professor of Aeronautics and Astronautics, now at ETH Zurich) and **Dr. Karl Iagnemma** (director of MIT's Robotic Mobility Group). The company's core technical differentiator was its use of **formal methods** -- mathematical techniques from theoretical computer science and control theory -- to provide provable safety guarantees for autonomous driving.

Unlike most AV companies that treated decision-making as a learning problem, nuTonomy treated it as a **verification problem**: the system should be provably correct with respect to a given set of traffic rules and safety specifications.

### Temporal Logic Specifications

nuTonomy's formal methods heritage draws heavily on **temporal logic**, a family of formal languages used to express properties of systems over time. The key logics used in autonomous driving verification are:

| Logic | Full Name | Use Case |
|---|---|---|
| **LTL** | Linear Temporal Logic | Expressing safety and liveness properties over infinite traces (e.g., "the vehicle shall never enter the oncoming lane without clearance") |
| **STL** | Signal Temporal Logic | Specifying properties over continuous signals with time bounds (e.g., "the vehicle shall stop within 3 seconds of detecting a red light") |
| **CTL** | Computation Tree Logic | Branching-time properties for exploring multiple possible futures |
| **MLTL** | Mission-time Linear Temporal Logic | Bounded-time specifications for practical CPS verification |

LTL formulas are constructed from atomic propositions and temporal operators:
- **G** (Globally / Always): "G safe" means "the system is always safe"
- **F** (Finally / Eventually): "F goal" means "the goal is eventually reached"
- **U** (Until): "safe U goal" means "safety holds until the goal is reached"
- **X** (Next): Properties that must hold at the next timestep

For autonomous driving, specifications are typically written as conjunctions of safety invariants (things that must always hold) and liveness goals (things that must eventually happen):

```
Specification = G(no_collision) ∧ G(in_lane ∨ safe_lane_change) ∧ F(reach_destination)
```

### Tichakorn Wongpiromsarn and Controller Synthesis

**Tichakorn (Nok) Wongpiromsarn** served as a principal research scientist at nuTonomy, leading the planning team. Wongpiromsarn was invited by Emilio Frazzoli in 2014 and brought deep expertise in formal methods from his work on the **TuLiP (Temporal Logic Planning) Toolbox** at Caltech.

**TuLiP** is a Python-based software toolbox for the synthesis of embedded control software that is provably correct with respect to LTL specifications. The toolbox combines three key components:

1. **Finite state abstraction**: Discretizing continuous control systems into finite-state models that can be analyzed with model checking tools
2. **Digital design synthesis from LTL specifications**: Automatically generating controllers that satisfy temporal logic formulas
3. **Receding horizon planning**: Breaking the synthesis problem into a set of smaller sub-problems to manage computational complexity while preserving correctness guarantees

At nuTonomy, this approach was applied differently from the earlier Alice autonomous vehicle project (an earlier Frazzoli project). Rather than relying on complex finite state machines, nuTonomy's planning system applied formal methods to **automatically build decision-making logic that is provably correct by construction**. The controller synthesis treats the environment as an adversary, ensuring the resulting controller is correct for any admissible environment behavior.

### Model Checking for Autonomous Driving

Model checking is an automated verification technique that exhaustively explores all possible states of a system to verify that it satisfies a given temporal logic specification. For nuTonomy, model checking was used to:

- **Verify control software** against formal specifications before deployment
- **Detect safety violations** that might occur under corner-case environmental conditions
- **Certify rule compliance** -- ensuring the vehicle's decision-making logic always respects the priority ordering of traffic rules

The verification process operates on a finite-state abstraction of the vehicle's behavior:

```
                ┌─────────────────┐
                │  Continuous     │
                │  Vehicle Model  │
                └────────┬────────┘
                         │ Abstraction
                         ▼
                ┌─────────────────┐
                │  Finite-State   │
                │  Model          │
                └────────┬────────┘
                         │ Model Checking
                         ▼
                ┌─────────────────┐     ┌─────────────────┐
                │  LTL/STL Spec   │────▶│  Verified /      │
                │  (Safety Rules) │     │  Counterexample  │
                └─────────────────┘     └─────────────────┘
```

### Sampling-Based Motion Planning with Provable Guarantees

Emilio Frazzoli's foundational contribution to robotics is the development of **RRT\*** (Rapidly-exploring Random Tree Star) and **PRM\*** (Probabilistic Roadmap Star), published with Sertac Karaman in the *International Journal of Robotics Research* (2011). These algorithms are:

- **Probabilistically complete**: The probability of finding a solution, if one exists, approaches 1 as the number of samples grows
- **Asymptotically optimal**: The cost of the returned solution converges almost surely to the optimum
- **Computationally efficient**: The complexity is within a constant factor of their non-optimal counterparts (RRT, PRM)

This represented a breakthrough because prior sampling-based algorithms (RRT, PRM) were probabilistically complete but could converge to arbitrarily suboptimal solutions. RRT\* achieves optimality by rewiring the tree: when a new random sample is added, the algorithm checks whether nearby nodes would benefit from being rerouted through the new node, continuously improving path quality.

At nuTonomy, these planning algorithms were combined with formal specifications to produce motion plans that were both dynamically feasible and provably compliant with traffic rules.

### Formal Collision Risk Estimation

nuTonomy developed **compositional data-driven approaches** for formal collision risk estimation. Rather than treating collision risk as a single monolithic probability, the compositional approach decomposes risk into modular components that can be:

- Independently estimated from data (historical driving scenarios)
- Formally composed to derive system-level risk bounds
- Updated incrementally as new data becomes available

This approach bridges the gap between formal methods (which provide guarantees but require models) and data-driven methods (which scale well but lack guarantees).

---

## 2. Rule-Based Planning Heritage (Rulebooks)

### The Rulebook Framework

The **Rulebook** is nuTonomy/Motional's most significant contribution to formal methods for autonomous driving behavior specification. Published at ICRA 2019 by Andrea Censi, Konstantin Slutsky, Tichakorn Wongpiromsarn, Dmitry Yershov, Scott Pendleton, James Fu, and Emilio Frazzoli, the paper "Liability, Ethics, and Culture-Aware Behavior Specification using Rulebooks" introduced a formal framework for specifying autonomous driving behavior.

### Mathematical Definition

A **rulebook** is formally defined as a **pre-ordered set of rules**, where each rule is a **violation metric** on possible outcomes (called "realizations"). The key mathematical structure is:

- **Rule**: A function `r: Realizations → ℝ≥0` that assigns a non-negative violation score to each possible trajectory outcome. Zero violation means perfect compliance; higher values indicate greater rule violation.
- **Priority ordering**: Rules are **partially ordered by priority**, creating a hierarchy. Higher-priority rules must be satisfied before lower-priority rules are even considered.
- **Rulebook**: A set of rules `R = {r₁, r₂, ..., rₙ}` together with a partial order `≤` on the rules.

The rulebook semantics impose a **pre-order on the set of realizations**: given two possible trajectory outcomes, the rulebook determines which is preferred by first comparing them on the highest-priority rules, then breaking ties with lower-priority rules.

### Rule Priority Hierarchy

The rulebook encodes a natural priority hierarchy that reflects both legal requirements and ethical considerations:

| Priority Level | Rule Category | Examples |
|---|---|---|
| **Highest** | Safety invariants | No collision with any road user; maintain safe following distance |
| **High** | Traffic law compliance | Obey traffic signals; stay within speed limits; respect right-of-way |
| **Medium** | Right-of-way rules | Yield to pedestrians; merge properly; intersection protocols |
| **Lower** | Driving conventions | Stay in lane when possible; maintain smooth trajectories |
| **Lowest** | Comfort and efficiency | Minimize acceleration/deceleration; choose shortest route; smooth steering |

### How Rulebooks Drive Decision Making

When the planner generates multiple candidate trajectories, the rulebook provides a principled way to select among them:

1. **Evaluate each trajectory** against all rules, computing violation scores
2. **Compare trajectories** using the priority ordering -- a trajectory that violates a high-priority rule is always worse than one that only violates lower-priority rules, regardless of the magnitude
3. **Select the trajectory** that is optimal under the rulebook's pre-order

This resolves common dilemmas in autonomous driving. For example, when a double-parked car blocks the lane, the vehicle must cross the center line (violating a lane-keeping rule) to pass. The rulebook correctly prioritizes this because the lane-keeping rule has lower priority than the progress rule, and the center-line crossing is only permitted when the higher-priority no-collision rule is satisfied (i.e., no oncoming traffic).

### Compositional Properties

The rulebook framework was designed to be **compositional**: smaller rulebooks can be combined into larger ones while preserving previously-introduced constraints. This is critical for practical deployment because:

- Different jurisdictions have different traffic laws (Singapore vs. Las Vegas)
- Cultural driving norms vary by region
- New rules can be added without re-validating the entire specification

The compositionality property means that if rulebook A guarantees safety property P, and rulebook B is composed with A such that B only adds lower-priority rules, then the composed rulebook A+B still guarantees property P.

### Connection to nuTonomy Operations

As Karl Iagnemma described nuTonomy's cars in Singapore: the formal logic "tells the taxis when low-priority 'rules of the road' can be broken safely to drive flexibly and efficiently." For example, when driving around a double-parked car with no oncoming traffic, the taxi recognizes it is not violating the most important rule (no collision) and safely passes by crossing the center line.

### Subsequent Work: Safety of the Intended Driving Behavior

The rulebook framework was extended in "Safety of the Intended Driving Behavior Using Rulebooks" (2021), which addressed situations involving collision risks with other agents and incorporated:

- Specification of autonomous vehicle behavior considering traffic laws, local driving culture, and driving practices
- Formal reasoning about situations where perfect rule compliance is impossible (e.g., unavoidable conflicts between rules)
- Integration with Responsibility-Sensitive Safety (RSS)-style safety envelopes

---

## 3. Singapore Deployment Classical Components

### World's First Public Robotaxi (August 2016)

In August 2016, nuTonomy launched the world's first public robotaxi pilot in Singapore's one-north business district, using a fleet of 6 modified Renault Zoes and Mitsubishi i-MiEVs. The perception system was a hybrid of classical and early ML techniques.

### Sensor Suite

The Singapore vehicles carried:
- **LiDARs** on the roof and around the front bumper
- **Radar** units for velocity and ranging
- **Cameras** providing near-complete surround coverage

This established the multi-modal pattern that Motional's IONIQ 5 would later scale to 30+ sensors.

### Classical Perception Components

**LiDAR-Centric Localization**: nuTonomy's most distinctive classical perception approach was using LiDAR data for localization. While all autonomous vehicles use LiDAR for object detection, nuTonomy's system specifically localized by detecting not only objects on the road surface but also **stationary objects all around the car** -- particularly buildings and permanent structures. As a nuTonomy representative explained: "Even though stuff at road level can change all the time -- you can have a car parked here or not, for example -- a building is going to stay put." This approach used scan matching against a pre-built map of stable environmental features, making localization robust to dynamic scene changes.

**Formal Logic Decision Making**: The Singapore deployment's decision-making system was built on formal logic rather than learned behavior. The system:
- Translated traffic rules into formal specifications
- Used controller synthesis to generate provably correct driving behavior
- Applied the rulebook framework to resolve conflicts between rules
- Maintained safety invariants through model checking

**Classical Object Detection**: While the Singapore deployment used early deep learning for some object detection, the pipeline included significant classical preprocessing:
- LiDAR ground plane extraction
- Point cloud clustering for object segmentation
- Classical geometric feature extraction
- Rule-based object classification for simple cases (e.g., using height, aspect ratio)

**Map-Based Navigation**: The Singapore deployment relied heavily on HD maps of the one-north district, with:
- Pre-mapped lane geometry and intersection topology
- Traffic light positions encoded in the map
- Route planning using classical graph search algorithms
- Localization by matching current LiDAR scans against the pre-built map

---

## 4. Ouster Alpha Prime VLS-128 Processing

### Hardware Specifications

The Ouster Alpha Prime (originally Velodyne Alpha Prime, now under Ouster after the Velodyne-Ouster merger) is Motional's long-range LiDAR sensor for the IONIQ 5 robotaxi.

| Specification | Value |
|---|---|
| **Channels** | 128 vertical beams |
| **Range** | Over 300 meters |
| **Horizontal FOV** | 360 degrees |
| **Vertical FOV** | 40 degrees |
| **Frame Rates** | 5 Hz, 10 Hz, 20 Hz |
| **Wavelength** | 903 nm (near-infrared) |
| **Return Modes** | Dual return (strongest return + last return) |
| **Environmental Rating** | IP68 and IP69K |
| **Operating Temperature** | -40C to +65C |
| **Points per Second** | Up to ~4.8 million (128 channels x 20 Hz, dual return) |

### Dual-Return Processing

The Alpha Prime supports **dual-return mode**, which captures two return signals per laser pulse:

- **Strongest return**: The signal reflection with the highest intensity. This typically corresponds to the most reflective surface encountered by the laser.
- **Last return**: The final reflected signal received. In many scenarios, this corresponds to the farthest surface (e.g., a wall behind foliage).

Dual-return processing is a classical signal processing technique that provides several advantages:

```
Laser Pulse ──────────▶ ┌──────────┐     ┌──────────┐
                        │  Foliage │     │   Wall   │
                        │(strongest│     │  (last   │
                        │ return)  │     │  return) │
                        └──────────┘     └──────────┘
                              │                │
                              ▼                ▼
                        Return 1:          Return 2:
                        High intensity,    Lower intensity,
                        closer range       farther range
```

**Applications of dual-return data**:
1. **See-through capability**: The last return can detect objects behind semi-transparent obstacles (rain, dust, foliage, chain-link fences)
2. **Object disambiguation**: Comparing strongest and last returns helps distinguish solid objects from semi-transparent ones
3. **Noise rejection**: Points where strongest and last returns coincide are high-confidence detections; divergent returns indicate partial occlusion or atmospheric interference
4. **Density improvement**: Dual returns effectively double the point cloud density in regions with multiple surfaces

### Ambient Light Rejection and Interference Mitigation

The Alpha Prime operates at **903 nm wavelength** (near-infrared), which creates challenges from solar ambient light (the sun emits strongly at 903 nm). Classical signal processing techniques for ambient light rejection include:

- **Temporal filtering**: The detector uses narrow temporal gating to accept only returns within the expected round-trip time window, rejecting ambient light that arrives continuously
- **Optical filtering**: Narrow bandpass filters centered at 903 nm reject broadband ambient light while passing the laser return
- **Signal-to-noise thresholding**: Returns below a dynamic SNR threshold (computed from measured ambient light levels) are rejected
- **Sensor-to-sensor interference mitigation**: The Alpha Prime includes advanced crosstalk rejection to prevent interference from other LiDAR units operating nearby (critical when multiple AVs share the road)

### LiDAR Rolling Shutter and Motion Compensation

A spinning LiDAR like the Alpha Prime collects points sequentially as the mirror rotates through 360 degrees. At 10 Hz rotation, one full scan takes 100 ms. During this time, the ego vehicle may have moved significantly, causing **motion distortion** (also called rolling shutter distortion).

**Ego-motion compensation** is a classical preprocessing step that corrects this distortion:

1. **Obtain ego-motion estimate**: From IMU integration, wheel odometry, or previous localization results, estimate the vehicle's pose change during the scan
2. **Interpolate pose for each point**: Using the point's timestamp within the scan, interpolate the vehicle pose at the moment that specific point was captured
3. **Transform each point**: Apply the inverse of the interpolated ego-motion to transform each point into a common reference frame (typically the pose at the scan's start or midpoint)

```
For each point p_i with timestamp t_i in scan [t_start, t_end]:
    T_i = interpolate(ego_pose(t_start), ego_pose(t_end), (t_i - t_start) / (t_end - t_start))
    p_i_corrected = T_ref * T_i^(-1) * p_i
```

This correction is essential for downstream processing -- without it, static objects appear smeared, and point cloud registration with the map becomes unreliable.

---

## 5. Hesai Short-Range LiDAR Processing

### Hardware Specifications

Motional uses **4 Hesai Technology short-range LiDAR units** mounted around the vehicle perimeter to fill near-field blind spots that the roof-mounted Alpha Prime cannot cover.

While the specific Hesai model deployed on the IONIQ 5 has not been publicly confirmed, Hesai's short-range product line includes:

| Model | FOV (H x V) | Range | Resolution | Points/sec | Form Factor |
|---|---|---|---|---|---|
| **FT120** | 100 x 75 degrees | 0.1m to 100m | 160 x 120 pixels | 384,000 (dual return) | Fully solid-state |
| **FTX** | 180 x 140 degrees | Short range | Higher resolution | Higher | Fully solid-state |
| **QT128** | 360 x wide | Short range | 128 channels | High | Rotating |

### Near-Field Processing Challenges

Short-range LiDAR processing has distinct classical challenges compared to long-range:

- **High point density**: At close range, objects produce very dense point clouds, requiring efficient downsampling or voxelization
- **Wide angular coverage**: The ultra-wide FOV (up to 180 degrees) means significant geometric distortion at the edges that must be corrected
- **Low-speed object detection**: Near-field sensors must detect curbs, bollards, small debris, and pedestrians stepping off curbs -- objects that may be only a few centimeters tall
- **Self-occlusion handling**: The vehicle body itself occludes portions of the near-field sensors' FOV; this must be masked in the processing pipeline
- **Range accuracy at close range**: At ranges below 1 meter, even small range errors (e.g., +/- 3 cm) represent significant relative error, requiring careful calibration

### Classical Near-Field Perception Tasks

The short-range LiDARs support several primarily classical perception tasks:

1. **Curb detection**: Height discontinuities at road edges are detected using local plane fitting and step detection -- a classical geometric algorithm
2. **Parking space estimation**: Free space around the vehicle is estimated by ray-casting through the near-field point cloud
3. **Close-range obstacle detection**: Small objects adjacent to the vehicle (shopping carts, posts, low walls) are detected through height thresholding and clustering
4. **Ground clearance verification**: Ensuring sufficient ground clearance for driving over speed bumps, ramps, or uneven surfaces

---

## 6. Radar Signal Processing

### Traditional Radar Signal Processing Pipeline (What Motional is Replacing)

The traditional automotive radar signal processing pipeline that Motional characterizes as producing "merely a few hundred detections per frame" follows this classical chain:

```
Tx Antenna ──▶ FMCW Chirp (77 GHz → 79 GHz) ──▶ Target Reflection
                                                        │
                                                        ▼
Rx Antenna ◀── Echo Signal ◀──────────────────── Reflected Signal
      │
      ▼
┌─────────────┐
│   Mixer      │  Mix Tx and Rx signals
│   (dechirp)  │  → IF (Intermediate Frequency) signal
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ADC         │  Analog-to-Digital Conversion
│  Sampling    │  → Raw digital samples (the "ADC data" Motional preserves)
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Range FFT (1st FFT)                          │  → Range profile
│  Doppler FFT (2nd FFT)                        │  → Range-Doppler Map (RDM)
│  Sum across Rx channels                       │  → Improved SNR
│  CFAR Detection                               │  → Target extraction
│  DOA Estimation (3rd FFT / beamforming)        │  → Azimuth & Elevation angles
│  Point Cloud Generation                       │  → (range, azimuth, elevation, velocity)
└──────────────────────────────────────────────┘
       │
       ▼
  Sparse Detection List (~100-300 points/frame)
```

### FMCW Waveform Processing

**Frequency-Modulated Continuous Wave (FMCW)** is the waveform used by Motional's Aptiv radars (77 GHz). The key classical signal processing steps:

1. **Chirp generation**: A linear frequency sweep (chirp) from 77 GHz to 79 GHz is transmitted. The chirp bandwidth (2 GHz) determines range resolution: `Δr = c / (2 × BW) = 7.5 cm`

2. **Dechirping (mixing)**: The received echo is mixed with the transmitted chirp. Because the echo is a time-delayed copy of the transmit signal, the mixer output is a sinusoid whose frequency is proportional to the round-trip delay (and hence range): `f_IF = (2 × BW × R) / (c × T_chirp)`

3. **Range FFT**: A Fast Fourier Transform on the IF signal converts the time-domain beat signal into a frequency spectrum where each peak corresponds to a target at a specific range.

4. **Doppler FFT**: A second FFT across multiple chirps (a "frame" of chirps) extracts the Doppler frequency shift, providing target radial velocity: `v_r = (λ × f_Doppler) / 2`

5. **Range-Doppler Map (RDM)**: The 2D FFT output is a matrix where one axis is range and the other is velocity. Each cell contains the signal energy from targets at that range-velocity combination.

### CFAR (Constant False Alarm Rate) Detection

**CFAR** is the classical detection algorithm that Motional's ML approach is designed to replace. CFAR dynamically sets a detection threshold based on local noise statistics:

1. **For each cell** in the Range-Doppler Map, estimate the local noise power from surrounding "guard" and "training" cells
2. **Compute threshold** as: `T = α × P_noise`, where `α` is chosen to achieve a desired false alarm probability
3. **Detect target** if the cell's power exceeds the threshold

CFAR has fundamental limitations that motivate Motional's ML approach:
- **Masking effects**: Strong targets can elevate the local noise estimate, causing weaker nearby targets to be missed
- **Fixed resolution cells**: CFAR operates on a fixed grid; extended objects spanning multiple cells are poorly handled
- **Loss of information**: CFAR is a hard thresholding operation -- all sub-threshold information is discarded, even if it contains useful semantic content
- **Clutter sensitivity**: In urban environments with many reflective surfaces, CFAR's noise estimation can be corrupted by clutter

### DOA (Direction of Arrival) Estimation

After CFAR detection, the angular position of each target is estimated using **beamforming** or **DOA estimation** algorithms:

- **FFT-based beamforming**: A spatial FFT across the receive antenna array elements estimates the angle of arrival
- **MIMO virtual array**: Modern 4D imaging radars (like Aptiv's FLR4+) use MIMO antenna configurations to create virtual arrays with larger apertures, improving angular resolution
- **Elevation estimation**: 4D radars add a vertical antenna dimension to resolve elevation angles, distinguishing overhead signs from vehicles at the same range

### Motional's Replacement: End-to-End ML from Raw ADC

Motional's imaging radar architecture replaces the entire classical pipeline from ADC onward with machine learning:

```
Traditional:  ADC → Range FFT → Doppler FFT → CFAR → DOA → Sparse Points (few hundred/frame)

Motional:     ADC → [Central GPU: End-to-End ML] → Dense Radar Imagery (20M+ points/sec equivalent)
```

The key innovations are:
- **Raw ADC data preservation**: Instead of on-chip DSP discarding information, the raw ADC samples are streamed at multi-Gbps rates to the vehicle's central High-Performance Computer (HPC)
- **Multi-Channel Multi-Scan (MCMS) aggregation**: An ML module aggregates data across multiple radar channels (antenna elements) and multiple scans (temporal frames) to produce high-fidelity radar images
- **3x VRU detection improvement**: The end-to-end pipeline achieves 3x Average Precision improvement in Vulnerable Road User detection compared to classical CFAR-based processing
- **20 Hz update rate**: Dense radar images are produced at 20 Hz, matching LiDAR frame rates

### What Classical Radar Processing Survives

Even with Motional's ML approach, certain classical radar processing elements persist:

| Component | Status | Reason |
|---|---|---|
| **FMCW waveform generation** | Classical (hardware) | Fundamental physics; no ML alternative |
| **Antenna beamforming (Tx)** | Classical (hardware) | Transmit-side beamforming is a hardware function |
| **ADC sampling** | Classical (hardware) | Analog-to-digital conversion is inherently classical |
| **Ego-velocity compensation** | Classical (preprocessing) | Radar Doppler measurements include ego-velocity that must be subtracted |
| **Coordinate transformation** | Classical (postprocessing) | Converting radar-frame detections to ego-vehicle frame |
| **CFAR** | **Replaced by ML** | The primary target of Motional's innovation |
| **DOA estimation** | **Replaced by ML** | Subsumed into the end-to-end model |

---

## 7. Camera ISP Pipeline

### Image Signal Processing Overview

Each of the 13 cameras on the IONIQ 5 produces raw sensor data that must pass through an **Image Signal Processor (ISP)** before it can be consumed by perception algorithms. The ISP pipeline is an entirely classical signal processing chain, implemented in hardware (either in the sensor, as a separate chip, or within the main SoC).

### ISP Pipeline Stages

The ISP pipeline for autonomous driving cameras follows two stages:

**Stage 1: Restoration (Signal Fidelity)**

| Operation | Description |
|---|---|
| **Demosaicing** | Converting the Bayer-patterned raw sensor data (RGGB) into full-color RGB images by interpolating missing color channels at each pixel |
| **Black level correction** | Subtracting the sensor's dark current offset to establish a true zero baseline |
| **Dead pixel correction** | Interpolating values for known defective pixels using neighboring pixel data |
| **Denoising** | Reducing sensor readout noise and photon shot noise using spatial and temporal filtering (e.g., bilateral filters, NLM) |
| **White balance** | Adjusting color channel gains to compensate for the color temperature of ambient illumination |
| **Lens shading correction** | Compensating for light falloff at image edges (vignetting) caused by lens optics |

**Stage 2: Enhancement (Perception Optimization)**

| Operation | Description |
|---|---|
| **Auto Exposure Control (AEC)** | Adjusting shutter speed and sensor gain to maintain optimal image brightness. This is the ISP's primary feedback loop -- exposure settings for the next frame are computed from the current frame's brightness histogram |
| **Auto Gain Control (AGC)** | Adjusting analog and digital gain to maintain signal levels in varying light |
| **High Dynamic Range (HDR)** | Combining multiple exposures (short and long) to capture both highlights and shadows simultaneously |
| **Tone mapping** | Compressing the HDR signal into a displayable/processable range while preserving local contrast |
| **Gamma correction** | Applying a nonlinear transfer function to match the sensor's linear response to a perceptually uniform encoding |
| **Color space conversion** | Converting from sensor-native color space to a standard space (e.g., YUV, RGB) for downstream processing |
| **Lens distortion correction** | Undistorting the image using the camera's intrinsic calibration parameters (radial and tangential distortion coefficients) |

### AEC/AGC: Critical for Las Vegas Operations

Auto Exposure Control is particularly critical for Las Vegas operations where lighting conditions change dramatically:

- **Tunnel transitions**: Driving from bright sunlight into a casino parking garage requires rapid exposure adaptation (several stops of dynamic range change in < 1 second)
- **Strip neon lighting**: The Las Vegas Strip produces extremely non-uniform illumination -- bright neon signs above with relatively dark road surfaces below
- **Night driving**: Headlight glare from oncoming vehicles against dark backgrounds requires HDR processing
- **Sunrise/sunset**: Low sun angles create extreme contrast between lit and shadowed regions

An underexposed image has poor SNR and contrast separation; an overexposed image has information loss in scene highlights. Both degrade perception model performance. The ISP must maintain optimal exposure for the perception pipeline's needs, not human visual comfort -- a key difference from consumer camera ISPs.

### HDR Processing for Autonomous Driving

HDR technology is essential because autonomous vehicles must simultaneously perceive:
- **Bright regions**: Sun-lit road surfaces, reflective vehicle bodies, neon signs
- **Dark regions**: Shadows under overpasses, pedestrians in dark clothing at night
- **Dynamic range**: The real world can exceed 120 dB; typical single-exposure cameras capture ~60 dB

Automotive HDR typically uses **split-exposure** sensors that capture short and long exposures simultaneously or in rapid succession, then combine them algorithmically. The combined image preserves detail in both highlights and shadows, providing the perception model with maximum scene information.

---

## 8. Time Synchronization

### The Multi-Sensor Temporal Alignment Problem

Motional's IONIQ 5 carries 30+ sensors, each operating at different frame rates:

| Sensor Type | Typical Frame Rate | Sensors | Total Data Streams |
|---|---|---|---|
| LiDAR (long-range) | 10-20 Hz | 1 | 1 |
| LiDAR (short-range) | 10-20 Hz | 4 | 4 |
| Cameras | 12-30 Hz | 13 | 13 |
| Radars | 13-20 Hz | 11 | 11 |
| IMU | 100-400 Hz | 1 | 1 |
| GPS | 10 Hz | 1 | 1 |

These sensors are **not synchronized** -- they capture data at independent times, creating a temporal alignment challenge. Even small timing errors have significant consequences: at highway speed (30 m/s), a 40 ms synchronization error corresponds to 1.2 m of positional uncertainty -- enough to misplace an object by an entire lane width.

### Hardware Time Synchronization Protocols

**GPS-PPS (Pulse Per Second)**: GPS receivers output a highly accurate 1-pulse-per-second signal synchronized to atomic clock time. This provides a global time reference with sub-microsecond accuracy to which all vehicle sensors can be aligned.

**IEEE 1588 PTP (Precision Time Protocol)**: PTP provides sub-microsecond synchronization over Ethernet networks. The protocol uses a master-slave architecture:

1. The **master clock** (typically GPS-disciplined) sends `Sync` messages with its timestamps
2. **Slave clocks** (sensors) measure the arrival time and compute clock offset
3. `Delay_Req` / `Delay_Resp` messages measure the one-way delay
4. Slaves adjust their clocks to match the master

**gPTP (generalized PTP / IEEE 802.1AS)**: A simplified variant of PTP designed specifically for automotive and time-sensitive networking (TSN) applications. gPTP has a slightly simplified message flow and is becoming the standard for in-vehicle sensor networks.

### Software Temporal Interpolation

Even with hardware synchronization, sensors capture data at different rates and with different latencies. Motional's patent **DK180393B1** ("Data Fusion System for a Vehicle Equipped with Non-Synchronized Perception Sensors") addresses this with a **temporal interpolation** approach:

**Core Method**: When sensor A captures a frame at time T1 and another frame at time Ts, and sensor B captures a frame at time T2 where T1 < T2 < Ts, the system synthesizes an **interpolated frame** from sensor A at time T2 using motion-flow analysis.

```
Sensor A:  Frame@T1 ─────────────────── Frame@Ts
                        │                     │
                        ▼ (interpolation)     │
           Synthesized Frame@T2               │
                        │                     │
Sensor B:  ─────────── Frame@T2 ─────────────┘
                        │
                        ▼
                   Fused Frame (both sensors aligned at T2)
```

**Conditional Execution**: Interpolation is only performed when the time difference exceeds a threshold (e.g., 5 ms). Below this threshold, the nearest frame is used directly to avoid unnecessary computation.

**Multi-Modal Applicability**: The patent explicitly covers interpolation for camera images (using optical flow / motion-flow analysis), radar maps (using radar-map processing techniques), and LiDAR point clouds (using point-cloud processing techniques).

### Ego-Motion Compensation Across Sensors

Beyond synchronizing sensor clocks, the vehicle must also account for its own motion between sensor captures. This is handled by:

1. **IMU integration**: The IMU (operating at 100-400 Hz) provides continuous ego-motion estimates between lower-rate sensor frames
2. **Pose interpolation**: Each sensor frame is tagged with the vehicle's pose at its capture time, computed by interpolating IMU-derived poses
3. **Coordinate alignment**: All sensor data is transformed into a common reference frame (typically the ego frame at a designated reference time) using the interpolated poses

---

## 9. Multi-Sensor Calibration

### Calibration Scope

With 30+ sensors on the IONIQ 5, calibration involves establishing the precise spatial relationships between all sensors and the vehicle body frame. The calibration problem decomposes into:

| Calibration Type | What It Determines | Sensors Affected | Typical Method |
|---|---|---|---|
| **Camera intrinsic** | Focal length, principal point, distortion coefficients | 13 cameras | Checkerboard patterns / calibration targets |
| **LiDAR intrinsic** | Beam directions, range offsets | 5 LiDARs | Factory calibration by manufacturer |
| **Camera extrinsic** | 6-DOF pose (rotation + translation) relative to ego frame | 13 cameras | Target-based or targetless methods |
| **LiDAR extrinsic** | 6-DOF pose relative to ego frame | 5 LiDARs | Target-based, then scan matching refinement |
| **Radar extrinsic** | 6-DOF pose relative to ego frame | 11 radars | Reflector-based or motion-based methods |
| **Camera-to-LiDAR** | Cross-modal alignment | 13 x 5 pairs | 3D calibration target with known patterns |
| **Temporal** | Time offsets between sensor clocks | All 30+ sensors | PTP + cross-correlation of motion signals |

### Extrinsic Calibration Process

The extrinsic calibration for each sensor establishes the **4x4 rigid body transformation matrix** from the sensor coordinate frame to the ego vehicle body frame:

```
T_sensor_to_ego = [ R  | t ]    where R is a 3x3 rotation matrix
                  [ 0  | 1 ]    and t is a 3x1 translation vector
```

The rotation is typically stored as a **quaternion** (w, x, y, z) for compactness and interpolation stability (quaternions avoid gimbal lock and can be smoothly interpolated via SLERP).

**Camera-to-LiDAR calibration** in the nuScenes era used a cube-shaped calibration target with three orthogonal planes featuring known patterns. After detecting the patterns in camera images and corresponding planes in the LiDAR point cloud, the transformation matrix is computed by aligning the detected planes.

**Production calibration** for the IONIQ 5 is performed at Motional's Autonomous Vehicle Integration Center at HMGICS (Hyundai Motor Group Innovation Center Singapore), where specialized calibration rigs and target arrays provide high-accuracy alignment for all 30+ sensors.

### Calibration Chain

The full transformation from any sensor to the global coordinate frame requires chaining two transforms:

```
T_sensor_to_global = T_ego_to_global × T_sensor_to_ego

where:
  T_sensor_to_ego  = from calibrated_sensor table (fixed for a given vehicle)
  T_ego_to_global  = from ego_pose table (changes with vehicle motion)
```

For cross-sensor alignment (e.g., projecting LiDAR points into a camera image):

```
T_lidar_to_camera = T_camera_to_ego^(-1) × T_lidar_to_ego
```

This chain of classical rigid-body transformations is fundamental to all multi-sensor fusion and is performed thousands of times per second.

---

## 10. nuScenes Calibration Architecture

### How Dataset Calibration Reflects Production Approaches

The nuScenes dataset provides a complete calibration framework that mirrors (at smaller scale) the calibration approach used in Motional's production vehicles. The calibration data is stored in two key database tables:

**`calibrated_sensor` Table**:

| Field | Type | Description |
|---|---|---|
| `token` | string | Unique identifier |
| `sensor_token` | string | Reference to the sensor type |
| `translation` | float[3] | Sensor position in ego frame [x, y, z] in meters |
| `rotation` | float[4] | Sensor orientation as quaternion [w, x, y, z] |
| `camera_intrinsic` | float[3][3] | 3x3 camera intrinsic matrix (empty for non-cameras) |

**`ego_pose` Table**:

| Field | Type | Description |
|---|---|---|
| `token` | string | Unique identifier |
| `timestamp` | int | Unix timestamp in microseconds |
| `translation` | float[3] | Vehicle position in global frame [x, y, z] in meters |
| `rotation` | float[4] | Vehicle orientation as quaternion [w, x, y, z] |

### Three Coordinate Frames

nuScenes uses three coordinate frames that mirror the production system:

| Frame | Origin | Use | Update Rate |
|---|---|---|---|
| **Global** | Fixed world origin | All annotations stored here | Static (map frame) |
| **Ego Vehicle** | Midpoint of rear axle | Sensor extrinsics defined here | Every sensor sample |
| **Sensor** | Each sensor's optical center | Raw sensor data native frame | Fixed (calibration) |

### Coordinate Transformation Utilities

The nuScenes devkit provides classical geometry utilities in `nuscenes.utils.geometry_utils`:

- **Quaternion-to-rotation-matrix** conversion for building 4x4 transform matrices
- **Point cloud transformation** functions for converting between coordinate frames
- **Box projection** functions for projecting 3D bounding boxes into camera images

These operations are all classical linear algebra -- matrix multiplication, quaternion algebra, and perspective projection -- with no ML components.

### Calibration Quality Impact on Perception

The nuScenes dataset demonstrates how calibration accuracy directly impacts perception:

- **PointPainting** depends on accurate camera-LiDAR calibration to correctly "paint" semantic scores onto LiDAR points. A calibration error of even a few pixels can assign wrong semantic labels.
- **BEV projection** from cameras requires accurate intrinsics and extrinsics; errors create spatial misalignment in the bird's-eye-view feature map.
- **TransFusion's soft association** mechanism was specifically designed to be robust to calibration errors, using attention-based fusion instead of hard geometric projection.

---

## 11. Online Calibration Monitoring

### Why Online Calibration Matters

Sensor calibration can drift over time due to:
- **Mechanical fatigue**: Vibrations from driving cause gradual loosening of sensor mounts
- **Thermal drift**: Temperature cycling (Las Vegas heat reaching 46C/115F) causes thermal expansion/contraction of mounting structures
- **Physical impacts**: Road debris, curb strikes, or door impacts can shift sensor positions
- **Aging**: Long-term degradation of adhesives, gaskets, or structural components

In a production robotaxi operating daily, calibration drift is not a theoretical concern but an operational reality.

### Online Calibration Detection Methods

Online calibration monitoring uses several classical techniques to detect drift without requiring physical recalibration:

**Motion-Based Detection**: By comparing the ego-motion estimated independently from two different sensors (e.g., camera visual odometry vs. LiDAR odometry), discrepancies reveal relative calibration drift. If the camera and LiDAR are properly calibrated, their independent ego-motion estimates should agree; divergence indicates miscalibration.

**Feature Correspondence Monitoring**: For camera-LiDAR pairs, 3D points projected into camera images should consistently align with visual features (edges, corners). Systematic misalignment across many frames indicates extrinsic calibration drift.

**Reprojection Error Tracking**: The average reprojection error of known landmarks (e.g., lane markings projected from LiDAR to camera) is tracked over time. A trending increase indicates calibration degradation.

**Hand-Eye Calibration**: The relative transformation between sensors is continuously re-estimated from their independent motion estimates using the hand-eye calibration formulation:

```
A × X = X × B

where A and B are motion transformations from two sensors,
and X is the unknown relative calibration between them.
```

### Recalibration Strategies

When drift is detected:
1. **Soft recalibration**: Online algorithms update the extrinsic parameters to minimize reprojection error, without requiring the vehicle to stop
2. **Hard recalibration**: The vehicle returns to a depot where physical calibration targets provide ground-truth alignment
3. **Degraded-mode operation**: If calibration uncertainty exceeds a threshold, the system can reduce speed, increase following distance, or request remote assistance

---

## 12. Point Cloud Preprocessing

### Ground Segmentation

Ground segmentation -- separating ground points from non-ground (obstacle) points -- is one of the most critical classical preprocessing steps for LiDAR perception. Multiple classical algorithms are used:

**RANSAC Plane Fitting**:
The classical approach uses RANSAC (Random Sample Consensus) to fit a plane to the lowest-elevation points:

1. **Random sampling**: Select 3 random points and fit a plane through them
2. **Consensus counting**: Count points within a distance threshold of the plane (inliers)
3. **Iterate**: Repeat for N iterations; keep the plane with the most inliers
4. **Refine**: Fit a least-squares plane to all inliers of the best model
5. **Segment**: Points within the distance threshold of the final plane are classified as ground

RANSAC is robust to outliers but can be slow for large point clouds (quadratic worst case). For a 128-channel LiDAR producing millions of points per scan, efficient implementations are critical.

**Regional Ground Plane Fitting (R-GPF)**:
Rather than fitting a single ground plane to the entire scan, the space is partitioned into annular regions using a **Concentric Zone Model (CZM)**. Each region gets its own ground plane fit, accommodating slopes, hills, and road crown. Principal Component Analysis (PCA) within each region estimates the local ground normal.

**Height-Based Thresholding**:
The simplest approach: points below a fixed height threshold (e.g., z < 0.3m above ground level) are classified as ground. This is fast but fails on slopes, curbs, and uneven terrain.

### Voxelization

Voxelization converts the irregular point cloud into a regular 3D grid:

```
Raw Point Cloud (N points, irregular spacing)
         │
         ▼
┌─────────────────────┐
│  Discretize space    │  e.g., voxel size = 0.1m x 0.1m x 0.2m
│  into 3D grid       │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Assign each point   │  Hash-based or sort-based voxel assignment
│  to its voxel        │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Aggregate points    │  Mean position, max height, point count per voxel
│  within each voxel   │
└─────────────────────┘
         │
         ▼
Voxelized Representation (W x H x D grid)
```

In Motional's pipeline, voxelization serves as the input to VoxelNet-based detectors. The **sparse 3D convolution** approach only processes occupied voxels (typically < 5% of the total grid), making the computation tractable.

### Range Filtering

Points beyond the maximum reliable detection range of the LiDAR (e.g., > 70m for Velodyne HDL-32E in nuScenes, > 300m for Alpha Prime) are filtered out, as they typically consist of noise returns rather than valid targets.

Points at very close range (< 1m) may also be filtered to remove returns from the vehicle body, sensor housing, or mounting structures.

### Multi-Sweep Accumulation

Multiple LiDAR scans (typically 10 sweeps at 20 Hz = 0.5 seconds) are accumulated after ego-motion compensation:

1. Each historical sweep's points are transformed from their original sensor frame to the current ego frame using the chain: `T_current_ego × T_historical_ego^(-1) × T_sensor_to_ego × p`
2. Each point is tagged with a **relative timestamp** (e.g., -0.45s for a point from 9 sweeps ago)
3. The accumulated cloud provides: denser coverage of static objects, motion trails for moving objects (providing velocity cues), and temporal consistency checks

---

## 13. Free Space Estimation

### Classical Occupancy Grid Methods

Free space estimation determines which areas around the vehicle are drivable (unoccupied) vs. occupied by obstacles. The classical approach uses **occupancy grid maps (OGMs)**.

**Ray-Casting (Inverse Sensor Model)**:
For each LiDAR beam:
1. All grid cells along the ray from the sensor to the hit point are marked as **free** (the beam passed through them without hitting anything)
2. The cell at the hit point is marked as **occupied**
3. Cells beyond the hit point are **unknown**

This is repeated for all beams, and the results are accumulated using **log-odds updates** (a Bayesian approach):

```
L(occupied | z) = L(occupied) + log(p(z | occupied) / p(z | free))

where L(x) = log(p(x) / (1 - p(x)))  is the log-odds form
```

The log-odds formulation is computationally efficient (additions instead of multiplications) and naturally handles uncertainty from multiple observations over time.

### Motional's Dynamic Occupancy Grid (DOG) Patent

Motional holds patent **US20210354690A1** ("Vehicle Operation Using a Dynamic Occupancy Grid"), invented by Matthias Sapuan and Dmytro S. Yershov. This patent describes a system that:

1. **Receives LiDAR data** from the vehicle's LiDAR sensors
2. **Generates a DOG** based on a semantic map, where the grid cells are defined using Cartesian coordinates
3. **Computes probability density functions** for each grid cell representing the probability that the cell is occupied by an object
4. **Employs recursive Bayesian filtering**: The probability density function is computed by recursively combining current LiDAR data with a posterior probability from the previous timestep
5. **Alternative Fourier transform approach**: The patent also describes using a Fourier transform to convert time-domain LiDAR measurements into spatial-domain occupancy probabilities

The semantic map integration is noteworthy: the grid is overlaid on the semantic map (which contains lane markings, road boundaries, etc.), allowing the system to distinguish between expected free space (drivable surface) and occupied regions.

### Free Space for Planning

The free space representation serves as a direct input to the planner:
- **Collision checking**: Proposed trajectories are validated against the occupancy grid to ensure they do not pass through occupied cells
- **Lane-free navigation**: In unstructured environments (parking lots, construction zones), the planner can navigate using free space directly rather than lane-following
- **Conservative defaults**: Unknown cells (unobserved regions) are treated as potentially occupied, enforcing conservative behavior

---

## 14. Road Geometry and Lane Detection

### Classical Lane Detection Methods

Before the rise of deep learning, lane detection relied on classical computer vision techniques:

**Edge Detection and Hough Transform**:
1. Apply edge detection (Canny, Sobel) to camera images
2. Filter for near-horizontal/near-vertical edges in the road region
3. Use the Hough transform to detect parametric lane line models (straight lines or curves)
4. Fit polynomial curves to the detected lane markings

**IPM (Inverse Perspective Mapping)**:
1. Use the camera intrinsics and extrinsics to compute a homography that maps the perspective road image to a top-down (BEV) view
2. In the BEV image, lane lines appear as parallel lines, simplifying detection
3. Apply thresholding and connected-component analysis to extract lane markings

### LiDAR-Based Road Boundary Detection

LiDAR provides complementary road geometry information through classical geometric analysis:

- **Curb detection**: Height discontinuities at road edges are detected by analyzing the elevation gradient of the ground surface. A step change of > 10 cm over a short horizontal distance indicates a curb.
- **Road surface classification**: LiDAR intensity values differ between road surfaces (asphalt: medium intensity) and off-road surfaces (grass: low intensity; concrete: high intensity), enabling surface-based road boundary estimation.
- **Guard rail detection**: Linear vertical structures along road edges are detected through point cloud clustering and line fitting.

### HD Map Integration

In Motional's production system, lane detection from sensors is cross-validated against the HD map:

**Map Layers** (from Motional's mapping pipeline):

| Layer | Content | Classical Method |
|---|---|---|
| **Geometric map** | 3D point cloud of static infrastructure (buildings, curbs, overpasses) | Graph SLAM from LiDAR scans |
| **Semantic map** | Driving lanes, road boundaries, traffic lights, lane connectivity | ML segmentation + human validation |
| **Traffic annotations** | Traffic light positions, sign locations, speed limits | ML detection + 3D point projection + temporal clustering |

**Map matching**: The vehicle's current perception (detected lane markings, curb positions) is compared against the HD map's stored road geometry. Discrepancies may indicate:
- Temporary road changes (construction zones, detours)
- Map aging (new road markings, changed lane configurations)
- Localization error (the vehicle's position estimate is wrong)

### Intersection Topology

Intersection topology -- the graph of lane connectivity through an intersection -- is a critical classical representation:

```
Lane A (approach) ──┐
                    ├── Intersection Node ──┬── Lane C (departure, through)
Lane B (approach) ──┘                      └── Lane D (departure, left turn)
```

The topology is stored in the HD map as a directed graph where:
- **Nodes** represent intersection centers and merge/diverge points
- **Edges** represent valid lane connections (which approach lanes can connect to which departure lanes)
- **Attributes** include turn type (left, right, through, U-turn), yield/stop requirements, and traffic signal associations

This classical graph representation enables the planner to determine valid maneuver sequences at intersections without requiring ML inference.

---

## 15. LiDAR-Based Localization

### Scan Matching Against HD Maps

LiDAR-based localization is a classical technique where the vehicle determines its position by matching current LiDAR scans against a pre-built HD map. This provides centimeter-level accuracy -- far better than GPS alone (which has ~2-5m urban accuracy due to multipath effects).

### ICP (Iterative Closest Point)

ICP is the foundational scan matching algorithm:

1. **Initialize** with a pose estimate (from GPS, odometry, or previous localization)
2. **Find correspondences**: For each point in the current scan, find the nearest point in the map
3. **Compute optimal transform**: Find the rigid body transformation (rotation + translation) that minimizes the sum of squared distances between corresponding points
4. **Apply transform**: Update the pose estimate
5. **Iterate**: Repeat until convergence (change in transform < threshold)

ICP is sensitive to initialization (can converge to local minima) and computationally expensive for large point clouds. It requires explicit point-to-point correspondences, which can be noisy.

### NDT (Normal Distributions Transform)

NDT is generally superior to ICP for vehicle localization and is used in production AV systems (Autoware, Apollo). NDT:

1. **Represents the map as normal distributions**: The map point cloud is subdivided into voxels, and each voxel's points are modeled as a normal (Gaussian) distribution with a mean and covariance
2. **Scores the current scan**: For each point in the current scan, compute the probability of that point belonging to the NDT cell it falls in
3. **Optimizes the pose**: Find the rigid body transformation that maximizes the total probability (or equivalently, minimizes the negative log-likelihood)

NDT advantages over ICP:
- **No explicit correspondences needed**: Points are matched against distributions, not other points
- **Smoother cost function**: The Gaussian representation creates a smooth optimization landscape with fewer local minima
- **Robustness**: Localization remains stable until occlusion exceeds ~25%, and only fails above ~80% occlusion
- **Accuracy**: Errors below 30 cm are achievable, sufficient for lane-level localization

### EKF-Based Localization Fusion

In practice, scan matching is fused with other localization sources using an **Extended Kalman Filter (EKF)**:

```
┌──────────────┐     ┌─────────┐     ┌──────────────────┐
│  GPS/GNSS     │────▶│         │     │                  │
│  (coarse pos) │     │         │     │  Localized Pose   │
├──────────────┤     │   EKF   │────▶│  (x, y, z, θ, φ, ψ) │
│  IMU          │────▶│  Fusion │     │  + covariance     │
│  (high rate)  │     │         │     │                  │
├──────────────┤     │         │     └──────────────────┘
│  NDT/ICP      │────▶│         │
│  (scan match) │     │         │
├──────────────┤     │         │
│  Wheel Odometry│───▶│         │
│  (dead reckoning)│  └─────────┘
└──────────────┘
```

The EKF prediction step uses the IMU and wheel odometry (classical dead reckoning: integrating angular rates and accelerations). The update step incorporates NDT/ICP scan matching results and GPS fixes when available.

### nuTonomy's Localization Innovation

nuTonomy's Singapore deployment used a distinctive localization approach: rather than matching ground-level features (which change frequently due to parked cars, construction, etc.), the system matched against **stable environmental features** -- buildings and permanent structures. As described by nuTonomy: "Even though stuff at road level can change all the time -- you can have a car parked here or not, for example -- a building is going to stay put." This made localization robust to the dynamic clutter of urban environments.

---

## 16. Kalman Filtering and State Estimation

### Role of Kalman Filtering in AV Perception

Kalman filtering is the classical workhorse for state estimation in autonomous vehicles. Even as Motional has moved toward ML-based tracking, Kalman filters remain embedded in multiple system components.

### Linear Kalman Filter (LKF)

Motional's radar tracking patent (US20210080558A1) explicitly uses a **Linear Kalman Filter** with a **constant velocity motion model**:

**State vector**: `x = [x, y, vx, vy, length, width]` (position, velocity, and object extent)

**Prediction step** (constant velocity model):
```
x_predicted = F × x_previous + process_noise

where F = [ I  Δt×I ]    (position updates with velocity × time)
          [ 0    I  ]    (velocity remains constant)
```

**Update step** (when a new measurement arrives):
```
innovation = z_measured - H × x_predicted
K = P_predicted × H^T × (H × P_predicted × H^T + R)^(-1)
x_updated = x_predicted + K × innovation
P_updated = (I - K × H) × P_predicted
```

where K is the Kalman gain, P is the state covariance, H is the measurement matrix, and R is the measurement noise covariance.

### Extended Kalman Filter (EKF) for Nonlinear Systems

For systems with nonlinear dynamics or measurement models (e.g., radar measurements in polar coordinates), the **Extended Kalman Filter** linearizes the models at each timestep using Jacobians:

```
State prediction:   x_predicted = f(x_previous, u)
Covariance prediction: P_predicted = F × P_previous × F^T + Q

where F = ∂f/∂x |_{x_previous}  (Jacobian of the motion model)
```

EKF is used in Motional's localization pipeline (fusing IMU, GPS, and scan matching results) and was historically used in the tracking pipeline before the transition to ML-based tracking.

### Unscented Kalman Filter (UKF)

For highly nonlinear systems where linearization introduces significant errors, the **Unscented Kalman Filter** propagates carefully chosen "sigma points" through the nonlinear functions, providing a better estimate of the posterior distribution without requiring Jacobian computation.

### Kalman Filtering Components That Survive in ML-Era

Even in Motional's current ML-heavy architecture, Kalman filtering persists in:

| Component | KF Variant | Reason for Persistence |
|---|---|---|
| **Ego-state estimation** | EKF | Fusing IMU, GPS, wheel odometry at high rate; well-understood dynamics |
| **Localization** | EKF | Fusing NDT scan matching with IMU dead reckoning |
| **Radar target tracking** | LKF (patent) | Classical radar tracking remains available as a safety fallback |
| **IMU bias estimation** | EKF | Online estimation of accelerometer and gyroscope biases |

---

## 17. Data Association

### The Matching Problem

Data association is the problem of determining which detection in the current frame corresponds to which tracked object from previous frames. This is a classical combinatorial optimization problem.

### Hungarian Algorithm (Optimal Assignment)

The Hungarian algorithm provides the **optimal** one-to-one assignment between detections and tracks by minimizing a total cost:

1. **Construct cost matrix**: Each entry C[i,j] represents the cost of assigning detection i to track j (typically a combination of position distance, velocity similarity, and appearance similarity)
2. **Solve the assignment**: The Hungarian algorithm finds the minimum-cost bijection in O(n^3) time
3. **Threshold**: Assignments with cost above a threshold are rejected (indicating new objects or lost tracks)

### Greedy Closest-Point Matching

CenterPoint simplified 3D multi-object tracking to **greedy closest-point matching**:

1. Compute pairwise distances between current detection centers and predicted track centers
2. Greedily assign each detection to its closest track (if within a threshold)
3. Unassigned detections become new tracks; unassigned tracks begin coasting

This approach achieved 63.8 AMOTA on nuScenes -- remarkably competitive despite its simplicity -- demonstrating that strong detection reduces the complexity of the tracking problem.

### Innovation-Based Matching (Radar Patent)

Motional's radar tracking patent describes a more nuanced association:

1. **Position innovation**: Squared Euclidean distance between predicted track center and measured cluster center
2. **Velocity innovation**: Comparison of axis-aligned velocity components between track prediction and cluster measurement
3. **Joint threshold**: A cluster associates to a track when the sum of innovations is minimized AND both individual innovations fall below predefined thresholds
4. **Multiple cluster handling**: When multiple clusters associate to one track, they are consolidated into a single cluster for the state update

### Multi-Sensor Data Association

For fusing detections across modalities (camera, LiDAR, radar), classical approaches include:

- **Spatial gating**: Only consider matches between detections from different sensors if their 3D positions (after coordinate transformation) are within a gate distance
- **Track-to-track fusion**: Independent tracks from each modality are associated and merged at the track level
- **Measurement-to-track fusion**: Raw detections from all modalities are associated to a common track pool

---

## 18. Track Management

### Track Lifecycle (Classical Approach)

Classical multi-object tracking manages track lifecycles through deterministic state machines:

```
                    ┌──────────────┐
  New Detection ───▶│  TENTATIVE   │──── Not confirmed ───▶ DELETED
                    │  (unconfirmed)│      after M frames
                    └──────┬───────┘
                           │ Confirmed
                           │ (associated for N consecutive frames)
                           ▼
                    ┌──────────────┐
                    │   CONFIRMED  │◀─── Re-associated ────┐
                    │   (active)   │                        │
                    └──────┬───────┘                        │
                           │ No association                 │
                           │ for 1+ frames                  │
                           ▼                                │
                    ┌──────────────┐                        │
                    │   COASTING   │────────────────────────┘
                    │  (predicted) │
                    └──────┬───────┘
                           │ No association
                           │ for K frames
                           ▼
                    ┌──────────────┐
                    │   DELETED    │
                    └──────────────┘
```

**Key parameters** (traditionally hand-tuned):

| Parameter | Description | Typical Value |
|---|---|---|
| N (confirmation) | Consecutive frames with association required to confirm | 3 |
| M (tentative timeout) | Frames without confirmation before deletion | 5 |
| K (coasting timeout) | Frames without association before a confirmed track is deleted | 5-10 |

### Track Management in Motional's Patent (US20210080558A1)

The radar tracking patent implements specific lifecycle rules:
- New tracks initialize with cluster parameters (position, velocity, predetermined length/width)
- Tracks remain in **INVALID state** until associated with clusters for at least **3 consecutive iterations**
- This prevents noise and transient reflections from spawning spurious tracks

### ML-Based Track Management (Motional's Transition)

Motional's unified tracking model replaces the classical heuristic-based lifecycle management with a **learned network output** that makes track birth/death decisions. As described in their blog post:

- Traditional systems use heuristics: "birth a track when enough positive signals are received; kill a track when positive signals stop for a certain time"
- The ML approach uses a dedicated network output for making track management decisions, learning optimal thresholds from data rather than hand-tuning

The ML approach can learn complex patterns: for instance, a pedestrian temporarily occluded behind a tree should coast longer than a radar ghost target, even though both have the same number of missed associations. The network learns these distinctions from training data.

---

## 19. NDS (nuScenes Detection Score)

### Design Philosophy

The nuScenes Detection Score (NDS) was designed by Motional's research team (Holger Caesar, Oscar Beijbom, et al.) to be a single number that captures both detection accuracy and the quality of detected objects' attributes. It is deliberately decomposable to allow detailed analysis.

### NDS Formula

```
NDS = (1/10) × [5 × mAP + Σᵢ (1 - min(1, mTP_i))  for i ∈ {ATE, ASE, AOE, AVE, AAE}]
```

Equivalently:
```
NDS = (1/10) × [5×mAP + (1-mATE') + (1-mASE') + (1-mAOE') + (1-mVE') + (1-mAAE')]

where mTP' = min(1, mTP)  clips the error to [0, 1]
```

**Weighting rationale**: mAP receives weight 5 (out of 10 total), meaning detection accuracy counts for 50% of the final score. The five True Positive error metrics each contribute 10% (for 50% total), ensuring that both "what you detect" and "how well you characterize what you detect" matter equally.

### Why This is a Classical Metric Design

NDS is fundamentally a classical metric -- it is computed entirely from geometric comparisons between predicted and ground-truth bounding boxes, with no learned components. The metric design embodies several classical principles:

1. **Precision-recall analysis**: mAP is computed by sweeping confidence thresholds and computing precision at each recall level
2. **Geometric error decomposition**: Translation, scale, orientation, velocity, and attribute errors are orthogonal components that can be independently optimized
3. **Center-distance matching** (see Section 20): A deliberate departure from IoU-based matching that better reflects autonomous driving requirements
4. **Threshold-free evaluation**: By averaging across multiple matching thresholds, NDS avoids sensitivity to any single operating point

---

## 20. Mean Average Precision

### mAP Computation in nuScenes

The nuScenes mAP computation follows a classical precision-recall framework but with an important innovation: **2D center distance on the ground plane** replaces Intersection over Union (IoU) as the matching criterion.

### Matching Protocol

For each class and each distance threshold d ∈ {0.5m, 1.0m, 2.0m, 4.0m}:

1. **Sort predictions** by confidence score (descending)
2. **Greedy matching**: For each prediction (in confidence order), find the closest unmatched ground truth within distance d (using 2D Euclidean distance on the ground plane)
3. **True Positive**: A prediction matched to a ground truth within distance d
4. **False Positive**: A prediction with no matching ground truth (or matched at distance > d)
5. **False Negative**: A ground truth with no matching prediction

### AP Computation

For each class and threshold:
1. Compute precision and recall at each confidence threshold
2. Compute the precision-recall curve
3. Compute Average Precision (AP) as the area under the precision-recall curve using the 40-point interpolation method (following PASCAL VOC convention)

Final mAP is the mean of per-class AP values averaged across all four distance thresholds.

### Why Center Distance Instead of IoU

This was a deliberate design decision by the nuScenes team for several reasons:

| Factor | Center Distance | IoU |
|---|---|---|
| **Long-range objects** | Small center error at long range is still considered a good detection | Small size error at long range can dramatically reduce IoU even when the center is well-localized |
| **Interpretability** | Error measured in meters (directly meaningful) | Dimensionless ratio (harder to interpret for AV planning) |
| **Error decomposition** | Size and orientation errors captured separately by mASE and mAOE | IoU conflates position, size, and orientation errors |
| **Consistency** | Behavior is consistent across ranges | IoU becomes unreliable for small or distant objects |

### True Positive Error Metrics

For each matched (true positive) detection, five error metrics are computed:

| Metric | Computation | Unit | Classical Algorithm |
|---|---|---|---|
| **ATE** | 2D Euclidean distance between centers on ground plane | meters | `sqrt((x_pred - x_gt)^2 + (y_pred - y_gt)^2)` |
| **ASE** | 1 - IoU after aligning centers and orientation | unitless | 3D IoU computation with aligned boxes |
| **AOE** | Smallest yaw angle difference | radians | `min(|θ_pred - θ_gt|, 2π - |θ_pred - θ_gt|)` |
| **AVE** | Absolute 2D velocity error | m/s | `sqrt((vx_pred - vx_gt)^2 + (vy_pred - vy_gt)^2)` |
| **AAE** | 1 - attribute classification accuracy | unitless | Exact-match comparison of categorical attribute |

Each metric is averaged across all true positive detections per class (sampled at recall points), then averaged across classes to produce the mean True Positive metric (mATE, mASE, etc.).

---

## 21. Tracking Metrics (AMOTA, AMOTP)

### Classical MOT Metrics Foundation

The nuScenes tracking evaluation builds on the classical **CLEAR MOT** metrics framework:

**MOTA (Multi-Object Tracking Accuracy)** at a single confidence threshold:
```
MOTA = 1 - (FN + FP + IDS) / GT

where:
  FN  = number of False Negatives (missed objects)
  FP  = number of False Positives (spurious tracks)
  IDS = number of Identity Switches (track assigned to wrong object)
  GT  = total number of ground truth objects
```

**MOTP (Multi-Object Tracking Precision)**: The average position error of matched tracks:
```
MOTP = Σ d(matched_track, ground_truth) / number_of_matches
```

### Why AMOTA Over MOTA

Standard MOTA has a critical flaw: it depends on the confidence threshold used to filter predictions. A low threshold increases recall but also false positives; a high threshold reduces false positives but increases false negatives. The "best" MOTA requires selecting the optimal threshold, which is not known at inference time.

**AMOTA (Average MOTA)** solves this by averaging MOTA across **40 recall thresholds** (n = 40 point interpolation):

```
AMOTA = (1/n) × Σ_{r ∈ recall_thresholds} MOTA(r)

where recall thresholds span from 0.1 to 1.0 (points with recall < 0.1 are excluded as noisy)
```

This provides a threshold-free metric that evaluates tracker performance across a range of operating points, from conservative (high precision, low recall) to aggressive (high recall, lower precision).

**AMOTP (Average MOTP)** similarly averages MOTP across recall thresholds, providing a threshold-free measure of localization precision.

### Tracking-Specific Classical Metrics

| Metric | Description | Classical Computation |
|---|---|---|
| **IDS** | Identity Switches | Count of frames where a ground truth object's assigned track ID changes |
| **Frag** | Track Fragmentations | Count of times a ground truth trajectory is interrupted (track lost and re-acquired) |
| **MT** | Mostly Tracked | Fraction of ground truth trajectories tracked for > 80% of their lifespan |
| **ML** | Mostly Lost | Fraction of ground truth trajectories tracked for < 20% of their lifespan |
| **FP** | False Positives | Tracks without corresponding ground truth |
| **FN** | False Negatives | Ground truth objects without corresponding tracks |

---

## 22. Segmentation Metrics

### mIoU (Mean Intersection over Union)

mIoU is the primary metric for nuScenes LiDAR semantic segmentation (nuScenes-lidarseg) and BEV map segmentation tasks.

**Per-class IoU computation**:
```
IoU_c = TP_c / (TP_c + FP_c + FN_c)

where for class c:
  TP_c = points correctly predicted as class c
  FP_c = points incorrectly predicted as class c (actually another class)
  FN_c = points of class c that were predicted as another class
```

Equivalently:
```
IoU_c = |prediction_c ∩ ground_truth_c| / |prediction_c ∪ ground_truth_c|
```

**mIoU** is the unweighted mean across all C classes:
```
mIoU = (1/C) × Σ_{c=1}^{C} IoU_c
```

For nuScenes-lidarseg, C = 16 (the challenge classes). This can be computed using a **confusion matrix**: IoU for class c equals the diagonal entry divided by the sum of its row, column, and minus the diagonal entry (to avoid double-counting).

**Handling absent classes**: When computing mIoU, the `nanmean` function is used to ignore classes that do not appear in a given evaluation sample, preventing division-by-zero errors.

### fwIoU (Frequency-Weighted IoU)

fwIoU weights each class's IoU by its frequency in the dataset:
```
fwIoU = Σ_{c=1}^{C} (freq_c × IoU_c) / Σ_{c=1}^{C} freq_c

where freq_c = number of ground truth points in class c
```

This gives more weight to common classes (drivable surface, vegetation) and less to rare classes (bicycle, construction vehicle), reflecting their relative importance by frequency.

### Panoptic Quality (PQ)

For Panoptic nuScenes (combined semantic + instance segmentation), the primary metric is **Panoptic Quality**:

```
PQ = SQ × RQ

where:
  SQ (Segmentation Quality) = mean IoU of all true positive segments
  RQ (Recognition Quality)  = F1 score = 2 × (Precision × Recall) / (Precision + Recall)
```

The decomposition separates:
- **SQ**: How well matched segments are with their ground truths (a measure of segmentation fidelity)
- **RQ**: How well the model identifies segments (the harmonic mean of precision and recall)

A perfect PQ of 1.0 requires both perfect segmentation (all segments perfectly aligned with ground truth, SQ = 1) and perfect recognition (no false positives or false negatives, RQ = 1).

---

## 23. What Survived the LDM Pivot

### The Architectural Transition

In 2024, Motional redesigned its autonomous driving system from a modular pipeline (Perception -> Prediction -> Planning -> Control) to a **Large Driving Model (LDM)** architecture with end-to-end learning. This was described as "an important turning point in autonomous driving technology development."

### Classical Components That Survived

| Component | Classical Status | Reason for Survival |
|---|---|---|
| **Sensor calibration** | Fully classical | Extrinsic/intrinsic calibration requires geometric precision that ML cannot replace; errors here corrupt all downstream ML |
| **Camera ISP** | Fully classical | Hardware-level signal processing; operates below the ML abstraction layer |
| **Time synchronization** | Fully classical | PTP/GPS clock synchronization is a hardware/protocol problem |
| **Ego-motion compensation** | Fully classical | IMU integration and point cloud motion correction are physics-based |
| **Coordinate transformations** | Fully classical | 4x4 matrix operations are exact mathematical transforms |
| **Safety guardrail system** | Mostly classical / rule-based | Deterministic safety checks that override ML decisions (see Section 24) |
| **AEB (Automatic Emergency Braking)** | Fully classical / rule-based | Time-to-collision computation with deterministic braking authority |
| **Localization** | Hybrid (classical + ML) | Scan matching (NDT/ICP) + EKF fusion with ML-based map matching |
| **HD map** | Hybrid (classical + ML) | Graph SLAM (classical) + ML for labeling and error correction |
| **Evaluation metrics** | Fully classical | NDS, mAP, AMOTA computed from geometric comparisons |
| **FMCW radar hardware** | Fully classical | Waveform generation, mixing, ADC are hardware functions |
| **Ground segmentation** | Partially survived | RANSAC/plane fitting may still be used as preprocessing for LDM inputs |
| **Track management** | Replaced by ML | Classical heuristic lifecycle replaced by learned network output |
| **Object detection** | Subsumed by LDM | PointPillars, CenterPoint replaced by end-to-end model |
| **Prediction** | Subsumed by LDM | Graph Attention Network replaced by shared transformer backbone |
| **Sensor fusion** | Subsumed by LDM | PointPainting, BEVFusion replaced by joint multi-modal encoding |

### The LDM Boundary

The LDM subsumes perception, prediction, and planning into a unified model, but it does **not** subsume:

```
               Classical Domain                    LDM Domain
          ┌───────────────────────┐          ┌─────────────────────┐
          │                       │          │                     │
Sensors──▶│  ISP, Calibration,   │──▶Raw───▶│  Multi-Modal        │
          │  Time Sync, Motion   │  Data     │  Transformer        │
          │  Compensation        │          │  Backbone            │
          │                       │          │                     │
          │  Coordinate           │          │  Perception +       │──▶ Control
          │  Transformations     │          │  Prediction +       │    Commands
          │                       │          │  Planning           │
          └───────────────────────┘          └──────────┬──────────┘
                                                       │
          ┌───────────────────────┐                     │
          │  Safety Guardrails    │◀────────────────────┘
          │  (rule-based, ~1%     │
          │   of scenarios)       │──▶ Override if unsafe
          │  AEB, formal safety   │
          └───────────────────────┘
```

---

## 24. Classical Safety Guardrails

### System Architecture

Motional's safety guardrail system runs **in parallel with** (not inside) the LDM, providing a deterministic safety layer:

- For **~90% of general driving situations**, the LDM handles all decisions end-to-end
- For **~1% of edge cases** (unexpected events), the safety guardrails override the LDM
- The guardrails have been **validated over a long period** using extensive real-world data

### Rule-Based Safety Components

The safety guardrail system includes deterministic, rule-based components that do not rely on ML:

**Automatic Emergency Braking (AEB)**:
AEB is the most critical classical safety component. It operates independently of the LDM and uses a **time-to-collision (TTC)** computation:

```
TTC = d / v_relative

where:
  d = distance to obstacle (from radar/LiDAR)
  v_relative = closing speed (from Doppler radar or consecutive LiDAR measurements)
```

AEB applies emergency braking when TTC falls below a threshold (typically 0.5-1.5 seconds depending on speed). The braking deceleration must be at least 5 m/s^2 per UN ECE Regulation 152. The algorithm uses **cascaded braking**: multi-stage partial braking followed by full braking if the threat persists.

**Safety Envelope Constraints**:
Inspired by Mobileye's RSS (Responsibility-Sensitive Safety) framework and nuTonomy's own formal methods heritage, the guardrail system enforces deterministic safety constraints:

- **Minimum following distance**: Computed from current speed and assumed maximum deceleration of the lead vehicle
- **Safe lateral distance**: Minimum distance to adjacent vehicles/pedestrians during lane changes
- **Right-of-way compliance**: Deterministic yield rules at intersections and crosswalks
- **Speed limits**: Hard enforcement of posted speed limits and context-dependent speed restrictions (school zones, construction)

**Formal Verification Heritage**:
The guardrail system's design philosophy directly inherits from nuTonomy's formal methods approach: the system is designed to be **verifiable** -- its behavior in any given scenario can be deterministically predicted and validated against specifications, unlike the LDM whose outputs are probabilistic.

### Parallel Execution Model

The guardrail operates as a **safety monitor** pattern (common in formal methods and safety-critical systems):

```
Sensors ──▶ LDM ──▶ Proposed Action ──▶ ┌────────────────┐ ──▶ Actuators
                                         │ Safety Monitor │
                                         │ (Guardrails)   │
                                         │                │
                                         │ IF action is   │
                                         │ safe: pass     │
                                         │ ELSE: override │
                                         │ with safe action│
                                         └────────────────┘
```

The Safety controller is prioritized whenever the LDM does not meet the safety constraint. This architecture ensures that even if the LDM makes an erroneous decision (e.g., due to a novel scenario not well-represented in training data), the guardrail system prevents unsafe actions.

---

## 25. Perception-Planning Interface

### Classical Representations at the Module Boundary

In the modular (pre-LDM) architecture, the perception-planning interface used classical data structures:

**Object List Representation**:
The primary perception output was a structured list of tracked objects, each containing:

```
Object = {
    id:          int          // unique track ID
    class:       enum         // car, pedestrian, cyclist, etc.
    position:    (x, y, z)   // 3D center in ego frame
    velocity:    (vx, vy)    // 2D velocity vector
    acceleration: (ax, ay)   // estimated acceleration
    size:        (l, w, h)   // bounding box dimensions
    heading:     θ           // yaw angle
    confidence:  [0, 1]      // detection confidence
    attributes:  {...}       // parked/moving, sitting/standing, etc.
    trajectory:  [(x,y,t)]   // predicted future positions with timestamps
    covariance:  P           // uncertainty estimate (from Kalman filter)
}
```

**Occupancy Grid Representation**:
For areas without discrete objects (free space, road surface), an occupancy grid provides a dense spatial representation where each cell contains:
- Occupancy probability (0 = free, 1 = occupied)
- Semantic class (drivable, sidewalk, vegetation, etc.)
- Height information (for detecting overhanging obstacles)

**HD Map Interface**:
The planner also receives map data in classical graph/geometric formats:
- Lane centerlines as polylines with curvature and width attributes
- Intersection topology as a directed graph of lane connections
- Traffic light states (from camera-based detection)
- Speed limits and other regulatory information

### How the LDM Changes the Interface

In the LDM architecture, the explicit perception-planning interface largely disappears. Instead:

- The shared transformer backbone produces **learned embeddings** that encode scene understanding
- **PredictNet** encodes spatiotemporal relationships between agents and map elements into high-dimensional latent representations
- An **optimization-based trajectory generator** creates motion plan candidates from these embeddings
- An **ML ranker** evaluates trajectories using multi-objective loss

However, the classical representations **do not fully disappear** -- they re-emerge for:
1. **Introspection and debugging**: Motional explicitly requires LDMs to provide "enough introspection to really understand what's happening so that we can more easily improve the system and solve long tail issues"
2. **Safety guardrail inputs**: The parallel safety system needs classical object lists and occupancy grids to compute TTC, safe distances, etc.
3. **Logging and replay**: Structured data is more storage-efficient and analyzable than raw embeddings

---

## 26. Geometric Post-Processing

### Non-Maximum Suppression (NMS)

NMS is the classical post-processing step applied to detection outputs to remove duplicate detections:

**Classical NMS Algorithm**:
1. Sort all detections by confidence score (descending)
2. Select the highest-confidence detection and add it to the output set
3. Compute the IoU between this detection and all remaining detections
4. Remove (suppress) all detections with IoU above a threshold (typically 0.3-0.5)
5. Repeat from step 2 with the remaining detections

For 3D object detection (as in Motional's pipeline), IoU is computed on 3D bounding boxes or on their BEV projections. The computational complexity of classical NMS is O(n^2) in the worst case.

**Rotated NMS**: Standard NMS uses axis-aligned IoU, but 3D objects have arbitrary orientations. Rotated NMS computes IoU between oriented bounding boxes -- a more complex geometric computation involving polygon intersection.

### Consistency Checks on LDM Perception Outputs

Even with end-to-end learning, geometric consistency checks serve as sanity filters:

| Check | Description | Classical Method |
|---|---|---|
| **Physical plausibility** | Detected objects must have physically reasonable sizes (a "car" cannot be 50m long) | Bounds checking against class-specific size priors |
| **Temporal consistency** | Object positions should be consistent across frames given estimated velocity | Smoothing / outlier rejection on tracked trajectories |
| **Geometric consistency** | Objects should not interpenetrate each other or the ground plane | Overlap checking between bounding boxes |
| **Map consistency** | Detected road objects should be near road surfaces, not floating in air | Cross-referencing detection positions against HD map |
| **Velocity sanity** | Detected velocities should be physically achievable for the detected class | Maximum velocity bounds per class |

### Box Refinement and Aggregation

Post-processing of 3D bounding boxes includes classical geometric operations:
- **Box smoothing**: Temporal smoothing of box dimensions using exponential moving average or Kalman filtering to reduce frame-to-frame jitter
- **Heading disambiguation**: 3D detectors often predict heading modulo 180 degrees; the correct heading is resolved using velocity direction
- **Size normalization**: Detected box sizes are optionally constrained to class-specific size distributions learned from the training data

---

## 27. Radar-Only Perception

### Motional's Strategic Vision

Motional has publicly articulated a vision for radar to become "the central sensing modality" for future AV platforms. The strategic reasoning is driven by cost, durability, and weather resilience:

- Automotive-grade radars cost **5-10x less** than LiDAR
- Radar has **70+ years** of industrial and defense heritage
- **Solid-state electronics** with no moving parts means greater durability
- Radar **retains functionality** in rain, snow, fog, dust, and darkness
- **Direct Doppler measurement** provides instantaneous velocity -- a measurement that neither LiDAR nor cameras can provide directly

Motional is "studying whether future iterations could utilize radars as more of a central sensing modality, without sacrificing performance."

### Classical Radar Processing Limitations for Primary Sensing

For radar to replace LiDAR as the primary sensor, the classical radar processing challenges that must be overcome include:

**Angular Resolution**: Classical radar has much coarser angular resolution than LiDAR (degrees vs. fractions of a degree). Motional's FLR4+ 4D imaging radar with ML-based processing is narrowing this gap, but angular resolution remains a fundamental challenge for distinguishing closely-spaced objects.

**Multi-Path Reflections**: Radar signals bounce off multiple surfaces (buildings, guardrails, underpasses), creating ghost targets. Classical CFAR detection cannot reliably distinguish direct returns from multi-path artifacts. ML-based processing learns to identify and suppress multi-path ghosts.

**Extended Object Representation**: Classical radar returns are point-like, providing no shape information. A truck and a motorcycle at the same range may produce similar individual returns. Motional's extended object tracking patent addresses this by clustering returns and fitting geometric models (see Sections 16-17).

**Clutter in Urban Environments**: Urban environments produce dense radar clutter from buildings, fences, parked vehicles, and road signs. Classical CFAR's noise estimation is corrupted by this distributed clutter, reducing detection sensitivity.

### What Classical Radar Processing Must Improve

| Challenge | Classical Limitation | Motional's Approach |
|---|---|---|
| **Sparse detections** | CFAR produces ~100-300 detections/frame | ML on raw ADC: 20M+ points/sec equivalent |
| **Poor VRU detection** | Pedestrians have small radar cross-section; CFAR misses them | 3x AP improvement with end-to-end ML |
| **No semantic understanding** | CFAR extracts range, angle, velocity -- no object class | ML-based classification from radar imagery |
| **Information loss** | DSP discards sub-threshold data | Raw ADC preservation retains all information |
| **Angular resolution** | FFT-based DOA limited by antenna aperture | MIMO virtual arrays + ML super-resolution |

---

## 28. Radar Point Cloud Processing

### Classical 4D Radar Point Cloud Pipeline

For 4D imaging radars (which provide range, azimuth, elevation, and Doppler velocity), the classical processing pipeline generates a point cloud:

```
Range-Doppler Map (from 2D FFT)
         │
         ▼
CFAR Detection (extract target cells)
         │
         ▼
DOA Estimation (azimuth + elevation via spatial FFT / beamforming)
         │
         ▼
Point Cloud Generation:
  For each detected target:
    - range r, azimuth θ, elevation φ, velocity v
    - Convert spherical → Cartesian:
        x = r × cos(φ) × cos(θ)
        y = r × cos(φ) × sin(θ)
        z = r × sin(φ)
    - Attach velocity: v_radial
         │
         ▼
Radar Point Cloud: {(x, y, z, v_radial)}ₙ
```

### Radar Point Cloud Clustering (DBSCAN)

Motional's radar tracking patent uses **DBSCAN (Density-Based Spatial Clustering of Applications with Noise)** adapted for traffic scenarios:

**Standard DBSCAN**:
1. For each point, count the number of neighbors within distance `eps`
2. Points with > `min_pts` neighbors are **core points**
3. Core points within `eps` of each other are in the same cluster
4. Non-core points within `eps` of a core point are **border points** (assigned to the cluster)
5. Points that are neither core nor border are **noise**

**Motional's Traffic-Adapted DBSCAN**:
- Uses **elliptical regions** instead of circular regions, with the major axis parallel to the direction of traffic flow -- this prevents adjacent vehicles traveling in the same direction from being merged into a single cluster
- Uses **range-dependent epsilon**: At longer ranges, radar points are sparser, so the clustering radius is increased proportionally
- Incorporates **radial velocity** as an additional clustering dimension: points with similar positions but very different velocities are separated (e.g., an oncoming vehicle vs. a stationary guardrail)

### RLS-Based Velocity Estimation for Clusters

Motional's patent introduces a **Recursive Least Squares (RLS)** approach for computing cluster velocity from radar returns:

**The velocity estimation problem**: Each radar return provides a **radial velocity** (velocity along the line from the radar to the target):
```
v_r = v_x × cos(θ) + v_y × sin(θ)
```

where v_x, v_y are the target's true velocity components and θ is the bearing angle. With multiple returns at different bearings (from an extended object), the system can solve for v_x and v_y.

**RLS approach**:
- An ensemble of **10 RLS filters** processes the cluster's points in **randomized orders**
- Each filter recursively updates velocity estimates as points are processed
- The filter producing the **smallest reprojected range rate error** is selected as the velocity estimate
- The randomized ensemble approach provides robustness against outlier radar returns and clutter

**Ego-velocity compensation**: All radar measurements include the ego vehicle's velocity. Before velocity estimation, each return's radial velocity is compensated by subtracting the ego vehicle's velocity component along the bearing direction:
```
v_r_compensated = v_r_measured - v_ego_x × cos(θ) - v_ego_y × sin(θ)
```

### Cluster Geometric Estimation

After clustering, the cluster's spatial extent is estimated classically:
1. **Heading estimation**: The cluster's heading θ is estimated from the velocity direction or from the elongation axis of the point distribution
2. **Rotation alignment**: Points are rotated by -θ to align with the heading direction
3. **Bounding box computation**: In the aligned frame, the bounding box is computed from the extrema of the rotated points
4. **Center computation**: The geometric center of the bounding box in Cartesian coordinates

---

## 29. Night Perception on the Strip

### The Las Vegas Perception Challenge

Driving along the Las Vegas Strip presents uniquely challenging perception scenarios that combine multiple classical challenges simultaneously:

**Extreme Dynamic Range**:
- Bright neon signs and LED billboards (potentially hundreds of thousands of lux) directly adjacent to dark road surfaces (< 1 lux)
- The HDR challenge is more extreme than almost any other urban environment

**Visual Confusion (Cameras)**:
- High-resolution video screens displaying vehicle images -- the perception system must not "think there's a truck up in the air" when seeing one on a billboard
- A flat screen displaying a person must register as "a flat screen" not a 3D pedestrian
- Dynamic lighting creates rapidly changing illumination that can confuse exposure control

**Traffic Light Disambiguation**:
The system must distinguish actual traffic signals from the "swirl of colors shining out from all the signs and screens along The Strip." This is addressed through multi-sensor fusion: "If we were just using image sensors that could be problematic."

### Multi-Sensor Approach to Visual Confusion

The classical insight that solves the neon lights problem is **multi-sensor geometric consistency**:

1. **Camera** detects a vehicle image on a billboard
2. **LiDAR** measures the 3D structure at that location -- it sees a flat surface (the billboard), not a 3D object
3. **Radar** detects no moving target at that location (zero Doppler return from a static billboard)
4. **Fusion decision**: The multi-modal evidence confirms the object is a 2D image on a flat surface, not a real vehicle

Similarly, Motional's perception system classifies objects **only within the drivable area**, ignoring objects above road level (billboards, elevated signs). This is a classical spatial filtering approach: objects outside the 3D region of interest (the road surface +/- reasonable heights for vehicles and pedestrians) are excluded from the detection pipeline.

### Night-Specific Classical Challenges

| Challenge | Classical Response |
|---|---|
| **Headlight glare** | Camera ISP HDR processing; LiDAR/radar are unaffected by headlights |
| **Wet road reflections** | Neon signs reflected in wet pavement create false detections; LiDAR confirms actual surface geometry |
| **Shadows vs. real obstacles** | Camera shadows appear as dark regions; LiDAR/radar confirm presence or absence of physical objects |
| **Sensor saturation** | Camera exposure control prevents saturation from bright signs; radar is immune; LiDAR uses narrow temporal gating |

### V2X Infrastructure Augmentation (Derq Partnership)

Motional partnered with **Derq** to supplement perception with **overhead camera data** at challenging Las Vegas intersections:

- Cameras placed high above intersections connect to Derq's AI systems running on roadside computers
- From the elevated vantage point, Derq's system sees cars exiting parking lots, pedestrians stepping between parked cars, and cyclists weaving through stopped traffic
- The system predicts movements to provide advance notice of potentially challenging interactions
- Data is transmitted to Motional's vehicles for processing alongside the onboard sensor suite

This V2X approach addresses classical perception limitations: overhead views resolve occlusions that ground-level sensors cannot see (e.g., a pedestrian hidden behind a parked SUV). The fusion of overhead and vehicle-level views is a classical geometric problem -- coordinate transformation between the infrastructure camera's frame and the vehicle's ego frame.

---

## 30. Pedestrian Detection in Crowded Environments

### VRU Detection: The Core Safety Challenge

Vulnerable Road User detection is the most safety-critical perception task. Las Vegas amplifies this challenge with:

- **Dense pedestrian crowds** on the Strip, particularly at night
- **Unusual appearances**: Performers in large feathery costumes, people on stilts, costumed characters (clowns, showgirls), tourists carrying oversized objects
- **Unpredictable behavior**: Jaywalking across wide boulevards, sudden movements into traffic, intoxicated pedestrians

### Multi-Modal VRU Detection

Classical challenges in pedestrian detection are addressed through multi-modal redundancy:

**LiDAR**: Detects pedestrians as clusters of points with characteristic height (~1.5-2m), width (~0.5m), and shape. Classical challenges include:
- Pedestrians at long range produce very few LiDAR returns (< 10 points at 50m+ with a 32-beam LiDAR)
- Groups of pedestrians can merge into a single cluster
- Unusual costumes (wings, stilts) change the expected point cloud profile

**Radar**: Provides unique information for pedestrian detection:
- **Micro-Doppler signatures**: Walking pedestrians produce distinctive Doppler patterns from the periodic motion of arms and legs, distinguishing them from stationary objects
- **Radar cross-section**: Pedestrians have small but detectable radar cross-sections (~1 m^2 for an adult)
- Motional's imaging radar achieves **3x Average Precision improvement** in VRU detection over classical CFAR-based processing

**Camera**: Provides the richest information for classification:
- Texture and appearance features distinguish pedestrians from poles, signs, and other vertical objects
- Pose estimation identifies pedestrian intent (walking toward road vs. standing)
- Attribute classification (adult vs. child, carrying objects) enables appropriate safety margins

### Classical Conservative Defaults

When perception confidence is low, the system applies classical conservative behavior:

1. **Default to VRU classification**: Ambiguous objects near the road surface are treated as potential pedestrians until confirmed otherwise
2. **Maximum safety margin**: For uncertain VRU detections, the planner uses the most conservative motion prediction (assuming the pedestrian may step into the roadway at any moment)
3. **Speed reduction**: In areas with dense pedestrian activity (e.g., the Strip), the vehicle operates at reduced speeds to ensure adequate stopping distance
4. **Object permanence**: Temporarily occluded pedestrians are maintained in the scene model using temporal reasoning -- if a pedestrian was visible 2 seconds ago and could not have left the scene, they are still assumed to be present

### The Clown Edge Case

In a documented edge case from Motional's Las Vegas testing, a clown juggling pins on the sidewalk dropped a pin and stepped into the street directly in front of an IONIQ 5 robotaxi. Despite the unusual costume and unexpected behavior, the vehicle stopped safely. This case demonstrates the multi-layered approach:

1. **Detection**: The LiDAR detected a human-sized object near the road edge; the camera classified it as a pedestrian despite the costume
2. **Prediction**: The prediction system assigned high probability to the pedestrian entering the roadway (proximity to curb edge, body orientation toward street)
3. **Planning**: The planner maintained a safety margin for the predicted pedestrian trajectory
4. **Continuous Learning**: This scenario was mined from fleet data and incorporated into training for improved handling of costumed performers

---

## Summary: The Classical Foundation Under the ML Stack

Even as Motional's perception stack has evolved toward end-to-end learning with Large Driving Models, the classical and non-ML components remain foundational. They can be categorized into three tiers:

### Tier 1: Permanently Classical (Cannot Be Replaced by ML)

| Component | Reason |
|---|---|
| Camera ISP | Hardware-level signal processing operating below the ML abstraction |
| Sensor calibration | Geometric precision requirements; errors here corrupt all ML downstream |
| Time synchronization | Hardware protocol (PTP/GPS) problem |
| Coordinate transformations | Exact mathematical operations (matrix multiplication, quaternion algebra) |
| FMCW radar waveform | Fundamental physics of electromagnetic wave propagation |
| Evaluation metrics | Mathematical definitions (mAP, NDS, AMOTA, mIoU) by design |

### Tier 2: Classical Components Surviving Alongside ML

| Component | Role |
|---|---|
| Safety guardrails | Deterministic safety layer running in parallel with LDM for edge cases |
| AEB | Rule-based emergency braking with TTC computation |
| Ego-state estimation | EKF fusion of IMU, GPS, wheel odometry |
| Localization | NDT/ICP scan matching + EKF fusion |
| Ground segmentation | RANSAC/plane fitting as preprocessing (may feed into LDM) |
| Online calibration monitoring | Motion-based drift detection |
| HD map infrastructure | Graph SLAM, geometric map layers, lane topology graphs |

### Tier 3: Classical Components Subsumed by LDM but Informing Its Design

| Component | Legacy Influence |
|---|---|
| Formal methods / Rulebooks | Inspired the safety guardrail architecture and the emphasis on verifiable behavior |
| Kalman filtering | The LDM's attention mechanism learns similar temporal smoothing; KF still used in ego-state estimation |
| DBSCAN clustering | ML-based detection replaces clustering, but the insight of density-based grouping influences network design |
| NMS | Learned NMS or set-based prediction replaces classical NMS in modern detectors |
| Hungarian algorithm | Transformer-based tracking replaces Hungarian matching but uses similar optimal assignment concepts |
| CFAR detection | ML-based radar processing replaces CFAR, but the training signal is generated using CFAR-processed labels |

The nuTonomy formal methods heritage is perhaps the most enduring legacy: the emphasis on **provable correctness**, **compositionality**, and **rule-based safety specifications** directly shaped the safety guardrail system that now runs alongside the LDM. Motional's explicit requirement that LDMs provide "enough introspection to really understand what's happening" reflects the formal methods philosophy that safety-critical systems must be analyzable, not black boxes.

---

## Sources

### Motional Official Sources
- [Motional - Imaging Radar Architecture](https://motional.com/news/technically-speaking-motionals-imaging-radar-architecture-paves-road-major-improvements)
- [Motional - Keeping Focus: Las Vegas Distractions](https://motional.com/news/keeping-focus-motionals-robotaxis-block-out-las-vegas-distractions)
- [Motional - Rulebooks: Liability, Ethics, and Culture-Aware Behavior](https://motional.com/news/liability-ethics-and-culture-aware-behavior-specification-using-rulebooks)
- [Motional - End-to-End ML Tracking](https://motional.com/news/building-towards-end-end-machine-learning-autonomy-improving-multi-object-tracking-single)
- [Motional - Using ML to Map Roadways Faster](https://motional.com/news/technically-speaking-mapping)
- [Motional - Large Driving Models (LDMs)](https://motional.com/news/how-motional-accelerating-scale-affordability-and-safety-large-driving-models-ldms)
- [Motional - Las Vegas Perception Challenges](https://motional.com/news/jackpot-how-las-vegas-helped-make-motionals-driverless-vehicles-ready-consumers)
- [Motional - Derq Partnership Bird's-Eye View](https://motional.com/news/motional-derq-partner-give-driverless-vehicles-birds-eye-view)
- [Motional - IONIQ 5 Robotaxi](https://motional.com/news/ioniq-5-robotaxi-production-vehicle-tailor-made-robotaxi-service)
- [Motional Builds Radars into Perception System (Aptiv)](https://www.aptiv.com/en/insights/article/motional-builds-radars-into-perception-system)
- [Motional CEO Introduces Safety Guardrails (Seoul Economic Daily)](https://en.sedaily.com/finance/2026/03/08/motional-ceo-introduces-safety-guardrails-for-autonomous)
- [Motional Robotaxi Safety (CleanTechnica)](https://cleantechnica.com/2026/01/16/how-motionals-robotaxi-is-making-driverless-vehicles-a-safe-reliable-and-accessible-reality/)

### Research Papers
- [Censi et al. - Liability, Ethics, and Culture-Aware Behavior Specification using Rulebooks (ICRA 2019)](https://arxiv.org/abs/1902.09355)
- [Safety of the Intended Driving Behavior Using Rulebooks (2021)](https://arxiv.org/abs/2105.04472)
- [Karaman & Frazzoli - Sampling-based Algorithms for Optimal Motion Planning (IJRR 2011)](https://arxiv.org/abs/1105.1186)
- [Wongpiromsarn et al. - TuLiP: Receding Horizon Temporal Logic Planning (HSCC 2011)](https://dl.acm.org/doi/10.1145/1967701.1967747)
- [Wongpiromsarn - Formal Methods for Autonomous Systems (2023)](https://tichakorn.dev/publication/wongpiromsarn-2023-formal/)
- [Formal Methods to Comply with Rules of the Road (Automatica 2022)](https://www.sciencedirect.com/science/article/abs/pii/S0005109822005568)
- [nuScenes: A Multimodal Dataset for Autonomous Driving (CVPR 2020)](https://arxiv.org/abs/1903.11027)
- [PointPillars (CVPR 2019)](https://arxiv.org/abs/1812.05784)
- [CenterPoint (CVPR 2021)](https://arxiv.org/abs/2006.11275)

### Patents
- [US20210080558A1 - Extended Object Tracking Using RADAR (Motional)](https://patents.google.com/patent/US20210080558A1/en)
- [US20210354690A1 - Vehicle Operation Using a Dynamic Occupancy Grid (Motional)](https://uspto.report/patent/app/20210354690)
- [DK180393B1 - Data Fusion for Non-Synchronized Sensors (Aptiv/Motional)](https://patents.google.com/patent/DK180393B1/en)

### Sensor Hardware
- [Ouster VLS-128 (Alpha Prime)](https://ouster.com/products/hardware/vls-128)
- [Hesai FT120 Short-Range LiDAR](https://www.hesaitech.com/product/ft120/)
- [Hesai FTX Short-Range LiDAR](https://www.hesaitech.com/product/ftx/)
- [Aptiv Radars](https://www.aptiv.com/en/solutions/advanced-safety/adas/radars)

### nuScenes Devkit and Documentation
- [nuScenes Schema](https://github.com/nutonomy/nuscenes-devkit/blob/master/docs/schema_nuscenes.md)
- [nuScenes Detection Evaluation](https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/eval/detection/README.md)
- [nuScenes Tracking Evaluation](https://github.com/nutonomy/nuscenes-devkit/tree/master/python-sdk/nuscenes/eval/tracking)
- [nuScenes Panoptic Challenge](https://www.nuscenes.org/panoptic)

### Other References
- [MIT News - nuTonomy Driverless Taxi](https://news.mit.edu/2016/startup-nutonomy-driverless-taxi-service-singapore-0324)
- [IEEE Spectrum - nuTonomy Singapore](https://spectrum.ieee.org/after-mastering-singapores-streets-nutonomys-robotaxis-are-poised-to-take-on-new-cities)
- [nuTonomy Wikipedia](https://en.wikipedia.org/wiki/NuTonomy)
- [Tichakorn Wongpiromsarn - Iowa State University](https://tichakorn.dev/)
- [ISP Parameter Tuning for Visual Perception in Autonomous Driving](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321211/)
- [Calibration Drift Detection and Automated Recalibration (ResearchGate)](https://www.researchgate.net/publication/395234426)
- [Motional + Derq - Autonomous Vehicle International](https://www.autonomousvehicleinternational.com/news/motional-and-derq-embark-on-las-vegas-trial-to-boost-perception-with-overhead-camera-data.html)
