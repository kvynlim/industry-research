# Industry Research

Comprehensive autonomous vehicle technology research — **156 documents, ~134,000 lines**.

## Directory Structure

```
industry-research/
├── companies/          # 21 companies, 52 docs
├── technology/         # 9 domains, 33 docs
├── operations/         # 4 domains, 23 docs
├── hardware/           # 4 domains, 12 docs
├── foundations/        # 11 docs
├── cross-cutting/      # 17 docs
└── synthesis/          # 6 docs
```

## Quick Start

| Goal | Document |
|------|----------|
| **Day 1: Start coding now** | `synthesis/getting-started.md` (runnable Python code) |
| **Overview of everything** | `synthesis/master-synthesis.md` |
| **What to build first** | `synthesis/poc-proposals.md` (8 POCs, $2-5K total) |
| **Technology readiness** | `synthesis/technology-readiness.md` (TRL per POC, go/no-go) |
| **Competitive landscape** | `synthesis/competitive-landscape.md` (all players compared) |
| **Full architecture** | `synthesis/design-spec.md` (891-line Simplex design) |
| **Get a world model running in 7 days** | `technology/e2e-driving/e2e-world-model-pipeline.md` |
| **Research a company** | `companies/<name>/` |
| **Research a technology** | `technology/<domain>/` |
| **Safety & certification** | `operations/safety/` (8 docs) |
| **Find anything** | `INDEX.md` (topic-based navigation) |

---

### `companies/` — 52 documents across 21 companies

