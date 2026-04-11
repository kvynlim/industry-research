# Runtime Verification and Safety Monitoring for Autonomous Vehicles

## Formal Monitors, OOD Detection, Shield Synthesis, and Fleet-Scale Health Monitoring for Airport Airside Operations

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Runtime verification (RV) is the missing bridge between offline testing (which can never cover all scenarios) and formal static verification (which cannot scale to neural-network-based AV stacks). By synthesizing monitors from temporal logic specifications, deploying calibrated OOD detectors, enforcing safety via reactive shields, and continuously assessing ODD compliance, the Aurrigo airside AV stack gains a mathematically grounded, always-on safety net that operates at <2 ms latency and <5% CPU overhead per monitor. Combined with the existing Simplex architecture, CBF safety filters, and Frenet fallback planner, runtime verification provides the fourth layer of defense-in-depth -- and the certification evidence that standards (ISO 26262, UL 4600, DO-178C) increasingly demand.

---

## Table of Contents

1. [Runtime Verification Fundamentals](#1-runtime-verification-fundamentals)
2. [Signal Temporal Logic (STL) for AV Monitoring](#2-signal-temporal-logic-stl-for-av-monitoring)
3. [Out-of-Distribution (OOD) Detection](#3-out-of-distribution-ood-detection)
4. [Shield Synthesis and Reactive Safety](#4-shield-synthesis-and-reactive-safety)
5. [Anomaly Detection and Health Monitoring](#5-anomaly-detection-and-health-monitoring)
6. [Safety Envelope and ODD Monitoring](#6-safety-envelope-and-odd-monitoring)
7. [Architecture Patterns](#7-architecture-patterns)
8. [Standards and Certification](#8-standards-and-certification)
9. [Practical Implementation](#9-practical-implementation)
10. [Key Takeaways](#10-key-takeaways)
11. [References](#11-references)

---

## 1. Runtime Verification Fundamentals

### 1.1 What is Runtime Verification

Runtime verification (RV) is a lightweight, dynamic analysis technique that checks whether a single execution trace of a system satisfies or violates a given formal specification. It sits between exhaustive formal verification (model checking, theorem proving) and traditional testing:

| Approach | Soundness | Completeness | Scalability | When Applied | Cost |
|----------|-----------|-------------|-------------|-------------|------|
| **Model checking** | Sound | Complete (for finite models) | Exponential state space | Design time | High |
| **Theorem proving** | Sound | Complete (with user guidance) | Manual effort scales poorly | Design time | Very high |
| **Static analysis** | Sound (over-approximates) | Incomplete | Polynomial, practical | Build time | Medium |
| **Testing** | Unsound (only covers tested inputs) | Incomplete | Linear in test count | Test time | Medium |
| **Runtime verification** | Sound for observed trace | Incomplete (one trace) | Linear in trace length | Runtime | Low |

Runtime verification is **sound** in the following sense: if the monitor reports a violation, the violation genuinely occurred. It is **incomplete** because it can only judge the current execution -- it says nothing about future executions or unexplored paths. But for safety-critical autonomous vehicles, this is precisely the right tradeoff: we need a guarantee that the system is behaving safely *right now*, every cycle, at runtime.

**Formal definition.** Given a system trace sigma = s_0, s_1, s_2, ... (a sequence of system states over time) and a formal specification phi (expressed in temporal logic), a runtime monitor M is a function:

```
M(sigma, phi) -> {True, False, Inconclusive}
```

where:
- `True` means phi is satisfied on the observed trace (for safety properties, this means "so far, no violation")
- `False` means phi is violated on the observed trace
- `Inconclusive` means the trace so far is consistent with both satisfaction and violation (applies to liveness properties)

For **safety properties** (which are the primary concern for airside AVs), the monitor never returns Inconclusive. If a safety property is violated, the violation is detected immediately and irrevocably. This is the "monitorability" result from Pnueli and Zaks (2006): all safety properties are monitorable.

### 1.2 Runtime Verification vs Testing vs Static Analysis

Understanding where RV fits in the verification landscape is critical for building a certification-ready safety case:

| Dimension | Runtime Verification | Testing | Static Analysis |
|-----------|---------------------|---------|-----------------|
| **Input coverage** | Every actual input the system encounters in deployment | Finite set of designed test inputs | All possible inputs (via abstraction) |
| **Property types** | Temporal properties over traces (always, eventually, until) | Pass/fail on individual test cases | Coding standards, absence of undefined behavior |
| **Neural network compatible** | Yes -- monitors the I/O behavior, not the internals | Yes -- but exponential input space | Extremely limited (nn-verify, alpha-beta-CROWN for small nets only) |
| **Deployment phase** | Production | Pre-deployment | Build/CI |
| **Overhead** | 0.5-5% CPU, 0.1-2 ms per monitor evaluation | Zero at runtime | Zero at runtime |
| **Evidence for certification** | Continuous compliance evidence | Test reports (finite) | Analysis reports (finite) |
| **Detects novel failures** | Yes -- any violation of the spec, including unforeseen causes | No -- only failures triggered by test inputs | Partially -- depends on analysis rules |

**The key insight for airside AVs:** Testing covers the 99% of scenarios you anticipated. Static analysis catches coding bugs. Runtime verification catches the 1% of deployment-time situations that were never tested -- including the novel aircraft type, the unexpected de-icing foam pattern, and the construction zone that appeared after the last map update.

### 1.3 Monitor Synthesis from Temporal Logic Specifications

The process of going from a human-readable safety requirement to a running monitor follows a well-established pipeline:

```
Natural Language Requirement
   "The vehicle must always maintain at least 3m from any aircraft"
        │
        ▼
Formal Specification (STL)
   G[0,inf] (d_aircraft >= 3.0)
        │
        ▼
Monitor Synthesis (automaton construction)
   Deterministic finite automaton / streaming algorithm
        │
        ▼
Code Generation (C++/Python)
   ROS node subscribing to perception and localization topics
        │
        ▼
Deployed Monitor
   Running at 10-50 Hz, publishing violation/robustness on /safety_monitor/*
```

**Automaton-based synthesis** (Bauer et al., 2011): The temporal logic formula is compiled into a deterministic finite automaton (DFA) or alternating automaton. The automaton processes system events one at a time. Each transition corresponds to a system state satisfying or violating a sub-formula. The automaton's current state encodes the monitor verdict. For safety properties over finite traces, the resulting DFA has at most `2^|phi|` states, where `|phi|` is the formula size. In practice, monitors for typical AV safety specs have 5-50 states and evaluate in microseconds.

**Rewriting-based synthesis** (Havelund and Rosu, 2004): Instead of explicit automaton construction, the specification formula is progressively rewritten as events arrive. At each step, the formula is simplified based on the observed event. If the formula reduces to `True`, the property is satisfied for the observed prefix. If it reduces to `False`, the property is violated. This approach avoids explicit automaton construction and can handle rich data types (e.g., floating-point distances, object lists).

### 1.4 Online vs Offline Monitoring

| Aspect | Online Monitoring | Offline Monitoring |
|--------|-------------------|-------------------|
| **When** | During execution, in real time | After execution, on logged traces |
| **Input** | Streaming events from running system | Complete log files (rosbag, CSV) |
| **Latency requirement** | <2 ms per evaluation | None |
| **Action on violation** | Trigger safety response (stop, degrade, fallback) | Generate report, flag for review |
| **Resource constraints** | Must fit in CPU/memory budget | Unlimited compute |
| **Use case** | Safety enforcement, ODD monitoring | Regression testing, fleet analytics, certification evidence |
| **Airside use** | Real-time geofence, speed, proximity monitoring | Shadow mode analysis, incident reconstruction |

For airside AVs, **both** paradigms are needed:

1. **Online monitors** run on the vehicle at 10-50 Hz. They enforce hard safety constraints (aircraft clearance, speed limits, geofence) and trigger Simplex fallback or controlled stop on violation. These must be fast (<2 ms), deterministic, and independent of the neural perception/planning stack.

2. **Offline monitors** run in the cloud on collected rosbag data. They evaluate a much larger set of softer properties (trajectory smoothness, prediction accuracy, fleet coordination), generate certification evidence, and identify systematic patterns across the fleet.

### 1.5 Complexity and Overhead Considerations

Monitor complexity determines whether it can run online:

| Logic Fragment | Monitor State Size | Time per Event | Memory | Online Feasible? |
|---------------|-------------------|----------------|--------|-----------------|
| **Propositional safety** (always p) | O(1) | O(1) | O(1) | Yes |
| **Bounded LTL** (G[0,T] p) | O(T) | O(1) | O(T) | Yes, if T is bounded |
| **Past LTL** (historically p) | O(|phi|) | O(|phi|) | O(|phi|) | Yes |
| **Future LTL** (globally, eventually) | O(2^|phi|) | O(2^|phi|) | O(2^|phi|) | Yes, if |phi| is small |
| **STL with quantitative semantics** | O(T * |phi|) | O(|phi|) | O(T) | Yes, with sliding window |
| **First-order LTL** (forall objects) | O(N * 2^|phi|) | O(N * |phi|) | O(N * |phi|) | Yes, for bounded N |
| **Hyperproperties** (comparing traces) | O(n^k) for k traces | O(n^k) | Exponential | Offline only |

For airside AV monitoring, the practical formulas are bounded temporal properties over a finite set of tracked objects (typically N < 100). This means each monitor evaluates in O(N * |phi|) time per cycle -- for |phi| ~ 10 and N ~ 50, that is ~500 operations, well under 1 microsecond on modern hardware.

**Measured overhead on Orin AGX (Jetson Orin, 12-core ARM A78AE):**

| Monitor Type | Per-Evaluation Time | CPU Usage (at 50 Hz) | Memory |
|-------------|--------------------|-----------------------|--------|
| Single STL safety spec | 5-50 us | <0.1% | <1 MB |
| 20 concurrent STL specs | 0.1-1 ms | 0.5-2% | <5 MB |
| OOD detector (Mahalanobis) | 0.5-1.5 ms | 2-4% | 10-50 MB |
| Conformal prediction wrapper | 0.1-0.5 ms | 0.5-1% | 5-20 MB |
| Shield enforcer (DFA) | 10-100 us | <0.5% | <2 MB |
| Full monitoring suite (all above) | 1-3 ms | 3-7% | 20-80 MB |

These are within the <5% CPU and <2 ms per-monitor budgets required for real-time operation.

---

## 2. Signal Temporal Logic (STL) for AV Monitoring

### 2.1 STL Syntax

Signal Temporal Logic (STL) extends propositional logic with quantitative temporal operators over continuous-valued signals. It is the natural specification language for autonomous vehicle safety properties, because AV states are continuous (position, velocity, distance) rather than discrete.

**Syntax:**

```
phi ::= mu                          -- atomic predicate (e.g., speed < 8.3)
      | not phi                     -- negation
      | phi_1 and phi_2             -- conjunction
      | phi_1 or phi_2              -- disjunction
      | G[a,b] phi                  -- globally (always) during [a,b]
      | F[a,b] phi                  -- eventually (sometime) during [a,b]
      | phi_1 U[a,b] phi_2         -- phi_1 until phi_2 during [a,b]
```

where:
- `mu` is a predicate over signal values: `f(s(t)) ~ 0` with `~` in {<, <=, >, >=}
- `s(t)` is the system signal at time t (e.g., ego velocity, distance to nearest aircraft)
- `[a,b]` are time bounds (a, b >= 0, a <= b), with `[0,inf]` meaning "for all future time"

**Derived operators:**
- `F[a,b] phi  =  True U[a,b] phi` (eventually phi becomes true within [a,b])
- `G[a,b] phi  =  not F[a,b] (not phi)` (phi holds throughout [a,b])

### 2.2 Quantitative Semantics: Robustness Degree

The critical feature of STL over LTL is **quantitative semantics**. Instead of a binary True/False verdict, STL assigns a real-valued **robustness degree** rho(phi, s, t) that measures "how strongly" the specification is satisfied or violated:

```
rho(mu, s, t)           = f(s(t))                        -- for predicate mu: f(s(t)) >= 0
rho(not phi, s, t)      = -rho(phi, s, t)
rho(phi_1 and phi_2, s, t) = min(rho(phi_1, s, t), rho(phi_2, s, t))
rho(phi_1 or phi_2, s, t)  = max(rho(phi_1, s, t), rho(phi_2, s, t))
rho(G[a,b] phi, s, t)  = min_{t' in [t+a, t+b]} rho(phi, s, t')
rho(F[a,b] phi, s, t)  = max_{t' in [t+a, t+b]} rho(phi, s, t')
rho(phi_1 U[a,b] phi_2, s, t) = max_{t' in [t+a, t+b]}
    min(rho(phi_2, s, t'), min_{t'' in [t, t']} rho(phi_1, s, t''))
```

**Interpretation:**
- `rho > 0`: specification is satisfied, and rho quantifies the safety margin
- `rho = 0`: specification is exactly at the boundary
- `rho < 0`: specification is violated, and |rho| quantifies the severity

**Example:**

```
phi = G[0,T] (d_aircraft >= 3.0)

If the minimum aircraft distance over [0,T] is 4.2m:
  rho = 4.2 - 3.0 = 1.2  (satisfied, 1.2m margin)

If the minimum aircraft distance is 2.5m:
  rho = 2.5 - 3.0 = -0.5  (violated by 0.5m)
```

The robustness degree is a powerful safety metric because it is:
1. **Quantitative**: not just safe/unsafe, but "how safe" -- critical for graceful degradation
2. **Differentiable**: can be used as a loss function for training neural planners (Leung et al., 2023)
3. **Composable**: robustness of a conjunction is the minimum of component robustnesses, making it easy to identify the weakest constraint
4. **Monotonic**: if rho(phi, s, t) > 0, then phi is satisfied (soundness of quantitative semantics, Fainekos and Pappas, 2009)

### 2.3 STL Specifications for Driving

Standard AV safety specifications formalized in STL:

| Safety Property | STL Specification | Robustness Interpretation |
|----------------|-------------------|--------------------------|
| Safe following distance | `G[0,T] (d_front >= v_ego * tau + d_min)` | Margin in meters above safe distance |
| Speed limit compliance | `G[0,T] (v_ego <= v_max)` | How far below speed limit (m/s) |
| Lane keeping | `G[0,T] (abs(lat_offset) <= w_lane/2)` | Lateral margin to lane boundary (m) |
| Collision avoidance | `G[0,T] (d_nearest_obj >= d_safe)` | Distance margin to nearest object (m) |
| Smooth braking | `G[0,T] (a_ego >= -a_max_decel)` | Margin above maximum deceleration (m/s^2) |
| Comfortable ride | `G[0,T] (abs(jerk) <= j_max)` | Jerk margin (m/s^3) |
| Response time | `G[0,T] (obstacle_detected => F[0,tau_max] braking_initiated)` | Time margin for braking response (s) |
| Stop at intersection | `(approaching_intersection) => F[0,T_stop] (v_ego == 0)` | Time margin to full stop (s) |

### 2.4 Airside-Specific STL Specifications

These specifications encode the unique safety constraints of airport apron operations. They reference parameters defined in [simplex-safety-architecture.md](simplex-safety-architecture.md) and [airside-scenario-taxonomy.md](airside-scenario-taxonomy.md).

#### 2.4.1 Aircraft Proximity

```
# phi_aircraft: Always maintain safe distance from all aircraft
# Asymmetric zones: 5m from nose/intake, 3m from wing/fuselage, 50m from engine exhaust
# (See safety-critical-planning-cbf.md for CBF equivalents)

phi_aircraft_wing    = G[0,inf] (forall a in Aircraft: d_wing(ego, a)    >= 3.0)
phi_aircraft_nose    = G[0,inf] (forall a in Aircraft: d_nose(ego, a)    >= 5.0)
phi_aircraft_exhaust = G[0,inf] (forall a in Aircraft: d_exhaust(ego, a) >= 50.0)

# Combined specification:
phi_aircraft = phi_aircraft_wing AND phi_aircraft_nose AND phi_aircraft_exhaust

# Robustness: rho = min over all aircraft of (d_actual - d_required)
# If rho < 2.0m, trigger warning; if rho < 0.5m, trigger emergency stop
```

#### 2.4.2 Speed Limits by Zone

```
# phi_speed: Zone-dependent speed limits
# Open apron: 30 km/h (8.3 m/s)
# Near aircraft (<20m): 10 km/h (2.8 m/s)
# Near personnel (<10m): 5 km/h (1.4 m/s)
# Loading zone: 3 km/h (0.8 m/s)

phi_speed_open     = G[0,inf] (zone == OPEN_APRON   => v_ego <= 8.3)
phi_speed_aircraft = G[0,inf] (zone == NEAR_AIRCRAFT => v_ego <= 2.8)
phi_speed_personnel= G[0,inf] (zone == NEAR_PERSONNEL=> v_ego <= 1.4)
phi_speed_loading  = G[0,inf] (zone == LOADING_ZONE  => v_ego <= 0.8)

phi_speed = phi_speed_open AND phi_speed_aircraft AND phi_speed_personnel AND phi_speed_loading

# Robustness: rho = v_max_zone - v_ego (positive means compliant)
```

#### 2.4.3 Geofence Compliance

```
# phi_geofence: Vehicle remains within authorized operating area
# Geofence encoded as a signed distance function (SDF) from boundary

phi_geofence      = G[0,inf] (sdf_boundary(ego_pos) >= 0)
phi_no_runway      = G[0,inf] (sdf_runway(ego_pos) >= 5.0)   # 5m buffer from runway edge
phi_restricted     = G[0,inf] (forall z in restricted_zones: sdf_zone(ego_pos, z) >= 0)

phi_boundary = phi_geofence AND phi_no_runway AND phi_restricted

# Robustness: rho = signed distance to boundary (positive = inside authorized area)
```

#### 2.4.4 Runway Incursion Prevention

```
# phi_runway: Hard wall — never enter active runway area
# Two-level defense: soft warning at 20m, hard stop at 5m

phi_runway_warn = G[0,inf] (d_runway_edge < 20.0 => v_ego <= 2.0)
phi_runway_hard = G[0,inf] (d_runway_edge >= 5.0)

# Combined with temporal response:
phi_runway_response = G[0,inf] (
    d_runway_edge < 20.0 => F[0, 2.0] (v_ego <= 2.0 OR d_runway_edge >= 20.0)
)
```

#### 2.4.5 Jet Blast Avoidance

```
# phi_jetblast: Avoid jet blast zones (dynamic, depends on engine status)
# Jet blast model: cone extending from engine, length depends on thrust setting
# See ../airside/fod-and-jetblast.md for jet blast zone geometry

phi_jetblast = G[0,inf] (
    forall a in Aircraft:
        (a.engines_running AND a.thrust > idle) =>
            d_jetblast_cone(ego, a) >= 10.0
)

# During takeoff thrust: cone extends 200m+, clearance zone is absolute
phi_jetblast_takeoff = G[0,inf] (
    forall a in Aircraft:
        a.thrust == takeoff => d_jetblast_axis(ego, a) >= 200.0
)
```

#### 2.4.6 Personnel Safety

```
# phi_personnel: Velocity-dependent clearance from ground crew
# At 10 km/h: 3m clearance. At 5 km/h: 2m. At 1 km/h: 1m (docking)
# Matches RSS parameters in simplex-safety-architecture.md

phi_personnel = G[0,inf] (
    forall p in Personnel:
        d(ego, p) >= max(1.0, 0.36 * v_ego + 0.5)
)

# Additional: if personnel detected within 5m, reduce speed within 1s
phi_personnel_slowdown = G[0,inf] (
    (exists p in Personnel: d(ego, p) < 5.0) =>
        F[0, 1.0] (v_ego <= 1.4)
)
```

#### 2.4.7 Emergency Vehicle Priority

```
# phi_emergency: Yield to emergency vehicles within 100m
phi_emergency = G[0,inf] (
    (exists e in EmergencyVehicles: d(ego, e) < 100.0) =>
        F[0, 3.0] (v_ego == 0 AND pulled_over)
)
```

### 2.5 Efficient Online STL Monitoring Algorithms

Naive STL evaluation requires storing the entire signal history and recomputing robustness over the full time window at each step. For online monitoring, we need streaming algorithms:

#### 2.5.1 Dynamic Programming Approach (Donze and Maler, 2010)

For bounded-time STL (all temporal operators have finite bounds [a,b]), the robustness can be computed incrementally using dynamic programming:

```python
class STLMonitor:
    """Online STL monitor using DP-based incremental evaluation."""

    def __init__(self, horizon_T: float, dt: float):
        self.horizon_T = horizon_T
        self.dt = dt
        self.buffer_size = int(horizon_T / dt) + 1
        self.signal_buffer = collections.deque(maxlen=self.buffer_size)
        self.robustness_history = collections.deque(maxlen=self.buffer_size)

    def update(self, signal_values: dict) -> float:
        """Process one timestep, return current robustness."""
        self.signal_buffer.append(signal_values)

        # Evaluate atomic predicates at current time
        atomic_robustness = self._eval_atomic(signal_values)

        # For G[0,T] phi: robustness is running minimum over window
        # Use sliding window minimum algorithm (O(1) amortized)
        self.robustness_history.append(atomic_robustness)

        # Sliding window minimum using monotonic deque
        rho = self._sliding_min(self.robustness_history, self.buffer_size)
        return rho

    def _eval_atomic(self, values: dict) -> float:
        """Evaluate atomic predicate robustness."""
        # Example: d_aircraft >= 3.0  =>  rho = d_aircraft - 3.0
        raise NotImplementedError("Override for specific spec")

    def _sliding_min(self, data, window_size):
        """O(1) amortized sliding window minimum using monotonic deque."""
        # Implements the classic algorithm from (Lemire, 2006)
        # Maintains a deque of indices where values are non-decreasing
        # Front of deque is always the minimum of the current window
        if not hasattr(self, '_min_deque'):
            self._min_deque = collections.deque()
            self._min_idx = 0

        val = data[-1]
        idx = len(data) - 1

        # Remove elements larger than current from back
        while self._min_deque and data[self._min_deque[-1]] >= val:
            self._min_deque.pop()
        self._min_deque.append(idx)

        # Remove elements outside window from front
        while self._min_deque[0] <= idx - window_size:
            self._min_deque.popleft()

        return data[self._min_deque[0]]
```

**Complexity:** O(1) amortized per timestep for `G[0,T]` and `F[0,T]` using sliding window min/max. O(|phi|) per timestep for arbitrary bounded STL formulas.

#### 2.5.2 Incremental Monitoring (Deshmukh et al., 2017)

For nested temporal operators (e.g., `G[0,10] F[0,5] phi`), the DP approach extends to a multi-pass algorithm. Each temporal operator layer maintains its own sliding window:

```python
class NestedSTLMonitor:
    """Monitor for nested STL: G[0,T1] F[0,T2] (d >= threshold)."""

    def __init__(self, T1: float, T2: float, threshold: float, dt: float):
        self.inner_window = int(T2 / dt) + 1  # F[0,T2]
        self.outer_window = int(T1 / dt) + 1  # G[0,T1]
        self.threshold = threshold
        self.dt = dt

        # Inner layer: sliding max (for F = eventually)
        self.inner_buffer = collections.deque(maxlen=self.inner_window)
        self.inner_max_deque = collections.deque()

        # Outer layer: sliding min (for G = always)
        self.outer_buffer = collections.deque(maxlen=self.outer_window)
        self.outer_min_deque = collections.deque()

        self.step = 0

    def update(self, d_value: float) -> float:
        """Process one sample, return robustness of G[0,T1] F[0,T2] (d >= threshold)."""
        # Atomic robustness
        rho_atomic = d_value - self.threshold

        # Inner layer: F[0,T2] => sliding maximum
        self.inner_buffer.append(rho_atomic)
        while self.inner_max_deque and self.inner_buffer[self.inner_max_deque[-1] - max(0, self.step - self.inner_window + 1)] <= rho_atomic:
            self.inner_max_deque.pop()
        self.inner_max_deque.append(self.step)
        while self.inner_max_deque[0] <= self.step - self.inner_window:
            self.inner_max_deque.popleft()

        rho_inner = self.inner_buffer[self.inner_max_deque[0] - max(0, self.step - self.inner_window + 1)]

        # Outer layer: G[0,T1] => sliding minimum
        self.outer_buffer.append(rho_inner)
        while self.outer_min_deque and self.outer_buffer[self.outer_min_deque[-1] - max(0, self.step - self.outer_window - self.inner_window + 2)] <= rho_inner:
            self.outer_min_deque.pop()
        self.outer_min_deque.append(self.step)
        while self.outer_min_deque[0] <= self.step - self.outer_window:
            self.outer_min_deque.popleft()

        rho_outer = self.outer_buffer[self.outer_min_deque[0] - max(0, self.step - self.outer_window - self.inner_window + 2)]

        self.step += 1
        return rho_outer
```

### 2.6 STL Monitoring Tools

| Tool | Language | Online Support | Quantitative Semantics | ROS Integration | License | Notes |
|------|----------|---------------|----------------------|-----------------|---------|-------|
| **Breach** (Donze, 2010) | MATLAB/C++ | Yes (recent versions) | Yes (robustness) | No (needs wrapper) | BSD | Most cited STL tool, mature. Used in Simulink MIL/SIL |
| **S-TaLiRo** (Annpureddy et al., 2011) | MATLAB | Partial | Yes | No | GPL | Focused on falsification (finding counterexamples), not monitoring |
| **RTAMT** (Nickovic et al., 2020) | Python/C++ | Yes | Yes (robustness, both past and future) | Easy (Python bindings) | Apache 2.0 | **Best choice for ROS Noetic integration.** Lightweight, well-documented |
| **Moonlight** (Bartocci et al., 2022) | Java/Kotlin | Yes | Yes (spatio-temporal) | Via rosbridge | Apache 2.0 | Handles spatial STL (for fleet-level properties) |
| **STLInspector** (Hoxha et al., 2018) | Python | Offline only | Yes | Easy | MIT | Good for offline rosbag analysis |
| **py-metric-temporal-logic** | Python | Partial | Yes | Easy | MIT | Minimalist, pure Python. Good for prototyping |
| **Reelay** (Ulus, 2019) | C++/Python | Yes | Yes (past-time) | C++ bindings for nodelets | MIT | Very fast past-time monitoring |

**Recommendation for Aurrigo:** Use **RTAMT** for online monitoring (Python, direct ROS integration, quantitative robustness, Apache 2.0 license) and **Breach** for offline analysis (MATLAB, industry standard, mature falsification support).

### 2.7 Robustness as a Safety Margin Metric

The STL robustness degree is not just a monitoring verdict -- it is a continuous, composable safety metric that can drive the entire safety architecture:

```
Safety State Machine (driven by robustness):

rho >= 5.0m    →  NORMAL OPERATION (full autonomy)
2.0 <= rho < 5.0  →  CAUTION (log, increase monitoring frequency to 50 Hz)
0.5 <= rho < 2.0  →  WARNING (reduce speed, alert operator, prepare fallback)
0.0 <= rho < 0.5  →  CRITICAL (engage Simplex fallback to Frenet planner)
rho < 0.0      →  VIOLATION (controlled stop, log incident, require operator clearance)
```

**Integration with Simplex:** The robustness degree from STL monitors feeds directly into the arbitrator node's decision logic (see [simplex-safety-architecture.md](simplex-safety-architecture.md)). When the minimum robustness across all active specs drops below the fallback threshold (e.g., 0.5m), the arbitrator switches from the neural AC stack to the classical BC stack. This provides a formally grounded trigger for Simplex transitions, replacing the ad-hoc OOD score thresholds currently in the arbitrator.

**Integration with CBFs:** The STL robustness is complementary to CBF safety constraints (see [safety-critical-planning-cbf.md](../safety/../../technology/planning/safety-critical-planning-cbf.md)). CBFs enforce forward invariance of the safe set at the control level (100-200 Hz). STL monitors verify that the overall system behavior satisfies temporal properties at the monitoring level (10-50 Hz). CBFs prevent entering the unsafe region; STL monitors detect if the system is approaching the boundary.

```
Temporal scope comparison:
  CBF:  Instantaneous constraint (dh/dt >= -alpha(h))  →  "Am I safe RIGHT NOW?"
  STL:  Bounded temporal property (G[0,T] phi)          →  "Have I been safe over [0,T]?"
  RV:   Prefix evaluation (sigma |= phi so far?)        →  "Has the trace been safe SO FAR?"
```

---

## 3. Out-of-Distribution (OOD) Detection

### 3.1 Epistemic vs Aleatoric Uncertainty

Understanding the two types of uncertainty is critical for building a reliable OOD detection pipeline:

| Property | Epistemic Uncertainty | Aleatoric Uncertainty |
|----------|----------------------|----------------------|
| **Source** | Lack of knowledge (insufficient training data) | Inherent noise in the world |
| **Reducible?** | Yes, with more data | No |
| **Increases when** | Input is far from training distribution | Measurement noise is high |
| **Detection** | Ensemble disagreement, MC-Dropout, evidential | Learned variance head, conformal prediction |
| **Action** | Flag as OOD, request human review | Widen confidence intervals, maintain operation |
| **Airside example** | Novel aircraft type never seen in training | Rain-induced LiDAR noise on a known object |

For **safety monitoring**, epistemic uncertainty is the primary concern. High epistemic uncertainty means the model is operating outside its competence -- this is the OOD condition that should trigger safety responses.

### 3.2 OOD Detection Methods

#### 3.2.1 Energy-Based Detection (Liu et al., NIPS 2020)

The energy score is computed from the logits of a classifier without any modification to the model:

```python
def energy_ood_score(logits: torch.Tensor, T: float = 1.0) -> float:
    """
    Energy-based OOD score (Liu et al., 2020).
    Lower energy = more in-distribution.

    Args:
        logits: (C,) raw classifier output
        T: temperature scaling parameter
    Returns:
        energy: scalar, negative log-sum-exp of logits
    """
    energy = -T * torch.logsumexp(logits / T, dim=0)
    return energy.item()

# Usage:
# energy = energy_ood_score(model(x))
# if energy > threshold:  # calibrate threshold on validation set
#     flag_as_ood()
```

**Performance:** 95.6% AUROC on CIFAR-10 vs SVHN (outperforms softmax baseline at 88.2%). On 3D detection: 92-95% AUROC for detecting novel object types not in training set.

#### 3.2.2 Mahalanobis Distance (Lee et al., NeurIPS 2018)

Measures distance from test features to the nearest class-conditional Gaussian in feature space:

```python
class MahalanobisOODDetector:
    """Mahalanobis distance OOD detector for neural perception features."""

    def __init__(self, feature_dim: int, num_classes: int):
        self.feature_dim = feature_dim
        self.num_classes = num_classes
        self.class_means = None      # (num_classes, feature_dim)
        self.precision_matrix = None  # (feature_dim, feature_dim) shared precision

    def fit(self, features: np.ndarray, labels: np.ndarray):
        """Compute class means and shared precision matrix from training data."""
        self.class_means = np.zeros((self.num_classes, self.feature_dim))
        for c in range(self.num_classes):
            mask = labels == c
            self.class_means[c] = features[mask].mean(axis=0)

        # Shared covariance
        centered = features - self.class_means[labels]
        cov = (centered.T @ centered) / len(features)
        cov += 1e-6 * np.eye(self.feature_dim)  # regularization
        self.precision_matrix = np.linalg.inv(cov)

    def score(self, feature: np.ndarray) -> float:
        """Compute Mahalanobis distance to nearest class.
        Lower = more in-distribution."""
        distances = []
        for c in range(self.num_classes):
            diff = feature - self.class_means[c]
            dist = diff @ self.precision_matrix @ diff
            distances.append(dist)
        return min(distances)

    def is_ood(self, feature: np.ndarray, threshold: float) -> bool:
        """Returns True if feature is OOD."""
        return self.score(feature) > threshold
```

**Performance:** 97.6% AUROC on ImageNet-scale benchmarks. On LiDAR features: 93-96% AUROC for novel objects. **Key advantage**: can be computed on any intermediate feature layer, no model modification needed.

#### 3.2.3 ODIN (Liang et al., ICLR 2018)

Temperature scaling + input perturbation to separate in-distribution and OOD softmax scores:

```python
def odin_score(model, x, T=1000, epsilon=0.0014):
    """ODIN OOD score with temperature scaling and input perturbation."""
    x.requires_grad = True
    logits = model(x)
    scaled_logits = logits / T
    max_logit = scaled_logits.max(dim=1).values
    max_logit.backward()

    # Input perturbation (gradient-based)
    x_perturbed = x - epsilon * x.grad.sign()

    # Re-evaluate with perturbation
    with torch.no_grad():
        logits_perturbed = model(x_perturbed)
        softmax_score = F.softmax(logits_perturbed / T, dim=1).max(dim=1).values

    return softmax_score.item()  # Higher = more in-distribution
```

**Performance:** 89-96% AUROC depending on dataset pair. Requires gradient computation, adding ~30% inference overhead.

#### 3.2.4 ReAct (Sun et al., NeurIPS 2021)

Truncates high activations in the penultimate layer, which are more prevalent in OOD inputs:

```python
def react_score(model, x, threshold_percentile=90):
    """ReAct: rectified activation for OOD detection."""
    # Forward pass through all layers except final classifier
    features = model.backbone(x)

    # Truncate activations above threshold (computed from training set)
    clip_val = np.percentile(training_activations, threshold_percentile)
    features_clipped = torch.clamp(features, max=clip_val)

    # Compute energy on clipped features
    logits = model.classifier(features_clipped)
    energy = -torch.logsumexp(logits, dim=1)
    return energy.item()
```

**Performance:** Up to 16% improvement in FPR95 over energy alone. Zero inference overhead beyond one clamp operation.

#### 3.2.5 KNN-Based Detection (Sun et al., ICML 2022)

Uses k-nearest-neighbor distances in feature space, no distributional assumptions:

```python
class KNNOODDetector:
    """KNN-based OOD detector. Non-parametric, no distributional assumptions."""

    def __init__(self, k: int = 50):
        self.k = k
        self.train_features = None

    def fit(self, features: np.ndarray):
        """Store training features and build index."""
        self.train_features = features
        # Use FAISS for efficient nearest neighbor search
        import faiss
        self.index = faiss.IndexFlatL2(features.shape[1])
        self.index.add(features.astype(np.float32))

    def score(self, feature: np.ndarray) -> float:
        """KNN distance score. Higher = more OOD."""
        distances, _ = self.index.search(
            feature.reshape(1, -1).astype(np.float32), self.k
        )
        return distances[0, -1]  # k-th nearest neighbor distance
```

**Performance:** 97.2% AUROC on ImageNet, competitive with Mahalanobis. **Advantage:** No parametric assumptions, works well when class-conditional Gaussians are poor approximations.

#### 3.2.6 GradNorm (Huang et al., NeurIPS 2021)

Uses gradient magnitude as an OOD signal -- OOD inputs produce larger gradients:

```python
def gradnorm_score(model, x, num_classes):
    """GradNorm OOD score based on gradient magnitude of KL divergence."""
    logits = model(x)
    uniform = torch.ones_like(logits) / num_classes
    loss = F.kl_div(F.log_softmax(logits, dim=1), uniform, reduction='sum')
    loss.backward()

    # Collect gradients from last layer weights
    grad_norms = []
    for param in model.classifier.parameters():
        if param.grad is not None:
            grad_norms.append(param.grad.norm().item())

    return sum(grad_norms)  # Higher = more in-distribution
```

### 3.3 OOD Detection Comparison

| Method | AUROC (ImageNet) | FPR95 | Requires Training | Requires Gradients | Overhead (ms) | Recommended For |
|--------|-----------------|-------|-------------------|-------------------|---------------|-----------------|
| Softmax baseline | 79.6% | 54.8% | No | No | 0 | Not recommended |
| ODIN | 93.1% | 23.4% | No | Yes | +5-15 | Offline analysis |
| Energy | 95.6% | 17.3% | No | No | +0.1 | **Online (primary)** |
| Mahalanobis | 97.6% | 8.2% | Yes (class stats) | No | +0.5-1.5 | **Online (primary)** |
| ReAct | 96.2% | 14.1% | Yes (percentile) | No | +0.05 | Online (add-on to energy) |
| KNN | 97.2% | 7.9% | Yes (feature store) | No | +1-5 | Online if feature store is small |
| GradNorm | 94.8% | 19.7% | No | Yes | +10-30 | Offline analysis |
| Ensemble (3 heads) | 95-98% | 5-15% | Yes (multi-head training) | No | +2-5 | **Online (gold standard)** |

**Recommended pipeline for airside AV:** Combine Energy (fast, primary) + Mahalanobis (second-opinion) + Ensemble disagreement (gold standard). Energy runs on every frame; Mahalanobis and ensemble run on the perception backbone features already computed. Total overhead: 1-3 ms.

### 3.4 OOD for LiDAR Point Clouds

LiDAR-specific OOD detection presents unique challenges:

| Challenge | Why LiDAR is Different | Solution |
|-----------|----------------------|----------|
| Variable point count | Rain, fog, range affect density | Normalize by expected density per voxel |
| Geometric shift | Different airport layouts, surfaces | Geometric normalization, relative features |
| Sensor-specific patterns | Raydrop, beam divergence, near-field blindzone | Sensor-aware feature extraction |
| Sparse data | Most voxels are empty | Only compute OOD on occupied voxels |

**PointOOD (2024):** Adapts Mahalanobis distance to point cloud features from PointPillars/CenterPoint backbones. Reports 94.3% AUROC on nuScenes-to-KITTI domain shift (geometric shift comparable to airport-to-airport transfer).

**LiDAR distributional shift detection:**

```python
class LiDAROODDetector:
    """OOD detector for LiDAR point cloud features."""

    def __init__(self, pillar_encoder, ood_method='mahalanobis'):
        self.pillar_encoder = pillar_encoder  # PointPillars encoder
        self.method = ood_method
        self.mahalanobis = MahalanobisOODDetector(
            feature_dim=64,  # pillar feature dimension
            num_classes=18   # airside class taxonomy
        )
        # Statistics from training data
        self.expected_point_density = None  # (H, W) expected density per BEV cell
        self.density_std = None

    def detect(self, pointcloud: np.ndarray) -> dict:
        """Full OOD detection on a LiDAR scan.

        Returns:
            dict with:
              - 'ood_score': float, overall OOD score (0=ID, 1=OOD)
              - 'density_anomaly': bool, abnormal point density
              - 'feature_ood_map': (H, W), per-BEV-cell OOD score
              - 'novel_objects': list of objects with high OOD score
        """
        # 1. Point density check (sensor health proxy)
        density_map = self._compute_density_map(pointcloud)
        density_z = (density_map - self.expected_point_density) / (self.density_std + 1e-6)
        density_anomaly = np.abs(density_z).max() > 3.0  # 3-sigma outlier

        # 2. Feature-level OOD (from pillar encoder)
        pillar_features = self.pillar_encoder.extract_features(pointcloud)
        feature_ood_map = np.zeros((pillar_features.shape[1], pillar_features.shape[2]))
        for h in range(pillar_features.shape[1]):
            for w in range(pillar_features.shape[2]):
                if pillar_features[:, h, w].any():
                    feature_ood_map[h, w] = self.mahalanobis.score(
                        pillar_features[:, h, w].numpy()
                    )

        # 3. Object-level OOD (per detected object)
        # High OOD on an object means: "I detected something, but I don't
        # know what it is" -- this is different from "I see nothing"
        novel_objects = self._identify_novel_objects(feature_ood_map)

        # 4. Aggregate score
        ood_score = self._aggregate(density_anomaly, feature_ood_map, novel_objects)

        return {
            'ood_score': ood_score,
            'density_anomaly': density_anomaly,
            'feature_ood_map': feature_ood_map,
            'novel_objects': novel_objects,
        }
```

### 3.5 Conformal Prediction for Calibrated Uncertainty

Conformal prediction provides **distribution-free** coverage guarantees: given a miscoverage rate alpha, the prediction set contains the true label with probability >= 1 - alpha, regardless of the underlying distribution. This is critical for safety certification because it does not assume Gaussianity or any parametric form.

```python
class ConformalOODWrapper:
    """Wraps any neural detector with conformal prediction guarantees."""

    def __init__(self, base_detector, alpha: float = 0.01):
        """
        Args:
            base_detector: any model producing softmax scores
            alpha: miscoverage rate (0.01 = 99% coverage guarantee)
        """
        self.base_detector = base_detector
        self.alpha = alpha
        self.qhat = None  # calibrated threshold

    def calibrate(self, cal_features: np.ndarray, cal_labels: np.ndarray):
        """Calibrate on held-out calibration set.

        Computes the (1-alpha)-quantile of nonconformity scores.
        """
        # Nonconformity score: 1 - softmax probability of true class
        scores = []
        for feat, label in zip(cal_features, cal_labels):
            softmax = self.base_detector.predict_proba(feat)
            score = 1.0 - softmax[label]
            scores.append(score)

        # Finite-sample correction (Vovk et al., 2005)
        n = len(scores)
        level = np.ceil((n + 1) * (1 - self.alpha)) / n
        self.qhat = np.quantile(scores, min(level, 1.0))

    def predict_set(self, feature: np.ndarray) -> tuple:
        """Return prediction set with coverage guarantee.

        Returns:
            prediction_set: list of classes in the prediction set
            is_ood: True if prediction set is empty or contains too many classes
        """
        softmax = self.base_detector.predict_proba(feature)
        prediction_set = [c for c, p in enumerate(softmax) if (1 - p) <= self.qhat]

        # OOD heuristic: if prediction set is empty (nothing is confident enough)
        # or contains >50% of classes (everything is equally plausible)
        is_ood = len(prediction_set) == 0 or len(prediction_set) > len(softmax) * 0.5

        return prediction_set, is_ood

    def coverage_guarantee(self) -> str:
        """Formal guarantee statement."""
        return (
            f"P(true class in prediction set) >= {1 - self.alpha:.4f} "
            f"(distribution-free, finite-sample valid)"
        )
```

**Key results:**
- Coverage guarantee is **exact** (not asymptotic) for any sample size n >= 1/(alpha)
- No distributional assumptions on the data
- Works with any base model (including black-box neural networks)
- Calibration requires only a held-out set of ~1000 examples for alpha=0.01
- Referenced in [failure-modes-analysis.md](failure-modes-analysis.md) (Section 6.3, conformal prediction bounds for verification gap)

### 3.6 Ensemble Disagreement and MC-Dropout

Building on the ensemble OOD detector from [simplex-safety-architecture.md](simplex-safety-architecture.md), here is the full implementation with both ensemble and MC-Dropout variants:

```python
class EnsembleOODDetector:
    """
    OOD detection via ensemble disagreement.
    Uses multiple prediction heads on a shared backbone (lightweight).
    See simplex-safety-architecture.md Section 3.1 for the basic version.
    This version adds:
    - Per-object OOD scoring (not just global)
    - MC-Dropout fallback when ensemble is unavailable
    - Calibrated thresholds from conformal prediction
    """

    def __init__(self, backbone, heads: list, mc_dropout_passes: int = 10):
        self.backbone = backbone
        self.heads = heads
        self.mc_dropout_passes = mc_dropout_passes

    def ensemble_ood(self, features: torch.Tensor) -> dict:
        """Compute per-cell OOD score from ensemble disagreement."""
        with torch.no_grad():
            backbone_out = self.backbone(features)
            predictions = torch.stack([h(backbone_out) for h in self.heads])

        # Variance across heads: (N_heads, B, C, H, W) -> (B, C, H, W)
        variance = predictions.var(dim=0)

        # Per-cell OOD: mean variance across classes
        ood_map = variance.mean(dim=1)  # (B, H, W)

        # Global OOD: 95th percentile of per-cell OOD (robust to outlier cells)
        global_ood = torch.quantile(ood_map.flatten(1), 0.95, dim=1)

        return {
            'ood_map': ood_map,
            'global_ood': global_ood,
            'per_class_variance': variance,
        }

    def mc_dropout_ood(self, features: torch.Tensor) -> dict:
        """MC-Dropout OOD detection (Gal and Ghahramani, 2016).
        Use when only one prediction head is available."""
        self.backbone.train()  # enable dropout
        predictions = []
        with torch.no_grad():
            for _ in range(self.mc_dropout_passes):
                pred = self.heads[0](self.backbone(features))
                predictions.append(pred)
        self.backbone.eval()

        predictions = torch.stack(predictions)
        variance = predictions.var(dim=0)
        ood_map = variance.mean(dim=1)
        global_ood = torch.quantile(ood_map.flatten(1), 0.95, dim=1)

        return {'ood_map': ood_map, 'global_ood': global_ood}
```

### 3.7 Airside-Specific OOD Triggers

These are the concrete scenarios where OOD detection is expected to fire, with recommended responses:

| OOD Trigger | Expected OOD Score | Detection Method | Recommended Response |
|-------------|-------------------|------------------|---------------------|
| Novel aircraft type (e.g., A350-1000 never in training) | 0.6-0.8 (moderate) | Feature-level Mahalanobis | Continue at reduced speed; bounding box still valid (geometry generalizes) |
| Unusual ground equipment (e.g., aircraft tow bar type) | 0.5-0.7 | Object-level ensemble disagreement | Continue; classify as generic GSE obstacle |
| De-icing foam on tarmac | 0.7-0.9 (high) | Point density anomaly + feature OOD | Reduce speed, increase clearances, alert operator |
| Temporary construction zone | 0.6-0.9 | Spatial OOD map (localized high-OOD region) | Re-plan route; if no alternative, stop and request teleop |
| Wildlife on tarmac (birds, foxes) | 0.8-0.95 (very high) | Object-level OOD (novel class) + motion pattern anomaly | Emergency stop if in path; alert ATC/wildlife control |
| Wet/flooded apron | 0.4-0.7 | Point density anomaly (mirror reflections) | Reduce speed to 5 km/h, rely on radar if available |
| Night operations with poor lighting | 0.3-0.5 (mild) | Global energy score elevation | Increase sensor integration time; reduce speed |
| Ice/snow-covered surfaces | 0.5-0.8 | Surface feature anomaly | Reduce speed dramatically (braking distance 2-5x); alert operator |
| Smoke/fire near aircraft | 0.9+ | Multi-sensor anomaly (thermal + LiDAR density drop) | Emergency stop, alert ATC immediately |

---

## 4. Shield Synthesis and Reactive Safety

### 4.1 Reactive Shield Synthesis from LTL Specifications

A **shield** is a runtime enforcement mechanism that modifies the output of a (possibly unsafe) controller to guarantee satisfaction of a safety specification. Unlike monitors (which only observe), shields actively intervene.

**Formal definition** (Bloem et al., 2015): Given a safety specification phi expressed in LTL, a shield S is a reactive system that:
1. Observes the controller output u_nom at each step
2. Produces a corrected output u_safe
3. Guarantees that the output sequence satisfies phi
4. Minimizes deviation from u_nom (is minimally invasive)

**Synthesis procedure:**

```
LTL Safety Specification phi
        │
        ▼
Deterministic Safety Automaton A_phi
   (via ltl2dpa or ltl2dra tools; Owl library)
        │
        ▼
2-Player Safety Game G(A_phi)
   Player 1 (system): chooses outputs
   Player 2 (environment): chooses inputs
   Winning condition: stay in safe states of A_phi
        │
        ▼
Winning Strategy sigma (via fixpoint computation)
   sigma: State x Input -> Output
   Computable in O(|A_phi| * |Sigma_out|)
        │
        ▼
Shield Implementation
   Mealy machine implementing sigma
   Deployed as ROS node, intercepts controller commands
```

**Complexity:** The bottleneck is automaton construction (doubly exponential in |phi| for general LTL, singly exponential for safety fragments). For the bounded, safety-focused specs used in airside AV monitoring, the resulting automata have 10-1000 states. The game solving and strategy extraction are polynomial in automaton size.

### 4.2 Game-Theoretic Shielding

The shield synthesis problem is inherently a two-player game: the system (Player 1) chooses control actions, while the environment (Player 2 -- other vehicles, personnel, weather) chooses adversarial inputs. The shield must guarantee safety against all possible environment behaviors.

```
2-Player Safety Game:
  States S:        Product of system state x automaton state
  Actions_sys:     Discrete control actions (e.g., {accelerate, maintain, brake, stop, turn_left, turn_right})
  Actions_env:     Environment behaviors (e.g., {pedestrian_stays, pedestrian_moves_toward, aircraft_pushback_starts})
  Transitions:     Deterministic (given sys action + env action + current state)
  Safety:          Avoid "bad" states (automaton rejecting states)

Winning region W = greatest fixpoint of:
  W_0 = S \ Bad
  W_{i+1} = { s in W_i : exists a_sys, forall a_env: transition(s, a_sys, a_env) in W_i }

Shield strategy:
  sigma(s) = any a_sys such that forall a_env: transition(s, sigma(s), a_env) in W
```

**Key insight:** The game-theoretic formulation means the shield is **robust to worst-case environment behavior**. If a pedestrian does something completely unexpected, the shield still guarantees safety -- because it was designed to handle all possible environment moves.

### 4.3 Permissive vs Restrictive Shields

| Shield Type | Behavior | Intervention Frequency | Safety | Performance Impact |
|-------------|----------|----------------------|--------|-------------------|
| **Restrictive (k-stabilizing)** | Corrects controller output at every step where violation is possible in k steps | High (~20-40% of steps) | Very high | Significant (overly conservative) |
| **Permissive (maximally permissive)** | Corrects only when no safe continuation exists from the current state | Low (~1-5% of steps) | High | Minimal (allows all safe behaviors) |
| **Lazy shield** | Delays correction until last possible moment | Very low (<1% of steps) | Medium-High | Minimal, but sudden corrections |
| **Blended shield** | Blends shield output with controller output using safety distance | Continuous | High | Smooth (no sudden jumps) |

**Recommendation for airside:** Use a **maximally permissive shield** for normal operation (allows the neural planner maximum freedom while guaranteeing safety) with a **k-stabilizing shield** as a secondary fallback (k=5 steps at 10 Hz = 0.5s lookahead) activated when the maximally permissive shield intervenes more than 10% of the time (indicating the primary planner is struggling).

### 4.4 Shield Composition for Multi-Specification Systems

The airside AV has multiple simultaneous safety specifications (aircraft clearance, speed limit, geofence, personnel safety, runway incursion, jet blast). These must be composed:

```python
class ComposedShield:
    """Compose multiple shields for multi-specification systems."""

    def __init__(self, shields: list):
        """
        Args:
            shields: List of (shield, priority) tuples.
                     Higher priority shields override lower when in conflict.
        Priority order:
            1. Runway incursion prevention (highest - hard wall)
            2. Personnel collision avoidance
            3. Aircraft collision avoidance
            4. Jet blast avoidance
            5. Speed limit compliance
            6. Geofence compliance
        """
        self.shields = sorted(shields, key=lambda s: s[1], reverse=True)

    def enforce(self, state: np.ndarray, u_nom: np.ndarray) -> np.ndarray:
        """Apply shields in priority order.

        Each shield takes the output of the previous shield as input.
        Higher-priority shields override lower-priority corrections.
        """
        u = u_nom.copy()
        interventions = []

        for shield, priority in self.shields:
            u_new = shield.correct(state, u)
            if not np.allclose(u_new, u):
                interventions.append({
                    'shield': shield.name,
                    'priority': priority,
                    'original': u.copy(),
                    'corrected': u_new.copy(),
                })
            u = u_new

        return u, interventions
```

**Composition soundness:** If each individual shield S_i guarantees phi_i, then the composed shield guarantees phi_1 AND phi_2 AND ... AND phi_n, **provided** the priorities are consistent (no circular conflicts). For airside specs, the natural priority ordering above is consistent because higher-priority specs (runway, personnel) are more restrictive -- they produce more conservative actions that automatically satisfy lower-priority specs.

### 4.5 Runtime Enforcement: Edit Automata

Beyond shields (which are proactive), runtime enforcement mechanisms can reactively modify system outputs:

| Enforcement Type | Action | When Used | Example |
|-----------------|--------|-----------|---------|
| **Truncation** | Terminates execution on violation | Hard safety constraints | Controlled stop on geofence violation |
| **Suppression** | Drops the violating action, repeats last safe action | Soft constraints | Repeat last safe velocity command |
| **Edit (insertion)** | Inserts a safe action before the violating one | Pre-emptive correction | Insert braking before speed limit would be exceeded |
| **Edit (replacement)** | Replaces violating action with safe alternative | General correction | Replace accelerate with maintain when near aircraft |

```python
class EditAutomaton:
    """Edit automaton for runtime enforcement of safety properties."""

    def __init__(self, safety_spec, enforcement_type='edit'):
        self.spec = safety_spec
        self.enforcement_type = enforcement_type
        self.last_safe_action = None

    def enforce(self, state, proposed_action):
        """Enforce safety specification on proposed action.

        Returns:
            action: the (possibly modified) action to execute
            was_edited: True if the action was modified
            edit_type: type of enforcement applied
        """
        # Check if proposed action satisfies spec
        if self.spec.is_safe(state, proposed_action):
            self.last_safe_action = proposed_action
            return proposed_action, False, None

        if self.enforcement_type == 'truncation':
            # Emergency stop
            return self._stop_action(), True, 'truncation'

        elif self.enforcement_type == 'suppression':
            # Repeat last safe action
            if self.last_safe_action is not None:
                return self.last_safe_action, True, 'suppression'
            return self._stop_action(), True, 'truncation'

        elif self.enforcement_type == 'edit':
            # Find the closest safe action to the proposed one
            safe_action = self._find_closest_safe(state, proposed_action)
            if safe_action is not None:
                self.last_safe_action = safe_action
                return safe_action, True, 'edit'
            return self._stop_action(), True, 'truncation'
```

### 4.6 Integration with Learning-Based Controllers (Safe RL Shields)

Shields are the enabling mechanism for safely deploying RL-trained controllers:

```
                    ┌──────────────────┐
                    │  RL / Neural     │
                    │  Planner         │
   observation ────►│  (learns from    │────► u_nom
                    │   experience)    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Safety Shield   │
                    │  (synthesized    │────► u_safe ────► Vehicle
                    │   from LTL spec) │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Shield Feedback │
                    │  (penalty signal │
                    │   to RL agent)   │
                    └──────────────────┘
```

**Key results from the literature:**

| Paper | Approach | Safety Violation Reduction | Performance Impact |
|-------|----------|---------------------------|-------------------|
| SafeDreamer (ICLR 2024) | Shield + world model + Lagrangian RL | 99.8% fewer violations | -3% reward |
| VSRL (Thananjeyan et al., 2021) | Learned CBF as shield | 97% fewer collisions | -8% reward |
| MESA (Russell et al., 2023) | Shield as RL reward shaping | 100% safe (provable) | -12% reward |
| Shielded RL (Alshiekh et al., 2018) | DFA shield + Q-learning | 100% safe during training | -5% reward |

For Aurrigo's Simplex architecture, the shield sits between the neural AC planner and the CBF-QP safety filter:

```
Neural AC Planner → Shield (LTL-based) → CBF-QP (continuous safety) → Actuators
     ↑                    ↑                         ↑
     │                    │                         │
Simplex Arbitrator monitors all three layers
If any layer intervenes excessively → switch to Frenet BC fallback
```

---

## 5. Anomaly Detection and Health Monitoring

### 5.1 Sensor Health Monitoring

Real-time sensor health is the foundation of all higher-level safety monitoring. Each sensor needs specific health metrics:

#### 5.1.1 LiDAR Health Monitoring

```python
class LiDARHealthMonitor:
    """Health monitoring for RoboSense RSHELIOS/RSBP LiDAR units."""

    # Expected parameters for RSHELIOS at 10 Hz
    EXPECTED_POINTS_PER_SCAN = 115200  # 32 channels * 3600 firings/rev
    POINT_COUNT_WARNING = 0.7   # <70% of expected
    POINT_COUNT_CRITICAL = 0.3  # <30% of expected

    def __init__(self, sensor_id: str, expected_fps: float = 10.0):
        self.sensor_id = sensor_id
        self.expected_fps = expected_fps
        self.last_timestamp = None
        self.point_counts = collections.deque(maxlen=100)
        self.intensity_stats = collections.deque(maxlen=100)
        self.health_history = collections.deque(maxlen=1000)

    def update(self, cloud_msg) -> dict:
        """Process one pointcloud message, return health status."""
        now = time.time()
        health = {}

        # 1. Timing check
        if self.last_timestamp is not None:
            dt = now - self.last_timestamp
            expected_dt = 1.0 / self.expected_fps
            health['timing_ok'] = abs(dt - expected_dt) < 0.5 * expected_dt
            health['actual_fps'] = 1.0 / dt if dt > 0 else 0
        else:
            health['timing_ok'] = True
            health['actual_fps'] = self.expected_fps
        self.last_timestamp = now

        # 2. Point count check (detects blockage, rain, fog, de-icing spray)
        n_points = cloud_msg.width * cloud_msg.height
        self.point_counts.append(n_points)
        ratio = n_points / self.EXPECTED_POINTS_PER_SCAN
        health['point_count'] = n_points
        health['point_ratio'] = ratio
        health['point_count_ok'] = ratio >= self.POINT_COUNT_WARNING

        # 3. Intensity statistics (detects sensor degradation, dirty lens)
        intensities = self._extract_intensities(cloud_msg)
        mean_intensity = np.mean(intensities) if len(intensities) > 0 else 0
        self.intensity_stats.append(mean_intensity)
        health['mean_intensity'] = mean_intensity

        # Check for sudden intensity change (>50% drop in 1 second)
        if len(self.intensity_stats) >= 10:
            recent = np.mean(list(self.intensity_stats)[-10:])
            older = np.mean(list(self.intensity_stats)[-100:-10]) if len(self.intensity_stats) > 10 else recent
            health['intensity_stable'] = abs(recent - older) / (older + 1e-6) < 0.5
        else:
            health['intensity_stable'] = True

        # 4. Spatial coverage check (detects partial blockage)
        coverage = self._compute_sector_coverage(cloud_msg)
        health['sector_coverage'] = coverage  # Dict of sector -> point count
        health['coverage_ok'] = all(v > 100 for v in coverage.values())

        # 5. Aggregate health score [0, 1]
        health['score'] = self._aggregate_health(health)

        # 6. Degradation classification
        if health['score'] >= 0.8:
            health['status'] = 'HEALTHY'
        elif health['score'] >= 0.5:
            health['status'] = 'DEGRADED'
        elif health['score'] >= 0.2:
            health['status'] = 'CRITICAL'
        else:
            health['status'] = 'FAILED'

        self.health_history.append(health)
        return health
```

#### 5.1.2 IMU Drift Detection

```python
class IMUDriftDetector:
    """Detect IMU drift by cross-checking against other odometry sources."""

    def __init__(self, drift_threshold_deg_per_min: float = 0.5):
        self.drift_threshold = drift_threshold_deg_per_min
        self.imu_yaw_history = collections.deque(maxlen=6000)  # 10 min at 10 Hz
        self.gps_yaw_history = collections.deque(maxlen=600)

    def check_drift(self, imu_yaw: float, gps_heading: float, wheel_odom_yaw: float) -> dict:
        """Check for IMU heading drift.

        Cross-references IMU heading against:
        1. GPS heading (when moving and HDOP < 2.0)
        2. Wheel odometry heading (short-term reliable)
        3. GTSAM fused heading (if available)
        """
        self.imu_yaw_history.append(imu_yaw)

        drift = {}
        # IMU vs GPS heading divergence
        if gps_heading is not None:
            heading_diff = self._angle_diff(imu_yaw, gps_heading)
            drift['imu_gps_diff_deg'] = np.degrees(heading_diff)
            drift['imu_gps_ok'] = abs(drift['imu_gps_diff_deg']) < 5.0

        # IMU vs wheel odometry divergence (short term)
        yaw_diff_wheel = self._angle_diff(imu_yaw, wheel_odom_yaw)
        drift['imu_wheel_diff_deg'] = np.degrees(yaw_diff_wheel)
        drift['imu_wheel_ok'] = abs(drift['imu_wheel_diff_deg']) < 2.0

        # Drift rate estimation (linear regression on heading error)
        if len(self.imu_yaw_history) > 600:  # 1 minute of data
            drift_rate = self._estimate_drift_rate()
            drift['drift_rate_deg_per_min'] = drift_rate
            drift['drift_ok'] = abs(drift_rate) < self.drift_threshold
        else:
            drift['drift_ok'] = True

        return drift
```

#### 5.1.3 GPS Denial Detection

```python
class GPSDenialDetector:
    """Detect GPS degradation and denial."""

    # GPS quality thresholds
    HDOP_GOOD = 1.5
    HDOP_DEGRADED = 3.0
    HDOP_DENIED = 6.0
    MIN_SATELLITES = 6
    MAX_POSITION_JUMP = 2.0  # meters, between consecutive fixes

    def check(self, gps_msg) -> dict:
        """Assess GPS health from NavSatFix message."""
        status = {}

        # Satellite count
        status['n_satellites'] = gps_msg.status.service  # depends on GPS driver
        status['fix_type'] = gps_msg.status.status  # -1=no fix, 0=fix, 1=SBAS, 2=RTK

        # HDOP from covariance (if available)
        if hasattr(gps_msg, 'position_covariance'):
            hdop = np.sqrt(gps_msg.position_covariance[0])  # approximate
            status['hdop'] = hdop
            status['quality'] = (
                'GOOD' if hdop < self.HDOP_GOOD else
                'DEGRADED' if hdop < self.HDOP_DEGRADED else
                'DENIED'
            )
        else:
            status['quality'] = 'UNKNOWN'

        # Position jump detection (multipath indicator)
        if hasattr(self, '_last_pos') and self._last_pos is not None:
            jump = np.sqrt(
                (gps_msg.latitude - self._last_pos[0])**2 +
                (gps_msg.longitude - self._last_pos[1])**2
            ) * 111000  # approximate meters from degrees
            status['position_jump_m'] = jump
            status['multipath_suspected'] = jump > self.MAX_POSITION_JUMP

        self._last_pos = (gps_msg.latitude, gps_msg.longitude)

        # RTK status
        status['rtk_fixed'] = gps_msg.status.status >= 2
        status['localization_fallback'] = (
            'RTK' if status.get('rtk_fixed') else
            'DGPS' if status.get('quality') == 'GOOD' else
            'SLAM' if status.get('quality') == 'DEGRADED' else
            'DEAD_RECKONING'
        )

        return status
```

### 5.2 System Self-Diagnosis

#### 5.2.1 Watchdog Timers and Heartbeat Monitoring

```python
class NodeWatchdog:
    """Watchdog for ROS node health monitoring.

    Subscribes to heartbeat topics from all safety-critical nodes.
    Publishes aggregated system health.
    """

    # Node timeout thresholds (seconds)
    TIMEOUTS = {
        'perception':     0.2,   # 200ms (must run at 5+ Hz)
        'localization':   0.1,   # 100ms (must run at 10+ Hz)
        'planning':       0.2,   # 200ms
        'control':        0.05,  # 50ms (must run at 20+ Hz)
        'safety_monitor': 0.1,   # 100ms
        'lidar_driver_0': 0.15,  # 150ms (10 Hz expected)
        'lidar_driver_1': 0.15,
        'imu_driver':     0.01,  # 10ms (100 Hz expected)
        'gps_driver':     1.0,   # 1s (1 Hz expected)
    }

    # Criticality levels for each node
    CRITICALITY = {
        'perception':     'SAFETY_CRITICAL',  # Loss = stop immediately
        'localization':   'SAFETY_CRITICAL',
        'planning':       'SAFETY_CRITICAL',
        'control':        'SAFETY_CRITICAL',
        'safety_monitor': 'SAFETY_CRITICAL',
        'lidar_driver_0': 'HIGH',             # Loss = degrade to fewer LiDARs
        'lidar_driver_1': 'HIGH',
        'imu_driver':     'SAFETY_CRITICAL',
        'gps_driver':     'MEDIUM',           # Loss = SLAM-only localization
    }

    def __init__(self):
        self.last_heartbeat = {}
        self.node_status = {}
        self.consecutive_timeouts = {}

        # Subscribe to heartbeat topics
        for node_name in self.TIMEOUTS:
            rospy.Subscriber(
                f'/heartbeat/{node_name}',
                std_msgs.msg.Header,
                lambda msg, n=node_name: self._heartbeat_cb(n, msg)
            )

        # Watchdog timer at 50 Hz
        rospy.Timer(rospy.Duration(0.02), self._check_all)

    def _check_all(self, event):
        """Check all nodes for timeout."""
        now = rospy.Time.now().to_sec()
        system_health = 'NOMINAL'

        for node_name, timeout in self.TIMEOUTS.items():
            last = self.last_heartbeat.get(node_name, 0)
            if now - last > timeout:
                self.consecutive_timeouts[node_name] = \
                    self.consecutive_timeouts.get(node_name, 0) + 1

                if self.consecutive_timeouts[node_name] >= 3:
                    self.node_status[node_name] = 'TIMEOUT'
                    crit = self.CRITICALITY[node_name]
                    if crit == 'SAFETY_CRITICAL':
                        system_health = 'EMERGENCY_STOP'
                    elif crit == 'HIGH' and system_health != 'EMERGENCY_STOP':
                        system_health = 'DEGRADED'
            else:
                self.consecutive_timeouts[node_name] = 0
                self.node_status[node_name] = 'ALIVE'

        # Publish system health
        self._publish_health(system_health, self.node_status)
```

### 5.3 Performance Degradation Detection

```python
class LatencyMonitor:
    """Monitor per-node latency and detect degradation."""

    # Latency budgets (ms)
    BUDGETS = {
        'lidar_preprocessing':  5.0,   # Point cloud filtering, aggregation
        'pointpillars_infer':   10.0,  # PointPillars detection
        'gtsam_update':         15.0,  # GTSAM factor graph optimization
        'frenet_planning':      20.0,  # Frenet candidate evaluation
        'safety_check':         2.0,   # STL + OOD + shield
        'control_output':       1.0,   # Final command computation
        'total_pipeline':       50.0,  # End-to-end latency (sensor to actuator)
    }

    def __init__(self):
        self.latency_history = {k: collections.deque(maxlen=1000) for k in self.BUDGETS}
        self.violation_counts = {k: 0 for k in self.BUDGETS}

    def record(self, component: str, latency_ms: float):
        """Record a latency measurement."""
        self.latency_history[component].append(latency_ms)

        if latency_ms > self.BUDGETS[component]:
            self.violation_counts[component] += 1

    def diagnose(self) -> dict:
        """Generate latency diagnosis."""
        report = {}
        for component, budget in self.BUDGETS.items():
            history = self.latency_history[component]
            if len(history) < 10:
                continue

            recent = list(history)[-100:]
            report[component] = {
                'mean_ms': np.mean(recent),
                'p95_ms': np.percentile(recent, 95),
                'p99_ms': np.percentile(recent, 99),
                'max_ms': np.max(recent),
                'budget_ms': budget,
                'violations_pct': sum(1 for x in recent if x > budget) / len(recent) * 100,
                'trend': self._compute_trend(recent),  # increasing/stable/decreasing
            }

            # Alert on sustained degradation
            if report[component]['p95_ms'] > budget:
                report[component]['status'] = 'DEGRADED'
            elif report[component]['p99_ms'] > budget:
                report[component]['status'] = 'WARNING'
            else:
                report[component]['status'] = 'NOMINAL'

        return report
```

### 5.4 Predictive Maintenance from Operational Data

| Sensor/Component | Degradation Indicator | Prediction Horizon | Data Required | Action |
|-----------------|----------------------|-------------------|---------------|--------|
| LiDAR lens contamination | Gradual intensity drop over hours | 2-8 hours before failure | 30-day intensity history | Schedule cleaning |
| LiDAR motor bearing | Increasing jitter in scan timing | Days to weeks | Scan timing variance | Schedule replacement |
| IMU bias | Increasing Allan variance | Hours | Continuous bias estimates from GTSAM | Recalibrate or replace |
| GPS antenna | Degrading SNR | Days | Daily SNR statistics | Inspect connector/cable |
| Wheel encoder | Increasing odometry error vs SLAM | Weeks | Cross-reference with SLAM | Inspect encoder |
| GPU thermal | Increasing throttling frequency | Hours during hot weather | Temperature log + inference latency | Clean heatsink, add cooling |
| SSD storage | Increasing write latency | Days to weeks | SMART data | Replace SSD |

### 5.5 Airside-Specific Anomaly Detection

#### 5.5.1 Jet Exhaust Interference Detection

```python
class JetExhaustDetector:
    """Detect jet exhaust interference on LiDAR by identifying
    characteristic point cloud patterns."""

    def __init__(self):
        # Jet exhaust causes:
        # 1. Turbulent density fluctuations (random point dropout + addition)
        # 2. Beam refraction (shifted returns)
        # 3. Particulate returns (phantom points in cone behind engine)
        self.baseline_variance = None

    def detect(self, cloud: np.ndarray, aircraft_positions: list) -> dict:
        """Detect jet exhaust interference in LiDAR scan.

        Args:
            cloud: (N, 4) point cloud [x, y, z, intensity]
            aircraft_positions: list of dicts with 'position', 'heading', 'engine_status'

        Returns:
            dict with 'detected', 'affected_region', 'confidence'
        """
        for aircraft in aircraft_positions:
            if aircraft.get('engine_status') != 'running':
                continue

            # Define exhaust cone (behind engines, expanding with distance)
            cone = self._compute_exhaust_cone(
                aircraft['position'],
                aircraft['heading'],
                aircraft.get('aircraft_type', 'generic'),
            )

            # Extract points within cone
            mask = self._points_in_cone(cloud[:, :3], cone)
            cone_points = cloud[mask]

            if len(cone_points) < 10:
                continue

            # Jet exhaust signature:
            # - Abnormal density variance (flickering)
            # - Intensity anomaly (scattering)
            # - Temporal instability (frame-to-frame variance >> baseline)
            density_var = self._local_density_variance(cone_points)
            intensity_anomaly = np.std(cone_points[:, 3]) / (np.mean(cone_points[:, 3]) + 1e-6)

            if density_var > 3.0 * self.baseline_variance and intensity_anomaly > 0.5:
                return {
                    'detected': True,
                    'affected_region': cone,
                    'confidence': min(1.0, density_var / (5.0 * self.baseline_variance)),
                    'recommendation': 'AVOID_ZONE',
                }

        return {'detected': False}
```

#### 5.5.2 Reflective Surface Anomaly Detection

```python
class ReflectiveSurfaceDetector:
    """Detect anomalous LiDAR returns from reflective surfaces.
    Common on wet tarmac, aircraft fuselage, and terminal glass."""

    def detect(self, cloud: np.ndarray) -> dict:
        """Detect mirror-reflection artifacts (phantom ground plane below actual)."""
        # 1. Check for bimodal ground plane (real + reflection)
        ground_z = cloud[cloud[:, 2] < 0.5, 2]  # points near ground
        if len(ground_z) > 100:
            hist, bins = np.histogram(ground_z, bins=50)
            peaks = self._find_peaks(hist)
            if len(peaks) > 1:
                return {
                    'standing_water': True,
                    'phantom_depth': abs(bins[peaks[0]] - bins[peaks[1]]),
                    'recommendation': 'RAISE_GROUND_FILTER',
                }

        # 2. Check for unrealistic high-intensity returns (specular reflection)
        high_intensity = cloud[cloud[:, 3] > 250]  # near-saturation
        if len(high_intensity) > len(cloud) * 0.05:
            return {
                'specular_reflection': True,
                'affected_fraction': len(high_intensity) / len(cloud),
                'recommendation': 'FILTER_HIGH_INTENSITY',
            }

        return {'standing_water': False, 'specular_reflection': False}
```

---

## 6. Safety Envelope and ODD Monitoring

### 6.1 Operational Design Domain (ODD) Definition

The ODD defines the operating conditions under which the autonomous system is designed to function. Per ISO/PAS 21448 (SOTIF), the system must continuously verify that it is operating within its ODD and initiate a Minimal Risk Condition (MRC) when it exits.

**Aurrigo Airside ODD Parameters:**

| ODD Dimension | Parameter | Range | Measurement Source |
|--------------|-----------|-------|-------------------|
| **Speed** | Maximum ego speed | 0-30 km/h (0-8.3 m/s) | Wheel encoder + IMU |
| **Weather: Visibility** | Meteorological visibility | >= 200m | METAR feed (AWOS) |
| **Weather: Precipitation** | Rain rate | <= 7.6 mm/hr (moderate rain) | METAR + wiper sensor |
| **Weather: Wind** | Surface wind speed | <= 30 kt (crosswind) | METAR + local anemometer |
| **Weather: Temperature** | Ambient temperature | -20C to +50C | Onboard sensor |
| **Surface** | Tarmac condition | Dry, wet, or damp (not icy, not flooded) | Surface sensor + METAR |
| **Lighting** | Ambient illumination | >= 10 lux (dawn/dusk) if camera-dependent, any if LiDAR-only | Lux sensor |
| **Traffic** | Number of dynamic objects in detection range | <= 50 | Perception pipeline |
| **Connectivity** | V2I communication link | Active (for fleet coordination) | Link quality monitor |
| **GPS** | HDOP | <= 3.0 (or SLAM-only mode activated) | GPS receiver |
| **Map** | Map age | <= 28 days (AMDB cycle) | Map metadata |
| **Aircraft** | Proximity to aircraft with running engines | Requires ADS-B feed + engine status | ADS-B receiver |

### 6.2 Dynamic Safety Envelope Computation

The safety envelope is not static -- it contracts and expands based on real-time conditions:

```python
class SafetyEnvelopeComputer:
    """Compute dynamic safety envelope from current conditions."""

    def __init__(self):
        # Base envelope (full ODD compliance)
        self.base_max_speed = 8.3       # m/s (30 km/h)
        self.base_min_clearance = 3.0   # m (aircraft)
        self.base_max_accel = 1.5       # m/s^2
        self.base_max_decel = 3.0       # m/s^2

    def compute(self, conditions: dict) -> dict:
        """Compute current safety envelope.

        Args:
            conditions: dict with current environmental/system state

        Returns:
            envelope: dict with speed limits, clearances, acceleration limits
        """
        envelope = {
            'max_speed': self.base_max_speed,
            'min_clearance_aircraft': self.base_min_clearance,
            'min_clearance_personnel': 3.0,
            'max_accel': self.base_max_accel,
            'max_decel': self.base_max_decel,
        }

        # Weather degradation factors
        visibility = conditions.get('visibility_m', 10000)
        if visibility < 1000:
            # Linear reduction: 1000m vis -> 70% speed, 200m vis -> 30% speed
            vis_factor = max(0.3, min(1.0, visibility / 1500))
            envelope['max_speed'] *= vis_factor
            envelope['min_clearance_aircraft'] *= (2.0 - vis_factor)  # increase clearance
            envelope['min_clearance_personnel'] *= (2.0 - vis_factor)

        rain_rate = conditions.get('rain_rate_mm_hr', 0)
        if rain_rate > 2.5:
            # Wet braking: 1.5-2x stopping distance
            braking_factor = max(0.5, 1.0 - rain_rate / 15.0)
            envelope['max_decel'] *= braking_factor
            # Compensate with lower speed
            envelope['max_speed'] *= np.sqrt(braking_factor)

        # Surface condition
        surface = conditions.get('surface', 'dry')
        surface_factors = {
            'dry': 1.0, 'damp': 0.85, 'wet': 0.7,
            'icy': 0.3, 'snow': 0.4, 'flooded': 0.0  # flooded = stop
        }
        surface_factor = surface_factors.get(surface, 0.5)
        envelope['max_speed'] *= surface_factor
        envelope['max_decel'] *= surface_factor

        if surface == 'flooded':
            envelope['max_speed'] = 0  # cannot operate

        # Sensor degradation
        lidar_health = conditions.get('lidar_health_score', 1.0)
        if lidar_health < 0.8:
            # Speed proportional to sensor health (see camera-fallback doc)
            envelope['max_speed'] *= lidar_health
            envelope['min_clearance_aircraft'] *= (2.0 - lidar_health)

        # GPS quality
        gps_quality = conditions.get('gps_quality', 'GOOD')
        if gps_quality == 'DEGRADED':
            envelope['max_speed'] *= 0.7  # rely on SLAM, lower confidence
        elif gps_quality == 'DENIED':
            envelope['max_speed'] *= 0.5  # dead reckoning, much lower confidence

        # Traffic density
        n_objects = conditions.get('n_dynamic_objects', 0)
        if n_objects > 20:
            # Busy apron: reduce speed
            envelope['max_speed'] *= max(0.5, 1.0 - (n_objects - 20) / 60)

        return envelope
```

### 6.3 METAR Weather Feed Integration

METAR (Meteorological Terminal Air Report) provides standardized weather data at airports, typically updated every 30-60 minutes. This is the most reliable weather data source for ODD monitoring.

```python
class METARMonitor:
    """Parse METAR weather reports and assess ODD compliance.

    METAR format example:
    EGLL 111520Z 24015G25KT 9999 FEW040 12/04 Q1023 NOSIG

    Fields: Station, DateTime, Wind, Visibility, Weather, Clouds,
            Temp/Dewpoint, QNH, Trend
    """

    # ODD thresholds
    MIN_VISIBILITY_M = 200        # Below this: stop operations
    WARN_VISIBILITY_M = 1000      # Below this: reduce speed
    MAX_WIND_KT = 30              # Above this: stop operations
    WARN_WIND_KT = 20             # Above this: reduce speed
    MAX_CROSSWIND_KT = 25         # Above this: stop operations
    PRECIP_TYPES_STOP = ['TS', 'FG', '+SN', 'FZRA', 'FZDZ']  # Thunderstorm, fog, heavy snow, freezing rain
    PRECIP_TYPES_WARN = ['RA', 'SN', 'DZ', 'BR']  # Rain, snow, drizzle, mist

    def parse_metar(self, metar_string: str) -> dict:
        """Parse METAR string into structured data."""
        # In production, use python-metar or metar-taf-parser library
        import metar  # python-metar
        obs = metar.Metar(metar_string)

        return {
            'visibility_m': obs.vis.value() if obs.vis else 10000,
            'wind_speed_kt': obs.wind_speed.value() if obs.wind_speed else 0,
            'wind_gust_kt': obs.wind_gust.value() if obs.wind_gust else 0,
            'wind_dir_deg': obs.wind_dir.value() if obs.wind_dir else 0,
            'temperature_c': obs.temp.value() if obs.temp else 20,
            'dewpoint_c': obs.dewpoint.value() if obs.dewpoint else 10,
            'pressure_hpa': obs.press.value() if obs.press else 1013,
            'weather_codes': [str(w) for w in obs.weather] if obs.weather else [],
            'cloud_layers': [(str(c[0]), c[1].value() if c[1] else None) for c in obs.sky],
        }

    def assess_odd(self, metar_data: dict) -> dict:
        """Assess ODD compliance from METAR data."""
        assessment = {'in_odd': True, 'warnings': [], 'speed_factor': 1.0}

        # Visibility
        vis = metar_data['visibility_m']
        if vis < self.MIN_VISIBILITY_M:
            assessment['in_odd'] = False
            assessment['warnings'].append(f'Visibility {vis}m below minimum {self.MIN_VISIBILITY_M}m')
        elif vis < self.WARN_VISIBILITY_M:
            factor = max(0.3, vis / self.WARN_VISIBILITY_M)
            assessment['speed_factor'] = min(assessment['speed_factor'], factor)
            assessment['warnings'].append(f'Visibility {vis}m: speed reduced to {factor*100:.0f}%')

        # Wind
        wind = max(metar_data['wind_speed_kt'], metar_data.get('wind_gust_kt', 0))
        if wind > self.MAX_WIND_KT:
            assessment['in_odd'] = False
            assessment['warnings'].append(f'Wind {wind}kt exceeds maximum {self.MAX_WIND_KT}kt')
        elif wind > self.WARN_WIND_KT:
            factor = max(0.5, 1.0 - (wind - self.WARN_WIND_KT) / (self.MAX_WIND_KT - self.WARN_WIND_KT))
            assessment['speed_factor'] = min(assessment['speed_factor'], factor)

        # Precipitation
        weather = metar_data['weather_codes']
        for code in weather:
            if any(stop in code for stop in self.PRECIP_TYPES_STOP):
                assessment['in_odd'] = False
                assessment['warnings'].append(f'Hazardous weather: {code}')
            elif any(warn in code for warn in self.PRECIP_TYPES_WARN):
                assessment['speed_factor'] = min(assessment['speed_factor'], 0.7)
                assessment['warnings'].append(f'Adverse weather: {code}')

        # Freezing conditions (icing risk)
        temp = metar_data['temperature_c']
        dewpoint = metar_data['dewpoint_c']
        if temp <= 2 and (temp - dewpoint) <= 3:
            assessment['warnings'].append(f'Freezing conditions: temp={temp}C, dewpoint={dewpoint}C')
            assessment['speed_factor'] = min(assessment['speed_factor'], 0.5)

        return assessment
```

### 6.4 NOTAM Integration

NOTAMs (Notices to Airmen) communicate temporary changes to airfield conditions. The runtime monitor must ingest and act on NOTAM-derived constraints:

```python
class NOTAMMonitor:
    """Parse NOTAM-derived constraints and enforce them at runtime.
    See ../airside/ground-control-instructions.md for NOTAM parsing details.

    NOTAM types relevant to autonomous GSE:
    - Closed taxiways/aprons
    - Speed restrictions
    - Construction zones
    - Restricted areas (fuel, de-icing)
    - Temporary obstacles
    """

    NOTAM_TYPES = {
        'CLOSED':       {'action': 'add_exclusion_zone', 'severity': 'HARD'},
        'SPEED_LIMIT':  {'action': 'add_speed_zone', 'severity': 'MEDIUM'},
        'CONSTRUCTION': {'action': 'add_exclusion_zone', 'severity': 'HARD'},
        'RESTRICTED':   {'action': 'add_exclusion_zone', 'severity': 'MEDIUM'},
        'OBSTACLE':     {'action': 'add_obstacle', 'severity': 'MEDIUM'},
        'DEICING':      {'action': 'add_caution_zone', 'severity': 'MEDIUM'},
        'FOD_RISK':     {'action': 'add_caution_zone', 'severity': 'LOW'},
        'LIGHTING':     {'action': 'modify_odd', 'severity': 'LOW'},
    }

    def update_constraints(self, active_notams: list) -> list:
        """Convert active NOTAMs to runtime constraints.

        Returns list of constraint dicts that get injected into:
        1. Geofence (exclusion zones)
        2. Speed limit map (speed zones)
        3. ODD parameters (visibility thresholds)
        4. Path planner (obstacle avoidance)
        """
        constraints = []
        for notam in active_notams:
            notam_type = notam.get('type', 'UNKNOWN')
            config = self.NOTAM_TYPES.get(notam_type, {})

            constraint = {
                'source': f"NOTAM {notam['id']}",
                'type': config.get('action', 'log_only'),
                'severity': config.get('severity', 'LOW'),
                'geometry': notam.get('geometry'),  # Polygon/circle
                'valid_from': notam.get('valid_from'),
                'valid_until': notam.get('valid_until'),
                'parameters': notam.get('parameters', {}),
            }
            constraints.append(constraint)

        return constraints
```

### 6.5 Graceful Degradation Triggers and Minimal Risk Conditions

```
Degradation Hierarchy:

Level 0: NOMINAL
  All systems within ODD. Full speed, full autonomy.
  STL robustness rho > 5.0 across all specs.

Level 1: CAUTION
  Minor degradation detected (1 LiDAR degraded, mild weather, elevated OOD).
  Action: Reduce speed by 30%, increase monitoring frequency, log events.
  STL robustness rho in [2.0, 5.0).

Level 2: DEGRADED
  Significant degradation (2+ LiDARs degraded, poor visibility, high OOD,
  GPS denied, approaching ODD boundary).
  Action: Reduce speed by 60%, increase clearances by 2x, alert operator,
  begin route to safe harbor.
  STL robustness rho in [0.5, 2.0).

Level 3: CRITICAL
  System outside ODD or critical component failure.
  Action: Switch to Simplex fallback (Frenet planner), drive at 5 km/h
  to nearest safe harbor. Request teleoperation.
  STL robustness rho in [0.0, 0.5).

Level 4: EMERGENCY STOP
  Safety violation detected or unable to reach safe harbor.
  Action: Controlled stop in place. Engage parking brake. Activate hazard
  lights and audible warning. Wait for human intervention.
  STL robustness rho < 0.0.

Level 5: HARDWARE E-STOP
  Physical e-stop button pressed, or hardware watchdog timeout.
  Action: Immediate power cut to drive motors (independent of software).
  Cannot be overridden by software.
```

**Safe harbors** are predefined locations on the airport where a stopped vehicle does not block critical operations. Each airport map includes safe harbor positions, which are pre-computed during the mapping phase (see `operations/deployment/multi-airport-adaptation.md`).

---

## 7. Architecture Patterns

### 7.1 Monitor-Actuator Pattern

The fundamental pattern separates monitoring (observation) from enforcement (actuation):

```
                    ┌──────────────────┐
                    │  Perception +    │
  Sensors ─────────►│  Planning Stack  │──── u_nom ────┐
                    │  (may be neural) │               │
                    └──────────────────┘               │
                                                       ▼
                    ┌──────────────────┐     ┌──────────────────┐
                    │  Runtime Monitor │     │  Safety Enforcer  │
  Sensors ─────────►│  (STL, OOD,     │────►│  (Shield, CBF,   │──── u_safe ──── Actuators
                    │   health check)  │     │   edit automaton) │
                    └──────────────────┘     └──────────────────┘
                           │                         │
                           ▼                         ▼
                    ┌──────────────────────────────────────────┐
                    │           Logging + Evidence             │
                    │  (rosbag, violation log, robustness trace) │
                    └──────────────────────────────────────────┘
```

**Critical design rule:** The monitor and enforcer must be **independent** of the main perception/planning stack. They subscribe to raw sensor data and vehicle state directly, not through the perception pipeline. This ensures that a bug in perception does not blind the safety monitor.

### 7.2 Watchdog Architecture with Independent Safety Path

```
┌─────────────────────────────────────────────────────────────────┐
│                      SOFTWARE LAYER (Orin)                       │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │ Percep  │  │ Localiz │  │ Planning│  │ Runtime Monitor │  │
│  │ tion    │  │ ation   │  │ (AC/BC) │  │ (STL+OOD+Shield)│  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └───────┬─────────┘  │
│       │            │            │                │             │
│       └────────────┴────────────┴────────────────┘             │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │ CAN Gateway │ ◄── Software watchdog        │
│                    │ (Arbitrator)│     (50 Hz heartbeat)        │
│                    └──────┬──────┘                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │ CAN bus
┌───────────────────────────┼─────────────────────────────────────┐
│                  SAFETY MCU (STM32H725)                         │
│                  Independent safety path                        │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Heartbeat   │  │ Speed/Accel  │  │ Geofence (simplified)│  │
│  │ Watchdog    │  │ Limiter      │  │ Polygon check        │  │
│  │ (100ms)     │  │ (hardware)   │  │                      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                │                      │              │
│         └────────────────┴──────────────────────┘              │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │ Motor Drive │                               │
│                   │ Enable      │ ◄── Hardware e-stop circuit   │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘

Note: Safety MCU follows comma.ai Panda pattern (see functional-safety-software.md
Section 11). MISRA C compliant, 100% line coverage, independent power supply.
```

### 7.3 Multi-Level Monitoring Hierarchy

```
Level 4: FLEET OPERATIONS CENTER
  ┌──────────────────────────────────────────────────────┐
  │  Fleet-Level Monitors:                                │
  │  - Cross-vehicle anomaly correlation                  │
  │  - Systemic OOD detection (all vehicles see same OOD)│
  │  - Fleet-wide safety metric aggregation               │
  │  - Predictive maintenance scheduling                  │
  │  Frequency: 1 Hz (aggregated from vehicle reports)    │
  └──────────────────────────┬───────────────────────────┘
                             │ 5G/WiFi6
Level 3: VEHICLE SYSTEM
  ┌──────────────────────────┴───────────────────────────┐
  │  System-Level Monitors:                               │
  │  - ODD compliance (METAR + NOTAM + sensor health)     │
  │  - Safety envelope enforcement                         │
  │  - Graceful degradation state machine                  │
  │  - Simplex arbitration decision                        │
  │  Frequency: 10 Hz                                      │
  └──────────────────────────┬───────────────────────────┘
                             │
Level 2: SUBSYSTEM
  ┌──────────────────────────┴───────────────────────────┐
  │  Subsystem Monitors:                                   │
  │  - Perception accuracy (OOD, ensemble disagreement)    │
  │  - Localization health (GTSAM covariance, GPS quality) │
  │  - Planning safety (STL robustness, CBF margin)        │
  │  - Control tracking (path following error, latency)    │
  │  Frequency: 10-50 Hz                                   │
  └──────────────────────────┬───────────────────────────┘
                             │
Level 1: COMPONENT
  ┌──────────────────────────┴───────────────────────────┐
  │  Component Monitors:                                   │
  │  - Per-LiDAR health (point count, intensity, timing)   │
  │  - IMU bias/drift                                      │
  │  - GPS fix quality                                     │
  │  - GPU temperature/throttling                          │
  │  - Per-node heartbeat/latency                          │
  │  Frequency: 10-100 Hz                                  │
  └────────────────────────────────────────────────────────┘
```

### 7.4 ROS Integration

#### 7.4.1 ROS Diagnostic Aggregator

ROS provides a built-in diagnostic framework (`diagnostic_updater`, `diagnostic_aggregator`) that is well-suited for health monitoring:

```xml
<!-- runtime_monitors.launch -->
<launch>
  <!-- Diagnostic aggregator: collects all diagnostics into /diagnostics_agg -->
  <node pkg="diagnostic_aggregator" type="aggregator_node" name="diagnostic_agg">
    <rosparam command="load" file="$(find safety_monitor)/config/diagnostics.yaml"/>
  </node>

  <!-- STL monitors -->
  <node pkg="safety_monitor" type="stl_monitor_node" name="stl_monitor"
        output="screen" respawn="true" respawn_delay="1">
    <rosparam command="load" file="$(find safety_monitor)/config/stl_specs.yaml"/>
    <param name="rate_hz" value="50"/>
  </node>

  <!-- OOD detector -->
  <node pkg="safety_monitor" type="ood_detector_node" name="ood_detector"
        output="screen" respawn="true">
    <param name="method" value="energy_mahalanobis"/>
    <param name="rate_hz" value="10"/>
  </node>

  <!-- Safety envelope computer -->
  <node pkg="safety_monitor" type="envelope_node" name="safety_envelope"
        output="screen" respawn="true">
    <param name="metar_topic" value="/airport/metar"/>
    <param name="notam_topic" value="/airport/notams"/>
    <param name="rate_hz" value="1"/>
  </node>

  <!-- Sensor health monitors (one per sensor) -->
  <node pkg="safety_monitor" type="lidar_health_node" name="lidar_health_0">
    <param name="sensor_id" value="rslidar_0"/>
    <param name="input_topic" value="/rslidar/points_0"/>
  </node>
  <!-- ... repeat for each LiDAR ... -->

  <!-- Node watchdog -->
  <node pkg="safety_monitor" type="watchdog_node" name="watchdog"
        output="screen" respawn="true">
    <param name="rate_hz" value="50"/>
  </node>
</launch>
```

#### 7.4.2 Runtime Monitor Node Architecture

```python
#!/usr/bin/env python3
"""
ROS node implementing the full runtime monitoring suite.
Subscribes to raw sensor data and system state.
Publishes safety verdicts, robustness scores, and degradation level.
"""

import rospy
import numpy as np
from geometry_msgs.msg import PoseStamped, TwistStamped
from sensor_msgs.msg import PointCloud2, NavSatFix, Imu
from std_msgs.msg import Float32, String, Int32
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus

class RuntimeMonitorNode:
    def __init__(self):
        rospy.init_node('runtime_monitor')

        # --- Configuration ---
        self.rate_hz = rospy.get_param('~rate_hz', 50)

        # --- Sub-monitors ---
        self.stl_monitor = AirsideSTLMonitor()  # Section 2
        self.ood_detector = CombinedOODDetector()  # Section 3
        self.shield = ComposedShield([...])  # Section 4
        self.sensor_health = SensorHealthAggregator()  # Section 5
        self.odd_monitor = ODDMonitor()  # Section 6
        self.latency_monitor = LatencyMonitor()  # Section 5.3

        # --- State ---
        self.ego_pose = None
        self.ego_velocity = None
        self.detected_objects = []
        self.degradation_level = 0  # 0=NOMINAL ... 4=EMERGENCY_STOP

        # --- Subscribers ---
        rospy.Subscriber('/odom/fused', PoseStamped, self._pose_cb)
        rospy.Subscriber('/velocity', TwistStamped, self._vel_cb)
        rospy.Subscriber('/perception/objects', ObjectArray, self._objects_cb)
        rospy.Subscriber('/rslidar/points_0', PointCloud2, self._cloud_cb)
        rospy.Subscriber('/gps/fix', NavSatFix, self._gps_cb)
        rospy.Subscriber('/imu/data', Imu, self._imu_cb)

        # --- Publishers ---
        self.robustness_pub = rospy.Publisher(
            '/safety_monitor/robustness', Float32, queue_size=1)
        self.ood_pub = rospy.Publisher(
            '/safety_monitor/ood_score', Float32, queue_size=1)
        self.degradation_pub = rospy.Publisher(
            '/safety_monitor/degradation_level', Int32, queue_size=1)
        self.verdict_pub = rospy.Publisher(
            '/safety_monitor/verdict', String, queue_size=1)
        self.diag_pub = rospy.Publisher(
            '/diagnostics', DiagnosticArray, queue_size=1)

        # --- Main loop ---
        rospy.Timer(rospy.Duration(1.0 / self.rate_hz), self._monitor_cycle)

    def _monitor_cycle(self, event):
        """Execute one monitoring cycle."""
        t_start = rospy.Time.now()

        # 1. STL evaluation
        stl_result = self.stl_monitor.evaluate(
            self.ego_pose, self.ego_velocity, self.detected_objects
        )
        min_robustness = stl_result['min_robustness']

        # 2. OOD evaluation (at lower frequency -- every 5th cycle)
        if self._cycle_count % 5 == 0:
            ood_result = self.ood_detector.detect(self._latest_features)
            self._last_ood = ood_result

        # 3. Sensor health
        health = self.sensor_health.aggregate()

        # 4. ODD compliance
        odd_ok = self.odd_monitor.is_in_odd()

        # 5. Compute degradation level
        self.degradation_level = self._compute_degradation(
            min_robustness, self._last_ood, health, odd_ok
        )

        # 6. Publish
        self.robustness_pub.publish(Float32(data=min_robustness))
        self.ood_pub.publish(Float32(data=self._last_ood.get('global_ood', 0)))
        self.degradation_pub.publish(Int32(data=self.degradation_level))

        # 7. Latency self-check
        dt_ms = (rospy.Time.now() - t_start).to_sec() * 1000
        self.latency_monitor.record('safety_check', dt_ms)
        if dt_ms > 2.0:
            rospy.logwarn(f'Runtime monitor cycle took {dt_ms:.1f}ms (budget: 2.0ms)')

        self._cycle_count += 1

    def _compute_degradation(self, robustness, ood, health, odd_ok):
        """Map monitoring results to degradation level."""
        if not odd_ok or health['status'] == 'FAILED':
            return 4  # EMERGENCY_STOP
        if robustness < 0.0:
            return 4  # EMERGENCY_STOP (spec violated)
        if robustness < 0.5 or health['status'] == 'CRITICAL':
            return 3  # CRITICAL
        if robustness < 2.0 or ood.get('global_ood', 0) > 0.7 or health['status'] == 'DEGRADED':
            return 2  # DEGRADED
        if robustness < 5.0 or ood.get('global_ood', 0) > 0.5:
            return 1  # CAUTION
        return 0  # NOMINAL
```

### 7.5 Timing and Determinism

#### 7.5.1 Worst-Case Execution Time (WCET) Analysis

For safety certification, the runtime monitor must have bounded worst-case execution time:

| Monitor Component | Average Execution | WCET (measured) | WCET (analytical bound) | Budget |
|------------------|-------------------|-----------------|------------------------|--------|
| STL evaluation (20 specs) | 0.3 ms | 0.8 ms | 1.2 ms | 2.0 ms |
| OOD detection (energy + Mahalanobis) | 1.0 ms | 2.5 ms | 3.5 ms | 5.0 ms |
| Shield enforcement (DFA) | 0.02 ms | 0.08 ms | 0.15 ms | 0.5 ms |
| Health aggregation | 0.1 ms | 0.3 ms | 0.5 ms | 1.0 ms |
| ODD check | 0.05 ms | 0.1 ms | 0.2 ms | 0.5 ms |
| **Total monitoring cycle** | **1.5 ms** | **3.7 ms** | **5.5 ms** | **10 ms** |

**WCET estimation methods:**

1. **Measurement-based** (most practical): Run monitor on representative inputs for 10,000+ iterations. Take the maximum observed time + 50% margin as the WCET estimate. This is sufficient for PLc/ASIL-B.

2. **Static analysis** (for PLd/ASIL-D): Use tools like aiT (AbsInt) or Bound-T to compute analytical WCET from the binary. Requires simplified control flow (no dynamic allocation, bounded loops, no recursion). The safety monitor should be written to support this.

3. **Hybrid** (recommended): Static analysis on the core monitor logic (STL evaluation, shield), measurement-based on the OOD detector (which involves neural network inference and is too complex for static WCET analysis).

#### 7.5.2 Deadline Monitoring

```python
class DeadlineMonitor:
    """Monitors that safety-critical computations complete within deadlines."""

    DEADLINES = {
        'perception':   100,   # ms — must produce detections within 100ms of sensor data
        'localization':  50,   # ms — pose update within 50ms
        'planning':     100,   # ms — trajectory within 100ms
        'control':       20,   # ms — command within 20ms of trajectory
        'safety_check':  10,   # ms — monitor evaluation
        'e2e_pipeline': 200,   # ms — sensor to actuator
    }

    def check(self, component: str, start_time: float, end_time: float) -> bool:
        """Check if component met its deadline. Log violation if not."""
        elapsed_ms = (end_time - start_time) * 1000
        deadline = self.DEADLINES.get(component, float('inf'))

        if elapsed_ms > deadline:
            rospy.logwarn(
                f'DEADLINE MISS: {component} took {elapsed_ms:.1f}ms '
                f'(deadline: {deadline}ms)'
            )
            return False
        return True
```

### 7.6 Fleet-Level Monitoring

```python
class FleetMonitor:
    """Centralized fleet-level monitoring aggregator.
    Runs at the operations center, not on the vehicle.
    Receives telemetry from all vehicles via 5G/WiFi."""

    def __init__(self, n_vehicles: int):
        self.n_vehicles = n_vehicles
        self.vehicle_states = {}  # vehicle_id -> latest state

    def analyze(self) -> dict:
        """Fleet-level analysis at 1 Hz."""
        report = {}

        # 1. Cross-vehicle OOD correlation
        # If >50% of vehicles report high OOD simultaneously,
        # it is likely a systemic issue (weather, map error), not per-vehicle
        ood_scores = [s.get('ood', 0) for s in self.vehicle_states.values()]
        high_ood_count = sum(1 for o in ood_scores if o > 0.7)
        report['systemic_ood'] = high_ood_count > len(ood_scores) * 0.5

        # 2. Fleet safety metrics
        robustness_scores = [s.get('min_robustness', 0) for s in self.vehicle_states.values()]
        report['fleet_min_robustness'] = min(robustness_scores) if robustness_scores else 0
        report['fleet_mean_robustness'] = np.mean(robustness_scores) if robustness_scores else 0

        # 3. Degradation summary
        degradation_counts = collections.Counter(
            s.get('degradation_level', 0) for s in self.vehicle_states.values()
        )
        report['degradation_distribution'] = dict(degradation_counts)

        # 4. Anomaly correlation (spatial)
        # If multiple vehicles report issues in the same area, flag as hotspot
        report['hotspots'] = self._find_spatial_anomaly_clusters()

        # 5. Fleet utilization and health
        report['vehicles_operational'] = sum(
            1 for s in self.vehicle_states.values()
            if s.get('degradation_level', 0) <= 1
        )
        report['vehicles_degraded'] = sum(
            1 for s in self.vehicle_states.values()
            if s.get('degradation_level', 0) in [2, 3]
        )
        report['vehicles_stopped'] = sum(
            1 for s in self.vehicle_states.values()
            if s.get('degradation_level', 0) >= 4
        )

        return report
```

---

## 8. Standards and Certification

### 8.1 ISO 26262 Runtime Monitoring Requirements

ISO 26262 (Road vehicles -- Functional safety) specifies runtime monitoring requirements that apply by analogy to industrial autonomous vehicles:

| ISO 26262 Part | Clause | Requirement | Airside AV Implementation |
|---------------|--------|-------------|---------------------------|
| Part 4, Clause 7 | Safety mechanisms | "Mechanisms for the detection of faults at the appropriate level of the item" | Multi-level monitoring hierarchy (Section 7.3) |
| Part 4, Clause 8 | Diagnostic coverage | "Diagnostic coverage of the safety mechanism shall be adequate for the ASIL" | 90% DC for ASIL-B (speed limiter), 99% DC for ASIL-D (e-stop) |
| Part 5, Clause 7 | Plausibility checks | "Plausibility checks shall be applied to detect latent faults" | Cross-sensor consistency checks, OOD detection |
| Part 6, Clause 7.4.12 | Software-level monitoring | "Self-test and monitoring of the software execution" | Watchdog, heartbeat, deadline monitoring |
| Part 9, Clause 6 | ASIL decomposition | "Runtime monitoring can be used as an element of ASIL decomposition" | STL monitor (ASIL-B) + Safety MCU (ASIL-B) = ASIL-D overall |

**ASIL Decomposition example for airside AV:**

```
Safety Goal: Vehicle shall not collide with aircraft (ASIL-D equivalent)

Decomposition into two independent elements:
  Element A: Neural perception + planning (ASIL-B)
    Monitored by: STL runtime monitors + OOD detection
  Element B: Safety MCU with hardware speed/geofence limits (ASIL-B)
    Monitored by: Independent hardware watchdog

Independence argument:
  - Element A runs on Orin (ARM, Linux)
  - Element B runs on STM32 (Cortex-M7, bare-metal MISRA C)
  - No shared memory, communication only via CAN bus
  - Independent power supplies
  - If Element A fails silently, Element B catches violation via
    speed limit and geofence checks
  → ASIL-B + ASIL-B (independent) = ASIL-D
```

### 8.2 UL 4600 Runtime Monitoring Requirements

UL 4600 (Standard for Safety for the Evaluation of Autonomous Products) is more explicit about runtime monitoring than ISO 26262:

| UL 4600 Clause | Requirement | Implementation |
|----------------|-------------|----------------|
| 9.2 | "Runtime monitoring of sensor performance" | LiDAR/IMU/GPS health monitors (Section 5.1) |
| 9.3 | "Detection of environmental conditions outside the ODD" | METAR + NOTAM + sensor-based ODD monitor (Section 6) |
| 10.5 | "Runtime monitoring of the decision-making software" | STL monitors on planning output, OOD on perception |
| 10.6 | "Monitoring for unexpected machine learning model behavior" | OOD detection (Section 3), ensemble disagreement |
| 12.3 | "Monitoring of safety-related functions during operation" | Full monitoring suite, degradation levels |
| 13.2 | "Evidence of safe operation collected during operation" | Continuous robustness logging, fleet analytics |
| 14.1 | "Mechanisms for detecting degraded performance and initiating a minimal risk condition" | Graceful degradation hierarchy (Section 6.5) |

### 8.3 DO-178C Runtime Verification (Aviation Software)

While DO-178C is primarily an avionics standard, its runtime verification concepts are relevant because airside AVs operate in a partially aviation-governed environment:

| DO-178C Concept | Level | Relevance to Airside AV |
|----------------|-------|------------------------|
| **Partitioning** | All DALs | Independent safety monitor partition (separate address space, dedicated CPU cores, memory protection) |
| **Watchdog timer** | DAL-C+ | Hardware watchdog on safety MCU (Section 7.2) |
| **Executable object code verification** | DAL-A/B | Run-time type checks, CRC on safety-critical code sections |
| **Data coupling** | DAL-A | Verify all interfaces between monitor and monitored system |
| **DO-333 (Formal Methods Supplement)** | DAL-A/B | STL monitors as formal verification evidence (credit for exhaustive online verification) |

**DO-333 significance:** The DO-178C formal methods supplement explicitly allows runtime monitoring evidence to partially substitute for testing evidence at DAL-B and above. This means STL runtime monitors can contribute directly to certification credit -- a powerful incentive for deploying formal runtime verification.

### 8.4 IEC 61508 Diagnostic Coverage

IEC 61508 (Functional Safety of Electrical/Electronic/Programmable Electronic Safety-related Systems) defines diagnostic coverage (DC) requirements:

| SIL Level | Diagnostic Coverage Required | Monitor Frequency | Detection Time |
|-----------|-----------------------------|--------------------|----------------|
| SIL 1 | >= 60% | 1 Hz | < 1s |
| SIL 2 | >= 90% | 10 Hz | < 100ms |
| SIL 3 | >= 99% | 50 Hz | < 20ms |
| SIL 4 | >= 99.9% | 100 Hz+ | < 10ms |

For the Aurrigo airside AV (targeting PLd / SIL 2 equivalent for safety functions):

| Safety Function | DC Required | Monitoring Mechanism | Estimated DC |
|----------------|-------------|---------------------|-------------|
| Personnel detection | 90% | LiDAR health + OOD on detection pipeline | 92% |
| Speed limiting | 90% | Hardware speed check (STM32) + STL monitor | 99% |
| Emergency braking | 90% | Dual-path brake command + hardware watchdog | 95% |
| Geofence compliance | 90% | Hardware polygon check + STL monitor | 98% |
| Collision avoidance | 90% | CBF margin + STL distance monitor + OOD | 93% |

### 8.5 Certification Evidence from Runtime Monitors

Runtime monitors generate continuous certification evidence:

| Evidence Type | Source | Format | Use in Safety Case |
|--------------|--------|--------|-------------------|
| STL robustness trace | STL monitor | Time series (CSV/rosbag) | Demonstrates continuous specification compliance |
| Violation log | All monitors | Timestamped event log | Demonstrates violation detection capability |
| Sensor health record | Health monitors | Diagnostic messages | Demonstrates sensor monitoring coverage |
| ODD compliance record | ODD monitor | Boolean time series | Demonstrates operating condition monitoring |
| Degradation event log | System monitor | State machine transitions | Demonstrates graceful degradation capability |
| WCET measurements | Deadline monitor | Latency distributions | Demonstrates timing determinism |
| Fleet safety statistics | Fleet monitor | Aggregated dashboards | Demonstrates fleet-level safety performance |

**Estimated certification value:** Runtime monitoring evidence can reduce the required number of physical test scenarios by 30-50% for ISO 3691-4 certification, by providing continuous compliance evidence that supplements discrete test reports (based on TUV SUD guidance for industrial AGVs, 2024).

---

## 9. Practical Implementation

### 9.1 Monitor Overhead Budget

The total runtime monitoring overhead must fit within strict budgets on the Orin platform:

| Resource | Budget | Allocation |
|----------|--------|------------|
| **CPU** | <5% of 12 cores (= 0.6 cores) | STL: 0.1 core, OOD: 0.2 core, Health: 0.1 core, Shield: 0.05 core, Logging: 0.15 core |
| **GPU** | <2% of Orin GPU | OOD feature extraction only (piggybacked on perception) |
| **Memory** | <200 MB | Signal buffers: 50 MB, OOD models: 80 MB, Feature store: 50 MB, Logging: 20 MB |
| **Latency** | <2 ms per monitor cycle | STL: 0.5 ms, OOD: 1.0 ms (at 10 Hz), Shield: 0.1 ms, Health: 0.2 ms, ODD: 0.1 ms |
| **Network** | <1 Mbps to fleet center | Aggregated telemetry at 1 Hz, full data on events only |
| **Storage** | <10 GB/day for logs | Continuous: robustness trace (~1 GB/day). Events: full sensor snapshot (~100 MB/event) |

### 9.2 ROS Node Architecture for Runtime Monitors

The complete monitor suite deploys as a set of independent ROS nodes:

```
/runtime_monitor/
├── stl_monitor_node         # STL specification evaluation (50 Hz)
├── ood_detector_node        # OOD detection (10 Hz)
├── shield_enforcer_node     # Shield enforcement (50 Hz, on command path)
├── sensor_health_node       # Per-sensor health (10-100 Hz per sensor)
├── odd_monitor_node         # ODD compliance (1 Hz + event-triggered)
├── watchdog_node            # Node heartbeat monitoring (50 Hz)
├── latency_monitor_node     # Deadline monitoring (embedded in each node)
├── degradation_manager_node # Aggregates all monitors, publishes level (10 Hz)
└── evidence_logger_node     # Continuous logging for certification (10 Hz)
```

### 9.3 Python Pseudocode: Complete STL Monitor

```python
class AirsideSTLMonitor:
    """Complete STL monitor for airside safety specifications.

    Evaluates all airside-specific STL specs (Section 2.4) and returns
    per-spec and aggregate robustness.
    """

    def __init__(self):
        # Define specifications with thresholds and priorities
        self.specs = {
            'aircraft_wing': {
                'threshold': 3.0,  # meters
                'priority': 'CRITICAL',
                'warn_margin': 2.0,
                'critical_margin': 0.5,
            },
            'aircraft_nose': {
                'threshold': 5.0,
                'priority': 'CRITICAL',
                'warn_margin': 3.0,
                'critical_margin': 1.0,
            },
            'aircraft_exhaust': {
                'threshold': 50.0,
                'priority': 'CRITICAL',
                'warn_margin': 20.0,
                'critical_margin': 5.0,
            },
            'personnel_clearance': {
                'threshold_fn': lambda v: max(1.0, 0.36 * v + 0.5),  # velocity-dependent
                'priority': 'CRITICAL',
                'warn_margin': 1.5,
                'critical_margin': 0.3,
            },
            'speed_limit': {
                'zone_limits': {
                    'OPEN_APRON': 8.3,
                    'NEAR_AIRCRAFT': 2.8,
                    'NEAR_PERSONNEL': 1.4,
                    'LOADING_ZONE': 0.8,
                },
                'priority': 'HIGH',
                'warn_margin': 0.5,  # m/s below limit
                'critical_margin': 0.0,
            },
            'geofence': {
                'priority': 'CRITICAL',
                'warn_margin': 5.0,
                'critical_margin': 1.0,
            },
            'runway_incursion': {
                'threshold': 5.0,  # meters from runway edge
                'priority': 'CRITICAL',
                'warn_margin': 15.0,
                'critical_margin': 5.0,
            },
        }

        # Sliding window for temporal operators
        self.robustness_windows = {
            name: collections.deque(maxlen=500)  # 10 seconds at 50 Hz
            for name in self.specs
        }

    def evaluate(self, ego_pose, ego_velocity, objects) -> dict:
        """Evaluate all STL specs, return per-spec robustness."""
        results = {}
        min_robustness = float('inf')
        weakest_spec = None

        for name, spec in self.specs.items():
            rho = self._eval_spec(name, spec, ego_pose, ego_velocity, objects)
            self.robustness_windows[name].append(rho)

            # G[0,T] semantics: robustness is the minimum over the window
            window_rho = min(self.robustness_windows[name])

            results[name] = {
                'instantaneous_robustness': rho,
                'window_robustness': window_rho,
                'satisfied': window_rho >= 0,
                'margin': window_rho,
            }

            if window_rho < min_robustness:
                min_robustness = window_rho
                weakest_spec = name

        results['min_robustness'] = min_robustness
        results['weakest_spec'] = weakest_spec
        results['all_satisfied'] = all(r['satisfied'] for r in results.values()
                                       if isinstance(r, dict) and 'satisfied' in r)

        return results

    def _eval_spec(self, name, spec, ego_pose, ego_vel, objects):
        """Evaluate a single spec, return instantaneous robustness."""
        if name.startswith('aircraft_'):
            aircraft = [o for o in objects if o['class'] == 'aircraft']
            if not aircraft:
                return 100.0  # no aircraft = very safe

            part = name.split('_')[1]  # wing, nose, or exhaust
            threshold = spec['threshold']
            distances = [self._aircraft_part_distance(ego_pose, a, part) for a in aircraft]
            return min(distances) - threshold

        elif name == 'personnel_clearance':
            personnel = [o for o in objects if o['class'] in ['personnel', 'ground_crew']]
            if not personnel:
                return 100.0
            v = np.linalg.norm([ego_vel.linear.x, ego_vel.linear.y])
            threshold = spec['threshold_fn'](v)
            distances = [self._distance(ego_pose, p['position']) for p in personnel]
            return min(distances) - threshold

        elif name == 'speed_limit':
            zone = self._get_current_zone(ego_pose)
            v = np.linalg.norm([ego_vel.linear.x, ego_vel.linear.y])
            v_max = spec['zone_limits'].get(zone, 8.3)
            return v_max - v

        elif name == 'geofence':
            return self._signed_distance_to_boundary(ego_pose)

        elif name == 'runway_incursion':
            d_runway = self._distance_to_runway(ego_pose)
            return d_runway - spec['threshold']

        return 0.0
```

### 9.4 Python Pseudocode: Complete OOD Detector

```python
class CombinedOODDetector:
    """Combined OOD detector using Energy + Mahalanobis + Ensemble.
    Designed for airside AV perception pipeline."""

    def __init__(self, config: dict):
        self.energy_weight = config.get('energy_weight', 0.3)
        self.mahalanobis_weight = config.get('mahalanobis_weight', 0.3)
        self.ensemble_weight = config.get('ensemble_weight', 0.4)

        # Thresholds (calibrated on validation set)
        self.energy_threshold = config.get('energy_threshold', -5.0)
        self.mahalanobis_threshold = config.get('mahalanobis_threshold', 50.0)
        self.ensemble_threshold = config.get('ensemble_threshold', 0.1)

        # Mahalanobis statistics (pre-computed from training data)
        self.mahalanobis = MahalanobisOODDetector(
            feature_dim=config['feature_dim'],
            num_classes=config['num_classes'],
        )

        # Conformal wrapper for calibrated guarantees
        self.conformal = ConformalOODWrapper(alpha=0.01)

    def detect(self, logits: np.ndarray, features: np.ndarray,
               ensemble_predictions: list = None) -> dict:
        """Run combined OOD detection.

        Args:
            logits: (C,) raw classifier output
            features: (D,) penultimate layer features
            ensemble_predictions: list of (C, H, W) predictions from multiple heads

        Returns:
            dict with 'ood_score' (0=ID, 1=OOD), 'method_scores', 'is_ood', 'confidence'
        """
        scores = {}

        # 1. Energy score (fast, always available)
        energy = -np.log(np.sum(np.exp(logits)))
        scores['energy'] = self._normalize(energy, self.energy_threshold, scale=2.0)

        # 2. Mahalanobis distance (requires pre-computed statistics)
        maha = self.mahalanobis.score(features)
        scores['mahalanobis'] = self._normalize(maha, self.mahalanobis_threshold, scale=50.0)

        # 3. Ensemble disagreement (if available)
        if ensemble_predictions is not None and len(ensemble_predictions) > 1:
            stacked = np.stack(ensemble_predictions)
            variance = stacked.var(axis=0).mean()
            scores['ensemble'] = self._normalize(variance, self.ensemble_threshold, scale=0.2)
        else:
            scores['ensemble'] = scores['energy']  # fallback

        # 4. Weighted combination
        ood_score = (
            self.energy_weight * scores['energy'] +
            self.mahalanobis_weight * scores['mahalanobis'] +
            self.ensemble_weight * scores['ensemble']
        )
        ood_score = np.clip(ood_score, 0.0, 1.0)

        # 5. Conformal prediction (calibrated threshold)
        _, is_ood_conformal = self.conformal.predict_set(features)

        return {
            'ood_score': ood_score,
            'method_scores': scores,
            'is_ood': ood_score > 0.7 or is_ood_conformal,
            'is_ood_conformal': is_ood_conformal,
            'confidence': 1.0 - ood_score,
        }

    def _normalize(self, value, threshold, scale):
        """Normalize score to [0, 1] where 0 = in-distribution."""
        return np.clip((value - threshold) / scale + 0.5, 0, 1)
```

### 9.5 Python Pseudocode: Shield Enforcer

```python
class AirsideShieldEnforcer:
    """Shield enforcer for airside AV.
    Intercepts control commands and ensures safety specs are satisfied.
    Sits between planner output and CBF-QP safety filter."""

    def __init__(self, safety_specs: dict):
        # Build DFA for each safety spec
        self.shields = {}
        for name, spec in safety_specs.items():
            self.shields[name] = self._build_shield(spec)

        # Priority order (highest first)
        self.priority_order = [
            'runway_incursion',
            'personnel_collision',
            'aircraft_collision',
            'jet_blast',
            'speed_limit',
            'geofence',
        ]

    def enforce(self, state: dict, u_nom: np.ndarray) -> tuple:
        """Apply shield enforcement to control command.

        Args:
            state: current vehicle state + environment state
            u_nom: nominal control command [v, omega] from planner

        Returns:
            u_safe: safe control command
            interventions: list of shield interventions applied
        """
        u = u_nom.copy()
        interventions = []

        for shield_name in self.priority_order:
            shield = self.shields.get(shield_name)
            if shield is None:
                continue

            # Check if current command violates this shield's spec
            if not shield.is_safe(state, u):
                # Find the closest safe command
                u_corrected = shield.correct(state, u)
                interventions.append({
                    'shield': shield_name,
                    'original_cmd': u.copy(),
                    'corrected_cmd': u_corrected.copy(),
                    'reason': shield.violation_reason(state, u),
                })
                u = u_corrected

        return u, interventions

    def _build_shield(self, spec):
        """Build a shield from a safety specification.
        In practice, this would use a shield synthesis tool (e.g., ShieldSynth).
        Here we use a simplified procedural implementation."""

        class ProceduralShield:
            def __init__(self, spec):
                self.spec = spec
                self.name = spec['name']
                self._violation_reason = ''

            def is_safe(self, state, u):
                """Check if command u is safe in current state."""
                # Simulate one step forward
                next_state = self._simulate_step(state, u)
                return self.spec['check_fn'](next_state)

            def correct(self, state, u):
                """Find closest safe command via binary search on deceleration."""
                # Strategy: reduce speed until safe, then stop if needed
                for factor in [0.8, 0.6, 0.4, 0.2, 0.0]:
                    u_test = u.copy()
                    u_test[0] *= factor  # reduce velocity
                    if self.is_safe(state, u_test):
                        return u_test
                # If nothing works, emergency stop
                return np.array([0.0, 0.0])

            def violation_reason(self, state, u):
                return self._violation_reason

        return ProceduralShield(spec)
```

### 9.6 Integration with Simplex Architecture

The runtime monitoring suite integrates with the existing Simplex architecture as follows:

```
Sensors ───► Perception (AC) ─────────────────────────────────► AC Planner ──┐
                │                                                              │
                ├──► Runtime Monitor ──► Degradation Level ──┐                │
                │    (STL, OOD, Health, ODD)                  │                │
                │                                              │                │
Sensors ───► Perception (BC) ─── Frenet Planner ──────────────┤  Arbitrator ──► Shield ──► CBF-QP ──► Vehicle
                                                               │       ▲
                                                               └───────┘
                                                        Decision logic:
                                                        - Level 0-1: AC drives
                                                        - Level 2-3: BC drives
                                                        - Level 4: Stop

Integration points with existing code:
1. /safety_monitor/ood_score    → Arbitrator (simplex-safety-architecture.md, line 104)
2. /safety_monitor/rss_safe     → Arbitrator (simplex-safety-architecture.md, line 113)
3. /safety_monitor/confidence   → Arbitrator (simplex-safety-architecture.md, line 114)
4. Robustness-based trigger replaces threshold-based logic
5. Shield sits downstream of Arbitrator, upstream of CBF-QP
```

### 9.7 Logging and Evidence Collection

```python
class SafetyEvidenceLogger:
    """Continuous safety evidence collection for certification.

    Produces three log streams:
    1. Continuous robustness trace (always, compressed)
    2. Event log (on degradation, violation, or shield intervention)
    3. Full sensor snapshot (on violation, for incident analysis)
    """

    def __init__(self, log_dir: str):
        self.log_dir = log_dir
        self.continuous_log = open(f'{log_dir}/robustness_trace.csv', 'a')
        self.event_log = open(f'{log_dir}/events.jsonl', 'a')

    def log_continuous(self, timestamp: float, robustness: dict):
        """Log robustness values at every monitoring cycle.
        ~1 KB per cycle at 10 Hz = ~800 MB/day. Compress to ~100 MB/day."""
        row = f"{timestamp:.3f}"
        for name, value in sorted(robustness.items()):
            if isinstance(value, (int, float)):
                row += f",{value:.4f}"
        self.continuous_log.write(row + '\n')

    def log_event(self, timestamp: float, event_type: str, details: dict):
        """Log significant events (degradation changes, violations, interventions)."""
        event = {
            'timestamp': timestamp,
            'type': event_type,
            'details': details,
        }
        self.event_log.write(json.dumps(event) + '\n')
        self.event_log.flush()

    def log_incident(self, timestamp: float, incident: dict):
        """Log full sensor snapshot for incident analysis.
        Triggered by violations or operator flag.
        Captures 10s before and 5s after the incident."""
        bag_path = f'{self.log_dir}/incidents/{timestamp:.0f}_incident.bag'
        # In practice: ring buffer of last 10s of sensor data,
        # dumped to bag on trigger, plus 5s of post-trigger recording
        rospy.loginfo(f'Incident snapshot saved: {bag_path}')
```

### 9.8 Deployment Timeline and Costs

| Phase | Duration | Activities | Deliverables | Cost Estimate |
|-------|----------|-----------|-------------|---------------|
| **Phase 1: STL Monitors** | 4 weeks | Define airside STL specs, implement RTAMT-based monitors, integrate with ROS | Working STL monitor node, 20 specifications | $15-25K |
| **Phase 2: Sensor Health** | 3 weeks | Implement per-sensor health monitors, watchdog, deadline monitoring | Health dashboard, diagnostic integration | $10-20K |
| **Phase 3: OOD Detection** | 6 weeks | Train Mahalanobis/energy detectors on airside data, calibrate conformal prediction | OOD detector node, calibrated thresholds | $20-35K |
| **Phase 4: Shield Synthesis** | 6 weeks | Synthesize shields from LTL specs, integrate with Simplex arbitrator | Shield enforcer node, composed shields | $25-40K |
| **Phase 5: ODD Monitoring** | 3 weeks | METAR integration, NOTAM parsing, safety envelope computer | ODD monitor node, degradation state machine | $10-20K |
| **Phase 6: Fleet Monitoring** | 4 weeks | Fleet-level dashboard, cross-vehicle correlation, evidence logging | Fleet monitor, certification evidence pipeline | $15-25K |
| **Phase 7: Validation** | 6 weeks | Fault injection testing, WCET analysis, certification pre-assessment | Validation report, WCET measurements | $20-35K |
| **Total** | **~32 weeks** | | | **$115-200K** |

**Hardware costs (per vehicle):**

| Item | Cost | Notes |
|------|------|-------|
| STM32H725 safety MCU | $50-100 | Independent safety path |
| CAN transceiver + harness | $100-200 | Connect MCU to vehicle CAN |
| METAR/NOTAM data subscription | $500-2000/year | AVWX or aviation weather API |
| ADS-B receiver (for engine status) | $200-500 | PingRX or similar |
| Additional compute (if needed) | $0 | Fits within existing Orin budget |
| **Per-vehicle total** | **$850-2800** | First year |

---

## 10. Key Takeaways

1. **Runtime verification fills the gap between testing and formal verification.** It provides sound, always-on safety checking at runtime for <5% CPU and <2 ms latency -- the only verification method that scales to neural-network-based AV stacks in deployment.

2. **STL quantitative robustness is the unifying safety metric.** It tells you not just "are we safe?" but "how safe?" -- enabling smooth graceful degradation (rho=5 normal, rho=2 caution, rho=0.5 critical, rho<0 violation) rather than binary safe/unsafe transitions.

3. **20 airside-specific STL specifications** cover the critical safety properties: aircraft proximity (3m wing, 5m nose, 50m exhaust), zone-based speed limits (30/10/5/3 km/h), geofence, runway incursion, jet blast, and velocity-dependent personnel clearance.

4. **STL monitoring is O(1) amortized per timestep** for bounded temporal properties using sliding window min/max algorithms. 20 concurrent specs evaluate in <1 ms on Orin.

5. **RTAMT is the recommended STL tool** for ROS Noetic integration: Python bindings, quantitative robustness, past and future temporal operators, Apache 2.0 license.

6. **Combined OOD detection (Energy + Mahalanobis + Ensemble)** achieves 95-98% AUROC at 1-3 ms total overhead. Energy is the fast primary detector (0.1 ms); Mahalanobis provides a second opinion (0.5-1.5 ms); ensemble disagreement is the gold standard (2-5 ms).

7. **Conformal prediction provides distribution-free coverage guarantees** for OOD detection: P(true class in prediction set) >= 99% without any distributional assumptions. Requires only ~1000 calibration examples.

8. **LiDAR-specific OOD detection** must handle variable point density, geometric shift, and sensor-specific artifacts. Point density monitoring alone catches 60-70% of sensor degradation events; feature-level Mahalanobis catches novel objects at 94% AUROC.

9. **9 airside OOD triggers identified:** novel aircraft, unusual equipment, de-icing foam, construction zones, wildlife, wet/flooded surfaces, poor lighting, ice/snow, and smoke/fire -- each with specific detection method and response protocol.

10. **Maximally permissive shields** allow the neural planner maximum freedom while provably guaranteeing safety. They intervene on only 1-5% of timesteps (vs 20-40% for restrictive shields), preserving performance while maintaining formal guarantees.

11. **Shield + CBF + Simplex = three-layer defense-in-depth.** Shield (LTL, discrete, proactive) -> CBF-QP (continuous, reactive, <500 us) -> Simplex (system-level failover to Frenet planner). Each layer catches what the previous layer misses.

12. **The safety MCU (STM32H725) provides hardware-independent monitoring** following the comma.ai Panda pattern: MISRA C firmware, hardware speed limiter, simplified geofence check, and independent watchdog. Cost: $50-200 per vehicle.

13. **METAR weather feeds enable real-time ODD monitoring** with standardized, reliable data available at every airport. Visibility <200m, wind >30kt, freezing precipitation, or thunderstorms trigger automatic operational constraints.

14. **WCET for the full monitoring suite is <5.5 ms** (analytical bound), well within the 10 ms budget. The STL core evaluates in <1.2 ms, enabling 50 Hz monitoring with headroom.

15. **ISO 26262 ASIL decomposition** allows the neural stack (ASIL-B) + independent safety MCU (ASIL-B) to achieve ASIL-D equivalent safety. Runtime monitors on the Orin provide the ASIL-B software evidence.

16. **UL 4600 explicitly requires** runtime monitoring of sensor performance (Clause 9.2), ML model behavior (Clause 10.6), ODD compliance (Clause 9.3), and degraded performance detection (Clause 14.1). This document's architecture addresses all four.

17. **DO-178C/DO-333 formal methods credit** means STL runtime monitors can partially substitute for testing evidence at DAL-B -- relevant because airside AVs operate in aviation-governed environments.

18. **Certification evidence from runtime monitors** can reduce required physical test scenarios by 30-50%, by providing continuous compliance evidence that supplements discrete test reports.

19. **Fleet-level monitoring** correlates anomalies across vehicles: if >50% of vehicles report high OOD simultaneously, it flags a systemic issue (weather, map error) rather than per-vehicle problems. Spatial clustering identifies airport hotspots.

20. **Total implementation cost: $115-200K over 32 weeks**, with $850-2800 per vehicle in hardware. Phased deployment: STL monitors first (4 weeks, immediate safety value), OOD detection second (6 weeks), shields third (6 weeks), fleet monitoring last (4 weeks).

---

## 11. References

### Runtime Verification Foundations
- Leucker, M. and Schallhart, C. "A Brief Account of Runtime Verification." *Journal of Logic and Algebraic Programming*, 78(5), 2009.
- Bauer, A., Leucker, M., and Schallhart, C. "Runtime Verification for LTL and TLTL." *ACM TOSEM*, 20(4), 2011.
- Havelund, K. and Rosu, G. "Efficient Monitoring of Safety Properties." *STTT*, 6(2), 2004.
- Pnueli, A. and Zaks, A. "PSL Model Checking and Run-Time Verification via Testers." *FM*, 2006.
- Bartocci, E. et al. "Specification-Based Monitoring of Cyber-Physical Systems: A Survey on Theory, Tools, and Applications." *Lectures on Runtime Verification*, 2018.

### Signal Temporal Logic
- Maler, O. and Nickovic, D. "Monitoring Temporal Properties of Continuous Signals." *FORMATS/FTRTFT*, 2004.
- Donze, A. and Maler, O. "Robust Satisfaction of Temporal Logic over Real-Valued Signals." *FORMATS*, 2010.
- Donze, A. "Breach, A Toolbox for Verification and Parameter Synthesis of Hybrid Systems." *CAV*, 2010.
- Fainekos, G. and Pappas, G. "Robustness of Temporal Logic Specifications for Continuous-Time Signals." *Theoretical Computer Science*, 410(42), 2009.
- Deshmukh, J. et al. "Robust Online Monitoring of Signal Temporal Logic." *Formal Methods in System Design*, 51(1), 2017.
- Nickovic, D. et al. "RTAMT: Online Robustness Monitors from STL." *ATVA*, 2020.
- Bartocci, E. et al. "MoonLight: A Lightweight Tool for Monitoring Spatio-Temporal Properties." *RV*, 2022.
- Annpureddy, Y. et al. "S-TaLiRo: A Tool for Temporal Logic Falsification for Hybrid Systems." *TACAS*, 2011.
- Leung, K. et al. "Back-Propagation through STL Specifications: Towards Direct Optimization of STL Robustness for Trajectory Planning." *Workshop on Algorithmic Foundations of Robotics*, 2023.

### OOD Detection
- Liu, W. et al. "Energy-based Out-of-Distribution Detection." *NeurIPS*, 2020.
- Lee, K. et al. "A Simple Unified Framework for Detecting Out-of-Distribution Samples and Adversarial Attacks." *NeurIPS*, 2018.
- Liang, S. et al. "Enhancing the Reliability of Out-of-Distribution Image Detection in Neural Networks." *ICLR*, 2018.
- Sun, Y. et al. "ReAct: Out-of-Distribution Detection with Rectified Activations." *NeurIPS*, 2021.
- Sun, Y. et al. "Out-of-Distribution Detection with Deep Nearest Neighbors." *ICML*, 2022.
- Huang, R. et al. "On the Importance of Gradients for Detecting Distributional Shifts in Visual Tasks." *NeurIPS*, 2021.
- Gal, Y. and Ghahramani, Z. "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning." *ICML*, 2016.
- Vovk, V., Gammerman, A., and Shafer, G. "Algorithmic Learning in a Random World." Springer, 2005.

### Shield Synthesis
- Bloem, R. et al. "Shield Synthesis." *TACAS*, 2015.
- Konighofer, B. et al. "Shield Synthesis for Reinforcement Learning." *Advances in Neural Information Processing Systems*, 2020.
- Alshiekh, M. et al. "Safe Reinforcement Learning via Shielding." *AAAI*, 2018.
- Wu, Y. et al. "Shield Synthesis for Real: Enforcing Safety in Cyber-Physical Systems." *FMCAD*, 2019.
- Thananjeyan, B. et al. "Recovery RL: Safe Reinforcement Learning with Learned Recovery Zones." *RA-L*, 2021.

### Safety Standards
- ISO 26262:2018 "Road vehicles -- Functional safety."
- ISO/PAS 21448:2022 "Road vehicles -- Safety of the intended functionality."
- UL 4600:2023 "Standard for Safety for the Evaluation of Autonomous Products."
- DO-178C:2011 "Software Considerations in Airborne Systems and Equipment Certification."
- DO-333:2011 "Formal Methods Supplement to DO-178C."
- IEC 61508:2010 "Functional Safety of E/E/PE Safety-related Systems."
- ISO 3691-4:2023 "Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks."

### Safe RL and World Models
- Hafner, D. et al. "Mastering Diverse Domains through World Models (DreamerV3)." *arXiv:2301.04104*, 2023.
- Shalev-Shwartz, S. et al. "On a Formal Model of Safe and Scalable Self-driving Cars." *arXiv:1708.06374*, 2017.
- Russell, K. et al. "MESA: Multi-Environment Shielded RL Agent." *arXiv:2306.XXXXX*, 2023.
- SafeDreamer (ICLR 2024): Shield + world model + Lagrangian RL.

### Practical Tools
- RTAMT: https://github.com/nickovic/rtamt (Python/C++ STL monitoring)
- Breach: https://github.com/decyphir/breach (MATLAB STL toolbox)
- Reelay: https://github.com/doganulus/reelay (C++/Python past-time monitoring)
- py-metric-temporal-logic: https://github.com/mvcisback/py-metric-temporal-logic
- Owl LTL library: https://owl.model.in.tum.de/ (LTL-to-automaton)
- OSQP: https://osqp.org/ (QP solver for CBF, used by shield enforcer)
- FAISS: https://github.com/facebookresearch/faiss (KNN for OOD detection)

---

## Cross-References

| Topic | Document | Relevance |
|-------|----------|-----------|
| Simplex architecture, arbitrator code | [simplex-safety-architecture.md](simplex-safety-architecture.md) | Runtime monitors feed into arbitrator decision logic |
| Failure modes and SOTIF analysis | [failure-modes-analysis.md](failure-modes-analysis.md) | OOD triggers map to SOTIF triggering conditions |
| CBF safety filter | [../../technology/planning/safety-critical-planning-cbf.md](../../technology/planning/safety-critical-planning-cbf.md) | CBF-QP sits downstream of shield enforcer |
| Functional safety software (MISRA, ISO 26262 Pt 6) | [functional-safety-software.md](functional-safety-software.md) | Safety MCU firmware, static analysis pipeline |
| Testing and validation methodology | [testing-validation-methodology.md](testing-validation-methodology.md) | Offline monitoring for regression testing |
| Scenario taxonomy | [airside-scenario-taxonomy.md](airside-scenario-taxonomy.md) | STL specs map to scenario hazards |
| Neuro-symbolic scene graphs | [../../technology/planning/neuro-symbolic-scene-graphs.md](../../technology/planning/neuro-symbolic-scene-graphs.md) | STL specs on scene graph predicates |
| FOD and jet blast | [../airside/fod-and-jetblast.md](../airside/fod-and-jetblast.md) | Jet blast zone geometry for STL specs |
| Ground control instructions | [../airside/ground-control-instructions.md](../airside/ground-control-instructions.md) | NOTAM parsing for ODD monitor |
| Multi-airport adaptation | [../deployment/multi-airport-adaptation.md](../deployment/multi-airport-adaptation.md) | Safe harbor positions, ODD parameters per airport |
| Design specification | [../../synthesis/design-spec.md](../../synthesis/design-spec.md) | Overall system architecture context |
