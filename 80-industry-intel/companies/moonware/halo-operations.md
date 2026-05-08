# Moonware HALO: AI Turnaround Orchestration Platform

## Research Date: March 2026

---

## 1. HALO Platform Architecture

### What It Does

HALO (branded as Ground Traffic Control) is Moonware's flagship AI-powered platform for coordinating, monitoring, and managing all airside ground operations from a single centralized system. It replaces fragmented manual processes — walkie-talkies, paper-based task sheets, radio dispatching — with algorithmic real-time coordination of ground crews, ground support equipment (GSE), and aircraft servicing workflows.

The platform manages the full scope of below-wing turnaround operations:
- Crew dispatching and task assignment
- GSE allocation and tracking (pushback tugs, belt loaders, fuel trucks, etc.)
- Baggage and cargo loading coordination
- Aircraft refueling sequencing
- Catering delivery scheduling
- Real-time airside navigation and situational awareness
- In-app communication replacing radio channels

### How It Works

HALO operates as a cloud-based SaaS platform accessible via mobile app (Android/iOS), tablet, and web dashboard. The system architecture centers on a **core optimizer** that fuses three proprietary data streams:

1. **Real-time flight information** — Schedule data including arrivals, departures, gate assignments, delays, and schedule changes. Auto-syncs tasks and shifts according to flight schedule modifications.

2. **Crew schedules and task allocation** — Shift rosters, certifications, availability, and current task status for all ground personnel.

3. **Ground positions and movement** — The proprietary data layer. HALO uses **low-cost GPS trackers** attached to GSE vehicles and **smartphone-based tracking** via worker cell phones to maintain real-time location awareness of all assets and personnel on the ramp.

The optimizer considers multiple constraint variables — urgency, distance to aircraft, departure/arrival times, crew availability, equipment compatibility, certification requirements — to automatically generate and dispatch optimal service missions. Task allocation and vehicle routing happen in the cloud in real time.

### AI/ML Components

- **Dispatch optimization algorithm**: Constraint-based optimizer that generates optimal crew-to-aircraft and equipment-to-aircraft assignments considering distance, timing, availability, and equipment compatibility
- **Machine learning models**: Built from ground data collected across multiple airport hubs, these models identify airfield traffic patterns, airport-specific constraints, and operational bottlenecks. Training data includes GSE movement patterns, crew interaction logs, and service punctuality metrics
- **Predictive analytics**: End-of-day analytics engine surfaces recurring delay patterns, staffing inefficiencies, and resource allocation issues to support strategic improvements
- **Turnaround timing models**: Track, timestamp, and continuously feed ground activity data into planning tools for data-driven turnaround time prediction and process optimization

### Decision Outputs

- Automated crew dispatch assignments
- Dynamic GSE allocation and routing
- Real-time task reassignment when schedules change
- Delay risk alerts and escalation notifications
- Performance benchmarking across flights and stations
- Punctuality trend analysis for individual operations

### Key Differentiator: No Cameras

Unlike camera-based competitors (notably Assaia), Moonware explicitly positions HALO as a **camera-free solution**. Their argument: camera-based systems are costly and time-consuming to plan, install, and maintain, and can disrupt airport operations during implementation. HALO's GPS/smartphone tracking approach requires minimal infrastructure — no camera installation across stands, no CCTV integration, no video processing pipelines. The tradeoff is that HALO lacks computer vision-based turnaround event detection (e.g., automatically detecting when a fuel truck connects or a jetbridge retracts).

### Apple Vision Pro Integration

In December 2024, Moonware launched HALO on Apple Vision Pro, providing spatial computing capabilities for Operations Control Centers. Features include a 3D real-time visualization of the airfield, hands-free interaction, the ability to focus on specific gates, track GSE, and monitor personnel movements. This appears to be primarily a demonstration/showcase capability rather than a core operational deployment.

---

## 2. Deployments

### JFK Terminal 8 — British Airways / IAG / dnata

