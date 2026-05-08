# V2X Cooperative Planning

> **Purpose**: Extend V2X from communication and cooperative perception into the planning loop: prediction, tactical maneuver choice, trajectory negotiation, reservation, fallback, and deployment assurance for connected autonomous vehicles.
>
> **Key Takeaway**: V2X becomes operationally valuable when it changes what the vehicle plans to do. Status and perception sharing improve awareness, but cooperative planning requires intent, maneuver, authority, and trust semantics that can be consumed by behavior planning and trajectory generation. Airside fleets are an unusually strong fit because participants are bounded, known, low-speed, infrastructure-rich, and centrally governed.
>
> **Research current as of:** 2026-05-09

---

## Problem Framing

Most V2X documents stop at radios, message types, and cooperative perception. That is necessary but incomplete. A vehicle still needs to decide whether to yield, request priority, enter a single-lane segment, clear a stand, or reject stale advice. Cooperative planning is the layer that converts communicated state and intent into behavior and trajectory decisions.

For airside autonomy, V2X can supply information that onboard sensing cannot reliably infer:

- Aircraft and GSE intent behind occlusions.
- Stand phase, pushback, fuel, de-icing, emergency, and turnaround status.
- Road-resource reservations for narrow service roads and stand pockets.
- Infrastructure-detected hazards such as FOD, jet blast, personnel, and temporary closures.
- Ramp-control or fleet-manager advice for coordinated maneuvers.

The design principle is conservative: V2X can increase capability, but loss or corruption of V2X must not remove the vehicle's ability to stop safely and obey default-deny authority rules.

---

## Method and Architecture Taxonomy

### Cooperation Classes

ETSI's Manoeuvre Coordination Service and SAE cooperative-driving terminology are useful for separating levels of cooperation:

| Class | Meaning | Planning Impact |
|---|---|---|
| Status sharing | "Here is my current state" | Better tracking and TTC estimates |
| Intent sharing | "Here is what I plan to do" | Conditional prediction and earlier yielding |
| Agreement seeking | "Can we execute this joint maneuver?" | Negotiated merge, crossing, convoy, or single-lane reservation |
| Prescriptive | "An authorized entity advises or commands this maneuver" | Infrastructure or ramp-control priority and route allocation |

Airside examples:

- Status: Tug broadcasts pose, speed, vehicle type, task, and brake/turn state.
- Intent: Pushback tug broadcasts planned aircraft sweep path and time window.
- Agreement seeking: Two GSE negotiate entry to a one-lane service road.
- Prescriptive: Fleet manager or ramp control assigns a vehicle to hold/clear/proceed.

### Cooperative Planning Data Plane

| Data Type | Source | Planning Use |
|---|---|---|
| Cooperative awareness / status | Vehicle, RSU, infrastructure | Track confirmation, TTC, right-of-way estimation |
| Cooperative perception | Vehicle/infrastructure sensors | Occluded object occupancy and confidence |
| Intent and trajectory | Vehicles, aircraft-tug systems, fleet manager | Conditional prediction and behavior scoring |
| Maneuver requests/advice | Peer vehicles, infrastructure, traffic manager | Agreement-seeking and prescriptive coordination |
| Operational authority | A-CDM, A-SMGCS, ramp control, NOTAMs | Hold/proceed, route validity, mission priority |
| Road-resource reservations | Fleet traffic manager or distributed protocol | Deadlock prevention and narrow-zone access |
| Trust and health | PKI, misbehavior monitor, network QoS | Message weighting, rejection, degraded mode |

### Planning Loop Integration

```text
Receive V2X / V2I / V2N messages
  -> authenticate, time-align, and geofence
  -> reject stale, inconsistent, or unauthorized messages
  -> fuse into cooperative world model
  -> condition prediction on shared intent
  -> behavior arbitration: yield, request, reserve, proceed, clear, stop
  -> trajectory generation within accepted reservations and authority state
  -> publish own status, intent, and reservation request/update
  -> monitor execution and revoke/rollback on deviation
```

The ego planner should never use V2X as a direct actuator command. V2X updates the world model, constraints, and tactical intent; the local planner and validator still produce and check the trajectory.

### System Architectures

