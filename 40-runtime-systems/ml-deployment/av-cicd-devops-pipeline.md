# CI/CD and DevOps Pipelines for Autonomous Vehicle Software

## End-to-End Pipeline from Code Commit to Fleet Deployment

> This document covers the **end-to-end CI/CD workflow** that connects code, ML models, simulation, maps, and fleet deployment into a single integrated pipeline for safety-critical autonomous vehicle development. Existing documents cover individual pieces -- OTA delivery (`../../50-cloud-fleet/ota/ota-fleet-management.md`), TensorRT optimization (`production-ml-deployment.md`), MISRA/static analysis (`functional-safety-software.md`), V-model testing (`testing-validation-methodology.md`), shadow mode (`../../60-safety-validation/verification-validation/shadow-mode.md`), and data flywheel (`50-cloud-fleet/mlops/data-flywheel-airside.md`). This document fills the gap: the pipeline architecture that orchestrates all of these into a repeatable, auditable, and safety-certifiable workflow. Designed for the reference ROS Noetic airside stack (22 packages, C++ nodelets, NVIDIA Orin, 4-8 RoboSense LiDARs, airport airside operations, ISO 3691-4 certification target).

---

## Table of Contents

1. [AV-Specific CI/CD Challenges](#1-av-specific-cicd-challenges)
2. [Repository Architecture](#2-repository-architecture)
3. [Code CI Pipeline](#3-code-ci-pipeline)
4. [ML Model CI Pipeline](#4-ml-model-ci-pipeline)
5. [Simulation-in-the-Loop CI](#5-simulation-in-the-loop-ci)
6. [Map and Configuration CI](#6-map-and-configuration-ci)
7. [Artifact Management and Versioning](#7-artifact-management-and-versioning)
8. [Fleet Deployment Pipeline](#8-fleet-deployment-pipeline)
9. [Monitoring and Observability](#9-monitoring-and-observability)
10. [ML Regression Detection](#10-ml-regression-detection)
11. [Safety Assurance Integration](#11-safety-assurance-integration)
12. [Infrastructure and Tooling](#12-infrastructure-and-tooling)
13. [Airside-Specific Pipeline Requirements](#13-airside-specific-pipeline-requirements)
14. [Industry Approaches to Safety-Critical DevOps](#14-industry-approaches-to-safety-critical-devops)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Key Takeaways](#16-key-takeaways)
17. [References](#17-references)

---

## 1. AV-Specific CI/CD Challenges

### 1.1 Why Standard Web CI/CD Does Not Work for AVs

Standard CI/CD pipelines assume stateless, deterministic software running on commodity infrastructure with blue-green deployments and instant rollback. Autonomous vehicles violate every one of these assumptions:

| Assumption | Web/Cloud Reality | AV Reality |
|---|---|---|
| Deterministic builds | Same input = same output | Non-deterministic ML inference, GPU scheduling, sensor noise |
| Hardware homogeneity | All servers identical | Orin vs Thor, different sensor configs, vehicle-specific calibration |
| Instant rollback | Revert container in seconds | Vehicle in motion, must safe-stop before rollback, OTA requires WiFi |
| Isolated testing | Unit tests + staging | Requires SIL, HIL, VIL, real sensor data, physical vehicles |
| Deploy == done | Code runs or it does not | Model may pass all tests but fail on a new aircraft type unseen in test set |
| Failure is tolerable | Return 500, retry | Failure causes physical collision with $250K+ aircraft damage |
| Continuous deployment | Deploy 100x/day | Deploy monthly with regulatory sign-off and shadow mode validation |
| Single artifact | One Docker image | Code binary + ML models + TensorRT engines + maps + parameters + calibration |

### 1.2 The Six Artifact Types

AV CI/CD must manage six fundamentally different artifact types, each with its own lifecycle, validation requirements, and deployment mechanism:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    AV DEPLOYMENT ARTIFACT TAXONOMY                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CODE BINARIES        ROS nodelets, C++ shared libraries, Python     │
│     (.so, .py)           scripts. Built per-architecture (aarch64).     │
│     Lifecycle: PR → build → test → merge → release                     │
│                                                                          │
│  2. ML MODEL WEIGHTS     PyTorch checkpoints → ONNX → TensorRT engines │
│     (.onnx, .engine)     Built per-hardware (Orin-specific engines).    │
│     Lifecycle: train → evaluate → quantize → convert → benchmark       │
│                                                                          │
│  3. HD MAPS              Lanelet2 .osm files, AMDB overlays, point     │
│     (.osm, .pcd)         cloud maps, semantic annotations.             │
│     Lifecycle: survey → process → validate → sign-off → deploy         │
│                                                                          │
│  4. CONFIGURATION        ROS launch files, YAML parameters, vehicle-   │
│     (.yaml, .launch)     specific tuning, airport-specific settings.   │
│     Lifecycle: edit → validate schema → simulate → deploy              │
│                                                                          │
│  5. CALIBRATION DATA     LiDAR extrinsic transforms, camera intrinsics,│
│     (.yaml, .json)       thermal drift tables, IMU biases.             │
│     Lifecycle: calibrate → verify → store → auto-refresh               │
│                                                                          │
│  6. TensorRT ENGINES     Hardware-specific compiled inference engines.  │
│     (.engine, .plan)     Must be rebuilt when TRT version, CUDA, or    │
│     Lifecycle: ONNX → build on target HW → benchmark → cache          │
│                          GPU driver changes.                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Non-Determinism in ML Pipelines

ML models introduce fundamental non-determinism into CI/CD:

**Training non-determinism**: Even with fixed seeds, GPU floating-point operations, data loader parallelism, and cuDNN autotuning produce different weights across runs. A model trained twice on identical data will differ by 0.1-0.5% mAP.

**Inference non-determinism**: TensorRT kernel selection varies by hardware state. FP16/INT8 quantization introduces rounding differences. On Orin, the same model can produce different outputs for identical inputs across reboots if autotuning is not locked.

**Evaluation non-determinism**: nuScenes mAP computation is deterministic, but custom metrics involving IoU thresholds on point clouds can vary by 0.01-0.05% due to floating-point order of operations.

**Practical response**: Do not require exact reproducibility. Instead, require statistical reproducibility -- metrics must fall within confidence intervals across N evaluations. For reference airside AV stack: 3 evaluation runs, results must agree within 0.5% mAP for pass/fail decisions.

### 1.4 The Hardware-in-the-Loop Dependency Problem

Unlike web CI where tests run on commodity x86 servers, AV CI requires:

- **aarch64 cross-compilation**: Orin runs ARM64. CI runners must either cross-compile or use Orin hardware.
- **TensorRT engine builds**: Must build on identical GPU architecture. An engine built on an A100 will not run on an Orin. Build farms need actual Orin devices.
- **Sensor replay**: Integration tests need actual sensor data replayed through the pipeline. rosbag files are 1-50 GB each.
- **Real-time constraints**: A test that passes at 100ms on a server may fail at 50ms budget on Orin under thermal throttle.

This creates a tension: fast CI (cloud x86) vs accurate CI (on-target Orin). The solution is a tiered pipeline.

---

## 2. Repository Architecture

### 2.1 Monorepo vs Polyrepo for AV Stacks

The repository structure fundamentally shapes the CI/CD pipeline. AV companies split roughly 60/40 in favor of monorepos:

| Approach | Companies Using It | Advantages | Disadvantages |
|---|---|---|---|
| **Monorepo** | Tesla, Waymo, comma.ai, Aurora | Atomic cross-package changes, unified versioning, single CI pipeline | Build times grow, all developers see all code, large clone sizes |
| **Polyrepo** | Cruise (pre-pause), Motional, Nuro | Independent team velocity, smaller CI scope per repo | Dependency hell, cross-repo integration testing pain, version matrix explosion |
| **Hybrid** | Zoox, Mobileye | Core platform monorepo + separate ML model repos | Best of both but requires careful interface contracts |

**Recommendation for reference airside AV stack**: Hybrid approach.

```
airside-ws/                          # Monorepo: ROS workspace (catkin)
├── src/
│   ├── airside_perception/          # LiDAR processing, segmentation
│   ├── airside_localization/        # GTSAM, VGICP, RTK fusion
│   ├── airside_planning/            # Frenet planner, trajectory generation
│   ├── airside_control/             # Stanley controller, CAN interface
│   ├── airside_safety/              # Safety monitor, arbitrator, e-stop
│   ├── airside_vehicle_interface/   # Vehicle-specific CAN DBW
│   ├── airside_teleoperation/       # Remote operation interface
│   ├── airside_fleet/               # Fleet management, task dispatch
│   ├── airside_common/              # Shared messages, utilities
│   └── ... (22 packages total)
├── launch/                          # Top-level launch configurations
├── config/                          # Vehicle-specific YAML parameters
├── scripts/                         # CI/CD scripts, tooling
├── docs/                            # Safety documentation
│   └── safety/
│       ├── requirements/
│       ├── traceability_matrix.csv
│       └── misra_deviations.csv
├── test/                            # Integration test scenarios
│   ├── bags/                        # DVC-tracked test rosbags (pointers)
│   ├── scenarios/                   # OpenSCENARIO 2.0 test definitions
│   └── benchmarks/                  # Per-airport benchmark suites
├── .gitlab-ci.yml                   # CI pipeline definition
├── .pre-commit-config.yaml          # Pre-commit hooks
└── CMakeLists.txt

airside-models/                      # Separate repo: ML models
├── perception/
│   ├── pointpillars/                # Detection model
│   ├── centerpoint/                 # Detection model
│   ├── segmentation/                # FlatFormer / SalsaNext
│   └── occupancy/                   # FlashOcc / nvblox
├── planning/
│   └── diffusion_planner/           # DiffusionDrive
├── evaluation/
│   ├── benchmarks/                  # Standardized evaluation scripts
│   ├── datasets/                    # DVC pointers to eval datasets
│   └── baselines/                   # Baseline metric thresholds
├── export/                          # ONNX export scripts
├── tensorrt/                        # TensorRT build scripts
├── dvc.yaml                         # DVC pipeline definitions
├── mlflow/                          # Experiment tracking config
└── .gitlab-ci.yml

airside-maps/                        # Separate repo: HD maps
├── airports/
│   ├── airport_a/
│   │   ├── lanelet2/                # Lanelet2 .osm files
│   │   ├── pointcloud/              # Reference point cloud (DVC)
│   │   ├── amdb/                    # AMDB base layer
│   │   ├── semantic/                # Semantic annotations
│   │   └── config.yaml              # Airport-specific parameters
│   └── airport_b/
├── tools/                           # Map validation, conversion tools
├── schemas/                         # JSON schemas for map configs
└── .gitlab-ci.yml
```

### 2.2 Why Separate ML and Map Repos

The three repos have fundamentally different change cadences:

| Repository | Change Cadence | Typical PR Size | Review Process | Deploy Frequency |
|---|---|---|---|---|
| `airside-ws` (code) | Daily | 50-500 lines | Peer review + CI | Bi-weekly to monthly |
| `airside-models` (ML) | Weekly | Model weights (GB) | ML review + benchmark | Monthly |
| `airside-maps` (maps) | Per-airport/survey | Map files (100MB+) | Safety review + field verify | Per deployment |

Separating them prevents:
- Multi-GB model weights bloating the code repo's git history
- Map changes requiring full code CI to pass
- ML training experiments polluting the code commit log

DVC (Data Version Control) connects all three: model weights and map files are stored in S3/MinIO, with DVC pointers in git. The code repo pins specific model and map versions via DVC lock files or version tags.

### 2.3 Branching Strategy

```
main ─────────────────────────────────────────────────────────────────────
  │                                      │                    │
  ├── release/v2.4.0 ──── tag v2.4.0    │                    │
  │                                      │                    │
  ├── feature/cbf-safety-filter ─────── merge                │
  │     └── (feature branch, PR-based)                        │
  │                                                           │
  ├── feature/thermal-fusion ──────────────────────── merge   │
  │                                                           │
  └── hotfix/estop-latency-fix ───────────────────────────── merge + tag v2.4.1
```

**Branch rules**:
- `main`: Always deployable to shadow mode. Protected -- requires CI pass + 2 approvals.
- `release/*`: Cut from `main` when ready for fleet deployment. Additional safety gates.
- `feature/*`: Developer branches. CI runs on every push. PRs into `main`.
- `hotfix/*`: Emergency fixes. Abbreviated CI (safety tests only). Merges to `main` + cherry-pick to active release.
- Safety-critical packages (`airside_safety`, `airside_vehicle_interface`): Require safety engineer approval on any PR.

---

## 3. Code CI Pipeline

### 3.1 Pipeline Architecture

The code CI pipeline runs on every push to a feature branch and on every PR to `main`. It is structured in stages with explicit pass/fail gates:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CODE CI PIPELINE                                │
│                      (Triggered on every push)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │  STAGE 1    │──→│  STAGE 2     │──→│  STAGE 3     │                │
│  │  Pre-flight │   │  Build       │   │  Lint &      │                │
│  │             │   │              │   │  Static      │                │
│  │  - Schema   │   │  - catkin    │   │  Analysis    │                │
│  │    validate │   │    make      │   │              │                │
│  │  - YAML     │   │  - x86 +    │   │  - clang-    │                │
│  │    lint     │   │    aarch64   │   │    tidy      │                │
│  │  - Launch   │   │  - Zero      │   │  - cpplint   │                │
│  │    syntax   │   │    warnings  │   │  - cppcheck  │                │
│  │  - Commit   │   │  - 3-5 min  │   │  - MISRA     │                │
│  │    message  │   │              │   │    (safety   │                │
│  │  - 30s      │   │              │   │    pkgs)     │                │
│  └──────┬──────┘   └──────┬───────┘   │  - 5-8 min  │                │
│         │ PASS            │ PASS      └──────┬───────┘                │
│         ▼                 ▼                   │ PASS                   │
│  ┌─────────────┐   ┌──────────────┐   ┌──────▼───────┐                │
│  │  STAGE 4    │──→│  STAGE 5     │──→│  STAGE 6     │                │
│  │  Unit Tests │   │  Integration │   │  Artifacts   │                │
│  │             │   │  Tests       │   │              │                │
│  │  - gtest    │   │  - rostest   │   │  - Coverage  │                │
│  │  - rosunit  │   │  - rosbag    │   │    report    │                │
│  │  - Coverage │   │    replay    │   │  - MISRA     │                │
│  │    >= 80%   │   │  - Multi-    │   │    report    │                │
│  │    overall  │   │    node      │   │  - Binary    │                │
│  │  - >= 95%   │   │    comms     │   │    hash      │                │
│  │    safety   │   │  - Timing    │   │  - Deb pkg   │                │
│  │    packages │   │    budgets   │   │  - Docker    │                │
│  │  - 5-10 min │   │  - 10-20min │   │    image     │                │
│  └─────────────┘   └──────────────┘   └──────────────┘                │
│                                                                         │
│  Total wall-clock: 25-45 minutes (with parallelization)                │
│  Safety-critical PR: +15 min (MISRA full + MC/DC + impact analysis)   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Stage Details

#### Stage 1: Pre-flight Checks (30 seconds)

Fast checks that catch common errors before spending compute on builds:

```yaml
# .gitlab-ci.yml excerpt
preflight:
  stage: preflight
  image: python:3.10-slim
  script:
    # Validate all YAML files parse correctly
    - python -c "import yaml, glob; [yaml.safe_load(open(f)) for f in glob.glob('config/**/*.yaml', recursive=True)]"
    # Validate launch file XML syntax
    - find launch/ -name '*.launch' -exec xmllint --noout {} \;
    # Check commit message format (Conventional Commits)
    - python scripts/ci/check_commit_message.py
    # Validate JSON schemas for config files
    - python scripts/ci/validate_schemas.py
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
```

#### Stage 2: Build (3-5 minutes)

```yaml
build:x86:
  stage: build
  image: ros:noetic-ros-core
  script:
    - source /opt/ros/noetic/setup.bash
    - catkin_make -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-Werror -Wall -Wextra"
    - catkin_make run_tests  # Compile test targets
  artifacts:
    paths:
      - devel/
      - build/
    expire_in: 1 day

build:aarch64:
  stage: build
  tags: [aarch64]  # Runs on Orin-class self-hosted runner
  script:
    - source /opt/ros/noetic/setup.bash
    - catkin_make -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE=cmake/aarch64.cmake
  rules:
    - if: $CI_MERGE_REQUEST_TARGET_BRANCH_NAME == "main"  # Only on PR to main
```

#### Stage 3: Lint and Static Analysis (5-8 minutes)

```yaml
lint:
  stage: analysis
  parallel:
    matrix:
      - TOOL: [clang-tidy, cpplint, cppcheck]
  script:
    - case $TOOL in
        clang-tidy)
          # Run clang-tidy with project checks
          run-clang-tidy -p build/ -checks='-*,bugprone-*,cert-*,performance-*,modernize-*' src/
          ;;
        cpplint)
          cpplint --recursive --filter=-whitespace/braces,-build/include_order src/
          ;;
        cppcheck)
          cppcheck --enable=all --suppress=missingIncludeSystem \
            --error-exitcode=1 --inline-suppr src/
          ;;
      esac

misra:
  stage: analysis
  script:
    - scripts/ci/misra_check.sh  # See functional-safety-software.md Section 8.2
  rules:
    - if: $CI_MERGE_REQUEST_TARGET_BRANCH_NAME == "main"
      changes:
        - src/airside_safety/**/*
        - src/airside_vehicle_interface/**/*
        - src/airside_control/**/*
```

#### Stage 4: Unit Tests (5-10 minutes)

```yaml
unit_tests:
  stage: test
  script:
    - source /opt/ros/noetic/setup.bash
    - source devel/setup.bash
    # Run all gtest targets
    - catkin_make run_tests
    - catkin_test_results build/test_results --verbose
    # Generate coverage
    - lcov --capture --directory build/ --output-file coverage.info
    - lcov --remove coverage.info '/opt/ros/*' '/usr/*' --output-file coverage.info
    - genhtml coverage.info --output-directory coverage_report/
  after_script:
    # Enforce coverage gates
    - python scripts/ci/check_coverage.py --overall-min=80 --safety-min=95
  artifacts:
    paths:
      - coverage_report/
      - build/test_results/
    reports:
      junit: build/test_results/**/*.xml
```

**Coverage gates by package classification**:

| Package Classification | Branch Coverage Minimum | MC/DC Required | Examples |
|---|---|---|---|
| Safety-critical | 95% | Yes (ASIL-B+) | `airside_safety`, `airside_vehicle_interface` |
| Perception | 80% | No | `airside_perception`, `airside_localization` |
| Planning | 85% | No | `airside_planning`, `airside_control` |
| Infrastructure | 70% | No | `airside_common`, `airside_fleet` |

#### Stage 5: Integration Tests (10-20 minutes)

```yaml
integration_tests:
  stage: integration
  services:
    - name: ros:noetic-ros-core
      alias: roscore
  script:
    - source /opt/ros/noetic/setup.bash && source devel/setup.bash
    # Multi-node communication tests
    - rostest airside_perception perception_pipeline.test
    - rostest airside_planning planning_integration.test
    # Rosbag replay tests (DVC-tracked bags)
    - dvc pull test/bags/smoke_test.bag.dvc
    - rostest airside_integration bag_replay_smoke.test bag:=test/bags/smoke_test.bag
    # Timing budget verification
    - rostest airside_integration timing_budgets.test
  rules:
    - if: $CI_MERGE_REQUEST_TARGET_BRANCH_NAME == "main"
```

**Rosbag replay tests**: The CI pipeline replays curated rosbag files through the perception and planning pipeline, comparing outputs against ground truth. This catches regressions that unit tests miss -- a change to LiDAR preprocessing can break downstream detection even if the preprocessor's own tests pass.

### 3.3 Pre-commit Hooks

Fast, local checks before code even reaches CI:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: clang-format
        name: clang-format
        entry: clang-format -i --style=file
        language: system
        types: [c++]
      - id: yaml-lint
        name: yaml-lint
        entry: yamllint -c .yamllint.yml
        language: python
        types: [yaml]
      - id: launch-xml-check
        name: launch-xml-check
        entry: xmllint --noout
        language: system
        files: '\.launch$'
      - id: safety-package-guard
        name: safety-package-guard
        entry: python scripts/ci/safety_package_guard.py
        language: python
        files: 'airside_safety|airside_vehicle_interface'
        description: "Warns when modifying safety-critical packages"
```

### 3.4 Handling the ROS Noetic Build System

catkin_make has specific CI challenges:

**Workspace isolation**: Each CI job must build in a clean workspace. catkin's incremental builds are not reproducible across different machines or after branch switches. Always build clean in CI (`catkin_make clean` or fresh workspace).

**Cross-compilation**: Native aarch64 builds on Orin hardware are slow (~15 minutes for 22 packages). Cross-compilation from x86 with `CMAKE_TOOLCHAIN_FILE` is 3-5x faster but catches fewer platform-specific issues. Strategy: x86 build on every push, aarch64 build on PRs to main only.

**Package dependency ordering**: catkin resolves build order via `package.xml` dependencies. A missing `<depend>` declaration will work locally (incremental build caches it) but fail in clean CI builds. This is a common source of CI-only failures.

**Parallel build**: `catkin_make -j$(nproc)` on multi-core CI runners. However, catkin's parallelism is per-package, not per-file within a package. With 22 packages and typical dependency chains, effective parallelism is 4-8x.

---

## 4. ML Model CI Pipeline

### 4.1 Pipeline Architecture

The ML pipeline is fundamentally different from code CI -- it is data-driven, compute-heavy, and inherently non-deterministic:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ML MODEL CI PIPELINE                              │
│              (Triggered on model commit or training completion)          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────┐    │
│  │  TRAIN     │─→│  EVALUATE  │─→│  QUANTIZE   │─→│  CONVERT     │    │
│  │            │  │            │  │  & EXPORT   │  │  TensorRT    │    │
│  │  PyTorch   │  │  mAP, NDS  │  │             │  │              │    │
│  │  W&B track │  │  per-class │  │  FP16/INT8  │  │  Build on    │    │
│  │  DVC data  │  │  safety    │  │  calibrate  │  │  target HW   │    │
│  │            │  │  metrics   │  │  ONNX       │  │  (Orin)      │    │
│  │  Hours-    │  │            │  │             │  │              │    │
│  │  days      │  │  20-60 min │  │  30-60 min  │  │  15-45 min   │    │
│  └────────────┘  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘    │
│                        │ PASS           │ PASS            │ PASS       │
│                        ▼                ▼                 ▼            │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────┐    │
│  │  BENCHMARK │─→│  SAFETY    │─→│  SIM        │─→│  APPROVAL    │    │
│  │  REGRESSION│  │  METRICS   │  │  REGRESSION │  │  GATE        │    │
│  │            │  │            │  │             │  │              │    │
│  │  Latency   │  │  No safety │  │  CARLA /    │  │  Auto if     │    │
│  │  Memory    │  │  class     │  │  Isaac Sim  │  │  all pass    │    │
│  │  Throughput│  │  regression│  │  scenario   │  │              │    │
│  │  vs prev   │  │  ever      │  │  suite      │  │  Manual if   │    │
│  │            │  │            │  │             │  │  safety-     │    │
│  │  15-30 min │  │  5 min     │  │  1-4 hours  │  │  critical    │    │
│  └────────────┘  └────────────┘  └─────────────┘  └──────────────┘    │
│                                                                          │
│  Total wall-clock: 3-8 hours (training excluded)                        │
│  With training: 1-7 days                                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Training Orchestration

Training is not part of CI per se (too slow), but must be tracked and reproducible:

```yaml
# dvc.yaml — DVC pipeline for model training
stages:
  prepare_data:
    cmd: python scripts/prepare_training_data.py
    deps:
      - data/raw/${AIRPORT}
      - scripts/prepare_training_data.py
    outs:
      - data/processed/${AIRPORT}
    params:
      - params.yaml:
          - data.augmentation
          - data.split_ratio

  train:
    cmd: python train.py --config configs/${MODEL}.yaml
    deps:
      - data/processed/${AIRPORT}
      - configs/${MODEL}.yaml
      - src/models/${MODEL}/
    outs:
      - models/${MODEL}/checkpoint_best.pt
    metrics:
      - models/${MODEL}/metrics.json:
          cache: false
    plots:
      - models/${MODEL}/training_curves.csv

  export_onnx:
    cmd: python export_onnx.py --checkpoint models/${MODEL}/checkpoint_best.pt
    deps:
      - models/${MODEL}/checkpoint_best.pt
      - scripts/export_onnx.py
    outs:
      - models/${MODEL}/model.onnx
```

**Experiment tracking with W&B/MLflow**:

Every training run logs:
- Hyperparameters (learning rate, batch size, augmentation settings)
- Training/validation loss curves
- Per-class mAP on validation set at every epoch
- GPU utilization, memory, training time
- Git commit hash of the model code
- DVC hash of the training data
- Random seed used

This produces a complete audit trail from trained model back to exact code + data.

### 4.3 Evaluation Gate

The evaluation stage is the most critical gate in the ML pipeline. It must answer: "Is this model at least as good as the current production model, especially on safety-critical scenarios?"

```python
#!/usr/bin/env python3
"""ML model evaluation gate for CI pipeline."""

import json
import sys

# Thresholds — safety classes can NEVER regress
SAFETY_CLASSES = ['aircraft', 'personnel', 'fod', 'emergency_vehicle']
NON_SAFETY_CLASSES = ['gse_tug', 'gse_loader', 'gse_catering', 'barrier', 'cone']

GATES = {
    'overall_mAP': {'min': 0.0, 'regression_tolerance': 0.02},  # Allow 2% overall regression
    'safety_class_mAP': {'min': 0.0, 'regression_tolerance': 0.0},  # Zero tolerance
    'personnel_recall_50m': {'min': 0.95, 'regression_tolerance': 0.0},
    'aircraft_mAP': {'min': 0.0, 'regression_tolerance': 0.0},
    'fod_recall': {'min': 0.0, 'regression_tolerance': 0.005},  # 0.5% tolerance
    'latency_p99_ms': {'max': 50.0},  # Must fit within 50ms budget on Orin
    'memory_peak_mb': {'max': 3072},  # 3GB max on Orin (shared with other models)
}

def evaluate(new_metrics, baseline_metrics):
    """Compare new model against production baseline."""
    failures = []
    warnings = []

    for metric, gate in GATES.items():
        new_val = new_metrics.get(metric)
        base_val = baseline_metrics.get(metric)

        if new_val is None:
            failures.append(f"MISSING: {metric} not reported")
            continue

        # Absolute minimum check
        if 'min' in gate and new_val < gate['min']:
            failures.append(f"FAIL: {metric}={new_val:.4f} < min={gate['min']}")

        # Absolute maximum check
        if 'max' in gate and new_val > gate['max']:
            failures.append(f"FAIL: {metric}={new_val:.4f} > max={gate['max']}")

        # Regression check against baseline
        if base_val is not None and 'regression_tolerance' in gate:
            regression = base_val - new_val
            if regression > gate['regression_tolerance']:
                failures.append(
                    f"REGRESSION: {metric} dropped {regression:.4f} "
                    f"(baseline={base_val:.4f}, new={new_val:.4f}, "
                    f"tolerance={gate['regression_tolerance']})")

    return failures, warnings

if __name__ == '__main__':
    new = json.load(open(sys.argv[1]))
    baseline = json.load(open(sys.argv[2]))
    failures, warnings = evaluate(new, baseline)

    for w in warnings:
        print(f"WARNING: {w}")
    for f in failures:
        print(f"FAILURE: {f}")

    if failures:
        print(f"\n{len(failures)} failure(s) — model REJECTED")
        sys.exit(1)
    else:
        print("\nAll gates passed — model APPROVED for deployment pipeline")
        sys.exit(0)
```

**The zero-regression rule for safety classes**: The most important principle in AV ML CI is that safety-critical class performance (aircraft, personnel, FOD) must never decrease, even by 0.1%. A model that improves GSE detection by 5% but drops personnel recall by 0.1% is rejected. This is non-negotiable for certification.

### 4.4 TensorRT Conversion and Benchmarking

TensorRT engines must be built on the target hardware. This requires Orin devices in the CI farm:

```bash
#!/bin/bash
# scripts/ci/build_tensorrt_engine.sh
# Runs on Orin CI runner (self-hosted, tagged "orin")

set -euo pipefail

MODEL_ONNX=$1
MODEL_NAME=$(basename "$MODEL_ONNX" .onnx)
PRECISION=${2:-fp16}  # fp16 or int8

echo "=== Building TensorRT engine for ${MODEL_NAME} (${PRECISION}) ==="

# Build engine with locked autotuning for reproducibility
trtexec \
    --onnx="${MODEL_ONNX}" \
    --saveEngine="engines/${MODEL_NAME}_${PRECISION}.engine" \
    --${PRECISION} \
    --workspace=4096 \
    --minShapes=input:1x4x120000x5 \
    --optShapes=input:1x4x120000x5 \
    --maxShapes=input:1x8x150000x5 \
    --timingCacheFile="cache/${MODEL_NAME}_timing.cache" \
    --verbose 2>&1 | tee "logs/${MODEL_NAME}_build.log"

echo "=== Benchmarking ==="

# Run inference benchmark (100 iterations, report p50/p95/p99)
trtexec \
    --loadEngine="engines/${MODEL_NAME}_${PRECISION}.engine" \
    --iterations=100 \
    --warmUp=10 \
    --duration=0 \
    --percentile=50,95,99 2>&1 | tee "logs/${MODEL_NAME}_benchmark.log"

# Extract metrics
P50=$(grep "GPU Compute Time: " "logs/${MODEL_NAME}_benchmark.log" | awk '{print $NF}')
P99=$(grep "percentile" "logs/${MODEL_NAME}_benchmark.log" | tail -1 | awk '{print $NF}')
MEM=$(grep "GPU Memory" "logs/${MODEL_NAME}_benchmark.log" | awk '{print $NF}')

echo "{\"p50_ms\": ${P50}, \"p99_ms\": ${P99}, \"gpu_memory_mb\": ${MEM}}" \
    > "metrics/${MODEL_NAME}_benchmark.json"

# Gate check
if (( $(echo "$P99 > 50.0" | bc -l) )); then
    echo "FAIL: p99 latency ${P99}ms exceeds 50ms budget"
    exit 1
fi

echo "PASS: Engine built and benchmarked within budget"
```

### 4.5 INT8 Calibration in CI

INT8 quantization requires a calibration dataset that represents the deployment distribution. This dataset must be versioned and airport-specific:

```yaml
# CI job for INT8 calibration
calibrate_int8:
  stage: quantize
  tags: [orin]
  script:
    - dvc pull calibration_data/${AIRPORT}/calibration_set.dvc
    - python scripts/calibrate_int8.py \
        --onnx models/${MODEL}/model.onnx \
        --calibration-data calibration_data/${AIRPORT}/ \
        --num-samples 500 \
        --output models/${MODEL}/calibration_cache.bin
    - scripts/ci/build_tensorrt_engine.sh models/${MODEL}/model.onnx int8
  artifacts:
    paths:
      - engines/
      - models/${MODEL}/calibration_cache.bin
```

**Airport-specific calibration**: INT8 calibration data from Airport A may not represent Airport B's distribution (different pavement reflectivity, aircraft types, lighting). Each airport needs its own calibration set of 500-1000 representative frames. See `production-ml-deployment.md` Section 1 for details on TensorRT precision.

---

## 5. Simulation-in-the-Loop CI

### 5.1 Why Simulation in CI

Unit tests verify code correctness. Integration tests verify component communication. But only simulation verifies that the **system behaves correctly in driving scenarios**. A change to the Frenet planner that passes all unit tests can still cause the vehicle to clip an aircraft wing during pushback.

Simulation-in-the-loop CI runs driving scenarios as part of the merge process. This is the AV-specific analog of end-to-end integration tests in web development.

### 5.2 Simulation Tiers

Not every PR needs the full simulation suite. Tier the simulation by scope and compute cost:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       SIMULATION TIERS                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TIER 1: Smoke Tests (every PR, 15-30 min)                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  - 10-20 core scenarios (straight taxi, stand approach,         │    │
│  │    pedestrian crossing, e-stop, obstacle avoidance)             │    │
│  │  - Deterministic (fixed seed, fixed sensor noise)               │    │
│  │  - Binary pass/fail: collision = fail, e-stop timeout = fail    │    │
│  │  - Lightweight sim (log replay or minimal CARLA)                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  TIER 2: Regression Suite (PR to main, 1-4 hours)                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  - 100-200 scenarios from scenario taxonomy                     │    │
│  │  - Airport-specific scenario sets per deployment                │    │
│  │  - Statistical evaluation (3 runs per scenario, mean + stddev)  │    │
│  │  - Metrics: collision rate, mission completion, comfort,        │    │
│  │    clearance violations, latency compliance                     │    │
│  │  - Full CARLA or Isaac Sim with realistic sensor models         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  TIER 3: Full Certification Suite (release branch, 8-24 hours)          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  - 500-1000+ scenarios from ISO 34502 taxonomy                  │    │
│  │  - All weather conditions, all aircraft types, all time-of-day  │    │
│  │  - Multiple random seeds per scenario (10+ runs)                │    │
│  │  - Coverage-driven: 2-wise covering array for parameter space   │    │
│  │  - Produces certification evidence artifacts                    │    │
│  │  - SOTIF triggering condition coverage                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  TIER 4: Nightly Stress (scheduled, continuous)                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  - Randomized fuzzing: random scenarios, random failures        │    │
│  │  - Long-duration missions (4-8 hour simulated operations)       │    │
│  │  - Adversarial scenarios: sensor failure injection, GPS denial  │    │
│  │  - Results feed into scenario mining and test case creation     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Handling Non-Determinism in Simulation

Simulation is inherently non-deterministic due to physics engine numerical integration, GPU rendering, sensor noise models, and traffic agent behavior. A scenario that passes 9/10 times and fails 1/10 is a real signal, not a flaky test.

**Strategy: Statistical Pass/Fail**

```python
# Scenario pass criteria
SCENARIO_CRITERIA = {
    'collision_free': {
        'required_pass_rate': 1.0,  # 100% — any collision fails
        'min_runs': 3,
    },
    'mission_complete': {
        'required_pass_rate': 0.95,  # 95% of runs must complete
        'min_runs': 5,
    },
    'clearance_maintained': {
        'required_pass_rate': 1.0,  # 100% — clearance violations fail
        'min_runs': 3,
    },
    'comfort_within_limits': {
        'required_pass_rate': 0.90,  # 90% within comfort bounds
        'min_runs': 5,
    },
    'latency_within_budget': {
        'required_pass_rate': 0.99,  # 99% within timing budget
        'min_runs': 10,
    },
}
```

**Flaky test management**: If a scenario shows >5% failure rate variance across runs with no code change, it is flagged as unstable and moved to a quarantine suite. Quarantined tests run nightly but do not block PRs. An engineer must investigate and either fix the test or fix the non-determinism source.

### 5.4 CI Configuration for Simulation

```yaml
# GitLab CI simulation jobs
sim:smoke:
  stage: simulation
  tags: [gpu, sim-runner]
  script:
    - python scripts/sim/run_scenarios.py \
        --suite smoke \
        --config test/scenarios/smoke_suite.yaml \
        --num-runs 3 \
        --timeout 1800 \
        --output results/sim_smoke/
    - python scripts/sim/evaluate_results.py \
        --results results/sim_smoke/ \
        --criteria test/scenarios/pass_criteria.yaml
  artifacts:
    paths:
      - results/sim_smoke/
    reports:
      junit: results/sim_smoke/junit.xml
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

sim:regression:
  stage: simulation
  tags: [gpu, sim-runner]
  timeout: 4h
  script:
    - python scripts/sim/run_scenarios.py \
        --suite regression \
        --airport ${AIRPORT:-airport_a} \
        --num-runs 3 \
        --parallel 4 \
        --output results/sim_regression/
    - python scripts/sim/evaluate_results.py \
        --results results/sim_regression/ \
        --criteria test/scenarios/pass_criteria.yaml \
        --baseline results/baselines/${CI_DEFAULT_BRANCH}/
    - python scripts/sim/generate_report.py \
        --results results/sim_regression/ \
        --output results/sim_regression/report.html
  artifacts:
    paths:
      - results/sim_regression/
  rules:
    - if: $CI_MERGE_REQUEST_TARGET_BRANCH_NAME == "main"

sim:certification:
  stage: simulation
  tags: [gpu, sim-cluster]
  timeout: 24h
  script:
    - python scripts/sim/run_scenarios.py \
        --suite certification \
        --airport ${AIRPORT} \
        --num-runs 10 \
        --parallel 8 \
        --coverage-report results/sim_cert/coverage.json \
        --output results/sim_cert/
  rules:
    - if: $CI_COMMIT_BRANCH =~ /^release\//
  allow_failure: false
```

### 5.5 Log Replay as Lightweight Simulation

Full CARLA/Isaac Sim is expensive. For many regression tests, replaying recorded sensor data through the perception+planning pipeline is sufficient and 10-100x cheaper:

```bash
# Replay a rosbag through the stack and compare outputs to recorded ground truth
rosbag play test/bags/scenario_042.bag --clock --rate=1.0 &
rostopic echo -p /planning/trajectory > /tmp/new_trajectory.csv
# Wait for bag to finish
wait

# Compare trajectory against recorded ground truth
python scripts/sim/compare_trajectories.py \
    --new /tmp/new_trajectory.csv \
    --baseline test/baselines/scenario_042_trajectory.csv \
    --max-lateral-deviation 0.3 \
    --max-longitudinal-deviation 1.0
```

Log replay catches most perception and planning regressions. It cannot catch emergent behaviors from traffic interaction (the recorded agents do not react to the ego's changed decisions), but it covers 70-80% of regression testing at 1% of the compute cost.

---

## 6. Map and Configuration CI

### 6.1 HD Map Change Pipeline

Map changes are safety-critical -- a misplaced lane boundary can route a vehicle into an aircraft. Maps require their own validation pipeline:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      MAP CHANGE PIPELINE                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐   ┌───────────────┐   ┌───────────────┐                │
│  │ MAP EDIT   │──→│ VALIDATION    │──→│ SIM VERIFY    │                │
│  │            │   │               │   │               │                │
│  │ Lanelet2   │   │ - Schema      │   │ - Route all   │                │
│  │ JOSM or    │   │   check       │   │   missions    │                │
│  │ auto from  │   │ - Topology    │   │   through     │                │
│  │ SLAM       │   │   (connected  │   │   new map     │                │
│  │            │   │    graph)     │   │ - No route    │                │
│  │            │   │ - Geometry    │   │   failures    │                │
│  │            │   │   (no self-   │   │ - Clearance   │                │
│  │            │   │    intersect) │   │   check       │                │
│  │            │   │ - Regulatory  │   │               │                │
│  │            │   │   (speed,     │   │ 30-60 min     │                │
│  │            │   │    zones)     │   │               │                │
│  │            │   │ 2-5 min      │   │               │                │
│  └────────────┘   └───────┬───────┘   └───────┬───────┘                │
│                           │ PASS              │ PASS                    │
│                           ▼                   ▼                         │
│                    ┌───────────────┐   ┌───────────────┐                │
│                    │ SAFETY REVIEW │──→│ DEPLOY TO     │                │
│                    │               │   │ SHADOW FLEET  │                │
│                    │ Manual human  │   │               │                │
│                    │ review for    │   │ Run shadow    │                │
│                    │ any map       │   │ mode 48h+     │                │
│                    │ change        │   │ before full   │                │
│                    │               │   │ rollout       │                │
│                    └───────────────┘   └───────────────┘                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Lanelet2 Validation

```python
#!/usr/bin/env python3
"""Lanelet2 map validation for CI pipeline."""

import lanelet2
from lanelet2.core import BasicPoint3d
from lanelet2.io import load
from lanelet2.routing import RoutingGraph
from lanelet2.traffic_rules import Participants
import sys

def validate_map(map_path):
    """Run comprehensive validation on a Lanelet2 map."""
    errors = []
    warnings = []

    # Load map
    projector = lanelet2.projection.UtmProjector(lanelet2.io.Origin(51.5, -1.2))
    map_data = load(map_path, projector)

    # 1. Topology check: all lanelets reachable from routing graph
    traffic_rules = lanelet2.traffic_rules.create(
        lanelet2.traffic_rules.Locations.Germany,
        Participants.Vehicle)
    routing_graph = RoutingGraph(map_data, traffic_rules)

    reachable = set()
    for ll in map_data.laneletLayer:
        routes = routing_graph.getRoute(ll, 0.0)
        if routes is not None:
            reachable.add(ll.id)

    unreachable = set(ll.id for ll in map_data.laneletLayer) - reachable
    if unreachable:
        errors.append(f"Unreachable lanelets: {unreachable}")

    # 2. Geometry check: no self-intersecting boundaries
    for ll in map_data.laneletLayer:
        left = ll.leftBound
        right = ll.rightBound
        # Check for degenerate (zero-length) segments
        for bound in [left, right]:
            for i in range(len(bound) - 1):
                p1, p2 = bound[i], bound[i+1]
                dist = ((p1.x - p2.x)**2 + (p1.y - p2.y)**2)**0.5
                if dist < 0.01:  # 1cm minimum segment length
                    warnings.append(
                        f"Lanelet {ll.id}: degenerate segment at index {i} "
                        f"(length={dist:.4f}m)")

    # 3. Width check: all lanelets wide enough for vehicle
    MIN_WIDTH = 2.5  # meters, minimum for GSE vehicle
    for ll in map_data.laneletLayer:
        # Sample width at 1m intervals
        for s in range(0, int(lanelet2.geometry.length2d(ll)), 1):
            # ... width sampling logic ...
            pass

    # 4. Speed zone consistency
    for reg in map_data.regulatoryElementLayer:
        if hasattr(reg, 'speedLimit'):
            speed = reg.speedLimit
            if speed > 25:  # km/h — airside maximum
                errors.append(
                    f"Speed limit {speed} km/h exceeds airside maximum (25 km/h)")

    # 5. Regulatory layer completeness
    # Every lanelet must have a speed limit regulatory element
    for ll in map_data.laneletLayer:
        has_speed = any(
            hasattr(r, 'speedLimit')
            for r in ll.regulatoryElements)
        if not has_speed:
            warnings.append(f"Lanelet {ll.id}: no speed limit assigned")

    return errors, warnings

if __name__ == '__main__':
    errors, warnings = validate_map(sys.argv[1])
    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    if errors:
        sys.exit(1)
```

### 6.3 Configuration Change Validation

YAML parameter changes are deceptively dangerous. Changing `max_speed: 8.0` to `max_speed: 80.0` (a single-character typo) could drive a vehicle at highway speed on an apron.

**Schema validation**:

```yaml
# schemas/vehicle_config.schema.yaml
type: object
required: [max_speed_kmh, min_obstacle_distance_m, emergency_decel_mps2]
properties:
  max_speed_kmh:
    type: number
    minimum: 0.5
    maximum: 25.0
    description: "Maximum vehicle speed. Airside limit is 25 km/h."
  min_obstacle_distance_m:
    type: number
    minimum: 1.0
    maximum: 50.0
    description: "Minimum distance to maintain from detected obstacles."
  emergency_decel_mps2:
    type: number
    minimum: 1.0
    maximum: 8.0
    description: "Emergency braking deceleration."
  planning_horizon_s:
    type: number
    minimum: 1.0
    maximum: 10.0
  frenet_candidates:
    type: integer
    minimum: 50
    maximum: 1000
```

```yaml
# CI job for config validation
config_validation:
  stage: preflight
  script:
    # Schema validation
    - python scripts/ci/validate_config_schemas.py config/ schemas/
    # Range plausibility
    - python scripts/ci/check_config_ranges.py config/
    # Diff analysis — flag safety-relevant parameter changes
    - python scripts/ci/config_diff_safety.py \
        --old $(git show HEAD~1:config/vehicle.yaml) \
        --new config/vehicle.yaml
  rules:
    - changes:
        - config/**/*.yaml
```

### 6.4 AMDB Update Pipeline

Airport Mapping Databases (AMDB) update on a 28-day AIRAC cycle. Each update must be ingested and validated:

```
AIRAC Publication ──→ Download AMDB ──→ Diff vs Current ──→ Review Changes
                                                                  │
         ┌────────────────────────────────────────────────────────┘
         ▼
  Safety-relevant? ──→ Yes ──→ Manual review + SIM test + shadow deploy
         │
         No ──→ Auto-merge after schema validation
```

Safety-relevant AMDB changes include:
- New or modified taxiway designations
- Changed holding positions
- New construction/closure areas
- Modified stand assignments

Non-safety changes (cosmetic label changes, unchanged geometry) can be auto-merged after schema validation.

---

## 7. Artifact Management and Versioning

### 7.1 Version Pinning Strategy

A fleet deployment must pin exact versions of all six artifact types. Ambiguity in any single artifact type can cause field failures:

```yaml
# deployment_manifest.yaml — pins every artifact for a release
release:
  version: "2.4.0"
  timestamp: "2026-04-10T14:30:00Z"
  approved_by: "safety-engineer@airside-av.example"
  deployment_target: "airport_a"

artifacts:
  code:
    git_commit: "a1b2c3d4e5f6"
    git_tag: "v2.4.0"
    docker_image: "registry.airside-av.example/ads:v2.4.0-aarch64"
    binary_sha256: "sha256:e3b0c44298fc..."

  models:
    perception:
      name: "centerpoint-v3.2-airport_a"
      onnx_sha256: "sha256:abc123..."
      engine_sha256: "sha256:def456..."
      tensorrt_version: "8.6.1"
      cuda_version: "11.4"
      calibration_data_dvc: "calibration/airport_a@v1.2"
      eval_metrics:
        overall_mAP: 0.723
        personnel_recall_50m: 0.961
        aircraft_mAP: 0.889
    segmentation:
      name: "flatformer-v1.1-airport_a"
      onnx_sha256: "sha256:789abc..."
      engine_sha256: "sha256:012def..."

  maps:
    lanelet2: "airports/airport_a/lanelet2@v3.1"
    pointcloud: "airports/airport_a/pointcloud@v2.0"
    amdb_cycle: "AIRAC 2604"
    semantic: "airports/airport_a/semantic@v1.5"

  config:
    vehicle_type: "third-generation tug"
    config_commit: "b2c3d4e5f6a7"
    parameter_hash: "sha256:345678..."

  calibration:
    lidar_extrinsics: "calibration/third-generation tug-007/lidar_extrinsics@2026-04-08"
    imu_biases: "calibration/third-generation tug-007/imu_biases@2026-04-08"
    thermal_drift_table: "calibration/third-generation tug-007/thermal_lut@v1.0"
```

### 7.2 DVC for Large Artifacts

Git cannot handle multi-GB model weights and map files. DVC (Data Version Control) bridges this gap:

```
Git repo (lightweight)              S3/MinIO (heavy storage)
├── models/                         ├── models/
│   ├── centerpoint.onnx.dvc ─────→│   └── ab/cd1234...  (actual .onnx file)
│   └── flatformer.onnx.dvc ──────→│   └── ef/gh5678...
├── maps/
│   ├── airport_a.pcd.dvc ────────→│   └── ij/kl9012...  (point cloud)
│   └── airport_a.osm.dvc ────────→│   └── mn/op3456...
└── calibration/
    └── third-generation tug-007.yaml.dvc ────────→│   └── qr/st7890...
```

DVC commands in CI:

```yaml
# Pull specific artifacts needed for testing
pull_test_data:
  stage: prepare
  script:
    - dvc pull test/bags/smoke_test.bag.dvc
    - dvc pull models/centerpoint_baseline.onnx.dvc
    - dvc pull calibration/${VEHICLE_ID}/
```

### 7.3 Container Images

Each release produces a Docker image containing the complete ROS workspace, launch files, and configuration. Model weights and maps are mounted as volumes (too large to bake into images, and change on different schedules):

```dockerfile
# Dockerfile.deploy
FROM nvcr.io/nvidia/l4t-jetpack:r36.4.0

# ROS Noetic
RUN apt-get update && apt-get install -y ros-noetic-ros-base
COPY devel/ /opt/airside_av/devel/
COPY launch/ /opt/airside_av/launch/
COPY config/ /opt/airside_av/config/
COPY scripts/ /opt/airside_av/scripts/

# Entrypoint sources ROS and launches the stack
COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

# Models and maps mounted at runtime:
# -v /data/models:/opt/airside_av/models
# -v /data/maps:/opt/airside_av/maps
# -v /data/calibration:/opt/airside_av/calibration
```

---

## 8. Fleet Deployment Pipeline

### 8.1 Deployment Stages

The fleet deployment pipeline is the most safety-critical part of CI/CD. It progresses through five stages with explicit gates between each:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FLEET DEPLOYMENT PIPELINE                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  STAGE 1     │───→│  STAGE 2     │───→│  STAGE 3     │              │
│  │  DEV/SIL     │    │  HIL TEST    │    │  SHADOW      │              │
│  │              │    │              │    │  DEPLOY      │              │
│  │  Full sim    │    │  Orin bench  │    │              │              │
│  │  regression  │    │  on real HW  │    │  1-3 vehicles│              │
│  │  All tests   │    │  Sensor      │    │  Shadow mode │              │
│  │  pass        │    │  replay on   │    │  48h-168h    │              │
│  │              │    │  target      │    │  No control  │              │
│  │  Auto gate   │    │              │    │  Compare vs  │              │
│  │  1-4 hours   │    │  Auto gate   │    │  production  │              │
│  │              │    │  2-8 hours   │    │              │              │
│  └──────┬───────┘    └──────┬───────┘    │  Manual gate │              │
│         │ ALL PASS          │ ALL PASS   │  1-7 days    │              │
│         ▼                   ▼            └──────┬───────┘              │
│                                                 │                      │
│                                          ┌──────▼───────┐              │
│                                          │  STAGE 4     │              │
│                                          │  CANARY      │              │
│                                          │  DEPLOY      │              │
│                                          │              │              │
│                                          │  10% fleet   │              │
│                                          │  Full control│              │
│                                          │  Enhanced    │              │
│                                          │  monitoring  │              │
│                                          │  Auto rollbk │              │
│                                          │              │              │
│                                          │  Auto gate   │              │
│                                          │  24-72 hours │              │
│                                          └──────┬───────┘              │
│                                                 │ NO ANOMALIES         │
│                                                 ▼                      │
│                                          ┌──────────────┐              │
│                                          │  STAGE 5     │              │
│                                          │  FULL        │              │
│                                          │  ROLLOUT     │              │
│                                          │              │              │
│                                          │  25% → 50%   │              │
│                                          │  → 100%      │              │
│                                          │  fleet       │              │
│                                          │              │              │
│                                          │  Manual gate │              │
│                                          │  + safety    │              │
│                                          │    sign-off  │              │
│                                          │  3-7 days    │              │
│                                          └──────────────┘              │
│                                                                          │
│  Total: Code commit to 100% fleet: 2-4 weeks (nominal)                 │
│         Hotfix path: 24-72 hours (safety-only CI, abbreviated shadow)  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Automated Rollback Triggers

During canary and gradual rollout, automated monitoring watches for rollback triggers:

| Trigger | Threshold | Response | Latency |
|---|---|---|---|
| Collision or near-miss | Any single event | Immediate rollback + fleet halt | <10 seconds |
| E-stop rate increase | >2x baseline | Rollback canary group | <5 minutes |
| Perception false negative | Safety class missed on replay | Rollback + investigation | <1 hour |
| Latency budget violation | p99 > 50ms for >5 min | Rollback canary group | <10 minutes |
| OOD detection spike | >3x baseline anomaly rate | Pause rollout, investigate | <30 minutes |
| Operator intervention rate | >1.5x baseline | Pause rollout, investigate | <4 hours |
| Vehicle fault rate | >2x baseline | Rollback canary group | <1 hour |

**Rollback mechanism**: See `../../50-cloud-fleet/ota/ota-fleet-management.md` Section 5 for A/B partition rollback. The key addition here is that rollback is **automated** based on the triggers above. No human needs to decide -- the monitoring system triggers rollback and alerts the engineering team.

```python
# Simplified rollback decision logic
class RollbackMonitor:
    """Monitors canary fleet and triggers rollback if thresholds exceeded."""

    IMMEDIATE_ROLLBACK = ['collision', 'near_miss']
    ESCALATION_ROLLBACK = ['estop_rate', 'latency_violation', 'vehicle_fault']
    INVESTIGATION_PAUSE = ['ood_spike', 'intervention_rate']

    def check(self, metrics, baseline):
        for event_type in self.IMMEDIATE_ROLLBACK:
            if metrics.get(event_type, 0) > 0:
                return 'ROLLBACK_IMMEDIATE', event_type

        for metric in self.ESCALATION_ROLLBACK:
            if metrics.get(metric, 0) > baseline.get(metric, 0) * 2.0:
                return 'ROLLBACK_CANARY', metric

        for metric in self.INVESTIGATION_PAUSE:
            ratio = metrics.get(metric, 0) / max(baseline.get(metric, 1), 1)
            if ratio > 1.5:
                return 'PAUSE_ROLLOUT', metric

        return 'CONTINUE', None
```

### 8.3 A/B Fleet Testing

For non-safety model updates (e.g., improved GSE classification), A/B testing allows statistically rigorous comparison:

```
Fleet of 20 vehicles:
  Group A (control):  10 vehicles, production model v2.3
  Group B (treatment): 10 vehicles, candidate model v2.4
  Duration: 2 weeks
  Metrics: mission completion rate, intervention rate, detection accuracy
  Statistical test: Two-sample t-test, alpha=0.05, power=0.8
  Minimum detectable effect: 10% improvement in target metric
```

**Constraints on A/B testing for safety-critical systems**:
- Safety-critical changes are NEVER A/B tested -- they go through the full shadow+canary pipeline
- A/B groups must be balanced for route difficulty, weather exposure, and operator skill
- If Group B shows any safety degradation during A/B test, it is immediately terminated

See `../../50-cloud-fleet/ota/ota-fleet-management.md` Section 4 and `data-flywheel-airside.md` Section 6 for detailed A/B testing methodology.

### 8.4 Multi-Airport Deployment Orchestration

When deploying across multiple airports, each airport has its own artifact set (models, maps, calibration) but shares the code base:

```yaml
# Multi-airport deployment matrix
deployments:
  airport_a:
    code_version: "v2.4.0"  # Shared
    model_version: "centerpoint-v3.2-airport_a"  # Airport-specific
    map_version: "airport_a/lanelet2@v3.1"  # Airport-specific
    config: "config/airport_a/vehicle.yaml"
    rollout_schedule:
      shadow: "2026-04-14"
      canary: "2026-04-18"
      full: "2026-04-22"

  airport_b:
    code_version: "v2.4.0"  # Same code
    model_version: "centerpoint-v3.1-airport_b"  # Different model version
    map_version: "airport_b/lanelet2@v2.8"
    config: "config/airport_b/vehicle.yaml"
    rollout_schedule:
      shadow: "2026-04-21"  # Staggered — 1 week after airport_a
      canary: "2026-04-25"
      full: "2026-04-29"
```

**Stagger deployments across airports**: Never deploy to multiple airports simultaneously. Deploy to the airport with the most operational data first (better baseline for anomaly detection), observe for one week, then deploy to the next.

---

## 9. Monitoring and Observability

### 9.1 Runtime Monitoring Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     MONITORING ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ON-VEHICLE (real-time)                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Prometheus Node Exporter                                       │    │
│  │  ├── CPU/GPU utilization, temperature, memory                  │    │
│  │  ├── ROS topic rates (Hz), latency (ms), queue depths          │    │
│  │  ├── Model inference latency (p50/p95/p99 per model)           │    │
│  │  ├── Sensor health (point count, range, coverage)              │    │
│  │  ├── Safety monitor state (armed/disarmed/fault)               │    │
│  │  └── Vehicle state (speed, battery, fault codes)               │    │
│  │                                                                 │    │
│  │  Fluentd / Vector log shipper                                   │    │
│  │  ├── ROS logs (filtered: WARN and above)                       │    │
│  │  ├── Safety event log (all severity levels)                    │    │
│  │  └── Structured JSON logs for parsing                          │    │
│  └────────────────────────┬────────────────────────────────────────┘    │
│                           │ WiFi/5G upload (batch every 30s)           │
│                           ▼                                             │
│  CLOUD (analytics)                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Grafana + Prometheus (time-series metrics)                     │    │
│  │  ├── Fleet-wide dashboard: all vehicles, all airports           │    │
│  │  ├── Per-vehicle dashboard: detailed health                     │    │
│  │  ├── Alerting: PagerDuty/Slack integration                      │    │
│  │  └── SLA tracking: uptime, mission completion rate              │    │
│  │                                                                 │    │
│  │  Elasticsearch + Kibana (log analysis)                          │    │
│  │  ├── Safety event search and correlation                        │    │
│  │  ├── Error pattern detection                                    │    │
│  │  └── Incident timeline reconstruction                           │    │
│  │                                                                 │    │
│  │  Custom dashboards (model performance)                          │    │
│  │  ├── mAP drift detection per airport                            │    │
│  │  ├── OOD detection rate trends                                  │    │
│  │  └── Scenario-specific performance tracking                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Key Metrics to Monitor

**Tier 1 -- Safety (immediate alert)**:

| Metric | Collection Rate | Alert Threshold | Response |
|---|---|---|---|
| E-stop activation | Event-driven | Any activation | Page on-call engineer |
| Safety monitor fault | 10 Hz | Any fault | Page on-call + auto safe-stop |
| Collision proximity | 10 Hz | <1m from aircraft/person | Log + alert + review |
| Geofence violation | 10 Hz | Any violation | Auto safe-stop + alert |
| Perception total failure | 1 Hz | 0 detections for >2s | Auto safe-stop + alert |

**Tier 2 -- Performance (escalation after threshold)**:

| Metric | Collection Rate | Alert Threshold | Response |
|---|---|---|---|
| Inference latency p99 | 1 Hz | >50ms for >5min | Alert + investigate |
| Mission completion rate | Per-mission | <90% over 24h | Alert + investigate |
| Operator intervention rate | Per-mission | >2x baseline over 8h | Alert + consider rollback |
| GPU temperature | 1 Hz | >85C sustained | Throttle warning |
| LiDAR point count | 1 Hz | <50% of expected | Sensor degradation alert |

**Tier 3 -- Operational (daily review)**:

| Metric | Collection Rate | Review Cadence | Action |
|---|---|---|---|
| Battery consumption per km | Per-mission | Daily | Fleet charging optimization |
| Network upload success rate | Per-batch | Daily | Connectivity troubleshooting |
| Model OOD detection rate | 1 Hz | Daily | Data collection trigger |
| Map drift indicators | Per-session | Weekly | Survey re-assessment |

### 9.3 Incident Response Automation

When a Tier 1 alert fires, the system automatically:

1. **Captures context**: Saves last 60 seconds of rosbag data from the affected vehicle
2. **Broadcasts fleet alert**: Notifies all vehicles of the event type (e.g., "aircraft proximity violation at stand 12") via V2X or fleet management
3. **Creates incident ticket**: Auto-generates a ticket in the incident tracking system with attached rosbag, logs, and telemetry
4. **Triggers data pipeline**: Marks the rosbag for priority annotation and model evaluation
5. **Notifies humans**: PagerDuty alert to on-call engineer + Slack notification to #incidents channel

See `runtime-verification-monitoring.md` for detailed STL monitoring specifications and `../monitoring-observability/hmi-operator-interface.md` Section 7 for the operator-facing incident reporting pipeline.

---

## 10. ML Regression Detection

### 10.1 The Regression Problem

ML model regression is insidious because it can be invisible to standard test metrics. A model update can:
- Improve overall mAP by 2% while degrading personnel detection at night by 5%
- Pass all benchmark scenarios while failing on a specific aircraft type (A380 vs B737)
- Perform identically on the test set while hallucinating objects in a new pavement texture

Standard overall-mAP evaluation catches none of these. Airport-specific, scenario-specific, and class-specific regression detection is required.

### 10.2 Multi-Dimensional Benchmark Suite

```yaml
# evaluation/benchmarks/airport_a_benchmark.yaml
benchmark:
  name: "Airport A Comprehensive Benchmark"
  version: "v2.1"
  eval_datasets:
    # Standard evaluation
    - name: "airport_a_val"
      path: "dvc://datasets/airport_a/val"
      frames: 5000
      metrics: [mAP, NDS, per_class_AP]

    # Per-class stratified evaluation
    - name: "aircraft_focused"
      path: "dvc://datasets/airport_a/aircraft_focused"
      frames: 1000
      metrics: [aircraft_AP, aircraft_recall_100m]
      gate: "no_regression"

    - name: "personnel_focused"
      path: "dvc://datasets/airport_a/personnel_focused"
      frames: 800
      metrics: [personnel_AP, personnel_recall_50m, personnel_recall_night]
      gate: "no_regression"

    - name: "fod_focused"
      path: "dvc://datasets/airport_a/fod_focused"
      frames: 500
      metrics: [fod_recall, fod_precision]
      gate: "no_regression"

    # Condition-stratified evaluation
    - name: "night_operations"
      path: "dvc://datasets/airport_a/night"
      frames: 1200
      metrics: [mAP, personnel_AP]
      gate: "warn_on_regression"

    - name: "rain_conditions"
      path: "dvc://datasets/airport_a/rain"
      frames: 600
      metrics: [mAP, range_degradation]
      gate: "warn_on_regression"

    - name: "de_icing_operations"
      path: "dvc://datasets/airport_a/deicing"
      frames: 400
      metrics: [mAP, false_positive_rate]
      gate: "warn_on_regression"

    # Airport-specific edge cases
    - name: "stand_12_approach"
      path: "dvc://datasets/airport_a/stand_12"
      frames: 200
      metrics: [mAP, clearance_accuracy]
      gate: "warn_on_regression"
      note: "Stand 12 has unusual bollard configuration"
```

### 10.3 Regression Detection Algorithm

```python
#!/usr/bin/env python3
"""Multi-dimensional ML regression detection."""

import json
import numpy as np
from scipy import stats

def detect_regression(new_metrics, baseline_metrics, history):
    """
    Detect regression across multiple dimensions.

    Args:
        new_metrics: Current evaluation results
        baseline_metrics: Production model results
        history: List of previous evaluation results (for trend detection)
    """
    findings = []

    for dataset_name, new_result in new_metrics.items():
        base_result = baseline_metrics.get(dataset_name, {})

        for metric_name, new_value in new_result.items():
            base_value = base_result.get(metric_name)
            if base_value is None:
                continue

            # 1. Direct regression check
            regression = base_value - new_value
            if regression > 0:
                # Check if regression is statistically significant
                # using historical variance
                hist_values = [
                    h.get(dataset_name, {}).get(metric_name)
                    for h in history if h.get(dataset_name, {}).get(metric_name) is not None
                ]
                if len(hist_values) >= 5:
                    hist_std = np.std(hist_values)
                    z_score = regression / max(hist_std, 1e-6)
                    if z_score > 2.0:  # 2 sigma = significant regression
                        findings.append({
                            'type': 'REGRESSION',
                            'dataset': dataset_name,
                            'metric': metric_name,
                            'baseline': base_value,
                            'new': new_value,
                            'regression': regression,
                            'z_score': z_score,
                            'severity': 'HIGH' if z_score > 3.0 else 'MEDIUM',
                        })

            # 2. Trend detection — check for gradual degradation
            if len(hist_values) >= 10:
                slope, _, r_value, p_value, _ = stats.linregress(
                    range(len(hist_values)), hist_values)
                if slope < 0 and p_value < 0.05:
                    findings.append({
                        'type': 'TREND_DEGRADATION',
                        'dataset': dataset_name,
                        'metric': metric_name,
                        'slope_per_version': slope,
                        'r_squared': r_value ** 2,
                        'p_value': p_value,
                    })

    return findings
```

### 10.4 Per-Airport Regression Suites

Each airport accumulates a growing regression suite from operational edge cases:

```
evaluation/
├── benchmarks/
│   ├── airport_a_benchmark.yaml
│   ├── airport_a_edge_cases/
│   │   ├── ec_001_a380_reflection.bag     # A380 fuselage causing false detection
│   │   ├── ec_002_night_personnel.bag      # Personnel missed at night
│   │   ├── ec_003_deicing_spray.bag        # De-icing spray false positives
│   │   └── ec_004_pushback_occlusion.bag   # Pushback tug occluded by aircraft
│   ├── airport_b_benchmark.yaml
│   └── airport_b_edge_cases/
│       ├── ec_001_snow_ground.bag          # Snow-covered ground
│       └── ec_002_terminal_shadow.bag      # Terminal shadow GPS degradation
└── baselines/
    ├── v2.3.0/
    │   ├── airport_a_results.json
    │   └── airport_b_results.json
    └── v2.4.0/
        ├── airport_a_results.json
        └── airport_b_results.json
```

Every operator-flagged incident, every shadow mode disagreement, and every near-miss generates a candidate for the regression suite. The suite grows monotonically -- cases are never removed. This is the test set analog of the data flywheel (see `data-flywheel-airside.md`).

---

## 11. Safety Assurance Integration

### 11.1 Mapping CI/CD Evidence to Certification Requirements

The primary value of a structured CI/CD pipeline for safety-critical AV development is not speed -- it is **evidence generation**. Every pipeline run produces artifacts that map directly to certification requirements:

| Certification Requirement | Standard | CI/CD Evidence | Pipeline Stage |
|---|---|---|---|
| Coding standard compliance | ISO 26262-6 Cl.8, MISRA | clang-tidy + cppcheck reports | Stage 3 (Lint) |
| Structural test coverage | ISO 26262-6 Cl.9 | lcov/gcov coverage reports, MC/DC | Stage 4 (Unit Test) |
| Integration test results | ISO 26262-6 Cl.10 | rostest JUnit XML reports | Stage 5 (Integration) |
| Static analysis results | ISO 26262-6 Cl.11 | MISRA compliance reports, Polyspace | Stage 3 (Analysis) |
| Binary reproducibility | ISO 26262-6 Cl.8 | Build hash comparison logs | Stage 6 (Artifacts) |
| Traceability matrix | ISO 26262-6 Cl.6 | Auto-generated from code annotations | Stage 6 (Artifacts) |
| Safety function verification | ISO 3691-4 Cl.4 | Simulation test results | Sim Tier 2-3 |
| Personnel detection test | ISO 3691-4 Cl.4.3 | Sim + field test results | Sim + Field |
| Speed limiting verification | ISO 3691-4 Cl.4.5 | Unit test + HIL results | Stage 4 + HIL |
| Change impact analysis | ISO 26262-8 Cl.7 | Auto-generated impact reports | Stage 3 (on PR) |
| ODD boundary verification | UL 4600 Cl.8 | Sim scenario pass rates | Sim Tier 3 |
| Runtime monitoring evidence | UL 4600 Cl.12 | Fleet monitoring dashboards | Production monitoring |
| Continuous improvement | ISO 3691-4 Cl.6 | Version history, regression results | All stages |

### 11.2 Traceability Pipeline

The CI pipeline automatically maintains bidirectional traceability:

```
Requirement SSR-001 ──→ Design SDD-001 ──→ Code arbitrator.cpp ──→ Test test_estop.cpp
     │                       │                     │                       │
     │                       │                     │                       │
     ▼                       ▼                     ▼                       ▼
 JIRA ticket ────── Design doc ────── Git commits ────── Test results (JUnit)
 (requirement       (in repo)        (with SSR-001       (linked to SSR-001
  management)                         tags in commits)    via test naming)
```

**Convention**: All commits, test names, and design docs reference requirement IDs:

```cpp
// In code:
// @safety_req SSR-001 Emergency braking within 50ms
void SafetyMonitor::triggerEmergencyBraking() { ... }

// In tests:
// Test name encodes requirement: TEST(SafetyMonitor, SSR001_EmergencyBraking_Within50ms)
TEST(SafetyMonitor, SSR001_EmergencyBraking_Within50ms) { ... }

// In CI, auto-extract:
// grep -r "@safety_req" src/ → build traceability matrix
```

### 11.3 Regulatory Deployment Gate

For regulated environments (ISO 3691-4, EU Machinery Regulation 2023/1230), deployment requires human sign-off that cannot be bypassed by automation:

```yaml
# GitLab CI regulatory gate
regulatory_approval:
  stage: deploy_gate
  script:
    - echo "Awaiting regulatory sign-off from safety engineer"
    - echo "Deployment manifest: ${MANIFEST_URL}"
    - echo "Test evidence package: ${EVIDENCE_URL}"
  when: manual  # MUST be manually triggered
  allow_failure: false
  environment:
    name: production/$AIRPORT
    action: prepare
  rules:
    - if: $CI_COMMIT_BRANCH =~ /^release\//
```

**What the safety engineer reviews before clicking "Deploy"**:

1. All CI stages passed (automated verification)
2. Simulation regression suite passed (automated)
3. Shadow mode results show no safety-critical disagreements (automated + human review)
4. Change impact analysis shows no unreviewed safety requirement modifications (automated report, human review)
5. Any new MISRA deviations are documented and justified (human review)
6. Deployment manifest is complete and all artifact versions are pinned (automated check)
7. Airport-specific edge case suite shows no regression (automated)
8. Regulatory documentation package is current (human verification)

This gate takes 30-60 minutes of human review time. It cannot be automated away for certification purposes -- an assessor will ask "Who approved this release and what evidence did they review?"

### 11.4 EU AI Act Implications (2027 Machinery Regulation)

The EU Machinery Regulation 2023/1230 (effective January 2027) mandates third-party conformity assessment for autonomous vehicles with AI control systems. This directly impacts CI/CD:

- **Technical documentation**: Must be generated automatically by CI and kept current. Manual documentation goes stale.
- **Audit trail**: Complete, immutable log from requirement through code through test through deployment. Git + CI logs + artifact stores provide this.
- **Change management**: Every change to safety-critical components must have documented impact analysis. The change impact analysis script (see `functional-safety-software.md` Section 8.4) runs automatically in CI.
- **Continuous compliance**: Not a one-time certification but ongoing. CI/CD must produce fresh evidence with every release.

---

## 12. Infrastructure and Tooling

### 12.1 CI/CD Platform Comparison

| Platform | Strengths for AV | Weaknesses for AV | Used By |
|---|---|---|---|
| **GitLab CI/CD** | Self-hosted runners (Orin), built-in container registry, DAG pipelines, compliance frameworks | Heavy resource usage, complex YAML | Aurora, Waymo (internal), many startups |
| **GitHub Actions** | Large ecosystem, easy setup, matrix builds | Limited self-hosted runner support, no built-in artifact management for large files | comma.ai (open source), Nuro |
| **Jenkins** | Highly customizable, mature plugin ecosystem, free | Maintenance burden, outdated UI, Groovy scripting | Legacy AV companies, Cruise (pre-pause) |
| **Buildkite** | Excellent self-hosted runner support, fast, scales well | Smaller ecosystem, no built-in features | Several AV startups |
| **Bazel + custom** | Hermetic builds, remote caching, massive monorepo support | Steep learning curve, poor ROS integration | Tesla, Waymo |

**Recommendation for reference airside AV stack (current scale)**: GitLab CI/CD self-hosted.

Rationale:
- Self-hosted runners are essential for Orin hardware and rosbag replay
- Built-in container registry for Docker images
- Compliance and audit features built in (Ultimate tier)
- DAG-based pipelines allow parallel stages with dependencies
- Reasonable learning curve for a small team

### 12.2 Runner Infrastructure

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       CI RUNNER INFRASTRUCTURE                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  x86 RUNNERS (cloud or on-premise)                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Runner Pool: "x86-build"   (4-8 runners)                      │    │
│  │  Specs: 16 cores, 32 GB RAM, 500 GB NVMe                      │    │
│  │  Purpose: Code build, lint, unit tests, pre-flight             │    │
│  │  Concurrency: 4 jobs per runner                                │    │
│  │  Cost: ~$400/month per runner (cloud) or $3K one-time (HW)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  GPU RUNNERS (on-premise)                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Runner Pool: "gpu-sim"   (2-4 runners)                        │    │
│  │  Specs: RTX 4090 / A5000, 64 GB RAM, 2 TB NVMe                │    │
│  │  Purpose: Simulation, ML evaluation, training                   │    │
│  │  Concurrency: 1-2 jobs per runner (GPU-bound)                   │    │
│  │  Cost: ~$8-15K one-time per runner                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ORIN RUNNERS (on-premise, dedicated hardware)                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Runner Pool: "orin"   (2-3 devices)                            │    │
│  │  Specs: Orin AGX 64GB, identical to production vehicles         │    │
│  │  Purpose: TensorRT build, aarch64 build, on-target benchmark   │    │
│  │  Concurrency: 1 job per device (exclusive access)               │    │
│  │  Cost: ~$2K per device                                          │    │
│  │  NOTE: Must match production JetPack version exactly            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Storage                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  MinIO (S3-compatible): DVC remote, model weights, rosbags      │    │
│  │  GitLab Container Registry: Docker images                        │    │
│  │  NFS: Shared rosbag storage for replay tests                    │    │
│  │  Cost: ~$500/month for 10TB                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 12.3 Experiment Tracking

ML experiment tracking is orthogonal to code CI but feeds into the ML CI pipeline:

| Tool | Strengths | Weaknesses | Cost |
|---|---|---|---|
| **Weights & Biases** | Best visualization, easy team collaboration, artifact tracking | SaaS only (data leaves premises), cost scales with team | $50/user/month (Team) |
| **MLflow** | Open source, self-hosted, model registry, broad framework support | UI less polished, requires hosting infra | Free (self-hosted) |
| **Neptune.ai** | Good comparison features, metadata tracking | Smaller community, SaaS pricing | $49/user/month |
| **ClearML** | Open source, full pipeline orchestration, data versioning | Complex setup, less mature | Free (self-hosted) |

**Recommendation for reference airside AV stack**: MLflow (self-hosted) for production tracking + W&B (SaaS) for research experiments.

Rationale:
- MLflow keeps production model metadata on-premise (important for airport data sovereignty)
- MLflow's model registry integrates with CI/CD for promotion workflows (staging → production)
- W&B is superior for interactive experiment exploration during research phase
- Both can be used simultaneously via simple logging wrappers

### 12.4 Data Pipeline Integration

The CI/CD pipeline connects to the data flywheel (see `data-flywheel-airside.md`) at two points:

1. **Evaluation data**: CI pulls curated evaluation datasets from DVC to evaluate new models
2. **Incident → regression test**: Production incidents create new regression test cases that are added to CI suites

```
Production Incident
    │
    ▼
Rosbag Captured ──→ Annotated ──→ Added to Regression Suite
    │                                      │
    ▼                                      ▼
Active Learning                    CI Pipeline
(retrain model)                    (prevent future regression)
```

---

## 13. Airside-Specific Pipeline Requirements

### 13.1 Regulatory Deployment Gate

Airport deployments operate under regulatory frameworks that web software does not face. The CI/CD pipeline must enforce:

**No deployment without sign-off**: Unlike web apps where anyone can merge to main and deploy, airside AV deployments require documented approval from:
1. reference airside AV stack safety engineer (internal)
2. Airport operations manager (external, per airport)
3. Regulatory compliance (if change affects certified safety functions)

```yaml
# Deployment approval chain
deploy_airport_a:
  stage: deploy
  script:
    - scripts/deploy/deploy_to_fleet.sh airport_a
  when: manual
  environment:
    name: production/airport_a
  rules:
    - if: $CI_COMMIT_BRANCH =~ /^release\//
  # GitLab protected environments require specific approvers
  # Configured in GitLab UI: Settings → CI/CD → Protected Environments
```

### 13.2 Airport-Specific Regression Suites

Each airport has unique characteristics that require custom test cases:

| Airport Feature | Test Case Type | Example |
|---|---|---|
| Stand geometry | Sim scenario | "Approach stand 12 with A380 present, verify 3m wing clearance" |
| Pavement reflectivity | Perception eval | "Evaluate detection on wet concrete apron surface" |
| Aircraft mix | Benchmark dataset | "Eval on airport-specific aircraft type distribution" |
| Weather pattern | Condition-stratified eval | "Night + rain + de-icing scenario suite" |
| Traffic pattern | Sim scenario | "Peak hour with 5 GSE vehicles + 2 pedestrians crossing" |
| GPS shadow zones | Localization eval | "Navigate through terminal shadow zone without GPS" |

### 13.3 Multi-Airport Configuration Management

```yaml
# config/airports/airport_a/vehicle_adt3.yaml
# Airport-specific parameters for third-generation tug vehicle at Airport A
airport:
  code: "EGAA"
  name: "Airport A"
  amdb_version: "AIRAC 2604"
  coordinate_frame: "utm_zone_29n"

vehicle:
  type: "third-generation tug"
  max_speed_kmh: 15.0  # Airport A limit: 15 km/h (lower than generic 25)
  steering_mode: "ackermann"  # Default mode for Airport A routes

perception:
  model: "centerpoint-v3.2-airport_a"
  lidar_config: "8x_rshelios"
  detection_range_m: 100.0
  aircraft_classes: ["A320", "A321", "B737-800", "B777"]  # Airport A fleet

planning:
  frenet_candidates: 420
  min_aircraft_clearance_m: 5.0
  min_personnel_clearance_m: 3.0
  stand_approach_speed_kmh: 5.0

safety:
  geofence: "maps/airport_a/geofence.json"
  restricted_zones: ["runway_09_27", "fuel_farm", "fire_station"]
  night_speed_reduction: 0.3  # 30% speed reduction at night
```

### 13.4 NOTAM Integration in CI

NOTAMs (Notices to Air Missions) modify operational areas dynamically. While runtime NOTAM handling is an operational concern (see `70-operations-domains/airside/operations/ground-control-instructions.md`), CI must validate that the NOTAM parsing system handles all known NOTAM formats:

```yaml
# CI job: test NOTAM parser against corpus of real NOTAMs
test_notam_parser:
  stage: integration
  script:
    - python -m pytest test/notam/ -v
    - python scripts/test_notam_corpus.py \
        --corpus test/notam/corpus/ \
        --expected test/notam/expected_output/ \
        --report results/notam_test.json
  artifacts:
    paths:
      - results/notam_test.json
```

---

## 14. Industry Approaches to Safety-Critical DevOps

### 14.1 comma.ai: Speed Through Simplicity

comma.ai operates the fastest release cycle in the AV industry (bi-weekly OTA updates to 10,000+ devices) while maintaining a safety-critical system. Their approach:

- **2.5M lines of Python/C++, but only ~20K lines are safety-critical** (the Panda CAN safety layer)
- **Safety layer on separate hardware**: STM32H725 microcontroller running MISRA C code with 100% line coverage. This is independent of the main CI pipeline.
- **Main CI is standard web CI**: GitHub Actions, Python pytest, CI/CD runs in minutes. The driving stack is treated as "software that can be wrong" -- the safety layer catches it.
- **No simulation in CI**: comma.ai validates through fleet-scale shadow testing. Every openpilot device runs shadow mode and uploads disagreements.
- **Release process**: PR → CI → merge → nightly fleet rollout → automated monitoring → hotfix if needed
- **Key insight**: Decouple safety from performance. The CI/CD for the performance stack can be fast and permissive because the safety layer is independently certified.

**Applicability to reference airside AV stack**: The Simplex architecture (see `60-safety-validation/runtime-assurance/simplex-safety-architecture.md`) mirrors this pattern. The safety controller (BC) has a stringent CI pipeline with MISRA, MC/DC, and formal verification. The performance stack (AC) has a faster CI pipeline focused on ML regression and simulation. The two pipelines are independent.

### 14.2 Waymo: Rigor at Scale

Waymo operates the most rigorous release process in the industry for a fully driverless service:

- **Bazel-based monorepo**: Hermetic builds with remote caching. Every binary is bit-for-bit reproducible.
- **Simulation at massive scale**: SimulationCity synthesizes entire journeys from 20M+ autonomous miles. Millions of simulation scenarios run per release candidate.
- **Multi-stage validation**: Simulation → closed-course testing → structured on-road testing → limited public deployment → expansion
- **Change review board**: Every release candidate is reviewed by a safety review board before deployment
- **Continuous simulation**: Every commit triggers simulation. Results are visible to the entire team.
- **Foundation model evaluation**: Waymo evaluates its Foundation Model on hundreds of driving scenarios before any deployment
- **Key insight**: At Waymo's scale, simulation IS the CI. Code CI is table stakes. The differentiator is the quality and coverage of simulation evaluation.

**Applicability to reference airside AV stack**: reference airside AV stack cannot match Waymo's simulation scale, but the principle applies -- simulation regression testing on every PR to main is the highest-value CI investment after basic code CI.

### 14.3 Aurora: The Safety Case Approach

Aurora builds its CI/CD around producing evidence for a safety case (based on UL 4600):

- **Safety Case as CI artifact**: Each release produces an updated safety case document, auto-generated from CI evidence
- **Hazard-traced testing**: Every test maps to a specific hazard in the STPA hazard analysis
- **Quantitative safety metrics**: Track Safety Case confidence levels over releases
- **Virtual Testing Platform**: Aurora's simulation platform tests billions of miles of scenarios per release
- **CommonRoad integration**: Uses CommonRoad scenario format for planning validation
- **Key insight**: The CI/CD pipeline IS the safety case production system. Certification evidence is not bolted on after the fact but is a first-class output of the pipeline.

**Applicability to reference airside AV stack**: For ISO 3691-4 certification, adopting this approach -- where every CI run produces certification evidence artifacts -- saves months of post-hoc documentation effort.

### 14.4 Tesla: Data-Driven Velocity

Tesla's approach prioritizes iteration speed powered by data:

- **Shadow mode is the test**: Rather than extensive pre-deployment simulation, Tesla deploys to shadow mode on millions of vehicles and evaluates disagreements.
- **Data engine as CI**: The data flywheel continuously generates training data, evaluates models, and promotes to production. CI is embedded in the data engine, not separate.
- **Hardware-aware deployment**: Different model variants for HW3 vs HW4 vs HW4.5. CI builds and evaluates multiple hardware targets.
- **Aggressive rollout**: Tesla deploys to a percentage of the fleet and monitors in production rather than running exhaustive pre-deployment testing.
- **Key insight**: With enough fleet scale, production monitoring replaces pre-deployment testing for many scenarios. This does NOT apply to safety-critical functions.

**Applicability to reference airside AV stack**: Limited. Tesla's approach requires millions of vehicles for statistical safety arguments. With a fleet of 5-100 vehicles, reference airside AV stack must rely on simulation and structured testing rather than fleet-scale statistical validation. However, the data engine integration with CI/CD is directly applicable (see `data-flywheel-airside.md`).

### 14.5 Comparison Summary

| Dimension | comma.ai | Waymo | Aurora | Tesla | reference airside AV stack (target) |
|---|---|---|---|---|---|
| Release cadence | Bi-weekly | Monthly | Monthly | Bi-weekly | Monthly |
| Primary validation | Fleet shadow | Simulation | Safety case | Fleet shadow | Sim + shadow |
| Safety decoupling | Separate MCU | Redundant compute | Safety case layers | Redundant HW | Simplex (AC/BC) |
| Simulation in CI | No | Yes (massive) | Yes (massive) | Limited | Yes (moderate) |
| Regulatory | None (ADAS, not AV) | FMVSS exemption | UL 4600 | None (ADAS assist) | ISO 3691-4 |
| Team size | ~50 | ~2000 | ~1600 | ~5000 (Autopilot) | ~10-20 |
| CI/CD platform | GitHub Actions | Custom (Bazel) | Custom | Custom (Bazel) | GitLab CI |

---

## 15. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-6) -- $15-25K

| Task | Duration | Deliverable | Cost |
|---|---|---|---|
| GitLab CI/CD setup (self-hosted) | 1 week | Running CI instance | $2K (hardware) |
| Code CI pipeline (build + lint + unit test) | 2 weeks | Automated build/test on every push | $5K (engineer time) |
| Pre-commit hooks (clang-format, yamllint) | 2 days | Developer-local quality checks | Included |
| aarch64 cross-compilation in CI | 1 week | ARM64 builds on x86 runners | $2K |
| Orin CI runner setup (2 devices) | 1 week | On-target build and benchmark | $4K (hardware) |
| Docker-based build environment | 1 week | Reproducible build containers | $2K |
| DVC setup for rosbags and models | 3 days | Version-tracked large files on MinIO | $3K (storage) |
| Basic coverage reporting | 2 days | lcov reports in CI | Included |

**Outcome**: Every code push triggers automated build, lint, and unit tests. Developers get fast feedback. aarch64 builds validated on Orin hardware for PRs to main.

### Phase 2: ML Pipeline (Weeks 7-12) -- $20-35K

| Task | Duration | Deliverable | Cost |
|---|---|---|---|
| ML evaluation pipeline in CI | 2 weeks | Automated model evaluation on commit | $5K |
| TensorRT build pipeline on Orin runners | 1 week | Automated engine build + benchmark | $3K |
| MLflow setup (self-hosted) | 1 week | Experiment tracking + model registry | $2K |
| Per-airport benchmark suite (Airport A) | 2 weeks | Comprehensive evaluation dataset | $8K (annotation) |
| Safety-class regression detection | 1 week | Zero-tolerance gate for safety classes | $3K |
| DVC pipeline for training data | 1 week | Reproducible training pipeline | $2K |
| INT8 calibration pipeline | 3 days | Airport-specific calibration in CI | $2K |

**Outcome**: Model updates go through automated evaluation with per-class safety gates. TensorRT engines built and benchmarked on Orin automatically. No model reaches production without passing regression checks.

### Phase 3: Simulation Integration (Weeks 13-20) -- $25-40K

| Task | Duration | Deliverable | Cost |
|---|---|---|---|
| Simulation smoke suite (Tier 1, 20 scenarios) | 3 weeks | Sim tests on every PR | $10K |
| Log replay regression tests | 2 weeks | Rosbag replay in CI | $5K |
| GPU CI runners (2x RTX 4090) | 1 week | Sim-capable CI infrastructure | $8K (hardware) |
| Simulation regression suite (Tier 2, 100+ scenarios) | 3 weeks | Full regression on PR to main | $10K |
| Non-determinism handling (statistical pass/fail) | 1 week | Robust sim test evaluation | $3K |
| Nightly stress testing (Tier 4) | 1 week | Continuous fuzzing pipeline | $2K |

**Outcome**: Every PR to main runs through simulation smoke tests. Release candidates run through the full regression suite. Nightly fuzzing discovers edge cases continuously.

### Phase 4: Safety and Deployment (Weeks 21-28) -- $20-35K

| Task | Duration | Deliverable | Cost |
|---|---|---|---|
| Safety evidence generation pipeline | 2 weeks | Auto-generated certification artifacts | $8K |
| Traceability matrix automation | 1 week | Requirement → code → test links | $3K |
| Regulatory deployment gate | 1 week | Manual approval workflow | $2K |
| Fleet deployment pipeline (shadow → canary → full) | 2 weeks | Staged rollout with auto-rollback | $8K |
| Monitoring + alerting (Grafana + Prometheus) | 2 weeks | Fleet-wide observability | $5K |
| Incident → regression test automation | 1 week | Closed-loop from production to CI | $3K |

**Outcome**: Complete pipeline from code commit to fleet deployment with safety evidence, staged rollout, automated rollback, and production monitoring.

### Phase 5: Multi-Airport and Scale (Weeks 29-36) -- $15-25K

| Task | Duration | Deliverable | Cost |
|---|---|---|---|
| Multi-airport configuration management | 2 weeks | Per-airport config + test suites | $5K |
| Airport B benchmark suite | 2 weeks | Second airport evaluation | $8K (annotation) |
| Map CI pipeline (Lanelet2 validation) | 1 week | Automated map validation | $3K |
| Certification suite (Tier 3, 500+ scenarios) | 3 weeks | ISO 3691-4 evidence package | $8K |
| AMDB update integration | 3 days | AIRAC cycle automation | $2K |

**Outcome**: Pipeline supports multiple airports with independent models, maps, and regression suites. Certification evidence generated automatically.

### Total Cost Summary

| Phase | Duration | Cost Range | Cumulative |
|---|---|---|---|
| Phase 1: Foundation | 6 weeks | $15-25K | $15-25K |
| Phase 2: ML Pipeline | 6 weeks | $20-35K | $35-60K |
| Phase 3: Simulation | 8 weeks | $25-40K | $60-100K |
| Phase 4: Safety + Deploy | 8 weeks | $20-35K | $80-135K |
| Phase 5: Multi-Airport | 8 weeks | $15-25K | $95-160K |
| **Total** | **36 weeks** | **$95-160K** | |

**Ongoing costs**: $2-5K/month for CI infrastructure (runners, storage, cloud compute for simulation).

### Timeline Visualization

```
Month:  1    2    3    4    5    6    7    8    9
        ├────┼────┼────┼────┼────┼────┼────┼────┤
Phase 1 ████████████                              Foundation
Phase 2            ████████████                   ML Pipeline
Phase 3                       ████████████████    Simulation
Phase 4                                  ████████████████  Safety/Deploy
Phase 5                                           ████████████████  Multi-Airport
                                                  
Key:    ██ = Active development
        At end of Phase 2: Code + ML CI operational
        At end of Phase 4: Full pipeline, single airport
        At end of Phase 5: Multi-airport, certification-ready
```

---

## 16. Key Takeaways

1. **AV CI/CD manages six artifact types, not one** -- code binaries, ML model weights, TensorRT engines, HD maps, configuration, and calibration data each have distinct lifecycles, validation requirements, and deployment mechanisms. A pipeline that only handles code covers ~30% of what can break in production.

2. **The zero-regression rule for safety classes is non-negotiable** -- a model update that improves overall mAP by 5% but drops personnel recall by 0.1% must be rejected. CI gates must evaluate per-class metrics for safety-critical classes (aircraft, personnel, FOD, emergency vehicles) with zero tolerance for regression.

3. **Simulation-in-the-loop CI is the highest-value investment after basic code CI** -- unit tests verify code correctness but cannot verify system behavior. A change to the Frenet planner that passes all unit tests can still cause a wing clearance violation. Tier 1 simulation (20 smoke scenarios, 15-30 minutes) on every PR catches integration failures that no amount of unit testing finds.

4. **Log replay provides 80% of simulation value at 1% of the cost** -- replaying recorded rosbag data through the perception + planning pipeline catches most regressions without the compute expense of full physics simulation. Reserve full CARLA/Isaac Sim for scenarios requiring traffic agent interaction.

5. **TensorRT engines must be built on target hardware** -- an engine built on an A100 will not run on an Orin. CI requires dedicated Orin devices (~$2K each) as self-hosted runners. At minimum 2 devices for redundancy and parallel builds.

6. **The Simplex architecture enables separate CI pipelines for safety and performance** -- comma.ai's insight: decouple safety from performance. The safety controller (BC, Frenet + e-stop) gets a slow, rigorous CI pipeline (MISRA, MC/DC, formal verification). The ML performance stack (AC) gets a faster pipeline focused on regression testing. This mirrors the reference airside AV stack's Simplex architecture.

7. **Hybrid repo is optimal for AV teams under 50 engineers** -- monorepo for the ROS workspace (atomic cross-package changes), separate repos for ML models (GB-scale weights, different cadence) and maps (per-airport, safety-critical changes). DVC connects them.

8. **Every CI run must produce certification evidence** -- for ISO 3691-4 and EU Machinery Regulation conformity assessment, CI artifacts (coverage reports, MISRA compliance, test results, traceability) ARE the certification evidence. Building the pipeline to generate these from day one saves months of post-hoc documentation.

9. **Fleet deployment takes 2-4 weeks from code commit, not hours** -- shadow mode (48-168 hours) + canary (24-72 hours) + gradual rollout (3-7 days) + regulatory sign-off. The hotfix path (safety-only CI, abbreviated shadow) takes 24-72 hours. This is fundamentally slower than web deployment and this is correct for safety-critical systems.

10. **Automated rollback is non-optional for fleet deployment** -- monitoring must automatically trigger rollback on collision, near-miss, e-stop rate spike, or latency budget violation. No human should need to decide whether to roll back a canary that caused a collision.

11. **Map changes are safety-critical and need their own CI pipeline** -- a misplaced lane boundary can route a vehicle into an aircraft. Map changes require schema validation, topology checks, simulation verification, human safety review, and shadow mode testing before fleet deployment.

12. **Non-determinism is inherent in ML CI and must be managed, not eliminated** -- require statistical reproducibility (metrics within confidence intervals across N runs) rather than exact reproducibility. 3 evaluation runs with 0.5% mAP agreement is a practical threshold.

13. **Per-airport regression suites grow monotonically** -- every operator-flagged incident, shadow mode disagreement, and near-miss becomes a permanent regression test case. The suite never shrinks. At 12 months of operation, Airport A's suite will contain 200-500 edge cases that no generic test set covers.

14. **Airport-specific INT8 calibration is required** -- quantization calibration data from Airport A may not represent Airport B's distribution (different pavement, aircraft types, lighting). Each airport needs its own calibration set of 500-1000 frames. Using the wrong calibration set can degrade perception by 3-8% mAP.

15. **Configuration changes are as dangerous as code changes** -- changing `max_speed: 8.0` to `max_speed: 80.0` is a single-character typo that drives a vehicle at highway speed on an apron. Schema validation with enforced range bounds catches these in CI before they reach a vehicle.

16. **The regulatory deployment gate cannot be automated away** -- ISO 3691-4 and the EU Machinery Regulation require documented human review and approval for safety-critical deployments. This is a feature, not a limitation. A 30-60 minute human review per release is negligible compared to the cost of deploying a faulty update to a fleet operating near $100M+ aircraft.

17. **CI infrastructure for a 20-vehicle fleet costs $95-160K to build and $2-5K/month to operate** -- the majority of cost is engineering time, not hardware. 2-3 Orin devices ($6K), 2-4 GPU machines ($30-60K), and storage ($500/month) are the hardware components. The ROI comes from catching regressions before they reach production -- a single prevented aircraft incident ($250K+) pays for years of CI infrastructure.

18. **Stagger multi-airport deployments by at least one week** -- never deploy to multiple airports simultaneously. Deploy to the airport with the most operational data first (better anomaly detection baseline), observe for one week, then proceed to the next airport. This limits blast radius if a regression slips through all CI gates.

---

## 17. References

1. GitLab CI/CD Documentation, "CI/CD pipelines," 2026. https://docs.gitlab.com/ee/ci/pipelines/
2. DVC (Data Version Control) Documentation, "Versioning Data and Models," 2026. https://dvc.org/doc
3. MLflow Documentation, "Model Registry," 2026. https://mlflow.org/docs/latest/model-registry.html
4. NVIDIA, "TensorRT Developer Guide," Version 10.x, 2025.
5. NVIDIA, "Isaac Sim for CI/CD Testing," 2025.
6. comma.ai, "openpilot CI/CD infrastructure," GitHub, 2025.
7. Waymo, "Scaling Safety: Building a Robust AV Software Release Process," 2024.
8. Aurora, "Safety Case Approach to Autonomous Vehicle Development," 2024.
9. ISO 26262-6:2018, "Road vehicles — Functional safety — Part 6: Product development at the software level"
10. ISO 3691-4:2023, "Industrial trucks — Safety requirements and verification — Part 4: Driverless industrial trucks"
11. UL 4600:2022, "Standard for Safety for the Evaluation of Autonomous Products"
12. EU Regulation 2023/1230 (Machinery Regulation), Official Journal of the European Union, 2023.
13. Bazel Build System, "Remote Execution and Caching," 2025. https://bazel.build/remote/rbe
14. Koopman, P., "How Safe Is Safe Enough? Measuring and Predicting Autonomous Vehicle Safety," 2022.
15. Kang et al., "Testing and Validation of Autonomous Vehicles — A Systematic Review," IEEE Access, 2023.
16. Weights & Biases, "ML Experiment Tracking for Autonomous Vehicles," 2025.
17. Tesla AI Day 2024, "FSD v14 Architecture and Deployment Pipeline."
18. EU AI Act (Regulation 2024/1689), Official Journal of the European Union, 2024.

---

*Document generated for reference airside AV stack industry research, April 2026. This covers the end-to-end CI/CD pipeline orchestrating code, ML models, simulation, maps, and fleet deployment. For individual topics in depth: OTA delivery (`../../50-cloud-fleet/ota/ota-fleet-management.md`), TensorRT optimization (`production-ml-deployment.md`), MISRA/static analysis (`functional-safety-software.md`), V-model testing (`testing-validation-methodology.md`), shadow mode (`../../60-safety-validation/verification-validation/shadow-mode.md`), data flywheel (`50-cloud-fleet/mlops/data-flywheel-airside.md`).*