- **Status**: Operational (Moonware's inaugural major airline deployment)
- **Scope**: All British Airways flights at JFK Terminal 8
- **Airline partner**: IAG (International Airlines Group), parent company of British Airways
- **Ground handler**: dnata (subsidiary of Emirates Group), providing ground handling services
- **What it does**: HALO services all BA flights at T8, providing dynamic task coordination, equipment allocation, and comprehensive situational awareness for ground crews
- **Strategic context**: Part of IAG's broader transformation program comprising 1,000+ projects aimed at improving operational efficiencies and customer experience
- **Timeline**: Launched prior to the March 2024 seed round announcement

### LAX — Aerocharter USA

- **Status**: Operational
- **Scope**: Ground handling operations for Aerocharter USA, a Mexico-based ground handler
- **What it does**: HALO manages aircraft turnaround coordination, replacing traditional communication methods and manual monitoring. Moonware has been on the ground providing upgraded product capabilities to manage increasing operational demands for Aerocharter's growing operation
- **Results**: Moonware claims "measurable improvements in aircraft turnaround times and operational efficiency" but has not published specific metrics for this deployment
- **Timeline**: Launched prior to the March 2024 seed round

### Tokyo Haneda (HND) — Japan Airlines / JAL Ground Service

- **Status**: Trial (announced July 2025)
- **Scope**: Below-wing coordination at JAL's local ground handling control station
- **Airline partner**: Japan Airlines (JAL)
- **Ground handler**: JAL Ground Service (JGS)
- **Features being tested**:
  - Dynamic dispatching capabilities
  - Live status updates and end-to-end visibility
  - Real-time communication between control station and field teams
  - Automated activity tracking with timestamps
  - Data-driven decision support tools
- **Expected outcomes**: Reduced variability in turnaround times, streamlined ground service execution, enhanced asset utilization
- **Strategic context**: Part of JAL's broader initiative to modernize and digitize ground handling workflows. Moonware CEO Javier Vidal described Haneda as "one of the most dynamic and demanding airport environments in the world"
- **Trial duration**: Not publicly disclosed

### Felipe Angeles International Airport (NLU), Mexico City — PrimeFlight Aviation Services

- **Status**: Deployed
- **Scope**: PrimeFlight's largest station and primary hub in Mexico
- **What it does**: Automates manual ground handling processes, provides real-time data fusion for adapting to schedule changes
- **Strategic context**: Builds on the LAX Aerocharter deployment success; marks expansion into Latin America

### Additional Deployments

Moonware states HALO has been "successfully launched in airfields all over the world" and references "additional global rollouts planned," though specific airports beyond the four named above have not been publicly identified.

---

## 3. 20% Delay Reduction Claim

### The Claim

Moonware states: "The system has proven to reduce delays by 20% and cut down turnaround times by an average of five minutes per flight, leading to better asset utilization and increased flight throughput."

### How Measured

Based on available public information, the measurement methodology appears to involve:

- **Before/after comparison**: Turnaround times and delay metrics before HALO deployment vs. after, at deployed airports
- **Real-time task tracking**: HALO logs precise start and stop times for all ground tasks, creating a detailed record of turnaround execution
- **Performance benchmarking**: Punctuality trends across individual operations to identify delays and improvement areas
- **Timestamped activity data**: Ground activities are tracked, timestamped, and continuously fed into analytics

### Assessment of the Claim

**What is known:**
- The 20% figure and 5-minute reduction are consistently cited across Moonware's marketing materials, press releases, and investor communications
- The claim likely derives from the JFK/British Airways deployment, which is the most substantial named deployment

**What is NOT known:**
- The specific baseline against which the 20% is measured (pre-HALO delay rate at the same station? Industry average?)
- Sample size (how many turnarounds measured)
- Statistical significance or confidence intervals
- Whether the improvement is from a controlled study or simple before/after observation
- Whether confounding factors (seasonal variation, staffing changes, schedule changes) were controlled for
- Whether any independent third party has verified the results

**Context — industry benchmarks:**
- Assaia claims a 25% reduction in departure delays across 450,000+ AI-enabled turnarounds at 15 airports (April 2024 - March 2025), verified by their published Turnaround Report
- Assaia also claims departure delays stabilizing at a median of 3 minutes at their airports vs. higher industry averages
- Neither Moonware nor any independent body has published a peer-reviewed study validating the 20% claim

**Assessment**: The claim is plausible given what similar systems achieve, but it lacks the statistical rigor and sample size transparency of competitors like Assaia. The 20% figure should be treated as a marketing claim from operational experience rather than an independently verified metric.

---

## 4. Integration with Ground Handling

### Integration Approach

HALO is designed to operate **independently of legacy systems**. This is both a strength and a limitation:

**Strengths:**
- No dependency on existing airport infrastructure (AODB, FIDS, A-CDM)
- Rapid deployment — GPS trackers and smartphone app can be deployed in days/weeks rather than months
- Works across any airport regardless of technology maturity
- Ground handler can adopt unilaterally without airport authority involvement

**Integration with existing operations:**
- HALO replaces (not augments) the ground handler's dispatch workflow
- Ramp agents receive task assignments via the HALO mobile app instead of radio
- Ramp managers use the HALO dashboard instead of paper-based or legacy dispatch systems
- Station managers get real-time oversight of all operations from a single screen
- OCC (Operations Control Center) personnel use HALO for performance monitoring and issue escalation

**What is unclear:**
- Whether HALO integrates with airport A-CDM systems to share TOBT (Target Off-Block Time) or receive TSAT (Target Start-up Approval Time)
- Whether flight data ingestion is via direct AODB/ACARS feeds or secondary sources (FlightAware, etc.)
- Whether HALO outputs feed back into airline operations control systems
- How HALO handles multi-handler environments where different handlers service different airlines at the same terminal

### Operational Workflow (from Moonware's "Day in the Life" content)

1. **OCC level**: Monitor overall station performance, identify systemic issues (e.g., pushback tug maintenance delays), analyze performance metrics
2. **Station manager level**: Real-time map of all operations, drill down into specific gate activity, communicate with ramp teams
3. **Ramp manager level**: Receive auto-generated task assignments, reassign crews based on real-time changes, track equipment availability
4. **Ramp agent level**: Mobile app shows current assignment, task details, timing, and enables direct communication with managers

---

## 5. Data Sources

### Confirmed Data Inputs

| Data Source | Type | Method |
|---|---|---|
| Flight schedules (arrivals, departures, gates) | Real-time | Ingested from operational systems (specific source not disclosed) |
| Crew schedules and shift rosters | Batch + real-time | Manual input and/or integration with scheduling systems |
| Crew task assignments and status | Real-time | HALO-generated and tracked |
| GSE vehicle locations | Real-time | Low-cost GPS trackers attached to vehicles |
| Personnel locations | Real-time | Smartphone-based tracking via worker cell phones |
| Task completion timestamps | Real-time | Logged automatically by HALO |
| Equipment availability and status | Real-time | Tracked within HALO |

### Not Confirmed / Unclear

| Data Source | Assessment |
|---|---|
| A-CDM data (TOBT, TSAT, ELDT) | No evidence of A-CDM integration in public materials |
| ADS-B aircraft tracking | Not mentioned; would provide independent arrival/departure timing |
| CCTV / camera feeds | Explicitly NOT used — this is a core differentiator |
| Weather data | Not mentioned in available materials |
| Passenger boarding data | Not mentioned |
| Baggage system data (BRS) | Not mentioned |
| Fuel delivery confirmation | Not mentioned |
| ACARS messages | Not mentioned |

### Data Processing

- Real-time processing for dispatch optimization and task assignment
- Batch/daily processing for performance analytics, trend identification, and ML model training
- Historical data used to build ML models for airport-specific operational patterns

---

## 6. Turnaround Prediction Accuracy

### What HALO Provides

HALO tracks turnaround execution in real time and provides performance analytics, but Moonware has **not published specific turnaround prediction accuracy metrics** (e.g., POBT prediction error, pushback time prediction accuracy).

**Available capabilities:**
- Real-time turnaround progress monitoring
- Task completion tracking with precise timestamps
- Performance benchmarking across flights
- Punctuality trend analysis
- End-of-day analytics on recurring issues

**What is NOT published:**
- POBT (Predicted Off-Block Time) accuracy in minutes
- PRDT (Predicted Readiness Time) accuracy
- Pushback timing prediction error distribution
- Comparison of predicted vs. actual turnaround durations

### Comparison with Assaia

Assaia explicitly publishes prediction capabilities:
- POBT and PRDT predictions using ML on camera-detected turnaround milestones
- Deployed at 15+ airports with 450,000+ turnarounds analyzed
- Specific per-airport metrics (e.g., 5-min delay reduction at JFKIAT, 17% OTP improvement at SEA)

Moonware's approach is fundamentally different — it focuses on **orchestrating** the turnaround (dispatching the right crew/equipment at the right time) rather than **observing and predicting** turnaround milestone completion from camera feeds. HALO's prediction capability, to the extent it exists, would derive from GPS movement patterns and task completion logs rather than visual detection of specific turnaround events.

---

## 7. Moonware NOVA — Military C2 Product

### Overview

NOVA is Moonware's Command-and-Control (C2) platform for military airbase operations. It adapts the core HALO architecture for defense-specific requirements.

### Capabilities

- **Real-time flightline coordination**: Automates and streamlines flightline management for aircraft turnaround, maintenance, and logistics
- **Operational oversight**: Provides comprehensive C2 across all airbase operations
- **Optimal mission generation**: Proprietary optimizer integrates real-time flight data, vehicle telemetry, and airmen task assignments to generate optimal aircraft service missions
- **Agile Combat Employment (ACE) support**: Designed for ACE doctrine — rapid deployment, austere base operations, distributed force postures
- **Low infrastructure**: Operates without external power, minimal setup requirements, deployable on-the-fly
- **Multi-tier base support**: Consistent C2 across fully equipped main bases through bare/austere environments

### Relationship to HALO

NOVA shares HALO's core optimization engine and data fusion architecture but adds:
- Military-grade security requirements
- ACE-specific operational modes
- Support for austere/disconnected environments
- Autonomous Aerospace Ground Equipment (A2GE) C2 capabilities — laying groundwork for autonomous military GSE
- Deployment readiness metrics specific to military mission requirements

### Defense Contracts

Specific contract details (SBIR/STTR awards, contract values, contracting agencies) have **not been publicly disclosed** in available sources. Moonware's defense page references USAF operations and ACE doctrine but does not name specific contracts or bases. The company lists defense as one of four target sectors (alongside commercial aviation, cargo, and advanced air mobility).

---

## 8. Moonware ATLAS — Autonomous Electric Aircraft Tug

### Overview

ATLAS is Moonware's autonomous and electric towing vehicle, currently under development. It originated from Moonware's collaboration with Uber Elevate to build autonomous pushback vehicles for eVTOL aircraft at vertiports.

### Technical Specifications

- **Propulsion**: Fully electric
- **Autonomy**: Autonomous navigation, path planning, and collision avoidance via onboard sensor suite
- **Coupling mechanism**: Patented design that leverages the weight of the aircraft's nose landing gear to generate the torque necessary for towing — eliminates need for cradle-style mechanisms and accommodates different landing gear configurations while minimizing structural fatigue
- **Alignment**: Precision alignment algorithm using computer vision to accurately locate and attach to the aircraft's front landing gear
- **Dispatch**: Controlled by HALO, dispatched based on real-time data including availability, charge level, and location
- **Navigation**: Follows trajectory commanded by HALO, dynamically adjusting for traffic and other obstacles
- **Capacity**: Initial design targets aircraft up to 10,000 lb (eVTOL class); commercial aviation applications would require larger variants

### Development Status

- **Concept demonstrated**: Prototype work completed during Uber Elevate collaboration (2020-2021)
- **Patent filed**: Coupling mechanism patent granted
- **Current status**: Under development; no publicly announced production timeline, certification pathway, or test deployment schedule
- **Original target**: "Could be ready for service by 2023" (stated in 2020) — this timeline was not met
- **Current focus**: Moonware appears to be prioritizing HALO software deployment and commercial traction over ATLAS hardware development

### Strategic Role

ATLAS represents the "last mile" of Moonware's airfield autonomy vision — autonomous vehicles executing the physical tasks that HALO orchestrates digitally. The software-first strategy (deploy HALO, collect operational data, build ML models) is intended to create the foundation for autonomous GSE deployment.

---

## 9. Business Model

### Revenue Model

Moonware has not publicly disclosed specific pricing. Based on available information:

- **Delivery model**: Cloud-based SaaS platform (web app + mobile app)
- **Likely pricing structure**: Per-station or per-airport subscription (typical for aviation SaaS), potentially with per-turnaround or per-flight components
- **Hardware costs**: Low-cost GPS trackers for GSE vehicles (Moonware-provided); smartphones/tablets used by workers (likely BYOD or handler-provided)
- **Implementation**: Rapid deployment — no camera installation, no infrastructure buildout, no integration with legacy airport systems required

### Funding History

| Round | Amount | Date | Lead Investors |
|---|---|---|---|
| Pre-seed | $2.5M | ~2022 | Third Prime |
| Seed | $7.0M | March 2024 | Third Prime, Zero Infinity Partners |
| **Total** | **$9.5M** | | |

Other investors: The House Fund, Lorimer Ventures, Plug and Play, strategic angel investors.

### Team

- **CEO**: Javier Vidal (founder) — Duke Mechanical Engineering; prior experience at Tesla (Model 3 ramp, autonomous material conveyance), Uber ATG (self-driving systems/hardware), Uber Elevate (autonomous pushback vehicle design); first patent at age 15; engineering career started in Tokyo at a robotics company
- **CTO**: Saunon Malekshahi
- **Headquarters**: Los Angeles, California
- **Team composition**: Draws from Silicon Valley tech firms and aviation industry

### Cost-Benefit Context

- Average cost of a delayed flight: ~$100/minute (FAA estimate), up to $166/minute (EASA)
- A 5-minute average turnaround reduction across a hub operation (say 200 flights/day) would save ~$100,000/day or ~$36.5M/year at $100/minute
- Even at a fraction of this, the ROI case for a SaaS subscription is strong

---

## 10. Competition with Assaia ApronAI

### Feature Comparison

| Dimension | Moonware HALO | Assaia ApronAI |
|---|---|---|
| **Core approach** | GPS/IoT-based orchestration | Camera/computer vision-based observation |
| **Primary function** | Dispatch optimization & task coordination | Turnaround milestone detection & prediction |
| **Data collection** | GPS trackers + smartphones | Existing CCTV cameras + computer vision |
| **Infrastructure needed** | GPS trackers, smartphone app | Access to existing camera infrastructure |
| **Turnaround event detection** | Inferred from GPS/task completion | Directly observed via computer vision |
| **Prediction capability** | Optimization-driven (prescriptive) | ML-driven POBT/PRDT prediction |
| **A-CDM integration** | Not confirmed | Yes (TOBT, TSAT sharing) |
| **Delay reduction claim** | 20% | 25% (median departure delays) |
| **Sample size for claims** | Not disclosed | 450,000+ turnarounds at 15 airports |
| **Total funding** | $9.5M (seed) | $26.6M+ (through Series B, Dec 2025) |
| **Founded** | 2020 | 2018 |
| **Key deployments** | JFK (BA), LAX, Haneda (trial), Mexico City | JFK, Heathrow, Dubai, Munich, Calgary, Seattle, Toronto Pearson, Rome, 15+ airports |
| **Primary buyer** | Ground handler / airline station | Airport authority + airline + ground handler |
| **Apple Vision Pro** | Yes (launched Dec 2024) | No |
| **Autonomous GSE roadmap** | Yes (ATLAS) | No |
| **Military product** | Yes (NOVA) | No |

### Differentiation Summary

**Moonware's advantages:**
- Lower deployment cost and faster time-to-value (no camera infrastructure)
- Can deploy at any airport regardless of CCTV coverage
- Orchestration-first approach (prescriptive, not just observational)
- Path to autonomous GSE integration
- Military market diversification via NOVA
- Ground handler can adopt unilaterally without airport authority buy-in

**Assaia's advantages:**
- Much larger deployment base (15+ airports, 450,000+ turnarounds analyzed)
- Computer vision provides objective, automated turnaround milestone detection without relying on human task completion logs
- Published, data-backed performance claims (2025 Turnaround Report)
- Stronger A-CDM integration capabilities
- Doesn't require GPS tracker hardware deployment on every vehicle
- Strategic Partner Community model (airport equity stakes)
- More mature prediction capabilities (POBT, PRDT)
- $26.6M Series B signals stronger commercial traction

### Other Competitors

| Company | Approach |
|---|---|
| **Veovo (Airport 20/20)** | AI-based operations platform using real-time and historical data; deployed at Manchester Airports Group |
| **SITA** | Broad aviation IT including ground operations modules |
| **ADB SAFEGATE** | Airport management systems including Resource Management Express (RMX) for gate/stand optimization |
| **Smarter Airports (AIRHART)** | JV between Copenhagen Airport and Netcompany; supports 100+ airside processes |
| **Synaptic Aviation** | AI for turnaround time and ramp efficiency |

---

## 11. Future Roadmap

### Moonware's Phased Master Plan

Moonware has published a multi-phase roadmap for achieving "airfield autonomy":

**Phase 1 — Software Foundation (Current)**
- Deploy HALO at commercial airports worldwide
- Build operational data corpus across diverse airport environments
- Train ML models on airport-specific traffic patterns and constraints
- Establish Ground Traffic Control as a new software category

**Phase 2 — Autonomous Ramp Services (Next)**
- Leverage data and operational experience from Phase 1
- Deploy initial autonomous ramp services in high-demand sectors:
  - Military airfields (via NOVA + A2GE)
  - Advanced Air Mobility / vertiports (via ATLAS + Skyway partnership)
- These environments are more controlled and less congested than major commercial airports

**Phase 3 — Integrated Autonomous Ground Service Provider**
- Deploy autonomous vehicles and systems for all aspects of ground operations
- Engine-off taxiing via autonomous tugs (reducing fuel consumption and emissions)
- HALO orchestrates the fleet; autonomous GSE executes physical tasks

**Phase 4 — Next-Generation Aircraft Support**
- Adapt technologies for autonomous and electric aircraft
- Sophisticated surface management for diverse operational requirements
- Full integration with AAM ecosystems (Skyway partnership for vertiport management)

### Skyway Partnership (AAM)

Moonware partnered with Skyway (February 2023) to integrate HALO's ground operations automation into Skyway's Vertiport Management System (VMS). ATLAS would tow eVTOL aircraft between parking stands and FATOs within Skyway's network. This partnership targets the emerging Advanced Air Mobility market.

### World Model Potential

HALO's data collection creates a comprehensive operational dataset that could serve as training data for world models:
- Spatial-temporal patterns of GSE movement across the ramp
- Crew-aircraft-equipment interaction sequences
- Delay propagation patterns through connected turnarounds
- Airport-specific constraint maps (taxiway geometries, stand configurations)
- Real-time schedule perturbation and response dynamics

---

## 12. Lessons for Autonomous GSE Operations

### How Turnaround Orchestration Data Improves Autonomous Vehicle Operations

Moonware's software-first strategy creates several direct benefits for autonomous GSE development:

**1. Operational Data as Training Corpus**

HALO collects continuous GPS traces of every GSE vehicle and crew member across the ramp. This data — movement patterns, speed profiles, interaction sequences, dwell times, near-misses — forms a rich training corpus for autonomous driving models in the airside environment. Human-driven GSE traces provide the behavioral baselines and edge cases that autonomous systems must replicate.

**2. Digital Twin of the Ramp**

HALO's real-time position tracking of all assets effectively creates a digital twin of ramp operations. For autonomous vehicles, this provides:
- Complete awareness of all dynamic obstacles (other vehicles, crew, aircraft)
- Predicted trajectories of human-driven vehicles (based on their assigned tasks)
- Occupancy maps of stands, taxilanes, and service areas
- Real-time no-go zones (active aircraft pushback paths, fueling operations)

**3. Dispatch and Routing as Autonomy Infrastructure**

HALO's dispatch optimizer already generates the routing decisions that autonomous vehicles would need:
- Which vehicle goes to which aircraft
- When to dispatch based on arrival/departure timing
- Optimal paths considering current ramp traffic
- Dynamic re-routing when schedules change

When ATLAS (or any autonomous GSE) deploys, HALO provides the C2 layer — the autonomous vehicle just needs to execute the trajectory that HALO already computes.

**4. Turnaround Sequence Understanding**

Autonomous GSE must understand turnaround sequencing to avoid conflicts:
- A pushback tug cannot approach until all other service vehicles have cleared
- A fuel truck must finish before the baggage cart can access certain positions
- Catering vehicles have specific timing windows relative to boarding

HALO's task orchestration engine already models these dependencies. This sequencing logic transfers directly to autonomous GSE coordination.

**5. Safety Case Data**

The safety case for autonomous GSE on airport ramps requires extensive data on:
- Vehicle-to-vehicle proximity distributions
- Near-miss frequency and causes
- Operational tempo variations (peak vs. off-peak)
- Environmental conditions affecting operations

HALO's tracking data provides this baseline, enabling quantitative safety arguments for autonomous operations.

**6. Human-Autonomy Transition**

The HALO platform provides a natural pathway for mixed human-autonomous operations:
- Start with HALO dispatching human-operated vehicles
- Introduce autonomous vehicles one-at-a-time, still dispatched by HALO
- Gradually increase autonomous fleet percentage
- HALO handles the coordination between human and autonomous assets seamlessly
- Human operators can take over individual vehicles through the same interface

### Implications for Our World Models Research

Moonware's approach validates several hypotheses relevant to airside autonomous vehicle development:

1. **Software-first is viable**: Deploying orchestration software before autonomous hardware generates the operational data and institutional trust needed for autonomy adoption

2. **GPS-based tracking is sufficient for dispatch**: High-precision positioning is not required for fleet management and dispatch optimization — consumer-grade GPS trackers and smartphones provide adequate data

3. **Camera-free is possible but limiting**: While Moonware avoids cameras for cost/speed reasons, autonomous GSE will ultimately need perception systems. The question is whether the orchestration layer (HALO-like) and the perception layer (Assaia-like) converge into one system or remain separate

4. **Ground handler buy-in is the bottleneck**: Moonware's success depends on ground handlers adopting the platform. The same adoption challenge applies to autonomous GSE — the handler must trust the system enough to change their operational workflows

5. **Military as proving ground**: Moonware's NOVA strategy (deploying autonomy in military environments first, where control is tighter and regulations more permissive for new tech) mirrors the approach that could work for autonomous GSE — prove the concept in controlled environments before commercial airports

---

## Key Unknowns and Research Gaps

1. **No published turnaround prediction accuracy metrics** — Unlike Assaia, Moonware has not published specific prediction accuracy for turnaround completion or pushback timing
2. **20% delay reduction is unverified** — No independent validation, no published sample size, no statistical methodology disclosed
3. **ATLAS development timeline is unclear** — Original 2023 target was missed; no updated public timeline
4. **Integration depth is unknown** — Whether HALO connects to A-CDM, AODB, or airline OCC systems is not documented
5. **Defense contract details are not public** — NOVA's military customer base and contract status are undisclosed
6. **Pricing not disclosed** — No public information on per-turnaround, per-station, or subscription pricing
7. **Scale of deployment is modest** — 4 named airports vs. Assaia's 15+ and growing
8. **No ADS-B integration mentioned** — Surprising given the value of independent aircraft tracking data for turnaround management

---

## Company Timeline

| Date | Event |
|---|---|
| 2019 | Collaboration with Uber Elevate on autonomous pushback vehicles for eVTOL |
| 2020 | Moonware founded by Javier Vidal; launched as independent company |
| 2020 | ATLAS autonomous tug prototype development begins |
| ~2022 | Pre-seed round: $2.5M led by Third Prime |
| Feb 2023 | Skyway partnership for AAM/vertiport ground operations |
| Aug 2023 | TechCrunch coverage of HALO platform |
| ~2023 | HALO deployed at LAX with Aerocharter |
| ~2023 | HALO deployed at JFK with British Airways / dnata |
| Mar 2024 | Seed round: $7M co-led by Third Prime and Zero Infinity Partners |
| Dec 2024 | HALO on Apple Vision Pro announced |
| 2025 | PrimeFlight deployment at Mexico City (NLU) |
| 2025 | Won GHI 2025 Digital Innovation Award at 26th Annual GHI Conference (Amsterdam) |
| Jul 2025 | Tokyo Haneda trial announced with JAL and JGS |
| Nov 2025 | 2025 year-in-review published |

---

## Sources

- [Moonware HALO Product Page](https://moonware.com/products/halo)
- [Moonware NOVA Product Page](https://moonware.com/products/nova)
- [Moonware ATLAS Page](https://moonware.com/atlas/)
- [Moonware and IAG Partnership at JFK](https://moonware.com/blog/moonware-iag-partnership-jfk)
- [Moonware $7M Seed Round](https://moonware.com/blog/7-million-seed-round)
- [Moonware LAX Aerocharter Launch](https://moonware.com/blog/moonware-launch-lax-aerocharter)
- [Moonware PrimeFlight Mexico City Partnership](https://moonware.com/blog/moonware-and-primeflight-partner)
- [Moonware JAL/JGS Tokyo Haneda Trial](https://moonware.com/blog/moonware-to-test-ground-traffic-control-technology-with-japan-airlines-and-jal-ground-service)
- [Moonware Tokyo Haneda Press Release (PRNewswire)](https://www.prnewswire.com/news-releases/moonware-to-test-ground-traffic-control-technology-with-japan-airlines-and-jal-ground-service-at-tokyo-international-airport-302499553.html)
- [Moonware HALO and NOVA Blog Post](https://moonware.com/blog/optimizing-commercial-and-military-airfield-operations)
- [Moonware No Cameras Blog Post](https://moonware.com/blog/no-cameras-no-problem-beyond-the-airport-gate)
- [Moonware Bridge to Airfield Autonomy (Master Plan)](https://moonware.com/blog/the-bridge-to-airfield-autonomy-moonware-master-plan)
- [Moonware Apple Vision Pro Announcement](https://moonware.com/blog/moonware-unveils-halo-on-apple-vision-pro)
- [Moonware 2025 GHI Digital Innovation Award](https://moonware.com/blog/moonware-wins-this-year-s-ground-handling-digital-innovation-award-at-the-26th-annual-ghi-conference)
- [Moonware TechCrunch Coverage (Aug 2023)](https://techcrunch.com/2023/08/03/moonwares-ai-lets-airfield-ground-crews-ditch-the-walkies/)
- [Moonware AIN Funding Coverage](https://www.ainonline.com/aviation-news/futureflight/2024-04-02/moonware-gets-funding-ai-based-ground-handling-software)
- [Moonware Revolution.aero Seed Round](https://www.revolution.aero/news/2024/03/25/moonware-closes-7m-seed-round/)
- [AviTrader Moonware Haneda Trial](https://avitrader.com/2025/07/09/moonware-to-trial-halo-platform-at-tokyo-haneda-airport/)
- [FTE Moonware JAL Tokyo](https://www.futuretravelexperience.com/2025/07/moonware-to-test-ground-traffic-control-technology-with-japan-airlines-at-tokyo-international-airport/)
- [GHI JAL Moonware HALO Trial](https://www.groundhandlinginternational.com/content/news/japan-airlines-trials-moonware-halo-at-tokyo-haneda-airport)
- [Airport Technology Moonware AI System](https://www.airport-technology.com/news/moonware-ai-ground-traffic-system/)
- [Moonware Uber Elevate History (Vertical Mag)](https://verticalmag.com/news/moonware-autonomous-ground-handling-services-uber-elevates-skyports-commercial-aviation/)
- [Moonware eVTOL Insights Launch](https://evtolinsights.com/2020/11/moonware-launches-its-autonomous-ground-handling-service-with-plans-for-the-urban-air-mobility-market/)
- [Skyway Moonware Partnership](https://www.globenewswire.com/news-release/2023/02/02/2600632/0/en/Skyway-and-Moonware-Partner-in-Advanced-Air-Mobility.html)
- [Assaia ApronAI](https://www.assaia.com/solutions/apron-ai)
- [Assaia TurnaroundControl](https://www.assaia.com/solutions/turnaroundcontrol)
- [Assaia Series B Funding ($26.6M)](https://www.assaia.com/resources/assaia-raises-26-6-million-in-series-b-funding-to-enhance-global-ai-leadership-in-airport-operations)
- [Assaia 2025 Turnaround Report](https://www.assaia.com/turnaround-report-2025)
- [Assaia Munich Airport Deployment](https://www.assaia.com/resources/assaias-apronai-to-be-rolled-out-at-munich-airport)
- [Assaia Calgary Airport Deployment](https://www.assaia.com/resources/assaia-partners-with-calgary-international-airport-to-deploy-apronai-across-67-gates-driving-on-time-performance-and-efficiency)
- [ePlane AI Turnaround Delays Report](https://www.eplaneai.com/news/ai-driven-aircraft-turnarounds-reduce-airport-delays-by-25)
- [Aviation Business ME — $100/Min Delay Cost](https://www.aviationbusinessme.com/airlines/100-a-minute-the-cost-of-delay-and-the-case-for-ai)
