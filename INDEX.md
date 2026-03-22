# Research Index

## Quick Navigation by Topic

### If you need to know about...

#### A specific company
| Company | Primary | Also mentioned in |
|---------|---------|------------------|
| **Waymo** | `companies/waymo/` (5 docs) | `technology/e2e-driving/company-approaches.md`, `operations/safety/safety-incidents-lessons.md`, `operations/deployment/ota-fleet-management.md`, `operations/deployment/fleet-management-dispatch.md`, `technology/perception/production-perception-systems.md` |
| **Tesla** | `companies/tesla/` (4 docs) | `technology/e2e-driving/company-approaches.md`, `operations/safety/safety-incidents-lessons.md`, `operations/deployment/ota-fleet-management.md`, `technology/perception/production-perception-systems.md` |
| **comma.ai** | `companies/comma-ai/` (2 docs) | `technology/world-models/opensource-implementations.md`, `operations/deployment/shadow-mode.md`, `cross-cutting/opensource-ecosystem.md` |
| **Aurrigo** | `companies/aurrigo/` (3 docs) | `operations/airside/industry-overview.md`, `operations/safety/iso-3691-4-deep-dive.md` |
| **UISEE** | `companies/uisee/tech-stack.md` | `companies/changi-programme/`, `operations/airside/industry-overview.md` |
| **TractEasy/EasyMile** | `companies/tracteasy/` (2 docs) | `operations/safety/iso-3691-4-deep-dive.md`, `operations/airside/industry-overview.md` |
| **Wayve** | `companies/wayve/` (4 docs) | `technology/e2e-driving/company-approaches.md`, `technology/world-models/overview.md` |
| **AeroVect** | `companies/aerovect/tech-stack.md` | `operations/airside/industry-overview.md` |
| **Assaia** | `companies/assaia/tech-stack.md` | `companies/moonware/halo-operations.md` |
| **Fernride** | `companies/fernride/tech-stack.md` | `operations/teleoperation/teleoperation-systems.md` |
| **Applied Intuition** | `companies/applied-intuition/tech-stack.md` | `technology/simulation/airport-digital-twins.md` |

#### World models
| Topic | Primary | Supporting |
|-------|---------|-----------|
| What are world models | `technology/world-models/overview.md` | `synthesis/master-synthesis.md` |
| Diffusion-based | `technology/world-models/diffusion-world-models.md` | `foundations/diffusion-models.md` |
| Occupancy-based | `technology/world-models/occupancy-world-models.md` | `technology/world-models/occupancy-networks-comparison.md` (20 methods) |
| Tokenized / JEPA | `technology/world-models/tokenized-and-jepa.md` | `foundations/vqvae-tokenization.md` |
| RL with world models | `technology/world-models/rl-with-world-models.md` | `technology/world-models/dreamer-world-model-rl.md` |
| OccWorld setup | `technology/world-models/occworld-implementation.md` | `technology/world-models/occupancy-networks-comparison.md` |
| Open-source repos | `technology/world-models/opensource-implementations.md` | 21 repos rated |
| Cutting edge 2026 | `technology/world-models/cutting-edge-2026.md` | Latest papers and SOTA |

#### Perception
| Topic | Primary | Supporting |
|-------|---------|-----------|
| BEV encoding | `technology/perception/bev-encoding.md` | `foundations/pointpillars.md` |
| Open-vocab detection | `technology/perception/open-vocab-detection.md` | YOLO-World, Grounding DINO |
| DINOv2 for driving | `technology/perception/dinov2-foundation-models-driving.md` | LoRA, adapter integration |
| CenterPoint/OpenPCDet | `technology/perception/openpcdet-centerpoint.md` | `hardware/compute/tensorrt-deployment-guide.md` |
| Production systems | `technology/perception/production-perception-systems.md` | Waymo/Tesla/comma sensor suites |
| Sensor fusion | `cross-cutting/sensor-fusion-architectures.md` | BEVFusion, masked modality training |

#### Hardware
| Topic | Primary | Supporting |
|-------|---------|-----------|
| NVIDIA Orin | `hardware/compute/nvidia-orin-technical.md` | 275 TOPS, 8 power modes, benchmarks |
| NVIDIA Thor | `hardware/compute/nvidia-drive-thor.md` | ~1000 TOPS, FP8, OEM commitments |
| TensorRT deployment | `hardware/compute/tensorrt-deployment-guide.md` | DLA, quantization, Lidar_AI_Solution |
| Hesai LiDAR | `hardware/sensors/hesai-lidar.md` | XT32, AT128 ASIL-B, FMC500 SoC |
| RoboSense LiDAR | `hardware/sensors/robosense-lidar.md` | RSHELIOS, RSBP, 7-sensor layout |
| 4D radar | `hardware/sensors/4d-radar.md` | Continental ARS548, weather immunity |
| Airport 5G | `hardware/connectivity/airport-5g-cbrs.md` | `hardware/connectivity/airport-5g-case-studies.md` |

#### Safety & certification
| Topic | Primary | Supporting |
|-------|---------|-----------|
| ISO 3691-4 | `operations/safety/iso-3691-4-deep-dive.md` | 27 functions, $130K-380K |
| Full certification guide | `operations/safety/certification-guide.md` | UL 4600, AMLAS, ISO 26262 |
| Regulatory trajectory | `operations/safety/regulatory-trajectory-deep-dive.md` | FAA, EASA, CAAS, predicted timeline |
| Safety incidents | `operations/safety/safety-incidents-lessons.md` | Cruise, Waymo, Tesla, Uber ATG |
| Failure modes | `operations/safety/failure-modes-analysis.md` | SOTIF, hallucination taxonomy |
| Simplex architecture | `operations/safety/simplex-safety-architecture.md` | RSS, OOD detection, ROS dual-stack |
| Ground crew safety | `operations/safety/ground-crew-pedestrian-safety.md` | 27K accidents/yr, hi-vis paradox |
| Insurance & liability | `operations/safety/insurance-liability-airside.md` | EU PLD, $35M exposure |

