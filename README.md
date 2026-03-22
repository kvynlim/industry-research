# Industry Research

Comprehensive autonomous vehicle technology research — 113 documents, 100K+ lines.

## Directory Structure

```
industry-research/
├── companies/          # Per-company research (17 companies)
├── technology/         # Technology domain research
├── operations/         # Production operations & deployment
├── hardware/           # Sensors, compute, connectivity
├── foundations/        # Mathematical first principles
├── cross-cutting/      # Topics spanning multiple domains
└── synthesis/          # Master synthesis, design spec, POC proposals
```

### `companies/` — 43 documents across 17 companies

Each company directory contains all research about that company in one place:

| Company | Contents |
|---------|----------|
| **waymo/** | Tech stack, perception, non-ML perception, production operations |
| **tesla/** | Tech stack, perception, non-ML perception, FSD production |
| **zoox/** | Tech stack, perception, non-ML perception, perception stack detailed |
| **cruise/** | Tech stack, perception, non-ML perception |
| **aurora/** | Tech stack, perception, non-ML perception |
| **wayve/** | Tech stack, perception, non-ML perception |
| **mobileye/** | Tech stack, perception, non-ML perception |
| **motional/** | Tech stack, perception, non-ML perception |
| **nuro/** | Tech stack, perception, non-ML perception |
| **ponyai/** | Tech stack, perception, non-ML perception |
| **kodiak/** | Tech stack, perception, non-ML perception |
| **comma-ai/** | Production world model deployment |
| **aurrigo/** | Perception recommendations, production deployment |
| **tracteasy/** | Production deployment (8 airports) |
| **moonware/** | HALO operations |
| **changi-programme/** | Autonomous GSE programme |
| **uisee/** | (Pending — rate-limited) |

### `technology/` — 28 documents across 9 domains

| Domain | Contents |
|--------|----------|
| **world-models/** | Overview, diffusion, occupancy, tokenized/JEPA, RL, cutting-edge 2026, OccWorld implementation, Dreamer RL |
| **vla/** | VLA for driving, Alpamayo setup guide |
| **perception/** | BEV encoding, open-vocab detection, vision foundation models, production systems, OpenPCDet/CenterPoint |
| **planning/** | Frenet planner augmentation, motion prediction, LLM reasoning |
| **simulation/** | Neural simulation platforms, 3DGS digital twin, neural scene reconstruction, NVIDIA Cosmos |
| **localization/** | Mapping and localization |
| **e2e-driving/** | E2E architectures, company approaches, E2E world model pipeline |
| **multi-agent/** | Fleet coordination |
| **robustness/** | Adverse conditions |

### `operations/` — 15 documents across 4 domains

| Domain | Contents |
|--------|----------|
| **airside/** | Industry overview, turnaround prediction, FOD & jet blast, airport data integration, aviation ground ops ecosystem |
| **deployment/** | Deployment playbook, shadow mode, OTA fleet management, production ML deployment |
| **safety/** | Certification guide, safety incidents & lessons, failure modes analysis, Simplex architecture, safety verification |
| **teleoperation/** | Teleoperation systems |

### `hardware/` — 4 documents

| Domain | Contents |
|--------|----------|
| **compute/** | Edge platforms (Orin/Thor), training infrastructure & MLOps |
| **connectivity/** | Airport 5G/CBRS |
| **vehicle/** | Bicycle kinematic model |

### `foundations/` — 7 documents

Mathematical first principles: PointPillars, VQ-VAE/FSQ tokenization, transformer world models, diffusion models, RTK-GPS/IMU localization, theoretical foundations, architecture innovations.

### `cross-cutting/` — 11 documents

Signal processing & weather, calibration & tracking, ground safety, fusion & geometric association, formal methods & regulatory, transfer learning, data engines & datasets, ROS 2 migration, open-source ecosystem, embodied AI crossover, data engine from ROS bags.

### `synthesis/` — 3 documents

- **master-synthesis.md** — Executive summary tying everything together
- **design-spec.md** — 891-line spec-reviewed architecture for airside world model AV
- **poc-proposals.md** — 8 concrete proof-of-concept models with cost estimates
