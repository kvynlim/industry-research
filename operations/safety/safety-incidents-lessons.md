# AV Safety Incidents, Near-Misses, and Lessons Learned from Production Deployments

> Comprehensive analysis of autonomous vehicle safety incidents across public road and airside deployments, with extractable lessons for world-model-based airside AV systems.

---

## Table of Contents

1. [Cruise Shutdown](#1-cruise-shutdown-october-2023--december-2024)
2. [Waymo Incidents](#2-waymo-incidents-and-safety-record)
3. [Tesla FSD Incidents](#3-tesla-fsd-incidents-and-nhtsa-investigations)
4. [Uber ATG Fatal Crash](#4-uber-atg-fatal-crash-march-2018)
5. [Airside-Specific Incidents](#5-airside-specific-incidents)
6. [Common Failure Patterns](#6-common-failure-patterns-in-production-av-deployments)
7. [Safety Metrics That Matter](#7-safety-metrics-that-matter)
8. [Regulatory Response to Incidents](#8-regulatory-response-to-incidents)
9. [Recovery Procedures](#9-post-incident-recovery-procedures)
10. [Lessons for World-Model-Based Systems](#10-lessons-for-world-model-based-systems)
11. [Building a Safety Culture](#11-building-a-safety-culture)

---

## 1. Cruise Shutdown (October 2023 -- December 2024)

### 1.1 The Pedestrian Dragging Incident

On October 2, 2023, a human-driven Nissan struck a pedestrian crossing a San Francisco street at night, propelling her into the path of a Cruise autonomous Chevrolet Bolt traveling at approximately 19 mph. The Cruise AV detected the other vehicle's collision and began braking, but still struck the pedestrian at reduced speed. After a brief stop, the AV then executed its programmed "minimal risk condition" (MRC) pullover maneuver, dragging the pedestrian approximately 20 feet at up to 7.7 mph before stopping.

### 1.2 Root Cause Analysis: What the ML System Got Wrong

The Quinn Emanuel external investigation report and subsequent technical analyses identified multiple cascading failures:

**Collision Detection Misclassification.** The collision detection subsystem incorrectly classified the impact as a side collision rather than a frontal collision. This misclassification triggered a less severe response protocol -- the pullover maneuver -- rather than an immediate full stop.

**Pedestrian Track Loss.** The pedestrian's body, except her legs, fell outside the field of view of the lidar sensors after she was pinned under the vehicle. The perception system briefly detected the pedestrian's legs but failed to classify or track the woman as a person under the vehicle.

**Location Error.** The AV suffered from a localization error, failing to recognize that it was already in the lane adjacent to the curb. This caused it to attempt an unnecessary lateral pullover movement.

**Missing Safety Interlocks.** The system lacked logic to prevent forward movement after a detected collision when an object might be trapped beneath the vehicle. The AV could travel up to 100 feet during its pullover without re-checking for obstructions beneath the chassis.

**No Under-Vehicle Sensing.** The sensor suite had no capability to detect objects trapped under the vehicle -- a scenario that had apparently not been considered in the system's design.

### 1.3 Organizational and Cultural Failures

The Quinn Emanuel report identified failures beyond the technical:

- **Poor leadership and lack of coordination.** Different teams independently prepared for regulator meetings without senior oversight or information consolidation.
- **"Us versus them" mentality with regulators.** Cruise leadership focused on correcting the media narrative (that the Cruise AV, not the Nissan, caused the initial collision) rather than transparent disclosure.
- **Withholding information.** When Cruise showed regulators video of the incident on October 3, the footage stopped shortly after the initial impact and did not show the dragging. The full video was not provided to the DMV until October 13.
- **No incident command structure.** The organization lacked the kind of formalized incident response protocols common in safety-critical industries like aviation.

### 1.4 Regulatory and Business Consequences

| Date | Event |
|------|-------|
| Oct 2, 2023 | Pedestrian dragging incident |
| Oct 3, 2023 | DMV meets with Cruise; Cruise shows truncated video |
| Oct 13, 2023 | DMV receives full video showing dragging |
| Oct 24, 2023 | California DMV suspends all Cruise permits, effective immediately |
| Oct 24, 2023 | California PUC pulls commercial robotaxi permit |
| Oct 26, 2023 | Cruise voluntarily pauses all driverless operations nationwide |
| Nov 8, 2023 | Cruise recalls entire fleet of 950 vehicles |
| Jan 25, 2024 | Quinn Emanuel report released; DOJ and SEC investigations revealed |
| Sep 30, 2024 | NHTSA fines Cruise $1.5 million for withholding crash details in SGO reports |
| Dec 10, 2024 | GM announces end of Cruise robotaxi program; $10B+ in cumulative losses |
| Feb 2025 | Cruise lays off ~50% of workforce; CEO and executives depart |

### 1.5 Key Lessons

1. **Post-collision behavior is safety-critical.** The AV's pre-collision behavior was arguably reasonable (it braked and reduced speed). The catastrophic failure was in post-collision decision-making -- an area that received insufficient design attention.
2. **Edge cases in MRC design.** The minimal risk condition pullover, designed for safety, became the source of the worst harm. MRC maneuvers must account for the possibility of objects trapped beneath the vehicle.
3. **Transparency with regulators is non-negotiable.** Cruise's withholding of the full video destroyed trust and accelerated the regulatory response far beyond what the technical failure alone might have warranted.
4. **Tech company culture is inadequate for safety-critical operations.** The absence of formalized incident command, independent safety oversight, and regulatory transparency protocols is a structural deficiency, not a one-time lapse.

---

## 2. Waymo Incidents and Safety Record

### 2.1 Safety Performance Data (Through December 2025)

Waymo has published peer-reviewed safety data across 170.7 million rider-only miles in four cities (Phoenix, SF Bay Area, Los Angeles, Austin), validated against human benchmarks:

| Metric | Waymo Rate (per M miles) | Human Benchmark | Reduction |
|--------|--------------------------|-----------------|-----------|
| Serious injury or worse crashes | 0.02 | 0.22 | 92% fewer |
| Any-injury reported crashes | 0.71 | 3.90 | 82% fewer |
| Airbag deployments | 0.28 | 1.63 | 83% fewer |
| Pedestrian injury crashes | -- | -- | 92% fewer |
| Cyclist injury crashes | -- | -- | 85% fewer |
| Motorcyclist injury crashes | -- | -- | 81% fewer |

43% of Waymo collisions involved velocity changes below 1 mph, typically resulting only in minor property damage. Swiss Re insurance analysis confirmed 92% fewer bodily injury claims and 88% fewer property damage claims over 25 million miles compared to human drivers.

### 2.2 Notable Incident Categories and Recalls

**Collisions with Thin/Suspended Barriers (2022-2025).**
NHTSA identified 16 reports of collisions with "stationary and semi-stationary objects such as gates and chains" between December 2022 and 2024. These are thin, often low-contrast objects that challenged the perception system. Waymo deployed a software fix in November 2024 and issued a formal recall of 1,212 vehicles in May 2025. This incident type reveals a perception gap: objects that are geometrically unusual (thin chains, retractable bollards) may not match learned object categories well.

**School Bus Violations (2025).**
Waymo recalled 3,067 vehicles in December 2025 after multiple instances of robotaxis driving around stopped school buses in Austin and Atlanta. The Austin Independent School District recorded 19 incidents during the 2025-2026 school year. NHTSA opened an investigation in October 2025. This failure type involves rule-based reasoning (school bus stop laws) rather than pure perception -- the AV could see the bus but failed to apply the correct behavioral rule.

**Fatalities.** Two fatalities have been reported in collisions involving Waymo vehicles through November 2025, though Waymo has emphasized that its vehicles were not at fault in these incidents.

### 2.3 Waymo's Safety Framework

Waymo employs a three-component safety architecture:

1. **The Driver** -- The onboard AV system making real-time driving decisions, built on a foundation model with a "Think Fast / Think Slow" dual architecture (Sensor Fusion Encoder for rapid reaction + Driving VLM for complex semantic reasoning).
2. **The Simulator** -- Billions of miles of virtual testing including the Waymo World Model (February 2026), built on Google DeepMind's Genie 3, capable of generating rare edge-case scenarios across multiple sensor modalities.
3. **The Critic** -- An evaluation system that identifies suboptimal Driver behaviors and generates improved alternatives.

Waymo publishes twelve deployment readiness criteria spanning system performance, robustness, risk mitigation, and post-deployment monitoring, governed by a Safety Framework Steering Committee and Safety Board.

### 2.4 Lessons for Airside

- **Thin/unusual objects are a persistent perception challenge.** Airport aprons contain chains, ropes, FOD, retractable bollards, ground markings, and other geometrically unusual objects. Waymo's gate/chain collision pattern is directly relevant.
- **Rule compliance failures can occur even with good perception.** The school bus incidents show that seeing an object is not sufficient -- the system must also correctly apply context-specific rules.
- **Transparency and data publication build trust.** Waymo's public safety data hub and peer-reviewed publications have helped maintain public and regulatory confidence despite incidents.

---

## 3. Tesla FSD Incidents and NHTSA Investigations

### 3.1 Current Investigation Status (as of March 2026)

NHTSA has escalated its investigation of Tesla's Full Self-Driving (Supervised) system to an Engineering Analysis -- one step short of a mandated recall -- covering an estimated 3.2 million vehicles. Three concurrent probes are active:

1. **Low-visibility/reduced visibility crashes** (PE25012) -- Nine total incidents including one fatality and one injury, involving sun glare, fog, dust, and other conditions that degrade camera performance.
2. **Traffic safety violations** -- 58 incidents involving running red lights, crossing into opposing lanes, and other traffic law violations with FSD engaged.
3. **Crash reporting gaps** -- Delays and omissions in required SGO reports.

### 3.2 The Vision-Only Problem

Tesla's decision to remove radar and rely solely on cameras ("Tesla Vision") creates fundamental vulnerability to conditions that degrade optical sensors:

- **Sun glare:** Cameras can be completely blinded by direct sunlight, with no redundant sensing modality to fall back on.
- **Fog and dust:** Reduced contrast and visibility degrade object detection performance.
- **Dawn/dusk transitions:** Research shows AVs are more than five times more vulnerable to collisions at dawn and dusk compared to other times.
- **Nighttime:** 75% of fatal pedestrian crashes occur at night, where camera-based systems are inherently disadvantaged.

NHTSA found that FSD's degradation detection system fails to warn drivers when cameras are blinded by common road conditions. When cameras did lose visibility, the system either issued no warning at all or alerted drivers only moments before a crash.

### 3.3 Phantom Braking

Tesla owners have extensively reported "phantom braking" -- sudden, unexpected braking with no visible obstacle. Contributing factors include:

- Overhead highway signs misinterpreted as obstacles
- Bridge shadows on road surface
- Sun glare creating false positive detections
- Oncoming vehicle headlights at night

This failure mode is particularly dangerous because it creates unpredictable behavior for following vehicles.

### 3.4 Reporting Failures

A fatal crash involving FSD and reduced visibility occurred on November 28, 2023. Tesla submitted the required SGO report on June 27, 2024 -- seven months later. The very next day, Tesla began developing a degradation detection update, raising questions about whether the crash data motivated the fix. Tesla's own analysis concedes that its updated detection system "may have affected" only 3 of the 9 identified crashes.

### 3.5 Lessons for Airside

- **Sensor redundancy is essential.** Camera-only systems have inherent failure modes that cannot be addressed through software alone. Airside operations involve jet blast heat shimmer, low-sun-angle glare off wet aprons, and dust/debris -- all camera-degrading conditions. LiDAR + radar + camera fusion is the minimum viable sensor suite.
- **Degradation detection must be proactive.** Systems must detect when their own sensing capabilities are compromised and act conservatively before a failure occurs, not after.
- **Phantom braking analogues exist airside.** False positive obstacle detections could cause an autonomous tug to halt in an active taxiway or jet blast zone -- potentially more dangerous than the obstacle it was trying to avoid.

---

## 4. Uber ATG Fatal Crash (March 2018)

### 4.1 The Incident

On March 18, 2018, a modified Volvo XC90 SUV operated by Uber's Advanced Technologies Group struck and killed Elaine Herzberg as she walked a bicycle across a four-lane road in Tempe, Arizona. This was the first recorded pedestrian fatality involving an autonomous vehicle. The vehicle was traveling at approximately 39 mph.

### 4.2 What the Perception System Missed

The NTSB investigation revealed a cascade of perception failures over 5.6 seconds:

**Classification Cycling.** The system detected Herzberg 5.6 seconds before impact but cycled between classifying her as a "vehicle," "bicycle," and "unknown object" with each detection cycle. Each reclassification reset the tracking, treating her as a new stationary object rather than maintaining a continuous track of a moving entity.

**Path Prediction Failure.** When classified as a vehicle or bicycle, the system assumed she would travel in the same direction as the Uber vehicle (parallel to the road). When classified as unknown, it assumed she was stationary. At no point did the system predict her actual trajectory -- crossing the road perpendicular to traffic.

**No Jaywalking Model.** The system did not have the capability to classify an object as a pedestrian unless that object was near a crosswalk. This architectural decision eliminated the possibility of correctly classifying the most dangerous pedestrian scenario -- mid-block crossing.

### 4.3 The Action Suppression Catastrophe

At 1.3 seconds before impact, the ADS determined that emergency braking was needed. However:

1. **Automatic emergency braking was disabled.** The vehicle's factory-installed Volvo forward collision warning and AEB systems were deactivated to prevent conflicts with the developmental ADS.
2. **Action suppression engaged.** Uber engineers had implemented a one-second "action suppression" delay to prevent false-alarm emergency braking. This suppressed the planned braking response for the critical final second before impact.
3. **No ADS-initiated emergency braking.** Emergency braking maneuvers were not enabled while the vehicle was under computer control. The system could only alert the safety driver to take over.

The safety driver, who was streaming a television show on her phone, was given approximately one second of warning. The vehicle struck Herzberg at near-full speed with no braking applied.

### 4.4 Safety Culture Deficiencies

The NTSB's finding of "inadequate safety culture" encompassed:

- **No safety division or safety manager.** Uber ATG had no standalone operational safety organization.
- **No safety plan.** There was no formal safety plan, standardized operating procedure, or guiding safety document.
- **No operator oversight.** Phone usage by safety drivers was not monitored. Uber could not provide logs showing if or when phone checks were performed. No drug testing was conducted.
- **No hazard assessment.** Uber ATG did not adequately assess the safety risk of its ADS's functional limitations.
- **Reduction from two safety drivers to one.** Shortly before the crash, Uber reduced the number of safety drivers per vehicle from two to one, increasing the burden on the remaining operator.

### 4.5 Lessons That Still Apply

These lessons from 2018 remain as relevant as ever:

1. **Action suppression is inherently dangerous.** Any system that delays or suppresses emergency braking to avoid false alarms trades certain catastrophic failure for uncertain nuisance reduction. The risk calculus must always favor false positives over missed detections.
2. **Classification instability is a perception system design flaw.** Systems must maintain object tracks even when classification is uncertain. An object that cycles between "vehicle" and "bicycle" is clearly *something* and should be treated as a potential hazard regardless of its label.
3. **Automation complacency is predictable, not exceptional.** The safety driver's distraction was entirely foreseeable. Any safety architecture that depends on sustained human vigilance as the last line of defense will eventually fail.
4. **Safety culture cannot be bolted on.** Uber ATG's fundamental posture was "move fast" technology development, not safety-critical operations. This organizational DNA proved incompatible with operating lethal vehicles on public roads.
5. **Disabling OEM safety systems is unconscionable.** The Volvo's factory AEB could have prevented or mitigated the crash. Replacing a proven safety system with a developmental system and no backup is indefensible.

---

## 5. Airside-Specific Incidents

### 5.1 Ground Damage: The Scale of the Problem

Airport ramp operations represent one of aviation's most persistent safety challenges:

- **61% of aircraft ground damage incidents** are caused by ground support equipment (IATA Ground Damage Database).
- **$10 billion annually** is the projected global cost of ground damage by 2035 (IATA estimate).
- Airlines currently lose more than EUR 2.5 billion per year to ramp damage.
- **90%+ of incidents** trace to lack of or failure to follow appropriate procedures (IATA).
- Common GSE incident types: collisions with aircraft fuselage, wing tips, and engines; jet bridge strikes; baggage cart collisions; fuel spill events.

In a 22-year FAA study (1983-2004), 80 ramp accidents resulted in 21 fatalities. Leading causes: contact with spinning propellers (10 deaths), vehicle-aircraft collisions (6 deaths), heavy equipment accidents (3 deaths).

### 5.2 Autonomous GSE Deployments and Safety Events

**TractEasy / EZTow (EasyMile + TLD Joint Venture).**
The first autonomous electric baggage tractor, operating at SAE Level 4 with a top speed of 25 km/h. Deployed at airports including Singapore Changi, Narita (Japan), and Greenville-Spartanburg (USA) since 2018.

Key safety event: After TractEasy initiated operations in the U.S., the FAA issued a letter requesting operations be paused because the agency had not been consulted and "did not know what was going on." This prompted the development of CertAlert 24-02 and subsequent AGVS guidance. No public reports of injury incidents involving TractEasy have been identified, but the FAA pause highlights the regulatory gap.

Safety features include anti-collision software, a separate safety chain system, and the requirement that the tug will not move until all cargo is properly secured and locked.

**Aurrigo.**
Secured a ground handling licence at East Midlands Airport (UK) to support autonomous vehicle rollout. Aurrigo's approach includes a digital twin of airside operations for pre-deployment simulation. Their Transport Safety System is designed to prevent movement until all equipment is properly configured. No public incident reports identified.

**General Observations.**
- No publicly reported injury incidents involving autonomous GSE have been identified as of March 2026.
- Deployments remain limited in scale and are typically conducted in controlled, low-traffic areas of the apron.
- The absence of reported incidents may reflect both genuinely safer operations and the early, limited scale of deployments.

### 5.3 FAA Regulatory Posture for Airside AGVS

The FAA's current position (as of May 2025):

- **Supports testing** of AGVS in "controlled environments" including non-movement areas (aprons, gate areas, parking areas, remote/landside areas).
- **Does not currently support** AGVS in active movement areas, safety areas, and object-free areas.
- Requires a human operator capable of "instantaneous control" of the AGVS if the automated system fails.
- Part 139 airports must coordinate with FAA Airport Certification and Safety Inspectors early in planning.
- No formal incident reporting requirements specific to AGVS have been published beyond the general mandate to mitigate risks.

Key guidance documents:
- CertAlert 24-02: Autonomous Ground Vehicle Systems Technology on Airports (February 2024)
- Emerging Entrants Bulletin 25-02: Testing and Demonstrating AGVS at Federally Obligated Airports (May 2025)

### 5.4 EASA Position

EASA is not developing its own regulatory framework for autonomous GSE. Instead, EASA's head of aerodrome safety advocates for international standardization through ICAO, arguing that fragmented regional regulation would undermine industry investment and operational consistency for airlines and ground handlers operating globally. No EASA-specific safety standards for autonomous airside vehicles exist as of March 2026.

### 5.5 Lessons for Airside AV Deployment

1. **The ramp is already dangerous.** Autonomous GSE enters an environment where human-operated GSE already causes billions in damage and dozens of injuries annually. The bar for "safer than human" may be lower than on public roads, but the consequences of an aircraft strike are disproportionately severe.
2. **Regulatory frameworks lag deployment.** The FAA's CertAlert came after TractEasy was already operating. Proactive regulatory engagement is essential.
3. **Unique airside hazards.** Jet blast, prop wash, FOD ingestion, fuel spills, confined spaces between parked aircraft, unmarked push-back zones, rapidly changing gate assignments, and the presence of high-value assets (aircraft) create an operational design domain unlike any public road environment.
4. **No standardized incident reporting for autonomous GSE.** This gap means that near-misses and minor incidents may go unreported and unanalyzed -- exactly the condition that aviation safety science identifies as a precursor to major accidents.

---

## 6. Common Failure Patterns in Production AV Deployments

### 6.1 Taxonomy of Failure Modes

Drawing from Cruise, Waymo, Tesla, Uber, and Zoox incidents, the following failure pattern taxonomy emerges:

#### Perception Failures
| Pattern | Examples | Frequency |
|---------|----------|-----------|
| **Object classification instability** | Uber ATG cycling between vehicle/bicycle/unknown | Common |
| **Thin/unusual object detection** | Waymo gate/chain collisions; Tesla failing on construction cones | Common |
| **Sensor degradation without detection** | Tesla FSD in fog/glare with no warning | Moderate |
| **Under-represented scenario** | Uber's no-crosswalk pedestrian model; Cruise's under-vehicle occlusion | Rare but catastrophic |
| **Dawn/dusk vulnerability** | 5x higher AV collision rate at dawn/dusk | Systematic |

#### Decision/Planning Failures
| Pattern | Examples | Frequency |
|---------|----------|-----------|
| **Incorrect post-collision behavior** | Cruise pullover dragging pedestrian | Rare but catastrophic |
| **Rule compliance failures** | Waymo school bus violations; Tesla red light running | Moderate |
| **Over-cautious braking** | Zoox rear-end collisions from unnecessary hard braking | Common |
| **Action suppression** | Uber ATG delaying emergency braking | Rare but catastrophic |
| **ODD boundary violations** | Cruise vehicles entering downed power line area | Moderate |

#### System Integration Failures
| Pattern | Examples | Frequency |
|---------|----------|-----------|
| **Disabling OEM safety systems** | Uber ATG turning off Volvo AEB | Design-level failure |
| **Missing safety interlocks** | Cruise allowing movement after collision | Design-level failure |
| **Sensor suite gaps** | Tesla vision-only; Cruise no under-vehicle sensing | Architectural |

### 6.2 The Pattern of Patterns

Across all major incidents, a consistent meta-pattern emerges:

1. **The system detected something** -- perception was not completely blind.
2. **But it could not correctly interpret what it detected** -- classification, tracking, or path prediction failed.
3. **And when uncertain, it chose the wrong default behavior** -- pullover instead of stop, suppress braking instead of brake, assume stationary instead of assume moving.
4. **No independent safety layer caught the error** -- single-threaded decision-making without redundant safety checks.

This is the autonomous driving analog of the Swiss cheese model: multiple defensive layers each had holes, and the holes aligned.

---

## 7. Safety Metrics That Matter

### 7.1 Misleading Metrics

**Disengagement Rate (Miles per Disengagement).**
The California DMV's annual disengagement reports have become an industry benchmark, but they provide little meaningful safety signal:
- Definitions of "disengagement" vary wildly between companies.
- Disengagement rates are confounded by testing conditions (suburban vs. urban, dry vs. wet).
- Manual takeover frequency ranges from 2 x 10^-4 to 3 disengagements per mile across manufacturers.
- A company testing in easy conditions can appear "safer" than one testing in challenging conditions.
- Many miles driven are "dumb miles" that add nothing new to validation.

**Total Miles Driven.**
The RAND Corporation demonstrated that proving autonomous vehicle safety with 95% confidence requires 8.8 billion miles of driving -- an impossible proposition for any single fleet. Miles alone cannot validate safety; they must be the right miles in the right conditions.

**Zero-Incident Streaks.**
The absence of incidents over a period proves very little statistically. Fatal events are rare enough (~1.09 per 100 million miles for humans) that even a genuinely unsafe system could accumulate millions of incident-free miles by chance.

### 7.2 Metrics That Predict Real-World Safety

**Crash Rate Comparisons Against Human Benchmarks.**
Waymo's approach -- comparing crash rates per million miles against human drivers in the same geographies -- is the current gold standard. Key sub-metrics:
- Serious injury or worse crashes per million miles
- Any-injury crashes per million miles
- Vulnerable road user (pedestrian, cyclist, motorcyclist) crash rates
- Delta-V distribution of crashes (severity measurement)

**Near-Miss and Surrogate Safety Measures.**
Because crashes are rare, near-miss events provide higher-frequency signal:
- Time-to-collision (TTC) distributions
- Post-encroachment time (PET)
- Hard braking events per mile
- Evasive maneuver frequency

**ODD Violation Detection Rate.**
What fraction of operational design domain violations are detected by the vehicle itself? If the system operates outside its competence without knowing it, safety margins are illusory.

**Safety Performance Indicators (SPIs) vs. KPIs.**
Phil Koopman (CMU) distinguishes between KPIs (percent correctly identified pedestrians, miles between disengagements) and Safety Performance Indicators:
- KPIs quantify performance but are insufficient for safety.
- SPIs must capture system-level safety properties, including behavior in the presence of uncertainty and failure.
- Examples: fraction of scenarios where the system correctly identifies its own uncertainty; time to safe stop from any operating state; degraded-mode coverage.

**Scenario Coverage Metrics.**
Rather than total miles, measure the diversity and completeness of scenarios tested:
- Percentage of known critical scenarios covered in simulation and real-world testing
- Edge case discovery rate over time (should increase with better testing, not decrease)
- Coverage of ODD boundary conditions

### 7.3 Airside-Specific Metrics

For autonomous airside operations, relevant safety metrics include:

| Metric | Why It Matters |
|--------|---------------|
| Aircraft proximity events per 1000 operations | Direct measure of the highest-consequence risk |
| FOD detection rate / false positive rate | Balances safety against operational disruption |
| Time to full stop from max speed | Determines minimum safe following/clearance distances |
| Sensor degradation detection latency | How quickly the system recognizes its own impairment |
| Mean time between unplanned stops | Operational reliability; excessive stops block other ops |
| Human override events per 1000 operations | Indicates system confidence and competence boundaries |
| Gate assignment change adaptation time | Measures responsiveness to dynamic apron environment |
| Near-miss with aircraft / personnel / other GSE | Leading indicator before actual contact events |

---

## 8. Regulatory Response to Incidents

### 8.1 NHTSA's Investigation and Enforcement Framework

NHTSA follows a structured escalation process:

1. **Standing General Order (SGO) Reports.** Companies must report crashes involving ADS or Level 2 ADAS to NHTSA. As of the Third Amended SGO (June 2025):
   - Fatality reports due within 5 calendar days (extended from 1 day)
   - Must include pre-crash, crash, and post-crash details
   - Reports required for fatalities, hospital-treated injuries, vulnerable road user involvement, airbag deployment, or vehicle tow-away
   - Failure to report accurately can result in civil penalties (e.g., Cruise's $1.5M fine)

2. **Preliminary Evaluation (PE).** NHTSA's Office of Defects Investigation reviews SGO data and opens formal inquiries when patterns emerge (e.g., Waymo barrier collisions, Tesla low-visibility crashes).

3. **Engineering Analysis (EA).** Escalation from PE when evidence of a potential safety defect strengthens. This is the step immediately preceding a mandated recall (Tesla FSD is currently at this stage).

4. **Recall.** Voluntary (company-initiated) or mandated. For ADS, recalls typically involve OTA software updates rather than physical modifications.

### 8.2 California DMV Actions

The California DMV maintains separate authority over autonomous vehicle testing and deployment permits:
- Can suspend permits "effective immediately" upon finding of unreasonable safety risk
- Requires disclosure of all material information about safety incidents
- The Cruise suspension demonstrated that withholding information can trigger faster and more severe regulatory action than the underlying incident itself

### 8.3 FAA Approach to Airside AGVS

The FAA's approach is notably less developed:
- No formal certification process for autonomous GSE exists
- CertAlert 24-02 provides awareness and guidance, not binding regulation
- Testing is permitted only in controlled environments with human override capability
- No AGVS-specific incident reporting requirements
- The FAA has demonstrated willingness to issue pause orders (as with TractEasy) when deployments proceed without coordination

### 8.4 EASA / ICAO

EASA defers to ICAO for international standardization of autonomous GSE regulation. No binding EASA standards exist. Industry stakeholders (airlines, ground handlers, airports) are actively requesting standardized frameworks. The current regulatory vacuum creates uncertainty for companies investing in autonomous airside technology.

### 8.5 What Triggers Investigation

Analysis of regulatory actions reveals consistent triggers:

| Trigger | Regulatory Response | Example |
|---------|-------------------|---------|
| Fatality | Immediate investigation + potential enforcement | Uber ATG, Tesla FSD |
| Pattern of similar incidents | Preliminary evaluation | Waymo barriers (16 reports), Zoox hard braking (2 rear-end crashes) |
| Withholding or delayed reporting | Civil penalty + enhanced oversight | Cruise ($1.5M fine), Tesla (delayed SGO report) |
| Public outcry / media attention | Accelerated regulatory action | Cruise (SF pedestrian incident), Waymo (school bus incidents) |
| Vulnerable road user involvement | Lower threshold for action | School children (Waymo buses), pedestrians (all major incidents) |
| Operating without regulatory coordination | Immediate pause order | TractEasy (FAA) |

---

## 9. Post-Incident Recovery Procedures

### 9.1 Industry Best Practice: The Fleet Pause

When a serious incident occurs, the emerging industry standard involves:

1. **Immediate fleet-wide pause** of autonomous operations (not just the involved vehicle).
2. **Incident investigation** including data preservation, root cause analysis, and timeline reconstruction.
3. **Software analysis** to determine if the failure mode could affect other vehicles in the fleet.
4. **OTA software update** to address identified defects.
5. **Regression testing** to verify the fix does not introduce new failure modes.
6. **Phased resumption** of operations, often starting in lower-risk environments.
7. **Enhanced monitoring** of fixed vehicles for a defined period.

### 9.2 Company-Specific Approaches

**Cruise (2023).** Paused all driverless operations nationwide within days of the incident. Issued a fleet-wide recall. Ultimately never resumed operations.

**Waymo.** Has not implemented full fleet pauses for its incidents but issues voluntary recalls with OTA software updates. Waymo's approach emphasizes continuous monitoring and rapid deployment of fixes rather than fleet-wide halts.

**Zoox.** Paused driverless operations in Las Vegas after an April 2025 collision, restricted routes above 40 mph, and issued multiple software recalls for specific behavior categories (hard braking, lane crossings).

**Tesla.** Does not pause FSD operations during investigations. Issues OTA software updates designated as recalls. This approach reflects Tesla's position that FSD is a driver-assistance system requiring continuous human supervision, not a fully autonomous system.

### 9.3 Recertification and Return to Service

For autonomous fleets, return to service requires:
- **Software verification:** Confirming the updated ADS correctly handles the failure scenario
- **Regression testing:** Ensuring the fix does not degrade performance in other scenarios
- **Simulation validation:** Running the specific incident scenario through simulation to verify correct behavior
- **Staged deployment:** Often resuming in lower-complexity areas before returning to full ODD
- **Regulatory notification:** Informing relevant regulators of the fix and resumption plan
- **Enhanced monitoring:** Increased telemetry and human oversight during the initial return period

### 9.4 Airside-Specific Recovery Considerations

Airport operations add unique constraints to post-incident recovery:

- **Aircraft safety takes absolute priority.** Any incident involving potential aircraft damage requires coordination with the airline, airport authority, and potentially the NTSB.
- **Apron cannot be fully shut down.** Unlike a robotaxi that can simply not drive, airport operations must continue. Recovery procedures must include human-driven fallback operations.
- **Turnaround time pressure.** Airports operate on tight schedules. Extended fleet pauses have cascading effects on flight operations.
- **Multi-stakeholder coordination.** Airlines, ground handlers, airport operators, ATC, and regulators all have legitimate interests in incident investigation and resumption decisions.
- **Evidence preservation on active aprons.** Incident scenes cannot be preserved as long as on public roads; apron areas must be cleared for ongoing operations.

---

## 10. Lessons for World-Model-Based Systems

### 10.1 How Each Major Incident Would Be Addressed Differently

**Cruise Pedestrian Dragging -- World Model Advantage.**
A world model would maintain a persistent representation of the scene, including predictions about where objects are even when occluded. After a collision, the world model would:
- Predict the likely position of the struck person based on pre-collision trajectory and collision physics
- Maintain the person's existence in the world model even without active sensor confirmation
- Simulate the consequences of the planned pullover maneuver, predicting that forward movement could drag an object trapped beneath the vehicle
- Default to "person still present" rather than "person not detected, therefore absent"

**Uber ATG Classification Cycling -- World Model Advantage.**
A world model maintains temporal continuity of objects. Instead of reclassifying an object each frame independently:
- The world model would maintain a single persistent entity with uncertainty over its class
- Path prediction would be based on observed motion (crossing the road), not on class-dependent assumptions
- The critical prediction -- "this object is on a collision course regardless of what it is" -- would emerge from trajectory modeling, not classification

**Tesla FSD Visibility Degradation -- World Model Advantage.**
A world model can reason about what *should* be visible but isn't:
- If the model predicts a vehicle ahead based on recent observations but camera input becomes degraded, the world model retains the prediction and flags the discrepancy
- The gap between predicted world state and observed world state becomes an explicit signal of sensor degradation
- This enables proactive slow-down before a crash, not reactive warning after one

**Waymo School Bus Violations -- World Model Advantage.**
A world model that incorporates semantic scene understanding would:
- Recognize the school bus stop scenario as a distinct context requiring specific behavioral rules
- Predict the likely appearance of children near a stopped school bus
- Maintain awareness of regulatory requirements as part of the world model's rule layer

### 10.2 World Model Architecture for Safety

Based on the failure patterns analyzed above, a safety-focused world model for airside operations should include:

```
+-------------------------------------------------------------------+
|                     WORLD MODEL ARCHITECTURE                       |
+-------------------------------------------------------------------+
|                                                                    |
|  [1] PERSISTENT OBJECT LAYER                                      |
|      - Maintain object tracks even without active detection        |
|      - Propagate position/velocity predictions through occlusion   |
|      - Never delete an object immediately; decay over time         |
|      - Flag "expected but not detected" objects                    |
|                                                                    |
|  [2] PHYSICS SIMULATION LAYER                                      |
|      - Predict consequences of planned actions before execution    |
|      - Model object interactions (collision, entanglement, drag)   |
|      - Simulate sensor field-of-view to predict blind spots        |
|                                                                    |
|  [3] SEMANTIC CONTEXT LAYER                                        |
|      - Airport-specific rules (restricted zones, push-back areas)  |
|      - Dynamic context (active runway, gate assignments, NOTAMS)   |
|      - Entity relationships (aircraft-GSE clearances, right-of-way)|
|                                                                    |
|  [4] UNCERTAINTY QUANTIFICATION LAYER                              |
|      - Explicit representation of what the system does/doesn't know|
|      - Sensor health monitoring through prediction-observation gap  |
|      - Confidence-weighted decision-making                         |
|      - Automatic conservative behavior when uncertainty is high    |
|                                                                    |
|  [5] COUNTERFACTUAL REASONING LAYER                                |
|      - "What if this object is a person?" safety checks            |
|      - Worst-case trajectory prediction for ambiguous objects      |
|      - Pre-mortem analysis of planned maneuvers                    |
|                                                                    |
+-------------------------------------------------------------------+
```

### 10.3 The Waymo World Model as Precedent

Waymo's World Model (February 2026), built on Google DeepMind's Genie 3, demonstrates the trajectory of the field:

- **Multi-modal generation:** Produces both camera and lidar outputs for the same scene, enabling cross-modal consistency checking.
- **Scenario control:** Driving action control, scene layout control, and language control enable targeted stress testing.
- **Edge case synthesis:** Can generate scenarios the fleet has never encountered (snow on unusual roads, floods, animals) through compositional generation.
- **Counterfactual testing:** "What if" scenario generation enables testing alternative responses to critical situations.
- **Efficient variants:** Reduced-compute models enable longer simulation horizons for extended scenarios.

For airside applications, a similar approach would generate:
- Simulated jet blast scenarios with varying wind conditions
- FOD encounters of unusual types and locations
- Multi-GSE traffic conflicts at congested gates
- Aircraft push-back events with unexpected timing
- Sensor degradation scenarios (rain on sensors, sun glare off wet apron)

### 10.4 The Fundamental Shift

Traditional AV systems follow a **detect-classify-plan-act** pipeline where failures at any stage propagate unrecoverably. World-model-based systems enable a fundamentally different architecture:

| Traditional Pipeline | World Model Approach |
|---------------------|---------------------|
| Classify, then predict path | Predict path regardless of classification |
| If not detected, assume absent | If expected but not detected, flag anomaly |
| Plan based on current snapshot | Plan based on evolving scene prediction |
| React to sensor degradation | Predict through sensor gaps |
| Binary object existence | Probabilistic object persistence |
| Single decision pathway | Counterfactual safety evaluation |

The core insight: **every major AV incident involved the system acting on what it *didn't* know or *incorrectly* assumed, rather than on what it demonstrably did know.** World models make the boundary between known and unknown explicit, enabling the system to act conservatively at exactly the right moments.

---

## 11. Building a Safety Culture

### 11.1 Aviation Safety Principles Applied to AV Operations

Aviation has achieved extraordinary safety records through organizational and cultural practices developed over decades. These principles are directly applicable to autonomous vehicle operations:

#### Crew Resource Management (CRM)

CRM, developed after recognizing that most aviation accidents resulted from human factors rather than mechanical failure, emphasizes:

- **Structured communication:** Standardized callouts, readbacks, and checklists
- **Challenge authority safely:** Junior crew members empowered to question senior decisions
- **Shared mental model:** All team members maintain awareness of the current situation
- **Workload management:** Tasks distributed to prevent overload

**AV Application -- Human-Autonomy Teaming (HAT).**
NASA research on CRM for Automated Teammates (CRM-A) extends these principles to human-machine teams:
- The autonomous system should be treated as a teammate, not just a tool
- The human operator's mental model of the AV's capabilities and limitations must be accurate
- Communication between human and autonomous system must be bidirectional and transparent
- Handoff procedures (autonomous-to-human and human-to-autonomous) must be as structured as pilot-copilot transfers of control

#### Just Culture

James Reason's Just Culture framework (1997) distinguishes between:

- **Human error (honest mistakes):** No blame. Investigate system factors that contributed. Redesign to prevent recurrence.
- **At-risk behavior:** Coaching and system redesign. Ask: would a similarly trained, reasonable person do the same thing in the same context?
- **Reckless behavior:** Disciplinary action warranted. Willful violations and gross negligence.

**AV Application:**
- **Report all incidents and near-misses without fear of retribution.** This requires organizational commitment from leadership.
- **Investigate system factors, not just individual actions.** When an AV incident occurs, ask: "What about the system design, training data, testing regime, or operational context created the conditions for this failure?"
- **Map system contributors:** Design, environment, tools, staffing, time pressure. The Uber ATG crash was not just a "safety driver was distracted" problem -- it was a system with no safety division, no safety plan, no operator oversight, and a deliberate decision to disable backup safety systems.
- **Just culture applies to reporting culture.** People will only report near-misses and anomalies if they trust that reporting will lead to improvements, not punishment. Cruise's "us versus them" mentality with regulators is the antithesis of just culture.

#### The Swiss Cheese Model and Defense in Depth

James Reason's Swiss cheese model represents safety defenses as imperfect layers. Accidents occur when holes in multiple layers align:

```
Layer 1: Perception     Layer 2: Planning      Layer 3: Safety       Layer 4: Human
(sensors, ML)           (decision, path)       (interlocks, MRC)     (oversight, ops)

   [ o    ]               [    o  ]              [  o     ]            [     o  ]
   [   o  ]               [  o    ]              [     o  ]            [  o     ]
   [      ]               [    o  ]              [o       ]            [      o ]
   [ o    ]               [       ]              [   o    ]            [   o    ]

When holes align → INCIDENT
```

**AV Application -- Defense in Depth:**
Every major AV incident involved alignment of holes across layers:
- **Uber ATG:** Perception uncertainty + action suppression + disabled AEB + distracted driver = fatality
- **Cruise:** Collision misclassification + pullover logic + no under-vehicle sensing + no human backup = pedestrian dragging
- **Tesla FSD:** Sensor degradation + no degradation warning + driver complacency = collision

A robust AV safety architecture must ensure that no single failure mode can propagate through all layers:
- Independent safety monitor running separate from the primary ADS
- Hardware-level safety interlocks (e.g., immediate stop capability independent of software)
- Operational constraints (speed limits, geo-fencing) as physical layer defense
- Human oversight as an additional, not sole, safety layer

### 11.2 Safety Management System (SMS) for AV Operations

Drawing from aviation's Safety Management System (ICAO Annex 19), an AV operation should implement:

**1. Safety Policy and Objectives**
- Executive-level safety accountability (not delegated to engineering)
- Published safety policy with clear risk tolerance thresholds
- Independent safety reporting channel

**2. Safety Risk Management**
- Hazard identification: systematic enumeration of failure modes
- Risk assessment: severity x probability matrix for each identified hazard
- Risk mitigation: documented controls for each identified risk
- Residual risk acceptance: formal sign-off at appropriate leadership level

**3. Safety Assurance**
- Continuous monitoring of safety performance (SPIs, not just KPIs)
- Internal safety audits and reviews
- Post-incident investigation with root cause analysis
- Trend analysis of near-misses and anomalies
- Management of change: safety assessment for every software update, ODD expansion, or operational change

**4. Safety Promotion**
- Safety training for all personnel (including remote operators, maintenance staff, and management)
- Safety communication: regular sharing of lessons learned
- Near-miss reporting incentives
- Cross-industry learning from aviation, nuclear, and healthcare safety science

### 11.3 Airside-Specific Safety Culture Requirements

| Practice | Description | Rationale |
|----------|-------------|-----------|
| **Pre-operation briefing** | Daily safety briefing including active NOTAMs, weather, construction, changed gate assignments | Establishes shared situational awareness |
| **FOD walks** | Regular foreign object debris walks, with autonomous GSE data supplementing human checks | AV sensors can detect FOD that humans miss, and vice versa |
| **Incident reporting with no-blame** | All near-misses, anomalies, and unexpected behaviors logged and analyzed | Leading indicators prevent catastrophic events |
| **Regular safety stand-downs** | Periodic pauses for safety review, even without an incident trigger | Prevents normalization of deviance |
| **Cross-functional safety reviews** | Include airline, ground handler, airport ops, ATC, and AV engineering perspectives | Each stakeholder sees different risks |
| **Shared safety database** | Anonymous, de-identified incident/near-miss data shared across operators and airports | Enables industry-wide learning |
| **Safety champion program** | Designated safety advocates in each operational role | Ensures safety voice at all levels |

### 11.4 The Normalization of Deviance

One of the most insidious threats to safety culture is the normalization of deviance -- the gradual process by which unacceptable practices become acceptable as repeated boundary violations go unchallenged. In AV operations, this manifests as:

- "The system always does that; it's fine" when a consistent but unsafe behavior is observed
- Expanding the ODD without completing the full safety assessment process
- Reducing monitoring staffing as confidence in the system grows
- Dismissing near-misses because no actual contact occurred
- Pressure to increase operational tempo or expand coverage area before safety validation is complete

The Cruise incident exemplifies institutionalized normalization: the company's culture prioritized narrative management and regulatory gamesmanship over transparent safety operations. The Uber ATG case shows how eliminating one of two safety drivers, disabling OEM safety systems, and allowing unsupervised phone use by operators represented progressive normalization of deviance until a fatality occurred.

**Counter-measures:**
- Treat every near-miss as a gift -- free information about system limitations
- Maintain written ODD boundaries and enforce them mechanically (geo-fencing, speed limiters)
- Require formal safety assessment for any operational expansion
- Rotate personnel to prevent complacency
- Conduct periodic "red team" exercises where the team actively tries to find failure modes

---

## Summary: Extractable Lessons for Airside Deployment

### The Five Cardinal Rules

1. **Never assume absence of evidence is evidence of absence.** If a person, vehicle, or object was recently detected and is no longer visible, the world model must retain it as "expected but unconfirmed" -- not delete it.

2. **Post-action behavior is as critical as pre-action behavior.** Every planned maneuver (pullover, reroute, emergency stop) must be evaluated for its own risks, not just the risk it was designed to mitigate. The Cruise pullover was designed for safety but caused the worst harm.

3. **Sensor redundancy is non-negotiable.** Camera-only systems (Tesla) fail in predictable conditions. LiDAR-only systems miss thin objects (Waymo chains). Multi-modal fusion with explicit degradation detection is the minimum viable architecture.

4. **Transparency with regulators is a strategic asset, not a liability.** Cruise's withholding of information destroyed the company. Waymo's public safety data and peer-reviewed publications have sustained regulatory support through multiple incidents.

5. **Safety culture is organizational DNA, not a department.** You cannot bolt safety onto a "move fast" culture. Safety must be embedded from leadership through to every operational decision. The Uber ATG case is a textbook example of what happens when a technology company treats safety-critical operations like a software startup.

### The Airside Imperative

Airport airside operations combine the safety challenges of autonomous driving with the operational constraints of aviation. The world model approach offers a fundamental advantage: by maintaining a persistent, physics-informed prediction of the operating environment, it can reason about what it *should* see but doesn't, what *could* happen if it acts, and what the *worst-case* interpretation of an ambiguous situation is. This is not just better perception -- it is a different paradigm for autonomous safety.

The incidents catalogued in this report are not just cautionary tales. They are a design specification for what the world model must handle. Every failure mode identified here should be a test case in simulation, a scenario in the training data, and a consideration in the safety case.

---

## References and Sources

### Cruise
- [Phil Koopman: The Cruise Pedestrian Dragging Mishap](https://philkoopman.substack.com/p/the-cruise-pedestrian-dragging-mishap)
- [Quinn Emanuel Report to Cruise/GM Board of Directors (PDF)](https://assets.ctfassets.net/95kuvdv8zn1v/1mb55pLYkkXVn0nXxEXz7w/9fb0e4938a89dc5cc09bf39e86ce5b9c/2024.01.24_Quinn_Emanuel_Report_re_Cruise.pdf)
- [Dan Luu: Notes on Cruise's Pedestrian Accident](https://danluu.com/cruise-report/)
- [CNBC: GM exits robotaxi market](https://www.cnbc.com/2024/12/10/gm-halts-funding-of-robotaxi-development-by-cruise.html)
- [NHTSA Consent Order with Cruise](https://www.nhtsa.gov/press-releases/consent-order-cruise-crash-reporting)
- [California DMV Statement on Cruise Suspension](https://www.dmv.ca.gov/portal/news-and-media/dmv-statement-on-cruise-llc-suspension/)
- [Koopman 2024: Cruise Mishap Analysis (IEEE Reliability)](https://users.ece.cmu.edu/~koopman/cruise/Koopman2024_CruiseMishap_IEEEReliabilityMagazine.pdf)

### Waymo
- [Waymo Safety Impact Data](https://waymo.com/safety/impact/)
- [Waymo Safety Data Hub](https://waymo.com/blog/2024/09/safety-data-hub/)
- [Waymo: Demonstrably Safe AI for Autonomous Driving](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)
- [Waymo: Safe to Deploy](https://waymo.com/blog/2025/06/safe-to-deploy)
- [Waymo Safety Case Approach White Paper (PDF)](https://assets.ctfassets.net/e6t5diu0txbw/66jOjPtNIjzawaK0ZjpU3q/7f081b392cf29a3355c97d0d758fe6cf/Waymo_Safety_Case_Approach.pdf)
- [Waymo World Model Blog Post](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [NPR: Waymo Recalls Software After School Bus Failures](https://www.npr.org/2025/12/06/nx-s1-5635614/waymo-school-buses-recall)
- [TechCrunch: Waymo Recalls 1,200 Robotaxis (Gates/Chains)](https://techcrunch.com/2025/05/14/waymo-recalls-1200-robotaxis-following-low-speed-collisions-with-gates-and-chains/)

### Tesla FSD
- [Electrek: NHTSA Upgrades Tesla FSD Visibility Probe](https://electrek.co/2026/03/19/nhtsa-upgrades-tesla-fsd-visibility-investigation-3-2-million-vehicles/)
- [NHTSA Investigation PE25012 (PDF)](https://static.nhtsa.gov/odi/inv/2025/INOA-PE25012-19171.pdf)
- [Repairer Driven News: NHTSA Launches FSD Investigation](https://www.repairerdrivennews.com/2025/10/10/nhtsa-launches-new-tesla-full-self-driving-investigation-on-nearly-2-9-million-vehicles/)

### Uber ATG
- [NTSB Accident Report HAR-19/03 (PDF)](https://www.ntsb.gov/investigations/AccidentReports/Reports/HAR1903.pdf)
- [NTSB Press Release: Inadequate Safety Culture](https://www.ntsb.gov/news/press-releases/Pages/NR20191119c.aspx)
- [IEEE Spectrum: NTSB Investigation Reveals Lax Safety](https://spectrum.ieee.org/ntsb-investigation-into-deadly-uber-selfdriving-car-crash-reveals-lax-attitude-toward-safety)
- [NBC News: Uber Car Did Not Recognize Jaywalking Pedestrians](https://www.nbcnews.com/tech/tech-news/self-driving-uber-car-hit-killed-woman-did-not-recognize-n1079281)

### Airside and GSE
- [FAA: Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [EASA on Developing a Regulatory Framework for Autonomous GSE](https://airsideint.com/easa-on-developing-a-regulatory-framework-for-autonomous-gse/)
- [TractEasy](https://tracteasy.com/)
- [Aurrigo: Ground Handling Licence at East Midlands Airport](https://www.stattimes.com/air-cargo/aurrigo-secures-ground-handling-licence-at-east-midlands-airport-1358264)
- [IATA Ground Operations Safety](https://www.iata.org/en/programs/ops-infra/ground-operations/safety/)
- [SKYbrary: Ground Collision](https://skybrary.aero/articles/ground-collision)

### Safety Standards and Frameworks
- [UL 4600: Standard for Safety for the Evaluation of Autonomous Products](https://users.ece.cmu.edu/~koopman/ul4600/index.html)
- [RAND: Driving to Safety](https://www.rand.org/pubs/research_reports/RR1478.html)
- [RAND: Measuring Automated Vehicle Safety](https://www.rand.org/content/dam/rand/pubs/research_reports/RR2600/RR2662/RAND_RR2662.pdf)
- [Koopman: Safety Performance Indicators for AVs (PDF)](https://users.ece.cmu.edu/~koopman/lectures/L124_SPI_vs_KPI.pdf)
- [NIST IR 8527: Standards and Performance Metrics (PDF)](https://nvlpubs.nist.gov/nistpubs/ir/2024/NIST.IR.8527.pdf)

### Safety Culture
- [SKYbrary: CRM](https://skybrary.aero/articles/crew-resource-management-crm)
- [NASA: CRM for Automated Teammates (PDF)](https://ntrs.nasa.gov/api/citations/20180004774/downloads/20180004774.pdf)
- [SKYbrary: Just Culture](https://skybrary.aero/articles/just-culture)
- [SKYbrary: James Reason HF Model](https://skybrary.aero/articles/james-reason-hf-model)
- [NHTSA Standing General Order on Crash Reporting](https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting)

### Zoox
- [TechCrunch: Zoox Recalls Over Lane Crossings](https://techcrunch.com/2025/12/23/zoox-issues-software-recall-over-lane-crossings/)
- [NHTSA: Zoox Investigation PE24015 (PDF)](https://static.nhtsa.gov/odi/inv/2024/INOA-PE24015-12348.pdf)

### World Models
- [SafeDrive Dreamer (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S1110016824011943)
- [World Models for Autonomous Driving: Survey (arXiv)](https://arxiv.org/pdf/2501.11260)
- [World Model-Based Accident Anticipation (Nature)](https://www.nature.com/articles/s44172-025-00474-7)
- [Swiss Cheese + SHELL Analysis for AV Safety (MDPI)](https://www.mdpi.com/2673-7590/6/1/21)
