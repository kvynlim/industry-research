# Cruise Autonomous Vehicle: Non-ML and Hybrid Perception Deep Dive

> **Last Updated:** March 2026
> **Companion to:** cruise-perception-deep-dive.md

---

## Table of Contents

1. [Strobe FMCW LiDAR Signal Processing](#1-strobe-fmcw-lidar-signal-processing)
2. [Articulating Radar Assemblies (ARAs)](#2-articulating-radar-assemblies-aras)
3. [Sensor Preprocessing](#3-sensor-preprocessing)
4. [Calibration](#4-calibration)
5. [State Estimation and Tracking](#5-state-estimation-and-tracking)
6. [Classical Perception](#6-classical-perception)
7. [October 2023 Incident -- Non-ML Failure Analysis](#7-october-2023-incident----non-ml-failure-analysis)
8. [Hybrid ML+Classical](#8-hybrid-mlclassical)
9. [GM Super Cruise Classical Heritage](#9-gm-super-cruise-classical-heritage)

---

## 1. Strobe FMCW LiDAR Signal Processing

### 1.1 FMCW Technology -- Strobe's Chip-Scale FMCW LiDAR

Cruise acquired **Strobe Inc.** in October 2017, a 12-person startup founded by **Lute Maleki**, formerly of OEwaves. In 2014, Maleki co-founded Strobe as a spin-off from OEwaves, bringing with him expertise in ultra-high-Q optical resonators. Strobe's core innovation is a **chip-scale FMCW (Frequency-Modulated Continuous Wave) LiDAR** that collapses the entire sensor down to a single photonic integrated circuit.

#### 1.1.1 Silicon Photonics Integration

Strobe's architecture is built on a **silicon photonics platform** where all functional elements of the LiDAR system -- laser source, modulator, splitter, waveguides, photodetectors, and processing electronics -- are fabricated on a single silicon substrate using **photolithographic methods**. This is the same fabrication technology used for CMOS semiconductor manufacturing, enabling mass production at scale.

The key components integrated on-chip include:

- **Laser source with optical injection locking**: A semiconductor laser diode optically coupled to a whispering gallery mode (WGM) optical resonator. The resonator acts as an ultra-narrow linewidth filter.
- **Optical waveguides**: Silicon waveguides route light between components on-chip, replacing free-space optics and fiber interconnects.
- **Beam splitter**: Divides the modulated laser output into a transmitted chirp (Tx) and a local oscillator reference chirp (LO).
- **Photodetectors/photodiodes**: Convert the returning optical signal and the reference signal to electrical signals.
- **Amplifier circuits**: Integrated with photodetectors for signal conditioning.
- **FFT processing module**: Performs fast Fourier transform on the beat frequency signal.
- **Data analysis processor**: Derives spatial coordinates and velocity from FFT output. Strobe's patent (US20160299228A1) mentions processors like "SnapDragon chips from Qualcomm" as candidate on-board processors.

The working wavelength is **1550 nm** -- the standard telecom C-band wavelength -- chosen because existing telecom device supply chains make components at this wavelength inexpensive, and 1550 nm is eye-safe at higher power levels than shorter wavelengths (905 nm used by most ToF LiDARs).

#### 1.1.2 Whispering Gallery Mode Optical Resonator

The core of Strobe's innovation is the use of a **whispering gallery mode (WGM) optical resonator** to achieve ultra-narrow laser linewidth and highly linear frequency chirps. This technology originated from Maleki's work at OEwaves.

**Operating principle**: Light from the source laser is coupled into the WGM resonator (which can be spherical, discoidal, toroidal, or ring-shaped). Inside the resonator, light propagates as a self-reinforcing whispering gallery mode wave -- circulating around the inner surface of the resonator via total internal reflection, similar to sound waves traveling along the curved walls of a whispering gallery. A **counterpropagating wave** exits the resonator and returns to the source laser, providing **optical injection locking** that narrows the laser linewidth.

**Performance achieved**:
- Laser linewidth reduced to **less than 1 kHz**, and potentially **less than 100 Hz**
- Relative intensity noise (RIN) reduced **by at least a factor of 10** compared to the source laser alone
- This ultra-narrow linewidth enables large-bandwidth chirps (10+ GHz) while maintaining exceptional linearity

**Chirp modulation mechanism**: Rather than electronically modulating the laser frequency (which introduces nonlinearity), Strobe modulates the **optical properties of the WGM resonator itself**. A transducer -- which can be a resistive heater, piezoelectric device, or electrode -- alters the resonator's refractive index. Since the laser is injection-locked to a whispering gallery mode, shifting the resonant frequency of that mode automatically and precisely shifts the laser frequency. This produces highly linear, reproducible frequency ramps without electronic feedback systems.

**Chirp specifications** (from US20160299228A1):
- Chirp bandwidth: **10 GHz or greater** (examples given: 1, 5, 10, 15+ GHz)
- Linearity: r-values (correlation coefficient) from **0.8 to greater than 0.995**
- Linearity deviation: **less than 0.2%** at best
- Chirp reproducibility: coefficient of variation **less than 1%** across populations of chirps
- Chirp types: monotonic linear ramps, biphasic (ascending then descending), sigmoidal

#### 1.1.3 Optical Phased Array Beam Steering

Strobe's patent references multiple beam steering approaches: rotating or gimbal-mounted mirrors, MEMS devices, rotating prisms, rotating lenses, and **phased array steering devices**. The silicon photonics platform is particularly well-suited to optical phased arrays (OPAs) because waveguide-based phase shifters can be fabricated directly on the chip.

In the broader silicon photonic FMCW LiDAR literature (which Strobe's approach builds on), OPA beam steering works as follows:

- **Transmitter-receiver interleaved coaxial architecture**: Two sets of OPA antennas (transmitter and receiver) are integrated on the optical chip to form a coaxial coherent optical system.
- **Solid-state scanning**: Beam direction is controlled electronically by adjusting the phase of light in each waveguide element of the array, with no moving parts. Demonstrated scanning rates up to **200 MHz** and steering ranges of **80 degrees**.
- **Wavelength-based steering**: In one axis, beam direction is controlled by wavelength tuning; in the orthogonal axis, by phase shifting. This enables 2D scanning from a 1D array.

For the Cruise Origin, Strobe's vision was to integrate this scanning capability entirely on-chip, eliminating the mechanical spinning assemblies of conventional LiDAR.

#### 1.1.4 Coherent Detection

FMCW LiDAR uses **coherent detection** (also called optical heterodyne detection), which is fundamentally different from the direct detection used in time-of-flight LiDAR.

**Operating principle**: Light from the frequency-swept laser is split into two portions. The transmit portion (Tx) is sent to the target. The local oscillator portion (LO) is kept on-chip and does not travel to the target. The returning signal reflected from the target is **interferometrically recombined** with the LO on the photodetector.

**Key advantage**: Because the system measures the interference between the returned signal and the LO, it is sensitive only to light at the exact frequency of the LO. This provides:

- **Ambient light rejection**: Sunlight, streetlights, and other LiDAR systems produce light at different frequencies and are rejected by the coherent detection process. Kyle Vogt noted that Strobe's FMCW LiDAR is "relatively immune" to interference from other LiDAR systems and sunlight, "even in extreme cases."
- **Reduced detector requirements**: Coherent detection provides an inherent amplification (the LO acts as an optical amplifier at the detector), eliminating the need for expensive, highly sensitive photodetectors such as APDs (avalanche photodiodes) or SPADs (single-photon avalanche diodes) required by ToF LiDAR.
- **Low power operation**: Strobe's patent states the system can operate with laser power **as low as 3 mW**, yet achieve ranges of **200 meters or more** with SNR as low as 10 dB.

Strobe's specific coherent detection architecture eliminates the need for **a separate complex local oscillator** -- the same injection-locked FMCW laser provides both the transmitted chirp and the LO reference via a simple beam splitter. This is a significant simplification over prior FMCW LiDAR implementations.

#### 1.1.5 On-Chip Processing

After coherent detection, the combined electrical signals from the photodetectors undergo:

1. **Amplification**: Integrated transimpedance amplifiers convert photocurrent to voltage.
2. **Digitization**: Analog-to-digital conversion of the beat signal.
3. **FFT analysis**: Fast Fourier transform extracts the beat frequency components, revealing range and velocity information.
4. **Scan timing**: Synchronization circuitry coordinates beam scanning with signal acquisition.
5. **Data analysis**: A processor derives 3D spatial coordinates (x, y, z) and per-point velocity (vx, vy, vz) from the FFT output.

All of these processing stages can be integrated on the same silicon chip as the photonic components, or on a closely coupled electronic chip in a system-in-package configuration.

### 1.2 Doppler Processing -- Per-Point Velocity from FMCW

FMCW LiDAR's most significant advantage over ToF LiDAR is **instantaneous per-point velocity measurement** via the Doppler effect. Each point in the FMCW point cloud contains not just position [X, Y, Z] but also velocity [Vx, Vy, Vz] -- this is why FMCW LiDAR is sometimes called **4D LiDAR**.

#### 1.2.1 Doppler Shift Physics

When the FMCW laser illuminates a moving target, the reflected light undergoes a Doppler frequency shift proportional to the target's radial velocity:

```
f_Doppler = 2v * f_0 * cos(theta) / c
```

Where:
- `v` = instantaneous radial velocity of the target
- `f_0` = center optical frequency of the laser
- `theta` = angle between the target velocity vector and the beam path
- `c` = speed of light

At 1550 nm (f_0 ~ 193 THz), a target moving at 1 m/s produces a Doppler shift of approximately **1.29 MHz**. This is easily resolvable with standard electronics.

#### 1.2.2 Extracting Velocity from Up-Chirp and Down-Chirp

To separate range information from velocity information, FMCW LiDAR uses **triangular modulation** -- alternating up-chirps (frequency increasing) and down-chirps (frequency decreasing):

- During an **up-chirp**: the measured beat frequency is `f_beat_up = f_range - f_Doppler`
- During a **down-chirp**: the measured beat frequency is `f_beat_down = f_range + f_Doppler`

By measuring beat frequencies during both chirp phases:
- **Range beat frequency**: `f_range = (f_beat_up + f_beat_down) / 2`
- **Doppler frequency**: `f_Doppler = (f_beat_down - f_beat_up) / 2`

This simultaneous extraction eliminates the need for frame-to-frame correspondence matching to derive velocity, which is computationally expensive and error-prone for fast-moving or briefly-visible objects.

#### 1.2.3 Velocity Resolution

Velocity resolution depends on the **chirp duration** (observation time). For a chirp duration T:

```
delta_v = lambda / (2T)
```

Published experimental results in the FMCW LiDAR literature demonstrate velocity precision of **0.037 m/s** (approximately 0.13 km/h). For autonomous driving applications, this level of precision enables:

- Distinguishing stationary objects from slowly moving objects (parked cars vs. cars creeping in traffic)
- Detecting pedestrian walking speed (typically 1.2--1.5 m/s)
- Measuring vehicle speeds with centimeter-per-second precision
- Identifying which parts of a scene are moving and in what direction, from a single scan

#### 1.2.4 Downstream Benefits for Cruise

Kyle Vogt specifically highlighted that Strobe's FMCW LiDAR provides **both accurate distance and velocity information, which can be checked against similar information from a RADAR sensor for redundancy**. The per-point velocity data enables:

- **Instantaneous moving object segmentation**: Points with non-zero radial velocity immediately flag moving objects, without requiring frame differencing.
- **Velocity cross-validation**: FMCW LiDAR Doppler measurements can be directly compared to radar Doppler measurements for redundant confirmation.
- **Reduced computational burden**: Eliminating frame-to-frame velocity estimation saves GPU compute cycles and reduces latency.
- **Improved prediction inputs**: Direct velocity measurement feeds cleaner, lower-latency velocity estimates to the prediction system.

### 1.3 Range Processing -- Beat Frequency Extraction

#### 1.3.1 Beat Frequency Generation

The fundamental range measurement in FMCW LiDAR relies on the **beat frequency** generated by mixing the returned signal with the local oscillator:

```
f_beat = kappa * tau_D
```

Where:
- `kappa` = chirp rate (Hz/s) -- the rate at which the laser frequency changes
- `tau_D` = round-trip time delay = `2R / c`
- `R` = target range
- `c` = speed of light

Rearranging:

```
R = f_beat * c / (2 * kappa)
```

The beat frequency is extracted by performing an **FFT** on the digitized interference signal from the photodetector. Each peak in the FFT spectrum corresponds to a target at a specific range.

#### 1.3.2 Range Resolution

Range resolution -- the minimum separation between two targets that can be independently resolved -- depends solely on the **chirp bandwidth** B:

```
delta_R = c / (2B)
```

For Strobe's system with chirp bandwidth B = 10 GHz:

```
delta_R = (3 * 10^8) / (2 * 10^10) = 1.5 cm
```

Strobe's patent claims range resolution of **10 cm, 7.5 cm, 5 cm, 2.5 cm, 1 cm, or less than 1 cm** depending on configuration. At 10+ GHz bandwidth, sub-2-cm resolution is theoretically achievable.

#### 1.3.3 Range Precision

Range precision (the accuracy of a single measurement) follows the Cramer-Rao lower bound:

```
sigma_R ~ delta_R / sqrt(SNR)
```

With good SNR (e.g., 20 dB), range precision of **millimeters** is achievable. Published experimental results demonstrate **16 mm distance precision** at ranges exceeding 200 meters.

#### 1.3.4 Maximum Range

Strobe's patent claims maximum range of **200 meters or more** with laser power as low as 3 mW. The company's prototype reportedly achieved **300-meter range** (984 feet). This long range is enabled by coherent detection's inherent sensitivity advantage over direct detection.

### 1.4 Cost Reduction -- Chip-Scale Integration

#### 1.4.1 The 99% Cost Reduction Claim

Kyle Vogt stated at the time of the Strobe acquisition that chip-scale integration would **"reduce the cost of each LIDAR on our self-driving cars by 99%."** Strobe reportedly had a **$100 prototype LiDAR** with 300-meter range and sub-45-millisecond processing time. For context, the Velodyne HDL-64E used on early Cruise AVs cost approximately **$75,000 per unit**.

#### 1.4.2 Sources of Cost Reduction

The cost reduction comes from multiple factors inherent to chip-scale silicon photonics:

**Fabrication**: Silicon photonic circuits are manufactured using the same CMOS lithographic processes used for semiconductor chips. A single silicon wafer can yield hundreds or thousands of LiDAR chips, with marginal cost per unit dropping dramatically at volume. The patent states: "Such LIDAR systems can be compact and can be produced economically on a silicon wafer using photolithographic methods."

**Component elimination**: Strobe's architecture eliminates several expensive discrete components:
- No separate local oscillator laser (the same injection-locked laser provides both Tx and LO)
- No complex interferometer (replaced by on-chip beam splitter and waveguides)
- No highly sensitive photodetectors (coherent detection eliminates the need for APDs/SPADs)
- No mechanical spinning assembly (replaced by solid-state beam steering)
- No bulk optical components (replaced by integrated waveguides)

**Volume manufacturing**: Silicon photonics leverages the existing semiconductor foundry ecosystem. Components that were previously assembled from discrete optical elements by skilled technicians become a single chip produced by automated fabrication.

**Simplified packaging**: A chip-scale device requires minimal packaging compared to a mechanical LiDAR with spinning assemblies, motors, bearings, slip rings, and environmental seals.

#### 1.4.3 Strategic Implications

The cost reduction was strategic for Cruise's planned Cruise Origin -- a purpose-built robotaxi with no steering wheel, designed for volume production. At $75,000 per LiDAR unit and 5 units per vehicle, LiDAR alone would cost $375,000. At $100 per unit, the cost drops to $500 for all five -- making LiDAR economically viable for consumer vehicles, which is directly relevant to GM's current eyes-off Super Cruise plans.

---

## 2. Articulating Radar Assemblies (ARAs)

### 2.1 Servo Control

The ARA is one of Cruise's most distinctive hardware innovations -- a **motorized radar pointing system** that dynamically directs a long-range radar sensor based on the current driving scenario.

#### 2.1.1 Hardware Architecture

Each ARA consists of:
- A **long-range radar sensor** with narrow field of view and excellent range (analogous to a telephoto lens)
- A **motorized actuator** (servo motor) that rotates the radar left and right
- **Positional encoder** for closed-loop position feedback
- **Motor controller** electronics

The Cruise AV fleet deploys **three ARAs**:
- **Two ARAs** positioned in front of the A-pillar on both sides of the vehicle
- **One additional ARA** providing supplementary directional coverage

On the **Cruise Origin**, the ARA design was enhanced with the ability to **pivot 360 degrees** at "superhuman speed," providing omnidirectional long-range radar coverage from a single assembly.

#### 2.1.2 Communication Protocol Stack

The command path from the self-driving software to the physical motor traverses multiple protocols and electronic control units:

```
Self-Driving Brain (Software)
    |
    v
ARA Bridge Software (IPC)
    |
    v
Vehicle Electrical System (Ethernet)
    |
    v
Electronic Control Units (CAN Gateway)
    |
    v
Motor Controller (CANOpen)
    |
    v
ARA Motor (Electromechanical)
```

**CANOpen** is the fieldbus protocol used at the lowest level to communicate with the motor controller. CANOpen is a CAN-based higher-layer protocol commonly used in industrial servo systems and robotics, providing:
- Standardized device profiles for motor controllers
- Process Data Objects (PDOs) for real-time cyclic position/velocity commands
- Service Data Objects (SDOs) for configuration and parameterization
- Emergency objects for fault reporting
- Heartbeat monitoring for communication health

**Ethernet** provides higher-bandwidth communication between the vehicle's computing platform and the CAN gateway ECUs.

**IPC (Inter-Process Communication)** mechanisms connect the ARA Bridge software to the main self-driving software stack running on the compute platform.

#### 2.1.3 Position Control Loop

The ARA Bridge software implements a **position control loop** that determines the optimal motor angle:

1. The self-driving software identifies the current driving scenario and the direction requiring long-range radar coverage.
2. A **directional command** is issued to the ARA Bridge.
3. The ARA Bridge computes the target motor angle using:
   - Current vehicle **localization** (GPS + LiDAR-to-map pose)
   - Current vehicle **pose** (heading, pitch, roll from IMU)
   - **Assembly tolerances** (manufacturing variations in sensor mounting)
   - **Sensor and motor controller versions** (hardware-specific calibration offsets)
   - **Speed and direction** of the AV
4. The computed angle is translated to a CANOpen position command.
5. The motor controller executes the rotation using its internal servo loop (typically PID control with encoder feedback).
6. **Positional encoder information** is transmitted back over the same communication path, confirming the radar is pointing at the intended angle.

This is entirely a **classical control system** -- there is no ML involved in the servo loop. The control is deterministic: given a scenario and vehicle state, the same motor angle is always commanded.

### 2.2 Radar Signal Processing

The radar sensors within the ARAs perform **classical radar signal processing** -- the same fundamental techniques used in radar systems since World War II, refined for automotive applications.

#### 2.2.1 Range-Doppler Processing

Automotive radar (typically 76--81 GHz band) uses **FMCW waveforms** (the same modulation principle as Strobe's LiDAR, but at millimeter-wave radio frequencies rather than optical frequencies):

1. **Chirp transmission**: The radar transmits a series of linear frequency chirps (also called "ramps" or "sweeps").
2. **Range FFT**: For each chirp, the received signal is mixed with the transmitted signal, producing a beat frequency proportional to target range. An FFT across **fast-time** (within a single chirp) yields the **range profile**.
3. **Doppler FFT**: A second FFT across **slow-time** (across successive chirps in a coherent processing interval) extracts the Doppler frequency shift, yielding radial velocity.
4. **Range-Doppler map**: The combined output is a 2D matrix where one axis is range and the other is Doppler velocity. Each cell contains the signal magnitude from targets at that range and velocity.

This is entirely classical signal processing -- FFTs, windowing functions (Hamming, Hanning, Blackman), and spectral analysis. No neural networks are involved.

#### 2.2.2 CFAR Detection

**Constant False Alarm Rate (CFAR)** detection is the classical algorithm used to extract target detections from the range-Doppler map:

- CFAR dynamically computes a detection threshold for each cell based on the estimated noise/clutter level in surrounding cells.
- The algorithm slides a window across the range-Doppler map. For each **cell under test (CUT)**, it estimates the noise floor from neighboring **training cells** (excluding **guard cells** immediately adjacent to the CUT).
- If the CUT's signal power exceeds the noise estimate by a specified factor, a detection is declared.
- Common variants used in automotive radar include **CA-CFAR** (Cell-Averaging), **OS-CFAR** (Ordered Statistic), and **SOCA/GOCA-CFAR** (Smallest/Greatest Of).

CFAR ensures that the false alarm rate remains approximately constant regardless of varying background clutter levels -- critical for automotive applications where the radar must operate in diverse environments (open highway vs. dense urban canyon).

#### 2.2.3 Beamforming and Angle Estimation

After range-Doppler processing, automotive radar estimates the **angle of arrival (AoA)** of detected targets:

- **Digital beamforming**: The radar's receive antenna array (typically 4--12 elements in automotive radar) receives the reflected signal with small phase differences across elements. Processing these phase differences yields the bearing angle to each target.
- **Direction-of-Arrival (DoA) algorithms**:
  - **Bartlett beamforming**: Classical FFT-based spectral estimation across the antenna array.
  - **MVDR/Capon beamforming**: Minimum Variance Distortionless Response -- provides better angular resolution than Bartlett by minimizing the output power subject to a distortionless constraint in the look direction.
  - **MUSIC**: Multiple Signal Classification -- a super-resolution algorithm that separates signal and noise subspaces to achieve angular resolution beyond the diffraction limit of the array.

The output of the complete radar signal processing chain is a set of detections, each with: **range, radial velocity, azimuth angle, elevation angle** (for 4D radar), **and signal strength (RCS)**. This is all classical signal processing with no ML components.

### 2.3 Dynamic Pointing Strategy

The ARA's radar direction is determined by a **scenario-aware pointing policy** implemented in the self-driving software:

#### 2.3.1 Unprotected Left Turns (Primary Use Case)

The canonical ARA use case is the **unprotected left turn** -- one of the most dangerous maneuvers in urban driving:

1. The route planner identifies an upcoming unprotected left turn.
2. The self-driving software commands the ARA to point the long-range radar **down the oncoming traffic lane** to scan for approaching vehicles that have right-of-way.
3. The narrow-beam, long-range radar detects approaching vehicles at distances where camera and LiDAR coverage may be insufficient (200+ meters).
4. The ARA provides velocity measurement of oncoming vehicles via Doppler, enabling the planner to determine if there is a sufficient gap to complete the turn.

This pointing strategy is implemented as **rule-based logic**: if the upcoming maneuver is an unprotected left turn, point the ARA in the direction of oncoming traffic. The direction is computed geometrically from the vehicle's pose, the intersection geometry (from the HD map), and the lane direction of oncoming traffic.

#### 2.3.2 Other Scenarios

While Cruise's published materials emphasize the unprotected left turn scenario, the ARA pointing strategy likely extends to other scenarios where long-range directional detection is valuable:
- **Highway merging**: Scanning for fast-approaching vehicles in the merge lane
- **Intersection clearance**: Scanning cross-traffic directions before proceeding through intersections
- **Adverse weather fallback**: When camera and LiDAR range degrades in fog or rain, the ARA's long-range radar becomes the primary detection modality for distant targets

#### 2.3.3 Diagnostics and Safety Monitoring

All Cruise AVs have software that determines the condition of the ARA upon **startup** and monitors it **continuously during operation**.

**Startup procedures** (six checks):
1. Communication pathway connectivity verification (confirming the full protocol stack -- IPC to Ethernet to CAN to motor -- is operational)
2. Motor calibration confirmation
3. Full range-of-motion validation (commanding the motor through its complete rotation range)
4. Resistance measurement during movement (detecting mechanical binding or degradation)
5. Sensor health check
6. Additional unspecified tests and diagnostics

**Runtime fault monitoring** tracks:
- Communication loss with gateways or controllers
- Voltage irregularities (over-voltage, under-voltage)
- Component temperature deviations (overheating or out-of-range readings)
- Motor operating current elevation (indicating mechanical stress or binding)
- Positional encoder errors

**Graduated response system**: Detected faults trigger responses calibrated to severity:
- **Minor faults**: "Return to the garage after this ride ends" -- the AV completes its current mission, then returns for servicing.
- **Moderate faults**: Reduced operational capability with degraded perception.
- **Severe faults**: "Pull over immediately" -- the AV executes a minimal risk condition stop.

These are entirely **rule-based responses** -- fault conditions map to predefined severity levels, which map to predefined vehicle responses. This is classical embedded systems engineering with deterministic behavior.

---

## 3. Sensor Preprocessing

### 3.1 Camera ISP -- 16-Camera Preprocessing Pipeline

The Cruise AV's **16 cameras** each produce raw sensor data (Bayer-pattern images) that must be converted to usable images before any perception processing. This conversion is handled by an **Image Signal Processor (ISP)** -- a dedicated hardware processing block that is entirely classical (no ML).

#### 3.1.1 ISP Processing Pipeline

The ISP performs a cascade of image processing operations on each camera frame:

1. **Black level subtraction**: Removing sensor dark current offset from raw pixel values.
2. **Defective pixel correction**: Identifying and interpolating dead or stuck pixels using neighboring pixel values.
3. **Lens shading correction**: Compensating for optical vignetting (brightness falloff from center to edges) using calibrated correction maps.
4. **Demosaicing (debayering)**: Converting the Bayer color filter array pattern (RGGB) into full-color RGB images using interpolation algorithms (bilinear, edge-directed, or advanced adaptive methods).
5. **White balance**: Adjusting color channels to compensate for illuminant color temperature, ensuring consistent color representation across varying lighting conditions (daylight, streetlights, headlights).
6. **Color correction matrix (CCM)**: Applying a 3x3 matrix to transform sensor-native color space to a standard color space (sRGB or a custom AV-optimized space).
7. **Noise reduction**: Spatial and temporal denoising to reduce sensor noise, particularly important in low-light nighttime operation.
8. **Sharpening**: Edge enhancement to recover detail lost in the demosaicing and denoising steps.
9. **Gamma correction / tone mapping**: Mapping the sensor's linear intensity response to a perceptually uniform representation.

#### 3.1.2 HDR (High Dynamic Range) Processing

Urban driving presents extreme dynamic range challenges -- bright sunlight on pavement adjacent to deep shadows under overpasses, or headlight glare against dark nighttime backgrounds. Cruise's cameras likely employ **HDR imaging**:

- **Multi-exposure capture**: The camera sensor captures two or more frames in rapid succession with different exposure and gain settings (e.g., short exposure for highlights, long exposure for shadows).
- **HDR merge**: The ISP combines the best-exposed data from each frame into a single composite image with **much wider dynamic range** than any single exposure could achieve.
- **Tone mapping**: The merged HDR image (which may have 16-20+ bits of dynamic range) is compressed to a range suitable for downstream processing while preserving detail in both highlights and shadows.

This is entirely classical image processing -- the algorithms are well-established signal processing and interpolation techniques with no learned components.

#### 3.1.3 Auto-Exposure (AE)

The ISP outputs **image statistics** (histograms, mean brightness, zone-based metering values) that a control algorithm uses to dynamically adjust:

- **Exposure time**: How long the sensor integrates light per frame
- **Analog gain**: Amplification applied to the sensor signal before digitization
- **Digital gain**: Post-digitization amplification (used as a last resort since it amplifies noise)

The AE control loop is a **classical feedback control system** (typically PID-based) that adjusts these parameters to maintain target brightness levels across varying ambient illumination. For autonomous driving, the AE algorithm must be tuned differently than for consumer cameras -- it must prioritize maintaining visibility of road-relevant objects (pedestrians, vehicles, lane markings) rather than producing aesthetically pleasing images.

#### 3.1.4 Scale Across 16 Cameras

All 16 cameras run their ISP pipelines simultaneously. At typical automotive camera resolutions (2-8 megapixels) and frame rates (30-60 fps), the aggregate ISP processing rate across the full camera array is substantial. Modern automotive ISP ASICs (such as the NXP S32N) support up to **16 camera inputs** with real-time processing, suggesting Cruise may use a centralized ISP or a small number of multi-channel ISP processors.

### 3.2 LiDAR Motion Compensation

LiDAR point clouds are distorted by the vehicle's own motion during the scan acquisition period. For a **spinning LiDAR** completing a 360-degree rotation in 100 ms (10 Hz), the vehicle can move 1--3 meters during a single rotation. This means points captured at the beginning of the rotation were measured from a different vehicle position than points captured at the end.

#### 3.2.1 The Distortion Problem

Consider a Velodyne-type spinning LiDAR at the start and end of a single rotation:
- **Start of scan** (0 degrees): Vehicle is at position P_0
- **End of scan** (360 degrees, 100 ms later): Vehicle is at position P_1 = P_0 + delta_P

All points are reported in the sensor frame as if captured from a single position, but they were actually captured from a continuum of positions along the vehicle's trajectory during the scan. This creates **motion distortion** -- straight walls appear curved, stationary objects appear smeared, and precise geometric relationships are corrupted.

#### 3.2.2 Motion Compensation Algorithm

The compensation algorithm adjusts each point by interpolating the vehicle's pose at the time that specific point was captured:

1. **Ego-motion estimation**: The vehicle's trajectory during the scan period is obtained from:
   - **IMU data**: Provides high-rate (100--1000 Hz) measurements of angular velocity and linear acceleration. Integration yields vehicle pose at any time within the scan period.
   - **GPS data**: Provides position fixes (though at lower rate, typically 10--20 Hz).
   - **Wheel odometry**: Vehicle speed from wheel encoders.
   - **Previous LiDAR-based localization**: The pose estimate from the previous scan provides a starting point.

2. **Per-point pose interpolation**: For each LiDAR point with timestamp t_i, the algorithm interpolates the vehicle pose (position + orientation) at time t_i using the IMU/GPS trajectory. Common interpolation methods include linear interpolation for translation and SLERP (Spherical Linear Interpolation) for rotation.

3. **Point transformation**: Each point is transformed from its actual capture pose to the reference pose (typically the pose at the scan start or center time):
   ```
   P_corrected = T_ref^(-1) * T(t_i) * P_raw
   ```
   Where T(t_i) is the vehicle-to-world transform at time t_i.

4. **Output**: A motion-compensated point cloud where all points are expressed as if captured simultaneously from a single position.

This is entirely **classical robotics** -- rigid-body transformations, quaternion interpolation, and IMU integration. No ML is involved.

#### 3.2.3 Solid-State LiDAR Considerations

Solid-state LiDAR (such as the Strobe FMCW sensors) may use flash illumination or rapid electronic steering rather than mechanical rotation. The scan pattern and timing differ from spinning LiDAR, but motion compensation is still required -- any sensor that acquires points over a time interval during which the vehicle moves needs per-point ego-motion correction. The same IMU-based interpolation approach applies.

### 3.3 Time Synchronization -- Synchronizing 42 Sensors

#### 3.3.1 The Synchronization Problem

The Cruise AV has **42 sensors** (5 LiDAR + 16 cameras + 21 radar) that must be temporally aligned. When the late fusion stage combines a camera detection with a LiDAR detection, both measurements must refer to the same instant in time. A 10-millisecond timing error at highway speeds (30 m/s) corresponds to a 30-cm position error -- enough to misalign a camera detection from its corresponding LiDAR cluster.

#### 3.3.2 IEEE 1588 Precision Time Protocol (PTP)

Cruise uses **PTP (Precision Time Protocol, IEEE 1588)** for hardware clock synchronization across sensors. PTP provides:

- **Grandmaster clock**: A single high-accuracy reference clock (typically GPS-disciplined) serves as the time source for the entire sensor system.
- **Clock distribution**: PTP messages are distributed over Ethernet to all sensors and compute nodes, enabling each to synchronize its local clock to the grandmaster.
- **Sub-microsecond accuracy**: PTP achieves synchronization precision of **< 100 microseconds** for LiDAR frames, and can approach nanosecond-level precision with hardware timestamping support (gPTP, IEEE 802.1AS).

#### 3.3.3 Phase Locking -- LiDAR-Camera Synchronization

Cruise implements **phase locking** to synchronize LiDAR rotation with camera frame capture:

- The LiDAR is scheduled to arrive at a certain point of its rotation at a certain point in time.
- Camera exposure triggers are coordinated with the LiDAR rotation phase.
- This ensures that when a camera frame is captured, the corresponding LiDAR points from the same angular sector were captured at approximately the same time.

Without phase locking, a camera might capture an image at a moment when the LiDAR is pointing in a completely different direction, making spatial correspondence between the two modalities unreliable.

#### 3.3.4 Software Timestamp Alignment

Beyond hardware clock synchronization, software-level timestamp processing accounts for:

- **Sensor-specific latencies**: Each sensor has a different internal processing delay between photon capture and data output. These latencies are characterized and compensated.
- **Exposure time accounting**: Camera images integrate light over an exposure period (e.g., 10 ms). The "effective time" of the image is typically the center of the exposure interval.
- **Communication delays**: Network transmission delays between sensors and the compute platform are measured and subtracted.
- **Interpolation**: When sensor timestamps do not exactly align, poses and detections are interpolated to a common reference time.

This is all **classical systems engineering** -- clock distribution protocols, latency characterization, and temporal interpolation. No ML is involved.

---

## 4. Calibration

### 4.1 Multi-Sensor Calibration -- Cross-Calibration Across 42 Sensors

Calibration determines the precise spatial and temporal relationships between all 42 sensors, enabling sensor fusion to combine information from different modalities correctly.

#### 4.1.1 Intrinsic Calibration

Each sensor's internal characteristics are calibrated independently:

**Camera intrinsics**:
- **Focal length** (fx, fy): The effective focal length in pixel units for each axis.
- **Principal point** (cx, cy): The optical center of the image, which may not coincide with the image center due to manufacturing tolerances.
- **Distortion coefficients**: Radial distortion (barrel/pincushion) and tangential distortion coefficients (typically 5--14 parameters depending on the distortion model: Brown-Conrady, fisheye, equidistant).
- **Calibration method**: Typically uses checkerboard or AprilTag patterns photographed from multiple viewpoints, with the intrinsic parameters estimated by minimizing reprojection error (Levenberg-Marquardt optimization). This is a classical nonlinear least-squares problem.

**LiDAR intrinsics**:
- Beam timing calibration: Accounting for time offsets between laser channels.
- Intensity calibration: Normalizing reflectivity values across channels.
- Mechanical alignment: Characterizing the actual beam angles relative to the nominal beam angles (important for multi-channel spinning LiDARs where manufacturing tolerances cause deviations).

**Radar intrinsics**:
- Antenna pattern characterization
- Range calibration (internal delay compensation)
- Doppler calibration

#### 4.1.2 Extrinsic Calibration

Extrinsic calibration determines the 6-DOF rigid-body transformation (3D rotation + 3D translation) between each sensor and the vehicle body frame. For 42 sensors, this is a total of **252 parameters** (6 per sensor).

Cruise's calibration process is described as confirming each sensor's actual position and orientation -- its "extrinsics." Small differences due to **manufacturing, shipping, placement, and road vibration** cause deviations between expected and actual extrinsics. An accurate and efficient calibration process is essential for sensor fusion.

**Cross-sensor calibration pairs** that must be established include:
- Camera-to-camera (16 x 15 / 2 = 120 pairs, though typically mediated through the body frame)
- Camera-to-LiDAR (16 x 5 = 80 pairs)
- Camera-to-radar (16 x 21 = 336 pairs)
- LiDAR-to-LiDAR (5 x 4 / 2 = 10 pairs)
- LiDAR-to-radar (5 x 21 = 105 pairs)
- Radar-to-radar (21 x 20 / 2 = 210 pairs)

In practice, calibration is performed transitively through the vehicle body frame: each sensor is calibrated to the body frame, and sensor-to-sensor transforms are computed by composing individual transforms.

#### 4.1.3 Calibration Algorithms

Extrinsic calibration between sensor modalities uses different classical approaches depending on the sensor pair:

**Camera-LiDAR**: The most common approach uses target-based methods (e.g., checkerboard visible in both camera image and LiDAR point cloud) or targetless methods (matching edge features or planes between modalities). The optimization minimizes the reprojection error between LiDAR points projected into the camera image and corresponding image features.

**Camera-Radar**: Similar to camera-LiDAR but using radar reflectors (corner reflectors) as calibration targets visible to both sensors.

**LiDAR-LiDAR**: Point cloud registration algorithms (ICP -- Iterative Closest Point, or NDT -- Normal Distributions Transform) align overlapping point clouds from different LiDARs.

All of these are **classical optimization algorithms** -- nonlinear least squares, ICP, and point-to-plane or point-to-distribution matching. No ML is used.

### 4.2 Online Calibration -- Real-Time Monitoring and Drift Detection

#### 4.2.1 The Drift Problem

After factory calibration, sensor extrinsics gradually drift due to:
- **Vibration and road shock**: Continuous driving over rough roads loosens sensor mounts.
- **Thermal cycling**: Expansion and contraction of mounting structures with temperature changes.
- **Minor impacts**: Curb strikes, pothole impacts, and car wash brush contacts can shift sensor positions.
- **Material fatigue**: Long-term creep of adhesives and mounting brackets.

Even small drifts (sub-degree rotational, millimeter translational) can significantly degrade perception quality, especially for camera-LiDAR fusion at long ranges.

#### 4.2.2 Online Calibration Monitoring

Cruise's online calibration system continuously monitors calibration quality during operation:

- **Track-to-track association monitoring**: The system monitors whether detections from different sensor modalities remain well-aligned. If a camera detection consistently fails to associate with the corresponding LiDAR detection, this may indicate a calibration drift.
- **Error model tracking**: Pre-trained error models (trained with examples of correct and incorrect calibration settings) detect when the current sensor alignment has drifted beyond acceptable bounds.
- **Feature-based consistency checks**: Natural features in the environment (lane markings, pole positions, building edges) that are visible to multiple sensors provide continuous calibration reference points. Persistent misalignment between modalities when observing the same feature indicates drift.

#### 4.2.3 Drift Correction

When drift is detected, the system can:
- **Apply small corrections online**: If the drift is within a correctable range, the extrinsic transform is updated in real-time.
- **Flag for factory recalibration**: If drift exceeds the online correction range, the vehicle is flagged for return to the depot for full recalibration.
- **Trigger degraded operation**: If calibration quality drops below a threshold, perception confidence is reduced, which may trigger reduced speed or a pull-over.

### 4.3 Factory Calibration

#### 4.3.1 Physical Calibration Process

Initial calibration is performed when a vehicle enters the fleet:

1. **Sensor installation**: All 42 sensors are installed on the vehicle according to engineering specifications.
2. **Fixture-based calibration**: Calibration targets (checkerboards, corner reflectors, reference poles) are placed at known positions in a calibration bay.
3. **Data collection**: All sensors simultaneously observe the calibration targets.
4. **Optimization**: Calibration software solves for the extrinsic transforms that minimize the aggregate error across all sensor-to-target measurements.
5. **Verification**: The calibrated transforms are verified against known ground truth (target positions measured by a precision coordinate measurement system).

#### 4.3.2 Simulation-Accelerated Calibration

Cruise developed a **Sensor Placement Tool** that uses simulation to accelerate calibration development:

- **Virtual sensor placement**: Engineers can evaluate different sensor layouts, including cameras with different fields of view and distortion characteristics, before physical installation.
- **Accurate sensor models**: The tool models camera field of view and distortion, radar field of view, range, and point cloud distribution, and LiDAR beam distribution and intensity. Simulated sensors are refined through rigorous comparison against real-world sensor data.
- **Virtual calibration**: Starting from a simulated environment ensures "perfect calibration by calibrating to a known good simulation setup as opposed to starting from a setup vehicle, which will inherently have some minor calibration offsets."
- **Calibration setup evaluation**: Engineers evaluate calibration setups (target types, target positions, calibration procedures) needed for proper calibration "all on a computer in a fraction of the time that it would take to reposition the various fixtures manually."

This simulation-based approach was particularly important for the Cruise Origin, which had a novel sensor layout that could not be derived from existing vehicle calibration experience.

---

## 5. State Estimation and Tracking

### 5.1 Kalman Filtering -- EKF for Multi-Object Tracking

#### 5.1.1 The Kalman Filter in Cruise's Tracker

Cruise's engineering publications confirm the use of **Kalman Filters** as a core component of the state estimation pipeline. The tracker operates in the **tracking-by-detection** paradigm: detections arrive from the perception pipeline, and the tracker maintains persistent object states across frames.

#### 5.1.2 State Vector

For each tracked object, the Kalman filter maintains a state vector that typically includes:

```
x = [px, py, pz, vx, vy, vz, ax, ay, heading, yaw_rate, length, width, height]
```

Where:
- `px, py, pz` -- 3D position in the ego-centric or world frame
- `vx, vy, vz` -- 3D velocity
- `ax, ay` -- 2D acceleration (lateral and longitudinal)
- `heading` -- orientation (yaw angle)
- `yaw_rate` -- angular velocity
- `length, width, height` -- bounding box dimensions (may be estimated or fixed)

The associated **covariance matrix** P encodes the uncertainty of each state component and their correlations.

#### 5.1.3 Motion Models

The Kalman filter's **prediction step** propagates the state forward using a motion model:

**Constant Velocity (CV)** model:
```
px(t+dt) = px(t) + vx(t) * dt
vx(t+dt) = vx(t)
```

**Constant Acceleration (CA)** model:
```
px(t+dt) = px(t) + vx(t) * dt + 0.5 * ax(t) * dt^2
vx(t+dt) = vx(t) + ax(t) * dt
```

**Constant Turn Rate and Velocity (CTRV)** model (for vehicles):
```
px(t+dt) = px(t) + v/omega * (sin(heading + omega*dt) - sin(heading))
py(t+dt) = py(t) + v/omega * (cos(heading) - cos(heading + omega*dt))
heading(t+dt) = heading(t) + omega * dt
```

The **Extended Kalman Filter (EKF)** handles the nonlinearity of the CTRV model by linearizing the motion model around the current state estimate using a Jacobian matrix. The standard Kalman filter assumes linear dynamics and would produce poor predictions for turning vehicles.

#### 5.1.4 Update Step

When a new detection is associated with an existing track, the **update step** combines the predicted state with the measurement:

```
K = P_pred * H^T * (H * P_pred * H^T + R)^(-1)    (Kalman gain)
x_updated = x_pred + K * (z - H * x_pred)            (state update)
P_updated = (I - K * H) * P_pred                      (covariance update)
```

Where:
- `K` -- Kalman gain (determines how much to trust the measurement vs. prediction)
- `H` -- measurement model matrix (maps state space to measurement space)
- `R` -- measurement noise covariance (characterizes sensor accuracy)
- `z` -- detection measurement vector

This is **entirely classical estimation theory** -- no learned parameters, no neural networks. The Kalman filter has been the workhorse of state estimation since the 1960s.

#### 5.1.5 Limitations Acknowledged by Cruise

Cruise's engineering publications noted that compared with Kalman Filters and Particle Filters, **deep learning models adapt faster to sudden kinematic changes**, which is vital for accident avoidance when encountering moving objects. This acknowledges that the classical Kalman filter, with its fixed motion model, struggles when objects exhibit abrupt behavior changes (e.g., a car suddenly swerving, a pedestrian jumping into the road). Cruise's hybrid approach uses learned models to augment or replace the Kalman filter's motion model in such scenarios.

### 5.2 Data Association -- Hungarian Algorithm

#### 5.2.1 The Assignment Problem

At each perception frame, the tracker receives a set of new detections that must be matched to existing tracks. This is a **linear assignment problem**: given N existing tracks with predicted positions and M incoming detections, find the optimal one-to-one assignment that minimizes total cost.

#### 5.2.2 Cost Matrix Construction

The cost of assigning detection j to track i is computed from multiple factors:

- **Mahalanobis distance**: The statistically normalized distance between the detection and the track's predicted position, accounting for the track's uncertainty (covariance). This weights the spatial distance by the track's confidence -- a track with high uncertainty accepts detections from a wider spatial region.
  ```
  d_M = sqrt((z - H*x_pred)^T * S^(-1) * (z - H*x_pred))
  ```
  Where S = H * P_pred * H^T + R is the innovation covariance.

- **IoU (Intersection over Union)**: The overlap between the predicted bounding box and the detected bounding box. Used in SORT-style trackers.

- **Velocity agreement**: The difference between the track's predicted velocity and the detection's measured velocity (if available from radar Doppler or FMCW LiDAR).

- **Classification consistency**: Penalty for associating a detection of one class (e.g., pedestrian) with a track of a different class (e.g., vehicle).

- **Appearance similarity**: CNN-extracted appearance embeddings from camera images can provide a feature vector for each detection, with cosine similarity between detection and track appearance features reducing identity switches through occlusion (as in DeepSORT).

#### 5.2.3 Hungarian Algorithm

The **Hungarian algorithm** (also known as the Kuhn-Munkres algorithm) solves the linear assignment problem optimally in O(n^3) time:

1. Build the cost matrix C where C[i,j] = cost of assigning detection j to track i.
2. Apply the Hungarian algorithm to find the assignment that minimizes total cost.
3. Apply a **gating threshold**: reject assignments where the cost exceeds a maximum threshold (preventing detections of new objects from being incorrectly matched to existing tracks).

This is a **classical combinatorial optimization algorithm** from 1955, with no ML components.

### 5.3 Track Management -- M-of-N Initialization, Coasting, Deletion

#### 5.3.1 Track Lifecycle States

Each track exists in one of several states:

```
[Tentative] ---(M detections in N frames)---> [Confirmed]
[Confirmed] ---(no detection for K frames)---> [Coasting]
[Coasting]  ---(detection received)---------> [Confirmed]
[Coasting]  ---(no detection for L frames)---> [Deleted]
[Tentative] ---(insufficient detections)-----> [Deleted]
```

#### 5.3.2 M-of-N Initialization

A new track starts in a **tentative** state when a detection appears that does not match any existing track. The track is promoted to **confirmed** only after receiving **at least M detections within the first N updates** (the M-of-N criterion).

For example, with M=3, N=5:
- A new detection creates a tentative track.
- If 3 or more detections are associated with this track within the next 5 frames, it is confirmed.
- If fewer than 3 detections arrive in 5 frames, the tentative track is deleted.

This prevents **false track creation** from transient noise detections -- a single spurious detection will not create a confirmed track. The M-of-N parameters are tuned based on sensor reliability and the application's tolerance for latency vs. false positives.

#### 5.3.3 Coasting

When a confirmed track receives no matching detection for one or more consecutive frames (due to occlusion, sensor dropout, or the object momentarily leaving the sensor field of view):

- The Kalman filter continues to **predict** (coast) the track's state forward using the motion model, without an update step.
- The track's **covariance grows** with each prediction-only cycle, reflecting increasing uncertainty.
- The tracker maintains the track's identity during brief occlusions, preventing identity switches when the object reappears.

Coasting is bounded: after **K consecutive missed detections**, the track's covariance becomes so large that it is no longer useful, and the track transitions to deletion.

#### 5.3.4 Deletion

A track is deleted when:
- It has been coasting for too many frames without receiving a matching detection (exceeding the **deletion threshold**).
- Its covariance has grown beyond a maximum bound, indicating the state estimate is no longer reliable.
- It was tentative and failed the M-of-N initialization criterion.

These track lifecycle parameters (M, N, coasting duration, deletion threshold) are classical engineering design parameters, not learned. They are tuned through testing and validation.

---

## 6. Classical Perception

### 6.1 Ground Plane Estimation

#### 6.1.1 Role in the Perception Pipeline

Ground plane estimation separates LiDAR points belonging to the road surface from above-ground points belonging to objects. This is a critical preprocessing step because:

- Object detection algorithms (both classical and ML-based) perform much better when ground points are removed, as ground clutter creates false object candidates.
- Free space estimation requires knowing where the drivable surface is.
- Road geometry (slopes, curvature, banking) affects vehicle dynamics modeling.

#### 6.1.2 RANSAC-Based Ground Plane Fitting

The most common classical approach to ground plane estimation is **RANSAC (Random Sample Consensus)** plane fitting:

1. **Random sampling**: Randomly select 3 points from the point cloud (the minimum needed to define a plane).
2. **Model fitting**: Fit a plane to the 3 selected points: `ax + by + cz + d = 0`.
3. **Inlier counting**: Count how many other points in the cloud lie within a distance threshold of this plane. Points within the threshold are **inliers** (ground points); points outside are **outliers** (above-ground objects).
4. **Iteration**: Repeat steps 1--3 for many iterations (typically 100--1000), keeping the plane model with the most inliers.
5. **Final fit**: Refit the plane using all inliers from the best model (least-squares fit).

RANSAC is robust to outliers (objects protruding from the ground) because it only needs 3 points to define a candidate plane, and outliers are unlikely to be consistently selected.

#### 6.1.3 Piecewise and Adaptive Ground Models

Urban roads are not perfectly flat -- they have slopes, crowns, curbs, and intersections with different grades. Advanced ground estimation uses:

- **Piecewise planar models**: Divide the point cloud into spatial cells and fit a separate plane to each cell, allowing the ground model to follow road curvature.
- **Height thresholding**: After fitting the ground plane, classify points as ground if their height above the fitted plane is below a threshold (e.g., 20 cm).
- **Morphological filtering**: Apply min/max pooling operations on height grids to separate ground from objects based on local height variations.

These are all **classical algorithms** -- RANSAC, least-squares fitting, and grid-based processing. Some AV companies have begun using learned ground segmentation (e.g., GndNet, which uses PointNet for ground estimation), but the classical approaches remain widely used as they are fast, interpretable, and reliable.

### 6.2 Point Cloud Clustering

#### 6.2.1 Purpose

After ground removal, the remaining above-ground LiDAR points must be grouped into clusters, where each cluster represents a distinct physical object. This clustering is used both as input to ML-based detection (providing candidate regions) and as a fallback classical detection method.

#### 6.2.2 DBSCAN (Density-Based Spatial Clustering of Applications with Noise)

**DBSCAN** is the most common clustering algorithm used in LiDAR point cloud processing for autonomous driving:

**Parameters**:
- `epsilon` (eps): The maximum distance between two points for them to be considered neighbors.
- `minPts`: The minimum number of points required to form a dense region (cluster).

**Algorithm**:
1. For each unvisited point P, find all points within distance epsilon (the epsilon-neighborhood).
2. If the neighborhood contains at least minPts points, P is a **core point**, and a new cluster is created containing P and its neighbors.
3. Expand the cluster by recursively adding all density-reachable points (points within epsilon of any core point in the cluster).
4. Points that are not core points and not density-reachable from any core point are classified as **noise**.

**Advantages for LiDAR**:
- Does not require specifying the number of clusters in advance (unlike k-means)
- Can find clusters of arbitrary shape (vehicles, walls, poles)
- Naturally handles noise (isolated spurious points)
- Computationally efficient with spatial indexing (KD-tree, R-tree) -- O(n log n)

**Limitations**:
- The fixed epsilon parameter struggles with LiDAR's **varying point density** -- objects near the vehicle have high point density, while distant objects have sparse points. A single epsilon value that works for nearby objects will over-segment distant objects (or vice versa).
- **Adaptive DBSCAN** variants address this by scaling epsilon with range.

#### 6.2.3 Euclidean Clustering

A simpler alternative to DBSCAN, **Euclidean clustering** groups points that are within a distance threshold of each other using a region-growing approach:

1. Select an unvisited point as a seed.
2. Find all points within distance d of the seed and add them to the cluster.
3. For each newly added point, find its neighbors within distance d and add them.
4. Repeat until no more points can be added.
5. Start a new cluster from the next unvisited point.

This is equivalent to connected-component analysis on a proximity graph and is computationally simpler than DBSCAN but less robust to noise.

### 6.3 Free Space Estimation -- Occupancy Grid Bayesian Updates

#### 6.3.1 Occupancy Grid Representation

The environment around the Cruise AV is represented as a 2D grid of cells in **bird's-eye view (BEV)**, where each cell stores a **probability of occupancy** -- the likelihood that the cell contains an obstacle.

Grid parameters (typical for AV applications):
- **Cell size**: 10--20 cm per cell
- **Grid extent**: 100--200 meters in each direction from the vehicle
- **Update rate**: 10--20 Hz (matching LiDAR scan rate)

#### 6.3.2 Bayesian Update

Each sensor observation updates the occupancy probability of each grid cell using **Bayes' theorem**. The standard approach uses the **log-odds representation** for computational efficiency:

```
l(x) = log(P(occupied) / P(free))
```

The Bayesian update in log-odds space is additive:

```
l(x | z_1:t) = l(x | z_1:t-1) + l(x | z_t) - l_0
```

Where:
- `l(x | z_1:t)` = updated log-odds after incorporating measurement z_t
- `l(x | z_1:t-1)` = prior log-odds from all previous measurements
- `l(x | z_t)` = log-odds from the current measurement alone (derived from the sensor model)
- `l_0` = prior log-odds (typically log(0.5/0.5) = 0 for a uniform prior)

**Sensor model**: For LiDAR, the sensor model assigns:
- **High occupancy probability** to cells where a LiDAR return was detected (the beam hit something).
- **High free probability** to cells along the beam path between the sensor and the return point (the beam passed through freely).
- **No information** to cells beyond the return point (occluded by the obstacle).

This update is applied for every LiDAR beam in every scan, incrementally building a probabilistic map of free and occupied space.

#### 6.3.3 Free Space Extraction

The free space (drivable area) is extracted from the occupancy grid by thresholding:
- Cells with `P(occupied) < threshold` (e.g., 0.3) are classified as free.
- Cells with `P(occupied) > threshold` are classified as occupied.
- The boundary between free and occupied cells defines the **free space boundary**.

This is entirely **classical probabilistic robotics** -- the Bayesian occupancy grid framework was introduced by Moravec and Elfes in 1985 and remains a foundational algorithm in robotics perception. No ML is involved.

### 6.4 Map-Based Localization -- LiDAR-to-Map Scan Matching

#### 6.4.1 Localization Architecture

Cruise's localization system is one of its most important **non-ML components**. The system determines the vehicle's precise 6-DOF pose (position + orientation) in the HD map frame by comparing live LiDAR scans against the pre-built HD map.

Cruise's HD maps store important **pre-computed information** about the world, including lane geometry, traffic signal positions, road boundaries, and 3D structural features. The map encodes information based on **thousands of interactions** in each area, providing the AV with contextual knowledge that would be extremely difficult to derive from sensors alone.

#### 6.4.2 Scan Matching Algorithms

Two classical scan matching algorithms are commonly used for LiDAR-based localization in autonomous vehicles:

**ICP (Iterative Closest Point)**:
1. For each point in the live LiDAR scan, find the closest point in the map point cloud.
2. Compute the rigid transformation (rotation + translation) that minimizes the sum of squared distances between matched point pairs.
3. Apply the transformation to the live scan and repeat until convergence.

ICP is simple and widely used but can converge to local minima if the initial pose estimate is poor.

**NDT (Normal Distributions Transform)**:
1. The map point cloud is divided into voxels (3D cells).
2. For each voxel, the mean and covariance of the contained points are computed, creating a set of **normal distributions** that represent the local geometry.
3. For the live scan, the algorithm optimizes the transformation that maximizes the probability of the live scan points under the map's normal distributions.

NDT is generally **superior to ICP** in terms of accuracy, robustness, and computational efficiency. It handles environmental changes (parked cars, construction) better because the normal distribution representation smoothly accommodates minor geometric variations.

Both algorithms achieve **centimeter-level localization accuracy** in favorable conditions. This precision is essential because the HD map provides lane-level context (which lane the vehicle is in, where the traffic lights are, where the stop line is) that depends on knowing the vehicle's position within centimeters.

#### 6.4.3 Urban Canyon GPS Augmentation

In San Francisco's urban canyons (tall buildings blocking GPS satellite signals), GPS accuracy degrades from meters to tens of meters -- far too inaccurate for lane-level driving. LiDAR-to-map localization provides the primary position fix in these environments, with GPS serving only as a coarse initial estimate to seed the scan matching algorithm.

Cruise's mapping team noted that their sensors are "always trying to match up what they see with what's in the database." When there is an incompatibility (e.g., new construction that has changed the environment since the map was built), the system detects the mismatch and can prompt degraded operation.

#### 6.4.4 Map Freshness

HD maps must be regularly updated to reflect real-world changes. Cruise addressed this by:
- Fleet-based mapping: Cruise's own fleet vehicles continuously collect updated LiDAR and camera data that can be used to refresh the map.
- Change detection: The localization system's residual error (the quality of the scan match) can detect when the real world has diverged from the map.
- Map version management: Different map versions are maintained and deployed to the fleet as updates are validated.

---

## 7. October 2023 Incident -- Non-ML Failure Analysis

### 7.1 Collision Detection Subsystem

The October 2, 2023 pedestrian incident revealed critical failures in Cruise's **Collision Detection Subsystem** -- a predominantly **rule-based, classical system** responsible for characterizing collisions and determining the appropriate post-collision response.

#### 7.1.1 Incident Sequence

1. A human-driven vehicle traveling adjacent to the Cruise AV struck a pedestrian.
2. The pedestrian was propelled across the human-driven vehicle and onto the ground in the immediate path of the Cruise AV (nicknamed "Panini").
3. The Cruise AV biased rightward and braked aggressively but made contact with the pedestrian at **18.6 mph** -- approximately **0.78 seconds** (530 ms latency identified by Dan Luu) after the pedestrian entered the AV's path.
4. The AV came to an initial brief stop after impact.

At this point, the Collision Detection Subsystem activated and made critical errors that led to the pedestrian being dragged.

#### 7.1.2 Three Technical Errors (Exponent Investigation)

Engineering consultancy **Exponent Inc.** conducted an independent investigation and identified **three distinct technical failures**, all in classical/rule-based components:

**Error 1 -- Position Detection Failure**: The system **failed to detect the pedestrian's location** after impact. The pedestrian fell beneath and forward of the vehicle, falling out of view of the LiDAR object detection sensors. Critically, the pedestrian's "feet and lower legs were visible in the wide-angle left-side camera from the time of impact to the final stop, but even though her legs were briefly detected, the Cruise robotaxi did not classify or track the woman." The object tracker lost track of the pedestrian when she went under the vehicle.

**Error 2 -- Collision Classification Error**: The collision detection system **incorrectly identified the pedestrian as being located on the side of the AV** at the time of impact instead of in front of the AV. This caused the system to **inaccurately characterize the collision as a lateral (side) collision** rather than a frontal collision. The collision classification was based on the **inaccurate object track** -- the tracked position of the pedestrian had diverged from her actual position, and the classifier used this erroneous track position to determine the impact geometry.

**Error 3 -- Self-Localization Error**: The vehicle **suffered from a location error and failed to identify that it was already in the lane next to the curb**. This meant the pull-over maneuver (designed to move to the outermost lane) was unnecessary -- the vehicle was already at the curb.

#### 7.1.3 The Collision Classification Logic

The collision detection subsystem used a **rule-based decision tree** to classify collision type:

```
IF collision detected:
    Determine collision geometry from object track position relative to vehicle
    IF object track position is LATERAL to vehicle centerline:
        CLASSIFY as SIDE COLLISION
        RESPONSE = pull-over maneuver (move to outermost lane, up to 100 feet)
    ELIF object track position is FRONTAL:
        IF object is PEDESTRIAN:
            CLASSIFY as FRONTAL PEDESTRIAN COLLISION
            RESPONSE = remain stationary (emergency stop)
        ELSE:
            CLASSIFY as FRONTAL VEHICLE COLLISION
            RESPONSE = pull-over maneuver
```

The critical failure was that the collision classification depended on the **accuracy of the object track**, which had diverged from reality. The tracked position showed the pedestrian at the side of the vehicle (because the tracker's last valid detection was lateral), when the actual impact was frontal. This is a classic failure mode of **chaining dependent classical systems** -- the track management system's error propagated into the collision classifier, which propagated into the response selector.

#### 7.1.4 What Made This a Non-ML Failure

Exponent confirmed that "there were no issues with the robotaxi's sensors or vehicle maintenance" -- the hardware was functioning correctly. The failures were **algorithmic** -- specifically in the classical rule-based logic that:
1. Relied on a single object track position without uncertainty-aware reasoning
2. Used a binary classification (lateral vs. frontal) without considering ambiguous cases
3. Did not incorporate raw sensor data (the camera showing legs under the vehicle) as a cross-check against the track-based classification
4. Did not have a "pedestrian under vehicle" detection capability

### 7.2 Post-Collision Behavior -- The Pull-Over Response

#### 7.2.1 The Minimal Risk Condition (MRC) Pull-Over

After classifying the collision as a lateral (side) impact, the system executed a **Minimal Risk Condition (MRC) pull-over maneuver**:

- The vehicle was programmed to move **up to 100 feet** to find a safe stopping location at the curb.
- The vehicle accelerated to **7.7 mph** during the pull-over.
- The rationale for the pull-over (rather than stopping in place) was to clear the travel lane and reduce the risk of a secondary collision from following traffic.

This pull-over logic was a **deterministic rule-based behavior** -- for lateral collisions, the response was always to pull over. There was no probabilistic reasoning, no consideration of the possibility that the classification might be wrong, and no cross-check against other sensor data.

#### 7.2.2 Wheel Speed Anomaly Detection

The pull-over was terminated after approximately **20 feet** (rather than the maximum 100 feet) by a **wheel speed sensor anomaly detection** system:

- During the pull-over, the vehicle's **wheels were moving at different speeds** because one wheel was spinning on the pedestrian's leg.
- The wheel speed differential triggered a **failed wheel speed sensor flag** in the vehicle's classical diagnostics system.
- This anomaly detection caused the vehicle to halt the pull-over maneuver early.

As Kyle Vogt noted, "it was good the AV stopped after 20 feet when it detected interference with its tire rather than continuing" to search for safe pullover locations up to 100 feet.

This wheel speed anomaly detection was a **classical sensor health monitoring check** -- comparing wheel speeds across the four wheels and flagging if they diverge beyond a threshold. It was designed to detect sensor failures, not pedestrians under the vehicle, but it fortuitously provided a secondary safety catch.

#### 7.2.3 The Vehicle's Final Position

The AV came to a stop with a tire resting on the pedestrian's leg, pinning her beneath the vehicle. The pedestrian was dragged approximately 20 feet.

#### 7.2.4 Scene Understanding Gap

Dan Luu's analysis highlighted a fundamental **scene understanding failure**: current AV systems lack the ability humans exhibit to notice and react to collisions in adjacent lanes. A human driver seeing a pedestrian struck by a vehicle in the next lane would typically preemptively slow or stop -- even before the pedestrian entered their own lane. The Cruise AV only reacted once the pedestrian physically entered its travel path, with 530 ms latency before braking initiation.

This is not a classical algorithm failure per se, but rather a gap in the **system architecture** -- no classical or ML component was responsible for monitoring adjacent-lane hazards and triggering preemptive defensive responses.

### 7.3 Hard Braking Recall -- Non-ML Trajectory Prediction Failures

#### 7.3.1 NHTSA Investigation PE23018

NHTSA opened a Preliminary Evaluation on December 12, 2022, examining **7,632 hard-braking events** commanded by software in Cruise vehicles.

#### 7.3.2 Root Causes

The investigation identified two primary non-ML failure modes:

**Inaccurate trajectory predictions**: The prediction system (which is ML-based) produced trajectory forecasts for nearby vehicles that did not match reality. However, the **downstream planner's interpretation** of these predictions used **classical decision-making logic** (threshold-based collision risk assessment) that amplified minor prediction errors into hard braking commands. A slightly off prediction that placed a nearby vehicle's forecast trajectory marginally closer to the AV's path would trigger the planner's collision avoidance threshold, commanding hard braking even when no actual collision risk existed.

**Sensor interference from nearby vehicles**: When vehicles were in close proximity, the perception system experienced degraded accuracy -- likely due to LiDAR multi-path reflections, radar cross-talk, or camera occlusion effects. These are **classical signal processing limitations** of the sensor hardware, not ML failures.

#### 7.3.3 Crash and Injury Data

The hard braking problem contributed to **10 crashes**, four of which involved a vulnerable road user and resulted in injury. Three rear-end collisions occurred when the Cruise ADS initiated a hard braking maneuver in response to a road user approaching from the rear -- the AV braked, and the following vehicle could not stop in time.

#### 7.3.4 Recall 24E-067

On August 9, 2024, Cruise initiated recall 24E-067 affecting **1,194 vehicles** (the entire fleet). The software update improved perception, prediction, and path planning capabilities to reduce the risk of unexpected braking. The fix addressed both the ML prediction models and the **classical planning logic** that translated prediction outputs into braking commands.

---

## 8. Hybrid ML+Classical

### 8.1 CLM Classical Components

The **Continuous Learning Machine (CLM)** is Cruise's automated ML improvement pipeline. While the models it trains are ML-based, the CLM pipeline itself contains significant classical/non-ML components:

#### 8.1.1 Error Mining (Active Learning)

The error mining stage uses **deterministic comparison logic** to identify prediction failures:
- At time T, the prediction model forecasts agent trajectories for times T+1 through T+N.
- At times T+1 through T+N, the perception system observes where agents actually went.
- A **classical distance metric** (e.g., Average Displacement Error, Final Displacement Error) compares predicted vs. observed trajectories.
- If the error exceeds a **threshold**, the scenario is flagged for inclusion in the training dataset.

This error detection is a **classical statistical comparison** -- no ML is used to decide whether a prediction was wrong. The thresholding, data selection, and sampling logic are rule-based.

#### 8.1.2 Self-Supervised Label Generation

The auto-labeling framework uses **future perception output** as ground truth for prediction training labels. This label generation process involves:

- **Temporal alignment**: Aligning predictions made at time T with observations made at times T+1 through T+N. This is classical timestamp matching and coordinate transformation.
- **Trajectory extraction**: Extracting the observed trajectory from the tracker output. The tracker uses Kalman filtering (classical) and data association (Hungarian algorithm, classical).
- **Label formatting**: Converting the observed trajectory into the training label format expected by the prediction model.

The "self-supervised" label generation is actually a **classical data processing pipeline** that feeds into ML model training.

#### 8.1.3 Evaluation Metrics

The CLM's evaluation pipeline uses **deterministic metrics** to decide whether a new model exceeds the performance of the previous model:
- Classical metrics: ADE, FDE, miss rate, collision rate, minADE/minFDE for multi-modal predictions
- Threshold-based acceptance criteria: the new model must exceed the previous model on all critical metrics
- This evaluation logic is entirely classical -- no ML is used to evaluate ML models

### 8.2 HD Map Interaction -- Classical Map Matching Feeds ML Perception

#### 8.2.1 Traffic Light ROI from Map

One of the most important hybrid interactions between classical and ML components is **map-based region-of-interest (ROI) extraction** for traffic light detection:

1. **Map lookup (classical)**: The HD map stores the 3D positions and types of all traffic signals along the route. Given the vehicle's current localized position (from LiDAR-to-map scan matching -- classical), the system queries the map for all traffic signals within the vehicle's approach zone.

2. **ROI projection (classical)**: Each traffic signal's 3D map position is projected into each camera's 2D image plane using the camera's calibrated intrinsic and extrinsic parameters. The projection is a classical pinhole camera model:
   ```
   [u, v, 1]^T = K * [R | t] * [X, Y, Z, 1]^T
   ```
   Where K is the intrinsic matrix, [R|t] is the extrinsic transform.

3. **ROI cropping (classical)**: A rectangular region around the projected position is cropped from the camera image. This dramatically reduces the search area for the ML detector.

4. **ML classification**: A deep neural network classifies the traffic signal state (red, yellow, green, arrow direction, flashing pattern) from the cropped ROI image.

This hybrid approach provides several advantages:
- **Reduced false positives**: By constraining the search to map-predicted locations, the system avoids detecting irrelevant red lights (e.g., brake lights of cars, red signs, decorative lights).
- **Reduced computation**: Processing a small ROI rather than the full camera image saves significant GPU compute.
- **Relevance filtering**: The map tells the system which traffic signal applies to the AV's lane and direction of travel -- a challenging problem for a purely vision-based system at complex intersections.

This is a textbook example of **classical prior knowledge (map) constraining an ML search problem**, reducing both false positives and computation.

#### 8.2.2 Lane Geometry as Prediction Prior

The HD map provides lane geometry (centerlines, lane widths, connectivity, speed limits) that serves as a strong prior for the ML prediction system:

- **Goal candidates**: Possible future positions for tracked vehicles are constrained by the lane graph topology from the map. A vehicle on a road segment can only continue straight, turn left, turn right, or make a U-turn based on the map's lane connectivity.
- **Speed priors**: The map's speed limit provides a prior on likely vehicle speeds.
- **Intersection structure**: The map's intersection topology (which lanes connect, protected vs. unprotected turns, stop signs vs. signals) informs the prediction model about what behaviors are feasible at each location.

The map information is provided as **classical structured data** (vectors, graphs, attributes) to the ML model, which learns to condition its trajectory predictions on this map context.

#### 8.2.3 Localization as Perception Enabler

The classical LiDAR-to-map localization system (Section 6.4) is a prerequisite for nearly all perception functions:

- Without knowing where the vehicle is in the map, the system cannot look up traffic signal locations, lane geometry, or speed limits.
- Without precise pose estimation, multi-frame object tracking in world coordinates would drift.
- Without map context, the prediction system would have no knowledge of road structure and would produce much worse trajectory forecasts.

This localization system is **entirely classical** (scan matching, pose graph optimization, IMU integration) and is arguably the single most critical non-ML component in the entire perception stack.

### 8.3 Post-Processing -- NMS, Geometric Consistency Checks on ML Outputs

#### 8.3.1 Non-Maximum Suppression (NMS)

ML object detection networks produce multiple overlapping bounding boxes for each object -- a single pedestrian might generate 3--10 candidate detections of varying sizes, positions, and confidence scores. **Non-Maximum Suppression** filters these down to a single detection per object:

1. Sort all detections by confidence score (highest first).
2. Select the highest-confidence detection as a kept detection.
3. Compute the **IoU (Intersection over Union)** between the kept detection and all remaining detections.
4. Remove all detections with IoU above a threshold (typically 0.5--0.7) -- these are considered duplicate detections of the same object.
5. Repeat with the next highest-confidence remaining detection.

NMS is a **classical post-processing algorithm** applied to every output of every ML detection head. Without NMS, the planning system would receive duplicate object detections that could cause erratic behavior (e.g., "seeing" three copies of one pedestrian).

For dense scenes (e.g., crowded crosswalks), standard IoU-based NMS can fail by suppressing valid detections of closely-spaced objects. Variants like **Soft-NMS** (decaying scores rather than hard removal) and **Adaptive Spatial-Aware NMS** address this limitation.

#### 8.3.2 Geometric Consistency Checks

After ML detection, several classical geometric consistency checks validate the outputs:

**Physical plausibility**:
- Detected bounding box dimensions are checked against class-specific size ranges (e.g., a "vehicle" detection with dimensions of 0.5m x 0.3m is rejected as implausible).
- Detected positions are checked against the drivable surface -- a vehicle detection floating 3 meters above the road is rejected.
- Detected velocities are checked against physical limits -- a pedestrian detection with velocity > 15 m/s is flagged.

**Cross-modal consistency**:
- A camera detection that has no corresponding LiDAR points within its projected 3D volume may be downweighted or rejected (possible false positive).
- A LiDAR cluster that has no corresponding camera detection may be classified as an unknown obstacle rather than a specific object class.
- Radar velocity measurements are compared against tracker-estimated velocities derived from LiDAR/camera detections -- large discrepancies may indicate a tracking error or a false radar detection.

**Temporal consistency**:
- Sudden, large jumps in an object's tracked position that violate kinematic limits are flagged and corrected.
- An object that abruptly changes class (e.g., vehicle to pedestrian) without a corresponding change in observed geometry is treated with suspicion.

These checks are all **classical rule-based and geometric algorithms** -- threshold comparisons, physical constraint verification, and cross-sensor agreement checks. They serve as a safety net around the ML detection outputs, catching implausible or inconsistent results.

---

## 9. GM Super Cruise Classical Heritage

### 9.1 Super Cruise Perception -- Primarily Classical ADAS Perception

#### 9.1.1 Current Super Cruise Sensor Suite

GM's Super Cruise system (production since 2017 on the Cadillac CT6) is a **primarily classical ADAS perception system** that does not use onboard LiDAR:

| Sensor | Type | Function |
|---|---|---|
| Forward-facing camera | Windshield-mounted | Lane marking detection, vehicle detection |
| Long-range radar | Front-mounted module | Adaptive cruise control, forward collision avoidance |
| Short-range radar (some models) | Behind front fascia, left and right | Blind spot monitoring, cross-traffic detection |
| High-precision GPS | Roof-mounted | Lane-level positioning |
| Driver-facing IR camera | Steering column-mounted | Driver attention monitoring |

This is a minimal sensor suite compared to Cruise's 42-sensor AV -- Super Cruise operates with roughly **5--7 sensors** (depending on model), all using classical signal processing.

#### 9.1.2 Classical Perception Pipeline

Super Cruise's perception relies on classical computer vision and signal processing:

**Radar processing**: The long-range radar (typically 77 GHz) uses the same classical FMCW signal processing described in Section 2.2 -- range-Doppler FFT, CFAR detection, and beamforming. It provides:
- Range and range rate (radial velocity) to the lead vehicle for adaptive cruise control
- Distance and speed measurements of surrounding objects for collision avoidance
- These measurements feed a **classical Kalman filter** that tracks the lead vehicle's position and velocity

**Camera processing**: The forward camera detects lane markings using:
- **Edge detection** (Canny or Sobel operators) to identify lane marking edges
- **Hough transform** or polynomial fitting to extract lane geometry from edge points
- Color and intensity thresholding to distinguish lane markings from road surface
- Some ML-based lane detection may be used in newer versions, but the original system was primarily classical

**GPS + HD Map matching**: Super Cruise's most distinctive feature is its use of **pre-built LiDAR HD maps** for lane-level positioning:
- GM has mapped over **600,000 kilometers** (200,000+ miles) of divided highways using LiDAR-equipped mapping vehicles.
- The HD map provides a 3D model of the road including lane geometry, curvature, road boundaries, and grade.
- The vehicle's high-precision GPS position is **matched against the HD map** to determine lane-level positioning.
- When the GPS position does not match the map (e.g., a new construction zone), Super Cruise detects the incompatibility and prompts the driver to take over.

This map-matching is a **classical algorithm** -- geometric comparison of the GPS-estimated position against the map database, with consistency checks.

#### 9.1.3 Driver Attention System

The **driver-facing infrared camera** is a classical computer vision application:
- IR illumination ensures consistent facial imaging regardless of ambient lighting
- Classical face detection and head pose estimation algorithms determine if the driver is looking at the road
- Eye tracking determines if the driver's eyes are open
- If the system detects an inattentive driver (looking away from road, eyes closed), it triggers a **graduated alert sequence**: visual (light bar on steering wheel changes from green to red), haptic (steering wheel vibration, if equipped), and audio warnings

This is a **rule-based safety system** -- the driver monitoring state (attentive/inattentive) is compared against thresholds, and predefined alert actions are triggered.

### 9.2 Eyes-Off Transition -- How Classical + ML Perception Will Enable Eyes-Off Driving

#### 9.2.1 The 2028 Eyes-Off System

GM plans to introduce **SAE Level 3 "eyes-off" driving** in 2028, debuting on the **Cadillac Escalade IQ**. This system will allow drivers to **take their eyes off the road** and engage in other activities while the vehicle handles highway driving. When the system is active, turquoise lighting across the dashboard and exterior mirrors signals Level 3 operation.

This represents a fundamental perception challenge escalation: at Level 2 (current Super Cruise), the driver serves as the ultimate perception backup. At Level 3, the vehicle's perception must be reliable enough that the driver can be disengaged -- a much higher bar.

#### 9.2.2 Perception Upgrade: Adding LiDAR

The eyes-off system adds **onboard LiDAR** to the Super Cruise sensor suite for the first time in a GM consumer vehicle. The LiDAR bump is visible on the roof of test vehicles. This creates a triple-modality perception system:

- **LiDAR**: Provides the high-precision 3D geometry that Super Cruise has historically lacked. Enables robust object detection independent of lighting conditions.
- **Radar**: Remains the weather-robust backbone, providing range and velocity in all conditions.
- **Cameras**: Provide rich semantic information (lane markings, signs, traffic lights, object classification).

This directly inherits Cruise's **triple-modality, sensor-fusion philosophy** -- the same architecture that Cruise's 42-sensor AV used, scaled down to a consumer vehicle form factor.

#### 9.2.3 Technology Transfer from Cruise

The eyes-off system explicitly leverages Cruise's technology:

- **AI models trained on 5+ million driverless miles**: Cruise's perception and prediction models, refined through the CLM pipeline on San Francisco's challenging streets, provide the ML backbone.
- **Advanced simulation framework**: Millions of high-fidelity closed-loop simulations run daily, equivalent to more than 10,000 times the daily driving of an average U.S. driver. This simulation infrastructure was built by Cruise and inherited by GM.
- **Computing platform**: The new system offers "10x more over-the-air software update capacity, 1,000x more bandwidth, and up to 35x more AI performance for autonomy" compared to the current Super Cruise compute platform.

#### 9.2.4 Classical Components in the Eyes-Off System

The eyes-off system retains and extends Super Cruise's classical components:

**HD Map matching**: The expanded map database (now covering more road types) continues to use classical scan matching, but augmented with LiDAR-to-map matching (same algorithms used by Cruise's AV -- ICP/NDT) instead of GPS-only matching.

**Sensor fusion**: Late fusion of LiDAR, radar, and camera detections using classical data association (Hungarian algorithm) and state estimation (Kalman filtering).

**Driver monitoring**: The driver attention system must now handle the transition between Level 3 (eyes-off, system drives) and Level 2 (eyes-on, driver monitors). The transition logic is **rule-based**: when the system determines it can no longer maintain safe autonomous operation (leaving the ODD, sensor degradation, system fault), it must alert the driver to resume attention with sufficient lead time.

**Fallback behavior**: If the driver fails to resume control after the takeover alert, the system must execute a **Minimal Risk Condition (MRC)** -- autonomously bringing the vehicle to a safe stop. The MRC path planning and execution use classical control algorithms (path planning, speed profiling, lateral/longitudinal control).

#### 9.2.5 The Hyper Cruise Future

GM filed a trademark for **"Hyper Cruise"** -- likely the branding for a more advanced autonomous driving system that incorporates a larger portion of Cruise's full perception stack. This may represent the eventual endpoint where Cruise's L4-class perception technology, including multi-sensor fusion across many sensors, Strobe FMCW LiDAR IP, and the full CLM pipeline, is deployed in consumer vehicles for an expanded ODD approaching full autonomy on highways and eventually urban roads.

---

## Sources

### Strobe FMCW LiDAR
- [GM Cruise Snaps Up Solid-State Lidar Pioneer Strobe Inc (IEEE Spectrum)](https://spectrum.ieee.org/gm-cruise-snaps-up-solidstate-lidar-pioneer-strobe-inc)
- [Strobe FMCW LiDAR Patent US20160299228A1 (Google Patents)](https://patents.google.com/patent/US20160299228A1/en)
- [GM Cruise Acquires OEwaves Spin-off Strobe Inc. (OEwaves)](https://www.oewaves.com/resources/gm-cruise-acquires-oewaves-spin-off-strobe-inc)
- [Lidar Maker Strobe Acquired by General Motors (Laser Focus World)](https://www.laserfocusworld.com/lasers-sources/article/16569556/lidar-maker-strobe-acquired-by-general-motors)
- [Lidar System Key to GM's Autonomous-Car Development (WardsAuto)](https://www.wardsauto.com/technology/lidar-system-key-gm-s-autonomous-car-development)
- [GM Buys Compact LiDAR Systems Developer Strobe (Optics.org)](https://optics.org/news/8/10/18)
- [How We're Solving the LIDAR Problem -- Kyle Vogt (Cruise Medium)](https://medium.com/cruise/how-were-solving-the-lidar-problem-8b4363ff30db)
- [FMCW LiDAR (Bridger Photonics)](https://www.bridgerphotonics.com/blog/frequency-modulated-continuous-wave-fmcw-lidar)
- [What I Learned About FMCW LiDAR at CES (ThinkAutonomous)](https://www.thinkautonomous.ai/blog/fmcw-lidar/)
- [Cruise Co-Founder Vogt on LiDAR SPACs (The Robot Report)](https://www.therobotreport.com/cruise-co-founder-vogt-on-lidar-spacs/)
- [Si Photonics FMCW LiDAR Chip (MDPI Micromachines)](https://www.mdpi.com/2072-666X/14/5/1001)
- [Coherent Solid-State LIDAR with Silicon Photonic Optical Phased Arrays (Optica)](https://opg.optica.org/ol/abstract.cfm?uri=ol-42-20-4091)

### Articulating Radar Assemblies
- [The Decision Behind Using Articulating Sensors on Cruise AVs -- JM Fischer (Cruise Medium)](https://medium.com/cruise/cruise-embedded-systems-articulating-radars-7cae24642930)
- [Articulating Sensors on Cruise AVs (SelfDrivingCars360)](https://www.selfdrivingcars360.com/the-decision-behind-using-articulating-sensors-on-cruise-avs/)
- [Why Cruise Uses Rotating Radar On Its AVs (GM Authority)](https://gmauthority.com/blog/2020/07/why-cruise-uses-rotating-radar-assemblies-on-its-self-driving-prototypes/)

### Radar Signal Processing
- [Advanced Signal Processing for Automotive Radar (ScienceDirect)](https://www.sciencedirect.com/org/science/article/pii/S1526149225002267)
- [Radar Signal Simulation and Processing (MathWorks)](https://www.mathworks.com/help/driving/ug/radar-signal-simulation-and-processing-for-automated-driving.html)
- [Radar Perception in Autonomous Driving: Data Representations (ArXiv)](https://arxiv.org/html/2312.04861v1)

### October 2023 Incident
- [Notes on Cruise's Pedestrian Accident (Dan Luu)](https://danluu.com/cruise-report/)
- [NHTSA Recall Report 23E-086 (NHTSA)](https://static.nhtsa.gov/odi/rcl/2023/RMISC-23E086-4326.pdf)
- [Quinn Emanuel Report to Cruise Board of Directors (PDF)](https://assets.ctfassets.net/95kuvdv8zn1v/1mb55pLYkkXVn0nXxEXz7w/9fb0e4938a89dc5cc09bf39e86ce5b9c/2024.01.24_Quinn_Emanuel_Report_re_Cruise.pdf)
- [Analysis Reveals GM's Cruise Robotaxi Struck and Dragged Pedestrian (Fox Business)](https://www.foxbusiness.com/technology/analysis-reveals-gms-cruise-robotaxi-struck-dragged-pedestrian-20-feet)
- [NHTSA Investigation Close Resume PE23018 (NHTSA)](https://static.nhtsa.gov/odi/inv/2023/INCLA-PE23018-11022.pdf)
- [NHTSA Consent Order with Cruise (NHTSA)](https://www.nhtsa.gov/press-releases/consent-order-cruise-crash-reporting)
- [Cruise DOJ Settlement (DOJ)](https://www.justice.gov/usao-ndca/pr/cruise-admits-submitting-false-report-influence-federal-investigation-and-agrees-pay)

### Hard Braking Recall
- [Cruise Recalls Robotaxi Fleet to Resolve Federal Safety Probe (TechCrunch)](https://techcrunch.com/2024/08/22/cruise-recall-av-fleet-nhtsa-probe-closed/)
- [Cruise Recalls ADS Over Sudden Braking Risks (The BRAKE Report)](https://thebrakereport.com/cruise-recalls-ads-over-sudden-braking-risks/)
- [NHTSA Recall Report 24E-067 (NHTSA)](https://static.nhtsa.gov/odi/rcl/2024/RMISC-24E067-1279.pdf)

### Calibration and Sensor Simulation
- [How Cruise Uses Simulation to Speed Up Sensor Development -- Rico Stenson (Cruise Medium)](https://medium.com/cruise/cruise-simulation-sensor-development-be57a5991fe6)
- [Cruise -- A Self-Driving Car Startup (ThinkAutonomous)](https://www.thinkautonomous.ai/blog/cruise-self-driving-car/)
- [OpenCalib: A Multi-Sensor Calibration Toolbox (ArXiv)](https://arxiv.org/abs/2205.14087)

### HD Maps and Localization
- [3 Ways Cruise HD Maps Give Our Self-Driving Vehicles An Edge (Cruise Medium)](https://medium.com/cruise/hd-maps-self-driving-cars-b6444720021c)
- [Traffic Light Detection with HD Maps and ROI (MDPI Sensors)](https://www.mdpi.com/1424-8220/20/4/1181)
- [Traffic Light Perception -- Apollo Auto](https://daobook.github.io/apollo/docs/specs/traffic_light.html)

### State Estimation and Tracking
- [Kalman Filter-Based Fusion for Multi-Object Tracking (MDPI Sensors)](https://www.mdpi.com/1424-8220/24/23/7718)
- [Multi-Object Tracker Documentation (MathWorks)](https://www.mathworks.com/help/driving/ref/multiobjecttracker.html)
- [Multi-Object Tracking with DeepSORT (MathWorks)](https://www.mathworks.com/help/vision/ug/multi-object-tracking-with-deepsort.html)

### GM Super Cruise
- [GM's Super Cruise ADAS System (CarADAS)](https://caradas.com/gm-super-cruise-adas-system/)
- [GM Super Cruise: How It Works (Autonomous Vehicle International)](https://www.autonomousvehicleinternational.com/features/gm-super-cruise.html)
- [Super Cruise 101 (GM News)](https://news.gm.com/home.detail.html/Pages/topic/us/en/2025/feb/0228-supercruise.html)
- [GM Plans Eyes-Off Super Cruise with LIDAR by 2028 (InsideEVs)](https://insideevs.com/news/776525/gm-super-cruise-eyes-off-2028/)
- [GM to Launch Eyes-Off Driving (GM News)](https://news.gm.com/home.detail.html/Pages/news/us/en/2025/oct/1022-AI-GM-launch-eyes-off-driving-conversational-AI.html)
- [GM Autonomous Driving Tech May Be Called Hyper Cruise (GM Authority)](https://gmauthority.com/blog/2025/06/gm-autonomous-driving-tech-may-be-called-hyper-cruise/)
- [GM's Path to Full Autonomy (GM News)](https://news.gm.com/home.detail.html/Pages/topic/us/en/2025/oct/1009-GMs-path-full-autonomy-Building-trust-step-by-step.html)

### CLM and ML Infrastructure
- [Cruise's Continuous Learning Machine (Cruise Medium)](https://medium.com/cruise/cruise-continuous-learning-machine-30d60f4c691b)
- [ML Infrastructure for Autonomous Vehicles at Cruise (MLconf)](https://mlconf.com/sessions/ml-infrastructure-for-autonomous-vehicles-cruise/)

### Occupancy Grids and Classical Perception
- [A Review of the Bayesian Occupancy Filter (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5336118/)
- [Free Space Estimation Using Occupancy Grids (ArXiv)](https://arxiv.org/pdf/1708.04989)
- [GndNet: Fast Ground Plane Estimation (GitHub)](https://github.com/anshulpaigwar/GndNet)

### Patents
- [Strobe Compact LIDAR System Patent US20160299228A1](https://patents.google.com/patent/US20160299228A1/en)
- [GM LiDAR Sensor Array Patent US11604258B2 (GM Authority)](https://gmauthority.com/blog/2023/03/gm-files-patent-for-lidar-system/)
- [Sensor Event Detection and Fusion Patent US10802450 (Justia)](https://patents.justia.com/patent/10802450)
- [Patents Assigned to GM Cruise Holdings LLC (Justia)](https://patents.justia.com/assignee/gm-cruise-holdings-llc)
- [LIDAR SYSTEM -- STROBE, INC. (FreePatentsOnline)](https://www.freepatentsonline.com/y2020/0182978.html)
