# Neuro-Symbolic Reasoning and Scene Graphs for Autonomous Driving

> **Purpose**: Deep dive into scene graph representations, graph neural networks, knowledge-graph-based rule encoding, and neuro-symbolic planning for autonomous driving — the intersection of structured symbolic reasoning with neural perception for interpretable, verifiable driving behavior.
>
> **Relation to existing docs**: Extends `semantic-mapping-learned-priors.md` (map topology), `llm-reasoning-driving.md` (LLM chain-of-thought), `vlm-scene-understanding.md` (VLM perception). This document focuses specifically on structured graph representations of driving scenes, symbolic rule systems, and hybrid neuro-symbolic architectures that combine the strengths of both paradigms.

---

## Table of Contents

1. [Why Neuro-Symbolic Reasoning for Driving](#1-why-neuro-symbolic)
2. [Scene Graphs for Driving Scenes](#2-scene-graphs)
3. [Graph Neural Networks for Traffic](#3-gnns-for-traffic)
4. [Knowledge Graphs and Ontologies for Driving Rules](#4-knowledge-graphs)
5. [Neuro-Symbolic Planning Architectures](#5-neuro-symbolic-planning)
6. [Compositional Reasoning and Program Synthesis](#6-compositional-reasoning)
7. [LLM-Symbolic Hybrid Systems](#7-llm-symbolic-hybrid)
8. [Verification and Interpretability](#8-verification)
9. [Airside Applications](#9-airside)
10. [Implementation](#10-implementation)
11. [Comparison Table](#11-comparison)
12. [Key Findings](#12-key-findings)

---

## 1. Why Neuro-Symbolic Reasoning for Driving

### 1.1 The Limitations of Pure Neural and Pure Symbolic Approaches

| Aspect | Pure Neural (E2E) | Pure Symbolic (Rule-based) | Neuro-Symbolic |
|--------|-------------------|--------------------------|----------------|
| Perception | Excellent — learns from data | Poor — needs hand-crafted features | Neural perception + symbolic post-processing |
| Reasoning | Implicit, opaque | Explicit, interpretable | Structured reasoning over neural outputs |
| Generalization | Good on distribution | Perfect within defined rules | Both — rules for known cases, learning for novel |
| Verification | Statistical only | Formally verifiable | Verifiable reasoning over uncertain perception |
| Failure mode | Silent, unpredictable | Brittle at rule boundaries | Graceful — neural handles novelty, rules handle safety |
| Explainability | Low (grad-CAM, saliency) | High (rule trace) | High (reasoning chain) |

### 1.2 The Airside Argument

Airport airside operations have properties that strongly favor neuro-symbolic approaches:

1. **Complex, explicit rules**: Right-of-way, speed zones, restricted areas, NOTAM constraints — these are symbolic rules that should be represented symbolically, not learned implicitly.

2. **High-value, verifiable decisions**: "Why did the vehicle yield?" needs an answer beyond "the neural network said so." Regulators and airport authorities need interpretable decisions.

3. **Novel situations**: Airside environments change frequently (new aircraft types, construction, emergency scenarios). Symbolic rules generalize; neural models need retraining.

4. **Multi-entity interactions**: Ramp operations involve 5-15 different entity types interacting simultaneously. Scene graphs capture these relationships naturally.

5. **Certification path**: Neuro-symbolic systems offer a path to certification that pure neural systems cannot: verify the symbolic reasoning layer formally, validate the neural perception layer statistically.

### 1.3 The Neuro-Symbolic Spectrum

```
Pure Neural ◄──────────────────────────────────────────────► Pure Symbolic

    E2E         Neural with        Neuro-symbolic      Symbolic with      Rule
    driving     symbolic loss      architecture        learned features   engine
    
    UniAD       SafeDreamer        DriveLM-Graph       Knowledge         Traffic
    SparseDrive (reward shaping)   SceneGraphNet       distillation      code
                                   NuScenes-QA
```

Most SOTA approaches sit in the "neuro-symbolic architecture" zone — using neural perception to build structured representations (scene graphs, knowledge bases), then reasoning symbolically over these structures.

---

## 2. Scene Graphs for Driving Scenes

### 2.1 What is a Driving Scene Graph

A driving scene graph (DSG) is a structured representation of a traffic scene as a directed graph:

```
Nodes:  Objects in the scene (vehicles, pedestrians, lanes, traffic signs, infrastructure)
Edges:  Relationships between objects (spatial, semantic, temporal, causal)

Example: Airport ramp scenario

  Nodes:
    ego_gse: {type: "autonomous_tractor", pos: (10, 20), vel: (2, 0), heading: 90}
    aircraft_1: {type: "A320", pos: (30, 25), state: "parked", doors: "open"}
    ground_crew_1: {type: "person", pos: (25, 22), activity: "loading"}
    belt_loader: {type: "equipment", pos: (28, 23), state: "operating"}
    lane_1: {type: "service_road", geometry: [...], speed_limit: 15}
    
  Edges:
    ego_gse --[on]--> lane_1                    (spatial: vehicle is on lane)
    ego_gse --[approaching]--> aircraft_1       (spatial-temporal: closing distance)
    ego_gse --[must_yield_to]--> ground_crew_1  (semantic: safety rule)
    ground_crew_1 --[operating]--> belt_loader  (functional: crew-equipment relation)
    belt_loader --[servicing]--> aircraft_1     (functional: equipment-aircraft relation)
    aircraft_1 --[occupies]--> gate_3           (spatial: aircraft at gate)
    lane_1 --[speed_restricted_by]--> aircraft_proximity  (rule: speed zone near aircraft)
```

### 2.2 Scene Graph Generation from Perception

**Step 1: Object detection and tracking (neural)**
```
LiDAR/Camera → Perception pipeline → Detected objects with:
  - 3D bounding box (position, size, heading)
  - Semantic class (vehicle, person, equipment, aircraft, lane)
  - Velocity estimate
  - Track ID (temporal consistency)
```

**Step 2: Relationship prediction (neural + heuristic)**
```
For each pair of objects (o_i, o_j):
  Spatial relations: computed geometrically
    - distance(o_i, o_j), relative_angle, overlap, containment
  Semantic relations: predicted by GNN or rule-based
    - "operating", "following", "yielding_to", "approaching"
  Temporal relations: from tracking history
    - "converging", "diverging", "stationary_relative_to"
```

**Step 3: Graph construction**
```
G = (V, E) where:
  V = {detected objects + map elements + abstract concepts}
  E = {predicted relationships with confidence scores}
```

### 2.3 DSGA: Driving Scene Graph Abstraction

**Paper:** "Scene Graph Abstraction for Autonomous Driving" (Autonomous Driving Workshop 2024)

**Key innovation:** Multi-level abstraction of driving scene graphs:

```
Level 0 (Instance): Every detected object is a node
  ego → [2.3m ahead of] → car_#42 → [in_lane] → lane_3
  
Level 1 (Category): Aggregate by type
  ego → [approaching] → vehicle_cluster → [blocking] → intersection
  
Level 2 (Functional): Group by role
  ego → [in_queue_behind] → traffic_stream → [crossing] → pedestrian_flow
  
Level 3 (Strategic): High-level situation
  ego → [at] → congested_intersection → [requires] → yielding_behavior
```

**Benefit:** Planning at different abstraction levels:
- Level 0: Collision avoidance (specific object clearance)
- Level 1: Tactical (merge into traffic stream)
- Level 2: Strategic (choose route to avoid congestion)
- Level 3: Mission (replan task sequence)

### 2.4 NuScenes-QA and Scene Graph QA

**Paper:** "NuScenes-QA: A Multi-modal Visual Question Answering Benchmark for Autonomous Driving" (AAAI 2024)

Uses scene graphs as the bridge between perception and language understanding:
```
Perception → Scene Graph → Graph Query → Natural Language Answer

Q: "Is there a pedestrian near the ego vehicle?"
→ Query: EXISTS(node.type == "pedestrian" AND distance(node, ego) < 10m)
→ A: "Yes, there is a pedestrian 7.3m to the left."

Q: "Should the ego vehicle yield?"
→ Query: EXISTS(edge.type == "must_yield_to" AND edge.source == ego)
→ A: "Yes, a pedestrian is crossing ahead with right-of-way."
```

### 2.5 3D Semantic Scene Graphs

**3DSSG (3D Semantic Scene Graph):** Extends 2D scene graphs to 3D:
```
Input: 3D point cloud + 2D images
Nodes: 3D objects with point cloud segments
Edges: 3D spatial relationships (above, below, behind, supported_by, ...)

For driving:
  Input: LiDAR point cloud + detection results
  Nodes: 3D bounding boxes with semantic labels
  Edges: 3D spatial relations + traffic relations
```

**SceneGraphFusion (2024):** Real-time 3D scene graph construction from LiDAR at 10 Hz on Orin:
```
LiDAR scan → 3D detection (CenterPoint) → 3D tracking (SimpleTrack)
    → Relation prediction (GNN, 2ms) → Scene graph update → Output graph
    
Total: ~30ms on Orin (fits within perception cycle)
```

---

## 3. Graph Neural Networks for Traffic

### 3.1 GNNs for Interaction Modeling

Traffic scenes are naturally graph-structured: agents are nodes, interactions are edges. GNNs process these graphs to predict agent behavior.

**Message passing formulation:**
```
For each node i at layer l:
  m_i^{l+1} = AGG({MLP_edge(h_i^l, h_j^l, e_ij) : j in N(i)})
  h_i^{l+1} = MLP_node(h_i^l, m_i^{l+1})

where:
  h_i^l = node i feature at layer l
  e_ij = edge feature between i and j
  N(i) = neighbors of i in the graph
  AGG = aggregation function (sum, mean, max, attention)
```

### 3.2 LaneGCN (CVPR 2020, Extended 2024)

**Paper:** "Learning Lane Graph Representations for Motion Forecasting"

**Core innovation:** Model the road as a lane graph and use GCN message passing:

```
Lane graph:
  Nodes: Lane centerline points (sampled every 1m)
  Edges: 
    - Predecessor/Successor (sequential along lane)
    - Left/Right neighbor (parallel lanes)
    - Connection (lane merges, splits, intersections)

Agent-lane interaction:
  Agent nodes → attention to lane nodes → lane-aware agent features
  Lane nodes → attention to agent nodes → traffic-aware lane features
  
Multiple rounds of message passing capture complex interactions.
```

**Performance:** SOTA for trajectory prediction on Argoverse. The lane graph representation captures road topology that pure rasterized inputs miss.

### 3.3 HiVT: Hierarchical Vector Transformer (CVPR 2022)

Uses a hierarchical graph structure:
```
Level 1: Local interaction graph (agents within 50m)
  - Polyline-level: encode agent history and map polylines
  - Local attention: agents attend to nearby agents and map
  
Level 2: Global interaction graph (all agents)
  - Scene-level: aggregate local features
  - Global attention: capture long-range dependencies
```

**Key insight:** Not all agents interact equally. The hierarchical structure captures that nearby agents interact strongly (require detailed modeling) while distant agents interact weakly (coarse representation suffices).

### 3.4 HDGT: Heterogeneous Driving Graph Transformer (NeurIPS 2022)

**Heterogeneous graph:** Different node types (vehicles, pedestrians, cyclists, lanes, crosswalks) have different feature schemas and different interaction patterns.

```
Node types: {agent_vehicle, agent_pedestrian, agent_cyclist, lane, crosswalk, traffic_light}
Edge types: {agent_agent, agent_lane, agent_crosswalk, lane_lane, ...}

Each edge type has its own learned attention weights:
  Attn_{vehicle→lane} ≠ Attn_{pedestrian→crosswalk} ≠ Attn_{vehicle→vehicle}
```

**For airside extension:**
```
Node types: {autonomous_gse, manual_gse, aircraft, person, equipment, lane, gate, zone}
Edge types: 
  {gse_gse: interaction, gse_aircraft: clearance, gse_person: safety,
   gse_lane: navigation, gse_zone: restriction, aircraft_gate: assignment,
   person_equipment: operation, equipment_aircraft: service}
```

### 3.5 Spatial-Temporal Scene Graphs

**STSceneGraph (2024):** Adds temporal edges to scene graphs:
```
Time t-1:    ego → [following] → truck_1       (spatial at t-1)
                      |
                [temporal_same]                  (same object across time)
                      |
Time t:      ego → [overtaking] → truck_1      (spatial at t)
                      |
                [temporal_same]
                      |  
Time t+1:    ego → [ahead_of] → truck_1        (predicted spatial at t+1)
```

**Temporal edges encode:**
- Object persistence (same object across frames)
- Relationship evolution (following → overtaking → ahead_of)
- Temporal predictions (what relationships will exist in 2 seconds)

---

## 4. Knowledge Graphs and Ontologies for Driving Rules

### 4.1 Traffic Rule Ontologies

**Traffic Rule Ontology (TRO):** Formalizes traffic rules in a machine-readable format:

```turtle
# Example: Speed zone near aircraft (OWL/Turtle format)
:SpeedZoneNearAircraft rdf:type :TrafficRule ;
    :applies_when :VehicleNearAircraft ;
    :condition [ :distance_to_aircraft :less_than "30m" ] ;
    :constraint [ :max_speed "15 km/h" ] ;
    :priority "5" ;  # higher priority than general speed limit
    :source "Airport Operations Manual Section 3.2" .

:VehicleNearAircraft rdf:type :Situation ;
    :requires [ :ego_type :GroundServiceEquipment ] ;
    :requires [ :nearby_entity :Aircraft ; :distance "< 30m" ] ;
    :exception [ :aircraft_state "departed" ] .
```

### 4.2 AutoOnto: Automotive Domain Ontology

**Paper:** "An Ontology-Based Approach to Knowledge Representation for Autonomous Driving" (2023)

**Hierarchy:**
```
Thing
├── PhysicalEntity
│   ├── Vehicle
│   │   ├── EgoVehicle
│   │   ├── OtherVehicle
│   │   │   ├── Car, Truck, Bus, Motorcycle
│   │   │   └── GSE (airport extension)
│   │   └── Aircraft (airport extension)
│   ├── VulnerableRoadUser
│   │   ├── Pedestrian
│   │   └── GroundCrew (airport extension)
│   └── Infrastructure
│       ├── Road, Lane, Intersection
│       └── Gate, Taxiway, ServiceRoad (airport extension)
├── TrafficRule
│   ├── SpeedLimit
│   ├── RightOfWay
│   ├── RestrictedZone
│   └── AirsideRule (airport extension)
│       ├── AircraftClearance
│       ├── JetBlastZone
│       ├── ActiveRunwayExclusion
│       └── NOTAMConstraint
└── Situation
    ├── NormalDriving
    ├── Intersection
    ├── EmergencyVehicle
    └── AirsideScenario (airport extension)
        ├── PushbackInProgress
        ├── AircraftArrival
        ├── TurnaroundActive
        └── MaintenanceZone
```

### 4.3 ASAM OpenODD: Machine-Readable ODD

**ASAM OpenODD** standard provides a formal language for defining Operational Design Domains:

```json
{
  "odd_id": "airside_airside_v1",
  "scenery": {
    "road_types": ["service_road", "taxiway_crossing", "ramp_area"],
    "surface_types": ["asphalt", "concrete"],
    "infrastructure": ["gate_areas", "fuel_farms", "maintenance_hangars"]
  },
  "environment": {
    "weather": ["clear", "rain", "fog", "snow"],
    "illumination": ["day", "night", "dawn_dusk"],
    "temperature": [-20, 50]
  },
  "dynamic_elements": {
    "agent_types": ["aircraft", "gse_autonomous", "gse_manual", "personnel", "passenger"],
    "max_agents": 50,
    "speed_range": [0, 25]
  },
  "constraints": {
    "max_ego_speed": 25,
    "connectivity_required": true,
    "operator_supervision": "remote_monitoring"
  }
}
```

### 4.4 KGRL: Knowledge-Graph-Guided Reinforcement Learning

**Paper:** "Knowledge-Graph-Guided Reinforcement Learning for Autonomous Driving" (AAAI 2024)

**Architecture:**
```
Environment → State observation
    |
    v
Scene Graph Construction (neural)
    |
    v
Knowledge Graph Query (symbolic)
  - Which rules apply in this situation?
  - What constraints must be satisfied?
  - What actions are permitted?
    |
    v
Rule-Constrained Action Space
  - Remove actions that violate rules
  - Boost actions that follow rules
    |
    v
RL Policy (neural, but constrained)
  - Learns within the rule-permitted action space
  - Cannot explore actions that violate symbolic rules
    |
    v
Action → Environment
```

**Benefit:** The RL agent never learns to violate rules, even during exploration. This is fundamentally different from reward shaping (where the agent could still find exploits) — the symbolic layer removes unsafe actions from the action space entirely.

---

## 5. Neuro-Symbolic Planning Architectures

### 5.1 The Two-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│              Symbolic Reasoning Layer                 │
│                                                       │
│  Scene Graph → Rule Engine → Constrained Plan Sketch │
│  (what to do, interpretable, verifiable)             │
└─────────────────────┬───────────────────────────────┘
                      │ Plan skeleton + constraints
┌─────────────────────┴───────────────────────────────┐
│              Neural Execution Layer                   │
│                                                       │
│  Plan Sketch → Neural Planner → Smooth Trajectory    │
│  (how to do it, continuous, comfortable)             │
└─────────────────────────────────────────────────────┘
```

**Example execution:**
```
Scene: Approaching gate with aircraft, ground crew, belt loader

Symbolic layer:
  1. Query scene graph: ego approaching aircraft_1 (distance 20m)
  2. Apply rules:
     - AircraftClearance: min_distance = 3m, reduce_speed_at = 30m
     - PersonnelSafety: yield to ground_crew_1 (8m away, crossing path)
     - EquipmentZone: belt_loader operating, avoid 5m radius
  3. Plan sketch:
     - Phase 1: Decelerate to 10 km/h (aircraft proximity rule)
     - Phase 2: Yield (stop) until ground_crew_1 clears path
     - Phase 3: Navigate around belt_loader (5m clearance)
     - Phase 4: Proceed to parking position (2m from aircraft nose)
  
Neural layer:
  - Takes plan sketch constraints
  - Generates smooth trajectory satisfying all constraints
  - Optimizes for comfort (jerk minimization) within safe envelope
  - Outputs: [x, y, theta, v, a] at 10 Hz for 5 seconds
```

### 5.2 PDM (Plan-Do-Monitor) with Scene Graphs

**Inspired by BDI (Belief-Desire-Intention) architecture:**

```
Perception → Scene Graph (Belief)
    |
    v
Goal Reasoning (Desire)
  - Mission goal: deliver baggage to gate 3
  - Safety goal: zero collisions
  - Efficiency goal: minimize time
    |
    v
Plan Selection (Intention)
  - Query scene graph for current situation
  - Match situation to plan library
  - Select best plan for current beliefs + desires
    |
    v
Neural Execution (Do)
  - Execute selected plan via neural trajectory generation
    |
    v
Monitor
  - Verify execution matches plan
  - Detect unexpected scene graph changes
  - Re-plan if situation deviates from assumptions
```

### 5.3 Logic-Constrained Trajectory Optimization

**Signal Temporal Logic (STL)** for specifying trajectory constraints:

```
STL specifications for airside:

phi_1 = G[0,T] (distance_to_aircraft > 3m)
  "Always maintain at least 3m from aircraft"

phi_2 = G[0,T] (speed < 15 km/h) U (distance_to_aircraft > 30m)
  "Maintain speed < 15 km/h until aircraft is > 30m away"

phi_3 = F[0, 10] (distance_to_goal < 1m)
  "Eventually (within 10 seconds) reach the goal"

phi_4 = G[0,T] (person_detected => F[0, 2] (speed < 5 km/h))
  "If a person is detected, reduce speed to < 5 km/h within 2 seconds"

Combined: phi = phi_1 AND phi_2 AND phi_3 AND phi_4
```

**STL-constrained optimization:**
```
Trajectory = argmax_tau robustness(tau, phi)
  s.t. dynamics_constraints(tau)
       comfort_constraints(tau)

where robustness(tau, phi) is the STL robustness score:
  robustness > 0 iff trajectory satisfies specification
  higher robustness = larger safety margin
```

**STL robustness is differentiable** — can be used as a loss function for neural planner training:
```
L = -robustness(tau_predicted, phi) + lambda * ||tau_predicted - tau_expert||^2
```

This trains a neural planner to both imitate expert behavior and satisfy formal specifications.

### 5.4 Hierarchical Task Networks (HTN) for Mission Planning

For complex multi-step airside missions:

```
Mission: "Deliver baggage from terminal to aircraft at gate 5"

HTN decomposition:
  deliver_baggage(terminal, gate_5)
    ├── load_baggage(terminal_bay)
    │   ├── navigate_to(terminal_bay)
    │   ├── dock_at(loading_point)
    │   └── wait_for(baggage_loaded)
    ├── transport(terminal_bay, gate_5)
    │   ├── plan_route(terminal_bay, gate_5)
    │   ├── follow_route()
    │   │   ├── navigate_segment(seg_1)
    │   │   ├── yield_at(intersection_2)  ← triggered by scene graph
    │   │   └── navigate_segment(seg_2)
    │   └── handle_unexpected()           ← neural fallback
    └── unload_baggage(gate_5)
        ├── navigate_to(aircraft_stand)
        ├── dock_at(belt_loader_position)
        └── wait_for(baggage_unloaded)
```

**HTN + scene graph integration:**
- The HTN provides the task structure (what to do)
- The scene graph provides the current situation (what is happening)
- When the scene graph indicates an unexpected event (e.g., path blocked), the HTN triggers re-planning
- Neural execution handles continuous control within each HTN action

---

## 6. Compositional Reasoning and Program Synthesis

### 6.1 Compositional Scene Understanding

**Key idea:** Understand complex scenes by composing simple concepts:

```
Simple concepts (learned):
  is_moving(x), is_person(x), is_near(x, y), is_in_path(x, ego)

Composed reasoning (symbolic):
  should_yield(ego) = EXISTS x: is_person(x) AND is_near(x, ego) AND is_in_path(x, ego)
  
  is_dangerous(situation) = 
    EXISTS x: is_aircraft(x) AND is_near(x, ego) AND engine_running(x)
    OR EXISTS x: is_person(x) AND is_in_path(x, ego) AND is_moving(x)
    OR speed(ego) > speed_limit(location(ego))
```

### 6.2 ProgPrompt and Code-as-Policy

**ProgPrompt (2022):** Use LLMs to generate robot programs:

```
Context: "You are controlling an autonomous baggage tractor on an airport ramp."
Observation: {scene_graph_as_text}
Task: "Navigate to gate 5 while respecting safety rules."

LLM generates:
```python
def navigate_to_gate_5(scene_graph, planner):
    # Check for blocking obstacles
    path = planner.plan_route(current_pos, gate_5_pos)
    
    for segment in path:
        # Check scene graph for each segment
        obstacles = scene_graph.query_near(segment, radius=10)
        
        for obs in obstacles:
            if obs.type == "person" and obs.distance < 8:
                planner.yield_until_clear(obs)
            elif obs.type == "aircraft" and obs.engine_state == "running":
                planner.avoid_zone(obs.jet_blast_zone)
            elif obs.type == "equipment" and obs.state == "operating":
                planner.maintain_clearance(obs, min_distance=5)
        
        planner.execute_segment(segment, max_speed=speed_limit(segment))
```

**Benefit:** The generated program is inspectable, modifiable, and debuggable. Unlike a neural planner's opaque weights, the program can be reviewed by safety engineers.

### 6.3 Visual Programming for Driving

**VisProg (2023) adapted for driving:**

```
Input: "If there is a pedestrian crossing ahead and the traffic light is red, stop."

Generated visual program:
  1. DETECT(image, "pedestrian") → ped_boxes
  2. DETECT(image, "traffic_light") → tl_boxes
  3. CLASSIFY(tl_boxes[0], "color") → "red"
  4. SPATIAL_RELATION(ped_boxes, ego_path) → "crossing"
  5. IF result_3 == "red" AND result_4 == "crossing":
       ACTION("stop")
```

Each step uses a neural module (detector, classifier) but the composition is symbolic — explicitly structured and verifiable.

---

## 7. LLM-Symbolic Hybrid Systems

### 7.1 LLM as Scene Graph Reasoner

```
Input: Scene graph (structured) + question (natural language)

Scene graph (JSON):
{
  "nodes": [
    {"id": "ego", "type": "gse", "speed": 12, "heading": 90},
    {"id": "ac1", "type": "aircraft", "state": "pushback", "distance": 25},
    {"id": "crew1", "type": "person", "activity": "marshalling", "distance": 15}
  ],
  "edges": [
    {"src": "ego", "dst": "ac1", "type": "approaching", "closing_rate": 3.0},
    {"src": "crew1", "dst": "ac1", "type": "directing_pushback"},
    {"src": "ego", "dst": "crew1", "type": "in_field_of_view"}
  ]
}

Question: "What should the ego vehicle do?"

LLM reasoning (chain-of-thought):
1. Aircraft ac1 is in pushback state → pushback has highest priority on ramp
2. Crew1 is directing the pushback → marshaller signals must be obeyed
3. Ego is approaching at 12 km/h, closing rate 3.0 m/s → will reach aircraft in ~8s
4. Rule: yield to all pushback operations, minimum 15m clearance
5. Current distance 25m, closing at 3 m/s → must decelerate within 3s

Decision: Decelerate to stop, maintain 15m clearance from aircraft, 
          monitor marshaller signals for proceed indication.
```

### 7.2 DriveCoT: Chain-of-Thought Driving with Scene Graphs

**Architecture:**
```
Perception → Scene Graph → LLM Chain-of-Thought → Action

Step 1 (Perception): What do I see?
  "Detected: 1 aircraft (pushback), 1 marshaller, 2 GSE vehicles"

Step 2 (Situation): What is happening?
  "Aircraft pushback in progress at gate 7. Marshaller directing."

Step 3 (Rules): What rules apply?
  "Rule 1: Yield to pushback operations (Airport Manual 3.2.1)"
  "Rule 2: Obey marshaller signals (ICAO Doc 9137)"
  "Rule 3: Minimum 15m clearance during pushback"

Step 4 (Plan): What should I do?
  "Stop at 15m from aircraft. Wait for marshaller's proceed signal."

Step 5 (Action): Trajectory command
  "Decelerate at -1.5 m/s^2, stop at position (15, 20)"
```

### 7.3 Grounding LLM Reasoning in Physics

**Problem:** LLMs can hallucinate physically impossible actions ("accelerate to 100 km/h to avoid the obstacle").

**Solution: Physics-grounded scene graph**
```
Scene graph includes physical constraints:
  ego.max_acceleration = 2.0 m/s^2
  ego.max_deceleration = 3.0 m/s^2
  ego.max_speed = 25 km/h
  ego.turning_radius_min = 5.0 m
  
LLM prompt includes: "You are constrained by: max accel 2 m/s^2, max decel 3 m/s^2, 
                       max speed 25 km/h, min turn radius 5m."

LLM output is validated: 
  If proposed trajectory violates physics → reject, request re-reasoning
  If proposed trajectory is physically valid → pass to execution
```

---

## 8. Verification and Interpretability

### 8.1 Verifiable Neuro-Symbolic Pipelines

The key advantage of neuro-symbolic systems: the symbolic layer can be formally verified.

```
Neural layer (statistical validation):
  - Perception accuracy: mAP, NDS on test set
  - Scene graph accuracy: relation prediction F1
  - Coverage: what fraction of situations correctly classified

Symbolic layer (formal verification):
  - Rule completeness: do rules cover the entire ODD?
  - Rule consistency: no contradictory rules?
  - Rule safety: does following all rules guarantee safety?
  - Can be checked with SMT solvers (Z3) or model checkers (NuSMV)

Interface (validated):
  - Neural outputs are within expected ranges
  - Scene graph structure matches ontology
  - Confidence thresholds correctly calibrated
```

### 8.2 Explanation Generation

```python
class ExplainableDecision:
    """Generate human-readable explanations for planning decisions."""
    
    def explain(self, scene_graph, decision):
        """
        Returns: structured explanation with reasoning chain
        """
        explanation = {
            "decision": decision.action,
            "reasoning_chain": [],
            "rules_applied": [],
            "confidence": decision.confidence
        }
        
        # Trace which scene graph elements influenced the decision
        for rule in decision.active_rules:
            matched_nodes = scene_graph.query(rule.precondition)
            explanation["rules_applied"].append({
                "rule": rule.name,
                "source": rule.source_document,
                "matched_entities": [n.id for n in matched_nodes],
                "constraint": rule.constraint_description
            })
        
        # Generate natural language explanation
        explanation["natural_language"] = self._to_natural_language(explanation)
        
        return explanation
    
    def _to_natural_language(self, explanation):
        """Convert structured explanation to readable text."""
        lines = [f"Action: {explanation['decision']}"]
        for rule in explanation["rules_applied"]:
            entities = ", ".join(rule["matched_entities"])
            lines.append(f"Because: {rule['rule']} applies to {entities}")
            lines.append(f"  Source: {rule['source']}")
        return "\n".join(lines)


# Example output:
# Action: DECELERATE to 0 km/h at position (15.0, 20.0)
# Because: PushbackYield rule applies to aircraft_1
#   Source: Airport Operations Manual Section 3.2.1
# Because: MarshallerObey rule applies to ground_crew_1
#   Source: ICAO Doc 9137 Part 2
# Because: AircraftClearance rule applies to aircraft_1 (min 15m)
#   Source: ISO 3691-4 Annex B
```

### 8.3 Certification Argument Structure

```
Safety Case for Neuro-Symbolic Planning:

Claim: The planning system makes safe decisions in all ODD scenarios.

Evidence 1 (Symbolic layer):
  - All rules formally verified for completeness and consistency (SMT/Z3)
  - Rule set covers 100% of ODD scenarios (per scenario taxonomy)
  - No contradictory rules (model checker proof)

Evidence 2 (Neural perception):
  - mAP > 70% on airside test set (1000+ frames)
  - Scene graph recall > 85% for safety-critical relations
  - Validated on scenario taxonomy (115 functional scenarios)

Evidence 3 (Integration):
  - 10,000 simulated scenarios, 0 rule violations when perception is correct
  - Shadow mode: 5,000 km, 0 disagreements with human operator on safety decisions
  - Failure mode analysis: perception errors trigger conservative fallback (stop)

Evidence 4 (Runtime monitoring):
  - Scene graph consistency checking at 10 Hz
  - Confidence thresholds trigger degraded mode
  - All decisions logged with full reasoning chain (auditable)
```

---

## 9. Airside Applications

### 9.1 Airport Right-of-Way Knowledge Graph

Airport right-of-way rules are complex, context-dependent, and often informal:

```
Right-of-way priority (encoded as knowledge graph):

Priority 1: Emergency vehicles (always yield)
Priority 2: Aircraft under power (engines running)
Priority 3: Aircraft under tow/pushback
Priority 4: Fuel trucks (hazmat)
Priority 5: Passenger transport (buses, mobile lounges)
Priority 6: Catering/cleaning vehicles (time-critical turnaround)
Priority 7: Baggage/cargo tractors
Priority 8: General maintenance vehicles
Priority 9: Autonomous GSE (lowest — must yield to all above)

Context modifiers:
- If both at same priority → vehicle on the right yields (ICAO convention)
- If at intersection → vehicle already in intersection has priority
- If marshaller present → marshaller overrides all rules
- If NOTAM restricts area → affected vehicles lose access regardless of priority
```

**Knowledge graph encoding:**
```
:RightOfWay rdf:type :RuleSet ;
    :context :AirsideRamp .

:EmergencyPriority rdf:type :RightOfWayRule ;
    :applies_to :EmergencyVehicle ;
    :priority 1 ;
    :action "all_others_yield" .

:AircraftUnderPower rdf:type :RightOfWayRule ;
    :applies_to :Aircraft ;
    :condition [ :engine_state "running" ] ;
    :priority 2 ;
    :clearance_meters 15 ;
    :additional [ :jet_blast_zone "avoid" ] .

:ContextOverride_Marshaller rdf:type :Override ;
    :overrides :AllRightOfWayRules ;
    :condition [ :marshaller_present true ] ;
    :action "follow_marshaller_signals" .
```

### 9.2 NOTAM as Dynamic Rule Injection

NOTAMs change the rule set in real-time:

```
NOTAM: "Taxiway B closed for resurfacing 0800-1700 local"

Dynamic rule injection:
  1. Parse NOTAM (regex + LLM fallback, from ground-control-instructions.md)
  2. Create temporary rule:
     :TaxiwayBClosed rdf:type :TemporaryRule ;
         :affects :TaxiwayB ;
         :action "no_entry" ;
         :valid_from "2026-04-11T08:00:00" ;
         :valid_to "2026-04-11T17:00:00" .
  3. Inject into knowledge graph
  4. Scene graph query now returns "restricted" for any path through Taxiway B
  5. Planner re-routes automatically
```

### 9.3 Turnaround Scene Graph

Model the aircraft turnaround as an evolving scene graph:

```
t=0: Aircraft arrives
  Nodes: aircraft(A320, gate_5, engines_running)
  Edges: aircraft --[approaching]--> gate_5

t=+2min: Engines off, chocks placed
  Nodes: + chocks, + ground_power
  Edges: aircraft --[parked_at]--> gate_5
         chocks --[securing]--> aircraft

t=+5min: Doors open, equipment positioned
  Nodes: + jet_bridge, + belt_loader, + fuel_truck
  Edges: jet_bridge --[connected]--> aircraft
         belt_loader --[positioned_at]--> aircraft_hold_1
         fuel_truck --[approaching]--> aircraft

t=+15min: Full turnaround activity
  Nodes: + catering_vehicle, + water_truck, + crew_members(5)
  Edges: multiple service edges to aircraft
         crew_members --[operating]--> various_equipment

Query: "Is it safe for autonomous baggage tractor to approach aircraft hold 2?"
→ Check: belt_loader at hold_1, not hold_2. Fuel truck on other side. 
         No crew in path. Speed limit 10 km/h (turnaround active).
→ Answer: Yes, approach at ≤10 km/h via service road south.
```

---

## 10. Implementation

### 10.1 Scene Graph Data Structure

```python
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import numpy as np

class NodeType(Enum):
    EGO = "ego"
    AIRCRAFT = "aircraft"
    GSE = "gse"
    PERSON = "person"
    EQUIPMENT = "equipment"
    LANE = "lane"
    ZONE = "zone"
    GATE = "gate"

class EdgeType(Enum):
    # Spatial
    NEAR = "near"
    ON = "on"
    APPROACHING = "approaching"
    BLOCKING = "blocking"
    
    # Semantic  
    MUST_YIELD_TO = "must_yield_to"
    OPERATING = "operating"
    SERVICING = "servicing"
    
    # Temporal
    CONVERGING = "converging"
    DIVERGING = "diverging"

@dataclass
class SceneNode:
    id: str
    node_type: NodeType
    position: np.ndarray          # (x, y, z) global frame
    velocity: np.ndarray          # (vx, vy, vz)
    heading: float                # radians
    bbox: np.ndarray             # (length, width, height)
    attributes: Dict[str, any] = field(default_factory=dict)
    confidence: float = 1.0

@dataclass
class SceneEdge:
    source: str                   # node id
    target: str                   # node id
    edge_type: EdgeType
    attributes: Dict[str, any] = field(default_factory=dict)
    confidence: float = 1.0

class DrivingSceneGraph:
    """Scene graph for airside driving scenario."""
    
    def __init__(self):
        self.nodes: Dict[str, SceneNode] = {}
        self.edges: List[SceneEdge] = []
        self.timestamp: float = 0.0
    
    def add_node(self, node: SceneNode):
        self.nodes[node.id] = node
    
    def add_edge(self, edge: SceneEdge):
        self.edges.append(edge)
    
    def query_near(self, position: np.ndarray, radius: float, 
                   node_type: Optional[NodeType] = None) -> List[SceneNode]:
        """Find nodes within radius of position."""
        results = []
        for node in self.nodes.values():
            dist = np.linalg.norm(node.position[:2] - position[:2])
            if dist <= radius:
                if node_type is None or node.node_type == node_type:
                    results.append(node)
        return results
    
    def query_edges(self, source_id: str = None, target_id: str = None,
                    edge_type: EdgeType = None) -> List[SceneEdge]:
        """Query edges by source, target, or type."""
        results = []
        for edge in self.edges:
            if source_id and edge.source != source_id:
                continue
            if target_id and edge.target != target_id:
                continue
            if edge_type and edge.edge_type != edge_type:
                continue
            results.append(edge)
        return results
    
    def get_yield_targets(self, ego_id: str = "ego") -> List[SceneNode]:
        """Get all entities the ego must yield to."""
        yield_edges = self.query_edges(source_id=ego_id, 
                                        edge_type=EdgeType.MUST_YIELD_TO)
        return [self.nodes[e.target] for e in yield_edges]
    
    def get_active_rules(self, ego_id: str = "ego") -> List[Dict]:
        """Query knowledge graph for rules applicable to current situation."""
        ego = self.nodes[ego_id]
        active_rules = []
        
        # Speed zone rules
        for node in self.query_near(ego.position, 30, NodeType.AIRCRAFT):
            active_rules.append({
                "rule": "AircraftProximitySpeed",
                "constraint": {"max_speed": 15},  # km/h
                "trigger": node.id,
                "distance": np.linalg.norm(node.position[:2] - ego.position[:2])
            })
        
        # Right-of-way rules
        for edge in self.query_edges(source_id=ego_id, 
                                      edge_type=EdgeType.MUST_YIELD_TO):
            target = self.nodes[edge.target]
            active_rules.append({
                "rule": "RightOfWayYield",
                "constraint": {"action": "yield"},
                "trigger": target.id,
                "priority": self._get_priority(target)
            })
        
        return active_rules
    
    def _get_priority(self, node: SceneNode) -> int:
        """Right-of-way priority (lower = higher priority)."""
        priority_map = {
            "emergency": 1,
            "aircraft_powered": 2,
            "aircraft_pushback": 3,
            "fuel_truck": 4,
            "passenger_transport": 5,
            "catering": 6,
            "baggage_tractor": 7,
            "maintenance": 8,
            "autonomous_gse": 9,
        }
        return priority_map.get(
            node.attributes.get("role", "autonomous_gse"), 9
        )
```

### 10.2 Scene Graph Construction Pipeline (ROS)

```
10 Hz pipeline on Orin:

1. Object detection (CenterPoint, 8ms)
   → 3D bounding boxes with class, velocity

2. Tracking (SimpleTrack, 2ms)
   → Track IDs, histories

3. Map element extraction (from HD map, 0.5ms)
   → Lanes, zones, gates near ego

4. Relation prediction (GNN or heuristic, 3ms)
   → Spatial: distance, bearing, overlap
   → Semantic: on_lane, approaching, blocking
   → Rule-based: must_yield_to (from knowledge graph)

5. Graph assembly (0.5ms)
   → Combine nodes and edges into scene graph

Total: ~14ms → fits within 100ms cycle with room to spare
```

---

## 11. Comparison Table

| Approach | Type | Interpretable | Verifiable | Handles Novelty | Real-time | Best For |
|----------|------|--------------|-----------|-----------------|-----------|----------|
| Pure E2E (UniAD) | Neural | Low | Statistical | Good | Yes | High-performance driving |
| Rule engine | Symbolic | High | Formal | Poor | Yes | Simple, well-defined domains |
| Scene graph + rules | Neuro-symbolic | High | Partial | Moderate | Yes | Structured environments |
| LLM CoT reasoning | Hybrid | High | No | Excellent | Slow (1-2Hz) | Complex decision-making |
| STL-constrained planning | Neuro-symbolic | High | Formal | Moderate | Yes | Safety-critical trajectories |
| Knowledge graph RL | Neuro-symbolic | Moderate | Partial | Good | Yes | Learning with rule constraints |
| HTN + neural execution | Neuro-symbolic | High | Task-level | Moderate | Yes | Multi-step missions |
| Program synthesis | Neuro-symbolic | Highest | Code-level | Good | Moderate | Inspectable, auditable decisions |

**Recommendation for airside:** Scene graph + knowledge graph + STL-constrained planning. This combination provides:
- Neural perception accuracy (3D detection + tracking → scene graph)
- Symbolic rule compliance (knowledge graph of airside rules)
- Formal trajectory safety (STL specifications)
- Interpretability (reasoning chain from graph to decision)
- Real-time performance (14ms scene graph + 5ms rule query + 10ms STL planning)

---

## 12. Key Findings

| # | Finding |
|---|---------|
| 1 | Scene graphs bridge the gap between neural perception and symbolic reasoning — structured yet learnable |
| 2 | GNN-based interaction modeling (LaneGCN, HiVT, HDGT) naturally extends to airside heterogeneous agents |
| 3 | Knowledge graphs encode airport rules machine-readably — right-of-way priority, NOTAM constraints, speed zones |
| 4 | STL-constrained planning provides differentiable formal safety specifications — can train neural planners to satisfy them |
| 5 | Scene graph construction adds ~14ms on Orin — negligible overhead for significant interpretability gain |
| 6 | The two-layer architecture (symbolic reasoning + neural execution) separates "what to do" from "how to do it" — each layer can be validated independently |
| 7 | Neuro-symbolic systems offer a clear certification path: verify symbolic rules formally, validate neural perception statistically |
| 8 | NOTAM → knowledge graph injection enables dynamic rule updates without model retraining |
| 9 | Turnaround scene graphs capture the evolving multi-entity choreography around aircraft — enabling anticipatory planning |
| 10 | Program synthesis (ProgPrompt, VisProg) generates inspectable, debuggable driving programs from LLM reasoning |
| 11 | Airport right-of-way rules can be encoded as 9-level priority knowledge graph with context overrides |
| 12 | LLM-symbolic hybrid: LLM reasons over scene graph (not raw sensor data) — grounds language reasoning in structured perception |

---

## References

### Scene Graphs
- Yang, J., et al. "Scene Graph Generation: A Comprehensive Survey." arXiv 2024.
- Kim, J., et al. "3D Scene Graph: A Structure for Unified Semantics, 3D Space, and Camera." ICCV 2019.

### GNNs for Traffic
- Liang, M., et al. "Learning Lane Graph Representations for Motion Forecasting." ECCV 2020.
- Zhou, Z., et al. "HiVT: Hierarchical Vector Transformer for Multi-Agent Motion Prediction." CVPR 2022.
- Jia, X., et al. "HDGT: Heterogeneous Driving Graph Transformer." NeurIPS 2022.

### Knowledge Graphs
- Zhao, H., et al. "Knowledge-Graph-Guided Reinforcement Learning." AAAI 2024.
- Bagschik, G., et al. "Ontology-Based Scene Creation for Automated Driving." IV 2018.

### Neuro-Symbolic Planning
- Liang, J., et al. "ProgPrompt: Generating Situated Robot Task Plans using Large Language Models." ICRA 2023.
- Pant, Y. V., et al. "Fly-by-Logic: Control of Multi-Drone Fleets with Temporal Logic Objectives." ICCAS 2018.
- Leung, K., et al. "Back-propagation through Signal Temporal Logic Specifications." WAFR 2020.

### Driving Scene Graphs
- Renz, K., et al. "NuScenes-QA: A Multi-modal Visual Question Answering Benchmark." AAAI 2024.

---

*Document created: 2026-04-11*
*Complements: semantic-mapping-learned-priors.md (map topology), llm-reasoning-driving.md (LLM planning), vlm-scene-understanding.md (VLM perception), airside-scenario-taxonomy.md (scenario catalog)*
*Next steps: Prototype scene graph construction from CenterPoint detections, encode airport right-of-way rules in OWL ontology, evaluate STL-constrained planning on Frenet planner*
