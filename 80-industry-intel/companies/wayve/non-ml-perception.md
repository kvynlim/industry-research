# The Classical Backbone of the Most End-to-End AV Company

## Non-ML and Hybrid-ML Techniques in Wayve's Perception Stack

*Last updated: March 2026*

Wayve is the most aggressively end-to-end autonomous driving company in the world. They have replaced HD maps, hand-coded driving rules, modular perception pipelines, and explicit object detection with a single differentiable neural network trained end-to-end from sensor inputs to driving trajectory. And yet, even Wayve cannot escape classical methods entirely. This document is an exhaustive accounting of every non-ML and hybrid-ML technique that exists in or around Wayve's perception and driving stack -- the classical scaffolding that supports the learned system.

---

## Table of Contents

**Part I: Camera Signal Processing (Unavoidable Classical)**
1. [ISP Pipeline](#1-isp-pipeline)
2. [Lens Distortion Correction](#2-lens-distortion-correction)
3. [Rolling Shutter Correction](#3-rolling-shutter-correction)

**Part II: Geometric Methods in End-to-End Systems**
4. [Camera Geometry and Projection Models](#4-camera-geometry-and-projection-models)
5. [Ego-Motion and Vehicle Odometry](#5-ego-motion-and-vehicle-odometry)
6. [Coordinate Transforms Between Frames](#6-coordinate-transforms-between-frames)
7. [Depth from Classical Geometry](#7-depth-from-classical-geometry)

**Part III: Bayesian Deep Learning (Hybrid)**
8. [Aleatoric Uncertainty](#8-aleatoric-uncertainty)
9. [Epistemic Uncertainty](#9-epistemic-uncertainty)
10. [Uncertainty Calibration](#10-uncertainty-calibration)
11. [Loss Attenuation via Homoscedastic Uncertainty](#11-loss-attenuation-via-homoscedastic-uncertainty)

**Part IV: Self-Supervised Learning (Hybrid)**
12. [Photometric Consistency Loss](#12-photometric-consistency-loss)
13. [Temporal Consistency via Ego-Motion](#13-temporal-consistency-via-ego-motion)
14. [Minimum Reprojection Loss](#14-minimum-reprojection-loss)

**Part V: PRISM-1 Classical Components**
15. [3D Gaussian Splatting Rendering Pipeline](#15-3d-gaussian-splatting-rendering-pipeline)
16. [Camera Ray Casting and Rasterization](#16-camera-ray-casting-and-rasterization)
17. [Point Cloud Initialization](#17-point-cloud-initialization)

**Part VI: GAIA World Model Classical Components**
18. [Video Tokenization Preprocessing](#18-video-tokenization-preprocessing)
19. [Action Conditioning from Classical Vehicle Signals](#19-action-conditioning-from-classical-vehicle-signals)

**Part VII: Calibration**
20. [Camera Calibration](#20-camera-calibration)
21. [Cross-Platform Geometric Generalization](#21-cross-platform-geometric-generalization)

**Part VIII: Safety Classical Components**
22. [Safety Envelope and Guardrails](#22-safety-envelope-and-guardrails)
23. [Operational Domain Detection](#23-operational-domain-detection)
24. [Intervention Triggers](#24-intervention-triggers)

**Part IX: State Estimation**
25. [Vehicle State Estimation](#25-vehicle-state-estimation)
26. [Object State Filtering](#26-object-state-filtering)

**Part X: What Classical Methods Wayve Deliberately Removed**
27. [No HD Maps](#27-no-hd-maps)
28. [No Hand-Coded Rules](#28-no-hand-coded-rules)
29. [Remaining Classical Components -- Honest Accounting](#29-remaining-classical-components)

---

## Part I: Camera Signal Processing (Unavoidable Classical)

### 1. ISP Pipeline {#1-isp-pipeline}

#### Why This Cannot Be Learned Away

Every neural network in Wayve's stack -- the driving model, GAIA world models, PRISM-1, Rig3R -- consumes processed RGB images as input. Not raw Bayer sensor data. Between the photons hitting the CMOS sensor and the 8-bit RGB tensor entering the neural network, there is an entire classical signal processing pipeline that no amount of end-to-end learning has replaced.

The Image Signal Processor (ISP) is divided into three processing layers:

**Basic Signal Processing Layer:**
- **Black level correction**: Subtracting the sensor's dark current offset from raw pixel values. This is a per-sensor calibration constant, determined during manufacturing or startup.
- **Linearization**: Correcting the sensor's non-linear photoelectric response to produce a linear relationship between incident light and pixel value.
- **Noise reduction**: Spatial and temporal denoising of the raw signal. This involves classical signal processing (bilateral filtering, wavelet denoising, or temporal averaging) to suppress sensor noise while preserving edges. There is an inherent trade-off: excessive denoising suppresses high-frequency information critical for gradient-based feature detection in downstream neural networks.

**Image Optimization Layer:**
- **Demosaicing / Debayering**: The most critical classical operation. Camera sensors use a Bayer Color Filter Array (CFA) where each pixel captures only one color channel (R, G, or B). Demosaicing interpolates the missing two channels per pixel to produce a full RGB image. Algorithms range from bilinear interpolation to edge-directed methods (Malvar-He-Cutler) to more sophisticated gradient-based approaches. This is pure classical signal processing -- every pixel the neural network sees has been through this transform.
- **Color correction matrix (CCM)**: A 3x3 matrix mapping sensor-native color space to a standard color space (sRGB or a custom automotive color space). Derived from classical spectral calibration.
- **Gamma correction**: Applying a nonlinear transfer function (typically power-law) to map the linear sensor response to a perceptually uniform encoding. Standard sRGB gamma is approximately y = x^(1/2.2).
- **Sharpening**: Edge enhancement via unsharp masking or other classical convolution kernels to compensate for optical and demosaicing blur.

**Intelligent Control Layer:**
- **Auto Exposure (AE)**: A classical control loop that adjusts sensor integration time and analog gain to keep the image within the sensor's dynamic range. In automotive applications, this must handle extreme dynamic range scenarios: entering/exiting tunnels, direct sun glare, nighttime headlights. The exposure controller is typically a PID or histogram-based algorithm that targets a specific mean luminance or histogram distribution. Recent research explores neural auto-exposure (learning the exposure parameter jointly with the detector), but production automotive ISPs use classical control loops.
- **Auto White Balance (AWB)**: Estimating the scene illuminant color temperature and applying a diagonal correction matrix to neutralize color casts. Classical algorithms include gray-world assumption, white-patch retinex, and gamut-mapping. This is a classical color constancy problem.
- **Auto Focus (AF)**: For cameras with adjustable focus (less common in automotive fixed-focus systems), classical contrast-detection or phase-detection autofocus algorithms.

#### What Wayve's Papers Reveal

Wayve's published papers (GAIA-1, GAIA-2, MILE, FIERY, Rig3R, PRISM-1, SimLingo) make zero mention of ISP processing. The GAIA-2 paper begins its data description at the level of already-processed RGB frames -- the video tokenizer's encoder takes "raw video frames" as input, but this "raw" means processed RGB, not Bayer sensor data. The normalization applied is a fixed mean of mu_x = 0.0 and standard deviation sigma_x = 0.32, empirically determined during tokenizer training. This normalization operates on already-demosaiced, already-gamma-corrected images.

The silence is itself informative. The ISP pipeline is treated as a fixed, pre-neural preprocessing stage. It is classical signal processing that the end-to-end learning paradigm has not absorbed, and likely cannot absorb without redesigning the entire camera-to-compute interface. Modern automotive SoCs (like the Qualcomm Snapdragon Ride that Wayve uses for consumer deployment) include dedicated ISP hardware that processes sensor data before the AI accelerator ever sees it. The ISP runs in silicon, not in software -- it is physically separate from the neural network compute path.

#### The Information Loss Problem

This is not a neutral preprocessing step. The ISP introduces irreversible information loss that affects downstream perception:
- Demosaicing blurs fine spatial patterns, potentially affecting small object detection at distance.
- Noise reduction suppresses textures that might be informative for surface classification.
- Tone mapping compresses dynamic range, potentially losing details in shadows and highlights that are critical for detecting pedestrians at night or reading signs in direct sunlight.
- Gamma correction redistributes the signal in a way optimized for human vision, not for neural network feature extraction.

There is active research in the broader AV community on "raw perception" -- feeding Bayer sensor data directly to neural networks, bypassing the ISP entirely or learning the ISP jointly with the perception model. Some automotive SoCs now offer dual ISP pipelines: one optimized for human viewing (rear camera display) and one optimized for computer vision (perception input). Wayve has not publicly described using this approach, but it represents a frontier where classical ISP processing could eventually be absorbed into the learned system.

---

### 2. Lens Distortion Correction {#2-lens-distortion-correction}

#### The Physical Constraint

Camera lenses introduce geometric distortions that are entirely governed by classical optics. These distortions cause straight lines in the real world to appear curved in the image. For automotive cameras, which often use wide-angle or fisheye lenses to maximize field of view, distortion can be severe.

Wayve's WayveScenes101 dataset explicitly specifies a **fisheye distortion model** for its cameras, confirming that their fleet cameras produce significantly distorted images that must be corrected or modeled.

#### Distortion Models

The standard distortion models used in autonomous driving are purely classical:

**Radial distortion** (barrel and pincushion):
```
x_distorted = x(1 + k1*r^2 + k2*r^4 + k3*r^6)
y_distorted = y(1 + k1*r^2 + k2*r^4 + k3*r^6)
```
where r^2 = x^2 + y^2 and k1, k2, k3 are radial distortion coefficients.

**Tangential distortion** (due to lens decentering):
```
x_distorted = x + [2*p1*x*y + p2*(r^2 + 2*x^2)]
y_distorted = y + [p1*(r^2 + 2*y^2) + 2*p2*x*y]
```
where p1, p2 are tangential distortion coefficients.

**Fisheye models** (equidistant, stereographic, equisolid angle): For wide-angle automotive cameras, specialized fisheye models replace the simple polynomial radial model with trigonometric mappings.

#### How Distortion Feeds the Learned System

Wayve handles distortion in two distinct ways depending on the system:

**Approach 1: Undistort, then process.** Classical undistortion is applied as a preprocessing step, warping the distorted image to a rectilinear (pinhole) image before feeding it to the neural network. This uses the known distortion coefficients and the classical inverse distortion mapping. The neural network then operates on undistorted images and can assume a simple pinhole camera model.

**Approach 2: Encode distortion as a conditioning signal.** In GAIA-2, distortion parameters are not used to undistort images. Instead, "distortion coefficients are processed through their respective encoders to yield compact representations" that are summed with intrinsic and extrinsic embeddings to form a unified camera encoding. The neural network learns to handle distorted images directly, conditioned on the known distortion parameters. This is a hybrid approach: the distortion model itself is classical (the polynomial coefficients come from classical calibration), but the correction is learned rather than geometrically applied.

**Rig3R** takes a third approach: it predicts per-pixel ray directions (raymaps) that implicitly encode both intrinsics and distortion. The classical camera model is used to compute ground-truth rays during training: r_uv = R * K^(-1) * [u, v, 1]^T, where K is the intrinsic matrix and R is the rotation. But the model learns to predict these rays from image content, effectively learning to infer the camera model. Even here, the ground-truth supervision comes from classical calibration.

---

### 3. Rolling Shutter Correction {#3-rolling-shutter-correction}

#### The Physical Problem

Most automotive cameras use CMOS rolling shutter sensors, which expose the image line-by-line rather than all at once. At driving speeds, this creates geometric distortions: vertical lines appear skewed, fast-moving objects are stretched or compressed, and the geometric relationship between pixels in different rows corresponds to different moments in time.

For a vehicle traveling at 30 m/s (108 km/h) with a sensor that takes 33 ms to read out all rows (common for 1080p at 30 Hz), the vehicle has moved approximately 1 meter between the first and last row of a single frame. This is not negligible for precise geometric reasoning.

#### WayveScenes101 Evidence

Wayve's WayveScenes101 dataset explicitly records the **rolling shutter type** for each camera, confirming that their fleet cameras are rolling shutter sensors and that this is a known property of their data pipeline. The dataset captures at 10 Hz with 1920x1080 resolution across 5 synchronized cameras.

#### Correction Methods

Rolling shutter correction requires knowing the vehicle's ego-motion during the frame exposure and applying a per-row geometric correction:

1. **Estimate ego-motion during exposure**: Using IMU data (typically sampled at 100-1000 Hz) or vehicle odometry, interpolate the vehicle's pose at each row's exposure time.
2. **Per-row undistortion**: Apply a rigid body transform to each row (or block of rows) to warp it to a common reference time (typically the frame center or start), using the classical pinhole projection model.
3. **Resampling**: Bilinear or bicubic interpolation to produce the corrected image.

This is entirely classical geometry and signal processing. The ego-motion comes from classical sensors (IMU, wheel encoders), the correction uses the known camera model (intrinsics + extrinsics), and the resampling is classical image warping.

#### Impact on End-to-End Learning

If rolling shutter correction is not applied, the neural network must implicitly learn to handle rolling shutter artifacts -- which vary with ego-motion speed and direction. This makes the learning problem harder and wastes model capacity on compensating for a known, deterministic distortion. Whether Wayve applies explicit correction or relies on the network to handle it implicitly is not publicly disclosed, but their recording of rolling shutter metadata in WayveScenes101 suggests awareness and likely correction in the preprocessing pipeline.

---

## Part II: Geometric Methods in End-to-End Systems

### 4. Camera Geometry and Projection Models {#4-camera-geometry-and-projection-models}

#### The Irreducible Classical Core

Camera geometry is perhaps the single most important classical component in Wayve's stack. Every model they have published -- MILE, FIERY, GAIA-2, Rig3R, PRISM-1 -- relies on known camera intrinsics and extrinsics to perform 3D reasoning. These parameters are determined by classical calibration and encode the physics of image formation.

**Intrinsic parameters** (the camera's internal geometry):
- Focal lengths (f_x, f_y): Measured in pixels, defining the mapping from 3D camera-frame coordinates to 2D pixel coordinates.
- Principal point (c_x, c_y): The pixel coordinate where the optical axis intersects the image plane.
- Assembled into the intrinsic matrix K:
```
K = [f_x   0   c_x]
    [ 0   f_y  c_y]
    [ 0    0    1 ]
```

**Extrinsic parameters** (the camera's pose in the vehicle frame):
- Rotation matrix R in SO(3): 3x3 orthogonal matrix encoding the camera's orientation relative to the vehicle.
- Translation vector t in R^3: The camera's position relative to the vehicle origin.
- Together forming the 4x4 homogeneous transformation matrix [R|t].

#### How Classical Geometry Feeds Every Wayve Model

**MILE (NeurIPS 2022):**
Camera intrinsics K and extrinsics M are used explicitly in the 3D lifting operation. Image features are projected to 3D voxels using the formula:

```
Lift(u_t, d_t, K^(-1), M) in R^(C_e x D x H_e x W_e x 3)
```

where u_t are image features, d_t is the predicted depth distribution, K^(-1) is the inverse intrinsic matrix, and M is the extrinsic matrix. This is classical projective geometry -- the unprojection operation that maps a 2D pixel with a known depth to a 3D point:

```
X_3D = depth * K^(-1) * [u, v, 1]^T
```

The 3D feature voxels are then sum-pooled onto a predefined BEV grid -- another classical geometric operation (orthographic projection onto the ground plane).

**FIERY (ICCV 2021):**
Uses the Lift-Splat-Shoot paradigm where per-pixel depth probability distributions are combined with camera intrinsics and extrinsics to lift 2D features into 3D. The depth distribution defines a probability over discrete depth bins, and features are scattered into 3D voxels weighted by this probability. The voxel positions are determined entirely by classical camera projection.

**GAIA-2:**
Camera intrinsics (focal lengths, principal points), extrinsics (pose), and distortion parameters are each embedded via separate learnable linear projections, summed into a unified camera encoding, and added as positional information to spatial tokens. The classical camera model defines what these parameters mean; learning determines how to use them.

The GAIA-2 paper also performs classical 3D-to-2D bounding box projection: "Each box encodes the 3D location, orientation, dimensions, and category of an agent. The 3D boxes are projected into the 2D image plane and normalized." This is the standard homogeneous coordinate projection:

```
[u, v, 1]^T ~ K * [R|t] * [X, Y, Z, 1]^T
```

**Rig3R (NeurIPS 2025 Spotlight):**
Raymaps encode the classical pinhole camera model in per-pixel form. For each pixel (u, v):

```
r_cam = [u/f_x, v/f_y, 1]^T / ||[u/f_x, v/f_y, 1]^T||
r_world = R * K^(-1) * [u, v, 1]^T
```

The model predicts these rays and uses them to recover camera parameters. Focal lengths are recovered analytically from angular constraints: f_x = |delta_u| / tan(theta). Rotation R is solved via cross-covariance alignment and Singular Value Decomposition (SVD) -- a classical linear algebra operation. Even though Rig3R is a learned model, its output is decoded using classical geometric algebra.

---

### 5. Ego-Motion and Vehicle Odometry {#5-ego-motion-and-vehicle-odometry}

#### Classical Signals That Feed the Learned System

Wayve's end-to-end driving model does not operate in a vacuum. It receives classical ego-motion signals from the vehicle's sensor suite:

**CAN Bus Data:**
The Controller Area Network (CAN bus) is the automotive industry's standard serial communication protocol, carrying real-time vehicle state data from distributed Electronic Control Units (ECUs). Wayve's systems consume:
- **Vehicle speed**: From wheel speed sensors (typically Hall effect sensors on each wheel hub), reported via CAN at ~25 Hz.
- **Steering angle**: From the steering column angle sensor, also via CAN.
- **Yaw rate**: From the vehicle's inertial measurement unit or electronic stability control system.
- **Throttle position and brake pressure**: Feedback from the powertrain and braking systems.

These are classical analog-to-digital sensor readings, processed by classical embedded firmware, transmitted over a classical serial bus protocol. No machine learning is involved in producing these signals.

**IMU (Inertial Measurement Unit):**
A 6-axis IMU provides:
- 3-axis accelerometer: Linear acceleration in the body frame (a_x, a_y, a_z).
- 3-axis gyroscope: Angular velocity in the body frame (omega_x, omega_y, omega_z).
Typical automotive IMUs sample at 100-400 Hz. The raw IMU data is processed by classical signal processing:
- Bias estimation and correction (gyro bias drifts with temperature).
- Integration of angular velocity to produce orientation (classical quaternion or rotation matrix integration).
- Double integration of acceleration to produce position (extremely drift-prone; hence always fused with other sensors).

**Wheel Odometry:**
Wheel encoder ticks are converted to distance traveled via the known wheel circumference -- a classical kinematic calculation. Differential wheel speeds (left vs. right) provide an estimate of yaw rate via the bicycle model:

```
yaw_rate = (v_right - v_left) / track_width
```

This is classical vehicle kinematics. Wheel odometry is fused with IMU data using classical filtering (complementary filters or Kalman filters) to compensate for IMU drift and wheel slip.

#### How Ego-Motion Feeds Wayve's Models

**FIERY:** Known past ego-motion is used by the Spatial Transformer module to register past BEV frames to the present reference frame. Past BEV features are warped using the known ego-motion (from CAN bus / IMU) via classical rigid body transforms before being fed to the temporal model. This is not learned -- it is a deterministic geometric operation using measured vehicle motion.

**GAIA-1:** The action encoder takes scalar values of speed and curvature (derived from CAN bus data) and projects them into the model's shared representation space via learned linear projections. The input signals are classical; the encoding is learned.

**GAIA-2:** Ego-vehicle actions are parameterized by speed and curvature, normalized using a symmetric logarithmic transform:

```
symlog(y) = sign(y) * log(1 + s*|y|) / log(1 + s*|y_max|)
```

For curvature (m^(-1), range 0.0001-0.1): s = 1000.
For speed (m/s, range 0-75): s = 3.6 (to express values in km/h).

This symlog transform is a classical nonlinear normalization function, not learned. It maps the physically meaningful range of vehicle dynamics into a [-1, 1] range suitable for neural network training stability.

**Self-supervised depth training:** Ego-motion from vehicle odometry provides the geometric supervision signal for self-supervised depth estimation. The photometric consistency loss (Section 12) requires knowing how the camera moved between frames; this motion comes from classical odometry.

---

### 6. Coordinate Transforms Between Frames {#6-coordinate-transforms-between-frames}

#### The Classical Rigid Body Transform Stack

Wayve's multi-camera systems require a chain of classical coordinate transforms to relate different reference frames:

```
Pixel Frame (u, v)
    |  K^(-1) (inverse intrinsic matrix -- classical)
    v
Camera Frame (x_c, y_c, z_c)
    |  [R_cam | t_cam]^(-1) (inverse extrinsic -- classical)
    v
Vehicle/Rig Frame (x_v, y_v, z_v)
    |  T_ego(t) (ego-motion transform -- classical)
    v
World Frame (x_w, y_w, z_w)
```

Each of these transforms is a classical rigid body transformation (rotation + translation), represented as a 4x4 homogeneous matrix in SE(3). The composition of transforms is classical matrix multiplication.

**In MILE:** 3D points are computed in the camera frame, then transformed to the vehicle frame, then projected to the BEV grid -- all using classical matrix operations with known K and M.

**In FIERY:** Temporal alignment of BEV features uses the inverse ego-motion transform to warp past features to the present reference frame: BEV_aligned = SpatialTransformer(BEV_past, T_ego^(-1)).

**In GAIA-2:** Camera encodings are created from intrinsics, extrinsics, and distortion parameters. The normalization of focal lengths and principal point coordinates is a classical operation that maps hardware-specific camera parameters to a common representation.

**In Rig3R:** The entire system is organized around two coordinate frames:
1. A global/world frame for the "pose raymap" (encoding absolute camera poses).
2. A rig-centric frame for the "rig raymap" (encoding relative camera poses within the multi-camera rig, decoupled from ego-motion).

The distinction between these frames and the transforms between them are classical concepts from multi-view geometry.

#### Timestamp Encoding in GAIA-2

Even temporal coordinates receive classical preprocessing: "Each timestamp is (i) normalized relative to the present time and scaled to the range [-1, 1], (ii) transformed using sinusoidal functions (Fourier feature encoding), and (iii) passed through an MLP." The normalization and Fourier encoding are classical signal processing operations; only the MLP is learned.

---

### 7. Depth from Classical Geometry {#7-depth-from-classical-geometry}

#### Alex Kendall's Thesis: Classical Geometry as Free Supervision

Alex Kendall's PhD thesis, "Geometry and Uncertainty in Deep Learning for Computer Vision" (Cambridge, 2017), established the theoretical framework for using classical geometry to train deep learning models without labeled data. The core insight: epipolar geometry -- a classical result from multi-view geometry -- provides a free supervisory signal for depth estimation.

#### The Classical Foundation

**Epipolar geometry** constrains the relationship between corresponding points in two views of the same scene. Given two cameras with known relative pose (rotation R and translation t), a point in one image constrains the corresponding point in the other image to lie on an epipolar line. This constraint is encoded in the Essential Matrix E = [t]_x * R (for calibrated cameras) or the Fundamental Matrix F = K'^(-T) * E * K^(-1) (for uncalibrated cameras).

**Photometric consistency** exploits this geometry: if you know the depth of a pixel in image I_1 and the relative camera pose between I_1 and I_2, you can project the pixel into I_2 and check if the colors match. This is the classical "view synthesis" operation:

```
p_2 = K * (R * (d * K^(-1) * p_1) + t)
```

where p_1 is a pixel in image 1, d is its depth, K is the intrinsic matrix, and (R, t) is the relative pose. If the predicted depth is correct, the synthesized view will match the actual second image.

This entire formulation is classical projective geometry. What Kendall showed is that you can use this classical geometry as a loss function to train a neural network to predict depth -- without any ground-truth depth labels. The geometry provides "free supervision."

#### Self-Supervised Depth in Wayve's Stack

Wayve's depth estimation (used as an auxiliary training signal and for BEV lifting in MILE and FIERY) uses self-supervised learning based on this classical geometric framework:

1. A **depth network** predicts per-pixel depth from a single image.
2. A **pose network** predicts the relative camera pose between consecutive frames (or this comes from known ego-motion via CAN bus).
3. The predicted depth and pose are used to **warp** the source image to the target view using the classical projection formula above.
4. The **photometric loss** between the warped image and the actual target image provides the training signal.

The warping operation itself is classical geometry + differentiable bilinear sampling (from Jaderberg et al.'s Spatial Transformer Network, 2015). The gradient flows through the sampling operation back to the depth and pose predictions, but the geometric relationship that makes this possible is entirely classical.

---

## Part III: Bayesian Deep Learning (Hybrid)

### 8. Aleatoric Uncertainty {#8-aleatoric-uncertainty}

#### The Classical Statistical Foundation

Aleatoric uncertainty captures noise inherent in the observations -- sensor noise, motion blur, ambiguous scene elements. This is a concept from classical statistics (irreducible variance in the data) applied within a deep learning framework.

**Heteroscedastic aleatoric uncertainty** (data-dependent noise) is modeled by having the neural network predict both the mean prediction and its variance for each output. For a regression task (e.g., depth estimation), the network predicts:
- y_hat (the depth estimate)
- sigma^2 (the variance of the estimate)

The classical Gaussian likelihood is:

```
p(y | f(x), sigma^2) proportional to exp(-||y - f(x)||^2 / (2*sigma^2))
```

Taking the negative log-likelihood produces the loss:

```
L = (1 / (2*sigma^2)) * ||y - f(x)||^2 + log(sigma)
```

This is a classical maximum likelihood estimation formulation. The first term weights the squared error by the inverse variance (precision) -- giving less weight to predictions the model believes are noisy. The second term (log sigma) regularizes the variance -- preventing the model from predicting infinite variance to zero out the loss.

**The hybrid nature**: The statistical framework (Gaussian likelihood, maximum likelihood estimation, precision weighting) is entirely classical. What is novel is having a neural network predict the variance sigma^2 as a function of the input, enabling input-dependent noise modeling within a learned system.

#### Application in Wayve's System

Kendall and Gal (NeurIPS 2017) demonstrated this for both per-pixel depth regression and semantic segmentation. For depth:
- The network outputs a mean depth and a variance per pixel.
- Pixels with high inherent ambiguity (textureless regions, reflective surfaces, occlusion boundaries) receive high predicted variance.
- The loss down-weights these pixels, preventing noisy gradients from degrading the overall model.

For classification (semantic segmentation), the formulation uses a temperature-scaled softmax:

```
p(y = c | f(x), sigma^2) = softmax(f_c(x) / sigma^2)
```

where sigma^2 modulates the "temperature" of the softmax. High uncertainty produces a flatter (more uniform) distribution; low uncertainty produces a sharper one.

Rig3R's confidence scores follow the same principle: per-pixel 3D point predictions are accompanied by confidence weights that modulate the reconstruction loss, with an alpha * log(C) regularization term preventing degenerate solutions. Regions like sky or dynamic objects (where depth is inherently ambiguous) receive low confidence.

---

### 9. Epistemic Uncertainty {#9-epistemic-uncertainty}

#### Monte Carlo Dropout as Approximate Bayesian Inference

Epistemic uncertainty captures uncertainty in the model parameters -- uncertainty that can be reduced with more training data. This is the model saying "I don't know because I haven't seen enough examples like this."

Kendall and colleagues model epistemic uncertainty using **MC Dropout** (Gal and Ghahramani, 2016). The key insight: dropout at test time, with multiple stochastic forward passes, approximates Bayesian inference over the network weights. Each dropout mask effectively samples a different sub-network, and the variance across these samples estimates the model's epistemic uncertainty.

For T stochastic forward passes with different dropout masks:
```
Mean prediction: y_bar = (1/T) * sum_{t=1}^{T} f_hat(x, dropout_mask_t)
Epistemic variance: Var_epistemic = (1/T) * sum_{t=1}^{T} (f_hat(x, dropout_mask_t) - y_bar)^2
```

This is Monte Carlo integration -- a classical statistical method -- applied to approximate the intractable posterior distribution over neural network weights.

#### The Critical Safety Application

For autonomous driving, the distinction between aleatoric and epistemic uncertainty is safety-critical:

- **High aleatoric, low epistemic**: The model has seen many examples like this but the data is inherently noisy (e.g., a wet road with specular reflections). The system should proceed with caution but this is a known-difficult scenario.
- **Low aleatoric, high epistemic**: The model has not seen enough examples like this (e.g., an unusual obstacle, an unfamiliar road type). This is an out-of-distribution scenario. The system should potentially disengage or request human intervention.

Kendall's "Concrete Problems for Autonomous Vehicle Safety" (IJCAI 2017) articulated this directly: a model trained on highway images that encounters a dirt track should return high epistemic uncertainty, signaling that it is operating outside its training distribution. The classical statistical framework (variance decomposition into aleatoric and epistemic components) provides the theoretical grounding for this safety-critical capability.

**Concrete Dropout** (Kendall, Gal, and Hron, NeurIPS 2017) extended this by learning the dropout probability itself through backpropagation, using a continuous relaxation of the discrete dropout mask. This allows the model to adapt its uncertainty estimates as more data is observed, without manual tuning of dropout rates -- a principled optimization of uncertainty estimation.

---

### 10. Uncertainty Calibration {#10-uncertainty-calibration}

#### Classical Calibration Theory

A well-calibrated uncertainty estimate means that predicted confidence levels match actual error frequencies. If the model says "I am 90% confident," it should be correct approximately 90% of the time. This is a classical concept from probability theory and decision theory.

**Calibration diagnostics** use:
- **Reliability diagrams**: Plotting predicted confidence against actual accuracy in binned intervals. A perfectly calibrated model produces points on the y = x diagonal.
- **Expected Calibration Error (ECE)**: The weighted average of the gap between predicted confidence and actual accuracy across bins.
- **Calibration curves for regression**: Plotting the fraction of predictions that fall within predicted confidence intervals. For a well-calibrated model, x% prediction intervals should contain x% of actual values.

These are entirely classical statistical evaluation tools, predating deep learning by decades.

#### Application in Wayve's Context

Kendall and Gal demonstrated that combining aleatoric and epistemic uncertainty produces better-calibrated uncertainty estimates than either alone. The Bayesian SegNet paper showed that uncertainty maps correlate with actual prediction errors -- high uncertainty regions are indeed where the model makes mistakes. This correlation is evaluated using classical statistical metrics.

For Wayve's deployed system, calibration of uncertainty estimates is critical for:
- **Safety thresholds**: Triggering conservative behavior when uncertainty exceeds a calibrated threshold.
- **Active learning**: Identifying high-uncertainty scenarios in fleet data for prioritized retraining. The uncertainty estimate must be calibrated -- otherwise, the active learning selection is unreliable.
- **Human-machine interface**: If the system communicates confidence to a safety driver, the confidence must be meaningful in an absolute sense.

The calibration process itself is classical: collect predictions and their uncertainty estimates, bin by predicted uncertainty, compute actual error rates in each bin, and apply recalibration if needed (e.g., Platt scaling, isotonic regression, temperature scaling -- all classical methods).

---

### 11. Loss Attenuation via Homoscedastic Uncertainty {#11-loss-attenuation-via-homoscedastic-uncertainty}

#### The Mathematical Derivation

Kendall, Gal, and Cipolla's CVPR 2018 paper "Multi-Task Learning Using Uncertainty to Weigh Losses for Scene Geometry and Semantics" is one of the most cited papers in multi-task learning. It uses classical Bayesian statistics to solve a practical deep learning problem: how to weight multiple loss functions when training a single network for multiple tasks.

**The problem**: When training a network to simultaneously predict depth (regression), semantic segmentation (classification), and instance segmentation, the relative weighting of losses for each task critically affects performance. Manual tuning is expensive and fragile.

**The solution**: Model each task's loss with a homoscedastic uncertainty parameter sigma_k (a per-task noise level) and derive the optimal multi-task loss from maximum likelihood estimation.

For K tasks, the combined loss is derived from the joint Gaussian likelihood:

```
L_total = sum_{k=1}^{K} [ (1 / (2 * sigma_k^2)) * L_k + log(sigma_k) ]
```

where:
- L_k is the loss for task k.
- sigma_k is the learned homoscedastic uncertainty for task k.
- The (1 / (2 * sigma_k^2)) term weights each task by its inverse variance (precision). Tasks with high inherent noise receive lower weight.
- The log(sigma_k) term acts as a regularizer, preventing sigma_k from growing unboundedly (which would zero out the loss).

**What is classical**: The entire derivation. Gaussian likelihood, negative log-likelihood, maximum likelihood estimation, precision weighting, regularization through the likelihood's normalization constant -- these are standard concepts from classical Bayesian statistics and inference theory. The formula is a direct consequence of modeling task noise as Gaussian with learned variance.

**What is novel**: Having the noise parameters sigma_k be learnable parameters optimized jointly with the neural network weights through backpropagation. The uncertainty parameters are updated dynamically during training as the model's understanding of each task's difficulty evolves.

#### Application in Wayve's System

Wayve's driving model trains with multiple objectives simultaneously: imitation learning (driving trajectory), depth estimation, semantic segmentation, traffic light detection, optical flow, and future prediction. The CVPR 2018 multi-task uncertainty framework is directly used (as described in Wayve's "Reimagining an Autonomous Vehicle" paper, 2021) to automatically balance these competing objectives.

This is a quintessential hybrid technique: classical Bayesian statistics providing the mathematical framework, deep learning providing the function approximation and end-to-end optimization.

---

## Part IV: Self-Supervised Learning (Hybrid)

### 12. Photometric Consistency Loss {#12-photometric-consistency-loss}

#### Classical Image Warping as Neural Network Supervision

The photometric consistency loss is the cornerstone of Wayve's self-supervised depth estimation. It uses classical multi-view geometry to provide free supervision for learning 3D scene structure from unlabeled video.

**The classical warping operation:**

Given a target image I_t and a source image I_s, with known relative camera pose (R, t) and predicted depth D_t for the target image:

1. For each pixel p_t in the target image, compute its 3D position:
   ```
   P_3D = D_t(p_t) * K^(-1) * p_t_homogeneous
   ```

2. Transform to the source camera frame:
   ```
   P_source = R * P_3D + t
   ```

3. Project back to the source image:
   ```
   p_s = K * P_source / P_source.z
   ```

4. Sample the source image at p_s using **differentiable bilinear interpolation**:
   ```
   I_s_warped(p_t) = BilinearSample(I_s, p_s)
   ```

Steps 1-3 are entirely classical projective geometry. Step 4 uses the Spatial Transformer Network's differentiable bilinear sampling (Jaderberg et al., 2015), which is a classical interpolation scheme (bilinear interpolation is a linear algebra operation) made differentiable to allow gradient flow.

**The photometric loss:**

```
L_photo = sum_pixels [ alpha * SSIM(I_t, I_s_warped) + (1 - alpha) * |I_t - I_s_warped| ]
```

SSIM (Structural Similarity Index) is a classical image quality metric from Wang et al. (2004), based on luminance, contrast, and structure comparisons. L1 loss is the classical absolute error.

**The hybrid nature**: The geometry (projection, warping) and the loss function (SSIM, L1) are classical. What is learned is the depth prediction D_t and (optionally) the pose (R, t). The classical geometry converts depth predictions into view synthesis predictions, which can be compared with actual observations to produce gradients for the depth network.

This is what Kendall's thesis calls using "epipolar geometry for unsupervised learning" -- the geometry of multi-view imaging provides a supervisory signal that requires no human annotation.

---

### 13. Temporal Consistency via Ego-Motion {#13-temporal-consistency-via-ego-motion}

#### Classical Odometry Enabling Temporal Self-Supervision

Self-supervised depth estimation requires knowing the relative pose between frames. This pose comes from one of two sources:

**Source 1: Classical vehicle odometry (CAN bus + IMU).** The vehicle's speed and yaw rate, measured by classical sensors and communicated over the CAN bus, provide an ego-motion estimate. This is fused using classical filtering (complementary filter or Kalman filter) to produce a relative pose between consecutive frames. This pose is used directly in the view synthesis warping operation, providing the (R, t) transform needed for photometric consistency.

**Source 2: A learned pose network.** Alternatively, a neural network predicts the 6-DOF relative pose from pairs of images. This pose network is trained jointly with the depth network via the photometric consistency loss. Even here, the output of the pose network is a classical geometric object (rotation + translation in SE(3)), and the loss function uses classical projection geometry.

In Wayve's system, both sources are likely used: classical odometry provides a reliable baseline ego-motion estimate, while the learned pose network can refine it or provide visual ego-motion estimation in cases where odometry is unreliable (e.g., wheel slip on ice).

**FIERY's temporal alignment** is a clear example: past BEV features are registered to the present reference frame using "known past ego-motion." This ego-motion comes from the vehicle's odometry pipeline -- a classical signal processing chain producing rigid body transforms. The warping is done via a Spatial Transformer, which applies a classical 2D affine or projective transform to the BEV feature grid.

---

### 14. Minimum Reprojection Loss {#14-minimum-reprojection-loss}

#### Classical Multi-View Geometry Handling Occlusion

The minimum reprojection loss, introduced in Monodepth2 (Godard et al., ICCV 2019 -- from Niantic, with connections to Kendall's work at Cambridge), addresses a classical problem in multi-view geometry: occlusion.

When warping a source image to a target view, some pixels in the target may be occluded in the source -- they are not visible from the source viewpoint. The standard photometric loss penalizes these pixels incorrectly, because the warped source image shows a different surface (the occluder) than the target image shows (the occluded surface).

**The minimum reprojection solution**: When multiple source images are available (e.g., both the previous and next frame in a video sequence), compute the photometric loss for each source independently and take the per-pixel minimum:

```
L_min_reproj(p) = min_{s in sources} L_photo(I_t(p), I_s_warped(p))
```

This exploits a classical geometric insight: a pixel that is occluded in one source view is likely visible in another. Taking the minimum per-pixel loss selects the source view in which that pixel is visible, effectively handling occlusion without explicit occlusion reasoning.

**Auto-masking** is a related classical technique: pixels where the photometric loss is lower for the unwarped source image than the warped one are masked out. This handles static scenes where the ego-vehicle is not moving (the auto-masking detects that the scene is static and disables the loss for those pixels).

Both techniques use the structure of classical multi-view geometry (occlusion geometry, scene stationarity) to design robust loss functions. The geometry provides the reasoning; the neural network provides the depth prediction that is optimized through this geometric loss.

---

## Part V: PRISM-1 Classical Components

### 15. 3D Gaussian Splatting Rendering Pipeline {#15-3d-gaussian-splatting-rendering-pipeline}

#### Classical Computer Graphics as Scene Representation

PRISM-1 uses 3D Gaussian Splatting as its core scene representation. This is a technique from classical computer graphics (rooted in EWA splatting by Zwicker et al., 2001) adapted with differentiability for optimization. The classical components are extensive.

**Each 3D Gaussian primitive encodes:**
- **3D position** (mean mu in R^3): The center of the Gaussian in world coordinates.
- **3D covariance** (Sigma in R^(3x3)): A positive semi-definite matrix encoding the Gaussian's shape, size, and orientation. Parameterized as Sigma = R * S * S^T * R^T, where R is a rotation matrix (classical SO(3)) and S is a diagonal scale matrix.
- **Opacity** (alpha in [0, 1]): How opaque the Gaussian is.
- **Color / Spherical Harmonics (SH) coefficients**: View-dependent appearance modeled using Spherical Harmonics, a classical basis from mathematical physics and computer graphics. SH coefficients encode how the Gaussian's color varies with viewing direction -- a classical representation of the BRDF (bidirectional reflectance distribution function) from rendering theory.

**Spherical Harmonics** are a classical mathematical tool from harmonic analysis on the sphere. They were introduced to computer graphics by Ramamoorthi and Hanrahan (2001) for representing environment lighting and surface reflectance. In 3DGS, they encode view-dependent color:

```
c(d) = sum_{l=0}^{L} sum_{m=-l}^{l} c_{l,m} * Y_{l,m}(d)
```

where d is the viewing direction, Y_{l,m} are the spherical harmonic basis functions, and c_{l,m} are the learned coefficients. The basis functions themselves are classical (Legendre polynomials, associated Legendre functions) -- the coefficients are optimized.

#### Classical Rendering Operations

**2D Projection of 3D Gaussians**: Each 3D Gaussian is projected onto the image plane using the classical camera projection. The 3D covariance Sigma is projected to a 2D covariance Sigma_2D using:

```
Sigma_2D = J * W * Sigma * W^T * J^T
```

where J is the Jacobian of the projective transform and W is the viewing transform. This is the classical EWA (Elliptical Weighted Average) framework from Zwicker et al. (2001).

**Depth sorting**: Gaussians are sorted by depth using GPU-accelerated radix sort -- a classical sorting algorithm.

**Alpha compositing** (front-to-back blending): For each pixel, overlapping Gaussians are blended using the classical Porter-Duff alpha compositing formula:

```
C_pixel = sum_{i=1}^{N} c_i * alpha_i * prod_{j=1}^{i-1} (1 - alpha_j)
```

where c_i and alpha_i are the color and opacity of the i-th Gaussian (sorted front to back), and the product term is the accumulated transmittance. This is the classical volume rendering equation from computer graphics.

**Tile-based rasterization**: The screen is divided into 16x16 pixel tiles. Gaussians are assigned to tiles based on their projected 2D extent (a classical bounding box test), then each tile is rendered independently. This is a classical GPU rasterization strategy.

#### What Is Classical vs. What Is Learned

| Component | Classical | Learned |
|---|---|---|
| 3D Gaussian parameterization | Covariance matrix, rotation, scale | The specific values (optimized) |
| Camera projection | Pinhole model, Jacobian | Nothing |
| Alpha compositing | Porter-Duff blending equation | Nothing |
| Depth sorting | Radix sort | Nothing |
| Tile rasterization | Screen-space tiling, bounding box culling | Nothing |
| Spherical harmonics | Basis functions (Y_l,m) | Coefficients (c_l,m) |
| Differentiable rasterizer | Gradient computation through rendering | The parameters being optimized |

The entire rendering pipeline is classical computer graphics. What makes 3DGS "learned" is that all parameters (positions, covariances, opacities, SH coefficients) are optimized to minimize photometric reconstruction loss -- using the same classical photometric loss from Section 12.

---

### 16. Camera Ray Casting and Rasterization {#16-camera-ray-casting-and-rasterization}

#### Classical Ray-Camera Geometry

Unlike Neural Radiance Fields (NeRFs), which cast rays from the camera into the scene and sample densities along each ray (a classical ray-tracing paradigm), 3D Gaussian Splatting works in the opposite direction: it projects (splats) 3D primitives onto the 2D image plane. This is classical rasterization.

However, the underlying ray geometry is still classical:
- Each pixel corresponds to a ray from the camera center through the pixel on the image plane.
- The ray direction is computed using the inverse intrinsic matrix: d = K^(-1) * [u, v, 1]^T.
- The ray origin is the camera center c in world coordinates.
- For each 3D Gaussian, its contribution to a pixel is determined by evaluating the Gaussian at the point where the pixel's ray passes closest to the Gaussian's mean -- a classical closest-point-on-ray calculation.

In Rig3R, this ray geometry is made explicit through "raymaps" -- per-pixel encodings of ray direction and camera center that are used both as conditioning inputs and prediction targets. The raymap formulation: r_uv = R * K^(-1) * [u, v, 1]^T represents the classical mapping from pixel coordinates to 3D ray directions.

---

### 17. Point Cloud Initialization {#17-point-cloud-initialization}

#### Structure from Motion as Classical Initialization

Standard 3D Gaussian Splatting requires an initial point cloud to seed the positions of Gaussians. This initialization typically comes from **Structure from Motion (SfM)** -- a classical computer vision pipeline.

**COLMAP** (Schonberger and Frahm, CVPR 2016) is the standard SfM system used for initialization. It is used explicitly in Wayve's WayveScenes101 dataset:
- 101,000 camera images with poses obtained from COLMAP.
- Both extrinsic and intrinsic camera calibration provided as COLMAP files.
- COLMAP serves as the ground-truth source for evaluating Rig3R's camera pose predictions.

COLMAP's SfM pipeline is entirely classical:

1. **Feature extraction**: SIFT (Scale-Invariant Feature Transform) keypoints -- a classical hand-designed feature detector based on Difference of Gaussians.
2. **Feature matching**: Nearest-neighbor matching with ratio test -- classical descriptor matching.
3. **Geometric verification**: RANSAC (Random Sample Consensus) with the fundamental matrix -- a classical robust estimation algorithm for removing outlier matches.
4. **Incremental reconstruction**: Starting from an initial image pair, progressively registering new images by solving the PnP (Perspective-n-Point) problem -- a classical camera pose estimation algorithm.
5. **Bundle adjustment**: Joint optimization of all camera poses and 3D point positions by minimizing reprojection error -- a classical nonlinear least-squares optimization (Levenberg-Marquardt algorithm).

Every step of this pipeline is classical computer vision. The output is a sparse 3D point cloud and camera poses -- which serve as initialization for 3D Gaussian Splatting optimization.

**PRISM-1's initialization** likely follows a similar pattern, though Wayve has not disclosed whether they use COLMAP or an alternative initialization. Since PRISM-1 operates on camera-only inputs and achieves generalization without LiDAR, the initialization must come from either:
- Classical SfM (like COLMAP)
- Depth-based initialization (using the depth predictions from their self-supervised depth network to unproject pixels into 3D)
- Learned initialization (using a network like Rig3R to predict initial 3D points)

Options 2 and 3 are hybrid: the depth/point predictions come from learned models, but the unprojection operation (depth * K^(-1) * [u, v, 1]^T) is classical geometry.

---

## Part VI: GAIA World Model Classical Components

### 18. Video Tokenization Preprocessing {#18-video-tokenization-preprocessing}

#### Classical Video Processing Before the Transformer

Before the GAIA world models can process driving video, several classical video processing operations are required:

**Frame extraction**: Raw video streams from cameras are decoded from compressed video formats (H.264/H.265) into individual frames. Video codec decoding is a classical signal processing operation involving DCT (Discrete Cosine Transform) decoding, motion compensation, and entropy decoding.

**Spatial cropping and resizing**: GAIA-2 extracts "random spatial crops of size 448x960 from the frames" during training. This involves classical image resampling (typically bilinear or bicubic interpolation) and cropping operations.

**Temporal sampling**: GAIA-2 processes sequences of 24 or 48 video frames "sampled at their native capture frequencies (20, 25, or 30 Hz)." Handling variable frame rates requires classical timestamp-based sampling -- selecting frames at specified temporal intervals regardless of the source frame rate.

**Normalization**: Input latents are normalized using "a fixed mean of mu_x = 0.0 and standard deviation sigma_x = 0.32, as empirically determined during tokenizer training." This z-score normalization is a classical statistical preprocessing step.

**Aspect ratio handling**: GAIA-1 resizes frames to a 9:16 aspect ratio. GAIA-2 uses 448x960 crops. Both require classical image resizing with interpolation.

None of these operations are learned. They are classical signal processing and image manipulation steps that must occur before any neural network processing begins.

---

### 19. Action Conditioning from Classical Vehicle Signals {#19-action-conditioning-from-classical-vehicle-signals}

#### CAN Bus to Neural Network Interface

GAIA world models are conditioned on ego-vehicle actions to enable controllable future prediction. These actions originate as classical vehicle signals:

**GAIA-1**: The action encoder takes scalar values of speed and curvature, which are independently projected into the model's shared representation space via learned linear projections. These scalars come from vehicle CAN bus measurements: speed from wheel encoder signals, curvature from steering angle and vehicle geometry via the classical bicycle model:

```
curvature = tan(steering_angle) / wheelbase
```

This kinematic relationship is classical vehicle dynamics.

**GAIA-2**: Actions are parameterized as speed and curvature, normalized with the symlog transform (Section 5). The embedding process: "Each action a_t is embedded to R^C" via a learnable projection, then injected into each transformer block through adaptive layer norm. The choice of adaptive layer norm over cross-attention was empirical: "action conditioning was more accurate when using adaptive layer norm."

**The classical-to-learned interface**: The raw CAN bus signals (wheel speeds, steering angle) undergo classical processing (filtering, kinematic model application) to produce the speed and curvature scalars. These scalars are then embedded by learned projections. The boundary between classical and learned is sharp: below the embedding, everything is classical signal processing; above it, everything is learned.

**SimLingo's kinematic bicycle model**: Wayve's SimLingo paper uses a classical kinematic bicycle model explicitly for its "Action Dreaming" technique, which generates synthetic instruction-action pairs. The bicycle model converts between waypoint representations and vehicle control commands using classical vehicle kinematics.

---

## Part VII: Calibration

### 20. Camera Calibration {#20-camera-calibration}

#### The Classical Foundation That Enables Everything

Camera calibration is the process of determining the intrinsic parameters (focal length, principal point, distortion coefficients) and extrinsic parameters (position and orientation relative to the vehicle) of each camera. This is one of the most critical classical components in Wayve's stack.

**Classical calibration methods**:
- **Checkerboard calibration**: The standard method (Zhang, 2000). A planar checkerboard pattern with known geometry is imaged from multiple viewpoints. Corner detection (classical feature detection) provides correspondences between known 3D points and observed 2D points. The intrinsic and distortion parameters are estimated by minimizing reprojection error using nonlinear least-squares optimization (Levenberg-Marquardt).
- **COLMAP SfM calibration**: Used for WayveScenes101. COLMAP simultaneously estimates camera intrinsics and extrinsics from natural feature correspondences across multiple images.
- **Target-based extrinsic calibration**: Mounting multiple cameras on a vehicle requires knowing their relative poses precisely. This is typically done using calibration targets (checkerboards, ArUco markers) visible to multiple cameras simultaneously, solving the multi-camera registration problem.

**The calibration data pipeline**: Wayve's fleet of vehicles across multiple countries (UK, US, Germany, Canada, Japan) each have cameras mounted in specific positions. Each vehicle must be calibrated:
1. Factory calibration: Initial intrinsic and extrinsic parameters determined during vehicle setup.
2. Online recalibration: Camera mounts can shift over time due to vibration, temperature, and physical contact. The system must detect and compensate for calibration drift.

#### Rig3R: Learning to Calibrate

Rig3R represents Wayve's most sophisticated approach to calibration, blending classical and learned methods:

**When calibration is known** (standard deployment): Rig3R accepts calibration as input via "raymaps" -- per-pixel encodings of ray directions computed from the known intrinsic and extrinsic matrices using classical projection. The model uses this classical geometric information to improve 3D reconstruction accuracy.

**When calibration is unknown** (new vehicle, shifted mount): Rig3R infers calibration from image content alone. It predicts:
1. **Pose raympas**: Per-pixel ray directions and global camera centers (encoding absolute camera pose).
2. **Rig raymaps**: Per-pixel rays and rig-frame camera centers (encoding relative camera poses within the rig).

From the predicted raymaps, camera parameters are recovered using classical geometric algebra:
- Focal lengths are computed analytically from angular constraints between pixel pairs: f_x = |delta_u| / tan(theta).
- Rotation matrices are solved via cross-covariance alignment and **Singular Value Decomposition (SVD)** -- a classical matrix factorization.
- The principal point is fixed to the image center (a classical assumption for well-manufactured cameras).

This is a profound hybrid: a learned model (ViT-Large transformer) predicts geometric quantities, which are then decoded using classical linear algebra operations. The model outperforms COLMAP (a purely classical pipeline) by 17-45% mAA on real-world driving benchmarks, demonstrating that the hybrid approach exceeds the classical method while still relying on classical mathematics for the final parameter recovery.

---

### 21. Cross-Platform Geometric Generalization {#21-cross-platform-geometric-generalization}

#### Classical Geometry Enabling Multi-Vehicle Deployment

Wayve deploys on multiple vehicle platforms (their own R&D fleet, Nissan ProPILOT prototypes, future OEM consumer vehicles) with different camera configurations. The classical geometry that enables this is:

**The camera model abstraction**: All cameras, regardless of their specific hardware, are described by the same classical pinhole model (intrinsics K, extrinsics [R|t], distortion coefficients). This abstraction means the neural network can operate on any camera by conditioning on these parameters.

**GAIA-2's camera encoding**: The model embeds intrinsics, extrinsics, and distortion via separate learnable projections summed into a unified encoding. This means a model trained on one camera configuration can generalize to another by simply providing the new camera parameters -- the model has learned how camera geometry maps to visual appearance.

**Rig3R's rig-awareness**: Each camera in a multi-camera rig is identified by a camera ID and a 6D raymap encoding its pose relative to the rig frame. During training, these metadata fields are "randomly dropped" to encourage robustness when information is unavailable. The model learns to handle:
- Known rig with known calibration (use rig constraints to improve accuracy)
- Known rig with unknown calibration (infer calibration from image content)
- Unknown rig configuration (discover rig structure from multi-view correspondences)

This flexibility is what enables Wayve's OEM licensing model: different automakers can use different camera placements, and the system adapts through classical geometry (providing new camera parameters) rather than requiring retraining.

**The classical requirement**: Even with learned adaptation, the fundamental geometric relationship between cameras and the world is classical. The system needs to know (or infer) the camera projection model -- there is no way to process multi-view images without understanding how 3D points map to 2D pixels, and this mapping is governed by classical optics and geometry.

---

## Part VIII: Safety Classical Components

### 22. Safety Envelope and Guardrails {#22-safety-envelope-and-guardrails}

#### The Classical Safety Layer Around the Learned System

Despite Wayve's commitment to end-to-end learning, their deployed system includes non-ML safety components. Wayve's Safety 2.0 framework "aligns with critical safety principles, including redundancy, fail-operational behaviors, and adherence to automotive safety standards such as ISO 26262 and SOTIF."

**NVIDIA Halos Safety System:**
Wayve's Gen 3 L4 platform is built on NVIDIA DRIVE AGX Thor, which includes the NVIDIA Halos comprehensive safety system. This system provides:
- **22,000+ platform safety monitors**: Classical runtime checks that continuously verify system health. These are not neural networks -- they are deterministic, rule-based monitors checking hardware and software states.
- **NVIDIA DriveOS**: A safety-certified ASIL-D operating system spanning CPU, GPU, I/O, and memory systems. ASIL-D (Automotive Safety Integrity Level D) is the highest safety level in ISO 26262, requiring rigorous classical safety engineering including failure mode and effects analysis (FMEA), fault tree analysis (FTA), and hardware reliability calculations.
- **Design-time guardrails**: Built-in hardware/software safety with deterministic execution guarantees -- classical real-time systems engineering.
- **Deployment-time guardrails**: Runtime monitoring and real-time introspection. These monitors check that the AI system's outputs are within physically plausible bounds, that sensor data is valid, and that the system is operating within its designed conditions.
- **Hundreds of built-in safety mechanisms** in the SoC hardware: Watchdog timers, ECC memory, lockstep CPU cores, voltage monitors -- all classical fault-tolerance mechanisms from safety-critical embedded systems engineering.

**Qualcomm Snapdragon Ride Active Safety Stack:**
For consumer deployment, Wayve's AI Driver layers on top of Qualcomm's "tightly integrated Active Safety software" within a "safety-certified architecture that includes redundancy, real-time monitoring, and secure system isolation." This Active Safety stack is a classical ADAS safety system providing:
- Redundant computation paths
- Deterministic safety monitoring
- Secure isolation between AI and safety-critical subsystems

**The classical safety cage**: The learned driving model operates within a classical safety envelope. The neural network proposes trajectories; the classical safety layer validates that these trajectories do not violate physical constraints (maximum deceleration, steering angle limits), do not command physically impossible maneuvers, and that the system is in a healthy state. This is analogous to how autopilot systems in aviation operate within classical flight envelope protection.

#### The Vehicle Controller

Wayve's "Reimagining an Autonomous Vehicle" paper (2021) explicitly states that "classical control methods together with learned representation and abstraction layers are still very effective at trajectory following." This reveals a critical architectural boundary:

- The **neural network** outputs a trajectory (a sequence of future positions and/or velocities).
- A **classical controller** (likely PID, MPC, or a hybrid) translates this trajectory into actuator commands (steering angle, throttle, brake pressure) that are sent to the vehicle via the CAN bus.

This classical controller handles:
- Trajectory tracking (minimizing the error between desired and actual trajectory)
- Actuator constraints (steering rate limits, braking force limits)
- Vehicle dynamics (the physical relationship between control inputs and vehicle motion)
- Real-time execution (deterministic control loops running at 50-100 Hz)

The controller is the last classical component before the physical world. It is not learned, and there are strong safety and regulatory reasons to keep it classical: deterministic behavior, provable stability, well-understood failure modes.

---

### 23. Operational Domain Detection {#23-operational-domain-detection}

#### Hybrid Statistical and Learned OOD Detection

Wayve's DriveSafeAI project (with WMG at the University of Warwick) develops safety assurance methodologies including Operational Design Domain (ODD) monitoring. The approach uses a novel "OASISS (ODD-based AI Safety In Self-Driving Systems)" methodology.

**ODD monitoring** requires detecting when the system is operating outside its designed operational conditions. This is inherently a hybrid problem:

**Classical components of ODD detection:**
- **Sensor health monitoring**: Checking that cameras are producing valid images (not blocked, not saturated, not failed). This involves classical image quality metrics: mean intensity, variance, gradient magnitude, histogram analysis.
- **Environmental condition detection**: Temperature, precipitation, visibility -- often from vehicle sensors (rain sensor, ambient light sensor) rather than learned perception.
- **Speed and road type monitoring**: Classical comparisons of vehicle state against ODD boundaries (e.g., maximum speed, minimum visibility distance).
- **Geofencing**: Classical GPS-based boundary checking to ensure the vehicle is within its approved operational area.

**Learned components of ODD detection:**
- **Epistemic uncertainty monitoring**: High epistemic uncertainty (from MC Dropout or ensemble disagreement) signals out-of-distribution inputs -- scenarios outside the training distribution. This is the Bayesian deep learning framework from Section 9.
- **Anomaly detection in the latent space**: Monitoring the model's internal representations for unusual patterns that indicate novel scenarios.
- **Introspection via language**: Wayve pioneers "methods for model introspection using natural language" -- the LINGO-series models can describe what they see and explain their decisions, providing a learned introspection capability.

**The hybrid boundary**: The ODD monitoring system likely uses classical thresholds on learned uncertainty metrics. The uncertainty is estimated by the neural network (learned); the threshold that triggers a safety response is a classical engineering parameter (determined by safety analysis, not learning).

---

### 24. Intervention Triggers {#24-intervention-triggers}

#### Rule-Based Triggers Around Learned Confidence

For systems with a safety driver (L2/L3), intervention triggers determine when the system requests or mandates human takeover. These triggers involve a mix of classical and learned components:

**Classical intervention triggers** (deterministic, rule-based):
- **Hardware fault detection**: Any sensor failure, compute failure, or communication failure triggers immediate handoff. These are classical watchdog/heartbeat monitors.
- **Actuator limit violation**: If the requested trajectory would require physically impossible actuator commands (exceeding steering rate, exceeding braking capacity), a classical bounds-checker rejects the command.
- **Communication timeout**: If the AI model fails to produce a valid trajectory within a deterministic time window, a classical fallback (e.g., controlled stop) is triggered.
- **Geofence violation**: Classical GPS boundary check.

**Learned intervention triggers** (uncertainty-based):
- **High prediction uncertainty**: If the model's uncertainty (aleatoric + epistemic) exceeds a calibrated threshold, the system signals that it is not confident and requests intervention.
- **Anomalous perception outputs**: If decoded auxiliary outputs (depth, semantics) are inconsistent with expectations, the system flags a potential perception failure.
- **Trajectory quality metrics**: If the predicted trajectory has properties that suggest unsafe behavior (excessive jerk, collision risk based on simple geometric checks), intervention is triggered.

**Ghost Gym's role**: Wayve's neural simulator (Ghost Gym) uses an "accurate vehicle dynamics model that captures the intricate physics of the vehicle's movement" -- a classical dynamics model. This is used during validation to ensure that proposed trajectories are physically feasible before real-world deployment. The dynamics model checks classical physics constraints: friction limits, rollover thresholds, acceleration bounds.

---

## Part IX: State Estimation

### 25. Vehicle State Estimation {#25-vehicle-state-estimation}

#### Classical Filtering for Ego-State

Vehicle state estimation -- determining the vehicle's position, velocity, orientation, and angular rates -- is a classical signal processing and control theory problem. Even in Wayve's end-to-end system, the vehicle state must be estimated from sensor data before it can be fed to the neural network or used for trajectory execution.

**State variables**:
- Position (x, y, z) in a local reference frame
- Velocity (v_x, v_y, v_z) in the body frame
- Orientation (roll, pitch, yaw) or as a quaternion
- Angular rates (roll rate, pitch rate, yaw rate)
- Acceleration (a_x, a_y, a_z)

**Classical estimation methods** (likely used by Wayve or by the vehicle platform's existing software):

**Extended Kalman Filter (EKF)**:
The industry-standard approach for nonlinear state estimation. The EKF fuses:
- Wheel speed sensors (velocity and yaw rate via differential wheel speeds)
- IMU (acceleration and angular velocity)
- GPS/GNSS (position and velocity, when available)

The prediction step uses a classical vehicle dynamics model (bicycle model or multi-body model):
```
x_{k+1} = f(x_k, u_k) + w_k
```
where f is the nonlinear state transition function, u_k are control inputs, and w_k is process noise.

The update step fuses sensor measurements using the classical Kalman gain:
```
K = P * H^T * (H * P * H^T + R)^(-1)
```
where P is the state covariance, H is the observation Jacobian, and R is the measurement noise covariance.

**Complementary filtering**: A computationally simpler alternative that fuses IMU (high-frequency, drift-prone) with wheel odometry (low-frequency, drift-free) using classical high-pass and low-pass filters. The IMU is high-pass filtered (trusting it for short-term dynamics) and wheel odometry is low-pass filtered (trusting it for long-term drift).

**Integration with the learned system**: The estimated vehicle state (speed, yaw rate, acceleration) is fed to the neural network as conditioning inputs. In GAIA-2, speed and curvature are the primary action conditioning signals. The state estimation happens entirely in the classical domain, upstream of any neural network processing.

---

### 26. Object State Filtering {#26-object-state-filtering}

#### An Open Question

Traditional AV perception pipelines include extensive classical filtering on tracked object states -- Kalman filters or particle filters smoothing detected object positions, velocities, and trajectories over time. The question is whether Wayve uses any such filtering on the outputs of their learned perception.

**Evidence against classical object filtering**: Wayve's end-to-end architecture explicitly avoids explicit object detection and tracking as intermediate representations. The learned model reasons about other agents implicitly in its latent space, without producing explicit bounding boxes or tracks that could be filtered.

**Evidence for some form of temporal smoothing**: The GAIA-2 world model conditions on 3D bounding boxes of dynamic agents when available. These bounding boxes must come from somewhere -- either from a learned perception model that detects objects, or from an external labeling pipeline. If the driving model consumes object detections at runtime, some form of temporal consistency (learned or classical) would be applied to prevent jittery detections from destabilizing downstream processing.

**The auxiliary decoder path**: Wayve decodes auxiliary outputs (semantics, depth, objects) from the model's latent state for interpretability and safety monitoring. If these decoded outputs are used for safety-critical monitoring (e.g., "is there a pedestrian in the planned trajectory?"), they may be filtered using classical temporal smoothing to reduce false positive/negative rates.

**Most likely**: Wayve does not use classical object state filtering in their primary decision pipeline (the end-to-end path from sensors to trajectory). However, the safety monitoring layer (Section 22) may apply classical filtering to decoded perception outputs used for safety verification.

---

## Part X: What Classical Methods Wayve Deliberately Removed

### 27. No HD Maps {#27-no-hd-maps}

#### What They Removed

HD maps in traditional AV stacks provide:
- Precise lane geometry (centerlines, boundaries, widths) at centimeter accuracy
- Traffic sign and signal locations
- Speed limits
- Intersection topology (which lanes connect to which)
- Crosswalk locations
- Road surface markings
- Grade (slope) information

Wayve replaced all of this with learned perception from raw sensor data, augmented only by standard satellite navigation (turn-by-turn directions, not geometric maps).

#### What Classical Localization They Don't Use

Traditional AV stacks use HD maps for **localization** -- determining the vehicle's precise position within the map. This involves:
- **Map matching**: Classical algorithms (e.g., Hidden Markov Model-based) that match sensor observations to map features.
- **Point cloud registration**: ICP (Iterative Closest Point) or NDT (Normal Distribution Transform) aligning LiDAR scans to a pre-built point cloud map.
- **Visual localization**: Matching image features to a pre-built visual map database.

Wayve uses none of these. Their system does not maintain or query a pre-built geometric representation of the environment. This eliminates an entire category of classical algorithms from their stack.

#### Why This Matters

HD maps are, philosophically, a pre-computed perception cache. They represent the output of a prior perception pass (mapping vehicle survey), stored and retrieved at runtime. By eliminating maps, Wayve forces their perception system to understand the road structure in real-time from sensor data alone. This removes:
- The mapping fleet and infrastructure (classical surveying)
- Map maintenance and update pipelines (classical data engineering)
- Map-matching localization algorithms (classical probabilistic inference)
- The failure mode of stale maps (road construction, temporary changes)

---

### 28. No Hand-Coded Rules {#28-no-hand-coded-rules}

#### What They Removed

Traditional AV perception and planning stacks include extensive rule-based logic:

**Perception rules removed:**
- Object classification rules (hand-coded feature thresholds for distinguishing pedestrians from cyclists)
- Lane detection algorithms (classical edge detection like Canny + Hough transform for lane line detection)
- Traffic light state machines (classical color thresholds in HSV space for red/yellow/green classification)
- Tracking algorithms (classical multi-hypothesis tracking, Hungarian algorithm for detection-to-track association)

**Planning rules removed:**
- Finite state machines for driving modes (cruising, following, passing, merging)
- Rule-based gap acceptance for lane changes and intersections
- Hand-coded safety rules (minimum following distance as a function of speed)
- Speed limit enforcement logic
- Construction zone handling rules

Wayve explicitly contrasts their approach: "No requirement for human labelling or hand crafting of motion plans through learning." They provide the specific example of learning to navigate double-parked vehicles without "designing a double-parked-vehicle detection system."

#### What Emerged Instead

Wayve's blog describes emergent behaviors that were never explicitly programmed:
- Navigating around double-parked vehicles
- Handling roundabouts, 4-way stops, unprotected turns
- Responding to pedestrian intent and cyclist behavior
- Adapting to cultural driving norms across countries

These behaviors emerge from the end-to-end training process rather than being hand-coded -- validating Wayve's thesis that "intelligent behaviour cannot be hand-coded, but can be learned through experience."

---

### 29. Remaining Classical Components -- Honest Accounting {#29-remaining-classical-components}

#### What Cannot Be Learned and Must Remain Classical

Even in the most aggressively end-to-end autonomous driving system in the world, the following classical components remain irreducible:

**1. Image Signal Processing (ISP)**
Cannot be absorbed into learning without redesigning the camera-to-compute interface. The ISP runs in dedicated hardware (on the camera sensor or SoC ISP block) and produces the RGB images that neural networks consume. This includes debayering, white balance, exposure control, gamma correction, noise reduction, and tone mapping.

**2. Camera Optics and Lens Physics**
The physical distortion introduced by lenses is governed by classical optics. Whether corrected in preprocessing or encoded as conditioning, the distortion model comes from classical calibration.

**3. Vehicle CAN Bus Interface**
The communication protocol between the AI compute module and the vehicle's actuators (steering, throttle, brake) is the CAN bus -- a classical serial bus standard from 1986. The AI system must speak this protocol to command the vehicle.

**4. Low-Level Vehicle Controller**
The trajectory tracking controller that converts desired trajectories into actuator commands is classical (PID, MPC, or similar). Wayve explicitly acknowledges that "classical control methods together with learned representation and abstraction layers are still very effective at trajectory following."

**5. Vehicle Dynamics (Physics)**
The physical relationship between control inputs and vehicle motion is governed by classical mechanics. The tire forces, suspension dynamics, mass distribution, and aerodynamics are physical phenomena that constrain what trajectories are feasible. Ghost Gym uses "an accurate vehicle dynamics model that captures the intricate physics of the vehicle's movement" -- this is a classical physics model, not learned.

**6. Camera Calibration (Initial)**
At some point, the initial camera parameters must be determined. Even Rig3R, which can infer calibration from images, was trained on data with known calibration from classical methods (COLMAP, checkerboard calibration). The initial calibration of training data is a classical bootstrap.

**7. Clock Synchronization**
Multi-camera systems require precise temporal synchronization (hardware trigger signals, PTP/IEEE 1588 time synchronization). This is classical embedded systems engineering.

**8. Safety Monitors**
The 22,000+ safety monitors on NVIDIA DRIVE AGX Thor, ASIL-D certified DriveOS, and Qualcomm's Active Safety stack are classical safety-critical systems engineering. These deterministic monitors cannot be replaced by learned systems without fundamentally changing the safety certification paradigm.

**9. Operating System and Real-Time Scheduling**
The real-time operating system that ensures deterministic execution of safety-critical tasks is classical RTOS engineering. The scheduling of neural network inference alongside safety monitors requires classical real-time systems design.

**10. Network Communication**
The communication between cameras, compute modules, actuators, and fleet management systems uses classical networking protocols (Ethernet, CAN, CAN-FD, potentially Automotive Ethernet). These are classical communication standards.

**11. GPS/GNSS**
Satellite positioning for route-level navigation (providing the sat-nav turn-by-turn directions that condition the driving model) is a classical signal processing system.

**12. Power Management and Thermal Control**
Managing power delivery to compute modules and maintaining thermal limits is classical electrical and thermal engineering.

#### The Honest Summary

Wayve has successfully learned:
- Perception (3D scene understanding, object recognition, depth estimation, semantic understanding)
- Prediction (future state prediction, agent behavior prediction)
- Planning (trajectory generation, decision making)
- Multi-task balancing (uncertainty-weighted loss functions)
- Calibration inference (Rig3R)
- World modeling (GAIA-series)

Wayve has NOT learned (and likely cannot learn):
- Image signal processing (hardware-bound)
- Physical optics (lens distortion, rolling shutter)
- Low-level vehicle control (safety-critical, must be deterministic)
- Vehicle dynamics (physics)
- Safety monitoring (must be certifiable, deterministic)
- Hardware interfaces (CAN bus, sensor I/O)
- Clock synchronization (hardware)
- Operating system services (scheduling, memory management)

The learned system operates within a classical cocoon: classical sensors produce signals that are classically processed into images, fed to a learned model that produces trajectories, which are classically controlled into actuator commands, monitored by classical safety systems, all running on a classical real-time operating system communicating over classical bus protocols.

The genius of Wayve's approach is not the elimination of classical methods -- it is the maximization of the learned component within the irreducible classical scaffolding. They have pushed the boundary of what can be learned further than any other AV company, but the boundary still exists, and it is defined by physics, safety certification, and hardware interfaces.

---

## Sources

### Wayve Official
- [Wayve Technology / AV2.0](https://wayve.ai/technology/)
- [Wayve Safety 2.0 Framework](https://wayve.ai/technology/safety-framework/)
- [PRISM-1 Blog](https://wayve.ai/thinking/prism-1/)
- [Sensor Stack Explained](https://wayve.ai/thinking/introducing-radar-wayves-lean-sensor-stack-explained/)
- [Emerging Behaviour Blog](https://wayve.ai/thinking/emerging-behaviour-of-our-driving-intelligence-with-end-to-end-deep-learning/)
- [Wayve Gen 3 / NVIDIA DRIVE AGX Thor](https://wayve.ai/thinking/wayve-gen-3/)
- [Rig3R Blog](https://wayve.ai/thinking/rig3r/)
- [Ghost Gym Blog](https://wayve.ai/thinking/ghost-gym-neural-simulator/)
- [Qualcomm-Wayve Collaboration](https://wayve.ai/press/qualcomm-wayve-collaboration/)
- [DriveSafeAI](https://drive-safe.ai/)
- [WayveScenes101](https://wayve.ai/science/wayvescenes101/)
- [Scaling GAIA-1](https://wayve.ai/thinking/scaling-gaia-1/)
- [GAIA-2 Blog](https://wayve.ai/thinking/gaia-2/)
- [Learning to Drive in a Day](https://wayve.ai/thinking/learning-to-drive-in-a-day/)

### Academic Papers
- [GAIA-2 Paper (arXiv 2503.20523)](https://arxiv.org/html/2503.20523v1)
- [Rig3R Paper (arXiv 2506.02265)](https://arxiv.org/html/2506.02265v1)
- [What Uncertainties Do We Need (NeurIPS 2017)](https://arxiv.org/abs/1703.04977)
- [Multi-Task Learning Using Uncertainty (CVPR 2018)](https://arxiv.org/abs/1705.07115)
- [Concrete Problems for AV Safety (IJCAI 2017)](https://www.semanticscholar.org/paper/Concrete-Problems-for-Autonomous-Vehicle-Safety:-of-McAllister-Gal/5b4f38765365f21088d336ebf428c491e270edc0)
- [Bayesian SegNet (BMVC 2017)](https://arxiv.org/abs/1511.02680)
- [Concrete Dropout (NeurIPS 2017)](https://arxiv.org/abs/1705.07832)
- [GC-Net (ICCV 2017)](https://arxiv.org/abs/1703.04309)
- [PoseNet (ICCV 2015)](https://arxiv.org/abs/1505.07427)
- [Alex Kendall PhD Thesis](https://www.repository.cam.ac.uk/items/1a01f251-1437-46fe-9fde-2a46b4dd6da6)
- [FIERY (ICCV 2021)](https://arxiv.org/abs/2104.10490)
- [MILE (NeurIPS 2022)](https://arxiv.org/abs/2210.07729)
- [WayveScenes101 Paper](https://arxiv.org/html/2407.08280)
- [Monodepth2 (ICCV 2019)](https://arxiv.org/abs/1806.01260)
- [SimLingo (CVPR 2025)](https://arxiv.org/abs/2503.09594)
- [Reimagining an Autonomous Vehicle (2021)](https://wayve.ai/wp-content/uploads/2024/04/2108.05805-1.pdf)
- [GAIA-1 Paper (arXiv 2309.17080)](https://arxiv.org/abs/2309.17080)

### Classical Foundations
- [3D Gaussian Splatting (Kerbl et al., 2023)](https://github.com/graphdeco-inria/gaussian-splatting)
- [COLMAP (Schonberger & Frahm, CVPR 2016)](https://colmap.github.io/)
- [EWA Splatting (Zwicker et al., 2001)](https://www.researchgate.net/publication/48546966_EWA_volume_splatting)
- [Spatial Transformer Networks (Jaderberg et al., 2015)](https://arxiv.org/abs/1506.02025)
- [ISP for Autonomous Driving (Buckler et al., 2017)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321211/)

### Safety and Platforms
- [NVIDIA Halos Safety System](https://www.nvidia.com/en-us/ai-trust-center/halos/autonomous-vehicles/)
- [NVIDIA DriveOS / DRIVE AGX Thor](https://www.nvidia.com/en-us/solutions/autonomous-vehicles/in-vehicle-computing/)
