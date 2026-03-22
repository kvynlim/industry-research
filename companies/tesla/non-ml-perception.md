# Tesla FSD Perception: Exhaustive Deep Dive into Non-ML & Hybrid-ML Techniques

**Last Updated:** March 2026

Tesla claims "end-to-end" neural network driving, but the reality is far more nuanced. Beneath the neural network lies a thick substrate of classical computer vision, signal processing, geometric methods, rule-based systems, and hardware-level processing that is essential to making the system work. This document exhaustively catalogs every non-ML and hybrid-ML component in Tesla's perception stack.

---

## Table of Contents

1. [Camera Signal Processing](#1-camera-signal-processing)
2. [Calibration](#2-calibration)
3. [Geometric Methods](#3-geometric-methods)
4. [State Estimation & Tracking](#4-state-estimation--tracking)
5. [Temporal & Motion](#5-temporal--motion)
6. [Classical Depth Estimation](#6-classical-depth-estimation)
7. [Rule-Based & Hybrid Systems](#7-rule-based--hybrid-systems)
8. [NPU & Hardware Interface](#8-npu--hardware-interface)
9. [Patent Index](#9-patent-index)
10. [Sources & References](#10-sources--references)

---

## 1. Camera Signal Processing

### 1.1 ISP Pipeline -- Tesla's ISP Bypass

#### The Traditional ISP on HW3

The HW3 FSD chip contains a dedicated Image Signal Processor with the following specifications (per WikiChip Fuse analysis and Autonomy Day 2019 disclosure):

| Parameter | Specification |
|-----------|--------------|
| Internal pipeline depth | 24-bit processing |
| Throughput | Up to 1 billion pixels per second |
| Camera serial interface (CSI) input | Up to 2.5 billion pixels per second |
| Tone mapping | Yes -- recovers detail in shadows and highlights |
| Noise reduction | Spatial and temporal |
| HDR merge | Multi-exposure merge |
| Video encoder | H.265 (HEVC) for dashcam recording and cloud clip upload |

A conventional ISP pipeline performs, in order: black level subtraction, defective pixel correction, demosaicing (Bayer interpolation), white balance, color correction matrix, gamma/tone mapping, noise reduction (spatial + temporal), sharpening, lens distortion correction, dynamic range compression, and output encoding (JPEG or H.265).

#### The ISP Bypass: Raw Sensor Data to Neural Network

Tesla's radical departure: **bypass the ISP entirely** and feed raw 12-bit sensor data directly into the neural network. This was first publicly discussed at AI Day 2021 and later confirmed in FSD Beta 9.2 release notes, which mentioned upgrading the "generalized static object network to use 10-bit photon count streams rather than 8-bit ISP tonemapped images."

**Why this matters quantitatively:**

| Processing Stage | Bit Depth | Brightness Levels | Information Preserved |
|-----------------|-----------|-------------------|-----------------------|
| Raw sensor output | 12-bit | 4,096 per pixel | 100% -- full photon count |
| After ISP tone mapping | 8-bit | 256 per pixel | ~6.25% -- compressed for human viewing |
| After JPEG compression | 8-bit lossy | <256 effective | <6% -- further degraded by quantization artifacts |
| Tesla NN input | 12-bit raw (or 10-bit in some versions) | 1,024--4,096 | ~25--100% -- maximally preserved |

**What is bypassed:**
- No demosaicing -- the neural network receives the raw RCCC mosaic pattern and learns its own implicit demosaicing
- No color correction -- no white balance, no color matrix, no gamma curve
- No tone mapping -- no S-curve that compresses dynamic range for human viewing
- No dynamic range compression -- the full 120 dB (IMX490) or ~80 dB (AR0136AT) range is preserved
- No JPEG/H.265 encoding on the perception path (video encoding still used for dashcam and cloud uploads)

**What is NOT bypassed:**
- The ISP still processes images for the driver-facing display (dashcam view, Sentry Mode recordings)
- H.265 encoding is still used for cloud clip uploads (trigger-based data collection)
- Black level subtraction and defective pixel correction likely still occur at the analog front-end level, before the digital data reaches the neural network

**Practical impact in extreme conditions:**
- Tunnel entry/exit: Raw 12-bit data preserves 4,096 brightness levels simultaneously, so the neural network can "see" inside a dark tunnel and the bright exit at the same time. A conventional ISP would crush one or both ends of this range.
- Driving into direct sun: ISP-processed images saturate to white; raw data preserves gradients near saturation that the network can exploit.
- Night driving: The 3 clear pixels in RCCC capture 3x more photons than a Bayer green pixel, and the raw data preserves the low-signal photon counts that an ISP's noise reduction would smooth away.

**Patent:** US11215999B2 / WO2019245618 -- "Data Pipeline and Deep Learning System for Autonomous Driving" describes decomposing sensor data into component images and injecting them at different layers of the neural network to preserve signal fidelity, rather than compressing everything into a single initial input.

---

### 1.2 RCCC Color Filter Array Processing

#### What is RCCC?

RCCC stands for **Red-Clear-Clear-Clear**. It is a non-standard color filter array (CFA) that replaces the conventional Bayer RGGB pattern used in consumer cameras.

In a 2x2 pixel block:

```
Standard Bayer RGGB:        Tesla RCCC:
+---+---+                   +---+---+
| R | G |                   | R | C |
+---+---+                   +---+---+
| G | B |                   | C | C |
+---+---+                   +---+---+
```

Where:
- **R (Red):** Bandpass filter transmitting red wavelengths (~600--700 nm)
- **C (Clear):** No color filter -- panchromatic, transmitting the full visible spectrum (~380--720 nm)

#### How RCCC Differs from Bayer RGGB

| Property | Bayer RGGB | RCCC |
|----------|------------|------|
| Color channels | 3 (R, G, B) | 2 (R, panchromatic) |
| Color reproduction | Full-color images suitable for human viewing | Near-monochrome with red channel only |
| Light sensitivity per pixel | Each pixel loses ~67% of photons to the color filter | Clear pixels pass ~100% of photons; red pixels pass ~33% |
| Effective sensitivity gain | Baseline | ~2--3x more light collected per frame |
| Identifiable colors | Full visible spectrum | Red only; cannot distinguish green from blue |
| SNR in low light | Baseline | Significantly higher due to more collected photons |
| Autonomous driving suitability | Suboptimal -- wasting photons on color information the NN may not need | Optimized -- maximizes geometric/luminance information |

#### Why Tesla Chose RCCC

1. **2--3x light sensitivity:** Three of four pixels are unfiltered, collecting all visible photons rather than discarding ~67% through color filters. This is critical for night driving and low-light conditions.

2. **Red channel is sufficient for driving:** The only color that is safety-critical in driving is red -- traffic lights, brake lights, stop signs, emergency vehicles. Green, blue, and other colors are useful for aesthetics but rarely for driving decisions. The single red channel provides the necessary color discrimination.

3. **Neural network does not need color-accurate images:** The NN needs edges, gradients, motion, and geometric structure -- all of which are captured better by high-luminance-resolution clear pixels than by color-filtered pixels.

4. **Known limitations of RCCC:**
   - Cannot distinguish yellow from white road markings reliably (both appear as high-luminance against dark road)
   - Cannot distinguish green from amber traffic lights by color alone (must rely on spatial position in the traffic light housing)
   - Cannot reproduce human-viewable color images for the driver display (ISP must synthesize pseudo-color for dashcam view)

#### RCCC "Debayering"

Traditional Bayer demosaicing interpolates missing color channels at each pixel using surrounding pixels of different colors. For RCCC, the process differs fundamentally:

- **Classical RCCC demosaicing** (for display purposes): Interpolate red at clear pixels using the 1-in-4 red samples; clear channel is essentially luminance. The resulting image looks like a tinted grayscale with red highlights.
- **Tesla's approach for NN input:** No demosaicing at all. The raw RCCC mosaic is fed directly to the neural network. The first convolutional layers of the network learn to handle the mosaic pattern implicitly, effectively performing a learned demosaicing that extracts exactly the features needed for driving rather than reconstructing a human-viewable image.

#### HW3 Sensor: ON Semiconductor AR0136AT

| Parameter | Specification |
|-----------|--------------|
| Manufacturer | ON Semiconductor (formerly Aptina) |
| Resolution | 1280 x 960 (1.2 MP) |
| Pixel size | 3.75 um (BSI -- back-side illuminated) |
| Color filter | RCCC |
| HDR | 120 dB in HDR mode (multi-exposure combination) |
| Shutter | Rolling shutter |
| Output | 12-bit raw |
| Max pixel rate | 74.25 MP/second |
| Max frame rate | 45 fps at 960p; 60 fps at 720p |
| Tesla operating frame rate | 36 fps |
| LED flicker mitigation | No |

#### HW4 Sensor: Sony IMX490 / IMX963

| Parameter | Specification |
|-----------|--------------|
| Manufacturer | Sony Semiconductor Solutions |
| Resolution | 2896 x 1876 (5.4 MP) |
| Pixel size | 3.0 um |
| Illumination | Back-side illuminated (BSI) |
| Color filter | RCCC (custom automotive variant) |
| Dynamic range | 120 dB (140 dB in DR-priority mode) |
| HDR method | On-sensor sub-pixel architecture (NOT sequential multi-exposure) |
| LED flicker mitigation | Yes -- built into sensor hardware |
| Shutter | Rolling shutter |
| Output | 12-bit per channel; combined 24-bit HDR linear output |

---

### 1.3 HDR Processing -- The IMX490 Sub-Pixel Architecture

The Sony IMX490 represents a fundamentally different approach to HDR compared to the AR0136AT:

#### AR0136AT HDR (HW3): Sequential Multi-Exposure

The AR0136AT achieves HDR through sequential multi-exposure within a single frame period:
1. Capture a short exposure (captures highlights without saturation)
2. Capture a long exposure (captures shadows with sufficient signal)
3. Merge the two exposures into a single HDR frame

**Limitations:**
- Motion artifacts between the short and long exposures (objects move between exposures)
- Temporal aliasing with LED traffic lights -- a short exposure may capture the LED during its "off" phase in its PWM cycle, causing the light to appear dark or off
- Reduced effective frame rate due to multi-exposure overhead

#### IMX490 HDR (HW4): Simultaneous Sub-Pixel Exposure

The IMX490 uses a revolutionary **dual sub-pixel architecture**:

```
Each pixel location contains:
+-------------------+
| Sub-Pixel 1 (SP1) |  Large photodiode -- high sensitivity, high saturation (bright scenes)
| Sub-Pixel 2 (SP2) |  Small photodiode -- lower sensitivity (very bright scenes)
+-------------------+

Each sub-pixel has two readout gains:
- High conversion gain (HCG): Amplifies weak signals (dark scenes)
- Low conversion gain (LCG): Reduced amplification (bright scenes)

Total: 4 simultaneous exposures per pixel location
```

**How the 24-bit HDR is constructed:**

| Channel | Source | Covers |
|---------|--------|--------|
| SP1-HCG | Large pixel, high gain | Darkest shadows |
| SP1-LCG | Large pixel, low gain | Mid-shadows to mid-tones |
| SP2-HCG | Small pixel, high gain | Mid-tones to highlights |
| SP2-LCG | Small pixel, low gain | Brightest highlights |

Each channel outputs 12-bit data. The four 12-bit channels are combined on-sensor into a single **linear 24-bit HDR value** with a combined sub-pixel saturation capacity of 120,000 electrons and dynamic range exceeding 120 dB.

**Critical advantage for autonomous driving:** All four exposures happen simultaneously. There is zero temporal offset between them. This eliminates:
- Motion artifacts in HDR
- LED flicker artifacts (the long effective exposure averages out PWM cycling)

**Optical isolation:** Each sub-pixel has:
- A differently sized microlens to focus light optimally into its photodiode
- A light shield between sub-pixels
- A deep trench isolation to prevent optical crosstalk and charge leakage between adjacent pixels

**Signal processing per sub-pixel:**
- SP1 uses Correlated Double Sampling (CDS) for noise reduction: samples the reset level first, then the signal level, and subtracts to remove kTC noise
- SP2 uses Delta Reset Sampling (DRS) for noise suppression: the reset sample occurs after signal acquisition

---

### 1.4 LED Flicker Mitigation

LED traffic lights, electronic road signs, and vehicle LED brake/tail lights operate using Pulse-Width Modulation (PWM) -- they flicker on and off at frequencies typically between 60--400 Hz. At certain camera exposure times, the camera may capture the LED during its "off" phase, making it appear dark or completely off.

#### HW3 (AR0136AT): Software Mitigation Only

The AR0136AT sensor has **no hardware LED flicker mitigation**. Tesla mitigated this in software through:
- Temporal persistence: If a traffic light was detected as "on" in recent frames, a single "off" frame is treated as a flicker artifact
- Multi-exposure HDR: The long exposure in HDR mode averages across more LED on/off cycles, partially reducing flicker

This was a known weakness of HW3 -- occasional phantom "dark" traffic lights in individual frames.

#### HW4 (IMX490): Hardware-Level Mitigation

The IMX490's sub-pixel architecture inherently mitigates LED flicker because:
- The low-sensitivity sub-pixel (SP2) can use **longer exposure times** without saturating on bright scenes
- Longer exposure times average across more LED PWM cycles, smoothing out the flicker
- No sequential multi-exposure is needed, so there is no risk of capturing the LED's "off" phase in a short exposure

---

### 1.5 Rolling Shutter and Rolling Shutter Compensation

#### The Rolling Shutter Problem

Both the AR0136AT (HW3) and IMX490 (HW4) use **rolling shutter** CMOS sensors. Unlike a global shutter that exposes all pixels simultaneously, a rolling shutter reads out the sensor line by line, from top to bottom.

**Consequences for a moving vehicle:**
- At 60 mph (~27 m/s) with a ~30 ms rolling shutter readout delay, the vehicle moves approximately **80 cm** between the first and last scanline of a single frame
- Objects appear skewed or distorted -- vertical lines appear tilted
- Fast-moving lateral objects (e.g., cross-traffic) exhibit "jello" distortion
- At 36 fps, the inter-frame period is ~27.8 ms, and the rolling shutter readout consumes a significant fraction of this

#### Tesla's Rolling Shutter Correction

**Patent: WO2019079311A1** -- "Rolling Shutter Correction for Images Captured by a Camera Mounted on a Moving Vehicle"

The patent (originally filed by DeepMap, later acquired by NVIDIA, but the technique is general) describes the classical correction approach that Tesla and others use:

**Algorithm:**

1. **Known inputs:**
   - Camera projection matrix P (from calibration)
   - Image height H (number of scanlines)
   - Rolling shutter delay r (total readout time in milliseconds, from sensor datasheet)
   - Vehicle motion transform T (from IMU/odometry, representing vehicle displacement during one frame)

2. **Per-scanline correction:**
   - For each scanline y (from 0 to H):
     - Compute the delay factor: `delay_ratio = y / H`
     - Compute the time offset for this scanline: `t_scanline = delay_ratio * r`
     - Estimate vehicle displacement during `t_scanline` using the motion model: `displacement = velocity * t_scanline`
     - Translate 3D scene points backward by the estimated displacement to "undo" the vehicle motion that occurred between the reference scanline (typically the first or middle row) and scanline y
     - Re-project the corrected 3D points to image coordinates

3. **For 2D-only correction (no depth):**
   - Approximate the correction as a per-row affine transformation (horizontal shift proportional to row index)
   - This is sufficient when scene depth is roughly constant (e.g., road surface) but degrades for objects at varying depths

**In practice for Tesla:**
- The IMU provides high-rate (typically 100--1000 Hz) angular velocity and acceleration measurements
- Wheel odometry provides vehicle speed
- These are fused to estimate vehicle motion during each frame's rolling shutter readout
- The correction is applied either as a geometric pre-warp on the raw image or, more likely, the rolling shutter timing is encoded into the neural network's positional encoding so the network learns to compensate implicitly

**A key insight from the Tesla architecture:** Rather than explicitly correcting rolling shutter distortion in a separate preprocessing step, the calibration neural network and/or the positional encoding in the BEV transformer can learn to handle rolling shutter effects implicitly. The vehicle's IMU-derived motion during each frame is available as a kinematics input, allowing the network to account for the per-row timing offset.

---

### 1.6 Auto-Exposure and Gain Control

Auto-exposure (AE) is a classical feedback control system, not an ML component:

#### Per-Camera Exposure Control

Each of Tesla's 8 cameras operates independently with its own AE loop:

1. **Metering:** Analyze the brightness histogram of the current frame (or a metering region within it)
2. **Target exposure:** Compute the desired exposure level using a weighted metering algorithm (center-weighted, evaluative, or scene-adaptive)
3. **Control loop:** Adjust the sensor's exposure time and analog gain to reach the target brightness
   - Increase exposure time for dark scenes (up to the limit imposed by frame rate and motion blur)
   - Increase analog gain for dark scenes when exposure time is maxed out (introduces noise)
   - Decrease exposure time for bright scenes to prevent saturation

**For Tesla's RCCC sensors:**
- The metering is performed on the raw RCCC data, using primarily the clear pixels (which dominate the sensor)
- The red channel is not weighted separately in the metering -- it has the same exposure as the clear pixels
- HDR mode (AR0136AT) or sub-pixel architecture (IMX490) extends effective dynamic range beyond what AE alone can achieve

#### ISP Bypass Complication

With the ISP bypass, Tesla's exposure control has two consumers with different needs:
1. **Neural network path:** Wants maximally informative raw data -- may prefer slightly underexposed images to avoid clipping highlights, even if shadows are noisy
2. **Display/recording path:** Wants visually pleasing images for the driver's screen and dashcam

The AE algorithm likely prioritizes the NN's needs (preserving highlight detail) while the ISP applies its own tone mapping for the display path.

---

## 2. Calibration (Critical for Vision-Only)

Calibration is the single most important classical/geometric component in Tesla's vision-only stack. Without lidar or radar as geometric ground truth, the cameras must be precisely calibrated to enable any 3D reasoning.

### 2.1 Online Extrinsic Calibration

#### The Problem at Scale

Tesla ships 9+ million vehicles. Each vehicle has 8 cameras (7--8 active) installed with manufacturing tolerances:
- Camera mounting angle may vary by +/- 1--3 degrees from nominal
- Camera position may vary by +/- 5--20 mm
- The windshield introduces additional optical distortion that varies per vehicle
- Cameras shift over time due to vibration, thermal cycling, and minor impacts

For the neural network to produce consistent outputs across the entire fleet, every camera on every vehicle must present a geometrically standardized view of the world.

#### The Virtual Camera Approach

**Patent: US20230057509A1** -- "Vision-Based Machine Learning Model for Autonomous Driving with Adjustable Virtual Camera"

Tesla's solution: a **calibration neural network** that warps each physical camera's image into a synthetic "virtual camera" with standardized parameters.

**Technical implementation:**

1. **Physical camera:** Has unknown (or imprecisely known) extrinsic parameters [R|t] (rotation and translation relative to the vehicle body frame) and intrinsic parameters (focal length, principal point, distortion coefficients)

2. **Virtual camera:** Has precisely defined, standardized parameters that are identical across the entire fleet. Each camera position (e.g., "main forward," "left B-pillar") has one canonical virtual camera specification.

3. **Rectification transform:** An affine transformation (or more generally, a homography + lens distortion correction) warps each physical camera's image to match the virtual camera's view:
   ```
   I_virtual = Warp(I_physical, H_rectification)
   ```
   where H_rectification encapsulates the correction for:
   - Extrinsic misalignment (rotation + translation offset from nominal)
   - Intrinsic variations (focal length deviations, principal point offset)
   - Lens distortion correction (radial + tangential)

4. **Parameter estimation:** The calibration network estimates rectification parameters from visual features:
   - **Vanishing point detection:** Parallel lines in the scene (lane markings, building edges, power lines) converge to vanishing points in the image. The vanishing point position directly constrains the camera's yaw and pitch.
   - **Horizon detection:** The horizon line constrains camera pitch and roll.
   - **Multi-camera consistency:** Where multiple cameras have overlapping FOVs, the same 3D features must project consistently across cameras. Geometric inconsistency implies calibration error.
   - **IMU reference:** The IMU provides ground-truth gravity direction, constraining camera pitch and roll estimates.

**Calibration timeline:**

| Phase | Method | Duration |
|-------|--------|----------|
| Factory calibration (2025+) | Vehicle drives autonomously ~2 km on factory test track | Minutes |
| Post-delivery initial | Driver drives on roads with clear lane markings | 20--25 miles typical; up to 100 miles maximum |
| Ongoing refinement | Continuous background calibration while driving | Perpetual, asynchronous |

#### Vanishing Point Geometry (Classical)

The vanishing point method is a purely geometric technique:

1. Detect line segments in the image (using classical edge detection: Canny, LSD, or Hough transform; or neural network-based line detection)
2. Group parallel lines (lane markings, road edges)
3. Compute their intersection point (vanishing point) using least-squares fitting
4. The vanishing point position in the image directly encodes camera yaw and pitch:
   - `yaw = arctan((vp_x - cx) / fx)` where vp_x is the vanishing point x-coordinate, cx is the principal point, fx is the focal length
   - `pitch = arctan((vp_y - cy) / fy)` similarly for the y-coordinate

**Limitation:** Vanishing point estimation cannot recover camera roll or translation -- those require additional constraints (horizon detection for roll, multi-camera triangulation for translation).

---

### 2.2 Intrinsic Calibration

Intrinsic parameters describe the camera's internal optical properties:

| Parameter | Description | How Estimated |
|-----------|-------------|---------------|
| Focal length (fx, fy) | Mapping from 3D angle to pixel displacement | Factory calibration using known targets; refined online via vanishing points |
| Principal point (cx, cy) | Image center offset | Factory calibration; assumed stable post-manufacturing |
| Radial distortion (k1, k2, k3, ...) | Barrel/pincushion distortion | Factory calibration using checkerboard targets |
| Tangential distortion (p1, p2) | Decentering distortion from lens misalignment | Factory calibration |

#### Factory Calibration Process

Tesla's factory calibration (per service manual documentation) involves:

1. **Target-based calibration:** The vehicle is positioned in front of a known calibration target (checkerboard or ArUco marker pattern)
2. **Forward camera pitch verification:** A specific procedure verifies the forward-facing camera's pitch angle relative to the vehicle's longitudinal axis (documented in Tesla Service Manual: GUID-3D66A5D0-2B1E-4B3F-AECB-CE9C9A98234E)
3. **Intrinsic parameters are stored:** Focal length, principal point, and distortion coefficients are written to the camera module's non-volatile memory or the vehicle's configuration store

---

### 2.3 Lens Distortion Correction

#### Distortion Models

Tesla's cameras use different lens types across positions, requiring different distortion models:

**Standard/Narrow/Side cameras (moderate FOV: 35--90 deg):**

The **Brown-Conrady model** (also called the polynomial distortion model) is the standard:

```
Radial distortion:
  x_distorted = x_undistorted * (1 + k1*r^2 + k2*r^4 + k3*r^6)
  y_distorted = y_undistorted * (1 + k1*r^2 + k2*r^4 + k3*r^6)

Tangential distortion:
  x_distorted += 2*p1*x*y + p2*(r^2 + 2*x^2)
  y_distorted += p1*(r^2 + 2*y^2) + 2*p2*x*y

where r^2 = x^2 + y^2 (in normalized image coordinates)
```

Parameters: k1, k2, k3 (radial) and p1, p2 (tangential). Typically k1 dominates -- positive k1 = barrel distortion, negative = pincushion.

**Wide-angle/Fisheye cameras (FOV > 120 deg -- wide forward, rear):**

The Brown-Conrady model breaks down for FOVs exceeding ~120 degrees. Tesla's wide forward camera (~150 deg on HW3) and rear camera (~130 deg) likely use the **Kannala-Brandt equidistant fisheye model**:

```
r_distorted = theta + k1*theta^3 + k2*theta^5 + k3*theta^7 + k4*theta^9

where theta = arctan(r_undistorted / f) -- the angle from the optical axis
```

This model is more accurate for extreme wide-angle lenses because it parameterizes distortion in angular space rather than image-plane space.

#### Undistortion in Practice

Lens distortion correction is applied as a **geometric warp** -- a pixel remapping operation:
1. Compute a lookup table (LUT) mapping each output pixel (undistorted) to its source pixel (distorted) in the raw image
2. Apply the LUT using bilinear interpolation to remap the image
3. This LUT is precomputed from the calibrated distortion coefficients and does not change unless calibration is updated

**Where in the pipeline:** Lens distortion correction is part of the rectification transform in the calibration neural network's preprocessing. It is applied before the image enters the backbone network, ensuring that the backbone operates on geometrically corrected images where straight lines in the world map to straight lines in the image.

**ISP bypass consideration:** Even though Tesla bypasses the ISP for neural network processing, lens distortion correction is a geometric operation (not a photometric one) and must still be applied to the raw RCCC data before the neural network can reason about geometry.

---

### 2.4 Ground Plane Estimation

Without lidar, Tesla must estimate the 3D road surface plane from cameras only.

#### Methods:

1. **Vanishing point + known camera height:** The vanishing point constrains the road plane's orientation (pitch and yaw). Combined with the known camera mounting height (from factory calibration), the full 3D road plane can be estimated.

2. **Horizon line detection:** The horizon line in the image directly encodes the camera's pitch and roll relative to the ground plane. If the camera's intrinsic parameters are known, the ground plane normal can be computed from the horizon position.

3. **Multi-frame consistency:** As the vehicle drives, the road surface must be geometrically consistent across frames. Temporal filtering (e.g., Kalman filter on the plane parameters) smooths out noise.

4. **Neural network prediction:** The road surface height head in HydraNet (and its successor in the E2E model) predicts a dense 3D height map of the road surface. This is a learned prediction but relies on classical geometric priors during training (ground-truth road surface from lidar-equipped validation vehicles).

5. **IMU-based pitch/roll:** The IMU directly measures the vehicle's pitch and roll relative to gravity, constraining the road surface orientation when the vehicle is on a flat or known-grade road.

---

## 3. Geometric Methods

### 3.1 Multi-Camera Geometry

Tesla's 8-camera system provides geometric depth information through known camera baselines:

#### Camera Overlap Geometry

| Camera Pair | Approximate Baseline | Overlap Region | Depth Range |
|-------------|---------------------|----------------|-------------|
| Left B-pillar + Right B-pillar | ~1.8 m (vehicle width) | Forward scene, ~30--80 m range | Wide baseline stereo |
| Left B-pillar + Left Repeater/C-pillar | ~1.5 m (longitudinal) | Left side scene | Side-view stereo |
| Right B-pillar + Right Repeater/C-pillar | ~1.5 m (longitudinal) | Right side scene | Side-view stereo |
| Main forward + Left/Right B-pillar | ~1.0--1.5 m (lateral + longitudinal) | Near-field forward overlap | Close-range stereo |
| Wide forward + Side cameras | Large overlap at close range | Near-field surround | Near-field geometry |

#### Epipolar Geometry

For any pair of cameras with known relative pose [R|t], the **epipolar constraint** restricts the search for corresponding points:

```
x2^T * F * x1 = 0

where:
  x1 = point in camera 1 image (homogeneous coordinates)
  x2 = corresponding point in camera 2 image
  F = fundamental matrix (encodes relative camera geometry)
  F = K2^{-T} * [t]_x * R * K1^{-1}  (from camera intrinsics K and relative pose [R|t])
```

This means: for any point seen in camera 1, the corresponding point in camera 2 must lie on a specific line (the epipolar line). This reduces stereo matching from a 2D search to a 1D search along the epipolar line.

**In Tesla's system:** The BEV transformer implicitly learns epipolar geometry through cross-attention between camera features. When a query at a specific 3D location attends to image features, the attention weights naturally concentrate along the epipolar lines in each camera -- the geometric relationship is encoded in the learned attention patterns rather than explicitly computed.

---

### 3.2 Structure from Motion (SfM)

Structure from Motion is the classical technique for recovering 3D scene structure from multiple 2D views taken from different viewpoints. Tesla uses SfM extensively in two contexts:

#### Real-Time SfM (on-vehicle)

As the vehicle drives, each camera captures a sequence of frames from slightly different viewpoints (due to vehicle motion). This provides a continuously changing stereo baseline:

1. **Feature tracking:** Track visual features (corners, edges, distinctive textures) across consecutive frames
2. **Ego-motion estimation:** Using known vehicle motion (from IMU + wheel odometry), compute the camera displacement between frames
3. **Triangulation:** For each tracked feature visible in 2 or more frames, triangulate its 3D position using the known camera poses

**Depth from motion parallax:**
```
depth = baseline * focal_length / disparity

where:
  baseline = distance the vehicle moved between frames (from odometry)
  disparity = pixel displacement of the feature between frames
```

At 36 fps and 60 mph (~27 m/s), the vehicle moves ~0.75 m between frames -- providing a stereo baseline that grows with time. After 5 frames (~140 ms), the baseline is ~3.75 m, comparable to a wide-baseline stereo system.

**Limitations:**
- Only works for static scene elements (buildings, road signs, parked cars)
- Moving objects produce incorrect depth estimates (their own motion contaminates the parallax signal)
- Accuracy degrades for objects far from the camera (small parallax angle)

#### Offline SfM (Auto-Labeling Pipeline -- Multi-Trip Aggregation)

Tesla's auto-labeling pipeline uses offline SfM with dramatically more data:

1. **Multi-trip aggregation:** Multiple Tesla vehicles driving through the same location at different times contribute observations
2. **Bundle adjustment:** A large-scale nonlinear optimization jointly refines:
   - 3D positions of all observed features
   - Camera poses for all frames from all vehicles
   - Camera intrinsic parameters
3. **Fleet averaging:** Each observation from each vehicle is combined to build a progressively refined 3D reconstruction. Degraded observations (blurred frames, rain, fog) are averaged out.
4. **Moving object separation:** Objects that appear in some trips but not others are identified as dynamic and separated from the static reconstruction

**Bundle adjustment formulation:**
```
minimize sum_i sum_j || pi(P_j, X_i) - x_ij ||^2

where:
  X_i = 3D point positions (to be optimized)
  P_j = camera poses (to be optimized)
  x_ij = observed 2D position of point i in camera j
  pi() = camera projection function
```

This is a classical nonlinear least-squares problem, typically solved with Levenberg-Marquardt or Gauss-Newton optimization. Tesla runs this on their GPU compute cluster (not on-vehicle).

**Patent: WO2024073033A1** -- "Automated Data Labeling System" describes the multi-trip aggregation approach for generating 3D ground-truth labels from fleet data.

---

### 3.3 Multi-Camera Triangulation

When the same object is visible in two or more cameras simultaneously, its 3D position can be computed by triangulation:

#### Linear Triangulation (DLT)

Given a point observed at pixel coordinates (u1, v1) in camera 1 and (u2, v2) in camera 2, with known projection matrices P1 and P2:

```
Form the system:
  u1 * P1[3,:] - P1[1,:] = 0
  v1 * P1[3,:] - P1[2,:] = 0
  u2 * P2[3,:] - P2[1,:] = 0
  v2 * P2[3,:] - P2[2,:] = 0

Solve for X (3D point) via SVD of the 4x4 coefficient matrix.
```

This is a purely geometric computation -- no ML involved. The accuracy depends on:
- Calibration accuracy (errors in P1, P2 propagate to errors in X)
- Baseline length (longer baseline = better depth accuracy)
- Pixel localization accuracy (sub-pixel feature matching helps)

**In Tesla's system:** Multi-camera triangulation provides **hard geometric constraints** that complement the neural network's learned depth estimation. Where cameras overlap, triangulated depth can serve as a consistency check on the network's monocular depth predictions.

---

### 3.4 Ego-Motion Estimation

Ego-motion estimation -- determining how the vehicle has moved -- is critical for temporal fusion and is primarily a classical sensor fusion problem.

#### Sensor Sources

| Sensor | What It Provides | Update Rate | Accuracy |
|--------|-----------------|-------------|----------|
| Wheel encoders | Forward velocity, yaw rate (from differential wheel speeds) | ~100 Hz | Good for straight driving; degrades in slip conditions |
| IMU (accelerometer) | Linear acceleration in 3 axes | ~100--1000 Hz | Short-term accurate; long-term drift |
| IMU (gyroscope) | Angular velocity in 3 axes | ~100--1000 Hz | Short-term accurate; drift ~0.1--1 deg/min |
| GPS | Absolute position | ~1--10 Hz | ~1--3 m accuracy (consumer-grade); poor in tunnels/canyons |
| Visual odometry | Relative pose from feature tracking | 36 Hz (camera frame rate) | Good in textured environments; fails in textureless scenes |

#### Sensor Fusion for Ego-Motion

Tesla fuses these sensor inputs using a state estimation filter (likely an Extended Kalman Filter or a factor graph-based approach):

**State vector:**
```
x = [position_x, position_y, position_z,
     velocity_x, velocity_y, velocity_z,
     roll, pitch, yaw,
     gyro_bias_x, gyro_bias_y, gyro_bias_z,
     accel_bias_x, accel_bias_y, accel_bias_z]
```

**Prediction step (IMU mechanization):**
```
position += velocity * dt + 0.5 * acceleration * dt^2
velocity += acceleration * dt
orientation += angular_velocity * dt   (simplified; actual uses quaternion integration)
```

**Update step:** Correct the predicted state using:
- Wheel odometry (constrains forward velocity and yaw rate)
- GPS (constrains absolute position -- when available)
- Visual odometry (constrains relative pose between frames)

This ego-motion estimate is the input that allows temporal fusion to work: features from frame t-1 must be transformed to the coordinate frame at frame t, and the transformation comes from the ego-motion estimate.

---

## 4. State Estimation & Tracking

### 4.1 Kalman Filtering for Object Tracking

Object tracking in a camera-only system is noisy because monocular depth estimates have significant uncertainty. Classical state estimation filters smooth these noisy measurements:

#### Extended Kalman Filter (EKF) for 3D Object Tracking

**State vector per tracked object:**
```
x = [x, y, z,          -- 3D position in world frame
     vx, vy, vz,        -- 3D velocity
     ax, ay, az,         -- 3D acceleration (optional)
     w, l, h,            -- object dimensions (width, length, height)
     theta]              -- heading angle
```

**Prediction (constant velocity or constant acceleration model):**
```
x_predicted = F * x_previous + noise

where F is the state transition matrix:
  position_new = position_old + velocity * dt + 0.5 * acceleration * dt^2
  velocity_new = velocity_old + acceleration * dt
  acceleration_new = acceleration_old  (constant acceleration model)
```

**Update (measurement from neural network detection):**
```
z = [x_det, y_det, z_det, w_det, l_det, h_det, theta_det]  -- from BEV detector

x_updated = x_predicted + K * (z - H * x_predicted)

where K = Kalman gain, H = measurement matrix
```

The Kalman filter provides:
- **Smoothed position/velocity estimates** that are less noisy than raw per-frame detections
- **Prediction during occlusion:** When an object is temporarily not detected (behind another vehicle), the filter continues predicting its position based on last known velocity
- **Velocity estimation:** By fusing position measurements across time, velocity and acceleration are estimated even though cameras cannot measure velocity directly in a single frame

#### Why EKF (Extended) vs. Linear KF?

The measurement model is nonlinear: a 3D object position maps to camera pixel coordinates through the nonlinear camera projection function. The EKF linearizes this mapping at each timestep using the Jacobian of the projection function.

**In Tesla's modular stack (pre-v12):** Object tracking was likely implemented as a classical multi-object tracker with EKF state estimation. In the end-to-end stack (v12+), tracking is implicit -- the temporal module (10-second video buffer + spatial RNN) provides the network with implicit object persistence. However, classical tracking may still exist in the "safety wrapper" layer for AEB and other safety-critical functions.

---

### 4.2 Data Association

Data association -- matching new detections to existing tracks -- is a combinatorial assignment problem.

#### Hungarian Algorithm (Kuhn-Munkres)

The standard approach in multi-object tracking:

1. **Cost matrix construction:** For N existing tracks and M new detections, construct an NxM cost matrix where:
   ```
   cost[i][j] = distance(predicted_position_of_track_i, position_of_detection_j)
   ```
   Distance can be:
   - Euclidean distance in 3D BEV space
   - Mahalanobis distance (accounting for the Kalman filter's uncertainty)
   - IoU (Intersection over Union) of bounding boxes

2. **Optimal assignment:** The Hungarian algorithm finds the assignment that minimizes total cost in O(n^3) time

3. **Gating:** Before running the Hungarian algorithm, reject impossible assignments using a distance gate:
   - If `cost[i][j] > threshold`, set it to infinity (no match possible)
   - This prevents matching a track in the north with a detection in the south

#### IOU-Based Matching

An alternative (used in SORT and DeepSORT):

1. Predict each track's bounding box position in the current frame using the Kalman filter
2. Compute IoU between predicted bounding boxes and detected bounding boxes
3. Apply the Hungarian algorithm on the IoU matrix (maximize IoU = minimize 1-IoU)

---

### 4.3 Track Management

Track lifecycle management is rule-based, not learned:

| Event | Rule |
|-------|------|
| **Track creation** | New detection not matched to any existing track; tentative track created |
| **Track confirmation** | Tentative track matched in N consecutive frames (e.g., 3 out of 5); promoted to confirmed |
| **Track update** | Matched detection updates the Kalman filter state |
| **Track coasting** | No matched detection; Kalman filter predicts forward; coasting counter increments |
| **Track deletion** | Coasting counter exceeds threshold (e.g., 30 frames / ~0.8 seconds); track deleted |
| **Re-identification** | Appearance features (learned embedding from the NN) match a recently deleted track; track re-instantiated |

These are deterministic rules, not neural network outputs. The thresholds (N for confirmation, coasting limit) are engineering parameters tuned through testing.

---

### 4.4 Multi-Camera Object Association

When the same physical object is observed in multiple cameras simultaneously:

1. **3D position consistency:** The object's 3D position, estimated independently from each camera, must agree within tolerance
2. **Temporal consistency:** The object's trajectory must be consistent across camera transitions
3. **Geometric projection:** Given the 3D position estimate from one camera, project it into adjacent cameras and verify that a detection exists at the projected location

In the modular stack, this was an explicit geometric consistency check. In the E2E transformer-based architecture, multi-camera association is implicit -- the BEV transformer attends to all cameras simultaneously, and the unified BEV representation inherently fuses multi-camera observations of the same object.

---

## 5. Temporal & Motion

### 5.1 Kinematics Module

The kinematics module translates raw IMU and wheel encoder data into usable vehicle state estimates. This is a purely classical signal processing and state estimation pipeline.

#### IMU Mechanization Equations

The IMU outputs:
- 3-axis accelerometer: specific force (acceleration - gravity) in the sensor frame
- 3-axis gyroscope: angular velocity in the sensor frame

**Mechanization (dead reckoning from IMU):**

```
1. Attitude update:
   C_b^n(t) = C_b^n(t-1) * (I + [omega_ib^b]_x * dt)
   where C_b^n is the body-to-navigation rotation matrix
   omega_ib^b is the gyroscope measurement (angular velocity)

2. Velocity update:
   v^n(t) = v^n(t-1) + (C_b^n * f^b - g^n) * dt
   where f^b is the accelerometer measurement (specific force)
   g^n is gravity in the navigation frame

3. Position update:
   p^n(t) = p^n(t-1) + v^n(t) * dt
```

These are the strapdown inertial navigation equations -- entirely classical mechanics, predating neural networks by decades.

#### Wheel Odometry Integration

Wheel encoders provide:
- Wheel rotation counts -> vehicle forward displacement
- Differential wheel speeds (left vs. right) -> yaw rate

```
distance = (wheel_circumference * encoder_counts) / counts_per_revolution
yaw_rate = (v_right - v_left) / track_width
```

This is fused with IMU data in the ego-motion Kalman filter (Section 3.4).

---

### 5.2 Feature Queue Mechanics

The feature queue is Tesla's temporal memory mechanism, first detailed at AI Day 2021. Its push rules are **purely geometric/rule-based triggers**, not learned:

#### Time-Based Queue

| Parameter | Value |
|-----------|-------|
| Push interval | Every ~27 ms (matching the ~36 Hz camera frame rate) |
| Purpose | Handle temporal occlusion -- remember recently seen objects |
| What is stored | Multi-camera fused features + kinematics + positional encodings |
| Typical depth | Multiple recent frames (exact count undisclosed) |

**When an object disappears behind a truck for 0.5 seconds:**
- The time-based queue retains the features from ~18 frames ago when the object was last visible
- The spatial RNN can "remember" the object's existence and predict its likely current position

#### Space-Based Queue

| Parameter | Value |
|-----------|-------|
| Push interval | Every 1 meter of vehicle travel (computed from odometry) |
| Purpose | Road geometry prediction -- extrapolate road structure ahead |
| What is stored | Multi-camera fused features + kinematics + positional encodings |
| Typical depth | 50+ meters of road history |

**How it enables road prediction:**
- Lane markings observed 50 m behind the vehicle are stored in the space-based queue
- The spatial RNN uses this geometric memory to predict lane curvature, road width, and road edges ahead of the visible extent
- This is analogous to how a human driver uses their memory of the road behind them to anticipate what's ahead around a curve

#### Push Rule Implementation

The push decision is a simple comparison -- no neural network involved:

```python
# Time-based push
if current_time - last_time_push >= 27ms:
    push_to_time_queue(current_features, kinematics, position)
    last_time_push = current_time

# Space-based push
distance_since_last = compute_distance(current_position, last_space_push_position)
if distance_since_last >= 1.0:  # meters
    push_to_space_queue(current_features, kinematics, position)
    last_space_push_position = current_position
```

The `compute_distance` function uses odometry-derived position -- a classical computation.

---

### 5.3 Ego-Motion Compensation for Feature Warping

When fusing features across time, features from previous frames must be transformed to the current vehicle coordinate frame. This is a classical geometric operation:

#### The Warping Operation

```
Given:
  F_{t-1} = feature map from frame t-1, in coordinate frame at time t-1
  T_{t-1}^{t} = rigid body transform from frame t-1 to frame t
               (estimated from IMU + odometry ego-motion)

Warped features:
  F_{t-1->t} = Warp(F_{t-1}, T_{t-1}^{t})
```

For BEV features (2D top-down grid):
- The transform T is a 2D rotation + translation (ignoring vertical motion)
- Each cell in the t-1 BEV grid maps to a cell in the current BEV grid via the rotation + translation
- Bilinear interpolation handles sub-grid-cell offsets

For 3D voxel features (occupancy network):
- The transform is a full 3D rigid body transform (rotation + translation)
- Each voxel at (x, y, z) in the t-1 frame maps to (x', y', z') = R*(x,y,z) + t in the current frame

This warping ensures that the spatial RNN's hidden state remains registered in world coordinates as the vehicle moves. Without it, temporal fusion would be meaningless -- features from 1 second ago would be displaced by ~27 meters at highway speed.

---

## 6. Classical Depth Estimation

### 6.1 Multi-Frame Triangulation

The classical parallax-based depth estimation from video:

**Principle:** As the vehicle moves, a stationary scene point appears to shift in the image (parallax). The amount of shift is inversely proportional to the point's depth:

```
depth = (baseline * focal_length) / parallax

where:
  baseline = distance the vehicle has moved between observations (from odometry)
  focal_length = camera focal length in pixels
  parallax = pixel displacement of the scene point between frames
```

**Example calculation:**
- Vehicle speed: 60 mph = 27 m/s
- Time between frames: 27.8 ms (at 36 fps)
- Per-frame baseline: 27 * 0.0278 = 0.75 m
- Focal length: ~1000 pixels (typical for Tesla main forward camera)
- For an object at 50 m depth: parallax = (0.75 * 1000) / 50 = 15 pixels per frame
- For an object at 200 m depth: parallax = (0.75 * 1000) / 200 = 3.75 pixels per frame

At 200 m, the parallax is less than 4 pixels -- requiring sub-pixel feature tracking for accurate depth estimation at long range.

**Multi-frame accumulation:** Over 5 frames (~140 ms), the baseline grows to 3.75 m, increasing parallax proportionally and improving depth accuracy.

---

### 6.2 Multi-Camera Stereo

Classical stereo matching between Tesla's camera pairs:

**Stereo matching pipeline (when applied):**

1. **Rectification:** Warp both images so that epipolar lines are horizontal (using known camera geometry from calibration)
2. **Feature matching:** For each pixel in the left image, search along the corresponding horizontal scanline in the right image for the best match
   - Matching cost: Sum of Absolute Differences (SAD), Normalized Cross-Correlation (NCC), or Census transform
3. **Disparity computation:** The horizontal pixel displacement between matched points = disparity
4. **Depth from disparity:** `depth = baseline * focal_length / disparity`
5. **Sub-pixel refinement:** Parabolic interpolation around the cost minimum for sub-pixel disparity accuracy
6. **Post-processing:** Left-right consistency check, median filtering, disparity smoothing

**In Tesla's system:** Classical stereo matching is likely not used as a standalone module. Instead, the neural network learns to exploit multi-camera geometry implicitly through the BEV transformer's cross-attention mechanism. However, the geometric principles are the same -- the network must learn the relationship between disparity and depth.

---

### 6.3 Geometric Priors and Known Object Sizes

Classical depth estimation exploits known geometric relationships:

| Prior | How It Constrains Depth |
|-------|------------------------|
| Known object heights | A pedestrian is ~1.7 m tall; if they occupy 100 pixels in the image, depth = (1.7 * focal_length) / 100_pixels |
| Known object widths | A stop sign is 0.75 m wide; measured pixel width constrains distance |
| Road plane geometry | The road surface is approximately flat; pixels on the road surface at different heights in the image correspond to different distances via the perspective projection |
| Vanishing point | All parallel lines on the road converge to the vanishing point; the rate of convergence encodes distance |
| Texture gradient | Road texture becomes finer (higher spatial frequency) with distance |
| Atmospheric perspective | Distant objects appear hazier and lower contrast |
| Shadow geometry | Shadow angles constrain sun position and object height |

These priors are "built into" the neural network through training data -- the network learns these geometric relationships rather than having them hard-coded. But they are fundamentally classical geometric principles.

---

## 7. Rule-Based & Hybrid Systems

### 7.1 Driver Monitoring System

#### Architecture

Tesla's driver monitoring system uses the cabin-facing camera (above the rearview mirror) with IR illumination:

**Hardware:**
- Standard visible-light + near-infrared camera sensor
- IR LED array integrated above the rearview mirror (hidden behind plastic cover)
- IR LEDs illuminate the driver's face in darkness without visible light

**Classical CV components (pre-ML and alongside ML):**
- **Face detection:** Localize the driver's face in the cabin camera image
- **Facial landmark detection:** Identify eyes, nose, mouth, chin
- **Eye state classification:** Open/closed/partially closed (classical thresholding on eye aspect ratio, or neural network-based)
- **Gaze direction estimation:** Determine where the driver is looking

**Hybrid ML/classical approach:**
- Face detection and landmark localization: Neural network (likely a lightweight MobileNet or similar)
- Eye tracking: The IR LEDs illuminate the face; the camera detects the IR reflection from the eyes (classical IR reflection detection). However, Tesla's camera is NOT a dedicated eye tracker -- it is off-axis to the driver's eyes and has a wide FOV viewing the entire cabin, so pupil tracking accuracy is limited compared to dedicated eye-tracking systems (like those used by GM SuperCruise or BMW)
- Drowsiness detection: Tracks yawn frequency, blink rate, blink duration, head nodding -- a mix of neural network-based facial analysis and classical temporal pattern recognition (e.g., PERCLOS metric: percentage of time eyes are 80%+ closed over a time window)

**FSD v12.4 upgrade:** Shifted from primarily steering-wheel torque monitoring to primarily vision-based attention monitoring using the cabin camera. The system can now replace steering-wheel "nag" prompts with camera-based attentiveness checks, but only when the camera has "clear and continuous visibility of the driver's eyes" -- fails with sunglasses, low hat brims, or camera occlusion.

---

### 7.2 Ultrasonic Sensor Processing (Pre-Removal)

Tesla included 12 ultrasonic sensors (USS) on all vehicles until October 2022 (Model 3/Y) and early 2023 (Model S/X). The signal processing was entirely classical:

#### Operating Principles

| Parameter | Specification |
|-----------|--------------|
| Frequency | ~40 kHz (above human hearing) |
| Number of sensors | 12 (6 front bumper, 6 rear bumper) |
| Max range | ~5--8 m |
| Primary function | Parking assistance, near-field obstacle detection |

#### Signal Processing Pipeline

```
1. Transmit: Piezoelectric transducer emits 40 kHz ultrasonic pulse
2. Wait: Sensor enters receive mode
3. Receive: Same or adjacent transducer captures echo reflections
4. Time-of-Flight: distance = (speed_of_sound * round_trip_time) / 2
   where speed_of_sound ≈ 343 m/s at 20°C
5. Echo Processing:
   - Amplitude thresholding: reject weak echoes (below noise floor)
   - Multi-echo handling: multiple objects at different distances produce multiple echoes
   - Ring-down filtering: ignore echoes during the transducer's ring-down period after transmission
6. Environmental Compensation:
   - Temperature affects speed of sound: v = 331.3 + 0.606 * T(°C) m/s
   - Humidity and air pressure have smaller effects
7. Spatial Filtering:
   - Cross-talk rejection between adjacent sensors
   - Ghost echo suppression (echoes from vehicle body structure)
8. Output: Distance measurement per sensor, typically updated at ~10--40 Hz
```

#### Why Tesla Removed USS

- USS was used primarily for parking and low-speed maneuvering
- The occupancy network (neural network) can estimate near-field obstacles from cameras
- Removing 12 sensors per vehicle reduces manufacturing cost (~$5--10 per sensor = $60--120 per vehicle at scale)
- Reduces sensor wiring and failure modes
- Initially, USS removal caused feature regression (loss of Autopark and some Summon capabilities); these were gradually restored via vision-only software updates

---

### 7.3 Radar Signal Processing (Pre-Removal)

Tesla used a forward-facing radar (Continental ARS4xx family) on all vehicles until May 2021 (Model 3/Y) and early 2022 (Model S/X). The radar's signal processing chain was entirely classical:

#### Automotive FMCW Radar Pipeline

Tesla's radar was a **Frequency-Modulated Continuous-Wave (FMCW)** radar operating at 76--77 GHz:

```
1. WAVEFORM GENERATION
   - Transmit a linear frequency chirp (frequency ramp from f_start to f_start + B over time T_chirp)
   - Bandwidth B ≈ 1 GHz -> range resolution = c / (2*B) ≈ 0.15 m
   - Chirp repetition rate: ~1000 chirps per frame

2. RECEIVE & MIXING
   - Received echo is mixed with the transmitted signal
   - The beat frequency f_beat = 2*R*B / (c*T_chirp) encodes target range R
   - Result: Intermediate Frequency (IF) signal per receive channel

3. RANGE FFT (Fast Fourier Transform)
   - Apply FFT to each chirp's IF samples
   - Output: range profile (amplitude vs. range bins)
   - Classical signal processing -- FFT is the workhorse of radar

4. DOPPLER FFT
   - Apply FFT across chirps at each range bin
   - Output: range-Doppler map (amplitude vs. range vs. velocity)
   - Velocity resolution: delta_v = lambda / (2 * N_chirps * T_chirp)

5. CFAR DETECTION (Constant False Alarm Rate)
   - Slide a detection window across the range-Doppler map
   - For each cell under test (CUT):
     - Estimate the noise floor from surrounding reference cells
     - If CUT amplitude > noise_floor * threshold_factor, declare a detection
   - CFAR maintains a constant false alarm probability regardless of background clutter level
   - Classical adaptive thresholding -- no ML

6. ANGLE ESTIMATION (DOA -- Direction of Arrival)
   - For each detected peak, use the phase difference across receive antennas
   - Methods: beamforming, MUSIC, ESPRIT, or monopulse
   - Estimates azimuth (and sometimes elevation) of each target

7. GHOST TARGET FILTERING
   - Multipath reflections (signal bounces off road surface then off target) create ghost targets
   - Classical filtering:
     - Ghost targets appear at incorrect range/angle combinations
     - Physical consistency checks: target must be on or near the road plane
     - Temporal consistency: ghost targets tend to flicker while real targets persist
     - Known multipath patterns (undertruck reflections, guardrail reflections) are suppressed

8. TARGET LIST OUTPUT
   - Each detection: (range, range_rate/velocity, azimuth, SNR, RCS)
   - Updated at ~20 Hz (radar frame rate)
```

#### Why Tesla Removed Radar

Elon Musk's stated reason was **sensor contention**: when radar and cameras disagreed about whether an object was present, the system had to choose which to believe. Specific failure modes:

1. **Radar ghost targets from overpasses:** Radar would detect an overhead bridge as a stationary object in the driving path, triggering phantom braking. Cameras correctly identified it as an overpass. The fusion logic had to arbitrate.

2. **Radar multipath under trucks:** Radar signals bouncing under semi-trailers created confusing returns. The Joshua Brown fatal accident (May 2016) involved a failure to detect a truck trailer, partly due to radar cross-section issues.

3. **Radar clutter in heavy traffic:** Dense traffic produces complex multi-bounce radar returns that are difficult to filter.

4. **Vision superior for classification:** Radar knows "something is at 50 m moving at 60 mph" but cannot tell if it's a car, pedestrian, or road debris. Cameras provide rich classification.

**Internal dissent:** Tesla engineers reportedly argued against removing radar, citing its value for velocity measurement (Doppler gives direct radial velocity) and performance in fog/snow where cameras degrade. Musk overruled these objections.

**HD radar in HW4 (never activated):** Some HW4 Model S/X vehicles shipped with a Continental ARS540 high-definition radar (4D: range, Doppler, azimuth, elevation). Tesla has never activated this radar for FSD, confirming their commitment to vision-only.

---

### 7.4 Rule-Based Safety Checks

Even in the "end-to-end" era (v12+), Tesla's system is not 100% neural network. There remain safety-critical, non-ML components:

#### Automatic Emergency Braking (AEB)

AEB is a **separate safety system** from FSD -- it operates as a background monitor that can override the neural network's (or the human driver's) commands:

| Feature | Specification |
|---------|--------------|
| Active speed range | 3--124 mph (expanded from original 3--90 mph) |
| Operates independently of FSD | Yes -- works even when Autopilot/FSD is off |
| Cannot be fully disabled | AEB is always on (regulatory requirement) |
| Detection method | Vision-based (post-radar-removal) |
| Operates in reverse | Yes (added via OTA update) |

**AEB decision logic (simplified):**

```
1. Detect obstacles in the vehicle's path (from perception outputs)
2. Compute Time-to-Collision (TTC):
   TTC = distance_to_obstacle / closing_speed
3. If TTC < threshold (typically 0.5--1.5 seconds):
   - Issue Forward Collision Warning (visual + audible alert)
4. If TTC < critical_threshold AND driver has not responded:
   - Apply maximum braking force automatically
5. Safety limits:
   - Maximum deceleration capped (comfort and stability)
   - Lateral control maintained (AEB does not steer, only brakes)
```

**Important distinction:** While the perception inputs to AEB are now neural network-based (object detection, depth estimation), the **decision logic** for when to brake is rule-based:
- Deterministic TTC computation
- Hard-coded thresholds for warning and braking
- No learned policy -- the thresholds are engineering constants validated through testing

#### Other Rule-Based Safety Constraints

| Constraint | Type | Description |
|-----------|------|-------------|
| Speed limiter | Hard-coded | Maximum FSD operating speed (typically speed_limit + 5--10 mph offset; highway max ~85 mph) |
| Following distance | Rule-based | Minimum following distance based on speed (user-adjustable 1--7 setting) |
| Steering rate limiter | Hard-coded | Maximum steering wheel angular velocity (prevents jerky steering) |
| Acceleration limiter | Hard-coded | Maximum longitudinal and lateral acceleration (comfort and stability) |
| Geofence restrictions | Rule-based | FSD disabled in certain areas (school zones may have reduced speed; known construction zones flagged) |
| Disengagement rules | Rule-based | If driver attention monitoring detects inattention for >N seconds, issue escalating warnings, then disable FSD |
| Obstacle-Aware Acceleration | Rule-based | If object detected in path while driver presses accelerator, limit acceleration |

#### Safety Monitor / Safety Wrapper

Tesla has acknowledged (implicitly, through release notes mentioning "some legacy code still exists for safety-critical functions") that a **safety monitor** layer wraps the E2E neural network output:

```
Neural Network Output: (steering, acceleration, braking)
  |
  v
Safety Monitor:
  1. Check: Is steering rate within limits? If not, clamp.
  2. Check: Is acceleration within limits? If not, clamp.
  3. Check: Is AEB triggered? If yes, override with emergency braking.
  4. Check: Is vehicle on a valid road surface? If uncertain, warn driver.
  5. Check: Is driver attentive? If not, begin disengagement sequence.
  |
  v
Vehicle Actuators: (steering motor, throttle, brake)
```

This safety monitor is deterministic C++ code, not a neural network. It provides a hard safety floor that the E2E model cannot override, regardless of what the neural network computes.

In FSD v13, a **Safety Shield** system was introduced that monitors neural "confidence scores" in real-time. If the confidence score drops below ~85%, the system proactively asks the driver to take over with a 5-second lead time. This is a threshold-based rule, not a neural network decision.

---

### 7.5 Post-Processing on ML Outputs

Several post-processing steps applied to neural network outputs are classical algorithms:

#### Non-Maximum Suppression (NMS)

Object detection heads produce multiple overlapping bounding boxes for the same object. NMS eliminates duplicates:

```
Algorithm:
1. Sort all detections by confidence score (descending)
2. Select the highest-confidence detection D_best
3. For all remaining detections D_i:
   - Compute IoU(D_best, D_i)
   - If IoU > NMS_threshold (typically 0.45--0.5): suppress D_i (it's a duplicate)
4. Add D_best to the output list
5. Repeat from step 2 with remaining unsuppressed detections
```

NMS is a greedy, non-learned algorithm. The threshold is a fixed engineering parameter.

**Soft-NMS variant:** Instead of hard suppression, reduce the confidence of overlapping detections proportional to their IoU. This allows detection of partially overlapping objects (e.g., two pedestrians standing close together).

#### Confidence Thresholding

Before NMS, detections with confidence below a threshold are discarded:
```
filtered_detections = [d for d in raw_detections if d.confidence >= threshold]
```
Typical threshold: 0.25--0.5, depending on the object class and desired precision/recall tradeoff.

#### Geometric Consistency Checks

Post-processing verifies that neural network outputs are physically plausible:

| Check | Description | Action if Failed |
|-------|-------------|------------------|
| Object size consistency | A detected "car" with dimensions 0.5m x 0.3m is implausible | Suppress detection |
| Ground plane consistency | An object floating 3m above the road is likely a false positive | Suppress or flag |
| Multi-camera consistency | Same object detected in two cameras must agree on 3D position | Re-estimate position or suppress inconsistent detection |
| Temporal consistency | An object that appears for 1 frame and vanishes is likely noise | Require N-frame confirmation (track management) |
| Velocity plausibility | A "stationary" object with 60 mph velocity estimate is inconsistent | Re-estimate or clamp velocity |

These are rule-based sanity checks applied to ML outputs, preventing the neural network from producing physically impossible results.

---

## 8. NPU & Hardware Interface

### 8.1 Quantization

The neural network is trained in floating point (FP32/BF16) on NVIDIA GPUs in Tesla's data center but deployed in **INT8** on the FSD chip's NPU. This conversion is a critical classical optimization step.

#### Quantization-Aware Training (QAT)

Tesla uses QAT, not post-training quantization:

```
During training (on GPU, in FP32):
  1. Forward pass:
     - Weights and activations pass through "fake quantization" nodes
     - These nodes simulate INT8 quantization:
       x_quantized = round(clamp(x / scale, -128, 127)) * scale
     - The network "experiences" the precision loss during training
  2. Backward pass:
     - Gradients flow through the fake quantization nodes using the Straight-Through Estimator (STE)
     - The network learns to be robust to INT8 rounding errors
  3. Result:
     - A model that maintains near-FP32 accuracy when actually deployed in INT8
```

**Calibration dataset:** A representative subset of training/validation data is used to determine the quantization scale factors (the mapping from FP32 range to INT8 range) for each layer. The scale factors are chosen to minimize quantization error across this calibration set.

**Per-layer vs. per-channel quantization:**
- Per-layer: One scale factor per layer (coarser, less accurate)
- Per-channel: One scale factor per output channel (finer, more accurate, standard practice)

| Aspect | Training | Deployment |
|--------|----------|-----------|
| Weight precision | FP32 or BF16 | INT8 (8-bit integer) |
| Activation precision | FP32 or BF16 | INT8 (8-bit integer) |
| Accumulation precision | FP32 | INT32 (32-bit integer) |
| Quantization method | QAT with fake quantization nodes | Direct INT8 inference |
| Scale factors | Learned during training | Fixed at deployment |

---

### 8.2 Memory Management -- SRAM Tiling on the FSD Chip NPU

The FSD chip NPU's design philosophy: **once data enters SRAM, all computation happens in SRAM with zero DRAM interaction until the final output.** This requires sophisticated memory management.

#### NPU SRAM Architecture

| Parameter | Specification |
|-----------|--------------|
| SRAM capacity per NPU | 32 MiB |
| Banking | Highly banked, single port per bank |
| Read bandwidth | 384 bytes/cycle (256B data + 128B weights) |
| Peak read bandwidth | 786 GB/s per NPU (at 2 GHz) |
| Write-back bandwidth | 128 bytes/cycle |
| SRAM utilization | Typically >= 80%, often much higher |

#### How Large Tensors are Split (Tiling)

Neural network layers produce tensors that may exceed the 32 MiB SRAM capacity. The **Tesla custom compiler** (not TensorRT) handles this through tiling:

**Spatial tiling:**
```
For a convolutional layer with input tensor [H, W, C_in] and output tensor [H, W, C_out]:
  1. Divide the spatial dimensions (H, W) into tiles that fit in SRAM
  2. Process each tile independently:
     - Load the tile's input activations into SRAM (with halo/overlap for convolution receptive field)
     - Load the weights (shared across all tiles)
     - Compute the convolution
     - Write the output tile back to SRAM (or DRAM if needed)
  3. Tile edges: convolutions with kernel size > 1x1 require "halo" pixels from adjacent tiles
     - The compiler manages halo loading to avoid redundant computation
```

**Channel tiling:**
```
For layers with many channels (e.g., 512 or 1024):
  1. Divide C_out into groups of 96 (matching the MAC array width)
  2. Process each group of 96 output channels in parallel on the 96-column MAC array
  3. Accumulate partial sums across input channel groups
```

#### DMA Scheduling

The NPU uses **DMA (Direct Memory Access)** operations for data movement between DRAM and SRAM:

1. **Two DMA instructions** in the ISA: DMA read (DRAM -> SRAM) and DMA write (SRAM -> DRAM)
2. **Double buffering:** While the MAC array processes tile N from SRAM, the DMA prefetches tile N+1 from DRAM into a separate SRAM buffer. This overlaps computation with memory transfer.
3. **Compiler-scheduled prefetch:** The Tesla compiler inserts DMA prefetch operations ahead of when data is needed, based on the compute schedule. The compiler has full visibility into the compute graph and can plan DMA operations to minimize pipeline stalls.
4. **Bank conflict avoidance:** The compiler allocates SRAM banks and inserts channel padding to reduce bank conflicts. Bank conflict hints from the compiler guide the hardware bank arbitrator.

#### MAC Array Processing Flow

```
Data path through the NPU:

DRAM
  |-- DMA read -->
SRAM (32 MiB, highly banked)
  |-- 256 B/cycle (activations) -->  +  |-- 128 B/cycle (weights) -->
MAC Array (96 x 96 = 9,216 MACs)
  - 8-bit x 8-bit multiply, 32-bit accumulate
  - Each cycle: bottom row of activations broadcast across all rows
                rightmost column of weights broadcast across all columns
  - After dot product: data shifts down one row, weights shift right
  - Full dot product completes, then advances by 96 elements
  |
  v
SIMD Unit
  - Programmable: sigmoid, tanh, argmax, general instructions
  - Pipelined quantization unit: normalization, scaling, saturation
  - Converts 32-bit accumulator outputs back to 8-bit for next layer
  |
  v
Pooling Unit
  - 2x2 or 3x3 max/average pooling
  - Average pooling uses fixed-point multiply (not division)
  |
  v
Write-Combine Buffer
  - 128 B/cycle write-back to SRAM
  - Channel re-alignment (undo interleaving used for MAC efficiency)
  |
  v
SRAM (output buffer)
  |-- DMA write (if needed) -->
DRAM
```

#### Layer Fusion

The Tesla compiler fuses consecutive operations to maximize data reuse in SRAM:

```
Unfused (naive):
  Conv -> write to SRAM -> read from SRAM -> BatchNorm -> write to SRAM ->
  read from SRAM -> ReLU -> write to SRAM -> read from SRAM -> Pool

Fused:
  Conv -> BatchNorm -> ReLU -> Pool  (all in one pass through the MAC+SIMD+Pool pipeline)
  Only one SRAM read (input) and one SRAM write (final output)
```

This reduces SRAM bandwidth by 4x for a typical conv-BN-ReLU-pool block and is critical for meeting the ~28 ms per-frame latency budget.

#### NPU Instruction Set Architecture

The NPU executes only 8 instructions:

| Instruction | Function |
|-------------|----------|
| DMA Read | Load data from DRAM to SRAM |
| DMA Write | Store data from SRAM to DRAM |
| Dot Product (variant 1) | Standard matrix multiply-accumulate |
| Dot Product (variant 2) | Depthwise convolution variant |
| Dot Product (variant 3) | Pointwise/1x1 convolution variant |
| Scale | Multiply activations by a scale factor (for quantization/normalization) |
| Element-wise Add | Add two tensors element-wise (for residual connections) |

Instructions are variable-width (32--256 bytes) and contain:
- Up to 4 instruction slots
- A parameters slot (modifying operation variations)
- A flags slot (handling data dependencies between instructions)
- An extensions slot (SIMD micro-program sequences for post-MAC processing)

---

## 9. Patent Index

### Perception-Related Tesla Patents

| Patent Number | Title | Key Non-ML/Hybrid-ML Content |
|--------------|-------|------------------------------|
| **US20240185445A1** | AI Modeling Techniques for Vision-Based Occupancy Determination | Voxel grid generation (33 cm default, 10 cm refined); SDF-based geometry; trilinear interpolation for sub-voxel accuracy; temporal fusion across timestamps; queryable 3D data structure |
| **US20230057509A1** | Vision-Based ML Model for Autonomous Driving with Adjustable Virtual Camera | Rectification via affine transforms; lookup tables for pixel-to-virtual-camera mapping; extrinsic/intrinsic camera parameter estimation; depth assumptions (5--50 m for VRUs, 3--52 m for vehicles); two-depth-point ray casting |
| **US11215999B2 / WO2019245618** | Data Pipeline and Deep Learning System for Autonomous Driving | Sensor data decomposition into component images; multi-layer injection (different components at different NN layers); preserves sensor data fidelity vs. ISP compression |
| **WO2019079311A1** | Rolling Shutter Correction for Images Captured by Camera on Moving Vehicle | Per-scanline motion compensation; delay_ratio = y/H computation; 3D point translation by estimated vehicle displacement; consistency between lidar and rolling shutter camera data |
| **US20210271259A1** | System and Method for Obtaining Training Data (Karpathy, sole inventor) | Trigger classifiers on intermediate NN results; deploy/update triggers without updating vehicle software; classifier score thresholding for data upload decision; fleet-sourced training data pipeline |
| **US10956755B2** | Estimating Object Properties Using Visual Image Data | Monocular depth from trained ML model; training uses auxiliary sensor (radar/lidar) ground truth; eliminates need for dedicated distance sensor post-training |
| **WO2024073033A1** | Automated Data Labeling System | Multi-trip 3D aggregation; fleet averaging; structure-from-motion-based 3D reconstruction for auto-labeling |
| **WO2025193615** | AI Modeling for Vision-Based High-Fidelity Occupancy and Assisted Parking | Extended occupancy for parking; sub-voxel precision; camera-only near-field detection |

### Additional Related Patents (Not Tesla-Owned but Relevant to Techniques Used)

| Patent | Relevance |
|--------|-----------|
| **US9277132B2** | Image distortion correction of camera with rolling shutter (general technique) |
| **US8810692B2** | Rolling shutter distortion correction (general technique) |

---

## 10. Sources & References

### Tesla Presentations (Primary Sources)

| Event | Date | Key Presenters | Key Non-ML Content Disclosed |
|-------|------|----------------|------------------------------|
| Autonomy Day | April 2019 | Musk, Bannon, Bowers | FSD chip NPU architecture (96x96 MAC, 32 MiB SRAM, 8-instruction ISA); ISP specifications (1B pixel/sec, 24-bit pipeline) |
| AI Day 2021 | August 2021 | Karpathy et al. | HydraNet architecture; feature queue push rules (27 ms time, 1 m space); spatial RNN with 2D lattice; calibration NN for virtual camera; RegNet + BiFPN backbone; 48 networks / 1,000 output tensors |
| CVPR 2021 Workshop | June 2021 | Karpathy | Vision-only vs. fusion comparison; 221 triggers; auto-labeling with 4D vector space; shadow mode architecture; fleet data pipeline (80 nodes x 8 A100 = 5,760 GPUs) |
| AI Day 2022 | September 2022 | Tesla AI team | Occupancy networks; SDF geometry; occupancy flow; >100 FPS occupancy inference; MCTS + NN planner |
| CVPR 2022 Workshop | June 2022 | Karpathy | Multi-trip aggregation; fleet averaging; 3D reconstruction |
| CVPR 2023 Workshop | 2023 | Elluswamy | Occupancy network architecture details; post-Karpathy direction |
| ICCV 2024 | October 2024 | Elluswamy | E2E architecture confirmation; "billions of input tokens"; auxiliary output probing; Gaussian splatting; natural language querying |

### Technical Analyses

| Source | Topic |
|--------|-------|
| WikiChip Fuse -- "Inside Tesla's Neural Processor in the FSD Chip" | NPU MAC array (96x96); 8-instruction ISA; SRAM architecture (32 MiB, highly banked); DMA scheduling; layer fusion; SIMD/pooling units; write-combine buffer; 786 GB/s peak SRAM bandwidth; 36.86 TOPS per NPU; 4.9 TOPS/W efficiency |
| LUCID Vision Labs -- IMX490 Tech Brief | Sub-pixel HDR architecture; 4 simultaneous exposures; 120 dB dynamic range; LED flicker mitigation mechanism; CDS and DRS noise reduction; 120,000 e- saturation capacity |
| ON Semiconductor -- AR0136AT Datasheet | 1.2 MP; 3.75 um BSI pixels; RCCC CFA; 120 dB HDR; rolling shutter; 12-bit output |
| TechInsights -- Tesla Camera Teardown (PKG-2103-804) | Physical camera module analysis; RCCC confirmation |
| ThinkAutonomous -- Tesla HydraNet / Occupancy Networks articles | Architecture pipeline breakdowns; NeRF validation; fleet averaging |

### Academic Papers Inspired by Tesla's Approach

| Paper | Conference | Relevance |
|-------|-----------|-----------|
| BEVFormer (Li et al., 2022) | ECCV 2022 | Formalized Tesla's BEV transformer approach academically |
| TPVFormer (Zheng et al., 2023) | CVPR 2023 | "Academic alternative to Tesla's occupancy network" |
| Occupancy Networks (Mescheder et al., 2019) | CVPR 2019 | Original occupancy network concept (different from Tesla's use) |

---

## Appendix A: Summary -- Classical vs. ML Components

| Component | Classical / Rule-Based | Neural Network | Hybrid |
|-----------|----------------------|----------------|--------|
| ISP bypass (raw data to NN) | | | X -- classical sensor output format, NN consumption |
| RCCC demosaicing | | X -- NN learns implicit demosaicing | |
| HDR processing (IMX490) | X -- on-sensor sub-pixel combination | | |
| LED flicker mitigation | X -- hardware sub-pixel exposure averaging | | |
| Rolling shutter correction | X -- per-scanline geometric warp | | X -- NN may learn implicit correction |
| Auto-exposure control | X -- classical feedback loop | | |
| Lens distortion correction | X -- Brown-Conrady / Kannala-Brandt model + LUT warp | | |
| Online extrinsic calibration | | | X -- NN estimates parameters; geometric warp applied |
| Intrinsic calibration | X -- factory target-based calibration | | |
| Vanishing point estimation | X -- line detection + intersection | | X -- can be NN-assisted |
| Ground plane estimation | | | X -- NN prediction with geometric priors |
| Multi-camera triangulation | X -- classical epipolar geometry | | |
| Structure from motion (offline) | X -- bundle adjustment, SLAM | | |
| Ego-motion estimation | X -- IMU mechanization + KF fusion | | |
| Feature queue push rules | X -- time/distance thresholds | | |
| Ego-motion compensation | X -- rigid body transform warp | | |
| Object tracking (EKF) | X -- Kalman filter state estimation | | |
| Data association (Hungarian) | X -- combinatorial assignment | | |
| Track management | X -- rule-based lifecycle | | |
| Multi-camera association | X -- geometric consistency | | |
| NMS (non-maximum suppression) | X -- greedy IoU-based suppression | | |
| Confidence thresholding | X -- hard threshold | | |
| Geometric consistency checks | X -- plausibility rules | | |
| AEB decision logic | X -- TTC computation + thresholds | | |
| Speed/acceleration limiting | X -- hard-coded limits | | |
| Safety monitor wrapper | X -- deterministic C++ checks | | |
| Driver monitoring | | | X -- NN face detection + classical eye state analysis |
| USS processing (removed) | X -- time-of-flight echo processing | | |
| Radar processing (removed) | X -- FFT, CFAR, Doppler, ghost filtering | | |
| INT8 quantization | X -- QAT calibration + scale factor computation | | |
| SRAM tiling / DMA scheduling | X -- compiler-level memory management | | |
| Layer fusion | X -- compiler optimization | | |

---

## Appendix B: The "End-to-End" Myth

Tesla's FSD v12+ is described as "end-to-end," but this document demonstrates that the system is more accurately described as **"neural network core with classical scaffolding"**:

1. **Before the neural network:** Classical ISP (for display), AE control, lens distortion correction, geometric rectification, rolling shutter timing encoding
2. **Around the neural network:** Feature queue push rules (geometric triggers), ego-motion compensation (rigid body transforms), kinematics integration (IMU mechanization)
3. **After the neural network:** NMS, confidence thresholding, geometric consistency checks, AEB decision logic, safety monitor wrapper, speed/acceleration limiting
4. **Beneath the neural network:** INT8 quantization, SRAM tiling, DMA scheduling, layer fusion, MAC array data flow -- all handled by a custom compiler, not learned

The true innovation is not the elimination of classical techniques but the dramatic reduction of **hand-coded driving rules** (from ~300,000 lines of C++ to ~2,000--3,000 lines of glue code). The classical components that remain are either:
- **Hardware-mandated** (sensor physics, ISP for display, actuator limits)
- **Safety-mandated** (AEB, speed limits, driver monitoring)
- **Mathematically necessary** (geometric transforms, quantization, memory management)

The neural network handles the hard part -- perception, prediction, and decision-making -- while classical components handle the parts that are either safety-critical and must be deterministic, or are well-solved by classical methods and do not benefit from learning.

---

*This document was compiled from extensive web research including Tesla AI Day 2021/2022 presentations, Karpathy's CVPR 2021/2022 talks, Elluswamy's CVPR 2023 and ICCV 2024 keynotes, Tesla patent filings (USPTO and WIPO), WikiChip Fuse hardware analyses, Sony IMX490 technical briefs, ON Semiconductor AR0136AT datasheets, TechInsights teardown reports, independent technical analyses (ThinkAutonomous, NotATeslaApp, AutoPilot Review), Tesla service manuals, and academic literature on BEV transformers and occupancy networks. All information is derived from publicly available sources as of March 2026.*
