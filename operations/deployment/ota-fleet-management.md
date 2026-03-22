# OTA Model Deployment, Fleet Management, and ML Model Lifecycle for Production Autonomous Vehicles

## Table of Contents

1. [OTA Update Architectures](#1-ota-update-architectures)
2. [Model Versioning for AV](#2-model-versioning-for-av)
3. [Canary Deployments](#3-canary-deployments)
4. [A/B Testing on Fleet](#4-ab-testing-on-fleet)
5. [Rollback Procedures](#5-rollback-procedures)
6. [Shadow Deployment](#6-shadow-deployment)
7. [Monitoring in Production](#7-monitoring-in-production)
8. [Edge Compute Management](#8-edge-compute-management)
9. [Data Collection and Upload](#9-data-collection-and-upload)
10. [Model Validation Pipeline](#10-model-validation-pipeline)
11. [Fleet Management Platforms](#11-fleet-management-platforms)
12. [Airside-Specific Considerations](#12-airside-specific-considerations)

---

## 1. OTA Update Architectures

### 1.1 How Industry Leaders Push Model Updates

#### Tesla

Tesla operates the largest fleet-scale OTA neural network deployment system in production. Key architectural characteristics:

- **Bi-weekly cadence**: OTA updates are pushed approximately every two weeks, with major updates quarterly. Low-latency AI model updates are delivered via OTA channels on the same bi-weekly cycle.
- **End-to-end neural network**: FSD v14+ uses a single end-to-end neural network handling perception, planning, and control. The v14 release uses a 10x larger neural network compared to previous generations, skipping the planned 4x intermediate step.
- **Staged rollout**: Tesla begins with limited rollout (e.g., FSD v14.2 started with a small subset of vehicles before broader deployment). A "FSD v14 Lite" variant is planned for older Hardware 3 vehicles, demonstrating hardware-aware model packaging.
- **Dual compute architecture**: Tesla's Hardware 4.5 runs a 3-SoC architecture — two chips handle production driving with standard redundancy, while a third chip can run a newer experimental model in shadow mode with zero safety risk.
- **WiFi-preferred delivery**: Updates download over WiFi when parked, with cellular fallback for critical patches.

#### Waymo

Waymo takes a more controlled approach given its managed robotaxi fleet:

- **Centralized fleet control**: Operating approximately 2,500 robotaxis (as of late 2025), Waymo manages updates through a centralized operations platform rather than consumer-facing OTA.
- **Generation-based updates**: Major updates align with hardware generations. The 6th-generation Waymo Driver reduced sensors (13 cameras from 29, 4 lidar from 5) while maintaining performance, reaching driverless deployment "in about half the time" of previous generations.
- **Foundation model architecture**: The Waymo Foundation Model combines AV-specific ML with vision-language model capabilities. Updates to this model affect scene interpretation, driving plan generation, and agent trajectory prediction.
- **Large evaluation framework**: Waymo created an extensive evaluation and deployment framework allowing researchers to focus on model improvement rather than individual release cycles.
- **Factory-to-road deployment**: New vehicles can pick up their first public passengers less than 30 minutes after leaving the factory, indicating rapid software provisioning.

#### comma.ai (openpilot)

comma.ai demonstrates an open-source approach to model deployment:

- **Git-based OTA**: Updates are distributed via GitHub releases, downloaded over WiFi or cellular to the comma device. The device notifies users when an update is available and prompts a reboot.
- **ONNX model format**: Neural networks are deployed as ONNX files (e.g., `supercombo.onnx`), providing a hardware-agnostic model representation.
- **tinygrad runtime**: The model execution stack has migrated from Qualcomm SNPE to tinygrad, which simplifies the runtime in terms of lines of code and dependencies while enabling future optimizations and bigger driving models.
- **Edge-first compute**: All inference runs on-device. The ISP (Image Signal Processor) handles camera processing in 0.1ms, freeing the GPU entirely for neural network inference.
- **Future GPU expansion**: openpilot 0.9.9 introduces infrastructure for external GPU support, planning to ship two model classes: on-device and external GPU models.

### 1.2 Dual-Partition (A/B) Update Systems

The A/B partition architecture is the foundational mechanism for safe OTA updates on embedded vehicle systems:

#### Architecture

```
┌─────────────────────────────────────────────────┐
│                  Boot Loader                     │
│         (selects active partition)               │
├────────────────────┬────────────────────────────┤
│   Partition A      │      Partition B            │
│   (ACTIVE)         │      (INACTIVE)             │
│                    │                              │
│   Boot Image A     │      Boot Image B            │
│   Root FS A        │      Root FS B               │
│   Application A    │      Application B            │
│   ML Models A      │      ML Models B             │
├────────────────────┴────────────────────────────┤
│              Data Partition                      │
│    (persistent across updates — configs,         │
│     logs, calibration data)                      │
└─────────────────────────────────────────────────┘
```

#### Update Sequence

1. **Download**: New image/model is downloaded to inactive partition (B) while the vehicle continues operating from active partition (A)
2. **Verify**: Cryptographic signature and integrity checks on the downloaded image
3. **Write**: Update is written atomically to partition B — the update is always either fully applied or not at all
4. **Switch**: Bootloader is configured to boot from partition B on next restart
5. **Validate**: On first boot from B, system runs health checks (application startup, network connectivity, sensor availability)
6. **Commit or Rollback**: If all checks pass, B becomes the new active partition. If any check fails, the system automatically reboots back to A

#### Key Design Principles

- **Persistent data isolation**: Data must never be stored on the rootFS since it is replaced during updates. Logs, configurations, and calibration data live on a separate data partition.
- **Storage requirements**: A/B partitioning effectively doubles storage needs. Devices should have 512MB+ and must account for future firmware growth.
- **Atomicity**: Image-based updaters provide atomic updates — no other component can ever see a partial update.
- **No-downtime updates**: The update installs to the inactive partition while the device continues normal operation; downtime occurs only during the reboot.

#### OTA Frameworks for Embedded Linux

| Framework | Description | Binary Size | Key Strength |
|-----------|-------------|-------------|--------------|
| **Mender** | Open-source OTA management platform by Northern.tech | ~6.9MB | User-friendly, managed server, Yocto/Debian support |
| **RAUC** | Robust Auto-Update Controller, lightweight update client | ~512KB | Minimal footprint, fine-grained control |
| **SWUpdate** | Massive framework for Linux update scenarios | ~1.3MB | Supports raw flash, UBI volumes, disk partitions, tarballs |

### 1.3 Differential (Delta) Updates

For bandwidth-constrained deployments (cellular networks, airside WiFi), differential updates send only the binary differences between old and new firmware:

- **Binary diffing**: Compares old and new files, generates a patch file; only the patch is transmitted
- **Size reduction**: Can reduce download sizes by 70-95% compared to full image updates
- **Limitation**: Requires sufficient RAM/flash on the target device for patch application; not practical on low-end microcontrollers
- **Security**: Digital signatures and mutual authentication protect the patch integrity
- **Best for**: High-performance vehicle computing modules with sufficient spare memory (e.g., NVIDIA Jetson, Tesla FSD computer)

---

## 2. Model Versioning for AV

### 2.1 Versioning Fundamentals

ML model versioning for autonomous vehicles requires tracking far more than just model weights. A complete version record must include:

| Artifact | What to Version | Why |
|----------|----------------|-----|
| Model weights | Serialized parameters (checkpoint files) | Core inference artifact |
| Architecture definition | Network topology, layer configurations | Reproducibility |
| Training code | Git commit hash of training repository | Audit trail |
| Training data | Dataset version (DVC hash or manifest) | Data lineage |
| Hyperparameters | Learning rate, batch size, augmentations | Reproducibility |
| Training environment | CUDA version, framework version, hardware | Consistency |
| Evaluation metrics | Accuracy, latency, safety-critical KPIs | Performance baseline |
| Deployment config | TensorRT optimization profile, quantization settings | Target hardware compatibility |
| Calibration data | Vehicle-specific sensor calibration | Hardware variation |

### 2.2 Semantic Versioning for AV Models

Adopt a versioning scheme that communicates the nature and risk of changes:

```
v{MAJOR}.{MINOR}.{PATCH}-{HARDWARE_TARGET}

Examples:
  v3.2.1-orin        # Patch fix for NVIDIA Orin targets
  v4.0.0-orin        # Major architecture change (breaking)
  v3.3.0-hw4         # Minor improvement for Tesla HW4
```

- **MAJOR**: Architecture changes, new sensor inputs, changed output format — requires full validation cycle
- **MINOR**: Retrained model with new data, hyperparameter changes — requires regression testing
- **PATCH**: Bug fixes, quantization adjustments, calibration updates — requires targeted testing

### 2.3 Model Registry Architecture

A model registry serves as the single source of truth for all model versions across the fleet:

```
┌──────────────────────────────────────────────────────┐
│                    Model Registry                     │
│                (MLflow / Weights & Biases / Custom)    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ RegisteredModel: "perception_v4"                 │ │
│  │                                                   │ │
│  │  Version 1  ─── @archived                        │ │
│  │  Version 2  ─── @archived                        │ │
│  │  Version 3  ─── @champion (production)           │ │
│  │  Version 4  ─── @challenger (canary 10%)         │ │
│  │  Version 5  ─── @shadow                          │ │
│  │                                                   │ │
│  │  Metadata per version:                           │ │
│  │    - training_data_hash                          │ │
│  │    - evaluation_metrics                          │ │
│  │    - deployment_history                          │ │
│  │    - rollback_target (previous champion)         │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**MLflow Model Registry** is the most widely adopted open-source solution:

- Each registered model can have many versions, auto-incremented from 1
- **Aliases** (e.g., `@champion`, `@challenger`) provide mutable named references to specific versions
- Alias reassignment is independent of production code — the next inference execution automatically picks up the new model version
- Tags and metadata enable governance workflows: experimental -> staging -> production -> archived
- `ModelVersion` objects are immutable snapshots with full lineage

**DVC (Data Version Control)** complements the model registry by versioning training data:

- Stores lightweight pointer files in Git while actual data lives in cloud storage (S3, GCS, Azure Blob)
- `dvc.yaml` and `dvc.lock` define reproducible training pipelines
- `dvc pull` retrieves specific data versions needed for retraining or validation
- Enables exact reproduction of any training run tied to a model version

### 2.4 Maintaining Rollback Capability

Every production model deployment must maintain:

1. **Previous N versions on-device**: At minimum, the current and previous model version stored on each vehicle's A/B partitions
2. **Full version history in registry**: All versions with their artifacts stored in the model registry with immutable snapshots
3. **Rollback alias**: A designated `@rollback-target` alias pointing to the last known-good version
4. **Deployment manifest**: A declarative record of which model version is running on which vehicle (or vehicle cohort)

---

## 3. Canary Deployments

### 3.1 Progressive Rollout Strategy

Canary deployment gradually shifts traffic (or fleet) from the existing model to a new one, minimizing risk by exposing only a small subset initially:

```
Stage 0:  100% Fleet on Model v3 (baseline)
    │
    ▼
Stage 1:  1% Fleet on Model v4 (canary) ── Monitor 24-48 hours
    │                                         ├── Pass → advance
    │                                         └── Fail → rollback
    ▼
Stage 2:  5% Fleet on Model v4 ── Monitor 24-48 hours
    │
    ▼
Stage 3:  10% Fleet on Model v4 ── Monitor 1 week
    │
    ▼
Stage 4:  25% Fleet on Model v4 ── Monitor 1 week
    │
    ▼
Stage 5:  50% Fleet on Model v4 ── Monitor 1 week
    │
    ▼
Stage 6:  100% Fleet on Model v4 ── Continuous monitoring
```

### 3.2 Cohort Selection Criteria

For an AV fleet, canary cohorts should be selected carefully:

- **Geographic diversity**: Include vehicles from different operating environments (urban, highway, different weather regions)
- **Route diversity**: Cover representative route types and complexity levels
- **Hardware representativeness**: Include vehicles with different hardware configurations if applicable
- **Operational maturity**: Start with vehicles that have the most sensor telemetry and monitoring
- **Risk tiering**: For airside operations, begin with vehicles operating in lower-risk zones (maintenance areas, non-movement areas) before promoting to high-traffic apron zones

### 3.3 Monitoring at Each Stage

Critical metrics evaluated between canary stages:

| Metric Category | Specific Metrics | Threshold |
|----------------|------------------|-----------|
| **Safety** | Disengagement rate, near-miss events, hard braking events | Must not exceed baseline |
| **Performance** | Inference latency (P99 < target), detection accuracy | < 20% degradation from baseline |
| **Reliability** | Model crash rate, error rate, exception count | < 1% error threshold |
| **Operational** | Mission completion rate, route adherence | Must meet SLO |
| **System** | GPU utilization, memory usage, thermal throttling | Within hardware limits |

### 3.4 Automated Gate Criteria

Before advancing to the next stage, the system must verify:

- **Minimum observation window**: At least 300+ seconds (5 minutes) of operation per vehicle, typically 24-48 hours of fleet-level data
- **Minimum sample size**: 1,000+ inference cycles across the canary cohort
- **Statistical confidence**: 95% confidence level that performance metrics meet thresholds
- **No safety regressions**: Zero critical safety events attributable to the new model
- **Baseline comparison**: All metrics within acceptable variance of the baseline model

### 3.5 Implementation Tooling

- **Seldon Core**: Uses `SeldonDeployment` custom resources with traffic weight specification for multiple predictors
- **KServe**: Employs `InferenceService` resources with native `canaryTrafficPercent` fields; integrates with Argo Rollouts
- **Argo Rollouts + Flagger**: GitOps-friendly progressive delivery with automated metric analysis templates and webhook notifications
- **Feature flags**: Tools like LaunchDarkly enable percentage-based rollout and instant kill-switch capability; every feature flag is fundamentally a kill switch

---

## 4. A/B Testing on Fleet

### 4.1 A/B Testing vs. Canary Deployment

While related, A/B testing and canary deployment serve different purposes:

| Aspect | Canary Deployment | A/B Testing |
|--------|-------------------|-------------|
| **Goal** | Safe rollout of a new version | Compare two versions to determine which is better |
| **Traffic split** | Temporary, increasing to 100% | Fixed split for the duration of the experiment |
| **Duration** | Until full rollout or rollback | Until statistical significance is reached |
| **Decision** | Ship or don't ship | Which version performs better |
| **Metrics focus** | Safety and reliability | Performance and business metrics |

### 4.2 Fleet A/B Test Design

For autonomous vehicles, A/B testing requires careful experimental design:

#### Assignment Strategy

- **Vehicle-level assignment**: Each vehicle runs one model version consistently — never split within a single vehicle
- **Deterministic assignment**: Use vehicle ID hash to ensure consistent assignment across restarts
- **Stratified sampling**: Balance test groups across geographic regions, route types, weather conditions, and hardware variants
- **Minimum group size**: Statistical power analysis determines required fleet size per group

#### Metrics Framework

Define an Overall Evaluation Criterion (OEC) that may differ from the training loss function:

```
Primary metrics (must improve or maintain):
  - Miles between disengagements
  - Object detection recall @ 95% precision
  - Path planning smoothness score
  - Passenger comfort index

Secondary metrics (monitor for regression):
  - Inference latency (P50, P95, P99)
  - GPU power consumption
  - False positive rate
  - Edge case handling score

Guardrail metrics (must not degrade):
  - Safety-critical event rate
  - Hard braking frequency
  - Time-to-collision minimum
```

### 4.3 Statistical Significance

- **Significance level**: 5% (p < 0.05) is the industry standard; safety-critical systems may require p < 0.01
- **Statistical power**: Commonly set at 80% or 90%, meaning 80-90% probability of detecting a real effect
- **Effect size**: The minimum meaningful difference you want to detect (e.g., 2% improvement in disengagement rate)
- **Sample size calculation**: Depends on significance level, power, expected effect size, and baseline metric variance
- **Sequential testing**: For continuous metrics from fleet vehicles, use sequential analysis methods that allow early stopping without inflating false positive rates
- **Multiple testing correction**: When evaluating many metrics simultaneously, apply Bonferroni or Benjamini-Hochberg corrections

### 4.4 Practical Considerations for AV Fleets

- **Confounding variables**: Weather, time of day, route complexity, and traffic density all affect model performance. Stratified randomization and mixed-effects models help control for these.
- **Non-stationarity**: Driving conditions change over time. Tests should run long enough to capture weekly patterns.
- **Safety override**: If at any point the test model shows a statistically significant degradation in safety metrics, the test must be terminated immediately regardless of whether the primary metric has reached significance.
- **Novelty effects**: Initial performance may not reflect long-term behavior. Allow a burn-in period before beginning measurement.

---

## 5. Rollback Procedures

### 5.1 Rollback Architecture

Effective rollback requires three critical components working together:

1. **Continuous monitoring** to detect when performance degrades
2. **State preservation** to maintain previous model versions ready for instant activation
3. **Rapid restoration** to switch back with minimal disruption

```
┌─────────────────────────────────────────────────────────┐
│                  Rollback Decision Flow                  │
│                                                          │
│  Monitor Metrics                                         │
│       │                                                  │
│       ▼                                                  │
│  Threshold Breached?                                     │
│       │                                                  │
│  YES  │  NO ──→ Continue monitoring                      │
│       │                                                  │
│       ▼                                                  │
│  Severity Assessment                                     │
│       │                                                  │
│  ┌────┴────┐                                             │
│  │         │                                             │
│  ▼         ▼                                             │
│ CRITICAL  WARNING                                        │
│  │         │                                             │
│  ▼         ▼                                             │
│ Auto      Alert team,                                    │
│ Rollback  manual decision                                │
│  │         │                                             │
│  ▼         ▼                                             │
│ Switch to  Evaluate with                                 │
│ @rollback  extended data                                 │
│ alias                                                    │
│  │                                                       │
│  ▼                                                       │
│ Validate rollback                                        │
│ health checks                                            │
│  │                                                       │
│  ▼                                                       │
│ Update deployment                                        │
│ manifest                                                 │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Automated Rollback Triggers

Common triggers that initiate automated rollback:

| Trigger | Threshold Example | Response Time |
|---------|-------------------|---------------|
| Safety-critical event | Any single occurrence | Immediate (seconds) |
| Inference error rate | > 1% over 5-minute window | < 1 minute |
| Latency violation | P99 > 200ms sustained for 2 minutes | < 2 minutes |
| Accuracy degradation | < 95% accuracy with < 1% tolerance | < 5 minutes |
| System crash/restart | Model process crashes 3+ times | Immediate |
| Memory/GPU exhaustion | > 95% utilization sustained | < 2 minutes |

### 5.3 Rollback Execution Methods

#### Method 1: A/B Partition Swap (On-Vehicle)

- The previous model version is already stored on the inactive partition
- Rollback is a bootloader reconfiguration and reboot
- Execution time: 30-90 seconds
- Limitation: Can only roll back one version (to the partition B image)

#### Method 2: Model Registry Alias Reassignment

- Reassign the `@champion` alias from the new version back to the previous version in the model registry
- Next model load on each vehicle picks up the rollback version
- Execution time: Depends on fleet connectivity and model download time
- Advantage: Can roll back to any previous version, not just the immediately prior one

#### Method 3: Feature Flag Kill Switch

- Disable the feature flag controlling the new model
- System immediately falls back to the default/previous code path
- Execution time: Seconds (no download required, flag change propagates)
- Advantage: Fastest possible rollback; no reboot required

#### Method 4: Blue-Green Environment Switch

- Run old (blue) and new (green) model versions in parallel on separate infrastructure
- Rollback = redirect all fleet traffic to the blue environment
- Execution time: Seconds for routing change
- Limitation: Requires sufficient compute to run both versions simultaneously

### 5.4 Post-Rollback Procedures

1. **Verify rollback health**: Confirm the reverted model is performing as expected
2. **Root cause analysis**: Investigate why the new model failed
3. **Data collection**: Preserve all telemetry from the failed deployment for debugging
4. **Incident report**: Document the failure mode, detection time, rollback time, and impact
5. **Model quarantine**: Mark the failed version as "quarantined" in the model registry to prevent re-deployment
6. **Regression test creation**: Add the failure scenario to the test suite

---

## 6. Shadow Deployment

### 6.1 Shadow Mode Architecture

Shadow deployment runs a new model alongside the production model without affecting vehicle behavior. The production model controls the vehicle; the shadow model processes the same inputs and its outputs are logged for comparison.

```
                    Sensor Data
                        │
                ┌───────┴───────┐
                │               │
                ▼               ▼
        ┌──────────────┐  ┌──────────────┐
        │  Production  │  │   Shadow     │
        │  Model v3    │  │   Model v4   │
        │  (controls   │  │  (observe    │
        │   vehicle)   │  │    only)     │
        └──────┬───────┘  └──────┬───────┘
               │                 │
               ▼                 ▼
        Vehicle Control    Logged for
        Commands           Analysis
               │                 │
               ▼                 │
        Actuators               ▼
                         Comparison Engine
                         (offline or real-time)
```

### 6.2 Tesla's Shadow Mode Implementation

Tesla's shadow mode is the most extensive example in production:

- **Scale**: Tesla's entire fleet operates in shadow mode, capturing approximately 1.5 million miles of driving data daily under shadow mode
- **Dual compute**: Each car runs two FSD systems in tandem — one controls the vehicle, the other runs in shadow mode
- **Comparison mechanism**: The system compares FSD's intended action with the human driver's actual action. The driver's decision is treated as the correct answer.
- **Hard clip detection**: When FSD's prediction diverges significantly from the driver's behavior, these "hard clips" are flagged as the most valuable training data
- **Edge case harvesting**: If the system thinks a light is red but the driver proceeds, the imagery and video are sent back to Tesla for training
- **Fleet advantage**: While competitors rely on test fleets numbering in hundreds or thousands, Tesla leverages millions of vehicles creating "unparalleled volume and diversity" of data
- **Hardware 4.5 evolution**: The 3-SoC architecture allows a third chip to run next-gen software in shadow mode on consumer cars with zero safety risk

### 6.3 Shadow Mode vs. A/B Testing

| Aspect | Shadow Mode | A/B Testing |
|--------|------------|-------------|
| **Traffic handling** | Both models see all events | Traffic is split between models |
| **User impact** | Zero — shadow model never controls vehicle | Direct — test model controls assigned vehicles |
| **Best for** | Validating model correctness without risk | Measuring real-world impact on outcomes |
| **Limitation** | Cannot measure behavioral effects (how users/system responds to model outputs) | Exposes some users to potentially worse model |
| **Duration** | Can run indefinitely | Runs until statistical significance |

### 6.4 Shadow Deployment Patterns

**Pattern 1: Behind the API (recommended for AV)**

- Single inference pipeline internally routes sensor data to both models
- Only production model outputs are sent to vehicle controls
- Shadow model outputs are logged locally and uploaded when bandwidth allows
- The model host team controls experimentation with no changes to the control pipeline

**Pattern 2: In Front of the API**

- Separate inference endpoints for production and shadow models
- Calling system invokes both and discards shadow response
- Provides more flexibility in API signatures
- Requires code changes in the calling system

### 6.5 What to Validate in Shadow Mode

- **Engineering correctness**: Pipeline functions without errors, input/output formats are compatible, latency is acceptable
- **Output distribution**: Shadow model predictions follow expected patterns and variance
- **Performance metrics**: Detection accuracy, planning quality, trajectory smoothness compared to production
- **Edge case handling**: How the shadow model handles scenarios that the production model struggles with
- **Resource utilization**: GPU/CPU/memory consumption of the shadow model under real workloads

---

## 7. Monitoring in Production

### 7.1 Metrics to Track

#### Safety Metrics (Highest Priority)

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Disengagement rate | Manual interventions per 1,000 miles | Any increase vs. baseline |
| Near-miss events | Predicted collision within T seconds | Any occurrence |
| Hard braking events | Deceleration > threshold | > baseline + 2 sigma |
| Time-to-collision minimum | Smallest TTC observed | < safety floor |
| Object detection misses | Ground truth objects not detected | > acceptable miss rate |
| False positive detections | Phantom detections | > baseline + tolerance |

#### Performance Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Inference latency | P50, P95, P99 end-to-end | P99 > target latency |
| Detection accuracy | mAP, recall, precision | < baseline - tolerance |
| Planning quality | Path smoothness, jerk metrics | > comfort threshold |
| Prediction accuracy | Predicted vs. actual trajectories of other agents | > baseline error |
| Localization accuracy | Position error vs. ground truth | > acceptable drift |

#### System Health Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| GPU utilization | Percentage of compute used | > 90% sustained |
| GPU temperature | Thermal state | > thermal throttle point |
| Memory utilization | RAM and VRAM usage | > 85% |
| Model load time | Time to initialize model | > acceptable startup |
| Sensor pipeline health | Camera/lidar/radar status | Any sensor dropout |

### 7.2 Data Drift Detection

Data drift occurs when the statistical properties of input data change from what the model was trained on, causing silent degradation:

#### Types of Drift

- **Data drift (covariate shift)**: Input feature distributions change (e.g., a model trained on California roads deployed to snowy regions)
- **Concept drift**: The relationship between inputs and correct outputs changes (e.g., new road markings, changed traffic patterns)
- **Prediction drift**: Model output distributions shift even if inputs appear similar

#### Detection Methods

| Method | Application | Tools |
|--------|-------------|-------|
| **Kolmogorov-Smirnov test** | Continuous feature distribution comparison | Evidently AI, NannyML |
| **Chi-squared test** | Categorical feature distribution comparison | Custom, scipy |
| **Population Stability Index (PSI)** | Overall distribution shift measurement | Evidently AI, Great Expectations |
| **Kullback-Leibler Divergence** | Information-theoretic distribution comparison | Custom |
| **Isolation Forest** | Anomaly detection on feature space | scikit-learn |
| **Hellinger Distance** | Symmetric divergence metric | Custom |

#### AV-Specific Drift Scenarios

- **Seasonal**: Snow, rain, fog, sun angle changes throughout the year
- **Infrastructure**: New construction, changed lane markings, new signage
- **Fleet composition**: New vehicle models with different sensor characteristics
- **Geographic expansion**: Moving to new operating domains with different road layouts
- **Temporal**: Rush hour vs. off-peak, weekday vs. weekend traffic patterns
- **Airside-specific**: Changed taxiway markings, new ground support equipment types, seasonal aircraft mix changes

### 7.3 Anomaly Detection on Model Performance

Implement multi-layer anomaly detection:

1. **Statistical process control**: Track metrics with control charts. Alert when metrics exceed 2-sigma or 3-sigma bounds.
2. **Change-point detection**: Identify abrupt shifts in metric time series that may indicate a model issue or environmental change.
3. **Cohort comparison**: Compare metrics across geographic regions, time periods, or vehicle subgroups. Divergence between cohorts may indicate localized drift.
4. **Baseline regression detection**: Automatically compare current model performance to the performance recorded during validation.

---

## 8. Edge Compute Management

### 8.1 Hardware Platforms

#### NVIDIA Ecosystem

| Platform | Performance | Power | Target Use |
|----------|-------------|-------|------------|
| **Jetson AGX Orin** | 275 TOPS | 15-60W | Autonomous machines, robotics |
| **DRIVE AGX Orin** | 254 TOPS | 60W | Production autonomous vehicles |
| **DRIVE AGX Thor** | 2,000 TOPS | ~TDP varies | Next-gen software-defined vehicles |
| **Tesla FSD Computer** | 144 TOPS | Custom silicon | Tesla fleet (custom optimization for their networks) |

The NVIDIA DRIVE AGX Thor represents the convergence of autonomous driving, infotainment, and in-vehicle AI into a single platform with safety certification and transformer acceleration.

#### Compute Budget Allocation

A typical AV edge compute budget for a 275 TOPS platform:

```
┌─────────────────────────────────────────────────┐
│           Compute Budget Allocation              │
├─────────────────────────────────────────────────┤
│ Camera perception (8x 4K @ 30fps):    50 TFLOPS │
│ Lidar segmentation (2M pts/sec):      30 TFLOPS │
│ Radar tracking:                       10 TFLOPS │
│ Prediction/Planning:                  30 TFLOPS │
│ Mapping/Localization:                 10 TFLOPS │
│ Safety monitoring:                    10 TFLOPS │
│ System overhead:                      10 TFLOPS │
│ Shadow model (when active):           ~50 TFLOPS│
│                                                  │
│ Total available:                     200 TFLOPS  │
│ Target utilization:                  <80%        │
│ Reserve for thermal headroom:         20%        │
└─────────────────────────────────────────────────┘
```

### 8.2 Model Optimization for Edge

To fit models within edge compute budgets, multiple optimization techniques are applied:

#### Quantization

- **FP32 to INT8**: 4x reduction in model size, significant throughput improvement
- **FP32 to FP16**: 2x reduction with minimal accuracy loss
- **Mixed precision**: Critical layers stay at higher precision, others quantized aggressively
- **Post-training quantization (PTQ)**: Applied after training with calibration data
- **Quantization-aware training (QAT)**: Simulates quantization during training for better accuracy

#### Pruning

- **Structured pruning**: Remove entire filters/channels for hardware-friendly sparsity
- **Unstructured pruning**: Zero out individual weights (requires hardware support for speedup)
- **Typical result**: 50% computation reduction with < 1% accuracy loss

#### Other Techniques

- **Knowledge distillation**: Train a smaller "student" model to mimic a larger "teacher"
- **Neural architecture search (NAS)**: Automatically find efficient architectures for target hardware
- **Model partitioning**: Intelligent partitioning can reduce vehicle compute requirements by 40%

#### Optimization Frameworks

- **NVIDIA TensorRT**: Optimized inference for NVIDIA GPUs, supports INT8, layer fusion, kernel auto-tuning
- **TensorRT Edge-LLM**: Open-source C++ framework for efficient LLM/VLM inference on DRIVE AGX Thor and Jetson Thor
- **ONNX Runtime**: Cross-platform inference with hardware-specific optimizations
- **tinygrad**: Lightweight runtime used by comma.ai, compiles models for specific hardware backends (including Qualcomm QCOM)

### 8.3 Resource Management

#### Container-Based Deployment

Modern AV stacks use containerized deployments for model management:

- **Docker containers**: Package model + dependencies + runtime into deployable units
- **K3s / MicroK8s**: Lightweight Kubernetes distributions for edge devices
- **Container orchestration**: Manages model lifecycle, rolling updates, resource limits
- **Multi-Instance GPU (MIG)**: NVIDIA Fleet Command supports MIG, allowing multiple AI applications to share a single GPU with isolated resources

#### Thermal Management

- Monitor GPU junction temperature continuously
- Implement dynamic frequency scaling when thermal limits approach
- Reserve 20% compute headroom for thermal throttling scenarios
- Consider ambient temperature in operating environment (airport tarmac can exceed 50C/122F)

---

## 9. Data Collection and Upload

### 9.1 Data Volume Reality

The scale of data generated by autonomous vehicles is staggering:

| Metric | Value |
|--------|-------|
| Raw data per vehicle per 8-hour shift | > 200 TB |
| Data per fleet of 10 vehicles per day | ~2 PB |
| Hourly generation rate | ~28 TB/hour |
| Sensor data throughput (real-time) | 6 GB/s |
| Estimated data per hour (all sensors) | Up to 40 TB |

### 9.2 Upload Strategies

Given that no cellular or WiFi connection can handle raw data volumes, multiple strategies are employed:

#### Strategy 1: Physical Media Transfer (Primary)

- Removable NVMe drives are swapped at depots ("smart ingest stations")
- Disk swap takes 2-3 minutes, keeping vehicles operational
- Multiple disk sets must be maintained per vehicle
- Data is uploaded to central data lakes from ingest stations
- **Best for**: Fleet depots, maintenance windows, bulk data collection

#### Strategy 2: Selective/Triggered Upload (Cellular/WiFi)

Upload only the most valuable data over the network:

- **Event-triggered**: Upload data surrounding disengagements, near-misses, edge cases
- **Time-based filtering**: Reduce temporal sampling rate for routine driving
- **Statistical filtering**: Apply calculations before transmission, upload only when values exceed thresholds
- **Logical filtering**: Transmit only when specific conditions are met (e.g., novel scenario detected)
- **Compression**: Reduce frames-per-second or resolution for non-critical segments
- **Edge AI filtering**: On-vehicle models identify "interesting" data worth uploading — can reduce transmitted data by 99.9% (gigabytes instead of terabytes)
- **Best for**: Continuous data collection from production fleet, edge case harvesting

#### Strategy 3: Depot WiFi Bulk Upload

- High-bandwidth WiFi at vehicle depots/charging stations
- Vehicles upload queued data while parked/charging
- 100 Gbps connections can transfer ~1 PB in 24 hours (theoretical; practical throughput is ~50%)
- **Best for**: Night shift data offload, scheduled data collection

#### Strategy 4: 5G Connectivity (Emerging)

- Private 5G networks at operating sites (e.g., airports)
- Low-latency, high-bandwidth data transfer
- Enables real-time monitoring via HD video streams
- **Best for**: Airside operations with dedicated 5G infrastructure

### 9.3 Data Pipeline Architecture

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Vehicle   │    │ Edge         │    │ Data Lake    │    │ Training     │
│ Sensors   │───→│ Processing   │───→│ (Cloud/      │───→│ Cluster      │
│           │    │ & Filtering  │    │  On-Prem)    │    │              │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                      │                     │                    │
                      │              ┌──────┴───────┐           │
                      │              │ Labeling &   │           │
                      │              │ Annotation   │           │
                      │              └──────────────┘           │
                      │                                         │
                      ▼                                         ▼
               Selective Upload                          New Model Version
               (cellular/WiFi)                           (back to fleet)
```

### 9.4 Bandwidth and Cost Management

| Connection Type | Bandwidth | Cost Profile | Use Case |
|----------------|-----------|--------------|----------|
| Physical media swap | Unlimited (disk capacity) | Hardware cost only | Bulk data collection |
| Depot WiFi | 1-10 Gbps | Infrastructure cost | Overnight uploads |
| Private 5G | 1-4 Gbps | Infrastructure + spectrum | Real-time monitoring |
| Public cellular (5G) | 100-500 Mbps | Per-GB charges ($0.01-0.10/GB) | Triggered event upload |
| Public cellular (4G) | 20-100 Mbps | Per-GB charges | Metadata and alerts only |

**Cost optimization strategies**:
- Prioritize data by training value (edge cases > routine driving)
- Compress before upload (lossless for safety-critical, lossy for context)
- Schedule uploads during off-peak cellular pricing windows
- Negotiate bulk data plans with carriers for fleet accounts
- Use fog computing to pre-process data closer to the edge, reducing what must travel to the cloud

---

## 10. Model Validation Pipeline

### 10.1 Validation Pipeline Stages

A model must pass through multiple validation gates before deployment to any vehicle:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Model Validation Pipeline                     │
│                                                                  │
│  Stage 1: Unit Tests                                             │
│    ├── Model loads correctly                                     │
│    ├── Input/output shapes match specification                   │
│    ├── Inference produces valid outputs (no NaN, within bounds)  │
│    └── Latency within budget on target hardware profile          │
│                                                                  │
│  Stage 2: Offline Evaluation                                     │
│    ├── Evaluation on held-out test dataset                       │
│    ├── Comparison to baseline model on all KPIs                  │
│    ├── Per-class accuracy analysis (pedestrians, vehicles, etc.) │
│    ├── Edge case dataset evaluation                              │
│    └── Regression test suite (previously-fixed bugs)             │
│                                                                  │
│  Stage 3: Simulation (Open-Loop)                                 │
│    ├── Replay recorded sensor data through new model             │
│    ├── Compare outputs to ground truth annotations               │
│    ├── Resimulation across hundreds of petabytes of data         │
│    ├── Sensor processing validation                              │
│    └── Algorithm-level validation per function                   │
│                                                                  │
│  Stage 4: Simulation (Closed-Loop)                               │
│    ├── Software-in-the-loop (SIL) testing in simulator           │
│    ├── Dynamic environment interaction testing                   │
│    ├── Scenario-based testing (intersections, weather, etc.)     │
│    ├── Adversarial scenario testing                              │
│    └── Monte Carlo simulation for statistical safety claims      │
│                                                                  │
│  Stage 5: Hardware-in-the-Loop (HIL)                             │
│    ├── Test on actual target hardware (Jetson, DRIVE AGX, etc.)  │
│    ├── Validate real-time performance constraints                │
│    ├── Thermal behavior under sustained load                     │
│    ├── Sensor pipeline integration                               │
│    └── Failover and degraded mode testing                        │
│                                                                  │
│  Stage 6: Shadow Deployment                                      │
│    ├── Run on small fleet subset in shadow mode                  │
│    ├── Compare predictions to production model                   │
│    ├── Validate on real-world data distribution                  │
│    └── Monitor for edge cases not covered in simulation          │
│                                                                  │
│  Stage 7: Canary Deployment                                      │
│    ├── Gradual rollout to production fleet (1% → 10% → 100%)    │
│    ├── Continuous monitoring at each stage                       │
│    ├── Automated rollback if metrics degrade                     │
│    └── Final promotion to full fleet                             │
│                                                                  │
│  [Gate]: Safety Review Board Approval                            │
│    ├── Required before Stage 6 and Stage 7                       │
│    ├── Review of all test results and metrics                    │
│    └── Formal sign-off for production deployment                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Testing Methodologies (Microsoft ValOps Reference)

Microsoft's ValOps (Validation Operations) reference architecture for autonomous vehicles provides a comprehensive framework:

#### Open-Loop Testing

- **Resimulation/Recompute**: Replay recorded sensor data through a cloud-based processing graph to validate AD functions. This is a massive parallel compute job processing hundreds of petabytes using tens of thousands of cores with >30 GBps I/O throughput.
- **Sensor processing**: Analyze raw camera, lidar, and radar data to test perception algorithms
- **Algorithm validation**: Test individual algorithms (object detection, lane keeping) using prerecorded data
- **Scenario-based testing**: Run predefined scenarios (pedestrian crossings, merging traffic, adverse weather)

#### Closed-Loop Testing

- **Software-in-the-Loop (SIL)**: Software runs on a virtual platform mimicking actual hardware
- **Hardware-in-the-Loop (HIL)**: Real hardware components (sensors, control units, actuators) integrated into the test loop
- **Driver-in-the-Loop (DIL)**: Human driver interacts with the simulation
- **Vehicle-in-the-Loop (VIL)**: Entire vehicle in a controlled simulated environment

### 10.3 Safety Standards Compliance

#### ISO 26262 (Functional Safety)

- Addresses hardware and software failures
- Defines Automotive Safety Integrity Levels (ASIL A through D)
- Requires systematic failure analysis and mitigation

#### ISO 21448 (SOTIF — Safety of the Intended Functionality)

- Addresses hazards from performance limitations rather than failures
- Covers sensor misinterpretations and unforeseen scenarios
- Requires ongoing field monitoring throughout operational life
- Production vehicles must collect data on system performance, edge cases, and incidents
- Software updates must maintain or improve safety — never introduce new hazards
- Complements ISO 26262 for a comprehensive safety framework

#### AMLAS (Assurance of Machine Learning for Autonomous Systems)

- Describes how to systematically integrate safety assurance into ML component development
- Generates evidence for justifying acceptable safety when ML components are integrated into autonomous systems

### 10.4 Validation Infrastructure

The infrastructure required for AV model validation at scale:

- **Compute**: Azure Batch or AKS clusters for parallel test execution
- **Storage**: Data Lake Storage for sensor data; premium block blob storage for low-latency scenarios
- **Orchestration**: Eclipse Symphony, Apache Airflow, or Kubeflow for workflow management
- **Visualization**: Microsoft Fabric / Power BI for KPI dashboards and regression analysis
- **CI/CD**: GitHub Actions or GitLab CI trigger validation campaigns on model changes
- **Artifact storage**: Container registries for model containers, model registries for weights

---

## 11. Fleet Management Platforms

### 11.1 NVIDIA Fleet Command

NVIDIA Fleet Command is a hybrid-cloud platform for managing AI at the edge across potentially thousands of devices:

**Core Capabilities**:
- **Turnkey orchestration**: New devices provisioned in minutes, deployments created in clicks
- **Container-based deployment**: Manages containerized AI applications with full lifecycle support
- **OTA updates**: Application updates deployable across entire fleets in minutes
- **Zero-trust security**: Layered security with data encryption in transit and at rest, secure boot, private application registry
- **Multi-Instance GPU (MIG)**: Assign applications to dedicated GPU instances on the same device
- **Monitoring**: Custom dashboard monitoring, system and application logging, remote system access
- **Scale**: Manages dozens to thousands of edge devices from a single control plane

**Best for**: Organizations using NVIDIA Jetson or DRIVE hardware across a distributed fleet.

### 11.2 AWS IoT Greengrass

AWS IoT Greengrass extends cloud capabilities to edge devices, designed for disconnected operation:

**Core Capabilities**:
- **Component-based architecture**: Code is organized as components (AI model, inference code, data processing, device management)
- **ML inference at edge**: Pairs with SageMaker Neo for optimized model compilation for edge hardware
- **Disconnected operation**: Critical for AVs — all safety functions run locally without cloud connectivity
- **Fleet deployment**: Package components in AWS, deploy to device groups; Greengrass handles installation and lifecycle
- **Anomaly detection**: Integration with SageMaker Edge Manager for on-device anomaly detection
- **OTA model updates**: Deploy new model versions to fleet without manual intervention

**AV-specific components**:
- Sensor processing pipeline for raw sensor data ingestion and fusion
- Navigation controller for autonomous path planning
- Mission manager for vehicle behavior coordination
- Safety monitor for operational safety parameters

**Best for**: AWS-centric organizations needing robust disconnected operation and ML inference at the edge.

### 11.3 NVIDIA DRIVE Platform

Purpose-built for autonomous vehicles:

- **DRIVE AGX**: In-vehicle compute platform (Orin: 254 TOPS, Thor: 2,000 TOPS)
- **DRIVE Hyperion**: Complete production-ready compute and sensor reference architecture
- **OTA capability**: Fleet-wide updates via OTA, supporting software-defined vehicle concept
- **Alpamayo**: Open-source AI models and tools for safe, reasoning-based AV development
- **Safety certification**: Designed for functional safety certification (ISO 26262)

**Best for**: Production autonomous vehicle programs requiring safety-certified hardware and software.

### 11.4 Custom Solutions

Many AV companies build custom fleet management due to specialized requirements:

**Common architecture pattern**:

```
┌─────────────────────────────────────────────────────────────┐
│                   Fleet Management Platform                  │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Deployment │  │ Monitoring │  │ Model Registry          │ │
│  │ Service    │  │ Service    │  │ (MLflow/Custom)         │ │
│  │            │  │            │  │                          │ │
│  │ • Canary   │  │ • Metrics  │  │ • Version tracking      │ │
│  │ • A/B test │  │ • Alerts   │  │ • Alias management      │ │
│  │ • Rollback │  │ • Drift    │  │ • Artifact storage      │ │
│  │ • Schedule │  │ • Logs     │  │ • Approval workflow     │ │
│  └─────┬──────┘  └─────┬──────┘  └────────┬───────────────┘ │
│        │               │                   │                 │
│        └───────────────┼───────────────────┘                 │
│                        │                                     │
│                   ┌────┴─────┐                               │
│                   │ Vehicle  │                                │
│                   │ Agent    │  (runs on each vehicle)        │
│                   │          │                                │
│                   │ • Health │                                │
│                   │ • Update │                                │
│                   │ • Report │                                │
│                   └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**Key custom components**:
- **Vehicle agent**: Lightweight daemon on each vehicle managing updates, health reporting, and configuration
- **Deployment service**: Manages canary/A/B/shadow deployments with automated rollback
- **Monitoring service**: Aggregates metrics from fleet, runs drift detection, triggers alerts
- **Model registry**: Tracks all model versions with deployment history and lineage

### 11.5 Comparison Matrix

| Capability | NVIDIA Fleet Command | AWS IoT Greengrass | NVIDIA DRIVE | Custom |
|-----------|---------------------|-------------------|-------------|--------|
| Edge AI focus | Yes | Yes | Yes | Configurable |
| AV-specific | Partial | Partial | Yes | Fully |
| OTA updates | Yes | Yes | Yes | Yes |
| Disconnected mode | Limited | Yes | Yes | Configurable |
| Model optimization | MIG support | SageMaker Neo | TensorRT | Any |
| Safety certification | No | No | Yes (ISO 26262) | Depends |
| Open source | Partial | Partial | Partial (Alpamayo) | Fully |
| Multi-cloud | No (NVIDIA) | No (AWS) | No (NVIDIA) | Yes |

---

## 12. Airside-Specific Considerations

### 12.1 Connectivity Infrastructure for Airport OTA Updates

#### WiFi Infrastructure

- Airport WiFi networks typically cover terminal buildings and some apron areas
- Coverage gaps common in remote stands, cargo areas, and maintenance zones
- Bandwidth shared with passenger and operational users
- Dedicated fleet WiFi networks recommended for vehicle OTA updates

#### Private 5G Networks

The most promising connectivity solution for airside AV operations:

- **Changi Airport testbed**: CAAS and Singtel launched a 5G Aviation Testbed at Terminal 3 airside, enabling real-time monitoring of AV operations using HD video streams with low latency and high transmission stability
- **Capabilities**: High bandwidth, high-speed connectivity, ultra-low latency
- **Mobile Edge Computing**: Addresses computing and space constraints without additional equipment
- **Coverage**: 5G replaces fiber optic cables for wireless data transmission, extended to remote aircraft stands
- **Fleet transition**: Nearly 4,000 existing 4G users received complimentary 5G upgrades

#### Recommended Connectivity Architecture for Airside Fleet

```
┌─────────────────────────────────────────────────────────────┐
│              Airport Connectivity Layers                     │
│                                                              │
│  Layer 1: Private 5G (Primary operational network)           │
│    • Real-time vehicle telemetry and monitoring              │
│    • ATC coordination data                                   │
│    • Safety-critical communications                          │
│    • Triggered data upload (edge cases)                      │
│                                                              │
│  Layer 2: Depot WiFi (High-bandwidth update network)         │
│    • OTA model updates during maintenance windows            │
│    • Bulk sensor data upload                                 │
│    • System logs and diagnostics upload                      │
│                                                              │
│  Layer 3: Physical Media (Maximum bandwidth)                 │
│    • Full sensor data offload at depot                       │
│    • Training data collection                                │
│    • System image updates                                    │
│                                                              │
│  Layer 4: Cellular (Fallback)                                │
│    • Emergency commands and safety alerts                    │
│    • Minimal telemetry when other networks unavailable       │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Safety Case for Model Updates on Airside Vehicles

#### Regulatory Framework

Airside autonomous vehicles operate under multiple regulatory jurisdictions:

- **FAA (US)**: Emerging Entrants Bulletin 25-02 provides testing and demonstration guidance. Part 139 CertAlert 24-02 addresses AGVS technology on certificated airports.
- **ICAO**: Provides international standards for airside vehicle operations, training, and safety management
- **IATA**: Has developed recommended practices for testing and implementing autonomous GSE
- **Local Airport Authority**: Individual airports define airside driving permits, speed limits, and operational rules
- **National Aviation Safety Regulators**: CAA (UK), CAAS (Singapore), EASA (EU), etc.

#### Key Safety Requirements

1. **ATC integration**: All vehicles on manoeuvring areas require authorization from ATC. Autonomous vehicles must integrate with ATC communication frequencies and protocols.
2. **Airside Driving Permit equivalent**: An assessment and authorization program is required for all "drivers" — for autonomous vehicles this translates to a certification process for the autonomous driving system.
3. **Explicit runway clearances**: Vehicle driver procedures require explicit ATC clearances to enter or cross any runway, regardless of status. Autonomous systems must be capable of receiving, understanding, and complying with ATC instructions.
4. **Radio communication**: All vehicles operating on runways must be fitted with appropriate radio communication equipment.
5. **Speed limits**: Strict speed limits apply, especially on approach to aircraft. Systems must enforce geo-fenced speed zones.
6. **Right-of-way**: Aircraft always have right-of-way. Emergency vehicles take priority after aircraft.

#### Safety Case Structure for Model Updates

Any model update to an airside autonomous vehicle must address:

```
┌─────────────────────────────────────────────────────────────┐
│              Safety Case for Model Update                    │
│                                                              │
│  1. Change Impact Analysis                                   │
│     • What changed in the model?                            │
│     • Which safety functions are affected?                  │
│     • Risk assessment (SOTIF + ISO 26262)                   │
│                                                              │
│  2. Validation Evidence                                      │
│     • All Stage 1-5 tests passed (see Section 10)           │
│     • Simulation coverage of airside scenarios              │
│     • HIL testing on target vehicle hardware                │
│     • Shadow mode results from airside fleet                │
│                                                              │
│  3. Airside-Specific Validation                             │
│     • Aircraft detection/avoidance (all aircraft types)     │
│     • GSE detection (tugs, belt loaders, etc.)              │
│     • FOD detection (foreign object debris)                 │
│     • Taxiway marking recognition                           │
│     • Apron marking and stand guidance                      │
│     • Jet blast zone awareness                              │
│     • Low-visibility operations (fog, rain, night)          │
│                                                              │
│  4. Operational Constraints                                  │
│     • Update window (maintenance periods only)              │
│     • Rollback tested and verified                          │
│     • Reduced fleet during rollout                          │
│     • Enhanced monitoring period post-update                │
│                                                              │
│  5. Approval Chain                                           │
│     • Internal safety review board sign-off                 │
│     • Airport operations approval                           │
│     • Regulatory notification (as required)                 │
│     • ATC coordination for testing period                   │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Regulatory Requirements for Software Changes

#### ISO 21448 (SOTIF) Requirements for Updates

SOTIF mandates ongoing field monitoring throughout operational life:

- Production vehicles must collect data on system performance, edge cases, and incidents
- This operational feedback informs continuous improvement through software updates
- The 2022 edition provides frameworks for field monitoring, data analysis, and change management
- Updates must maintain or improve safety — never introduce new hazards
- A systematic process must ensure that software changes do not invalidate the existing safety case

#### FAA-Specific Guidance for Airport AGVS

- **Testing locations**: Initial testing should occur in controlled environments — remote areas and landside locations preferred
- **Closed movement areas**: AGVS may be tested in closed movement areas if aircraft operations are suspended and risks are mitigated
- **Early coordination**: Mandatory early coordination with FAA (Part 139 airports: FAA Airport Certification Inspector; GA airports: FAA Airports District Office)
- **Stakeholder engagement**: Airport operators must engage local stakeholders for awareness of testing activities
- **Tenant access**: Avoid closing airport areas exclusively for AGVS testing if it limits tenant access

#### Change Management Process

For airside AV fleets, model updates should follow a structured change management process:

1. **Change request**: Document the proposed model change, rationale, and expected impact
2. **Risk assessment**: Evaluate safety risks specific to the airside operating domain
3. **Approval**: Obtain approval from safety review board, airport operations, and regulatory bodies as required
4. **Scheduling**: Schedule deployment during low-traffic periods (overnight, seasonal low periods)
5. **Staged rollout**: Deploy to canary cohort first, with enhanced monitoring
6. **Verification**: Confirm model performs correctly in the airside environment
7. **Documentation**: Update safety case documentation, operational procedures, and training materials
8. **Notification**: Inform ATC, airport operations, and relevant stakeholders of the update

### 12.4 Airside Operating Domain Challenges

Autonomous vehicles on the airside face unique challenges that affect model deployment:

| Challenge | Impact on Model Management |
|-----------|---------------------------|
| **Aircraft jet blast** | Models must detect and respond to jet blast zones; test datasets must include diverse engine types |
| **FOD (Foreign Object Debris)** | Small object detection is safety-critical; models need high-resolution perception |
| **Highly dynamic environment** | Aircraft push-back, tug movements, belt loaders create complex scenes |
| **Shared space with humans** | Ground handlers, marshals, fuel crews; pedestrian detection is critical |
| **Low visibility operations** | Fog, rain, night operations require robust perception; model must be validated across conditions |
| **GPS multipath/denial** | Large metal aircraft cause GPS reflections; models may need vision-based localization |
| **Standard markings and signage** | Taxiway markings differ from road markings; models must be trained on airside-specific datasets |
| **Geofencing enforcement** | Critical safety zones (runways, fuel farms) require absolute compliance |
| **Variable surface conditions** | Wet tarmac, ice, oil spills, painted markings; different traction and visual characteristics |
| **Communication with ATC** | Future systems may need V2X integration with airport surface management systems |

### 12.5 Recommended Deployment Strategy for Airside Fleet

Given the regulatory constraints and safety requirements:

1. **Maintenance window updates**: Deploy model updates only during scheduled maintenance windows at the depot, never during active operations
2. **Depot WiFi delivery**: Use high-bandwidth depot WiFi for model downloads; avoid cellular for large model files to control costs
3. **Dual-partition with verified rollback**: Ensure A/B partition system is tested and rollback verified before every deployment
4. **Extended shadow period**: Run new models in shadow mode for a minimum of 2 weeks in the airside environment before promotion
5. **Conservative canary stages**: Start with 1 vehicle (not a percentage), expand to 3, then 5, then 10, then full fleet — with minimum 1-week observation at each stage
6. **Enhanced monitoring**: Deploy additional human safety operators during the first 48 hours of each canary stage expansion
7. **Regulatory documentation**: Maintain complete audit trail of all model changes, test results, and deployment decisions
8. **Seasonal validation**: Re-validate perception models across seasonal conditions (summer heat haze, winter fog/ice, rain) before deploying to the full fleet
9. **Airport-specific calibration**: Account for airport-specific factors (marking styles, equipment types, layout) in model validation

---

## References and Sources

### OTA Architectures
- [Tesla FSD Technology Overview](https://evdances.com/blogs/blog/tesla-full-self-driving-fsd-technology-safety-regulation-and-what-comes-next)
- [Tesla OTA Updates in 2026](https://www.basenor.com/blogs/news/why-teslas-ota-updates-are-still-unmatched-in-2026)
- [Tesla FSD v14.2 Limited Rollout](https://www.teslaoracle.com/2025/11/21/tesla-begins-limited-rollout-of-the-fsd-v14-2-2025-38-9-5-update-adds-self-driving-stats-feature-official-release-notes/)
- [Tesla Core AI Architecture](https://applyingai.com/2025/07/decoding-teslas-core-ai-and-hardware-architecture-a-ceos-perspective/)
- [Waymo AI and ML](https://waymo.com/blog/2024/10/ai-and-ml-at-waymo/)
- [Waymo Fleet Manufacturing](https://waymo.com/blog/2025/05/scaling-our-fleet-through-us-manufacturing/)
- [comma.ai openpilot](https://github.com/commaai/openpilot)
- [openpilot 0.9.8 Release](https://blog.comma.ai/098release/)
- [openpilot 0.9.9 Release](https://blog.comma.ai/099release/)

### Dual-Partition and OTA Frameworks
- [Mender A/B Partitions](https://mender.io/blog/robust-ota-updates-with-partitions-for-linux-devices)
- [OTA Update Comparison — Mender, RAUC, SWUpdate](https://lembergsolutions.com/blog/ota-updates-choosing-among-memfault-mender-and-rauc)
- [RAUC — Safe and Secure OTA](https://rauc.io/)
- [Differential OTA Updates for Automotive](https://www.embedded.com/a-diff-approach-for-automotive-ota-updates/)
- [Mender Delta Updates](https://mender.io/blog/how-to-do-delta-differential-updates-with-mender)

### Model Versioning
- [MLflow Model Registry](https://mlflow.org/docs/latest/model-registry/)
- [ML Model Versioning Best Practices](https://lakefs.io/blog/model-versioning/)
- [Neptune.ai Version Control for ML](https://neptune.ai/blog/version-control-for-ml-models)
- [DVC Data Version Control](https://dvc.org/)

### Canary Deployment
- [Canary Model Deployment Guide](https://oneuptime.com/blog/post/2026-01-30-mlops-canary-model-deployment/view)
- [AWS SageMaker Canary Traffic Shifting](https://docs.aws.amazon.com/sagemaker/latest/dg/deployment-guardrails-blue-green-canary.html)
- [ML Model Deployment Strategies](https://towardsdatascience.com/ml-model-deployment-strategies-72044b3c1410/)
- [Feature Flags for Gradual Rollout](https://launchdarkly.com/blog/release-management-flags-best-practices/)

### A/B Testing
- [A/B Testing ML Models Best Practices](https://www.statsig.com/perspectives/ab-testing-ml-models-best-practices)
- [A/B Testing ML Models in Production](https://mlinproduction.com/ab-test-ml-models-deployment-series-08/)
- [AWS SageMaker Dynamic A/B Testing](https://aws.amazon.com/blogs/machine-learning/dynamic-a-b-testing-for-machine-learning-models-with-amazon-sagemaker-mlops-projects/)

### Rollback
- [Automated Rollback Mechanisms](https://apxml.com/courses/monitoring-managing-ml-models-production/chapter-4-automated-retraining-updates/automated-rollback)
- [Model Rollback Implementation](https://oneuptime.com/blog/post/2026-01-30-mlops-model-rollback/view)
- [Rollback in AI Systems](https://www.sandgarden.com/learn/rollback)

### Shadow Deployment
- [ML Shadow Mode Deployment](https://alexgude.com/blog/machine-learning-deployment-shadow-mode/)
- [Tesla FSD Shadow Mode](https://www.notateslaapp.com/news/3108/teslas-fsd-shadow-mode-what-it-is-and-how-it-improves-fsd)
- [Shadow vs Canary Deployment](https://www.qwak.com/post/shadow-deployment-vs-canary-release-of-machine-learning-models)
- [Shadow Testing in Autonomous Vehicles (Research)](https://www.researchgate.net/publication/385733470_Shadow_Testing_in_Autonomous_Vehicles_A_Novel_Approach_to_Validating_Full_Self-Driving_AI_Systems)
- [AWS SageMaker Shadow Testing](https://aws.amazon.com/blogs/machine-learning/minimize-the-production-impact-of-ml-model-updates-with-amazon-sagemaker-shadow-testing/)

### Monitoring and Drift Detection
- [Evidently AI — Data Drift](https://www.evidentlyai.com/ml-in-production/data-drift)
- [Model Drift Best Practices](https://encord.com/blog/model-drift-best-practices/)
- [ML Monitoring and Drift Detection Guide](https://www.bentoml.com/blog/a-guide-to-ml-monitoring-and-drift-detection)
- [Advanced ML Model Monitoring](https://enhancedmlops.com/advanced-ml-model-monitoring-drift-detection-explainability-and-automated-retraining/)

### Edge Compute
- [NVIDIA Jetson Orin](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/)
- [NVIDIA DRIVE AGX Platform](https://developer.nvidia.com/drive/agx)
- [NVIDIA DRIVE AGX Thor](https://www.nevsemi.com/blog/what-is-nvidia-drive-agx-thor-a-deep-dive-into-nvidia-s-automotive-ai-supercomputer)
- [AV AI Infrastructure — Edge vs Cloud](https://introl.com/blog/autonomous-vehicle-ai-infrastructure-edge-cloud)
- [TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm)
- [Model Compression and Quantization](https://github.com/NVIDIA/Model-Optimizer)

### Data Collection
- [AV Data Ingestion](https://dxc.com/us/en/insights/perspectives/blogs/ensuring-effective-autonomous-vehicle-data-ingestion)
- [AV Data Pipeline on AWS with NVIDIA](https://aws.amazon.com/blogs/industries/building-an-end-to-end-physical-ai-data-pipeline-for-autonomous-vehicle-3-0-on-aws-with-nvidia/)
- [Edge-Native Data Processing for AV Training](https://arxiv.org/html/2601.22919)
- [Selective Data Upload — Excelfore](https://aws.amazon.com/blogs/apn/excelfore-edge-ai-for-anomaly-detection-in-connected-vehicles-using-aws/)

### Model Validation
- [Microsoft ValOps for Autonomous Vehicles](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/architecture/autonomous-vehicle-validation-operations)
- [ISO 21448 SOTIF](https://www.perforce.com/blog/qac/sotif-iso-pas-21448-autonomous-driving)
- [AMLAS — Assurance of ML for Autonomous Systems](https://www.sciencedirect.com/science/article/abs/pii/S0951832025005125)
- [CI/CD for Automotive Software](https://circleci.com/blog/ci-cd-for-automotive-software-development/)

### Fleet Management Platforms
- [NVIDIA Fleet Command](https://www.nvidia.com/en-us/data-center/products/fleet-command/)
- [AWS IoT Greengrass for Connected Vehicles](https://aws.amazon.com/blogs/aws/aws-iot-greengrass-and-machine-learning-for-connected-vehicles-at-ces/)
- [AWS IoT Greengrass Disconnected Environments](https://aws.amazon.com/blogs/publicsector/deploying-mission-critical-edge-applications-with-aws-iot-greengrass-in-disconnected-environments/)
- [NVIDIA DRIVE Platform](https://www.nvidia.com/en-us/self-driving-cars/drive-platform/)
- [Containerized ML on Kubernetes for Autonomous Devices](https://www.harpoon.io/post/machine-learning-kubernetes-in-autonomous-devices)

### Airside-Specific
- [FAA Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [5G Aviation Testbed at Changi Airport](https://www.caas.gov.sg/who-we-are/newsroom/Detail/5g-aviation-testbed-launched-at-changi-airport-airside)
- [Connected Aviation — Airport Automation](https://tecknexus.com/connected-aviation-how-autonomous-systems-are-automating-airports/)
- [Airport Autonomous Systems and 5G](https://www.p1sec.com/blog/5g-in-airports-building-smart-connected-aviation-hubs-with-private-mobile-networks)
- [IATA Ground Support Equipment](https://www.iata.org/en/programs/ops-infra/ground-operations/ground-support-equipment/)
- [ICAO Airside Driving Training](https://igat.icao.int/ated/TrainingCatalogue/Course/49)
- [Airside Vehicle Operations — SKYbrary](https://skybrary.aero/articles/airside-vehicle-operations)
