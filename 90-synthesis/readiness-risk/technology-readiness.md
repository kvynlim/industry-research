# Technology Readiness Assessment

## POC-by-POC Readiness, Dependencies, and Go/No-Go Criteria

---

## Technology Readiness Levels (TRL)

| TRL | Definition | For Airside AV |
|-----|-----------|----------------|
| 1 | Basic principles observed | Research paper published |
| 2 | Technology concept formulated | Architecture designed |
| 3 | Proof of concept | Works on recorded data (bags) |
| 4 | Lab validation | Works in simulation (CARLA/3DGS) |
| 5 | Relevant environment validation | Works on vehicle in shadow mode |
| 6 | Prototype demonstrated | Drives autonomously in controlled area |
| 7 | System prototype in operational environment | Shadow mode at real airport |
| 8 | System complete and qualified | Safety case approved, full operations |
| 9 | System proven in operations | Multi-airport, fleet-scale |

---

## POC Readiness Matrix

### POC 1: Self-Supervised Scene Prediction (Occupancy World Model)

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| PointPillars BEV encoder | **6** (nuScenes pretrained, TensorRT on Orin proven) | 7 | Airside fine-tuning data | Low |
| VQ-VAE/FSQ tokenizer | **4** (OccWorld proven on nuScenes) | 6 | Custom training on airside BEV | Low |
| Transformer world model | **4** (OccWorld, DrivingGPT proven) | 6 | Airside fine-tuning, compute | Medium |
| Self-supervised training pipeline | **3** (concept from comma.ai, Dreamer) | 5 | Data pipeline from bags | Medium |
| Occupancy prediction quality | **2** (untested on airside data) | 5 | Domain gap, novel objects | Medium |

**Overall TRL: 2-3 → Target: 5**
**Go/No-Go:** Achieve IoU > 0.3 at 1s on airside replay data within 4 weeks.

### POC 2: Learned 3D Detection (CenterPoint)

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| CenterPoint/PointPillars | **7** (production in Waymo, Autoware) | 7 | None — proven |  Low |
| nuScenes pretrained model | **6** (OpenPCDet, TensorRT proven) | 7 | None | Low |
| Auto-labeling pipeline | **4** (concept proven, tools exist) | 6 | Label quality on airside | Medium |
| Custom class training | **3** (airside classes undefined) | 6 | Class definition, annotation | Medium |
| TensorRT on Orin | **7** (6.84ms measured) | 8 | None | Low |

**Overall TRL: 4 → Target: 7**
**Go/No-Go:** Achieve mAP > 40% on 10+ airside classes with < 25ms on Orin.

### POC 3: Prediction-Aware Frenet Planner

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| Frenet planner (existing) | **8** (production in reference airside AV stack) | 8 | None — exists | Low |
| World model cost function | **2** (concept from Think2Drive, WorldRFT) | 5 | POC 1 must work first | High |
| Batched GPU trajectory eval | **4** (18.7ms benchmark exists) | 6 | C++/Python interop latency | Medium |
| Safety fallback to traditional | **3** (Simplex concept designed) | 6 | Arbitration logic | Medium |

**Overall TRL: 2 → Target: 5**
**Go/No-Go:** Shadow mode agreement > 80% with production planner. Latency < 200ms total.
**Dependency:** Requires POC 1 working.

### POC 4: Jet Blast Hazard Mapping

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| ADS-B receiver + decoding | **7** (dump1090/readsb mature) | 8 | $30 hardware purchase | Very Low |
| Aircraft type lookup table | **5** (CFD data published for major types) | 7 | Incomplete for all types | Low |
| Hazard zone computation | **4** (geometry straightforward) | 7 | Validation against real data | Low |
| ROS integration | **3** (not built yet) | 7 | Simple engineering | Very Low |
| Planner integration | **3** (zone → cost function mapping) | 6 | Zone manager compatibility | Low |

**Overall TRL: 3 → Target: 7**
**Go/No-Go:** Correct zone visualization for 5+ aircraft types in RViz. Zero false negatives.

### POC 5: LiDAR FOD Detection

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| PCD map (existing) | **8** (two maps in workspace) | 8 | None | Low |
| Map differencing algorithm | **5** (open3d KD-tree, well-understood) | 7 | Threshold tuning | Low |
| Clustering + filtering | **5** (DBSCAN standard) | 7 | False positive rate | Medium |
| Persistence filtering | **3** (multi-frame confirmation) | 6 | Tracking across frames | Low |
| ROS node | **3** (not built yet) | 7 | Simple engineering | Very Low |

