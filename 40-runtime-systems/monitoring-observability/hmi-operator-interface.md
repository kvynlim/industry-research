# Human-Machine Interaction Design for Autonomous Airside Vehicles

> **Key Takeaway:** The transition from attended to unattended autonomous airside operations hinges on HMI design more than perception or planning capability. ISO 3691-4 mandates operator interface requirements that assume physical presence; FAA CertAlert 24-02 requires a human monitor near AGVS around aircraft and personnel; EASA AI Roadmap 2.0 classifies airside AVs as Level 2 AI (autonomous decision-making) requiring the highest human factors assurance. The practical path is a four-mode control architecture (full autonomous, supervised autonomous, shared control, full teleoperation) with a web-based monitoring dashboard built on ROS topics and rosbridge_websocket, supporting progressive scaling from 1:1 operator-to-vehicle ratios toward 1:10+ as autonomy matures. Budget $5-15K per operator station hardware and $20-40K software development for the initial monitoring dashboard. A structured operator training program (40-80 hours initial, 8-16 hours annual recurrent) and an integrated incident reporting pipeline that feeds flagged edge cases directly into the active learning loop are essential for both regulatory compliance and continuous system improvement.

---

## Table of Contents

1. [Regulatory Requirements for HMI](#1-regulatory-requirements-for-hmi)
2. [Monitoring Dashboard Design](#2-monitoring-dashboard-design)
3. [Trust Calibration](#3-trust-calibration)
4. [Handoff Procedures](#4-handoff-procedures)
5. [Operator Training Program](#5-operator-training-program)
6. [Incident Reporting and ML Feedback](#6-incident-reporting-and-ml-feedback)
7. [External Communication to Ground Crew](#7-external-communication-to-ground-crew)
8. [Practical Implementation](#8-practical-implementation)
9. [reference airside AV stack-Specific Integration](#9-airside-specific-integration)
10. [Cost Estimates and Phased Rollout](#10-cost-estimates-and-phased-rollout)

---

## 1. Regulatory Requirements for HMI

### 1.1 ISO 3691-4 Operator Interface Requirements

ISO 3691-4:2023 (Driverless Industrial Trucks) is the primary safety standard for autonomous airside vehicles, harmonized with the EU Machinery Directive since May 2024. Its HMI requirements are distributed across multiple clauses.

**Clause 4.8 -- Stop Functions and Operator Access:**

| Requirement | Clause | Detail |
|---|---|---|
| Emergency stop per ISO 13850:2015 | 4.8.1 | E-stop devices within 600 mm of any hazardous point on vehicle |
| Maximum E-stop spacing | 4.8.1 (2023) | Maximum distance between E-stop buttons specified |
| Operational stop | 4.8.2 (2023) | Controlled stop with restart capability -- new in 2023 edition |
| Automatic brake on power/control loss | 4.2 | Service brake must engage on any power or control system failure |
| All movements cease on E-stop | 4.8.1 | No motion permitted after emergency stop activation |

**Clause 4.9 -- Control Devices and Mode Selection:**

- Mode selection (automatic / manual / maintenance) must be controlled and require explicit operator action
- Mode transition safety functions require minimum PLc (Performance Level c) per Table 1 items 18-19
- Unauthorized mode changes must be prevented -- physical key switch, authentication, or equivalent
- The 2023 edition added explicit requirements for mode indication: the vehicle must clearly display its current operating mode to all personnel in the vicinity

**Clause 4.10 -- Personnel Detection Indication:**

- The system must provide visible/audible indication when personnel are detected in the safety field
- Detection status must be available to supervisory personnel (remote or on-site)
- All personnel detection functions require PLd -- the second-highest Performance Level

**Clause 5 -- Verification of Operator Interface:**

Clause 5 specifies verification methods for all safety requirements. For operator interface specifically:
- Functional testing of all stop functions with measured response times
- Verification of warning system visibility and audibility at operational distances
- Mode selection testing under fault conditions
- Documentation of all operator interface elements in the instruction manual (Clause 6)

**Clause 6 -- Information for Use (Documentation):**

- Instruction manual must document all operator interface functions
- Warning meanings must be unambiguously defined
- Training requirements must be specified by the manufacturer
- Operating zone preparation guidance must include communication procedures

**HMI Design Implications from ISO 3691-4:**

1. Every vehicle must have physical E-stop buttons accessible to nearby personnel -- remote-only stop is insufficient
2. Mode indication must be externally visible (not just on a remote dashboard)
3. Personnel detection status must be available to the remote operator in real time
4. The standard was written for warehouses; airport deployment requires additional HMI for ATC integration, aircraft proximity, and jet blast zones that ISO 3691-4 does not address

### 1.2 FAA CertAlert 24-02 and Bulletin 25-02

FAA CertAlert 24-02 (February 2024) is the FAA's first formal acknowledgment of autonomous ground vehicle technology at airports. It remains the active guidance as of early 2026 -- no subsequent CertAlert has updated it.

**HMI-Relevant Requirements (Implied):**

CertAlert 24-02 does not prescribe specific HMI requirements, but its operational conditions create implicit HMI obligations:

| Implied Requirement | Source Text | HMI Implication |
|---|---|---|
| Human monitor required | "Testing...in a controlled environment" | Operator must have real-time vehicle status visibility |
| FAA Inspector coordination | "Contact regional FAA Airport Certification and Safety Inspector" | Dashboard must support demonstration to FAA inspectors |
| Stakeholder awareness | "Engage local stakeholders to ensure awareness" | External vehicle state indicators for ground crew and ATC |
| Movement area restrictions | Movement area deemed higher risk | HMI must clearly indicate when vehicle approaches movement area boundaries |
| Aircraft proximity | "Higher speed aircraft operations and congestion" | Distance-to-aircraft display, jet blast zone overlay on map |

**FAA AC 150/5210-5D -- Vehicle Marking Implications:**

All vehicles in the Airport Operating Area (AOA) must display specific markings and lighting. For autonomous vehicles, this AC creates HMI gaps:
- No standard for identifying a vehicle as autonomous to surrounding operators
- No marking convention for communicating autonomous vs. manual mode
- No provision for machine-to-machine identification (V2X)
- Amber rotating/flashing beacons required in movement area -- the autonomous vehicle must control these automatically based on zone

**Recommended AV-Specific External Indicators (Pending FAA Guidance):**

| Mode | Beacon Color | Pattern | Additional |
|---|---|---|---|
| Full autonomous | Blue (proposed) | Steady flash 1 Hz | LED bar showing planned direction |
| Supervised autonomous | Blue/amber alternating | 0.5 Hz | Operator connected indicator |
| Shared control | Amber | Rapid flash 2 Hz | Standard GSE convention |
| Teleoperated | Amber | Standard | Matches human-driven convention |
| Stopped / fault | Red | Solid or slow flash | Universal hazard signal |
| E-stop activated | Red | Rapid flash 3 Hz | Audible alarm |

### 1.3 EASA AI Roadmap 2.0 -- Human Factors for AI

EASA's AI Roadmap 2.0 classifies airside autonomous vehicles as **Level 2 AI applications** (AI Decision-Making / Autonomy) -- the highest assurance category. The human factors building block has direct HMI implications.

**Four EASA Human Factors Requirements for AI:**

1. **Appropriate Trust Calibration:** Operators must understand the AI system's capabilities and limitations. The HMI must display enough information for operators to form accurate mental models without causing over-trust (automation complacency) or under-trust (excessive intervention).

2. **Transparency of AI Decisions:** The system must provide explanations for its decisions to human operators. For airside AVs: why did the vehicle stop? What did it detect? Why did it choose this path? This maps directly to the explanation UI discussed in Section 3.

3. **Human Override Procedures:** Clear, tested procedures for human override must exist. The handoff from autonomous to manual control must be smooth, with defined latency budgets and graceful degradation.

4. **Continuous Monitoring of Human-AI Interaction:** In-service experience must be tracked. How often do operators intervene? What triggers interventions? Are operators maintaining vigilance? This data feeds both safety assessment and system improvement.

**EASA W-Shaped Development Model -- HMI Integration Points:**

The W-shaped model's second V (System Integration and Validation) requires:
- End-to-end validation of the human-AI interface in the operational context
- Human factors assessment (usability testing, cognitive workload measurement, error rate analysis)
- Demonstration that the HMI design prevents identified human-AI interaction hazards

**Timeline Implication:** EASA Level 2 guidance is expected to mature by 2027-2028. Companies designing HMI now should align with the building blocks framework to avoid retrofitting.

### 1.4 UL 4600 -- Operator Competency and Safety

UL 4600 (Standard for Safety for the Evaluation of Autonomous Products) provides a comprehensive framework for autonomous system safety assessment. Its HMI-relevant sections address operator competency, operational design domain, and remote monitoring.

**Key UL 4600 Requirements:**

| Section | Requirement | HMI Relevance |
|---|---|---|
| Operator Competency | Training on system capabilities and limitations | Structured training program with simulator component |
| ODD Monitoring | System must detect and respond to ODD boundary violations | Dashboard must display ODD compliance status |
| Remote Monitoring | If remote monitoring is part of safety case, monitoring system is safety-critical | Dashboard reliability and availability requirements |
| Fallback | Defined minimal risk condition (MRC) for all failure modes | Operator must see fallback status and be able to trigger MRC |
| Validation | Safety case must include HMI usability evidence | Formal usability testing required (not just developer opinion) |
| Lifecycle | Continuous improvement process including HMI feedback | Operator feedback mechanism integrated into dashboard |

**UL 4600 Certified Autonomy Safety Professional (CASP):** UL offers this credential for personnel involved in autonomous system safety. Relevant for operator training program design and regulatory engagement.

### 1.5 SAE J3016 Parallels -- Levels of Automation and Operator Roles

SAE J3016 (Levels of Driving Automation) was written for on-road vehicles, but its automation level framework maps usefully to airside operations. The key insight is how operator roles change with automation level.

| SAE Level | On-Road Definition | Airside Parallel | Operator Role | HMI Requirement |
|---|---|---|---|---|
| L0 | No automation | Manual GSE driving | Full-time driver | Standard vehicle controls |
| L1 | Driver assistance | Speed limiting, collision warning | Full-time driver with alerts | Warning displays, audio alerts |
| L2 | Partial automation | Lane-keeping + adaptive speed | Constant monitoring, hands ready | Real-time perception display, takeover alerts |
| L3 | Conditional automation | Autonomous route following with operator on standby | Fallback-ready, can disengage | Takeover request UI, explanation display |
| L4 | High automation | Autonomous within defined ODD (specific routes, weather, time) | Remote monitoring, exception handling | Fleet dashboard, incident escalation |
| L5 | Full automation | Unrestricted autonomous airside operation | Fleet oversight only | KPI dashboard, strategic management |

**Current reference airside AV stack Position:** All deployments require a safety operator, placing operations at roughly L2-L3. The HMI must support the transition from L3 (operator on vehicle or nearby) to L4 (remote monitoring of multiple vehicles).

**Key J3016 Insight for HMI Design:** The most dangerous transition is from L2/L3 to L4 -- the so-called "automation gap." At L2/L3, the operator is engaged and building situational awareness. At L4, the operator monitors multiple vehicles and must rapidly re-engage when needed. The HMI must bridge this gap with effective attention management, takeover request design, and trust calibration.

### 1.6 EU Machinery Regulation 2023/1230 (Effective January 2027)

The new EU Machinery Regulation replaces the Machinery Directive and introduces mandatory third-party assessment for high-risk AI-enabled autonomous vehicles. HMI implications: (1) operator interface must not be a single point of failure (Annex III, 1.2.1), (2) autonomous mobile machinery requires Notified Body assessment including HMI (Article 6), (3) mode indicators, warnings, and emergency information must be perceivable under all foreseeable conditions (Annex III, 1.7.1).

---

## 2. Monitoring Dashboard Design

### 2.1 Architecture Overview

```
                    VEHICLE (On-Board)
┌──────────────────────────────────────────────────┐
│  Sensors    Perception    Planning    Control     │
│  (LiDAR,    (3D det,     (Frenet,    (Stanley,   │
│   IMU,      segmentation, trajectory  cmd_vel)   │
│   RTK)      occupancy)    gen)                    │
│                                                   │
│  ┌─────────────────────────────────┐              │
│  │  HMI Bridge Node               │              │
│  │  - Aggregates key topics       │              │
│  │  - Compresses sensor data      │              │
│  │  - Computes derived metrics    │              │
│  │  - Publishes /hmi/* topics     │              │
│  └──────────────┬──────────────────┘              │
└─────────────────┼────────────────────────────────┘
                  │  Private 5G / WiFi
                  │  (rosbridge_websocket or
                  │   custom WebSocket)
                  ▼
┌──────────────────────────────────────────────────┐
│  EDGE SERVER (On-Airport)                        │
│  ┌─────────────────────────────────┐             │
│  │  rosbridge_websocket            │             │
│  │  port 9090                      │             │
│  │  + TLS termination              │             │
│  │  + JWT authentication           │             │
│  └──────────────┬──────────────────┘             │
│                 │                                 │
│  ┌──────────────┴──────────────────┐             │
│  │  web_video_server               │             │
│  │  port 8080                      │             │
│  │  H.264 streams from cameras     │             │
│  └──────────────┬──────────────────┘             │
│                 │                                 │
│  ┌──────────────┴──────────────────┐             │
│  │  Fleet Aggregator Service       │             │
│  │  - Multi-vehicle state fusion   │             │
│  │  - Alert prioritization         │             │
│  │  - Logging / recording          │             │
│  └──────────────┬──────────────────┘             │
└─────────────────┼────────────────────────────────┘
                  │  Fiber / Encrypted VPN
                  ▼
┌──────────────────────────────────────────────────┐
│  OPERATOR TERMINAL (Operations Center)           │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  Web Dashboard (React + Three.js)          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ Map View │ │ 3D Scene │ │ Camera    │  │  │
│  │  │ (fleet)  │ │ (percep) │ │ Feeds     │  │  │
│  │  ├──────────┤ ├──────────┤ ├───────────┤  │  │
│  │  │ KPI      │ │ Alert    │ │ Telemetry │  │  │
│  │  │ Panel    │ │ Panel    │ │ Panel     │  │  │
│  │  └──────────┘ └──────────┘ └───────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  OR: Foxglove Studio (rapid prototyping)         │
└──────────────────────────────────────────────────┘
```

### 2.2 Real-Time Displays

**Primary View -- Airport Map with Fleet Overlay:**

The main screen shows a georeferenced airport map (AMDB-sourced or custom HD survey) with real-time vehicle positions. Each vehicle icon shows:
- Current position and heading (from `/odom/fused`)
- Planned trajectory (from Frenet planner output)
- Operational status (color-coded: green = nominal, yellow = caution, red = fault)
- Current mission (pickup/delivery/transit/idle)
- Speed and heading vector

**Secondary View -- Perception Output (Per-Vehicle):** 3D bounding boxes on point cloud, occupancy grid (2D/3D), planned vs. actual trajectory, safety field status (ISO 3691-4 zones), nearest obstacle distance and TTC.

**Tertiary View -- Sensor Health:** Per-sensor status (each RoboSense, IMU, RTK-GPS), point cloud density, localization uncertainty ellipse (GTSAM), GPS fix quality, network latency/bandwidth.

### 2.3 Alert Hierarchy

The alert system follows aviation human factors conventions (ICAO Doc 9859 SMS Manual and FAA AC 25-11B electronic displays). Four severity levels with distinct audio-visual coding:

| Level | Name | Color | Audio | Auto-Action | Example |
|---|---|---|---|---|---|
| 1 | Information | White/Cyan | None | None | "Vehicle 3 mission complete" |
| 2 | Caution | Amber | Single tone | Log event | "LiDAR 2 point density below 80%" |
| 3 | Warning | Amber flashing | Repeating tone | Vehicle slows to 50% speed | "Localization uncertainty > 0.3m" |
| 4 | Critical | Red flashing | Continuous alarm + voice | Vehicle stops, operator takeover requested | "Personnel detected < 2m", "E-stop activated" |

**Alert Escalation:** Information escalates to Caution after 30s persistence; Caution escalates to Warning on condition worsening; Warning escalates to Critical. Any level can jump directly to Critical for safety events (personnel in safety zone, E-stop, communication loss > 5s, localization failure). Duplicate alerts suppressed for 10 seconds. Critical alerts require explicit operator acknowledgment. Alert history retained for 90 days.

### 2.4 Key Performance Indicators

| KPI | Source Topic | Normal Range | Caution Threshold | Critical Threshold | Units |
|---|---|---|---|---|---|
| Detection confidence (min) | `/perception/detections` | > 0.8 | < 0.6 | < 0.4 | probability |
| Localization uncertainty | `/localization/uncertainty` | < 0.1 | > 0.3 | > 0.5 | meters (2-sigma) |
| TTC to nearest obstacle | `/safety_monitor/ttc` | > 5.0 | < 3.0 | < 1.5 | seconds |
| Mission progress | `/fleet/mission_status` | on-schedule | > 2 min behind | > 5 min behind | % / time |
| Battery state | `/vehicle/battery` | > 30% | < 20% | < 10% | SOC % |
| Network latency (RTT) | `/hmi/network_latency` | < 100 | > 200 | > 500 | milliseconds |
| Speed vs. limit | `/vehicle/speed` | within limit | within 90% | exceeding limit | km/h |
| OOD score | `/safety_monitor/ood_score` | < 0.3 | > 0.5 | > 0.7 | 0-1 scale |
| Point cloud density | `/sensor_health/lidar_density` | > 90% baseline | < 80% | < 60% | % of nominal |
| Safety field clear | `/safety/field_status` | clear | partial occlusion | personnel detected | boolean/enum |

### 2.5 Multi-Vehicle Fleet Monitoring

**The Core Challenge: Attention Management**

When a single operator monitors multiple vehicles, the primary HMI challenge is attention allocation. The operator cannot watch all vehicles simultaneously, so the system must:
1. Automatically prioritize which vehicle needs attention
2. Provide a clear overview of fleet status at a glance
3. Seamlessly switch operator focus to the vehicle that needs intervention

**Fleet Overview Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  FLEET OVERVIEW BAR (always visible at top)                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ V-01 │ │ V-02 │ │ V-03 │ │ V-04 │ │ V-05 │ │ V-06 │   │
│  │  OK  │ │ WARN │ │  OK  │ │  OK  │ │ CRIT │ │ IDLE │   │
│  │ 78%  │ │ 45%  │ │ 91%  │ │ 63%  │ │ !!!! │ │ 100% │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FOCUSED VEHICLE VIEW (V-05 auto-selected due to CRITICAL) │
│  ┌────────────────────┐  ┌────────────────────────────┐    │
│  │  Camera feeds      │  │  3D perception view        │    │
│  │  (4 streams)       │  │  (point cloud + boxes)     │    │
│  │                    │  │                             │    │
│  ├────────────────────┤  ├────────────────────────────┤    │
│  │  Alert detail:     │  │  Map with trajectory       │    │
│  │  "Personnel at 1.8m│  │  [planned path shown]      │    │
│  │   Vehicle stopped" │  │  [safety zone highlighted] │    │
│  └────────────────────┘  └────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OPERATOR ACTIONS: [Resume] [Teleoperate] [Reroute]  │  │
│  │                    [Send to Base] [E-Stop All]        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Attention Prioritization:** Dashboard ranks vehicles by `priority_score = alert_severity*10 + inverse_ttc*5 + ood_score*3 + loc_uncertainty*2 + takeover_requested*20 + time_since_check*0.1`. Highest-priority vehicle is auto-focused. Overview bar uses color intensity for peripheral attention.

### 2.6 Operator-to-Vehicle Ratio Research

| Company / Study | Ratio | Mode | Context | Notes |
|---|---|---|---|---|
| Waymo (current) | 1:41 | Remote assistance (advisory) | On-road robotaxi | 70 agents for ~3,000 vehicles. Agent does not drive -- only advises. |
| Cruise (pre-suspension) | 1:15-20 | Remote assistance | On-road robotaxi | Self-reported. Media estimated 1.5 total support workers per vehicle. |
| Nuro | 1:3 | Remote monitoring | Delivery robot | Low-speed, limited ODD. Operator can intervene. |
| Fernride (teleop phase) | 1:1 | Direct teleoperation | Yard logistics | Moving toward higher ratios as autonomy increases. |
| Fernride (target) | 1:3-5 | Supervised autonomous | Container terminal | With FERNRIDE Driver autonomy stack active. |
| Zoox (fleet oversight) | 1:50-100 | Fleet management | On-road robotaxi | Mission Operations model -- exception handling only. |
| Airport GSE (projected) | 1:100 | Fleet oversight | Airside apron | Projected with private 5G; intervention-on-demand. |
| TractEasy deployments | 1:1 | Safety driver present | Airport airside | Current regulatory requirement at most airports. |

**Recommended Progression for reference airside AV stack:**

| Phase | Ratio | Mode | Duration | Trigger to Next Phase |
|---|---|---|---|---|
| Phase 1 | 1:1 | On-vehicle safety operator | 6-12 months | 10,000+ km with zero safety interventions |
| Phase 2 | 1:1 | Remote monitoring (operator nearby on foot) | 6-12 months | Regulatory approval for unmanned vehicle |
| Phase 3 | 1:3 | Remote monitoring from operations center | 6-12 months | Demonstrated safe operation with 3 vehicles |
| Phase 4 | 1:5-10 | Supervised autonomous with exception handling | Ongoing | Continuous improvement based on intervention rate |
| Phase 5 | 1:10+ | Fleet oversight | Target state | Intervention rate < 0.1 per 1,000 km |

### 2.7 Latency Budget

**Monitoring Dashboard:** Sensor capture (10-33 ms) + on-vehicle processing (50-100 ms) + HMI bridge (10-20 ms) + network (25-50 ms) + edge server (5-10 ms) + rendering (16-33 ms) = **~120-250 ms total**. Acceptable for status monitoring.

**Teleoperation:** Camera (17-33 ms) + H.265 encoding (17-50 ms) + uplink (25-50 ms) + decoding (17-32 ms) + display (16 ms) = **~92-181 ms glass-to-glass** (target < 200 ms). Add control downlink (25-50 ms) + actuator (50 ms) = **~167-281 ms total control loop**. At 10-25 km/h, 200 ms = 0.6-1.4 m travel -- manageable given ISO 3691-4's 600 mm detection-to-stop requirement, provided safety system operates independently of teleoperation loop.

### 2.8 Web-Based vs. Native Dashboard

| Factor | Web (React + WebSocket) | Native (Qt) | Foxglove Studio |
|---|---|---|---|
| Cost | $20-40K | $40-80K | $0-5K (plugin dev) |
| ROS integration | rosbridge_websocket | Native client | Built-in |
| 3D rendering | Three.js | OpenGL/Vulkan | Built-in 3D panel |
| Video | web_video_server / WebRTC | GStreamer | Image topics |
| Latency | +5-15 ms vs native | Lowest | Moderate |
| Multi-vehicle | Custom | Custom | Limited |
| Best for | Production fleet monitoring | Low-latency teleoperation | Prototyping |

**Recommendation:** Start with Foxglove for Phase 1-2. Custom React dashboard for Phase 3+ fleet monitoring. Native GStreamer video client for teleoperation.

---

## 3. Trust Calibration

### 3.1 The Trust Calibration Problem

Trust calibration is the alignment between an operator's trust in the system and its actual capability (Lee and See, 2004). Three states: **over-trust** (complacency -- operator fails to monitor, misses failures; most dangerous for airside), **under-trust** (unnecessary intervention, wasted autonomy benefit), and **calibrated trust** (operator monitors appropriately, intervenes when needed). Parasuraman, Sheridan, and Wickens (2000) showed calibration depends on: (1) understanding system capabilities/limitations, (2) experience with system behavior, (3) real-time performance feedback, and (4) organizational culture reinforcing appropriate monitoring.

### 3.2 Displaying AI Confidence Without Over-Trust or Under-Trust

**Principles for Confidence Display:**

1. **Show uncertainty, not just confidence.** Instead of "Detection: 95% confident," show "Detection: 95% confident (+/- 3%)." Uncertainty bands prevent false precision.

2. **Use natural language thresholds, not raw numbers.** Most operators cannot calibrate trust to a number like 0.87. Instead, map confidence ranges to qualitative labels:

| Confidence Range | Label | Color | Operator Action |
|---|---|---|---|
| > 0.9 | High confidence | Green | Normal monitoring |
| 0.7 - 0.9 | Moderate confidence | Yellow | Increased attention |
| 0.5 - 0.7 | Low confidence | Orange | Prepare for intervention |
| < 0.5 | Very low confidence | Red | Intervene or verify |

3. **Show disagreement between subsystems.** When the perception system and the safety monitor disagree (e.g., perception says "clear" but safety scanner detects an obstacle), display this disagreement explicitly. Disagreement is a strong signal that the operator should pay attention.

4. **Decay display confidence during edge cases.** When the OOD (out-of-distribution) score rises, the confidence display should visually degrade (e.g., become desaturated, show question marks) to signal that the system is operating outside its training distribution.

### 3.3 Explanation UI

The explanation UI answers three questions for the operator:
1. **What is happening?** (perception state)
2. **What did the vehicle decide?** (planning output)
3. **Why?** (decision rationale)

**Explanation UI Components:**

```
┌──────────────────────────────────────────────────┐
│  EXPLANATION PANEL (auto-populates on events)     │
│                                                   │
│  EVENT: Vehicle stopped at 14:32:07               │
│                                                   │
│  WHAT: Personnel detected 3.2m ahead              │
│  ┌────────────────────────────────────────────┐   │
│  │  [Camera image with bounding box overlay]  │   │
│  │  Detection: Person (conf: 0.91)            │   │
│  │  Tracking ID: P-047                        │   │
│  │  Estimated velocity: 1.2 m/s (walking)     │   │
│  └────────────────────────────────────────────┘   │
│                                                   │
│  DECISION: Emergency stop                         │
│  REASON: TTC < 2.0s threshold                     │
│  SAFETY RULE: ISO 3691-4 Clause 4.10 --           │
│    personnel in active detection field             │
│                                                   │
│  PLANNED ACTION: Wait for field to clear,         │
│    then resume at reduced speed (5 km/h)           │
│                                                   │
│  [Override: Resume Now] [Reroute] [Teleoperate]   │
└──────────────────────────────────────────────────┘
```

**VLM Scene Narration (Future Enhancement):**

When a VLM is available on-vehicle or at the edge, the explanation UI can provide natural language scene descriptions: *"Vehicle stopped because a ground crew member stepped into the travel lane from behind the belt loader, walking left-to-right at 1.2 m/s, expected to clear in ~4 seconds."* This provides Level 3 situational awareness (Endsley's projection level) directly to the operator. Research on VLM integration for AV explainability (DriveVLM, Waymo EMMA) suggests this will become standard within 2-3 years.

### 3.4 Transparency: Showing System Health and Limitations

**Perception Disagreement Display:** When subsystems conflict (e.g., LiDAR detection sees object at 8.2m but tracking lost it), the dashboard highlights the disagreement. Vehicle follows the most conservative interpretation (detect if any subsystem detects). Example: safety scanner confirms object, but CenterPoint missed it -- operator sees "DISAGREES" status and can evaluate.

**OOD Score Visualization:** Bar display showing how novel the scene is relative to training data. Three bands: Low (< 0.3, green, "similar to training data"), Elevated (0.3-0.7, yellow, "unusual elements -- operator attention recommended"), High (> 0.7, red, "significantly different from training data -- vehicle speed reduced"). Critical for airside where unusual events (de-icing spray, unfamiliar aircraft types, FOD) may fall outside training distribution.

### 3.5 Avoiding Automation Complacency

Research on automation complacency (Parasuraman and Manzey, 2010, "Complacency and Bias in Human Use of Automation") identifies three key countermeasures:

**1. Periodic Attention Checks:** Dashboard presents confirmation prompts every 5-10 minutes (randomized intervals more effective than fixed). Format: "Confirm vehicle status: [All Clear] [Need to Check]." Timeout at 30 seconds escalates alert level. Frequency adapts based on operator activity (mouse movement, view changes).

**2. Workload Monitoring:** Track mouse/keyboard activity, view switching frequency, alert acknowledgment latency, and optionally eye tracking to detect disengagement patterns.

**3. Scenario Injection (Training Mode):** During Phase 1-2, periodically inject simulated events (perception failure, phantom detection, communication degradation) to test operator response. Clearly marked as training events after resolution.

---

## 4. Handoff Procedures

### 4.1 Control Mode Architecture

The system supports four control modes, matching ISO 3691-4 requirements and enabling progressive autonomy:

```
┌─────────────────────────────────────────────────────────┐
│                    CONTROL MODES                         │
│                                                          │
│  ┌──────────────┐    ┌──────────────────┐               │
│  │ FULL         │    │ SUPERVISED       │               │
│  │ AUTONOMOUS   │───>│ AUTONOMOUS       │               │
│  │              │<───│                  │               │
│  │ Vehicle      │    │ Vehicle drives,  │               │
│  │ drives,      │    │ operator         │               │
│  │ operator     │    │ monitors with    │               │
│  │ monitors     │    │ increased        │               │
│  │ fleet        │    │ attention        │               │
│  └──────┬───────┘    └────────┬─────────┘               │
│         │                     │                          │
│         │   Takeover Request  │   Operator Commands      │
│         │   or Fault          │   Speed/Direction        │
│         ▼                     ▼                          │
│  ┌──────────────┐    ┌──────────────────┐               │
│  │ SHARED       │    │ FULL             │               │
│  │ CONTROL      │───>│ TELEOPERATION    │               │
│  │              │<───│                  │               │
│  │ Vehicle      │    │ Operator has     │               │
│  │ provides     │    │ full control     │               │
│  │ safety       │    │ via remote       │               │
│  │ envelope,    │    │ steering,        │               │
│  │ operator     │    │ throttle,        │               │
│  │ guides       │    │ brake            │               │
│  └──────────────┘    └──────────────────┘               │
│                                                          │
│  ANY MODE ──(E-Stop)──> STOPPED (safe state)            │
└─────────────────────────────────────────────────────────┘
```

**Mode Transition Rules:**

| From | To | Trigger | Latency Budget | Safety Check |
|---|---|---|---|---|
| Full Autonomous | Supervised Autonomous | OOD score > 0.5, sensor degradation, approaching complex area | N/A (automatic) | None required |
| Supervised Autonomous | Full Autonomous | Operator confirms, conditions nominal | N/A (operator action) | All KPIs in normal range |
| Supervised Autonomous | Shared Control | Operator initiates, or takeover request | < 2 seconds | Operator acknowledges control |
| Shared Control | Full Teleoperation | Operator switches, or autonomy stack fault | < 1 second | Vehicle stopped first |
| Full Teleoperation | Shared Control | Operator releases, autonomy stack recovers | < 2 seconds | Safety system validates path |
| Shared Control | Supervised Autonomous | Operator releases to autonomy | < 2 seconds | KPIs nominal, operator confirms |
| Any Mode | Stopped | E-stop, communication loss > 5s, critical fault | < 500 ms | Immediate safe stop |

### 4.2 Takeover Request Design

The takeover request is the most safety-critical HMI element. It must be impossible to miss, clear in its urgency, and provide the operator with enough context to act effectively.

**Multi-Modal Takeover Request:**

| Channel | Implementation | Timing |
|---|---|---|
| Visual | Full-screen red border flash + vehicle icon flashing on fleet bar | Immediate |
| Audio | Escalating tone: 2 beeps/sec for 5s, then 4 beeps/sec, then continuous | Immediate |
| Haptic | Controller vibration (if handheld controller available) | Immediate |
| Text | "TAKEOVER REQUESTED: [reason]" with action buttons | Immediate |
| Voice | Synthesized: "Vehicle [ID] requires operator intervention" | After 2 seconds |

**Takeover Request Content:**

The request must provide the operator with enough information to act within the 2-5 second response window:

1. **Vehicle identification** -- which vehicle needs attention (highlighted on map and fleet bar)
2. **Reason** -- why the takeover is needed (e.g., "Unknown object in path," "Localization uncertainty high")
3. **Current state** -- vehicle speed, position, heading
4. **Recommended action** -- what the system suggests (e.g., "Confirm clear to proceed," "Reroute around obstacle")
5. **Available actions** -- buttons for immediate response (Resume, Stop, Teleoperate, Reroute)

### 4.3 Graceful Degradation on Non-Response

| Time | Action |
|---|---|
| T+0s | Takeover request issued, vehicle decelerating |
| T+2s | Audio escalates, vehicle at 50% speed |
| T+5s | Vehicle stops. "Vehicle stopped. Awaiting operator." |
| T+15s | Backup operator alerted |
| T+30s | Fleet supervisor alerted, vehicle enters safe parking mode |
| T+60s | Vehicle autonomously navigates to nearest safe parking spot |
| T+300s | Operations center notified for physical response |

**Critical Principle:** The vehicle must never require operator input to reach a safe state. On communication loss, the vehicle must autonomously achieve a Minimum Risk Condition (MRC) -- controlled stop-in-path or navigation to a predetermined safe parking area.

### 4.4 Post-Takeover Procedures

After takeover: (1) operator controls vehicle until situation resolved, (2) confirms safe state, (3) reviews trigger via explanation UI, (4) decides action (resume autonomous, continue teleoperated, send to base, or flag for engineering), (5) system logs the complete event (trigger, response time, actions, resolution).

### 4.5 Takeover Latency Measurement

The system must continuously measure and report takeover latency:

| Metric | Definition | Target | Regulatory Basis |
|---|---|---|---|
| Perception-to-request | Time from event detection to takeover request display | < 500 ms | System performance |
| Request-to-acknowledgment | Time from request display to operator's first input | < 3 seconds | Human factors research |
| Acknowledgment-to-control | Time from operator input to effective vehicle control | < 1 second | System performance |
| Total takeover time | End-to-end from event to effective operator control | < 5 seconds | ISO 3691-4 implied |

These metrics must be logged for every takeover event and reported in monthly safety reviews.

---

## 5. Operator Training Program

### 5.1 Required Competencies

| Competency Area | Knowledge Requirements | Skill Requirements | Assessment Method |
|---|---|---|---|
| Vehicle dynamics | Ackermann steering, turning radius, braking distance, crab mode (third-generation tug) | Predict vehicle behavior from display | Written exam + simulator |
| Airport safety | Airside rules (Part 139), FOD awareness, jet blast zones, right-of-way | Navigate airport map, identify hazard zones | Written exam |
| AV system capabilities | Perception range, weather limitations, ODD boundaries, known failure modes | Interpret confidence displays, identify OOD situations | Scenario-based assessment |
| AV system limitations | Sensor blind spots, weather degradation, novel object detection gaps | Recognize when the system is uncertain | Simulator scenarios |
| Emergency procedures | E-stop activation, communication loss protocol, aircraft proximity protocol | Execute emergency stop within 2 seconds, follow degradation protocol | Timed practical exercise |
| Dashboard operation | All display elements, alert meanings, control mode switching | Navigate dashboard efficiently under time pressure | Practical assessment |
| Teleoperation | Control latency awareness, speed management, obstacle avoidance | Safely teleoperating vehicle at airside speeds | Simulator proficiency test |
| Incident reporting | Report format, edge case flagging, near-miss documentation | Complete incident report within 15 minutes of event | Report quality review |
| Communication | ATC coordination, ground crew communication, escalation procedures | Clear radio communication, proper phraseology | Practical assessment |

### 5.2 Training Program Structure

**Initial Training: 40-80 Hours**

| Phase | Duration | Content | Delivery |
|---|---|---|---|
| Ground school | 16-24 hours | AV technology overview, airport safety, regulatory framework, system capabilities and limitations | Classroom / online |
| Dashboard training | 8-12 hours | All display elements, alert handling, KPI interpretation, fleet monitoring | Hands-on with training environment |
| Simulator training | 12-24 hours | Monitoring scenarios, takeover practice, teleoperation proficiency, emergency procedures | Simulator (Foxglove replay or custom) |
| Supervised operations | 8-16 hours | Live monitoring alongside experienced operator | On-site, paired with mentor |
| Assessment | 4-8 hours | Written exam, practical proficiency test, scenario assessment | Formal evaluation |

**Simulator Scenario Categories:**

| Category | Example Scenarios | Difficulty | Required Passes |
|---|---|---|---|
| Normal operations | Monitor 3 vehicles completing routine missions | Basic | 5/5 |
| Sensor degradation | LiDAR obscured by rain, RTK float, IMU drift | Intermediate | 4/5 |
| Personnel interaction | Ground crew crossing path, crouching worker near wheel, marshaller signals | Intermediate | 5/5 |
| Takeover required | Perception failure, communication degradation, OOD scenario | Advanced | 4/5 |
| Emergency | E-stop required, aircraft pushback conflict, FOD in path | Advanced | 5/5 |
| Multi-vehicle | Alert from one vehicle while actively monitoring another | Advanced | 4/5 |
| Teleoperation | Navigate vehicle through congested apron area at 5-10 km/h | Advanced | 4/5 |

### 5.3 Progressive Autonomy Training Model

| Phase | Incremental Hours | Focus |
|---|---|---|
| Phase 1 (1:1, on-vehicle) | 40 hours | Vehicle systems, airport safety, direct observation |
| Phase 2 (1:1, remote nearby) | +8 hours | Dashboard operation, remote situational awareness |
| Phase 3 (1:3, remote) | +12 hours | Multi-vehicle attention management, divided-attention takeover |
| Phase 4+ (1:5-10) | +8 hours | Fleet-level operations, exception-only monitoring, shift handoff |

### 5.4 Recurrent Training

| Requirement | Frequency | Duration | Content |
|---|---|---|---|
| Proficiency check | Quarterly | 2-4 hours | Simulator scenarios including emergency procedures |
| System update briefing | As needed (with OTA updates) | 1-2 hours | New features, changed behaviors, updated ODD |
| Incident review | Post-incident | 1-2 hours | Review of actual incidents/near-misses, lessons learned |
| Annual refresher | Annually | 8-16 hours | Comprehensive review of all competency areas |
| Re-certification | Every 2 years | 4-8 hours | Full assessment (written + practical) |

**Training Hours:** Year 1 total: 54-112 hours (initial 40-80 + quarterly checks 8-16 + briefings 4-8 + incident reviews 2-8). Annual recurring: 22-48 hours.

### 5.5 Training Infrastructure

| Simulator Option | Cost | Best For |
|---|---|---|
| Foxglove rosbag replay | $0-500 | Phase 1 prototyping (replay only, no interactivity) |
| CARLA/LGSVL + ROS bridge | $2-5K | Phase 2-3 (interactive, custom scenarios) |
| Custom web-based trainer | $10-20K | Phase 3+ (matches production dashboard) |
| Full teleop simulator | $20-40K | Phase 4+ (physical controls, haptic feedback) |

---

## 6. Incident Reporting and ML Feedback

### 6.1 Operator-Tagged Edge Case Reporting

**One-Button Flag System:**

The dashboard includes a prominent "Flag This Moment" button (keyboard shortcut: F key) that the operator can press at any time during a mission. When pressed:

1. The system captures a 30-second rolling buffer (15 seconds before, 15 seconds after the flag)
2. All sensor data (LiDAR point clouds, camera images, IMU, GPS) is saved at full resolution
3. Vehicle state (speed, heading, control commands, perception output, planning output) is logged
4. The operator is prompted for a brief categorization:

```
FLAG CATEGORIES (select one or more):
  [ ] Unexpected stop / slowdown
  [ ] Object detection issue (missed, false positive, wrong class)
  [ ] Localization issue (drift, jump, uncertainty)
  [ ] Personnel interaction (unexpected behavior, close call)
  [ ] Aircraft interaction (proximity, pushback, jet blast)
  [ ] Path planning issue (suboptimal route, oscillation)
  [ ] Sensor issue (degraded data, obstruction)
  [ ] Environmental (weather, lighting, surface condition)
  [ ] Other: [free text]
  
  Severity: [Minor] [Moderate] [Safety-Critical]
  
  Notes (optional): [                              ]
  
  [Submit Flag]
```

### 6.2 Automatic Edge Case Capture

In addition to operator flags, the system automatically captures data when safety-relevant events occur:

| Trigger | Threshold | Data Window | Priority |
|---|---|---|---|
| Safety controller activation | Any activation | 30s before + 10s after | High |
| Hard braking (deceleration > 2 m/s^2) | Configurable | 15s before + 5s after | Medium |
| TTC < 2.0 seconds | Any occurrence | 15s before + 10s after | High |
| E-stop activation | Any activation | 60s before + 30s after | Critical |
| Localization jump > 0.5m | Any occurrence | 30s before + 10s after | Medium |
| Perception confidence drop below 0.5 | Sustained > 2 seconds | 15s before + 10s after | Medium |
| OOD score > 0.7 | Sustained > 3 seconds | 30s before + 30s after | High |
| Operator takeover | Any occurrence | 60s before + duration + 30s after | High |
| Communication loss > 2 seconds | Any occurrence | 30s before + duration + 10s after | High |
| Speed exceeding 90% of limit | Any occurrence | 10s before + 10s after | Low |
| Novel object detection (class unknown) | Any occurrence | 15s before + 10s after | Medium |

**Storage:** Each 30-second capture is ~1-3 GB (full sensor suite). At 5-50 captures/day/vehicle, plan for 5-150 GB daily edge case storage. Tiered: 30 days hot (NVMe), 1 year warm (HDD), permanent cold for safety events (S3 Glacier).

### 6.3 Structured Incident Report Format

For events requiring formal documentation (safety events, near-misses, regulatory-reportable incidents):

```
INCIDENT REPORT  IR-2026-0417-003
══════════════════════════════════════════════════
Date: 2026-04-17 14:32:07 UTC | Vehicle: third-generation tug-007 | Location: Gate B7

WHAT HAPPENED: Vehicle transiting at 12 km/h performed emergency stop.
Ground crew member emerged from behind belt loader at ~4.5m, detected
at 3.8m (210ms pipeline latency at speed). Stopped with 1.2m clearance.

WHY: Personnel occluded by belt loader. No prior tracking history.
Belt loader at non-standard angle created blind zone.

VEHICLE RESPONSE: Detected at 3.8m (conf 0.94) → TTC 1.14s → 
Category 3 stop → 3.2 m/s^2 deceleration → stopped in 1.6m.

SHOULD HAVE: Reduced speed approaching active gate (turnaround in
progress). Applied predictive occlusion reasoning (belt loader at
gate implies possible hidden personnel). Target: 5 km/h within 15m.

CORRECTIVE ACTIONS:
☐ Add "active gate approach" speed reduction rule
☐ Flag data for annotation (occlusion scenario)
☐ Add to training dataset, review belt loader proximity rules
```

### 6.4 Integration with Active Learning Pipeline

Flagged and auto-captured data feeds directly into the active learning pipeline:

```
┌──────────────────┐
│  Operator Flag    │──┐
│  (manual)         │  │
└──────────────────┘  │     ┌────────────────────┐
                      ├────>│  Edge Case Database │
┌──────────────────┐  │     │  (MinIO / S3)       │
│  Auto-Capture     │──┘     │                    │
│  (safety triggers)│        │  Metadata:          │
└──────────────────┘        │  - Category          │
                            │  - Severity           │
                            │  - Vehicle ID         │
                            │  - Location           │
                            │  - Weather            │
                            │  - Time of day        │
                            └─────────┬────────────┘
                                      │
                            ┌─────────▼────────────┐
                            │  Prioritization       │
                            │  Queue                │
                            │                       │
                            │  Score = severity     │
                            │    * novelty          │
                            │    * class_rarity     │
                            │    * operator_flag    │
                            └─────────┬────────────┘
                                      │
                            ┌─────────▼────────────┐
                            │  Annotation Pipeline  │
                            │                       │
                            │  1. Pre-label with    │
                            │     existing models   │
                            │  2. Human QA / fix    │
                            │  3. Add to training   │
                            │     dataset           │
                            └─────────┬────────────┘
                                      │
                            ┌─────────▼────────────┐
                            │  Model Retraining     │
                            │                       │
                            │  Trigger: weekly or   │
                            │  when queue > 100     │
                            │  annotated samples    │
                            └─────────┬────────────┘
                                      │
                            ┌─────────▼────────────┐
                            │  Shadow Validation    │
                            │                       │
                            │  New model runs in    │
                            │  shadow mode for 7    │
                            │  days before          │
                            │  production deploy    │
                            └──────────────────────┘
```

### 6.5 Near-Miss Database for Safety Trend Analysis

Every edge case and incident is stored in a structured database enabling trend analysis:

**Queryable Fields:** Date/time, location (GPS + gate/stand), vehicle ID, operator ID, event category, severity, object type (personnel/aircraft/GSE/FOD), environmental conditions, system component involved, outcome (safe stop/near-miss/contact/damage), operator response time, corrective action status.

**Monthly Safety Dashboard KPIs:**

| KPI | Definition | Target |
|---|---|---|
| Near-miss rate | Near-misses per 1,000 vehicle-km | < 0.5 (trending down) |
| Operator intervention rate | Takeovers per 1,000 vehicle-km | < 1.0 (trending down) |
| Mean TTC at closest approach | Average TTC across all close encounters | > 3.0 seconds |
| Edge cases flagged (operator) | Operator flags per 1,000 vehicle-km | 2-10 (too low = complacency) |
| Auto-capture rate | Auto-triggered captures per 1,000 vehicle-km | Trending down |
| Mean time to annotate | Days from capture to annotated dataset | < 7 days |
| Model improvement rate | Accuracy improvement per retraining cycle | Positive trend |
| Corrective action closure rate | % of corrective actions closed within 30 days | > 90% |

---

## 7. External Communication to Ground Crew

### 7.1 The Communication Challenge

Ground crew working on the apron must understand autonomous vehicle intent and status without direct driver interaction. Research on airport ramp accidents shows that 27,000 ramp accidents occur worldwide annually, with GSE collisions as a primary cause. Autonomous vehicles must communicate their intent at least as effectively as human-driven GSE -- and ideally better.

Key challenges: (1) 85-100 dB ambient noise from APU/jet engines requires audio signals to be very loud or use alternative modalities; (2) visual clutter with dozens of vehicles/equipment requires distinctive signals; (3) ground crew attention is on their tasks, not the AV; (4) diverse workforce (airlines, handlers, fuelers, caterers) with varying training; (5) hi-vis vests cause 84-88% AEB failure at night due to sensor glare -- vehicle must detect crew reliably regardless.

### 7.2 Vehicle-to-Crew Signaling Systems

**LED Light Bar System:**

A 360-degree LED light bar is the primary external communication method. It communicates vehicle state and intent through color, pattern, and animation.

| State | LED Color | Pattern | Meaning for Ground Crew |
|---|---|---|---|
| Autonomous driving (normal) | Teal/Cyan | Steady glow | "I am moving autonomously -- be aware" |
| Autonomous driving (approaching) | Teal pulsing | Slow pulse 1 Hz | "I am approaching -- I see you" |
| Yielding / slowing | White sweep | Directional sweep toward obstacle | "I am yielding to you" |
| Stopping | Amber | Rapid pulse 3 Hz | "I am stopping" |
| Stopped (waiting) | Amber | Steady | "I am stopped and waiting" |
| About to move | Teal | Accelerating pulse | "I am about to start moving" (3s warning) |
| Turning left | Teal + left amber | Directional animation left | "I am turning left" |
| Turning right | Teal + right amber | Directional animation right | "I am turning right" |
| Fault / E-stop | Red | Rapid flash | "I have stopped due to a problem -- stay clear" |
| Teleoperated | Amber | Standard (matches human-driven) | "A human is controlling me remotely" |
| Charging / inactive | Dim white | Breathing pattern | "I am not in service" |

**Audio Alert System:**

| Situation | Sound | Volume | Duration |
|---|---|---|---|
| Normal movement | Synthetic hum (EV-style) | 65-70 dB | Continuous while moving |
| Approaching personnel (> 5m) | Melodic chime (non-alarming) | 75 dB | 2 chimes |
| Close approach (< 3m) | Urgent tone | 80-85 dB | Continuous until clear |
| About to move from stop | Rising two-tone | 75 dB | 3 seconds before movement |
| Emergency stop | Alarm horn | 90+ dB | Until acknowledged |
| Reversing | Beeping (standard) | 75-80 dB | Continuous while reversing |
| Speech (optional) | "Autonomous vehicle passing" | 75 dB | On approach to congested areas |

**Display Screen (Optional):** Rear/side-facing e-ink or LCD showing pictograms (arrows, stop hand, wait), multilingual text, QR code for vehicle info, and vehicle ID/mission type.

### 7.3 Predictable Behavior

Research on pedestrian-AV interaction shows predictability matters more than communication signals. Key principles: (1) follow consistent trajectories -- same route, speed, behavior at same locations; (2) signal intent early -- turning indication 5+ seconds before turn; (3) decelerate smoothly -- gradual deceleration communicates intentional slowing vs. sudden stop signaling fault; (4) maintain 10-15 km/h in crew areas (too slow = unpredictable, too fast = threatening); (5) yield to aircraft always, pedestrians always, follow existing GSE traffic patterns; (6) never surprise -- signal reason for any unexpected behavior.

### 7.4 SAE and Industry Standards for External AV Communication

**SAE J3134:** External indication of ADS engagement status; proposed marker lamp (blue/green) -- not finalized for airport. **SAE J3216:** Vehicle-to-road-user communication taxonomy; defines "receptivity" concept relevant to ground crew interaction. **ISO 23049:** eHMI requirements for visibility, conspicuity, cross-cultural comprehensibility -- airport deployment must consider international workforce.

**RTCA DO-XXX (Proposed):**
- No current RTCA standard for autonomous airside vehicle external communication -- gap for industry to fill

### 7.5 Research on External HMI (2024-2025 SOTA)

**Projection-Based Intent Display:** Projects planned trajectory onto ground surface ahead of vehicle. TU Munich (2024) research shows 34% reduction in pedestrian hesitation vs. no eHMI. Airside challenge: projection visibility in direct sunlight.

**LED Strip Trajectory Display:** LED strip along vehicle lower edge animates in direction of travel. Intuitive across cultures (no training needed), scalable to vehicle length.

**Sound Design:**
- Directional speakers can project audio toward specific individuals rather than broadcasting omnidirectionally
- UN Regulation 138 mandates minimum sound for electric vehicles at low speed -- applies to airside EVs

### 7.6 Ground Crew Familiarization Program

Ground crew who will work near autonomous vehicles need familiarization (distinct from operator training):

| Topic | Duration | Delivery |
|---|---|---|
| What the vehicle looks like and does | 15 minutes | Briefing + visual aids |
| What the lights and sounds mean | 15 minutes | Demonstration with vehicle |
| How to interact safely (right of way, crossing) | 15 minutes | Practical demonstration |
| E-stop button locations and how to use them | 10 minutes | Hands-on |
| What to do if the vehicle behaves unexpectedly | 10 minutes | Briefing + card |
| Who to contact for issues | 5 minutes | Contact card |
| **Total** | **~70 minutes** | **Annual refresher: 30 min** |

---

## 8. Practical Implementation

### 8.1 ROS Topic Architecture for HMI

The HMI system subscribes to existing reference airside AV stack topics and publishes aggregated data for the dashboard:

```yaml
# HMI-relevant ROS topics (published by existing stack)

# Sensor data (raw -- for edge case capture, not for dashboard)
/rslidar/points_0 ... /rslidar/points_7    # sensor_msgs/PointCloud2
/imu/data                                   # sensor_msgs/Imu
/gps/fix                                    # sensor_msgs/NavSatFix

# Localization
/odom/fused                                 # nav_msgs/Odometry
/localization/uncertainty                    # geometry_msgs/PoseWithCovariance
/localization/gps_quality                    # custom msg (fix type, satellites, HDOP)

# Perception
/perception/detections                      # vision_msgs/Detection3DArray
/perception/occupancy_grid                  # nav_msgs/OccupancyGrid (2D)
/perception/tracked_objects                  # custom msg (tracked objects with IDs)

# Planning
/planning/planned_path                      # nav_msgs/Path
/planning/trajectory                        # custom msg (trajectory with velocities)
/av_nav/cmd_twist                           # geometry_msgs/Twist

# Safety monitor
/safety_monitor/ood_score                   # std_msgs/Float32
/safety_monitor/ttc                         # std_msgs/Float32
/safety_monitor/confidence                  # std_msgs/Float32
/safety_monitor/field_status                # custom msg (safety field clear/triggered)
/safety_monitor/selected_stack              # std_msgs/String

# Vehicle state
/vehicle/speed                              # std_msgs/Float32
/vehicle/battery                            # sensor_msgs/BatteryState
/vehicle/mode                               # std_msgs/String (autonomous/shared/teleop/stopped)
/vehicle/steering_angle                     # std_msgs/Float32

# HMI bridge node publishes aggregated topics
/hmi/vehicle_status                         # custom msg (aggregated vehicle state)
/hmi/alert                                  # custom msg (alert level, message, timestamp)
/hmi/kpi_dashboard                          # custom msg (all KPIs in one message)
/hmi/sensor_health                          # custom msg (per-sensor status)
/hmi/edge_case_flag                         # custom msg (operator flag with metadata)

# Operator commands (from dashboard to vehicle via rosbridge)
/hmi/cmd/mode_switch                        # std_msgs/String (target mode)
/hmi/cmd/resume                             # std_msgs/Empty
/hmi/cmd/estop                              # std_msgs/Empty
/hmi/cmd/reroute                            # nav_msgs/Path (alternative path)
/hmi/cmd/send_to_base                       # std_msgs/Empty
/hmi/cmd/teleop_twist                       # geometry_msgs/Twist (teleoperation commands)
```

### 8.2 HMI Bridge Node (Key Components)

The HMI bridge node aggregates vehicle state into a single JSON message published at 10 Hz over rosbridge. Key design elements:

```python
#!/usr/bin/env python3
"""HMI Bridge -- aggregates vehicle state for dashboard. Publishes 10 Hz."""
import rospy, json
from std_msgs.msg import Float32, String
from nav_msgs.msg import Odometry
from sensor_msgs.msg import BatteryState

class HMIBridgeNode:
    def __init__(self):
        rospy.init_node('hmi_bridge')
        self.vehicle_state = {
            'timestamp': 0.0, 'position': {}, 'heading': 0.0,
            'speed': 0.0, 'battery_soc': 100.0, 'mode': 'stopped',
            'localization_uncertainty': 0.0, 'ttc': float('inf'),
            'ood_score': 0.0, 'confidence': 1.0,
            'alert_level': 0, 'alert_message': '',
        }
        # Subscribe to all relevant topics
        rospy.Subscriber('/odom/fused', Odometry, self._odom_cb)
        rospy.Subscriber('/vehicle/speed', Float32, self._speed_cb)
        rospy.Subscriber('/safety_monitor/ttc', Float32, self._ttc_cb)
        rospy.Subscriber('/safety_monitor/ood_score', Float32, self._ood_cb)
        # ... additional subscribers for battery, mode, confidence, localization
        
        self.status_pub = rospy.Publisher('/hmi/vehicle_status', String, queue_size=1)
        self.alert_pub = rospy.Publisher('/hmi/alert', String, queue_size=10)
        
        # Configurable thresholds
        self.thresholds = {
            'ttc_warning': rospy.get_param('~ttc_warning', 3.0),
            'ttc_critical': rospy.get_param('~ttc_critical', 1.5),
            'ood_caution': rospy.get_param('~ood_caution', 0.5),
            'ood_warning': rospy.get_param('~ood_warning', 0.7),
            'loc_caution': rospy.get_param('~loc_caution', 0.3),
            'loc_critical': rospy.get_param('~loc_critical', 0.5),
        }
        rospy.Timer(rospy.Duration(0.1), self._publish_status)
    
    def _compute_alerts(self):
        """Compute alert level from thresholds. Level 0-4 (info to critical)."""
        level, messages = 0, []
        if self.vehicle_state['ttc'] < self.thresholds['ttc_critical']:
            level, _ = 4, messages.append('TTC critical')
        elif self.vehicle_state['ttc'] < self.thresholds['ttc_warning']:
            level, _ = max(level, 3), messages.append('TTC warning')
        # Similar checks for OOD, localization, battery...
        self.vehicle_state['alert_level'] = level
        self.vehicle_state['alert_message'] = '; '.join(messages) or 'Nominal'
    
    def _publish_status(self, event):
        self.vehicle_state['timestamp'] = rospy.get_time()
        self._compute_alerts()
        msg = String(data=json.dumps(self.vehicle_state))
        self.status_pub.publish(msg)
        if self.vehicle_state['alert_level'] >= 2:
            self.alert_pub.publish(String(data=json.dumps({
                'level': self.vehicle_state['alert_level'],
                'message': self.vehicle_state['alert_message']})))
```

### 8.3 Rosbridge and Web Video Server Configuration

**rosbridge_websocket launch:**

```xml
<!-- hmi_server.launch -->
<launch>
  <!-- Rosbridge WebSocket for topic data -->
  <include file="$(find rosbridge_server)/launch/rosbridge_websocket.launch">
    <arg name="port" value="9090"/>
    <arg name="address" value="0.0.0.0"/>
    <arg name="ssl" value="true"/>
    <arg name="certfile" value="/etc/ssl/certs/hmi-server.pem"/>
    <arg name="keyfile" value="/etc/ssl/private/hmi-server.key"/>
    <arg name="authenticate" value="true"/>
  </include>
  
  <!-- Web video server for camera streams -->
  <node pkg="web_video_server" type="web_video_server" name="web_video_server">
    <param name="port" value="8080"/>
    <param name="server_threads" value="4"/>
    <param name="ros_threads" value="4"/>
    <param name="default_stream_type" value="h264"/>
    <param name="quality" value="50"/>  <!-- Balance quality vs bandwidth -->
  </node>
  
  <!-- HMI bridge node -->
  <node pkg="hmi_bridge" type="hmi_bridge_node.py" name="hmi_bridge" output="screen">
    <param name="ttc_warning" value="3.0"/>
    <param name="ttc_critical" value="1.5"/>
    <param name="ood_caution" value="0.5"/>
    <param name="ood_warning" value="0.7"/>
    <param name="loc_caution" value="0.3"/>
    <param name="loc_critical" value="0.5"/>
    <param name="battery_caution" value="20.0"/>
    <param name="battery_critical" value="10.0"/>
  </node>
</launch>
```

### 8.4 Foxglove Studio for Rapid Prototyping

Foxglove Studio provides the fastest path to a functional monitoring dashboard without custom development:

**Recommended Foxglove Panel Layout:**

| Panel | Type | Data Source | Purpose |
|---|---|---|---|
| Airport Map | Map panel | `/odom/fused` + custom GeoJSON | Vehicle position on airport map |
| 3D View | 3D panel | `/rslidar/points_*`, `/perception/detections` | Point cloud with detections |
| Camera | Image panel | `/camera/front/image_compressed` | Forward camera view |
| KPI Gauges | Plot panel | `/hmi/vehicle_status` | Speed, battery, TTC, OOD |
| Alert Log | Log panel | `/hmi/alert` | Alert history |
| Diagnostics | Diagnostics panel | `/diagnostics` | Sensor health |
| Raw Data | Raw Messages panel | Various | Debugging |

**Foxglove Connection:**

```
foxglove-websocket://edge-server:8765
  or
rosbridge-websocket://edge-server:9090
```

**Foxglove Limitations:** Single-vehicle focus (no fleet overview), limited custom UI, no built-in auth/RBAC, no alert escalation, no teleoperation control. Acceptable for Phase 1-2; custom dashboard needed for Phase 3+.

### 8.5 Security Architecture

| Layer | Controls |
|---|---|
| **Network** | Private 5G (SIM auth), WireGuard VPN, TLS 1.3 for WebSocket, dedicated VLAN |
| **Authentication** | MFA (TOTP/hardware key), JWT for rosbridge, 30-min session timeout |
| **Authorization** | Viewer (monitor only), Operator (flag, ack, mode switch), Supervisor (E-stop all, fleet override), Admin (config) |
| **Audit** | All actions logged with timestamp + user ID, mode transitions, alert acks, 2-year retention |
| **Safety Independence** | E-stop hardwired (not software), safety scanner independent of HMI network, MRC without HMI, comm loss = vehicle stops |

### 8.6 Operator Station Hardware

| Component | Specification | Cost | Notes |
|---|---|---|---|
| Primary display | 32" 4K, 60 Hz, IPS | $400-600 | Fleet overview + focused vehicle view |
| Secondary display | 27" 4K, 60 Hz | $300-400 | Camera feeds, 3D perception view |
| Tertiary display (optional) | 24" 1080p | $150-250 | KPIs, alerts, incident reporting |
| Workstation | 64 GB RAM, RTX 4060, i7/Ryzen 7 | $2,000-3,000 | 3D rendering, video decoding |
| Network | Dedicated 1 Gbps ethernet | $50-100 | Direct connection to edge server |
| UPS | 1500 VA, 30-minute runtime | $300-500 | Continuous operation during power events |
| Input devices | Keyboard, mouse, gamepad (teleop) | $200-400 | Gamepad for teleoperation control |
| Headset | Noise-canceling with microphone | $100-200 | Audio alerts, ATC communication |
| **Teleoperation add-on (optional)** | | | |
| Steering wheel + pedals | Logitech G923 or similar | $400-600 | For direct teleoperation mode |
| E-stop button | CE-certified, USB-connected | $100-200 | Physical emergency stop |
| **Total per station** | | **$3,700-5,750** | Without teleoperation hardware |
| **Total per station** | | **$4,200-6,550** | With teleoperation hardware |

**Note:** The $5-15K per station estimate includes the hardware above ($4-7K) plus installation, cabling, desk/chair, and a 20% contingency.

---

## 9. reference airside AV stack-Specific Integration

### 9.1 Current Stack Integration Points

The reference airside AV stack ROS Noetic stack (22 packages, C++ nodelets) provides the following integration points for HMI:

| Stack Component | Relevant Topic | HMI Use |
|---|---|---|
| GTSAM localization (GPU VGICP + IMU + RTK + wheel odom) | `/odom/fused` | Vehicle position on map, localization health |
| RoboSense LiDAR (4-8 sensors, RSHELIOS/RSBP) | `/rslidar/points_*` | Point cloud visualization, sensor health |
| RANSAC segmentation | Perception outputs | Object detection display |
| Frenet planner (420 candidates/cycle) | `/planning/trajectory` | Planned path visualization |
| Stanley lateral control | `/av_nav/cmd_twist` | Actual control commands |
| Safety monitor (if Simplex architecture deployed) | `/safety_monitor/*` | Safety state, stack selection |

### 9.2 HMI Integration with Simplex Architecture

If the Simplex dual-stack architecture (production + shadow) is deployed, the HMI must display both stacks:

```
┌────────────────────────────────────────────────────────┐
│  DUAL-STACK STATUS                                      │
│                                                         │
│  Production Stack (Active):                             │
│  ├─ RANSAC Perception: ██████████ OK                   │
│  ├─ Frenet Planner:    ██████████ OK                   │
│  ├─ Speed: 12.3 km/h                                   │
│  └─ Status: CONTROLLING VEHICLE                         │
│                                                         │
│  Shadow Stack (Observing):                              │
│  ├─ Neural Perception: ████████░░ 82%                  │
│  ├─ Diffusion Planner: ██████████ OK                   │
│  ├─ Shadow Speed Cmd: 12.1 km/h                        │
│  └─ Trajectory Divergence: 0.12m (within threshold)    │
│                                                         │
│  Arbitrator: Production selected. Shadow agrees.        │
│  Divergence threshold: 0.5m (current: 0.12m)           │
└────────────────────────────────────────────────────────┘
```

When the shadow stack disagrees with the production stack (trajectory divergence > threshold), this should be surfaced as a caution-level alert and logged for analysis.

### 9.3 Vehicle-Specific HMI Considerations

| Vehicle | Steering Type | HMI Consideration |
|---|---|---|
| third-generation tug | Ackermann + crab mode | Crab mode = lateral movement; display steering mode, travel direction (may differ from heading), external LED must signal lateral movement intent |
| small tug platform | Standard | Standard HMI |
| POD | Bidirectional | Display which end is "front"; intent display on both ends |
| ACA1 | Standard | Standard HMI |

### 9.4 Phased HMI Development Plan

| Phase | Duration | HMI Deliverable | Cost Estimate |
|---|---|---|---|
| Phase 1: Prototype | 2-3 months | Foxglove layout + HMI bridge node + basic web dashboard | $5-10K |
| Phase 2: Monitoring Dashboard | 3-4 months | Custom React dashboard with fleet overview, alerts, KPIs | $20-30K |
| Phase 3: Teleoperation Integration | 2-3 months | Video streaming, control commands, mode switching | $15-25K |
| Phase 4: Edge Case Pipeline | 2-3 months | Flag system, auto-capture, annotation queue integration | $10-15K |
| Phase 5: External HMI | 2-3 months | LED light bar integration, audio system, display screen | $8-12K per vehicle |
| **Total Software Development** | **11-16 months** | | **$50-80K** |
| **Per-Vehicle External HMI Hardware** | | LED bar + speakers + controller | **$2-5K per vehicle** |
| **Per-Station Operator Hardware** | | Displays + workstation + peripherals | **$5-15K per station** |

---

## 10. Cost Estimates and Phased Rollout

### 10.1 Total Cost Summary

| Item | Per-Unit Cost | Quantity (Initial) | Total |
|---|---|---|---|
| Software development (dashboard + bridge + pipeline) | -- | -- | $50-80K |
| Operator station hardware | $5-15K | 2 stations | $10-30K |
| External HMI hardware (per vehicle) | $2-5K | 3 vehicles | $6-15K |
| Edge server (on-airport) | $5-10K | 1 | $5-10K |
| Network infrastructure (if not existing) | $5-15K | 1 | $5-15K |
| Operator training development (curriculum + simulator) | -- | -- | $10-20K |
| Operator training delivery (per operator, initial) | $2-4K | 4 operators | $8-16K |
| Foxglove Studio (enterprise, optional) | $0-5K/yr | 1 | $0-5K |
| Security audit and penetration testing | -- | -- | $5-10K |
| **Total Initial Investment** | | | **$99-201K** |
| **Annual Recurring** | | | |
| Operator training (recurrent) | $1-2K | 4 operators | $4-8K/yr |
| Software maintenance and updates | -- | -- | $10-20K/yr |
| Edge case storage (cloud) | -- | -- | $5-15K/yr |
| **Total Annual Recurring** | | | **$19-43K/yr** |

### 10.2 ROI Considerations

The HMI investment enables the transition from 1:1 to 1:N operator-to-vehicle ratios. The financial impact:

| Ratio | Operators Needed (10 vehicles) | Annual Labor Cost (est.) | Savings vs. 1:1 |
|---|---|---|---|
| 1:1 (current) | 10 | $500-700K | Baseline |
| 1:3 | 4 | $200-280K | $300-420K |
| 1:5 | 2 | $100-140K | $400-560K |
| 1:10 | 1 | $50-70K | $450-630K |

At a 10-vehicle fleet with $99-201K initial investment, the breakeven point for transitioning from 1:1 to 1:3 is approximately 6-8 months. The investment pays for itself within the first year of reduced operator staffing.

### 10.3 Implementation Timeline

| Month | Activity | Deliverable |
|---|---|---|
| 1-2 | Phase 1: Foxglove prototype + HMI bridge node | Basic monitoring dashboard |
| 3-5 | Phase 2: Custom React dashboard | Fleet monitoring with alerts and KPIs |
| 5-7 | Phase 3: Teleoperation integration | Video streaming and remote control |
| 7-9 | Phase 4: Edge case pipeline | Flag system, auto-capture, annotation queue |
| 9-11 | Phase 5: External HMI | LED light bars, audio, ground crew training |
| 6-8 | Operator training curriculum (parallel) | Training materials and simulator |
| 9-11 | Initial operator training delivery | 4 trained operators |
| 12 | Operational readiness | Phase 2 deployment (1:1 remote) |
| 18 | Target | Phase 3 deployment (1:3 remote) |

---

## References

### Standards and Regulatory Documents

1. ISO 3691-4:2023 -- Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks and their systems
2. ISO 13849-1 -- Safety-related parts of control systems -- Part 1: General principles for design
3. ISO 13850:2015 -- Safety of machinery -- Emergency stop function
4. IEC 62998 -- Safety of machinery -- Safety-related sensors used for the protection of persons
5. FAA CertAlert 24-02 -- Autonomous Ground Vehicle Systems (AGVS) Technology on Airports (February 2024)
6. FAA AC 150/5210-5D -- Painting, Marking, and Lighting of Vehicles Used on an Airport
7. EASA AI Roadmap 2.0 -- A Human-Centric Approach to AI in Aviation (2023)
8. UL 4600 -- Standard for Safety for the Evaluation of Autonomous Products
9. SAE J3016 -- Taxonomy and Definitions for Terms Related to Driving Automation Systems
10. SAE J3134 -- Automated Driving System Marker Lamp
11. SAE J3216 -- Taxonomy and Definitions for Cooperative Driving Automation
12. ISO 23049 -- Road Vehicles -- External Human-Machine Interface Requirements (in development)
13. EU Machinery Regulation 2023/1230 (effective January 2027)
14. UN Regulation 138 -- Quiet Road Transport Vehicles (minimum sound requirements)

### Research Papers

15. Lee & See (2004). Trust in automation: Designing for appropriate reliance. Human Factors, 46(1), 50-80.
16. Parasuraman & Riley (1997). Humans and automation: Use, misuse, disuse, abuse. Human Factors, 39(2), 230-253.
17. Parasuraman, Sheridan & Wickens (2000). A model for types and levels of human interaction with automation. IEEE Trans SMC, 30(3).
18. Parasuraman & Manzey (2010). Complacency and bias in human use of automation. Human Factors, 52(3), 381-410.
19. Endsley (1995). Toward a theory of situation awareness in dynamic systems. Human Factors, 37(1), 32-64.
20. Flight Safety Foundation GAP, IATA Ground Damage Report (2022), IATA Enhanced GSE Recognition Program

### Related Repository Documents

- [ISO 3691-4 Deep Dive](../../60-safety-validation/standards-certification/iso-3691-4-deep-dive.md) -- Clause-level safety standard analysis
- [Regulatory Trajectory](../../80-industry-intel/regulations/regulatory-trajectory-deep-dive.md) -- FAA, EASA, ICAO regulatory timeline
- [Teleoperation Systems](teleoperation-systems.md) -- Fernride, Waymo, Cruise teleop comparison
- [Simplex Safety Architecture](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md) -- Dual-stack arbitrator design
- [Ground Crew Pedestrian Safety](../../70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md) -- Ramp accident statistics, detection challenges
- [Deployment Playbook](../../70-operations-domains/deployment-playbooks/deployment-playbook.md) -- End-to-end airport deployment guide
- [Shadow Mode](../../60-safety-validation/verification-validation/shadow-mode.md) -- Parallel autonomy validation
- [Cybersecurity](../../60-safety-validation/cybersecurity/cybersecurity-airside-av.md) -- Security requirements for airside AV systems
