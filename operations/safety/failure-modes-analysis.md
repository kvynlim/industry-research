# Failure Modes and Safety Analysis for World-Model-Based AV

## Taxonomy of Failures, Edge Cases, and Mitigation Strategies

---

## 1. World Model Failure Taxonomy

### 1.1 Hallucination

The world model predicts objects or events that don't exist in reality.

| Type | Description | Example | Severity | Detection |
|------|-------------|---------|----------|-----------|
| **Phantom objects** | Predicts occupied space that is actually free | "Ghost vehicle" appears in prediction | Medium — causes unnecessary braking | Compare prediction vs next observation |
| **Object duplication** | Same object appears multiple times | Aircraft predicted in two positions | Medium | Consistency check across frames |
| **Temporal hallucination** | Frame ordering errors, events appear out of sequence | Pushback predicted before doors close | Low-Medium | Check physical plausibility |
| **Causal hallucination** | Incorrect cause-effect chain | "Vehicle braked because traffic light" (no traffic lights on apron) | Low | Domain-specific plausibility check |

**Mitigation:**
- Ensemble disagreement: if 3 model copies disagree on an object's existence, flag as hallucination
- Persistence filter: require predicted objects to appear in 3+ consecutive frames
- VQ-VAE reconstruction quality: high reconstruction error → model is uncertain → flag

### 1.2 Mode Collapse

The world model predicts only the average future, missing multi-modal possibilities.

| Manifestation | Description | Impact |
|---------------|-------------|--------|
| **Mean trajectory** | Predicts average of possible futures | Vehicle predicted to stop halfway instead of "go left" OR "go right" |
| **Missing rare modes** | Doesn't predict low-probability events | Emergency vehicle not predicted |
| **Overconfident** | Assigns high probability to single future | Doesn't plan for alternative outcomes |

**Mitigation:**
- Use diffusion or flow matching (inherently multi-modal) instead of regression
- Sample multiple futures and evaluate each
- Train on balanced datasets (oversample rare scenarios)

### 1.3 Temporal Drift

Predictions diverge from reality over longer horizons due to compounding errors.

```
Prediction error at time step k:
  ε_k ≈ ε_1 × γ^k    (exponential growth, γ > 1)

For autoregressive models (OccWorld, DrivingGPT):
  Error compounds because each prediction feeds into the next

For diffusion models (GAIA-2, DriveDreamer):
  Less drift because entire sequence is generated at once
```

