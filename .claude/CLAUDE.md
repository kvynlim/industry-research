# Industry Research — Claude Instructions

## Project Overview

Comprehensive autonomous vehicle technology research repository — **153 documents, 132,429 lines**. Covers AV company tech stacks, perception systems, world models, simulation, deployment, safety, and airport airside operations.

## Directory Structure

```
industry-research/
├── companies/          # 21 companies, 52 docs
├── technology/         # 9 domains, 33 docs
│   ├── world-models/   # Overview, diffusion, occupancy (20 methods compared), tokenized/JEPA, RL, Dreamer, OccWorld, open-source repos (21 rated)
│   ├── vla/            # VLA for driving, Alpamayo setup (camera-only, non-commercial)
│   ├── perception/     # BEV encoding, open-vocab, DINOv2, CenterPoint, production systems
│   ├── planning/       # Frenet augmentation, motion prediction, LLM reasoning
│   ├── simulation/     # Neural sim, 3DGS digital twin, Cosmos, airport digital twins, simulators comparison
│   ├── localization/   # Mapping and localization
│   ├── e2e-driving/    # E2E architectures, company approaches, E2E pipeline (7-day quick start)
│   ├── multi-agent/    # Fleet coordination
│   └── robustness/     # Adverse conditions
├── operations/         # 23 docs
│   ├── airside/        # Industry overview, turnaround, FOD/jet blast, airport APIs (real endpoints), pushback systems, electric GSE market, aviation ecosystem
│   ├── deployment/     # Playbook (4,500 lines), shadow mode, OTA fleet mgmt, production ML, fleet dispatch
│   ├── safety/         # ISO 3691-4 deep dive, certification ($130K-380K), incidents, failure modes, Simplex, regulatory trajectory (FAA AC ~2028), ground crew safety (898 lines), insurance/liability
│   └── teleoperation/  # Systems comparison (Fernride, Waymo, Cruise lessons)
├── hardware/           # 12 docs
│   ├── compute/        # Orin (275 TOPS), Thor (1000+ TOPS), TensorRT guide, training infra
│   ├── sensors/        # Hesai LiDAR, RoboSense LiDAR, 4D radar (Continental ARS548)
│   ├── connectivity/   # Airport 5G/CBRS, case studies (DFW, Changi, LAX)
│   └── vehicle/        # CAN bus/DBW, bicycle kinematic model
├── foundations/        # 11 docs — PointPillars, VQ-VAE/FSQ, transformers, diffusion, GTSAM, Lanelet2, Frenet math, RTK/IMU, Mamba SSM, theoretical, architecture innovations
├── cross-cutting/      # 17 docs — sensor fusion, synthetic data, evaluation benchmarks, datasets (nuScenes/Waymo practical guide), transfer learning, ROS 2, Autoware (50+ modules), embodied AI, data engines, open-source ecosystem
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

## Entry Points

- **Start here**: `synthesis/master-synthesis.md`
- **POCs**: `synthesis/poc-proposals.md` (8 models, $2K-5K total)
- **Design**: `synthesis/design-spec.md` (891-line Simplex architecture)
- **Quick start**: `technology/e2e-driving/e2e-world-model-pipeline.md` (7-day plan)
- **Company research**: `companies/<name>/`
- **Any technology**: `technology/<domain>/`
- **Safety/certification**: `operations/safety/`
- **Hardware specs**: `hardware/`
- **Math foundations**: `foundations/`