| Architecture | Description | Airside Fit |
|---|---|---|
| Local advisory V2X | Vehicle consumes peer status/intent as extra prediction input | Good first step, low certification burden |
| Central traffic manager | Edge server allocates road resources and priorities | Strong fit for airports and yards with private networks |
| Decentralized agreement | Vehicles negotiate reservations directly | Useful fallback when central link is unavailable |
| Hybrid | Central manager for strategic/tactical zones, local V2V for immediate negotiation | Recommended for airside fleets |
| End-to-end cooperative planner | Neural model fuses ego and infrastructure data through to trajectory | Research frontier; useful in shadow mode before deployment |

### End-to-End Cooperative Planning Research

Recent V2X E2E work shows the field moving beyond perception-only gains:

- **UniV2X** integrates vehicle-infrastructure cooperation across perception, mapping, occupancy prediction, and planning with sparse-dense transmission.
- **UniE2EV2X** emphasizes unified V2X cooperative driving with accident prediction and end-to-end fusion.
- **V2X-VLM** combines vehicle and infrastructure camera views with text scene descriptions for cooperative trajectory planning.

For airside deployment, these are not drop-in production planners. They are useful patterns for shadow-mode scoring, cooperative feature design, and future learned cost/proposal modules. The deployable near-term stack should keep explicit authority, trust, and safety validation around any learned cooperative planner.

---

## Evaluation and Deployment Notes

### Metrics

| Category | Metrics |
|---|---|
| Planning quality | route completion, success rate, progress, comfort, unnecessary stops |
| Cooperative value | delta vs no-V2X baseline, occlusion resolution, earlier yielding, deadlock reduction |
| Safety | collision rate, TTC, clearance violations, hold-short compliance, jet-blast/no-go-zone entry |
| Communication | latency, jitter, packet loss, bandwidth, stale-message rejection, congestion behavior |
| Trust and security | invalid signature rejection, inconsistency detection, misbehavior demotion, replay resistance |
| Robustness | score under partial participation, infrastructure outage, wrong intent, clock drift, localization error |
| Operations | blocked-zone time, reservation conflicts, remote-assistance calls, mission lateness |

Always report V2X-enabled performance against at least three baselines:

1. Onboard-only planning.
2. V2X status/perception only, with no intent or maneuver coordination.
3. Full cooperative planning with intent/reservation/advice.

This prevents inflated claims where V2X appears useful only because the onboard-only baseline is weak.

### Deployment Stages

1. **Listen-only**: receive messages, log what decisions would have changed, never affect control.
2. **Advisory prediction**: use status/intent to adjust prediction costs but keep conservative behavior.
3. **Local constraints**: consume infrastructure hazards and reservations as validated constraints.
4. **Agreement seeking**: negotiate one-lane segments, stand-entry, and crossing maneuvers in controlled zones.
5. **Prescriptive coordination**: accept authorized fleet/ramp-control advice with explicit TTL and fallback.

Deployment requirements:

- All messages used for planning need source identity, timestamp, frame, covariance/confidence, TTL, and authority class.
- Maneuver advice must be checked against local map, perception, safety constraints, and route authority.
- Vehicle intent broadcasts should include a confidence and a revocation/update path if ego deviates.
- Clock synchronization and timestamp provenance are safety requirements, not logging niceties.
- The fallback policy must be deterministic for V2X loss: slow, inflate margins, hold at authority-critical boundaries, and stop when necessary.

---

## Indoor / Outdoor / Airside Fit

| Domain | Fit | Cooperative Planning Pattern |
|---|---|---|
| Indoor warehouse / factory | High | Fleet manager reserves aisles, doors, lifts, charging bays; robot-to-robot status fills blind corners |
| Outdoor yard / depot | Very high | Yard manager reserves gates, trailer lanes, staging areas, and one-lane roads |
| Public-road AV | Medium to high | Valuable for intersections, merges, emergency vehicles, and infrastructure sensing; partial adoption is hard |
| Airside apron | Very high | Known fleet, private 5G/CBRS, airport authority, stand sequencing, aircraft/GSE priority |
| Movement area | High with strict authority | V2X can aid awareness, but explicit clearance and default-deny rules must dominate |

Airside is the best near-term domain for cooperative planning because the trust domain is closed and the infrastructure owner can require participation. The main caveat is mixed traffic: human-driven GSE, personnel, and aircraft may remain unconnected for years, so onboard sensing and conservative rules must remain authoritative.

---

## Failure Modes

