# Risk Register

## Risks to POC Execution and World Model Integration

---

## Risk Matrix

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|----|------|-----------|--------|-------|-----------|-------|
| **R1** | Insufficient airside training data | Medium | High | **High** | Self-supervised training (no labels needed), transfer from nuScenes, synthetic data generation | ML Lead |
| **R2** | World model doesn't generalize to airside | Medium | High | **High** | Pre-train on road data, progressive fine-tuning, extensive eval before deployment | ML Lead |
| **R3** | Orin compute insufficient for full pipeline | Low | High | **Medium** | Lite model tier (50M params), DLA offloading, cloud-edge hybrid for heavy models | Systems Lead |
| **R4** | FAA/airport authority blocks deployment | Medium | High | **High** | Start with shadow mode (no regulatory barrier), build safety case early, engage FAA proactively | Program Lead |
| **R5** | RoboSense LiDAR data incompatible with pretrained models | Low | Medium | **Low** | Point cloud normalization pipeline, intensity/density matching, documented in data-engine guide | ML Lead |
| **R6** | GPS multipath near terminals causes localization failure | Medium | Medium | **Medium** | LiDAR SLAM fallback already in GTSAM stack, UWB beacons as backup | Systems Lead |
| **R7** | Integration disrupts production reference airside AV stack | Low | Critical | **High** | Simplex architecture: new stack runs in parallel, never touches production until validated | Systems Lead |
| **R8** | Key ML dependencies become unmaintained | Medium | Medium | **Medium** | Use established frameworks (OpenPCDet, PyTorch), avoid single-source dependencies (OccWorld mmdet3d risk) | ML Lead |
| **R9** | Bag data is corrupted/incomplete | Low | Medium | **Low** | Index all bags first (Day 1), validate quality before training, keep originals | Data Lead |
| **R10** | Camera hardware delays | Medium | Low | **Low** | Phase 1-3 are LiDAR-only, cameras only needed for Phase 2+ (POC 7) | Hardware Lead |
| **R11** | Airport operations data (A-CDM) access denied | High | Medium | **High** | Start with ADS-B (freely available), build relationship with airport ops team | Program Lead |
| **R12** | World model hallucinations cause unsafe behavior | Low | Critical | **Medium** | Simplex fallback, OOD detection, RSS safety envelope, safety monitor ensemble | Safety Lead |
| **R13** | Competitor (UISEE/TractEasy) achieves world model first | Low | Medium | **Low** | No competitor currently uses world models; UISEE is classical perception | Strategy Lead |
| **R14** | EU Machinery Regulation 2023/1230 (Jan 2027) imposes new requirements | High | Medium | **High** | Track regulation, ensure AI components have explainability and logging built in | Compliance Lead |
| **R15** | De-icing fluid/jet blast damages sensors | Medium | Medium | **Medium** | 4D radar as primary (weather-immune), sensor cleaning systems, thermal cameras | Hardware Lead |
| **R16** | Insurance costs prohibitive for autonomous operations | Medium | Medium | **Medium** | Start with shadow mode (standard insurance), Swiss Re data shows 88% fewer claims for AV | Program Lead |
| **R17** | Team lacks ML engineering expertise | Medium | High | **High** | Start with proven pipelines (OpenPCDet, OccWorld), use cloud GPU (Lambda Labs), hire/train | Program Lead |
| **R18** | Hi-vis clothing causes AEB failure at night | Medium | Critical | **High** | Add thermal/LWIR camera (FLIR Tura ASIL-B), UWB personal transponders, multi-layer detection | Safety Lead |

---

## Top 5 Risks (Action Required)

### 1. R7: Integration disrupts production stack (Impact: Critical)
**Status:** Mitigated by design
**Action:** Simplex architecture ensures complete isolation. Shadow mode runs new stack without actuator access. Arbitrator node with hysteresis prevents rapid switching. Both stacks tested independently.

### 2. R12: World model hallucinations (Impact: Critical)
**Status:** Mitigated by design
**Action:** Four-layer safety monitor (OOD detection, RSS envelope, occupancy collision check, watchdog). If ANY layer fails → fallback to production stack. All decisions logged for analysis.

### 3. R18: Hi-vis AEB failure at night (Impact: Critical)
**Status:** Requires hardware action
**Action:** Add thermal/LWIR camera to sensor suite. FLIR Tura has ASIL-B rating. UWB personal transponders provide redundant crew detection. Seven-layer detection stack designed in ground-crew-pedestrian-safety.md.

### 4. R4: Regulatory blocking (Impact: High)
**Status:** Requires proactive engagement
**Action:** Shadow mode requires NO regulatory approval (vehicle drives with current stack). Build ISO 3691-4 safety case in parallel ($130K-380K, 12-24 months). Engage FAA via CertAlert 24-02 dialogue channel. Track EASA AI Roadmap 2.0.

### 5. R17: ML expertise gap (Impact: High)
**Status:** Requires investment
**Action:** POCs 4 and 5 (jet blast, FOD) need zero ML. POCs 1 and 2 use established frameworks with pretrained models. Getting-started guide provides Day 1 runnable code. Cloud GPU eliminates infrastructure barrier. Consider Aston University KTP extension to cover perception ML.

---

## Risk Appetite Statement

**Safety:** Zero tolerance for unmitigated safety risks. Any system that could harm personnel, damage aircraft, or cause regulatory violation must have independent safety layers.

**Technology:** Moderate appetite for technology risk. Use proven open-source frameworks where available. Accept that world models are research-stage but mitigate with Simplex fallback.

**Schedule:** High appetite for schedule risk. Better to ship a working POC late than a broken one on time. Quality gates at each phase transition.

**Cost:** Low appetite for cost overruns. POC budget $2-5K (cloud GPU + ADS-B hardware). Certification budget $130-380K is separate and well-estimated.

---

*Risk register should be reviewed monthly and updated as POCs progress. Risk scores recalculated after each phase gate.*
