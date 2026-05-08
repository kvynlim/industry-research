# Section 5: Formal Methods, Safety Verification & Airport-Specific Hazards

## Deep Dive Feasibility Analysis -- Recommendations #30-36

**Scope:** Formal Safety Distance Model (RSS-Inspired), Temporal Logic Safety Specifications, Rulebook Framework, ISO 26262/SOTIF Alignment, Jet Blast Zone Modeling, Sensor Staleness Detection

**Analysis Date:** 2026-03-16
**Analyst Role:** Senior Perception Engineer / Safety Architect

---

## Regulatory Landscape Summary

### Airport-Specific Regulatory Framework

Unlike road vehicles (governed by national highway codes and type-approval regulations), autonomous airside vehicles operate in a unique regulatory space that spans multiple authorities:

1. **ICAO Annex 14 / Doc 9137** -- Sets international standards for aerodrome design, operations, and ground vehicle management. Does not explicitly address autonomous vehicles but establishes the safety management framework within which they must operate.

2. **IATA AHM (Airport Handling Manual), 45th Edition (2025)** -- AHM 908 now includes explicit provisions for autonomous vehicle operations airside, including risk assessment toolbox, sensor failure notification protocols, and categories for equipment with/without human involvement. This is the most directly applicable industry standard.

3. **UK CAA / Airports (Ground Handling) Regulations 1997** -- Under the Civil Aviation Act 2012, the CAA grants ground handling licences. reference airside AV stack holds a licence at East Midlands Airport (valid to June 2026) under this framework. The CAA's CAP 790 governs airside driving permits but does not yet address autonomous operations specifically.

4. **EASA** -- Currently focused on airborne AI trustworthiness (NPA 2025-07) and Innovative Air Mobility (VTOL). No specific regulation for autonomous ground vehicles airside exists yet. EASA's AI regulatory framework (RMT 0742) will extend to aviation domains in 2026-2027.

5. **ISO 26262 / ISO 21448 (SOTIF)** -- Both are formally scoped to "road vehicles." Airport ground vehicles are not road vehicles. However, these standards represent industry best practice and are used as reference frameworks by safety assessors. Zoox and Kodiak cite them; reference airside AV stack should adopt them voluntarily as part of the safety case.

6. **DO-178C** -- Applies to airborne software, not ground support equipment. However, airport authorities may reference DO-178C principles for software assurance of safety-critical ground systems, especially for NUIC (No User in Charge) operations.

### the reference airside AV stack's Specific Regulatory Position

reference airside AV stack is actively developing a NUIC framework in collaboration with IAG to define the safety, regulatory, cybersecurity and operational standards for driverless airport deployment. The Changi Airport precedent (Uisee tractors deployed January 2026 after 20,000 km of trials with zero safety incidents) demonstrates that autonomous airside deployment is achievable, but requires:
- Designated autonomous vehicle zones marked on the airside
- Remote operator oversight from a control centre
- Co-funding/endorsement from the local Civil Aviation Authority

### Key Operational Constraints

- **Apron speed limits:** Typically 15-30 km/h (airport-specific, not ICAO-mandated). the reference airside AV stack's vehicles operate at very low speeds (walking pace to ~25 km/h).
- **Jet blast zones:** Exhaust hazard areas extend 60m+ behind idling aircraft at 40% thrust; up to 400 feet (122m) at breakaway thrust (Boeing data via IATA).
- **Sensor environment:** Jet exhaust, rain, de-icing fluid spray, FOD, dark-clothed ground crew, reflective aircraft surfaces, dynamic stand layouts.

---

## Recommendation #32: Formal Safety Distance Model (RSS-Inspired)

### Original Assessment
**Original Priority:** High
**Original Complexity:** Medium (3-4 weeks)

### Revised Assessment
**Revised Priority:** HIGH (confirmed, elevate to near-Critical for NUIC pathway)
**Feasibility Verdict:** FEASIBLE

### Airport Regulatory Context

- **IATA AHM 908** requires risk assessment for autonomous vehicle operations. An RSS-based safety distance model provides a mathematically auditable response to this requirement -- the distance model parameters become part of the documented safety case.
- **UK CAA** does not mandate a specific safety distance model, but the NUIC framework reference airside AV stack is co-developing with IAG will need a provable collision avoidance argument. RSS provides exactly this.
- **Changi precedent:** Uisee's deployment uses designated autonomous vehicle zones with clearly marked boundaries. RSS-derived minimum distances would formalize what is currently achieved by zone segregation.

### Industry Reality Check

- **Deployed:** Mobileye's RSS is deployed in production ADAS (230M+ vehicles with EyeQ technology). Volkswagen's robotaxi programme (targeting 6 cities by 2027) uses Mobileye RSS. The model has been validated at road speeds far exceeding airport apron speeds.
- **Standards recognition:** China ITS has approved RSS as the basis for a forthcoming AV safety standard. IEEE P2846 references RSS concepts. The SAE EDGE research report "Safety-First for Automated Driving" (co-authored by 11 companies) builds on RSS principles.
- **Open-source implementation:** Intel's `ad-rss-lib` (C++, Apache 2.0 licence) provides a complete RSS implementation. It is already integrated into CARLA simulator and Apollo autonomous driving stack. The library supports unstructured roads and pedestrian scenarios relevant to airport aprons.
- **Cost:** Open-source library + 3-4 weeks engineering effort. No licence fees.

### Source Code Integration Analysis