| Failure Mode | Symptom | Mitigation |
|---|---|---|
| Stale V2X intent | Vehicle yields to a maneuver that is no longer happening | TTL, monotonic sequence numbers, execution monitoring |
| False cooperative object | Planner avoids a nonexistent or spoofed vehicle | PKI, plausibility checks, onboard perception cross-check |
| Missing unconnected actor | V2X-planned reservation ignores a pedestrian or legacy GSE | Never treat V2X as complete occupancy; fuse with onboard/infrastructure perception |
| Conflicting advice | Peer, fleet manager, and local rules disagree | Authority hierarchy, rule engine, default safe stop |
| Clock drift | Trajectories are time-shifted and collide | gPTP/PTP monitoring, timestamp uncertainty inflation |
| Localization frame mismatch | Shared trajectories are spatially offset | frame IDs, map-version checks, calibration monitors |
| Packet loss / congestion | Negotiation fails or intent updates are delayed | deterministic fallback, DCC/geofencing, bounded message rates |
| Overcentralization | Fleet manager outage blocks local mobility | hybrid fallback with local V2V and preapproved safe behaviors |
| Overtrust in learned E2E V2X | Neural planner exploits cooperative signals without explainable constraints | shadow mode, explicit validators, Simplex fallback |
| Privacy/security leakage | Operational schedules or restricted zones are exposed | network segmentation, least-privilege message routing, signed/encrypted links |

---

## Related Repo Docs

- [V2X Protocols for Airside](v2x-protocols-airside.md)
- [Fleet Coordination](fleet-coordination.md)
- [Airside Multi-Agent Coordination](airside-multi-agent.md)
- [Ramp Traffic Conflict Detection and Deadlock Prevention](ramp-traffic-conflict-deadlock-prevention.md)
- [Fleet Task Allocation and Scheduling](fleet-task-allocation-scheduling.md)
- [Infrastructure-Cooperative Perception](../perception/overview/infrastructure-cooperative-perception.md)
- [Collaborative Fleet Perception](../perception/overview/collaborative-fleet-perception.md)
- [Joint Prediction-Planning](../planning/joint-prediction-planning.md)
- [Behavior Planning and Maneuver Arbitration](../planning/behavior-planning-maneuver-arbitration.md)
- [Airport 5G / CBRS](../../20-av-platform/networking-connectivity/airport-5g-cbrs.md)
- [Ground Control Instruction Understanding](../../70-operations-domains/airside/operations/ground-control-instructions.md)
- [Cybersecurity for Airside AV](../../60-safety-validation/cybersecurity/cybersecurity-airside-av.md)

---

## Sources

- End-to-End Autonomous Driving through V2X Cooperation (UniV2X): https://arxiv.org/abs/2404.00717
- Unified End-to-End V2X Cooperative Autonomous Driving (UniE2EV2X): https://arxiv.org/abs/2405.03971
- V2X-VLM: End-to-End V2X Cooperative Autonomous Driving Through Large Vision-Language Models: https://arxiv.org/abs/2408.09251
- ETSI TR 103 578 V2.1.1, Manoeuvre Coordination Service pre-standardization study: https://www.etsi.org/deliver/etsi_TR/103500_103599/103578/02.01.01_60/tr_103578v020101p.pdf
- SAE J3216, Taxonomy and Definitions for Cooperative Driving Automation: https://saemobilus.sae.org/standards/j3216_202005-taxonomy-definitions-terms-related-cooperative-driving-automation-road-motor-vehicles
- SAE J3186, Application Protocol and Requirements for Maneuver Sharing and Coordinating Service: https://saemobilus.sae.org/standards/j3186_202303-application-protocol-requirements-maneuver-sharing-coordinating-service
- 3GPP TS 22.186, Service requirements for enhanced V2X scenarios: https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=3180
- 3GPP TS 23.287, Architecture enhancements for 5G System to support V2X services: https://www.3gpp.org/ftp/Specs/archive/23_series/23.287/
- 5GAA, Visionary Roadmap for Advanced Driving Use Cases, Connectivity Technologies, and Radio Spectrum Needs: https://5gaa.org/content/uploads/2025/01/5gaa-wi-cv2xrm-iii-roadmap-white-paper.pdf
- V2X-Real: a Large-Scale Dataset for Vehicle-to-Everything Cooperative Perception: https://arxiv.org/abs/2403.16034
- V2X-ReaLO: An Open Online Framework and Dataset for Cooperative Perception in Reality: https://arxiv.org/abs/2503.10034
