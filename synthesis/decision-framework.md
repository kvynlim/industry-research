# Key Decision Framework

## Technology Choices and Their Rationale — Derived from 167 Research Documents

---

## How to Use This Document

For each major architectural decision, this document provides:
- **The question** being decided
- **Options** considered (with evidence from the corpus)
- **Recommendation** with rationale
- **Where to read more** (corpus cross-references)

---

## Decision 1: World Model Architecture

**Question:** Which world model approach to use for predicting future airside scenes?

| Option | Evidence | Verdict |
|--------|----------|---------|
| **OccWorld (VQ-VAE + GPT transformer)** | Open-source, ECCV 2024, proven on nuScenes. mmdet3d dependency is painful but workable. | **Phase 1** |
| **Drive-OccWorld (action-conditioned)** | +33% over UniAD, action conditioning enables planning. AAAI 2025. | **Phase 2 upgrade** |
| **FlashOcc + custom forecasting** | 197.6 FPS — only method viable on Orin real-time without optimization. But no forecasting built-in. | **Alternative Phase 1** |
| **Cosmos (latent diffusion)** | Commercially licensed, FSQ tokenizer, 14B params. Too large for on-vehicle. | **For simulation/data gen** |
| **Alpamayo VLA** | 10B, camera-only, non-commercial license. Teacher model only. | **Phase 3 (distill)** |

**Decision:** Start with **OccWorld for self-supervised LiDAR prediction** (Phase 1). Upgrade to **Drive-OccWorld when action-conditioned prediction is needed** for planning (Phase 2). Use **Cosmos for synthetic data generation** (not on-vehicle). **Skip VLA until Phase 3** when cameras + Thor hardware are available.

**Read more:** `technology/world-models/occupancy-networks-comparison.md`, `technology/world-models/occworld-implementation.md`, `technology/vla/vla-distillation-scaling.md`

---

## Decision 2: Primary Perception Backbone

**Question:** What LiDAR 3D detection model to use?

| Option | Latency (Orin) | mAP | LiDAR-only? | Code |
|--------|---------------|-----|-------------|------|
| **PointPillars** | 6.84ms | 48% | Yes | OpenPCDet |
| **CenterPoint-Pillar** | ~20ms | 50% | Yes | OpenPCDet |
| **CenterPoint-Voxel** | ~40ms | 56% | Yes | OpenPCDet |
| **BEVFusion** | ~40ms (25 FPS) | 68.5% | No (camera+LiDAR) | MIT BEVFusion |

**Decision:** **PointPillars for BEV feature extraction** (6.84ms, well within budget). CenterPoint-Pillar for **detection when object types matter** (20ms). BEVFusion when **cameras are added** (Phase 2).

**Key finding:** PointPillars INT8 PTQ loses only **0.80% mAP for 2.2x speedup**. QAT recovers to 0.17% loss.

**Read more:** `10-knowledge-base/geometry-3d/pointpillars.md`, `technology/perception/openpcdet-centerpoint.md`, `20-av-platform/compute/tensorrt-deployment-guide.md`

---

## Decision 3: Sensor Strategy

**Question:** Which sensors and in what order?

| Phase | Sensors | Rationale |
|-------|---------|-----------|
| **Phase 1** | Existing LiDAR (4-8 RoboSense) | Already installed, proven, no hardware changes |
| **Phase 1+** | + ADS-B receiver ($30) | Jet blast hazard mapping, aircraft awareness |
| **Phase 2** | + Cameras (6-8 surround) | Open-vocab detection, semantic understanding, VLA path |
| **Phase 2** | + 4D radar (2-4 Continental ARS548) | **PRIMARY adverse weather sensor**, Doppler velocity |
| **Phase 2+** | + Thermal/LWIR camera (FLIR Tura) | Ground crew detection at night (hi-vis paradox mitigation) |
| **Phase 3** | + UWB beacons (near terminals) | GPS-degraded area localization |

**Key finding:** 4D radar should be **PRIMARY, not backup** — it's the only sensor immune to all airside adverse conditions (rain, fog, de-icing, jet exhaust). Cost: $50-200 per unit.

**Read more:** `20-av-platform/sensors/4d-radar.md`, `technology/robustness/airside-adverse-conditions.md`, `20-av-platform/sensors/robosense-lidar.md`

---

## Decision 4: Compute Platform

**Question:** What hardware to run the new stack on?

| Platform | TOPS | Cost | Availability | Can Run |
|----------|------|------|-------------|---------|
| **Jetson AGX Orin 64GB** | 275 (sparse) | $1,999 | Now | PointPillars + OccWorld Lite + safety monitor |
| **Jetson AGX Orin Industrial** | 248 | Higher | Now | Same, -40C to +85C, 10yr lifecycle |
| **DRIVE AGX Thor** | ~1,000 (dense) | TBD | 2025+ | Full world model + distilled VLA |
| **Dual Orin** | 550 | $4,000 | Now | One per stack (Simplex) |

**Decision:** **Orin 64GB for Phase 1-2** (sufficient for PointPillars + 50-200M world model + safety monitor). **Thor for Phase 3** when VLA distillation is needed. Consider **dual Orin** if running both stacks requires GPU isolation.

**Key finding:** DLA contributes **74% of Orin compute at 15W**, 3-5x more power-efficient than GPU. Use DLA for PointPillars, GPU for world model.