**Where it integrates:** The RSS safety distance model should be implemented as a new module consumed by two existing systems:

1. **`SafetyMonitor` (`/home/kvyn/ubuntu_20-04/z-airside-ws/src/airside_nav/src/behaviour_planner/safety_monitor.cpp`)** -- Currently performs only 2 checks (remote e-stop and system health). The RSS distance checker would be added as a third check in `checkAll()`:
   ```
   checkRemoteEstop();
   checkSystemHealth();
   checkRssSafeDistance();  // NEW: RSS longitudinal + lateral checks
   ```
   The `SafetyMonitor::report()` mechanism and `SafetyLevel` enum already support graded responses (CLEAR, WARNING, STOP, EMERGENCY). An RSS violation would report at STOP level, feeding into the `StopArbiter` priority chain.

2. **`LocalPlanningNodelet` (`/home/kvyn/ubuntu_20-04/z-airside-ws/src/airside_nav/include/airside_nav/local_planner/local_planning_nodelet.h`)** -- The Frenet trajectory generator evaluates 420 candidates per cycle. RSS safe distance can be added as a hard constraint during `checkTrajectoryCollisions()`. Trajectories that violate RSS longitudinal or lateral minimums would be marked infeasible (`has_collision = true`).

**Input data available:** The local planner already has:
- `current_vehicle_velocity` (from CAN feedback at 50Hz)
- `obstacles_` vector with `ObstaclePolygon` containing `velocity` (from perception `DetectedObjectArray`)
- `nearest_obstacle_distance_` and zone distances
- `emergency_ttc_threshold_` (currently 1.5s) -- RSS formalizes what TTC approximates informally

**RSS parameter calibration for airport domain:**
- `rho` (reaction time): 0.5-1.0s (system reaction, not human -- the vehicle is autonomous)
- `a_min_brake` (ego min braking): ~2.0 m/s^2 (conservative; `VEL_PLAN_COMFORT_DECEL` is already 1.7 m/s^2)
- `a_max_brake_front` (other vehicle max braking): 4.0 m/s^2 (airport tugs/tractors)
- `v_max`: 25 km/h (~7 m/s) at most
- `mu_lat` (static lateral margin): 1.5m from aircraft fuselage, 1.0m from personnel
- At v_ego = 7 m/s: d_safe_long = 7*0.5 + 49/(2*2.0) - 49/(2*4.0) = 3.5 + 12.25 - 6.125 = 9.625m. This is reasonable for an apron.

### Revised Implementation Plan

**Step 1 (Week 1):** Integrate Intel `ad-rss-lib` as a third-party dependency. Build and test standalone with unit tests using airport-parameterized scenarios.

**Step 2 (Week 2):** Create `RssSafetyChecker` class that:
- Subscribes to `/polygon_detector/objects` (tracked objects with velocities)
- Subscribes to `/odom/fused` (ego state)
- Computes RSS safe distances for each tracked object
- Publishes `/av_nav/safety/rss_status` (diagnostic) and exposes `isViolated()` for SafetyMonitor

**Step 3 (Week 3):** Integrate into `SafetyMonitor` as a third check. Wire RSS violations into `StopArbiter` at priority level 3 (between YIELD_LANE and PAUSE_WAYPOINT). Add airport-specific hard constraints: minimum distance from aircraft engines (jet intake 10m, exhaust 60m at idle).

**Step 4 (Week 4):** Integrate as hard constraint in Frenet trajectory evaluation. Validate with bag file replay using known scenarios (approaching aircraft, following tug, personnel near path).

**Estimated effort:** 4 weeks (1 engineer). Parallelizable with other perception work.

**Certification pathway:** RSS model + parameters documented in safety case for NUIC framework. Parameters auditable and traceable. Intel ad-rss-lib is well-documented and the RSS paper (Shalev-Shwartz et al., 2017) is peer-reviewed.

### Risk Assessment

- **Technical risk: LOW.** The mathematics is straightforward, the library exists, and the integration points in the codebase are clear.
- **Regulatory risk: LOW.** RSS strengthens rather than replaces existing safety mechanisms. No regulator has objected to RSS adoption.
- **Operational risk: MEDIUM.** If RSS parameters are too conservative for tight apron manoeuvres (e.g., docking to JCPL), the vehicle may refuse to approach. Mitigation: separate "docking mode" parameters with relaxed lateral margins when `is_docked` signal is active and speed < 0.5 m/s. The `UldStateMachine` states (LOADING, UNLOADING) already provide the context needed.

---

## Recommendation #33: Temporal Logic Safety Specifications

### Original Assessment
**Original Priority:** Medium
**Original Complexity:** Medium-High (4-6 weeks)

### Revised Assessment
**Revised Priority:** MEDIUM (confirmed, but critical dependency for NUIC pathway)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

### Airport Regulatory Context

- **IATA AHM 908** risk assessment toolbox requires identification of safety risks and mitigations. Formal temporal logic specifications make these machine-checkable rather than document-only.
- **NUIC framework:** For removing the safety operator, reference airside AV stack needs to demonstrate that safety invariants are continuously monitored. STL runtime monitoring provides exactly this evidence trail.
- **SMS (Safety Management System):** ICAO Annex 19 requires airports to maintain an SMS. Formal safety specifications with logged violations feed directly into the SMS hazard register.

### Industry Reality Check