#### Airport operations
| Topic | Primary | Supporting |
|-------|---------|-----------|
| Industry overview | `operations/airside/industry-overview.md` | All competitors, regulatory gaps |
| Airport data APIs | `operations/airside/airport-data-integration.md` | `operations/airside/airport-data-systems-detailed.md` (real endpoints) |
| FOD & jet blast | `operations/airside/fod-and-jetblast.md` | B737 148m zone, CFD tables |
| Turnaround prediction | `operations/airside/turnaround-prediction.md` | Moonware HALO, Assaia |
| Pushback systems | `operations/airside/pushback-systems.md` | Mototok, TaxiBot, WheelTug |
| Electric GSE market | `operations/airside/electric-gse-market.md` | $2.8B→$5.2B, autonomy rankings |
| Aviation ecosystem | `operations/airside/aviation-ground-ops-ecosystem.md` | Strategic context, business case |

#### Deployment & operations
| Topic | Primary | Supporting |
|-------|---------|-----------|
| Deployment playbook | `operations/deployment/deployment-playbook.md` | 4,500 lines, full checklists |
| Shadow mode | `operations/deployment/shadow-mode.md` | Tesla/Waymo/comma approaches |
| OTA & fleet management | `operations/deployment/ota-fleet-management.md` | Canary deployment, A/B testing |
| Production ML | `operations/deployment/production-ml-deployment.md` | TensorRT, Triton, GPU reliability |
| Fleet dispatch | `operations/deployment/fleet-management-dispatch.md` | VRPTW, A-CDM triggers |
| Teleoperation | `operations/teleoperation/teleoperation-systems.md` | Fernride, Waymo 1:41 ratio |

#### Mathematical foundations
| Topic | Primary |
|-------|---------|
| PointPillars | `foundations/pointpillars.md` — tensor shapes, TensorRT |
| VQ-VAE / FSQ | `foundations/vqvae-tokenization.md` — straight-through estimator, codebook collapse |
| Transformers | `foundations/transformer-world-models.md` — causal attention, KV-cache, scaling laws |
| Diffusion models | `foundations/diffusion-models.md` — DDPM, DiT, flow matching |
| GTSAM | `foundations/gtsam-factor-graphs.md` — ISAM2, VGICP, neural factors |
| Lanelet2 | `foundations/lanelet2-maps.md` — airport extensions, AIXM conversion |
| Frenet planning | `foundations/frenet-trajectory-math.md` — Werling 2010, quintic polynomials |
| RTK/GPS/IMU | `foundations/rtk-gps-imu-localization.md` — preintegration, NTRIP |
| Mamba SSM | `foundations/mamba-ssm-for-driving.md` — DriveMamba, O(n) vs O(n²) |
| Theory | `foundations/theoretical-foundations.md` — POMDP, free energy, PAC bounds |
| Architecture | `foundations/architecture-innovations.md` — MoE, DiT, flow matching, FSQ |

#### Cross-cutting topics
| Topic | Primary |
|-------|---------|
| Sensor fusion | `cross-cutting/sensor-fusion-architectures.md` |
| Synthetic data | `cross-cutting/synthetic-data-generation.md` |
| Evaluation benchmarks | `cross-cutting/evaluation-benchmarks.md` |
| nuScenes/Waymo guide | `cross-cutting/nuscenes-waymo-practical-guide.md` |
| Transfer learning | `cross-cutting/transfer-learning.md` |
| ROS 2 migration | `cross-cutting/ros2-migration.md` |
| Autoware Universe | `cross-cutting/autoware-universe-deep-dive.md` |
| Open-source ecosystem | `cross-cutting/opensource-ecosystem.md` |
| Embodied AI crossover | `cross-cutting/embodied-ai-crossover.md` |
| Data engine from bags | `cross-cutting/data-engine-from-bags.md` |
| Continual learning | `cross-cutting/continual-learning.md` |

---

#### Synthesis & strategy
| Topic | Primary |
|-------|---------|
| Master synthesis | `synthesis/master-synthesis.md` — Executive summary, tiered recommendations |
| Design spec | `synthesis/design-spec.md` — 891-line Simplex architecture |
| POC proposals | `synthesis/poc-proposals.md` — 8 models with code and costs |
| Competitive landscape | `synthesis/competitive-landscape.md` — All players compared, strategic quadrant |
| Technology readiness | `synthesis/technology-readiness.md` — TRL per POC, go/no-go criteria |
| Getting started | `synthesis/getting-started.md` — Day 1 guide with runnable code |

---

## Document Statistics

| Metric | Value |
|--------|-------|
| Total documents | 156 |
| Total lines | ~134,000 |
| Companies covered | 21 |
| Technology domains | 9 |
| Safety documents | 8 |
| Hardware specs | 12 |
| Foundation theory | 11 |
| Synthesis documents | 6 |
| Papers referenced | 300+ |
| Open-source repos evaluated | 21 |
| Occupancy methods compared | 20 |
| Airport deployments documented | 15+ |