| Company | Docs | Key Research |
|---------|------|-------------|
| **waymo/** | 5 | Tech stack, perception, non-ML, production ops (3K vehicles, $126B), safety methodology (170.7M miles) |
| **tesla/** | 4 | Tech stack, perception, non-ML, FSD production (8.5B miles, V13/V14 architecture) |
| **zoox/** | 4 | Tech stack, perception, non-ML, perception stack detailed |
| **comma-ai/** | 2 | Production world model (first in production), openpilot codebase analysis (FastViT+Policy split, panda safety) |
| **wayve/** | 4 | Tech stack, perception, non-ML, GAIA world model deep dive (1/2/3, $8.6B valuation) |
| **aurrigo/** | 3 | Perception recommendations (v1+v2), production deployment (9 airports, all need safety operator) |
| **uisee/** | 1 | Tech stack (1,000+ vehicles, 50x market leader, HKEX IPO filed) |
| **tracteasy/** | 2 | Production deployment (8 airports, zero accidents), EasyMile tech stack |
| **aerovect/** | 1 | Tech stack ($27.1M raised, retrofit approach, mapped half top 10 US airports) |
| **assaia/** | 1 | Tech stack (21 airports, 450K+ turnarounds, validated 25% delay reduction) |
| **fernride/** | 1 | Tech stack (teleoperation-first, TUV SUD certified, acquired by Quantum Systems) |
| **applied-intuition/** | 1 | Tech stack ($15B valuation, 18/20 top OEMs, Neural Sim) |
| **moonware/** | 1 | HALO operations (JFK/Haneda, 20% delay claim unverified) |
| **changi-programme/** | 1 | Autonomous GSE programme (first fully driverless Jan 2026, Nokia 5G) |
| **cruise/** | 3 | Tech stack, perception, non-ML |
| **aurora/** | 3 | Tech stack, perception, non-ML |
| **mobileye/** | 3 | Tech stack, perception, non-ML |
| **motional/** | 3 | Tech stack, perception, non-ML |
| **nuro/** | 3 | Tech stack, perception, non-ML |
| **ponyai/** | 3 | Tech stack, perception, non-ML |
| **kodiak/** | 3 | Tech stack, perception, non-ML |

### `technology/` — 33 documents across 9 domains

| Domain | Docs | Contents |
|--------|------|----------|
| **world-models/** | 8 | Overview, diffusion, occupancy (20 methods compared), tokenized/JEPA, RL, Dreamer, OccWorld implementation, open-source repos (21 rated — only 6 fully usable) |
| **vla/** | 2 | VLA for driving, Alpamayo setup (camera-only, non-commercial, teacher model) |
| **perception/** | 6 | BEV encoding, open-vocab detection (YOLO-World 52 FPS), DINOv2 (adapter-mediated integration), CenterPoint, production systems, vision foundation models |
| **planning/** | 3 | Frenet augmentation (256 candidates in 18.7ms GPU), motion prediction, LLM reasoning |
| **simulation/** | 5 | Neural sim platforms, 3DGS digital twin, neural scene reconstruction, NVIDIA Cosmos, airport digital twins ($50K-$4M), simulators comparison (CARLA/AWSIM/Isaac Sim) |
| **localization/** | 1 | Mapping and localization |
| **e2e-driving/** | 3 | E2E architectures, company approaches, E2E world model pipeline (7-day quick start) |
| **multi-agent/** | 1 | Fleet coordination |
| **robustness/** | 1 | Adverse conditions |

### `operations/` — 23 documents across 4 domains

| Domain | Docs | Contents |
|--------|------|----------|
| **airside/** | 7 | Industry overview, turnaround prediction (Moonware/Assaia), FOD & jet blast (B737 148m zone), airport data systems (real API endpoints, AIXM XML, pyModeS), pushback systems (Mototok 54% delay reduction), electric GSE market ($2.8B→$5.2B), aviation ground ops ecosystem |
| **deployment/** | 5 | Deployment playbook (4,500 lines with checklists), shadow mode, OTA fleet management (200TB/shift data rate), production ML deployment (TensorRT, DLA, Triton), fleet management & dispatch (VRPTW, A-CDM triggers) |
| **safety/** | 8 | ISO 3691-4 deep dive ($130K-380K, harmonized May 2024), certification guide, safety incidents (Cruise root cause, Waymo 92% methodology), failure modes (SOTIF), Simplex architecture (RSS for airside), regulatory trajectory (FAA AC ~2028-2029), ground crew safety (27K accidents/yr, hi-vis paradox), insurance & liability ($35M per engine exposure) |
| **teleoperation/** | 1 | Systems comparison (Fernride <100ms, Waymo 1:41 ratio) |

### `hardware/` — 12 documents

| Domain | Docs | Contents |
|--------|------|----------|
| **compute/** | 4 | NVIDIA Orin (275 TOPS, 8 power modes, benchmarks), DRIVE Thor (~1000 TOPS, FP8), TensorRT deployment guide (DLA 74% at 15W, Lidar_AI_Solution), training infrastructure & MLOps |
| **sensors/** | 3 | Hesai LiDAR (2M+ shipped, XT32 specs, ATX ~$200), RoboSense LiDAR (33.5% market share, RSHELIOS/RSBP specs), 4D radar (Continental ARS548, immune to all weather) |
| **connectivity/** | 2 | Airport 5G/CBRS ($5M-15M, 12-24mo ROI), case studies (DFW $10M, Changi Nokia, LAX 97% scan reduction) |
| **vehicle/** | 2 | CAN bus/DBW interface, bicycle kinematic model (ADT3 params, 4.1% validated error) |

### `foundations/` — 11 documents

PointPillars (tensor shapes, TensorRT 6.84ms), VQ-VAE/FSQ tokenization (codebook collapse prevention, Cosmos uses FSQ), transformer world models (causal attention, KV-cache, scaling laws), diffusion models (DDPM→DDIM→EDM→DiT→flow matching), GTSAM factor graphs (ISAM2, VGICP, adding neural factors), Lanelet2 maps (airport extensions, AIXM conversion), Frenet trajectory math (Werling 2010, quintic polynomials, 420 candidates), RTK-GPS/IMU localization (preintegration, NTRIP), Mamba SSM (DriveMamba 42% L2 reduction, 3.2x faster, eliminates KV-cache), theoretical foundations (POMDP, free energy, PAC bounds), architecture innovations (MoE, DiT, flow matching, FSQ).

### `cross-cutting/` — 17 documents

Sensor fusion architectures (BEVFusion, masked modality training, graceful degradation), synthetic data generation (Cosmos +16.2% mAP foggy, 7-phase airside pipeline), evaluation benchmarks (WorldModelBench, ACT-Bench 30-44% action fidelity), nuScenes/Waymo practical guide (download procedures, format conversion, 4-phase pre-training strategy), transfer learning (LoRA 500-1,000 frames, open research gap), ROS 2 migration (Jazzy, Isaac ROS NITROS 7x on Orin), Autoware Universe deep dive (50+ modules, Agnocast 16% latency improvement, 40-50% reusable for airside), embodied AI crossover (pi0 flow matching, RT-X, convergence thesis), data engines & datasets, data engine from ROS bags, open-source ecosystem (openpilot first production world model), signal processing & weather, calibration & tracking, ground safety, fusion & geometric, formal methods & regulatory, continual learning.

### `synthesis/` — 6 documents

- **getting-started.md** — Day 1 guide with runnable Python code for all quick-start POCs
- **master-synthesis.md** — Executive summary with tiered technology recommendations
- **poc-proposals.md** — 8 concrete POC models with architectures, code, configs, cost estimates ($2-5K total)
- **technology-readiness.md** — Component-level TRL assessment for each POC with go/no-go criteria
- **competitive-landscape.md** — Head-to-head comparison of all 7 AV + 3 software players, strategic quadrant
- **design-spec.md** — 891-line spec-reviewed Simplex architecture for airside world model AV
