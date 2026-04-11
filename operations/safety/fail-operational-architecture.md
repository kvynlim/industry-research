# Fail-Operational Architecture and Hardware Redundancy for Airside AVs

## System-Level Redundancy Patterns, ASIL Decomposition, Degradation Modes, and Compute/Sensor/Actuator/Power/Communication Redundancy

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Failure Mode Taxonomy](#2-failure-mode-taxonomy)
3. [Fail-Safe vs Fail-Operational vs Fail-Degraded](#3-fail-safe-vs-fail-operational-vs-fail-degraded)
4. [Architectural Patterns](#4-architectural-patterns)
5. [Compute Redundancy](#5-compute-redundancy)
6. [Sensor Redundancy](#6-sensor-redundancy)
7. [Actuator Redundancy](#7-actuator-redundancy)
8. [Power Supply Redundancy](#8-power-supply-redundancy)
9. [Communication Redundancy](#9-communication-redundancy)
10. [ASIL Decomposition for Redundancy](#10-asil-decomposition-for-redundancy)
11. [Degradation Modes and Graceful Degradation](#11-degradation-modes-and-graceful-degradation)
12. [Minimal Risk Condition (MRC)](#12-minimal-risk-condition-mrc)
13. [Runtime Safety Monitoring](#13-runtime-safety-monitoring)
14. [Airside-Specific Considerations](#14-airside-specific-considerations)
15. [Industry Implementations](#15-industry-implementations)
16. [Aurrigo Integration Recommendations](#16-aurrigo-integration-recommendations)
17. [Key Takeaways](#17-key-takeaways)
18. [References](#18-references)

---

## 1. Introduction

### 1.1 The Fail-Operational Imperative for Level 4 Autonomy

A Level 4 autonomous vehicle has no human driver to serve as fallback. When a component fails — a GPU locks up, a LiDAR loses sync, a CAN bus shorts — the system must continue operating safely long enough to reach a minimal risk condition (MRC). This is fundamentally different from traditional ADAS (Level 1-2), where the driver is always the ultimate fallback and the system can simply alert and disengage.

For airport airside operations, the stakes are extreme:
- Aircraft worth $100M-$400M are within meters
- Ground crew fatalities cost $7M+ per incident (FAA valuation)
- An uncontrolled vehicle on an active taxiway creates runway incursion risk
- Stopping in place is not always safe — a vehicle halted mid-pushback blocks the aircraft in a jet blast zone

The fail-operational requirement means the vehicle must maintain at minimum:
1. **Perception**: Ability to detect obstacles and understand the scene
2. **Localization**: Knowledge of where it is
3. **Planning**: Ability to compute a safe trajectory to stop
4. **Control**: Ability to execute that trajectory (steering + braking)
5. **Communication**: Ability to report its state to the fleet/tower

If any of these five capabilities is completely lost without warning, the vehicle cannot safely reach an MRC. Redundancy is the engineering answer: ensure that no single component failure can eliminate any of the five capabilities.

### 1.2 Scope and Relationship to Other Documents

This document focuses on **hardware and system-level architectural redundancy** — the physical and logical redundancy patterns that make a system fail-operational. It complements:

- `functional-safety-software.md` — Software development processes (MISRA, static analysis, testing)
- `simplex-safety-architecture.md` — Dual-stack software architecture (learned AC + classical BC)
- `safety-verification-certification.md` — Formal verification, RSS constraints, certification
- `testing-validation-methodology.md` — V&V methodology, scenario testing, shadow mode
- `safety-critical-planning-cbf.md` — Control barrier functions for safety filtering

### 1.3 Standards Context

| Standard | Relevance | Key Requirement |
|----------|-----------|-----------------|
| **ISO 26262:2018** | Automotive functional safety (applied by analogy) | ASIL classification, hardware metrics, systematic capability |
| **ISO 3691-4:2023** | Driverless industrial trucks (directly applicable) | PLd for personnel detection, safe-state requirements |
| **ISO 13849-1:2023** | Safety of machinery control systems | Performance Level calculation, Category architecture |
| **IEC 61508:2010** | Functional safety of E/E/PE systems | SIL classification, hardware fault tolerance |
| **ISO 21448:2022** | Safety of the intended functionality (SOTIF) | Triggering conditions, functional insufficiencies |
| **EU Machinery Reg. 2023/1230** | Effective Jan 2027, replaces Machinery Directive | AI software as safety component, third-party assessment |
| **ISO PAS 8800:2024** | Safety and AI | AI-specific risk assessment, data quality |

---

## 2. Failure Mode Taxonomy

### 2.1 Failure Types

Understanding failure modes is prerequisite to designing redundancy. Failures are classified along three axes:

**By duration:**

| Type | Duration | Example | Detection | Mitigation |
|------|----------|---------|-----------|------------|
| **Permanent** | Does not self-recover | GPU die failure, severed wire | Heartbeat timeout, self-test | Switch to redundant unit |
| **Transient** | Self-recovers within ms-seconds | Bit flip from radiation, EMI glitch | Error-correcting code (ECC), retry | Retry, vote with redundant outputs |
| **Intermittent** | Recurs unpredictably | Loose connector, thermal throttling | Trend analysis, vibration correlation | Preventive maintenance, derate |

**By detection:**

| Type | Observable? | Example | Approach |
|------|-------------|---------|----------|
| **Fail-silent** | Output stops | Dead process, severed bus | Heartbeat monitoring (timeout = failure) |
| **Fail-loud** | Produces detectably wrong output | NaN values, impossible sensor readings | Range checks, consistency checks |
| **Byzantine** | Produces plausibly wrong output | Subtle calibration drift, corrupted but valid-looking data | Voting, cross-sensor validation, temporal consistency |

Byzantine failures are the most dangerous — they cannot be detected by any single observer. Only cross-validation (comparing outputs of diverse redundant systems) can catch them.

**By scope:**

| Type | Scope | Example | Required Mitigation |
|------|-------|---------|---------------------|
| **Independent** | Single component | One GPU fails | Simple redundancy |
| **Common-cause (CCF)** | Multiple components from shared root | Power rail failure, software bug in shared library | Diversity, isolation, different design teams |
| **Systematic** | Design defect affecting all instances | Algorithm cannot handle fog, specification error | SOTIF analysis, diverse algorithms |

### 2.2 Common-Cause Failure Analysis

Common-cause failures (CCFs) defeat simple redundancy. Two identical GPUs on the same power rail both die simultaneously. Two instances of the same neural network both misclassify the same object. CCFs are the primary reason that **diverse redundancy** (different designs, different suppliers, different modalities) is required for high integrity levels.

ISO 26262 quantifies CCF susceptibility using the **beta factor** (β):

```
P(both fail) = β × P(one fails)
```

Where β ranges from 0 (fully independent) to 1 (fully dependent). Typical values:

| Architecture | β factor | Required mitigations |
|-------------|----------|---------------------|
| Identical HW, same power, same software | 0.1 - 0.5 | Unacceptable for safety-critical |
| Identical HW, isolated power, same software | 0.05 - 0.1 | Acceptable for ASIL B |
| Diverse HW, isolated power, diverse software | 0.01 - 0.02 | Required for ASIL D |
| Diverse HW + modality, isolated everything | 0.001 - 0.005 | Best practice for Level 4 |

### 2.3 Hardware Failure Rate Metrics

ISO 26262 Part 5 defines quantitative metrics for hardware:

**Single-Point Fault Metric (SPFM):**
```
SPFM = 1 - (λ_SPF / λ_total)
```
Where λ_SPF is the failure rate of single-point faults (faults that directly violate a safety goal without detection). Requirements: ASIL B ≥ 90%, ASIL C ≥ 97%, ASIL D ≥ 99%.

**Latent Fault Metric (LFM):**
```
LFM = 1 - (λ_latent / λ_total)
```
Where λ_latent is the failure rate of latent faults (multi-point faults that are not detected by any safety mechanism). Requirements: ASIL B ≥ 60%, ASIL C ≥ 80%, ASIL D ≥ 90%.

**Probabilistic Metric for Random Hardware Failure (PMHF):**
```
PMHF = Σ(λ_residual_i × t_exposure_i)    [for single-point faults]
     + Σ(λ_latent_j × λ_detected_k × t_exposure_k)  [for dual-point faults]
```
Requirements: ASIL B < 10⁻⁷/h, ASIL C < 10⁻⁷/h, ASIL D < 10⁻⁸/h.

For a dual-Orin compute platform with independent power and diverse software:
```
λ_Orin_random ≈ 200 FIT (failures in 10⁹ hours)
P(both fail simultaneously) ≈ λ² × t_diagnostic = (200e-9)² × 0.01 = 4e-19/h
PMHF contribution from compute ≈ 4e-13/h  (well below ASIL D requirement)
```

---

## 3. Fail-Safe vs Fail-Operational vs Fail-Degraded

### 3.1 Definitions

These terms are often used loosely. Precise definitions matter for system architecture:

**Fail-Safe:** Upon detecting a fault, the system transitions to a predefined safe state. The safe state is typically "stopped" — power to actuators is cut, brakes are applied. The system does NOT continue operating.

```
NORMAL --[fault detected]--> SAFE_STATE (stopped, de-energized)
```

Fail-safe is appropriate when:
- A human driver/operator can take over (ADAS Level 1-2)
- Stopping in place is inherently safe (factory floor with clear zones)
- The system operates in a controlled environment with safe parking areas

Fail-safe is **NOT** appropriate when:
- No human is available to take over (Level 4)
- Stopping in place creates hazard (active taxiway, pushback mid-operation)
- The vehicle must navigate to a safe location before stopping

**Fail-Operational:** Upon detecting a fault, the system continues to operate with full or near-full capability using redundant resources. The faulty component is isolated, and the system operates on the surviving components.

```
NORMAL --[fault detected]--> RECONFIGURE --> OPERATIONAL (reduced margin)
```

Fail-operational requires:
- Redundant components for every function in the safety path
- Fault detection fast enough to prevent hazardous output
- Automatic reconfiguration logic
- Sufficient remaining capability to complete the mission or reach MRC

**Fail-Degraded (Fail-Operational with Graceful Degradation):** Upon detecting a fault, the system continues to operate but with reduced capability — lower speed, reduced ODD, conservative behavior. This is the most practical approach for autonomous vehicles.

```
NORMAL --[fault detected]--> DEGRADE --> REDUCED_CAPABILITY --> MRC
```

Example degradation: one of two Orins fails → system continues on single Orin but reduces speed from 25 km/h to 10 km/h, disables neural planner (falls back to Frenet), and initiates navigation to nearest safe parking area.

### 3.2 Fail-Operational Time Budget

A critical design parameter is **how long** the system must remain operational after a fault. This determines the depth of redundancy required:

| Scenario | Required time | Determines |
|----------|--------------|------------|
| Highway L4 (Waymo, Aurora) | 10-30 seconds | Time to pull over at highway speed |
| Urban L4 (Cruise, Zoox) | 30-120 seconds | Time to navigate to safe stop in city |
| Airside GSE (Aurrigo) | 30-180 seconds | Time to clear active area, complete pushback |
| Pushback mid-operation | 60-300 seconds | Cannot abandon aircraft on taxiway |

For airside operations, the **pushback scenario is the most demanding**: if a fault occurs while pushing back an aircraft from the gate, the vehicle must complete the pushback (or safely hand off to ground crew) before it can stop. Abandoning a connected aircraft on an active taxiway is not a safe state.

### 3.3 ISO 13849-1 Category Architectures

ISO 13849-1 defines architectural categories that map to redundancy patterns:

**Category B (Basic):** Single channel, no diagnostics. A single fault can cause loss of safety function. Only acceptable for very low risk (PLa).

```
Input → Logic → Output
```

**Category 1 (Well-tried components):** Single channel with well-tried components and principles. Same as B but using proven components. Acceptable for PLa-PLc.

**Category 2 (Single with diagnostics):** Single channel with periodic testing by a diagnostic channel. A fault between tests causes loss of safety function.

```
Input → Logic → Output
         ↑
    Test/Diagnostic
```

**Category 3 (Dual channel):** Two channels, either of which can maintain the safety function. A single fault does not cause loss of safety function. Required for PLd (ISO 3691-4 personnel detection).

```
Input₁ → Logic₁ → Output₁
                  ↘
                   Monitoring/Comparison
                  ↗
Input₂ → Logic₂ → Output₂
```

**Category 4 (Dual with accumulated fault detection):** Same as Category 3, but accumulated faults (including latent faults) are detected. Required for PLe.

For ISO 3691-4 compliance at PLd, Category 3 is the minimum. This means dual-channel architectures for all safety functions (personnel detection, emergency stop, speed limiting).

---

## 4. Architectural Patterns

### 4.1 1oo2D (1-out-of-2 with Diagnostics)

The most common fail-operational pattern for autonomous vehicles. Two independent channels perform the same function. A diagnostic module compares their outputs and detects disagreement.

```
         ┌──────────────────────────┐
Sensor₁ →│ Channel A (Compute₁)     │→ Output_A ─┐
         └──────────────────────────┘             │
                                            ┌─────┤ Selector/
                                            │     │ Arbitrator
         ┌──────────────────────────┐       │     │
Sensor₂ →│ Channel B (Compute₂)     │→ Output_B ─┘
         └──────────────────────────┘             │
                                                  ↓
                                            Final Output
```

**Normal operation:** Both channels produce outputs. Arbitrator selects one (typically the more performant channel) or fuses both.

**Fault detected:** Arbitrator detects disagreement or one channel's heartbeat stops. Switches to the surviving channel, signals degraded mode.

**Key design decisions:**
- **Homogeneous vs diverse:** Same hardware and software (cheaper, easier) vs different hardware/software (better CCF protection). ASIL D requires diversity per ISO 26262 Part 9.
- **Hot standby vs active-active:** Both channels always running (higher power, instant switchover) vs one idle until needed (lower power, switchover latency). For airside AVs, active-active is required — switchover latency must be < 50ms.

```python
class OneOutOfTwoDiagnostic:
    """1oo2D arbitrator for dual-compute fail-operational architecture."""
    
    def __init__(self, config):
        self.timeout_ms = config.get('heartbeat_timeout_ms', 100)
        self.disagreement_threshold = config.get('disagreement_threshold', 0.5)  # m/s²
        self.primary = 'A'
        self.last_heartbeat_a = time.monotonic()
        self.last_heartbeat_b = time.monotonic()
        self.state = 'NOMINAL'  # NOMINAL, DEGRADED_A, DEGRADED_B, SAFE_STOP
        self.disagreement_count = 0
        self.max_disagreement_before_safe_stop = 10  # consecutive cycles
    
    def update(self, output_a, heartbeat_a, output_b, heartbeat_b):
        """Called every control cycle (10-50ms)."""
        now = time.monotonic()
        
        # Update heartbeat tracking
        if heartbeat_a:
            self.last_heartbeat_a = now
        if heartbeat_b:
            self.last_heartbeat_b = now
        
        a_alive = (now - self.last_heartbeat_a) * 1000 < self.timeout_ms
        b_alive = (now - self.last_heartbeat_b) * 1000 < self.timeout_ms
        
        # Check channel liveness
        if not a_alive and not b_alive:
            self.state = 'SAFE_STOP'
            return self._safe_stop_command()
        elif not a_alive:
            self.state = 'DEGRADED_B'
            return output_b
        elif not b_alive:
            self.state = 'DEGRADED_A'
            return output_a
        
        # Both alive — check consistency
        disagreement = self._compute_disagreement(output_a, output_b)
        
        if disagreement > self.disagreement_threshold:
            self.disagreement_count += 1
            if self.disagreement_count > self.max_disagreement_before_safe_stop:
                # Persistent disagreement — Byzantine fault, cannot trust either
                self.state = 'SAFE_STOP'
                return self._safe_stop_command()
            # Transient disagreement — use primary
            return output_a if self.primary == 'A' else output_b
        else:
            self.disagreement_count = 0
            self.state = 'NOMINAL'
            # Normal: use primary (or fuse)
            return output_a if self.primary == 'A' else output_b
    
    def _compute_disagreement(self, a, b):
        """Compare control outputs (acceleration, steering)."""
        accel_diff = abs(a.acceleration - b.acceleration)
        steer_diff = abs(a.steering_angle - b.steering_angle)
        # Weighted combination
        return accel_diff + 2.0 * steer_diff  # steering disagreement weighted higher
    
    def _safe_stop_command(self):
        """Maximum deceleration to stop."""
        cmd = ControlCommand()
        cmd.acceleration = -3.0  # m/s², comfortable emergency decel for GSE
        cmd.steering_angle = 0.0  # maintain current heading
        return cmd
```

### 4.2 Triple Modular Redundancy (TMR)

Three channels with majority voting. Tolerates any single channel producing wrong output (including Byzantine faults). Used for the most critical functions.

```
Channel A → ┐
Channel B → ┤ Majority Vote → Output
Channel C → ┘
```

**Advantages:**
- Tolerates Byzantine faults (2-out-of-3 voting)
- No need to determine which channel is faulty — just take the majority
- Can detect and isolate the faulty channel, then continue as 1oo2D

**Disadvantages:**
- 50% more hardware than 1oo2D
- Higher power consumption
- Voting logic itself must be simple and verified

**Where TMR is used in practice:**
- Safety-critical actuator commands (brake-by-wire)
- Emergency stop decision logic
- Inertial measurement (triple IMU configurations)

```python
def tmr_vote(val_a, val_b, val_c, tolerance=0.1):
    """Triple modular redundancy voting with fault identification."""
    ab_agree = abs(val_a - val_b) < tolerance
    bc_agree = abs(val_b - val_c) < tolerance
    ac_agree = abs(val_a - val_c) < tolerance
    
    if ab_agree and bc_agree:
        # All three agree
        return (val_a + val_b + val_c) / 3.0, 'ALL_AGREE', None
    elif ab_agree:
        # C is faulty
        return (val_a + val_b) / 2.0, 'C_FAULTY', 'C'
    elif bc_agree:
        # A is faulty
        return (val_b + val_c) / 2.0, 'A_FAULTY', 'A'
    elif ac_agree:
        # B is faulty
        return (val_a + val_c) / 2.0, 'B_FAULTY', 'B'
    else:
        # No two agree — catastrophic disagreement
        # Fall back to median (most robust single estimator)
        median = sorted([val_a, val_b, val_c])[1]
        return median, 'NO_AGREEMENT', 'UNKNOWN'
```

### 4.3 Monitor-Actuator Pattern

A simpler alternative to full dual-compute: one channel computes, a separate monitor checks the output. The monitor does NOT compute the full function — it only verifies that the output is safe.

```
Sensors → Compute → Command → Actuator
              ↓
           Monitor → Safe? → Gate → Allow/Block
```

The monitor is simpler than the compute channel, making it easier to verify and certify. This is the pattern used by:
- **comma.ai Panda**: STM32 safety MCU monitors commands from the main compute
- **Simplex architecture**: BC (baseline controller) monitors AC (advanced controller)
- **RSS checker**: Verifies that planned trajectory satisfies responsibility-sensitive safety constraints

**For Aurrigo, the monitor-actuator pattern is already partially implemented** via the STM32 CAN safety gateway that validates commands before forwarding to the vehicle CAN bus. This document recommends extending it to a full fail-operational architecture.

### 4.4 Safety Bag / Runtime Monitor

A "safety bag" is a set of runtime checks applied to the system's outputs before they reach actuators. Unlike the monitor-actuator pattern (which has a separate compute element), a safety bag is a set of rules/constraints checked inline.

```python
class SafetyBag:
    """Runtime safety envelope for actuator commands.
    
    Checks are ordered from cheapest to most expensive.
    Any failed check triggers command rejection and fallback.
    """
    
    def __init__(self, vehicle_params, odd_config):
        self.max_speed = vehicle_params['max_speed_mps']  # 6.94 m/s (25 km/h)
        self.max_accel = vehicle_params['max_accel']       # 2.0 m/s²
        self.max_decel = vehicle_params['max_decel']       # -4.0 m/s²
        self.max_steer_rate = vehicle_params['max_steer_rate']  # 0.5 rad/s
        self.max_steer = vehicle_params['max_steer_angle']      # 0.52 rad (30°)
        self.geofence = odd_config['geofence_polygon']
        self.exclusion_zones = odd_config.get('exclusion_zones', [])
        self.last_steer = 0.0
        self.last_cmd_time = time.monotonic()
        self.violation_log = []
    
    def check(self, cmd, vehicle_state):
        """Returns (safe, filtered_cmd, violations)."""
        violations = []
        filtered = copy.copy(cmd)
        
        # 1. NaN/Inf check (Byzantine fault detection)
        if math.isnan(cmd.acceleration) or math.isinf(cmd.acceleration):
            violations.append('NaN_ACCEL')
            filtered.acceleration = self.max_decel  # emergency brake
        if math.isnan(cmd.steering_angle) or math.isinf(cmd.steering_angle):
            violations.append('NaN_STEER')
            filtered.steering_angle = self.last_steer  # hold last valid
        
        # 2. Range checks (physical limits)
        filtered.acceleration = max(self.max_decel, 
                                    min(self.max_accel, filtered.acceleration))
        if abs(cmd.acceleration - filtered.acceleration) > 0.01:
            violations.append(f'ACCEL_CLAMPED:{cmd.acceleration:.2f}')
        
        filtered.steering_angle = max(-self.max_steer,
                                      min(self.max_steer, filtered.steering_angle))
        
        # 3. Rate limiting (prevent actuator damage and passenger discomfort)
        dt = time.monotonic() - self.last_cmd_time
        if dt > 0:
            steer_rate = (filtered.steering_angle - self.last_steer) / dt
            if abs(steer_rate) > self.max_steer_rate:
                sign = 1.0 if steer_rate > 0 else -1.0
                filtered.steering_angle = self.last_steer + sign * self.max_steer_rate * dt
                violations.append(f'STEER_RATE_LIMITED:{steer_rate:.2f}')
        
        # 4. Speed limit enforcement
        predicted_speed = vehicle_state.speed + filtered.acceleration * dt
        if predicted_speed > self.max_speed:
            # Compute maximum allowable acceleration
            filtered.acceleration = min(filtered.acceleration,
                                        (self.max_speed - vehicle_state.speed) / max(dt, 0.01))
            violations.append('SPEED_LIMITED')
        
        # 5. Geofence check
        predicted_pos = self._predict_position(vehicle_state, filtered, dt)
        if not self._point_in_polygon(predicted_pos, self.geofence):
            filtered.acceleration = self.max_decel
            violations.append('GEOFENCE_VIOLATION')
        
        # 6. Exclusion zone check (runways, restricted areas)
        for zone in self.exclusion_zones:
            if self._point_in_polygon(predicted_pos, zone['polygon']):
                filtered.acceleration = self.max_decel
                violations.append(f'EXCLUSION_ZONE:{zone["name"]}')
        
        # Update state
        self.last_steer = filtered.steering_angle
        self.last_cmd_time = time.monotonic()
        
        if violations:
            self.violation_log.append({
                'time': time.time(),
                'violations': violations,
                'original': cmd,
                'filtered': filtered
            })
        
        return len(violations) == 0, filtered, violations
```

---

## 5. Compute Redundancy

### 5.1 Dual-Compute Architecture

The most common architecture for Level 4 AVs uses two physically separate compute units, each capable of running the full autonomy stack independently.

```
┌─────────────────────────────────────────────┐
│              Compute Unit A                  │
│  ┌──────────────────────────────────────┐   │
│  │ NVIDIA Orin (275 TOPS)               │   │
│  │ - Full perception pipeline            │   │
│  │ - Neural planner (world model)        │   │
│  │ - Localization (GTSAM)               │   │
│  │ - Motion planning                     │   │
│  └──────────────────────────────────────┘   │
│  Power: Battery A → DC-DC A → 12V/19V      │
│  CAN: CAN-A bus                             │
│  Ethernet: Switch A                         │
└─────────────────────────────────────────────┘
              │ Cross-link (Ethernet) │
┌─────────────────────────────────────────────┐
│              Compute Unit B                  │
│  ┌──────────────────────────────────────┐   │
│  │ NVIDIA Orin (275 TOPS)               │   │
│  │ - Classical perception (PointPillars) │   │
│  │ - Frenet planner (safety baseline)    │   │
│  │ - Localization (GTSAM)               │   │
│  │ - Motion planning                     │   │
│  └──────────────────────────────────────┘   │
│  Power: Battery B → DC-DC B → 12V/19V      │
│  CAN: CAN-B bus                             │
│  Ethernet: Switch B                         │
└─────────────────────────────────────────────┘
              │
┌─────────────────────────────────────────────┐
│         Safety MCU (STM32H7)                 │
│  - Watchdog for both computes               │
│  - CAN gateway (validates commands)         │
│  - E-stop logic (hardwired)                 │
│  - Heartbeat monitoring                      │
│  - Power: Both batteries via diode-OR       │
└─────────────────────────────────────────────┘
```

**Key design principles:**

1. **Diverse software stacks**: Unit A runs the advanced neural pipeline (world model, learned planner). Unit B runs the classical pipeline (PointPillars, Frenet planner). This is the Simplex architecture mapped to hardware: Unit A = AC (advanced controller), Unit B = BC (baseline controller).

2. **Independent power domains**: Each compute has its own power path from a separate battery through a separate DC-DC converter. No single power failure can take out both computes.

3. **Safety MCU as arbiter**: The STM32 safety MCU receives commands from both computes and implements the 1oo2D arbitration logic. It has hardwired e-stop capability even if both computes are dead.

4. **Cross-link for state synchronization**: Dedicated Ethernet link between computes for sharing state (localization, map data) but NOT required for either to function independently.

### 5.2 NVIDIA Orin Functional Safety Island (FSI)

The Orin SoC includes a dedicated **Functional Safety Island (FSI)** — a hardware subsystem designed to ASIL D systematic capability:

**FSI Architecture:**
```
┌─────────────────────────────────────────┐
│           NVIDIA Orin SoC                │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │     Main Compute Complex        │    │
│  │  - 12x Arm Cortex-A78AE cores  │    │
│  │  - 2048 CUDA cores             │    │
│  │  - 2x NVDLA                    │    │
│  │  - 275 TOPS                    │    │
│  └─────────┬───────────────────────┘    │
│            │ Internal bus (monitored)    │
│  ┌─────────┴───────────────────────┐    │
│  │  Functional Safety Island (FSI) │    │
│  │  - 4x Arm Cortex-R52 in DCLS   │    │
│  │    (Dual-Core Lock-Step)        │    │
│  │  - ~10K ASIL D MIPS            │    │
│  │  - Dedicated SRAM (ECC)        │    │
│  │  - Watchdog timers              │    │
│  │  - Voltage/temp monitors        │    │
│  │  - CAN/SPI interfaces          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**DCLS (Dual-Core Lock-Step):** Each pair of R52 cores executes the same instructions in parallel. Outputs are compared every cycle — any disagreement triggers an immediate fault interrupt. This provides hardware-level Byzantine fault detection for safety-critical code.

**What runs on FSI:**
- Vehicle dynamics monitoring (speed, acceleration bounds)
- Actuator command validation (same as safety bag logic)
- Sensor health watchdog
- E-stop arbitration logic
- Heartbeat generation for external safety MCU
- ASIL D safety functions that cannot tolerate GPU/CUDA faults

**What does NOT run on FSI:**
- Neural network inference (needs GPU)
- Perception pipeline (needs full compute)
- Path planning (needs significant compute)

The FSI provides an **on-chip safety monitor** — it watches the main compute complex and can trigger safe-state transitions independently of the main CPU/GPU stack. For Orin-based systems, the FSI replaces or supplements the external safety MCU for many monitoring functions.

### 5.3 Lockstep vs Diverse Computation

**Lockstep:** Two identical processors execute the same code. Outputs are compared cycle-by-cycle. Detects random hardware faults (bit flips, stuck-at faults) but NOT systematic faults (software bugs, specification errors).

**Diverse computation:** Two different processors/algorithms compute the same function. Outputs are compared at the functional level. Detects both random AND systematic faults, at the cost of defining "agreement" between different implementations.

| Aspect | Lockstep | Diverse |
|--------|----------|---------|
| Random HW fault detection | Excellent | Excellent |
| Systematic fault detection | None | Good |
| CCF resistance | Low (identical design) | High |
| Agreement definition | Exact bit match | Functional tolerance |
| Development cost | 1x (single implementation) | 2x+ (two implementations) |
| ASIL coverage | Up to ASIL D (random only) | ASIL D (random + systematic) |

**For Aurrigo:** The dual-compute architecture already provides diverse computation at the system level: neural perception+planning on Unit A vs classical perception+planning on Unit B. Within each unit, the Orin FSI provides lockstep monitoring. This combination — lockstep within each unit, diversity across units — covers both random and systematic faults.

### 5.4 GPU-Specific Failure Modes

GPUs present unique challenges for fail-operational design:

| Failure mode | Detection | Mitigation |
|-------------|-----------|------------|
| **CUDA kernel hang** | Watchdog timeout (GPU heartbeat) | Kill and restart pipeline, switch to backup compute |
| **ECC uncorrectable error** | Hardware interrupt | Re-run inference; if persistent, switch to backup |
| **Thermal throttling** | Temperature monitoring | Reduce compute load, increase planning cycle time |
| **Driver crash** | Process monitoring | Restart driver; takes 200-500ms on Orin |
| **Silent data corruption** | Output validation (range/consistency) | Cross-check with backup compute |
| **TensorRT engine corruption** | Model checksum verification | Reload engine from verified image |

**GPU watchdog implementation for Orin:**

```cpp
// Simplified GPU heartbeat monitor for safety MCU integration
class GPUWatchdog {
    static constexpr uint32_t HEARTBEAT_TIMEOUT_MS = 200;  // 5Hz minimum
    static constexpr uint32_t MAX_CONSECUTIVE_SLOW = 5;
    
    struct Stats {
        uint64_t total_heartbeats = 0;
        uint64_t missed_heartbeats = 0;
        uint64_t slow_heartbeats = 0;
        double max_latency_ms = 0.0;
        double avg_latency_ms = 0.0;
    };
    
    std::atomic<uint64_t> last_heartbeat_us_{0};
    std::atomic<uint32_t> consecutive_slow_{0};
    Stats stats_;
    
public:
    // Called by GPU pipeline after each inference cycle
    void kick() {
        auto now = steady_clock_us();
        auto last = last_heartbeat_us_.load(std::memory_order_relaxed);
        
        if (last > 0) {
            double latency_ms = (now - last) / 1000.0;
            stats_.avg_latency_ms = 0.95 * stats_.avg_latency_ms + 0.05 * latency_ms;
            stats_.max_latency_ms = std::max(stats_.max_latency_ms, latency_ms);
            
            if (latency_ms > HEARTBEAT_TIMEOUT_MS * 0.8) {
                consecutive_slow_.fetch_add(1, std::memory_order_relaxed);
                stats_.slow_heartbeats++;
            } else {
                consecutive_slow_.store(0, std::memory_order_relaxed);
            }
        }
        
        last_heartbeat_us_.store(now, std::memory_order_release);
        stats_.total_heartbeats++;
    }
    
    // Called by safety monitor at fixed rate
    enum class Status { OK, SLOW, TIMEOUT };
    
    Status check() const {
        auto now = steady_clock_us();
        auto last = last_heartbeat_us_.load(std::memory_order_acquire);
        
        if (last == 0) return Status::TIMEOUT;  // Never kicked
        
        double elapsed_ms = (now - last) / 1000.0;
        
        if (elapsed_ms > HEARTBEAT_TIMEOUT_MS) {
            return Status::TIMEOUT;
        }
        if (consecutive_slow_.load(std::memory_order_relaxed) > MAX_CONSECUTIVE_SLOW) {
            return Status::SLOW;
        }
        return Status::OK;
    }
};
```

### 5.5 NVIDIA Thor: Next-Generation Fail-Operational Compute

NVIDIA DRIVE Thor (~1,000 TOPS dense, FP8 native, first vehicles early 2025 with Zeekr) introduces hardware features specifically designed for fail-operational Level 4:

- **Multi-domain compute isolation**: Hardware partitioning allows running safety-critical and non-safety code on the same SoC with ASIL D isolation guarantees
- **Enhanced FSI**: Larger safety island with more lockstep cores
- **Integrated NvSCI**: Hardware-assisted inter-process communication with guaranteed latency bounds
- **Dual-die option**: Two Thor dies in one package for fail-operational without external redundancy

A single Thor SoC can potentially replace the dual-Orin architecture by running the advanced and baseline stacks on hardware-isolated partitions within the same chip. This reduces power, weight, and cost while maintaining fail-operational capability. However, it introduces shared-die CCF risk that must be assessed.

---

## 6. Sensor Redundancy

### 6.1 Modality Diversity

No single sensor modality is robust to all failure modes. Modality diversity is the primary defense against environmental common-cause failures:

| Modality | Strengths | Failure modes | Mitigated by |
|----------|-----------|---------------|-------------|
| **LiDAR** | Precise 3D geometry, works in dark | Rain, fog, snow, dust, direct sun, reflective surfaces, black surfaces | Radar, camera |
| **Camera** | Rich semantics, texture, color, signage | Dark, glare, rain on lens, fog, no depth | LiDAR, radar |
| **Radar** | Works in all weather, measures velocity | Poor angular resolution, multipath, ground clutter | LiDAR, camera |
| **4D radar** | Weather immunity, elevation, velocity | Lower spatial resolution vs LiDAR, emerging technology | LiDAR, camera |
| **Ultrasonics** | Close range, low cost | Very short range (<5m), no classification | LiDAR, camera |
| **RTK-GPS** | Absolute position, cm accuracy | Multipath (buildings), spoofing, outages | IMU, LiDAR odometry, wheel odometry |
| **IMU** | Angular rate, acceleration, high rate | Drift over time, vibration sensitivity | GPS, LiDAR odometry, wheel odometry |
| **Wheel odometry** | Simple, reliable, independent | Wheel slip, calibration drift | IMU, GPS, LiDAR odometry |

**Current Aurrigo sensor suite (LiDAR-only perception):**
- 4-8x RoboSense (RSHELIOS/RSBP) LiDAR — provides spatial redundancy within one modality
- RTK-GPS + IMU (500Hz) + wheel odometry — for localization
- No cameras or radar in the perception pipeline

**Recommended minimum for fail-operational:**
- LiDAR array (current) + 4D radar (Continental ARS548) as primary dual modality
- Camera (minimum 2x surround) for semantic backup and regulatory compliance
- Triple IMU (TMR voting) for robust inertial reference
- Dual RTK-GPS receivers for heading and redundancy

### 6.2 Spatial Redundancy

Multiple sensors of the same modality covering overlapping fields of view:

```
              Front
         ┌─────────────┐
    LiDAR₁         LiDAR₂
   (RSHELIOS)     (RSHELIOS)
         └──┐   ┌──┘
            │   │        ← Overlap zone (double coverage)
   LiDAR₃  │   │  LiDAR₄
   (RSBP)  │   │  (RSBP)
         ┌──┘   └──┐
    LiDAR₅         LiDAR₆
   (RSHELIOS)     (RSHELIOS)
         └─────────────┘
              Rear
```

With 6-8 LiDARs, every point in the near field (0-30m) is covered by at least 2 sensors. Any single LiDAR failure reduces coverage but does not create a blind spot. The system can detect single-LiDAR failure by checking point cloud density in overlap zones.

### 6.3 Sensor Health and Degraded Perception Modes

See `hardware/sensors/sensor-degradation-health-monitoring.md` for detailed diagnostics. The fail-operational architecture must define degradation tiers:

| Tier | Condition | Perception capability | Speed limit | Action |
|------|-----------|----------------------|-------------|--------|
| **T0: Nominal** | All sensors healthy | Full | 25 km/h | Normal operation |
| **T1: Minor** | 1 LiDAR degraded or lost | 90%+ coverage, slight blind spot | 20 km/h | Alert, schedule maintenance |
| **T2: Moderate** | 2 LiDARs lost OR primary radar offline | 70%+ coverage, backup modality active | 15 km/h | Route to depot after current task |
| **T3: Significant** | Half of LiDARs lost OR all cameras offline | 50%+ coverage, relying on remaining modalities | 10 km/h | Complete current task, then stop |
| **T4: Critical** | Only 1 LiDAR + 1 radar remaining | Minimal coverage, forward-only | 5 km/h | Navigate to nearest safe stop |
| **T5: Emergency** | Perception below minimum safe threshold | Cannot guarantee obstacle detection | 0 | Immediate safe stop (brakes + hazard lights) |

```python
class SensorRedundancyManager:
    """Manages sensor health and determines perception degradation tier."""
    
    REQUIRED_COVERAGE_ZONES = {
        'front_close': (-30, 30, 0, 10),    # deg_min, deg_max, range_min, range_max (m)
        'front_far': (-15, 15, 10, 50),
        'left': (-120, -30, 0, 15),
        'right': (30, 120, 0, 15),
        'rear': (150, -150, 0, 10),          # wraps around
    }
    
    def __init__(self, sensor_configs):
        self.sensors = {}
        for cfg in sensor_configs:
            self.sensors[cfg['id']] = SensorHealth(cfg)
    
    def compute_tier(self):
        """Determine current degradation tier based on sensor health."""
        healthy_lidars = sum(1 for s in self.sensors.values() 
                            if s.modality == 'lidar' and s.is_healthy())
        healthy_radars = sum(1 for s in self.sensors.values()
                            if s.modality == 'radar' and s.is_healthy())
        healthy_cameras = sum(1 for s in self.sensors.values()
                             if s.modality == 'camera' and s.is_healthy())
        total_lidars = sum(1 for s in self.sensors.values() if s.modality == 'lidar')
        
        # Check coverage zones
        uncovered_zones = self._find_uncovered_zones()
        critical_uncovered = 'front_close' in uncovered_zones
        
        if critical_uncovered:
            return 'T5'  # Cannot see directly ahead — emergency stop
        
        if healthy_lidars <= 1 and healthy_radars == 0:
            return 'T5'
        elif healthy_lidars <= 1:
            return 'T4'
        elif healthy_lidars <= total_lidars // 2:
            return 'T3'
        elif healthy_lidars < total_lidars or healthy_radars == 0:
            return 'T2'
        elif any(not s.is_healthy() for s in self.sensors.values()):
            return 'T1'
        else:
            return 'T0'
    
    def _find_uncovered_zones(self):
        """Identify coverage zones with no healthy sensor."""
        uncovered = []
        for zone_name, zone_bounds in self.REQUIRED_COVERAGE_ZONES.items():
            has_coverage = False
            for sensor in self.sensors.values():
                if sensor.is_healthy() and sensor.covers_zone(zone_bounds):
                    has_coverage = True
                    break
            if not has_coverage:
                uncovered.append(zone_name)
        return uncovered
```

---

## 7. Actuator Redundancy

### 7.1 Steering Redundancy

For Ackermann-steered vehicles (ADT3, STL2), steering is the most critical actuator — loss of steering at any speed creates an uncontrolled trajectory.

**Electric Power Steering (EPS) redundancy patterns:**

| Pattern | Description | Fault tolerance | Used by |
|---------|-------------|-----------------|---------|
| **Single EPS + mechanical linkage** | Standard automotive | None — EPS failure = manual-only (no driver!) | Most production cars |
| **Dual-motor EPS** | Two motors on one rack | Tolerates one motor failure | Some L3 vehicles |
| **Dual-rack EPS** | Two complete steering racks | Tolerates complete rack failure | Zoox, some robotaxis |
| **Steer-by-wire + fallback EPS** | Primary SbW + backup traditional EPS | Full independence | Production SbW systems |
| **Redundant steer-by-wire** | Dual SbW actuators, no mechanical link | Tolerates any single SbW failure | Future L4 platforms |

**ADT3 crab steering advantage:** The ADT3 has both front Ackermann and crab steering capability. This provides inherent steering diversity — if the Ackermann steering fails, crab mode can still maneuver the vehicle to a stop (at reduced capability). This is a significant safety advantage unique to the ADT3 platform.

### 7.2 Braking Redundancy

Braking is the ultimate safety function. Even in a complete compute failure, the vehicle must be able to stop.

**Braking redundancy layers (defense in depth):**

```
Layer 1: Software brake command (normal operation)
  ↓ (if fails)
Layer 2: Safety MCU commanded brake (compute watchdog timeout)
  ↓ (if fails)
Layer 3: Hardware watchdog relay (MCU heartbeat timeout)
  ↓ (if fails)
Layer 4: Mechanical parking brake / spring-applied brake
  ↓ (always active when not powered)
Layer 5: Physical friction (worst case — emergency drag)
```

**Spring-applied, hydraulic-release (SAHR) brakes** are the gold standard for industrial AGVs (and required by ISO 3691-4 for parking brake): the brake is applied by spring force when power is removed. This means any power failure results in immediate braking — a natural fail-safe design.

For electric GSE vehicles, regenerative braking provides an additional braking mode that works independently of the friction brake system, though it cannot bring the vehicle to a complete stop.

### 7.3 Drive Redundancy

Electric drive motors in GSE vehicles are inherently more redundant than combustion engines:

| Configuration | Fault tolerance | Notes |
|---------------|-----------------|-------|
| **Single motor** | None | Standard configuration |
| **Dual motor (front/rear)** | Can still brake and limp on one motor | Common in EVs |
| **Hub motors (4x)** | Tolerates 1-2 motor failures | Each wheel independent |

For airside GSE, complete drive loss is less critical than steering/braking loss — a vehicle that cannot drive is annoying but not dangerous (assuming brakes hold). The priority for actuator redundancy is: **braking > steering > drive**.

---

## 8. Power Supply Redundancy

### 8.1 Power Architecture

Power failure is the most common cause of total system loss. Every subsystem must have at least two independent power paths:

```
┌──────────────┐    ┌──────────────┐
│  Battery A    │    │  Battery B    │
│  (48V/400V    │    │  (48V/400V    │
│   traction)   │    │   traction)   │
└──────┬───────┘    └──────┬───────┘
       │                    │
       ▼                    ▼
┌──────────────┐    ┌──────────────┐
│  DC-DC A      │    │  DC-DC B      │
│  48V→12V      │    │  48V→12V      │
└──────┬───────┘    └──────┬───────┘
       │                    │
       ├─── Compute A ◄────┤  (diode-OR: either DC-DC can power both)
       │                    │
       ├─── Compute B ◄────┤
       │                    │
       ├─── Safety MCU ◄───┤  (always powered if either battery alive)
       │                    │
       ├─── Sensors A  ◄───┤
       │                    │
       └─── Sensors B  ◄───┘
```

**Design rules:**
1. No single fuse, relay, or wire failure can de-power more than one subsystem
2. Safety MCU has diode-OR from both power paths — survives any single power failure
3. Each sensor group has independent power (LiDAR group A on Power A, LiDAR group B on Power B)
4. Compute units have independent power with cross-feed capability (diode-OR) for maximum availability
5. 12V auxiliary battery (or supercapacitor bank) provides 30-60 second power holdover for safe stop if both main batteries fail simultaneously

### 8.2 Power Monitoring

```cpp
struct PowerDomainHealth {
    float voltage_v;           // Current voltage
    float current_a;           // Current draw
    float temperature_c;       // Connector/board temperature
    float voltage_ripple_mv;   // AC component (indicates failing DC-DC)
    bool overcurrent_flag;     // Exceeded threshold
    bool undervoltage_flag;    // Below minimum for compute stability
    uint32_t brownout_count;   // Cumulative brownouts
    
    bool is_healthy() const {
        return voltage_v >= 11.0f && voltage_v <= 14.0f  // 12V nominal
            && current_a < 30.0f                          // Max rated current
            && temperature_c < 85.0f                      // Derating threshold
            && voltage_ripple_mv < 500.0f                 // Failing DC-DC signature
            && !overcurrent_flag
            && !undervoltage_flag;
    }
};

class PowerRedundancyManager {
    PowerDomainHealth domain_a_, domain_b_;
    bool cross_feed_active_ = false;
    
    enum class PowerState {
        NOMINAL,           // Both domains healthy
        DEGRADED_A,        // Domain A failed, running on B
        DEGRADED_B,        // Domain B failed, running on A
        CROSS_FEED,        // One domain marginal, cross-feeding
        EMERGENCY,         // Both domains unhealthy
        HOLDOVER           // Running on backup power, safe stop in progress
    };
    
    PowerState assess() {
        bool a_ok = domain_a_.is_healthy();
        bool b_ok = domain_b_.is_healthy();
        
        if (a_ok && b_ok) return PowerState::NOMINAL;
        if (a_ok && !b_ok) return PowerState::DEGRADED_B;
        if (!a_ok && b_ok) return PowerState::DEGRADED_A;
        
        // Both unhealthy — check if holdover power available
        if (holdover_available())
            return PowerState::HOLDOVER;
        
        return PowerState::EMERGENCY;
    }
};
```

### 8.3 Supercapacitor Holdover

For the critical 30-60 second safe-stop window, a supercapacitor bank provides more reliable holdover power than a tertiary battery:

- **Maxwell/UCAP BMOD series**: 48V module, 165F, stores ~190 kJ
- At 200W compute load: ~190,000 / 200 = ~950 seconds theoretical, ~300 seconds practical (accounting for voltage droop and minimum operating voltage)
- Advantages over battery: 1M+ charge cycles, works at -40°C to +65°C, no fire risk, instant charge
- Disadvantage: Lower energy density, higher cost per kWh

For Orin at ~60W TDP, a 48V/60F supercap module provides ~60 seconds of compute power — sufficient to execute a safe stop.

---

## 9. Communication Redundancy

### 9.1 Internal Communication (On-Vehicle)

```
┌───────────────────────────────────────────────┐
│                On-Vehicle Network               │
│                                                 │
│  ┌──────┐    Ethernet (1GbE)    ┌──────┐       │
│  │Orin A├────────────────────────┤Orin B│       │
│  └──┬───┘                       └──┬───┘       │
│     │                               │           │
│     │  CAN-A (500kbps)              │  CAN-B    │
│     │  ┌──────────┐                │           │
│     └──┤Safety MCU├────────────────┘           │
│        └────┬─────┘                             │
│             │                                   │
│             │  Vehicle CAN (500kbps)            │
│        ┌────┴─────────────────┐                 │
│        │  Steering  Braking   │                 │
│        │  Drive     Sensors   │                 │
│        └──────────────────────┘                 │
└───────────────────────────────────────────────┘
```

**Redundancy requirements:**
- **Dual CAN buses**: CAN-A and CAN-B carry the same safety-critical messages. Safety MCU listens to both and can command the vehicle from either. If one bus fails (short, open), the other maintains control.
- **Ethernet for data-intensive communication**: Point cloud, camera, map data between compute units. Not safety-critical path (safety commands go via CAN through safety MCU).
- **Watchdog heartbeat**: Safety MCU generates heartbeat on both CAN buses. Any compute unit that stops seeing heartbeat on both buses enters safe stop.

**CAN bus failure modes and detection:**

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Bus-off (one node) | CAN controller error counter > 255 | Auto-recovery after 128×11 recessive bits; safety MCU switches to other bus |
| Short to ground | All nodes see dominant state | Safety MCU detects via hardware fault pin, switches to other bus |
| Short to VCC | All nodes see recessive state | No communication possible; safety MCU detects via heartbeat loss |
| Open (wire break) | Affected segment loses arbitration | Depends on topology; star topology with hub isolates break |
| Babbling node | Excessive bus load, other nodes starved | Safety MCU monitors bus load, can disable offending node via relay |

### 9.2 External Communication (V2X, Fleet)

External communication links to fleet management, tower, teleoperation:

| Link | Primary | Backup | Failure mode |
|------|---------|--------|-------------|
| **Fleet server** | 5G/LTE | WiFi 6 (airport) | Operate autonomously with pre-loaded mission |
| **Teleoperation** | 5G (low latency) | LTE (higher latency) | Auto-stop if latency >500ms or loss >5s |
| **V2X / DSRC** | C-V2X (PC5) | WiFi direct | Reduce speed, increase safety margins |
| **Tower communication** | API (A-CDM) | Manual radio (human in loop) | Follow last received clearance, hold position |

**Communication loss handling:**

```python
class CommunicationRedundancy:
    """Manages external communication links with failover."""
    
    LINK_PRIORITY = ['5g', 'lte', 'wifi', 'dsrc']
    
    def __init__(self):
        self.links = {
            '5g': CommLink('5g', timeout_ms=200, min_bandwidth_mbps=10),
            'lte': CommLink('lte', timeout_ms=500, min_bandwidth_mbps=1),
            'wifi': CommLink('wifi', timeout_ms=300, min_bandwidth_mbps=5),
            'dsrc': CommLink('dsrc', timeout_ms=100, min_bandwidth_mbps=0.1),
        }
        self.active_link = '5g'
        self.fleet_connected = True
        self.teleop_connected = False
        self.time_since_fleet_contact_s = 0.0
        
    def update(self, dt):
        """Called every cycle. Manages link failover."""
        # Update all link health
        for link in self.links.values():
            link.update_health(dt)
        
        # Find best available link
        best = None
        for name in self.LINK_PRIORITY:
            if self.links[name].is_healthy():
                best = name
                break
        
        if best is None:
            self.fleet_connected = False
            self.time_since_fleet_contact_s += dt
        else:
            if best != self.active_link:
                # Failover
                self.active_link = best
            self.fleet_connected = True
            self.time_since_fleet_contact_s = 0.0
        
        # Determine communication-based operating mode
        return self._determine_mode()
    
    def _determine_mode(self):
        if self.time_since_fleet_contact_s < 5:
            return 'FULL_CONNECTIVITY'
        elif self.time_since_fleet_contact_s < 30:
            return 'REDUCED_CONNECTIVITY'  # Complete current task
        elif self.time_since_fleet_contact_s < 120:
            return 'AUTONOMOUS_FALLBACK'   # Navigate to safe parking
        else:
            return 'COMMUNICATION_LOST'     # Safe stop at current location
```

---

## 10. ASIL Decomposition for Redundancy

### 10.1 ASIL Decomposition Concept

ASIL decomposition (ISO 26262 Part 9) allows splitting a high-ASIL requirement across two independent elements with lower ASIL ratings:

```
ASIL D = ASIL D(D) + ASIL QM(D)    [most aggressive decomposition]
ASIL D = ASIL C(D) + ASIL A(D)
ASIL D = ASIL B(D) + ASIL B(D)     [most balanced]
```

The notation ASIL X(Y) means "developed to ASIL X with independence requirements from ASIL Y." The (D) suffix on all decompositions of ASIL D reflects the stringent independence requirements — even the lower-rated element must demonstrate ASIL D-level freedom from interference.

**Key constraint:** Decomposition requires demonstrated independence. Two elements sharing a common-cause failure path cannot claim independence, regardless of their individual ASIL ratings.

### 10.2 Practical Decomposition for Aurrigo

**Safety Goal: "Vehicle shall not collide with persons" (ASIL D equivalent)**

Decomposition into two independent channels:

```
Channel 1: Neural perception + learned planner (ASIL B(D))
  - Runs on Compute Unit A (Orin)
  - Uses LiDAR array + cameras + radar
  - Neural object detection + world model planning
  - Higher performance but harder to verify
  
Channel 2: Classical perception + Frenet planner (ASIL B(D))
  - Runs on Compute Unit B (Orin)
  - Uses LiDAR subset + radar
  - PointPillars + RANSAC + Frenet sampling
  - Lower performance but fully testable and verifiable
  
Safety Monitor: Arbitrator + Safety Bag (ASIL D)
  - Runs on Safety MCU (STM32H7) + Orin FSI
  - Compares outputs, selects safest command
  - Applies geofence, speed limits, rate limits
  - Simple enough to verify to ASIL D (or PLd)
```

**Why this works:** Neither channel alone needs to achieve ASIL D. The safety monitor ensures that the combination achieves ASIL D-equivalent collision avoidance. If both channels agree on "safe to proceed," the system proceeds. If they disagree, the safety monitor applies the more conservative action. If either channel is silent (crashed/hung), the other takes over.

### 10.3 Independence Requirements

For ASIL D decomposition, ISO 26262 Part 9 requires demonstration of independence in:

1. **Physical separation**: Different PCBs, different power domains, different connectors
2. **Communication independence**: No shared bus that could fail and corrupt both channels
3. **Logical independence**: No shared software libraries or OS kernel modules in the safety path
4. **Temporal independence**: No shared timing resources that could cause both channels to miss deadlines simultaneously
5. **Tool independence**: Ideally, different compilers/build systems for each channel

For the dual-Orin architecture:
- Physical: Separate SoMs on separate carrier boards ✓
- Communication: Safety commands via separate CAN buses ✓ (data shared via Ethernet is non-safety)
- Logical: Different perception/planning stacks ✓ (shared GTSAM localization is a concern — see mitigation below)
- Temporal: Independent real-time schedulers ✓
- Tool: Both use GCC/TensorRT (partial — mitigated by diverse algorithms)

**GTSAM localization shared dependency mitigation:** Both compute units run GTSAM for localization. This is a shared software dependency that could create a common-cause failure. Mitigations:
1. Different GTSAM configurations (different factor graph structures)
2. Unit B has a simplified dead-reckoning fallback (IMU + wheel odometry) that does not use GTSAM
3. Map data is loaded independently on each unit (different file paths, different integrity checks)

---

## 11. Degradation Modes and Graceful Degradation

### 11.1 Degradation State Machine

```
         ┌────────────────────────────────────────────────┐
         │                                                │
         ▼                                                │
    ┌─────────┐     fault      ┌──────────┐    cleared   │
    │ NOMINAL │──────────────→│ DEGRADED_1│────────────────┘
    │ (full)  │                │ (reduced) │
    └─────────┘                └────┬──────┘
                                    │ additional fault
                                    ▼
                               ┌──────────┐    cleared
                               │ DEGRADED_2│──────→ DEGRADED_1
                               │ (minimal) │
                               └────┬──────┘
                                    │ below minimum
                                    ▼
                               ┌──────────┐
                               │ SAFE_STOP│
                               │ (MRC)    │
                               └──────────┘
```

### 11.2 Degradation Matrix

| Subsystem failure | Degradation level | Speed limit | ODD restriction | Max duration |
|-------------------|-------------------|-------------|-----------------|-------------|
| **1 LiDAR lost** | D1 | 20 km/h | None | Until maintenance |
| **1 compute lost** | D1 | 15 km/h | Classical stack only | Current task + return |
| **2 LiDARs lost** | D2 | 10 km/h | Daylight + clear weather | Navigate to depot |
| **GPS lost** | D1 | 15 km/h | Known mapped area only | Until GPS recovered |
| **Radar + camera lost** | D1 | 20 km/h | LiDAR-only mode | Until maintenance |
| **CAN-A bus lost** | D1 | 15 km/h | CAN-B only | Navigate to depot |
| **Both CAN buses degraded** | SAFE_STOP | 0 | Immediate stop | — |
| **Power domain A lost** | D2 | 10 km/h | Cross-feed active | Navigate to depot |
| **Both power domains lost** | SAFE_STOP | 0 | Holdover only | 30-60 seconds |
| **Safety MCU lost** | SAFE_STOP | 0 | Cannot validate commands | Immediate |
| **Steering fault** | SAFE_STOP | 0 | Straight-line brake only | Immediate |
| **Brake system fault** | SAFE_STOP | 0 | Parking brake + regen | Immediate |

### 11.3 Degradation Arbitration Logic

```python
class DegradationArbitrator:
    """Combines subsystem health into overall degradation decision."""
    
    def __init__(self):
        self.subsystems = {
            'compute_a': SubsystemHealth('compute_a', criticality='high'),
            'compute_b': SubsystemHealth('compute_b', criticality='high'),
            'lidar_array': SubsystemHealth('lidar_array', criticality='critical'),
            'radar': SubsystemHealth('radar', criticality='medium'),
            'cameras': SubsystemHealth('cameras', criticality='medium'),
            'imu': SubsystemHealth('imu', criticality='high'),
            'gps': SubsystemHealth('gps', criticality='medium'),
            'can_a': SubsystemHealth('can_a', criticality='critical'),
            'can_b': SubsystemHealth('can_b', criticality='critical'),
            'power_a': SubsystemHealth('power_a', criticality='high'),
            'power_b': SubsystemHealth('power_b', criticality='high'),
            'safety_mcu': SubsystemHealth('safety_mcu', criticality='critical'),
            'steering': SubsystemHealth('steering', criticality='critical'),
            'braking': SubsystemHealth('braking', criticality='critical'),
        }
        
    def compute_overall_state(self):
        """Returns (state, speed_limit, odd_restrictions, explanation)."""
        faults = {name: ss for name, ss in self.subsystems.items() if not ss.is_healthy()}
        
        if not faults:
            return 'NOMINAL', 25.0, [], 'All systems healthy'
        
        # Immediate safe stop conditions (any single one triggers stop)
        safe_stop_conditions = [
            'safety_mcu' in faults,
            'steering' in faults,
            'braking' in faults,
            'can_a' in faults and 'can_b' in faults,
            'power_a' in faults and 'power_b' in faults,
            'compute_a' in faults and 'compute_b' in faults,
        ]
        
        if any(safe_stop_conditions):
            triggered = [desc for cond, desc in zip(safe_stop_conditions, [
                'Safety MCU fault', 'Steering fault', 'Braking fault',
                'Dual CAN failure', 'Dual power failure', 'Dual compute failure'
            ]) if cond]
            return 'SAFE_STOP', 0.0, ['STOP'], f'Critical: {", ".join(triggered)}'
        
        # Count faults by criticality
        critical_faults = sum(1 for f in faults.values() if f.criticality == 'critical')
        high_faults = sum(1 for f in faults.values() if f.criticality == 'high')
        medium_faults = sum(1 for f in faults.values() if f.criticality == 'medium')
        
        # Determine degradation level
        if critical_faults > 0 or high_faults >= 2:
            speed = 10.0
            state = 'DEGRADED_2'
        elif high_faults >= 1 or medium_faults >= 2:
            speed = 15.0
            state = 'DEGRADED_1'
        else:
            speed = 20.0
            state = 'DEGRADED_1'
        
        # Determine ODD restrictions
        restrictions = []
        if 'gps' in faults:
            restrictions.append('MAPPED_AREA_ONLY')
        if 'cameras' in faults:
            restrictions.append('NO_SEMANTIC_DETECTION')
        if 'compute_a' in faults:
            restrictions.append('CLASSICAL_STACK_ONLY')
        
        explanation = f'Faults: {", ".join(faults.keys())}'
        return state, speed, restrictions, explanation
```

---

## 12. Minimal Risk Condition (MRC)

### 12.1 MRC Definition

The Minimal Risk Condition is the state the vehicle reaches after detecting a fault that requires ceasing normal operation. ISO/SAE 4804 defines MRC as "a condition to which a user or an ADS may bring the vehicle to reduce the risk of a crash when a given trip cannot or should not be completed."

For airside operations, MRC is more nuanced than "just stop":

| Scenario | MRC | Rationale |
|----------|-----|-----------|
| On service road | Stop in nearest pull-off area | Don't block active traffic |
| On apron/stand | Stop in current position, hazard lights | Already in controlled area |
| Mid-pushback (connected) | Complete pushback to designated stop point | Abandoning aircraft on taxiway is worse |
| On active taxiway (not connected) | Move to nearest cleared area | Don't block aircraft movements |
| Near runway hold line | Stop immediately, alert tower | Runway incursion prevention paramount |

### 12.2 MRC Planning

The MRC planner is a simplified motion planner that computes a safe trajectory to the nearest MRC location. It must be simpler and more robust than the main planner — it runs on the baseline compute (Unit B) and uses only verified classical algorithms.

```python
class MRCPlanner:
    """Minimal Risk Condition planner.
    
    Uses pre-computed safe-stop locations from the map.
    Falls back to stop-in-place if no safe location reachable.
    """
    
    def __init__(self, map_data):
        # Pre-computed safe stop locations loaded from map
        self.safe_stops = map_data.get_safe_stop_locations()
        self.max_mrc_distance_m = 200.0  # Max distance to navigate for MRC
        self.mrc_speed_limit = 5.0       # m/s — crawl speed during MRC
    
    def plan_mrc(self, vehicle_state, degradation_state):
        """Compute trajectory to nearest MRC location."""
        
        # Find reachable safe stops
        reachable = []
        for stop in self.safe_stops:
            dist = self._distance(vehicle_state.position, stop.position)
            if dist < self.max_mrc_distance_m:
                # Check if route is clear (simplified check using local costmap)
                if self._route_is_clear(vehicle_state.position, stop.position):
                    reachable.append((dist, stop))
        
        if not reachable:
            # No safe stop reachable — stop in place
            return self._stop_in_place(vehicle_state)
        
        # Sort by distance, pick nearest
        reachable.sort(key=lambda x: x[0])
        target = reachable[0][1]
        
        # Generate simple trajectory (straight line + arc if needed)
        trajectory = self._generate_simple_trajectory(
            vehicle_state, target, self.mrc_speed_limit
        )
        
        return trajectory
    
    def _stop_in_place(self, vehicle_state):
        """Emergency stop trajectory — decelerate to zero."""
        traj = Trajectory()
        traj.points = [TrajectoryPoint(
            time_offset=0.0,
            position=vehicle_state.position,
            velocity=0.0,
            acceleration=-2.0,  # Comfortable emergency decel
            heading=vehicle_state.heading
        )]
        return traj
```

### 12.3 Pre-Computed MRC Locations in HD Map

Safe stop locations should be annotated in the HD map as first-class entities:

```yaml
# Example safe stop annotations in Lanelet2 map
safe_stop_locations:
  - id: SS_001
    position: [lat: 51.4523, lon: -1.2341]
    type: pull_off        # pull_off, parking_bay, apron_edge
    capacity: 2           # Number of vehicles
    surface: concrete
    lighting: true
    accessible_from: [lanelet_1042, lanelet_1043]
    restrictions:
      - max_vehicle_length_m: 15
    notes: "Service road pull-off near Gate 14"
  
  - id: SS_002
    position: [lat: 51.4531, lon: -1.2338]
    type: parking_bay
    capacity: 4
    surface: asphalt
    lighting: true
    accessible_from: [lanelet_1050]
    restrictions:
      - max_vehicle_length_m: 20
    notes: "GSE staging area, always available"
```

---

## 13. Runtime Safety Monitoring

### 13.1 Watchdog Architecture

A multi-level watchdog system ensures that stuck or crashed software is detected within bounded time:

```
Level 1: Application Watchdog (software)
  - Each ROS node publishes heartbeat at expected rate
  - Node manager monitors all heartbeats
  - Timeout: 200ms (5Hz minimum)
  - Action: Restart node, log event

Level 2: System Watchdog (OS/kernel)
  - Linux hardware watchdog (/dev/watchdog)
  - Must be kicked by supervisor process
  - Timeout: 1000ms
  - Action: System reboot

Level 3: External Watchdog (safety MCU)
  - Safety MCU expects heartbeat from each compute
  - Independent hardware (STM32), independent power
  - Timeout: 500ms
  - Action: Switch to surviving compute or safe stop

Level 4: Hardware Watchdog (relay)
  - Electromechanical relay, no software
  - Requires periodic pulse from safety MCU
  - Timeout: 2000ms
  - Action: Cut power to drive actuators, apply parking brake
```

```cpp
// Multi-level watchdog implementation for safety MCU (STM32)
class WatchdogManager {
    struct ComputeWatchdog {
        uint32_t last_heartbeat_tick;
        uint32_t timeout_ms;
        bool alive;
        uint32_t miss_count;
    };
    
    ComputeWatchdog compute_a_{0, 500, false, 0};
    ComputeWatchdog compute_b_{0, 500, false, 0};
    
    // Hardware watchdog output — must be toggled or relay opens
    GPIO_Pin hw_watchdog_pin_;
    uint32_t hw_watchdog_interval_ms_ = 500;
    uint32_t last_hw_kick_;
    
public:
    // Called from CAN receive ISR when heartbeat message arrives
    void on_heartbeat(uint8_t compute_id, uint32_t sequence, uint32_t now_tick) {
        auto& wd = (compute_id == 0) ? compute_a_ : compute_b_;
        wd.last_heartbeat_tick = now_tick;
        wd.alive = true;
        wd.miss_count = 0;
    }
    
    // Called from main safety loop at fixed 100Hz rate
    enum class Action { NONE, DEGRADE_A, DEGRADE_B, SAFE_STOP };
    
    Action check(uint32_t now_tick) {
        bool a_ok = check_compute(compute_a_, now_tick);
        bool b_ok = check_compute(compute_b_, now_tick);
        
        // Kick hardware watchdog only if at least one compute alive
        if (a_ok || b_ok) {
            if (now_tick - last_hw_kick_ >= hw_watchdog_interval_ms_) {
                HAL_GPIO_TogglePin(hw_watchdog_pin_);
                last_hw_kick_ = now_tick;
            }
        }
        // If neither compute alive, hardware watchdog will timeout and cut power
        
        if (!a_ok && !b_ok) return Action::SAFE_STOP;
        if (!a_ok) return Action::DEGRADE_A;
        if (!b_ok) return Action::DEGRADE_B;
        return Action::NONE;
    }
    
private:
    bool check_compute(ComputeWatchdog& wd, uint32_t now) {
        if (now - wd.last_heartbeat_tick > wd.timeout_ms) {
            wd.alive = false;
            wd.miss_count++;
            return false;
        }
        return true;
    }
};
```

### 13.2 End-to-End Latency Monitoring

For a fail-operational system, it's not enough that each component works — the end-to-end pipeline must complete within its deadline. A single slow component can cause the entire pipeline to miss its control deadline.

```python
class PipelineLatencyMonitor:
    """Monitors end-to-end perception-to-control latency."""
    
    # Maximum allowed latency from sensor data capture to actuator command
    MAX_E2E_LATENCY_MS = 200.0  # 200ms budget
    
    # Component latency budgets
    BUDGETS_MS = {
        'sensor_acquisition': 10.0,   # LiDAR packet collection
        'preprocessing': 15.0,        # Point cloud assembly, undistortion
        'perception': 50.0,           # Object detection
        'prediction': 30.0,           # Motion prediction
        'planning': 40.0,             # Trajectory planning
        'control': 10.0,              # PID/Stanley output
        'can_transmission': 5.0,      # CAN message to actuator
        'margin': 40.0,               # Safety margin
    }
    
    def __init__(self):
        self.timestamps = {}
        self.latency_history = collections.deque(maxlen=1000)
        self.overrun_count = 0
    
    def record(self, stage, timestamp_ns):
        """Record timestamp for a pipeline stage."""
        self.timestamps[stage] = timestamp_ns
    
    def check_cycle(self):
        """Called at end of each control cycle. Returns (ok, latency_ms, overruns)."""
        if 'sensor_acquisition' not in self.timestamps:
            return False, float('inf'), {'missing': 'sensor_acquisition'}
        if 'can_transmission' not in self.timestamps:
            return False, float('inf'), {'missing': 'can_transmission'}
        
        e2e_ns = self.timestamps['can_transmission'] - self.timestamps['sensor_acquisition']
        e2e_ms = e2e_ns / 1e6
        self.latency_history.append(e2e_ms)
        
        overruns = {}
        stages = list(self.BUDGETS_MS.keys())
        for i in range(len(stages) - 1):
            if stages[i] in self.timestamps and stages[i+1] in self.timestamps:
                stage_ms = (self.timestamps[stages[i+1]] - self.timestamps[stages[i]]) / 1e6
                if stage_ms > self.BUDGETS_MS[stages[i]]:
                    overruns[stages[i]] = stage_ms
        
        ok = e2e_ms <= self.MAX_E2E_LATENCY_MS
        if not ok:
            self.overrun_count += 1
        
        self.timestamps.clear()
        return ok, e2e_ms, overruns
```

---

## 14. Airside-Specific Considerations

### 14.1 Aircraft Proximity Hazards

Unlike road vehicles, airside AVs operate near assets worth $100M-$400M. The consequences of a fail-operational transition failure near an aircraft are orders of magnitude higher than on a road:

| Proximity zone | Distance to aircraft | Fail-operational requirement |
|---------------|---------------------|------------------------------|
| **Red zone** | < 2m (contact possible) | Must complete current operation safely — cannot abort mid-pushback |
| **Orange zone** | 2-10m (collision avoidable) | Immediate safe trajectory away from aircraft |
| **Yellow zone** | 10-50m (approach phase) | Standard fail-degraded, reduce speed |
| **Green zone** | > 50m (transit) | Normal degradation modes apply |

**Key insight:** In the red zone (during pushback or docking), a "safe stop" that abandons the operation may be more dangerous than completing it. The fail-operational architecture must support **operation completion under degraded conditions** as an MRC option.

### 14.2 Jet Blast and De-Icing Effects on Hardware

Jet exhaust and de-icing chemicals create failure modes specific to airside:

- **Jet blast thermal**: Exhaust temperatures 300-600°C at 30m behind large aircraft. Sustained exposure can damage sensor housings, melt plastic connectors, derate electronics.
- **Jet blast debris**: FOD accelerated to dangerous velocities, can crack sensor windows.
- **De-icing fluid**: Type I/IV glycol-based fluids are conductive when wet, corrosive over time. Can infiltrate connectors, cause shorts.
- **Salt/chemical spray**: Winter operations coat sensor windows, degrade visibility.

**Hardware hardening for airside:**
- IP67 minimum for all sensor and compute enclosures (IP69K for washing resistance)
- MIL-spec connectors (Amphenol, TE Deutsch) with environmental sealing
- Conformal coating on all PCBs in the environmental exposure zone
- Sensor heating elements for ice/frost removal (already standard on most LiDARs)
- Redundant sensor cleaning system (washer fluid + air blast)

### 14.3 Runway Incursion Prevention (Safety-Critical)

A vehicle entering an active runway is a catastrophic safety event. This requires the highest integrity safety function, independent of the autonomy stack:

```
GEOFENCE LAYER (hardcoded, not learned):
  - Runway boundaries loaded into Safety MCU at boot
  - GPS + INS position checked against runway polygons at 100Hz
  - Any position within runway buffer zone → immediate e-stop
  - Cannot be overridden by autonomy stack
  - Updated only via authenticated, signed map update
```

This is an example of a safety function that should be implemented entirely on the Safety MCU (or Orin FSI) — not in the main autonomy stack. It is simple enough to formally verify and critical enough to warrant the highest integrity level.

### 14.4 EMI Environment

Airports have intense electromagnetic environments:

| EMI source | Frequency | Effect on vehicle | Mitigation |
|-----------|-----------|-------------------|------------|
| **Airport surveillance radar (ASR)** | 2.7-2.9 GHz | GPS interference, compute upset | Shielding, frequency filtering |
| **ILS localizer** | 108-112 MHz | Minimal (low frequency) | Standard shielding |
| **ILS glideslope** | 329-335 MHz | Minimal | Standard shielding |
| **Ground radar (ASDE-X)** | 24 GHz | 4D radar interference | Frequency separation, filtering |
| **ADS-B transponders** | 1090 MHz | GPS interference (near band) | Bandpass filter on GPS antenna |
| **Comm radios** | 118-137 MHz | Minimal | Standard shielding |
| **De-icing heaters** | Broadband switching noise | CAN bus errors, sensor glitches | Shielded CAN, ferrite cores |

**MIL-STD-461G/DO-160G** testing should be considered for EMI compliance, especially if the vehicle operates near aircraft with active radar or communication systems.

---

## 15. Industry Implementations

### 15.1 Waymo (5th Generation)

Waymo's 5th-generation platform (Jaguar I-PACE) represents the most mature fail-operational architecture publicly documented:

- **Dual compute**: Two independent compute boards, each capable of full L4 driving
- **Redundant sensors**: LiDAR (5x), cameras (29x), radar (6x) — extreme modality and spatial redundancy
- **Redundant steering**: Dual EPS motors on same rack, with independent controllers
- **Redundant braking**: Dual hydraulic circuits + electronic parking brake
- **Redundant power**: Two independent 12V batteries + DC-DC isolated power domains
- **Redundant communication**: LTE + WiFi + dedicated V2X
- **Safe stop**: Can pull over and stop safely on loss of any single system

**Key lesson:** Waymo's approach is belt-and-suspenders redundancy everywhere. This is feasible for a purpose-built robotaxi but expensive. For GSE applications, selective redundancy (focused on the highest-risk functions) is more practical.

### 15.2 Zoox

Zoox (Amazon) built a purpose-built L4 vehicle with bidirectional drive:

- **Four-wheel steering**: Each wheel independently steered — inherent steering redundancy
- **Dual compute**: NVIDIA-based dual compute with diverse software stacks
- **Bidirectional**: Can drive in either direction — if front sensors fail, can reverse to safety
- **Redundant everything**: Dual power, dual communication, redundant actuators

**Key lesson:** Purpose-built vehicles can design in redundancy from the start. Retrofit redundancy (adding redundant systems to an existing platform) is always harder and less reliable.

### 15.3 comma.ai Panda Safety Layer

The most elegant minimal fail-operational design:

- **STM32H725 safety MCU**: 120 lines of safety-critical C code (MISRA compliant, 100% line coverage)
- **Monitors**: Speed, steering torque, gas/brake commands from main compute
- **Actions**: Limits steering torque rate, enforces max speed, blocks dangerous commands
- **Independence**: Completely independent from main compute — different hardware, different software, different power
- **Philosophy**: "If the safety MCU doesn't see valid commands for 1 second, it disengages and returns control to the stock car systems"

**Key lesson for Aurrigo:** The Panda model — a simple, verified safety MCU that gates all actuator commands — is directly applicable. Aurrigo's existing STM32 CAN gateway is the foundation for this approach.

### 15.4 UISEE (Airside Leader)

UISEE's 1,000+ deployed airside vehicles use:

- **Dual compute**: Proprietary SoC-based dual compute
- **Sensor fusion**: LiDAR + camera + ultrasonic (no radar in early deployments)
- **Remote monitoring**: Teleop capability as human fallback
- **Conservative ODD**: 10-15 km/h max speed reduces fail-operational demands
- **Fleet-level redundancy**: If one vehicle faults, fleet manager reroutes tasks to others

**Key lesson:** Low speed is the best safety margin. At 10 km/h, the stopping distance is ~2m with moderate braking. This dramatically relaxes fail-operational timing requirements — you have 720ms to detect a fault and begin braking before traveling 2m.

---

## 16. Aurrigo Integration Recommendations

### 16.1 Current State Assessment

| Component | Current | Gap | Priority |
|-----------|---------|-----|----------|
| **Compute** | Single Orin | No backup compute | **Critical** |
| **Safety MCU** | STM32 CAN gateway | Exists but limited monitoring | High |
| **LiDAR** | 4-8x RoboSense | Good spatial redundancy, single modality | High |
| **Radar** | None | No weather-resilient perception | **Critical** |
| **Camera** | None in perception | No semantic backup | Medium |
| **Steering** | Single EPS | No redundancy | High |
| **Braking** | Hydraulic + parking | Adequate for GSE speeds | Medium |
| **Power** | Single power domain | No redundancy | High |
| **CAN** | Single bus | No bus redundancy | High |
| **Communication** | WiFi + LTE | Basic redundancy | Low |

### 16.2 Phased Implementation Roadmap

**Phase 1: Safety MCU Enhancement (8-12 weeks, $15-25K)**
- Upgrade STM32 firmware to full safety monitor role
- Implement watchdog for Orin (heartbeat, timeout, safe stop)
- Add command validation (safety bag: range, rate, geofence)
- Add CAN bus health monitoring
- Implement hardware watchdog relay for ultimate fallback
- Deliverable: Independent safety layer that can stop the vehicle if Orin dies

**Phase 2: Sensor Modality Diversity (12-16 weeks, $30-50K)**
- Add Continental ARS548 4D radar (2-4 units)
- Add minimum camera suite (2x forward, 2x rear)
- Implement radar-LiDAR fusion (see `cross-cutting/radar-lidar-fusion-adverse-weather.md`)
- Implement sensor health monitoring and degradation tiers
- Deliverable: Weather-resilient perception with graceful degradation

**Phase 3: Dual Compute (16-24 weeks, $50-80K)**
- Add second Orin on separate carrier board with independent power
- Implement classical perception+planning on Unit B (PointPillars + Frenet)
- Implement 1oo2D arbitration between compute units
- Add cross-link for state synchronization (non-safety)
- Deliverable: Full fail-operational compute architecture

**Phase 4: Power and Communication Redundancy (8-12 weeks, $20-35K)**
- Implement dual power domains with diode-OR cross-feed
- Add supercapacitor holdover for safe stop
- Add dual CAN bus topology
- Implement communication failover (5G primary + LTE backup)
- Deliverable: No single power or communication failure stops the vehicle

**Phase 5: Actuator Redundancy (12-20 weeks, $40-70K)**
- Vehicle-specific: depends on ADT3/STL2/POD platform
- Dual EPS motor or backup steering actuator
- Brake system enhancement (if needed beyond current)
- Redundant drive motor controller
- Deliverable: No single actuator failure causes loss of control

**Total estimated investment: $155-260K over 56-84 weeks**

### 16.3 Quick Wins (Immediate, Low Cost)

These can be implemented immediately with existing hardware:

1. **Orin FSI activation**: Enable and configure the Functional Safety Island on existing Orin. Run safety bag checks on FSI lockstep cores. Cost: engineering time only.

2. **Software watchdog hardening**: Implement per-node heartbeat monitoring in existing ROS stack. Kill and restart crashed nodes automatically. Cost: engineering time only.

3. **Geofence on Safety MCU**: Load runway exclusion zones into STM32 flash. Check GPS position against geofence at 100Hz, independent of main stack. Cost: engineering time + GPS feed to STM32.

4. **Pre-compute MRC locations**: Annotate safe stop locations in existing Lanelet2 maps. Implement simple MRC planner that routes to nearest safe stop. Cost: engineering time + map annotation effort.

5. **Pipeline latency monitoring**: Instrument end-to-end latency from sensor capture to actuator command. Alert on overruns. Cost: engineering time only.

---

## 17. Key Takeaways

1. **Fail-operational ≠ fail-safe**: Level 4 autonomy cannot just stop on failure — it must continue operating safely long enough to reach an MRC. For airside, this is especially critical during pushback operations where stopping creates new hazards.

2. **Diverse redundancy defeats common-cause failures**: Two identical systems fail together. Diverse computation (neural + classical), diverse sensors (LiDAR + radar + camera), and diverse power paths are required for ASIL D-equivalent safety.

3. **ASIL decomposition enables practical architecture**: Rather than developing everything to ASIL D, decompose into two ASIL B(D) channels monitored by an ASIL D safety layer. This is the Simplex architecture mapped to hardware.

4. **The safety MCU is the most important component**: A simple, verified, independent safety monitor (STM32 or Orin FSI) that can stop the vehicle regardless of main compute state is the foundation of fail-operational design. comma.ai proved this with 120 lines of safety-critical C.

5. **NVIDIA Orin FSI provides on-chip fail-operational capability**: The 4x DCLS R52 cores at ~10K ASIL D MIPS can run safety bag checks, watchdog monitoring, and geofencing independently of the GPU/CPU complex. This is available now on existing Aurrigo hardware.

6. **Sensor modality diversity is more important than sensor count**: 8 LiDARs provide excellent spatial redundancy but zero weather diversity. Adding even 2 radar units creates a qualitatively different safety argument.

7. **Power redundancy is the most overlooked failure mode**: A single fuse or DC-DC converter failure can take down the entire autonomy stack. Dual power domains with diode-OR cross-feed should be Phase 1 of any fail-operational upgrade.

8. **Low speed is the best safety margin**: At 10 km/h, stopping distance is ~2m and the fail-operational timing budget is 10x more relaxed than highway driving. Airside GSE speeds naturally provide this advantage.

9. **MRC planning requires map integration**: Safe stop locations must be first-class entities in the HD map, pre-computed and loaded into both compute units. The MRC planner must be simpler and more robust than the main planner.

10. **Runway incursion prevention must be hardware-enforced**: GPS-based geofencing on the safety MCU, independent of the autonomy stack, is a non-negotiable safety function for airside operations.

11. **Phase 1 should be Safety MCU enhancement**: Before adding expensive redundant hardware, maximize the value of the existing STM32 safety gateway by upgrading it to a full safety monitor with watchdog, safety bag, and geofencing.

12. **Dual-compute is the highest-value hardware investment**: A second Orin running a diverse classical stack provides fail-operational compute capability and naturally implements the Simplex architecture at the hardware level.

13. **Spring-applied brakes provide inherent fail-safe**: SAHR brakes (ISO 3691-4 requirement for parking brake) mean any total power loss results in immediate braking — the safest possible failure mode.

14. **Airport EMI environment requires hardware hardening**: ASR radar, ILS, ADS-B, and de-icing equipment create intense EMI. MIL-STD-461G/DO-160G testing should be part of the vehicle qualification program.

15. **UISEE's fleet-level redundancy is a practical model**: Rather than making each vehicle individually bulletproof, use fleet management to redistribute tasks when any vehicle enters degraded mode. This amortizes redundancy cost across the fleet.

---

## 18. References

### Internal Repository
- `operations/safety/functional-safety-software.md` — ISO 26262 Part 6, MISRA C, software safety patterns
- `operations/safety/simplex-safety-architecture.md` — Dual-stack Simplex architecture for ROS
- `operations/safety/safety-verification-certification.md` — Formal verification, RSS, certification
- `operations/safety/testing-validation-methodology.md` — V&V methodology, scenario testing
- `operations/safety/certification-guide.md` — ISO 3691-4 certification process ($130K-380K)
- `operations/safety/weather-adaptive-odd-management.md` — ODD management under weather conditions
- `hardware/sensors/sensor-degradation-health-monitoring.md` — Per-sensor health diagnostics
- `cross-cutting/radar-lidar-fusion-adverse-weather.md` — Radar-LiDAR fusion for weather resilience
- `hardware/compute/nvidia-drive-thor.md` — Thor compute platform specs
- `hardware/vehicle/can-bus-dbw.md` — CAN bus and drive-by-wire fundamentals
- `technology/planning/safety-critical-planning-cbf.md` — Control barrier functions for safety

### External
- ISO 26262:2018 Parts 1-12, "Road vehicles — Functional safety"
- ISO 3691-4:2023, "Industrial trucks — Safety requirements and verification — Part 4: Driverless industrial trucks"
- ISO 13849-1:2023, "Safety of machinery — Safety-related parts of control systems"
- ISO/SAE 4804:2024, "Road vehicles — Safety and cybersecurity for automated driving systems — Design, verification and validation"
- IEC 61508:2010, "Functional safety of electrical/electronic/programmable electronic safety-related systems"
- NVIDIA, "Functional Safety Island (FSI)" documentation, developer.nvidia.com
- Elektrobit, "Software for Fail-Operational Systems in Autonomous Vehicles," elektrobit.com/blog
- Sha, L. et al. (2001). "Using Simplicity to Control Complexity." IEEE Software.
- Boubakri, A. (2021). "A New Architecture of Autonomous Vehicles: Redundant Architecture to Improve Operational Safety." IJRCS.
- SafeAutonomy Blog (2025). "Safety Architecture & Redundancy Patterns." safeautonomy.blogspot.com
- NVIDIA (2018). "World's First Functionally Safe AI Self-Driving Platform." NVIDIA Newsroom.
- ARM, "Prototype safety-critical isolation for autonomous driving systems on Neoverse." learn.arm.com
