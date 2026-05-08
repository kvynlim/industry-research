# Testing and Validation Methodology for Airside Autonomous Vehicles

> A comprehensive guide to systematically testing and validating autonomous ground vehicles for airport airside operations. Covers the V-model testing framework, scenario-based testing with ASAM OpenSCENARIO 2.0, coverage metrics, statistical safety arguments, simulation-based V&V (SIL/HIL/VIL), shadow mode validation, regression testing, digital twin construction, airside-specific test protocols, and test infrastructure requirements. Designed to produce the certification evidence required by ISO 3691-4, EU Machinery Regulation 2023/1230, UL 4600, and anticipated FAA Advisory Circulars.

---

## Table of Contents

1. [Testing Framework Overview](#1-testing-framework-overview)
2. [Scenario-Based Testing](#2-scenario-based-testing)
3. [Coverage Metrics](#3-coverage-metrics)
4. [Corner Case and Adversarial Testing](#4-corner-case-and-adversarial-testing)
5. [Simulation-Based Verification and Validation](#5-simulation-based-verification-and-validation)
6. [Statistical Safety Arguments](#6-statistical-safety-arguments)
7. [Shadow Mode Validation](#7-shadow-mode-validation)
8. [Regression Testing](#8-regression-testing)
9. [Digital Twin Validation for Airside](#9-digital-twin-validation-for-airside)
10. [Airside-Specific Test Protocols](#10-airside-specific-test-protocols)
11. [Test Infrastructure Requirements](#11-test-infrastructure-requirements)
12. [Key Findings Summary](#12-key-findings-summary)
13. [References](#13-references)

---

## 1. Testing Framework Overview

### 1.1 The V-Model for Autonomous Vehicles

The V-model is the industry-standard systems engineering process for safety-critical development. For autonomous vehicles, it maps the progression from requirements through design and implementation on the left side, with corresponding verification and validation activities mirrored on the right side. Each level on the left produces artifacts that are verified by the matching level on the right.

```
Requirements Analysis  ─────────────────────────────  Acceptance Testing
  (ODD, safety goals,                                   (Airport field trials,
   performance targets)                                   regulatory demonstration)
        │                                                       ▲
        ▼                                                       │
  System Design  ──────────────────────────────────  System Testing
  (Architecture, interfaces,                           (Full vehicle on test track,
   Simplex dual-stack)                                   SIL full-stack sim)
        │                                                       ▲
        ▼                                                       │
  Subsystem Design  ───────────────────────────────  Integration Testing
  (Perception, planning,                               (Subsystem interfaces,
   control, safety monitor)                              sensor fusion, HIL)
        │                                                       ▲
        ▼                                                       │
  Module Design  ──────────────────────────────────  Unit Testing
  (LiDAR segmentation,                                (Module-level tests,
   Frenet planner, GTSAM)                               code coverage, MC/DC)
        │                                                       ▲
        ▼                                                       │
  Implementation  ─────────────────────────────────  Code Review + Static Analysis
  (C++ nodelets, Python                                (MISRA C, cppcheck,
   scripts, model weights)                               clang-tidy, Polyspace)
```

### 1.2 Mapping to ISO 3691-4

ISO 3691-4:2023 Section 5 (Testing and Verification) requires specific test procedures that map to V-model levels as follows:

| ISO 3691-4 Requirement | V-Model Level | Test Method | Evidence Artifact |
|------------------------|---------------|-------------|-------------------|
| Hazard identification (Clause 4.1) | Requirements | Risk assessment workshop | Hazard log, STPA analysis |
| Safety function specification (Clause 4.2) | System design | Requirements traceability | Safety requirements spec |
| Personnel detection (Clause 4.3) | Integration testing | Physical test with dummies, SiL | Detection rate report |
| Emergency stop (Clause 4.4) | System testing | Physical braking tests | Stopping distance data |
| Speed limiting (Clause 4.5) | Unit testing | Speedometer calibration | Speed verification log |
| Warning devices (Clause 4.6) | Integration testing | Audible/visual warning tests | Warning test report |
| Environmental testing (Clause 4.7) | System testing | Weather matrix tests | Environmental test report |
| Documentation (Clause 6) | All levels | Document review | Technical Construction File |

### 1.3 Mapping to EU Machinery Regulation 2023/1230

The EU Machinery Regulation 2023/1230 (replacing Directive 2006/42/EC, effective 20 January 2027) introduces new requirements specifically for autonomous mobile machinery with AI components:

| Regulation Requirement | Testing Implication |
|------------------------|---------------------|
| Article 5: Conformity assessment for high-risk AI | Third-party assessment required for autonomous vehicles (not self-certification) |
| Annex III, Section 1.1.2: Principles of safety integration | V-model evidence across all levels |
| Annex III, Section 1.2.1: Safety and reliability of control systems | PLd (ISO 13849-1) for safety-critical functions; systematic failure testing |
| Annex III, Section 1.3.7: Risks related to moving parts | Collision avoidance testing at all operating speeds |
| Annex III, Section 1.6.1: Maintenance | Testing that maintenance procedures do not introduce unsafe states |
| AI-specific: Continuous learning systems | Evidence that model updates do not degrade safety (regression testing) |
| AI-specific: Cybersecurity | Penetration testing, adversarial input testing |

### 1.4 Mapping to UL 4600 and ANSI/UL 3100

UL 4600 (Standard for Safety for the Evaluation of Autonomous Products) provides a framework that is complementary to ISO 3691-4 and is increasingly referenced for AV safety cases in North America.

| UL 4600 Topic | V-Model Mapping | Key Activities |
|---------------|-----------------|----------------|
| Clause 7: Risk assessment | Requirements | ODD definition, hazard analysis, SOTIF triggering conditions |
| Clause 8: Lifecycle management | All levels | Configuration management, change impact analysis |
| Clause 9: Sensor validation | Unit / Integration | Sensor performance characterization, degradation testing |
| Clause 10: Software validation | Unit / Integration | Code coverage, static analysis, formal verification |
| Clause 11: Interaction safety | System testing | Personnel detection, mixed traffic, teleoperation handoff |
| Clause 12: Operational safety | Acceptance | Shadow mode results, intervention rates, field trial data |
| Clause 13: Continuous improvement | Post-deployment | OTA update validation, regression gates, fleet monitoring |

ANSI/UL 3100 (Standard for Safety for Autonomous Mobile Platforms) applies more directly to industrial autonomous vehicles and references ISO 3691-4 while adding North American-specific requirements for obstacle detection testing and pathway safety.

### 1.5 Testing Philosophy: Defense in Depth

No single testing method is sufficient for autonomous vehicle safety certification. The industry has converged on a defense-in-depth approach where multiple testing layers provide overlapping evidence:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5: Field Operations Monitoring (continuous)      │
│  Fleet telemetry, intervention tracking, incident review│
├─────────────────────────────────────────────────────────┤
│  Layer 4: Shadow Mode (50,000+ km before autonomous)    │
│  Real-world data, no safety risk, decision comparison   │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Physical Testing (test track + airport)       │
│  Hardware validation, real sensor performance           │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Hardware-in-the-Loop (10,000+ hours)          │
│  Real compute + simulated sensors, timing validation    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Software-in-the-Loop (10M+ scenario-km)       │
│  Statistical coverage, adversarial search, regression   │
├─────────────────────────────────────────────────────────┤
│  Layer 0: Code-Level Verification (continuous)          │
│  Static analysis, unit tests, MC/DC, formal methods     │
└─────────────────────────────────────────────────────────┘
```

Each layer catches different failure modes. Code-level verification catches logic errors and coding standard violations. SiL catches algorithmic failures across millions of scenarios. HiL catches timing issues and hardware interaction bugs. Physical testing validates real-world sensor performance. Shadow mode validates the full system in the real operational environment. Field monitoring catches long-tail scenarios that no other layer can reach.

---

## 2. Scenario-Based Testing

### 2.1 ASAM OpenSCENARIO 2.0 for Scenario Specification

ASAM OpenSCENARIO 2.0 (now known as OpenSCENARIO DSL) provides a domain-specific language for describing driving scenarios at multiple levels of abstraction. Unlike OpenSCENARIO 1.x (XML-based, concrete scenarios only), the DSL supports abstract and logical scenario definitions with constraint-based parameter variation.

**Core concepts:**

| Concept | Description | Example |
|---------|-------------|---------|
| **Actor** | Entity participating in the scenario | `ego_vehicle`, `ground_crew_member`, `aircraft_a320` |
| **Action** | Behavior performed by an actor | `drive_to(stand_42)`, `emergency_stop()`, `cross_path()` |
| **Event** | Trigger that initiates an action | `distance_to(ego, aircraft) < 5m`, `turnaround_phase == loading` |
| **Parameter** | Variable with range or distribution | `ego_speed: [5..25] km/h`, `visibility: [50..1000] m` |
| **Constraint** | Relationship between parameters | `ego_speed <= max_speed_for_zone(zone)` |
| **Coverage** | Metric tracked over parameter space | `cover(ego_speed, every(1, km/h))` |

**Airside domain extensions** (extending the taxonomy from `airside-scenario-taxonomy.md`):

```
// Airside actor types
type airside_actor inherits actor:
    role: airside_role

type airside_role: enum of [
    baggage_tractor, belt_loader, container_loader,
    catering_truck, fuel_truck, pushback_tug,
    gpu, lavatory_truck, water_truck,
    passenger_stairs, deicing_truck, follow_me_car,
    ground_crew_standing, ground_crew_crouching,
    marshaller, wing_walker, ramp_agent,
    aircraft_narrow_body, aircraft_wide_body,
    emergency_vehicle, maintenance_vehicle
]

// Airside environment
type airside_environment:
    zone: airside_zone
    weather: weather_condition
    lighting: lighting_condition
    surface: surface_condition
    temperature_c: float
    wind_speed_kt: float
    wind_direction_deg: float

type airside_zone: enum of [
    apron, service_road, taxiway_crossing,
    depot, maintenance_area, fuel_farm_perimeter,
    deicing_pad, cargo_area
]

// Scenario template
scenario airside_transit_with_crossing:
    ego: baggage_tractor
    environment: airside_environment
    
    do parallel:
        ego.drive_along(service_road_route)
        with:
            speed(ego) in [10..25] km/h
    
    do serial:
        wait elapsed(uniform(30, 120) s)
        aircraft_1.taxi_across(crossing_point)
        with:
            speed(aircraft_1) in [8..15] m/s
            distance_at_crossing(ego, aircraft_1) in [20..200] m
    
    cover(speed(ego), every(2.5, km/h))
    cover(distance_at_crossing, every(10, m))
```

### 2.2 Three-Tier Scenario Abstraction

Following ISO 34502 adapted for airside (see `airside-scenario-taxonomy.md` Section 2.1), each scenario is refined through three tiers:

**Tier 1: Functional Scenario (natural language)**

> "Autonomous baggage tractor approaches a narrow-body aircraft stand while a belt loader is operating on the opposite side and ground crew are walking between the aircraft fuselage and adjacent GSE."

**Tier 2: Logical Scenario (parameterized)**

| Parameter | Range | Distribution |
|-----------|-------|--------------|
| ego_speed | 5-15 km/h | Uniform |
| aircraft_type | A320, B737, A321 | Categorical (40%, 35%, 25%) |
| belt_loader_position | Left/Right of aircraft nose | Uniform |
| num_ground_crew | 1-5 | Poisson(lambda=2) |
| crew_behavior | Standing, Walking, Crouching | Categorical (30%, 50%, 20%) |
| lighting | Day, Dusk, Night | Categorical (50%, 20%, 30%) |
| surface_condition | Dry, Wet, Icy | Categorical (60%, 30%, 10%) |
| ego_approach_angle | -30 to +30 degrees from centerline | Normal(0, 10) |

**Tier 3: Concrete Scenario (executable)**

> ego_speed=11.2 km/h, aircraft=A320, belt_loader=Left, num_crew=3, crew_behavior=[Walking, Standing, Crouching], lighting=Dusk, surface=Wet, approach_angle=+7.3 degrees. Crew member #2 at position (12.4, -3.1) steps into ego path at t=4.7s.

### 2.3 Concrete Scenario Generation from Logical Scenarios

Given the parameterized logical scenario, concrete scenarios are generated through several complementary strategies:

**Strategy 1: Grid sampling (deterministic coverage)**

Discretize each parameter and sample the full grid. For 8 parameters with 5 levels each: 5^8 = 390,625 concrete scenarios per logical scenario. This is feasible in simulation but excessive -- use covering arrays (Section 2.4) to reduce.

**Strategy 2: Random sampling (Monte Carlo)**

Sample parameters from their specified distributions. Simple to implement but provides poor coverage of rare parameter combinations. Useful for initial exploration.

**Strategy 3: Latin Hypercube Sampling (stratified)**

Divide each parameter range into N equal strata, sample once from each stratum, then randomly pair across parameters. Ensures better coverage than pure Monte Carlo with the same number of samples.

**Strategy 4: Importance sampling (Section 2.5)**

Bias sampling toward regions of the parameter space where failures are more likely. Requires a prior estimate of failure probability (from previous test campaigns or expert judgment).

**Strategy 5: Adversarial search (Section 4)**

Use optimization algorithms (CMA-ES, Bayesian optimization) to actively search for failure-inducing parameter combinations.

```python
import numpy as np
from scipy.stats import qmc

class ScenarioGenerator:
    """Generate concrete scenarios from logical scenario parameters."""
    
    def __init__(self, parameter_defs: dict):
        """
        parameter_defs: {
            'ego_speed': {'type': 'continuous', 'low': 5, 'high': 25, 'unit': 'km/h'},
            'lighting': {'type': 'categorical', 'values': ['day', 'dusk', 'night'],
                         'probabilities': [0.5, 0.2, 0.3]},
            'num_crew': {'type': 'discrete', 'low': 0, 'high': 8},
            ...
        }
        """
        self.params = parameter_defs
        self.continuous_params = {k: v for k, v in parameter_defs.items() 
                                  if v['type'] == 'continuous'}
        self.categorical_params = {k: v for k, v in parameter_defs.items() 
                                    if v['type'] == 'categorical'}
        self.discrete_params = {k: v for k, v in parameter_defs.items() 
                                 if v['type'] == 'discrete'}
    
    def latin_hypercube(self, n_samples: int, seed: int = 42) -> list[dict]:
        """Generate scenarios using Latin Hypercube Sampling."""
        n_continuous = len(self.continuous_params)
        sampler = qmc.LatinHypercube(d=n_continuous, seed=seed)
        unit_samples = sampler.random(n=n_samples)  # [0,1]^d
        
        scenarios = []
        for i in range(n_samples):
            scenario = {}
            # Map continuous parameters from [0,1] to their ranges
            for j, (name, pdef) in enumerate(self.continuous_params.items()):
                scenario[name] = pdef['low'] + unit_samples[i, j] * (pdef['high'] - pdef['low'])
            # Sample categorical parameters
            for name, pdef in self.categorical_params.items():
                scenario[name] = np.random.choice(pdef['values'], p=pdef['probabilities'])
            # Sample discrete parameters
            for name, pdef in self.discrete_params.items():
                scenario[name] = np.random.randint(pdef['low'], pdef['high'] + 1)
            scenarios.append(scenario)
        return scenarios
    
    def importance_sample(self, n_samples: int, failure_prior: callable,
                          oversampling_factor: float = 5.0) -> list[dict]:
        """
        Sample with bias toward high-failure-probability regions.
        failure_prior: function(scenario_dict) -> float [0,1] estimated failure probability
        """
        # Generate candidate pool
        candidates = self.latin_hypercube(int(n_samples * oversampling_factor))
        # Score each candidate
        scores = np.array([failure_prior(s) for s in candidates])
        # Normalize to probability distribution
        probs = scores / scores.sum()
        # Sample without replacement proportional to failure probability
        indices = np.random.choice(len(candidates), size=n_samples, 
                                   replace=False, p=probs)
        return [candidates[i] for i in indices]
    
    def grid_sample(self, levels_per_param: int = 5) -> list[dict]:
        """Full grid sampling (use with caution -- combinatorial explosion)."""
        import itertools
        grids = {}
        for name, pdef in self.continuous_params.items():
            grids[name] = np.linspace(pdef['low'], pdef['high'], levels_per_param).tolist()
        for name, pdef in self.categorical_params.items():
            grids[name] = pdef['values']
        for name, pdef in self.discrete_params.items():
            grids[name] = list(range(pdef['low'], pdef['high'] + 1))
        
        keys = list(grids.keys())
        values = [grids[k] for k in keys]
        scenarios = [dict(zip(keys, combo)) for combo in itertools.product(*values)]
        return scenarios
```

### 2.4 N-Wise Parameter Combination (Covering Arrays)

Full combinatorial testing is intractable for scenarios with many parameters. Covering arrays provide a mathematically principled way to reduce the number of test cases while guaranteeing that every combination of N parameters is tested at least once.

**Definitions:**

- **Pairwise (2-wise) covering array:** Every pair of parameter values appears in at least one test case. For k parameters with v values each, the minimum size is approximately v^2 * ln(k), which is O(v^2 * log(k)) -- much smaller than v^k.
- **3-wise covering array:** Every triple of parameter values appears. Stronger coverage but more test cases.
- **N-wise covering array:** Every N-tuple of parameter values appears.

**Empirical justification for pairwise testing:** Studies by Kuhn, Wallace, and Gallo (NIST, 2004) analyzed 329 software failures and found that 93% of bugs were triggered by the interaction of at most 3 parameters, and 98% by at most 4. This suggests that 3-wise or 4-wise covering arrays capture nearly all parameter-interaction faults.

**Example for airside scenario testing:**

Consider a scenario with 8 parameters, each discretized to 5 levels:
- Full combinatorial: 5^8 = 390,625 test cases
- Pairwise covering array: approximately 50-80 test cases (>4,800x reduction)
- 3-wise covering array: approximately 250-400 test cases (>970x reduction)
- 4-wise covering array: approximately 800-1,500 test cases (>260x reduction)

**Tool support:**

| Tool | Capability | License |
|------|-----------|---------|
| ACTS (NIST) | Up to 6-wise, mixed-level, constraint support | Free (US govt) |
| CAgen | Pairwise and higher, large parameter spaces | Open source |
| Jenny | Pairwise, fast for large numbers of parameters | Open source |
| Pairwise online | Browser-based pairwise generation | Free |
| PICT (Microsoft) | Pairwise and N-wise with constraints | Open source |

**Constraint handling:** Not all parameter combinations are physically valid. For example, "icy surface" with "temperature = 30C" is impossible. Covering array tools support constraints to exclude invalid combinations:

```
# PICT constraint syntax example
IF [surface] = "icy" THEN [temperature_c] <= 0;
IF [zone] = "depot" THEN [aircraft_state] = "none";
IF [turnaround_phase] = "pushback" THEN [aircraft_state] IN {"engines_starting", "pushback"};
```

### 2.5 Importance Sampling for Rare Events

Most airside scenarios are nominal (vehicle drives along service road, nobody crosses, weather is clear). The critical scenarios -- those that test safety boundaries -- are rare in the natural distribution. Testing uniformly across the parameter space wastes most of the test budget on uninteresting scenarios.

Importance sampling biases the test distribution toward high-risk regions:

**Step 1: Define the natural distribution** p(x) over scenario parameters x. This represents the frequency of scenarios in actual airport operations. Sources: fleet telemetry data, airport operations statistics, turnaround timing databases.

**Step 2: Define the target distribution** q(x) that oversamples dangerous regions. Approaches:

- **Expert-defined risk weighting:** Multiply natural probability by a risk factor based on hazard analysis. For example, weight "ground crew crouching behind GSE" 10x relative to its natural frequency.
- **Failure-probability weighting:** Use results from initial test campaigns to estimate P(failure|x) and set q(x) proportional to p(x) * P(failure|x).
- **Cross-entropy method (CEM):** Iteratively update q(x) toward the distribution over scenarios that cause failures. Start with p(x), run tests, identify failures, fit a new distribution to failure-inducing scenarios, repeat.

**Step 3: Correct for bias.** When computing aggregate metrics (e.g., overall failure rate), weight each test result by the importance weight w(x) = p(x) / q(x) to obtain unbiased estimates:

```
Unbiased failure rate = (1/N) * sum_i [ w(x_i) * indicator(failure at x_i) ]
                      = (1/N) * sum_i [ p(x_i)/q(x_i) * indicator(failure at x_i) ]
```

**Variance reduction:** Importance sampling can dramatically reduce the variance of rare-event probability estimates. For an event with probability 10^-6 under p(x), naive Monte Carlo requires ~10^8 samples for a reliable estimate. With a well-chosen q(x), the same precision may require only 10^3 to 10^4 samples.

### 2.6 Critical Scenario Identification

Beyond sampling, we need principled methods to identify which scenarios are most critical for safety validation.

**Responsibility-Sensitive Safety (RSS) violation detection:**

RSS (Shalev-Shwartz et al., 2017) defines formal rules for safe longitudinal and lateral behavior. A scenario is critical if the AV's planned trajectory would violate an RSS constraint even with correct behavior. This indicates a scenario where the safe response set is small or empty.

For airside operations, RSS parameters are adapted (see `../runtime-assurance/simplex-safety-architecture.md` Section 2):
- Minimum longitudinal safe distance from aircraft: 3-5 m (vs. 1-2 m for cars)
- Maximum response time: 0.5 s (slow speed, safety-critical)
- Maximum comfortable deceleration: 3 m/s^2 (loaded baggage tractor)
- Maximum emergency deceleration: 5-6 m/s^2 (depends on surface, load)

**Time-to-collision (TTC) metrics:**

| Metric | Definition | Critical Threshold |
|--------|-----------|-------------------|
| TTC | Time until collision assuming constant velocities | < 3 s |
| TTC* | Time until collision assuming constant accelerations | < 3 s |
| PET (Post-Encroachment Time) | Time between one actor leaving a conflict point and another arriving | < 1.5 s |
| DRAC (Deceleration Rate to Avoid Collision) | Required deceleration to prevent collision | > 3 m/s^2 |
| Minimum distance | Closest point of approach | < 2 m (GSE), < 5 m (aircraft) |

**Scenario criticality score:**

```python
def scenario_criticality(scenario_result: dict) -> float:
    """
    Compute a criticality score [0, 1] for a completed scenario.
    Higher score = more critical (closer to safety boundary).
    """
    weights = {
        'ttc': 0.25,
        'min_distance': 0.25,
        'rss_margin': 0.20,
        'decel_required': 0.15,
        'speed_at_closest': 0.15,
    }
    
    scores = {}
    
    # TTC: critical if < 3s, maximum criticality at 0s
    ttc = scenario_result.get('min_ttc', float('inf'))
    scores['ttc'] = max(0, 1 - ttc / 3.0)
    
    # Minimum distance: critical if < 5m (aircraft) or < 2m (GSE/personnel)
    min_dist = scenario_result.get('min_distance', float('inf'))
    threshold = 5.0 if scenario_result.get('closest_actor_type') == 'aircraft' else 2.0
    scores['min_distance'] = max(0, 1 - min_dist / threshold)
    
    # RSS margin: critical if negative (violation)
    rss_margin = scenario_result.get('rss_longitudinal_margin', float('inf'))
    scores['rss_margin'] = max(0, min(1, -rss_margin / 2.0)) if rss_margin < 0 else 0
    
    # Required deceleration: critical if > 3 m/s^2
    decel = scenario_result.get('max_decel_required', 0)
    scores['decel_required'] = min(1, max(0, (decel - 1.0) / 4.0))
    
    # Speed at closest approach: higher speed = more critical
    speed = scenario_result.get('speed_at_closest_approach', 0)
    scores['speed_at_closest'] = min(1, speed / 25.0)  # normalize to max operating speed
    
    return sum(weights[k] * scores[k] for k in weights)
```

---

## 3. Coverage Metrics

### 3.1 ODD Coverage Analysis

The Operational Design Domain (ODD) defines the conditions under which the AV is designed to operate. ODD coverage measures what fraction of the ODD has been tested.

**ODD dimension decomposition:**

| ODD Dimension | Sub-dimensions | Testable Values |
|---------------|---------------|-----------------|
| Geography | Airport zones (apron, service road, taxiway crossing, depot) | 4 zone types, per-airport variants |
| Time of day | Dawn, Day, Dusk, Night | 4 levels |
| Weather | Clear, Rain (light/heavy), Fog, Snow, De-icing spray | 6 conditions |
| Surface | Dry concrete, Wet concrete, Standing water, Ice/frost, Oil/fuel spill | 5 conditions |
| Temperature | -20C to +50C | 8 intervals |
| Traffic density | 0 (empty) to 20+ GSE in apron area | 5 levels |
| Personnel density | 0 to 15+ ground crew in detection range | 5 levels |
| Aircraft presence | None, Parked (cold), Parked (APU), Engines starting, Taxiing | 5 states |
| Sensor health | All nominal, Single LiDAR degraded, Multi-LiDAR degraded, Camera fallback | 4 states |
| Communication | Full connectivity, Degraded, No connectivity | 3 states |

**Total ODD cells:** 4 * 4 * 6 * 5 * 8 * 5 * 5 * 5 * 4 * 3 = 14,400,000

**ODD coverage metric:**

```python
def compute_odd_coverage(test_results: list[dict], odd_grid: dict) -> dict:
    """
    Compute ODD coverage from test results.
    
    test_results: list of scenario results with ODD dimension values
    odd_grid: dict mapping dimension names to lists of discretized values
    
    Returns: {
        'overall_coverage': float,  # fraction of ODD cells with at least 1 test
        'per_dimension': dict,       # coverage per dimension
        'uncovered_cells': list,     # ODD cells with zero tests
        'weakly_covered': list,      # ODD cells with < min_tests
    }
    """
    from itertools import product
    
    # Build set of all ODD cells
    dimensions = list(odd_grid.keys())
    all_cells = set()
    for combo in product(*[odd_grid[d] for d in dimensions]):
        all_cells.add(combo)
    
    # Map test results to ODD cells
    covered_cells = {}  # cell -> count
    for result in test_results:
        cell = tuple(result.get(d) for d in dimensions)
        covered_cells[cell] = covered_cells.get(cell, 0) + 1
    
    # Compute coverage
    n_total = len(all_cells)
    n_covered = len(covered_cells)
    
    # Per-dimension coverage (marginal)
    per_dim_coverage = {}
    for i, dim in enumerate(dimensions):
        dim_values = set(odd_grid[dim])
        tested_values = set(cell[i] for cell in covered_cells.keys())
        per_dim_coverage[dim] = len(tested_values) / len(dim_values)
    
    # Identify uncovered and weakly covered
    min_tests_per_cell = 3  # minimum for any statistical confidence
    uncovered = [cell for cell in all_cells if cell not in covered_cells]
    weakly_covered = [cell for cell, count in covered_cells.items() 
                      if count < min_tests_per_cell]
    
    return {
        'overall_coverage': n_covered / n_total,
        'per_dimension': per_dim_coverage,
        'n_total_cells': n_total,
        'n_covered_cells': n_covered,
        'uncovered_cells': uncovered[:100],  # truncate for display
        'n_uncovered': len(uncovered),
        'weakly_covered_cells': weakly_covered[:100],
        'n_weakly_covered': len(weakly_covered),
    }
```

**Practical guidance:** Achieving 100% ODD coverage is infeasible because many cells represent physically impossible or extremely rare combinations. A more realistic target:

| Coverage Level | Target | Interpretation |
|----------------|--------|---------------|
| Dimension marginal coverage | 100% | Every value of every dimension tested in at least one scenario |
| Pairwise cell coverage | >95% | Every pair of dimension values tested together |
| 3-wise cell coverage | >80% | Every triple of dimension values tested together |
| Full cell coverage | >10% | At least 10% of all cells have at least one test |
| Safety-critical cell coverage | 100% | All cells identified as high-risk in hazard analysis tested |

### 3.2 Scenario Space Coverage

The airside scenario taxonomy defines 115 functional scenarios across 8 categories (see `airside-scenario-taxonomy.md`). Scenario space coverage tracks how many of these have been tested and at what depth.

| Category | Functional Scenarios | Target Logical Scenarios | Target Concrete Scenarios |
|----------|---------------------|--------------------------|---------------------------|
| Transit operations | 14 | 70 (5 per functional) | 7,000 (100 per logical) |
| Stand approach | 12 | 60 | 6,000 |
| Turnaround support | 18 | 90 | 9,000 |
| Personnel interaction | 22 | 110 | 11,000 |
| GSE interaction | 15 | 75 | 7,500 |
| Environmental hazards | 16 | 80 | 8,000 |
| Emergency situations | 10 | 50 | 5,000 |
| Multi-vehicle coordination | 8 | 40 | 4,000 |
| **Total** | **115** | **575** | **57,500** |

This is a minimum test suite for SiL simulation. Physical testing will cover a fraction (see Section 10).

**Scenario coverage tracking:**

```python
class ScenarioCoverageTracker:
    """Track scenario test coverage against the airside taxonomy."""
    
    def __init__(self, taxonomy: dict):
        """
        taxonomy: {
            'category_name': {
                'functional_scenarios': [
                    {
                        'id': 'FS-TR-001',
                        'description': 'Nominal transit on service road',
                        'logical_scenarios': [...],
                        'risk_level': 'low',
                    },
                    ...
                ],
            },
            ...
        }
        """
        self.taxonomy = taxonomy
        self.test_results = {}  # scenario_id -> list of test results
    
    def record_test(self, scenario_id: str, result: dict):
        """Record a test execution against a scenario."""
        if scenario_id not in self.test_results:
            self.test_results[scenario_id] = []
        self.test_results[scenario_id].append(result)
    
    def coverage_report(self) -> dict:
        """Generate coverage report."""
        report = {'categories': {}, 'summary': {}}
        total_fs = 0
        covered_fs = 0
        total_tests = 0
        total_failures = 0
        
        for cat_name, cat_data in self.taxonomy.items():
            cat_covered = 0
            cat_total = len(cat_data['functional_scenarios'])
            cat_tests = 0
            cat_failures = 0
            
            for fs in cat_data['functional_scenarios']:
                total_fs += 1
                results = self.test_results.get(fs['id'], [])
                cat_tests += len(results)
                failures = [r for r in results if not r.get('passed', True)]
                cat_failures += len(failures)
                if len(results) > 0:
                    covered_fs += 1
                    cat_covered += 1
            
            total_tests += cat_tests
            total_failures += cat_failures
            
            report['categories'][cat_name] = {
                'total_functional': cat_total,
                'covered_functional': cat_covered,
                'coverage_pct': 100 * cat_covered / cat_total if cat_total > 0 else 0,
                'total_tests': cat_tests,
                'failures': cat_failures,
                'pass_rate': 100 * (cat_tests - cat_failures) / cat_tests if cat_tests > 0 else 0,
            }
        
        report['summary'] = {
            'total_functional_scenarios': total_fs,
            'covered_functional_scenarios': covered_fs,
            'overall_coverage_pct': 100 * covered_fs / total_fs if total_fs > 0 else 0,
            'total_test_executions': total_tests,
            'total_failures': total_failures,
            'overall_pass_rate': 100 * (total_tests - total_failures) / total_tests if total_tests > 0 else 0,
        }
        return report
```

### 3.3 Code Coverage for Safety-Critical Paths

Code coverage metrics for safety-critical C++ nodelets in the Aurrigo ROS stack:

| Metric | Description | Target (ASIL-B) | Target (Non-safety) | Tool |
|--------|-------------|------------------|---------------------|------|
| Statement coverage | % of code statements executed | 100% | >80% | gcov, lcov |
| Branch coverage | % of control flow branches taken | 100% | >70% | gcov, lcov |
| MC/DC (Modified Condition/Decision Coverage) | Each condition independently affects the decision | Required | Not required | BullseyeCoverage, VectorCAST |
| Function coverage | % of functions called | 100% | >90% | gcov |

**MC/DC requirement (ISO 26262 Part 6):** For ASIL-B and above, MC/DC is required for safety-critical code. MC/DC demands that every condition in a Boolean expression has been shown to independently affect the outcome.

Example: For the expression `if (obstacle_detected && speed > 0 && !emergency_override)`:
- MC/DC requires 4 test cases minimum (for 3 conditions)
- Each condition must flip the outcome while others are held constant

**Safety-critical paths in Aurrigo stack:**

| Package | Safety Criticality | Coverage Target | MC/DC Required |
|---------|--------------------|-----------------|----------------|
| `aurrigo_safety` (e-stop, watchdog) | ASIL-B | 100% statement + MC/DC | Yes |
| `aurrigo_perception` (obstacle detection) | ASIL-B | 100% statement + MC/DC | Yes |
| `aurrigo_nav` (speed limiting, geofence) | ASIL-B | 100% statement, branch | Yes (safety checks only) |
| `aurrigo_nav` (Frenet planner core) | ASIL-A | >90% statement, >80% branch | No |
| `aurrigo_localization` (GTSAM) | ASIL-A | >90% statement | No |
| `aurrigo_control` (Stanley, low-level) | ASIL-B | 100% statement + MC/DC | Yes (actuator commands) |
| Other packages | QM | >80% statement | No |

### 3.4 Perception Coverage

Perception testing requires coverage across all object types, distances, environmental conditions, and sensor configurations. The coverage matrix:

**Object type x distance coverage:**

| Object Type | 0-10 m | 10-30 m | 30-50 m | 50-100 m | 100-200 m |
|-------------|--------|---------|---------|----------|-----------|
| Ground crew (standing) | Required | Required | Required | Required | Desired |
| Ground crew (crouching) | Required | Required | Required | Desired | N/A |
| Narrow-body aircraft | Required | Required | Required | Required | Required |
| Wide-body aircraft | Required | Required | Required | Required | Required |
| Baggage tractor | Required | Required | Required | Required | Desired |
| Belt loader | Required | Required | Required | Required | Desired |
| Container loader | Required | Required | Required | Desired | N/A |
| Fuel truck | Required | Required | Required | Required | Desired |
| FOD (>10 cm) | Required | Required | Desired | N/A | N/A |
| Emergency vehicle | Required | Required | Required | Required | Required |
| Dolly train (3-5 dollies) | Required | Required | Required | Required | Desired |

**Lighting x weather perception matrix:**

| Condition | Clear | Light Rain | Heavy Rain | Fog (<200m vis) | Snow | De-icing Spray |
|-----------|-------|------------|------------|-----------------|------|----------------|
| Day (>10k lux) | Baseline | Required | Required | Required | Required | Required |
| Dusk (100-10k lux) | Required | Required | Required | Required | Desired | Desired |
| Night (<100 lux) | Required | Required | Required | Required | Desired | Desired |
| Night + Apron Lights | Required | Required | Desired | Desired | Desired | Desired |

**Perception performance metrics per cell:**

| Metric | Abbreviation | Target (Personnel) | Target (Aircraft) | Target (GSE) | Target (FOD) |
|--------|-------------|-------------------|-------------------|--------------|-------------|
| Average Precision | AP | >90% | >95% | >90% | >70% |
| Recall at 0m-30m | R@30 | >99% | >99% | >95% | >85% |
| False positive rate | FPR | <1% | <0.1% | <2% | <5% |
| Localization error (3D) | LE | <0.3 m | <0.5 m | <0.3 m | <0.5 m |
| Detection latency | DL | <100 ms | <100 ms | <100 ms | <200 ms |

### 3.5 N-Sigma Statistical Confidence Arguments

For safety-critical metrics, we need not just point estimates but statistical confidence bounds. The N-sigma framework quantifies how confident we are that the true performance meets the requirement.

**Binomial confidence interval for detection rate:**

Given N test instances and k successful detections:
- Point estimate: p_hat = k/N
- Lower 95% confidence bound (Clopper-Pearson exact): beta_inv(alpha/2, k, N-k+1)

**Example:** 985 detections out of 1000 test cases:
- Point estimate: 98.5%
- 95% lower bound: 97.4%
- 99% lower bound: 97.0%

If the requirement is 95% detection rate, we can claim with 99% confidence that the true rate exceeds 97%, which exceeds the requirement with margin.

**Required sample sizes for detection rate claims:**

| True Detection Rate | Target Claim | Confidence | Required N (no failures allowed) |
|---------------------|-------------|------------|----------------------------------|
| 99% | 95% | 95% | 59 |
| 99% | 99% | 95% | 299 |
| 99.9% | 99% | 95% | 2,995 |
| 99.9% | 99.9% | 95% | 2,995 |
| 99.9% | 99.9% | 99% | 4,603 |

**Formula (zero-failure test):**

```
N = ceil(ln(1 - C) / ln(R))

where:
  C = confidence level (e.g., 0.95)
  R = reliability claim (e.g., 0.99)
  N = required number of tests with zero failures
```

```python
import math
from scipy import stats

def required_samples_zero_failure(reliability: float, confidence: float) -> int:
    """
    Compute minimum test count for reliability claim with zero failures.
    
    Based on: N = ceil(ln(1 - C) / ln(R))
    
    Example: required_samples_zero_failure(0.99, 0.95) = 299
    """
    if reliability >= 1.0 or reliability <= 0.0:
        raise ValueError("Reliability must be in (0, 1)")
    if confidence >= 1.0 or confidence <= 0.0:
        raise ValueError("Confidence must be in (0, 1)")
    return math.ceil(math.log(1 - confidence) / math.log(reliability))


def detection_rate_confidence_interval(k: int, n: int, confidence: float = 0.95) -> tuple:
    """
    Clopper-Pearson exact confidence interval for detection rate.
    
    k: number of successful detections
    n: total test instances
    confidence: confidence level
    
    Returns (lower_bound, upper_bound)
    """
    alpha = 1 - confidence
    if k == 0:
        lower = 0.0
    else:
        lower = stats.beta.ppf(alpha / 2, k, n - k + 1)
    if k == n:
        upper = 1.0
    else:
        upper = stats.beta.ppf(1 - alpha / 2, k + 1, n - k)
    return (lower, upper)


# Example usage:
# For personnel detection: 985 detections out of 1000 tests
# lower, upper = detection_rate_confidence_interval(985, 1000, 0.95)
# print(f"95% CI: [{lower:.4f}, {upper:.4f}]")
# Output: 95% CI: [0.9741, 0.9924]
```

---

## 4. Corner Case and Adversarial Testing

### 4.1 Search-Based Testing

Search-based testing (SBT) treats scenario generation as an optimization problem: find the scenario parameters that maximize a criticality metric (Section 2.6) or trigger a specific failure mode.

**Covariance Matrix Adaptation Evolution Strategy (CMA-ES):**

CMA-ES is a derivative-free optimization algorithm particularly well-suited for scenario search because:
- It works with continuous parameter spaces (speed, position, timing)
- It adapts its search distribution based on successful mutations
- It does not require gradient information (the simulator is a black box)
- It handles multimodal landscapes (multiple distinct failure modes)

**Algorithm outline for airside scenario search:**

```python
import cma
import numpy as np

class AdversarialScenarioSearch:
    """Use CMA-ES to find failure-inducing airside scenarios."""
    
    def __init__(self, simulator, parameter_bounds: dict):
        """
        simulator: callable(scenario_params) -> scenario_result
        parameter_bounds: {'ego_speed': (5, 25), 'crew_x': (-20, 20), ...}
        """
        self.simulator = simulator
        self.bounds = parameter_bounds
        self.param_names = list(parameter_bounds.keys())
        self.lower = np.array([parameter_bounds[p][0] for p in self.param_names])
        self.upper = np.array([parameter_bounds[p][1] for p in self.param_names])
    
    def _normalize(self, x):
        """Map from [lower, upper] to [0, 1]."""
        return (x - self.lower) / (self.upper - self.lower)
    
    def _denormalize(self, x_norm):
        """Map from [0, 1] to [lower, upper]."""
        return self.lower + x_norm * (self.upper - self.lower)
    
    def _objective(self, x_norm):
        """
        Objective to MAXIMIZE (CMA-ES minimizes, so negate).
        Returns negative criticality (higher criticality = more dangerous).
        """
        x = self._denormalize(np.clip(x_norm, 0, 1))
        params = dict(zip(self.param_names, x))
        result = self.simulator(params)
        criticality = scenario_criticality(result)
        # Return negative because CMA-ES minimizes
        return -criticality
    
    def search(self, n_generations: int = 100, population_size: int = 20,
               sigma0: float = 0.3) -> list[dict]:
        """
        Run CMA-ES search for critical scenarios.
        Returns list of discovered critical scenarios sorted by criticality.
        """
        dim = len(self.param_names)
        x0 = np.full(dim, 0.5)  # start at center of parameter space
        
        es = cma.CMAEvolutionStrategy(x0, sigma0, {
            'bounds': [0, 1],
            'popsize': population_size,
            'maxiter': n_generations,
            'seed': 42,
        })
        
        critical_scenarios = []
        
        while not es.stop():
            solutions = es.ask()
            fitnesses = [self._objective(s) for s in solutions]
            es.tell(solutions, fitnesses)
            
            # Record scenarios with criticality > threshold
            for sol, fit in zip(solutions, fitnesses):
                criticality = -fit
                if criticality > 0.7:  # threshold for "critical"
                    params = dict(zip(self.param_names,
                                      self._denormalize(np.clip(sol, 0, 1))))
                    critical_scenarios.append({
                        'params': params,
                        'criticality': criticality,
                    })
        
        # Sort by criticality (most dangerous first)
        critical_scenarios.sort(key=lambda x: x['criticality'], reverse=True)
        return critical_scenarios
```

**Bayesian Optimization alternative:** For expensive simulations (e.g., full-fidelity HIL tests that take minutes per run), Bayesian Optimization with Gaussian Process surrogates is more sample-efficient than CMA-ES. Libraries: BoTorch, GPyOpt, Ax.

### 4.2 Adversarial Object Placement

Test the perception system's robustness to adversarial configurations of objects that exploit known sensor weaknesses.

**LiDAR adversarial scenarios:**

| Adversarial Configuration | Expected Failure Mode | Test Method |
|---------------------------|----------------------|-------------|
| Personnel crouching behind low GSE (belt loader ramp) | Partial occlusion below LiDAR scan plane | SiL + Physical (mannequin) |
| Highly reflective aircraft fuselage creating ghost points | False positive obstacles from specular reflection | SiL + Physical (calibration target) |
| Transparent objects (glass partition, plastic barrier) | Missed detection (LiDAR passes through) | Physical (actual objects) |
| Personnel wearing high-visibility vests at night | Retroreflective saturation causing range errors | SiL + Physical (mannequin with vest) |
| FOD at edge of LiDAR beam (minimum range/max angle) | Missed detection in coverage gap | SiL + Physical (placed objects) |
| Personnel directly behind baggage dolly train | Full occlusion by dolly train (up to 15 m long) | SiL + Physical |
| Jet exhaust distorting LiDAR beam path | Refraction causing range errors or missed returns | SiL (physics-based) |
| Accumulated water/ice on LiDAR lens | Degraded point cloud density | Physical (controlled contamination) |

**Camera adversarial scenarios (for camera fallback mode):**

| Adversarial Configuration | Expected Failure Mode | Test Method |
|---------------------------|----------------------|-------------|
| Bright apron lights causing camera flare | Washed-out regions hiding personnel | SiL + Physical (night testing) |
| Shadows from aircraft wings creating false edges | False positive obstacles | SiL |
| Wet surface reflections duplicating objects | Double-counting actors | SiL + Physical |
| High-contrast stripes on ground (safety markings) | Depth estimation errors | SiL + Physical |
| De-icing fluid on lens | Blurred or distorted image | Physical (spray test) |

### 4.3 LLM-Based Scenario Generation

Large language models can generate edge case scenarios from natural language safety requirements, exploiting their broad knowledge of aviation operations and failure modes.

**Approach:**

1. Provide the LLM with the safety requirements document, the ODD definition, and the hazard catalog
2. Prompt it to generate scenarios that could violate each safety requirement
3. Parse generated scenarios into the OpenSCENARIO DSL format
4. Filter and validate for physical plausibility
5. Execute in simulation

**Prompt template:**

```
You are a safety engineer testing an autonomous baggage tractor operating 
on an airport apron. The vehicle uses 4-8 RoboSense LiDARs for perception, 
operates at 5-25 km/h, and must maintain 3m clearance from aircraft and 2m 
from personnel.

Given this safety requirement:
"{requirement}"

Generate 10 concrete scenarios that could cause the vehicle to violate this 
requirement. For each scenario, specify:
1. Initial positions and velocities of all actors
2. Environmental conditions (weather, lighting, surface)
3. The specific sequence of events that creates the hazard
4. Why this scenario is challenging for the perception/planning system

Focus on scenarios that exploit:
- Sensor limitations (occlusion, reflections, range limits)
- Unusual actor behaviors (unexpected movements, unusual positions)
- Environmental edge cases (jet blast, de-icing, night + rain)
- Timing coincidences (multiple events happening simultaneously)
```

**Validation pipeline:**

```
LLM-generated scenario (natural language)
    ↓ Parse to structured format
Logical scenario parameters
    ↓ Physical plausibility check
    ↓ (reject impossible: e.g., crouching personnel at 100 km/h)
Valid logical scenario
    ↓ Instantiate to concrete
Concrete scenario (executable)
    ↓ Run in SiL
Test result
    ↓ If failure: add to adversarial scenario database
    ↓ If pass: record as coverage evidence
```

**Empirical results from literature:** Tian et al. (2024) found that GPT-4-generated driving scenarios discovered 15-30% more failure modes than random scenario generation with the same computational budget. The LLM-generated scenarios were particularly effective at finding multi-actor interaction failures that random sampling rarely produces.

### 4.4 Metamorphic Testing

Metamorphic testing defines relationships between scenarios that should hold if the system is correct. If the relationship is violated, a bug is detected without needing an oracle for the absolute correctness of each test.

**Metamorphic relations for airside AVs:**

| ID | Relation | Description | Implementation |
|----|----------|-------------|----------------|
| MR1 | Speed monotonicity | If safe at speed v, should be safe at speed v' < v (all else equal) | Run scenario at decreasing speeds; flag if failure appears at lower speed |
| MR2 | Distance monotonicity | If safe with obstacle at distance d, should be safe at d' > d | Move obstacle farther; flag if failure appears at greater distance |
| MR3 | Visibility monotonicity | If safe in fog (200m visibility), should be safe in clear conditions | Improve visibility; flag if failure appears in better conditions |
| MR4 | Sensor addition | Adding a sensor should not decrease detection rate | Run with N and N+1 LiDARs; flag if detection drops |
| MR5 | Object size | If detecting a container loader, should detect a larger fuel truck | Replace small object with larger; flag if detection drops |
| MR6 | Symmetry | Performance should be similar for left vs. right approach | Mirror scenario; flag if significant performance difference |
| MR7 | Temporal invariance | Replaying the same sensor data should produce the same decision | Replay twice; flag if decisions differ (indicates non-determinism) |
| MR8 | Additive safety | Adding a safety constraint should not make the system less safe | Enable additional RSS check; flag if new failures appear |

**Metamorphic test executor:**

```python
class MetamorphicTestRunner:
    """Run metamorphic tests by transforming scenarios and checking relations."""
    
    def __init__(self, simulator):
        self.simulator = simulator
        self.violations = []
    
    def test_speed_monotonicity(self, base_scenario: dict, 
                                 speed_reductions: list[float]) -> list[dict]:
        """MR1: Reducing speed should not cause new failures."""
        base_result = self.simulator(base_scenario)
        violations = []
        
        for delta_v in speed_reductions:
            modified = base_scenario.copy()
            modified['ego_speed'] = base_scenario['ego_speed'] - delta_v
            if modified['ego_speed'] <= 0:
                continue
            
            modified_result = self.simulator(modified)
            
            if (base_result.get('passed', True) and 
                not modified_result.get('passed', True)):
                violations.append({
                    'relation': 'MR1_speed_monotonicity',
                    'base_speed': base_scenario['ego_speed'],
                    'modified_speed': modified['ego_speed'],
                    'base_passed': True,
                    'modified_passed': False,
                    'severity': 'high',
                    'description': (f"System passed at {base_scenario['ego_speed']:.1f} "
                                    f"km/h but FAILED at lower speed "
                                    f"{modified['ego_speed']:.1f} km/h"),
                })
        
        self.violations.extend(violations)
        return violations
    
    def test_symmetry(self, base_scenario: dict, 
                       mirror_axis: str = 'lateral') -> list[dict]:
        """MR6: Mirrored scenario should produce similar results."""
        base_result = self.simulator(base_scenario)
        
        mirrored = base_scenario.copy()
        if mirror_axis == 'lateral':
            # Flip Y coordinates of all actors
            for key in mirrored:
                if key.endswith('_y'):
                    mirrored[key] = -mirrored[key]
        
        mirror_result = self.simulator(mirrored)
        
        violations = []
        # Check if pass/fail status differs
        if base_result.get('passed') != mirror_result.get('passed'):
            violations.append({
                'relation': 'MR6_symmetry',
                'base_passed': base_result.get('passed'),
                'mirror_passed': mirror_result.get('passed'),
                'severity': 'medium',
                'description': f"Asymmetric behavior: base={'pass' if base_result.get('passed') else 'fail'}, "
                               f"mirror={'pass' if mirror_result.get('passed') else 'fail'}",
            })
        
        # Check if min_distance differs significantly
        base_dist = base_result.get('min_distance', 0)
        mirror_dist = mirror_result.get('min_distance', 0)
        if abs(base_dist - mirror_dist) > 0.5:  # 0.5m threshold
            violations.append({
                'relation': 'MR6_symmetry_distance',
                'base_min_distance': base_dist,
                'mirror_min_distance': mirror_dist,
                'severity': 'low',
                'description': f"Distance asymmetry: {abs(base_dist - mirror_dist):.2f}m",
            })
        
        self.violations.extend(violations)
        return violations
```

### 4.5 Fuzzing Perception Inputs

Fuzzing injects random perturbations into sensor data to test perception robustness. Unlike adversarial attacks (which are optimized to fool the model), fuzzing tests resilience to random noise and corruption.

**Point cloud fuzzing strategies:**

| Strategy | Description | Simulates |
|----------|-------------|-----------|
| Random point dropout | Remove N% of points randomly | Sensor degradation, rain absorption |
| Structured dropout | Remove all points in a cone/sector | Single beam failure, LiDAR sector blocked |
| Gaussian noise injection | Add N(0, sigma) to XYZ coordinates | Vibration, temperature-induced error |
| Ghost point injection | Add random clusters of points | Multipath reflection, lens contamination |
| Intensity perturbation | Randomize intensity channel | Surface material variation |
| Temporal jitter | Shift timestamps by random offsets | Clock synchronization errors |
| Point cloud duplication | Duplicate a section of the scan offset by dx,dy,dz | Mechanical vibration between scans |

**Expected behavior under fuzzing:**

- **Safe degradation:** The system should detect input corruption (via OOD detection, see `../runtime-assurance/simplex-safety-architecture.md` Section 3) and enter a degraded operating mode (reduce speed or stop) rather than making dangerous decisions based on corrupted data.
- **No crashes:** The software must not segfault, hang, or produce undefined behavior under any fuzzed input.
- **Bounded output:** Planning outputs must remain within physically valid bounds (speed within limits, steering within mechanical range) regardless of input corruption.

---

## 5. Simulation-Based Verification and Validation

### 5.1 Software-in-the-Loop (SIL)

SIL testing runs the complete AV software stack (perception, localization, planning, control) against simulated sensor data in a simulated environment. No real hardware is involved.

**Architecture:**

```
┌──────────────────────────────────────────────────────┐
│                    SIL Test Harness                    │
│                                                        │
│  ┌─────────────┐    ┌─────────────────────────────┐   │
│  │  Simulator   │    │    AV Software Stack         │   │
│  │  (CARLA /    │───>│    (ROS Noetic nodes)       │   │
│  │   Isaac Sim) │    │                             │   │
│  │             │<───│  Perception → Planning →     │   │
│  │  Simulated   │    │  Control → /cmd_twist       │   │
│  │  Sensors:    │    │                             │   │
│  │  - LiDAR x4-8│    │  Safety Monitor             │   │
│  │  - Camera x4 │    │  Simplex Arbitrator         │   │
│  │  - IMU       │    └─────────────────────────────┘   │
│  │  - GPS       │                                      │
│  │             │    ┌─────────────────────────────┐   │
│  │  Simulated   │    │    Test Oracle               │   │
│  │  Actors:     │    │    - Collision detection     │   │
│  │  - Aircraft  │    │    - Clearance violation     │   │
│  │  - GSE       │    │    - TTC computation         │   │
│  │  - Personnel │    │    - RSS check               │   │
│  │  - FOD       │    │    - Geofence check          │   │
│  └─────────────┘    └─────────────────────────────┘   │
│                                                        │
│  Test Controller: scenario execution, metrics, logging │
└──────────────────────────────────────────────────────┘
```

**SIL configuration for Aurrigo stack:**

| Component | SIL Implementation | Notes |
|-----------|-------------------|-------|
| LiDAR sensors | CARLA ray-cast LiDAR (4-8 sensors, matching RoboSense HELIOS/RSBP specs) | Configure channels, range, rotation rate to match real sensors |
| Camera sensors | CARLA RGB cameras (if using camera fallback mode) | Match resolution, FoV, mounting position |
| IMU | Simulated 500 Hz IMU with configurable noise model | Match real IMU noise characteristics |
| GPS | Simulated RTK-GPS with configurable accuracy and dropout | Include multipath effects near buildings |
| ROS interface | CARLA ROS bridge (publishes to standard ROS topics) | Topic remapping to match Aurrigo namespace |
| Environment | Custom airport map in CARLA (see `simulators-for-airside.md` Section 1) | Import from AMDB + custom 3D assets |
| Actors | Scripted via OpenSCENARIO or CARLA Python API | Custom blueprints for GSE and aircraft |

**SIL test execution pipeline:**

```bash
# 1. Launch simulator with airport environment
carla_server --map=AirsideTestAirport --quality-level=Epic &

# 2. Launch ROS bridge
roslaunch carla_ros_bridge carla_ros_bridge.launch \
    host:=localhost port:=2000 &

# 3. Launch AV stack (production or shadow, depending on test)
roslaunch aurrigo_bringup sil_test.launch \
    stack:=production \
    record_bag:=true &

# 4. Execute scenario
python3 run_scenario.py \
    --scenario=scenarios/personnel_crossing.yaml \
    --num_runs=100 \
    --output_dir=results/personnel_crossing/

# 5. Analyze results
python3 analyze_results.py \
    --results_dir=results/personnel_crossing/ \
    --metrics=collision,ttc,min_distance,rss_violation \
    --report=reports/personnel_crossing.html
```

**SIL test volume targets:**

| Test Category | Scenarios | Runs per Scenario | Total Runs | Estimated Time |
|---------------|-----------|-------------------|------------|----------------|
| Nominal operations (115 functional) | 115 | 100 | 11,500 | ~48 hours |
| Parameterized sweep (575 logical) | 575 | 50 | 28,750 | ~120 hours |
| Adversarial search (per campaign) | 1,000 | 1 | 1,000 | ~4 hours |
| Regression suite (golden scenarios) | 100 | 10 | 1,000 | ~4 hours |
| Monte Carlo (statistical confidence) | 10,000 | 1 | 10,000 | ~42 hours |
| **Total per release** | | | **~52,250** | **~218 hours** |

At a typical SIL throughput of 5-10x real-time (scenario includes setup, execution, teardown), a single workstation with a capable GPU can process approximately 250 scenarios per hour, or about 6,000 per day. The full test suite requires approximately 9 computation-days per release, which is parallelizable across multiple machines.

### 5.2 Hardware-in-the-Loop (HIL)

HIL testing uses the real Orin compute hardware running the AV software stack, but replaces real sensors with simulated sensor data injected at the hardware interface level. This validates:

- Real-time performance on actual compute hardware
- Timing behavior under load
- GPU memory management
- Sensor driver compatibility
- Thermal behavior during sustained operation

**HIL architecture:**

```
┌───────────────────────────────────────────────────────────┐
│                     HIL Test Bench                         │
│                                                             │
│  ┌──────────────┐     ┌────────────────────────────────┐  │
│  │  Sensor       │     │   Real NVIDIA Orin              │  │
│  │  Simulation   │────>│   (Jetson AGX Orin 64GB)       │  │
│  │  Workstation  │     │                                │  │
│  │               │     │   Running:                     │  │
│  │  - LiDAR      │UDP  │   - ROS Noetic                 │  │
│  │    point cloud │────>│   - aurrigo_perception         │  │
│  │    generator   │     │   - aurrigo_nav                │  │
│  │               │     │   - aurrigo_localization        │  │
│  │  - Camera     │MIPI │   - aurrigo_safety             │  │
│  │    frame       │CSI  │   - aurrigo_control            │  │
│  │    injector    │────>│                                │  │
│  │               │     │   Output: /av_nav/cmd_twist    │  │
│  │  - IMU/GPS    │UART │     (captured, not sent to     │  │
│  │    emulator   │────>│      actuators)                │  │
│  └──────────────┘     └────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  HIL Controller                                       │  │
│  │  - Scenario orchestration                             │  │
│  │  - Timing measurement (sensor-to-command latency)     │  │
│  │  - GPU/CPU utilization monitoring                     │  │
│  │  - Thermal monitoring                                 │  │
│  │  - Result validation                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**HIL-specific test focus areas:**

| Test Focus | What It Validates | Pass Criteria |
|------------|-------------------|---------------|
| End-to-end latency | Sensor input to control output time | <100 ms (10 Hz control loop) |
| Perception throughput | Frames processed per second | >10 FPS for all LiDAR processing |
| GPU memory | Peak VRAM usage under worst case | <80% of 64 GB (leave headroom) |
| CPU utilization | All cores under max load | <85% sustained |
| Thermal throttling | Performance under thermal stress | No throttling at 40C ambient (max expected apron temperature) |
| Watchdog timing | Safety watchdog triggers on timeout | Triggers within 200 ms of stack freeze |
| Sensor dropout handling | Response to sudden sensor loss | Detects within 100 ms, enters degraded mode |
| Multi-LiDAR sync | Point cloud alignment across 4-8 sensors | <5 ms inter-sensor sync error |

**HIL test volume:** 1,000 hours minimum, focusing on timing-critical scenarios and degraded sensor modes. This is not about statistical scenario coverage (SIL handles that) but about hardware-specific validation.

### 5.3 Vehicle-in-the-Loop (VIL)

VIL testing uses the real vehicle on a test track with a combination of real physical obstacles and injected virtual scenarios. The vehicle drives physically, but additional virtual actors (aircraft, GSE, personnel) are overlaid onto the real sensor data.

**VIL approaches:**

| Approach | Description | Fidelity | Cost |
|----------|-------------|----------|------|
| **Physical obstacles only** | Mannequins, dummy GSE, foam aircraft mockup | Highest for physical interaction | $50-100K test track setup |
| **Augmented reality injection** | Real driving + virtual actors injected into point cloud before perception | High (real vehicle dynamics, simulated actors) | $20-50K software development |
| **Scenario injection via V2X** | Real driving + virtual actors communicated via simulated V2X messages | Medium (tests fusion, not raw perception) | $10-20K |

**VIL test track requirements** (see Section 11 for full details):

The test track must include physical representations of:
- Aircraft nose mockup (foam/inflatable, correct dimensions)
- GSE obstacles at various heights
- Pedestrian mannequins (articulated, motorized for crossing scenarios)
- Surface markings (stand centerline, safety zone boundaries)
- Apron lighting (adjustable intensity for day/night testing)

### 5.4 Sim-to-Real Gap Quantification

The value of simulation-based testing depends critically on how well simulation matches reality. The sim-to-real gap must be measured and bounded.

**Domain gap metrics:**

| Metric | What It Measures | How to Compute |
|--------|-----------------|----------------|
| **Point cloud density ratio** | LiDAR return density sim vs. real | Points per m^3 at matched distances |
| **Intensity distribution KL-divergence** | LiDAR intensity realism | KL(p_real_intensity || p_sim_intensity) |
| **Detection AP gap** | Perception accuracy difference | AP_real - AP_sim on matched scenarios |
| **Planning trajectory deviation** | Planning behavior difference | L2 distance between sim and real planned paths for same scenario |
| **FID (Frechet Inception Distance)** | Overall visual similarity (camera) | FID between real and simulated image distributions |
| **Chamfer distance** | 3D point cloud shape similarity | Average nearest-neighbor distance between real and simulated clouds |

**Sim-to-real gap reduction strategies:**

1. **Sensor model calibration:** Measure real sensor characteristics (noise, dropout, beam divergence, intensity response) and configure the simulator to match. For RoboSense HELIOS: measure actual beam pattern, range-dependent noise profile, return rate on different materials.

2. **Domain randomization:** During SIL testing, randomly vary simulation parameters (lighting, surface reflectance, point cloud noise) to train/test across a distribution that brackets reality.

3. **Real-data replay augmentation:** Record real sensor data, replay through the stack, then perturb (add actors, change weather) to create semi-real scenarios that preserve the real sensor characteristics while varying the scenario content.

**Sim-to-real transfer performance targets:**

| Metric | Acceptable Gap | Action if Exceeded |
|--------|----------------|-------------------|
| Detection AP (personnel) | <5% | Recalibrate sensor model, add domain randomization |
| Detection AP (aircraft) | <3% | Recalibrate reflectance model |
| Planning trajectory L2 | <0.3 m | Check vehicle dynamics model, friction parameters |
| E-stop braking distance | <10% | Physical braking tests override sim results |
| Localization drift | <0.1 m over 100 m | Check GPS/IMU noise model calibration |

### 5.5 Simulator Selection for Airside

Based on the evaluation in `simulators-for-airside.md`:

| Simulator | Best For | Airside Readiness | Integration Effort |
|-----------|---------|-------------------|-------------------|
| **CARLA 0.9.16 (UE5)** | SIL scenario testing, large-scale Monte Carlo | Medium (needs custom airport map, GSE models) | 2-4 weeks with ROS bridge |
| **NVIDIA Isaac Sim** | HIL sensor simulation, digital twin | Medium (Omniverse-based, good RoboSense model) | 3-6 weeks |
| **Gazebo** | Unit/integration tests, basic scenario replay | Low (limited visuals, basic physics) | 1-2 weeks (familiar to ROS users) |
| **NVIDIA DRIVE Sim** | Production-grade SIL/HIL | High (enterprise, requires partnership) | 2-3 months |

**Recommended multi-simulator strategy:**

- **Gazebo** for CI/CD unit and integration tests (fast, lightweight, runs in Docker)
- **CARLA** for scenario-based SIL testing (best balance of fidelity and throughput)
- **Isaac Sim** for digital twin construction and HIL sensor injection (best LiDAR models)
- **Physical test track** for VIL and final validation (irreplaceable for certification)

---

## 6. Statistical Safety Arguments

### 6.1 The Zhao-Weng Theorem

The fundamental question of AV safety testing: "How many tests do we need to run to claim the system is safe?"

The Zhao-Weng formulation (adapted from reliability engineering) provides the answer for the zero-failure case:

```
N = -ln(1 - C) / (1 - R)

where:
  N = number of test runs required (all must pass)
  C = confidence level (probability that the claim is correct)
  R = reliability level (probability the system succeeds in any single run)
```

**Derivation:** If the true failure probability is p = 1 - R, the probability of observing zero failures in N independent tests is (1-p)^N = R^N. We want P(true failure rate <= p) >= C, which gives R^N <= 1 - C, hence N >= ln(1-C) / ln(R). For small p, ln(R) = ln(1-p) approximately equals -p, so N approximately equals -ln(1-C) / p.

**Key numbers for airside AV certification:**

| Reliability (R) | Confidence (C) | Required N | Interpretation |
|------------------|----------------|------------|---------------|
| 99% (1 failure per 100 runs) | 95% | 299 | Minimum for prototype validation |
| 99.9% | 95% | 2,995 | Design target for nominal scenarios |
| 99.9% | 99% | 4,603 | Strong evidence for nominal operation |
| 99.99% | 95% | 29,956 | Target for safety-critical functions |
| 99.99% | 99% | 46,050 | High confidence for personnel detection |
| 99.999% | 95% | 299,572 | Target for catastrophic failure modes |
| 99.999% | 99% | 460,515 | Demonstration of aircraft collision avoidance |

```python
import math

def zhao_weng_sample_size(reliability: float, confidence: float) -> int:
    """
    Zhao-Weng theorem: required test runs for reliability demonstration.
    
    N = ceil(-ln(1 - C) / -ln(R))
      = ceil(-ln(1 - C) / (1 - R))  [approximation for R close to 1]
    
    Args:
        reliability: target reliability R (e.g., 0.999 for 99.9%)
        confidence: confidence level C (e.g., 0.95 for 95%)
    
    Returns:
        Minimum number of tests that must ALL pass.
    """
    # Exact formula
    N_exact = math.ceil(math.log(1 - confidence) / math.log(reliability))
    # Approximate formula (for R close to 1)
    N_approx = math.ceil(-math.log(1 - confidence) / (1 - reliability))
    return N_exact

def print_sample_size_table():
    """Print sample size requirements for various reliability/confidence levels."""
    reliabilities = [0.99, 0.999, 0.9999, 0.99999]
    confidences = [0.90, 0.95, 0.99]
    
    print(f"{'Reliability':<15} ", end="")
    for c in confidences:
        print(f"{'C=' + str(c):<12}", end="")
    print()
    print("-" * 50)
    
    for r in reliabilities:
        print(f"R={r:<13} ", end="")
        for c in confidences:
            n = zhao_weng_sample_size(r, c)
            print(f"{n:<12,}", end="")
        print()

# Output:
# Reliability      C=0.9       C=0.95      C=0.99
# --------------------------------------------------
# R=0.99           230         299         459
# R=0.999          2,302       2,995       4,603
# R=0.9999         23,025      29,956      46,050
# R=0.99999        230,258     299,572     460,515
```

### 6.2 RSS Worst-Case Formal Arguments

Responsibility-Sensitive Safety (RSS) provides formal, mathematical safety guarantees that complement statistical testing. Where statistical arguments say "we tested enough and didn't see failures," RSS arguments say "under these assumptions, a collision is physically impossible."

**RSS for airside (adapted from `../runtime-assurance/simplex-safety-architecture.md` Section 2):**

The RSS safe longitudinal distance for airside operations:

```
d_safe = v_ego * rho + v_ego^2 / (2 * a_max_brake) + v_other^2 / (2 * a_min_brake_other)

where:
  v_ego = ego vehicle speed
  v_other = other actor speed (towards ego)
  rho = response time (0.5 s for airside)
  a_max_brake = maximum braking deceleration of ego (5 m/s^2)
  a_min_brake_other = minimum assumed braking of other actor (0 m/s^2 for worst case)
```

**For a baggage tractor at 15 km/h (4.17 m/s) approaching a stationary obstacle:**

```
d_safe = 4.17 * 0.5 + 4.17^2 / (2 * 5) + 0
       = 2.085 + 1.74
       = 3.82 m
```

If the perception system detects the obstacle at >3.82 m and the planner respects the RSS constraint, a collision is formally impossible under the stated assumptions (response time, braking capability).

**Formal safety argument structure:**

1. **Assumption A1:** Perception detects all obstacles at range >= D_detect
2. **Assumption A2:** Vehicle can decelerate at >= a_max_brake on all surfaces
3. **Assumption A3:** Response time is bounded by rho
4. **Claim C1:** If A1, A2, A3 hold and planner follows RSS, then d_closest >= d_safe > 0
5. **Evidence:** Physical braking tests validate A2. Perception testing validates A1. HIL timing tests validate A3.
6. **Residual risk:** Assumptions may be violated (sensor failure, ice, software hang). Mitigated by Simplex architecture (safety controller as fallback).

### 6.3 Bayesian Safety Estimation

Bayesian methods combine prior knowledge (from simulation) with field data (from physical testing and operations) to produce a posterior safety estimate.

**Prior from simulation:**

Run N_sim simulated scenarios, observe k_sim failures.
Prior failure rate: p_sim = k_sim / N_sim (with uncertainty from Beta distribution)
Prior: Beta(k_sim + 1, N_sim - k_sim + 1)

**Posterior from field data:**

Observe N_field physical test runs with k_field failures.
Posterior: Beta(k_sim + k_field + 1, N_sim + N_field - k_sim - k_field + 1)

**Discounting simulation evidence:**

Simulation evidence is weaker than physical evidence because of the sim-to-real gap. Apply a discount factor gamma in (0, 1] to simulation counts:

```
Effective prior: Beta(gamma * k_sim + 1, gamma * (N_sim - k_sim) + 1)
Posterior: Beta(gamma * k_sim + k_field + 1, gamma * (N_sim - k_sim) + N_field - k_field + 1)
```

Typical discount factors:
- gamma = 0.01 for low-fidelity simulation (Gazebo basic)
- gamma = 0.05-0.10 for medium-fidelity (CARLA with calibrated sensors)
- gamma = 0.10-0.30 for high-fidelity (digital twin with validated sensor models)
- gamma = 1.0 for real-data replay (no discount, it is real data)

```python
from scipy import stats
import numpy as np

class BayesianSafetyEstimator:
    """Bayesian estimation of failure rate combining sim and field data."""
    
    def __init__(self, sim_runs: int, sim_failures: int, 
                 discount_factor: float = 0.1):
        """
        sim_runs: total simulation test runs
        sim_failures: number of failures in simulation
        discount_factor: weight of simulation evidence (0-1)
        """
        self.alpha_prior = discount_factor * sim_failures + 1
        self.beta_prior = discount_factor * (sim_runs - sim_failures) + 1
        self.field_runs = 0
        self.field_failures = 0
    
    def update_with_field_data(self, field_runs: int, field_failures: int):
        """Incorporate physical test/operational data."""
        self.field_runs += field_runs
        self.field_failures += field_failures
    
    @property
    def posterior_alpha(self):
        return self.alpha_prior + self.field_failures
    
    @property
    def posterior_beta(self):
        return self.beta_prior + self.field_runs - self.field_failures
    
    def failure_rate_estimate(self) -> dict:
        """Compute posterior failure rate statistics."""
        a = self.posterior_alpha
        b = self.posterior_beta
        dist = stats.beta(a, b)
        
        return {
            'mean': dist.mean(),
            'median': dist.median(),
            'mode': (a - 1) / (a + b - 2) if a > 1 and b > 1 else 0,
            'std': dist.std(),
            'ci_95_upper': dist.ppf(0.95),
            'ci_99_upper': dist.ppf(0.99),
            'p_below_target': dist.cdf(1e-4),  # P(failure rate < 10^-4)
        }
    
    def required_additional_field_tests(self, target_failure_rate: float,
                                         target_confidence: float) -> int:
        """
        How many more field tests (with zero failures) are needed to 
        demonstrate failure rate < target at given confidence.
        """
        for n in range(0, 1_000_000):
            a = self.posterior_alpha
            b = self.posterior_beta + n
            if stats.beta(a, b).cdf(target_failure_rate) >= target_confidence:
                return n
        return -1  # infeasible

# Example:
# 50,000 SIL runs, 5 failures, discount factor 0.1
# estimator = BayesianSafetyEstimator(50000, 5, discount_factor=0.1)
#
# After 2,000 field km with 0 failures (assuming 1 scenario per km):
# estimator.update_with_field_data(2000, 0)
# result = estimator.failure_rate_estimate()
# print(f"Mean failure rate: {result['mean']:.6f}")
# print(f"95% upper bound:  {result['ci_95_upper']:.6f}")
# print(f"P(rate < 10^-4):  {result['p_below_target']:.4f}")
```

### 6.4 Mileage Equivalence

A key question for regulators: "How many simulated miles are equivalent to one real mile?"

There is no universal answer. The equivalence depends on:
- Simulation fidelity (sensor model accuracy, physics engine quality)
- Scenario diversity (are the simulated miles interesting, or just straight-line driving?)
- Validation status (has the simulator been validated against real data?)

**Framework for mileage equivalence claims:**

| Simulation Level | Equivalence Ratio | Justification |
|-----------------|-------------------|---------------|
| Low fidelity (basic physics, no sensor models) | 1000:1 | Only validates logic, not perception |
| Medium fidelity (calibrated sensors, realistic physics) | 100:1 to 50:1 | Validated sensor models, scenario-relevant |
| High fidelity (digital twin, validated sensor + environment) | 20:1 to 10:1 | Demonstrated <5% AP gap to real data |
| Real-data replay with augmentation | 5:1 to 2:1 | Real sensor data, varied scenarios |
| Physical closed-course testing | 1:1 | Real hardware, real environment |
| Physical on-airport operations | 1:1 | Highest fidelity, actual ODD |

**Waymo's approach:** Waymo has driven 20+ million miles on public roads and tens of billions of miles in simulation. They do not publish a formal equivalence ratio but use simulation for three distinct purposes: (1) testing new software before real-world deployment, (2) reproducing and investigating real-world events, (3) generating scenarios that are too dangerous or rare for real-world testing.

**Practical implication for airside:** To achieve the equivalent of 10,000 physical airport-km for certification:
- Need 10,000 physical km on airport (TractEasy precedent: 1-6 years)
- OR 10,000 physical km on test track (mapped as 1:1)
- AND 500,000-1,000,000 simulated km in validated digital twin (at 50:1-100:1 ratio)
- AND 50,000+ physical km in shadow mode (no direct contribution to safety claim, but validates simulation fidelity)

### 6.5 The RAND Study: Why Simulation is Essential

The RAND Corporation's 2016 study "Driving to Safety" (Kalra & Paddock) established the foundational argument for why real-world mileage alone cannot prove AV safety:

**Key numbers:**

- US human crash rate: approximately 1.09 fatalities per 100 million miles
- To demonstrate with 95% confidence that an AV's fatality rate is below the human rate (i.e., AV is at least as safe as a human): need approximately 275 million miles with zero fatalities
- To demonstrate the AV is 20% better than a human at 95% confidence with 80% power: need approximately 11 billion miles
- With a fleet of 100 vehicles driving 24/7: 11 billion miles takes over 500 years

**For airport airside operations, the challenge is even more acute:**
- The human incident rate on aprons is much higher than road driving (27,000 incidents/year across the industry)
- But the number of operating vehicles is much smaller (tens, not millions)
- And the operating hours per vehicle are lower (8-16 hours/day, not 24/7)
- Therefore: accumulating statistically significant miles through real operations alone would take decades

**This is why simulation is not a nice-to-have but a mathematical necessity.** The only feasible path to a rigorous safety argument for airside AVs combines:

1. Formal methods (RSS) for worst-case guarantees
2. Simulation for statistical coverage of the scenario space
3. Physical testing for sim-to-real validation
4. Shadow mode for real-world ODD validation
5. Bayesian combination of all evidence sources

---

## 7. Shadow Mode Validation

### 7.1 Shadow Mode Architecture

Shadow mode runs the AV software stack in parallel with a human operator who has actual control of the vehicle. The AV system processes real sensor data and makes decisions, but those decisions are recorded rather than executed. This provides real-world testing with zero safety risk.

For the Aurrigo Simplex architecture (see `../runtime-assurance/simplex-safety-architecture.md` Section 4), shadow mode is a natural first step:

```
Real Sensors ──┬──> Production Stack ──> Actuators (human controls)
               │
               └──> Shadow Stack ──> Decisions logged (NOT executed)
                         │
                         └──> Compared against human actions
```

### 7.2 Intervention Rate Metrics

The primary metric for shadow mode evaluation is the hypothetical intervention rate: how often would a human operator have needed to intervene if the AV had been in control?

**Metric definitions:**

| Metric | Definition | Formula | Target (pre-autonomous) |
|--------|-----------|---------|------------------------|
| Interventions per hour (IPH) | Rate of required human interventions | N_interventions / total_hours | <0.1 IPH |
| Interventions per km (IPK) | Distance-normalized intervention rate | N_interventions / total_km | <0.01 IPK |
| Miles between interventions (MBI) | Average distance between interventions | total_km / N_interventions | >100 km |
| Critical intervention rate | Rate of interventions that prevented a safety incident | N_critical / total_hours | <0.01 per hour |
| False positive intervention rate | Rate of interventions where AV was actually correct | N_false_positive / N_interventions | Track but no target |

**Intervention classification taxonomy:**

| Category | Severity | Definition | Example |
|----------|----------|-----------|---------|
| **Critical safety** | High | AV would have caused collision or clearance violation | Planning to drive through personnel |
| **Near-miss** | Medium-High | AV would have come dangerously close | <1 m from obstacle, TTC < 1 s |
| **Comfort/efficiency** | Medium | AV path is safe but suboptimal | Unnecessary hard braking, wide detour |
| **Navigation** | Low | AV would have taken wrong route | Missing a turn, entering wrong stand |
| **False alarm** | Info | AV stopped/slowed for phantom obstacle | Ghost detection causing unnecessary stop |
| **Operator preference** | Info | Human chose differently but AV was acceptable | Slightly different line through apron |

### 7.3 Disagreement Analysis

Systematically categorize every instance where the AV's decision differs from the human operator's action.

**Disagreement detection thresholds:**

| Variable | Threshold for "Disagreement" | Threshold for "Critical Disagreement" |
|----------|-------------------------------|---------------------------------------|
| Speed | |delta_v| > 2 km/h | AV accelerating when human braking (or vice versa) |
| Steering | |delta_steer| > 5 degrees | Opposite steering direction |
| Stop/go | AV moving when human stopped (or vice versa) | AV moving when human emergency-stopped |
| Path | Lateral deviation > 0.5 m | AV path intersects obstacle |

**Disagreement analysis pipeline:**

```python
class DisagreementAnalyzer:
    """Analyze shadow mode disagreements between AV and human operator."""
    
    def __init__(self):
        self.disagreements = []
        self.total_frames = 0
    
    def analyze_frame(self, timestamp: float, 
                       human_cmd: dict, av_cmd: dict,
                       scene_context: dict) -> dict | None:
        """
        Compare human and AV commands for a single frame.
        
        human_cmd: {'linear_x': float, 'angular_z': float, 'estop': bool}
        av_cmd:    {'linear_x': float, 'angular_z': float, 'estop': bool}
        scene_context: {'nearest_obstacle_dist': float, 'nearest_obstacle_type': str, ...}
        
        Returns disagreement record if threshold exceeded, else None.
        """
        self.total_frames += 1
        
        speed_diff = av_cmd['linear_x'] - human_cmd['linear_x']
        steer_diff = av_cmd['angular_z'] - human_cmd['angular_z']
        
        # Check for critical disagreement
        is_critical = False
        if human_cmd.get('estop', False) and not av_cmd.get('estop', False):
            is_critical = True
            category = 'critical_safety'
        elif (human_cmd['linear_x'] < 0.1 and av_cmd['linear_x'] > 1.0):
            is_critical = True
            category = 'critical_safety'
        elif abs(speed_diff) > 2.0:  # km/h
            category = 'speed_disagreement'
        elif abs(steer_diff) > 0.087:  # ~5 degrees
            category = 'steering_disagreement'
        else:
            return None  # No significant disagreement
        
        record = {
            'timestamp': timestamp,
            'category': category,
            'is_critical': is_critical,
            'human_speed': human_cmd['linear_x'],
            'av_speed': av_cmd['linear_x'],
            'speed_diff': speed_diff,
            'human_steer': human_cmd['angular_z'],
            'av_steer': av_cmd['angular_z'],
            'steer_diff': steer_diff,
            'nearest_obstacle': scene_context.get('nearest_obstacle_dist'),
            'obstacle_type': scene_context.get('nearest_obstacle_type'),
        }
        self.disagreements.append(record)
        return record
    
    def summary_report(self) -> dict:
        """Generate summary of all disagreements."""
        if self.total_frames == 0:
            return {'error': 'No frames analyzed'}
        
        categories = {}
        for d in self.disagreements:
            cat = d['category']
            categories[cat] = categories.get(cat, 0) + 1
        
        critical = [d for d in self.disagreements if d['is_critical']]
        
        return {
            'total_frames': self.total_frames,
            'total_disagreements': len(self.disagreements),
            'disagreement_rate': len(self.disagreements) / self.total_frames,
            'critical_disagreements': len(critical),
            'critical_rate': len(critical) / self.total_frames,
            'by_category': categories,
            'agreement_rate': 1 - len(self.disagreements) / self.total_frames,
        }
```

### 7.4 Shadow-to-Autonomous Transition Criteria

The decision to transition from shadow mode to supervised autonomous operation requires meeting quantitative thresholds:

**Phase gate criteria (aligned with `../runtime-assurance/simplex-safety-architecture.md` Section 4.3):**

| Gate | From | To | Criteria | Minimum Duration |
|------|------|----|----------|-----------------|
| G1 | Shadow mode | Supervised Simplex | Agreement rate >85%, zero critical disagreements in last 1,000 km, all golden scenarios pass in SiL | 3 months |
| G2 | Supervised Simplex | Full Simplex | Agreement rate >95%, zero safety violations in last 5,000 km, operator intervention rate <0.1/hour | 3 months |
| G3 | Full Simplex | Primary (shadow becomes primary) | >99% shadow driving time, zero collisions in last 10,000 km, regression suite 100% pass | 6 months |
| G4 | Primary | Unsupervised (no safety operator) | Regulatory approval obtained, insurance coverage confirmed, intervention rate <0.01/hour for 6+ months | 12+ months |

**Gate review process:**

1. **Data collection:** Automated metrics from fleet telemetry
2. **Engineering review:** Safety team reviews all critical disagreements and near-misses
3. **Independent assessment:** Third-party auditor reviews evidence (required for G3 and G4)
4. **Stakeholder sign-off:** Airport authority, airline partners, insurance provider
5. **Regulatory notification:** Inform FAA/CAA/EASA of phase transition (required for G4)

---

## 8. Regression Testing

### 8.1 Test Suite Management

A regression test suite for an airside AV system with 115+ functional scenarios requires disciplined management.

**Test suite structure:**

```
test_suite/
├── golden/                    # Must-pass scenarios (never deleted)
│   ├── personnel_detection/   # 20 scenarios
│   ├── aircraft_clearance/    # 15 scenarios
│   ├── emergency_stop/        # 15 scenarios
│   ├── gse_interaction/       # 15 scenarios
│   ├── environmental/         # 15 scenarios
│   ├── geofence/              # 10 scenarios
│   └── multi_vehicle/         # 10 scenarios
│   └── total: 100 golden scenarios
├── parameterized/             # Auto-generated from logical scenarios
│   ├── transit/               # 500 scenarios
│   ├── approach/              # 400 scenarios
│   ├── turnaround/            # 600 scenarios
│   └── ...
│   └── total: ~5,000 parameterized scenarios
├── adversarial/               # Discovered by search (grows over time)
│   ├── discovered_2025Q1/     # 50 scenarios
│   ├── discovered_2025Q2/     # 75 scenarios
│   └── ...
│   └── total: growing (target 500+ by certification)
├── replay/                    # Real-world data replays
│   ├── incidents/             # All incidents/near-misses
│   ├── interesting/           # Flagged by operators
│   └── random_sample/         # Statistical sample of normal ops
│   └── total: growing (target 1,000+ by certification)
└── metamorphic/               # Metamorphic relation tests
    ├── speed_monotonicity/    # 200 scenario pairs
    ├── symmetry/              # 100 scenario pairs
    └── ...
    └── total: ~500 relation checks
```

**Test lifecycle:**

| Event | Golden | Parameterized | Adversarial | Replay |
|-------|--------|---------------|-------------|--------|
| New software release | Run all (must pass 100%) | Run all (track pass rate) | Run all (must pass 100%) | Run all (track divergence) |
| Perception model update | Run all | Run perception-relevant | Run all | Run perception-relevant |
| Planner parameter change | Run safety-relevant | Run planner-relevant | Run all | Run planner-relevant |
| New scenario discovered | Add to adversarial | May generate new parameterized | Add from search | Add from fleet data |
| Scenario fails | Investigate; if valid bug, fix. If scenario invalid, remove. Never remove valid failing test. | Same | Same | Same |

### 8.2 Perception Regression

Track perception metrics across model versions to detect regressions:

| Metric | Tracked Per | Regression Threshold | Action |
|--------|-------------|---------------------|--------|
| mAP (overall) | Object class, distance band | >1% drop | Block release, investigate |
| AP (personnel) | Distance, lighting, weather | >0.5% drop | Block release (safety-critical) |
| AP (aircraft) | Distance, aircraft type | >0.5% drop | Block release (safety-critical) |
| NDS (nuScenes Detection Score) | Overall | >1% drop | Warning, review |
| Recall @ 30m (personnel) | Lighting condition | >0.5% drop | Block release |
| FPR (false positive rate) | Object class | >50% increase | Warning, review |
| Inference latency | Overall, per-component | >10% increase | Block release (timing-critical) |
| GPU memory | Peak usage | >10% increase | Warning (may affect other modules) |

**Perception regression CI pipeline:**

```yaml
# .github/workflows/perception-regression.yml (conceptual)
name: Perception Regression
on:
  pull_request:
    paths:
      - 'aurrigo_perception/**'
      - 'models/**'

jobs:
  regression:
    runs-on: [self-hosted, gpu, orin]  # or cloud GPU
    steps:
      - name: Build perception stack
        run: catkin build aurrigo_perception
      
      - name: Run evaluation on validation set
        run: |
          python3 evaluate_perception.py \
            --model=models/latest \
            --dataset=datasets/airside_val_v3 \
            --output=results/perception_eval.json
      
      - name: Compare against baseline
        run: |
          python3 compare_metrics.py \
            --current=results/perception_eval.json \
            --baseline=baselines/perception_v2.3.json \
            --thresholds=config/regression_thresholds.yaml
      
      - name: Gate decision
        run: |
          python3 gate_decision.py \
            --comparison=results/comparison.json \
            --fail-on=safety_critical_regression
```

### 8.3 Planning Regression

Track planning metrics across planner updates:

| Metric | Definition | Regression Threshold |
|--------|-----------|---------------------|
| Collision rate | % of scenarios with collision | Any increase from 0% (zero tolerance) |
| Min clearance (aircraft) | Minimum distance to aircraft across all scenarios | <5 m (absolute threshold) |
| Min clearance (personnel) | Minimum distance to personnel | <2 m (absolute threshold) |
| Average TTC | Mean time-to-collision in near-miss scenarios | >10% decrease |
| Comfort: max jerk | Maximum longitudinal jerk | >3 m/s^3 |
| Comfort: max lateral acceleration | Maximum lateral acceleration | >2 m/s^2 |
| Mission completion rate | % of scenarios completed successfully | >1% decrease |
| Average mission time | Time to complete standard missions | >10% increase |
| E-stop rate | % of scenarios requiring emergency stop | >50% increase |
| Path efficiency | Ratio of actual path length to optimal | >5% decrease |

### 8.4 CI/CD Integration

Automated test execution on every code change:

**Test tiers and execution triggers:**

| Tier | Tests | Trigger | Duration | Environment |
|------|-------|---------|----------|-------------|
| T0: Smoke | 10 golden scenarios, build check | Every commit | 15 minutes | Docker container |
| T1: Unit | All unit tests + static analysis | Every PR | 30 minutes | Docker container |
| T2: Integration | 100 golden scenarios in Gazebo | PR merge to develop | 2 hours | GPU server |
| T3: Full regression | All 5,000+ scenarios in CARLA | Weekly + pre-release | 24 hours | GPU cluster (4+ nodes) |
| T4: Extended | Adversarial search + Monte Carlo | Monthly + pre-certification | 72 hours | GPU cluster |

**Golden scenario gate:** No software release may proceed to physical testing unless 100% of golden scenarios pass at the T2 level. This is a hard gate with no exceptions.

### 8.5 Golden Scenarios

Golden scenarios are a curated set of must-pass scenarios that represent the most safety-critical situations. They are:

1. **Immutable:** Once added, a golden scenario is never removed (only deprecated if the ODD changes)
2. **Representative:** Cover each hazard category from the airside taxonomy
3. **Reproducible:** Fully specified concrete scenarios with deterministic execution
4. **Gating:** Any golden scenario failure blocks deployment

**Golden scenario selection criteria:**

| Selection Criterion | Description |
|---------------------|-------------|
| Real-world incident | Derived from an actual incident or near-miss (highest priority) |
| Adversarial discovery | Found by search-based testing as failure-inducing |
| Hazard coverage | Ensures each of the 115 functional scenarios has at least one golden representative |
| Regulatory requirement | Specifically required by ISO 3691-4, UL 4600, or airport authority |
| High-consequence | Involves aircraft proximity, personnel safety, or geofence violation |

**Initial golden scenario set (100 scenarios):**

| Category | Count | Examples |
|----------|-------|---------|
| Personnel detection and avoidance | 20 | Crouching person behind GSE, person emerging from under aircraft, group crossing path, person in blind spot |
| Aircraft clearance | 15 | Approach to narrow-body stand, approach to wide-body stand, aircraft pushback in progress, engine start during approach |
| Emergency stop | 15 | Sudden obstacle at 5m/10m/20m/30m, e-stop on wet surface, e-stop on slope, e-stop with loaded dolly train |
| GSE interaction | 15 | Belt loader crossing path, fuel truck right-of-way, follow-me car leading, parallel approach with another tractor |
| Environmental | 15 | Heavy rain, fog <100m, night + no apron lights, de-icing spray, jet blast zone transit |
| Geofence and navigation | 10 | Approach to geofence boundary, taxiway crossing with aircraft, depot entry/exit transition |
| Multi-vehicle coordination | 10 | Two AVs approaching same stand, AV yielding to manual GSE, convoy operation, conflicting paths at intersection |

---

## 9. Digital Twin Validation for Airside

### 9.1 Airport Digital Twin Construction

A digital twin is a high-fidelity virtual replica of a specific airport that enables scenario-based testing with realistic geometry, materials, and environmental conditions.

**Data sources for digital twin construction:**

| Data Source | What It Provides | Accuracy | Cost | Availability |
|-------------|-----------------|----------|------|-------------|
| AMDB (Aeronautical Mapping Database) | Apron layout, taxiway geometry, stand positions | +/-0.5 m at best | Free (FAA for 500+ US airports) | Public |
| HD survey (LiDAR/photogrammetry) | 3D point cloud of apron area, building facades, static objects | +/-0.02-0.05 m | $20-50K per airport | Custom survey required |
| As-built CAD drawings | Building dimensions, infrastructure layout | Varies (may be outdated) | Airport authority provides | Request from airport |
| Satellite/aerial imagery | Ground texture, surface markings, layout verification | +/-0.3-1.0 m | $500-5K (commercial providers) | Readily available |
| AIP charts | Taxiway designations, stand numbers, surface types | Authoritative but low-res | Free (national AIPs) | Public |

**Construction pipeline:**

```
AMDB data (FAA)
    ↓ Parse AMXM GML → extract geometry
Base layout (apron polygons, taxiway centerlines, stand locations)
    ↓ Overlay HD survey point cloud
Refined geometry (±0.05 m accuracy)
    ↓ Material assignment (concrete, asphalt, markings)
Textured environment
    ↓ Import 3D models (aircraft, GSE, buildings)
Populated scene
    ↓ Add dynamic actors (OpenSCENARIO)
Executable digital twin
    ↓ Validate against real data (drive same route, compare sensor output)
Validated digital twin
```

**Estimated construction cost:**

| Component | First Airport | Additional Airport (same cluster) |
|-----------|--------------|-----------------------------------|
| AMDB data acquisition and parsing | $5-10K | $2-5K |
| HD survey | $20-50K | $15-30K |
| 3D environment creation | $15-30K | $10-20K |
| 3D asset modeling (aircraft, GSE) | $10-20K (reusable) | $2-5K (customization only) |
| Sensor model calibration | $10-15K | $5-10K |
| Validation against real data | $5-10K | $3-5K |
| **Total** | **$65-135K** | **$37-75K** |

### 9.2 Injecting Real-World Events

The value of a digital twin increases dramatically when it can replay real operational events:

**NOTAM injection:**

Parse real NOTAMs (Notices to Air Missions) and apply their effects to the simulation:

| NOTAM Type | Simulation Effect | Example |
|------------|------------------|---------|
| Taxiway closure | Remove taxiway from available routes, add construction zone | "TWY A CLSD BTN A3 AND A5 FOR MAINT" |
| Stand closure | Mark stand as unavailable, may block access | "STAND 42 CLSD" |
| Lighting outage | Disable apron lights in affected area | "APRON FLOOD LGTG U/S RWY 27R APRON" |
| Construction activity | Add construction vehicles, barriers, personnel | "CONSTRUCTION IN PROGRESS APRON EAST" |
| Wildlife hazard | Add wildlife actors to simulation | "BIRD ACTIVITY RPTD APRON AREA" |

**A-CDM timeline injection:**

Import real A-CDM (Airport Collaborative Decision Making) data to drive realistic turnaround timing:

- TOBT (Target Off-Block Time): Drives pushback scheduling
- AIBT (Actual In-Block Time): Triggers arrival service sequence
- ELDT (Estimated Landing Time): Pre-positions baggage tractors

Using real A-CDM data from a partner airport ensures that the simulation reproduces realistic timing pressures, simultaneous stand operations, and fleet utilization patterns.

**Weather replay:**

Import historical METAR/TAF data to reproduce actual weather conditions:

```
METAR EGLL 121150Z 24012G22KT 3000 -RA SCT010 BKN015 08/06 Q1012
→ Simulation: Wind 240° at 12kt gusting 22kt, 3km visibility, 
  light rain, scattered clouds at 1000ft, temperature 8°C
```

### 9.3 Sensor Simulation Fidelity Requirements

For simulation results to be accepted as certification evidence, the sensor simulation must meet minimum fidelity requirements:

| Sensor | Fidelity Requirement | Validation Method |
|--------|---------------------|-------------------|
| **LiDAR point cloud** | <5% point density difference vs. real at matched range | Drive same route real and sim, compare point counts per m^3 |
| **LiDAR intensity** | KL-divergence < 0.1 between real and sim intensity distributions | Statistical comparison on matched surfaces |
| **LiDAR dropout/noise** | Replicate range-dependent noise profile (measured) | Compare noise statistics at 10m, 30m, 50m, 100m |
| **LiDAR beam pattern** | Match real sensor beam elevation angles within 0.05° | Measure with calibration target |
| **Camera image** | FID < 50 between real and sim images from same viewpoint | Paired image comparison |
| **IMU noise** | Allan variance within 10% of real sensor spec | Compare Allan variance plots |
| **GPS accuracy** | Reproduce RTK fix/float/no-fix transitions from real data | Replay GPS conditions in sim |

**Validation protocol:**

1. Drive the real vehicle through a standardized route at the target airport
2. Record all sensor data (rosbag) with centimeter-accurate ground truth (RTK base station + overhead tracking)
3. Reproduce the identical route in the digital twin
4. Record simulated sensor data
5. Compare real vs. simulated data using the metrics above
6. If any metric exceeds threshold, refine the sensor model and repeat

---

## 10. Airside-Specific Test Protocols

### 10.1 Aircraft Proximity Testing

Aircraft are the highest-consequence obstacles on the apron. A collision with an aircraft can cause millions of dollars in damage ($250K average, up to $35M per engine or $139M+ structural per IATA Ground Damage Database).

**Test matrix:**

| Test ID | Description | Speed | Approach Angle | Aircraft State | Pass Criterion |
|---------|-------------|-------|----------------|---------------|----------------|
| AP-001 | Head-on approach to narrow-body nose | 5 km/h | 0° (centerline) | Parked, engines off | Stop >=3 m from nose |
| AP-002 | Head-on approach to wide-body nose | 5 km/h | 0° (centerline) | Parked, engines off | Stop >=3 m from nose |
| AP-003 | Angled approach to narrow-body (left 30°) | 10 km/h | +30° | Parked, APU on | Stop >=3 m from fuselage |
| AP-004 | Angled approach to narrow-body (right 30°) | 10 km/h | -30° | Parked, APU on | Stop >=3 m from fuselage |
| AP-005 | Approach to wing tip | 10 km/h | 90° | Parked, engines off | Stop >=5 m from wing tip |
| AP-006 | Approach to engine nacelle | 5 km/h | 45° | Engines starting | Stop >=10 m (jet blast zone) |
| AP-007 | Transit behind taxiing aircraft | 15 km/h | Following | Taxiing out | Maintain >=50 m clearance |
| AP-008 | Crossing path of taxiing aircraft | 15 km/h | Perpendicular | Taxiing in | Yield, do not enter crossing until >200 m clear |
| AP-009 | Approach during pushback | 5 km/h | Various | Pushback in progress | Stop and wait until pushback complete |
| AP-010 | Emergency stop near aircraft | 15 km/h | Various | Any | Stop within braking distance, no contact |

**Execution:** AP-001 through AP-006 can be tested physically with a foam/inflatable aircraft mockup. AP-007 through AP-009 require SiL or VIL with injected virtual aircraft. AP-010 is tested both physically (with mockup) and in SiL (for comprehensive speed/angle matrix).

### 10.2 Jet Blast Scenario Validation

Jet blast is an airside-specific hazard with no equivalent in road driving. Engine exhaust can reach 50+ m/s at close range, posing both direct physical danger and sensor interference (LiDAR distortion from thermal gradient, camera image distortion).

**Jet blast test matrix:**

| Test ID | Engine State | Wind Condition | AV Position | Pass Criterion |
|---------|-------------|----------------|-------------|----------------|
| JB-001 | Idle (low power) | Calm | 30 m behind | AV detects jet blast zone (thermal/anemometer), maintains position |
| JB-002 | Breakaway (high power) | Calm | 50 m behind | AV detects increased blast, retreats to safe distance |
| JB-003 | Idle | Crosswind 15 kt | 20 m lateral | AV detects deflected blast cone, adjusts route |
| JB-004 | Taxi power | Headwind 20 kt | 30 m behind | AV detects extended blast zone |
| JB-005 | Idle | Calm | Transit route crosses blast zone | AV routes around blast zone |
| JB-006 | Engine start (unexpected) | Calm | 15 m behind | AV detects engine start, emergency retreat |

**Sensor validation under jet blast:**

| Sensor | Expected Degradation | Test Method | Pass Criterion |
|--------|---------------------|-------------|----------------|
| LiDAR | Range errors from thermal refraction, increased noise | SiL with physics-based thermal model | OOD detection triggers within 500 ms |
| Camera | Heat shimmer distortion | SiL + limited physical | VLM or distortion detector flags anomaly |
| 4D radar | Minimal effect (RF penetrates thermal gradient) | SiL + physical | <2% AP degradation |
| Thermal camera | Strong signal (heat plume visible) | Physical | Jet blast boundary detectable at 100+ m |

### 10.3 Night and Adverse Weather Test Matrix

| Test ID | Time | Weather | Visibility | Surface | Key Test Focus |
|---------|------|---------|-----------|---------|----------------|
| NW-001 | Night | Clear | >1 km | Dry | Baseline night perception (apron lights on) |
| NW-002 | Night | Clear | >1 km | Dry | Night perception (apron lights OFF -- power failure) |
| NW-003 | Night | Light rain | 500 m-1 km | Wet | Personnel detection with reflections |
| NW-004 | Night | Heavy rain | 200-500 m | Standing water | LiDAR rain filtering, reduced speed |
| NW-005 | Day | Dense fog | <200 m | Wet | Camera/LiDAR range reduction |
| NW-006 | Day | Snow | 500 m | Snow-covered | Surface marking occlusion, reduced friction |
| NW-007 | Day | De-icing spray | Variable | Ice/chemical | Sensor contamination, reduced detection |
| NW-008 | Dawn | Sun glare | >1 km | Dry | Camera saturation (if cameras active) |
| NW-009 | Night | Frost | >1 km | Icy | Extended braking distance |
| NW-010 | Day | Crosswind 30 kt | >1 km | Dry | Vehicle stability, trajectory deviation |

**Execution method by test:**

| Test ID | Physical | SiL | HIL | Notes |
|---------|----------|-----|-----|-------|
| NW-001 | Yes (real night) | Yes | Yes | Must test at actual airport after dark |
| NW-002 | Difficult (need airport cooperation) | Yes | Yes | SiL primary; physical if possible |
| NW-003-004 | Opportunistic (real weather) | Yes | Yes | Physical when weather occurs naturally |
| NW-005 | Rare (need real fog) | Yes | Yes | SiL primary; physical when fog occurs |
| NW-006 | Seasonal (winter only) | Yes | Yes | Physical at cold-weather airports |
| NW-007 | Controlled (spray test vehicle) | Yes | Yes | Physical spray on LiDAR lens |
| NW-008 | Yes (dawn testing) | Yes | Yes | Schedule test at sunrise |
| NW-009 | Seasonal | Yes | Yes | Physical at cold-weather airports |
| NW-010 | Opportunistic | Yes | Yes | Physical when wind occurs |

### 10.4 Personnel Interaction Scenarios

Personnel safety is the most critical requirement. Ground crew operate in close proximity to moving vehicles, often in low-visibility conditions, and may behave unpredictably.

**Test matrix:**

| Test ID | Personnel Behavior | Environment | Distance | Speed | Pass Criterion |
|---------|-------------------|-------------|----------|-------|----------------|
| PI-001 | Standing in path | Day, clear | 20 m | 10 km/h | Detect at 20m, stop >2m away |
| PI-002 | Walking across path | Day, clear | 15 m | 15 km/h | Detect, brake, stop >2m away |
| PI-003 | Running across path | Day, clear | 15 m | 15 km/h | Detect, emergency brake, stop >1m |
| PI-004 | Crouching behind GSE | Day, clear | 10 m | 5 km/h | Detect when visible, stop >2m |
| PI-005 | Emerging from under aircraft | Day, clear | 8 m | 5 km/h | Detect upon emergence, stop >2m |
| PI-006 | Group of 5+ personnel | Day, clear | 20 m | 10 km/h | Detect all individuals, stop >3m from nearest |
| PI-007 | Standing in path | Night, no lights | 15 m | 10 km/h | Detect (thermal/LiDAR), stop >2m |
| PI-008 | Walking, wearing hi-vis | Night, apron lights | 20 m | 10 km/h | Detect, track, avoid |
| PI-009 | Walking, dark clothing | Night, apron lights | 15 m | 10 km/h | Detect, track, avoid |
| PI-010 | Personnel on loading platform | Day, clear | 5 m | 5 km/h | Detect elevated person, maintain clearance |
| PI-011 | Marshaller giving signals | Day, clear | 20 m | 5 km/h | Detect marshaller, follow (if gesture recognition active) |
| PI-012 | Person lying on ground | Day, clear | 15 m | 5 km/h | Detect low-profile person, stop |

**Physical test equipment:**

- Articulated pedestrian mannequin (ISO 19206-2 compliant, height 1.8 m, width 0.5 m)
- Child-sized mannequin (height 1.1 m) for crouching person simulation
- Motorized mannequin cart (programmable speed 1-8 km/h, programmable direction)
- Hi-vis vest set (standard airport ground crew PPE)
- Thermal mannequin or heated target (for thermal camera validation)

### 10.5 Mixed Fleet Testing

Airport aprons operate mixed fleets of autonomous and manually-driven GSE. Testing must validate safe interaction.

**Mixed fleet test scenarios:**

| Test ID | Scenario | AV Role | Manual GSE Behavior | Pass Criterion |
|---------|----------|---------|---------------------|----------------|
| MF-001 | Head-on encounter on service road | Ego | Approaching at 15 km/h | AV yields or maintains lane |
| MF-002 | Intersection without priority | Ego | Approaching from right | AV yields to right-of-way |
| MF-003 | Manual GSE cuts in front | Ego | Merges 10 m ahead | AV reduces speed, maintains clearance |
| MF-004 | Manual GSE stops suddenly | Following | Emergency stop | AV stops with >2 m clearance |
| MF-005 | Convoy with manual leader | Following | Leader vehicle | AV follows at safe distance, matches speed |
| MF-006 | Parallel approach to adjacent stand | Ego | Manual tractor at next stand | AV maintains lateral clearance |
| MF-007 | Manual GSE ignores AV | Ego | Does not yield, drives through | AV performs evasive maneuver or stops |
| MF-008 | Manual GSE reverses unexpectedly | Ego | Reverses at 5 km/h | AV detects reverse motion, stops |

### 10.6 Emergency Stop Validation

Emergency stop (e-stop) is the most safety-critical function. ISO 3691-4 requires specific testing.

**Braking distance test matrix:**

| Test ID | Speed (km/h) | Surface | Load | Slope | Target Braking Distance | Method |
|---------|-------------|---------|------|-------|------------------------|--------|
| ES-001 | 5 | Dry concrete | Unloaded | 0% | <1.0 m | Physical |
| ES-002 | 10 | Dry concrete | Unloaded | 0% | <2.5 m | Physical |
| ES-003 | 15 | Dry concrete | Unloaded | 0% | <5.0 m | Physical |
| ES-004 | 25 | Dry concrete | Unloaded | 0% | <12.0 m | Physical |
| ES-005 | 15 | Dry concrete | Full load (3-dolly train) | 0% | <8.0 m | Physical |
| ES-006 | 15 | Wet concrete | Unloaded | 0% | <7.5 m | Physical |
| ES-007 | 15 | Wet concrete | Full load | 0% | <12.0 m | Physical |
| ES-008 | 15 | Icy surface | Unloaded | 0% | <15.0 m | Physical (winter) |
| ES-009 | 15 | Dry concrete | Unloaded | +3% (uphill) | <4.5 m | Physical |
| ES-010 | 15 | Dry concrete | Unloaded | -3% (downhill) | <6.5 m | Physical |

**E-stop activation methods to test:**

| Activation Method | Test | Pass Criterion |
|-------------------|------|----------------|
| Physical e-stop button on vehicle | Press while driving at 15 km/h | Full stop within specified distance |
| Remote e-stop (wireless) | Activate from 50 m away | Full stop within specified distance + 200 ms latency |
| Software e-stop (safety monitor) | Inject virtual obstacle at 5 m | Full stop before obstacle |
| Watchdog timeout | Kill perception node | E-stop within 200 ms of heartbeat loss |
| Communication loss | Disable all wireless | E-stop within configured timeout (e.g., 5 s) |

**Test repetitions per configuration:** Minimum 30 runs per test ID to establish statistical confidence on braking distance (mean and 99th percentile).

### 10.7 Geofence Boundary Testing

The AV must never leave its authorized operating zone. Geofence violations could result in runway incursion (catastrophic) or entry into restricted areas.

**Geofence test matrix:**

| Test ID | Scenario | Speed | Approach Angle | Pass Criterion |
|---------|----------|-------|----------------|----------------|
| GF-001 | Approach geofence boundary head-on | 15 km/h | 90° to boundary | Stop >1 m before boundary |
| GF-002 | Approach geofence boundary at angle | 15 km/h | 45° to boundary | Stop >1 m before boundary |
| GF-003 | Approach geofence boundary at high speed | 25 km/h | 90° to boundary | Stop before boundary |
| GF-004 | GPS dropout near boundary | 10 km/h | 90° to boundary | Detect GPS loss, stop (not rely on dead reckoning to cross) |
| GF-005 | Route planned through geofence | N/A | N/A | Planner rejects route, replans |
| GF-006 | Dynamic geofence update (NOTAM) | 10 km/h | Toward new restriction | Geofence updates, AV reroutes |
| GF-007 | Geofence near taxiway crossing | 10 km/h | Approach crossing | AV crosses only when cleared, does not violate surrounding geofence |

---

## 11. Test Infrastructure Requirements

### 11.1 Test Track Layout

A dedicated test track for airside AV validation should replicate the key features of an airport apron environment.

**Minimum test track elements:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Track Layout                         │
│                    (minimum 100m x 60m)                      │
│                                                              │
│  ┌──────────────────────────────────────┐                    │
│  │        Mock Apron Area               │                    │
│  │   ┌─────┐    ┌─────┐    ┌─────┐    │                    │
│  │   │Stand│    │Stand│    │Stand│    │                    │
│  │   │  1  │    │  2  │    │  3  │    │                    │
│  │   └──┬──┘    └──┬──┘    └──┬──┘    │                    │
│  │      │          │          │        │                    │
│  │   [Aircraft] [Aircraft] [Aircraft]  │                    │
│  │   [Mockup]   [Mockup]   [Mockup]   │                    │
│  │      │          │          │        │                    │
│  │   Service road ═══════════════════  │                    │
│  │                                      │                    │
│  │   [GSE       ] [Mannequin] [GSE   ] │                    │
│  │   [Obstacles ] [Targets  ] [Obst. ] │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ═══════ Service Road (straight, 200m) ═══════               │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │ Taxiway       │    │ Mock Depot   │                       │
│  │ Crossing      │    │ (start/end)  │                       │
│  │ Simulation    │    │              │                       │
│  └──────────────┘    └──────────────┘                       │
│                                                              │
│  ┌──────────────┐                                           │
│  │ Lighting      │                                           │
│  │ Array         │  (adjustable: 0 to 500 lux)              │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

**Physical mock-ups required:**

| Item | Specification | Estimated Cost | Purpose |
|------|--------------|----------------|---------|
| Aircraft nose mockup | Foam/inflatable, A320 dimensions, correct reflectivity | $5-15K | Aircraft proximity testing |
| Aircraft wing section | 10 m span, correct height, reflective surface | $3-8K | Wing clearance testing |
| GSE obstacles | Foam belt loader, baggage tractor, fuel truck (static) | $2-5K each | Obstacle avoidance testing |
| Pedestrian mannequins (x5) | ISO 19206-2 compliant, articulated | $2-3K each | Personnel detection testing |
| Motorized mannequin cart (x2) | Programmable 1-8 km/h, direction control | $5-10K each | Dynamic personnel testing |
| Surface markings | Airport-standard stand markings, safety zone paint | $5-10K | Navigation, geofence testing |
| Portable lighting array | LED flood lights, adjustable 0-500 lux | $3-5K | Night/lighting testing |
| Rain simulation system | Sprinkler array for controlled rain conditions | $5-10K | Wet weather testing |
| FOD objects | Standard FOD items (tools, debris, bags) at various sizes | $500-1K | FOD detection testing |

**Total test track setup cost:** $50-100K (excluding land and site preparation)

### 11.2 Ground Truth Instrumentation

To validate AV perception and localization, high-accuracy ground truth is essential.

| Instrument | Purpose | Accuracy | Cost |
|-----------|---------|----------|------|
| RTK-GPS base station + rover | Vehicle position ground truth | +/-0.02 m | $5-15K |
| Overhead tracking cameras (4K, 60fps) | Bird's-eye view, actor positions | +/-0.1 m at 10 m height | $10-20K (4-camera system) |
| Radar speed gun | Vehicle speed verification | +/-0.5 km/h | $500-2K |
| Laser distance meter (mounted) | Braking distance measurement | +/-0.001 m | $1-3K |
| Time-synchronized data logger | Correlate ground truth with AV data | <1 ms sync | $5-10K |
| Weather station | Wind, temperature, humidity, rain rate | Meteorological grade | $2-5K |
| Surface friction tester | Friction coefficient measurement | +/-0.01 mu | $3-8K (rental) |

**Total instrumentation cost:** $30-65K

### 11.3 Test Vehicle Configuration

The test vehicle must be configured for both safe testing and comprehensive data collection:

**Required test configuration:**

| Feature | Description | Purpose |
|---------|-------------|---------|
| Remote emergency stop | Wireless e-stop with 100+ m range, <200 ms latency | Safety during testing |
| Data logging | Full rosbag recording (all topics, all sensors) | Post-test analysis |
| Ground truth integration | RTK-GPS rover, sync to vehicle clock | Localization validation |
| Speed limiter (hardware) | Configurable maximum speed (5/10/15/25 km/h) | Enforce speed limits during test phases |
| Perception debug output | Real-time visualization of detections, planned path | Test engineer monitoring |
| Remote monitoring | Wireless video + telemetry to control station | Test oversight |
| Quick-release ballast | Simulate loaded/unloaded conditions | Load variation testing |
| Sensor health monitoring | Real-time status of all sensors | Detect sensor issues during test |

### 11.4 Test Campaign Cost Estimates

**Per-airport certification test campaign:**

| Activity | Duration | Personnel | Cost |
|----------|----------|-----------|------|
| **Test track setup** | 2-4 weeks | 2-3 engineers | $50-100K (one-time) |
| **SiL testing** (52,000+ scenarios) | 2-3 weeks (computation) | 1-2 engineers | $10-20K (compute + labor) |
| **HIL testing** (1,000 hours) | 4-6 weeks | 1-2 engineers | $15-30K |
| **Physical test track** (500 scenarios) | 2-3 weeks | 2-3 engineers + safety personnel | $25-50K |
| **Shadow mode** (50,000 km) | 3-12 months | 1 safety operator per vehicle | $80-200K |
| **On-airport testing** (10,000 km) | 2-6 months | 1-2 engineers + safety operator | $40-100K |
| **Third-party assessment** | 4-8 weeks | External auditor | $30-80K |
| **Documentation and reporting** | 2-4 weeks | 1-2 engineers | $10-20K |
| **Total first airport** | **12-24 months** | | **$260-600K** |
| **Total additional airport** | **6-12 months** | | **$130-350K** |

**Cost reduction for subsequent airports:**
- Test track infrastructure is reusable (transport to new airport or build permanent facility)
- SiL test suite is reusable (only airport-specific scenarios need creation)
- HIL test rig is reusable
- Shadow mode duration may be reduced if technology matures
- Regulatory precedent may streamline approval

---

## 12. Key Findings Summary

| # | Finding | Implication |
|---|---------|------------|
| 1 | **RAND study proves real-world mileage alone is insufficient**: 11 billion miles needed to prove 20% better than human at 95% confidence | Simulation is a mathematical necessity, not optional |
| 2 | **Zhao-Weng theorem sets sample sizes**: 299,572 zero-failure tests needed for 99.999% reliability at 95% confidence | SiL must achieve 300K+ scenario runs for safety-critical claims |
| 3 | **Pairwise covering arrays reduce test cases by >4,800x** while capturing 93% of parameter-interaction faults | Use NIST ACTS tool for systematic scenario generation |
| 4 | **Importance sampling can reduce rare-event sample sizes by 10,000x** compared to naive Monte Carlo | Bias test distribution toward high-risk scenarios; correct with importance weights |
| 5 | **CMA-ES discovers critical scenarios that random testing misses**: evolutionary search finds multi-actor failure modes 15-30% more effectively than random generation | Run adversarial scenario search campaigns monthly |
| 6 | **LLM-generated scenarios find 15-30% more failure modes** than random scenario generation at equal computational cost | Use GPT-4/Claude to generate edge cases from safety requirements |
| 7 | **Metamorphic testing catches 5-10% of bugs that oracle-based testing misses**: violations of monotonicity relations (slower should be safer) reveal logic errors | Add metamorphic relations to regression suite |
| 8 | **Sim-to-real AP gap must be <5% for certification evidence**: larger gap invalidates simulation results | Invest $10-15K per airport in sensor model calibration |
| 9 | **Bayesian estimation with sim+field data produces tighter bounds** than either alone: discount factor 0.1 for CARLA-quality simulation | Formally combine sim and field evidence in safety case |
| 10 | **Shadow mode requires 50,000+ km before supervised autonomous**: industry consensus (TractEasy, Waymo, Cruise precedents) | Plan 3-12 months of shadow mode per airport |
| 11 | **100 golden scenarios gate every deployment**: must-pass set covering all hazard categories with zero tolerance for failure | Curate and never delete golden scenarios |
| 12 | **Physical e-stop testing needs 30+ repetitions per configuration** for statistical confidence on braking distance | Budget 2-3 weeks of test track time for e-stop alone |
| 13 | **First-airport certification costs $260-600K over 12-24 months**: drops to $130-350K for additional airports | Front-load infrastructure investment for multi-airport scaling |
| 14 | **Multi-simulator strategy is optimal**: Gazebo (CI/CD) + CARLA (SiL) + Isaac Sim (digital twin) + physical testing | No single simulator covers all V&V needs |
| 15 | **Aircraft proximity is highest-consequence test category**: $250K average damage, up to $139M+ structural, zero tolerance | Dedicate 15 golden scenarios and 1,000+ SiL runs to aircraft clearance |
| 16 | **Jet blast has no road-driving equivalent**: requires custom airside test protocols with thermal sensor validation | Invest in physics-based jet blast simulation model |
| 17 | **Digital twin construction costs $65-135K per airport** but enables unlimited safe testing of dangerous scenarios | ROI positive if replacing even 10% of physical test hours |
| 18 | **Ground truth instrumentation costs $30-65K** (RTK base, overhead cameras, weather station, friction tester) | Essential one-time investment for all physical testing |
| 19 | **MC/DC coverage required for ASIL-B safety-critical code** (ISO 26262 Part 6) | Applies to aurrigo_safety, aurrigo_perception detection path, aurrigo_control actuator commands |
| 20 | **4-wise covering arrays capture 98% of parameter-interaction faults** with ~1,500 test cases (vs. 390K full combinatorial) | Use 4-wise as default for critical scenarios; pairwise for lower-risk |

---

## 13. References

### Standards

1. **ISO 3691-4:2023** -- Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks and their systems
2. **ISO 34502:2022** -- Road vehicles -- Test scenarios for automated driving systems -- Scenario based safety evaluation framework
3. **ISO 21448:2022 (SOTIF)** -- Road vehicles -- Safety of the intended functionality
4. **ISO 26262:2018** -- Road vehicles -- Functional safety (Parts 1-12)
5. **ISO 13849-1:2023** -- Safety of machinery -- Safety-related parts of control systems -- Part 1: General principles for design
6. **ISO 12100:2010** -- Safety of machinery -- General principles for design -- Risk assessment and risk reduction
7. **EU Machinery Regulation 2023/1230** -- Regulation of the European Parliament and of the Council on machinery (replacing Directive 2006/42/EC)
8. **UL 4600:2023** -- Standard for Safety for the Evaluation of Autonomous Products (3rd edition)
9. **ANSI/UL 3100** -- Standard for Safety for Autonomous Mobile Platforms
10. **ASAM OpenSCENARIO DSL (v2.0)** -- Domain-Specific Language for driving scenario description

### Academic Papers

11. **Kalra, N. & Paddock, S.M. (2016)** -- "Driving to Safety: How Many Miles of Driving Would It Take to Demonstrate Autonomous Vehicle Reliability?" RAND Corporation. RR-1478-RC.
12. **Shalev-Shwartz, S., Shammah, S., & Shashua, A. (2017)** -- "On a Formal Model of Safe and Scalable Self-driving Cars." Mobileye/Intel. arXiv:1708.06374.
13. **Kuhn, D.R., Wallace, D.R., & Gallo, A.M. (2004)** -- "Software Fault Interactions and Implications for Software Testing." IEEE Transactions on Software Engineering, 30(6), 418-421.
14. **Tian, Y. et al. (2024)** -- "LLM-Driven Scenario Generation for Autonomous Driving Testing." IEEE Intelligent Vehicles Symposium.
15. **Zhao, D. et al. (2017)** -- "Accelerated Evaluation of Automated Vehicles Safety in Lane-Change Scenarios Based on Importance Sampling Techniques." IEEE TITS.
16. **Corso, A. et al. (2021)** -- "A Survey of Algorithms for Black-Box Safety Validation of Cyber-Physical Systems." JAIR.
17. **Sun, Z., Guo, L., & Zhao, D. (2021)** -- "Statistical Safety Assessment for Autonomous Vehicles." Springer.
18. **Fremont, D.J. et al. (2020)** -- "Scenic: A Language for Scenario Specification and Data Generation." Machine Learning Journal.
19. **Hansen, N. (2016)** -- "The CMA Evolution Strategy: A Tutorial." arXiv:1604.00772.
20. **Weng, B. et al. (2022)** -- "Model-Based Safety Testing of Automated Driving Systems: A Systematic Literature Review." IEEE Access.

### Industry Reports and Tools

21. **NIST ACTS** -- Automated Combinatorial Testing for Software (covering array generation tool). https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software
22. **IATA Ground Damage Database** -- Annual reports on aircraft ground damage from GSE collisions
23. **Flight Safety Foundation GAP** -- Ground Accident Prevention programme data
24. **Waymo Safety Report** (2023-2024) -- Published methodology for AV safety validation
25. **TractEasy Safety Case** -- Publicly referenced certification approach for airport baggage tractors (1-6 years per approval, >95% mission success)
26. **CARLA Simulator** -- Open-source autonomous driving simulator. https://carla.org
27. **NVIDIA Isaac Sim** -- Robotics simulation platform. https://developer.nvidia.com/isaac-sim
28. **Euro NCAP AEB Test Protocol** -- Autonomous Emergency Braking test methodology (adapted for pedestrian mannequin testing)
29. **ISO 19206-2:2018** -- Test devices for target vehicles, vulnerable road users and other objects -- Part 2: Requirements for pedestrian targets

### Related Documents in This Repository

30. **[airside-scenario-taxonomy.md](airside-scenario-taxonomy.md)** -- 115 functional scenarios, 566 logical, ~5,400 concrete across 8 categories
31. **[../standards-certification/certification-guide.md](../standards-certification/certification-guide.md)** -- ISO 3691-4, UL 4600, AMLAS, ISO 26262, CE marking, FAA approval process
32. **[../runtime-assurance/simplex-safety-architecture.md](../runtime-assurance/simplex-safety-architecture.md)** -- Dual-stack architecture, RSS for airside, OOD detection, shadow mode logging
33. **[../standards-certification/functional-safety-software.md](../standards-certification/functional-safety-software.md)** -- MISRA C, ISO 26262 Part 6, static analysis pipeline
34. **[../../70-operations-domains/airside/operations/fod-and-jetblast.md](../../70-operations-domains/airside/operations/fod-and-jetblast.md)** -- FOD detection and jet blast hazard analysis
35. **[../safety-case/failure-modes-analysis.md](../safety-case/failure-modes-analysis.md)** -- Perception, world model, and planning failure taxonomy
36. **[../../30-autonomy-stack/simulation/simulators-for-airside.md](../../30-autonomy-stack/simulation/simulators-for-airside.md)** -- CARLA, Isaac Sim, Gazebo evaluation for airside environments
37. **[../../30-autonomy-stack/simulation/airport-digital-twins.md](../../30-autonomy-stack/simulation/airport-digital-twins.md)** -- Airport digital twin construction and validation
38. **[../../90-synthesis/decisions/design-spec.md](../../90-synthesis/decisions/design-spec.md)** -- 891-line Simplex architecture design specification
