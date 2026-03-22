# Industry Research — Claude Instructions

## Project Overview

Comprehensive autonomous vehicle technology research repository — 113 documents, 100K+ lines. Covers AV company tech stacks, perception systems, world models, simulation, deployment, safety, and airport airside operations.

## Directory Structure

```
industry-research/
├── companies/          # Per-company research (17 companies, 43 docs)
├── technology/         # Technology domains (28 docs)
│   ├── world-models/   # World model architectures and implementations
│   ├── vla/            # Vision-Language-Action models
│   ├── perception/     # BEV encoding, detection, foundation models
│   ├── planning/       # Trajectory planning, motion prediction, LLM reasoning
│   ├── simulation/     # Neural sim, 3DGS, Cosmos
│   ├── localization/   # Mapping, SLAM, GPS
│   ├── e2e-driving/    # End-to-end architectures
│   ├── multi-agent/    # Fleet coordination
│   └── robustness/     # Adverse conditions
├── operations/         # Production operations (15 docs)
│   ├── airside/        # Airport-specific: FOD, jet blast, turnaround, data integration
│   ├── deployment/     # Playbooks, shadow mode, OTA, production ML
│   ├── safety/         # Certification, incidents, failure modes, Simplex
│   └── teleoperation/  # Remote operation systems
├── hardware/           # Sensors, compute, connectivity, vehicle (4 docs)
├── foundations/        # Math first principles (7 docs)
├── cross-cutting/      # Multi-domain topics (11 docs)
└── synthesis/          # Master synthesis, design spec, POC proposals (3 docs)
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

1. **Alpamayo**: Camera-only, non-commercial license, teacher model for distillation
2. **Cosmos**: FSQ tokenizer (not VQ-VAE), commercially licensed
3. **comma.ai**: World model (2B DiT) used at training time only — small policy on-device
4. **No public airside driving datasets exist**
5. **Road→airside transfer**: Open research gap, no published results
6. **Aurrigo deployments**: All still require safety operator
7. **Changi (Jan 2026)**: First fully driverless airside deployment (UISEE)
8. **TractEasy**: Zero accidents across 8 airports, >95% mission success
9. **Certification**: $1.5-5M, FAA prohibits at Part 139 airports (CertAlert 24-02)
10. **PointPillars**: 6.84ms on Orin — real-time capable

## Entry Points

- **Start here**: `synthesis/master-synthesis.md`
- **POCs**: `synthesis/poc-proposals.md`
- **Design**: `synthesis/design-spec.md`
- **Quick start**: `technology/e2e-driving/e2e-world-model-pipeline.md` (7-day plan)
- **Company research**: `companies/<name>/`
- **Any technology**: `technology/<domain>/`

## Pending Work (Rate-Limited)

9 foundation reports researched but not written: EasyMile tech stack, UISEE tech stack, Hesai LiDAR, RoboSense LiDAR, NVIDIA Orin deep technical, GTSAM factor graphs, Lanelet2 maps, Frenet trajectory math, CAN bus/DBW interface.