- **Deployed:** Motional/nuTonomy demonstrated the TuLiP toolbox for temporal logic verification. However, runtime STL monitoring is more practical for operational systems.
- **Tooling exists:** `rtamt` (Runtime Monitoring Analysis Tool) is an open-source Python/C++ library for online STL monitoring. The `rtamt4ros` extension provides native ROS integration. C++ backend achieves ~0.05ms per sample -- negligible overhead at 10Hz monitoring rate.
- **Academic validation:** Encoding and monitoring RSS rules in STL has been demonstrated (ACM MEMOCODE 2019). PerceMon provides perception-specific STL monitoring integrated with ROS.
- **Cost:** Open-source tools, no licence fees. Engineering effort is primarily in specification elicitation.

### Source Code Integration Analysis

**Where it integrates:** A new `SafetySpecificationMonitor` node (standalone, not a nodelet) that:

1. Subscribes to key state topics already published:
   - `/odom/fused` (ego velocity, position)
   - `/polygon_detector/objects` (obstacle distances)
   - `/av_nav/safety/diagnostics` (sensor health from SafetyMonitor)
   - `/av_nav/cmd_twist` (commanded velocity)
   - `/uld_detection/state` (ULD state machine state)

2. Evaluates STL specifications at 10Hz using `rtamt4ros`

3. Publishes violations to `/av_nav/safety/stl_violations` and logs to bag file

**Key specifications for airport operations (initial set of 10):**

| # | Specification (natural language) | STL encoding | Source |
|---|---|---|---|
| 1 | Always maintain > d_min from any obstacle | `G(min_obstacle_dist > 2.0)` | RSS |
| 2 | Never exceed apron speed limit | `G(ego_speed < 7.0)` | Airport ops |
| 3 | Always have >= 3 LiDAR sensors reporting | `G(active_lidar_count >= 3)` | Sensor health |
| 4 | If obstacle detected < 5m, stop within 2s | `G((obstacle_dist < 5.0) -> F[0,2](ego_speed < 0.1))` | Safety |
| 5 | Never enter aircraft engine exclusion zone | `G(dist_to_engine_zone > 0.0)` | Jet blast |
| 6 | Sensor staleness < 200ms for all LiDARs | `G(max_sensor_staleness < 0.2)` | Data integrity |
| 7 | EKF innovation norm stays bounded | `G(ekf_innovation_norm < 1.0)` | Perception |
| 8 | TTC > 1.5s whenever speed > 0.5 m/s | `G((ego_speed > 0.5) -> (ttc > 1.5))` | RSS |
| 9 | Vehicle stops within 3s of e-stop signal | `G(estop_signal -> F[0,3](ego_speed < 0.01))` | Safety |
| 10 | ULD detection confidence > 0.3 during LOADING state | `G((uld_state == LOADING) -> (jcpl_confidence > 0.3))` | Perception |

### Revised Implementation Plan

**Step 1 (Week 1-2):** Install `rtamt4ros`. Define initial 10 STL specifications in YAML config file. Implement `SafetySpecificationMonitor` ROS node that loads specs and subscribes to required topics.

**Step 2 (Week 3):** Implement runtime evaluation loop at 10Hz. Log all specification robustness values (not just violations) to diagnostic topic. Critical violations (specs 1, 2, 4, 5, 9) trigger `SafetyMonitor` report via service call or topic.

**Step 3 (Week 4-5):** Replay all available bag files through the monitor. Catalogue any existing specification violations. Tune thresholds based on operational data. Add airport-specific specifications from consultation with airport operations team.

**Step 4 (Week 6):** Integrate critical violations into `StopArbiter` priority chain. Document specification rationale for NUIC safety case. Establish process for specification review and update.

**Estimated effort:** 5-6 weeks (1 engineer). Weeks 1-3 can overlap with RSS implementation.

**Certification pathway:** STL specifications + violation logs become a core artefact of the NUIC safety case. Each specification maps to a hazard in the safety management system.

### Risk Assessment

