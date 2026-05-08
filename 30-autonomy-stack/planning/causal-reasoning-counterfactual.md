# Causal Reasoning and Counterfactual Planning for Autonomous Driving

> **Purpose**: Deep dive into causal inference, structural causal models, counterfactual reasoning, and their application to autonomous driving decisions -- bridging the gap between correlation-based ML and the kind of causal understanding needed for safety certification, incident investigation, and robust planning on airport airside.
>
> **Relation to existing docs**: Extends `neuro-symbolic-scene-graphs.md` (structured reasoning over scenes), `llm-reasoning-planning.md` (chain-of-thought and LLM decision-making), `safety-critical-planning-cbf.md` (formal safety guarantees), `neural-motion-planning.md` (learned planning). This document focuses specifically on *why* things happen, not just *what* happens -- the causal mechanisms behind driving decisions and outcomes.

---

## Table of Contents

1. [Why Causal Reasoning for Autonomous Driving](#1-why-causal-reasoning-for-autonomous-driving)
2. [Structural Causal Models for Driving](#2-structural-causal-models-for-driving)
3. [Counterfactual Reasoning](#3-counterfactual-reasoning)
4. [Causal Discovery from Driving Data](#4-causal-discovery-from-driving-data)
5. [Causal Representation Learning](#5-causal-representation-learning)
6. [Causal Planning and Decision-Making](#6-causal-planning-and-decision-making)
7. [Causal Safety Analysis](#7-causal-safety-analysis)
8. [Causal Reasoning with LLMs](#8-causal-reasoning-with-llms)
9. [Counterfactual Simulation](#9-counterfactual-simulation)
10. [Practical Implementation for Airside](#10-practical-implementation-for-airside)
11. [Key Takeaways](#11-key-takeaways)

---

## 1. Why Causal Reasoning for Autonomous Driving

### 1.1 The Failure of Correlation-Based Approaches

Modern autonomous driving stacks learn correlations from massive datasets: "when I see a red light, I should stop." But correlation is not causation, and this distinction has concrete, safety-critical consequences.

**Spurious correlations in driving data:**

| Spurious Correlation | Why It Exists | Failure Mode |
|---------------------|---------------|--------------|
| Ambulances appear near accidents | Co-occurrence in training data | System brakes when it sees an ambulance, even parked at a station |
| Wet roads co-occur with headlights on | Weather confound | System assumes headlights-on means wet road, adjusts speed unnecessarily |
| Construction cones near lane closures | Layout confound | System merges on seeing cones, even when lanes are open |
| Ground crew near aircraft doors | Turnaround confound | System assumes door is open when crew is present, even during towing |
| Pushback tractors near terminal gates | Spatial confound | System treats all tractors near gates as active pushbacks |

These spurious correlations are not edge cases -- they are systematic failure modes that emerge whenever a model learns P(Y|X) instead of the causal effect of X on Y.

**Distribution shift is fundamentally a causal problem:**

When an AV trained on Airport A deploys at Airport B, the joint distribution P(X,Y) changes. But the *causal mechanisms* -- how aircraft move, how physics works, how braking force relates to stopping distance -- remain invariant. A causal model captures these invariant mechanisms; a correlational model captures the joint distribution, which is fragile.

```
Airport A:  P_A(wet_road, slow_speed) = high  (because Airport A is in Seattle)
Airport B:  P_B(wet_road, slow_speed) = low   (because Airport B is in Phoenix)

Causal truth: wet_road -> increased_braking_distance -> should_slow_down
This relationship is invariant across airports.
A correlational model trained on Airport A will over-predict slow_speed at Airport B.
A causal model captures the mechanism and generalizes.
```

### 1.2 Pearl's Ladder of Causation

Judea Pearl (2018) articulated three levels of causal reasoning, each strictly more powerful than the previous:

```
Level 3: COUNTERFACTUALS (Imagination)
         "What if I had braked 0.5s earlier?"
         "Would the incident have occurred if the crew member had not stepped out?"
         Requires: Full structural causal model
         Math: P(Y_x | X=x', Y=y')  [cross-world probability]
         
         ↑ Cannot be answered from Level 2
         
Level 2: INTERVENTIONS (Doing)
         "What happens if I set speed to 5 km/h?"
         "What is the effect of adding a 4D radar?"
         Requires: Causal graph + do-calculus
         Math: P(Y | do(X=x))
         
         ↑ Cannot be answered from Level 1
         
Level 1: ASSOCIATIONS (Seeing)
         "What is the probability of collision given wet road?"
         "How often do ground crew appear near Gate 5?"
         Requires: Joint distribution P(X,Y)
         Math: P(Y | X=x)
```

**Where current AV systems sit:**

| Component | Causal Level | Limitation |
|-----------|-------------|------------|
| Object detection (CenterPoint, PointPillars) | Level 1 | Learns correlations between point patterns and labels |
| Behavior prediction (motion forecasting) | Level 1 | Predicts P(future | past), not P(future | do(action)) |
| Imitation learning planners | Level 1 | Mimics demonstrations, confuses correlation with causation |
| Reinforcement learning planners | Level 2 | Learns interventional effects through trial-and-error |
| Rule-based safety (CBF, RSS) | Level 2 | Encodes causal knowledge as constraints (e.g., braking causes deceleration) |
| **Counterfactual analysis** | Level 3 | *Not present in any production AV stack* |

The gap is clear: **no production AV system reasons at Level 3**, yet counterfactual reasoning is exactly what is needed for incident investigation ("would the collision have occurred if...?"), explanation ("the vehicle braked because..."), and robust planning under novel scenarios.

### 1.3 Regulatory and Certification Requirements

Causal reasoning is not merely a research curiosity -- it is increasingly a regulatory requirement.

**EU AI Act (2024/1689, applicable from August 2026):**
- Article 13(1): High-risk AI systems must be "sufficiently transparent to enable deployers to interpret the system's output and use it appropriately."
- Article 14(4): Human oversight measures must enable the operator to "correctly interpret the high-risk AI system's output."
- Recital 47: Explanations should enable the deployer to understand "which features or inputs have the most significant influence on the output."
- **Causal explanations** ("the vehicle stopped because the crew member stepped into the path") are far more interpretable than feature attributions ("pixel region (340, 210) had high gradient magnitude").

**ISO 3691-4:2023 (Automated Industrial Vehicles -- Safety):**
- Clause 5.2.4: "The manufacturer shall document the functional description of the safety-related control system, including the causal relationship between inputs and safety functions."
- Clause 7.3: Incident investigation requires identifying "root causes" -- a fundamentally causal concept.
- The standard implicitly requires causal arguments: "if the personnel detection system had failed, what would have happened?" This is a counterfactual question.

**EU Product Liability Directive 2024/2853 (transposition by December 2026):**
- Article 9: Claimant must prove "the defectiveness of the product and the causal link between the defectiveness and the damage."
- Article 10: Establishes a "rebuttable presumption of causality" when the defendant fails to disclose relevant evidence about the AI system's decision-making process.
- **This means:** If reference airside AV stack cannot provide causal explanations for driving decisions, courts may *presume* causal responsibility.

**Practical implication for reference airside AV stack:** The ability to generate causal explanations ("the vehicle stopped because the crew member was predicted to cross the path, based on their heading and velocity, which would have caused a collision within 2.3 seconds") is not just good engineering -- it is approaching a legal requirement in the EU by 2026-2027.

### 1.4 Safety Cases Require Causal Arguments

A safety case (as required by ISO 3691-4, the GSN/CAE argument structures, and increasingly by airport authorities) is fundamentally a causal argument:

```
Claim:  "The AV is acceptably safe for airside operation."
         |
Strategy: "Argument over causal mechanisms that prevent harm"
         |
   +-----+-----+
   |             |
Sub-claim:    Sub-claim:
"Personnel     "The braking system
detection       arrests motion within
causes          X meters given the
e-stop          detected speed."
trigger"
   |             |
Evidence:      Evidence:
Detection       Braking dynamics
performance     model (causal)
(statistical)   + test results
```

Statistical evidence ("detection rate 99.5%") is necessary but not sufficient. The safety case must explain *why* the detection leads to the correct action -- a causal chain from perception through decision to actuation. Without causal models, safety cases are vulnerable to challenges like "yes, but what if the detection was correct and the braking was triggered but the stopping distance was miscalculated because of wet surfaces?" -- which requires counterfactual analysis to address.

### 1.5 Blame and Responsibility Attribution

When an incident occurs, multiple parties need to understand *who or what caused it*:

- **Airport authority**: Was it the AV, the crew member, or the ground handler's procedures?
- **Insurance**: Is the defect in the AV (manufacturer liability) or the operating procedures (operator liability)?
- **Regulator**: Should the type approval be revoked?
- **Engineering team**: What should be changed to prevent recurrence?

All of these questions are causal. The formal frameworks for answering them (actual causation, responsibility, blame) are grounded in structural causal models, as formalized by Halpern and Pearl.

---

## 2. Structural Causal Models for Driving

### 2.1 SCM Formalism

A **Structural Causal Model** (SCM) M = (U, V, F, P(U)) consists of:

- **U** = {U_1, ..., U_n}: exogenous (background) variables -- unobserved factors
- **V** = {V_1, ..., V_m}: endogenous (model) variables -- observed/modeled factors
- **F** = {f_1, ..., f_m}: structural equations, where each V_i = f_i(PA_i, U_i) with PA_i being the parents of V_i
- **P(U)**: probability distribution over exogenous variables

**Key property:** The structural equations are *asymmetric* -- they represent causal mechanisms, not mere associations. V_i = f_i(PA_i, U_i) means "V_i is determined by its parents PA_i and noise U_i," not "V_i is correlated with PA_i."

**Example -- Airside braking decision:**

```python
# Structural Causal Model for ego vehicle braking on airside
class AirsideBrakingSCM:
    """
    Endogenous variables (V):
        crew_position    -- ground crew position (x, y)
        crew_velocity    -- ground crew velocity (vx, vy)
        crew_intent      -- crew intention (crossing, stationary, walking_parallel)
        detection_result -- perception output (detected, missed, false_positive)
        ego_speed        -- ego vehicle speed
        braking_decision -- brake (yes/no) and intensity
        outcome          -- {safe_stop, near_miss, collision, unnecessary_stop}
    
    Exogenous variables (U):
        U_crew           -- crew behavioral noise (unpredictability)
        U_perception     -- sensor noise, occlusion, lighting
        U_surface        -- road surface condition (wet, icy, dry)
        U_vehicle        -- vehicle mechanical state
    """
    
    def structural_equations(self):
        # Each equation encodes a causal mechanism
        crew_position    = f_position(crew_intent, U_crew)          # intent causes position change
        crew_velocity    = f_velocity(crew_intent, U_crew)          # intent causes velocity
        detection_result = f_detect(crew_position, ego_speed, U_perception)  # position + noise -> detection
        braking_decision = f_brake(detection_result, ego_speed)     # detection + speed -> brake
        outcome          = f_outcome(braking_decision, crew_position, 
                                     ego_speed, U_surface, U_vehicle)  # everything -> outcome
        return outcome
```

### 2.2 Causal DAGs for Driving Scenarios

The causal DAG (Directed Acyclic Graph) encodes which variables cause which. Each node is an endogenous variable; each directed edge represents a direct causal relationship.

**General driving DAG:**

```
Weather ──────────┐
                   ▼
Road_Surface ──→ Braking_Distance
                   ▲
Ego_Speed ────────┘
    │
    ▼
Perception ──→ Decision ──→ Action ──→ Outcome
    ▲              ▲                       ▲
    │              │                       │
Other_Agent    Traffic_Rules          Other_Agent
  State            │                   Response
    ▲              │
    │              ▼
Other_Agent    Regulatory
  Intent       Context
```

**Airside-specific DAG (aircraft-vehicle interaction):**

```
ATC_Instruction ──→ Aircraft_State ──→ Jet_Blast_Zone
       │                  │                   │
       │                  ▼                   ▼
       │           Aircraft_Position ──→ Ego_Risk_Assessment
       │                  │                   │
       ▼                  ▼                   ▼
NOTAM_Constraints   Crew_Activity ──→ Braking_Decision ──→ Outcome
       │                  ▲                   ▲
       │                  │                   │
       ▼              Turnaround          Ego_Speed
Restricted_Zones      Phase               ▲
       │                                    │
       ▼                               Ego_Position
Route_Constraint                           ▲
       │                                    │
       ▼                              Previous_Plan
Path_Plan ─────────────────────────────────┘
```

### 2.3 Formal DAG for Airside Braking

```python
import networkx as nx

def build_airside_braking_dag():
    """
    Formal causal DAG for airside braking decision.
    
    Nodes:
        W  -- Weather (exogenous)
        S  -- Surface condition
        CP -- Crew position
        CI -- Crew intent (partially observable)
        CV -- Crew velocity
        ES -- Ego speed
        EP -- Ego position
        DR -- Detection result
        BD -- Braking decision
        SD -- Stopping distance
        OC -- Outcome (safe/collision/near-miss)
    
    Edges encode direct causal relationships.
    """
    G = nx.DiGraph()
    
    # Exogenous -> endogenous
    G.add_edges_from([
        ('W', 'S'),     # weather causes surface condition
        ('W', 'DR'),    # weather affects perception (fog, rain)
    ])
    
    # Crew behavior chain
    G.add_edges_from([
        ('CI', 'CP'),   # intent causes position change
        ('CI', 'CV'),   # intent causes velocity
    ])
    
    # Perception
    G.add_edges_from([
        ('CP', 'DR'),   # crew position -> detection
        ('CV', 'DR'),   # crew velocity -> detection (motion helps)
        ('EP', 'DR'),   # ego position -> detection (range, angle)
    ])
    
    # Decision
    G.add_edges_from([
        ('DR', 'BD'),   # detection -> braking decision
        ('ES', 'BD'),   # ego speed -> braking decision
    ])
    
    # Physics
    G.add_edges_from([
        ('ES', 'SD'),   # speed -> stopping distance
        ('S', 'SD'),    # surface -> stopping distance
        ('BD', 'SD'),   # braking decision -> stopping distance
    ])
    
    # Outcome
    G.add_edges_from([
        ('SD', 'OC'),   # stopping distance -> outcome
        ('CP', 'OC'),   # crew position -> outcome
        ('CV', 'OC'),   # crew velocity -> outcome
    ])
    
    return G
```

### 2.4 Causal Sufficiency and Hidden Confounders

A causal model is **causally sufficient** if every common cause of any two observed variables is also observed. In driving, causal sufficiency is almost never satisfied:

**Hidden confounders in airside driving:**

| Confounder | Variables It Affects | Why Hidden |
|-----------|---------------------|-----------|
| Crew intent | Crew position, crew velocity | Not directly observable (must be inferred) |
| Aircraft system state | Aircraft movement, crew urgency | Internal to aircraft, not broadcast |
| Turnaround schedule pressure | Crew speed, crew attention level | Not communicated to AV |
| Radio communication content | ATC instructions, crew behavior | AV may not receive or parse |
| Crew fatigue/distraction | Crew awareness, crew reaction time | Not observable |
| Surface contamination (invisible) | Braking distance, traction | Not detectable by LiDAR alone |

**Implication:** Standard causal discovery algorithms that assume causal sufficiency (like the PC algorithm) will produce incorrect graphs. We must use algorithms designed for latent confounders (FCI, ancestral graphs) or incorporate domain knowledge to constrain the graph.

### 2.5 Causal Bayesian Networks for Scene Understanding

A **Causal Bayesian Network** (CBN) combines a causal DAG with conditional probability distributions for each variable, enabling probabilistic inference and intervention analysis.

```python
# Simplified CBN for scene understanding
# Using pgmpy-style specification

class AirsideSceneCBN:
    """
    Causal Bayesian Network for airside scene classification.
    
    Scenario types: normal_transit, active_pushback, turnaround_service,
                    emergency, maintenance
    """
    
    def __init__(self):
        self.variables = {
            'aircraft_state': ['parked', 'taxiing', 'pushback', 'emergency'],
            'crew_density': ['none', 'low', 'high'],
            'gse_present': ['none', 'baggage', 'fuel', 'catering', 'pushback_tug'],
            'time_since_arrival': ['<5min', '5-30min', '30-60min', '>60min'],
            'scenario': ['transit', 'pushback', 'turnaround', 'emergency', 'maintenance']
        }
        
        # CPDs encode causal knowledge
        self.cpd_scenario = {
            # P(scenario | aircraft_state, crew_density, gse_present)
            # These are causal: the aircraft state and crew activity
            # CAUSE the scenario classification, not merely correlate with it
            ('parked', 'high', 'baggage'):  {'turnaround': 0.85, 'maintenance': 0.10, ...},
            ('pushback', 'low', 'pushback_tug'): {'pushback': 0.95, ...},
            ('taxiing', 'none', 'none'):    {'transit': 0.90, ...},
        }
    
    def intervene(self, variable, value):
        """
        Compute P(scenario | do(variable = value))
        
        Unlike conditioning P(scenario | variable = value), intervention
        removes incoming edges to the variable, preventing confounding.
        """
        # Create mutilated graph: remove all edges into `variable`
        # Set variable to `value`
        # Propagate through remaining causal structure
        pass
    
    def counterfactual(self, evidence, intervention):
        """
        P(scenario_intervention | evidence)
        
        "Given what we observed (evidence), what would the scenario 
        classification have been if we had intervened?"
        """
        # Step 1: Abduction -- infer U given evidence
        # Step 2: Action -- apply intervention to mutilated model
        # Step 3: Prediction -- compute outcome in modified model with inferred U
        pass
```

### 2.6 Identifiability: Backdoor and Frontdoor Criteria

A causal effect P(Y | do(X)) is **identifiable** if it can be computed from observational data alone (without experiments). Pearl provides two key criteria:

**Backdoor Criterion:**
A set Z satisfies the backdoor criterion relative to (X, Y) if:
1. No node in Z is a descendant of X
2. Z blocks every path between X and Y that contains an arrow into X

If Z satisfies the backdoor criterion:
```
P(Y | do(X)) = SUM_z P(Y | X, Z=z) P(Z=z)
```

**Example -- Identifying the causal effect of braking on outcome:**
```
Weather (W) ──→ Surface (S) ──→ Stopping_Distance (SD) ──→ Outcome (OC)
                                       ▲
Ego_Speed (ES) ──→ Braking_Decision (BD)
                                       │
                                       ▼
                             Crew_Position (CP) ──→ OC

Question: What is P(Outcome | do(Braking_Decision = emergency_brake))?

Confounders: Ego_Speed affects both Braking_Decision and Stopping_Distance.
Backdoor set: Z = {Ego_Speed, Surface}

P(OC | do(BD)) = SUM_{es,s} P(OC | BD, ES=es, S=s) P(ES=es) P(S=s)
```

**Frontdoor Criterion:**
When no valid backdoor set exists (due to unobserved confounders), the frontdoor criterion identifies the effect through a mediating variable M:

```
If X -> M -> Y, and there is an unobserved confounder U affecting both X and Y:

P(Y | do(X)) = SUM_m P(M=m | X) SUM_x' P(Y | M=m, X=x') P(X=x')
```

**Example -- Crew intent as unobserved confounder:**
```
Crew_Intent (CI, unobserved) ──→ Crew_Position (CP) ──→ Detection (DR) ──→ Decision
                    │
                    └──→ Crew_Velocity (CV) ──→ Outcome

Cannot observe intent directly. But:
- Crew_Position mediates the effect of Intent on Detection
- Frontdoor through Crew_Position identifies P(Decision | do(Intent))
```

### 2.7 Example: Aircraft-Vehicle Interaction as a Causal DAG

A pushback scenario illustrates the full complexity of airside causal reasoning:

```
                    ┌────────────────────────┐
                    │   ATC Pushback          │
                    │   Clearance              │
                    └──────────┬───────────────┘
                               │
                               ▼
┌──────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Schedule  │────→│  Aircraft State       │────→│  Jet Blast Zone  │
│ Pressure  │     │  (brake_release,      │     │  (position,       │
│ (hidden)  │     │   pushback_start,     │     │   intensity,      │
│           │     │   pushback_active)    │     │   boundary)       │
└──────────┘     └──────────┬───────────┘     └────────┬──────────┘
                             │                          │
                    ┌────────┘                          │
                    │                                    │
                    ▼                                    ▼
              ┌──────────────┐              ┌──────────────────────┐
              │ Tug Velocity  │              │ Ego Risk Assessment   │
              │ and Direction │              │ (collision risk,      │
              └──────┬───────┘              │  jet blast exposure,  │
                     │                       │  clearance margin)    │
                     │                       └──────────┬───────────┘
                     │                                   │
                     ▼                                   ▼
              ┌──────────────┐              ┌──────────────────────┐
              │ Swept Path    │              │ Ego Decision          │
              │ (tail swing,  │─────────────→│ (yield, reroute,      │
              │  wing tip)    │              │  e-stop, proceed)     │
              └──────────────┘              └──────────┬───────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────────┐
                                            │ Outcome               │
                                            │ (safe, near-miss,     │
                                            │  delay, collision)    │
                                            └──────────────────────┘
```

**Causal questions this DAG answers:**

1. **Interventional**: P(Outcome | do(Ego_Decision = yield)) -- "What would happen if the ego always yields to pushback?"
2. **Counterfactual**: P(Outcome_yield | Ego_Decision = proceed, Outcome = near_miss) -- "Given that a near-miss occurred when we proceeded, would yielding have avoided it?"
3. **Identification**: Schedule pressure is hidden, but its effect on outcome is identifiable through the frontdoor via Aircraft State.

---

## 3. Counterfactual Reasoning

### 3.1 Pearl's Three-Step Procedure

Counterfactual inference in an SCM follows three steps:

```
Step 1: ABDUCTION
  Given evidence (what actually happened), infer the values of 
  exogenous variables U.
  
  "The vehicle was traveling at 15 km/h, the crew member stepped out 
  at t=0, the vehicle braked at t=0.8s, and stopped at t=2.1s."
  → Infer: U_surface = dry (consistent with stopping distance),
           U_perception = moderate_delay (0.8s detection latency),
           U_crew = sudden_emergence (no prior motion cues)

Step 2: ACTION (Intervention)
  Modify the structural equations to reflect the hypothetical change.
  
  "What if the vehicle had braked at t=0.3s instead of t=0.8s?"
  → Set: braking_decision = emergency_brake at t=0.3s
  → This is do(BD = brake_at_0.3s), which mutilates the graph by 
    removing all incoming edges to BD

Step 3: PREDICTION
  Use the modified model with the inferred U values to compute 
  the counterfactual outcome.
  
  → With U_surface = dry and brake at t=0.3s:
    stopping_distance = v^2 / (2 * mu * g) + v * t_reaction
                      = (15/3.6)^2 / (2 * 0.7 * 9.81) + (15/3.6) * 0.3
                      = 1.27 + 1.25 = 2.52 m
  → Crew position at t=2.52s: 1.2m from vehicle path
  → Counterfactual outcome: SAFE (vehicle stopped before crew crossing)
```

### 3.2 Formal Definition

Let M = (U, V, F, P(U)) be an SCM. The counterfactual "Y would be y had X been x, given that we observed E = e" is:

```
P(Y_{X=x} = y | E = e) = SUM_u P(Y_{X=x}(u) = y) * P(u | E = e)
                          \_________________________/   \___________/
                          Step 3: Prediction              Step 1: Abduction
                          (in mutilated model M_x)
```

Where M_x is the mutilated model with the structural equation for X replaced by X = x.

**The key insight:** Counterfactuals require reasoning about two worlds simultaneously:
- The **actual world**: where the observed evidence holds
- The **counterfactual world**: where the intervention is applied

Both worlds share the same exogenous variables U (same background conditions), but differ in the structural equations (different actions taken).

### 3.3 Counterfactual Trajectory Analysis

For driving, the most important counterfactual question is: "What would have happened if the ego vehicle had taken a different action?"

```python
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional

@dataclass
class VehicleState:
    x: float       # meters
    y: float       # meters
    theta: float   # radians
    v: float       # m/s
    t: float       # seconds

@dataclass
class CounterfactualQuery:
    """
    Represents: "What would the outcome have been if {intervention}
    instead of {actual_action}, given {evidence}?"
    """
    evidence: List[VehicleState]          # observed trajectory
    actual_action: str                     # what happened
    intervention: str                      # hypothetical action
    other_agents: List[List[VehicleState]] # observed agent trajectories
    
class CounterfactualTrajectoryAnalyzer:
    """
    Analyzes counterfactual trajectories for incident investigation.
    
    Given:
    - Observed ego trajectory
    - Observed other agent trajectories
    - A hypothetical intervention (e.g., "brake 0.5s earlier")
    
    Computes:
    - Counterfactual ego trajectory
    - Whether the counterfactual avoids the incident
    - Minimum intervention that would have changed the outcome
    """
    
    def __init__(self, vehicle_model, friction_model):
        self.vehicle = vehicle_model    # bicycle kinematic model
        self.friction = friction_model  # surface friction estimator
    
    def abduction(self, evidence: List[VehicleState], 
                  other_agents: List[List[VehicleState]]) -> dict:
        """
        Step 1: Infer exogenous variables from evidence.
        
        Returns inferred background conditions:
        - surface_friction
        - perception_latency
        - agent_intent_models
        """
        # Infer friction from observed braking profile
        # (deceleration = friction * g, so friction = decel / g)
        observed_decel = self._compute_deceleration(evidence)
        inferred_friction = abs(observed_decel) / 9.81
        
        # Infer perception latency from detection-to-brake delay
        detection_time = self._estimate_detection_time(evidence, other_agents)
        brake_time = self._estimate_brake_onset(evidence)
        inferred_latency = brake_time - detection_time
        
        # Infer agent intent from observed trajectories
        agent_intents = [
            self._infer_intent(agent_traj) 
            for agent_traj in other_agents
        ]
        
        return {
            'surface_friction': inferred_friction,
            'perception_latency': inferred_latency,
            'agent_intents': agent_intents,
        }
    
    def action(self, intervention: str, 
               evidence: List[VehicleState]) -> callable:
        """
        Step 2: Create modified structural equation for the intervention.
        
        Supported interventions:
        - "brake_at_t=X": emergency brake at time X
        - "speed_limit=X": cap speed at X km/h
        - "yield": yield to detected agent
        - "reroute_left/right": take alternative path
        """
        if intervention.startswith("brake_at_t="):
            t_brake = float(intervention.split("=")[1])
            def modified_control(state, t):
                if t >= t_brake:
                    return {'accel': -self.vehicle.max_decel, 'steer': 0.0}
                else:
                    # Use actual controls up to intervention point
                    return self._actual_control_at(evidence, t)
            return modified_control
        
        elif intervention.startswith("speed_limit="):
            v_max = float(intervention.split("=")[1]) / 3.6  # km/h to m/s
            def modified_control(state, t):
                actual = self._actual_control_at(evidence, t)
                if state.v > v_max:
                    actual['accel'] = min(actual['accel'], -1.0)  # decelerate
                return actual
            return modified_control
        
        # ... other intervention types
    
    def prediction(self, modified_control: callable, 
                   initial_state: VehicleState,
                   exogenous: dict,
                   other_agents: List[List[VehicleState]],
                   t_horizon: float = 10.0,
                   dt: float = 0.01) -> dict:
        """
        Step 3: Simulate counterfactual trajectory and evaluate outcome.
        """
        # Forward simulate with modified control and inferred exogenous
        cf_trajectory = []
        state = initial_state
        
        for t_step in np.arange(0, t_horizon, dt):
            control = modified_control(state, t_step)
            
            # Apply vehicle dynamics with inferred friction
            state = self.vehicle.step(
                state, control, dt, 
                friction=exogenous['surface_friction']
            )
            cf_trajectory.append(state)
            
            # Check for collision with other agents
            # (agents follow their OBSERVED trajectories -- 
            #  this assumes ego's counterfactual action doesn't 
            #  change other agents' behavior; see Section 3.6 
            #  for reactive counterfactuals)
            for agent_traj in other_agents:
                agent_pos = self._interpolate_agent(agent_traj, t_step)
                if self._check_collision(state, agent_pos):
                    return {
                        'trajectory': cf_trajectory,
                        'outcome': 'collision',
                        'collision_time': t_step,
                        'collision_pos': (state.x, state.y),
                    }
        
        return {
            'trajectory': cf_trajectory,
            'outcome': 'safe',
            'min_clearance': self._compute_min_clearance(
                cf_trajectory, other_agents
            ),
        }
    
    def minimum_sufficient_intervention(
        self, evidence, other_agents, 
        intervention_type="brake_earlier"
    ) -> dict:
        """
        Find the MINIMUM change that would have avoided the incident.
        
        Binary search over intervention parameter to find the threshold.
        """
        exogenous = self.abduction(evidence, other_agents)
        
        if intervention_type == "brake_earlier":
            # Binary search over brake time
            t_actual_brake = self._estimate_brake_onset(evidence)
            t_lo, t_hi = 0.0, t_actual_brake
            
            for _ in range(20):  # ~20 iterations for 1ms precision
                t_mid = (t_lo + t_hi) / 2
                cf_control = self.action(f"brake_at_t={t_mid}", evidence)
                result = self.prediction(
                    cf_control, evidence[0], exogenous, other_agents
                )
                if result['outcome'] == 'safe':
                    t_lo = t_mid  # can brake even later
                else:
                    t_hi = t_mid  # need to brake earlier
            
            return {
                'minimum_intervention': f"brake {t_actual_brake - t_hi:.3f}s earlier",
                'threshold_time': t_hi,
                'margin': t_actual_brake - t_hi,
            }
```

### 3.4 Counterfactual Explanation Methods

Several formal methods exist for generating counterfactual explanations:

| Method | Approach | Strengths | Limitations |
|--------|----------|-----------|-------------|
| **DICE** (Diverse Counterfactual Explanations, Mothilal et al. 2020) | Generates diverse set of counterfactual inputs | Multiple actionable explanations | Assumes differentiable model |
| **FACE** (Feasible Actionable Counterfactual Explanations, Poyiadzi et al. 2020) | Shortest path through feasible feature space | Ensures physical feasibility | Computationally expensive |
| **CEM** (Contrastive Explanation Method, Dhurandhar et al. 2018) | Finds pertinent positives and negatives | Both "why" and "why not" explanations | Binary classification focus |
| **CERTIFAI** (Sharma et al. 2020) | Genetic algorithm for counterfactuals | Model-agnostic, handles complex constraints | Non-deterministic |
| **Causal Counterfactuals** (Pearl 2009) | Full SCM-based three-step procedure | Theoretically correct, handles confounders | Requires known causal graph |

**For driving, causal counterfactuals (Pearl) are the correct approach** because:
1. Physical feasibility is ensured by the vehicle dynamics model
2. Agent interactions have causal structure (my braking causes the follower to brake)
3. Confounders (weather, surface) must be handled correctly
4. Legal causation standards require "but-for" reasoning, which is inherently counterfactual

### 3.5 Nearest Possible World Semantics

Lewis (1973) formalized counterfactuals using possible-world semantics: a counterfactual "if X had been x, then Y would have been y" is true if, in the nearest possible world where X=x, Y=y holds.

**For driving, "nearness" of possible worlds is measured by:**

```python
def world_distance(actual_world, counterfactual_world):
    """
    Distance metric between possible worlds for driving scenarios.
    
    Lower distance = more plausible counterfactual.
    """
    d = 0.0
    
    # 1. Laws of physics must hold (infinite distance if violated)
    if not counterfactual_world.obeys_physics():
        return float('inf')
    
    # 2. Number of intervened variables (fewer = nearer)
    d += 10.0 * counterfactual_world.num_interventions()
    
    # 3. Temporal proximity of intervention to outcome
    #    (earlier intervention = more distant world)
    d += 2.0 * abs(counterfactual_world.intervention_time 
                   - actual_world.outcome_time)
    
    # 4. Magnitude of intervention
    #    (smaller change = nearer world)
    d += 1.0 * counterfactual_world.intervention_magnitude()
    
    # 5. Agent behavior consistency
    #    (agents should behave as similarly as possible)
    for agent in counterfactual_world.agents:
        d += 0.5 * agent.behavior_deviation_from(actual_world)
    
    return d
```

The nearest possible world framework is useful for generating explanations: "The nearest world where the collision didn't happen is one where the vehicle braked 0.3 seconds earlier" -- this is a concise, actionable explanation.

### 3.6 Twin Networks for Quantitative Counterfactuals

**Twin networks** (Balke and Pearl, 1994) provide a computational framework for counterfactual inference by constructing two copies of the causal model -- one for the actual world and one for the counterfactual world -- sharing the same exogenous variables.

```
Actual World                    Counterfactual World
============                    ====================
U_crew ─────────┬───────────────────┐
                │                    │
                ▼                    ▼
          CI (actual)          CI' (same intent)
                │                    │
                ▼                    ▼
          CP (actual)          CP' (same position)
                │                    │
                ▼                    ▼
          DR (actual)          DR' (same detection)
                │                    │
                ▼                    ▼
     BD (actual: late brake)   BD' (intervention: early brake)  ← INTERVENTION
                │                    │
                ▼                    ▼
     OC (actual: collision)    OC' (counterfactual: ?)
```

**Key property:** Both worlds share U_crew (same crew behavior), so the counterfactual crew position is the same as actual -- only the ego's braking differs. This is the correct semantics: "given the same crew behavior, what would have happened if I had braked earlier?"

```python
class TwinNetwork:
    """
    Twin network for driving counterfactual inference.
    
    Creates two copies of the SCM sharing exogenous variables.
    """
    
    def __init__(self, scm):
        self.actual = scm           # actual world
        self.counter = scm.copy()   # counterfactual world
        # Exogenous variables are shared
        self.counter.U = self.actual.U
    
    def query(self, evidence, intervention, target):
        """
        Compute P(target' | evidence, do(intervention))
        
        Args:
            evidence: dict of observed variable values in actual world
            intervention: dict of {variable: value} to set in counterfactual
            target: variable to query in counterfactual world
        
        Returns:
            Distribution over target in counterfactual world
        """
        # Step 1: Abduction in actual world
        posterior_U = self.actual.infer_exogenous(evidence)
        
        # Step 2: Set shared U
        self.counter.U = posterior_U
        
        # Step 3: Apply intervention in counterfactual world
        self.counter.intervene(intervention)
        
        # Step 4: Predict in counterfactual world
        return self.counter.predict(target)
```

---

## 4. Causal Discovery from Driving Data

### 4.1 The Problem: Learning Causal Structure

Given observational driving data (logs from fleet operation), can we *discover* which variables cause which? This is causal discovery -- learning the DAG from data.

**Why this matters for airside:**
- Domain experts can hypothesize the causal structure, but they may miss subtle relationships
- Different airports may have different causal structures (e.g., different ATC procedures)
- Data-driven causal discovery can validate or challenge expert assumptions
- Fleet data accumulates naturally -- can we extract causal knowledge from it?

### 4.2 Constraint-Based Methods

**PC Algorithm** (Spirtes, Glymour, Scheines, 2000):

```
Algorithm: PC (Peter-Clark)
Input: Observational data over variables V, significance level alpha
Output: Completed Partially Directed Acyclic Graph (CPDAG)

1. Start with complete undirected graph over V
2. For each pair (X, Y) and conditioning set S of increasing size:
   - Test conditional independence: X ⊥ Y | S
   - If independent at significance alpha: remove edge X-Y
   - Record S as the separating set Sep(X, Y)
3. Orient v-structures:
   For each triple X - Z - Y where X and Y are not adjacent:
   - If Z not in Sep(X, Y): orient as X → Z ← Y
4. Apply orientation rules (Meek rules) to orient remaining edges

Complexity: O(|V|^d * n) where d = max degree, n = sample size
```

**FCI Algorithm** (Fast Causal Inference) -- for latent confounders:
- Extends PC to handle hidden variables
- Outputs a Partial Ancestral Graph (PAG) with edge types:
  - `→` : definite causal direction
  - `↔` : latent common cause exists
  - `○` : uncertain direction
- Essential for driving data where crew intent, schedule pressure, etc. are unobserved

```python
# Pseudo-implementation of PC algorithm for driving data
from itertools import combinations
from scipy.stats import chi2_contingency, pearsonr

def pc_algorithm(data, variables, alpha=0.05):
    """
    PC algorithm for causal discovery from driving logs.
    
    Args:
        data: DataFrame with columns for each variable
        variables: list of variable names
        alpha: significance level for independence tests
    
    Returns:
        DAG as adjacency matrix with edge orientations
    """
    n_vars = len(variables)
    adj = np.ones((n_vars, n_vars)) - np.eye(n_vars)  # complete graph
    sep_sets = {}
    
    # Phase 1: Edge removal by conditional independence
    for d in range(n_vars):  # conditioning set size
        for i, j in combinations(range(n_vars), 2):
            if adj[i, j] == 0:
                continue
            
            # Neighbors of i excluding j
            neighbors = [k for k in range(n_vars) 
                        if adj[i, k] == 1 and k != j]
            
            if len(neighbors) < d:
                continue
            
            for S in combinations(neighbors, d):
                # Test: X_i ⊥ X_j | X_S ?
                p_value = conditional_independence_test(
                    data, variables[i], variables[j], 
                    [variables[s] for s in S]
                )
                
                if p_value > alpha:
                    adj[i, j] = adj[j, i] = 0
                    sep_sets[(i, j)] = set(S)
                    sep_sets[(j, i)] = set(S)
                    break
    
    # Phase 2: Orient v-structures
    orientations = np.zeros((n_vars, n_vars))  # 1 = directed i->j
    for i, j, k in find_unshielded_triples(adj):
        if j not in sep_sets.get((i, k), set()):
            # i → j ← k (v-structure)
            orientations[i, j] = 1
            orientations[k, j] = 1
    
    # Phase 3: Apply Meek's orientation rules
    orientations = apply_meek_rules(adj, orientations)
    
    return adj, orientations
```

### 4.3 Score-Based Methods

**GES (Greedy Equivalence Search)** (Chickering, 2002):

```
Algorithm: GES
1. Forward phase: Start with empty graph, greedily add edges that 
   maximally increase BIC score
2. Backward phase: Greedily remove edges that increase BIC score
3. Turning phase: Greedily reverse edges that increase BIC score

Advantage: Provably consistent in large samples, faster than PC
Limitation: Assumes causal sufficiency
```

**NOTEARS** (Zheng et al., NeurIPS 2018) -- Differentiable DAG Learning:

The breakthrough that enabled gradient-based causal discovery by reformulating the acyclicity constraint as a differentiable equality:

```
Minimize:   L(W) = (1/2n) ||X - XW||_F^2 + lambda * ||W||_1
Subject to: h(W) = tr(e^{W ∘ W}) - d = 0

Where:
  W ∈ R^{d×d}  -- weighted adjacency matrix
  X ∈ R^{n×d}  -- data matrix (n samples, d variables)
  h(W) = 0     -- acyclicity constraint (trace of matrix exponential)
  ∘             -- element-wise product (Hadamard)
  d             -- number of variables
```

**Key insight:** h(W) = 0 if and only if W represents a DAG. This allows solving causal discovery as a continuous optimization problem using standard tools (L-BFGS, augmented Lagrangian).

```python
import torch
import torch.nn as nn

class NOTEARS(nn.Module):
    """
    NOTEARS: differentiable DAG learning.
    
    Learns a weighted adjacency matrix W from data,
    subject to acyclicity constraint.
    """
    
    def __init__(self, d, hidden_dim=64):
        super().__init__()
        self.d = d
        # Option 1: Linear SEM
        self.W = nn.Parameter(torch.randn(d, d) * 0.01)
        
        # Option 2: Nonlinear SEM (MLP per variable)
        # self.mlps = nn.ModuleList([
        #     nn.Sequential(nn.Linear(d, hidden_dim), nn.ReLU(),
        #                   nn.Linear(hidden_dim, 1))
        #     for _ in range(d)
        # ])
    
    def forward(self, X):
        """Reconstruct X from linear SEM: X = X @ W + noise"""
        return X @ self.W
    
    def acyclicity_constraint(self):
        """h(W) = tr(e^{W ∘ W}) - d"""
        W_sq = self.W * self.W  # element-wise square
        # Matrix exponential via eigendecomposition or power series
        exp_W = torch.matrix_exp(W_sq)
        return torch.trace(exp_W) - self.d
    
    def loss(self, X, lambda_l1=0.01, rho=1.0, alpha=0.0):
        """
        Augmented Lagrangian loss.
        
        L = (1/2n)||X - XW||^2 + lambda*||W||_1 
            + alpha*h(W) + (rho/2)*h(W)^2
        """
        n = X.shape[0]
        recon = self.forward(X)
        mse = 0.5 / n * torch.sum((X - recon) ** 2)
        l1 = lambda_l1 * torch.sum(torch.abs(self.W))
        h = self.acyclicity_constraint()
        
        return mse + l1 + alpha * h + 0.5 * rho * h * h
    
    def get_dag(self, threshold=0.3):
        """Threshold W to get binary DAG."""
        W_np = self.W.detach().cpu().numpy()
        return (np.abs(W_np) > threshold).astype(int)
```

### 4.4 Hybrid: Domain Knowledge + Data-Driven Discovery

Pure data-driven causal discovery often produces incorrect graphs due to finite sample sizes and hidden confounders. The practical approach is **hybrid**: combine domain knowledge (expert-specified constraints) with data-driven discovery.

```python
class ConstrainedCausalDiscovery:
    """
    Causal discovery with domain knowledge constraints.
    
    Expert provides:
    - Required edges (must be in the graph)
    - Forbidden edges (must NOT be in the graph)
    - Required orientations (must be in this direction)
    - Tier ordering (temporal or logical ordering of variables)
    """
    
    def __init__(self):
        self.required_edges = []     # [(X, Y), ...]
        self.forbidden_edges = []    # [(X, Y), ...]
        self.required_orientations = []  # [(X, Y), ...] meaning X -> Y
        self.tiers = {}              # {var: tier_number}
    
    def add_airside_constraints(self):
        """
        Domain knowledge for airside causal structure.
        """
        # Physical causation (cannot be reversed)
        self.required_orientations.extend([
            ('weather', 'surface_condition'),
            ('weather', 'visibility'),
            ('ego_speed', 'stopping_distance'),
            ('surface_condition', 'stopping_distance'),
            ('braking_force', 'deceleration'),
        ])
        
        # Temporal ordering (cause precedes effect)
        self.tiers = {
            'weather': 0, 'surface_condition': 0,
            'atc_instruction': 1,
            'aircraft_state': 2, 'crew_position': 2,
            'ego_perception': 3,
            'ego_decision': 4,
            'ego_action': 5,
            'outcome': 6,
        }
        
        # Forbidden edges (no direct causal link)
        self.forbidden_edges.extend([
            ('outcome', 'weather'),        # outcome cannot cause weather
            ('ego_action', 'aircraft_state'),  # ego cannot cause aircraft state
            # (aircraft is much larger and doesn't respond to GSE)
        ])
    
    def apply_constraints(self, discovered_dag):
        """
        Post-process discovered DAG with domain constraints.
        """
        dag = discovered_dag.copy()
        
        # Enforce required edges
        for (x, y) in self.required_edges:
            dag.add_edge(x, y)
        
        # Remove forbidden edges
        for (x, y) in self.forbidden_edges:
            if dag.has_edge(x, y):
                dag.remove_edge(x, y)
        
        # Enforce required orientations
        for (x, y) in self.required_orientations:
            if dag.has_edge(y, x):
                dag.remove_edge(y, x)
            dag.add_edge(x, y)
        
        # Enforce tier ordering (no backward edges)
        for u, v in list(dag.edges()):
            if self.tiers.get(u, 0) > self.tiers.get(v, 0):
                dag.remove_edge(u, v)
                # Optionally reverse
                dag.add_edge(v, u)
        
        return dag
```

### 4.5 Time-Series Causal Discovery

Driving data is inherently temporal. Time-series causal discovery methods exploit temporal ordering (causes precede effects) for stronger identification.

**Granger Causality** (Granger, 1969):
- X Granger-causes Y if past values of X improve prediction of Y beyond past values of Y alone
- Linear, fast, but captures only predictive relationships (not true causation)
- Useful as a screening tool: "does aircraft heading Granger-cause ego brake activation?"

**PCMCI** (Runge et al., Science Advances 2019):
- Combines PC algorithm with momentary conditional independence testing
- Handles autocorrelation and high-dimensional time series
- State of the art for time-series causal discovery in climate science; applicable to driving

```python
# PCMCI for airside time-series causal discovery
# Using tigramite library

"""
Example: Discovering causal relationships from fleet driving logs.

Variables (sampled at 10 Hz from driving logs):
  - ego_speed
  - ego_steering_angle
  - nearest_agent_distance
  - nearest_agent_velocity
  - brake_command
  - perception_confidence
  - surface_friction_estimate

Question: What causes brake_command? Is it nearest_agent_distance 
          directly, or is it mediated by perception_confidence?
"""

def run_pcmci_on_fleet_data(dataframe, var_names, tau_max=20):
    """
    Args:
        dataframe: np.array of shape (T, N) -- T timesteps, N variables
        var_names: list of variable names
        tau_max: maximum time lag to consider (20 steps = 2s at 10Hz)
    
    Returns:
        Causal graph with time-lagged edges
    """
    import tigramite
    from tigramite.pcmci import PCMCI
    from tigramite.independence_tests.parcorr import ParCorr
    
    # Setup
    data = tigramite.data_processing.DataFrame(
        dataframe, var_names=var_names
    )
    parcorr = ParCorr(significance='analytic')
    pcmci = PCMCI(dataframe=data, cond_ind_test=parcorr)
    
    # Run PCMCI
    results = pcmci.run_pcmci(tau_max=tau_max, pc_alpha=0.05)
    
    # results['graph'] contains the causal graph
    # results['val_matrix'] contains effect strengths
    # results['p_matrix'] contains p-values
    
    return results
```

**Expected discoveries from airside fleet data:**

| Causal Relationship | Expected Lag | Interpretation |
|---|---|---|
| nearest_agent_distance → brake_command | 3-8 steps (0.3-0.8s) | Perception-to-action latency |
| ego_speed → brake_command | 0-2 steps | Speed directly influences brake decisions |
| perception_confidence → brake_command | 1-5 steps | Low confidence triggers earlier braking |
| surface_friction → stopping_distance | 0 steps | Instantaneous physical relationship |
| ATC_instruction → aircraft_state | 50-200 steps (5-20s) | Delay between instruction and aircraft response |
| turnaround_phase → crew_density | 100+ steps | Turnaround progression causes crew movement |

### 4.6 Interventional Data from Simulation

Observational fleet data has a fundamental limitation: confounders. Simulation provides interventional data -- we can do(X=x) and observe the effect on Y, eliminating confounding.

```python
class SimulationInterventionEngine:
    """
    Generate interventional data from airport digital twin.
    
    For each scenario, create interventional variants by changing
    one variable at a time while holding all others fixed.
    
    See also: 30-autonomy-stack/simulation/airport-digital-twins.md
    """
    
    def __init__(self, simulator):
        self.sim = simulator
    
    def generate_interventional_data(self, base_scenario, 
                                       interventions):
        """
        Run simulation with systematic interventions.
        
        Args:
            base_scenario: reference scenario parameters
            interventions: list of (variable, values) pairs
        
        Returns:
            Dataset of (intervention, outcome) pairs for causal estimation
        """
        results = []
        
        for variable, values in interventions:
            for value in values:
                # Set the intervention
                scenario = base_scenario.copy()
                scenario[variable] = value  # do(variable = value)
                
                # Run simulation multiple times (for noise averaging)
                for seed in range(100):
                    scenario['random_seed'] = seed
                    outcome = self.sim.run(scenario)
                    results.append({
                        'intervention_variable': variable,
                        'intervention_value': value,
                        'seed': seed,
                        'outcome': outcome,
                    })
        
        return results
    
    # Example usage:
    # interventions = [
    #     ('ego_speed', [5, 10, 15, 20, 25]),        # km/h
    #     ('crew_distance', [5, 10, 15, 20, 30]),     # meters
    #     ('surface_friction', [0.3, 0.5, 0.7, 0.9]), # mu
    #     ('visibility', [50, 100, 200, 500]),          # meters
    #     ('perception_latency', [0.1, 0.3, 0.5, 0.8, 1.0]), # seconds
    # ]
    #
    # This generates 5 * 5 * 4 * 4 * 5 * 100 = 200,000 runs
    # Each run isolates the effect of one variable
```

---

## 5. Causal Representation Learning

### 5.1 Why Causal Representations?

Standard deep learning learns representations that capture correlations in the training data. These representations break under distribution shift because they encode spurious correlations alongside causal features.

**Causal representation learning** aims to learn representations where:
1. Each latent dimension corresponds to an independent causal mechanism
2. Interventions on one mechanism don't affect others (Independent Causal Mechanisms principle, Scholkopf et al. 2021)
3. The representation is invariant to spurious correlations that change across environments

**For airside AV:** A causal representation would separate "features that predict obstacles because of physics" from "features that predict obstacles because of airport-specific layout correlations." The former transfers across airports; the latter does not.

### 5.2 Independent Causal Mechanisms (ICM) Principle

Scholkopf et al. (2021) articulated the ICM principle:

> The causal generative process of a system's variables is composed of autonomous modules that do not inform or influence each other. In the probabilistic case, this means that the conditional distribution of each variable given its causes (i.e., its causal mechanism) does not inform or influence the other mechanisms.

**Mathematically:**
```
P(X_1, ..., X_n) = PROD_i P(X_i | PA_i)

The ICM principle states that changing one mechanism P(X_j | PA_j)
does not change any other P(X_i | PA_i) for i != j.
```

**For driving representations:**

```
Causal factorization:
P(scene) = P(layout) * P(agents | layout) * P(weather) * P(lighting | weather, time)
                                                              
Changing P(weather) at Airport B (Arizona) vs Airport A (Seattle)
should NOT change P(agents | layout) -- how agents move given the layout
is a separate, invariant mechanism.

A correlational model learns P(scene) jointly.
A causal model learns each factor independently.
```

### 5.3 CITRIS: Causal Identifiability from Temporal Sequences

**CITRIS** (Lippe et al., ICML 2022) learns causally disentangled representations from temporal sequences with interventional targets:

```
Input: Sequence of observations (x_t, x_{t+1}, ...) with known interventions
Output: Disentangled latent factors z_1, ..., z_k where each z_i corresponds 
        to a separate causal variable

Architecture:
  Encoder: x_t → z_t (variational)
  Transition: z_t → z_{t+1} (sparse, causal)
  Decoder: z_t → x_t (reconstruction)
  
Key innovation: Uses intervention targets as supervision to identify which 
latent dimensions correspond to which causal factors.
```

**Application to airside:**
- Intervention targets are known from fleet operation logs (brake events, speed changes, route modifications)
- CITRIS can learn to separate: ego dynamics, agent dynamics, environmental factors, perception uncertainty
- Each learned factor should transfer independently across airports

### 5.4 CaRL: Causal Representation Learning Framework

**Causal Representation Learning (CaRL)** (Scholkopf, 2021) provides the theoretical framework:

| Concept | Definition | Driving Application |
|---------|-----------|-------------------|
| **Causal variables** | Ground-truth generative factors | Ego state, agent states, weather, surface |
| **Observed variables** | Sensor measurements | LiDAR points, images, IMU |
| **Causal model** | SCM over causal variables | Driving dynamics model |
| **Representation function** | Maps observations to causal variables | Perception backbone |
| **Identifiability** | Can we recover causal variables from observations? | Can we disentangle physics from airport-specific correlations? |

**Identifiability conditions** (Hyvarinen et al., 2019):
- Nonlinear ICA (Independent Component Analysis) can identify causal factors under:
  1. Time-contrastive learning (TCL): temporal structure provides supervision
  2. Permutation contrastive learning (PCL): auxiliary information about interventions
  3. Multi-environment data: distribution shifts across environments identify invariant factors

### 5.5 ICA-Based Causal Feature Learning

**Nonlinear ICA** (Hyvarinen and Morioka, 2016, 2017) recovers independent causal factors from mixed observations:

```python
class CausalFeatureLearner:
    """
    Learn causally disentangled features from multi-airport driving data.
    
    Uses nonlinear ICA with domain labels as auxiliary variables.
    """
    
    def __init__(self, input_dim, latent_dim, n_domains):
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, latent_dim)
        )
        
        # Domain-conditional prior (enables identifiability)
        self.prior_nets = nn.ModuleList([
            nn.Sequential(
                nn.Linear(n_domains, 64),  # domain one-hot
                nn.ReLU(),
                nn.Linear(64, latent_dim * 2)  # mean and log-var
            )
        ])
    
    def forward(self, x, domain_label):
        """
        Encode observation x with domain label u.
        
        The domain label acts as auxiliary variable that makes
        the latent factors identifiable (Hyvarinen 2019).
        """
        z = self.encoder(x)
        
        # Domain-conditional prior parameters
        prior_params = self.prior_nets[0](domain_label)
        prior_mean, prior_logvar = prior_params.chunk(2, dim=-1)
        
        # TCL loss: maximize log-likelihood under domain-conditional prior
        loss = -0.5 * torch.sum(
            prior_logvar + (z - prior_mean)**2 / torch.exp(prior_logvar)
        )
        
        return z, loss
```

### 5.6 DiffuseVAE and Causal Generative Models

Causal generative models combine VAEs or diffusion models with causal structure in the latent space:

```
Standard VAE:     z ~ N(0, I)  →  Decoder  →  x
                  (unstructured latent)

Causal VAE:       z ~ SCM      →  Decoder  →  x
                  (structured by causal DAG)

DiffuseVAE:       z ~ SCM      →  Diffusion  →  x
                  (causal latent + diffusion generation)
```

**CausalVAE** (Yang et al., CVPR 2021):
- Encodes an SCM in the latent space
- Each latent dimension corresponds to a causal factor
- Structural equations in latent space enforce causal relationships
- Enables counterfactual generation: change one factor, generate the result

**Application to airside data augmentation:**
- Train CausalVAE on driving scenarios with labeled causal factors
- Generate counterfactual scenes: "same layout but wet surface" or "same turnaround but different aircraft type"
- These counterfactual scenes maintain physical consistency because of the causal structure

### 5.7 Learning Invariant Features for Cross-Airport Transfer

The key application for reference airside AV stack: learn representations that transfer across airports by isolating causal (invariant) features from airport-specific (spurious) features.

```python
class InvariantRiskMinimization:
    """
    IRM (Arjovsky et al., 2019) learns representations that are 
    simultaneously optimal across all training environments.
    
    If a feature is useful at Airport A and Airport B, it's likely causal.
    If it's useful at Airport A but not Airport B, it's likely spurious.
    """
    
    def __init__(self, feature_extractor, classifier):
        self.phi = feature_extractor   # shared representation
        self.w = classifier            # classifier on top
    
    def loss(self, data_per_environment):
        """
        IRM objective:
        min_{phi, w} SUM_e R_e(w ∘ phi) 
        subject to: w in argmin_{w'} R_e(w' ∘ phi) for all e
        
        Practical penalty form (IRMv1):
        min_{phi, w} SUM_e [ R_e(w ∘ phi) + lambda * ||grad_w R_e(w ∘ phi)||^2 ]
        
        The gradient penalty ensures that w=1.0 (identity) is optimal
        in ALL environments simultaneously, meaning phi has learned
        an invariant representation.
        """
        total_loss = 0.0
        total_penalty = 0.0
        
        for env_data in data_per_environment:
            x, y = env_data
            features = self.phi(x)
            logits = self.w(features)
            
            # Standard loss
            env_loss = F.cross_entropy(logits, y)
            total_loss += env_loss
            
            # IRM penalty: gradient of loss w.r.t. scalar w should be zero
            # (meaning the representation is optimal regardless of w)
            grad = torch.autograd.grad(
                env_loss, self.w.parameters(), 
                create_graph=True
            )[0]
            total_penalty += torch.sum(grad ** 2)
        
        return total_loss + self.lambda_irm * total_penalty
```

**Cross-reference:** See `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md` for the operational framework for cross-airport transfer. IRM and causal representation learning provide the theoretical foundation for why PointLoRA fine-tuning with 500-1000 frames works: the base model has already learned causal features from pre-training, and only the airport-specific (non-causal) adaptation needs fine-tuning.

---

## 6. Causal Planning and Decision-Making

### 6.1 Causal Model-Based Planning

Standard model-based planning optimizes:

```
pi* = argmax_pi E[R | pi]  (maximize expected reward under policy pi)
```

**Causal model-based planning** optimizes:

```
pi* = argmax_pi E[R | do(pi)]  (maximize expected reward under intervention do(pi))
```

The difference is subtle but critical: E[R|pi] conditions on policy (associational), while E[R|do(pi)] intervenes with policy (causal). The interventional formulation correctly handles confounders between action selection and outcomes.

**Example of the distinction:**

```
Observation: Vehicles that drive slowly near Gate 5 have fewer incidents.
Associational: E[incidents | slow_speed] = low  ← could be confounded
               (maybe cautious drivers both drive slowly AND are better at 
                avoiding incidents, but speed isn't the cause)
Causal: E[incidents | do(slow_speed)] = ?   ← the actual effect of slowing down
        (if we force all vehicles to slow down, what happens to incidents?)
```

For an AV planner, the action is deterministic given the policy, so the distinction matters primarily when:
1. Evaluating policies from logged data (offline policy evaluation)
2. Handling hidden confounders in expert demonstrations (imitation learning)
3. Reasoning about other agents' responses to ego actions

### 6.2 Potential Outcomes Framework (Rubin Causal Model)

The **potential outcomes** framework (Rubin, 1974) provides an alternative to SCMs for causal reasoning about actions:

```
For each unit i and treatment a:
  Y_i(a) = potential outcome if unit i receives treatment a

Causal effect of action a vs a':
  tau_i = Y_i(a) - Y_i(a')  -- individual treatment effect (ITE)
  ATE = E[Y(a) - Y(a')]     -- average treatment effect

Fundamental problem of causal inference:
  We only observe Y_i(a) for the action a that was actually taken.
  Y_i(a') for the action NOT taken is a counterfactual.
```

**Application to driving action selection:**

```python
class PotentialOutcomePlanner:
    """
    Select actions by estimating potential outcomes (causal effects).
    
    For each candidate action, estimate the counterfactual outcome
    using the potential outcomes framework.
    """
    
    def __init__(self, outcome_model):
        self.model = outcome_model  # estimates E[Y(a) | X=x]
    
    def select_action(self, state, candidate_actions):
        """
        Select action with best estimated potential outcome.
        
        Args:
            state: current driving state (ego + scene)
            candidate_actions: list of possible actions
        
        Returns:
            Best action according to causal effect estimation
        """
        best_action = None
        best_outcome = float('-inf')
        
        for action in candidate_actions:
            # Estimate E[Y(action) | state]
            # This is the CAUSAL effect of taking this action,
            # not the association between this action and outcomes
            potential_outcome = self.model.predict_potential_outcome(
                state, action
            )
            
            # Score combines safety, efficiency, comfort
            score = (
                -100.0 * potential_outcome['collision_prob']
                + 10.0 * potential_outcome['progress']
                - 5.0 * potential_outcome['discomfort']
                - 20.0 * potential_outcome['near_miss_prob']
            )
            
            if score > best_outcome:
                best_outcome = score
                best_action = action
        
        return best_action
```

### 6.3 Offline Policy Evaluation with Causal Inference

Before deploying a new planning policy, we want to evaluate it using logged data from the current policy. This is **off-policy evaluation** -- a causal inference problem.

**Inverse Propensity Weighting (IPW):**

```
V(pi_new) = (1/n) SUM_i [ pi_new(a_i | s_i) / pi_old(a_i | s_i) ] * R_i

Where:
  pi_new(a | s) = probability of new policy taking action a in state s
  pi_old(a | s) = probability of logged (old) policy taking action a in state s
  R_i           = observed reward for logged data point i
```

**Doubly Robust (DR) estimator** (Dudik et al., 2011) -- combines IPW with a model-based estimate for lower variance:

```
V_DR(pi_new) = (1/n) SUM_i [
    Q_hat(s_i, a_i)  +  
    [pi_new(a_i|s_i) / pi_old(a_i|s_i)] * (R_i - Q_hat(s_i, a_i))
]

Where Q_hat is a learned value function (model-based component)
```

**Application:** Evaluate a neural planner using logged Frenet planner data without deployment.

```python
class OffPolicyEvaluator:
    """
    Evaluate new planning policy using logged data from current policy.
    
    Uses doubly-robust estimation to handle confounding between
    the logging policy's action selection and outcomes.
    """
    
    def __init__(self, value_model, logging_policy):
        self.Q = value_model          # Q(s, a) estimator
        self.pi_old = logging_policy  # behavior policy
    
    def evaluate(self, new_policy, logged_data):
        """
        Estimate V(new_policy) from logged data.
        
        Args:
            new_policy: pi_new(a | s)
            logged_data: list of (state, action, reward) from pi_old
        
        Returns:
            Estimated value of new_policy with confidence interval
        """
        estimates = []
        
        for state, action, reward in logged_data:
            # Propensity ratio
            w = new_policy.prob(action, state) / self.pi_old.prob(action, state)
            
            # Clamp weights for stability (common practice)
            w = np.clip(w, 0.01, 100.0)
            
            # Doubly robust estimate
            q_hat = self.Q.predict(state, action)
            dr_estimate = q_hat + w * (reward - q_hat)
            estimates.append(dr_estimate)
        
        # Return mean and confidence interval
        mean_v = np.mean(estimates)
        se = np.std(estimates) / np.sqrt(len(estimates))
        return {
            'value_estimate': mean_v,
            'ci_lower': mean_v - 1.96 * se,
            'ci_upper': mean_v + 1.96 * se,
        }
```

### 6.4 Treatment Effect Heterogeneity

The causal effect of an action varies across contexts -- this is **treatment effect heterogeneity** or **Conditional Average Treatment Effect (CATE)**:

```
CATE(x) = E[Y(a=1) - Y(a=0) | X=x]

"The effect of emergency braking depends on the context:
 - At 25 km/h on dry surface: CATE = -0.95 (almost certainly prevents collision)
 - At 25 km/h on wet surface: CATE = -0.70 (usually prevents collision)
 - At 15 km/h on dry surface: CATE = -0.99 (definitely prevents collision)
 - At 5 km/h: CATE = -0.30 (collision avoidable even without e-brake)"
```

**Methods for CATE estimation:**

| Method | Approach | Strength |
|--------|----------|----------|
| **Causal Forest** (Wager & Athey, 2018) | Random forest with causal splitting criterion | Non-parametric, interpretable, confidence intervals |
| **BART** (Bayesian Additive Regression Trees) | Bayesian tree ensemble | Handles heterogeneity, uncertainty quantification |
| **T-Learner** | Separate models for treatment and control | Simple, works with any base model |
| **S-Learner** | Single model with treatment as feature | Data-efficient, but can miss heterogeneity |
| **X-Learner** (Kunzel et al., 2019) | Two-stage with cross-fitting | Best for imbalanced treatment groups |
| **DragonNet** (Shi et al., 2019) | Neural net with treatment head | End-to-end, handles high-dimensional features |

**Airside application:** Different contexts require different actions. A causal forest can learn that "yield" is the best action near active pushbacks but "proceed at reduced speed" is sufficient near parked aircraft, even when the raw feature correlations are similar.

### 6.5 Integration with Frenet Planner: Causal Cost Function

The most practical near-term integration is augmenting the existing Frenet planner's cost function with causal terms:

```python
class CausalAugmentedFrenetCost:
    """
    Augment the Frenet planner's cost function with causal terms.
    
    Standard Frenet cost: 
      C = w_s * C_speed + w_d * C_deviation + w_j * C_jerk + w_o * C_obstacle
    
    Causal augmentation adds:
      C_causal = w_c * C_causal_effect + w_cf * C_counterfactual_risk
    
    See also: 30-autonomy-stack/planning/frenet-planner-augmentation.md
    """
    
    def __init__(self, causal_model, counterfactual_analyzer):
        self.causal_model = causal_model
        self.cf_analyzer = counterfactual_analyzer
    
    def causal_cost(self, trajectory, scene_state):
        """
        Compute causal cost for a candidate trajectory.
        
        Unlike standard obstacle cost (which is correlational: 
        "how close am I to obstacles?"), causal cost asks:
        "what would the OUTCOME be if I take this trajectory?"
        """
        cost = 0.0
        
        for t, (ego_state, agents) in enumerate(
            zip(trajectory, scene_state.future_agents)
        ):
            # Interventional prediction:
            # P(collision | do(ego_trajectory = this_trajectory))
            # Not just P(collision | ego_near_agent)
            collision_prob = self.causal_model.predict_outcome(
                ego_state=ego_state,
                agent_states=agents,
                intervention='ego_follows_trajectory'
            )
            
            cost += collision_prob * 1000.0  # high weight for collision
            
            # Counterfactual risk:
            # "If the agent deviated from predicted behavior, 
            #  would this trajectory still be safe?"
            for agent in agents:
                cf_outcomes = self.cf_analyzer.agent_deviation_risk(
                    ego_state, agent,
                    deviations=['sudden_stop', 'sudden_turn', 
                               'step_into_path']
                )
                worst_case = max(cf_outcomes.values())
                cost += worst_case * 100.0
        
        return cost
```

**Cross-reference:** See `30-autonomy-stack/planning/frenet-planner-augmentation.md` for the full Frenet cost function and integration architecture.

---

## 7. Causal Safety Analysis

### 7.1 Actual Causation: Halpern-Pearl Definition

When an incident occurs, we need to determine *what actually caused it*. The **Halpern-Pearl (HP) definition of actual causation** (2005, updated 2015) formalizes this:

**Definition (HP Actual Cause):**
X = x is an actual cause of Y = y in context u if:
1. **(AC1)** X = x and Y = y in the actual world
2. **(AC2)** There exists a set W of variables and a setting (x', w') such that:
   - Setting X = x' and W = w' results in Y != y (counterfactual change)
   - For any subset of W set to their actual values, Y still changes when X is changed
3. **(AC3)** X is minimal -- no proper subset of X satisfies AC1-AC2

```python
class HalpernPearlCausation:
    """
    Determine actual causation using Halpern-Pearl definition.
    
    Used for incident investigation: "What caused the collision?"
    """
    
    def __init__(self, scm, evidence):
        self.scm = scm
        self.evidence = evidence  # actual world observations
    
    def is_actual_cause(self, candidate_X, candidate_x, 
                        outcome_Y, outcome_y):
        """
        Test whether X=x is an actual cause of Y=y.
        
        Args:
            candidate_X: variable name (e.g., 'perception_latency')
            candidate_x: actual value (e.g., 0.8 seconds)
            outcome_Y: outcome variable (e.g., 'collision')
            outcome_y: actual outcome value (e.g., True)
        
        Returns:
            bool: whether X=x is an actual cause of Y=y
        """
        # AC1: Both hold in the actual world
        actual_values = self.scm.compute(self.evidence)
        if actual_values[candidate_X] != candidate_x:
            return False
        if actual_values[outcome_Y] != outcome_y:
            return False
        
        # AC2: Find contingency (W, x', w') that shows causal effect
        other_vars = [v for v in self.scm.endogenous 
                     if v != candidate_X and v != outcome_Y]
        
        for W_subset in self._powerset(other_vars):
            # Try changing X to a different value
            for x_prime in self._alternative_values(candidate_X):
                if x_prime == candidate_x:
                    continue
                
                # Get actual values of W
                w_actual = {w: actual_values[w] for w in W_subset}
                
                # Compute counterfactual with X=x' and W=w_actual
                cf_values = self.scm.counterfactual(
                    intervention={candidate_X: x_prime, **w_actual},
                    evidence=self.evidence
                )
                
                if cf_values[outcome_Y] != outcome_y:
                    # AC2 part 1 satisfied: changing X changes Y
                    
                    # Check AC2 part 2: monotonicity condition
                    # (for robustness of the causal claim)
                    if self._check_monotonicity(
                        candidate_X, x_prime, W_subset, 
                        w_actual, outcome_Y, outcome_y
                    ):
                        # AC3: minimality (check no proper subset works)
                        return True
        
        return False
    
    def find_all_actual_causes(self, outcome_Y, outcome_y):
        """
        Find ALL actual causes of the outcome.
        
        Returns list of (variable, value) pairs that are actual causes.
        """
        causes = []
        for var in self.scm.endogenous:
            if var == outcome_Y:
                continue
            actual_val = self.scm.compute(self.evidence)[var]
            if self.is_actual_cause(var, actual_val, outcome_Y, outcome_y):
                causes.append((var, actual_val))
        return causes
```

### 7.2 Responsibility and Blame in Multi-Agent Scenarios

Halpern and Pearl (2005) extended actual causation to quantify **degree of responsibility** and **blame**:

**Degree of Responsibility:**
```
dr(X=x, Y=y) = 1 / (1 + k)

Where k = minimum number of changes to other variables needed to make
          X=x a but-for cause of Y=y

If k=0: X=x is a but-for cause (full responsibility, dr=1)
If k=1: One other change needed (dr=0.5)
If k=2: Two other changes needed (dr=0.33)
```

**Example -- Multi-agent airside collision:**

```
Scenario: Ego vehicle collides with ground crew member who stepped out
from behind a baggage cart while ego was traveling at 18 km/h 
(limit: 15 km/h) on a wet surface.

Candidate causes and responsibility:

1. Ego speed (18 km/h vs 15 km/h limit):
   - Counterfactual: at 15 km/h, would vehicle have stopped in time?
   - Computation: stopping_distance(18) = 8.2m, stopping_distance(15) = 5.8m
   - Crew was 6.5m away when detected
   - At 15 km/h: would have stopped at 5.8m → NO collision
   - k=0 (but-for cause): dr = 1.0

2. Perception latency (0.7s vs design target 0.3s):
   - Counterfactual: with 0.3s latency, would vehicle have stopped?
   - At 18 km/h with 0.3s latency: stopping_distance = 6.0m
   - Crew at 6.5m → SAFE (barely)
   - k=0 (but-for cause): dr = 1.0

3. Wet surface (mu=0.5 vs dry mu=0.7):
   - Counterfactual: on dry surface at 18 km/h with 0.7s latency?
   - stopping_distance = 6.4m → barely SAFE
   - k=0 (but-for cause, given other conditions): dr = 1.0

4. Crew member stepping out (immediate vs signaling):
   - If crew had paused at cart edge for 1s: ego would have detected + stopped
   - k=0: dr = 1.0

Result: Multiple but-for causes exist. EACH is individually sufficient 
to have prevented the collision if changed alone.
```

**Blame** incorporates the agent's epistemic state:

```
blame(X=x, Y=y) = SUM_{s in S} Pr(s) * dr_s(X=x, Y=y)

Where S = set of possible world states and Pr(s) = agent's belief about state

"Did the agent KNOW (or should have known) that their action would cause harm?"

Ego vehicle blame: High, because:
- It knew it was over speed limit (ego speed is a controlled variable)
- It should have known perception latency was elevated (system monitoring)
- Wet surface information was available from sensors

Crew member blame: Lower, because:
- Crew may not have been aware of the vehicle's approach
- Stepping out from behind cart is common behavior (not negligent per se)
- But: if crew was trained to check for AVs, blame increases
```

### 7.3 But-For Causation vs NESS Test

Two competing legal causation standards apply:

**But-For Causation** (counterfactual test):
```
X caused Y if and only if: but for X, Y would not have occurred.

P(Y | do(not-X)) = 0  →  X is a but-for cause of Y
```

Problem: **overdetermination**. If two sufficient causes exist independently, neither is a but-for cause (because removing either one still leaves the other sufficient).

**NESS Test** (Necessary Element of a Sufficient Set, Wright 1985):
```
X is a cause of Y if X is a necessary element of some sufficient set 
of conditions for Y.

X caused collision if X was part of a set of conditions {X, A, B} that 
was sufficient for collision, AND removing X from that set makes it 
insufficient.
```

The NESS test handles overdetermination better and is increasingly adopted in tort law.

**Formalization for incident analysis:**

```python
class LegalCausationAnalyzer:
    """
    Analyze causation using both but-for and NESS standards.
    
    Used for insurance/liability determination and regulatory compliance.
    """
    
    def but_for_test(self, scm, evidence, candidate, outcome):
        """
        But-for test: would the outcome have occurred without the candidate?
        """
        # Counterfactual: remove/negate the candidate cause
        cf_evidence = evidence.copy()
        cf_evidence[candidate] = self._negate(candidate, evidence[candidate])
        
        cf_outcome = scm.counterfactual(cf_evidence)
        
        return {
            'is_but_for_cause': cf_outcome[outcome] != evidence[outcome],
            'actual_outcome': evidence[outcome],
            'counterfactual_outcome': cf_outcome[outcome],
        }
    
    def ness_test(self, scm, evidence, candidate, outcome):
        """
        NESS test: is the candidate a necessary element of a sufficient set?
        """
        # Find all minimal sufficient sets for the outcome
        sufficient_sets = self._find_sufficient_sets(scm, evidence, outcome)
        
        # Check if candidate is necessary in any sufficient set
        for ss in sufficient_sets:
            if candidate in ss:
                # Is candidate necessary for this set's sufficiency?
                reduced_set = ss - {candidate}
                if not self._is_sufficient(scm, reduced_set, evidence, outcome):
                    return {
                        'is_ness_cause': True,
                        'sufficient_set': ss,
                        'role': 'necessary element',
                    }
        
        return {'is_ness_cause': False}
```

### 7.4 Counterfactual Safety Testing

Beyond incident investigation, counterfactual reasoning enables **proactive safety testing**:

```
"Would the accident have happened if..."
  - ...the perception latency was 2x worse?     (robustness test)
  - ...the surface was wet?                       (environmental test)
  - ...there was an additional agent?              (complexity test)
  - ...the agent behaved unexpectedly?             (adversarial test)
  - ...the safety system had failed?               (fault injection test)
```

This is directly related to ISO 34502 scenario-based testing (see `60-safety-validation/verification-validation/airside-scenario-taxonomy.md`) but adds the causal dimension: instead of just testing "what happens in scenario X?", we ask "what *would* happen if we changed one factor in observed scenario Y?"

```python
class CounterfactualSafetyTester:
    """
    Generate safety-relevant counterfactual scenarios from recorded data.
    
    Takes real driving logs and generates "what if" variants.
    """
    
    def __init__(self, scm, vehicle_model):
        self.scm = scm
        self.vehicle = vehicle_model
    
    def generate_counterfactual_tests(self, recorded_scenario):
        """
        Generate counterfactual variants of a recorded scenario.
        
        For each recorded safe scenario, ask: "What changes would 
        have made this unsafe?"
        
        Returns list of (intervention, predicted_outcome) pairs.
        """
        tests = []
        
        # Category 1: Degrade perception
        for latency_factor in [1.5, 2.0, 3.0, 5.0]:
            test = self._counterfactual(
                recorded_scenario,
                intervention={'perception_latency': 
                    recorded_scenario['perception_latency'] * latency_factor}
            )
            tests.append({
                'category': 'perception_degradation',
                'description': f'Perception latency {latency_factor}x worse',
                'intervention': {'perception_latency_factor': latency_factor},
                'outcome': test['outcome'],
                'safety_margin': test['min_clearance'],
            })
        
        # Category 2: Environmental change
        for surface in ['wet', 'icy', 'oily']:
            friction = {'wet': 0.5, 'icy': 0.2, 'oily': 0.3}[surface]
            test = self._counterfactual(
                recorded_scenario,
                intervention={'surface_friction': friction}
            )
            tests.append({
                'category': 'environmental',
                'description': f'Surface condition: {surface}',
                'intervention': {'surface_friction': friction},
                'outcome': test['outcome'],
                'safety_margin': test['min_clearance'],
            })
        
        # Category 3: Agent behavior deviation
        for agent_idx, agent in enumerate(recorded_scenario['agents']):
            # What if agent suddenly stopped?
            test = self._counterfactual(
                recorded_scenario,
                intervention={f'agent_{agent_idx}_behavior': 'sudden_stop'}
            )
            tests.append({
                'category': 'agent_deviation',
                'description': f'Agent {agent_idx} sudden stop',
                'outcome': test['outcome'],
            })
            
            # What if agent stepped into path?
            test = self._counterfactual(
                recorded_scenario,
                intervention={f'agent_{agent_idx}_behavior': 'step_into_path'}
            )
            tests.append({
                'category': 'agent_deviation',
                'description': f'Agent {agent_idx} steps into path',
                'outcome': test['outcome'],
            })
        
        # Category 4: Fault injection
        for system in ['lidar_primary', 'imu', 'rtk_gps', 'brake_actuator']:
            test = self._counterfactual(
                recorded_scenario,
                intervention={f'{system}_fault': True}
            )
            tests.append({
                'category': 'fault_injection',
                'description': f'{system} failure',
                'outcome': test['outcome'],
            })
        
        return tests
```

### 7.5 EU AI Act Requirements for Causal Explanations

The EU AI Act (Regulation 2024/1689) imposes specific requirements that causal reasoning can address:

| Article | Requirement | How Causal Reasoning Helps |
|---------|------------|--------------------------|
| Art. 13(1) | Transparency: "enable deployers to interpret the system's output" | Causal explanations ("stopped because crew detected on collision path") are interpretable |
| Art. 14(4) | Human oversight: "correctly interpret the AI system's output" | Causal chain from perception to decision enables human verification |
| Art. 9(2)(a) | Risk management: "identification and analysis of the known and the reasonably foreseeable risks" | Counterfactual analysis identifies what-if risks systematically |
| Art. 9(7) | Residual risk: "due consideration of the reasonably foreseeable misuse" | Causal models predict outcomes under misuse scenarios |
| Art. 72 | Post-market monitoring: "analysis of the root causes of serious incidents" | Halpern-Pearl actual causation provides formal root cause analysis |

### 7.6 Airside Incident Reconstruction

A complete incident reconstruction pipeline using causal models:

```python
class AirsideIncidentReconstructor:
    """
    Reconstruct and analyze airside incidents using causal models.
    
    Pipeline:
    1. Extract data from rosbag
    2. Build scenario-specific SCM
    3. Determine actual causes (Halpern-Pearl)
    4. Generate counterfactual explanations
    5. Produce certification-grade report
    
    Cross-reference: 60-safety-validation/safety-case/safety-incidents-lessons.md
    """
    
    def reconstruct(self, rosbag_path):
        """Full reconstruction pipeline."""
        
        # 1. Extract timeline from rosbag
        timeline = self.extract_timeline(rosbag_path)
        # Returns: timestamped ego states, agent detections, 
        #          decisions, actuator commands
        
        # 2. Build scenario-specific SCM
        scm = self.build_scm(timeline)
        
        # 3. Determine actual causes
        actual_causes = HalpernPearlCausation(
            scm, timeline.evidence
        ).find_all_actual_causes(
            outcome_Y='incident_outcome',
            outcome_y=timeline.outcome
        )
        
        # 4. Generate counterfactual explanations
        counterfactuals = []
        for cause_var, cause_val in actual_causes:
            # What is the minimum change to this cause that 
            # would have prevented the incident?
            min_change = self.minimum_sufficient_change(
                scm, timeline, cause_var, cause_val
            )
            counterfactuals.append({
                'cause': cause_var,
                'actual_value': cause_val,
                'minimum_change': min_change,
                'explanation': self.generate_natural_language(
                    cause_var, cause_val, min_change
                )
            })
        
        # 5. Responsibility assignment
        responsibilities = {}
        for cause_var, cause_val in actual_causes:
            dr = self.compute_responsibility(
                scm, timeline, cause_var, cause_val
            )
            responsibilities[cause_var] = dr
        
        return {
            'timeline': timeline,
            'actual_causes': actual_causes,
            'counterfactuals': counterfactuals,
            'responsibilities': responsibilities,
            'report': self.generate_report(
                timeline, actual_causes, 
                counterfactuals, responsibilities
            ),
        }
    
    def generate_natural_language(self, cause_var, cause_val, min_change):
        """
        Generate human-readable causal explanation.
        
        Examples:
        - "The collision occurred because perception latency was 0.8s 
           (threshold for avoidance: 0.5s). Braking 0.3s earlier would 
           have provided sufficient stopping distance."
        - "The near-miss was caused by ego speed of 18 km/h combined 
           with wet surface (mu=0.5). At the posted limit of 15 km/h, 
           even on wet surface, the stopping distance would have been 
           5.8m vs the 6.5m available clearance."
        """
        templates = {
            'perception_latency': (
                f"Detection delay was {cause_val:.1f}s. "
                f"Reducing latency to {min_change['threshold']:.1f}s "
                f"would have provided sufficient stopping margin."
            ),
            'ego_speed': (
                f"Vehicle speed was {cause_val:.1f} km/h. "
                f"At {min_change['threshold']:.1f} km/h, the vehicle "
                f"would have stopped {min_change['margin']:.1f}m "
                f"before the collision point."
            ),
            'surface_friction': (
                f"Surface friction was {cause_val:.2f} "
                f"({'wet' if cause_val < 0.6 else 'dry'}). "
                f"On a surface with mu >= {min_change['threshold']:.2f}, "
                f"the braking distance would have been sufficient."
            ),
        }
        return templates.get(cause_var, f"{cause_var} = {cause_val}")
```

---

## 8. Causal Reasoning with LLMs

### 8.1 Chain-of-Thought as Approximate Causal Reasoning

LLM chain-of-thought (CoT) prompting produces reasoning traces that *resemble* causal reasoning but are fundamentally different:

```
CoT: "The crew member is walking toward the vehicle path → they might 
      cross → I should slow down → applying brakes"

This LOOKS causal, but it is:
- Generated by next-token prediction (pattern matching)
- Not grounded in a formal causal model
- Not guaranteed to be consistent across similar scenarios
- Not amenable to formal verification
```

**Key distinction:**
- **LLM CoT**: P(next_token | previous_tokens) -- autoregressive generation
- **Causal reasoning**: P(Y | do(X), context) -- interventional inference
- **Counterfactual reasoning**: P(Y_x' | X=x, Y=y) -- cross-world inference

LLMs perform well on many causal reasoning benchmarks (CausalBench, CLADDER) but fail on novel causal structures not seen in training. They approximate causal reasoning through pattern matching over causal language in their training data.

### 8.2 LLM + SCM: Constructing Causal Graphs from Language

A powerful hybrid: use LLMs to *construct* causal graphs from natural language descriptions, then use formal causal inference on the resulting graphs.

```python
class LLMCausalGraphBuilder:
    """
    Use LLM to construct causal DAGs from scenario descriptions.
    
    The LLM provides the graph structure; formal methods provide 
    the inference. This avoids the LLM's weakness in formal 
    causal reasoning while leveraging its strength in understanding 
    domain descriptions.
    """
    
    SYSTEM_PROMPT = """
    You are a causal reasoning assistant for airside autonomous vehicles.
    Given a scenario description, identify:
    1. The relevant causal variables
    2. The directed causal relationships between them
    3. Any hidden confounders
    
    Output as a JSON DAG:
    {
      "variables": [{"name": "...", "type": "...", "observable": true/false}],
      "edges": [{"from": "...", "to": "...", "mechanism": "..."}],
      "confounders": [{"affects": ["...", "..."], "description": "..."}]
    }
    
    Rules:
    - Edges must be directed (from cause to effect)
    - No cycles allowed
    - Physical laws are always respected (e.g., braking causes deceleration, not vice versa)
    - Temporal order must be respected (cause precedes effect)
    """
    
    def build_graph(self, scenario_text):
        """
        Build causal DAG from scenario description.
        
        Args:
            scenario_text: Natural language description of scenario
            
        Returns:
            CausalDAG object
        """
        # LLM generates initial graph
        llm_response = self.llm.generate(
            system=self.SYSTEM_PROMPT,
            user=scenario_text
        )
        dag = self.parse_dag(llm_response)
        
        # Validate against domain constraints
        dag = self.validate_dag(dag)
        
        return dag
    
    def validate_dag(self, dag):
        """
        Validate LLM-generated DAG against domain knowledge.
        
        Checks:
        1. Acyclicity
        2. Temporal ordering
        3. Physical plausibility
        4. Known required edges present
        5. Known forbidden edges absent
        """
        # Check acyclicity
        if not nx.is_directed_acyclic_graph(dag.graph):
            # Remove minimum edges to make acyclic
            dag = self._break_cycles(dag)
        
        # Check temporal ordering
        for u, v in dag.graph.edges():
            if self.temporal_order.get(v, 0) < self.temporal_order.get(u, 0):
                dag.graph.remove_edge(u, v)
                dag.graph.add_edge(v, u)  # reverse
        
        return dag
```

### 8.3 CausalGPT and Related Approaches

**CausalGPT** (Ban et al., 2023) and similar systems attempt to endow LLMs with causal reasoning:

| System | Approach | Capability | Limitation |
|--------|----------|-----------|------------|
| **CausalGPT** | Fine-tune GPT on causal reasoning tasks | Improved performance on CLADDER benchmark | Still pattern-matching, not formal inference |
| **CausalLM** (Ban et al., 2023) | LLM trained with causal objective | Better causal consistency | Requires specialized training data |
| **CLadder** (Jin et al., 2024) | Benchmark for LLM causal reasoning | Tests all 3 levels of Pearl's ladder | LLMs struggle on Level 3 (counterfactuals) |
| **Causal Parrots** (Zevcenko et al., 2023) | Analysis of LLM causal abilities | LLMs use heuristics, not true causation | Confirms fundamental limitation |

**Key finding from CLadder (Jin et al., 2024):**
- GPT-4 achieves 73% on association (Level 1)
- GPT-4 achieves 65% on intervention (Level 2)
- GPT-4 achieves 57% on counterfactual (Level 3)
- Human performance: 90%+ across all levels
- **LLMs degrade as causal complexity increases**

### 8.4 Hybrid: LLM Hypotheses + Formal Testing

The most promising approach combines LLM strengths (language understanding, hypothesis generation) with formal causal inference (mathematical correctness):

```
Pipeline:
1. LLM reads incident report / scenario description
2. LLM generates causal hypotheses as DAGs
3. Formal system tests each hypothesis against data
4. LLM interprets results and generates explanations

                  ┌──────────────────┐
                  │  Scenario Text    │
                  │  / Incident       │
                  │  Report           │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  LLM: Generate    │
                  │  Causal           │
                  │  Hypotheses       │
                  │  (as DAGs)        │
                  └────────┬─────────┘
                           │
                  ┌────────┼─────────┐
                  │        │         │
                  ▼        ▼         ▼
             Hypothesis Hypothesis Hypothesis
             DAG_1      DAG_2      DAG_3
                  │        │         │
                  └────────┼─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Formal Causal    │
                  │  Testing:         │
                  │  - Independence   │
                  │    tests          │
                  │  - Backdoor/      │
                  │    frontdoor      │
                  │  - d-separation   │
                  │  - Counterfactual │
                  │    predictions    │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Best-fitting     │
                  │  Causal Model     │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  LLM: Generate    │
                  │  Natural Language │
                  │  Explanation      │
                  └──────────────────┘
```

### 8.5 DriveCoT: Causal Explanations for Driving

**DriveCoT** (Wang et al., 2024) provides chain-of-thought reasoning specifically for driving decisions:

```
Input: Driving scene (perception output + map + ego state)

DriveCoT output:
"1. PERCEPTION: I detect a ground crew member 15m ahead, walking 
    left-to-right at 1.2 m/s, currently 2m from my path.
 2. PREDICTION: At current velocity, they will cross my path in 
    ~1.7 seconds. I will reach that point in ~2.1 seconds.
 3. CAUSAL ANALYSIS: If they maintain course and speed, we will 
    NOT collide (0.4s margin). However, if they accelerate (CAUSAL: 
    late for flight departure), margin drops to 0.1s.
 4. COUNTERFACTUAL: If I reduce speed by 5 km/h now, margin 
    increases to 1.2s even under acceleration scenario.
 5. DECISION: Reduce speed by 5 km/h. CAUSE: maintaining comfortable 
    safety margin under plausible crew behavior variations."
```

**For airside, this can be extended with domain-specific causal knowledge:**
- Aircraft engine state causes jet blast zones
- Turnaround phase causes expected crew positions
- NOTAM constraints cause route modifications
- ATC instructions cause aircraft movement patterns

### 8.6 LLM Limitations in Causal Reasoning

Critical limitations to acknowledge:

1. **No formal causal model**: LLMs have no internal SCM or DAG structure
2. **Inconsistency**: Same scenario with rephrased prompt may yield different causal conclusions
3. **Sensitivity to framing**: "X caused Y" vs "Y was caused by X" can yield different reasoning
4. **No intervention operator**: LLMs cannot truly compute do(X) -- they approximate it
5. **Hallucinated causation**: LLMs may assert causal relationships that don't exist
6. **Cannot handle novel causal structures**: If the causal mechanism isn't in the training data, LLMs fail

**Practical recommendation:** Use LLMs as a *front-end* for causal reasoning (translating between natural language and formal models) but never as the *engine* for causal inference. The formal SCM provides mathematical guarantees; the LLM provides accessibility.

---

## 9. Counterfactual Simulation

### 9.1 Counterfactual World Generation

Counterfactual simulation generates alternative versions of recorded scenarios by changing specific factors:

```
Recorded scenario: Vehicle successfully navigates around parked aircraft
                   at 12 km/h on dry surface in clear weather.

Counterfactual variants:
  CF1: Same scenario, but wet surface (mu = 0.5)
  CF2: Same scenario, but crew member emerges from behind landing gear
  CF3: Same scenario, but aircraft engine starts unexpectedly
  CF4: Same scenario, but perception confidence drops to 60%
  CF5: Same scenario, but ego speed was 20 km/h instead of 12 km/h

For each variant:
  - Replay simulation with the one changed factor
  - Keep ALL other factors identical (same agent positions, same weather, etc.)
  - Evaluate: would the outcome have changed?
```

### 9.2 KING: Counterfactual Scenario Generation

**KING** (Hanselmann et al., NeurIPS 2023) generates *kinematically consistent* counterfactual driving scenarios:

**Key contribution:** Unlike random perturbations, KING generates counterfactual agent behaviors that are kinematically feasible (obeying vehicle dynamics) and behaviorally plausible (consistent with the agent's likely goals).

```
KING Pipeline:
1. Take recorded scenario
2. Select target agent to modify
3. Optimize agent trajectory to create challenging scenario:
   - Minimize distance to ego vehicle (maximize danger)
   - Subject to kinematic constraints (feasible trajectory)
   - Subject to behavioral plausibility (not physically impossible)
4. Evaluate ego response to counterfactual scenario

Cost function:
  min_traj  d(ego_traj, agent_traj)            -- minimize clearance
  subject to:
    |a(t)| <= a_max                             -- acceleration limits
    |kappa(t)| <= kappa_max                     -- curvature limits
    traj(0) = observed_position                 -- starts from actual position
    P(traj | context) > threshold               -- behavioral plausibility
```

**Application to airside:**

| Scenario | Counterfactual Modification | KING-style Generation |
|----------|---------------------------|----------------------|
| Normal transit | Crew member diverts into path | Optimize crew trajectory to be kinematically feasible but maximally challenging |
| Pushback | Aircraft tail swing exceeds expected envelope | Generate maximally-challenging but physically feasible pushback trajectory |
| Turnaround | Baggage cart driver deviates | Optimize cart trajectory for maximum ego-vehicle challenge |
| Jet blast | Wind gust increases blast zone | Parametrically expand jet blast zone to find critical threshold |

### 9.3 Causal Confusion in Imitation Learning

**Causal confusion** (de Haan et al., ICML 2019) is a critical failure mode where imitation learning models learn to copy spurious correlations instead of true causal relationships:

```
Expert demonstration: Expert brakes when they see a red traffic light.
  True causal chain: Red light → Expert decides to brake → Brake applied
  
Spurious correlation: 
  When the car ahead brakes → the red light turns on → Expert brakes
  
Causal confusion: The IL model learns "brake when car ahead brakes" 
instead of "brake when red light is visible." 

In new situations where the car ahead brakes but the light is green,
the model incorrectly brakes.
```

**For airside imitation learning:**

| True Causal Relationship | Spurious Correlation That IL Might Learn |
|-------------------------|------------------------------------------|
| Crew in path → brake | Crew visible anywhere → brake (too conservative) |
| Active pushback → yield | Any aircraft near gate → yield (blocks transit) |
| Jet blast zone active → reroute | Engine pods visible → reroute (even when parked cold) |
| Speed limit zone → slow | Near terminal → slow (even in transit corridor) |

**Mitigation through causal reasoning:**
1. **Causal discovery on demonstrations**: Identify true causal links in expert behavior
2. **Invariant feature learning**: Train on multiple environments so spurious correlations are different but causal relationships are consistent
3. **Counterfactual data augmentation**: Generate scenarios that break the spurious correlation (red light + car doesn't brake; green light + car brakes)

### 9.4 Counterfactual Data Augmentation

Generate training data that breaks spurious correlations:

```python
class CounterfactualAugmentor:
    """
    Generate counterfactual training data to prevent causal confusion.
    
    Strategy: For each recorded scenario, generate variants that 
    break known spurious correlations while preserving the true 
    causal relationship.
    """
    
    def __init__(self, scm, simulator):
        self.scm = scm
        self.sim = simulator
    
    def augment(self, scenario, known_spurious_correlations):
        """
        Generate counterfactual variants that break spurious correlations.
        
        Args:
            scenario: recorded driving scenario
            known_spurious_correlations: list of (X, Y) pairs where 
                X correlates with Y in training data but X doesn't 
                cause Y
        
        Returns:
            List of counterfactual scenarios for training
        """
        augmented = []
        
        for (X, Y) in known_spurious_correlations:
            # Generate scenario where X is present but Y is absent
            cf_present = self.scm.counterfactual(
                evidence=scenario,
                intervention={X: 'present', Y: 'absent'}
            )
            if self._is_physically_feasible(cf_present):
                augmented.append(cf_present)
            
            # Generate scenario where X is absent but Y is present
            cf_absent = self.scm.counterfactual(
                evidence=scenario,
                intervention={X: 'absent', Y: 'present'}
            )
            if self._is_physically_feasible(cf_absent):
                augmented.append(cf_absent)
        
        return augmented
    
    # Example spurious correlations to break:
    # ('crew_visible', 'should_brake')  -- crew visible != must brake
    # ('near_gate', 'should_slow')      -- being near gate != must slow
    # ('aircraft_visible', 'pushback_active') -- seeing aircraft != pushback
```

### 9.5 Digital Twin + Causal Model for What-If Analysis

Combining the airport digital twin (see `30-autonomy-stack/simulation/airport-digital-twins.md`) with causal models enables comprehensive what-if analysis:

```python
class DigitalTwinCausalAnalyzer:
    """
    Digital twin + SCM for systematic what-if analysis.
    
    The digital twin provides high-fidelity simulation.
    The SCM provides causal structure for systematic exploration.
    Together: targeted, meaningful counterfactual scenarios.
    """
    
    def __init__(self, digital_twin, scm):
        self.twin = digital_twin
        self.scm = scm
    
    def systematic_what_if(self, base_scenario, 
                           target_variable='safety_margin'):
        """
        Systematically vary each causal parent of the target variable 
        and measure its effect in the digital twin.
        
        This generates the causal sensitivity analysis:
        "Which factors have the largest causal effect on safety margin?"
        """
        parents = self.scm.get_parents(target_variable)
        sensitivities = {}
        
        for parent in parents:
            # Vary this parent through its range
            parent_range = self.scm.get_range(parent)
            effects = []
            
            for value in np.linspace(parent_range[0], parent_range[1], 20):
                # Intervene in digital twin
                cf_scenario = base_scenario.copy()
                cf_scenario[parent] = value
                
                # Run simulation
                result = self.twin.simulate(cf_scenario)
                effects.append((value, result[target_variable]))
            
            sensitivities[parent] = {
                'values': [e[0] for e in effects],
                'effects': [e[1] for e in effects],
                'causal_effect_magnitude': max(e[1] for e in effects) 
                                         - min(e[1] for e in effects),
            }
        
        # Rank by causal effect magnitude
        ranked = sorted(sensitivities.items(), 
                       key=lambda x: x[1]['causal_effect_magnitude'],
                       reverse=True)
        
        return ranked
```

### 9.6 Airside Counterfactual Scenarios

Specific counterfactual scenarios for airside validation:

| Base Scenario | Counterfactual Question | Variables Changed | Expected Finding |
|---|---|---|---|
| Successful transit past parked A320 | "What if the aircraft had started engines during transit?" | aircraft_engine_state: off→idle→full | Safety margin drops from 15m to <5m when entering jet blast zone |
| Safe stop for crew member | "What if the crew had been crouching (harder to detect)?" | crew_posture: standing→crouching | Detection distance drops from 25m to 12m; need earlier braking trigger |
| Normal pushback yield | "What if a second aircraft had started pushback simultaneously?" | num_active_pushbacks: 1→2 | Route planning fails to find safe path; needs dynamic replanning |
| Turnaround transit | "What if the baggage cart had lost brakes?" | cart_brake_state: normal→failed | Collision occurs unless ego predicts anomalous cart behavior within 2s |
| Night operation | "What if the crew's hi-vis had been obscured?" | hi_vis_visibility: normal→occluded | LiDAR detection unaffected (no hi-vis dependency); camera fallback fails |
| Wet surface operation | "What if de-icing fluid had reduced friction further?" | surface_friction: 0.5→0.15 | Stopping distance increases 3.3x; current speed limits insufficient |

---

## 10. Practical Implementation for Airside

### 10.1 Airside Causal DAG

A comprehensive causal DAG for the airside operating environment:

```
EXOGENOUS (Background Conditions)
=====================================
U_weather     -- temperature, precipitation, wind, visibility
U_time        -- time of day, season, shift schedule
U_airport     -- airport layout, procedures, equipment fleet
U_human       -- crew training, fatigue, attention, experience
U_mechanical  -- vehicle condition, sensor calibration, actuator state

ENDOGENOUS (Modeled Variables)
=====================================

Layer 1: Environment
  Weather → Surface_Condition
  Weather → Visibility
  Weather → Wind_Pattern → Jet_Blast_Shape
  Time → Lighting_Condition

Layer 2: Operations Context
  ATC_Instruction → Aircraft_State
  Schedule → Turnaround_Phase
  NOTAM → Restricted_Zones
  Turnaround_Phase → Expected_Crew_Positions
  Turnaround_Phase → Expected_GSE

Layer 3: Agent States
  Aircraft_State → Aircraft_Position
  Aircraft_State → Engine_State → Jet_Blast_Zone
  Crew_Intent → Crew_Position
  Crew_Intent → Crew_Velocity
  GSE_Task → GSE_Position
  GSE_Task → GSE_Velocity

Layer 4: Ego Perception
  {All Layer 3 states} + Visibility + Lighting → Detection_Results
  Detection_Results + Sensor_State → Perception_Confidence

Layer 5: Ego Decision
  Detection_Results + Ego_Speed + Traffic_Rules + Restricted_Zones → Decision
  Decision + Perception_Confidence → Action_Command

Layer 6: Ego Actuation
  Action_Command + Vehicle_State → Actual_Deceleration
  Actual_Deceleration + Surface_Condition → Stopping_Distance
  Ego_Steering_Command → Ego_Path

Layer 7: Outcome
  Stopping_Distance + All_Agent_Positions → Min_Clearance
  Min_Clearance → Outcome (safe/near-miss/collision)
  Ego_Path + Restricted_Zones → Zone_Violation (yes/no)
```

### 10.2 Python Implementation

```python
"""
Minimal but functional causal reasoning module for airside AV.

Dependencies: numpy, networkx, scipy
Optional: pgmpy (for full Bayesian inference), dowhy (for causal estimation)
"""

import numpy as np
import networkx as nx
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any
from enum import Enum

class CausalVariable:
    """A variable in the structural causal model."""
    def __init__(self, name, var_type='continuous', 
                 domain=None, observable=True):
        self.name = name
        self.var_type = var_type  # 'continuous', 'categorical', 'binary'
        self.domain = domain     # range or set of values
        self.observable = observable
    
    def __repr__(self):
        obs = "obs" if self.observable else "hidden"
        return f"CausalVar({self.name}, {self.var_type}, {obs})"

class StructuralEquation:
    """
    A structural equation V_i = f_i(PA_i, U_i).
    
    Can be:
    - Parametric: linear, polynomial
    - Non-parametric: arbitrary function
    - Neural: learned from data
    """
    def __init__(self, target, parents, func, noise_dist=None):
        self.target = target       # variable name
        self.parents = parents     # list of parent variable names
        self.func = func           # callable(parent_values, noise) -> value
        self.noise_dist = noise_dist  # noise distribution
    
    def evaluate(self, parent_values, noise=None):
        if noise is None and self.noise_dist is not None:
            noise = self.noise_dist()
        return self.func(parent_values, noise)

class AirsideSCM:
    """
    Structural Causal Model for airside autonomous driving.
    """
    
    def __init__(self):
        self.variables: Dict[str, CausalVariable] = {}
        self.equations: Dict[str, StructuralEquation] = {}
        self.dag = nx.DiGraph()
        self._build_airside_model()
    
    def _build_airside_model(self):
        """Build the default airside causal model."""
        
        # Define variables
        vars_spec = [
            ('weather', 'categorical', ['clear', 'rain', 'fog', 'snow'], False),
            ('surface_friction', 'continuous', (0.1, 0.9), True),
            ('visibility', 'continuous', (10, 1000), True),
            ('ego_speed', 'continuous', (0, 25), True),
            ('ego_position', 'continuous', None, True),
            ('crew_intent', 'categorical', 
             ['stationary', 'walking', 'crossing', 'running'], False),
            ('crew_position', 'continuous', None, True),
            ('crew_velocity', 'continuous', None, True),
            ('detection_result', 'categorical', 
             ['detected', 'missed', 'false_positive'], True),
            ('perception_latency', 'continuous', (0.1, 2.0), True),
            ('braking_decision', 'categorical',
             ['none', 'mild', 'moderate', 'emergency'], True),
            ('stopping_distance', 'continuous', (0, 50), True),
            ('min_clearance', 'continuous', (-5, 50), True),
            ('outcome', 'categorical', 
             ['safe', 'near_miss', 'collision'], True),
        ]
        
        for name, vtype, domain, obs in vars_spec:
            self.variables[name] = CausalVariable(name, vtype, domain, obs)
            self.dag.add_node(name)
        
        # Define structural equations
        self.equations['surface_friction'] = StructuralEquation(
            target='surface_friction',
            parents=['weather'],
            func=lambda pa, u: {
                'clear': 0.7 + u * 0.1,
                'rain': 0.4 + u * 0.1,
                'fog': 0.6 + u * 0.1,
                'snow': 0.2 + u * 0.1,
            }[pa['weather']],
            noise_dist=lambda: np.random.normal(0, 0.05)
        )
        
        self.equations['stopping_distance'] = StructuralEquation(
            target='stopping_distance',
            parents=['ego_speed', 'surface_friction', 
                     'braking_decision', 'perception_latency'],
            func=self._stopping_distance_func,
            noise_dist=lambda: np.random.normal(0, 0.2)
        )
        
        self.equations['outcome'] = StructuralEquation(
            target='outcome',
            parents=['stopping_distance', 'min_clearance'],
            func=lambda pa, u: (
                'collision' if pa['stopping_distance'] > pa['min_clearance']
                else 'near_miss' if pa['stopping_distance'] > pa['min_clearance'] - 1.0
                else 'safe'
            ),
        )
        
        # Add edges to DAG
        for eq_name, eq in self.equations.items():
            for parent in eq.parents:
                self.dag.add_edge(parent, eq_name)
    
    @staticmethod
    def _stopping_distance_func(pa, noise):
        """
        Physics-based stopping distance model.
        
        d = v * t_reaction + v^2 / (2 * mu * g) + noise
        
        Where t_reaction includes perception latency + system latency
        """
        v = pa['ego_speed'] / 3.6  # km/h to m/s
        mu = pa['surface_friction']
        t_react = pa['perception_latency'] + 0.1  # +100ms system latency
        
        # Braking intensity modifier
        brake_intensity = {
            'none': 0.0,
            'mild': 0.3,
            'moderate': 0.6,
            'emergency': 1.0,
        }[pa['braking_decision']]
        
        if brake_intensity == 0:
            return float('inf')  # no braking = doesn't stop
        
        d = v * t_react + v**2 / (2 * mu * 9.81 * brake_intensity) + noise
        return max(0, d)
    
    def compute(self, evidence: Dict[str, Any]) -> Dict[str, Any]:
        """
        Forward computation: given exogenous + root values, 
        compute all endogenous variables.
        """
        values = evidence.copy()
        
        # Topological sort ensures parents computed before children
        for node in nx.topological_sort(self.dag):
            if node in values:
                continue
            if node in self.equations:
                eq = self.equations[node]
                parent_vals = {p: values[p] for p in eq.parents}
                values[node] = eq.evaluate(parent_vals)
        
        return values
    
    def intervene(self, evidence: Dict, intervention: Dict) -> Dict:
        """
        Compute P(Y | do(X=x)).
        
        Mutilate the graph by removing edges into intervened variables,
        set their values, and propagate.
        """
        # Create mutilated model
        mutilated_dag = self.dag.copy()
        mutilated_eqs = dict(self.equations)
        
        for var, val in intervention.items():
            # Remove all incoming edges (parents no longer influence)
            parents = list(mutilated_dag.predecessors(var))
            for parent in parents:
                mutilated_dag.remove_edge(parent, var)
            
            # Replace equation with constant
            mutilated_eqs[var] = StructuralEquation(
                target=var, parents=[], 
                func=lambda pa, u, v=val: v
            )
        
        # Forward compute in mutilated model
        values = evidence.copy()
        values.update(intervention)
        
        for node in nx.topological_sort(mutilated_dag):
            if node in values:
                continue
            if node in mutilated_eqs:
                eq = mutilated_eqs[node]
                parent_vals = {p: values[p] for p in eq.parents 
                              if p in values}
                values[node] = eq.evaluate(parent_vals)
        
        return values
    
    def counterfactual(self, evidence: Dict, intervention: Dict,
                       n_samples: int = 1000) -> Dict:
        """
        Three-step counterfactual inference.
        
        P(Y_{X=x} | E=e)
        """
        results = []
        
        for _ in range(n_samples):
            # Step 1: Abduction - sample U consistent with evidence
            u = self._sample_exogenous_given_evidence(evidence)
            
            # Step 2: Action - apply intervention
            # Step 3: Prediction - compute in mutilated model with sampled U
            cf_evidence = {**u, **evidence, **intervention}
            cf_result = self.intervene(cf_evidence, intervention)
            results.append(cf_result)
        
        # Aggregate results
        return self._aggregate_results(results)
    
    def _sample_exogenous_given_evidence(self, evidence):
        """
        Sample exogenous variables consistent with evidence.
        
        Uses rejection sampling or MCMC for complex models.
        """
        # Simplified: use rejection sampling
        for _ in range(10000):
            u = self._sample_prior_exogenous()
            computed = self.compute({**u, **evidence})
            
            # Check consistency with evidence
            consistent = True
            for var, val in evidence.items():
                if var in computed and not self._approx_equal(computed[var], val):
                    consistent = False
                    break
            
            if consistent:
                return u
        
        raise RuntimeError("Failed to find consistent exogenous sample")
    
    def _sample_prior_exogenous(self):
        """Sample from prior distribution of exogenous variables."""
        return {
            'weather': np.random.choice(
                ['clear', 'rain', 'fog', 'snow'], 
                p=[0.6, 0.2, 0.15, 0.05]
            ),
            'crew_intent': np.random.choice(
                ['stationary', 'walking', 'crossing', 'running'],
                p=[0.3, 0.4, 0.2, 0.1]
            ),
        }
    
    @staticmethod
    def _approx_equal(a, b, tol=0.1):
        if isinstance(a, str) and isinstance(b, str):
            return a == b
        try:
            return abs(float(a) - float(b)) < tol
        except (TypeError, ValueError):
            return a == b
    
    @staticmethod
    def _aggregate_results(results):
        """Aggregate multiple counterfactual samples."""
        if not results:
            return {}
        
        aggregated = {}
        for key in results[0].keys():
            values = [r[key] for r in results]
            if isinstance(values[0], (int, float)):
                aggregated[key] = {
                    'mean': np.mean(values),
                    'std': np.std(values),
                    'p5': np.percentile(values, 5),
                    'p95': np.percentile(values, 95),
                }
            else:
                # Categorical: return distribution
                from collections import Counter
                counts = Counter(values)
                total = len(values)
                aggregated[key] = {
                    v: c / total for v, c in counts.items()
                }
        
        return aggregated
```

### 10.3 ROS Integration: Causal Explanation Publisher

```python
#!/usr/bin/env python3
"""
ROS node that publishes causal explanations for driving decisions.

Subscribes to:
  - /perception/detections (agent detections)
  - /ego/state (ego vehicle state)
  - /planning/decision (planning decision)
  - /planning/trajectory (planned trajectory)

Publishes:
  - /causal/explanation (CausalExplanation msg)
  - /causal/counterfactuals (CounterfactualAnalysis msg)
  - /causal/responsibility (ResponsibilityScore msg)

Rate: 2 Hz (explanations don't need to run at full perception rate)

NOTE: This runs inside the airside-dev Docker container.
      See: docker exec airside-dev bash -c 'source /opt/ros/noetic/setup.bash && ...'
"""

import rospy
from std_msgs.msg import String
from geometry_msgs.msg import PoseStamped, TwistStamped
# Custom messages would be defined in a dedicated package
# from causal_reasoning.msg import CausalExplanation, CounterfactualAnalysis

class CausalExplanationNode:
    """
    ROS node providing causal explanations for driving decisions.
    
    Architecture:
    - Runs at 2 Hz (lightweight compared to perception/planning)
    - Maintains rolling window of scene history (last 5 seconds)
    - Generates causal explanation for current decision
    - Optionally runs counterfactual analysis on flagged events
    """
    
    def __init__(self):
        rospy.init_node('causal_explanation')
        
        # Initialize causal model
        self.scm = AirsideSCM()
        self.cf_analyzer = CounterfactualTrajectoryAnalyzer(
            vehicle_model=BicycleModel(),
            friction_model=SurfaceFrictionEstimator()
        )
        
        # State buffers
        self.ego_state_buffer = []
        self.detection_buffer = []
        self.decision_buffer = []
        
        # Subscribers
        rospy.Subscriber('/ego/state', PoseStamped, self.ego_state_cb)
        rospy.Subscriber('/perception/detections', String, self.detection_cb)
        rospy.Subscriber('/planning/decision', String, self.decision_cb)
        
        # Publishers
        self.explanation_pub = rospy.Publisher(
            '/causal/explanation', String, queue_size=10
        )
        self.counterfactual_pub = rospy.Publisher(
            '/causal/counterfactuals', String, queue_size=10
        )
        
        # Timer for explanation generation (2 Hz)
        rospy.Timer(rospy.Duration(0.5), self.generate_explanation)
        
        rospy.loginfo("Causal explanation node initialized")
    
    def generate_explanation(self, event):
        """Generate causal explanation for current decision."""
        if not self.decision_buffer:
            return
        
        current_decision = self.decision_buffer[-1]
        current_state = self._build_scene_state()
        
        # Generate causal explanation
        explanation = self._explain_decision(current_decision, current_state)
        
        # Publish
        msg = String()
        msg.data = explanation
        self.explanation_pub.publish(msg)
        
        # If flagged event, run full counterfactual analysis
        if self._is_safety_event(current_decision):
            cf_analysis = self._run_counterfactual_analysis(
                current_decision, current_state
            )
            cf_msg = String()
            cf_msg.data = str(cf_analysis)
            self.counterfactual_pub.publish(cf_msg)
    
    def _explain_decision(self, decision, state):
        """
        Generate natural language causal explanation.
        
        Format: "Decision: {action} because {causal_chain}"
        """
        # Identify the causal chain: which perception inputs 
        # caused which planning outputs
        causes = []
        
        if decision['action'] == 'emergency_brake':
            # Trace cause: what triggered the e-brake?
            if state.get('nearest_agent_distance', float('inf')) < 10.0:
                causes.append(
                    f"Agent detected at {state['nearest_agent_distance']:.1f}m "
                    f"with closing velocity {state.get('closing_velocity', 0):.1f} m/s"
                )
            if state.get('perception_confidence', 1.0) < 0.5:
                causes.append(
                    f"Low perception confidence ({state['perception_confidence']:.0%})"
                )
        
        elif decision['action'] == 'yield':
            if state.get('pushback_active'):
                causes.append("Active pushback detected, right-of-way yielded")
            if state.get('crew_crossing'):
                causes.append("Crew member crossing predicted")
        
        cause_str = "; ".join(causes) if causes else "normal operation"
        return f"Decision: {decision['action']} because {cause_str}"
    
    def _is_safety_event(self, decision):
        """Check if this decision warrants full counterfactual analysis."""
        return decision.get('action') in ['emergency_brake', 'emergency_stop']
    
    def _run_counterfactual_analysis(self, decision, state):
        """Run full counterfactual analysis for safety events."""
        evidence = {
            'ego_speed': state.get('ego_speed', 0),
            'perception_latency': state.get('perception_latency', 0.3),
            'surface_friction': state.get('surface_friction', 0.7),
            'braking_decision': decision.get('action', 'none'),
        }
        
        # Counterfactual: what if perception was faster?
        cf_fast_perception = self.scm.counterfactual(
            evidence=evidence,
            intervention={'perception_latency': 0.1}
        )
        
        # Counterfactual: what if speed was lower?
        cf_lower_speed = self.scm.counterfactual(
            evidence=evidence,
            intervention={'ego_speed': evidence['ego_speed'] * 0.75}
        )
        
        return {
            'event_type': 'safety_event',
            'actual_outcome': evidence,
            'cf_fast_perception': cf_fast_perception,
            'cf_lower_speed': cf_lower_speed,
        }
    
    # Callback stubs
    def ego_state_cb(self, msg):
        self.ego_state_buffer.append(msg)
        if len(self.ego_state_buffer) > 100:
            self.ego_state_buffer.pop(0)
    
    def detection_cb(self, msg):
        self.detection_buffer.append(msg)
        if len(self.detection_buffer) > 100:
            self.detection_buffer.pop(0)
    
    def decision_cb(self, msg):
        self.decision_buffer.append(msg)
        if len(self.decision_buffer) > 50:
            self.decision_buffer.pop(0)
    
    def _build_scene_state(self):
        """Build current scene state from buffers."""
        return {}  # Implement based on actual message types

if __name__ == '__main__':
    try:
        node = CausalExplanationNode()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

### 10.4 Incident Investigation Pipeline

```
Incident occurs
    │
    ▼
┌─────────────────────────────────┐
│  1. Data Extraction              │
│  - rosbag capture (auto-trigger) │
│  - Extract: ego states, agent    │
│    detections, decisions, actions │
│  - Timestamp alignment           │
│  - Duration: ~30s before/after   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  2. Scenario Reconstruction      │
│  - Build 3D scene replay         │
│  - Identify all agents           │
│  - Reconstruct trajectories      │
│  - Identify decision points      │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  3. Causal Model Construction    │
│  - Select relevant SCM subset    │
│  - Parameterize from data        │
│  - Validate: does the SCM        │
│    reproduce the actual outcome? │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  4. Actual Cause Determination   │
│  - Halpern-Pearl analysis        │
│  - Identify all actual causes    │
│  - Compute responsibility        │
│  - But-for + NESS tests          │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  5. Counterfactual Analysis      │
│  - For each actual cause:        │
│    minimum sufficient change     │
│  - "What if" sensitivity         │
│  - Timeline of critical points   │
│  - Last-chance analysis          │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  6. Report Generation            │
│  - Natural language summary      │
│  - Formal causal chain           │
│  - Counterfactual evidence       │
│  - Recommended actions           │
│  - Certification evidence        │
└─────────────────────────────────┘
```

### 10.5 Certification Evidence from Causal Models

Causal models provide specific types of evidence for safety certification:

| Certification Requirement | Causal Evidence | Standard |
|---|---|---|
| Root cause analysis | Halpern-Pearl actual causation report | ISO 3691-4 Cl. 7.3 |
| Safety function rationale | Causal DAG: perception → decision → action chain | ISO 3691-4 Cl. 5.2.4 |
| Risk assessment | Counterfactual sensitivity analysis | ISO 12100, ISO 3691-4 |
| Failure mode effects | Counterfactual fault injection results | IEC 61508 |
| Defense-in-depth argument | Causal independence of safety layers | Simplex architecture |
| Performance monitoring | Causal anomaly detection (deviation from expected causal structure) | ISO 3691-4 Cl. 6.3 |
| Product liability defense | Formal causal analysis showing no defect-outcome link | EU PLD 2024/2853 |

**Cross-reference:** See `60-safety-validation/standards-certification/safety-verification-certification.md` and `60-safety-validation/standards-certification/iso-3691-4-deep-dive.md` for the full certification framework.

### 10.6 Implementation Cost and Timeline

| Phase | Scope | Duration | Cost | Dependencies |
|---|---|---|---|---|
| **Phase 1**: Causal DAG + SCM | Build airside causal model, implement basic counterfactual analysis | 4-6 weeks | $15-25K | Domain expertise, Python |
| **Phase 2**: Incident pipeline | Rosbag extraction, automated reconstruction, HP causation | 6-8 weeks | $25-40K | Phase 1, existing rosbag infrastructure |
| **Phase 3**: ROS integration | Causal explanation node, real-time publishing | 4-6 weeks | $15-25K | Phase 1, ROS Noetic stack |
| **Phase 4**: Causal discovery | PCMCI on fleet data, DAG validation | 6-8 weeks | $20-30K | Phase 1, fleet driving data |
| **Phase 5**: Counterfactual simulation | Digital twin integration, systematic what-if | 8-12 weeks | $30-50K | Phase 2, digital twin |
| **Phase 6**: LLM hybrid | LLM graph construction + formal testing | 4-6 weeks | $10-20K | Phase 1, LLM API access |
| **Total** | End-to-end causal reasoning pipeline | 6-9 months | $115-190K | |

**Recommended starting point:** Phase 1 + Phase 2 (incident investigation) -- this provides immediate value for safety certification and regulatory compliance, independent of the neural planning stack.

### 10.7 Method Comparison Table

| Method | Use Case | Complexity | Computational Cost | Maturity | Airside Value |
|---|---|---|---|---|---|
| **Structural Causal Models** | Foundation for all causal reasoning | Medium | Low (graph ops) | High (Pearl 2000) | Critical |
| **Counterfactual Analysis** | Incident investigation, "what-if" | Medium | Medium (simulation) | High | Critical |
| **Halpern-Pearl Causation** | Blame/responsibility attribution | High | Medium (search) | High (2005/2015) | High |
| **PC / FCI Discovery** | Learning causal structure from data | Medium | Medium | High | Medium |
| **NOTEARS** | Differentiable DAG learning | High | High (optimization) | Medium (2018) | Medium |
| **PCMCI** | Time-series causal discovery | Medium | Medium | High (2019) | High |
| **IRM / Causal Rep. Learning** | Cross-airport transfer | High | High (training) | Low-Medium (2019+) | High |
| **CITRIS** | Temporal causal disentanglement | High | High | Low (2022) | Medium |
| **Causal Forest (CATE)** | Heterogeneous treatment effects | Medium | Medium | High | Medium |
| **Off-Policy Evaluation (DR)** | Evaluate new planner from logs | Medium | Low | High | High |
| **LLM + SCM Hybrid** | Accessible causal graph construction | Medium | Low-Medium | Low (2023+) | Medium |
| **KING Counterfactual Gen.** | Safety-critical scenario generation | High | High (optimization) | Medium (2023) | High |
| **Twin Networks** | Quantitative counterfactuals | Medium | Medium | High (1994/2009) | High |

---

## 11. Key Takeaways

1. **Causal reasoning fills the critical gap between correlation-based ML and the causal arguments required by ISO 3691-4, the EU AI Act, and EU Product Liability Directive 2024/2853.** No production AV system currently reasons at Pearl's Level 3 (counterfactuals), yet this is what safety cases and legal liability analysis require.

2. **The EU Product Liability Directive (transpose deadline December 2026) creates a "rebuttable presumption of causality"** -- if reference airside AV stack cannot provide causal explanations for driving decisions, courts may legally presume the AV caused the incident. This makes causal reasoning a near-term business necessity, not just research.

3. **Structural Causal Models (SCMs) with physics-based structural equations are implementable today for airside.** The airside environment has well-defined physical dynamics (braking, stopping distance, jet blast) that serve as structural equations, making the SCM practically grounded rather than abstract.

4. **Counterfactual trajectory analysis can determine that braking 0.3 seconds earlier would have prevented an incident** -- a precise, actionable finding that cannot be obtained from correlation-based methods. The minimum sufficient intervention search (binary search over intervention parameters) finds the exact threshold.

5. **Halpern-Pearl actual causation formalizes root cause analysis**, replacing ad-hoc investigation with mathematically rigorous cause identification. For multi-agent incidents, it quantifies degree of responsibility (dr = 1/(1+k)) for each contributing factor.

6. **NOTEARS enables differentiable causal discovery from fleet data** -- learning the causal DAG as a continuous optimization problem. Combined with PCMCI for time-series relationships, this can validate or challenge the expert-specified causal graph using actual fleet operational data.

7. **Causal representation learning (IRM, CITRIS) provides the theoretical foundation for cross-airport transfer.** The 500-1000 frame PointLoRA fine-tuning works because the base model has learned causal (invariant) features; only airport-specific (non-causal) adaptation requires fine-tuning.

8. **Off-policy evaluation using doubly-robust estimators can evaluate a neural planner using logged Frenet planner data** -- no need to deploy the new planner to estimate its performance. This addresses the "chicken-and-egg" problem of neural planner validation.

9. **LLMs are useful as causal graph construction front-ends but unreliable as causal inference engines.** GPT-4 achieves only 57% on counterfactual reasoning (CLadder benchmark) vs 90%+ human performance. The hybrid approach -- LLM generates hypotheses, formal SCM tests them -- leverages both strengths.

10. **Causal confusion in imitation learning is a concrete risk for airside.** If the IL model learns "crew visible -> brake" instead of "crew in predicted collision path -> brake," it will be either overly conservative (braking for any visible crew) or dangerously wrong (not braking when crew is in path but not visually salient). Counterfactual data augmentation addresses this.

11. **KING-style counterfactual scenario generation produces kinematically feasible adversarial scenarios** that are far more useful for safety validation than random perturbations. For airside, this means generating "what if the crew member had stepped out 0.5s later" scenarios that are physically plausible and maximally challenging.

12. **The causal explanation ROS node runs at 2 Hz with minimal computational overhead** -- it does not compete with the 10 Hz perception/planning loop. Causal explanations are generated in parallel, published for logging and human oversight, and stored for post-hoc analysis.

13. **Phase 1 + Phase 2 (SCM + incident pipeline) costs $40-65K and takes 10-14 weeks**, providing immediate value for ISO 3691-4 certification (root cause analysis) and EU AI Act compliance (interpretable explanations) before any neural planning components are deployed.

14. **Counterfactual safety testing systematically answers questions like "would this safe scenario have become unsafe if surface friction dropped to 0.15?"** -- directly generating the evidence needed for ISO 12100 risk assessment and ISO 34502 scenario coverage arguments.

15. **Causal arguments for defense-in-depth are stronger than statistical arguments.** The Simplex architecture's safety case is fundamentally causal: "if the neural planner produces an unsafe trajectory, the CBF filter blocks it (causal mechanism 1), and if the CBF fails, the classical Frenet planner takes over (causal mechanism 2)." Each mechanism is independently verifiable.

16. **The airside causal DAG has approximately 30-40 variables across 7 layers** (environment, operations, agents, perception, decision, actuation, outcome). This is tractable for exact inference -- no approximation needed, unlike large-scale causal models in epidemiology or economics.

17. **Causal anomaly detection can trigger safety fallbacks:** if the observed causal structure deviates from the expected DAG (e.g., braking force does not cause expected deceleration -- indicating actuator fault, or detection does not follow from agent presence -- indicating perception failure), the system can trigger the Simplex switch to the classical fallback before an incident occurs.

18. **The but-for test alone is insufficient for airside incidents due to overdetermination.** When multiple factors (excessive speed AND perception delay AND wet surface) each independently suffice, the NESS test correctly attributes causation to each necessary element. Legal analysis should apply both standards.

19. **Integration with the existing Frenet planner is straightforward:** add a causal cost term that evaluates P(collision | do(trajectory)) rather than just proximity to obstacles. This augmentation requires no changes to the planner's search algorithm -- only an additional cost function evaluation per candidate trajectory.

20. **No public airside causal model or counterfactual dataset exists.** Building and publishing an airside SCM with counterfactual scenarios would be a significant contribution to the field and a defensible competitive advantage for safety certification.

---

## References

### Foundational
- Pearl, J. (2009). *Causality: Models, Reasoning, and Inference*. Cambridge University Press. 2nd edition.
- Pearl, J. (2018). *The Book of Why*. Basic Books.
- Pearl, J., & Mackenzie, D. (2018). "The Ladder of Causation." Chapter 1 of *The Book of Why*.
- Spirtes, P., Glymour, C., & Scheines, R. (2000). *Causation, Prediction, and Search*. MIT Press.
- Halpern, J. Y., & Pearl, J. (2005). "Causes and Explanations: A Structural-Model Approach." Parts I and II. *British Journal for the Philosophy of Science*.
- Halpern, J. Y. (2015). "A Modification of the Halpern-Pearl Definition of Causality." *IJCAI*.
- Rubin, D. B. (1974). "Estimating Causal Effects of Treatments in Randomized and Nonrandomized Studies." *Journal of Educational Psychology*.
- Lewis, D. (1973). *Counterfactuals*. Blackwell.

### Causal Discovery
- Zheng, X., et al. (2018). "DAGs with NO TEARS: Continuous Optimization for Structure Learning." *NeurIPS*.
- Runge, J., et al. (2019). "Detecting and quantifying causal associations in large nonlinear time series datasets." *Science Advances*.
- Chickering, D. M. (2002). "Optimal Structure Identification With Greedy Search." *JMLR*.

### Causal Representation Learning
- Scholkopf, B., et al. (2021). "Toward Causal Representation Learning." *Proceedings of the IEEE*.
- Lippe, P., et al. (2022). "CITRIS: Causal Identifiability from Temporal Intervened Sequences." *ICML*.
- Hyvarinen, A., et al. (2019). "Nonlinear ICA Using Auxiliary Variables and Generalized Contrastive Learning." *AISTATS*.
- Arjovsky, M., et al. (2019). "Invariant Risk Minimization." *arXiv:1907.02893*.
- Yang, M., et al. (2021). "CausalVAE: Disentangled Representation Learning via Neural Structural Causal Models." *CVPR*.

### Driving-Specific
- de Haan, P., et al. (2019). "Causal Confusion in Imitation Learning." *NeurIPS*.
- Hanselmann, N., et al. (2023). "KING: Generating Safety-Critical Driving Scenarios for Robust Imitation via Kinematics Gradients." *NeurIPS*.
- Wang, W., et al. (2024). "DriveCoT: Integrating Chain-of-Thought Reasoning with Driving." *arXiv*.
- Jin, Z., et al. (2024). "CLadder: A Benchmark to Assess Causal Reasoning Capabilities of Language Models." *NeurIPS*.
- Ban, T., et al. (2023). "CausalGPT: Causal Reasoning Capability of GPT." *arXiv*.

### Counterfactual Explanations
- Mothilal, R. K., et al. (2020). "Explaining Machine Learning Classifiers through Diverse Counterfactual Explanations." *FAT*.
- Poyiadzi, R., et al. (2020). "FACE: Feasible and Actionable Counterfactual Explanations." *AIES*.
- Dhurandhar, A., et al. (2018). "Explanations Based on the Missing: Towards Contrastive Explanations with Pertinent Negatives." *NeurIPS*.
- Balke, A., & Pearl, J. (1994). "Counterfactual Probabilities: Computational Methods, Bounds and Applications." *UAI*.

### Causal Inference Methods
- Wager, S., & Athey, S. (2018). "Estimation and Inference of Heterogeneous Treatment Effects using Random Forests." *JASA*.
- Dudik, M., et al. (2011). "Doubly Robust Policy Evaluation and Learning." *ICML*.
- Kunzel, S., et al. (2019). "Metalearners for Estimating Heterogeneous Treatment Effects using Machine Learning." *PNAS*.
- Shi, C., et al. (2019). "Adapting Neural Networks for the Estimation of Treatment Effects." *NeurIPS (DragonNet)*.

### Legal/Regulatory
- EU AI Act: Regulation (EU) 2024/1689.
- EU Product Liability Directive: Directive (EU) 2024/2853.
- ISO 3691-4:2023. Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks.
- Wright, R. (1985). "Causation in Tort Law." *California Law Review* (NESS test).

### Software/Tools
- DoWhy (Microsoft): https://github.com/py-why/dowhy -- Causal inference library
- pgmpy: https://pgmpy.org/ -- Probabilistic graphical models in Python
- CausalNex (QuantumBlack): https://github.com/quantumblacklabs/causalnex -- Bayesian Networks + causal inference
- tigramite: https://github.com/jakobrunge/tigramite -- Time series causal discovery (PCMCI)
- NOTEARS: https://github.com/xunzheng/notears -- Differentiable DAG learning
- EconML (Microsoft): https://github.com/py-why/EconML -- CATE estimation