**Mitigation:**
- Limit prediction horizon (2-4s is practical, beyond 4s reliability drops)
- Confidence decay: weight predictions by 1/k for planning cost
- Re-predict every cycle (don't rely on old predictions)
- Shortcut forcing (DreamerV4): predict directly to future, skip intermediate steps

### 1.4 Action Infidelity

The world model prediction doesn't correctly reflect the ego action.

```
Problem: You feed trajectory τ_A, but the prediction looks the same as for τ_B
→ The world model learned to ignore the action input

ACT-Bench finding: Vista achieves only 30.72% action fidelity
→ Most driving world models have this problem
```

**Mitigation:**
- Action-conditioned training (Drive-OccWorld explicitly conditions on action)
- Action dropout during training (force model to use action when available)
- Evaluate action fidelity separately from visual quality

---

## 2. Sensor Failure Modes

### 2.1 LiDAR Degradation

| Condition | Effect on LiDAR | Detection | Response |
|-----------|-----------------|-----------|----------|
| **Heavy rain** | Point density drops 30-50%, spurious returns | Point count monitoring | Switch to radar-primary |
| **Fog** | Range reduced, backscatter noise | Intensity pattern analysis | Reduce ODD, slow down |
| **De-icing spray** | Lens contamination, complete blockage | Sudden point count drop to near-zero | Emergency stop, wait for clearing |
| **Snow on sensor** | Partial/full blockage | Asymmetric point density | Activate heater, alert |
| **Jet blast vibration** | Misalignment, noisy returns | IMU vibration detection | Stop, recalibrate |
| **Sun glare on tarmac** | Spurious high-intensity returns | Intensity outlier detection | Filter, use geometric features only |
| **Standing water** | Mirror reflections, phantom ground plane | Multi-return detection | Raise ground filter threshold |

### 2.2 GPS/GNSS Degradation

| Condition | Effect | Detection | Response |
|-----------|--------|-----------|----------|
| **Multipath near terminals** | Position error 2-10m | HDOP monitoring, position jumping | Switch to LiDAR SLAM localization |
| **Near large aircraft** | Signal shadowing | Satellite count drop | Use UWB beacons as backup |
| **RF interference** | Complete GPS loss | PVT status monitoring | Dead reckoning (IMU + wheel odometry) |

### 2.3 Camera Degradation (When Added)

| Condition | Effect | Detection | Response |
|-----------|--------|-----------|----------|
| **Night + poor apron lighting** | Low SNR, missed detections | Brightness histogram | HDR mode, rely on LiDAR |
| **De-icing glycol on lens** | Blurred/obscured image | Sharpness metric drop | LiDAR-only mode |
| **Sun in frame** | Bloom, saturation | Exposure analysis | Mask affected regions |
| **Vibration blur** | Motion blur at low shutter | IMU correlation | Increase shutter speed |

---

## 3. Software and System Failures

### 3.1 GPU/Inference Failures

| Failure | Impact | Detection | Response |
|---------|--------|-----------|----------|
| **CUDA OOM** | Model inference crashes | Try/catch CUDA errors | Fallback to current stack |
| **TensorRT engine corruption** | Wrong outputs | Output range validation | Reload engine, restart node |
| **GPU thermal throttling** | Latency increases | Temperature monitoring | Reduce model complexity, use Lite tier |
| **Inference timeout** | Stale predictions | Watchdog timer | Use last-known prediction, alert |
| **NaN in outputs** | Unpredictable behavior | NaN check on every output | Discard, use fallback |

### 3.2 ROS Communication Failures

| Failure | Impact | Detection | Response |
|---------|--------|-----------|----------|
| **Topic dropout** | Missing sensor data | Heartbeat monitoring | Use last-known data, degrade gracefully |
| **Clock skew** | Misaligned sensor fusion | TF timestamp validation | Reject out-of-sync data |
| **Message queue overflow** | Stale data | Queue size monitoring | Drop old messages, process latest |
| **Node crash** | Component offline | Lifecycle management | Auto-restart, log incident |

---

## 4. Airside-Specific Failure Scenarios

### 4.1 Critical Scenarios

| Scenario | Why It's Hard | Current Stack Handles? | World Model Helps? |
|----------|--------------|----------------------|-------------------|
| **Ground crew walks behind aircraft nose** | Occluded by aircraft body | No — can't see them | Yes — predicts pedestrian emergence from occlusion |
| **Aircraft pushback starts unexpectedly** | Large object starts moving | No — reactive only | Yes — predicts pushback from turnaround phase |
| **FOD on taxiway** | Small object, high speed (taxi) | No — no FOD detection | Yes — anomaly in occupancy prediction |
| **Emergency vehicle approaching** | Must yield immediately | Partially — if detected | Yes — predicts emergency vehicle trajectory |
| **Jet blast from engine startup** | Invisible hazard | No — no jet blast awareness | Yes — ADS-B + aircraft type → hazard zone |
| **De-icing spray hits sensors** | Sudden sensor degradation | No — relies on all sensors | Yes — OOD detection, graceful degradation |
| **Two GSE approaching same stand** | Coordination required | No — no multi-agent reasoning | Yes — shared world model predicts conflict |
| **Construction zone not in map** | Map doesn't match reality | Partial — if obstacles detected | Yes — NOTAM integration + anomaly detection |

### 4.2 Long-Tail Distribution

The "long tail" of rare scenarios is particularly challenging for airside:

```
Frequency distribution of airside scenarios:
  90%: Normal operations (straight driving, parking, loading)
  9%:  Common variations (weather, night, busy apron)
  0.9%: Unusual (emergency vehicle, equipment failure, bird strike)
  0.1%: Rare (aircraft abort, tire blowout, fuel spill)
  0.01%: Extremely rare (runway incursion, security incident)

The world model must handle ALL of these safely.
Training data will cover the top 90% well, partially cover 9%,
and barely cover the rest.
```

**Strategy for the long tail:**
1. **Adversarial scenario generation:** Use world model to imagine worst cases (SafeDreamer)
2. **Foundation model generalization:** VLAs can reason about novel situations via language
3. **Conservative fallback:** When uncertain, stop and request teleoperation
4. **Scenario mining from fleet:** Automatically extract rare events from continuous operation

---

## 5. SOTIF Analysis for World Models

### 5.1 ISO 21448 SOTIF Framework

SOTIF (Safety of the Intended Functionality) addresses failures that arise from the intended behavior of the system, not from hardware/software faults.

**Four-quadrant model:**

```
                Known          Unknown
Safe          1: Known Safe    3: Unknown Safe
              (normal ops)     (untested but OK)

Unsafe        2: Known Unsafe  4: Unknown Unsafe
              (identified      (unidentified
               triggers)        triggers — THE DANGER)
```

**Goal:** Minimize areas 3 and 4 (move them to 1 and 2).

### 5.2 Triggering Conditions for World Models

| Triggering Condition | SOTIF Quadrant | Functional Insufficiency | Mitigation |
|---------------------|----------------|------------------------|------------|
| LiDAR in heavy rain | 2 (Known Unsafe) | Reduced point density → occupancy prediction fails | Radar fusion, weather-adaptive thresholds |
| Novel aircraft type not in training | 4 (Unknown Unsafe) | World model doesn't know how this aircraft behaves | Open-vocab detection, occupancy is class-agnostic |
| GPS multipath near terminal | 2 (Known Unsafe) | Localization error → wrong BEV alignment | LiDAR SLAM fallback |
| Simultaneous pushback of adjacent aircraft | 4 (Unknown Unsafe) | World model never trained on this scenario | Adversarial scenario generation, test in sim |
| World model predicts static but aircraft moves | 2 (Known Unsafe) | Model lag, insufficient turnaround context | A-CDM integration, shorter prediction horizon |
| Reflective wet tarmac at night | 4 (Unknown Unsafe) | LiDAR phantom returns → occupancy hallucination | Standing water detection, multi-frame consistency |

### 5.3 SOTIF Verification Strategy

```
1. Identify triggering conditions (above table)
2. For each: estimate probability × severity → risk level
3. High-risk items: test extensively in simulation
4. Build test scenarios covering each triggering condition
5. Monitor in shadow mode: does the trigger actually cause failure?
6. Iterate until residual risk is below threshold
```

---

## 6. Formal Verification Limits

### 6.1 What CAN Be Formally Verified

| Property | Method | Feasibility |
|----------|--------|-------------|
| RSS safety envelope | Mathematical proof (Mobileye) | High — rules are simple |
| Bounded output range | Neural network verification (alpha-beta-CROWN) | Medium — for small networks |
| Geofence compliance | Polygon containment check | High — geometric |
| Speed limit compliance | Simple threshold check | High — trivial |
| Watchdog timeout | Formal timing analysis | High — well-understood |

### 6.2 What CANNOT Be Formally Verified

| Property | Why Not | Alternative |
|----------|---------|-------------|
| World model prediction accuracy | Model is too large for verification tools | Statistical testing + conformal prediction |
| Correct behavior in all scenarios | Infinite scenario space | Risk-based testing + SOTIF analysis |
| No hallucination ever | Generative models can always hallucinate | Runtime detection + ensemble disagreement |
| OOD detection completeness | Unknown unknowns | Multi-layer detection + conservative fallback |

### 6.3 The Verification Gap

```
Formal verification can handle: ~10^6 parameters (small networks)
World models have: ~10^8 parameters (100M+)

Gap: 100x

Approaches to bridge:
1. Verify the safety monitor (small) not the world model (large)
2. Verify properties of the combined system (Simplex guarantees)
3. Statistical verification with conformal prediction bounds
4. Runtime monitoring as a "continuous verification" substitute
```

---

## 7. Defense-in-Depth Safety Architecture

```
Layer 0: DESIGN
├── World model trained with safety-aware objectives (SafeDreamer)
├── Occupancy prediction with calibrated uncertainty
└── RSS constraints built into planning cost function

Layer 1: RUNTIME MONITORING
├── OOD detection (ensemble disagreement + reconstruction error)
├── Prediction consistency check (temporal, spatial)
├── Sensor health monitoring (per-sensor diagnostics)
└── Confidence calibration (conformal prediction)

Layer 2: SAFETY CONTROLLER
├── RSS envelope check on every proposed trajectory
├── Occupancy collision check (predicted + current)
├── Geofence check (NOTAM zones, airport boundary)
└── Speed limit enforcement

Layer 3: SIMPLEX ARBITRATION
├── If Layer 1 or 2 fails → switch to fallback stack
├── Fallback stack: proven Frenet planner (current Aurrigo stack)
├── Hysteresis prevents rapid switching
└── All transitions logged

Layer 4: GRACEFUL DEGRADATION
├── Reduced capability mode (slow, wide margins)
├── Controlled stop (safe position, parking brake)
├── Teleoperation request (remote operator)
└── Hardware e-stop (physical button)

Layer 5: PHYSICAL SAFETY
├── Mechanical speed limiter
├── Hardware e-stop circuit (independent of software)
├── Bumper/contact sensors
└── Emergency lighting and horn
```

**Key principle:** No single layer failure leads to an unsafe outcome. An adversary (or bug) must defeat ALL layers simultaneously to cause harm.

---

## Sources

- ISO 21448:2022 "Road vehicles — Safety of the intended functionality"
- ISO/PAS 8800:2024 "Road vehicles — Safety and artificial intelligence"
- Shalev-Shwartz et al. "On a Formal Model of Safe and Scalable Self-driving Cars" (RSS)
- Katz et al. "Marabou: A Framework for Verification and Analysis of Deep Neural Networks"
- NTSB accident reports on AV incidents (Uber ATG, Cruise)
- Burton et al. "Mind the gaps: Assuring the safety of autonomous systems from an engineering perspective"
- AMLAS Methodology (University of York)
- UL 4600 Standard for Evaluation of Autonomous Products
