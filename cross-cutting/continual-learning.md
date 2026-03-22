# Continual Learning, Lifelong Learning, and Online Adaptation for Autonomous Vehicle Fleets

**Date:** 2026-03-22
**Scope:** Comprehensive survey of continual/lifelong learning techniques applicable to autonomous vehicle fleets, with emphasis on multi-site deployment (e.g., airport airside operations), fleet-scale data pipelines, and safety-critical adaptation.

---

## Table of Contents

1. [Catastrophic Forgetting and Mitigations](#1-catastrophic-forgetting-and-mitigations)
2. [Online Adaptation from Fleet Data](#2-online-adaptation-from-fleet-data)
3. [Active Learning for Driving](#3-active-learning-for-driving)
4. [Data Flywheel Architecture](#4-data-flywheel-architecture)
5. [Distribution Shift Detection](#5-distribution-shift-detection)
6. [Multi-Airport / Multi-Domain Adaptation](#6-multi-airport--multi-domain-adaptation)
7. [Curriculum Learning](#7-curriculum-learning)
8. [Model Versioning and Rollback for Fleets](#8-model-versioning-and-rollback-for-fleets)
9. [Federated Learning for Privacy-Preserving Fleet Learning](#9-federated-learning-for-privacy-preserving-fleet-learning)
10. [World Model Online Adaptation](#10-world-model-online-adaptation)
11. [Synthesis: Architecture for Continual-Learning AV Fleets](#11-synthesis-architecture-for-continual-learning-av-fleets)
12. [Key Takeaways for Airport Airside Deployment](#12-key-takeaways-for-airport-airside-deployment)
13. [References](#13-references)

---

## 1. Catastrophic Forgetting and Mitigations

### 1.1 The Problem

Catastrophic forgetting occurs when a neural network trained sequentially on new tasks or data distributions loses previously learned knowledge. This is the central obstacle to continual learning. For an AV fleet, this manifests when a perception model retrained on data from a new airport (or new weather conditions, new vehicle types on the ramp) degrades performance on previously mastered scenarios.

The problem is rooted in the stability-plasticity dilemma: a network must be plastic enough to learn new information but stable enough to retain old knowledge. Standard SGD-based training offers no mechanism to balance these competing demands.

### 1.2 Regularization-Based Methods

#### Elastic Weight Consolidation (EWC)

EWC adds a quadratic penalty to the loss function that discourages large changes to parameters important for previous tasks:

```
L_EWC(theta) = L_new(theta) + (lambda/2) * sum_i F_i * (theta_i - theta_i*)^2
```

where `F_i` is the diagonal of the Fisher Information Matrix (FIM) computed on the previous task's data, and `theta_i*` are the optimal parameters for the previous task. Parameters with high Fisher information (i.e., those carrying significant information about past tasks) receive strong regularization, while less important parameters are free to adapt.

**Strengths:** Simple to implement, low memory overhead (stores one set of previous parameters + Fisher diagonal per task).

**Limitations:** Recent research (2025) has identified that when the network achieves high confidence in accurate predictions, EWC produces a low-magnitude FIM due to vanishing gradients, causing it to struggle to retain crucial parameter information. This leads to poor continual learning performance in practice, especially for well-trained models. Additionally, the diagonal FIM approximation loses cross-parameter interaction information.

**Application to AV:** Researchers have applied EWC to car-following models in autonomous driving, using Waymo and Lyft datasets divided into speed-stratified tasks. CL-EWC achieved 0% collision rates across all traffic conditions (vs. 0.19-5.51% for baselines) and reduced spacing MSE from 136.77 to 5.65 on the final task. This demonstrates EWC's viability for safety-critical driving behaviors.

#### Memory Aware Synapses (MAS)

MAS dynamically adjusts weight importance using gradient magnitudes rather than Fisher information:

```
Omega_i = (1/N) * sum_k ||g_i(x_k)||
L_MAS(theta) = L_new(theta) + lambda * sum_i Omega_i * (theta_i - theta_i*)^2
```

MAS showed comparable safety performance to EWC (0% collisions) with slightly better adaptability within similar scenarios, exhibiting "more dynamic behavior" while maintaining safety margins.

#### Synaptic Intelligence (SI)

SI computes an online importance measure for each parameter by accumulating the contribution of each weight to the change in loss during training. Unlike EWC, which computes importance post-hoc, SI tracks importance during training, making it more computationally efficient for online/streaming settings.

### 1.3 Architecture-Based Methods

#### Progressive Neural Networks

Progressive networks instantiate a new neural network "column" for each task, with lateral connections to features from previously learned columns. Previous columns are frozen, making catastrophic forgetting impossible by construction.

**Architecture:** Each new task adds a column with lateral adapters (`alpha_k`) connecting to hidden representations of all prior columns. This enables forward transfer while completely preventing backward interference.

**Limitations:** Parameter count grows linearly with the number of tasks. Analysis reveals that only a fraction of new capacity is actually utilized, suggesting significant redundancy. For a fleet deploying across many airports, the growing model size becomes a practical concern for edge deployment on vehicle hardware.

#### PackNet

PackNet addresses progressive networks' scalability issues through network pruning and parameter reuse:

1. Train the full unallocated portion of the network on the new task (with prior-task subnets frozen)
2. Prune and reserve the top-k% weights by absolute value for the new task
3. The pruned (freed) capacity becomes available for future tasks

PackNet can be seen as "packing" multiple tasks into a single network by giving each task a dedicated subnet. The approach maintains strong performance on earlier tasks (their weights are frozen) while making efficient use of network capacity.

**Relevance to AV:** PackNet is attractive for edge deployment where model size is constrained. A single network can serve multiple operational domains (airports) with dedicated subnets, avoiding the need to ship multiple models to each vehicle.

#### AdaHAT (2024)

Adaptive Hard Attention to the Task extends architecture-based approaches by allowing controlled updates to previously trained subnets. The intensity of updates is determined by heuristic indicators (parameter importance, current capacity usage), enabling the network to manage its capacity adaptively rather than rigidly partitioning it.

### 1.4 Replay-Based Methods

#### Experience Replay (ER)

ER maintains a memory buffer of representative samples from previous tasks and interleaves them with new-task data during training. Reservoir sampling provides a principled way to maintain a fixed-size buffer from a data stream of unknown length.

Replay-based methods dominate the continual learning literature, appearing in 62 of 81 approaches surveyed in a 2025 systematic review of online continual learning. Recent work (2025) demonstrates that experience replay not only prevents forgetting but also addresses the loss of plasticity problem in continual learning -- the tendency of neural networks to lose their ability to learn over time.

#### Generative Replay

Instead of storing raw samples, generative replay trains a generative model (GAN, VAE, or diffusion model) to synthesize pseudo-samples from previous distributions. This reduces memory requirements and avoids data retention concerns.

Brain-inspired generative replay, drawing on neuroscience research about memory consolidation during sleep, has shown comparable effectiveness to veridical (exact) replay while being more memory-efficient. Recent work on Brain Generative Replay uses EEG signal representations to generate task-relevant samples.

#### Adaptive Memory Replay (CVPR 2024 Workshop)

This approach dynamically adjusts the replay strategy based on task characteristics and model state, using entropy-based selection to avoid static buffers and reduce overfitting while maintaining diversity.

**Practical considerations for AV fleets:**
- Raw replay requires storing driving clips -- privacy and storage concerns at fleet scale
- Generative replay avoids raw data retention but adds model complexity
- Coreset selection (choosing maximally informative exemplars) reduces buffer size while maintaining representativeness
- For airport airside, replay buffers could store domain-specific edge cases (near-misses, unusual vehicle configurations, weather events)

### 1.5 Knowledge Distillation for Continual Learning

Knowledge distillation transfers information from a previous model ("teacher") to the updated model ("student") by adding a loss term that encourages the student's outputs to match the teacher's on new data. This is a "data-focused regularization" approach that does not require storing raw data.

In autonomous driving, distillation serves a dual role:
1. **Continual learning:** Preserving old-task knowledge in the updated model
2. **Model compression:** Cloud-trained large models (e.g., 32B parameters) are distilled into smaller models (e.g., 4B parameters) suitable for vehicle-edge deployment

### 1.6 Summary Comparison

| Method | Forgetting Prevention | Forward Transfer | Memory Cost | Compute Cost | Scalability |
|--------|----------------------|-----------------|-------------|-------------|-------------|
| EWC | Moderate | None | O(params) per task | Low | Good |
| MAS | Moderate | None | O(params) per task | Low | Good |
| Progressive Nets | Perfect | Strong (lateral) | O(params) per task | Growing | Poor |
| PackNet | Strong | Moderate | Subnet masks | Low | Moderate |
| Experience Replay | Strong | Moderate | O(buffer size) | Moderate | Good |
| Generative Replay | Moderate | Moderate | Generator model | High | Good |
| Knowledge Distillation | Moderate | Good | Teacher model | Moderate | Good |

---

## 2. Online Adaptation from Fleet Data

### 2.1 The Challenge

Autonomous vehicle fleets operate in environments that change continuously: new construction, seasonal weather patterns, evolving traffic rules, fleet composition changes, surface degradation. Static models trained on historical data inevitably encounter distribution shift. Online adaptation enables models to improve continuously from the data stream generated by deployed vehicles.

### 2.2 Approaches to Fleet-Scale Online Learning

#### Incremental/Continual Training

Rather than periodic full retraining, models are incrementally updated on new data batches collected from the fleet. This requires the catastrophic forgetting mitigations described in Section 1. The practical pipeline is:

1. Fleet vehicles collect data during operation (with trigger-based selection -- see Section 4)
2. Selected data is uploaded to centralized training infrastructure
3. Models are incrementally fine-tuned using EWC/replay/distillation
4. Updated models are validated (simulation + shadow deployment)
5. Models are deployed via OTA updates

#### Online Parameter Adaptation

Some parameters can be adapted on-device in real-time without centralized retraining. comma.ai's openpilot demonstrates this with `lagd`, a daemon that learns each car's lateral time delay online -- a parameter that "varies across car models and even between individual cars of the same model." This per-vehicle calibration happens at the edge, personalizing the driving policy without fleet-wide retraining.

#### Few-Shot Domain Adaptation

When deploying to a genuinely new environment (new airport), few-shot adaptation techniques enable rapid specialization from limited local data. Low-rank adaptation (LoRA) applied to pretrained models allows efficient domain-specific tuning with minimal new parameters.

### 2.3 Semi-Supervised Online Continual Learning

A 2024 study on semi-supervised online continual learning for 3D object detection in mobile robotics demonstrated that models can learn new distributions from streaming unlabeled LiDAR point clouds, performing 3D object detection as each scan arrives. This is directly applicable to AV fleets where labeling every frame is infeasible.

### 2.4 Practical Constraints

- **Bandwidth:** Uploading raw driving data from hundreds of vehicles is expensive; trigger-based collection and on-device preprocessing are essential
- **Staleness:** Models shipped to vehicles lag behind the current data distribution; the update cadence must balance freshness against validation rigor
- **Heterogeneity:** Different vehicles in the fleet may encounter different distributions (different airports, different shifts), requiring the aggregation strategies discussed in Section 9

---

## 3. Active Learning for Driving

### 3.1 Motivation

Autonomous driving datasets exhibit extreme long-tail distributions: the vast majority of collected frames show mundane driving (straight roads, normal conditions), while safety-critical scenarios are rare. Active learning selects the most informative samples for labeling, dramatically reducing annotation cost while improving model performance on tail events.

### 3.2 ActiveAD: Planning-Oriented Active Learning (2024)

ActiveAD is a framework specifically designed for end-to-end autonomous driving that addresses both the cold-start problem and ongoing sample selection:

**Cold-Start Phase (Diversity-Driven):**
- Uses diversity metrics to select an initial batch that covers the scenario space broadly
- Addresses the bootstrap problem where no model exists yet to compute uncertainty

**Iterative Phase (Uncertainty-Driven):**
- Computes uncertainty metrics specific to route planning (not just perception)
- Selects samples where the model is least confident about planning decisions
- Focuses on safety-critical scenarios that are underrepresented

**Key Result:** ActiveAD achieves comparable performance to state-of-the-art end-to-end AD methods using only 30% of the nuScenes dataset, demonstrating 70% reduction in labeling cost.

### 3.3 Uncertainty-Based Selection

Several uncertainty estimation approaches are used for active sample selection in driving:

- **Softmax entropy:** High entropy in perception model outputs indicates uncertain predictions
- **Monte Carlo dropout:** Running multiple forward passes with dropout to estimate predictive variance
- **Ensemble disagreement:** Training multiple models and flagging samples where predictions diverge
- **Epistemic vs. aleatoric separation:** Distinguishing model uncertainty (reducible by more data) from inherent noise (irreducible) -- critical because high aleatoric uncertainty does not indicate a useful training sample

**Limitation:** Predictive entropy does not distinguish between epistemic and aleatoric uncertainty, making high entropy ambiguous -- it may indicate either a genuinely novel scenario or simply a difficult (but well-represented) one.

### 3.4 Diversity-Based Selection

Uncertainty alone leads to redundant selections (many similar hard cases). Diversity criteria ensure broad coverage:

- **Coreset methods:** Select samples that are maximally different from existing labeled data in feature space
- **Scenario clustering:** Group driving situations by semantic type and ensure coverage across clusters
- **Geographic/temporal stratification:** Ensure representation across locations, times of day, weather conditions

### 3.5 Tesla's Trigger-Based Active Learning

Tesla implements a production-scale active learning system through trigger classifiers:

- Multiple lightweight classifiers run on top of the shared perception backbone
- Each classifier targets a specific scenario type (shopping carts, tunnel exits, unusual road markings)
- Context-aware activation: a tunnel-exit detector activates only when map data indicates a tunnel approach
- When confidence exceeds a threshold, flagged data is uploaded for human review and labeling
- Hundreds of triggers run simultaneously on each vehicle with minimal compute overhead

This is effectively active learning at fleet scale, where the "query strategy" is a set of learned classifiers that identify underrepresented or failure-prone scenarios in the wild.

### 3.6 Implications for Airport Airside

Airport airside environments have their own long-tail distribution: unusual aircraft types, ground support equipment configurations, construction zones, wildlife incursions, adverse weather. An active learning pipeline should:

1. Deploy trigger classifiers for known rare events (e.g., wide-body pushback conflicts, jet blast scenarios)
2. Use uncertainty-based selection for genuinely novel situations
3. Maintain diversity across airports, times of day, and operational conditions
4. Prioritize safety-critical scenarios (near-misses, hard braking events, manual takeovers)

---

## 4. Data Flywheel Architecture

### 4.1 Concept

The data flywheel is a self-reinforcing cycle where deployed vehicles generate data that improves models, which improves driving, which generates more diverse data (vehicles can handle more scenarios), attracting more users/deployments, generating yet more data. The key architectural components are: collection, selection, labeling, training, validation, and deployment.

### 4.2 Tesla's Data Engine

Tesla operates the most widely documented data flywheel in autonomous driving:

**Collection Infrastructure:**
- 5M+ vehicles act as sensor platforms, collecting video and telemetry
- Shadow mode: the FSD stack runs in the background comparing its intended actions against human driver actions, flagging disagreements
- Approximately 1.5 million miles of driving data captured daily under shadow mode
- 4.25 billion annual FSD Supervised miles (2025), up from 6 million in 2021

**Trigger-Based Selection:**
- Lightweight trigger classifiers identify edge cases and upload flagged clips
- GPS-correlated labeling: tag an intersection once, auto-label thousands of future drives through the same location across all conditions
- Long-tail scenario mining: search the fleet's database for scenarios similar to detected failures

**Auto-Labeling Pipeline:**
- AI-driven auto-labeling for the majority of training data
- 3D auto-labeling using multi-trip aggregated sensor data
- Human review for edge cases and quality assurance
- Datasets on the order of 1.5 petabytes from approximately 1 million clips

**Training Infrastructure:**
- Cortex supercomputer at Giga Texas (tens of thousands of NVIDIA H100 GPUs)
- Cortex 2 build-out underway (2026)
- R&D spend >$5B (2024), CapEx >$11B expected (2025)

**Deployment:**
- OTA updates push improved models to the entire fleet
- 1.1 million active FSD users globally (end of 2025)
- FSD v12+ uses end-to-end neural networks replacing 300,000 lines of rule-based code

### 4.3 Waymo's Approach

Waymo operates a different flywheel with a smaller but more controlled fleet:

**Collection:** 1,500+ vehicles across 10 US metro areas, 14 million trips completed in 2025 (3x vs. 2024), nearly 200 million fully autonomous miles logged to date.

**Adaptation Process:** For each new city, Waymo:
1. Compares driving performance against a proven baseline
2. Identifies unique local characteristics
3. Refines the Waymo Driver's AI for local nuances
4. Validates through real-world driving + advanced simulation
5. Deploys through regular software releases

**Key Insight:** Waymo reports that local nuances "are becoming fewer with every city," suggesting their models are converging toward generalizable driving competence across domains.

**International Adaptation:** For London, Waymo employs manual driving for months to "learn the nuances, learn about the zebra crossings" before deploying autonomous operation -- demonstrating that domain adaptation still requires significant site-specific data collection for substantially different traffic environments.

### 4.4 comma.ai's Open Approach

comma.ai operates a data flywheel with openpilot:

**Fleet Scale:** 325+ supported car models, 20,000+ users, 100M+ miles driven.

**Data Collection:**
- By default, openpilot uploads driving data to comma's servers
- "Firehose Mode" (v0.9.8, Feb 2025) maximizes training data upload rate
- commaCarSegments v2: 3,000 hours of CAN data from the fleet

**Training Architecture (v0.10):**
- Entirely new end-to-end training architecture
- World model ("Tomb Raider") used for simulation-based training
- Lossy image compression during training enables ML simulator use
- Distributed, asynchronous rollout data collection (similar to IMPALA/GORILA)

**Online Adaptation:**
- `lagd` daemon learns per-vehicle lateral time delay online
- Demonstrates that some adaptation can happen at the edge, per-vehicle

### 4.5 Closed-Loop Pipeline Architecture

The canonical data-centric closed-loop pipeline (based on NVIDIA MagLev and Tesla's architectures):

```
[Fleet Vehicles] --> [Trigger-Based Collection] --> [Data Lake]
        ^                                              |
        |                                    [Data Selection/Mining]
        |                                              |
  [OTA Update]                                  [Auto-Labeling]
        ^                                              |
        |                                     [Model Training]
  [Safety Validation]                                  |
        ^                                    [Simulation Testing]
        |                                              |
        +----------------------------------------------+
```

**Critical bottleneck:** Addressing the long-tail distribution requires approximately 1,000 billion driving miles of data. Strategic data selection (active learning) is essential because raw collection at this scale is infeasible.

---

## 5. Distribution Shift Detection

### 5.1 Types of Distribution Shift

| Shift Type | Description | AV Example |
|-----------|-------------|------------|
| Covariate shift | Input distribution changes, P(Y|X) stays same | New airport has different lighting/surfaces |
| Prior probability shift | Class frequencies change | Airport B has more wide-body aircraft than Airport A |
| Concept drift | P(Y|X) changes over time | New taxiway rules change what constitutes "correct" behavior |
| Dataset shift | Combination of the above | Seasonal changes affect everything simultaneously |

### 5.2 Out-of-Distribution (OOD) Detection

OOD detection identifies inputs that fall outside the training distribution, triggering safety interventions before the model makes unreliable predictions.

**Primary Methods:**

1. **Outlier Exposure (OE):** Train with proxy OOD data (e.g., from COCO/ADE20K) pasted into driving scenes. Methods like RbA and Maximized Entropy use this approach. Limitation: reduces in-distribution performance by 1-2.5% mIoU and risks overfitting to seen OOD examples.

2. **Uncertainty Estimation:** Use prediction confidence metrics (softmax entropy, maximum logit scores) to flag uncertain regions. Critical limitation: does not distinguish between epistemic uncertainty (model does not know) and aleatoric uncertainty (inherently ambiguous).

3. **Generative/Reconstruction-Based:** Compare input images against model reconstructions; large reconstruction errors indicate OOD. Limitation: high inference time makes real-time deployment challenging.

4. **Mask2Former-Based (2024-2025):** Five of the top seven OOD segmentation benchmark performers leverage Mask2Former's mask-level architecture (RbA, UNO, EAM), but these are computationally heavy (~200M parameters).

**Benchmarks:**
- SegmentMeIfYouCan Obstacle Track (SMIYC-OT): 327 test images, 388 OOD instances, 31 obstacle categories
- LostAndFound-NoKnown (L&F): 1,043 test images, 1,709 OOD instances

**Evaluation gap:** Current benchmarks use threshold-free metrics (AUPRC) that do not directly translate to deployment, where threshold selection requires calibration data typically unavailable in production.

### 5.3 Concept Drift Detection

Concept drift -- where the relationship between inputs and correct outputs changes over time -- is particularly relevant for AV fleets operating across evolving environments.

**Detection Approaches:**

- **Statistical tests:** Monitor performance metrics over sliding windows; detect statistically significant degradation (e.g., Page-Hinkley test, ADWIN)
- **Deep learning-based:** Autoencoder reconstruction error as a proxy for drift; novelty-aware concept drift detection combines novelty detection with drift detection to distinguish genuinely new concepts from gradual distribution changes
- **Image stream drift detection:** An underexplored area due to the high-dimensional, unstructured nature of visual data; most drift detection methods were designed for tabular/time-series data

**Practical deployment monitoring:**
- Track prediction confidence distributions over time; systematic drops indicate drift
- Monitor disagreement between redundant perception channels (camera vs. LiDAR)
- Compare real-world behavior against simulation predictions
- Spatio-temporal OOD detection considers both spatial anomalies within frames and temporal anomalies across sequences

### 5.4 Response to Detected Shift

When distribution shift or OOD inputs are detected, the system should:

1. **Immediate:** Flag for increased caution / reduced speed / human takeover
2. **Short-term:** Upload flagged scenarios for analysis
3. **Medium-term:** Trigger targeted data collection and model retraining
4. **Long-term:** Update the training distribution to include the new domain

---

## 6. Multi-Airport / Multi-Domain Adaptation

### 6.1 The Problem

Train a perception/planning stack at Airport A, deploy it at Airport B without forgetting how to operate at Airport A. This is domain-incremental learning: the task remains the same (navigate safely on the airside) but the domain changes (different airport layouts, markings, vehicle types, traffic patterns, weather).

### 6.2 Domain-Incremental Learning (DIL)

DIL is a specific continual learning setting where:
- The task structure remains constant (same classes, same objectives)
- The input distribution changes (new visual appearance, new spatial configurations)
- The model must perform well on all encountered domains simultaneously

Research on domain-incremental object detection for autonomous driving has demonstrated approaches that:
- Avoid catastrophic forgetting on previous domains
- Mitigate performance degradation in source domains
- Improve detection accuracy on new target domains

### 6.3 Brain-Inspired Domain-Incremental Adaptive Detection

A notable approach uses a two-stage framework:

**Recall Stage:** When encountering a new domain, the model recalls knowledge from the most similar previously learned domain (determined by a "domain tree" that measures inter-domain divergence).

**Adapt Stage:** The model adapts to the new domain using:
- Domain-Mix: combines pseudo-labels from previous domains with ground-truth source labels
- Patch-based adversarial learning for fine-grained spatial alignment
- Multi-level alignment (pixel-level and instance-level) to maintain discriminability

This approach successfully transferred knowledge across virtual-to-real and across weather conditions while maintaining performance on previously learned domains.

### 6.4 Unsupervised Domain Adaptation (UDA)

When labeled data is unavailable at the target domain (common when deploying to a new airport before operations begin), UDA techniques enable adaptation using only unlabeled data:

- **Feature alignment:** Align the feature distributions of source and target domains using adversarial training or moment matching
- **Self-training:** Generate pseudo-labels on target data using the source-trained model, then retrain
- **Style transfer:** Transform source images to look like target domain images, enabling training with source labels

**Research gap:** Only 19% of 2020-2024 publications focus on multi-domain adaptation for weather-robust perception, and only 8% integrate heterogeneous sensors, indicating significant room for advancement.

### 6.5 Multi-Airport Deployment Strategy

A practical strategy combining these techniques:

1. **Base Training:** Train on Airport A with full supervision (labeled data)
2. **Pre-Deployment Survey:** Collect unlabeled data at Airport B (manual/remote driving)
3. **Domain Gap Assessment:** Measure distribution divergence between A and B
4. **Adaptation:**
   - If gap is small: fine-tune with EWC/MAS regularization using limited B labels
   - If gap is moderate: apply UDA with self-training on unlabeled B data
   - If gap is large: collect labeled data at B; use replay buffer to prevent A forgetting
5. **Validation:** Test on held-out data from both A and B before deployment
6. **Monitoring:** Deploy drift detection to catch remaining distribution gaps
7. **Iteration:** Feed operational data from B back into the training pipeline

**Waymo's empirical finding** -- that local nuances decrease with each new city -- suggests that after sufficient domain diversity in training, the marginal adaptation cost for each new site decreases. This is encouraging for multi-airport deployment.

---

## 7. Curriculum Learning

### 7.1 Concept

Curriculum learning organizes training data from simple to complex, mimicking how humans learn. For autonomous driving, this means starting with easy scenarios (straight driving, clear weather, no traffic) and progressively introducing harder ones (dense traffic, adverse weather, complex intersections).

### 7.2 Benefits for AV Training

- **Faster convergence:** Models learn basic skills quickly, then build on them for complex scenarios
- **Better generalization:** Progressive exposure to harder cases produces more robust models than random sampling
- **Safety alignment:** Early mastery of basic safe driving behaviors provides a foundation for handling edge cases

### 7.3 CuRLA: Curriculum Learning with Deep RL (2025)

CuRLA combines deep reinforcement learning with curriculum learning for autonomous driving in the CARLA simulator:

- Uses Proximal Policy Optimization (PPO) with a Variational Autoencoder (VAE) for state representation
- Five-phase curriculum progressively transforms the environment from simple to complex
- Each phase introduces new challenges (traffic, weather, road complexity)

### 7.4 CurricuVLM: VLM-Guided Curriculum Learning (2025)

CurricuVLM represents a significant advance by using Vision-Language Models (GPT-4o) as "curriculum designers":

**Safety-Critical Event Analysis:**
1. When unsafe situations occur, GPT-4o generates narrative descriptions capturing violation type, object positioning, AV response patterns, and contextual factors
2. Multiple event descriptions are analyzed collectively to identify recurring behavioral patterns

**Personalized Curriculum Generation:**
- Dynamically creates training scenarios targeting identified weaknesses
- Balances three objectives: realistic background vehicle trajectories, agent response distributions matching recent history, and alignment with VLM-identified weaknesses
- The result is a personalized curriculum that adapts to each training agent's specific deficiencies

**Adaptive Scheduling:**
- Safety-critical scenario probability increases progressively with training progress
- Early training emphasizes fundamentals; edge cases are gradually introduced
- Bounded triggering prevents overwhelming the agent with difficult scenarios

### 7.5 Curriculum for Multi-Domain Deployment

Curriculum learning has natural synergy with multi-airport deployment:

1. **Phase 1:** Train on the most representative/common airport environment
2. **Phase 2:** Introduce variations (different lighting, weather within the same airport)
3. **Phase 3:** Add a second airport with moderate domain gap
4. **Phase 4:** Introduce airports with progressively larger domain gaps
5. **Phase 5:** Add rare/extreme scenarios across all domains

This structured exposure builds robust representations before challenging them with harder domains, reducing catastrophic forgetting compared to random domain ordering.

---

## 8. Model Versioning and Rollback for Fleets

### 8.1 Criticality

For safety-critical AV systems, the ability to rapidly detect model degradation and revert to a known-good version is essential. A new model release that performs well in simulation may exhibit unexpected failures in production due to untested edge cases or subtle distribution mismatches.

### 8.2 Versioning Infrastructure

**Model Registry:** Track all model versions with:
- Model weights and architecture definition
- Training data snapshot (or hash/reference)
- Training hyperparameters and procedure
- Validation metrics (simulation + real-world)
- Deployment status (staging, canary, production, retired)
- Associated code version and dependencies

**Tools:** MLflow, DVC (Data Version Control), Weights & Biases, and cloud-specific registries (Vertex AI Model Registry, Azure ML) provide model versioning capabilities. For safety-critical applications, the registry must also capture the training data provenance and validation evidence.

### 8.3 Deployment Strategies

#### Blue-Green Deployment
- Maintain two identical production environments (Blue = current, Green = new)
- Route traffic to Green gradually
- If Green shows issues, instantly revert to Blue
- Near-zero downtime rollback

#### Canary Deployment
- Deploy new model to 1-5% of fleet first
- Monitor safety metrics (intervention rate, hard braking, trajectory deviations)
- Gradually increase to 10%, 50%, 100% if metrics are satisfactory
- For AV fleets: "canary" vehicles could be specific vehicles in specific (lower-risk) operational areas

#### Shadow Deployment
- Run new model in parallel with production model
- Compare outputs without affecting vehicle behavior
- Tesla's shadow mode is essentially fleet-scale shadow deployment
- Enables risk-free evaluation on real-world data

### 8.4 Rollback Mechanisms

Three components must function together:

1. **Continuous Monitoring:** Detect performance degradation in real-time
   - Perception accuracy metrics (compared against high-confidence ensemble)
   - Planning quality metrics (smoothness, safety margins, route efficiency)
   - Intervention/disengagement rate
   - Latency and compute utilization

2. **State Preservation:** Maintain previous model versions in deployable state
   - Pre-compiled models for target hardware
   - Validated and certified for deployment
   - Associated calibration parameters

3. **Rapid Restoration:** Switch back to previous version with minimal disruption
   - For AV fleets: OTA rollback mechanism
   - Immediate fallback to rule-based safe behavior during transition
   - "Behavioral rollback": revert from AI-driven behavior to simpler rule-based control when anomalies surface

### 8.5 Safety-Critical Considerations

| Trigger Type | Response Time | Application |
|-------------|---------------|-------------|
| Safety violation detected | Milliseconds | Immediate behavioral rollback to rule-based control |
| Performance degradation | Minutes-hours | Model rollback via OTA for affected subset |
| Systematic bias discovered | Hours-days | Fleet-wide model rollback and investigation |
| Regulatory directive | Hours-days | Controlled fleet-wide rollback with documentation |

**Regulatory context:** EU mandates ADAS features since July 2024 with driver attention monitoring required starting 2026. OTA update frameworks must satisfy cybersecurity, performance validation, and traceability requirements. UNECE/GRVA's NATM mandates standardized scenario execution in simulation, proving grounds, and on-road testing, plus auditability and in-service performance monitoring.

---

## 9. Federated Learning for Privacy-Preserving Fleet Learning

### 9.1 Motivation

AV fleets generate enormous volumes of driving data that may contain:
- Personally identifiable information (passengers, pedestrians, license plates)
- Sensitive location data (airport security areas, restricted zones)
- Proprietary operational data (customer airline ground operations)

Federated learning enables fleet-wide model improvement without centralizing raw data.

### 9.2 Federated Learning Fundamentals

**FedAvg (Federated Averaging):**
1. Central server distributes global model to all vehicles
2. Each vehicle trains locally on its own data for several epochs
3. Vehicles send model updates (gradients or weight deltas) to server
4. Server aggregates updates via weighted averaging
5. Updated global model is distributed back

**Limitation:** FedAvg struggles with highly non-IID (non-independent and identically distributed) data -- which is the norm for AV fleets where different vehicles operate in different environments.

### 9.3 Handling Non-IID Data in AV Fleets

Different vehicles at different airports see fundamentally different data distributions. Standard aggregation strategies fail because local optima diverge.

**FedProx:** Adds a proximal term to each client's local objective, penalizing large deviations from the global model. Converges better than FedAvg under data heterogeneity and is recommended for AV applications.

**FedNova:** Normalizes and scales local updates based on local iteration count before aggregation, addressing heterogeneity in both data and computation.

**FedLGA (2024):** Uses Taylor expansion to approximate full local gradient updates for resource-constrained clients. Improved accuracy from 60.91% (FedAvg) to 64.44% on non-IID CIFAR-10.

**Personalized FL:** Rather than training one global model, personalized FL produces client-specific models that share some parameters globally while maintaining local specialization. This is attractive for multi-airport deployment where each site needs some local adaptation.

### 9.4 Privacy-Preserving Mechanisms

**Differential Privacy (DP):**
- Add calibrated noise to model updates before transmission
- Provides mathematical guarantee: no single training example can significantly influence the model
- Correlated differential privacy (2024) reduces noise while maintaining privacy guarantees by exploiting correlations between model parameters
- Localized differential privacy (LDP) adds noise on-device before any transmission

**Secure Aggregation:**
- Cryptographic protocols that allow the server to compute aggregate updates without seeing individual contributions
- Lightweight homomorphic encryption (LHE) enables secure computation on encrypted model updates
- Byzantine-robust aggregation (Krum rule) selects updates most similar to the majority, filtering poisoned or anomalous gradients

**Communication Efficiency:**
- Gradient compression/sparsification: send only significant updates
- LoRA-based FL: only transmit low-rank adapter updates rather than full model weights
- Reduces bandwidth requirements critical for vehicles with limited connectivity

### 9.5 FLAD: Federated Learning for LLM-based AD (2025)

FLAD represents the frontier of federated learning for autonomous driving:

**Three-Layer Architecture:**
- Vehicle layer: local model training on onboard sensor data
- Edge layer: regional aggregation and intermediate model storage
- Cloud layer: global aggregation and model distribution

**Key Innovations:**
1. Communication scheduling mechanism optimizing training efficiency
2. Knowledge distillation for personalizing LLMs to heterogeneous edge data
3. Intelligent parallelized collaborative training leveraging otherwise idle edge devices
4. Prototyped on NVIDIA Jetson hardware, demonstrating practical feasibility

### 9.6 Federated Continual Learning

The intersection of federated learning and continual learning addresses the scenario where fleet vehicles encounter new tasks/domains over time while collaborating without sharing data:

- Each vehicle performs continual learning locally (with forgetting mitigation)
- Federated aggregation combines progress across vehicles
- Challenge: different vehicles may be at different stages of learning new domains
- Solution: federated replay where vehicles share synthetic (generative replay) data rather than raw data

### 9.7 Relevance to Airport Operations

Airport airside data is particularly sensitive:
- Security-restricted areas visible in camera feeds
- Airline operational patterns that may be commercially sensitive
- Worker and passenger privacy concerns

Federated learning enables:
- Each airport to maintain data sovereignty
- Cross-airport model improvement without data sharing
- Compliance with data residency regulations (different countries)
- Per-airport model personalization with global knowledge sharing

---

## 10. World Model Online Adaptation

### 10.1 World Models for Autonomous Driving

A world model is a generative spatio-temporal neural system that compresses multi-sensor observations into a compact latent state and rolls it forward under hypothetical actions, enabling the vehicle to "rehearse futures before they occur." World models serve multiple roles:

- **Planning:** Evaluate candidate trajectories by simulating their outcomes
- **Simulation:** Generate training data for rare scenarios
- **Prediction:** Forecast other agents' behavior
- **Safety:** Detect when the world deviates from expectations (OOD detection)

### 10.2 Key Architectures

**Transformer-Based:**
- GAIA-1: Treats video, text, and control as one token stream; generates minute-long controllable clips
- DriveDreamer series: Progresses from 2D to 4D generation with LLM-based prompting
- InfinityDrive: Multi-resolution spatiotemporal modeling with memory mechanisms for long-range dependencies

**Diffusion-Based:**
- Drive-WM, Vista: Latent diffusion for geometry-consistent video from BEV layouts, text prompts, optical flow
- HoloDrive, BEVGen: Fuse camera and LiDAR, lifting BEV layouts to street-level frames

### 10.3 AdaWM: Adaptive World Model Planning (ICLR 2025)

AdaWM is the most directly relevant work for online world model adaptation:

**Problem:** When pretrained world models encounter distribution shift in new environments, both the dynamics model and the planning policy can become mismatched, causing performance degradation.

**Approach:**
1. **Mismatch Identification:** Quantifies two sources of error:
   - Policy mismatch (E_pi): pretrained policy is suboptimal for new tasks (Total Variation distance between state visitation distributions)
   - Dynamics model mismatch (E_P): model predictions are inaccurate in new environment (TV distance between state-action visitation distributions)
   - Decision criterion: update dynamics model if E_P >= C1*E_pi - C2

2. **Alignment-Driven Finetuning:**
   - For dynamics models: LoRA-based low-rank adaptation updating only weight B of base vectors
   - For policies: decompose into weighted convex combination of sub-units, update only weight vectors
   - Selective: only update whichever component has greater mismatch

**Results (CARLA):**
- Roundabout tasks: Success rate 0.82 vs. 0.40 baseline
- Left turn in dense traffic: Success rate 0.70 vs. 0.35 baseline
- Outperforms both supervised methods (VAD, UniAD) and model-based RL (DreamerV3)

### 10.4 Waymo World Model (February 2026)

Waymo's World Model, built on Google DeepMind's Genie 3, represents the current state-of-the-art:

**Foundation:** Genie 3's pre-training on an "extremely large and diverse set of videos" provides broad world knowledge. Specialized post-training converts 2D video knowledge into 3D lidar outputs matching Waymo's hardware.

**Multi-Sensor Generation:** Generates high-fidelity camera AND lidar data simultaneously -- critical for validating multi-modal perception pipelines.

**Three Control Mechanisms:**
1. **Driving action control:** Simulate counterfactual scenarios and alternative routes
2. **Scene layout control:** Customize road layouts, traffic signals, other road user behavior
3. **Language control:** Adjust time-of-day, weather, or generate entirely synthetic scenarios via text prompts

**Adaptation Implication:** Language-controlled generation enables testing the AV stack against scenarios it has never encountered in the real world, proactively preparing for distribution shift before deployment in new cities. Waymo has logged nearly 200 million real autonomous miles but "racks up billions of miles in virtual worlds."

### 10.5 comma.ai's World Model (v0.10)

comma.ai's world model ("Tomb Raider") is used for simulation-based on-policy training:

**Architecture:**
1. **Compressor:** Stable Diffusion's image VAE reduces states to latent representations
2. **Dynamics Model:** Video Diffusion Transformer predicts latent transitions given history and actions
3. **Plan Head:** Predicts curvature and acceleration trajectories trained on human driving

**Future Anchoring:** The model receives future states at fixed time steps ahead, enabling recovery from compounding prediction errors -- a critical innovation for long-horizon world model rollouts.

**Deployment:** Policies trained through this world model are live in openpilot (v0.8.15 for lateral, v0.9.0 for longitudinal, v0.10 for world model simulation).

### 10.6 Online Adaptation of World Models

As environments change (new construction at an airport, seasonal changes, new vehicle types), world models must adapt without catastrophic forgetting. The key challenges:

- **Scarce data:** Safety-critical edge cases are rare in real-world collection
- **Long-horizon reliability:** Prediction errors compound over multi-step rollouts
- **Physics violations:** World models may generate physically impossible scenarios (sudden vehicle appearances, incorrect speeds)
- **Multi-sensor consistency:** Adapted models must maintain consistency between camera and lidar outputs

**Promising approaches:**
- AdaWM's selective finetuning (update only the mismatched component)
- LoRA-based adaptation (few new parameters, fast to update)
- Uncertainty-aware ensembles for epistemic/aleatoric risk separation
- VLM-guided approaches: label logs with VLM safety scores, generate safety-aware rollouts

---

## 11. Synthesis: Architecture for Continual-Learning AV Fleets

Drawing on all sections above, a reference architecture for a continual-learning AV fleet:

```
+-------------------------------------------------------------------+
|                        CLOUD / DATA CENTER                         |
|                                                                    |
|  [Model Registry] <-> [Training Pipeline] <-> [Data Lake]         |
|       |                     |                      ^              |
|  [Validation &         [Active                 [Auto-Labeling]    |
|   Simulation]          Learning]                   ^              |
|       |                     |                      |              |
|  [A/B Test &           [Curriculum              [Data            |
|   Canary Mgmt]         Scheduler]              Selection]        |
|       |                                            ^              |
+-------|--------------------------------------------|--------------+
        |                                            |
        v              OTA Updates                   | Trigger Uploads
+-------------------------------------------------------------------+
|                     EDGE / VEHICLE FLEET                           |
|                                                                    |
|  [Perception] -> [World Model] -> [Planning] -> [Control]        |
|       |               |               |                           |
|  [OOD Detection] [Drift Monitor] [Safety Monitor]                |
|       |               |               |                           |
|  [Trigger        [Online          [Behavioral                    |
|   Classifiers]   Adaptation]      Rollback]                      |
|                                                                    |
+-------------------------------------------------------------------+
        |                                            |
        v              FL Aggregation                v
+-------------------------------------------------------------------+
|                   FEDERATED LEARNING LAYER                        |
|                                                                    |
|  [Local Training] -> [Gradient Compression] -> [Secure Agg]     |
|  [DP Noise Addition] -> [Personalization] -> [Global Model]      |
|                                                                    |
+-------------------------------------------------------------------+
```

**Key design principles:**

1. **Defense in depth against forgetting:** Combine EWC/MAS regularization with replay buffers and architecture-based isolation for maximum robustness
2. **Selective data collection:** Use trigger classifiers and uncertainty-based active learning to collect only informative data, not everything
3. **Graduated deployment:** Shadow mode -> canary fleet -> staged rollout -> full deployment, with rollback at every stage
4. **Multi-domain awareness:** Domain-incremental learning with curriculum ordering of new sites
5. **Privacy by design:** Federated learning with differential privacy for cross-airport knowledge sharing
6. **World model as force multiplier:** Generate synthetic scenarios for domains not yet encountered; test adaptation before physical deployment

---

## 12. Key Takeaways for Airport Airside Deployment

1. **Start with strong base training, then adapt incrementally.** A model trained on a diverse initial airport with rich scenarios provides a better foundation than training from scratch at each site. Waymo's experience shows that nuances decrease with each new domain.

2. **EWC + replay is the practical sweet spot** for preventing catastrophic forgetting during multi-airport adaptation. EWC is simple to implement and has demonstrated 0% collision rates in AV car-following experiments. Supplement with a replay buffer of domain-specific edge cases from each airport.

3. **Deploy trigger classifiers for airside-specific edge cases:** GSE conflicts, jet blast zones, wide-body pushback, wildlife, construction zones, unusual aircraft types. These enable targeted data collection from the fleet.

4. **Use world models for proactive adaptation:** Before deploying at a new airport, generate synthetic scenarios with the world model (varying airport layout, weather, traffic density). Test the model's performance in simulation before physical deployment.

5. **Domain-incremental learning with curriculum ordering:** Deploy at airports in order of increasing domain gap from the training distribution. Each deployment adds to the model's domain coverage, making subsequent deployments easier.

6. **Federated learning enables cross-airport improvement without data sharing:** Each airport retains data sovereignty while contributing to global model improvement. Personalized FL allows site-specific specialization.

7. **Build rollback into the deployment pipeline from day one:** Canary deployment at each new airport, shadow mode validation, behavioral rollback to rule-based control as the ultimate safety net. Track disengagement rates and intervention triggers per model version.

8. **Monitor for drift continuously:** Airport environments change (new construction, seasonal weather, new aircraft types, new ground procedures). Drift detection should trigger automated data collection and retraining workflows.

9. **Budget for labeling infrastructure:** Active learning reduces but does not eliminate labeling needs. Auto-labeling with GPS-correlated annotations (similar to Tesla's intersection labeling) can reduce per-frame cost dramatically.

10. **Plan for compute at the edge:** PackNet or knowledge distillation enables deploying multi-domain models on vehicle hardware. LoRA-based adaptation enables on-device fine-tuning for per-vehicle calibration.

---

## 13. References

### Catastrophic Forgetting and Continual Learning
- [Overcoming Catastrophic Forgetting in Neural Networks (EWC)](https://arxiv.org/abs/2507.10485) -- Kirkpatrick et al., original EWC paper
- [Elastic Weight Consolidation Done Right for Continual Learning](https://arxiv.org/html/2603.18596) -- 2026 analysis of EWC limitations
- [On the Computation of the Fisher Information in Continual Learning](https://arxiv.org/html/2502.11756v1) -- Fisher information analysis for CL
- [Continual Learning for Adaptable Car-Following in Dynamic Traffic Environments](https://arxiv.org/html/2407.14247) -- EWC/MAS applied to autonomous driving
- [Progressive Neural Networks](https://arxiv.org/abs/1606.04671) -- Rusu et al., DeepMind
- [Architecture-Based Continual Learning Algorithms](https://pengxiang-wang.com/posts/architecture-based-continual-learning) -- PackNet, AdaHAT overview
- [Experience Replay Addresses Loss of Plasticity in Continual Learning](https://arxiv.org/abs/2503.20018) -- 2025 study
- [Adaptive Memory Replay for Continual Learning (CVPR 2024)](https://openaccess.thecvf.com/content/CVPR2024W/ELVM/papers/Smith_Adaptive_Memory_Replay_for_Continual_Learning_CVPRW_2024_paper.pdf)
- [Online Continual Learning: A Systematic Literature Review](https://arxiv.org/html/2501.04897v1)
- [Catastrophic Forgetting in Neural Networks](https://www.ibm.com/think/topics/catastrophic-forgetting) -- IBM overview

### Surveys and Overviews
- [Advancing Autonomy Through Lifelong Learning: A Survey](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2024.1385778/full) -- 2024 survey of lifelong learning for AIS
- [Continual Learning for Real-World Autonomous Systems](https://link.springer.com/article/10.1007/s10846-022-01603-6) -- Springer survey
- [A Survey of Autonomous Driving from a Deep Learning Perspective](https://dl.acm.org/doi/10.1145/3729420) -- ACM Computing Surveys 2025

### Data Flywheel and Active Learning
- [How Tesla Turned Every Driver Into a Data Source](https://www.economyinsights.com/p/how-tesla-turned-every-driver-into-a-data-source) -- Tesla's data flywheel
- [Tesla Data Engine: Trigger Classifiers](https://codecompass00.substack.com/p/tesla-data-engine-trigger-classifiers) -- Detailed pipeline analysis
- [Autonomous Vehicle Training and Tesla's Data Engine Explained](https://www.arrow.com/en/research-and-events/articles/autonomous-vehicle-training-and-teslas-data-engine-explained)
- [ActiveAD: Planning-Oriented Active Learning for End-to-End Autonomous Driving](https://arxiv.org/abs/2403.02877)
- [Data-Centric Evolution in Autonomous Driving: Comprehensive Survey](https://arxiv.org/html/2401.12888v2) -- Closed-loop pipeline architectures
- [Tesla's FSD: The Software Flywheel](https://www.datainsightsmarket.com/news/article/teslas-fsd-the-software-flywheel-dominating-the-ev-market-20827)

### Domain Adaptation and Multi-Domain Deployment
- [Brain-Inspired Domain-Incremental Adaptive Detection for Autonomous Driving](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2022.916808/full)
- [Multi-Domain Adaptation for Autonomous Driving Perception](https://pinnaclepubs.com/index.php/PAPPS/article/view/234)
- [Domain Adaptation for Autonomous Driving](https://www.labelvisor.com/domain-adaptation-for-autonomous-driving/)
- [Cross-Domain Autonomous Driving Visual Segmentation](https://www.sciencedirect.com/science/article/pii/S2405959524001231)
- [Gradual Divergence for Seamless Adaptation: Domain Incremental Learning](https://arxiv.org/html/2406.16231v1)

### Distribution Shift and OOD Detection
- [Out-of-Distribution Segmentation in Autonomous Driving: Problems and State of the Art](https://arxiv.org/html/2503.08695v2)
- [OOD Detection for Safety Assurance](https://arxiv.org/pdf/2510.21254)
- [Novelty-Aware Concept Drift Detection for Neural Networks](https://www.sciencedirect.com/science/article/pii/S0925231224017041)
- [Concept Drift Detection in Image Data Stream: Survey](https://link.springer.com/article/10.1007/s10462-025-11428-y)
- [Efficient Spatio-Temporal OOD Detection for Autonomous Systems](https://www.sciencedirect.com/science/article/abs/pii/S1383762125001973)

### Curriculum Learning
- [CurricuVLM: Safety-Critical Curriculum Learning with VLMs](https://arxiv.org/html/2502.15119v1)
- [CuRLA: Curriculum Learning Based Deep RL for Autonomous Driving](https://arxiv.org/html/2501.04982v1)
- [Decision Making for AVs: Mixed Curriculum RL](https://www.sciencedirect.com/science/article/abs/pii/S0968090X25003730)

### Model Versioning and Deployment
- [Hitting the Undo Button: The Critical Role of Rollback in AI Systems](https://www.sandgarden.com/learn/rollback)
- [Model Versioning: Top Tools and Best Practices](https://lakefs.io/blog/model-versioning/)
- [Future-Proofing Automotive Software via OTA Updates](https://www.appliedintuition.com/blog/future-proofing-via-ota-updates)
- [Model Rollbacks Through Versioning](https://towardsdatascience.com/model-rollbacks-through-versioning-7cdca954e1cc/)

### Federated Learning
- [Federated Learning for Connected and Automated Vehicles: Survey](https://liangqiy.com/publication/federated_learning_for_connected_and_automated_vehicles_a_survey_of_existing_approaches_and_challenges/Federated_Learning_for_Connected_and_Automated_Vehicles_A_Survey_of_Existing_Approaches_and_Challenges.pdf)
- [FLAD: Federated Learning for LLM-based Autonomous Driving](https://arxiv.org/abs/2511.09025) -- Vehicle-edge-cloud architecture
- [Personalized FL for Autonomous Driving with Correlated DP](https://pmc.ncbi.nlm.nih.gov/articles/PMC11722728/)
- [FLAV: Federated Learning for Autonomous Vehicle Privacy Protection](https://www.sciencedirect.com/science/article/abs/pii/S1570870524002968)
- [Deep Federated Learning: Systematic Review](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1617597/full)
- [Federated Learning: Survey on Privacy-Preserving Collaborative Intelligence](https://arxiv.org/html/2504.17703v3)

### World Models
- [A Survey of World Models for Autonomous Driving](https://arxiv.org/html/2501.11260v4) -- Comprehensive 2025 survey
- [The Role of World Models in Shaping Autonomous Driving](https://arxiv.org/html/2502.10498v1)
- [AdaWM: Adaptive World Model Based Planning (ICLR 2025)](https://arxiv.org/html/2501.13072v1)
- [The Waymo World Model (February 2026)](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [Learning to Drive from a World Model -- comma.ai](https://blog.comma.ai/mlsim)
- [Waymo: Safe, Routine, Ready -- Autonomous Driving in New Cities](https://waymo.com/blog/2025/11/safe-routine-ready-autonomous-driving-in-new-cities/)

### Industry and Deployment
- [comma.ai openpilot](https://comma.ai/openpilot) -- 325+ car models, 20K+ users
- [openpilot 0.10 Release](https://blog.comma.ai/010release/) -- World model training architecture
- [Waymo's 2025 Year in Review](https://www.thedriverlessdigest.com/p/waymos-2025-year-in-review-the-year)
- [Tesla 2026: Cortex 2 Confirmed](https://www.basenor.com/blogs/news/tesla-2026-cortex-2-confirmed-autonomous-ai-future-takes-shape)
- [Decoding Tesla's Core AI and Hardware Architecture](https://applyingai.com/2025/07/decoding-teslas-core-ai-and-hardware-architecture-a-ceos-perspective/)