**Overall TRL: 3 → Target: 7**
**Go/No-Go:** Detect 10cm object at 25m range with < 5 false alarms/hour.

### POC 6: 3DGS Digital Twin

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| 3DGS training from PCD | **5** (gsplat, GS-LiDAR proven) | 6 | Airport-scale (large scene) | Medium |
| Novel view rendering | **6** (3DGS mature, 135 FPS) | 7 | Ground plane quality | Medium |
| Dynamic object removal | **4** (DeSiRe-GS approach exists) | 5 | Aircraft/GSE removal | Medium |
| Synthetic LiDAR rendering | **3** (GS-LiDAR research stage) | 5 | Ray-casting through Gaussians | High |
| Airport-scale tiling | **3** (CityGaussian concept exists) | 5 | Engineering effort | Medium |

**Overall TRL: 3 → Target: 5**
**Go/No-Go:** Render novel views with PSNR > 25 dB. Ground plane smooth enough for planning.

### POC 7: Open-Vocab GSE Detection (Requires Cameras)

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| YOLO-World | **7** (production-ready, 52 FPS) | 8 | Camera hardware needed | Low |
| Airside prompt library | **2** (designed but untested) | 5 | Prompt tuning on real images | Medium |
| 2D-to-3D lifting | **4** (frustum projection well-understood) | 6 | LiDAR-camera calibration | Medium |
| TensorRT on Orin | **5** (YOLO TensorRT proven) | 7 | Re-parameterization export | Low |

**Overall TRL: 2 → Target: 6**
**Go/No-Go:** Detect 10+ GSE types at > 50% recall, zero-shot. < 50ms on Orin.
**Dependency:** Requires camera hardware.

### POC 8: Turnaround Phase Estimator

| Component | Current TRL | Target TRL | Blocker | Risk |
|-----------|------------|------------|---------|------|
| A-CDM data ingestion | **3** (API endpoints documented) | 5 | Airport data access agreement | High |
| GBRT/LSTM model | **5** (well-understood ML problem) | 6 | Training data availability | Medium |
| Flight schedule integration | **4** (AODB APIs documented) | 6 | Integration complexity | Medium |
| Phase prediction accuracy | **2** (untested) | 5 | Need labeled turnaround data | High |

**Overall TRL: 2 → Target: 5**
**Go/No-Go:** 80% phase accuracy, ±5 min pushback prediction.
**Dependency:** Requires airport operations data access.

---

## Critical Path Analysis

```
Week 1-2:  POC 4 (Jet Blast) ─── No dependencies, immediate start
           POC 5 (FOD) ───────── No dependencies, immediate start

Week 2-4:  POC 2 (Detection) ─── Needs: auto-labeling pipeline
           POC 1 (World Model) ── Needs: BEV encoder + bag processing
                    │
Week 4-6:  POC 3 (Planner) ───── Needs: POC 1 working
           POC 6 (Digital Twin) ─ Needs: compute (A100 cloud)
                    │
Week 6-8:  POC 7 (Open-Vocab) ── Needs: camera hardware
           POC 8 (Turnaround) ── Needs: airport data access
```

**Minimum viable demonstration (Week 4):**
POC 4 (jet blast zones on map) + POC 5 (FOD alerts) + POC 2 (10+ object detection)
= Tangible safety improvements with zero world model dependency.

**World model demonstration (Week 6):**
POC 1 (occupancy prediction visualization) + POC 3 (prediction-aware planner in shadow mode)
= First proof that world models add value for airside.

---

## Infrastructure Requirements

| Requirement | POCs That Need It | Cost | Lead Time |
|-------------|------------------|------|-----------|
| Cloud GPU (1x A100) | 1, 2, 6 | $200-500 | 1 day |
| ADS-B receiver (RTL-SDR) | 4 | $30 | 3 days shipping |
| Camera hardware (6-8 cameras) | 7 | $500-2,000 | 2-4 weeks |
| Airport operations data access | 8 | $0 (partnership) | 4-12 weeks |
| Bag file organization | 1, 2, 5 | $0 (engineering time) | 1-2 weeks |
| NVIDIA Orin (if not already available) | 2, 7 | $1,000-2,000 | 1-2 weeks |

---

*Assessment based on technology analysis across 153 research documents. TRL definitions adapted from NASA/ISO 16290 for airside AV context.*
