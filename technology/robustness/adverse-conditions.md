# Robustness to Adverse Conditions, Domain Generalization, and Environmental Adaptation for Autonomous Vehicles

## Comprehensive Technical Report

---

## Table of Contents

1. [Adverse Weather Perception](#1-adverse-weather-perception)
2. [Domain Generalization for Driving](#2-domain-generalization-for-driving)
3. [Robustness of World Models](#3-robustness-of-world-models)
4. [Sensor Degradation Handling](#4-sensor-degradation-handling)
5. [Airport-Specific Adverse Conditions](#5-airport-specific-adverse-conditions)

---

## 1. Adverse Weather Perception

### 1.1 Rain, Snow, Fog, and Glare Handling in Perception

Adverse weather is one of the most significant challenges for autonomous vehicle perception systems. Rain, snow, fog, and glare degrade the performance of cameras, LiDAR, and radar -- the three primary sensing modalities -- through distinct physical mechanisms.

**Rain** introduces rain streaks and droplets into camera images, causes laser pulses to scatter off raindrops (reducing LiDAR point cloud density and range), and deposits water on sensor surfaces. At rainfall intensities above 10 mm/h, LiDAR sensing efficacy begins to decline measurably; at 50 mm/h, target detection is essentially nullified.

**Snow** obscures object edges, deposits material on sensor lenses, and introduces snowflake-shaped noise points throughout LiDAR point clouds. LiDAR detection distance degrades by approximately 25% in snowfall conditions. However, localization using pre-built maps remains functional even in heavy snowfall, unlike dense fog.

**Fog** reduces visibility for cameras and creates dense scattering volumes for LiDAR. Fog degrades LiDAR performance in a roughly monotonic fashion: weak fog (<150m visibility) causes moderate degradation, while thick fog (<=50m visibility) produces the most severe performance losses among all weather conditions. Notably, SLAM systems fail entirely in thick outdoor fog due to insufficient feature points.

**Glare** causes camera sensor saturation, producing regions of zero useful information in images. Sources include direct sunlight, oncoming headlights, and reflections from wet/icy surfaces. Recent work proposes deconvolution-based approaches using Joint Glare Spread Function (GSF) estimation and saturated pixel-aware reduction techniques, which outperform dehazing and enhancement approaches at moderate-to-high glare levels across five perception tasks (object detection, recognition, tracking, lane detection, depth estimation).

**Emerging solutions include:**

- **AWD-YOLO** (2025): An Adverse Weather Dual-backbone YOLO architecture that uses a hierarchical feature fusion strategy, extracting complementary features from both raw and preprocessed images via shallow concatenation and attention modules.
- **Dual-backbone approaches**: Processing both clean and degraded images simultaneously and fusing features at multiple scales.
- **HDR cameras**: High dynamic range CMOS sensors (e.g., 140dB dynamic range) that mitigate visibility drops from sudden light changes (tunnel entry/exit) and reduce the impact of sun glare by balancing light levels in high-contrast scenes.
- **Thermal cameras**: Infrared sensors that are inherently robust to ambient light variations and glare, providing complementary perception to visible-light cameras.

### 1.2 RoboBEV and RoboFusion -- Robust Perception Benchmarks

#### RoboBEV (TPAMI 2025)

[RoboBEV](https://github.com/Daniel-xsy/RoboBEV) is a comprehensive benchmark for evaluating Bird's Eye View (BEV) perception robustness against natural corruptions. It tests 8 corruption types across 3 severity levels (easy, moderate, hard), totaling 866,736 test images at 1600x900 resolution:

| Category | Corruption Types |
|----------|-----------------|
| Environmental | Brightness, Darkness, Fog, Snow |
| Sensor | Motion Blur, Color Quantization |
| Temporal | Camera Crash (dropped views), Frame Lost |

**Key quantitative findings:**

- **Snow and Dark corruptions** produce the largest performance drops, severely affecting depth estimation.
- **Depth-based BEV approaches** suffer the most severe degradation under corrupted images; depth-free transformation methods are inherently more robust.
- **SOLOFusion** achieved the best robustness (mCE: 92.86%, mRR: 64.53%), while **BEVDet variants** were least robust (mCE: 115-137%).
- **Pre-training with CLIP backbone** improved robustness by 11.8--23.1% under challenging conditions (Dark, Fog, Snow), but did not help with temporal corruptions.
- **Multi-modal models are disproportionately reliant on LiDAR**: camera-LiDAR fusion models show 89--95% performance drops when LiDAR is absent, versus only 5--8% decline when camera fails.
- Strong correlation exists between clean-dataset performance and absolute robustness, but **not** relative robustness improvement -- meaning better models are not necessarily proportionally more robust.

#### RoboFusion (IJCAI 2024)

[RoboFusion](https://github.com/adept-thu/RoboFusion) leverages Vision Foundation Models (specifically SAM -- Segment Anything Model) for robust multi-modal 3D object detection in out-of-distribution (OOD) noise scenarios. Its architecture includes:

1. **SAM-AD**: An adaptation of SAM for autonomous driving, with AD-FPN for upsampling image features.
2. **Wavelet decomposition**: Denoises depth-guided images to reduce weather interference.
3. **Self-attention reweighting**: Adaptively enhances informative features while suppressing noise from corrupted sensor inputs.

RoboFusion achieves state-of-the-art performance on KITTI-C and nuScenes-C corrupted benchmarks, demonstrating that foundation model features can be effectively leveraged to maintain perception quality under adverse conditions.

### 1.3 Defogging / Dehazing Neural Networks

Image dehazing has seen rapid progress with deep learning architectures specifically designed for autonomous driving scenarios:

| Method | Approach | Key Innovation |
|--------|----------|----------------|
| **ODD-Net** | Hybrid DL architecture | Atmospheric Light Net (A-Net) using dilated convolution for atmospheric light estimation |
| **FIGD-Net** | Frequency-domain guided dual-branch | Spatial branch for local haze + frequency branch for global haze distribution |
| **HazeTrendNet** (2025) | Haze-concentration-trend guidance | Single-image dehazing via haze trend modeling |
| **IDOD-YOLOV7** | Joint defogging + detection | Integrates image defogging, enhancement, and object detection for foggy low-light conditions |
| **Multi-scale Adaptive Detail Enhancement** (2025) | Multi-scale network | Preserves fine details during dehazing specifically for driving perception images |

**Critical architectural insight**: Most dehazing algorithms operate only in the spatial domain. Frequency-domain approaches (like FIGD-Net) capture global haze distribution patterns that spatial-only methods miss, leading to more uniform dehazing across the image.

**Simultaneous depth + dehazing**: Since haze formation is physically related to scene depth (atmospheric scattering model), methods that jointly estimate depth and dehaze can exploit this coupling. However, few algorithms currently achieve both tasks simultaneously with production-quality results.

**Real-time processing**: Recent unsupervised methods achieve dehazing at 1000 FPS for 2K resolution on GPU-equipped systems, without requiring paired hazy/clear training datasets -- a major practical advantage for deployment.

### 1.4 Rain Removal / De-raining

Rain creates out-of-distribution (OOD) artifacts that degrade perception for lane detection, depth estimation, and object detection. Key recent approaches:

- **Ultra-Fast Deraining Plugin (UFDP)** (IEEE T-ITS 2024): A model-efficient plugin that realigns the distribution of rainy images to match rain-free counterparts. It seamlessly integrates into existing perception models without retraining them, enhancing robustness and stability under rainy conditions.

- **RainMamba** (2024): Introduces a Hilbert scanning mechanism that preserves regional details at the sequence level, combined with a Local Mamba Block and difference-guided dynamic contrastive locality learning for enhanced local semantics. This leverages the Mamba (state-space model) architecture for efficient video deraining.

- **GAN-based controllable rain generation** (2025): Generates synthetic rainy training images with controllable rain intensity, streak angle, and density -- enabling data augmentation for rain-robust training.

- **Data-centric deraining** (2024): Rather than focusing solely on architecture, this approach optimizes batching schemes and training strategies to improve deraining model performance, validated through steering angle prediction accuracy as a downstream task.

**Adversarial concern**: Research has identified "universal rain-removal attacks" where adversarial perturbations are disguised as rain artifacts, exploiting deraining pre-processing to introduce harmful modifications that bypass downstream detection.

### 1.5 Night Vision and Low-Light Perception

Low-light conditions create noise, loss of contrast, and color distortion in camera images, severely impacting detection performance. Current research gaps include insufficient detail enhancement on nighttime driving datasets and high deployment costs preventing real-time edge inference.

**Key methods:**

- **LightDiff** (CVPR 2024): "Light the Night" -- a multi-condition diffusion framework for unpaired low-light enhancement in autonomous driving. Uses diffusion models to handle multiple degradation types without requiring paired day/night training data.

- **VELIE** (2024): Vehicle-based Efficient Low-light Image Enhancement using Swin Vision Transformer + gamma-integrated U-Net. Achieves state-of-the-art quality with processing time of only 0.19 seconds per image.

- **LDWLE** (2024): Self-supervised driven low-light object detection framework that combines enhancement and detection without requiring human-labeled low-light annotations.

- **LowLight-NeRF**: Enables 3D reconstruction from low-light captures, with applications in autonomous driving scene understanding.

**Detection performance**: YOLOv8 consistently outperforms other detectors in low-light scenarios, with YOLOv8s achieving mAP of 0.5513. Two-stage approaches (enhance first, detect second) using TBEFN show particular improvements for detecting cars, motorbikes, and people.

### 1.6 4D Radar as Weather-Robust Sensor

4D millimeter-wave (mmWave) imaging radar is emerging as a critical weather-robust sensor modality for autonomous driving. Unlike cameras and LiDAR, 4D radar excels in adverse weather conditions (fog, rain, snow) and low-light scenarios.

**Technical capabilities:**

- Measures four dimensions: distance, speed, azimuth, and elevation (vertical height -- the "4th D" beyond conventional 3D radar).
- Provides higher point cloud density and precise vertical resolution compared to conventional 3D radar.
- Operates reliably through precipitation, fog, and darkness where optical sensors fail.

**Industry deployment:**

| Company | Configuration |
|---------|--------------|
| Waymo | 6 high-performance 4D radars per vehicle |
| Cruise | 21 radars per vehicle |
| Market size | $677M (2024), projected $1.04B by 2032 (CAGR 6.5%) |

**Key datasets and research (2024-2025):**

- **V2X-Radar** (Tsinghua, 2024): World's first large-scale vehicle-to-infrastructure cooperative perception dataset with 4D radar, filling the gap for cooperative 4D radar perception research.
- **Dual Radar** (2025): Multi-modal dataset with dual 4D radar for autonomous driving research.
- **Multi-modal Denoising Diffusion (MDD)**: Uses weather-robust 4D radar features to clean noisy LiDAR data via diffusion models, leveraging radar's weather reliability to enhance LiDAR's precision -- a "best of both worlds" fusion approach.

**Fundamental advantage**: Radar's operating wavelength (millimeter-wave, ~77 GHz) is orders of magnitude longer than LiDAR's near-infrared wavelength (~905nm or ~1550nm), making it far less susceptible to scattering by rain, snow, and fog particles whose sizes are comparable to near-IR wavelengths.

---

## 2. Domain Generalization for Driving

### 2.1 Training on One Environment, Deploying in Another

Domain shift is a fundamental challenge: models trained on data from one geographic region, weather condition, sensor configuration, or time of day often fail when deployed in different conditions. Performance degrades across weather conditions, sensor settings, camera configurations, and geographic environments.

**Three core categories of domain adaptation methods:**

1. **Direct detection models**: Train robust detectors that can generalize without explicit adaptation.
2. **Distributed models**: Apply image restoration (defogging, deraining, etc.) as a preprocessing step before detection.
3. **End-to-end models**: Jointly learn restoration and detection in a unified architecture.

**Domain generalization** (as distinct from domain adaptation) does not require any target domain data during training -- making it the more practical approach for real-world deployment where the target environment is unknown a priori.

Recent evaluation using the ROAD-Almaty dataset tested generalization of YOLOv8s, RT-DETR, and YOLO-NAS, finding significant performance variations when models trained on Western road scenes were evaluated on Central Asian driving environments.

### 2.2 Style Transfer for Domain Adaptation

Diffusion-model-based style transfer has emerged as the leading approach for bridging the synthetic-to-real domain gap:

- **CACTI/CACTIF** (2025): Class-wise Adaptive Instance Normalization and Cross-Attention techniques for semantically consistent style transfer using diffusion models. Unlike traditional style transfer that may corrupt semantic content, these methods maintain class-level semantic fidelity during style transformation.

- **Sim2Real Diffusion** (2025): A unified framework for learning cross-domain adaptive representations through conditional latent diffusion. Achieves a **40.33% reduction in style difference** between simulation and real data, enabling reliable policy transfer. Generates diverse high-quality samples across times of day, weather conditions, seasons, and operational design domains.

- **Style Embedding Distribution Discrepancy (SEDD)**: A novel metric for quantifying the synthetic-to-real gap, providing systematic framework for measuring how much domain adaptation is needed.

**Key insight**: Diffusion-based approaches combined with semantic awareness are more effective than GAN-based style transfer for autonomous driving domain adaptation because they better preserve structural consistency (lane geometry, object boundaries) while transferring visual style (lighting, textures, weather appearance).

### 2.3 Generalization Across Different Driving Environments

The survey of learning-based planning identifies three persistent gaps:

1. **Distribution shift**: Performance degrades in out-of-distribution weather, geography, or traffic densities.
2. **Interpretability deficits**: Opaque latent policies impede validation and debugging.
3. **Safety certification**: Current learning pipelines lack provable bounds required for certification.

**Vision-Language-Action (VLA) models** represent the latest approach to improving generalization. Li Auto's 2025 architecture integrates end-to-end driving with VLMs, though discriminative-AI-based E2E models still lack generalization and common-sense reasoning, struggling with long-tail scenarios. VLA models aim to inject common-sense reasoning from large language models into driving policies.

**Datasets driving progress:**

- **UniOcc** (2025): Combines occupancy perception with forecasting, merging nuScenes, Waymo, CARLA, and OpenCOOD data.
- **CoVLA** (Turing Inc., 2024): First large-scale comprehensive Vision-Language-Action dataset for driving, based on 1,000+ hours of Tokyo driving data.

### 2.4 Continual Learning / Lifelong Learning for AV

Autonomous driving faces the **long-tail problem**: rare or unforeseen events that standard algorithms cannot handle. Static models degrade over time as driving environments evolve. Continual learning enables models to integrate new knowledge without catastrophic forgetting.

**Key recent methods:**

- **H2C** (Hippocampal Circuit-inspired Continual Learning, 2025): Designed for lifelong trajectory prediction. Reduces catastrophic forgetting by 22.71% on average in a task-free manner by mimicking hippocampal memory consolidation circuits.

- **Memory-aware learning**: Maintains exemplar buffers of past experiences to prevent forgetting while learning new scenarios.

- **Concept drift detection**: Adaptive mechanisms that detect when the distribution of incoming data shifts, triggering model updates.

**Technical challenges remain:**

- Balancing plasticity (learning new things) with stability (retaining old knowledge).
- Deciding when to update vs. when the model is sufficient.
- Handling computational constraints of on-vehicle hardware for incremental updates.
- Validating safety after each learning update without full re-certification.

### 2.5 Handling Distribution Shift

Distribution shift manifests in multiple forms for autonomous driving:

| Shift Type | Example | Impact |
|-----------|---------|--------|
| Covariate shift | Different weather/lighting | Input distribution changes, same task |
| Prior shift | Different traffic densities | Class frequency changes |
| Concept drift | New road designs, vehicle types | Relationship between input and output changes |
| Domain shift | Different countries/cities | Multiple distribution properties change simultaneously |

**Practical mitigation strategies:**

1. **Data augmentation**: Simulating adverse conditions during training (rain, fog, snow overlays on clean data).
2. **Domain randomization**: Training with randomly varied visual parameters to encourage learning domain-invariant features.
3. **Test-time adaptation**: Updating batch normalization statistics or lightweight adapter layers at inference time.
4. **Robust architectures**: Models inherently less sensitive to distribution shift (e.g., depth-free BEV methods outperform depth-dependent methods under corruption).
5. **Foundation model features**: Using features from models pre-trained on massive diverse datasets (CLIP, SAM) as robust representations.

---

## 3. Robustness of World Models

### 3.1 Do World Models Generalize to Unseen Conditions?

Current driving world models (DWMs) show **limited generalization** to unseen conditions. Surveys identify this as a critical open challenge:

- Performance degrades significantly during **long-horizon rollouts** and **drastic view shifts** -- complex simulations cause accumulating errors.
- **Environmental variability** (diverse traffic and weather) remains an unsolved challenge for world models.
- **Domain shift** in world models is acknowledged as a "highly challenging and impactful research area that warrants further exploration."

**Methods addressing generalization:**

- **InfinityDrive** (2024): Addresses long-horizon performance through multi-resolution spatiotemporal modeling with memory mechanisms, but generalization across conditions remains limited.
- **DrivingDojo** (2024): Provides diverse driving video datasets to improve training coverage.
- **AdaptiveDrive** (2024): Develops driving world models that adapt to different environments through specialized mechanisms.
- **DriveDreamer** (ECCV 2024): First world model derived entirely from real-world driving scenarios using diffusion models. Phase 1 learns structured traffic constraints; Phase 2 learns future state anticipation.

### 3.2 Hallucination in World Model Predictions

Hallucination is a critical safety concern. Current DWMs exhibit:

- **Sudden vehicle appearances**: Objects materializing without physical justification.
- **Incorrect speed estimations**: Predicted trajectories with physically implausible velocities.
- **Frame-order errors**: DriveSim (using GPT-4V-style models) shows "frame-order errors and inconsistent imagined trajectories that limit closed-loop reliability."
- **Causal hallucinations**: Multi-modal LLMs applied to driving exhibit causal reasoning errors -- inferring incorrect cause-effect relationships in traffic scenarios.
- **Temporal inconsistency**: Generated future frames may contradict the physics established in earlier frames.

**Mitigation approaches:**

- **DrivePhysica**: Introduces 3D bounding box coordinate conditions to enhance spatial relationship understanding, though this remains a partial solution.
- **Physics-aware constraints**: Incorporating physical laws (kinematics, dynamics) into the generation process to suppress physically impossible predictions.
- **Consistency losses**: Training objectives that penalize temporal and spatial inconsistencies across generated frames.

### 3.3 Calibration and Uncertainty in Adverse Conditions

Uncertainty quantification (UQ) is essential for safe deployment but remains underdeveloped for world models specifically:

**Types of uncertainty:**

- **Aleatoric uncertainty**: Irreducible noise from sensor limitations and environmental stochasticity. Higher in adverse weather due to sensor degradation.
- **Epistemic uncertainty**: Reducible uncertainty from insufficient training data. Critical in out-of-distribution operating regimes (e.g., weather conditions not seen during training).

**Current UQ approaches for autonomous driving:**

- **Bayesian methods**: Computing uncertainty scores during execution to distinguish safe from failure-inducing behaviors.
- **Ensemble methods**: Running multiple model instances and measuring prediction disagreement.
- **Calibration techniques**: Adjusting confidence scores to match actual event probabilities, reducing dangerous overconfidence.
- **Out-of-distribution detection**: Flagging inputs that fall outside the training distribution to trigger safety fallbacks.

**Critical gap**: The world model literature specifically **does not address calibration or uncertainty quantification** in current DWMs. This is identified as an unexplored area requiring urgent attention before deployment.

### 3.4 Failure Modes of Generative World Models

Generative world models exhibit several systematic failure modes:

1. **Geometric distortion**: BEV representations struggle to retain fine-grained 3D geometry in scenes with complex vertical structure or steep depth gradients.
2. **Point cloud sparsity artifacts**: LiDAR scan sparsity and irregular sampling, combined with real-time computational constraints, create algorithmic challenges that propagate through world model predictions.
3. **Computational bottlenecks**: Dense voxel grids (occupancy representations) demand considerable memory and throughput, potentially hindering deployment in large-scale or real-time systems.
4. **Compounding errors**: In autoregressive generation, small prediction errors compound over time, causing rapid degradation of long-horizon predictions.
5. **Mode collapse**: Generative models may converge to producing "average" predictions rather than capturing the full distribution of possible futures.

### 3.5 Robustness Testing and Adversarial Evaluation

**Current state of adversarial evaluation for world models is critically underdeveloped.** The literature explicitly notes: "there is currently a lack of research specifically addressing adversarial attacks on DWMs," and that "investigating such attacks and developing effective defense strategies are of critical practical importance."

**Relevant adversarial work:**

- **AUTHENTICATION** (2025): Uses adversarially guided diffusion models to identify rare failure modes in AV perception systems.
- **CrashAgent** (2025): Multi-modal reasoning for crash scenario generation to stress-test AV systems.
- **"When World Models Dream Wrong"** (2026): Physical-conditioned adversarial attacks against world models -- one of the first works directly targeting DWM adversarial robustness.

**Evaluation frameworks:**

- **GAIA-3** (Wayve, 2025): A 15-billion-parameter latent diffusion world model specifically designed for scalable evaluation:
  - **Safety-critical scenario generation**: Creates counterfactual what-if edge cases (collisions, near-misses, lane departures) while maintaining scene coherence.
  - **Controlled visual diversity**: Modifies appearance (lighting, textures, weather) while preserving geometry and motion for robustness testing.
  - **Embodiment transfer**: Re-renders scenes from different sensor configurations for cross-platform evaluation.
  - **LiDAR point-cloud alignment**: Validates spatial-structural fidelity of generated scenarios.
  - Trained across 9 countries on 3 continents; reduced synthetic-test rejection rates fivefold vs. prior methods.

- **DrivingGen** (2026): A comprehensive benchmark specifically for generative video world models in autonomous driving.

- **AdaWM** (ICLR 2025): Identifies world model mismatch through Total Variation distance between state-action visitation distributions, then selectively finetunes either the dynamics model or policy via LoRA-based low-rank adaptation:
  - On CARLA benchmarks: AdaWM achieved Success Rate of 0.82 (ROM03 task) vs. DreamerV3's 0.40.
  - On hardest task (LTD03): AdaWM reached SR 0.70 vs. DreamerV3's 0.35.

---

## 4. Sensor Degradation Handling

### 4.1 Camera Lens Contamination (Rain, De-icing Fluid, Dirt)

Camera lenses on autonomous vehicles are exposed to continuous contamination from rain droplets, mud splash, road spray, dust, oil mist, frost, and (in airport environments) glycol de-icing fluids.

**Quantitative impact:**

- Image quality (MTF50) decreases by **up to 80%** when droplet volume reaches 10 microliters on the lens surface.
- Contaminants cause ADAS systems to miss or falsely detect objects, directly risking traffic safety.
- Glycol de-icing fluids create a viscous film that is more difficult to remove than water and causes persistent optical distortion.

**Detection approaches:**

- Deep neural networks for camera blockage detection classify lens contamination state from the image itself (self-diagnosis).
- Feature disagreement scoring across sensor modalities can identify when one sensor's output has degraded.

### 4.2 LiDAR Performance in Rain/Snow/Fog

LiDAR degradation follows predictable patterns that have been empirically quantified:

| Condition | Severity | Effect |
|-----------|----------|--------|
| Light rain (10-20 mm/h) | Moderate | Point cloud density begins to decline |
| Weak fog (<150m visibility) | Moderate | Reduced range, scattered noise points |
| Intense rain (30-40 mm/h) | Severe | Significant detection range reduction |
| Thick fog (<=50m visibility) | Critical | SLAM failure, insufficient feature points |
| Heavy rain (50 mm/h) | Critical | Target detection essentially nullified |
| Surface water adherence | Variable | Missing points + reduced reflectivity |

**Physical mechanisms:**

1. **Backscatter**: Laser pulses reflect off rain/snow/fog particles before reaching the target, creating false returns.
2. **Attenuation**: Signal power is absorbed and scattered, reducing detection range.
3. **Surface contamination**: Water droplets adhering to the LiDAR housing cause persistent degradation even after precipitation stops.
4. **Specular reflection from wet surfaces**: Standing water acts as a mirror, redirecting laser pulses away from the receiver.

**Noise filtering algorithms:**

- **DROR** (Dynamic Radius Outlier Removal): Adapts removal radius based on local point cloud density.
- **DSOR** (Dynamic Statistical Outlier Removal): Uses statistical properties to identify weather-induced noise.
- **LIOR** (Low-Intensity Outlier Removal): Exploits the fact that weather-particle returns have lower intensity than solid-object returns.
- **DDIOR** (Distance-Dependent Intensity Outlier Removal): Combines range and intensity thresholds.
- **PP-LiteSeg based**: Deep learning approaches using semantic segmentation to classify points as object vs. weather noise.

### 4.3 Sensor Failure Detection and Graceful Degradation

Modern autonomous driving architectures must handle partial or complete sensor failures at runtime:

**MoME (Multi-modal Mixture of Experts)** represents the state of the art for resilient fusion:

- Three parallel Transformer decoders serve as specialized experts: LiDAR-only, camera-only, and fused LiDAR-camera.
- An **Adaptive Query Router (AQR)** selectively assigns each object query to the expert best suited for current conditions, using local attention masks to assess modal quality.
- During training, synthetic sensor dropout (1/3 probability per modality) teaches the model to route away from corrupted inputs.
- **Results on nuScenes-R** (6 failure scenarios): +4.2% mAP improvement in LiDAR-drop, +6.7% in limited FOV, +1.9% in camera-drop vs. prior SOTA.
- **Results on nuScenes-C** (27 corruptions): +2.1% overall improvement in relative robustness ratio.

**FDSNet** (Feature Disagreement Scoring Network): Dynamically selects the fusion stage based on measured semantic consistency across modalities. When sensors disagree significantly, it shifts to earlier (more conservative) fusion stages.

**SAMFusion** (Sensor-Adaptive Multimodal Fusion, ECCV 2024): Adapts fusion strategy based on current sensor reliability, using learned quality indicators for each modality.

**Design principles for graceful degradation:**

1. **Sensor redundancy**: Multiple sensors covering overlapping fields of view.
2. **Confidence-weighted fusion**: Dynamically adjusting modality weights based on estimated reliability.
3. **Fallback modes**: Ability to operate on single-modality streams when others fail.
4. **Mid-level fusion**: Reduces dimensionality of inputs, mitigates sensor misalignment, and enables task-specific fusion heads while accommodating missing/degraded inputs.

### 4.4 Multi-Modal Fusion for Robustness

Multi-modal fusion architectures have evolved through three generations:

**Early fusion** (raw data level): Concatenates raw sensor data before processing. Simple but brittle -- one corrupted modality poisons the entire input.

**Late fusion** (decision level): Independent per-modality processing with result aggregation. Robust to single-sensor failure but cannot exploit cross-modal complementarity.

**Mid-level fusion** (feature level): Current dominant approach. Fuses intermediate feature representations, enabling both complementarity and failure tolerance.

**Hierarchical alignment modules** refine token-level matching across depth and semantics, maintaining robust performance under degraded sensor conditions.

**Critical finding from RoboBEV**: Multi-modal models exhibit **asymmetric sensor dependence**. Camera-LiDAR fusion models lose 89-95% performance when LiDAR drops out, but only 5-8% when cameras fail. This means LiDAR failure is catastrophic for current fusion architectures, while camera failure is manageable -- a crucial insight for designing truly robust systems.

### 4.5 Self-Cleaning Sensor Systems

Sensor cleaning is a critical enabling technology. If sensor surfaces are not maintained, autonomy functions must be suspended.

**Active cleaning technologies:**

| Approach | Mechanism | Provider |
|----------|-----------|----------|
| **Pressure wash** | Targeted high-pressure water spray on lens surfaces | Ascencione (CVSS-HAV-MIL) |
| **Spray + air dry** | Dual-nozzle: water spray for cleaning, air jet for drying | Multiple tier-1 suppliers |
| **Air curtain** | Continuous airflow slots near lenses deflecting contaminants | Ford |
| **Software-triggered cleaning** | Algorithms detect contamination from image analysis, triggering cleaning only when needed | Ford, Valeo |
| **Integrated nozzle arrays** | Next-generation nozzles positioned adjacent to every camera/LiDAR lens | ARaymond, Kautex (Allegro) |

**Passive self-cleaning technologies:**

- **UV-durable self-cleaning coatings** (Nature Scientific Reports, 2024): Transparent functional coatings that maintain self-cleaning and hydrophobic properties over time, reducing maintenance needs. Key innovation is UV durability -- prior coatings degraded under sustained sunlight exposure.
- **Hydrophobic nano-coatings**: Cause water to bead and roll off lens surfaces, carrying contaminants away.
- **Oleophobic coatings**: Resist oil-based contaminants (relevant for airport environments with hydraulic fluid and glycol exposure).

**Industry solutions:**

- **Valeo**: Comprehensive sensor and camera cleaning system portfolio for automotive OEMs.
- **Kautex Allegro**: Modular cleaning systems designed for the diverse sensor suites of autonomous vehicles.
- **ARaymond**: Cleaning systems for windshields, lamps, LiDAR, ADAS sensors, and camera lenses.

---

## 5. Airport-Specific Adverse Conditions

Airport aprons present a unique combination of adverse conditions not encountered in typical road driving. The FAA currently classifies aprons as "non-movement areas" suitable for AGVS testing under controlled conditions, with regulatory frameworks still evolving (Part 139 CertAlert 24-02; Emerging Entrants Bulletin 25-02, May 2025).

### 5.1 De-icing Operations (Glycol on Surfaces, Spray, Visibility)

De-icing operations create multiple perception challenges simultaneously:

**Glycol contamination:**
- Aircraft de-icing uses heated Type I/IV fluids (propylene glycol or ethylene glycol based) sprayed at high pressure from elevated platforms ("cherry picker" vehicles).
- Glycol overspray can coat any sensor surface in the vicinity, creating a viscous, optically distorting film that is significantly harder to remove than water.
- Glycol on road/apron surfaces creates a slippery, partially transparent layer that alters surface reflectance properties, confusing both cameras (altered appearance) and LiDAR (changed reflectivity values).

**Visibility reduction:**
- Active de-icing generates clouds of heated fluid spray that temporarily reduce visibility in the operational area, similar to localized fog but with different particle size and reflectance characteristics.
- De-icing pads concentrate these effects in designated areas, but autonomous vehicles transiting nearby may encounter spray plumes.

**Sensor mitigation requirements:**
- Frequent automated lens cleaning cycles during de-icing operations.
- Oleophobic coatings to resist glycol adhesion.
- Radar-primary perception modes during active de-icing, as radar wavelengths pass through glycol spray.
- Geofenced speed reduction and increased safety margins in de-icing zones.

### 5.2 Jet Blast Effects on Sensors

Jet engine exhaust creates several distinct challenges:

**Physical forces:**
- Jet blast velocities can exceed 100 km/h at distances relevant to ground vehicle operations, potentially physically displacing lightweight sensor mounts or causing vibration-induced image blur.
- Debris entrainment: Jet blast picks up FOD, dust, and loose materials, projecting them at high velocity toward nearby vehicles and sensors.
- FAA guidance requires ground equipment to maintain sufficient distance from aircraft engines to prevent damage.

**Thermal effects:**
- Exhaust gases at elevated temperatures create convective plumes that produce density gradients in the air.
- These density gradients cause refractive index variations visible to cameras as "heat shimmer" (see 5.3).

**Perception impact:**
- Turbulent air from jet blast causes rapid, unpredictable image distortions in camera feeds.
- LiDAR beams passing through hot exhaust plumes experience refraction, potentially introducing range measurement errors.
- Physical vibration from jet blast on the vehicle platform degrades all sensor modalities simultaneously.

### 5.3 Heat Shimmer from Engines / Tarmac

Heat shimmer (atmospheric turbulence) is caused by temperature-driven density variations in air that create refractive index gradients, distorting light paths between objects and sensors.

**Sources on airport aprons:**
- Jet engine exhaust plumes (extremely high temperature gradients).
- Sun-heated tarmac (asphalt surface temperatures can exceed 60 deg C on hot days).
- Auxiliary Power Unit (APU) exhaust.
- Ground power equipment exhaust.

**Visual effects:**
- Spatially varying pixel displacements (straight lines appear wavy).
- Localized blurring that varies across the image.
- Temporal flickering that confuses motion detection and optical flow algorithms.

**Deep learning mitigation techniques:**

- **AT-Net**: Deep learning atmospheric turbulence removal network.
- **MPRNet**: Multi-stage progressive restoration network adapted for turbulence mitigation.
- **Frame selection methods**: Algorithms select informative regions from good-quality frames, then register and composite them to reduce distortion.
- **Laminar airflow systems**: Physical mitigation using directed airflow to suppress turbulence near sensor apertures.

**Critical challenge for airport AVs**: Heat shimmer is intermittent, spatially localized, and varies in intensity -- making it particularly difficult to train robust models against. Unlike fog or rain which affect the entire scene somewhat uniformly, heat shimmer creates localized, time-varying distortions.

### 5.4 Night Operations with Apron Lighting

Airport apron night operations present unique lighting challenges distinct from road driving at night:

**Lighting characteristics:**
- ICAO standards require floodlights positioned so each aircraft stand is lit from at least two directions to reduce shadows.
- Apron lighting is designed primarily for human visual tasks (aircraft servicing, baggage handling), not for machine vision.
- Lighting produces strong specular reflections on wet surfaces and aircraft fuselage, creating high dynamic range scenes.

**Perception challenges:**
- **Mixed lighting**: Combination of fixed floodlights, aircraft navigation lights, vehicle headlights, and strobes creates complex, time-varying illumination.
- **Shadow/highlight extremes**: Deep shadows under aircraft fuselages adjacent to brightly lit areas exceed typical camera dynamic range.
- **Glare from landing lights**: Aircraft taxi/landing lights pointed toward ground vehicles can saturate cameras.
- **Retroreflective markings**: Airport surface markings have specific retroreflective properties that can cause camera bloom.

**Mitigation approaches:**
- HDR cameras with 120dB+ dynamic range.
- Infrared/thermal cameras for illumination-independent perception.
- LiDAR (active illumination, unaffected by ambient lighting).
- Multi-exposure fusion algorithms.
- Adaptive exposure control with region-of-interest optimization.

### 5.5 Sun Glare on Tarmac

Airport tarmac surfaces are expansive, flat, and often dark-colored (asphalt), creating severe glare conditions:

**Specular reflection scenarios:**
- Low-angle sun (dawn/dusk) reflecting off wet tarmac creates mirror-like glare.
- Standing water pools act as near-perfect specular reflectors at shallow viewing angles.
- Painted markings (white/yellow) have different reflectance profiles than surrounding surface.

**Technical solutions:**
- **Deconvolution-based glare reduction**: Using Joint Glare Spread Function (GSF) estimation with saturated pixel-aware processing, shown to outperform dehazing and enhancement approaches.
- **140dB HDR cameras**: Capture useful information in both glare-saturated and shadow regions simultaneously.
- **Polarization filters**: Physical filters on cameras that reduce specular reflections (standard in aviation photography but rarely used in AV camera systems).
- **Multi-modal fallback**: When camera systems are glare-saturated, radar and LiDAR provide unaffected perception.

### 5.6 Standing Water on Apron

Standing water on airport aprons creates multiple simultaneous perception challenges:

**Detection challenges:**
- Water puddles appear as specular (mirror-like) surfaces to cameras, reflecting sky or surrounding structures rather than showing the underlying surface.
- LiDAR beams hitting standing water at shallow angles reflect specularly away from the sensor, creating "holes" in the point cloud where water is present.
- Water depth is extremely difficult to estimate from any single sensor modality.

**SemanticSpray++ dataset** (2024) specifically addresses wet surface perception:
- Captures highway-like scenarios at 50-130 km/h with varying surface water levels.
- Provides camera (2D bounding boxes), LiDAR (3D bounding boxes + semantic labels), and radar (semantic targets + Doppler) annotations.
- Identifies that modern object detectors tend to detect unknown objects (spray artifacts) as training classes with high confidence -- a dangerous false positive mode.

**Operational impact for airport aprons:**
- Reduced braking friction (hydroplaning risk).
- Spray generation by other vehicles obscuring following vehicles' sensors.
- Altered surface reflectance confusing lane/marking detection.
- Potential for ice formation in cold conditions.

**Active detection systems:**
- Anti-aquaplaning systems using sensorized tires that detect hydroplaning onset without additional dedicated sensors.
- Color camera-based daytime water detection (more cost-effective than thermal or LiDAR-based approaches).
- Radar-based surface condition assessment (radar returns from water surfaces have distinct signatures).

### 5.7 Snow/Ice Operations (Winter Ops)

Winter operations on airport aprons combine road-winter-driving challenges with airport-specific factors:

**Industry developments:**

- **Yeti Snow Technology** (Norway): Automated snowploughs clearing 357,500 m^2/hour with "Applied Autonomy" -- a leading example of autonomous winter operations at airports.
- **Kodiak Technologies** (2025): Unveiling the world's most powerful electric and hybrid commercial snow removal vehicle at the International Aviation Snow Symposium.
- **Daimler**: Has demonstrated automated snow removal operations at airports.

**Perception challenges specific to snow/ice:**

1. **Surface definition loss**: Snow covers markings, curbs, and surface boundaries that perception systems use for localization and path planning.
2. **LiDAR ground plane confusion**: Snow-covered surfaces change elevation profiles and reflectivity, potentially causing ground plane estimation failures.
3. **Reduced contrast**: White snow against white-painted markings and light-colored concrete eliminates visual contrast cues.
4. **Dynamic snow accumulation**: Surface conditions change continuously during active snowfall, requiring constant map/model updates.
5. **Black ice**: Invisible to cameras and LiDAR; requires specialized sensors (e.g., road surface temperature sensors) or friction estimation.

**Operational adaptations:**
- Pre-built high-definition maps with sub-surface feature encoding (e.g., buried magnetic markers or RFID tags for localization when visual features are occluded).
- Radar-primary perception modes (radar is largely unaffected by snow on the ground surface).
- Integration with airport Surface Movement Guidance and Control Systems (SMGCS) for situational awareness.
- Reduced operational speeds and increased safety margins during active precipitation.

### 5.8 Dust/FOD Kicked Up by Aircraft

Aircraft operations generate significant amounts of airborne particulate matter and foreign object debris:

**Sources of dust and FOD:**
- **Jet blast**: Entrains loose surface material, propelling it at high velocity.
- **Prop wash**: Helicopter and propeller aircraft create strong downwash that lifts dust and debris.
- **Tire debris**: Aircraft landing gear generates rubber fragments.
- **Maintenance debris**: Hardware, tools, fasteners, packaging materials.
- **Environmental debris**: Sand, gravel, vegetation fragments blown onto the apron.

**Impact on perception:**

Dust clouds degrade LiDAR point clouds similarly to fog -- scattered returns create noise throughout the point cloud. Mining industry research provides directly applicable solutions:

- **Reflectivity-based filtering**: Dust particle returns have distinct intensity signatures compared to solid objects, enabling algorithmic removal.
- **Confidence template matching**: Building templates of expected reflectivity patterns to screen out dust-contaminated points.
- **Real-time dust cloud detection**: Machine learning algorithms (e.g., Exyn Technologies' approach) that detect dust clouds in LiDAR data and adjust processing parameters in real time.

**FOD detection systems for airports:**

Modern autonomous FOD detection employs multi-sensor approaches:

- **AI-powered computer vision**: Continuous automated surveillance of apron surfaces.
- **Millimeter-wave radar and synthetic aperture radar**: Robust performance across weather and lighting conditions.
- **LiDAR surface scanning**: Identifies height and texture variations indicating FOD presence.
- **Autonomous ground robots**: Systems like Roboxi autonomously scan for and remove FOD from airside surfaces.
- **Airtrek platform**: AI-powered autonomous ground robotics providing 24/7 FOD detection and mitigation.

The global airport FOD detection market was valued at $49M (2023), growing at 14.1% CAGR through 2032, reflecting increasing adoption of autonomous detection systems.

---

## Summary of Key Takeaways

### Critical Research Gaps

1. **World model adversarial robustness**: Almost no published work on adversarial attacks against driving world models.
2. **World model uncertainty quantification**: Current DWMs do not provide calibrated uncertainty estimates.
3. **Airport-specific perception**: Very limited academic research on autonomous vehicle perception in airport apron environments specifically.
4. **Glycol/chemical contamination**: No systematic study of de-icing fluid effects on AV sensor performance.
5. **Heat shimmer for AV**: Deep learning turbulence removal exists but has not been evaluated for real-time autonomous driving perception.

### Most Promising Technologies

1. **4D radar**: The single most weather-robust sensor modality, with rapidly growing adoption and dataset availability.
2. **Mixture-of-Experts fusion**: MoME-style architectures that decouple modality dependencies and route queries to the best-performing expert for current conditions.
3. **Diffusion-based domain adaptation**: Sim2Real Diffusion achieving 40%+ style gap reduction while preserving semantic consistency.
4. **GAIA-3 world model evaluation**: The most comprehensive framework for safety-critical scenario generation and robustness testing.
5. **Self-cleaning sensor systems**: Increasingly sophisticated automated cleaning with both active (spray/air) and passive (hydrophobic/oleophobic coatings) approaches.

### Recommendations for Airport Apron AV Development

1. **Sensor suite**: Prioritize 4D radar as the primary weather/contamination-robust modality, supplemented by HDR cameras, LiDAR, and thermal cameras.
2. **Fusion architecture**: Implement Mixture-of-Experts or attention-based adaptive fusion that gracefully degrades when individual sensors are compromised.
3. **Cleaning systems**: Deploy active sensor cleaning with contamination detection, using oleophobic coatings as a first line of defense against glycol and hydraulic fluids.
4. **Domain-specific training data**: Collect and annotate data covering all airport-specific adverse conditions (de-icing spray, jet blast, heat shimmer, apron lighting, FOD).
5. **Uncertainty-aware planning**: Implement uncertainty quantification at the perception and world-model levels, with conservative fallback behaviors (speed reduction, stop) when uncertainty exceeds safety thresholds.
6. **Continual learning pipeline**: Deploy mechanisms for incremental model improvement as new airport environments and conditions are encountered, with safety validation gates.

---

## Sources

- [RoboBEV: Benchmarking BEV Perception Robustness (TPAMI 2025)](https://arxiv.org/html/2405.17426v2)
- [RoboFusion: Robust Multi-Modal 3D Detection via SAM (IJCAI 2024)](https://www.ijcai.org/proceedings/2024/141)
- [The Role of World Models in Shaping Autonomous Driving (Survey 2025)](https://arxiv.org/html/2502.10498v1)
- [A Survey of World Models for Autonomous Driving (2025)](https://arxiv.org/html/2501.11260v4)
- [AdaWM: Adaptive World Model Based Planning (ICLR 2025)](https://arxiv.org/html/2501.13072v1)
- [GAIA-3: Scaling World Models for Safety and Evaluation (Wayve 2025)](https://wayve.ai/thinking/gaia-3/)
- [DriveDreamer: Real-World-Driven World Models](https://drivedreamer.github.io/)
- [Glare Mitigation for Enhanced AV Perception (2024)](https://arxiv.org/html/2404.10992v1)
- [AWD-YOLO: Adverse Weather Perception (2025)](https://www.nature.com/articles/s41598-025-29575-1)
- [LightDiff: Low-Light Enhancement for Driving (CVPR 2024)](https://github.com/jinlong17/LightDiff)
- [Ultra-Fast Deraining Plugin (IEEE T-ITS 2024)](https://dl.acm.org/doi/abs/10.1109/TITS.2024.3503556)
- [4D mmWave Radar Survey (IEEE 2024)](https://ieeexplore.ieee.org/document/10477463/)
- [V2X-Radar Dataset (2024)](https://www.basic.ai/blog-post/15-new-autonomous-driving-datasets-in-2024-2025)
- [SemanticSpray++ Wet Surface Dataset (2024)](https://arxiv.org/html/2406.09945)
- [MoME: Resilient Sensor Fusion (2025)](https://arxiv.org/html/2503.19776v1)
- [LiDAR Performance Degradation in Rain and Fog](https://pmc.ncbi.nlm.nih.gov/articles/PMC10051412/)
- [Point Cloud Processing Under Adverse Weather Survey (2025)](https://link.springer.com/article/10.1007/s11760-025-04352-9)
- [Sensor Blockage Detection in AVs (2025)](https://wjaets.com/sites/default/files/fulltext_pdf/WJAETS-2025-0483.pdf)
- [UV-Durable Self-Cleaning Coatings (Nature 2024)](https://www.nature.com/articles/s41598-024-58549-y)
- [Valeo Sensor Cleaning Systems](https://www.valeo.com/en/sensor-and-camera-cleaning-system-for-cars/)
- [LiDAR Dust Filtering for Mining (2024)](https://www.mdpi.com/2071-1050/16/7/2827)
- [Uncertainty Quantification for Safe AVs (IEEE T-ITS 2025)](https://dl.acm.org/doi/abs/10.1109/TITS.2025.3532803)
- [Sim2Real Diffusion Domain Adaptation (2025)](https://arxiv.org/abs/2507.00236)
- [Style Transfer with Diffusion Models (2025)](https://arxiv.org/abs/2505.16360)
- [H2C: Continual Learning for Trajectory Prediction (2025)](https://arxiv.org/html/2508.01158)
- [FAA AGVS on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FOD Detection with AI (ACI-NA 2025)](https://airportscouncil.org/2025/04/30/the-silent-airside-threat-how-ai-is-fighting-foreign-object-debris-fod-and-revolutionizing-airport-operations/)
- [Deep Learning for Atmospheric Turbulence Removal (Springer 2024)](https://link.springer.com/article/10.1007/s10462-024-11086-6)
- [Domain Generalization with ROAD-Almaty Dataset (2024)](https://arxiv.org/html/2412.12349)
- [Advancing Autonomy Through Lifelong Learning Survey (Frontiers 2024)](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2024.1385778/full)
- [Multi-Sensor Fusion in Autonomous Driving Review (MDPI 2025)](https://www.mdpi.com/1424-8220/25/19/6033)
- [AUTHENTICATION: Adversarial Failure Mode Discovery (2025)](https://arxiv.org/abs/2504.17179)
