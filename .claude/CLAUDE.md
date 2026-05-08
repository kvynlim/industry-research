# Industry Research — Claude Instructions

## Project Overview

Comprehensive autonomous vehicle technology research repository — **247 documents, ~271,000 lines**. Covers AV company tech stacks, perception systems, world models, simulation, deployment, safety, and airport airside operations.

## Directory Structure

```
industry-research/
├── companies/          # 21 companies, 52 docs
├── 30-autonomy-stack/  # 195 autonomy docs
│   ├── world-models/   # Overview, diffusion, occupancy, tokenized/JEPA, RL, Dreamer, OccWorld, open-source repos, LiDAR-native world models, occupancy flow & 4D scenes
│   ├── vla-vlm/        # VLA for driving, Alpamayo setup, VLM scene understanding, spatial foundation models for airport robotics
│   ├── perception/     # Overview docs plus method-level perception library
│   ├── planning/       # Frenet augmentation, prediction, neural planning, CBF safety filters, causal reasoning, RL, docking, imitation learning, joint prediction-planning
│   ├── simulation/     # Neural simulation, 3DGS digital twins, Cosmos, airport digital twins, simulators comparison
│   ├── localization-mapping/ # Mapping/localization, maps, LiDAR SLAM methods, occupancy grids, map distribution
│   ├── end-to-end-driving/   # E2E architectures, company approaches, E2E pipeline
│   └── multi-agent-v2x/      # Fleet coordination, V2X protocols, task allocation, conflict and deadlock prevention
├── 60-safety-validation/ # Safety validation, verification, and robustness material
├── operations/         # 30 docs
│   ├── airside/        # Industry overview, turnaround, FOD/jet blast, airport APIs (real endpoints), pushback systems, electric GSE market, aviation ecosystem, ground control instructions (A-CDM/A-SMGCS/marshaller)
│   ├── deployment/     # Playbook (4,500 lines), shadow mode, OTA fleet mgmt, production ML, fleet dispatch, multi-airport adaptation (8-week onboarding), HMI operator interface, workforce transition, fleet TCO & business case, CI/CD & DevOps pipeline, fleet predictive maintenance & spare parts, EV fleet energy co-optimization, fleet anomaly root-cause attribution
│   ├── safety/         # ISO 3691-4, certification, incidents, failure modes, Simplex, regulatory trajectory, ground crew, insurance/liability, functional safety software (MISRA C, ISO 26262 Pt6), scenario taxonomy (ISO 34502/SOTIF, 115 scenarios), cybersecurity, testing & validation, runtime verification & monitoring, formal verification of neural networks, weather-adaptive ODD management, fail-operational architecture & HW redundancy, online perception monitoring & ODD enforcement
│   └── teleoperation/  # Systems comparison (Fernride, Waymo, Cruise lessons)
├── hardware/           # 20 docs
│   ├── compute/        # Orin (275 TOPS), Thor (1000+ TOPS), TensorRT guide, training infra, energy-efficient 24/7 inference, edge-cloud hybrid inference (three-tier vehicle+MEC+cloud)
│   ├── sensors/        # Hesai LiDAR, RoboSense LiDAR, 4D radar (Continental ARS548), multi-LiDAR extrinsic calibration, sensor degradation & health monitoring, solid-state LiDAR & photonic integrated circuits, automated sensor cleaning & self-maintenance
│   ├── connectivity/   # Airport 5G/CBRS, case studies (DFW, Changi, LAX), deterministic networking (TSN/IEEE 802.1)
│   └── vehicle/        # CAN bus/DBW, bicycle kinematic model
├── foundations/        # 12 docs — PointPillars, VQ-VAE/FSQ, transformers, diffusion, GTSAM, Lanelet2, Frenet math, RTK/IMU, Mamba SSM, theoretical, architecture innovations, sparse attention for 3D
├── cross-cutting/      # 26 docs — sensor fusion, synthetic data, evaluation benchmarks, datasets (nuScenes/Waymo practical guide), transfer learning, ROS 2, Autoware (50+ modules), embodied AI, data engines, open-source ecosystem, data flywheel (closed-loop ML), federated learning (fleet-scale), LiDAR data augmentation, radar-LiDAR fusion for adverse weather, cloud backend infrastructure (fleet data lake, Airflow, K8s), on-vehicle data triage & selective upload
└── synthesis/          # 3 docs — master synthesis, design spec, POC proposals
```

## User Context

The user builds **autonomous vehicles for airport airside operations** using an **Aurrigo ROS Noetic stack** (at `~/ubuntu_20-04/z-aurrigo-ws/`). They are researching how to integrate world models, VLAs, and modern AI into their existing stack.

## Current Aurrigo Stack

- **ROS Noetic**, 22 packages, C++ nodelets
- **LiDAR-only**: 4-8 RoboSense (RSHELIOS/RSBP), RANSAC segmentation
- **GTSAM localization**: GPU VGICP + IMU (500Hz) + RTK-GPS + wheel odometry
- **Frenet planning**: 420 candidates/cycle, Stanley lateral control
- **Vehicles**: ADT3 (Ackermann + crab), STL2, POD, ACA1

## Key Findings

### Technology
1. **Alpamayo**: Camera-only, non-commercial license, teacher model for distillation, 10B params
2. **Cosmos**: FSQ tokenizer (not VQ-VAE), commercially licensed (NVIDIA Open Model License)
3. **comma.ai**: 2B DiT world model used at training time only — small FastViT+Transformer policy on-device. Panda safety layer: STM32H725, MISRA C, 100% line coverage
4. **FlashOcc**: 197.6 FPS, only occupancy method viable for Orin real-time without optimization
5. **Only 6 open-source world model repos are fully usable** (Cosmos, OpenDWM, CarDreamer, DIAMOND, DiffusionDrive, Epona)
6. **DINOv2**: Direct backbone replacement fails (0% mAP) — need adapter-mediated integration. LoRA rank 32 optimal
7. **Mamba/SSM**: DriveMamba 42% L2 reduction vs UniAD, 3.2x faster, 68.8% less GPU memory. Eliminates KV-cache
8. **PointPillars**: 6.84ms on Orin with TensorRT. INT8 PTQ loses only 0.80% mAP for 2.2x speedup

