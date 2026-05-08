# Nuro Perception Stack: Non-ML and Hybrid-ML Techniques — Exhaustive Deep Dive

*Last updated: March 2026*

---

## Table of Contents

**Sensor Signal Processing (6 Modalities)**
1. [Solid-State LiDAR Processing](#1-solid-state-lidar-processing)
2. [Imaging Radar Processing](#2-imaging-radar-processing)
3. [LWIR Thermal Camera Processing](#3-lwir-thermal-camera-processing)
4. [Camera ISP Pipeline](#4-camera-isp-pipeline)
5. [Microphone Array Processing](#5-microphone-array-processing)
6. [IMU Processing](#6-imu-processing)

**Calibration**
7. [Six-Modality Cross-Calibration](#7-six-modality-cross-calibration)
8. [LiDAR Calibration Patents](#8-lidar-calibration-patents)
9. [Geospatial Foundation Model Calibration](#9-geospatial-foundation-model-calibration)
10. [Online Calibration](#10-online-calibration)

**Delivery-Specific Classical Methods**
11. [Curbside Detection](#11-curbside-detection)
12. [Sidewalk Navigation](#12-sidewalk-navigation)
13. [Low-Speed Operation](#13-low-speed-operation)
14. [Residential Road Geometry](#14-residential-road-geometry)
15. [Pet/Animal Detection Classical Components](#15-petanimal-detection-classical-components)

**State Estimation and Tracking**
16. [Low-Speed Tracking](#16-low-speed-tracking)
17. [Pedestrian Tracking](#17-pedestrian-tracking)
18. [Stationary Object Tracking](#18-stationary-object-tracking)

**Localization**
19. [Geospatial Localization Classical Components](#19-geospatial-localization-classical-components)
20. [GPS/GNSS Processing](#20-gpsgnss-processing)
21. [Visual Odometry](#21-visual-odometry)

**Zero-Occupant Safety Classical Methods**
22. [External Airbag Trigger Logic](#22-external-airbag-trigger-logic)
23. [Energy-Absorbing Front Panel](#23-energy-absorbing-front-panel)
24. [Conservative Braking Rules](#24-conservative-braking-rules)

**FTL Compiler Classical Components**
25. [ONNX Graph Processing](#25-onnx-graph-processing)
26. [TensorRT Integration](#26-tensorrt-integration)
27. [Multi-GPU Pipeline Parallelism](#27-multi-gpu-pipeline-parallelism)
28. [Quantization](#28-quantization)

**DARPA Urban Challenge Heritage**
29. [Dave Ferguson's Classical Methods](#29-dave-fergusons-classical-methods)
30. [Classical Robotics DNA](#30-classical-robotics-dna)

**Hybrid ML+Classical**
31. [Sensor Dropout Training](#31-sensor-dropout-training)
32. [RL Classical Components](#32-rl-classical-components)
33. [Recovery RL Safety Filtering](#33-recovery-rl-safety-filtering)

---

## 1. Solid-State LiDAR Processing

### Raw Signal Chain

Nuro's next-generation sensor architecture replaced the single roof-mounted rotary LiDAR (used on R2) with a distributed array of solid-state LiDAR sensors mounted around the vehicle perimeter. Solid-state LiDAR eliminates mechanical spinning parts and employs fixed or MEMS-based scanning mechanisms, improving durability and enabling flush or near-flush integration into vehicle body panels.

The raw signal chain for solid-state LiDAR follows the classical time-of-flight (ToF) measurement principle:

1. **Laser emission.** The transmitter emits short laser pulses (or continuous modulated signals) from a linear array of laser diodes. Nuro's LiDAR patent (US20200150278A1) specifies near-infrared light (example wavelength: 1000 nm), with laser diode arrays producing a collection of points in a line (typically vertical). The emitting lens shapes the beam -- collimating/converging in the horizontal direction and spreading/diverging in the vertical direction.

2. **Pulse propagation and reflection.** Laser pulses propagate outward, reflect off surfaces and objects, and return to the sensor. The reflected signal intensity depends on surface material, angle of incidence, distance, and atmospheric conditions.

3. **Photodetection.** Returned light is captured by photodetectors (photodiodes, photomultipliers, or avalanche photodiode arrays as specified in Nuro's patent). The detector converts optical energy to electrical signals proportional to intensity. Optical filtering uses tangential plane alignment so that only light reflected from the intended direction is directed to the detector, rejecting stray reflections.

4. **Range computation.** Distance to each point is computed from the round-trip time of the light pulse: `d = c * t / 2`, where `c` is the speed of light and `t` is the measured time delay. This can be implemented through direct ToF measurement (counting time between emission and detection) or through modulation-based approaches (measuring phase shift of a modulated signal).

5. **Point cloud assembly.** Individual range measurements, combined with known beam angles from the scanning mechanism, produce a set of 3D points (x, y, z) with associated intensity values reflecting the strength of the return signal.

### Intensity Calibration

LiDAR intensity values require calibration because:
- Different surface types (asphalt, metal, fabric, skin, foliage) reflect laser light with vastly different reflectivities
- Range affects signal strength via the inverse-square law
- Angle of incidence affects return intensity
- Atmospheric attenuation (rain, fog, dust) reduces signal strength
- Sensor aging and contamination alter detector sensitivity

Classical intensity calibration applies corrections based on measured range (compensating for inverse-square falloff), known sensor response curves, and empirical reflectivity models. This calibration is essential for consistent feature extraction downstream, since the LiDAR encoder in Nuro's unified perception model relies on both geometric and intensity features.

### Distributed Mounting Implications

Nuro's distributed solid-state architecture -- with multiple small sensors mounted around the vehicle perimeter -- introduces classical signal processing challenges not present in single-sensor systems:

**Time synchronization.** All distributed sensors must be precisely time-synchronized (typically to microsecond precision) so that point clouds from different sensors can be coherently merged. This requires hardware-level clock distribution or PTP (Precision Time Protocol) synchronization, a classical networking/signal processing technique.

**Coordinate frame registration.** Each sensor has its own local coordinate frame defined by its mounting position and orientation. Classical rigid-body transformation (rotation matrix + translation vector) converts each sensor's points into a unified vehicle coordinate frame. These extrinsic calibration parameters must be precisely known and maintained (see Section 7).

**Field-of-view tiling.** Unlike a spinning LiDAR with inherent 360-degree coverage, solid-state sensors have limited fields of view (Nuro's patent specifies 3-60 degrees in the Y direction). Multiple sensors must be tiled to achieve full coverage, requiring classical geometric analysis to ensure no blind spots exist in the composite coverage pattern.

**Overlap processing.** Where sensor fields of view overlap, the same surface may generate returns from multiple sensors. Classical point cloud merging algorithms (nearest-neighbor matching, ICP variants) resolve duplicate points and improve density in overlap regions.

### LiDAR-Specific Classical Processing

Before entering the neural network encoder, raw point clouds undergo classical preprocessing:

- **Ground plane extraction.** Classical RANSAC-based ground plane fitting or grid-based height analysis separates ground returns from obstacle returns, reducing the data volume that downstream processing must handle.
- **Noise filtering.** Statistical outlier removal (identifying points whose distance to neighbors exceeds a threshold) eliminates spurious returns from dust, rain, or sensor noise.
- **Motion compensation.** Because the vehicle moves during each scan sweep, raw point clouds exhibit motion distortion. Classical ego-motion compensation applies the vehicle's known velocity (from IMU/odometry) to deskew the point cloud, shifting each point to its position at a reference timestamp.
- **Voxelization.** Point clouds are discretized into a 3D voxel grid for efficient processing. This is a classical spatial data structure operation (3D grid hashing) that converts irregular point data into a regular grid format suitable for the neural network encoder.

---

## 2. Imaging Radar Processing

### Imaging Radar vs. Conventional Radar

Nuro uses long-range, high-resolution 77 GHz imaging radar -- a substantial upgrade from conventional automotive radar. The key distinction is angular resolution: conventional automotive radar resolves targets at roughly 10-15 degrees, while imaging radar achieves approximately 1-2 degrees through MIMO (Multiple-Input Multiple-Output) antenna configurations with many virtual channels. This higher angular resolution enables imaging radar to produce dense 4D point clouds (range, azimuth, elevation, Doppler velocity) approaching the density of sparse LiDAR.

### FMCW Signal Chain

Nuro's 77 GHz radars use Frequency-Modulated Continuous-Wave (FMCW) waveforms. The classical signal processing chain is:

1. **Chirp transmission.** The transmitter generates a linear frequency ramp (chirp) sweeping across the allocated bandwidth (76-77 GHz for long-range, 77-81 GHz for short-range). Multiple TX antennas transmit either simultaneously (with orthogonal waveforms via MIMO multiplexing) or sequentially (TDM-MIMO).

2. **Beat signal generation.** The received echo is mixed with the transmitted chirp to produce a beat (intermediate frequency) signal. The beat frequency is proportional to the range to the target: `f_beat = (2 * R * BW) / (c * T_chirp)`, where `R` is range, `BW` is chirp bandwidth, `c` is the speed of light, and `T_chirp` is chirp duration.

3. **Range-FFT (fast-time FFT).** A 1D FFT along each chirp's time samples resolves targets in range. Each bin in the output corresponds to a discrete range cell.

4. **Doppler-FFT (slow-time FFT).** A second FFT across multiple chirps at each range bin resolves targets in velocity via the Doppler shift. The result is a 2D Range-Doppler (RD) map. This 2D FFT processing is a purely classical signal processing operation.

5. **CFAR detection.** A Constant False Alarm Rate detector scans the Range-Doppler map to identify peaks (target detections) above an adaptive threshold. Nuro's radar engineer job posting explicitly requires knowledge of CFAR algorithms. Common variants include CA-CFAR (Cell-Averaging), CASO-CFAR (Cell-Averaging Smallest Of), and OS-CFAR (Ordered Statistics), all classical detection theory algorithms.

6. **Direction-of-arrival (DOA) estimation.** For each detected peak in the Range-Doppler map, DOA estimation computes azimuth and elevation angles from the phase differences across the MIMO virtual antenna array. Classical algorithms include:
   - **FFT-based beamforming**: Fast but limited angular resolution
   - **Capon (MVDR) beamforming**: Higher resolution but computationally expensive
   - **MUSIC/ESPRIT**: Super-resolution algorithms for closely-spaced targets
   - **Parametric spectral analysis**: Required per Nuro's radar engineer job description

7. **4D point cloud generation.** Detected targets are converted from (range, Doppler, azimuth, elevation) to Cartesian coordinates (x, y, z) with associated velocity, producing a 4D radar point cloud.

### MIMO Processing

Nuro's radar engineer job posting explicitly requires "phased array antenna designs, beamforming algorithms, MIMO radar multiplexing algorithms." MIMO radar creates a virtual antenna array larger than the physical array by using multiple transmit and receive antennas:

- **TDM-MIMO (Time-Division Multiplexing):** TX antennas transmit sequentially; simple but limits maximum unambiguous velocity.
- **DDM-MIMO (Doppler-Division Multiplexing):** TX antennas transmit simultaneously with different Doppler shifts applied to each; maintains orthogonality in the frequency domain.
- **DDMA (Doppler Division Multiple Access):** An advanced variant that resolves velocity ambiguities using dual-PRF waveforms.

The virtual array formed by MIMO has `N_TX * N_RX` elements, providing angular resolution proportional to the virtual aperture size -- this is the mechanism by which imaging radar achieves much finer angular resolution than conventional radar with a compact physical form factor.

### Doppler Velocity Extraction

Radar's unique advantage is direct velocity measurement via the Doppler effect. Unlike cameras or LiDAR (which infer velocity from position changes across frames), radar measures instantaneous radial velocity for every detection:

`v_radial = (f_doppler * lambda) / 2`

where `f_doppler` is the measured Doppler frequency and `lambda` is the wavelength.

Key classical processing steps for Doppler:
- **Velocity ambiguity resolution.** The maximum unambiguous velocity is limited by the pulse repetition frequency (PRF). Dual-PRF or staggered-PRF techniques (classical signal processing) resolve these ambiguities.
- **Static vs. dynamic separation.** Stationary objects have Doppler velocities corresponding to the ego vehicle's own motion. Classical thresholding separates static scene elements (road, buildings) from moving objects (vehicles, pedestrians), providing independent ego-velocity estimation.
- **Micro-Doppler analysis.** Fine-grained Doppler signatures can distinguish pedestrians (swinging limbs produce characteristic micro-Doppler patterns) from other objects -- a classical radar signal processing technique relevant to Nuro's pedestrian safety priority.

### RF Calibration and Interference Mitigation

Nuro's radar engineer role requires "RF calibration, parameter estimation, and interference mitigation":
- **RF calibration** compensates for gain/phase variations across antenna elements, ensuring accurate beamforming and DOA estimation.
- **Interference mitigation** handles mutual interference from other vehicles' radars (a growing problem as automotive radar proliferates), using classical techniques such as adaptive filtering, interference cancellation, and frequency agility.
- **Ghost target filtering.** Radar sensors generate specific classes of false echoes (multi-bounce reflections, sidelobes). Classical heuristic filtering based on physical constraints (e.g., implausible positions, inconsistent Doppler) removes these artifacts. The DARPA Urban Challenge Boss vehicle explicitly used heuristic filters for radar ghost rejection.

---

## 3. LWIR Thermal Camera Processing

### Uncooled Microbolometer Signal Chain

Nuro's thermal cameras operate in the Long-Wave Infrared (LWIR) spectrum (8-14 micrometers), using uncooled microbolometer detector arrays. The detector technology and signal chain are entirely classical:

**Detector physics.** Each pixel in the microbolometer array contains a temperature-sensitive resistor, typically constructed from either:
- **Vanadium oxide (VOx):** Industry standard for automotive LWIR (used in FLIR/Teledyne Boson modules). 12-micrometer pixel pitch is now standard.
- **Amorphous silicon (a-Si):** Alternative material used by some manufacturers.

The microbolometer's resistance changes as incident infrared radiation heats the detector element. This resistance change is measured to produce a signal proportional to the scene's thermal radiation at each pixel. This is a purely passive sensor -- it detects emitted thermal radiation rather than reflected light.

### Non-Uniformity Correction (NUC)

NUC is the most critical classical signal processing step in the thermal camera pipeline. Microbolometer fabrication variations cause different pixels to respond differently to the same thermal input, creating a fixed-pattern noise overlay on the image.

**Two-point NUC (classical calibration):**
1. The sensor views a uniform "cold" reference (blackbody at known temperature T_cold), recording each pixel's response: `R_cold(i,j)`
2. The sensor views a uniform "warm" reference at temperature T_warm, recording: `R_warm(i,j)`
3. For each pixel, offset and gain correction factors are computed:
   - `gain(i,j) = (T_warm - T_cold) / (R_warm(i,j) - R_cold(i,j))`
   - `offset(i,j) = T_cold - gain(i,j) * R_cold(i,j)`
4. During operation, each pixel's raw response is corrected: `T_corrected(i,j) = gain(i,j) * R_raw(i,j) + offset(i,j)`

**Shuttered vs. shutterless operation.** Some LWIR cameras use a mechanical shutter that periodically closes to provide a uniform reference for drift correction. Shutterless cameras (preferred for automotive due to reliability) use scene-based NUC algorithms that estimate drift from the scene statistics themselves -- a classical signal processing technique using temporal filtering and spatial statistics.

**1/f noise correction.** Microbolometers exhibit 1/f (flicker) noise that manifests as slow temporal drift. Classical high-pass temporal filtering or drift-tracking algorithms compensate for this.

### NETD (Noise Equivalent Temperature Difference)

NETD quantifies the smallest temperature difference the sensor can detect. Automotive-grade LWIR cameras achieve NETD of approximately 20-50 mK. State-of-the-art uncooled sensors (e.g., FLIR Boson) achieve less than 20 mK NETD, enabling detection of subtle temperature variations such as:
- A pedestrian's body heat against ambient background (typical delta of 10-15 degrees C, far above NETD threshold)
- An animal's thermal signature against cooler nighttime surroundings
- Recently-parked cars with warm engines vs. cold parked cars

### Temperature-to-Signal Conversion

Converting raw detector output to a meaningful thermal image involves classical physics:
- **Planck's law** governs the spectral radiance emitted by objects at temperature T in the LWIR band. Living objects (mammals at approximately 37 degrees C) have peak emission near 10 micrometers, coinciding with the 8-14 micrometer LWIR band -- this is why thermal cameras are so effective at detecting pedestrians and animals.
- **Emissivity correction.** Different materials have different emissivities (human skin approximately 0.98, metal approximately 0.1-0.3, road surface approximately 0.9). Classical radiometric calibration accounts for emissivity variations.
- **Atmospheric transmission.** The LWIR band is selected precisely because the atmosphere has a transmission window in this range, but humidity, rain, and dust still cause some attenuation. Classical atmospheric correction models compensate.
- **Reflected thermal radiation.** Hot surfaces (sun-heated pavement) or reflected thermal sources can create confusing thermal signatures. Classical scene analysis identifies and mitigates these effects.

### Thermal-Specific Image Processing

Before feeding into the thermal encoder of the unified perception model:
- **Bad pixel replacement.** Defective microbolometer elements produce consistently wrong values and are replaced by interpolating from neighbors (classical spatial interpolation).
- **Temporal noise filtering.** Frame-to-frame noise is reduced by classical temporal averaging or recursive filtering, trading temporal resolution for signal quality.
- **Contrast enhancement.** Histogram equalization or adaptive contrast stretching (classical image processing) improves visual contrast between pedestrians and background, enhancing the features available to the neural network encoder.
- **AGC (Automatic Gain Control).** Classical feedback control adjusts the sensor's dynamic range to the scene's thermal content, preventing saturation in hot scenes or noise domination in cold scenes.

---

## 4. Camera ISP Pipeline

### Multi-Category Camera Architecture

Nuro's next-generation sensor architecture features four categories of cameras, each with distinct ISP (Image Signal Processor) requirements:

1. **Ultra-long-range cameras:** Narrow field of view, high resolution, optimized for distant object detection at highway speeds
2. **Long-range cameras:** Primary detection cameras for typical driving distances
3. **Short-range cameras:** Wide field of view for close-range perception during curbside operations, parking, and tight maneuvering
4. **Traffic light detection cameras:** Specialized for traffic signal recognition with optimized color accuracy

All cameras feed through a classical ISP pipeline before their images enter the camera encoder (now a Vision Transformer / ViT architecture) of the unified perception model.

### Classical ISP Processing Stages

The image signal processor performs a sequence of classical image processing operations on the raw sensor output:

**1. Linearization.** The raw sensor output has a non-linear response due to tone-mapping applied at the sensor level. Linearization converts these non-linear responses back to linear values, which is required for subsequent processing steps like white balance. This is a classical lookup-table or polynomial correction operation.

**2. Debayering (Demosaicing).** Automotive image sensors use a Bayer Color Filter Array (CFA) where each pixel captures only one color channel (R, G, or B). Demosaicing interpolates the missing color values to reconstruct a full-color RGB image at each pixel. Classical algorithms include:
- Bilinear interpolation (fastest, lowest quality)
- Edge-directed interpolation (Malvar-He-Cutler, Hamilton-Adams)
- Adaptive algorithms that detect edges and interpolate along them rather than across them

**3. Denoising.** Noise reduction removes photon shot noise, read noise, and thermal noise from the sensor. Classical approaches include:
- 2D spatial filtering (Gaussian, bilateral filtering)
- Non-local means denoising
- Wavelet-domain denoising
The key trade-off is between noise removal and texture preservation -- aggressive denoising that blurs fine details can degrade downstream perception performance.

**4. White balance.** Color temperature correction ensures consistent color representation across different lighting conditions (sunlight, shade, artificial light, twilight). Classical white balance algorithms analyze scene statistics (gray-world assumption, white-patch assumption) or use illuminant estimation to determine correction factors for each color channel.

**5. HDR (High Dynamic Range) processing.** Automotive scenes frequently contain extreme dynamic range -- direct sunlight, shadows, tunnel entries/exits, headlights at night. HDR processing combines multiple exposures or applies tone mapping to compress the sensor's dynamic range into a displayable/processable range. Automotive ISPs like the OAX4000 handle up to 140 dB HDR. Classical tone mapping algorithms (Reinhard, Durand-Dorsey, adaptive histogram equalization) compress dynamic range while preserving local contrast.

**6. Color correction.** A 3x3 color correction matrix transforms the sensor's native color space to a standardized color space, compensating for the spectral response of the specific sensor and filter combination. This is critical for traffic light cameras where accurate red/yellow/green discrimination is safety-critical.

**7. Gamma correction.** Applies a non-linear transfer function to match human visual perception or optimize for neural network input. Some autonomous driving systems feed linear images directly to networks; others apply gamma for better feature extraction.

**8. Lens distortion correction.** All camera lenses introduce geometric distortion (barrel or pincushion). Classical lens distortion models (Brown-Conrady model with radial and tangential coefficients) are applied per-pixel to produce rectified images with straight lines appearing straight. This geometric correction is essential for accurate 2D-to-3D projection in the fusion module.

**9. Auto-exposure.** Classical feedback control algorithms adjust exposure time and gain to maintain optimal image brightness across varying lighting conditions. Automotive-specific auto-exposure must handle rapid transitions (tunnel entry/exit) and prioritize exposure for the most safety-critical regions of the image (typically the road and its immediate surroundings rather than the sky).

**10. Flicker mitigation.** LED traffic lights and signs flicker at frequencies that can cause them to appear off in some camera frames. Classical anti-flicker algorithms detect and compensate for LED flicker by adjusting exposure timing relative to the power line frequency (50/60 Hz).

---

## 5. Microphone Array Processing

### Hardware Architecture

Nuro's vehicles are equipped with a distributed array of multiple microphones placed around the vehicle body, designed for 360-degree audio awareness with emphasis on emergency vehicle siren detection. The microphone array enables both detection (is a siren present?) and localization (where is it coming from?).

### Classical Signal Processing Pipeline

The audio processing pipeline involves several classical signal processing stages that operate before or alongside the neural network components of the unified siren perception model ("Building Better Ears," November 2025, authors Roshan Benefo and Jia Pu):

**1. Analog-to-digital conversion and framing.** Raw audio from each microphone is digitized at a sample rate sufficient to capture siren frequencies (sirens typically operate in the 500 Hz to 3000 Hz range). Audio is segmented into overlapping frames (typically 20-50 ms windows) for spectral analysis.

**2. Short-Time Fourier Transform (STFT).** Each audio frame undergoes windowed FFT (Hanning or Hamming window) to produce a time-frequency representation (spectrogram). This classical transform decomposes the audio signal into its frequency components over time, making siren harmonics visible as distinct frequency tracks.

**3. Mel-spectrogram computation.** The linear-frequency spectrogram is converted to a mel-scale representation by applying a bank of triangular filters spaced according to the mel scale (which models human auditory perception). The mel-spectrogram is typically computed at 64 or 128 mel bins and serves as the primary feature representation for siren classification. The log-mel spectrogram (log of mel-spectrogram values) is the standard input format for audio neural networks.

**4. MFCC extraction.** Mel-Frequency Cepstral Coefficients (MFCCs) are computed by applying a Discrete Cosine Transform to the log-mel spectrogram. MFCCs capture the spectral envelope shape, which distinguishes siren patterns from other sounds. These are classical features from speech processing, adapted for siren detection.

**5. Frequency band filtering.** Siren signals have characteristic frequency profiles:
- Electronic sirens: swept tones typically between 500 Hz and 1800 Hz
- Mechanical sirens: broader spectral content
- Air horns: lower frequency, typically 200-500 Hz
Classical bandpass filtering isolates these frequency ranges, improving signal-to-noise ratio for siren detection before neural network processing.

### Direction-of-Arrival (DOA) Estimation

Determining the direction of an approaching emergency vehicle is critical for the autonomous vehicle to execute the correct pullover maneuver. Classical DOA algorithms used with microphone arrays include:

**GCC-PHAT (Generalized Cross-Correlation with Phase Transform).** Computes the cross-correlation between pairs of microphones with phase-transform weighting. The time delay at the correlation peak indicates the difference in arrival time between microphones, which geometrically constrains the source direction. GCC-PHAT is robust to reverberation and noise, making it suitable for outdoor automotive environments.

**SRP-PHAT (Steered Response Power with Phase Transform).** Scans a grid of candidate source directions, computing the steered response power at each point. The direction with maximum power is the estimated source direction. SRP-PHAT with hierarchical search (coarse grid then fine grid) provides good accuracy with reduced computation. Research shows it performs well even with modest microphone counts (8-16 microphones) and low-cost hardware.

**Beamforming.** Classical delay-and-sum beamforming or MVDR (Minimum Variance Distortionless Response) beamforming focuses the array's sensitivity in a specific direction. By scanning the beam across all directions, the system builds an angular power spectrum revealing the direction of siren sources. MVDR beamforming provides higher angular resolution than delay-and-sum by placing nulls in the direction of interference.

### Ambient Noise Rejection

Automotive environments are noisy: tire noise, wind, engine sounds from other vehicles, construction, music, and general urban ambient noise all interfere with siren detection. Classical noise rejection techniques include:

- **Spectral subtraction.** Estimates the noise spectrum during siren-free intervals and subtracts it from the current spectrum.
- **Adaptive filtering.** Wiener or LMS filters adapt to the current noise profile and extract the siren signal.
- **Spatial filtering via beamforming.** The microphone array can null noise from specific directions while maintaining sensitivity toward the siren direction.
- **Harmonic analysis.** Sirens have strong harmonic structure (integer-multiple frequency relationships) that classical harmonic detection algorithms can identify against non-harmonic noise backgrounds.

### The Unified Siren Model: Classical + ML

Nuro's "Building Better Ears" unified siren perception model combines classical audio feature extraction (spectrograms, mel-spectrograms, MFCCs) with neural network classification. Research in this domain shows that architectures like SirenNet achieve 98.24% accuracy using parallel CNN branches -- one processing raw waveforms, another processing MFCCs and log-mel spectrograms -- with outputs fused via softmax averaging. The classical feature extraction stages (FFT, mel filtering, MFCC computation, DOA estimation) provide the structured representations that make the neural network's classification task tractable. The audio encoder processes these features and feeds them into the unified perception model alongside visual and spatial sensor data, enabling cross-modal correlation (hearing a siren + seeing flashing lights).

---

## 6. IMU Processing

### ASIL-D IMU Specifications

Nuro's sensor suite includes an ASIL-D rated Inertial Measurement Unit -- the highest Automotive Safety Integrity Level defined by ISO 26262. ASIL-D designation means the IMU meets the most stringent requirements for hardware failure probability (less than 10^-8 failures per hour for random hardware faults) and systematic safety integrity. This rating reflects the IMU's role as a safety-critical component: it provides vehicle state information essential for emergency braking, stability control, and fallback navigation.

The IMU contains:
- **Three-axis accelerometer**: Measures specific force (linear acceleration minus gravity) along three orthogonal axes
- **Three-axis rate gyroscope**: Measures angular velocity (rotation rate) around three orthogonal axes

Automotive MEMS IMUs for ASIL-D applications achieve gyroscope bias stability of approximately 0.9 degrees/hour and gyro RMS noise below 0.007 degrees/second (based on automotive-grade MEMS specifications).

### Strapdown Mechanization Equations

Modern automotive IMUs use strapdown configuration, where the sensors are rigidly attached to the vehicle body and stabilized computationally rather than mechanically. The classical mechanization equations transform raw IMU measurements into navigation information:

**Attitude update.** The gyroscope measurements (angular velocities omega_x, omega_y, omega_z) are integrated to update the vehicle's orientation (roll, pitch, yaw). This integration uses the rotation matrix or quaternion differential equation:

`dq/dt = 0.5 * q * omega`

where q is the orientation quaternion and omega is the angular velocity vector represented as a pure quaternion. This is a classical ordinary differential equation integration, typically implemented with fourth-order Runge-Kutta or equivalent numerical integration methods.

**Velocity update.** Accelerometer measurements are rotated from the body frame to the navigation frame using the current attitude estimate, then gravity is subtracted:

`dv/dt = R_body_to_nav * f_specific - g`

where R is the rotation matrix from body to navigation frame, f_specific is the measured specific force, and g is the local gravity vector.

**Position update.** Velocity is integrated to obtain position:

`dp/dt = v`

### Bias Estimation

IMU biases are the dominant error source and require continuous estimation:

**Accelerometer bias.** A constant offset in acceleration measurement that, when integrated twice, causes quadratically-growing position errors. Typical automotive MEMS accelerometer biases are on the order of milligravities (mg).

**Gyroscope bias.** A constant offset in angular velocity measurement that causes linearly-growing attitude errors, which then contaminate velocity and position. Even small gyroscope biases (a few degrees/hour) accumulate rapidly.

**Bias estimation via Kalman filtering.** The classical approach augments the navigation state vector with bias states and uses external measurements (GPS, LiDAR-based localization, visual odometry) to observe and estimate biases in real time. The Extended Kalman Filter (EKF) is the standard algorithm for this loosely-coupled or tightly-coupled INS/GNSS integration.

**Allan variance characterization.** The noise properties of the IMU are characterized using Allan variance analysis, which decomposes sensor noise into distinct components:
- **Angle/velocity random walk**: White noise component, quantified as degrees/sqrt(hour)
- **Bias instability**: The minimum of the Allan variance curve, representing the best achievable bias stability
- **Rate random walk**: Low-frequency random drift
- **1/f noise**: Flicker noise component

### Gravity Alignment

During initialization, the IMU must determine its orientation relative to gravity. Classical gravity alignment uses the accelerometer measurements when the vehicle is stationary:

`pitch_0 = atan2(-a_x, sqrt(a_y^2 + a_z^2))`
`roll_0 = atan2(a_y, a_z)`

This provides initial pitch and roll estimates. Heading (yaw) cannot be determined from accelerometers alone and requires magnetometer data, GPS heading, or other external references.

### Vibration Filtering

Delivery vehicles traversing residential roads encounter significant vibrations from:
- Speed bumps and road imperfections
- Cargo loading/unloading
- Curbside approach over uneven surfaces
- Construction-damaged roads

Classical vibration filtering techniques include:
- **Low-pass filtering** of accelerometer data to separate vehicle dynamics from high-frequency vibration
- **Anti-aliasing filters** (analog, before ADC) to prevent high-frequency vibration from aliasing into the navigation band
- **Coning and sculling compensation** algorithms that correct for the interaction between rotation and vibration in strapdown systems -- classical algorithms that account for the non-commutativity of finite rotations

---

## 7. Six-Modality Cross-Calibration

### The Challenge

Nuro's six sensor modalities (LiDAR, cameras, radar, thermal cameras, microphones, IMU) operate on fundamentally different physical principles, produce data in different formats, and are mounted at different locations on the vehicle. Cross-calibrating all pairs of modalities requires determining precise spatial and temporal relationships between each sensor. With 6 modalities, there are 15 unique pairwise calibration relationships to maintain.

### Extrinsic Calibration (Spatial Registration)

Extrinsic calibration determines the 6-DOF rigid-body transformation (3 translation + 3 rotation parameters) between each sensor pair:

**LiDAR-to-camera.** The most common calibration pair. Classical approaches use:
- **Target-based (offline):** Placing a known calibration target (checkerboard or ArUco markers) visible to both sensors and solving for the transformation that aligns 3D LiDAR points on the target with their 2D camera projections. This is a classical Perspective-n-Point (PnP) problem solved via non-linear least-squares optimization (Levenberg-Marquardt).
- **Targetless (online):** Extracting natural features (edges, planes, corners) from both LiDAR and camera data and finding the transformation that maximizes feature alignment. Nuro's calibration team explicitly develops "online and offline unstructured (targetless) sensor calibration algorithms."

**LiDAR-to-radar.** More challenging because radar point clouds are sparser and noisier. Classical approaches align detections of common targets (corner reflectors for calibration, or vehicles/infrastructure in the natural scene) across both modalities.

**Thermal-to-RGB calibration.** Particularly challenging because thermal and visible-light images have fundamentally different appearance (thermal images show heat patterns, visible images show reflectance). Classical approaches:
- Use specially designed calibration targets that are visible in both modalities (e.g., heated patterns on a board)
- Extract common structural features (building edges, vehicle outlines) that appear in both modalities
- Recent research enables targetless LiDAR-RGB-thermal calibration using shared geometric features

**Microphone spatial calibration.** The positions of microphones relative to the vehicle frame must be precisely known for DOA estimation. Classical calibration uses known sound sources at known positions and solves for microphone positions via time-delay analysis.

**IMU-to-vehicle calibration.** Determines the IMU's mounting orientation relative to the vehicle frame. Classical calibration involves driving specific maneuvers (straight line, figure-eight) and estimating the misalignment that best explains the observed motion.

### Intrinsic Calibration

Each sensor also requires intrinsic calibration of its internal parameters:
- **Camera intrinsics:** Focal length, principal point, distortion coefficients (Brown-Conrady model). Classical calibration uses multiple images of a known pattern (Zhang's method) to solve a non-linear optimization.
- **LiDAR intrinsics:** Nuro's patent US20190018109A1 addresses manufacturing-induced discrepancies between transmission and collection lens optical properties, corrected through positional adjustment of optical elements (see Section 8).
- **Radar intrinsics:** Antenna element gain/phase calibration for accurate beamforming.

### Temporal Calibration

All sensors must be precisely synchronized in time. Classical approaches include:
- **Hardware synchronization:** A master clock (typically GPS-disciplined oscillator) triggers all sensors simultaneously or at known offsets. PTP (Precision Time Protocol, IEEE 1588) provides sub-microsecond synchronization over Ethernet.
- **Software timestamp alignment:** When hardware synchronization is imprecise, classical cross-correlation of sensor events (e.g., the same object appearing in camera and LiDAR at slightly different times) estimates temporal offsets.

Nuro's calibration team job description lists "classical state estimation techniques (non-linear least-squares optimization, Lie algebra)" as relevant expertise, confirming that the calibration stack uses these classical mathematical frameworks.

---

## 8. LiDAR Calibration Patents

### US20190018109A1: Image Size Compensation

This patent addresses a fundamental manufacturing challenge in LiDAR systems: the transmission optical pathway (which shapes the outgoing laser beam) and the collection optical pathway (which focuses returning light onto the detector) must ideally have identical optical properties, but manufacturing tolerances inevitably introduce discrepancies in focal length and distortion between the two as-built assemblies.

**Problem.** When the transmission and collection optical systems have different focal lengths or distortions, the transmitted laser pattern and the expected collection pattern are mismatched. This mismatch degrades range accuracy and spatial resolution because the detector pixels are not precisely aligned with the expected return positions.

**Solution: Positional adjustment.** Rather than re-manufacturing lenses to tighter tolerances (which is expensive), the patent describes translating optical components along the Z-axis (optical axis) to modify the effective focal length:

- **Lens translation in the collection system:** Moving one or more spherical lenses along the Z-axis to change the collection optical system's focal length, matching it to the transmission system
- **Lens translation in the transmission system:** Similarly adjusting the transmission pathway
- **Source/detector array translation:** Moving the laser source array or photodetector array along the Z-axis to shift the image plane

**Translation range:** 1 to 5000 microns (1 micrometer to 5 millimeters)

**Adjustment mechanisms:** The patent specifies servo motors, screw drive systems, pin-slot mechanisms, translation stages, linearized motors, and ball bearing/rack-and-pinion/leadscrew systems. Adjustments can be:
- **Passive (fixed):** Set during manufacturing and locked in place
- **Active (real-time):** Continuously adjusted during operation to compensate for thermal expansion, vibration-induced drift, or aging

**Optical system specifications:**
- Transmission system: Rod lens for X-direction collimation, 2-10 spherical lenses, optional cylindrical lens for enclosure compensation, field of view 3-60 degrees in Y direction
- Collection system: 2-10 spherical lenses, matched to transmission for image size alignment
- Arrays: 2-200 laser sources/photodetectors per linear array; 2D arrays with 2-100 linear arrays forming 4-2000 total sources, each on a single planar PCB

**Trade-off.** The patent acknowledges that image plane movement introduces increased image blur due to defocusing, but notes that this blur can partially compensate for image mismatch caused by focal length or distortion changes in as-built lenses.

### US20200150278A1: Short-Range LiDAR for Blind Spot Detection

This patent describes a compact LiDAR system specifically designed for ultra-close-range detection in vehicle blind spots.

**Detection capability.** The system can detect objects "within a few inches or less" of the vehicle -- critical for pedestrian safety during curbside delivery operations where people approach the vehicle to retrieve goods.

**Mounting locations.** Multiple systems are deployed "in or on the bumper, or on the sides of the doors," providing comprehensive close-range coverage around the vehicle perimeter.

**Optical architecture:**
- **Light source:** Linear laser diode arrays or single laser diodes emitting near-infrared light (approximately 1000 nm wavelength), producing a vertical line of measurement points
- **Beam shaping:** Emitting lens collimates/converges horizontally and spreads/diverges vertically
- **Detection:** Photodiodes, photomultipliers, or avalanche photodiode arrays
- **Scanning:** Rotating mirror driven by motor, capable of 360-degree CW/CCW rotation or oscillation. Rotation speed adapts dynamically based on required detection rate and field of view
- **Wedge mirror enhancement:** Advanced configurations use wedge mirrors that deflect the light path by 2C degrees, providing expanded vertical coverage

**Signal processing.** Range is computed from time-of-flight of returned light. Optical filtering ensures only light reflected from the rotational axis reaches the detector, rejecting stray reflections. Dual optical head configurations increase the field of view.

**Vehicle integration.** Detection data feeds directly into the vehicle's navigation system for collision avoidance, enabling the perception system to maintain awareness of objects in the immediate vicinity during low-speed maneuvering.

---

## 9. Geospatial Foundation Model Calibration

### How Learned Localization Provides Calibration

Nuro's geospatial foundation model produces three outputs: precision localization, online map feature inference, and real-time sensor calibration. The calibration capability emerges from the localization alignment process:

**Cross-correlation alignment.** The online encoder (consuming LiDAR point cloud spins) and geospatial encoder (consuming aerial RGB imagery from USDA and Digital Surface Models from USGS) each produce embedding images. These embeddings are aligned by computing cross-correlation over a search window of possible x, y, and theta (position and heading) offsets.

The cross-correlation operation is a classical signal processing technique:
`C(dx, dy, dtheta) = sum_over_pixels[ E_online(x, y) * E_geospatial(x - dx, y - dy, theta - dtheta) ]`

The (dx, dy, dtheta) that maximizes C gives the vehicle's position and heading relative to the geospatial reference. This is analogous to classical template matching in image processing.

**Calibration via alignment.** When the localization system precisely knows where the vehicle is (from the cross-correlation alignment), it can compare the positions of observed features (in the LiDAR/camera coordinate frames) with their known positions (in the geospatial reference frame). Systematic discrepancies between observed and expected feature positions indicate calibration drift. The system can then update sensor extrinsic parameters (the transformation between sensor frames and the vehicle frame) to minimize these discrepancies.

This is fundamentally a classical least-squares optimization problem: minimize the sum of squared residuals between observed feature positions (in sensor coordinates, transformed to world coordinates via current calibration parameters) and their known positions (from the geospatial reference). The optimization adjusts calibration parameters (rotations, translations) to reduce residuals.

**Continuous operation.** Unlike factory calibration (performed once) or periodic recalibration (performed at service intervals), this calibration runs continuously during operation, providing real-time compensation for:
- Thermal expansion of sensor mounts (temperature cycling during daily operation)
- Vibration-induced drift (residential roads, speed bumps)
- Cargo loading/unloading shifts (relevant for delivery vehicles where payload changes affect vehicle geometry)
- Gradual mechanical settling

---

## 10. Online Calibration

### Delivery Vehicle Calibration Challenges

Delivery vehicles face unique online calibration challenges compared to robotaxis:

**Speed bumps and road imperfections.** Residential neighborhoods have frequent speed bumps, potholes, and uneven road surfaces that subject sensor mounts to repeated mechanical shock, potentially causing calibration drift.

**Cargo loading and unloading.** Every delivery cycle involves loading goods at a depot and unloading at the customer's location. The weight change (and weight distribution change) alters vehicle ride height and suspension geometry, shifting sensor positions relative to the road surface.

**Fleet-scale operation without technicians.** In fleet deployment, there are no technicians at each vehicle to perform manual calibration. The system must be fully automated and self-correcting.

### Online Calibration Algorithms

Nuro's Sensor Data and Calibration team develops both online (real-time, during operation) and offline (depot-based, between operations) calibration algorithms. The job descriptions explicitly call for:

**Targetless (unstructured) calibration.** Online calibration cannot rely on specially designed calibration targets placed in the environment. Instead, the system uses natural scene features -- building edges, lane markings, curbs, poles -- to continuously verify and adjust calibration parameters.

**Classical state estimation techniques.** The job description lists "non-linear least-squares optimization" and "Lie algebra" as relevant techniques:
- **Non-linear least-squares (NLLS):** The Levenberg-Marquardt algorithm or Gauss-Newton method iteratively adjusts calibration parameters to minimize the reprojection error between observed and predicted feature positions across sensor modalities.
- **Lie algebra / Lie group optimization:** Calibration parameters live on the SE(3) manifold (the group of rigid-body transformations in 3D). Optimization on manifolds uses the Lie algebra se(3) (the tangent space at the identity) to parameterize small perturbations, then applies the exponential map to update the transformation. This avoids singularities and over-parameterization issues that arise with Euler angles or other representations.

**Combined classical + ML approaches.** The calibration team job description states the role involves "combining classic robotics and modern ML techniques," confirming a hybrid approach. The ML component likely involves learned feature extraction for matching across modalities, while the classical component provides the optimization framework that produces geometrically consistent calibration parameters.

**Sensor noise modeling.** The job description requires "simulating/modeling real sensors (camera, lidar, radar, IMU, etc.), including noise modeling." Classical noise models (Gaussian noise for range measurements, Poisson noise for photon counting, multiplicative noise for radar, Allan variance characterization for IMU) inform the weighting of measurements in the calibration optimization.

---

## 11. Curbside Detection

### Delivery-Critical Capability

Every delivery involves approaching a specific address and stopping precisely at the curb. Curbside detection is therefore a core capability for Nuro that is less critical for robotaxis. The system must identify:
- The curb line itself (height transition between road surface and sidewalk)
- Valid stopping zones (not in front of fire hydrants, not blocking driveways)
- Obstacles in the intended stopping area (trash cans, parked cars, scooters)

### Classical Geometric Methods for Curb Detection

While Nuro's primary perception operates through its ML-based unified perception model, the system includes a geometric reasoning fallback layer. Classical curb detection from LiDAR point clouds uses:

**Height gradient analysis.** Curbs create a characteristic step-function height change (typically 4-8 inches / 10-20 cm) at the road boundary. Classical detection:
1. Project point cloud to a 2D grid (x, y) with height (z) values
2. Compute height gradients (delta_z / delta_xy) across the grid
3. Identify continuous lines of high gradient magnitude as curb candidates
4. Filter by geometric constraints (curbs are approximately straight or smoothly curved, at consistent heights)

**Multi-feature analysis.** Robust curb detection combines multiple classical features:
- Standard deviation of height within each grid cell (high variance at curb transitions)
- Maximum height difference between adjacent cells
- Horizontal and vertical continuity with neighboring detected curb points
- Consistency with the global road trend (curbs run approximately parallel to the road direction)

**Star-shaped method.** An adaptive edge detection technique that radiates search lines from the vehicle position outward, identifying curb boundary points along each ray using height discontinuity criteria. This produces a continuous curb boundary estimate suitable for navigation.

### Driveway Detection

Driveways are critical features in residential delivery: they represent both delivery destinations and potential vehicle entry/exit points (backing vehicles emerging from driveways are a significant hazard).

Classical driveway detection uses:
- **Curb gap analysis.** Driveways appear as gaps in the curb line where the height transition from road to sidewalk is absent or ramped. Classical gap detection in the curb estimate identifies driveway locations.
- **Surface continuity.** Driveways connect the road surface to private property with a continuous, approximately planar surface. Classical plane fitting in the curb gap region confirms driveway presence.
- **Map prior fusion.** The hybrid HD mapping system (see geospatial model) provides offline driveway locations that are verified by online geometric analysis.

### Delivery Zone Recognition

Identifying valid stopping zones combines classical geometric analysis with map information:
- **Geometric clearance analysis.** Classical swept-path analysis verifies that the vehicle can fit in the candidate stopping position without blocking traffic
- **Obstacle detection in the stopping zone.** Point cloud analysis of the intended stopping area identifies objects (mailboxes, trash cans, parked scooters) that would prevent a valid stop
- **Address matching.** GPS position correlated with map data identifies the correct delivery address

---

## 12. Sidewalk Navigation

### Applicability

Nuro's primary vehicles (R2, R3, and the Lucid Gravity robotaxi) operate on public roads, not sidewalks. However, the perception system must understand sidewalks for several reasons:

**Sidewalk boundary detection.** The system must detect the boundary between road and sidewalk to:
- Avoid driving onto the sidewalk
- Detect pedestrians stepping from the sidewalk into the road
- Identify curb ramps (ADA-compliant ramps) that pedestrians in wheelchairs or with strollers will use

**Pedestrian right-of-way reasoning.** Classical rule-based systems encode right-of-way rules for pedestrians at crosswalks, intersections, and mid-block crossings. These rules are deterministic and do not require ML:
- Pedestrians in marked crosswalks have right-of-way
- At unsignalized intersections, pedestrians have right-of-way when in the crosswalk
- When the vehicle is stopped for delivery, approaching pedestrians (the customer) should be monitored but not treated as obstacles to avoid

**Sidewalk segmentation.** The classical geometric approach identifies sidewalks as elevated, approximately flat surfaces adjacent to the road, bounded by curbs. The hybrid mapping system provides offline sidewalk positions, verified by online perception.

---

## 13. Low-Speed Operation

### How Classical Methods Differ at Delivery Speeds vs. Highway Speeds

Nuro's delivery vehicles operate at 25-45 mph in residential areas, while the Lucid Gravity robotaxi operates up to 65+ mph on highways. Low-speed operation changes classical perception methods in several ways:

**Stopping distance calculations.** Classical kinematics governs stopping distance:

`d_stop = v * t_reaction + v^2 / (2 * a_max)`

At 25 mph (11.2 m/s) with 0.5s reaction time and 8 m/s^2 deceleration: d_stop = 5.6 + 7.8 = 13.4 meters. At 65 mph (29.1 m/s): d_stop = 14.5 + 52.9 = 67.4 meters. This 5x difference means:
- Detection range requirements are dramatically lower for delivery vehicles
- The perception system can allocate more compute to close-range, high-resolution processing rather than long-range detection
- Shorter stopping distances mean shorter required prediction horizons

**Sensor update rate vs. object displacement.** At low speed, objects move through fewer voxels per frame, providing more temporal samples per object. This benefits tracking algorithms (more observations per track) but creates challenges for velocity estimation (small displacements are harder to measure accurately, making radar's direct Doppler measurement particularly valuable).

**Ego-motion compensation precision.** At low speed, the motion distortion in LiDAR scans is smaller, reducing the requirements for precise ego-motion compensation. The classical deskewing correction (applying IMU-measured velocity to shift each point) is still needed but introduces smaller errors.

**Near-field sensor dominance.** At low speed, the vehicle spends more time close to objects (curbside stops, passing parked cars, navigating narrow residential streets). Short-range LiDAR (patent US20200150278A1), short-range cameras, and close-range radar returns become the primary information sources. Classical signal processing for near-field returns differs from far-field: near-field effects (wavefront curvature, parallax between TX and RX) become significant for radar processing at very close range.

**Pedestrian reaction to the vehicle.** At low speed, pedestrians have time to react to the vehicle's presence. Classical prediction models must account for interactive behavior (pedestrians stopping, waving the vehicle past, approaching to retrieve deliveries) rather than assuming ballistic trajectories typical of highway-speed encounters.

---

## 14. Residential Road Geometry

### Classical Detection of Delivery-Context Objects

Residential streets contain objects that are rare or absent on highways but critical for delivery operation:

**Driveways.** Detected via curb gap analysis and surface continuity (see Section 11). Classical geometric verification checks that the detected gap is wide enough for a vehicle, has appropriate slope, and connects to a property.

**Mailboxes.** Typically thin vertical poles with a box at approximately 42-48 inches height (USPS regulation). Classical detection from LiDAR uses:
- Vertical pole detection (thin, tall objects near the curb)
- Height filtering (eliminating objects too tall or too short)
- Proximity to road edge (mailboxes are within arm's reach from the road)

**Parked cars.** Classical bounding box estimation from LiDAR point clouds (oriented minimum bounding box, L-shape fitting) identifies parked vehicles. The distinction between parked and moving vehicles uses Doppler velocity from radar (zero radial velocity for truly stationary objects) and temporal stability analysis (object remains at the same position across multiple frames).

**Fire hydrants.** Short, cylindrical objects approximately 18-24 inches tall, typically 15 inches or more from the curb face. Classical geometric detection uses cylinder fitting in point cloud data combined with height constraints.

**Garbage bins.** Rectangular objects approximately 3-4 feet tall placed at the curb on collection days. These are particularly important because they can obstruct the intended delivery stopping zone and may be moved by wind or residents during a delivery route.

**Obstacles on narrow streets.** Residential streets often have obstacles (basketball hoops, skateboard ramps, children's toys, landscaping that encroaches on the road) that narrow the available driving width. Classical swept-path analysis computes whether the vehicle can pass safely given the detected obstacle positions.

### Geometric Fallback Layer

Nuro's autonomy stack blog explicitly states that "if all of the ML detectors fail to detect an object/obstacle, Nuro can fall back to a purely geometric reasoning layer, in which they identify where they can drive and what is a potential obstacle." This geometric fallback uses:
- Classical occupancy grid construction from raw LiDAR/radar points
- Height-based obstacle classification (any point above ground level and below maximum vehicle height is a potential obstacle)
- Conservative free-space estimation (only regions confirmed clear by multiple sensors are marked drivable)

This fallback is particularly important in residential environments where novel objects (construction debris, fallen branches, seasonal decorations, temporary signage) may not match any ML training class but must still be avoided.

---

## 15. Pet/Animal Detection Classical Components

### Thermal Signature Analysis

Nuro operates in residential neighborhoods where pets (dogs, cats) and wildlife are common. Thermal cameras provide a strong classical detection modality because:
- Warm-blooded animals have body temperatures of approximately 38-39 degrees C (dogs/cats), creating clear thermal contrast against ambient backgrounds
- At nighttime, when visual cameras struggle, thermal contrast actually improves (cooler ambient temperatures increase delta-T)
- The Planck curve peak for mammalian body temperature falls squarely in the LWIR 8-14 micrometer band

Classical thermal detection features include:
- **Blob detection.** Animals appear as connected regions of elevated temperature in the thermal image. Classical blob detection (connected component analysis with temperature thresholding) identifies candidate animal detections.
- **Size filtering.** Classical area and aspect-ratio constraints filter candidates: dogs range from approximately 10 to 100+ cm in length; cats are typically 30-50 cm. The apparent size in the thermal image (combined with range from LiDAR) provides a physical size estimate.
- **Temperature consistency.** Live animals maintain a consistent surface temperature (approximately 30-35 degrees C for fur-covered skin). Classical thresholding rejects objects that are too hot (engine) or too cold (inanimate objects at ambient temperature).

### Motion Pattern Analysis

Animal motion differs from human motion in ways that classical analysis can detect:
- **Speed and trajectory unpredictability.** Animals change direction more frequently and suddenly than pedestrians. Classical trajectory analysis (variance of heading change rate) can flag animal-like motion patterns.
- **Micro-Doppler from radar.** A quadruped gait produces a different micro-Doppler signature than bipedal human locomotion (four limbs moving vs. two). Classical spectral analysis of the Doppler return can distinguish these patterns.
- **Low-height detection.** Animals are typically lower to the ground than adult pedestrians. Classical height filtering (detections below approximately 0.5 meters) flags potential animal detections for additional scrutiny.

---

## 16. Low-Speed Tracking

### Kalman Filtering at Delivery Speeds

Nuro's unified perception model includes stateful temporal modeling for tracking, but the tracking system also relies on classical state estimation principles, particularly Extended Kalman Filters (EKF) or Unscented Kalman Filters (UKF).

**State vector.** For each tracked object, the classical state vector typically includes:
`x = [x, y, z, vx, vy, vz, theta, omega, length, width, height]`
(position, velocity, heading, yaw rate, and physical dimensions)

**Process model.** Classical motion models predict how each object will move between observations:
- **Constant velocity (CV):** Assumes objects maintain their current velocity -- appropriate for vehicles on straight roads
- **Constant turn-rate and velocity (CTRV):** Assumes constant speed and yaw rate -- appropriate for turning vehicles
- **Constant acceleration (CA):** For accelerating/decelerating objects

At delivery speeds, the choice of motion model matters differently than at highway speeds:
- Objects change velocity more frequently (stopping at signs, turning into driveways) -- the CV model is less reliable
- The absolute velocities are lower, making position predictions less sensitive to velocity errors
- Relative velocities between the ego vehicle and other objects are lower, providing more time for track correction

**Observation model.** Classical observation models relate sensor measurements to state variables:
- LiDAR provides (x, y, z) position measurements with known noise characteristics
- Radar provides (range, bearing, radial_velocity) with range and angle-dependent noise
- Camera provides (u, v) pixel coordinates that must be back-projected to 3D using depth from other sensors

### Low-Speed-Specific Tracking Challenges

**Start-stop cycling.** Delivery vehicles frequently stop (at delivery locations, stop signs, behind parked cars) and restart. During stops, the ego-vehicle velocity is zero, and the EKF must handle the transition between static and dynamic observation models for all tracked objects.

**Near-field track management.** At curbside stops, people approach the vehicle at very close range (within 1-2 meters). Classical track management must handle:
- Very high angular velocity of close objects in the sensor frame (even slowly walking pedestrians move rapidly in image coordinates at close range)
- Sensor handoff as objects move between different sensors' fields of view
- Merging tracks when the same object is detected by multiple sensors in overlapping coverage

**Quasi-static objects.** In residential areas, many objects are effectively stationary relative to the slowly-moving vehicle (mailboxes, parked cars, fire hydrants). Classical track management must efficiently handle the large number of static tracks without consuming excessive compute, typically by segregating static and dynamic tracks with different update rates.

---

## 17. Pedestrian Tracking

### Close-Range Residential Pedestrian Tracking

Pedestrian tracking in Nuro's delivery context differs from highway/urban pedestrian tracking:

**Delivery interaction.** When the vehicle arrives at a delivery address, the customer approaches to retrieve goods. The tracking system must maintain a stable track on this approaching pedestrian, distinguishing them from other nearby pedestrians and monitoring their distance throughout the retrieval process.

**Children.** Residential areas have children who may:
- Run unexpectedly into the street from behind parked cars
- Circle around the vehicle out of curiosity
- Play in driveways and yards adjacent to the road

Classical tracking must handle these rapid direction changes with responsive motion models. Higher-order motion models (constant acceleration or jerk-aware models) capture the sudden starts and stops characteristic of running children.

**Intention estimation.** Classical pedestrian intention estimation uses:
- **Heading analysis.** A pedestrian facing the road and approaching the curb may be about to cross -- classical geometric analysis of the pedestrian's orientation relative to the road.
- **Velocity trajectory analysis.** A pedestrian decelerating as they approach the curb is likely to stop; one maintaining speed may step into the road.
- **Context rules.** Classical rules: pedestrians at crosswalks are more likely to cross than pedestrians on a sidewalk facing away from the road. Pedestrians who have been detected looking at the vehicle (from camera-based head pose estimation) may yield or may step out expecting the vehicle to stop.

### Multi-Sensor Pedestrian Fusion

Classical fusion of pedestrian detections across sensors:
- **LiDAR** provides precise 3D position and body geometry (height, width) at close range
- **Radar** provides radial velocity, confirming whether the pedestrian is moving toward or away from the vehicle
- **Thermal camera** provides high-confidence detection independent of lighting
- **Camera** provides classification (adult vs. child), posture, and gait analysis

The classical fusion approach uses gated nearest-neighbor association or Hungarian algorithm matching to associate detections from different sensors to the same pedestrian track, then updates the track state via the Kalman filter with the fused observation.

---

## 18. Stationary Object Tracking

### Importance for Delivery Context

Delivery vehicles must track stationary objects because:
- The intended stopping zone must be clear of obstacles
- Stationary objects define the drivable corridor on narrow residential streets
- Some "stationary" objects may begin to move (a parked car pulling out, a trash can blown by wind)

### Classical Approaches to Stationary Object Tracking

**Map-relative tracking.** Stationary objects maintain fixed positions in the world coordinate frame. Classical tracking maintains a static object map that is updated each time the vehicle passes:
- New objects (placed since last visit) are detected by comparing current observations to the map
- Removed objects (collected trash cans, moved parked cars) are detected by the absence of expected returns

**Change detection.** Classical differencing between the current sensor observation and the HD map prior identifies changes:
- Objects present in the sensor data but absent from the map are novel obstacles
- Objects present in the map but absent from sensor data indicate map staleness
- This is the classical approach described in Nuro's HD mapping documentation, where "change detection systems detect discrepancies with the offboard map to ensure safe operation"

**Radar-based stationarity confirmation.** Radar Doppler measurement provides ground truth for object stationarity: a truly stationary object produces a Doppler velocity exactly equal and opposite to the ego vehicle's velocity. Classical thresholding on the residual (measured Doppler minus expected ego-motion Doppler) determines whether an object is truly stationary or slowly moving.

---

## 19. Geospatial Localization Classical Components

### Cross-Correlation Alignment

The core localization mechanism in Nuro's geospatial foundation model is cross-correlation alignment between an online encoder (processing LiDAR spins) and a geospatial encoder (processing aerial imagery and digital surface models). While the encoders themselves are learned (neural networks), the alignment mechanism is classical:

**Cross-correlation.** This is the classical template matching operation used in signal processing and image registration. For each candidate pose (x, y, theta), the system computes the correlation between the online embedding and the geospatial embedding:

`C(dx, dy, dtheta) = integral[ E_online(x,y) * E_geo(x-dx, y-dy, theta-dtheta) ] dxdy`

The pose that maximizes this correlation function is the vehicle's estimated position and heading.

**Search window.** The cross-correlation is computed over a finite search window of possible offsets. The search window is initialized using GPS (which provides an approximate position with meter-level accuracy) and refined using the cross-correlation peak. Classical techniques for efficient cross-correlation include:
- FFT-based correlation (computing correlation in the frequency domain using the convolution theorem)
- Hierarchical search (coarse-to-fine resolution)
- Sub-pixel/sub-cell interpolation for precision beyond the discrete grid resolution

**Improved contrast through alignment.** Nuro notes that vehicle-to-map alignment during training produces "improved contrast of the online embedding and reduced uncertainty compared to models trained without alignment." This suggests that the training process uses alignment as a supervisory signal, where the classical cross-correlation operation guides the learning of more discriminative embeddings.

### Classical Components in the Localization Pipeline

Beyond the core cross-correlation, the localization pipeline includes classical components:

**GPS initialization.** GPS provides the initial position estimate that centers the cross-correlation search window. This prevents the system from searching the entire map.

**Temporal filtering.** A Kalman filter or similar Bayesian estimator fuses localization estimates over time, maintaining a smooth position trajectory and rejecting outlier estimates. The filter state includes position, velocity, heading, and heading rate.

**Map change robustness.** The hybrid approach "learns to pass through the offline HD map prior when correct" but adapts when the map is outdated. This classical conditional logic (compare online observation to map prior, use prior if consistent, override if discrepant) provides robustness to construction, new signage, or road changes.

---

## 20. GPS/GNSS Processing

### Urban Canyon Handling in Residential Neighborhoods

GPS is a foundational input to Nuro's localization system, providing the initial position estimate for the geospatial alignment search window. However, GPS accuracy is affected by the environment:

**Multipath in residential areas.** Residential neighborhoods present a moderate multipath environment:
- Two-story houses, trees, and fences cause signal reflections
- Canopy from large trees (common in suburban neighborhoods) attenuates signals and causes diffraction
- Parked cars and delivery trucks can temporarily block satellite visibility

Classical GPS multipath mitigation techniques include:
- **Correlator-based mitigation.** Narrow correlator spacing or strobe correlator techniques reduce the impact of multipath on code-phase measurements.
- **Carrier-phase smoothing.** Using the carrier-phase measurement (which is less susceptible to multipath) to smooth the code-phase measurement, reducing position error.
- **RAIM (Receiver Autonomous Integrity Monitoring).** Classical consistency checking across visible satellites to detect and exclude faulty measurements.
- **Multi-constellation reception.** Using GPS, GLONASS, Galileo, and BeiDou simultaneously increases the number of visible satellites, improving geometric diversity and enabling better rejection of individual corrupted signals.

**Differential correction.** RTK (Real-Time Kinematic) or PPP (Precise Point Positioning) techniques use correction data from reference stations to achieve centimeter-level GPS accuracy. For delivery vehicles operating in fixed service areas, local reference station coverage may be available.

### GPS/IMU Integration

The classical tightly-coupled GPS/IMU integration uses an Extended Kalman Filter to fuse GPS position and velocity measurements with IMU-propagated state estimates:
- IMU provides continuous (high-rate, 100-1000 Hz) position/velocity/attitude estimates via mechanization equations
- GPS provides lower-rate (typically 10-20 Hz) but absolute position and velocity measurements
- The EKF estimates and compensates IMU biases using GPS as the reference
- During GPS outages (tunnels, dense tree cover), the system dead-reckons using IMU alone, with position error growing over time until GPS is reacquired

---

## 21. Visual Odometry

### Camera-Based Ego-Motion Estimation

Visual odometry (VO) estimates the vehicle's motion by tracking visual features across consecutive camera frames. This classical technique provides:

**Feature detection and matching.** Classical feature detectors (Harris corners, FAST, ORB, SIFT/SURF) identify distinctive points in each frame. Feature descriptors enable matching across frames. The relative motion between matched features, combined with camera calibration, constrains the camera's 3D motion.

**Essential/fundamental matrix estimation.** Classical epipolar geometry relates point correspondences across two views. The essential matrix (for calibrated cameras) or fundamental matrix (for uncalibrated) is estimated from point correspondences using RANSAC-based robust estimation, providing the relative rotation and translation between frames.

**Scale from stereo or LiDAR.** Monocular visual odometry has inherent scale ambiguity. Classical approaches resolve this via:
- Stereo camera baselines (known physical separation between cameras provides metric scale)
- LiDAR depth association (projecting LiDAR points onto camera images to provide scale for visual features)
- Ground plane constraint (if the camera height is known and the ground plane is visible)

### LiDAR Odometry

LiDAR odometry estimates ego-motion by aligning consecutive LiDAR scans:

**Scan matching.** Classical ICP (Iterative Closest Point) or its variants (point-to-plane ICP, GICP) align consecutive point cloud scans by iteratively finding correspondences and minimizing the alignment error. This provides 6-DOF ego-motion estimates.

**Feature-based methods.** Classical LOAM (LiDAR Odometry And Mapping) extracts edge and planar features from the point cloud and matches them across frames, achieving real-time performance with high accuracy.

### Role in Nuro's Stack

Visual and LiDAR odometry provide ego-motion estimates that:
- Supplement IMU mechanization during GPS degradation
- Provide independent motion estimates for cross-checking
- Enable motion compensation of point clouds (deskewing)
- Feed into the temporal alignment module of the unified perception model
- Contribute to the Kalman filter state estimate for vehicle position/velocity

---

## 22. External Airbag Trigger Logic

### Autoliv External Airbag System

Nuro's R3 delivery vehicle features an exterior pedestrian airbag developed with Autoliv -- the largest external car airbag available on the market. The airbag covers the front of the vehicle when inflated, specifically designed to mitigate head impacts in pedestrian-vehicle collisions.

### Classical Collision Prediction (TTC Computation)

The airbag trigger system uses perception data to predict imminent collisions and must decide whether to deploy within milliseconds. The classical time-to-collision (TTC) computation is:

**Point-based TTC:**
`TTC = -R / dR_dt`

where R is the range to the obstacle and dR/dt is the range rate (rate of closure). This simple formula, computed from radar Doppler or LiDAR range rate, provides the time until collision assuming constant relative velocity.

**Extended TTC with acceleration:**
`TTC = (-dR_dt + sqrt(dR_dt^2 + 2*a_rel*R)) / a_rel`

where a_rel is the relative acceleration (incorporating ego-vehicle braking).

**Multi-sensor TTC fusion.** The trigger system fuses TTC estimates from multiple sensors:
- Radar provides direct range-rate measurement via Doppler for precise TTC computation
- LiDAR provides precise range measurement with range-rate computed from consecutive scans
- Camera-based TTC uses the time derivative of the optical expansion (looming) of the detected object

### Deployment Timing

The airbag reaches deployed position in **40-60 milliseconds** after collision detection. This is the time from the trigger decision to full inflation -- a classical pyrotechnic gas generator inflates the airbag cushion in this interval.

The trigger decision must account for:
- **Detection confidence.** The system must be highly confident that a collision is truly imminent (false deployments are costly and potentially dangerous). Classical hypothesis testing (Neyman-Pearson or Bayesian decision theory) sets the decision threshold.
- **Point of no return.** Once the ego-vehicle's braking capability cannot prevent collision (given current closing speed and distance), the airbag deployment should be triggered. This is a classical kinematic calculation:
  `d_min_stop = v_rel^2 / (2 * a_brake_max)`
  When actual range R < d_min_stop + margin, deployment is triggered.
- **Deploy-before-contact timing.** The patent describes the airbag being "pre-deployed before contact" -- meaning it inflates during the closing phase, not after impact. This requires the perception system to predict the collision at least 40-60 ms before it occurs.

### Sensor Inputs for Trigger

The patent (US20190054876A1) specifies "detection sensors configured to detect obstacles in a direction of travel" that provide "obstacle information" to a "computer system" that decides whether to send an "actuation signal to the inflation unit." Upon obstacle detection, the system can also "send control signals to the conveyance system to apply brakes to reduce speed or steer the autonomous robot vehicle away from the obstacles" -- indicating that the airbag trigger operates in parallel with active collision avoidance.

---

## 23. Energy-Absorbing Front Panel

### Classical Impact Mechanics

Nuro's patent (US20190054876A1) describes a multi-layered energy absorption system on the front of the vehicle:

**Energy-absorbing member.** A compressible/resilient material member (foam, rubber, polymer, gel, or combination thereof) is mounted within cavities on the vehicle's front frame. This member is "configured to reduce impact on an object struck by the autonomous robot vehicle."

**Crash beam.** A structural crash beam provides structural integrity to the front side of the vehicle. A second energy-absorbing member is coupled with the crash beam.

**Classical crush zone design.** The energy-absorbing front panel functions as a controlled crush zone, governed by classical impact mechanics:

`E_absorbed = integral[ F(x) dx ]` from 0 to d_crush

where F(x) is the force-displacement characteristic of the crushable material and d_crush is the total crush distance. The material is engineered so that:
- Force rises rapidly to a plateau (controlled crush force)
- The plateau is maintained over the full crush distance (constant force absorption)
- Peak force is kept below the threshold for serious pedestrian injury (approximately 4-8 kN for head impact, per Euro NCAP pedestrian protection criteria)

For Nuro's low-mass, low-speed vehicle:
- Vehicle mass: approximately 2,535 lb (1,150 kg) for R2
- Maximum operating speed: 25-45 mph (11-20 m/s)
- Maximum kinetic energy at 25 mph: 0.5 * 1150 * 11.2^2 = approximately 72 kJ
- This is dramatically less than a typical passenger car at 35 mph (approximately 180 kJ) or 65 mph (approximately 625 kJ)

The low kinetic energy budget, combined with energy-absorbing materials and external airbag deployment, means that even in a collision, the mechanical energy transferred to a pedestrian is substantially reduced.

---

## 24. Conservative Braking Rules

### Rule-Based Aggressive Braking

Because Nuro's delivery vehicles carry no passengers, there are no passenger comfort or injury constraints on braking. This enables rule-based braking strategies that would be unacceptable in a robotaxi:

**Maximum deceleration.** Passenger vehicles typically limit emergency braking to approximately 4-6 m/s^2 to prevent passenger injury (whiplash, impact with interior). Nuro can brake at the vehicle's physical limit (approximately 8-10 m/s^2 on dry pavement), limited only by tire-road friction, not passenger comfort.

**Stopping distance advantage.** At 25 mph:
- Comfort-limited braking (4 m/s^2): d_stop = 15.7 m
- Physics-limited braking (8 m/s^2): d_stop = 7.8 m
- This approximately 50% shorter stopping distance directly improves safety margins

### Pre-Planned Stopping Trajectories

At all times, the onboard computer continuously calculates multiple potential stopping trajectories that would be safe if a system failure occurs. These trajectories are:
- **Pre-computed.** Calculated in advance, not in response to a specific threat
- **Frequently updated.** Sent to the high-reliability computer at high frequency
- **Resilient.** Can be executed even with loss of connectivity or primary computer malfunction
- **Situationally selected.** Multiple trajectories are maintained; the system selects the most appropriate one based on the detected fault and current driving context

### Classical Safety Rules

Nuro employs "expert rules-based systems" as safety backups to the ML decision-making system (as explicitly stated in September 2023 release notes). These classical rules include:

**Minimum safe following distance.** Classical rule: maintain at least `d_safe = v * t_gap + v^2 / (2 * a_max)` behind the lead vehicle, where t_gap is a configurable time gap and a_max is maximum braking deceleration.

**Speed limiting.** Classical rules limit vehicle speed based on:
- Road type and posted speed limit (from map data)
- Weather conditions (from rain detection model)
- Proximity to school zones, construction zones, or other restricted areas
- Sensor degradation level (reduced confidence requires reduced speed)

**Right-of-way rules.** Deterministic, classical traffic rule encoding:
- Stop at stop signs for the required minimum duration
- Yield to pedestrians in crosswalks
- Yield to emergency vehicles (triggered by siren detection)
- Follow traffic light state (red = stop, green = proceed with caution)

**Yielding behavior improvements.** Nuro's release notes indicate strengthened safety nets around unprotected maneuvers, including 20% improvement in yielding behavior and 36% increase in circumstances where more conservative behavior was desired -- achieved through tuning classical rule thresholds.

### Backup Parallel Autonomy Stack

Nuro has activated a "full stack parallel backup system on their next generation vehicle platforms, which operates an independent perception and emergency braking system." This backup stack provides:
- Independent perception (separate from the primary ML-based system)
- Independent emergency braking capability
- Rules-based safety checks on the primary ML system's outputs
- The ability to override the primary system and execute a safe stop if the primary system produces unsafe commands

The high-reliability vehicle interface is "a custom triple-redundant module that provides a hardware abstraction layer between the Nuro Driver and vehicle-specific systems such as braking, steering, and acceleration." This triple redundancy means three independent hardware paths from decision to actuation, so that even two simultaneous hardware failures cannot prevent a safe stop.

---

## 25. ONNX Graph Processing

### Classical Graph Algorithms in FTL

Nuro's FTL (Faster Than Light) Model Compiler Framework begins by converting trained models from TensorFlow or PyTorch to ONNX (Open Neural Network Exchange) format. ONNX represents the model as a directed acyclic graph (DAG) where nodes are operations (convolution, matrix multiply, activation functions) and edges are tensors.

**Graph partitioning.** The Orchestrator Segmenter in FTL performs classical graph analysis to partition the model graph into segments suitable for different execution strategies:

- **Subgraph identification.** Classical graph algorithms (BFS/DFS traversal, connected component analysis) identify subgraphs that can be compiled to TensorRT for optimized execution.
- **Dependency analysis.** Classical topological sorting of the DAG determines execution order, identifying which operations can execute in parallel and which must be sequential.
- **Cut-point identification.** Classical min-cut algorithms identify optimal points to partition the graph for multi-GPU execution, minimizing the data that must be transferred between GPUs at partition boundaries.

**Segment Breaker.** Allows developers to isolate specific subgraphs for particular precision levels. This uses classical graph manipulation (subgraph extraction, node insertion for precision boundaries) to ensure precision-sensitive operations (e.g., normalization layers, softmax) remain in FP32 while compute-heavy operations (convolutions) are quantized to FP16 or INT8.

---

## 26. TensorRT Integration

### Classical Optimization Passes

TensorRT, NVIDIA's inference optimization engine, applies several classical optimization techniques that FTL leverages:

**Layer fusion.** TensorRT analyzes the computation graph and fuses compatible adjacent layers into a single CUDA kernel. Classical pattern matching identifies fusible patterns:
- Convolution + Batch Normalization + ReLU fused into a single kernel
- Fully connected + activation fused into one operation
- Element-wise operations chained together

This fusion reduces kernel launch overhead and memory bandwidth requirements -- classical compiler optimization techniques (operation folding, dead code elimination) applied to neural network graphs.

**Kernel auto-tuning.** For each operation (or fused group), TensorRT benchmarks multiple CUDA kernel implementations and selects the fastest one for the target GPU architecture (NVIDIA DRIVE Thor in Nuro's case). This is a classical brute-force optimization: enumerate candidates, measure performance, select the best.

**Memory optimization.** Classical memory management techniques:
- **Tensor lifetime analysis** determines when each intermediate tensor is created and last used, enabling memory reuse (classical register allocation problem)
- **Memory pooling** pre-allocates GPU memory to avoid allocation overhead during inference
- **In-place operations** modify tensors directly when the input is no longer needed

**Precision selection.** TensorRT treats the model as floating-point by default and uses INT8 "opportunistically" -- if a layer runs faster in INT8 and has assigned quantization scales, the INT8 kernel is assigned. This is a classical constraint satisfaction problem: maximize performance subject to accuracy constraints.

---

## 27. Multi-GPU Pipeline Parallelism

### Classical Scheduling for Cross-GPU Pipeline Balancing

FTL splits the unified perception model across multiple GPU devices using pipeline parallelism. This achieved approximately **27-28% latency reduction** for Nuro's perception detector.

**Pipeline parallelism concept.** The model is divided into stages, each assigned to a different GPU. Data flows through the pipeline: while GPU-1 processes the current frame's early layers, GPU-2 processes the previous frame's later layers. This overlaps computation across GPUs, similar to classical instruction pipelining in CPU architecture.

**Classical scheduling algorithms:**

**Load balancing.** The graph is partitioned so that each GPU has approximately equal computation time. This is a classical graph partitioning problem (related to the NP-hard graph bisection problem), typically solved with heuristic algorithms:
- Compute the FLOPS (floating-point operations) or measured execution time for each layer
- Partition the layer sequence so that the total computation per partition is balanced
- Minimize cross-partition data transfer (the tensors that must be transferred between GPUs at partition boundaries)

**Pipeline bubble minimization.** In a pipeline with K stages, the first K-1 frames see pipeline startup latency (some GPUs idle while the pipeline fills). Classical micro-batching divides each batch into smaller micro-batches that flow through the pipeline in quick succession, reducing the fraction of time GPUs are idle.

**Asynchronous data transfer.** Classical double-buffering or triple-buffering techniques overlap GPU computation with inter-GPU data transfer (via NVLink or PCIe), hiding transfer latency behind computation.

**Synchronization.** Classical barrier synchronization ensures pipeline stages complete in order, with minimal synchronization overhead.

---

## 28. Quantization

### INT8 Calibration: Classical Statistical Methods

Quantization reduces the precision of model weights and activations from FP32 to FP16 or INT8, dramatically reducing compute requirements and memory consumption at the cost of some accuracy.

**The fundamental challenge:** FP32 values span a continuous range. INT8 values can only represent 256 distinct levels. The classical problem is determining the optimal mapping (scale and zero-point) from the FP32 range to the INT8 range for each tensor in the model.

**TensorRT calibration process (used by FTL):**
1. Build a FP32 engine and run it on a calibration dataset (representative real driving data)
2. For each activation tensor in the network, record a histogram of all observed values
3. Determine the optimal clipping threshold that minimizes information loss when mapping the FP32 distribution to INT8

**Entropy calibration (KL-divergence minimization).** The classical statistical method TensorRT uses to find optimal quantization thresholds:
- Model the FP32 activation distribution as a reference distribution P
- For each candidate threshold T, compute the quantized distribution Q (what happens when values are clipped to [-T, T] and mapped to INT8)
- Compute the KL-divergence: `D_KL(P || Q) = sum[ P(i) * log(P(i) / Q(i)) ]`
- Select the threshold T that minimizes D_KL -- this preserves maximum information from the original distribution

This is a classical information-theoretic optimization: minimize information loss (measured by KL-divergence) during quantization. Unlike gradient-based optimization, TensorRT uses iterative search over candidate thresholds (scanning through histogram bin boundaries), a classical exhaustive search approach.

**Per-tensor vs. per-channel quantization.** Classical statistical analysis determines whether each tensor benefits from a single scale factor (per-tensor) or separate scale factors for each output channel (per-channel, which provides finer-grained quantization at the cost of more scale parameters).

**Quantization-aware training (QAT).** If post-training quantization (PTQ) degrades accuracy unacceptably, QAT simulates quantization during training, allowing the network to adapt its weights to the quantized precision. This uses classical straight-through estimator (STE) for gradient computation through the non-differentiable quantization step.

---

## 29. Dave Ferguson's Classical Methods

### D* Lite Path Planning

Dave Ferguson (Nuro co-founder and CEO) co-developed D* Lite with Sven Koenig, a simplification of the D* algorithm for incremental path planning. D* Lite is an extension of A* that incrementally repairs solution paths when costs change in the underlying graph:

- Initially constructs an optimal path from start to goal using backward A*
- When edge costs change (new obstacles detected, road closures), only the affected states have their costs updated, rather than replanning from scratch
- Computational complexity is much lower than replanning with A* from scratch, making it suitable for real-time operation in dynamic environments

D* Lite is a purely classical algorithm based on graph search theory -- no learning is involved. Its influence on Nuro's architecture is in establishing the principle that planning should be incremental and adaptive, responding to perception updates without complete recomputation.

### Field D*: Interpolation-Based Planning

Ferguson and Anthony Stentz (CMU Robotics Institute) developed Field D*, which addresses a fundamental limitation of grid-based planners:

**Problem.** Standard grid planners (A*, D* Lite) constrain motion to a discrete set of headings (0, pi/4, pi/2, etc. -- typically 8 directions on a grid). This produces unnatural, suboptimal paths with unnecessary turns.

**Solution.** Field D* uses linear interpolation during planning to compute accurate path cost estimates for arbitrary positions within each grid cell, producing paths with continuous headings rather than grid-constrained angles. The interpolation considers the cost gradient across cell boundaries to find the true optimal path direction.

**Key innovation.** The algorithm extends D* and D* Lite to use linear interpolation, efficiently producing globally smooth paths through nonuniform cost grids. This means the planner can produce natural-looking paths that smoothly navigate around obstacles rather than following jagged grid-aligned routes.

**NASA Mars Rover deployment.** Field D* was integrated into the flight software for NASA's Mars Exploration Rovers, enabling simultaneous local and global planning during autonomous navigation (AutoNav). The implementation required only approximately 25 KB of memory for the interpolation table and was fast enough for real-time rover operation. Testing showed Field D* improved goal reachability to nearly 100% in complex obstacle fields.

### How DARPA Urban Challenge Heritage Influences Nuro

Dave Ferguson was a key member of CMU's Tartan Racing team, whose "Boss" vehicle (a modified Chevy Tahoe) won the 2007 DARPA Urban Challenge. The classical methods developed for Boss directly influenced Nuro's architecture:

**Two-layer tracking system.** Boss used a two-layer tracking architecture -- a sensor layer and a fusion layer:
- **Sensor layer:** Specialized modules for each sensor class, running sensor-specific processing (radar clutter rejection, LiDAR ground plane removal)
- **Fusion layer:** Merged sensor-level tracks into a unified scene representation using classical Extended Kalman Filters for state estimation

This architecture is reflected in Nuro's unified perception model, which uses independent sensor encoders (analogous to Boss's sensor layer) feeding into a shared fusion module (analogous to Boss's fusion layer).

**Extended Kalman Filter tracking.** Boss used EKF to estimate the state of dynamic obstacles, with revised motion and observation models for active sensors (radars and LiDARs). The EKF maintained object state (position, velocity, heading) and updated it with each new sensor observation. This classical technique remains foundational in Nuro's tracking pipeline.

**Heuristic radar ghost filtering.** Boss's radar sensors generated specific classes of false echoes that were filtered using classical heuristics based on physical constraints. This sensor-specific artifact removal remains relevant to Nuro's radar processing pipeline.

**Model-predictive trajectory generation.** Boss's motion planning used a model-predictive trajectory generation algorithm that computed dynamically feasible actions, combined with higher-level planners for on-road and unstructured navigation. This hierarchical planning approach -- separating strategic route planning from tactical trajectory generation from low-level vehicle control -- is a classical robotics architecture that persists in modern autonomous driving stacks.

---

## 30. Classical Robotics DNA

### What Persists from CMU/DARPA Heritage

Nuro's founding team brings deep classical robotics heritage from CMU, Google/Waymo, and DARPA programs. The following classical techniques from this heritage persist in or influence Nuro's architecture:

**Occupancy grid mapping.** Originally proposed by Elfman and Moravec at CMU, occupancy grids discretize the environment into cells and maintain a probability of occupancy for each cell. Nuro's 3D voxel representation in the unified perception model is a learned evolution of classical occupancy grids -- the same spatial discretization principle, but with learned features instead of binary occupancy probabilities.

**Sensor fusion via Bayesian estimation.** Classical sensor fusion (combining observations from multiple sensors using Bayes' theorem) is the foundation of Nuro's multi-modal fusion. While the unified perception model learns the fusion function, the underlying principle -- weighting each sensor's contribution by its reliability and combining probabilistically -- is classical Bayesian estimation.

**Graph-based planning.** Classical graph search (A*, D*, D* Lite, Field D*) from Ferguson's CMU work informs Nuro's planning architecture. Even as planning moves toward learned approaches (RL-based policies), the graph-based structure of the road network and the need for guaranteed path existence remain classical.

**Control theory.** Classical PID control and model predictive control (MPC) for vehicle lateral and longitudinal control. The control system is described as "safe, robust, portable, and high-performing" with "modular software design" -- characteristics of well-engineered classical control systems.

**Safety engineering.** Classical failure mode analysis (FMEA), fault tree analysis, and ASIL decomposition from ISO 26262 are used to design the safety architecture. The triple-redundant hardware, independent backup autonomy stack, and pre-computed safe-stop trajectories are all classical safety engineering approaches.

**State machine architecture.** Classical finite state machines govern high-level vehicle behavior modes (driving, stopped-for-delivery, pullover-for-emergency-vehicle, safe-stop). Transitions between states are triggered by deterministic conditions from perception and rules.

**Coordinate frame management.** Classical rigid-body kinematics (transformation chains using homogeneous transformation matrices or quaternions) maintains the relationships between all coordinate frames in the system: each sensor frame, the vehicle body frame, the local navigation frame, and the global (geodetic) frame.

**Geometric perception fallback.** As Nuro explicitly states, "if all of the ML detectors fail to detect an object/obstacle, Nuro can fall back to a purely geometric reasoning layer." This geometric layer -- identifying obstacles purely from 3D geometry without classification -- is a classical robotics technique that predates machine learning. It uses:
- Height-above-ground thresholding (anything protruding above the road surface is an obstacle)
- Free-space carving (regions with no LiDAR returns up to a maximum range are free; regions with returns are occupied)
- Conservative drivable corridor estimation

---

## 31. Sensor Dropout Training

### Classical Probability Theory for Random Sensor Masking

Sensor dropout is Nuro's technique for training the unified perception model to be robust to sensor failures. During training, entire sensor modalities are randomly masked (set to zero), forcing the model to learn representations that do not depend critically on any single sensor.

**Probabilistic framework.** The dropout configuration (which sensors to mask in each training step) is sampled from a probability distribution:

- Let S = {LiDAR, Camera, Radar, Thermal, Audio} be the set of maskable sensor modalities (IMU is typically not masked as it provides essential ego-state information)
- At each training step, a masking vector m in {0,1}^5 is sampled, where m_i = 0 means sensor i is masked
- The sampling distribution can be:
  - **Independent Bernoulli:** Each sensor is independently masked with probability p (typically p = 0.1-0.3), similar to standard neural network dropout
  - **Categorical over configurations:** Specific masking patterns are sampled with defined probabilities, weighting more common failure modes (e.g., camera-blocked-by-mud) more heavily
  - **Structured dropout:** Correlated masking (e.g., all cameras masked simultaneously, since a camera-obscuring event like heavy rain affects all cameras)

**Information-theoretic justification.** Sensor dropout maximizes the mutual information between the model's internal representation and the environment state, independent of any particular sensor subset. This is a classical information-theoretic objective: learn a representation that captures maximum environmental information regardless of which sensors are available.

**Relationship to standard dropout.** Standard neural network dropout randomly zeroes individual neurons during training to prevent co-adaptation. Sensor dropout applies the same principle at the sensor-modality level: preventing the model from co-adapting to a specific combination of sensors. The mathematical analysis (regularization effect, implicit ensemble training) transfers directly from classical dropout theory.

**Cross-platform benefit.** Sensor dropout naturally enables cross-platform deployment (delivery robot vs. robotaxi) because the model has learned to operate with varying sensor configurations. A platform with fewer sensors is simply a specific (deterministic) dropout pattern.

---

## 32. RL Classical Components

### Classical Reward Shaping in CIMRL

Nuro's CIMRL (Combining Imitation and Reinforcement Learning) framework uses classical reward engineering to guide learned driving policies:

**Reward decomposition.** CIMRL decomposes the reward function into two classical categories:
- **Dense task rewards:** Progress along the ego route -- a continuous, classical metric computed as the distance advanced along the planned path per timestep. This is a classical potential-based reward: `r_progress = phi(s') - phi(s)`, where phi is the distance-to-goal function.
- **Sparse risk rewards:** Collision events treated as terminal failure conditions with associated severity values. This binary (collision/no-collision) signal is a classical penalty term.

This decomposition reflects the classical reinforcement learning principle of reward shaping: dense rewards guide learning toward the goal (making exploration more efficient), while sparse rewards encode hard constraints (safety boundaries).

### Classical Trajectory Evaluation Metrics

CIMRL adopts multiple plan proposals and evaluates them using classical metrics:

**Average Displacement Error (ADE).** The average Euclidean distance between the planned trajectory and the reference (logged human) trajectory:
`ADE = (1/T) * sum_{t=1}^{T} || p_planned(t) - p_reference(t) ||`
This is a classical trajectory similarity metric from robotics.

**Collision Rate.** Percentage of episodes resulting in collision -- a classical safety metric.

**Offroad Rate.** Percentage of episodes where the vehicle exits the road boundary -- a classical constraint violation metric.

**Multi-hypothesis scoring.** CIMRL evaluates plans on a spectrum from too conservative to too aggressive: "the upper plan is too conservative, while the lower plan is too aggressive (and eventually leads to a future collision), and they both have low scores; the safe and non-conservative plan is chosen as having the highest score." This scoring function is a classical multi-objective optimization that balances progress against safety.

### Classical Control Frequency

CIMRL operates at 2 Hz control frequency (action repeat of 5 steps), reflecting a classical discrete-time control architecture where actions are held constant for a fixed interval before re-evaluation.

---

## 33. Recovery RL Safety Filtering

### Classical Safety Constraints Applied to Learned Policies

Recovery RL is the safety mechanism within CIMRL that prevents the learned driving policy from executing dangerous maneuvers. Its architecture combines learned risk estimation with classical decision-theoretic safety filtering.

### Dual Q-Function Architecture

Recovery RL trains two separate Q-functions:

**Qtask(s, a):** Estimates the expected cumulative task reward (progress) for taking action a in state s. This is a standard RL value function.

**Qrisk(s, a):** Estimates the expected cumulative risk (probability and severity of constraint violations) for taking action a in state s. The Qrisk is trained using the loss:

`Loss_risk = || Qrisk(s,a) - (r_risk(s,a) + gamma_risk * V_risk(s')) ||^2`

where r_risk is the immediate risk reward (collision severity), gamma_risk is the risk discount factor, and V_risk(s') is the risk value of the next state.

### Classical Safety Filtering Mechanism

The combined policy implements a classical hierarchical safety filter during inference:

**Step 1: Risk assessment.** For each candidate action a, compute Qrisk(s, a).

**Step 2: Safe set construction.** Define the safe action set as:
`A_safe = { a | Qrisk(s, a) < theta }`
where theta is a classical safety threshold parameter.

**Step 3: Decision logic (classical conditional):**
- **If A_safe is non-empty (safe case):** Re-normalize the task policy over safe actions only and sample from this truncated distribution. Unsafe actions are completely excluded.
- **If A_safe is empty (unsafe case):** All actions violate the safety threshold. Fall back to the recovery policy pi_recov, which minimizes expected risk: `J_recov = E[Qrisk(s,a)]` under pi_recov.

This is a classical constraint-satisfaction approach: the safety filter enforces hard constraints on the learned policy, similar to how classical control systems apply saturation limits, rate limiters, and safety interlocks to prevent actuator commands from exceeding safe operating bounds.

### Suppressed Task Value

To prevent discontinuities at the safety boundary, CIMRL applies adaptive suppression:

`Q_supp_task(s, a) = Q_task(s, a) / f(Qrisk(s, a))`

where f(.) is a partition function (e.g., exponential). This creates smooth interpolation between task maximization and risk minimization -- a classical technique in constrained optimization (barrier functions, penalty methods) adapted to the RL setting.

### Action Space: Trajectory Proposals

Rather than operating in continuous control space, CIMRL selects from state-dependent trajectory proposals. An action encoder projects variable-length 10-second motion plans into embeddings. The trajectory proposals themselves are generated using classical trajectory generation methods:
- **Polynomial trajectories:** Classical minimum-jerk or minimum-snap polynomial curves connecting current state to target state
- **Model-predictive trajectory generation:** Similar to the approach used in Boss (DARPA Urban Challenge), generating dynamically feasible trajectories that respect vehicle kinematic constraints (maximum steering rate, acceleration limits)
- **Sampling-based approaches:** Classical random sampling of endpoints with smooth trajectory interpolation

### Classical Initialization

Training initialization leverages classical physics-based bounds:
- Maximum possible progress reward is computed from road geometry (classical path length calculation)
- These bounds stabilize bootstrapping of Q-functions from scratch, a technique from classical value function initialization in RL

---

## Summary: The Classical-ML Spectrum in Nuro's Stack

Nuro's perception and autonomy stack exists on a spectrum from purely classical to purely learned methods:

| Component | Classical | Hybrid | Learned |
|---|---|---|---|
| **LiDAR range computation** | Time-of-flight, classical optics | | |
| **Radar signal processing** | FFT, CFAR, beamforming, DOA | | |
| **Thermal NUC** | Two-point calibration, drift correction | | |
| **Camera ISP** | Debayer, HDR, tone mapping, distortion correction | | |
| **Audio feature extraction** | FFT, mel-spectrogram, MFCC, DOA | | |
| **IMU mechanization** | Strapdown equations, bias estimation | | |
| **Sensor calibration** | | Non-linear least-squares + learned features | |
| **Localization** | | Cross-correlation alignment of learned embeddings | |
| **Object detection** | | | Unified perception model |
| **Geometric fallback** | Occupancy grid, height thresholding | | |
| **Object tracking** | | Kalman filter + learned temporal model | |
| **Prediction** | | | ML-first with rules-based fallback |
| **Driving policy** | | | RL with classical safety filter |
| **Safety systems** | Rules-based, TTC computation, braking kinematics | | |
| **FTL compiler** | Graph partitioning, quantization calibration | | |
| **External airbag** | TTC computation, deployment timing | | |
| **Path planning heritage** | D* Lite, Field D* (influenced architecture) | | |

The classical components form the bedrock: they handle raw sensor physics, provide safety guarantees, enable cross-sensor calibration, and serve as fallbacks when learned systems fail. The ML components sit atop this classical foundation, providing the pattern recognition, classification, and prediction capabilities that classical methods alone cannot achieve. The hybrid components -- where classical optimization frameworks are applied to learned representations -- represent the most sophisticated integration of both paradigms.

---

## Sources

### Nuro Primary Sources
- [Nuro -- Unified Perception Model](https://www.nuro.ai/blog/unified-perception-model)
- [Nuro -- FTL Model Compiler Framework](https://www.nuro.ai/blog/ftl-model-compiler-framework)
- [Nuro -- The Nuro Autonomy Stack](https://www.nuro.ai/blog/the-nuro-autonomy-stack)
- [Nuro -- Building Better Ears: Unified Siren Perception Model](https://www.nuro.ai/blog/building-better-ears-nuros-unified-siren-perception-model)
- [Nuro -- Learned Localization: Bridging the Aerial-Ground Divide](https://www.nuro.ai/blog/learned-localization-bridging-the-aerial-ground-divide)
- [Nuro -- Exploring HD Mapping that Scales](https://www.nuro.ai/blog/exploring-hd-mapping-that-scales)
- [Nuro -- Next-Generation Sensor Architecture](https://www.nuro.ai/blog/introducing-the-nuro-drivers-next-generation-sensor-architecture)
- [Nuro -- Safety: Our Vehicles](https://www.nuro.ai/blog/safety-nuro-our-vehicles)
- [Nuro -- Safety: Our Autonomy Software](https://www.nuro.ai/blog/safety-nuro-our-autonomy-software)
- [Nuro -- Delivering Safety](https://www.nuro.ai/blog/delivering-safety-nuros-approach)
- [Nuro -- CIMRL: Combining Imitation and Reinforcement Learning](https://www.nuro.ai/blog/cimrl-combining-imitation-reinforcement-learning-for-safe-autonomous-driving)
- [Nuro -- September 2023 Release Notes](https://www.nuro.ai/blogs/nuro-driver-september-release-notes)
- [Nuro Release Notes](https://www.nuro.ai/release-notes)
- [Nuro Driver Platform](https://www.nuro.ai/nuro-driver)
- [Nuro Safety](https://www.nuro.ai/safety)
- [Nuro Technology](https://www.nuro.ai/technology)
- [Nuro Careers](https://www.nuro.ai/careers)

### Nuro Patents
- [US20190018109A1 -- LiDAR Image Size Compensation](https://patents.google.com/patent/US20190018109A1/en)
- [US20200150278A1 -- LiDAR Blind Spot Detection](https://patents.google.com/patent/US20200150278A1/en)
- [US20190054876A1 -- Pedestrian Safety Mechanisms](https://patents.google.com/patent/US20190054876A1/en)
- [US10369976B1 -- Emergency Deceleration Safety Feature](https://patents.justia.com/patent/10369976)

### Nuro Job Postings
- [Senior Software Engineer, ML, Calibration -- Climatebase](https://climatebase.org/job/52417449/senior-software-engineer-machine-learning-calibration)
- [Radar Engineer, Signal Processing -- Glassdoor](https://www.glassdoor.com/job-listing/radar-engineer-signal-processing-nuro-JV_IC1147431_KO0,32_KE33,37.htm)
- [Perception Foundation Encoder -- ClimateTechList](https://www.climatetechlist.com/job/nuro-senior-ml-engineer-perception-foundation-encoder-Nir2SvdFmVYMvv)

### CIMRL / Recovery RL
- [CIMRL Paper (arXiv)](https://arxiv.org/html/2406.08878v2)
- [Recovery RL (UC Berkeley)](https://sites.google.com/berkeley.edu/recovery-rl/)

### Dave Ferguson / DARPA Urban Challenge
- [Field D* Algorithm (CMU RI)](https://www.ri.cmu.edu/pub_files/pub4/ferguson_david_2005_3/ferguson_david_2005_3.pdf)
- [Field D* Journal of Field Robotics](https://www.ri.cmu.edu/pub_files/pub4/ferguson_david_2006_3/ferguson_david_2006_3.pdf)
- [Boss / DARPA Urban Challenge (Springer)](https://link.springer.com/chapter/10.1007/978-3-642-03991-1_1)
- [Obstacle Detection and Tracking for Urban Challenge](https://www.ri.cmu.edu/pub_files/2009/9/09ieee-transport-darms.pdf)
- [Boss AI Magazine Paper](https://www.cmu.edu/traffic21/pdfs/aimag2009_urmson-compressed.pdf)
- [Mars Rover Field D* (JPL)](https://www-robotics.jpl.nasa.gov/media/documents/IEEEAC-Carsten-1125.pdf)

### Autoliv External Airbag
- [Autoliv Press Release -- Nuro Exterior Airbag](https://www.autoliv.com/press/autoliv-provides-exterior-airbag-nuros-autonomous-vehicle-1990769)
- [Autoliv Pedestrian Protection](https://www.autoliv.com/safety-solutions/pedestrian-protection)
- [Autoliv Autonomous Vehicle Safety Campaign](https://campaign.autoliv.com/autonomous-vehicle-safety)

### Sensor Technology References
- [FLIR Boson LWIR Thermal Camera](https://oem.flir.com/boson-family/)
- [Teledyne FLIR Automotive Thermal](https://oem.flir.com/solutions/automotive/)
- [4D Imaging Radar Survey (arXiv)](https://arxiv.org/html/2306.04242v3)
- [Automotive ISP Parameter Tuning (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321211/)
- [LWIR NUC Using Uncooled Microbolometer Camera](https://sbir.com/PDFs/MIRAGE-Publications/LWIR%20NUC%20Using%20an%20Uncooled%20Microbolometer%20Camera.pdf)
- [Emergency Vehicle Audio Detection and Localization (arXiv)](https://arxiv.org/abs/2109.14797)
- [GCC-PHAT / SRP-PHAT for Siren Localization (HAL)](https://hal.science/hal-02275184/)
- [Strapdown Inertial Navigation (Berkeley)](https://rotations.berkeley.edu/strapdown-inertial-navigation/)
- [IMU Mechanization (Analog Devices)](https://www.analog.com/en/resources/analog-dialogue/articles/strapdown-inertial-navigation-system-based-on-an-imu-and-a-geomagnetic-sensor.html)

### Classical Perception Techniques
- [CurbNet: Curb Detection from LiDAR Point Cloud](https://arxiv.org/html/2403.16794v1)
- [LiDAR-Based Road Boundary Detection](https://www.sciencedirect.com/science/article/abs/pii/S0921889020305546)
- [Kalman Filter for Autonomous Vehicle Tracking](https://www.geeksforgeeks.org/overview-of-kalman-filter-for-self-driving-car/)
- [Visual-LiDAR Odometry and Mapping (CMU)](https://frc.ri.cmu.edu/~zhangji/publications/ICRA_2015.pdf)

### TensorRT / Quantization
- [How TensorRT Works: Deep Dive](https://www.abhik.ai/articles/how-tensorrt-works)
- [TensorRT Quantization Documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-quantized-types.html)
- [NVIDIA Optimal AI Inference Pipeline for AV](https://developer.nvidia.com/blog/designing-an-optimal-ai-inference-pipeline-for-autonomous-driving/)

### Additional Analysis
- [Decoding Nuro: From Last-Mile Delivery to Scaled Autonomy (Boring Sage)](https://www.boringsage.com/post/decoding-nuro-from-last-mile-delivery-to-scaled-autonomy)
- [Nuro Patent Analysis (GreyB)](https://insights.greyb.com/nuro-patents/)
- [Scale AI -- Nuro Customer Story](https://scale.com/customers/nuro)
