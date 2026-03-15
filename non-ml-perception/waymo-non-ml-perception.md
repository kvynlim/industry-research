# Waymo Perception Stack: Non-ML and Hybrid-ML Techniques — Exhaustive Deep Dive

*Last updated: March 2026*

---

## Table of Contents

1. [LiDAR Signal Processing](#1-lidar-signal-processing)
2. [Radar Signal Processing](#2-radar-signal-processing)
3. [Camera ISP Pipeline](#3-camera-isp-pipeline)
4. [Stereo / Multi-View Geometry](#4-stereo--multi-view-geometry)
5. [Point Cloud Classical Processing](#5-point-cloud-classical-processing)
6. [Optical Flow and Scene Flow](#6-optical-flow-and-scene-flow)
7. [Edge / Feature Detection](#7-edge--feature-detection)
8. [Intrinsic Camera Calibration](#8-intrinsic-camera-calibration)
9. [Extrinsic Calibration](#9-extrinsic-calibration)
10. [Temporal Synchronization](#10-temporal-synchronization)
11. [Online Calibration Refinement](#11-online-calibration-refinement)
12. [Kalman Filtering for Object Tracking](#12-kalman-filtering-for-object-tracking)
13. [Interacting Multiple Model (IMM)](#13-interacting-multiple-model-imm)
14. [Data Association](#14-data-association)
15. [Track Lifecycle Management](#15-track-lifecycle-management)
16. [LiDAR-to-Map Localization](#16-lidar-to-map-localization)
17. [Visual Odometry](#17-visual-odometry)
18. [IMU Integration](#18-imu-integration)
19. [GNSS Processing](#19-gnss-processing)
20. [Geometric Safety Checks](#20-geometric-safety-checks)
21. [Rule-Based Fallbacks and Safety Monitors](#21-rule-based-fallbacks-and-safety-monitors)
22. [Occupancy Grid Classical Methods](#22-occupancy-grid-classical-methods)
23. [ML Proposals + Geometric Verification](#23-ml-proposals--geometric-verification)
24. [Learned Features + Classical Tracking](#24-learned-features--classical-tracking)
25. [Neural + Classical Fusion](#25-neural--classical-fusion)
26. [Classical Preprocessing for ML](#26-classical-preprocessing-for-ml)
27. [Key Patents (Non-ML Focus)](#27-key-patents-non-ml-focus)
28. [Key Papers and References](#28-key-papers-and-references)

---

## 1. LiDAR Signal Processing

### 1.1 Sensor Hardware Overview

Waymo designs and manufactures all LiDAR sensors in-house across three distinct sensor categories, spanning six generations of hardware. The 6th-generation system incorporates custom silicon chips that push signal processing complexity into dedicated ASICs rather than relying on discrete hardware solutions.

| Sensor Category | 5th Gen | 6th Gen | Role |
|---|---|---|---|
| **Long-range (roof)** | 1 unit, 64-beam, 360-degree rotation | 1 unit, improved illumination and data processing | Bird's-eye 360-degree coverage, >300 m range |
| **Perimeter (short-range)** | 4 units (Laser Bear Honeycomb) | 3 units | Near-object detection, VRU safety |
| **High-resolution forward** | N/A | 1 unit with zooming capability | Long-range dense point clouds on highways |

**Key patent**: US20160291134A1 ("Long Range Steerable LIDAR System") describes a fiber laser at 1550 nm with a dual-axis beam steering mechanism: a spring-actuated reciprocating mirror scanning vertically at approximately 140 Hz resonant frequency, and a stepper-motor-driven rotational mount providing 360-degree horizontal rotation. Angular resolution specified as 0.1 degrees horizontal by 0.03 degrees vertical, with effective range of 300+ meters.

### 1.2 Photon Detection

Waymo's LiDAR sensors use two primary detector technologies depending on the sensor generation and application:

**Avalanche Photodiodes (APDs)**: The most common detector in automotive LiDAR. APDs amplify the photocurrent through impact ionization (avalanche multiplication). The gain M is:

```
M = 1 / (1 - (V_bias / V_breakdown)^n)
```

where V_bias is the applied reverse bias, V_breakdown is the breakdown voltage, and n is a material-dependent constant (typically 3-6 for InGaAs).

**Single-Photon Avalanche Diodes (SPADs)**: Operate in Geiger mode, biased above breakdown voltage, producing a near-binary response to single photon arrivals. Waymo patent US8836922B1 describes using a flexible substrate to achieve curved SPAD arrays in the receiver block, enabling conformal detector geometries matched to the optical system. SPADs achieve timing resolution of picoseconds, directly enabling centimeter-level range accuracy.

For coherent LiDAR variants, Waymo's technology uses homodyne or heterodyne mixing of local oscillator and reflected signals at the SPAD array to produce beat-frequency signals, enabling simultaneous range and Doppler velocity measurement.

### 1.3 Time-of-Flight Calculation

The fundamental range measurement is time-of-flight (ToF):

```
R = (c * delta_t) / 2
```

where R is range, c is the speed of light (2.998 x 10^8 m/s), and delta_t is the round-trip time. For Waymo's specified centimeter-level accuracy, timing precision must be on the order of 67 picoseconds per centimeter of range.

The timing electronics use Time-to-Digital Converters (TDCs) integrated into the detector pixels (for SPAD-based systems) or high-speed ADCs followed by digital pulse detection (for APD-based systems). The 6th-generation system's custom silicon pushes these timing circuits into purpose-built ASICs for lower latency and higher precision.

### 1.4 Range Gating

Range gating is used to suppress near-field saturation and solar background noise:

- **Temporal gating**: The detector is enabled only during a specific time window corresponding to the expected range of interest. This rejects photons arriving outside the window (early returns from the vehicle body, late returns from background).
- **Electronic gating**: SPAD-based detectors use electronic quenching to disable the detector for a defined dead time after each avalanche, preventing false triggers from afterpulsing.
- **Optical gating**: Narrowband interference filters (centered on the laser wavelength, typically 905 nm or 1550 nm) reject ambient light across the solar spectrum.

The Laser Bear Honeycomb achieves a minimum range of zero -- objects immediately in front of the sensor are detectable -- indicating sophisticated near-field handling that avoids detector saturation at close range.

### 1.5 Multi-Return Processing

Waymo's LiDAR sensors capture multiple returns per laser pulse:

- The **Laser Bear Honeycomb** detects up to **4 returns** per pulse, enabling perception through partial occluders (e.g., seeing tree branches behind foliage).
- The **Waymo Open Dataset** provides **2 range images** per LiDAR per frame: one for the **first return** (nearest reflector) and one for the **strongest return** (highest signal amplitude).
- Each range image pixel contains 4 channels:
  - **Channel 0: Range** -- distance from sensor origin in meters
  - **Channel 1: Intensity** -- return signal strength, partially based on target reflectivity
  - **Channel 2: Elongation** -- temporal spreading of the return pulse beyond its nominal width
  - **Channel 3: is_in_NLZ** -- No-Label Zone flag (1 = in zone, -1 = not in zone)

Multi-return processing involves:
1. Pulse detection via matched filtering or leading-edge thresholding on the digitized return waveform.
2. Return separation: resolving multiple returns within a single pulse requires sufficient temporal separation (typically >1-2 ns, corresponding to ~15-30 cm range separation).
3. Return classification: first vs. strongest returns provide complementary information. The first return captures the nearest surface; the strongest return captures the most reflective surface.

### 1.6 Intensity Calibration

Raw return intensity depends on multiple factors beyond target reflectivity:

```
I_measured = (rho * P_t * A_r * eta) / (R^2 * cos(alpha))
```

where rho is target reflectivity, P_t is transmitted power, A_r is receiver aperture area, eta is system optical efficiency, R is range, and alpha is incidence angle.

Intensity normalization compensates for:
- **Range-dependent falloff**: Intensity drops as 1/R^2; compensated by applying R^2 scaling factor.
- **Atmospheric attenuation**: Exponential decay with range; calibrated against known targets at various distances.
- **Incidence angle**: Objects viewed at oblique angles return less energy; corrected using surface normal estimation.
- **Detector nonlinearity**: APD gain varies with temperature and bias; compensated via lookup tables calibrated at the factory and updated thermally.

### 1.7 Noise Floor Estimation

The noise floor determines the minimum detectable signal:

- **Shot noise**: Poisson-distributed, proportional to sqrt(signal + background) photon count.
- **Dark current noise**: Temperature-dependent; APDs exhibit higher dark current at elevated temperatures.
- **Relative Intensity Noise (RIN)**: For coherent systems, the laser RIN must be low enough that shot noise dominates over local oscillator intensity noise.
- **Ambient light noise**: Solar background at the detector wavelength; mitigated by narrowband optical filtering.
- **Electronic noise**: Thermal (Johnson) noise and amplifier noise in the transimpedance amplifier chain.

Waymo uses adaptive thresholding where the detection threshold is set as a multiple of the estimated noise floor, analogous to CFAR in radar.

### 1.8 Crosstalk Rejection

Crosstalk occurs when a laser pulse from one beam is detected by an adjacent beam's detector:

- **Spatial crosstalk**: At near-field ranges, the received spot size exceeds the detector element pitch, causing energy to spill onto neighboring detectors. This is exacerbated by high-reflectivity targets at short range.
- **Temporal crosstalk**: Multi-beam systems firing in rapid succession can cause secondary returns from one beam to overlap with primary returns from the next beam.

Mitigation strategies include:
- Interleaved firing patterns where non-adjacent beams fire simultaneously.
- Per-beam range gating to reject returns outside the expected range window.
- Correlation-based filtering to identify crosstalk signatures (simultaneous triggers on adjacent detectors with consistent timing offsets).
- In the 6th-gen system, custom silicon implements parallel per-channel processing with crosstalk rejection logic.

### 1.9 Near-Field Saturation Handling

At very short range (<1 m), the return signal can saturate the detector:

- **Optical attenuation**: Variable optical elements (e.g., Pockels cells) reduce received power at short range. Patent analysis suggests Waymo uses quadratic control of a Pockels cell to achieve nonlinear power reduction matched to the 1/R^2 signal increase at close range.
- **Electronic saturation management**: Fast-recovery APD bias circuits restore sensitivity rapidly after saturation events.
- **Zero-minimum-range design**: The Honeycomb's zero minimum range indicates dedicated near-field optical path design, possibly including separate short-range receiver optics with reduced gain.

### 1.10 Elongation as a Signal Quality Metric

Elongation (pulse temporal spreading) is a non-ML signal quality feature unique to Waymo's dataset:

- **High elongation + low intensity**: Strong indicator of a spurious return (dust, fog, rain droplet, multi-surface reflection). Low intensity alone is not sufficient for this classification.
- **Low elongation + high intensity**: Clean return from a solid surface.
- **Moderate elongation**: May indicate partial occlusion (beam partially hitting an edge), semi-transparent surfaces (glass, mesh), or a target at the range ambiguity boundary.

This elongation-intensity joint classification represents a classical signal processing heuristic used as a preprocessing filter before ML-based perception.

---

## 2. Radar Signal Processing

### 2.1 Waymo Imaging Radar Hardware

Waymo developed one of the world's first automotive imaging radar systems, designed and built in-house:

| Specification | 5th Gen | 6th Gen |
|---|---|---|
| **Count** | 6 units (some sources: 2 radars completing 360-degree coverage) | 6 units |
| **Range** | >500 m | >500 m |
| **Coverage** | 360-degree surround | 360-degree surround |
| **Velocity** | Instantaneous Doppler | Instantaneous Doppler |
| **Antenna type** | MIMO | MIMO |
| **Weather robustness** | Rain, fog, snow | Enhanced rain/snow algorithms |

**Key patent**: D881,854 -- "Integrated MIMO and SAR Radar Antenna" design patent assigned to Waymo LLC, covering the physical antenna configuration.

**Key patent**: US11,733,369 -- "Techniques for 3D object detection and localization using radar units and neural networks for processing sensor data."

### 2.2 FMCW Chirp Processing

Waymo's imaging radar uses Frequency-Modulated Continuous Wave (FMCW) signaling at millimeter-wave frequencies (likely 76-81 GHz automotive band):

**Transmitted signal**:
```
s_tx(t) = A * cos(2*pi*(f_c*t + (B/(2*T_chirp))*t^2))
```

where f_c is the carrier frequency, B is the chirp bandwidth, and T_chirp is the chirp duration.

**Received signal** from a target at range R with radial velocity v:
```
s_rx(t) = A_r * cos(2*pi*(f_c*(t - tau) + (B/(2*T_chirp))*(t - tau)^2))
```

where tau = 2R/c is the round-trip delay.

**Beat signal** after dechirp mixing:
```
f_beat = (B / T_chirp) * (2R/c) + 2*v*f_c/c
f_beat = f_range + f_doppler
```

The beat signal contains both range and Doppler information, which are separated through the 2D FFT process.

### 2.3 Range-Doppler Map Generation

The 2D FFT processing pipeline:

**Step 1 -- Range FFT**: Apply window function (Hamming, Hanning, or Blackman-Harris) and FFT across fast-time samples within each chirp. Each bin corresponds to a range gate:
```
delta_R = c / (2 * B)
R_max = (c * f_s) / (4 * B)
```
where f_s is the ADC sampling rate.

**Step 2 -- Doppler FFT**: Apply window function and FFT across slow-time samples (across chirps within a frame). Each bin corresponds to a velocity gate:
```
delta_v = lambda / (2 * N_chirps * T_chirp)
v_max = lambda / (4 * T_chirp)
```
where lambda = c/f_c is the wavelength and N_chirps is the number of chirps per frame.

The resulting Range-Doppler map is a 2D matrix where rows represent range bins, columns represent Doppler bins, and cell values represent signal magnitude. Waymo's imaging radar produces dense range-Doppler maps enabling continuous tracking of distance, velocity, and size of objects.

### 2.4 CFAR Detection

Constant False Alarm Rate (CFAR) detection maintains a fixed false alarm probability across the range-Doppler map:

**Cell-Averaging CFAR (CA-CFAR)**: For each cell under test (CUT):
1. Average the power in a set of training cells surrounding the CUT (excluding guard cells).
2. Multiply by a threshold factor alpha to set the detection threshold.
3. Declare a detection if the CUT power exceeds the threshold.

```
Threshold = alpha * (1/N) * sum(training cell powers)
alpha = N * (P_fa^(-1/N) - 1)
```

where P_fa is the desired false alarm probability and N is the number of training cells.

**OS-CFAR (Ordered Statistics CFAR)**: Used in heterogeneous clutter environments; selects the k-th ordered training cell value as the noise estimate, providing robustness against interfering targets in the training cells.

Waymo's 5th-gen radar specification mentions "enhanced signal processing capabilities" for detecting stationary, barely moving, and fully moving objects -- this implies multi-mode CFAR with different parameters for each motion regime.

### 2.5 Digital Beamforming and Angle-of-Arrival Estimation

Waymo's MIMO radar uses multiple transmit (Tx) and receive (Rx) antennas to form a virtual aperture:

**Virtual array formation**: With N_tx transmitters and N_rx receivers, the virtual array has N_tx * N_rx elements, achieving angular resolution equivalent to a much larger physical array:
```
delta_theta = lambda / (N_virtual * d)
```
where d is the element spacing (typically lambda/2) and N_virtual = N_tx * N_rx.

**Digital beamforming**: After range-Doppler processing, a third FFT (angle FFT) is applied across virtual array elements for each range-Doppler cell to estimate angle of arrival:
```
theta = arcsin(lambda * phase_gradient / (2 * pi * d))
```

**Super-resolution techniques**: For angular resolution beyond the Rayleigh limit:
- **MUSIC (Multiple Signal Classification)**: Eigendecomposition of the spatial covariance matrix to separate signal and noise subspaces; resolution limited by SNR rather than aperture.
- **ESPRIT**: Similar eigendecomposition approach exploiting shift-invariance structure in the array.
- **Capon beamforming**: Minimum variance distortionless response; adaptive beamforming that minimizes clutter while maintaining gain toward the target.

Waymo's imaging radar patent portfolio includes SAR (Synthetic Aperture Radar) processing where sequential radar measurements from different vehicle positions are coherently combined to synthesize a larger effective aperture, improving cross-range resolution.

### 2.6 Clutter Removal

Ground clutter, guardrails, and multi-path reflections dominate automotive radar returns:

- **Ground clutter**: Strong returns from the road surface at short range; suppressed via elevation beamforming null placement and Doppler-based filtering (ground clutter has zero Doppler when the radar is stationary; at vehicle speed, ground clutter appears at predictable Doppler based on geometry).
- **Static clutter mapping**: A persistent clutter map of known static returns (buildings, guardrails) is maintained and subtracted from current measurements.
- **MTI (Moving Target Indication)**: High-pass filtering in the Doppler domain removes zero-Doppler clutter, isolating moving targets.

### 2.7 Multi-Path Ghost Rejection

Multi-path propagation creates ghost targets at incorrect positions:

- **Geometric analysis**: Ghosts from single-bounce reflections (e.g., off guardrails) appear at predictable positions relative to real targets and the reflecting surface. Geometric consistency checks flag detections at impossible or implausible locations.
- **Cross-sensor validation**: Ghost targets that appear in radar but have no corresponding LiDAR or camera detection are flagged as potential multi-path artifacts.
- **Temporal persistence**: Real targets exhibit consistent motion trajectories; ghosts often appear intermittently or with inconsistent kinematics.
- **Deep learning ghost detection**: Research on the Waymo platform has explored detecting ghost moving detections using multi-modal transformers, combining classical geometric priors with learned features.

### 2.8 Micro-Doppler Analysis

Micro-Doppler signatures arise from non-rigid body motion superimposed on the bulk target velocity:

- **Pedestrians**: Walking gait creates characteristic micro-Doppler modulation patterns from swinging arms and legs.
- **Cyclists**: Pedaling motion and wheel rotation produce periodic micro-Doppler signatures.
- **Rotating objects**: Construction equipment, fans, and similar rotating machinery create distinctive modulation.

Micro-Doppler features are extracted via:
1. Short-Time Fourier Transform (STFT) of the Doppler time series, producing a spectrogram.
2. Cadence frequency analysis: The periodicity of micro-Doppler modulation (e.g., ~2 Hz for walking) enables classification.
3. These features can feed either classical classifiers (SVM, random forest) or neural networks for object classification.

---

## 3. Camera ISP Pipeline

### 3.1 Hardware Overview

| Specification | 5th Gen | 6th Gen |
|---|---|---|
| **Camera count** | 29 cameras | 13 cameras |
| **Resolution** | Up to 1920x1280 (dataset) | 17-megapixel imager |
| **Dynamic range** | High HDR | Generation-ahead HDR |
| **Thermal stability** | Automotive rated | -40C to +85C rated |
| **Coverage** | 360-degree overlapping | 360-degree overlapping |
| **Max detection range** | >500 m (stop signs) | >500 m |

The 5th-generation cameras include long-range, 360-degree vision, perimeter, and peripheral camera subsystems with custom lenses and precise optomechanical engineering. The 6th-gen cameras include miniature wipers on the front sensor pod for debris clearing.

### 3.2 Debayering / Demosaicing

Raw camera sensors use a Bayer color filter array (RGGB pattern). Debayering reconstructs full RGB values at each pixel:

- **Bilinear interpolation**: Simplest method; averages neighboring pixels of the missing color channel. Prone to color artifacts at edges.
- **Edge-directed interpolation**: Detects edge orientation and interpolates along edges rather than across them, reducing zipper artifacts. Algorithms include Hamilton-Adams, Malvar-He-Cutler.
- **Adaptive homogeneity-directed (AHD)**: Combines gradient-based edge detection with homogeneity metrics for artifact-free reconstruction.

For Waymo's 17-megapixel sensors, hardware-accelerated debayering in the ISP ASIC is essential for real-time operation at 10 Hz frame rate.

### 3.3 White Balance

Adjusts RGB channel gains to compensate for scene illuminant color temperature:

- **Gray world assumption**: The average scene color should be neutral gray; channel gains are adjusted to equalize mean R, G, B values.
- **Illuminant estimation**: More sophisticated methods estimate the scene illuminant from highlight regions, known-color targets, or by matching to a database of illuminant spectra.
- **Per-frame adaptation**: White balance adjusts dynamically as the vehicle transitions between lighting environments (tunnels, shade, direct sunlight).

### 3.4 HDR Tone Mapping

Waymo cameras capture high-dynamic-range scenes (e.g., bright sky and shadowed road surfaces simultaneously):

**Multi-exposure fusion**: Multiple exposures (short, medium, long) captured within a single frame period and fused:
```
HDR(x,y) = sum_i(w(E_i(x,y)) * E_i(x,y) / t_i) / sum_i(w(E_i(x,y)))
```
where E_i is the exposure at pixel (x,y) for exposure time t_i, and w() is a weighting function that favors well-exposed pixels.

**Local tone mapping** compresses the HDR luminance range to the displayable/processable range while preserving local contrast:
- Bilateral filtering separates base layer (low frequency) from detail layer; the base is compressed while detail is preserved.
- Reinhard's operator: `L_display = L / (1 + L)` applied to a local luminance estimate.

The 6th-gen cameras are described as "a generation ahead" of automotive cameras in HDR capability, suggesting on-sensor multi-exposure capture with in-pixel signal accumulation.

### 3.5 Gamma Correction

Converts linear sensor response to a perceptually uniform encoding:
```
V_out = A * V_in^gamma
```

Standard gamma values:
- sRGB: gamma approximately 2.2 (with linear segment near zero)
- For ML input: linear encoding may be preferred; gamma is applied or removed depending on the downstream network's training convention.

### 3.6 Lens Distortion Correction

Waymo uses the **Brown-Conrady distortion model** (same as OpenCV convention), as documented in the Waymo Open Dataset protocol buffer:

**Radial distortion**:
```
x_distorted = x * (1 + k1*r^2 + k2*r^4 + k3*r^6)
y_distorted = y * (1 + k1*r^2 + k2*r^4 + k3*r^6)
```

**Tangential distortion** (decentering):
```
x_distorted += 2*p1*x*y + p2*(r^2 + 2*x^2)
y_distorted += p1*(r^2 + 2*y^2) + 2*p2*x*y
```

where r^2 = x^2 + y^2, (x,y) are normalized image coordinates, and (k1, k2, k3, p1, p2) are the distortion coefficients.

The Waymo Open Dataset stores these as a 9-element intrinsic vector: `[f_u, f_v, c_u, c_v, k1, k2, p1, p2, k3]` following OpenCV ordering. Images in the dataset are provided **undistorted** (distortion has been removed using the calibrated coefficients).

### 3.7 Vignetting Compensation

Vignetting causes brightness falloff from image center to edges:

- **Cos^4 falloff**: Natural vignetting from lens geometry follows a cos^4(theta) law where theta is the off-axis angle.
- **Mechanical vignetting**: Lens barrel or filter ring blocks peripheral rays.
- **Calibration**: A flat-field calibration image (uniform white target) captures the vignetting profile; the inverse profile is applied as a per-pixel gain map.

### 3.8 Chromatic Aberration Correction

Chromatic aberration causes wavelength-dependent focus shifts:

- **Lateral chromatic aberration**: Different wavelengths focus at different radial positions; corrected by applying wavelength-specific radial distortion correction (separate k1, k2, k3 for R, G, B channels).
- **Longitudinal chromatic aberration**: Different wavelengths focus at different depths; typically addressed in lens design rather than ISP processing.

### 3.9 Motion Blur Handling

At vehicle speeds of 30-70 mph, motion blur can significantly degrade image quality:

- **Short exposure times**: Auto-exposure algorithms favor shorter exposures to limit blur, trading off noise.
- **Deblurring filters**: Wiener deconvolution or blind deblurring can partially recover sharpness.
- **HDR multi-exposure**: Short-exposure frames inherently have less motion blur; they provide sharp detail while long-exposure frames provide well-exposed shadows.

### 3.10 Rolling Shutter Correction

Most automotive CMOS sensors use rolling shutter readout, causing geometric distortion for moving objects or during ego-motion:

The Waymo Open Dataset explicitly defines rolling shutter parameters:

- **RollingShutterReadOutDirection** enum: `TOP_TO_BOTTOM`, `LEFT_TO_RIGHT`, `BOTTOM_TO_TOP`, `RIGHT_TO_LEFT`, `GLOBAL_SHUTTER`
- **Camera trigger time** (scalar): When the camera shutter was triggered
- **Camera readout done time** (scalar): When image readout completed
- **Velocity vector** (6 elements): Camera velocity during readout for rolling shutter adjustment

Correction involves:
1. For each pixel row (or column), compute the acquisition timestamp based on readout direction and timing.
2. Using the camera velocity vector, compute the camera pose at each row's acquisition time.
3. Reproject each row to a common reference time (typically the exposure center).
4. This requires known camera intrinsics, extrinsics, and ego-motion (from IMU/localization).

The dataset provides **undistorted images** specifically because pre-distorted images cannot be used to resolve the rolling shutter problem -- the correction must be applied in the correct order relative to undistortion.

### 3.11 Auto-Exposure

Auto-exposure adjusts sensor integration time and gain to maintain optimal signal levels:

- **Metering regions**: Weighted toward the road ahead and areas of interest (e.g., where traffic lights are expected).
- **Anti-flicker**: Synchronization with artificial lighting frequencies (50/60 Hz) to avoid banding.
- **Rapid transitions**: Tunnel entry/exit requires fast exposure adaptation (sub-100ms) to avoid temporary blindness.
- **Per-camera independent control**: Each of the 13-29 cameras can have independent exposure settings optimized for its field of view and lighting conditions.

---

## 4. Stereo / Multi-View Geometry

### 4.1 Epipolar Geometry

With up to 29 cameras (5th gen) providing overlapping fields of view, Waymo has rich multi-view geometry:

**Fundamental matrix F**: Encodes the epipolar constraint between two camera views:
```
x'^T * F * x = 0
```
where x and x' are corresponding points in the two images (in homogeneous coordinates).

**Essential matrix E**: For calibrated cameras:
```
E = K'^T * F * K
E = [t]_x * R
```
where K, K' are camera intrinsic matrices, R is the relative rotation, and [t]_x is the skew-symmetric matrix of the translation vector.

### 4.2 Triangulation

Given corresponding points in two or more calibrated cameras, 3D position is recovered via triangulation:

**Linear triangulation** (DLT): Construct the system `A * X = 0` from projection equations of each camera, solve via SVD.

**Optimal triangulation**: Minimizes reprojection error in both images simultaneously, accounting for measurement noise.

In Waymo's system, multi-view triangulation is most relevant for:
- **R4D (Reference-Based Distance Estimation)**: Uses graph-based attention over reference objects at known distances to estimate depth of target objects.
- **Cross-camera object matching**: Objects visible in overlapping camera fields of view can be triangulated for depth estimation.
- **Traffic signal 3D localization**: Patent US20110182475A1 describes automatically triangulating 3D positions of traffic lights from two or more images.

### 4.3 Structure from Motion (SfM)

SfM recovers 3D structure and camera motion from image sequences:

1. **Feature detection and matching** across frames (SIFT, ORB, or learned features).
2. **Relative pose estimation** from matched features using the five-point algorithm or eight-point algorithm.
3. **Triangulation** of matched points.
4. **Bundle adjustment**: Joint nonlinear optimization of all camera poses and 3D point positions minimizing total reprojection error.

Waymo uses SfM-related techniques primarily for:
- **HD map construction**: Offline reconstruction of 3D map geometry from fleet driving data (Block-NeRF uses 2.8 million images for city-scale reconstruction).
- **Camera-based depth estimation**: The R4D approach and monocular depth networks are informed by geometric principles.

### 4.4 Multi-View Stereo for Depth

When direct LiDAR depth is unavailable or sparse at long range, multi-view stereo provides complementary depth:

- **Depth from camera motion**: Sequential images from a single moving camera create a stereo baseline; depth inversely proportional to disparity.
- **Cross-camera stereo**: Overlapping camera pairs (e.g., front-left and front-right) provide a static stereo baseline.
- **Lift-Splat-Shoot (LSS)**: Predicts per-pixel depth distributions and scatters camera features into 3D voxels weighted by depth probability -- a hybrid of learned depth and geometric projection.

---

## 5. Point Cloud Classical Processing

### 5.1 Ground Plane Estimation

Ground plane removal is a critical classical preprocessing step before both ML-based and classical object detection:

**RANSAC-based ground estimation**:
1. Randomly sample 3 points from the point cloud.
2. Fit a plane: `ax + by + cz + d = 0`.
3. Count inliers (points within distance threshold epsilon of the plane).
4. Repeat for N iterations; select the plane with maximum inliers.
5. Segment ground points (inliers) from above-ground points (outliers).

```
Number of iterations N = log(1 - p) / log(1 - w^n)
```
where p is desired success probability, w is inlier ratio, n = 3 (minimum sample size for a plane).

**Morphological ground estimation**:
1. Divide the point cloud into a 2D grid.
2. In each grid cell, select the lowest point as a candidate ground point.
3. Fit a smooth surface through candidate points using interpolation or morphological opening.
4. Points below the surface plus a tolerance are classified as ground.

Waymo's **LESS** paper explicitly describes using ground removal as the first step in a heuristic pre-segmentation pipeline for label-efficient segmentation.

### 5.2 Euclidean Clustering

After ground removal, above-ground points are clustered into individual objects:

**Algorithm**:
1. Build a kd-tree spatial index on the non-ground points.
2. For each unvisited point, find all neighbors within distance threshold d.
3. If the neighborhood exceeds a minimum point count, start a new cluster.
4. Recursively add connected neighbors to the cluster.
5. Terminate when all points are either clustered or marked as noise.

This is essentially a connected-component analysis on the point cloud with a distance-based adjacency criterion.

### 5.3 DBSCAN

DBSCAN (Density-Based Spatial Clustering of Applications with Noise) is a more sophisticated density-based clustering method:

**Parameters**: epsilon (neighborhood radius), MinPts (minimum points to form a dense region).

**Algorithm**:
1. For each point p, compute the epsilon-neighborhood N_eps(p) = {q : dist(p,q) <= epsilon}.
2. If |N_eps(p)| >= MinPts, p is a **core point**.
3. A point q is **directly density-reachable** from p if p is a core point and q is in N_eps(p).
4. Clusters are formed by transitively connecting density-reachable points.
5. Non-reachable points are classified as **noise**.

**Advantages for LiDAR point clouds**:
- No need to pre-specify the number of clusters.
- Handles arbitrary cluster shapes (important for vehicles, pedestrians, complex structures).
- Naturally identifies noise points (isolated returns from dust, rain, sensor artifacts).

### 5.4 Voxel Downsampling

Reduces point cloud density while preserving spatial structure:

1. Overlay a regular 3D voxel grid (typical voxel size: 0.1m x 0.1m x 0.15m for Waymo detectors).
2. For each occupied voxel, replace all contained points with their centroid.
3. Output one point per voxel.

This reduces computational load for downstream processing while maintaining uniform spatial sampling. Waymo uses voxelization extensively as the input representation for SWFormer (0.1m x 0.1m x 0.15m voxels), CenterPoint, and PVTransformer architectures.

### 5.5 Statistical Outlier Removal

Removes isolated noise points based on local density:

1. For each point, compute the mean distance to its k nearest neighbors.
2. Compute the global mean and standard deviation of these distances.
3. Remove points whose mean k-NN distance exceeds (global_mean + alpha * global_std).

Typical parameters: k = 20-50, alpha = 1.0-2.0.

### 5.6 Normal Estimation

Surface normals are estimated at each point by analyzing local neighborhoods:

1. For each point p, select its k nearest neighbors (typically k = 20-30).
2. Compute the 3x3 covariance matrix of the neighborhood.
3. The eigenvector corresponding to the smallest eigenvalue is the estimated normal direction.
4. Orient normals consistently (e.g., pointing toward the sensor).

Normal estimates are used for:
- Ground plane refinement.
- Surface reconstruction.
- Point-to-plane ICP registration.
- Distinguishing planar surfaces (walls, roads) from curved surfaces (vehicles, poles).

### 5.7 ICP Variants

Iterative Closest Point (ICP) aligns two point clouds:

**Point-to-Point ICP**:
```
minimize sum ||R*p_i + t - q_i||^2
```
over rotation R and translation t, where (p_i, q_i) are corresponding point pairs.

**Point-to-Plane ICP** (more commonly used in Waymo's domain):
```
minimize sum ((R*p_i + t - q_i) . n_i)^2
```
where n_i is the surface normal at q_i. Converges faster than point-to-point for planar scenes.

**Generalized ICP (GICP)**: Treats both source and target as locally planar, using surface covariance information.

ICP is used for:
- Multi-LiDAR registration (aligning perimeter LiDARs to the roof LiDAR).
- LiDAR-to-map localization (see Section 16).
- Multi-sweep point cloud alignment.

---

## 6. Optical Flow and Scene Flow

### 6.1 Classical Optical Flow

**Lucas-Kanade** (sparse, local method):
- Assumes brightness constancy: `I(x,y,t) = I(x+dx, y+dy, t+dt)`.
- Taylor expansion yields the optical flow equation: `I_x*u + I_y*v + I_t = 0`.
- Solves for flow (u,v) in a local window using least squares (overconstrained system).
- Multi-scale (pyramidal) implementation handles large displacements.

**Horn-Schunck** (dense, global method):
- Adds a smoothness constraint: minimizes `integral(I_x*u + I_y*v + I_t)^2 + lambda*(|grad(u)|^2 + |grad(v)|^2)`.
- Produces dense flow fields but smooths over discontinuities.

### 6.2 Scene Flow Estimation

Waymo introduced the **Scalable Scene Flow from Point Clouds in the Real World** dataset (2021), approximately 1,000x larger than previous real-world scene flow datasets.

Scene flow is the 3D analog of optical flow: a per-point 3D motion vector:
```
f_i = (vx_i, vy_i, vz_i)
```
describing how each LiDAR point moves between consecutive frames.

**Derivation from tracked objects**:
1. Points within tracked 3D bounding boxes inherit the box's rigid-body motion (translation + rotation).
2. Static points (ground, buildings) have zero scene flow after ego-motion compensation.
3. The dataset provides these as ground-truth scene flow labels.

**Classical scene flow estimation** (before neural methods):
1. Ego-motion compensation removes the ego-vehicle's contribution to apparent motion.
2. Point-to-point correspondence between consecutive scans is established via nearest-neighbor or feature matching.
3. Rigid-body flow is estimated per cluster via least-squares fitting.

### 6.3 Ego-Motion Compensation

Critical classical preprocessing applied to all temporal LiDAR data:

1. **Intra-scan compensation**: During a 100ms LiDAR rotation, the vehicle moves. Each point's timestamp determines the ego pose at acquisition time (from IMU + localization). The point is transformed to a common reference pose (scan midpoint or endpoint):
```
p_compensated = T_ref * T_point_time^(-1) * p_raw
```
where T_point_time is the ego pose at the point's acquisition timestamp and T_ref is the reference pose.

2. **Inter-scan compensation**: Historical point clouds are transformed into the current frame's coordinate system:
```
p_current_frame = T_current * T_historical^(-1) * p_historical
```

After ego-motion compensation and ground point removal, the average Waymo point cloud contains approximately 79,327 points.

---

## 7. Edge / Feature Detection

### 7.1 Classical Feature Detectors

While Waymo's production perception is primarily neural-network-based, classical features serve auxiliary roles:

**Canny edge detection** is used in:
- **LiDAR-camera calibration**: Depth discontinuities in projected LiDAR data are correlated with image edges (Canny output) for extrinsic calibration verification (Patent US20170124781A1: "maximizing a correlation between depth discontinuities in 3D laser data and edges of image data").
- **ISP quality checks**: Edge sharpness metrics assess camera focus quality.

**Hough transform** applications:
- **Lane line detection**: Detects straight-line segments in road imagery as (rho, theta) parameter space peaks.
- **Traffic sign geometry**: Rectangular and circular sign shapes detected via generalized Hough transform.

### 7.2 Feature Detectors for Calibration and Localization

**ORB (Oriented FAST and Rotated BRIEF)**: Computationally efficient feature detector and descriptor used in real-time applications:
- FAST corner detection for keypoint identification.
- BRIEF binary descriptor for fast matching.
- Orientation compensation via intensity centroid.

**SIFT-like features**: Higher-quality but more expensive; used in offline HD map construction and calibration target detection.

These features primarily support calibration, map building, and localization rather than real-time object detection.

---

## 8. Intrinsic Camera Calibration

### 8.1 Lens Model

Waymo uses a **pinhole camera model with Brown-Conrady distortion**, as defined in the Open Dataset protocol buffer:

**Projection** (3D to 2D):
```
[u]   [f_u  0   c_u] [X/Z]
[v] = [0   f_v  c_v] [Y/Z]
[1]   [0    0    1 ] [ 1 ]
```

**Intrinsic parameter vector** (9 elements):
```
[f_u, f_v, c_u, c_v, k1, k2, p1, p2, k3]
```

| Parameter | Description |
|---|---|
| f_u, f_v | Focal lengths in pixel units (horizontal, vertical) |
| c_u, c_v | Principal point coordinates (image center offset) |
| k1, k2, k3 | Radial distortion coefficients |
| p1, p2 | Tangential (decentering) distortion coefficients |

These follow the **OpenCV distortion model convention**.

### 8.2 Factory Calibration

- Checkerboard or dot-pattern calibration targets in a controlled environment.
- Zhang's method: Multiple views of a planar calibration pattern yield closed-form initial estimates of intrinsics, refined via Levenberg-Marquardt nonlinear optimization.
- Calibration is performed per-camera and stored as part of each camera's calibration record.

### 8.3 Online Recalibration

Patent US20170124781A1 describes online calibration to detect parameter change:
- Thermal drift alters focal length and principal point as temperature changes.
- Mechanical vibration shifts lens elements.
- The calibrator monitors calibration consistency and triggers recalibration when drift exceeds thresholds.
- Methods include tracking known landmarks (e.g., lane markings, signs) and comparing observed vs. predicted image locations.

---

## 9. Extrinsic Calibration

### 9.1 LiDAR-Camera Extrinsic Calibration

Each sensor has a 4x4 extrinsic transformation matrix T mapping from sensor frame to vehicle frame:

```
T = [R | t]
    [0 | 1]
```

where R is a 3x3 rotation matrix and t is a 3x1 translation vector.

**Target-based calibration**:
- Custom calibration targets with known 3D geometry are placed in the shared field of view.
- Corresponding features are identified in both LiDAR (3D points on target edges/corners) and camera (2D image features).
- PnP (Perspective-n-Point) or direct 3D-2D optimization yields the extrinsic transformation.

**Targetless calibration** (Patent US20170124781A1):
- Maximizes correlation between LiDAR depth discontinuities and camera image edges.
- LiDAR points are projected into the camera image using the current extrinsic estimate.
- Depth discontinuities in the projected LiDAR data (sharp range changes between adjacent points) should align with intensity edges in the camera image.
- The optimization adjusts the 6-DOF extrinsic parameters (3 translation + 3 rotation) to maximize this correlation.

### 9.2 Camera-Camera Extrinsic Calibration

With 13-29 cameras, pairwise extrinsics are established via:
- Shared calibration targets visible in overlapping fields of view.
- Epipolar constraint enforcement: corresponding features in camera pairs must satisfy the fundamental matrix relationship.
- Bundle adjustment over all cameras simultaneously for global consistency.

### 9.3 Radar-Camera and LiDAR-Radar Calibration

- **Radar-camera**: Radar returns are projected into camera images; alignment is verified by checking that radar detections correspond to visible objects in the image.
- **LiDAR-radar**: Cross-modal registration using objects detected by both sensors. Range and angular correspondences are optimized.
- **Temporal alignment**: Radar, LiDAR, and camera operate at different update rates; extrinsic calibration must account for the ego-motion between non-simultaneous measurements.

### 9.4 Multi-LiDAR Registration

All 3-4 LiDAR units are registered to a common vehicle frame:
- Overlapping fields of view between perimeter and roof LiDARs provide shared geometry.
- ICP or NDT-based registration aligns point clouds from different sensors.
- Factory calibration establishes initial extrinsics; online monitoring detects drift.

---

## 10. Temporal Synchronization

### 10.1 Hardware-Level Synchronization

Waymo's sensor suite (29+ sensors in 5th gen, 23 in 6th gen) requires precise temporal alignment:

**IEEE 1588 Precision Time Protocol (PTP)**:
- A grandmaster clock (GPS-disciplined oscillator) distributes time to all sensors.
- Each sensor's onboard PTP-capable clock synchronizes to the grandmaster.
- Hardware timestamping at the MAC layer achieves sub-microsecond synchronization accuracy.
- Eliminates software jitter in timestamp assignment.

**Hardware trigger synchronization**:
- A central trigger generator issues hardware trigger pulses to all cameras and LiDARs.
- Ensures all sensors capture at precisely the same instant (or at defined offsets).
- The Waymo Open Dataset provides per-frame `timestamp_micros`, per-camera `camera_trigger_time`, and per-camera `camera_readout_done_time`.

### 10.2 Timestamp Alignment Across Sensors

- **LiDAR**: Each point carries a timestamp within the scan (the scan is not instantaneous; it spans ~100ms for a full rotation). Points are individually timestamped for motion compensation.
- **Camera**: Rolling shutter cameras assign timestamps per-row; the center-of-exposure timestamp is the canonical reference. The 6-element velocity vector enables per-row temporal interpolation.
- **Radar**: Radar frames have their own timestamps aligned to the common PTP clock.
- **IMU**: Highest rate sensor (~200-1000 Hz); interpolated to provide pose estimates at any query timestamp.

### 10.3 Latency Compensation

End-to-end latency from sensor acquisition to actuation is reportedly approximately 3ms. Latency compensation involves:
- **Measurement prediction**: The perception system predicts object positions forward in time by the processing latency to account for the delay between sensing and actuation.
- **Ego-motion prediction**: IMU-based ego-motion prediction extends the localization solution forward through the processing pipeline.

---

## 11. Online Calibration Refinement

### 11.1 Drift Detection

Calibration parameters drift due to:
- **Thermal effects**: Temperature changes alter focal length, lens geometry, and mounting bracket dimensions.
- **Mechanical vibration**: Road vibration causes slow shifts in sensor mounting angles.
- **Physical impacts**: Minor bumps or collisions can shift sensor alignment.

### 11.2 Online Monitoring Methods

**LiDAR-camera consistency monitoring**:
- Continuously project LiDAR points into camera images using current extrinsics.
- Compute alignment quality metrics (edge correlation, mutual information, projection error on known landmarks).
- Flag calibration degradation when quality drops below threshold.

**Cross-sensor detection consistency**:
- Objects detected independently by different sensors should agree on position after transformation through extrinsics.
- Systematic biases indicate extrinsic drift.

**Levinson's method** (used in the autonomous driving community, applicable to Waymo):
- Formulates a probability that the current calibration is accurate based on LiDAR depth discontinuity and image edge alignment.
- Tracks changes in extrinsic parameters over time.

### 11.3 Runtime Correction

Patent US20170124781A1 covers online calibration:
- The calibrator can calibrate sensors online to detect parameter changes.
- Intrinsic parameters (optical distortion, beam angles) and extrinsic parameters are both monitored.
- Additional parameters calibrated include vehicle inertial tensor, wheel base, wheel radius, and road surface friction.

---

## 12. Kalman Filtering for Object Tracking

### 12.1 State Vector Design

The Waymo tracking baseline (AB3DMOT paradigm) and 1st-place challenge solutions use Kalman filters with specific state vectors:

**3D tracking state vector** (10-dimensional):
```
x = [x, y, z, h, w, l, theta, x_dot, y_dot, z_dot]
```

| State Component | Description |
|---|---|
| x, y, z | 3D center position in vehicle frame |
| h, w, l | Height, width, length of bounding box |
| theta | Heading angle (yaw) |
| x_dot, y_dot, z_dot | Velocity components |

**2D tracking state vector** (8-dimensional):
```
x = [x, y, gamma, h, x_dot, y_dot, gamma_dot, h_dot]
```
where gamma is aspect ratio and h is box height in image coordinates.

### 12.2 Motion Models

**Constant velocity (CV) model**:
```
F = [I_3  dt*I_3]    (for position/velocity states)
    [0      I_3  ]
```

State prediction:
```
x_predicted = F * x_previous
P_predicted = F * P_previous * F^T + Q
```

where Q is the process noise covariance encoding expected acceleration uncertainty.

**Constant acceleration (CA) model**:
- Extends the state vector to include acceleration components.
- More appropriate for maneuvering targets (vehicles braking, accelerating, turning).

**Constant turn-rate and velocity (CTRV)** model:
```
x_new = x + v/omega * (sin(theta + omega*dt) - sin(theta))
y_new = y + v/omega * (cos(theta) - cos(theta + omega*dt))
theta_new = theta + omega * dt
```
where omega is the yaw rate. This is a nonlinear model requiring EKF or UKF.

### 12.3 Extended Kalman Filter (EKF)

For nonlinear motion models, the EKF linearizes around the current state estimate:

**Prediction**:
```
x_predicted = f(x_previous, u)
P_predicted = F_jacobian * P * F_jacobian^T + Q
```

**Update**:
```
K = P_predicted * H^T * (H * P_predicted * H^T + R)^(-1)
x_updated = x_predicted + K * (z - h(x_predicted))
P_updated = (I - K * H) * P_predicted
```

where F_jacobian = df/dx and H = dh/dx are Jacobian matrices.

### 12.4 Unscented Kalman Filter (UKF)

The UKF uses deterministic sigma points to handle nonlinearity without computing Jacobians:

1. Generate 2n+1 sigma points around the current mean (n = state dimension).
2. Propagate each sigma point through the nonlinear model.
3. Compute weighted mean and covariance from propagated sigma points.

Research on the Waymo dataset (UKF-MOT, CAAI 2024) demonstrates UKF advantages for nonlinear vehicle motion tracking, with higher accuracy than EKF for maneuvering targets.

### 12.5 Process and Measurement Noise Models

**Process noise Q**: Encodes expected deviation from the constant-velocity assumption.
- Diagonal elements: acceleration variance (typically 1-5 m/s^2 for vehicles, 0.5-2 m/s^2 for pedestrians).
- Off-diagonal: typically zero (assumes independent noise across states).

**Measurement noise R**: Encodes detection localization uncertainty.
- LiDAR detections: position uncertainty ~0.05-0.3 m depending on range and object size.
- Camera detections: higher position uncertainty, especially in depth (~1-5 m longitudinal error).
- Radar detections: excellent velocity accuracy (< 0.1 m/s), moderate angular uncertainty.

---

## 13. Interacting Multiple Model (IMM)

### 13.1 Concept and Application

The IMM filter runs a bank of Kalman filters in parallel, each using a different motion model, and combines their outputs based on model probabilities:

**Typical model set for vehicle tracking**:
1. **Constant Velocity (CV)**: Straight-line, constant-speed motion.
2. **Constant Acceleration (CA)**: Braking or accelerating.
3. **Constant Turn (CT)**: Turning at constant rate with constant speed.

### 13.2 Algorithm Steps

**Interaction (mixing)**:
```
x_0j = sum_i(mu_ij * x_i)     (mixed initial state for model j)
P_0j = sum_i(mu_ij * (P_i + (x_i - x_0j)*(x_i - x_0j)^T))
```
where mu_ij are mixing probabilities computed from the model transition probability matrix and current model probabilities.

**Filtering**: Each model-matched filter runs its prediction and update step independently.

**Model probability update**:
```
mu_j = c_j * Lambda_j * c_bar_j / sum_k(c_k * Lambda_k * c_bar_k)
```
where Lambda_j is the likelihood of the measurement given model j.

**Combination**: The overall state estimate is the probability-weighted combination of individual filter outputs.

### 13.3 Model Transition Matrix

```
Pi = [p_11  p_12  p_13]
     [p_21  p_22  p_23]
     [p_31  p_32  p_33]
```

Typical values: high self-transition probability (0.95-0.98 on diagonal), low switching probability (0.01-0.025 off-diagonal), reflecting the fact that vehicles typically maintain their current motion mode.

While Waymo has not published specific papers on IMM usage, the technique is standard in autonomous vehicle tracking and the AB3DMOT/CasTrack-style trackers used on the Waymo dataset commonly incorporate IMM-like model switching for handling maneuvering targets.

---

## 14. Data Association

### 14.1 Hungarian Algorithm

The Hungarian algorithm (Kuhn-Munkres algorithm) solves the linear assignment problem for track-to-detection matching:

**Input**: Cost matrix C where C[i,j] is the cost of assigning track i to detection j.
**Output**: Optimal one-to-one assignment minimizing total cost.

**Complexity**: O(n^3) for n assignments.

**Cost metrics used on Waymo dataset**:
- **3D IoU** (Intersection over Union of oriented 3D bounding boxes).
- **Euclidean distance with Gaussian kernel** between 3D centers (found superior to 3D IoU, BEV IoU, and Mahalanobis distance in the 2020 challenge 1st-place solution).
- **Mahalanobis distance**: `d_M = sqrt((z - H*x)^T * S^(-1) * (z - H*x))` where S is the innovation covariance; accounts for state uncertainty.

### 14.2 Global Nearest Neighbor (GNN)

The simplest association strategy:
1. Compute the distance matrix between all tracks and all detections.
2. Use Hungarian algorithm for optimal assignment.
3. Unmatched tracks enter coasting; unmatched detections spawn new tracks.

### 14.3 Joint Probabilistic Data Association (JPDA)

For dense scenarios with measurement ambiguity:
1. Enumerate all feasible assignment hypotheses.
2. Compute the probability of each hypothesis.
3. Update each track state as the weighted combination of all feasible assignments.

### 14.4 Gating Strategies

Before solving the assignment problem, gating reduces the search space:

- **Rectangular gate**: Exclude assignments where spatial distance exceeds a threshold.
- **Ellipsoidal gate (Mahalanobis)**: The Mahalanobis distance must be below chi-squared threshold (e.g., chi^2(3, 0.99) = 11.34 for 3D position).
- **Multi-stage gating**: The 2020 1st-place solution uses three association stages with progressively relaxed thresholds:
  - Stage 1: High-confidence detections matched to tracks using tight threshold t^(1).
  - Stage 2: Unmatched young tracks (age < 3 frames) matched with relaxed metrics (enlarged bounding boxes).
  - Stage 3: Remaining tracks matched against low-confidence detections using threshold t^(3).

### 14.5 Appearance-Based Association

The 1st-place Waymo 2020 tracking solution uses a Re-ID network (11 convolutional layers producing 512-dimensional embeddings) with cosine distance:
```
d_appearance = 1 - (f_track . f_detection) / (||f_track|| * ||f_detection||)
```

A gallery of historical appearance features maintains the smallest cosine distance observed, providing robustness to temporary occlusion and appearance changes.

---

## 15. Track Lifecycle Management

### 15.1 Track Creation

When a detection is not matched to any existing track during data association:

- A new track is initialized with the detection's position, size, and heading as the initial state.
- The velocity components are initialized to zero or estimated from two consecutive unmatched detections.
- The track receives a globally unique tracking ID.

**Confirmation (M-of-N logic)**: A tentative track must receive M successful associations in its first N frames to be confirmed. Typical values: M=2, N=3 or M=3, N=5. Unconfirmed tracks are not output to downstream systems.

### 15.2 Track Update

When a detection matches an existing track:
- The Kalman filter (or transformer) update step incorporates the new measurement.
- The track's age counter resets.
- Appearance features are updated.

### 15.3 Track Coasting (Occlusion Handling)

When no detection matches a track:
- The track's state is **predicted forward** using the motion model without a measurement update.
- The coasting counter a_k increments.
- Prediction uncertainty (covariance P) grows with each unmatched frame.
- The track continues to be reported to downstream modules with reduced confidence.

Waymo's SoDA tracker uses **attention-based soft data associations** with learned occlusion reasoning, maintaining track estimates for occluded objects using latent space representations rather than simple constant-velocity extrapolation.

### 15.4 Track Deletion

A track is deleted when:
- The coasting counter exceeds the maximum age threshold A_max (typically 5-30 frames, depending on object class and motion state).
- The predicted uncertainty becomes too large for meaningful state estimation.
- The track leaves the sensor field of view entirely.

### 15.5 Track Re-Identification

After occlusion, a previously coasting track may match a new detection:
- The same tracking ID is reused, maintaining temporal continuity.
- Re-ID appearance features (512-dimensional embeddings in the 2020 solution) assist in matching.
- Maximum appearance distance thresholds (0.06-0.15) control re-identification sensitivity.

---

## 16. LiDAR-to-Map Localization

### 16.1 Normal Distributions Transform (NDT)

NDT represents the reference map as a set of normal distributions, one per grid cell:

1. **Map representation**: Divide the 3D space into regular cells. For each cell, compute the mean and covariance of all contained points.
2. **Scan registration**: For a new LiDAR scan, find the transformation T that maximizes the sum of probability densities:
```
score(T) = sum_i exp(-0.5 * (T*p_i - mu_k)^T * Sigma_k^(-1) * (T*p_i - mu_k))
```
where p_i are scan points, mu_k and Sigma_k are the mean and covariance of the nearest map cell.

3. **Optimization**: Newton's method or gradient descent on the score function yields the 6-DOF pose.

NDT advantages:
- Compact map representation (means and covariances vs. raw points).
- Smooth cost function amenable to gradient-based optimization.
- Handles non-uniform point density naturally.

### 16.2 Point-to-Plane ICP Localization

Aligns the current LiDAR scan to the pre-built HD map:

```
minimize sum ((R*p_i + t - q_i) . n_i)^2
```

For localization, the map points q_i and normals n_i are precomputed; only the scan-to-map transformation (R, t) is optimized.

**Waymo's approach**: HD maps are built from fleet driving data using accumulated LiDAR scans. Runtime localization matches the current sparse scan against this dense prior map, achieving centimeter-level accuracy. The Waymo Open Dataset paper confirms GPS, IMU, and wheel odometry as localization sensor inputs, with LiDAR-to-map matching providing the primary high-accuracy position fix.

### 16.3 Particle Filter Localization

Monte Carlo localization represents the pose belief as a set of weighted particles:

1. **Prediction**: Propagate each particle according to the motion model (IMU + odometry) with added noise.
2. **Update**: Weight each particle by the likelihood of the current LiDAR scan given the particle's pose and the map.
3. **Resampling**: Duplicate high-weight particles and discard low-weight ones.

Particle filters handle multimodal distributions (useful during initialization or after GPS outages) but are computationally expensive compared to optimization-based methods.

---

## 17. Visual Odometry

### 17.1 Feature-Based Visual Odometry

Estimates ego-motion from camera image sequences:

1. **Feature detection**: ORB, FAST, or learned features extracted from consecutive frames.
2. **Feature matching**: Descriptor matching (brute-force or FLANN-based) between frames.
3. **Outlier rejection**: RANSAC on the essential matrix removes mismatches.
4. **Motion estimation**: Decompose the essential matrix E = [t]_x * R into rotation R and translation t (up to scale).
5. **Scale recovery**: Absolute scale requires either stereo baseline, known object sizes, LiDAR depth, or IMU integration.

### 17.2 Visual-Inertial Odometry (VIO)

Combines camera and IMU for drift-free odometry:

- **Tightly coupled**: Fuses visual features and IMU preintegration measurements in a single optimization.
- **Loosely coupled**: Visual odometry and IMU integration run independently; outputs are fused via EKF.

Waymo's system uses cameras in concert with LiDAR and IMU for localization, though LiDAR-to-map matching is the primary high-accuracy localization method. VIO may serve as a fallback when LiDAR or map matching is degraded.

---

## 18. IMU Integration

### 18.1 Mechanization Equations

The IMU provides 6-DOF measurements: 3-axis accelerometer and 3-axis gyroscope. Integration follows the strapdown mechanization equations:

**Attitude update** (quaternion form):
```
q_dot = 0.5 * q (x) [0, omega - b_g]^T
```
where omega is the measured angular velocity and b_g is the gyroscope bias.

**Velocity update**:
```
v_dot = R(q) * (a - b_a) - g
```
where a is the measured acceleration, b_a is the accelerometer bias, R(q) is the rotation matrix from body to navigation frame, and g is the gravity vector.

**Position update**:
```
p_dot = v
```

### 18.2 Bias Estimation

IMU biases drift slowly over time and must be estimated online:

- **Accelerometer bias b_a**: Estimated as part of the navigation filter state (EKF or factor graph). Typical automotive-grade bias instability: 10-100 micro-g.
- **Gyroscope bias b_g**: Similarly estimated. Typical bias instability: 1-10 deg/hr for automotive-grade MEMS IMUs.
- **Bias model**: Random walk or first-order Gauss-Markov process:
```
b_dot = -beta * b + w
```
where beta = 1/tau is the reciprocal correlation time and w is white noise.

### 18.3 Gravity Alignment

Accurate gravity vector estimation is critical:
- Initial gravity alignment from static accelerometer measurements: `g_body = [0, 0, -g]^T` in the navigation frame.
- The gravity magnitude varies geographically (~9.78 to 9.83 m/s^2); Waymo's system likely uses a gravity model (e.g., WGS-84 normal gravity formula).
- Gravity misalignment of 0.01 degrees causes position drift of approximately 0.015 m/s^2.

### 18.4 IMU Preintegration

Preintegration (Forster et al., 2015; Lupton and Sukkarieh, 2012) avoids re-integrating IMU measurements when the linearization point changes during optimization:

The preintegrated measurements between keyframes i and j:
```
delta_R_ij = prod_{k=i}^{j-1} Exp((omega_k - b_g) * dt)
delta_v_ij = sum_{k=i}^{j-1} delta_R_ik * (a_k - b_a) * dt
delta_p_ij = sum_{k=i}^{j-1} (delta_v_ik * dt + 0.5 * delta_R_ik * (a_k - b_a) * dt^2)
```

When bias estimates change during optimization, first-order corrections are applied without full re-integration:
```
delta_R_ij_corrected = delta_R_ij * Exp(J_R_bg * delta_bg)
```

This enables efficient sliding-window optimization for real-time state estimation.

---

## 19. GNSS Processing

### 19.1 GPS/GNSS for Autonomous Vehicles

Waymo uses GNSS as one component of multi-sensor localization:

- **Multi-constellation**: GPS (US), GLONASS (Russia), Galileo (EU), BeiDou (China) -- modern receivers access 125+ satellites (vs. <30 for GPS-only).
- **Frequencies**: Dual-frequency (L1/L2 for GPS) or multi-frequency reception improves accuracy by enabling ionospheric delay estimation.

### 19.2 RTK-GPS (Real-Time Kinematic)

RTK achieves centimeter-level accuracy using carrier-phase measurements:

```
phi = R + c*(dt_rx - dt_sat) + N*lambda - I + T + epsilon
```

where phi is the carrier-phase measurement, R is the geometric range, dt_rx and dt_sat are receiver and satellite clock errors, N is the integer ambiguity, lambda is the carrier wavelength, I is ionospheric delay, and T is tropospheric delay.

**Double differencing** between two receivers (base and rover) and two satellites eliminates common-mode errors:
```
nabla_delta_phi = nabla_delta_R + nabla_delta_N * lambda + noise
```

Integer ambiguity resolution (e.g., LAMBDA method) is the key challenge; once resolved, position accuracy reaches 1-5 cm.

### 19.3 PPP (Precise Point Positioning)

PPP uses precise satellite orbits and clocks from global correction services:
- No base station required (unlike RTK).
- Accuracy: ~5-20 cm after convergence (which can take minutes).
- PPP-RTK combines PPP with regional atmospheric corrections for faster convergence.

### 19.4 Integrity Monitoring

For safety-critical autonomous driving:
- **RAIM (Receiver Autonomous Integrity Monitoring)**: Detects faulty satellite measurements using measurement redundancy.
- **Multi-constellation cross-validation**: Independent constellations validate each other's outputs.
- **Fault detection and exclusion (FDE)**: Identifies and excludes measurements from malfunctioning satellites.

Waymo's primary localization is LiDAR-to-map matching, with GNSS providing coarse position initialization and integrity checking. This design ensures localization remains accurate even in GPS-challenged environments (urban canyons, tunnels).

---

## 20. Geometric Safety Checks

### 20.1 Collision Checking Algorithms

**GJK (Gilbert-Johnson-Keerthi)**:
- Determines whether two convex shapes intersect by searching for the origin in the Minkowski difference.
- Iterative algorithm that converges in a few iterations for typical 3D geometries.
- Complexity: O(n) per iteration where n is the number of vertices.
- Used for checking intersection between the ego vehicle's swept volume and predicted object volumes.

**SAT (Separating Axis Theorem)**:
- Two convex shapes do not intersect if and only if a separating axis exists.
- For 3D oriented bounding boxes (OBBs), test 15 candidate axes: 3 face normals per box + 9 edge cross products.
- Computationally efficient for box-box collision tests common in autonomous driving.

**Swept volume collision checking**:
- The ego vehicle's trajectory generates a swept volume over a time horizon.
- Other objects' predicted trajectories generate their own swept volumes.
- Intersection of swept volumes indicates potential collision.
- Computed via temporal sampling: check static collision at discrete time steps along both trajectories.

### 20.2 Time-to-Collision (TTC)

TTC is a fundamental safety metric used in Waymo's Collision Avoidance Testing (CAT):

**Point-based TTC**: For two objects approaching each other along a common line:
```
TTC = -d / d_dot
```
where d is the current distance and d_dot is the closing rate (relative velocity along the connecting line).

**2D TTC**: Waymo's CAT methodology uses a "high-fidelity, 2D time-to-collision near-miss indicator" derived from sensor data. This considers the full 2D extents of both objects, not just point distances.

**Polygon-based TTC**: For objects with complex shapes, TTC is computed as the minimum time at which the Minkowski sum of the two objects' footprints transitions from non-intersecting to intersecting, considering their current velocities and accelerations.

### 20.3 Safety Corridors

A safety corridor defines the region the ego vehicle must remain within:
- **Lateral corridor**: Defined by lane boundaries plus safety margins.
- **Longitudinal corridor**: Defined by following distance to the leading vehicle and time-to-collision constraints.
- **Violation detection**: Any planned trajectory that exits the safety corridor triggers a replanning event or emergency maneuver.

---

## 21. Rule-Based Fallbacks and Safety Monitors

### 21.1 Onboard Validation Layer

Waymo's 2025 "Demonstrably Safe AI" architecture explicitly includes **"a separate and rigorous onboard validation layer, which then verifies the trajectories produced by the Driver's generative ML model."**

This validation layer operates independently from the ML-based driving system and represents a classical, rule-based safety check on neural network outputs:

- **Trajectory feasibility**: Verifies that planned trajectories are physically realizable (within vehicle kinematic constraints: maximum acceleration, deceleration, steering rate).
- **Collision checking**: Geometrically verifies that planned trajectories do not intersect predicted object trajectories (using algorithms from Section 20).
- **Road boundary compliance**: Ensures the trajectory remains within drivable area boundaries.
- **Traffic rule compliance**: Verifies compliance with traffic signals, stop signs, and right-of-way rules.

### 21.2 Sensor Health Monitoring

The Waymo safety case white paper describes continuous monitoring of sensor functionality:

- **Nominal vs. degraded mode**: The system classifies its functional status as nominal (all sensors operational) or degraded (one or more sensors compromised).
- **Per-sensor health checks**: Each LiDAR, camera, and radar is individually monitored for:
  - Signal quality (SNR, dropout rate, return density).
  - Timestamp consistency (PTP synchronization integrity).
  - Calibration validity (extrinsic alignment quality metrics).
  - Mechanical function (rotation speed for LiDAR, lens cleanliness for cameras via miniature wipers on 6th-gen).

### 21.3 Degraded Mode Perception

When sensor fidelity degrades, the system adapts:

- **Graceful degradation**: If one camera fails, remaining cameras maintain coverage with reduced overlap. If a perimeter LiDAR fails, radar and cameras provide backup coverage for the affected region.
- **Confidence adjustment**: Detection confidence scores are reduced in regions with degraded sensor coverage.
- **Speed limiting**: The vehicle may reduce speed to compensate for reduced perception capability, buying more reaction time.

### 21.4 Minimum Risk Condition (MRC)

When the vehicle cannot guarantee safe continuation of autonomous operation:

1. **Controlled deceleration**: The vehicle smoothly decelerates to a stop.
2. **Pull-over maneuver**: If possible, the vehicle navigates to a safe stopping location (shoulder, parking area).
3. **Hazard lights**: Activated to alert other road users.
4. **Remote assistance**: Waymo's fleet response team is notified.

MRC triggers include:
- Multiple simultaneous sensor failures.
- Localization confidence below threshold.
- Environmental conditions exceeding the operational design domain (ODD).
- Persistent detection of safety-critical inconsistencies across sensors.

### 21.5 Collision Avoidance Testing (CAT) Framework

Waymo's CAT methodology (arXiv:2212.08148) provides a deterministic, rule-based safety evaluation:

- **Reference behavior model**: A non-impaired, eyes-on-conflict (NIEON) human driver model defines the acceptance criterion. The ADS must meet or exceed this reference.
- **Scenario database**: Systematically developed from human crash data (police databases, naturalistic driving studies), ADS testing data, and expert domain knowledge.
- **Simulation-based testing**: Thousands of collision scenarios are evaluated within hours using simulation constructed from real sensor data and test track recordings.
- **Collision and serious injury metrics**: Deterministic pass/fail criteria based on whether collisions occur and their severity.

---

## 22. Occupancy Grid Classical Methods

### 22.1 Bayesian Occupancy Grid Updates

The classical occupancy grid maintains a probability of occupancy for each 2D or 3D cell:

**Binary Bayes filter**:
```
p(m_i | z_{1:t}) = [1 + (1 - p(m_i | z_t)) / p(m_i | z_t) * (1 - p(m_i | z_{1:t-1})) / p(m_i | z_{1:t-1}) * p(m_i) / (1 - p(m_i))]^(-1)
```

### 22.2 Log-Odds Representation

For computational efficiency, the occupancy probability is stored in log-odds form:

```
l(m_i | z_{1:t}) = log(p(m_i | z_{1:t}) / (1 - p(m_i | z_{1:t})))
```

The recursive update becomes additive:
```
l(m_i | z_{1:t}) = l(m_i | z_{1:t-1}) + l(m_i | z_t) - l_0
```

where l_0 = log(p_prior / (1 - p_prior)) is the prior log-odds (typically 0 for p_prior = 0.5).

**Advantages**:
- No multiplication or division; only addition and subtraction.
- No renormalization needed.
- Numerically stable (avoids floating-point issues near 0 or 1).

### 22.3 Inverse Sensor Models

The inverse sensor model p(m_i | z_t) maps from a sensor measurement to the occupancy probability of each cell:

**LiDAR inverse sensor model**:
- Cells along the beam path (between sensor and return point) are marked as **free** (high probability of being unoccupied).
- The cell at the return point is marked as **occupied**.
- Cells beyond the return point are **unknown** (not observed).

```
p(m_i | z_t) = p_free    if cell is between sensor and return
             = p_occ     if cell is at the return point
             = p_prior   if cell is beyond the return or outside beam
```

Typical values: p_free = 0.3, p_occ = 0.9, p_prior = 0.5.

**Radar inverse sensor model**: Similar to LiDAR but with wider beam (larger angular uncertainty), requiring broader "occupied" marking and less certain "free" marking.

### 22.4 Dempster-Shafer Evidence Theory

An alternative to Bayesian occupancy grids that explicitly models uncertainty:

**Mass functions**: m(free), m(occupied), m(unknown) with m(free) + m(occupied) + m(unknown) = 1.

**Dempster's rule of combination**:
```
m_{1,2}(A) = (1 / (1-K)) * sum_{B intersect C = A} m_1(B) * m_2(C)
```
where K is the degree of conflict: K = sum_{B intersect C = empty} m_1(B) * m_2(C).

**Advantages over Bayesian**: Explicitly represents ignorance (unknown state) separate from equal probability of occupied/free. Better handles conflicting sensor evidence.

### 22.5 Waymo's Occupancy Representations

Waymo's published work moves beyond classical occupancy grids with learned **Occupancy Flow Fields** (RA-L, 2022):
- Each BEV grid cell contains both an **occupancy probability** and a **2D flow vector**.
- The flow trace loss enforces consistency between occupancy and flow predictions.
- Speculative agents: predicts currently-occluded agents that may appear in the future.

However, classical Bayesian occupancy grids likely still underpin:
- Free space estimation for drivable area computation.
- Static obstacle mapping (curbs, barriers, construction cones).
- Radar-based occupancy in degraded LiDAR conditions.

---

## 23. ML Proposals + Geometric Verification

### 23.1 Non-Maximum Suppression (NMS)

NMS is the primary classical post-processing step applied to all ML detection outputs:

**Oriented 3D IoU NMS**:
1. Sort detections by confidence score in descending order.
2. Select the highest-scoring detection; add it to the output list.
3. Compute oriented 3D IoU between the selected detection and all remaining detections.
4. Remove detections with IoU exceeding the threshold (typically 0.1-0.7 depending on class).
5. Repeat from step 2 until no detections remain.

**Oriented 3D IoU computation**:
- Project the two 3D OBBs onto the ground plane (BEV).
- Compute the intersection area of the two rotated rectangles (Sutherland-Hodgman polygon clipping).
- The 3D intersection volume considers the height overlap.
- IoU = intersection_volume / union_volume.

**Stateful NMS** (Waymo Streaming Detection, ECCV 2020):
- Standard NMS is a stateless operation applied to each frame independently.
- Streaming detection uses **stateful NMS** that maintains detection state across partial LiDAR rotations, preventing duplicate detections as the scan progresses.
- Combined with recurrent architectures (RNN) for temporal consistency.

**AFDet (Anchor-Free NMS-Free)**: Max pooling and AND operation find peaks in predicted heatmaps, replacing IoU-based NMS entirely for anchor-free detectors.

### 23.2 Geometric Consistency Checks

ML detections are verified against geometric constraints:

- **Ground plane consistency**: Detected objects should have their bottom face near the estimated ground plane (within tolerance). Floating objects or underground objects indicate false positives.
- **Physical size validation**: Detected bounding box dimensions are checked against class-specific size priors. A "vehicle" detection 0.5m long or 20m wide is flagged.
- **Kinematic feasibility**: Estimated velocities must be physically plausible for the object class (e.g., pedestrians < 10 m/s, vehicles < 80 m/s).

### 23.3 Cross-Sensor Geometric Validation

Waymo performs explicit cross-sensor validation:

- **Camera detects stop sign** -> LiDAR verifies whether it is a real 3D sign or a flat image/reflection.
- **LiDAR detects partially occluded shape** -> Camera texture confirms the object class.
- **Radar provides instant Doppler** -> Validates whether camera/LiDAR-detected objects are truly static or moving.

This cross-modal verification uses geometric projection (3D-to-2D via calibrated extrinsics) and consistency scoring rather than neural networks.

### 23.4 LiDAR-Camera Projection Verification

When ML proposes a 3D detection, geometric verification projects it into all camera views:

1. Transform 3D box corners to each camera's coordinate frame using extrinsic calibration.
2. Project to 2D using camera intrinsics.
3. Verify that:
   - The projected box aligns with a camera detection (if one exists).
   - The projected box region in the image contains pixels consistent with the proposed class (color, texture).
   - The projected box does not overlap with clearly inconsistent image regions (e.g., sky, road surface for a vehicle detection above ground level).

---

## 24. Learned Features + Classical Tracking

### 24.1 Detection-to-Track Pipeline

Waymo's tracking architecture follows the **tracking-by-detection** paradigm where ML detections feed classical trackers:

```
Neural Network Detector --> 3D Detections --> Classical Tracker --> Tracked Objects
    (SWFormer,                (boxes, scores,    (Kalman filter,     (IDs, states,
     CenterPoint,              classes)           Hungarian,          trajectories)
     PVTransformer)                               lifecycle mgmt)
```

The detector is purely ML-based; the tracker is primarily classical (with learned enhancements in newer systems like SoDA and STT).

### 24.2 AB3DMOT Baseline

The AB3DMOT tracker, widely used on the Waymo Open Dataset, is entirely classical post-detection:

| Component | Method |
|---|---|
| **State estimation** | 3D Kalman filter (10-state: position, size, heading, velocity) |
| **Motion model** | Constant velocity |
| **Data association** | Hungarian algorithm on 3D IoU |
| **Track management** | Heuristic birth/death rules |
| **Speed** | >200 FPS |

### 24.3 Hybrid Tracking (SoDA, STT)

Waymo's more recent trackers integrate learned components:

- **SoDA** (2020): Replaces hard Hungarian assignment with **attention-based soft data association**. Track embeddings encode spatiotemporal dependencies. The tracker maintains track estimates through occlusion via learned latent representations. The soft association is a learned module, but the overall track state management retains classical elements.

- **STT** (ICRA 2024): A transformer model that **jointly optimizes data association and state estimation**. Consumes appearance, geometry, and motion signals through long-term detection history. While the core is a transformer, the output still produces classical state estimates (position, velocity, acceleration) and classical tracking metrics (S-MOTA, MOTPS).

### 24.4 1st Place Waymo 2020 Tracking Solution

The winning solution (HorizonMOT) demonstrates the classical-ML hybrid:

**Classical components**:
- 3D Kalman filter with 10-dimensional state vector.
- Constant velocity motion model.
- Three-stage Hungarian assignment.
- Track creation/deletion heuristics with maximum age threshold A_max.

**Learned components**:
- Re-ID network (11 conv layers, 512-dim embeddings) for appearance-based association.
- Cosine distance between appearance features supplements geometric distance.

---

## 25. Neural + Classical Fusion

### 25.1 DeepFusion: InverseAug as Classical Geometric Operation

DeepFusion (CVPR 2022) combines deep learning with explicit geometric operations:

**InverseAug** is a purely geometric/classical operation within a neural pipeline:
1. During training, geometric data augmentation parameters (RandomRotation, WorldScaling, GlobalTranslateNoise, RandomFlip) are saved.
2. At fusion time, all augmentations are **inversely applied** to 3D keypoints to recover their positions in the original coordinate system.
3. These un-augmented 3D positions are then projected to 2D camera coordinates using the calibrated extrinsic and intrinsic parameters.
4. This enables accurate geometric alignment between LiDAR and camera features despite training-time augmentation.

The inverse transformation is:
```
p_original = T_flip^(-1) * T_translate^(-1) * S^(-1) * R_z^(-1) * p_augmented
```

where each T, S, R is the augmentation transform with saved parameters.

### 25.2 Sensor Fusion Encoder Output Structure

Waymo's 2025 foundation model architecture produces both neural embeddings and classical structured outputs:

| Output Type | Nature | Usage |
|---|---|---|
| **Rich learned embeddings** | Neural (dense vectors) | Input to World Decoder for prediction, planning |
| **3D object detections** | Classical (boxes, classes, scores) | Direct downstream consumption |
| **Semantic attributes** | Structured (class labels, states) | Rule-based safety logic |
| **Road graph elements** | Structured (polylines, boundaries) | Planning and map validation |

The structured outputs enable classical safety validation even within an end-to-end learned system.

### 25.3 World Decoder: Neural Outputs for Classical Validation

The World Decoder produces **"signals for trajectory validation"** -- explicitly generating outputs consumed by the classical onboard validation layer:

- **Predicted trajectories** for other road users (consumed by collision checking algorithms).
- **HD map elements** (consumed by route planning and lane-keeping logic).
- **Ego trajectory candidates** (consumed by the onboard validation layer for safety verification).

---

## 26. Classical Preprocessing for ML

### 26.1 Point Cloud Preprocessing Pipeline

Before entering any neural network, LiDAR point clouds undergo extensive classical preprocessing:

```
Raw Range Images
    |
    v
Range Image Formation (beam angle indexing)
    |
    v
Multi-Return Extraction (first + strongest)
    |
    v
Near-Field Filtering (vehicle body removal)
    |
    v
Intensity Normalization (range-dependent correction)
    |
    v
Elongation-Based Filtering (spurious return removal)
    |
    v
Motion Compensation (per-point ego-motion correction)
    |
    v
Multi-Sweep Aggregation (temporal concatenation with time channel)
    |
    v
Coordinate Transformation (sensor frame -> vehicle frame)
    |
    v
Voxelization / Pillarization / Range Image formatting
    |
    v
Neural Network Input
```

### 26.2 Camera Preprocessing Pipeline

```
Raw Bayer Data
    |
    v
Debayering / Demosaicing
    |
    v
White Balance
    |
    v
HDR Tone Mapping
    |
    v
Gamma Correction
    |
    v
Noise Reduction
    |
    v
Lens Distortion Correction (Brown-Conrady)
    |
    v
Vignetting Compensation
    |
    v
Rolling Shutter Correction
    |
    v
Auto-Exposure Normalization
    |
    v
Neural Network Input (RGB or specialized encoding)
```

### 26.3 Radar Preprocessing Pipeline

```
Raw ADC Samples
    |
    v
Range FFT (per chirp)
    |
    v
Doppler FFT (across chirps)
    |
    v
CFAR Detection (range-Doppler map)
    |
    v
Digital Beamforming / Angle FFT
    |
    v
Clutter Removal (ground, static environment)
    |
    v
Ghost Rejection (multi-path filtering)
    |
    v
Point-Like Representation (range, azimuth, elevation, Doppler, RCS)
    |
    v
Neural Network Input (or classical tracker input)
```

### 26.4 LESS Heuristic Pre-Segmentation

Waymo's LESS (ECCV 2022) uses classical preprocessing to dramatically reduce labeling requirements:

1. **Ground removal**: Classical ground plane estimation removes ground points.
2. **Connected component construction**: After ground removal, outdoor-scene objects are well-separated. Connected-component analysis on the remaining points groups them into segments.
3. **Coarse annotation**: Human annotators label each connected component rather than individual points -- orders of magnitude faster.
4. **Result**: Competitive with fully supervised methods using only **0.1% labeled points**.

### 26.5 Streaming Detection: Classical Scheduling

Waymo's Streaming Object Detection (ECCV 2020) uses classical computational scheduling:

- LiDAR point clouds are treated as a **streaming data source** rather than a static frame.
- Computation is **pipelined** across the acquisition time of a single rotation.
- Partial scans are processed as they arrive, rather than waiting for a complete 360-degree rotation.
- **Stateful NMS** maintains detection state across partial rotations.
- **Recurrent architectures** accumulate evidence as new portions of the scan arrive.
- Result: Peak latency reduced from ~120 ms to ~30 ms (3-15x improvement).

### 26.6 Multi-Sweep Aggregation as Classical Preprocessing

Combining consecutive LiDAR frames is a classical operation providing ML inputs with richer information:

1. **Ego-motion compensation**: Each historical frame is transformed to the current vehicle frame using the pose estimate.
2. **Temporal channel encoding**: Each point receives an additional feature: the time offset from the current frame (0.0 for current, -0.1 for previous frame at 10 Hz, etc.).
3. **Concatenation**: All compensated points are concatenated into a single dense point cloud.
4. **Typical window**: 2-5 frames (0.2-0.5 seconds). MoDAR extends this to 18 seconds.

---

## 27. Key Patents (Non-ML Focus)

| Patent Number | Title | Non-ML Relevance |
|---|---|---|
| **US9,383,753B1** | Wide-View LIDAR with Areas of Special Attention | Adaptive angular resolution via classical pulse-rate and slew-rate control; attention region selection via edge detection, moving object tracking, distance thresholding, spatial/temporal frequency analysis |
| **US20160291134A1** | Long Range Steerable LIDAR System | Fiber laser (1550 nm), dual-axis beam steering (spring resonant + stepper motor), 0.1x0.03 degree angular resolution, 300+ m range, time-of-flight signal processing |
| **US20170124781A1** | Calibration for Autonomous Vehicle Operation | Online/offline sensor calibration; intrinsic + extrinsic parameters; LiDAR-camera alignment via depth-edge correlation; vehicle parameters (wheel base, inertial tensor, friction) |
| **US20110182475A1** | Traffic Signal Mapping and Detection | 3D triangulation of traffic light positions from multiple camera images; geometric mapping |
| **US9,707,960** | Traffic Signal Response for Autonomous Vehicles | Rule-based intersection behavior based on traffic signal state |
| **US9,097,800** | LiDAR System (3D Point Map) | Classical 3D point map generation from LiDAR |
| **US9,086,273** | LiDAR Sensor Technology | Core LiDAR sensor architecture (central to Waymo-Uber lawsuit) |
| **US8,836,922B1** | Curved Detector Arrays | Flexible substrate SPAD arrays for conformal receiver optics |
| **D881,854** | Integrated MIMO and SAR Radar Antenna | Physical radar antenna design combining MIMO and SAR |
| **US11,733,369** | 3D Object Detection Using Radar and Neural Networks | Hybrid radar signal processing + neural network detection |
| **US9,880,263B2** | Long Range Steerable LIDAR System (granted) | Granted version of US20160291134A1 |
| **US11,054,505B2** | Long Range Steerable LIDAR System (continuation) | Continuation of the steerable LIDAR family |
| **US11,163,044** | LiDAR System | LiDAR system design and signal processing |

**Patent portfolio scale**: 3,476 patents globally (1,898 granted), with 20+ patent families related to LiDAR sensors alone. 97.07% grant rate. Top citing companies: Ford Motor, Toyota, GM Global Technology Operations.

---

## 28. Key Papers and References

### Directly Waymo-Authored (Non-ML/Hybrid Focus)

| Paper | Venue | Year | Non-ML Relevance |
|---|---|---|---|
| **Scalable Scene Flow from Point Clouds in the Real World** | arXiv | 2021 | 3D motion vector estimation; 1,000x larger real-world scene flow dataset; classical ego-motion compensation preprocessing |
| **Streaming Object Detection for 3-D Point Clouds** | ECCV | 2020 | Classical computational pipelining; stateful NMS; latency-optimized scheduling (120ms -> 30ms) |
| **LESS: Label-Efficient Semantic Segmentation for LiDAR Point Clouds** | ECCV | 2022 | Heuristic pre-segmentation using ground removal + connected components; classical preprocessing enables 0.1% label efficiency |
| **DeepFusion: Lidar-Camera Deep Fusion for Multi-Modal 3D Object Detection** | CVPR | 2022 | InverseAug: classical geometric transform inversion for LiDAR-camera alignment during training |
| **Occupancy Flow Fields for Motion Forecasting** | RA-L | 2022 | BEV occupancy representation; flow trace loss for consistency; extends classical occupancy grids with flow |
| **Collision Avoidance Testing of the Waymo ADS** | arXiv | 2022 | Rule-based safety evaluation; TTC metrics; reference behavior models; deterministic scenario testing |
| **Waymo's Safety Methodologies and Safety Readiness Determinations** | arXiv | 2020 | Hazard analysis, ODD boundary checking, sensor health monitoring, MRC procedures |
| **Waymo Safety Case Approach** | White Paper | 2023 | Classical safety validation framework; rule-based monitors; degraded mode operations |
| **Demonstrably Safe AI for Autonomous Driving** | Blog | 2025 | Onboard validation layer (classical) verifying ML trajectories; structured representations alongside learned embeddings |
| **Scalability in Perception for Autonomous Driving: WOD** | CVPR | 2020 | Dataset design exposing classical calibration parameters (intrinsics, extrinsics, rolling shutter, beam inclination) |
| **1st Place Solutions for Waymo Challenges -- 2D and 3D Tracking** | arXiv | 2020 | Classical Kalman filter tracking; Hungarian algorithm; three-stage association; heuristic track management |
| **RIDDLE: LiDAR Data Compression** | CVPR | 2022 | Range image delta encoding; classical signal compression concepts applied to LiDAR data |
| **Block-NeRF: Scalable Large Scene Neural View Synthesis** | CVPR | 2022 | Uses classical segmentation-based masking of transient objects; Structure-from-Motion-derived camera poses |

### Relevant Non-Waymo Papers Used on Waymo Data

| Paper/Method | Relevance |
|---|---|
| **AB3DMOT** (IROS 2020) | Classical 3D MOT baseline: Kalman filter + Hungarian algorithm; >200 FPS on Waymo |
| **UKF-MOT** (CAAI 2024) | UKF-based tracker achieving superior accuracy on Waymo, KITTI, nuScenes |
| **CasTrack** | Online 3D multi-object tracking on Waymo with cascade association |
| **ZeroFlow** (2023) | Scene flow via distillation; evaluated on Waymo; classical ego-motion compensation preprocessing |
| **FastFlow3D** | Scene flow estimation trained on Waymo's large-scale dataset |

### Waymo Official Safety Publications

- [Waymo Safety Case Approach White Paper](https://assets.ctfassets.net/e6t5diu0txbw/66jOjPtNIjzawaK0ZjpU3q/7f081b392cf29a3355c97d0d758fe6cf/Waymo_Safety_Case_Approach.pdf)
- [Waymo Safety Report 2021](https://downloads.ctfassets.net/sv23gofxcuiz/4gZ7ZUxd4SRj1D1W6z3rpR/2ea16814cdb42f9e8eb34cae4f30b35d/2021-03-waymo-safety-report.pdf)
- [Waymo Safety Methodologies (arXiv:2011.00054)](https://arxiv.org/abs/2011.00054)
- [Collision Avoidance Testing (arXiv:2212.08148)](https://arxiv.org/abs/2212.08148)

### Waymo Open Dataset Resources

- [Dataset Proto Definition](https://github.com/waymo-research/waymo-open-dataset/blob/master/src/waymo_open_dataset/dataset.proto)
- [Camera-Only Tutorial](https://github.com/waymo-research/waymo-open-dataset/blob/master/tutorial/tutorial_camera_only.ipynb)
- [Unofficial Detailed Documentation](https://github.com/Jossome/Waymo-open-dataset-document)

### Patent Sources

- [Waymo Patents List](https://waymo.com/legal/patents/)
- [Justia Waymo Patent Assignments](https://patents.justia.com/assignee/waymo-llc)
- [Waymo Patent Analysis (GreyB)](https://insights.greyb.com/waymo-patents/)
- [Google Patents: US9383753B1](https://patents.google.com/patent/US9383753)
- [Google Patents: US20170124781A1](https://patents.google.com/patent/US20170124781A1/en)
- [Google Patents: US20160291134A1](https://patents.google.com/patent/US20160291134A1/en)

### Sensor Hardware References

- [5th Gen Waymo Driver](https://waymo.com/blog/2020/03/introducing-5th-generation-waymo-driver/)
- [6th Gen Waymo Driver](https://waymo.com/blog/2024/08/meet-the-6th-generation-waymo-driver/)
- [Laser Bear Honeycomb LiDAR](https://waymo.com/blog/2019/03/bringing-3d-perimeter-lidar-to-partners)
- [LiDAR Solutions Blog](https://waymo.com/blog/2022/09/informing-smarter-lidar-solutions-/)
- [Tangram Vision Sensor Breakdown](https://www.tangramvision.com/blog/sensing-breakdown-waymo-jaguar-i-pace-robotaxi)
- [Demonstrably Safe AI Blog](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)

---

## Summary: Where Classical Methods Live in Waymo's Stack

| Layer | Classical / Non-ML Techniques | Status |
|---|---|---|
| **Raw signal acquisition** | ToF calculation, photon detection, range gating, FMCW processing, FFT, CFAR, beamforming | Essential, irreplaceable |
| **ISP pipeline** | Debayering, white balance, HDR, gamma, distortion correction, rolling shutter | Essential, irreplaceable |
| **Calibration** | Intrinsic/extrinsic estimation, online monitoring, depth-edge correlation | Essential, irreplaceable |
| **Synchronization** | PTP/IEEE 1588, hardware triggers, per-point timestamping | Essential, irreplaceable |
| **Point cloud preprocessing** | Ground removal, motion compensation, voxelization, multi-sweep aggregation | Essential preprocessing for ML |
| **Localization** | NDT/ICP scan matching, IMU mechanization, GNSS/RTK, preintegration | Core classical system |
| **Object tracking** | Kalman filtering, Hungarian algorithm, track lifecycle management | Classical backbone with ML enhancements |
| **Safety validation** | Collision checking (GJK/SAT), TTC, trajectory verification, rule-based monitors | Independent classical safety layer |
| **Post-processing** | NMS, geometric consistency checks, cross-sensor validation | Essential post-ML processing |
| **Occupancy** | Bayesian updates, log-odds, inverse sensor models | Classical foundation, extended by ML |

Even as Waymo moves toward end-to-end foundation models, the classical signal processing, calibration, synchronization, localization, and safety validation layers remain structurally necessary. The 2025 "Demonstrably Safe AI" architecture explicitly preserves a **separate classical validation layer** that verifies ML outputs before they reach the vehicle's actuators -- an architectural decision that ensures classical techniques will remain central to Waymo's perception and safety stack for the foreseeable future.