### Market & Competition
9. **UISEE**: 1,000+ vehicles deployed (50x more than nearest competitor), 101% revenue CAGR, filed HKEX IPO
10. **Changi (Jan 2026)**: First fully driverless airside deployment (UISEE tractors, 20,000+ km accident-free)
11. **TractEasy**: Zero accidents across 8 airports, >95% mission success, 1-6 years per approval
12. **Aurrigo**: All deployments still require safety operator, no ML in core perception
13. **AeroVect**: $27.1M raised, retrofit approach, mapped half of top 10 US airports
14. **Assaia**: 21 airports, 450K+ turnarounds, 25% delay reduction (vs Moonware's unverified 20%)

### Safety & Regulatory
15. **ISO 3691-4**: Harmonized with Machinery Directive May 2024. Certification $130K-380K, 12-24 months
16. **FAA CertAlert 24-02**: Non-directive, supports controlled testing. No formal standards exist
17. **Predicted timeline**: FAA AC ~2028-2029, EASA AMC ~2028, ISO/SAE ~2029-2030
18. **EU PLD 2024/2853**: Software/AI now "products" subject to strict liability — transpose by Dec 2026
19. **2027 EU Machinery Regulation**: Mandates third-party assessment for AI autonomous vehicles
20. **Ground crew**: 27,000 ramp accidents/year, $10B+ cost, hi-vis causes 84-88% AEB failure at night
21. **Aircraft damage from GSE**: Averages $250K, can reach $35M per engine or $139M+ structural

### Hardware
22. **4D radar**: Should be primary (not backup) for airside — immune to rain, fog, de-icing, jet exhaust
23. **NVIDIA Thor**: ~1,000 TOPS dense, FP8 native, first vehicles early 2025 (Zeekr), enables full world models on-vehicle
24. **Airport 5G**: $5M-15M CapEx for full coverage, 12-24 month ROI. DFW spent $10M

### Data
25. **No public airside driving datasets exist** — opportunity to create the benchmark
26. **Road→airside transfer**: Open research gap, LoRA needs only 500-1,000 frames
27. **nuScenes**: trainval ~300GB, Occ3D labels at 0.4m resolution

### Mapping & Localization
28. **MapTracker (ECCV 2024)**: 64.9 mAP, +69% temporal consistency over MapTRv2 via tracking-based mapping
29. **Neural Map Prior**: +5.4 mAP improvement, largest gains at night/rain — ideal for fleet-based airport mapping
30. **AMDB data available free** from FAA (500+ US airports). ±0.5m accuracy at best, needs HD survey overlay
31. **No AMXM→Lanelet2 converter exists** — custom pipeline needed. Cost: $20-50K dev
32. **Three-layer map architecture**: AMDB base (28-day cycle) + HD survey (monthly) + live perception (real-time)

### Infrastructure Cooperative Perception
33. **V2I cooperative perception**: +15-25% detection AP over vehicle-only (DAIR-V2X results)
34. **Where2comm**: 4.7x bandwidth reduction with only 1.2% AP loss — critical for multi-node airport
35. **Airports already have SMR + MLAT + ADS-B + 1000s of CCTV** — repurpose as perception inputs
36. **Infrastructure perception ROI**: $1-2M deployment, $1.4-4.75M annual benefit, 0.5-1.5yr payback

### LiDAR Foundation Models
37. **Pre-training saves 50-80% of labeled data**: GD-MAE matches full-dataset accuracy with 20% labels
38. **PTv3 + Sonata/Concerto**: Current SOTA 3D backbone, 3x faster and 10x more memory-efficient
39. **FlatFormer**: First point cloud transformer achieving real-time on edge GPUs (4.6x faster than SST)
40. **ScaLR**: Best LiDAR-only self-supervised features via DINOv2-to-LiDAR distillation (67.8% mIoU)
41. **PointLoRA (CVPR 2025)**: Parameter-efficient fine-tuning specifically for point clouds

### Occupancy Deployment
42. **FlashOcc on Orin**: 197.6 FPS with TensorRT INT8 — only camera-based occupancy viable without optimization
43. **nvblox**: NVIDIA's built-in TSDF occupancy, ROS 1 bridgeable via rosbridge or custom wrapper
44. **LiDAR voxelization**: Direct GPU raycasting achieves real-time 3D occupancy without learned models
45. **Multi-resolution grids**: 0.2m close / 0.4m medium / 0.8m far optimizes memory while preserving safety-critical detail

### Thermal/IR Sensors
46. **LWIR thermal cameras**: Detect personnel at 200m+ in complete darkness, immune to hi-vis failure (84-88% AEB failure rate at night)
47. **FLIR Boson 640**: $3-6K per unit, 640x512, 60Hz, MIPI CSI-2 for direct Orin integration
48. **Thermal+visible fusion**: +15-30% pedestrian AP in night/adverse conditions (KAIST/LLVIP benchmarks)
49. **Jet blast visualization**: Thermal is only passive sensor capable of detecting invisible jet exhaust boundaries

### Neural Motion Planning
50. **SparseDrive**: 0.06% collision rate, sparse representation, end-to-end trainable with planning
51. **DiffusionDrive**: Diffusion-based trajectory generation, 45ms on Orin via truncated diffusion (5 steps)
52. **GameFormer (NeurIPS 2023)**: Level-k game-theoretic interaction modeling, outperforms non-interactive planners by 30%+ on nuPlan
53. **Simplex for neural planning**: Neural planner as AC (performance), classical Frenet as BC (safety) — matches Aurrigo architecture

### LiDAR Semantic Segmentation
54. **FlatFormer**: Best accuracy/speed tradeoff for Orin — 25-35 FPS INT8, ~70% mIoU, standard attention ops (TensorRT-friendly)
55. **SalsaNext**: Only method achieving real-time on Orin without optimization — but 60% mIoU (20% below SOTA)
56. **ALPINE (2025)**: Training-free panoptic via BEV clustering on semantic output — PQ=64.2%, no additional training needed
57. **18-class airside taxonomy**: Aircraft (fuselage/wing/engine/tail), GSE (5 types), personnel (standing/crouching), FOD

### Model Compression & Edge
58. **Combined compression**: Distillation + pruning + INT8 achieves 5-15x speedup at 1-3% accuracy loss
59. **TinyBEV**: Distills multi-modal teacher to camera-only student — 5-8x fewer params, within 2-3% accuracy
60. **Safety-aware pruning**: Protects channels important for rare safety-critical classes (personnel, FOD) during pruning
61. **Multi-model orchestration**: CUDA streams enable concurrent segmentation + detection + occupancy on single Orin

### Multi-Object Tracking
62. **3D MOT on LiDAR**: CenterPoint tracker baseline (greedy matching), SimpleTrack (lifecycle management), MCTrack (multi-cue 2025)
63. **Airside tracking challenges**: Aircraft wingspan 30-65m vs personnel 0.5m; massive occlusion from fuselage; pushback at 1-3 km/h

### Test-Time Adaptation
64. **Multi-airport domain shift**: Geometric, environmental, seasonal, equipment, and lighting shifts require adaptation without full retraining
65. **TENT/CoTTA/SAR**: TTA methods adapt perception models at inference time via entropy minimization — no labeled target data needed
66. **OOD detection as trigger**: Mahalanobis distance / energy-based OOD scores determine when to trigger TTA vs safety fallback
67. **Active learning loop**: Fleet-scale edge case mining with uncertainty sampling, prioritized annotation, 60-70% annotation cost reduction

### Sim-to-Real Transfer
68. **LiDAR domain gap**: Raydrop + density modeling alone recovers ~60% of sim-to-real gap; total gap reducible from 15-20% AP to 2-3% AP
69. **LidarDM (ICRA 2025)**: Generative LiDAR simulation from HD maps — first method supporting map-conditioned sequence generation
70. **Digital twin ROI**: High-fidelity twin can outperform real-data training by 4.8%; cost $50-75K first airport, $25-50K each additional
71. **Sim + 500 real scans**: Achieves within 3-5% of fully real-data-trained model using 10x less real annotation

### Functional Safety Software
72. **MISRA C:2012 for ROS**: Typical ROS callbacks violate 15-20 MISRA rules; safety-critical nodes need explicit remediation
73. **ISO 26262 Part 6**: V-model maps to ROS development — unit testing needs MC/DC coverage for ASIL-B+ safety path
74. **Static analysis pipeline**: cppcheck (free) → clang-tidy (CI gate) → Polyspace (certification evidence)
75. **comma.ai Panda pattern**: STM32 safety MCU with MISRA C, 100% line coverage — applicable model for Aurrigo's safety controller

### Fleet Data Pipeline
76. **Data volume**: 4-8 RoboSense LiDAR at 10Hz = ~200GB/day/vehicle raw; 100-vehicle fleet = 20TB/day
77. **DVC for rosbags**: Version datasets alongside code; DVC remotes on S3/MinIO for fleet-scale storage
78. **Active learning annotation**: Uncertainty sampling reduces labeling cost 60-70%; pre-labeling with existing models saves further 40%
79. **Storage tiers**: Hot (NVMe, 30 days) → Warm (HDD, 1 year) → Cold (S3 Glacier, safety events permanent)

### VLM Scene Understanding
80. **VLM as co-pilot, not controller**: VLMs output text at 1-2 Hz, run alongside 10 Hz primary loop for anomaly explanation, NOTAM interpretation, turnaround status
81. **DriveVLM CoT reasoning**: Description → analysis → planning chain-of-thought; DriveLM adds graph-structured QA for temporal consistency
82. **InternVL2-2B on Orin**: 300ms inference, 3GB VRAM — smallest viable driving VLM for on-vehicle deployment
83. **No public airside VLM benchmark exists**: Opportunity to create airside-specific VQA dataset from fleet data

### Scenario Taxonomy & Validation
84. **ISO 34502 adapted for airside**: 115 functional scenarios, 566 logical, ~5,400 concrete across 8 categories — no prior published taxonomy exists
85. **SOTIF triggering conditions**: 11 perception triggers (jet exhaust, fuselage reflection, de-icing spray, hi-vis failure) and 5 decision triggers mapped with mitigations
86. **Scenario parameter space**: ~290M combinations from 13 parameters; importance-sampled to ~5,000-10,000 executable tests
87. **ISO 3691-4 gaps for airside**: Does not address jet blast, runway incursion, aircraft clearance, de-icing, fuel zones, or emergency vehicle priority
88. **STPA for airside**: 12 unsafe control actions identified across Airport Ops → Fleet → Vehicle → Actuator control structure

### Ground Control Instruction Understanding
89. **No autonomous GSE today handles real-time ATC interaction**: All competitors (UISEE, TractEasy, AeroVect) use pre-cleared apron zones with human instruction relay
90. **A-CDM integration**: TOBT/AIBT/ELDT milestones drive GSE mission scheduling — auto-dispatch baggage within 2 min of aircraft arrival
91. **NOTAM machine-readable parsing**: Regex primary + LLM fallback; 8 NOTAM types mapped to routing constraints (closed/speed-reduced/caution)
92. **Marshaller gesture recognition**: ViTPose + LSTM temporal model, 9 gesture classes, 5-frame confirmation, $30-50K Phase 4 capability
93. **D-TAXI digital clearance**: CPDLC-based taxi messages (UM73-UM80) extensible to GSE — trials at CDG/FRA/AMS for aircraft, not yet GSE

### Camera Fallback Perception
94. **LiDAR failure is not hypothetical**: De-icing spray, jet blast, sensor fault — estimated 2-8 hours cumulative downtime per vehicle per year
95. **Camera-only accuracy gap**: ~40% NDS vs ~70% for LiDAR; monocular depth >3-5m error at 50m — cannot match LiDAR, but can sustain safe reduced-speed operation
96. **DepthAnything v2 Small on Orin**: ~15ms INT8, combined with BEVFormer-Tiny (~35-50ms) fits within 100ms cycle for camera fallback pipeline
97. **Degraded mode policy**: Speed proportional to perception confidence — 25 km/h (full LiDAR) → 10 km/h (camera only) → stop (below threshold)

### Multi-Airport Domain Adaptation
98. **Per-airport adaptation cost**: $75-150K for additional airports (same cluster) vs $200-400K from scratch — 60% reduction via AMDB bootstrap + PointLoRA
99. **AMDB bootstrap**: Free FAA data for 500+ US airports eliminates 60-70% of HD mapping cost; SLAM refinement to ±0.2m during supervised operations
100. **PointLoRA fine-tuning**: 500 labeled frames sufficient for same-cluster transfer (1-3% mAP gap); 1,000 frames for cross-cluster
101. **8-week onboarding**: Map (W1-2) → Perception adaptation (W3) → Validation (W4) → Shadow mode (W5-6) → Supervised ops (W7-8) → Go/no-go
102. **Scaling economics**: Per-airport cost drops from $250K (first) to $100K (10th) to $75K (20th+) as tools and base models mature

### HMI & Operator Interface
103. **4-mode control architecture**: Full autonomous → supervised autonomous → shared control → full teleoperation
104. **Operator-to-vehicle ratio**: Industry range 1:1 (initial) to 1:10+ (mature); Waymo started 1:1, Nuro achieved 1:3
105. **Handoff latency budget**: 2-5 seconds for smooth teleoperation takeover; vehicle auto-stops if operator doesn't respond
106. **Operator training**: 40-80 hours initial, 8-16 hours annual recurrent; progressive from close monitoring to exception-only
107. **Incident reporting pipeline**: One-button "flag this moment" → rosbag capture → annotation queue → model retraining (active learning loop)

### Semantic Mapping & Learned Priors
108. **Neural Map Prior (NMP)**: +5.4 mAP on nuScenes, largest gains at night (+8.2) and rain (+6.7) — ideal for airport adverse conditions
109. **PriorDrive unified prior encoding**: Multi-source prior fusion (AMDB + HD survey + fleet SLAM + NMP) reduces mapping cost by additional 30-40% over AMDB bootstrap alone
110. **T2SG topology scene graphs**: CVPR 2025, typed nodes/edges with fleet-based topology discovery — discovers implicit rules (e.g., service road right-of-way) from fleet behavior
111. **Conformal prediction for maps**: Distribution-free uncertainty guarantees on map elements — coverage guarantee P(true in predicted set) >= 1-alpha without distributional assumptions
112. **7-layer semantic map**: L0 AMDB → L1 Survey HD → L2 Fleet SLAM → L3 Semantic Annotations → L4 NMP Behavioral → L5 Topology Graph → L6 Dynamic → L7 Mission

### CBF Safety-Critical Planning
113. **CBF-QP safety filter**: <1 ms on Orin (OSQP solver) — adds formal collision avoidance to any neural planner with negligible latency
114. **Neural CBFs + conformal prediction (CP-NCBF)**: 99.99% probabilistic safety guarantees without distribution assumptions
115. **Measurement-robust CBFs**: Directly integrate GTSAM pose covariance — automatically tighten margins when localization is uncertain
116. **GameFormer level-K reasoning**: Approximates Nash equilibrium via iterated best response — models right-of-way negotiations between GSE
117. **GCBF+ multi-agent**: GNN-based decentralized CBFs scale to 1024 agents — sufficient for largest airport fleets
118. **CBF-Simplex three-layer**: Neural planner → CBF filter → Simplex switch → classical fallback; provides defense-in-depth for certification
119. **Airside-specific CBFs**: Asymmetric aircraft zones (5m nose/intake, 50m+ exhaust/jet blast, 3m wing), velocity-dependent personnel clearance, geofence SDF, runway incursion hard wall

### LiDAR-Native World Models
120. **Modality mismatch solved**: LiDAR world models predict directly in metric 3D coordinates — eliminates depth estimation error from camera-based models
121. **Copilot4D**: 65% Chamfer distance improvement via discrete diffusion on LiDAR tokens (ICLR 2024), but proprietary (Waabi)
122. **UnO self-supervised**: Outperforms supervised baselines for occupancy forecasting — critical when no public airside LiDAR datasets exist
123. **LidarDM**: Map-conditioned LiDAR generation for simulation/augmentation (ICRA 2025) — could generate synthetic airside training data
124. **AD-L-JEPA**: First JEPA for LiDAR, 1.9-2.7x fewer GPU hours than Occupancy-MAE — efficient pre-training for limited airside data
125. **Deployment budget**: 50-100ms for 3-step prediction on Orin with TensorRT — fits within 100ms planning cycle

### Collaborative Fleet Perception
126. **V2V cooperative perception**: +18-22% mAP improvement in benchmarks; larger gains expected on airside due to severe occlusion
127. **Where2comm bandwidth**: 95.3% of full-sharing performance at 1/64 bandwidth (160 KB/frame) — feasible on airport 5G
128. **CoBEVFlow**: Handles asynchronous data (up to 200ms delay) via learned BEV flow compensation
129. **HEAL heterogeneous agents**: Different vehicle types in fleet fuse via alignment modules — no retraining of existing agents
130. **Collective FOD detection**: P(detect) rises from 0.3-0.6 (single) to 0.95-0.99 (fleet of 5) via multi-view consensus
131. **Phased deployment**: $15K (late fusion) → $55K (intermediate) → $115K (fleet intelligence)

### Neuro-Symbolic Scene Graphs
132. **Scene graphs bridge perception and reasoning**: Structured yet learnable representations enable interpretable, verifiable decisions
133. **Knowledge graph encodes airside rules**: 9-level right-of-way priority, NOTAM dynamic rule injection, turnaround scene evolution
134. **STL-constrained planning**: Differentiable Signal Temporal Logic specifications for formal trajectory safety
135. **Certification advantage**: Verify symbolic rules formally, validate neural perception statistically — clear path to safety case
136. **Scene graph overhead**: ~14ms on Orin (detection + tracking + relation prediction + graph assembly)

### Testing & Validation Methodology
137. **2-wise covering arrays**: Reduce combinatorial explosion from 1,280 to ~40 test cases while covering all parameter pairs
138. **Statistical safety**: Zhao-Weng formula requires ~4,600 zero-failure tests for 99.9% reliability at 99% confidence
139. **Sim-to-real factor**: ~0.1 (10 sim tests = 1 real test) — conservative but defensible for certification
140. **Shadow mode transition**: 0 safety-critical disagreements per 1,000 km over 2,000 km period required
141. **First airport certification**: ~$105K, 20 weeks; additional airports ~$65K, 12 weeks

### Self-Supervised Pre-training
142. **SSL reduces labeling cost by 50-80%**: Contrastive + MAE pre-training on unlabeled data, fine-tune with minimal labels
143. **JEPA vs MAE for driving**: AD-L-JEPA is 1.9-2.7x more compute-efficient than Occupancy-MAE
144. **Airside curriculum**: Road SSL → road supervised → airside SSL → airside supervised (progressive transfer)
145. **Cost comparison**: $5-15K pre-training compute + $15-30K labeling vs $80K+ full annotation without pre-training

### 3DGS for Perception & Mapping
146. **GaussianFormer**: 39.2 mIoU at 20 FPS on A100, matching dense voxel methods (39.3) with 3.2x less memory
147. **GaussianOcc self-supervised**: Closes 80% of gap to supervised methods with zero 3D labels — critical for airside
148. **Self-supervised + 500 labels**: 33.2 mIoU at $12.5K vs 39.1 mIoU at $700K fully supervised (1.8% cost for 85% performance)
149. **Gaussian SLAM (SplaTAM)**: <0.4cm trajectory error on Replica, map as byproduct
150. **Orin deployment**: GaussianFormer ~92ms end-to-end with TensorRT FP16, fits 100ms cycle
151. **Adaptive resolution advantage**: Handles 200m aprons and 2cm FOD simultaneously — voxels at 2cm for full apron = 500M voxels (infeasible)
152. **Integration cost**: $90K over 12-18 months, phased from research ($5K) to production ($25K)

### Data Flywheel (Closed-Loop ML)
153. **Trigger-based collection**: 50GB/day upload budget captures 100% of safety events, ~60% of perception edge cases
154. **Auto-labeling**: SAM + CLIP foundation models reduce cost 70-85% ($8-15/frame → $1.50-3/frame)
155. **Active learning**: 40-50% fewer labeled frames needed, safety-weighted selection prioritizes aircraft/crew/FOD
156. **Monthly retraining**: Triggered by 5K new frames, 3% mAP drop, or 30-day age
157. **Per-airport LoRA**: 500-2,000 labeled frames ($2-8K) for initial deployment quality — rapid airport onboarding
158. **mAP trajectory**: 45% (month 3) → 70% (month 12) → 82% (month 24) with interventions dropping 5-10/100km → 0.1-0.5/100km
159. **Flywheel breakeven**: ~Month 18, NPV positive by end of Year 2 ($205K Year 1 cost vs $150K Year 1 benefit growing to $1M Year 3)

### Runtime Verification & Monitoring
160. **STL monitoring <1ms on Orin**: 20 concurrent airside-specific specs (aircraft proximity, zone speed, geofence, runway incursion, jet blast)
161. **OOD detection**: Combined energy + Mahalanobis + ensemble achieves 95-98% AUROC at 1-3ms total overhead
162. **Maximally permissive shields**: Intervene on only 1-5% of timesteps (vs 20-40% for restrictive), preserving performance
163. **Three-layer defense-in-depth**: Shield (LTL, discrete) → CBF-QP (<500us) → Simplex (system failover to Frenet)
164. **WCET full monitoring suite**: <5.5ms analytical bound, well within 10ms budget
165. **Safety MCU**: STM32H725 following comma.ai Panda pattern, $50-200/vehicle, MISRA C, hardware speed limiter
166. **Standards compliance**: ISO 26262 ASIL decomposition, UL 4600 runtime monitoring (all 4 clauses addressed), DO-178C formal methods credit
167. **Implementation**: $115-200K over 32 weeks, phased from STL monitors (4 weeks) through fleet monitoring

### Occupancy Flow & 4D Scene Understanding
168. **ZeroFlow**: 0.028m EPE3D via zero-shot distillation — no labels needed for scene flow
169. **DeFlow (CVPR 2024)**: 0.023m EPE3D SOTA, 3.3x fewer parameters, TensorRT-friendly
170. **UnO self-supervised**: Won Argoverse 2 LiDAR Forecasting Challenge — LiDAR-only, no labels, matches Aurrigo constraints
171. **Flow-aware safety margins**: Approaching cart at 20km/h needs 6.25m vs 3.25m for stationary — prevents both false positives and negatives
172. **Orin pipeline**: 26-40ms FP16 for complete 4D occupancy flow — well within 50ms budget
173. **K-Planes compression**: 10,900x memory reduction vs dense 4D grids (17GB → 1.5MB)
174. **Frenet integration**: Flow-augmented obstacle costs predict 60-70% collision rate reduction, 50-67% fewer unnecessary stops
175. **Training cost**: $6-11K total via self-supervised methods — 85-93% cheaper than fully supervised

### Uncertainty Quantification & Calibration
176. **Evidential deep learning**: Single-pass uncertainty at ~10% overhead (7.5ms vs 6.84ms), 0.87 AUROC OOD detection
177. **Deep ensembles (M=5)**: Gold standard — 0.93 AUROC, 0.03 ECE, but 5x compute (use for offline analysis)
178. **MC-Dropout (T=3)**: Practical real-time choice — 0.85 AUROC, 21.5ms on Orin, zero extra memory
179. **Conformal prediction**: Distribution-free P(true ∈ set) ≥ 99% with ~1,000 calibration examples
180. **Temperature scaling**: ECE 0.12-0.18 → 0.02-0.05 at zero latency cost
181. **Multi-LiDAR fusion**: 4-8 RoboSense LiDARs reduce position uncertainty by 49-65% via covariance intersection
182. **Uncertainty-driven decisions**: Low → normal; medium → -30% speed, 2.5m buffer; high → stop, request teleop
183. **Implementation**: $15-25K, no hardware changes needed

### Multi-Task Unified Perception
184. **UniAD**: CVPR 2023 Best Paper, unified 6 tasks, planning L2 -30%, but 100ms A100 (infeasible on Orin)
185. **SparseDrive**: 3x faster than UniAD (9 FPS), 52.5 NDS, but 150ms on Orin (borderline)
186. **Shared-backbone multi-head**: 14.8ms on Orin — 56% savings vs 4 separate models, preserves proven PointPillars
187. **Incremental deployment**: +2.5ms segmentation, +1.5ms free space, +4ms prediction — add one at a time
188. **Task interference**: Uncertainty-weighted loss (Kendall 2018) balances tasks with 1 learnable param per task
189. **PTv3 shared backbone**: <1% per-task loss for 67% compute reduction
190. **Certification advantage**: Modular multi-head is decomposable for ISO 3691-4 / UL 4600 safety analysis

### Federated Learning (Fleet-Scale)
191. **FL not needed today, essential at scale**: At 5-20 vehicles/1-2 airports, centralized is simpler. At 30+ vehicles/3+ airports, data transfer ($500K+/year), GDPR, and airport data sovereignty make FL necessary
192. **Hybrid architecture optimal**: Centralized pre-training + federated LoRA fine-tuning achieves within 0.5-2% of centralized accuracy at 97% communication reduction
193. **LoRA FL communication**: PointPillars LoRA rank-16 reduces per-round from 20 MB to 600 KB; with INT8 quantization, full training <1 GB total
194. **FedBN mandatory**: BN statistics encode domain-specific info (ground reflectivity, weather); keeping BN local adds zero communication overhead
195. **On-vehicle Orin LoRA training**: 5 epochs on 1,000 LiDAR frames takes 1-3 min on Orin AGX during charging/idle
196. **Byzantine-robust FLTrust**: Essential for production — handles sensor degradation, corrupted data, supply-chain compromise
197. **Break-even ~10 airports (Year 3)**: FL infra $300K over 3 years saves $470K/year in data transfer + $200K/year labeling vs centralized
198. **Total cost 50 airports**: $130K/year FL vs $1.3M/year centralized (10x reduction)

### Causal Reasoning & Counterfactual Planning
199. **EU PLD 2024/2853 creates legal urgency**: "Rebuttable presumption of causality" — if Aurrigo can't provide causal explanations, courts may presume the AV caused the incident. Transpose deadline December 2026
200. **SCMs with physics-based equations**: Airside has well-defined dynamics (braking, stopping distance, jet blast) as structural equations — practically grounded, not abstract
201. **Counterfactual trajectory analysis**: Binary search determines "braking 0.3s earlier would have prevented incident" — precise, actionable, impossible from correlation methods
202. **Halpern-Pearl actual causation**: Formalizes root cause analysis, quantifies degree of responsibility (dr = 1/(1+k)) for multi-agent incidents
203. **NOTEARS causal discovery**: Learns causal DAG from fleet data as continuous optimization; validates/challenges expert-specified causal graph
204. **LLMs useful for causal graph construction, unreliable for inference**: GPT-4 achieves only 57% on counterfactual reasoning (CLadder) vs 90%+ human. Hybrid LLM+SCM approach leverages both strengths
205. **Causal ROS node**: 2 Hz parallel to 10 Hz perception/planning loop, minimal overhead, stores for post-hoc analysis
206. **Phase 1+2 costs $40-65K, 10-14 weeks**: SCM + incident pipeline provides immediate ISO 3691-4 and EU AI Act compliance value
207. **Airside DAG tractable**: ~30-40 variables, 7 layers — exact inference, no approximation needed
208. **No public airside causal model exists**: Building one would be a significant competitive advantage for safety certification

### RL Driving Policy
209. **CaRL (CoRL 2025)**: SOTA open-source RL planner on CARLA Leaderboard 2.0 and nuPlan. Key insight: PPO with simple route-completion reward scales with batch size; complex shaped rewards don't
210. **IQL is best offline RL for driving**: Consistent across traffic densities, no OOD action evaluation, single hyperparameter (expectile τ). 2026 AEB study confirms superiority over CQL and BPPO
211. **BC→Offline RL→Online RL pipeline**: BC warm start (90% Frenet), IQL fine-tuning (+5-15%), PPO in simulation (+10-20%). Each phase de-risks the next
212. **CBF safety filter decouples performance from safety**: RL focuses on efficiency; CBF-QP guarantees collision avoidance. Matches Simplex: RL advanced + Frenet fallback
213. **Privileged-to-sensor distillation**: Train with ground-truth state, distill to sensor-input student (0.5ms FP16 Orin). Total: 14.8ms perception + 0.5ms policy + 1.0ms CBF = 16.3ms
214. **Total $45-75K over 32 weeks**: From BC baseline through production deployment with safety guarantees

### HD Map Change Detection & Maintenance
215. **Fleet-based change detection reduces maintenance cost 60-80%**: Vehicles as continuous mapping sensors; 20 vehicles × 16h/day = dozens of observations per apron point daily
216. **RTMap (ICCV 2025)**: Centimeter-level real-time recursive map maintenance with noise-aware probabilistic density inference
217. **Bayesian fleet consensus**: Per-vehicle reliability modeling, posterior >0.99 for safety-critical updates, vehicle reputation scoring for systematic sensor failure filtering
218. **AIRAC dual-layer architecture**: Regulatory layer (AIRAC-sourced, 28-day cycle, takes precedence) + operational layer (fleet-sourced, continuous updates). Fleet cannot override taxiway designations or holding positions
219. **Light-map alternative**: Topology graph + safety zones + regulatory overlay (~720 KB) vs 50 MB HD map. Online perception fills geometry. Maintenance drops from $28-56K/year to $2-5K/year per airport
220. **Break-even at 2-3 airports**: Fleet-based maintenance ($55-75K setup + $55-100K/year) cheaper than quarterly manual re-survey at 2-3+ airports

### Fleet TCO & Business Case
221. **Minimum viable fleet for positive ROI: 15-20 vehicles** at a single high-labor-cost airport. Below 10, R&D/certification amortization kills the economics
222. **3-shift labor savings $150K/year per position**: Primary economic driver (55-65% of total benefit). Break-even when labor exceeds ~$130-140K/year per position
223. **Scale dynamics**: Pilot $400-650K/vehicle → mature 200-fleet $155-330K/vehicle. Primary driver is R&D amortization, not hardware volume discounts
224. **10-year NPV $45-80M at 200 vehicles (8% discount)**: Probability-weighted expected NPV ~$25M across scenarios. Regulatory delay -$8-15M per 12 months
225. **RaaS $10-14K/month per vehicle**: Cost-neutral for US hub ground handler replacing 3-shift coverage. Most likely initial deal structure
226. **UISEE manufacturing cost 40-60% lower**: Most serious competitive threat. Response: differentiated safety story, OEM integration, EU/US regulatory head start

### V2X Protocols & Airside Message Standards
227. **No V2X standard for airport airside exists**: ICAO, ACI, SAE have not addressed GSE communication. First-mover defines de facto standard
228. **8 custom airside message types defined**: APA (aircraft proximity), SOS (stand status), GTA (task assignment), DZN (de-icing), EVP (emergency vehicle), RIP (runway incursion, default-deny), FDA (FOD), JBW (jet blast — highest criticality, invisible to LiDAR/cameras)
229. **C-V2X over private 5G/CBRS preferred**: Sub-ms URLLC latency, 1+ Gbps, native network slicing. Safety-critical messages require <20ms end-to-end
230. **50-vehicle fleet needs ~123 Mbps V2X bandwidth**: Within 5G capacity; zone filtering needed at 200+ vehicles
231. **RIP default-deny model**: No explicit clearance = HOLD at hold-short lines. Network failure = HOLD. Most safety-critical V2X message
232. **Cooperative perception via V2X adds 15-25% AP**: Where2comm feature sharing at 160 KB/frame achieves 95.3% of full raw-data sharing
233. **Total $270-450K for full V2X capability**: Phase 1 (basic) $120-200K/16-20 weeks, Phase 2 (full) additional $150-250K/16-24 weeks

### LiDAR Data Augmentation
234. **GT-database sampling boosts rare classes +15-25% AP**: Pre-computed ground-truth boxes pasted into training scenes; airside-specific catalog of 10 classes (aircraft, 5 GSE types, personnel, FOD, barriers, cones)
235. **PolarMix (CVPR 2022)**: +3-7% mAP via polar-coordinate mixing; best augmentation for LiDAR scan patterns (preserves radial density falloff)
236. **LiDAR corruption augmentation critical for airside**: Rain/fog/beam dropout/de-icing fluid spray simulation bridges sim-to-real gap for weather-degraded perception
237. **Cross-airport GT database sharing**: Zero-cost diversity injection — rare classes from Airport A appear in Airport B training. Federated GT-DB complements federated learning
238. **40-60% labeling reduction**: Augmentation + GT-DB sampling reduces annotation requirements from 5,000+ to 2,000-3,000 frames per airport; saves $15-45K per airport

### Night Operations & Thermal Fusion
239. **Asymmetric late fusion is optimal**: LiDAR primary (geometry) + thermal secondary (personnel/hazard detection), not symmetric fusion. Thermal fails gracefully — LiDAR still provides >90% safety value alone
240. **Hi-vis paradox solved by thermal**: 84-88% camera AEB failure rate at night with hi-vis → 85-92% thermal detection AP regardless of clothing reflectivity
241. **YOLO-Thermal INT8 on Orin**: 6-8ms inference, total night pipeline 22.8-25.8ms (38-44 Hz) — fits within 50ms planning cycle
242. **Thermal-only hazard detection**: Jet blast invisible to LiDAR/camera/radar; fuel spill detectable via evaporative cooling signature. Thermal is the only passive sensor for both
243. **Night ODD = subset of daytime ODD**: Restrict to mapped routes, reduce speed 20-30%, increase margins 50%, require thermal health for night authorization
244. **Hardware cost per vehicle**: $6,700-22,600 depending on 2-4 thermal cameras (FLIR Boson 640 + enclosure + integration)

### Sparse Attention for 3D Point Cloud Perception
245. **Dense attention impossible for LiDAR**: O(n^2) over 120K+ points = 53.6 GB per attention matrix. Every practical 3D transformer uses sparse attention
246. **PTv3 serialized attention (CVPR 2024 Oral)**: 80.4% mIoU nuScenes, 3x faster, 10x less memory than PTv2 via space-filling curve serialization + standard FlashAttention
247. **FlatFormer (CVPR 2023)**: First real-time point cloud transformer — 4.6x faster than SST, 1.4x faster than CenterPoint, 16ms INT8 on Orin
248. **LitePT (CVPR 2026)**: 3.6x fewer params, 2x faster, 2x less memory than PTv3 — achieves 82.2 mIoU NuScenes with only 12.7M params. Key insight: convolutions for low-level geometry, attention only in deep low-resolution layers
249. **FlashAttention mandatory on Orin**: 204.8 GB/s bandwidth (10x less than A100); without FlashAttention, attention models 3-5x slower than necessary
250. **Window size 256-512 optimal for Orin**: Smaller (128) underutilizes Tensor Cores; larger (1024+) overflows 4 MB L2 cache. PTv3's default 1024 windows should be halved for Orin
251. **PointPillars still unbeatable for safety path**: 6.84ms INT8 on Orin — no attention-based model comes close. Simplex: attention model (AC) + PointPillars (BC)

### Multi-LiDAR Extrinsic Calibration
252. **0.1 degree error = 17 cm at 100m**: Sub-centimeter calibration accuracy is safety-critical for 4-8 RoboSense multi-LiDAR stacks. Ghost detections and split objects degrade GTSAM localization
253. **Combined approach is optimal**: Factory target-based initialization (<0.5cm/<0.05deg) + continuous GTSAM-integrated online refinement with thermal lookup tables = sustained sub-centimeter accuracy
254. **Thermal drift compensation essential**: Airport tarmac ranges -10C to +50C; LiDAR mounts drift ~0.02-0.05 deg/10C without compensation lookup tables
255. **PTP/PPS synchronization**: IEEE 1588 PTP over Ethernet achieves <1us inter-LiDAR synchronization — critical when fusing 4-8 sensors at 10Hz
256. **Automated fleet calibration saves 400-800 hours/year**: For 20+ vehicle fleet, eliminates periodic manual recalibration; provides ISO 3691-4 traceability records automatically

### Streaming & Temporal Perception
257. **Multi-sweep LiDAR is highest-value temporal method**: 3-sweep ego-compensated accumulation adds only 1.4ms but provides velocity estimation, point densification, and +2.5% mAP
258. **StreamPETR: best temporal per FLOP**: Object query propagation adds <3ms and 128 KB memory, provides +6-8% NDS and implicit multi-object tracking (AMOTA 65.3%)
259. **Sparse4D v3 is sparse query SOTA**: 71.9% NDS and 67.7% AMOTA on nuScenes test, unified detection+tracking without explicit data association
260. **Slow airside speeds need longer temporal windows**: 1-5 km/h objects require 10+ frame windows (1s+). Standard 5-frame insufficient
261. **Temporal filtering eliminates transient noise**: De-icing spray, jet blast shimmer, puddle splash — 3-frame persistence filter removes at zero accuracy cost
262. **Extended track persistence essential**: Class-dependent: 30s for GSE, 300 frames for aircraft, 3s for personnel (safety-critical, shorter window)
263. **Implementation**: $38K over 13 weeks, phased from multi-sweep (2 weeks, $5K) through StreamPETR (4 weeks, $15K)

### Active Perception & Sensor Scheduling
264. **Context-aware switching saves 35-45% compute**: 80% of airside time is low-complexity (taxiways, idle) where lightweight models suffice
265. **Safety baseline always runs**: PointPillars at 6.84ms runs every cycle regardless of context — Simplex BC for perception
266. **Multi-LiDAR scheduling reduces processing 40-45%**: Only 3-4 of 8 LiDARs need full processing at any time based on direction and detections
267. **Foveated voxelization reduces voxels ~89%**: 0.1m near, 0.8m far — fine-grained close perception + long-range awareness simultaneously
268. **Power savings 30-36% per shift**: Context-weighted ~16W avg vs 25W constant. ~72 Wh/shift savings for battery-powered electric GSE
269. **Runway crossing overrides all optimization**: Maximum perception always during runway operations. No degradation possible

### Formal Verification of Neural Networks
270. **Layered verification strategy**: Complete (SMT/MILP) for small safety-critical components (<100K params), over-approximation (alpha-beta-CROWN) for perception backbones, runtime for residual
271. **alpha-beta-CROWN**: VNN-COMP winner, scales to millions of parameters with conservative bounds. Most practical tool for PointPillars/CenterPoint robustness certification
272. **Policy networks are fully verifiable**: RL policy heads (500K params, 3-layer MLP) can be completely verified with Marabou in minutes
273. **Certified training (IBP/SABR)**: Builds robustness guarantees into model from start — 2-5% accuracy cost for provable Lp robustness
274. **Lipschitz bounds for safety margins**: If network has Lipschitz constant L, input perturbation ε guarantees output change ≤ L×ε. Directly maps to safety distance margins
275. **EU AI Act + 2027 Machinery Regulation create legal urgency**: High-risk AI systems require conformity assessment including robustness verification

### Radar-LiDAR Fusion for Adverse Weather
282. **L4DR (AAAI 2025)**: +20% mAP in dense fog via radar-conditioned LiDAR denoising — radar guides which LiDAR returns to trust
283. **Asymmetric mid-level fusion optimal**: LiDAR-primary + radar-augmented (not symmetric). Radar contributes velocity and weather resilience; LiDAR contributes spatial precision
284. **Continental ARS548**: 300m range, 800 detections/frame, 20Hz, $500-1500 — best price-performance 4D imaging radar for integration
285. **Adaptive fusion gating**: Learned weather-aware weights (0.1-0.9 radar contribution) automatically shift to radar-dominant in fog/rain
286. **De-icing spray detection**: Radar Doppler signatures detect spray events; triggers automatic radar-primary mode switching
287. **4-mode degradation management**: NORMAL → DEGRADED → IMPAIRED → EMERGENCY with speed/margin adjustments per mode
288. **Implementation**: $35-55K over 12 weeks, phased from early fusion ($8-12K) through adaptive gating ($10-15K)

### Sensor Degradation & Health Monitoring
289. **10 airside contamination sources**: De-icing fluid (severity 5/5), engine exhaust soot, rubber dust, hydraulic spray, fuel mist, bird strike residue, sand/dust storms, jet blast debris, rain/puddle splash, insect accumulation
290. **LiDAR 7-check diagnostics**: Point count, max range, angular coverage, intensity distribution, near-field saturation, beam uniformity, temporal consistency — all at 1 Hz with <2ms total
291. **Cross-sensor consistency scoring**: Compare detections across LiDAR, radar, thermal, camera — disagreement indicates sensor degradation rather than environment change
292. **Predictive maintenance via linear extrapolation**: Project health trends to predict when cleaning/service needed; schedule during charging windows
293. **Response matrix**: 4 sensors × 4 severity levels = 16 response states from "log only" to "full stop + maintenance alert"
294. **Fleet-level analytics**: Zone-correlated degradation patterns reveal environmental contamination hotspots (e.g., stand 12 always degrades LiDAR faster)
295. **Implementation**: $35K over 11 weeks, no additional hardware required

### Autonomous Docking & Precision Positioning
296. **Airside docking tolerances +-5-10cm**: 10-100x tighter than open-road driving. Belt loaders +-5cm, pushback tugs +-10cm for nose gear capture
297. **Two-phase architecture**: Coarse Frenet planner to DAP (3-5m from target), then handoff to 20-50 Hz fine docking controller with dedicated proximity sensors
298. **ICP template alignment**: +-1-2cm accuracy at docking range using existing RoboSense LiDARs. Templates per aircraft type ~50 KB each
299. **AprilTag fiducials**: +-0.5cm at 2m, 50+ FPS on CPU. Highest-accuracy lowest-latency option if markers can be placed on docking interfaces
300. **MPC docking control**: CasADi/IPOPT solves 15-step horizon in 2-5ms on Orin. Handles non-holonomic constraints, speed/steering limits, obstacle avoidance
301. **ADT3 crab steering decisive advantage**: Decouples lateral correction from heading — slide sideways for alignment without multi-point turns. No competing platform has this
302. **Pushback requires impedance control**: Position→force control transition at nose gear contact is most complex docking challenge. Requires force/torque sensing
303. **Competitive gap**: UISEE stops short + manual coupling; TractEasy uses teleop for final meters. Autonomous full-tolerance docking is unsolved in production
304. **Implementation**: $53-90K over 12-18 weeks, $2-5K additional hardware per vehicle (docking camera + ultrasonics + bumpers + safety scanner)

### LiDAR Place Recognition & Re-Localization
305. **Missing link in Aurrigo stack**: GTSAM+VGICP has no loop closure, no kidnapped robot recovery, no multi-session map alignment. Long missions accumulate unbounded drift
306. **Two-stage pipeline optimal**: Scan Context on CPU (<5ms, always-on) pre-filters, MinkLoc3D on GPU (~15ms, triggered) verifies. 97%+ recall, GPU used only 10-20% of time
307. **MinkLoc3D**: 97.5% recall@1, 256-byte descriptor, 15ms GPU — best accuracy/speed/maturity tradeoff for airside
308. **Identical-stands problem**: Primary airside challenge — adjacent gates with same geometry cause perceptual aliasing. Odometry-constrained geographic search eliminates 80-90% false matches at zero cost
309. **Aircraft presence disrupts descriptors**: 60m aircraft changes 40-60% of occupied voxels. Height filtering (>4m removal) or ground-plane-only descriptors essential
310. **FAISS million-scale retrieval**: PQ compression (32x) enables 1M entries in ~55 MB, <1ms GPU search. Scales to multi-airport
311. **Fleet shared descriptors**: <2 MB/min bandwidth per vehicle over airport 5G. Cross-vehicle loop closures improve map consistency 15-25%
312. **ICP geometric verification non-negotiable**: Descriptor matching alone produces 5-15% false positives. ICP fitness check (>30% overlap, <0.3m RMSE) reduces to <1%
313. **Implementation**: $33-57K over 12-16 weeks, phased from Scan Context+GTSAM ($8-12K) through fleet cooperative ($10-20K)

### Fleet Task Allocation & Scheduling
314. **CP-SAT (OR-Tools) solves optimally for Aurrigo's scale**: 50 vehicles × 200 tasks in 10-60 seconds. CP-SAT's NoOverlap constraint makes it 5-10x faster than MILP for scheduling problems
315. **Hybrid centralized + decentralized is optimal**: CP-SAT shift planning (2h) + CBBA medium-term (15 min) + SSI auction real-time (per-event). Each layer compensates for the others
316. **A-CDM integration is highest-value**: ELDT gives 15-30 min advance notice. Pre-positioning GSE reduces arrival delay 60-75%, empty travel 30-40%
317. **CBBA converges in O(n) iterations**: 50 vehicles converge in ~2.5 seconds over 5G. Achieves ~95% of centralized optimal with no single point of failure
318. **RL dispatch infers in <1ms**: After 6+ months fleet data, trained PPO policy matches or exceeds human dispatchers. Attention-based architecture handles variable fleet/task sizes
319. **Charging-aware scheduling reduces fleet size 10-15%**: Joint optimization of task assignment and charging vs treating them separately. Opportunity charging during predicted idle windows
320. **No competing airside platform publishes scheduling algorithms**: All use simple rule-based or manual dispatch. Optimal scheduling is a fleet-scale differentiator
321. **Implementation**: $42-67K over 15-17 weeks, phased from CP-SAT solver through RL policy

### Weather-Adaptive ODD Management
322. **5-level ODD (A-E) with asymmetric transitions**: Fast degradation (immediate), slow recovery (2-5 min sustained good conditions). Ensures conservative behavior
323. **METAR + on-vehicle + fleet consensus**: 3-timescale environmental fusion — METAR (30-60 min, official), sensors (1-10 Hz, local), fleet (1 Hz, spatial)
324. **TAF enables predictive ODD**: 24-30h forecasts allow pre-shelter, charging during holds, adjusted fleet allocation. A-CDM combines weather + flight predictions
325. **Capability curves**: Empirically calibrated sensor performance vs environment. LiDAR 60-75% mAP in heavy rain, radar 90-95% — directly computes safe speed
326. **De-icing spray is most severe short-duration hazard**: 60%+ LiDAR loss for 30-120s. Immediate radar-primary switching required
327. **Fog strongest case for radar as primary**: At <500m visibility, LiDAR 50-70% capability vs radar 85-95%. Dense fog (<200m) makes radar the only useful sensor
328. **Continuous speed envelope**: v_max = min(detection-limited, braking-limited, wind-limited, ODD-capped, zone-limited). Not discrete steps
329. **Seasonal profiles**: Winter 30% more visibility margin + 25% battery reserve + daily cleaning. Summer proactive thermal management >42C
330. **Implementation**: $30-50K over 8-12 weeks, METAR parser + state machine + sensor assessment + seasonal profiles

### Robust State Estimation & Multi-Sensor Fusion
331. **ESKF is the production standard**: Error-State Kalman Filter with quaternion error parameterization — used by Waymo, Apollo, Autoware. <0.5ms per update on Orin
332. **Chi-squared innovation gating**: Reject measurements that disagree with prediction by >chi2 threshold. Catches RTK false fixes (GPS multipath near aircraft) before they corrupt state
333. **Multi-hypothesis tracking (IMM)**: When vehicle could be at multiple locations (GPS multipath, similar stands), maintain parallel hypotheses. Prune when evidence converges
334. **GPS-denied dead-reckoning budget**: IMU + wheel odometry: ~10-30 seconds before uncertainty exceeds 0.5m (safety threshold). Place recognition extends to minutes
335. **Adaptive noise estimation (Sage-Husa)**: Learn true sensor noise from innovation sequences. Prevents filter divergence from model mismatch
336. **Fleet-level state consistency**: Relative pose constraints between vehicles observing same landmarks. Collaborative localization improves per-vehicle accuracy 15-25%

### Real-Time Occupancy Grid Mapping
337. **Log-odds Bayesian update**: Numerically stable, O(1) per ray, trivially parallelizable on GPU. Foundation for all occupancy representations
338. **VDBFusion for airside**: Sparse voxel hashmap — only stores occupied/observed space. 500x less memory than dense grid for 200m apron at 0.2m resolution
339. **GPU raycasting processes 4-8 LiDARs at 10Hz**: Custom CUDA kernel with DDA ray marching. ~2-5ms for 400K-1.2M points per cycle on Orin
340. **Multi-resolution grid optimal**: 0.1m near vehicle (safety), 0.2m medium (planning), 0.8m far (awareness). Reduces memory 80%+ while preserving safety-critical detail
341. **ESDF for planning**: Euclidean Signed Distance Field from occupancy enables gradient-based trajectory optimization. nvblox provides ESDF natively
342. **Fleet-shared occupancy**: Compressed delta updates over 5G. Each vehicle contributes local observations; fleet manager merges into global map
343. **Highest-value perception infrastructure upgrade**: Provides spatial backbone for neural occupancy, flow prediction, CBF safety filtering, cooperative perception. Currently missing from Aurrigo stack
344. **Implementation**: $25-40K development, no additional hardware

### Imitation Learning & Behavioral Cloning
345. **DAgger with Frenet expert is lowest-risk IL entry point**: Frenet planner as oracle in simulation, iterative dataset aggregation. 90%+ of expert performance with 500-1,000 labeled trajectories
346. **MDN for multimodal BC**: Mixture of K=5 Gaussians captures mode switching (lane change, stop, continue). Single Gaussian averages over modes (dangerous)
347. **Diffusion BC achieves SOTA**: DDIM 3-5 steps at 15-30ms on Orin. Better coverage of trajectory distribution than MDN
348. **MaxEnt IRL learns Frenet cost weights from demonstrations**: Recover implicit cost function from teleop data. Augments existing Frenet planner without replacing it
349. **Three integration modes**: (1) IRL costs into Frenet, (2) learned scoring of Frenet candidates, (3) full BC policy with Simplex fallback. Ascending risk/reward
350. **Style-conditioned BC handles multi-operator variance**: Encodes operator identity as conditioning vector. Prevents averaging of different driving styles

### Joint Prediction-Planning
351. **Sequential predict-then-plan causes "frozen robot" problem**: Overconservative predictions (max entropy) yield overly cautious plans. Joint models reduce unnecessary stops 50-67%
352. **PDM-Closed embarrassingly effective**: Simple rule-based planner with occupancy scoring matches or beats many learned planners on NAVSIM/nuPlan
353. **Frenet augmentation with prediction costs captures 70-80% of benefit**: Add occupancy flow and conditional prediction scoring to existing 420-candidate Frenet planner at 10% of full implementation cost
354. **Game-theoretic interaction modeling essential for airside**: Level-K/Stackelberg reasoning handles right-of-way negotiation between 10-30 GSE agents at turnaround stands
355. **Contingency planning**: Branch over top-k prediction modes, select branch closest to all. Handles multi-modal futures without committing early

### Fail-Operational Architecture
356. **Fail-operational ≠ fail-safe**: L4 cannot just stop on failure — must reach MRC. Pushback mid-operation requires operation completion (60-300s), not abandonment
357. **ASIL D decomposition into ASIL B(D) + ASIL B(D)**: Neural stack (Unit A) + classical stack (Unit B) + ASIL D safety monitor (STM32/FSI). Neither channel alone needs ASIL D
358. **Orin FSI provides on-chip ASIL D capability**: 4x DCLS R52 cores, ~10K MIPS, independent of GPU/CPU. Run safety bag, watchdog, geofence on FSI — available now on existing hardware
359. **Dual power domains with diode-OR most overlooked improvement**: Single DC-DC failure kills entire stack. Dual power is cheap and prevents most common total-loss failure mode
360. **Runway incursion geofence must be hardware-enforced**: GPS polygon check on safety MCU at 100Hz, independent of autonomy stack. Cannot be overridden by software
361. **Low speed is best safety margin**: At 10 km/h, stopping distance ~2m, timing budget 10x more relaxed than highway. Airside GSE speeds naturally provide this advantage
362. **Phase 1 Safety MCU enhancement ($15-25K)**: Highest ROI — watchdog, safety bag, geofence on existing STM32. Before adding expensive redundant hardware

### AV CI/CD & DevOps Pipeline
363. **AV CI/CD is 5-pipeline integration**: Code CI + ML model CI + simulation CI + map/config CI + fleet deployment CD. Most teams build only code CI
364. **SIL/HIL/VIL simulation gates before fleet deployment**: Scenario regression (1,000+ scenarios), performance benchmarks (mAP, L2, collision rate), safety metric non-regression
365. **ML regression detection requires nuanced metrics**: mAP can improve overall while critical rare classes degrade. Per-class + per-scenario regression checks mandatory
366. **Canary deployment (10% fleet)**: 2-hour monitoring window before fleet-wide rollout. Automatic rollback on safety metric regression
367. **Safety assurance traceability**: Bidirectional links from safety requirement → design → code → test → evidence. Required for ISO 3691-4 / EU Machinery Regulation

### Solid-State LiDAR & Photonic Integrated Circuits
368. **Solid-state saves $150-450K/year for 50-vehicle fleet**: Reduced sensor replacement (100K+ hr MTBF vs 20K hr mechanical), less downtime, lower maintenance labor
369. **FMCW provides per-point velocity at zero additional latency**: Eliminates 300-500ms tracking delay; transformative for jet blast detection (only sensor detecting exhaust flow velocity)
370. **1550nm eye safety critical for airside**: 100x higher safe power limit vs 905nm protects ground crew working 1-2m from sensors
371. **Voyant Helium is long-term target**: Photonic focal plane array, truly no moving parts, <150g, $200-500 at volume. Prototype CES 2026
372. **Aeva Atlas is near-term practical choice**: FMCW + MEMS, 300m range, automotive-grade, production 2025. Bridge technology while OPA matures
373. **OPA enables foveated perception**: Dynamic resolution allocation — more points on aircraft/personnel, fewer on empty taxiway. 2-5x effective resolution improvement

### Deterministic Real-Time Networking (TSN)
374. **TSN reduces safety message latency 50-200x**: E-stop delivery drops from ~0.5-2 ms (CAN) to <10 μs (TSN with frame preemption)
375. **gPTP provides <100 ns sensor synchronization**: Eliminates software timestamp jitter (1-10 ms) causing mm-level fusion errors
376. **Mixed-criticality on one network**: Safety, control, sensors, diagnostics share single TSN Ethernet backbone with guaranteed isolation via TAS/PSFP
377. **Hardware cost minimal: $230-440/vehicle**: Negligible compared to compute ($1-2K) or LiDAR ($6-24K)
378. **Orin natively supports TSN**: Hardware timestamping, gPTP, TAPRIO available on Orin Ethernet ports
379. **BMW, Mercedes, Volvo already in production**: Automotive-grade silicon (NXP SJA1110, Marvell 88Q6113) proven

### Spatial Foundation Models for Airport Robotics
380. **Driving-only models insufficient for airport robotics**: Heterogeneous tasks (docking, cargo alignment, FOD characterization) each require separate training pipeline
381. **4M unified multimodal model**: Single architecture handles depth, normals, semantics, edges from any input — multiple airport perception tasks from one model
382. **RT-2/Octo enable cross-embodiment transfer**: Pre-train on web-scale data, fine-tune on 500-2000 airport demonstrations per task
383. **Two-tier deployment**: Heavy model (cloud/edge server, 1-2 Hz) + lightweight distilled policy (Orin, 10 Hz) + Simplex safety wrapper
384. **No public airside embodied AI benchmark exists**: Opportunity to define docking accuracy, spatial QA, FOD detection, task completion metrics

### Fleet Predictive Maintenance & Spare Parts
385. **Correlated airside failures are the unique challenge**: De-icing spray, salt spray season, heat events cause fleet-wide simultaneous degradation — not independent failures
386. **LiDAR MTBF in airside conditions ~20K hours**: Weibull β=1.8-2.2, 50-vehicle fleet with 6 LiDARs needs ~100-200 replacements/year at $2-5K each
387. **Multi-echelon inventory**: On-vehicle → airport depot → regional hub → OEM. Cold-start sizing for new airport: $50-150K depending on fleet size
388. **Joint maintenance-operations scheduling**: Use charging windows, weather holds, low-demand periods. 1 technician per 8-15 vehicles at maturity
389. **Predictive vs reactive saves 30-40% total maintenance cost**: Implementation $50-80K, annual savings $30-60K per 20-vehicle fleet

### Energy-Efficient Inference for 24/7 Operations
276. **Orin 15W mode is viable for idle/taxiway**: CenterPoint at 15W: ~20ms (still <50ms budget). PointPillars-Lite: ~10ms. Saves 35-45W vs MAXN
277. **Dynamic model switching reduces average power 30-40%**: Lightweight models on straight taxiways, full stack at stands and crossings
278. **Thermal throttling is real at +50C tarmac**: Sustained 50W in hot ambient causes throttling after 15-20 minutes. Proactive power reduction prevents throughput collapse
279. **DLA concurrent scheduling**: Run segmentation on DLA (5-10W) while detection runs on GPU. 2 models at cost of ~1.3× power vs 2× sequential
280. **Fleet energy optimization**: Route planning that incorporates charging station proximity and compute-heavy zones (stands, crossings). Coordinate which vehicles run full perception
281. **8-15% more daily operating hours**: Power optimization extends battery range meaningfully for 24/7 electric GSE

### Cloud Backend Infrastructure
390. **Three-zone data lake (Bronze/Silver/Gold)**: S3 event-driven ingestion with Lambda, rosbag extraction via K8s jobs, feature store (Feast) for ML training, Airflow orchestration with 7 DAGs
391. **Vehicle data egress**: Priority-based upload queue (safety events first, mapping second), 50GB/day budget per vehicle over 5G, automatic bandwidth adaptation
392. **Cost**: $200-460/vehicle/month depending on fleet size; $80-135K implementation over 28 weeks. Streaming telemetry separate from bulk rosbag pipeline
393. **Multi-airport data isolation**: Per-airport S3 prefixes, IAM policies, cross-airport access only for shared model training. GDPR/airport sovereignty compliance

### HD Map Construction Pipeline
394. **5-7 working days per airport at $20-35K**: Survey drives (3 patterns), multi-session SLAM (FAST-LIO2+GTSAM), geodetic alignment (RTK+GCPs ±5-10cm), auto-annotation (SAM+CLIP), Lanelet2 generation, QA, deployment
395. **Multi-session dynamic object removal**: Points observed in <K of N sessions are classified as dynamic and removed — no need to survey empty airport
396. **AMDB bootstrap free for 500+ US airports**: Provides topology structure; LiDAR provides geometric precision. Combined eliminates manual topology creation (most labor-intensive step)
397. **Auto-annotation 85-92% accuracy**: SAM+CLIP handles primary classes; hold-short lines (100% recall required) and rare features (fuel hydrants, drainage grates) need manual QC
398. **Per-airport cost drops ~50% by airport 20**: Tooling amortization + operator experience. No complete open-source airside map pipeline exists — competitive moat

### Edge-Cloud Hybrid Inference
399. **Three-tier architecture**: On-vehicle Orin (safety-critical, always autonomous) + airport MEC edge server (VLMs, cooperative fusion, analytics) + cloud (training, fleet intelligence)
400. **Edge amortizes expensive GPU across fleet**: $2,500/vehicle for shared edge server vs $2,000-5,000/vehicle for individual Thor upgrades. A100/H100 edge server shared by 20-50 vehicles
401. **Airport advantage**: Bounded geography, private 5G, vehicles return to depot — uniquely suited for edge compute. Highway AVs cannot rely on infrastructure
402. **Graceful degradation is non-negotiable**: Vehicle must always operate fully autonomously. Edge enhances but never gates safety. Simplex BC runs entirely on-vehicle

### Automated Sensor Cleaning
403. **De-icing glycol and jet fuel require chemical cleaning**: Air jets alone spread these contaminants — washer fluid + wiper mandatory. Most critical airside-specific cleaning insight
404. **Germanium thermal windows**: Cannot tolerate mechanical wipers. Air-only cleaning with DLC or germanium-compatible hydrophobic coatings
405. **$200-500/vehicle hardware, 15-40W average power, 1.5-3 kg**: Pays for itself in first month by avoiding $30-60 depot cleaning visits (30-60 min downtime each)
406. **Health monitor closed-loop**: Degradation detection → cleaning trigger → post-cleaning validation → persistent degradation → depot alert. Fully automated response

### Ramp Traffic Conflict & Deadlock Prevention
407. **CBF prevents crashes but creates deadlocks**: Reactive collision avoidance is insufficient for fleet coordination. Vehicles stopping to avoid collision can cascade into fleet-wide gridlock on narrow single-lane service roads
408. **Wait-die protocol prevents deadlock by construction**: Total ordering on zone acquisition guarantees no circular wait. Zone reservation graph for 50-vehicle fleet has <500 nodes, solvable in <10ms
409. **9-level priority hierarchy**: Emergency > pushback > fueling > belt loader > catering > baggage > repositioning > depot return. Deterministic conflict resolution at runtime
410. **MAPF algorithms directly applicable**: CBS/ECBS for offline shift planning, PIBT/LaCAM* for real-time — airport scale (50-100 agents) is well within solved territory
411. **No competing airside platform publishes deadlock prevention**: Critical gap at 20+ vehicle fleet scale

### EV Fleet Energy Co-Optimization
412. **Joint charging-routing-task optimization saves 10-15% fleet utilization**: Treating charging separately from task assignment leaves vehicles stranded or creates unnecessary depot trips
413. **50-vehicle fleet = ~1-2 MWh dispatchable storage**: V2G demand response revenue $50-200/MWh during airport peak demand (terminal HVAC, de-icing). Potential $20-60K/year revenue
414. **Demand charge management critical**: Fleet-wide simultaneous charging creates $10-20/kW/month demand spikes. Staggered charging scheduling saves 15-25% of electricity costs
415. **LiFePO4 degradation-aware charging**: 0.5C charging extends battery life 40-60% vs 2C fast charging. Optimal: opportunity charge at 1C, depot overnight at 0.5C

### Test-Time Training for Airport Onboarding
416. **TTT > TTA for sharp domain shifts**: TTA (TENT, BN stats) updates only normalization; TTT uses gradient-based auxiliary tasks for deeper adaptation. 10-20% more domain gap recovery
417. **Online LoRA with MAE loss on Orin**: Rank 4-8 LoRA + point cloud MAE as self-supervised task. 1-3 gradient steps per batch within 50ms compute budget on Orin
418. **Catastrophic forgetting bounded by anchor loss**: Penalize deviation from pre-deployment weights. Combined with EWC (Fisher information) prevents TTT from diverging
419. **Simplex integration**: TTT-adapted model as Advanced Controller, frozen pre-deployment model as Baseline Controller. OOD detection triggers TTT; sustained degradation falls back to frozen

### Fleet Anomaly Root-Cause Attribution
420. **Automated attribution reduces MTTR 60-80%**: From hours of manual investigation to minutes of automated causal analysis. Critical at 20+ vehicles across multiple airports
421. **Hierarchical anomaly detection**: Fleet → airport → vehicle → subsystem → component. CUSUM/EWMA for drift, Isolation Forest for multivariate, autoencoder for telemetry
422. **NOTEARS causal discovery**: Learns causal DAG from fleet telemetry as continuous optimization. Variables: intervention rate, mAP, localization error, weather, OTA version, map age
423. **OTA regression attribution**: Automatic A/B comparison between canary (new) and fleet (old) versions. Per-class, per-scenario regression detection prevents model quality regressions from reaching full fleet

### Production LiDAR-to-Map Localization
424. **VGICP is the right primary method**: GPU-accelerated VGICP on Orin achieves ±3-8 cm at 15-25 ms — best accuracy/speed tradeoff. Multi-resolution coarse-to-fine (NDT→VGICP) provides both large convergence basin and high accuracy
425. **Eigenvalue-based degeneracy detection is essential**: Without it, the system hallucinate position updates in featureless areas (open aprons, straight taxiways). Eigenvalue ratios of the Hessian reveal unconstrained DoFs
426. **Five-level fallback hierarchy**: VGICP → NDT → GPS → dead reckoning (30s budget) → safe stop. Downgrades immediate, upgrades require 5s sustained improvement (hysteresis)
427. **Airside has 40-70% dynamic content at stands**: Aircraft, GSE, personnel occlude map features far more than urban driving. Cauchy robust kernel (delta=0.5m) essential for outlier rejection
428. **Per-LiDAR structural scoring optimizes compute**: Not all 4-8 LiDARs see useful structure. Selecting best 2-3 for matching saves 30-50% compute while maintaining accuracy

### On-Vehicle Data Triage & Selective Upload
429. **Ring buffer architecture on NVMe**: Multi-tier buffers (LiDAR 10Hz, camera, IMU 500Hz, CAN, GTSAM poses) with 1-4 TB NVMe SSD. Lock-free concurrent writes from multiple sensor callbacks
430. **Event-triggered clip extraction**: Safety events, perception OOD spikes, GTSAM innovation anomalies, operator flags — each with 30-60s pre-roll + 30s post-roll. Priority-tagged for upload scheduling
431. **Edge scenario classification enables smart annotation**: Lightweight CNN/DLA classifiers categorize clips (near-miss, novel object, adverse weather, sensor degradation) so cloud prioritizes what gets labeled
432. **50 GB/day upload budget per vehicle**: Priority queue: safety first → perception edge cases → mapping → routine diversity. Opportunistic upload during charging. LZ4 for point clouds, H.265 for camera

### Online Perception Monitoring & ODD Enforcement
433. **ML perception can silently degrade with healthy sensors**: Domain shift, model staleness, adversarial natural conditions (jet blast shimmer, de-icing spray, puddle reflections) cause neural network unreliability that no hardware diagnostic detects
434. **Input distribution monitoring catches domain shift**: KL divergence and MMD on perception backbone features detect when live data diverges from training distribution — near-zero additional compute cost
435. **Output consistency checking via CUSUM/EWMA**: Statistical process control on detection counts, class distributions, confidence scores, and tracking metrics detects gradual degradation without ground truth
436. **Perception Health Score drives graduated response**: Bayesian fusion of input monitoring, output consistency, cross-modal agreement, and OOD scores into single 0-1 score. Drives NORMAL→DEGRADED→RESTRICTED→SUSPENDED transitions with hysteresis

### Map Tile Versioning & Distribution
437. **Maps are NOT the same as models for OTA**: Spatial locality (vehicle only needs nearby tiles), temporal criticality (AIRAC mandated changes), safety implications (localization jump during swap can cause collision). Different distribution architecture needed
438. **Differential updates average 2-8% of full tile size**: Content-addressable storage (SHA-256 Merkle tree) enables efficient diff computation. 50-vehicle fleet consumes <500 MB/month in map updates
439. **Atomic swap protocol guarantees zero perception gaps**: Stage complete update, verify integrity, swap during low-risk segment (straight taxiway). Rollback if localization quality degrades. Never swap during docking or runway crossing
440. **AIRAC 28-day cycle integration**: Safety-critical map changes (hold-short lines, geofences, runway exclusion) have regulatory deadlines. Fleet must converge within AIRAC transition window

## Entry Points

- **Start here**: `90-synthesis/master/master-synthesis.md`
- **POCs**: `90-synthesis/poc-roadmaps/poc-proposals.md` (8 models, $2K-5K total)
- **Design**: `90-synthesis/decisions/design-spec.md` (891-line Simplex architecture)
- **Quick start**: `30-autonomy-stack/end-to-end-driving/e2e-world-model-pipeline.md` (7-day plan)
- **Company research**: `companies/<name>/`
- **Autonomy stack**: `30-autonomy-stack/<domain>/`
- **Safety/certification**: `operations/safety/`
- **Hardware specs**: `hardware/`
- **Math foundations**: `foundations/`