- **Technical risk: LOW.** rtamt4ros is proven. The monitoring is read-only (does not interfere with control).
- **Specification risk: MEDIUM.** Incorrect specifications may cause false alarms (overly tight) or miss real hazards (too loose). Mitigation: extensive bag-file replay and parameter tuning before deployment. Start with monitoring-only mode (log but don't trigger stops) for first 2 months.
- **Performance risk: LOW.** 10Hz evaluation of 10-20 STL specs adds < 5ms per cycle. The monitor runs in its own process.

---

## Recommendation #34: Rulebook Framework for Airport Ground Movement Rules

### Original Assessment
**Original Priority:** Medium
**Original Complexity:** Medium (3-5 weeks)

### Revised Assessment
**Revised Priority:** MEDIUM-LOW (defer until after RSS and STL are operational)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

### Airport Regulatory Context

- The airport ground movement rule hierarchy is naturally well-defined and static (unlike on-road driving where social norms are ambiguous). This makes it an excellent domain for a Rulebook framework.
- Airport operations already have implicit rule hierarchies (avoid aircraft damage > avoid personnel injury > obey taxi markings > maintain schedule). A Rulebook formalizes what operators already understand.

### Industry Reality Check

- **Motional/nuTonomy** published the Rulebook framework (Censi et al., ICRA 2019) and used it in their planning stack. However, Motional has since ceased operations (March 2024), reducing available support.
- **No open-source implementation** exists. The Rulebook is a design pattern, not a library.
- **Practical alternative:** The existing `StopArbiter` in the behavior planner already implements a priority-based stop resolution (10 priority levels from NONE to SAFETY_EMERGENCY). This is effectively a simplified Rulebook for stopping decisions. Extending it to trajectory selection (not just speed gating) would achieve much of the Rulebook's value.

### Source Code Integration Analysis

**Where it integrates:** The `StopArbiter` already at `/home/kvyn/ubuntu_20-04/z-airside-ws/src/airside_nav/src/behaviour_planner/stop_arbiter.cpp` implements 10-level priority resolution. The Frenet trajectory selector in `LocalPlanningNodelet` evaluates candidates by cost function with weights for jerk, lateral offset, curvature, velocity, and obstacle proximity.

The gap: trajectory selection does not use a strict priority ordering. It uses weighted cost summation, meaning a slightly faster trajectory could be selected over a slightly safer one if the weights are not perfectly calibrated. A Rulebook would enforce lexicographic ordering: first minimize safety violations, then minimize rule violations, then optimize comfort.

**Practical modification:** Rather than implementing a full Rulebook framework, modify `selectBestFrenetTrajectory()` to use a two-stage selection:
1. **Stage 1 (hard constraints):** Filter out trajectories that violate RSS, enter exclusion zones, or exceed speed limits. This is already partially done via `has_collision`.
2. **Stage 2 (priority-ordered soft constraints):** Among feasible trajectories, select by lexicographic ordering of (min clearance to aircraft, min clearance to personnel, marking deviation, travel time).

### Revised Implementation Plan

**Step 1 (Week 1):** Formalize the rule hierarchy in a YAML configuration file:
```yaml
rules:
  - priority: 1
    name: no_collision
    type: hard_constraint
    metric: min_obstacle_clearance
    threshold: 0.0
  - priority: 2
    name: rss_safe_distance
    type: hard_constraint
    metric: rss_violation_count
    threshold: 0
  - priority: 3
    name: aircraft_clearance
    type: soft_constraint
    metric: min_aircraft_distance
    weight: lexicographic
  # ... etc
```

**Step 2 (Week 2-3):** Implement `RulebookEvaluator` that takes a vector of `FrenetTrajectory` and returns the best one according to the priority ordering. Replace the weighted cost function call in `selectBestFrenetTrajectory()`.

**Step 3 (Week 4):** Validate with bag file replay. Compare trajectory selections between old (weighted cost) and new (Rulebook) approaches.

**Estimated effort:** 3-4 weeks (1 engineer). Should be scheduled after RSS integration (depends on RSS as a hard constraint input).

**Certification pathway:** The rule hierarchy document becomes part of the operational design domain (ODD) specification for the NUIC safety case.

### Risk Assessment

- **Technical risk: LOW-MEDIUM.** The modification is well-contained within the trajectory selection module.
- **Operational risk: MEDIUM.** Lexicographic ordering can produce overly conservative behaviour if the rule hierarchy does not account for edge cases. For example, during docking operations, the "maintain safe distance from aircraft" rule must have an exception for the intended approach to the JCPL.
- **Schedule risk:** Should not be started until RSS is integrated, as RSS provides the safety distance metrics the Rulebook uses.

---

## Recommendation #35: ISO 26262 / SOTIF Alignment for Perception Safety Case

### Original Assessment
**Original Priority:** Low
**Original Complexity:** High (ongoing)

### Revised Assessment
**Revised Priority:** HIGH (elevated -- this is a prerequisite for NUIC certification)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

### Airport Regulatory Context

- **Critical finding:** ISO 26262 and ISO 21448 are formally scoped to "road vehicles." However, the reference airside AV stack's NUIC framework with IAG explicitly requires defining "safety, regulatory, cybersecurity and operational standards." In the absence of an airport-specific functional safety standard, ISO 26262 and SOTIF serve as the de facto reference frameworks.
- **Zoox precedent:** Zoox cites ISO 26262, SOTIF, and ARP4754A in their safety framework for their on-road robotaxi, showing that AV companies voluntarily adopt these standards.
- **Kodiak precedent:** Claims ASIL-D compliance for their ACE (Autonomous Compute Engine), demonstrating that rigorous ASIL compliance is achievable for perception/compute hardware.
- **EASA direction:** EASA's AI trustworthiness framework (NPA 2025-07, RMT 0742) will extend to ground systems. Early voluntary alignment with ISO 26262/SOTIF positions reference airside AV stack favourably.

### SOTIF Analysis for the reference airside AV stack's Perception Stack

SOTIF (ISO 21448) specifically addresses "hazards resulting from functional insufficiencies of the intended functionality." For the reference airside AV stack's LiDAR-only perception stack, the triggering conditions analysis is:

| Triggering Condition | Hazardous Behaviour | Current Mitigation | Gap |
|---|---|---|---|
| Jet exhaust plume | False positive obstacles, emergency stop | `airside_rain_detection` SOR filter | Not jet-blast-specific |
| Heavy rain / fog | Reduced detection range, missed obstacles | Multi-return (not yet implemented) | **Critical gap** |
| Dark-clothed personnel at night | Missed detection (low LiDAR reflectivity) | None | **Critical gap** -- thermal camera recommended |
| Reflective aircraft surface | Ghost detections, multipath | None | Medium gap |
| Sensor failure (1 of 5 LiDAR) | Blind spot, missed detection | Aggregator staleness check (200ms) | Partial -- see Rec #31 |
| Novel FOD (dropped tool, debris) | Not classified, potentially ignored | Polygon detector will track as obstacle | Adequate for safety-stop |
| Snow/ice on sensor lens | Degraded or no returns | None | Gap -- lens heater / wiper needed |
| Dynamic stand reconfiguration | Map mismatch, wrong route | Localization uses live LiDAR matching | Adequate |

### Source Code Integration Analysis

**This is primarily a documentation and process activity**, not a code change. However, it requires instrumenting the perception stack to provide evidence:

1. **Perception confidence metrics:** Already partially available via `computeConfidence()` in `UldDetection.cpp` (lines 16-26) and the `vehicle_confidence_` / `jcpl_confidence_` signals. These need to be published to a diagnostic topic for logging.

2. **Sensor coverage analysis:** The aggregator (`PointcloudAggregator.hpp`) tracks per-sensor statistics (`cloud_received_count`, `cloud_stale_count`, `cloud_age_sum`). These should be published as `diagnostic_msgs::DiagnosticArray` for safety case evidence.

3. **Triggering condition monitoring:** The STL specifications from Recommendation #33 directly support SOTIF by monitoring for triggering conditions at runtime.

### Revised Implementation Plan

**Phase 1 -- SOTIF Triggering Condition Analysis (Weeks 1-4):**
- Conduct structured HARA (Hazard Analysis and Risk Assessment) adapted from ISO 26262 for airport operations
- Identify all triggering conditions for the 5-LiDAR perception stack
- Rate each by severity (S), exposure (E), and controllability (C) -- adapting ASIL methodology to airport operations where: S considers aircraft damage (catastrophic) vs personnel injury vs property damage; E considers frequency of exposure to condition (e.g., jet blast: every stand approach); C considers ability of remote operator to intervene (NUIC: lower controllability than supervised operation)
- Document residual risk for each triggering condition

**Phase 2 -- Gap Mitigation Plan (Weeks 4-8):**
- For each identified gap, map to an existing or planned perception recommendation (e.g., multi-return for rain, thermal camera for dark personnel)
- Prioritize based on residual risk
- Create traceability matrix: Hazard -> Triggering Condition -> Mitigation -> Verification Test

**Phase 3 -- Perception Safety Case Document (Weeks 8-12):**
- Compile the safety case in the Goal Structuring Notation (GSN) format
- Top-level goal: "Perception system does not contribute to unreasonable risk during airside operations"
- Sub-goals: one per hazard, supported by evidence from runtime monitoring, testing, and design analysis
- This becomes a deliverable for the NUIC framework

**Phase 4 -- Ongoing Compliance (Continuous):**
- Review safety case quarterly or after any perception stack change
- Incorporate field incident data into triggering condition probabilities
- Update STL specifications as new hazards are identified

**Estimated effort:** 3-4 months elapsed (1 safety engineer, ~50% FTE). External safety consultancy may be beneficial for initial HARA.

**Certification pathway:** The safety case document is the core deliverable for the NUIC framework and any future CAA/EASA certification. Voluntary alignment with ISO 26262 Part 3 (concept phase) and ISO 21448 methodology.

### Risk Assessment

- **Technical risk: LOW.** This is documentation and analysis, not software.
- **Resource risk: HIGH.** Requires safety engineering expertise that may not be available in-house. A functional safety consultant familiar with both automotive (ISO 26262) and aviation (DO-178C) domains is recommended.
- **Regulatory risk: LOW.** Voluntary adoption of ISO 26262/SOTIF methodology is viewed positively by regulators. No regulator will penalise over-compliance.
- **Schedule risk: MEDIUM.** The HARA must be completed before NUIC certification can proceed. If the NUIC timeline is aggressive (IAG project is 9 months), the safety case work is on the critical path.

---

## Recommendation #30: Jet Blast and Engine Exhaust Zone Modeling

### Original Assessment
**Original Priority:** Medium
**Original Complexity:** Medium (3-4 weeks)

### Revised Assessment
**Revised Priority:** HIGH (elevated -- airport-specific safety hazard with direct regulatory implications)
**Feasibility Verdict:** FEASIBLE

### Airport Regulatory Context

- **IATA Engine Danger Areas** document provides specific exclusion zone dimensions per aircraft type and thrust setting. For idle thrust on narrow-body aircraft (e.g., A320/CFM56): approximately 15m hazard radius. For breakaway thrust: up to 60m. For takeoff thrust: up to 120m+.
- **ICAO Doc 9137 Part 8** (Airport Operational Services) addresses ground handling safety zones.
- **SKYbrary** classifies jet efflux as a significant operational hazard with documented incidents.
- **Direct safety relevance:** Jet blast can physically move/overturn a baggage tractor. The perception hazard (false LiDAR returns from hot turbulent air) is secondary to the physical hazard.

### Industry Reality Check

- **No AV industry analog.** This is genuinely airport-domain-specific. On-road AV companies do not encounter jet blast.
- **Airport operations practice:** Human drivers are trained to maintain safe distances from running engines. Autonomous vehicles need this knowledge encoded explicitly.
- **Existing LiDAR data:** Hot exhaust plumes create low-intensity, high-variance LiDAR returns that are temporally transient. The existing `airside_rain_detection` SOR (Statistical Outlier Removal) filter handles some of this, but it was designed for rain, not directional exhaust plumes.

### Source Code Integration Analysis

**Integration point 1 -- Static exclusion zones:** Load jet blast exclusion zones from airport configuration data as polygonal regions in the map frame. The `LocalPlanningNodelet` already supports `ObstaclePolygon` with polygon collision checking (SAT-based). Jet blast zones would be loaded as permanent obstacles with a special type flag.

**Integration point 2 -- Dynamic filtering in perception:** In the `PointcloudPreprocessor` (`/home/kvyn/ubuntu_20-04/z-airside-ws/src/airside_perception/airside_pointcloud_preprocessor/src/PointcloudPreprocessor.cpp`), add a jet blast zone filter that:
- Takes known engine positions (from airport config or from perception of parked aircraft)
- Defines conical exclusion zones behind each engine (cone axis = engine thrust vector, opening angle = ~30 degrees, length = 60m for idle)
- Points within the zone that match the exhaust signature (low intensity < threshold, high frame-to-frame variance) are classified as exhaust artifacts

**Integration point 3 -- RSS extension:** The RSS safety distance model (Recommendation #32) should incorporate jet blast zones as hard constraints. The `mu_lat` (static lateral margin) parameter should be dynamically increased when the vehicle path approaches an engine exhaust zone.

**Data requirements:**
- Aircraft stand positions (from airport operations system or static configuration)
- Aircraft type (determines engine position relative to fuselage)
- Engine operational status (ideally from ground handling coordination, but can default to "assume running" for safety)

### Revised Implementation Plan

**Step 1 (Week 1):** Create `JetBlastZoneManager` class that:
- Loads static stand layout + aircraft type database from YAML config
- Computes conical exclusion zones per engine position
- Publishes zones as `visualization_msgs::MarkerArray` for debugging
- Exposes `isInJetBlastZone(x, y)` query

**Step 2 (Week 2):** Integrate as hard constraint in trajectory planning. Add jet blast zones to the `obstacles_` vector in `LocalPlanningNodelet` as permanent `ObstaclePolygon` entries (high-priority, never expire). Frenet trajectories entering the zone are rejected.

**Step 3 (Week 3):** Add perception-layer exhaust filtering. In the preprocessor, classify points within jet blast zones that have:
- Intensity < configurable threshold (e.g., < 10)
- Temporal variance > threshold (point present in < 3 of last 5 frames)
- Range < 60m from known engine position
Mark these as `JET_EXHAUST` class (do not forward to segmentation/tracking).

**Step 4 (Week 4):** Integration testing with real airport data. Validate that:
- Vehicle refuses to enter jet blast zone during route planning
- False positive obstacles from exhaust plumes are suppressed
- Legitimate obstacles within/near jet blast zones are still detected

**Estimated effort:** 3-4 weeks (1 engineer).

**Certification pathway:** Jet blast zone parameters traceable to IATA engine danger area specifications. Zone definitions auditable in config files.

### Risk Assessment

- **Technical risk: LOW-MEDIUM.** The zone geometry is straightforward. The perception filtering requires tuning to avoid suppressing real obstacles.
- **Data dependency risk: MEDIUM.** If aircraft stand positions and types are not available from the airport operations system, the zones must be configured statically per airport, reducing flexibility.
- **Safety risk if omitted: HIGH.** Without jet blast modeling, the vehicle may attempt to drive through an active exhaust zone, causing either physical damage (blast force) or repeated emergency stops (false positive obstacles from exhaust plume). Both outcomes are unacceptable for NUIC operations.

---

## Recommendation #31: Sensor Staleness Detection and Handling

### Original Assessment
**Original Priority:** Medium
**Original Complexity:** Low-Medium (2-3 weeks)

### Revised Assessment
**Revised Priority:** HIGH (elevated -- existing implementation is minimal, critical for sensor health)
**Feasibility Verdict:** FEASIBLE (partially already implemented)

### Airport Regulatory Context

- **IATA AHM 908** explicitly requires "equipment sensor failure notifications" for autonomous vehicles. Sensor staleness is a precursor to sensor failure -- detecting and handling it enables proactive failure notification.
- **NUIC framework:** Without a safety operator, the system must self-diagnose sensor health. Staleness detection is the first line of defence.

### Industry Reality Check

- **Zoox** published a sensor staleness framework (arXiv:2506.05780) describing a two-tier strategy with per-point timestamp offsets. This is the state of the art.
- **Universal need:** Every multi-sensor AV system needs staleness handling. This is not controversial.

### Source Code Integration Analysis -- CRITICAL FINDING

**The aggregator already has basic staleness handling.** In `PointcloudAggregator.hpp` (line 23):
```cpp
static constexpr double STALE_THRESHOLD = 0.2;  // seconds
```

And in `PointcloudAggregator.cpp` (lines 116-123):
```cpp
double age = (now - clouds_[i].header.stamp).toSec();
stats_.cloud_age_sum[i] += age;

if (age > STALE_THRESHOLD) {
    stats_.cloud_stale_count[i]++;
    ROS_WARN_THROTTLE(1.0, "Cloud '%s' is stale (%.1fs old)", topic_names_in_[i].c_str(), age);
    continue;  // Skip stale cloud
}
```

**What exists:**
- Binary stale/not-stale check with 200ms threshold
- Per-sensor statistics tracking (received count, stale count, age sum)
- Diagnostic printing every 30 seconds

**What is missing (gaps):**
1. **No ego-motion compensation for stale-but-usable data.** The current implementation has only two states: use normally or discard. Zoox's two-tier strategy adds an intermediate state where data aged 50-150ms is used but compensated for ego motion.
2. **No per-point timestamp handling.** RoboSense RS32 provides per-point timestamps within the scan. The aggregator treats the entire scan as having a single timestamp. For a rotating LiDAR at 10Hz, points within a single scan span 100ms, causing up to ~17cm positional error at 6 m/s (airport speed) even for "fresh" data.
3. **No staleness published to diagnostic topic.** The statistics are logged but not published as `diagnostic_msgs::DiagnosticArray`. The `SafetyMonitor` cannot react to sensor staleness.
4. **No degraded mode.** If 2 of 5 LiDARs go stale, the vehicle continues at full speed with reduced coverage. There is no speed reduction or alert escalation based on sensor availability count.

### Revised Implementation Plan

**Step 1 (Week 1):** Enhance aggregator with three-tier staleness:
```cpp
constexpr double TIER1_THRESHOLD = 0.05;   // 50ms: use normally
constexpr double TIER2_THRESHOLD = 0.15;   // 50-150ms: use with ego-motion compensation
constexpr double STALE_THRESHOLD = 0.20;   // >200ms: discard
```
For Tier 2, apply ego-motion compensation using the TF transform between `t_sensor` and `t_current`. The TF buffer (`tf_buffer_`) is already available in the aggregator.

**Step 2 (Week 1-2):** Publish per-sensor staleness to `/perception/sensor_health` as `diagnostic_msgs::DiagnosticArray`. Include: current age, tier classification, received rate, stale rate.

**Step 3 (Week 2):** Add degraded mode logic:
- 5/5 LiDARs healthy: full speed
- 4/5 healthy: log warning, continue (sufficient redundancy)
- 3/5 healthy: reduce max speed by 50%, publish WARNING to SafetyMonitor
- 2/5 or fewer healthy: request safe stop via SafetyMonitor STOP level

Wire this into `SafetyMonitor` as a new check: `checkSensorAvailability()`.

**Step 4 (Week 3):** (Optional, advanced) Implement per-point motion compensation. For each LiDAR point, use its per-point timestamp to look up the ego pose at that instant via TF, and transform to the current ego frame. This eliminates the ~17cm error from scan rotation. This is a meaningful improvement at the 10Hz aggregation rate.

**Estimated effort:** 2-3 weeks (1 engineer). Week 1-2 is essential; Week 3 is optional enhancement.

**Certification pathway:** Sensor health monitoring with documented degraded mode behaviour is a standard requirement for safety-critical systems. Logs from the diagnostic topic provide evidence of sensor availability for the safety case.

### Risk Assessment

- **Technical risk: LOW.** The existing aggregator code provides the foundation. The changes are incremental.
- **Operational risk: LOW.** Degraded mode is conservative (reduce speed, not continue at full speed). False positive staleness events would only cause speed reduction, not unsafe behaviour.
- **Dependency risk: LOW.** No external libraries required. Uses existing ROS TF infrastructure.

---

## Recommendation #36: [Implicit -- Formal Verification of State Machines]

### Context

While not explicitly numbered as a standalone recommendation, the perception stack contains two safety-relevant state machines that should be formally verified:

1. **`UldStateMachine`** (`UldStateMachine.h`, lines 56-84): 5-state bidirectional graph (IDLE, ULD_ON_JCPL, LOADING, ULD_ON_VEHICLE, UNLOADING). Governs ULD tracking state, which affects arm control commands via the cargo loading nodelet.

2. **`BehaviorPlannerNodelet` FSM** (`behavior_planner_nodelet.h`): 6-state navigation FSM (IDLE, READY, NAVIGATING, AT_PAUSE, CARGO_LOADING, DONE) with safety-critical transitions.

### Assessment
**Priority:** MEDIUM (important for NUIC safety case)
**Feasibility Verdict:** FEASIBLE

### Rationale

Both state machines are small enough (5-6 states) for exhaustive model checking. Tools like UPPAAL or NuSMV can verify properties such as:
- **Liveness:** "From any state, the system can eventually reach IDLE" (no deadlocks)
- **Safety:** "The system never transitions directly from IDLE to UNLOADING" (invalid sequence)
- **Bounded response:** "If jcpl_confidence drops below conf_lost for timeout_seconds, the state machine returns to IDLE within timeout_seconds + debounce_frames * dt"

The `UldStateMachine` is already well-designed for verification: it is a pure function (no side effects, no ROS dependencies), with explicit configuration parameters (`UldStateMachineConfig`). Unit tests exist (`test_uld_state_machine.cpp`). Model checking would complement these tests by exhaustively verifying all reachable states.

### Implementation

**Step 1:** Encode both state machines in NuSMV or UPPAAL model description language.
**Step 2:** Define safety and liveness properties as CTL/LTL specifications.
**Step 3:** Run model checker to verify properties. Fix any identified issues.
**Step 4:** Document verified properties in safety case.

**Estimated effort:** 1-2 weeks (1 engineer with model checking experience).

---

## Cross-Cutting Integration Architecture

The six recommendations in this section form an integrated safety verification layer:

```
                    +-----------------------+
                    |   NUIC Safety Case    |
                    |   (ISO 26262/SOTIF    |
                    |    aligned, Rec #35)  |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |  STL Runtime Monitor  |
                    |  (Rec #33: rtamt4ros) |
                    |  - 10-20 specs @ 10Hz |
                    |  - Violation logging  |
                    +-----------+-----------+
                                |
              +-----------------+-----------------+
              |                 |                 |
   +----------v------+  +------v--------+  +-----v---------+
   | RSS Safety Dist  |  | Jet Blast Zone |  | Sensor Health  |
   | (Rec #32: ad-rss)|  | (Rec #30)      |  | (Rec #31)      |
   | - Longitudinal   |  | - Static zones |  | - 3-tier stale |
   | - Lateral        |  | - Exhaust filt |  | - Degraded mode|
   | - Airport params |  | - IATA data    |  | - Per-sensor   |
   +----------+------+  +------+--------+  +-----+---------+
              |                 |                 |
              +-----------------+-----------------+
                                |
                    +-----------v-----------+
                    |    SafetyMonitor      |
                    | (existing, extended)  |
                    | - E-stop              |
                    | - System health       |
                    | + RSS check (NEW)     |
                    | + Sensor health (NEW) |
                    | + STL violations (NEW)|
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |    StopArbiter        |
                    | (existing, 10 levels) |
                    | - Priority-based      |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |    VelocityGate       |
                    | (existing, final out) |
                    +-----------------------+
```

### Implementation Dependencies

```
                    Rec #35 (SOTIF)
                         |
                    (informs specs for)
                         |
    Rec #31 ---------> Rec #33 (STL) <--------- Rec #32 (RSS)
    (staleness)          |                        |
         \              |                        /
          \     Rec #30 (Jet Blast)             /
           \         |                         /
            +--------+---------+--------------+
                     |
               SafetyMonitor
```

- **Rec #31 (Sensor Staleness)** should be implemented first -- it is lowest risk and provides data needed by all others.
- **Rec #32 (RSS)** and **Rec #30 (Jet Blast)** can proceed in parallel after staleness.
- **Rec #33 (STL Monitor)** depends on #31, #32, #30 being operational to have meaningful signals to monitor.
- **Rec #34 (Rulebook)** depends on #32 (RSS provides hard constraints for the Rulebook).
- **Rec #35 (SOTIF)** is ongoing and should start concurrently, informing the specifications for all other recommendations.

### Recommended Schedule

| Week | Activity | Rec |
|------|----------|-----|
| 1-3 | Sensor staleness enhancement | #31 |
| 1-4 | SOTIF HARA (parallel, safety engineer) | #35 |
| 3-6 | RSS integration | #32 |
| 3-6 | Jet blast zone modeling | #30 |
| 7-8 | State machine formal verification | #36 |
| 7-12 | STL runtime monitor | #33 |
| 10-14 | Rulebook framework | #34 |
| 8-12 | SOTIF safety case document | #35 |

**Total elapsed time:** ~14 weeks with 2 engineers (1 perception, 1 safety/planning).

---

## Sources

- [Mobileye RSS Overview](https://www.mobileye.com/technology/responsibility-sensitive-safety/)
- [Intel ad-rss-lib (GitHub)](https://github.com/intel/ad-rss-lib)
- [RSS Explained: Five Rules](https://www.mobileye.com/blog/rss-explained-the-five-rules-for-autonomous-vehicle-safety/)
- [RSS Gains Traction Worldwide](https://www.mobileye.com/blog/responsibility-sensitive-safety-gains-traction-worldwide/)
- [IATA Engine Danger Areas](https://www.iata.org/contentassets/f135f60f52e9495d9a6bb09aab8e39e7/engine-danger-areas.pdf)
- [Jet Efflux Hazard (SKYbrary)](https://skybrary.aero/articles/jet-efflux-hazard)
- [Changi Airport Autonomous Tractors Deployment](https://www.futuretravelexperience.com/2026/01/changi-airport-deploys-autonomous-tractors-in-major-step-towards-airside-automation/)
- [UK CAA Airside Driving Permit (CAP 790)](https://www.caa.co.uk/publication/download/14228)
- [EASA AI Trustworthiness NPA 2025-07](https://www.easa.europa.eu/en/document-library/notices-of-proposed-amendment/npa-2025-07)
- [IATA AHM 45th Edition (2025)](https://www.iata.org/en/publications/manuals/airport-handling-manual/)
- [IATA AHM 908 Autonomous Vehicles](https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/what-are-the-new-and-updated-standards-in-the-airport-handling-manual-45/)
- [ISO 21448 SOTIF Overview](https://www.automotive-iq.com/functional-safety/articles/navigating-sotif-iso-21448-and-ensuring-safety-in-autonomous-driving)
- [ISO 26262 Overview](https://en.wikipedia.org/wiki/ISO_26262)
- [DO-178C Overview](https://en.wikipedia.org/wiki/DO-178C)
- [RTAMT: Runtime STL Monitoring](https://arxiv.org/html/2501.18608v1)
- [Encoding RSS in STL (ACM MEMOCODE 2019)](https://dl.acm.org/doi/10.1145/3359986.3361203)
- [PerceMon: Online Monitoring for Perception](https://ar5iv.labs.arxiv.org/html/2108.08289)
- [ICAO Annex 14 Amendment 18](https://www.icao.int/sites/default/files/APAC/Meetings/2025/2025%20Workshop%20on%20Implementation%20of%20New%20ICAO%20Annex/Training%20Materials/SL-2025-23_amendment-18-to-Annex-14-Vol-I.pdf)
- [CASA Advisory Circular 139.C-14: Airside Vehicle Control](https://www.casa.gov.au/sites/default/files/2023-06/advisory-circular-139-c-14-airside-vehicle-control.pdf)
- [NASA ASRS: Ground Jet Blast Hazard](https://asrs.arc.nasa.gov/publications/directline/dl6_blast.htm)