**Read more:** `20-av-platform/compute/nvidia-orin-technical.md`, `20-av-platform/compute/nvidia-drive-thor.md`, `20-av-platform/compute/tensorrt-deployment-guide.md`

---

## Decision 5: Map Strategy

**Question:** HD maps (current approach) or map-free (world model approach)?

| Approach | Deploy Time | Cost/Airport | Accuracy | Maintenance |
|----------|-----------|-------------|----------|-------------|
| **HD map (current)** | 3-6 months | $50-200K survey | cm-level | Manual updates |
| **AIXM + online perception** | 1-2 weeks | ~$0 (AIXM free) | m-level global, cm local | Self-updating |
| **Pure map-free** | Days | $0 | Perception-limited | N/A |

**Decision:** **Keep HD maps for Phase 1** (proven, what Aurrigo does). Develop **AIXM + online perception in parallel** (Phase 2). Transition when **world model accuracy validated**. Keep HD map as fallback.

**Read more:** `technology/localization/map-free-driving.md`, `10-knowledge-base/robotics/lanelet2-maps.md`, `technology/localization/mapping-and-localization.md`

---

## Decision 6: Safety Architecture

**Question:** How to ensure the new stack doesn't compromise safety?

**Decision:** **Simplex architecture** — no question. Current stack becomes verified fallback. New stack is high-performance controller. Safety monitor arbitrates.

| Component | Approach | Rationale |
|-----------|----------|-----------|
| **Fallback controller** | Existing Aurrigo stack (unchanged) | Already production-tested |
| **Safety monitor** | Ensemble OOD + RSS envelope + occupancy collision | Multi-layer, any failure → fallback |
| **RSS parameters** | Airside-specific (2m aircraft, 3m personnel, 1s response) | Conservative for airport |
| **Arbitration** | State machine with 2s hysteresis | Prevents rapid switching |
| **Hardware safety** | Independent safety PLC/MCU (comma.ai panda pattern) | ML cannot override hardware safety |

**Key finding:** comma.ai's panda safety layer (STM32H725, MISRA C, 100% line coverage + mutation testing) is the gold standard for hardware-independent safety. **Safety must NEVER depend on neural networks.**

**Read more:** `operations/safety/simplex-safety-architecture.md`, `operations/safety/iso-3691-4-deep-dive.md`, `companies/comma-ai/openpilot-codebase-analysis.md`

---

## Decision 7: Deployment Strategy

**Question:** Teleoperation-first (Fernride) or autonomy-first (TractEasy)?

| Approach | Risk | Speed to Revenue | Technology Required |
|----------|------|------------------|-------------------|
| **Autonomy-first** | High (certification 12-24 months) | Slow | Full perception + planning + safety case |
| **Teleoperation-first** | Low (operator always in loop) | Fast | Connectivity + remote UI + basic autonomy |
| **Shadow mode first** | None (existing stack drives) | No revenue | Sensors + compute + data pipeline |

**Decision:** **Shadow mode first** (zero regulatory risk, builds data). Then **teleoperation for revenue** (Fernride model, operator ratio 1:4→1:10). Then **graduated autonomy** as world model matures.

**Read more:** `operations/deployment/shadow-mode.md`, `companies/fernride/tech-stack.md`, `operations/safety/regulatory-trajectory-deep-dive.md`

---

## Decision 8: Certification Path

**Question:** What standard to certify against?

**Decision:** **ISO 3691-4:2020** (what TractEasy and Aurrigo already use). Supplement with **ISO/PAS 8800** (new AI safety lifecycle) and **SOTIF (ISO 21448)** for world model components.

| Standard | What It Covers | Cost | Timeline |
|----------|---------------|------|----------|
| **ISO 3691-4** | Driverless industrial trucks (primary) | $130-380K | 12-24 months |
| **ISO/PAS 8800** | AI safety lifecycle (supplement) | Included above | Same |
| **ISO 21448 (SOTIF)** | Safety of intended functionality | Included | Same |
| **UL 4600** | Safety case framework | $50-100K | 6-12 months |

**Key finding:** ISO 3691-4 was **harmonized with EU Machinery Directive in May 2024**. New EU Machinery Regulation 2023/1230 (effective **January 2027**) mandates third-party assessment for AI autonomous vehicles.

**Read more:** `operations/safety/iso-3691-4-deep-dive.md`, `operations/safety/certification-guide.md`, `operations/safety/regulatory-trajectory-deep-dive.md`

---

## Decision Summary

| # | Decision | Choice | Phase |
|---|----------|--------|-------|
| 1 | World model | OccWorld → Drive-OccWorld → VLA distill | 1 → 2 → 3 |
| 2 | Perception | PointPillars (6.84ms) → BEVFusion | 1 → 2 |
| 3 | Sensors | LiDAR → + 4D radar + cameras → + thermal + UWB | 1 → 2 → 3 |
| 4 | Compute | Orin 64GB → Thor | 1-2 → 3 |
| 5 | Maps | HD map → AIXM + online perception | 1 → 2+ |
| 6 | Safety | Simplex + hardware safety PLC | All phases |
| 7 | Deployment | Shadow → teleop → graduated autonomy | Sequential |
| 8 | Certification | ISO 3691-4 + ISO/PAS 8800 + SOTIF | Start now |

---

*Each decision is backed by evidence from the research corpus. See cross-references for full analysis.*
