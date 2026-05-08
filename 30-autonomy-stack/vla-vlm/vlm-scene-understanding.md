# Vision-Language Models for Airside AV Scene Understanding

## Beyond Action Prediction: VLMs for Reasoning, Anomaly Detection, and Safety Explanation

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [VLM vs VLA Distinction](#2-vlm-vs-vla-distinction)
3. [SOTA VLMs for Driving (2023-2026)](#3-sota-vlms-for-driving)
4. [Scene Description and Captioning](#4-scene-description-and-captioning)
5. [Anomaly Detection with VLMs](#5-anomaly-detection-with-vlms)
6. [Safety Reasoning and Explanation](#6-safety-reasoning-and-explanation)
7. [Airside-Specific Applications](#7-airside-specific-applications)
8. [Benchmarks and Evaluation](#8-benchmarks-and-evaluation)
9. [Architecture: VLM as Co-Pilot](#9-architecture-vlm-as-co-pilot)
10. [Deployment Considerations](#10-deployment-considerations)
11. [Recommended Strategy for reference airside AV stack](#11-recommended-strategy)
12. [References](#12-references)

---

## 1. Introduction

### 1.1 The Scene Understanding Gap

Current AV perception pipelines (detection, segmentation, tracking) answer **what** and **where** but not **why** or **what if**:

| Question | Classical Perception | VLM |
|----------|---------------------|-----|
| "What objects are present?" | Yes (detection) | Yes (richer taxonomy) |
| "Where is the cargo loader?" | Yes (3D bbox) | Yes (spatial language) |
| "Why is the tractor stopped?" | **No** | "Waiting for pushback clearance" |
| "Is this situation normal?" | **No** (requires rules) | "Unusual: crew member near engine intake" |
| "What should we do?" | Rules / learned policy | "Yield and alert ground control" |
| "Explain the near-miss" | **No** | "Belt loader reversed without checking mirror" |

VLMs provide **semantic reasoning** that complements geometric perception — critical for:
- **Safety case documentation**: explaining autonomous decisions in natural language
- **Anomaly detection**: identifying "weird but not dangerous" vs "unusual and dangerous"
- **Operator communication**: alerting ground control with human-readable scene descriptions
- **Post-incident analysis**: generating natural language explanations from sensor logs

### 1.2 Why Airside Needs VLM Reasoning

Airport airside operations involve complex multi-agent interactions that resist pure rule-based reasoning:

- **Turnaround sequencing**: Understanding that the catering truck must finish before the cargo loader can approach
- **NOTAM interpretation**: Parsing "TWY A closed between A3 and A5 for construction" and mapping to vehicle routing
- **Marshaller signals**: Interpreting hand signals and wand gestures in context
- **Abnormal situations**: Recognizing that a fuel spill, bird flock, or medical emergency requires non-standard response
- **Regulatory compliance**: Explaining decisions in terms an aviation safety officer understands

---

## 2. VLM vs VLA Distinction

```
Vision-Language-Action (VLA):
  Input: images/LiDAR → Output: ACTIONS (trajectory waypoints, control commands)
  Example: Alpamayo, RT-2, OpenVLA
  Goal: Replace or augment the planner
  Runs: In the planning loop, latency-critical (<100ms)

Vision-Language Model (VLM):
  Input: images/LiDAR → Output: TEXT (descriptions, explanations, decisions)
  Example: DriveVLM, DriveLM, GPT-4V
  Goal: Scene understanding, reasoning, explanation
  Runs: Parallel to planning, NOT latency-critical (200ms-2s acceptable)
```

**Key insight**: VLMs don't need to run in real-time for most applications. They can process at 1-5 Hz alongside the 10 Hz perception pipeline, providing higher-level reasoning on a slower cadence.

### 2.1 Deployment Modes

| Mode | Latency | Use Case | Where |
|------|---------|----------|-------|
| **Real-time co-pilot** | 200-500ms | Anomaly flagging, scene narration | On-vehicle (Orin) |
| **Slow deliberation** | 1-5s | Complex decision reasoning | On-vehicle or edge server |
| **Post-hoc analysis** | Minutes | Incident investigation, safety reports | Cloud |
| **Training annotation** | Seconds | Auto-labeling, data curation | Cloud |

---

## 3. SOTA VLMs for Driving (2023-2026) {#3-sota-vlms-for-driving}

### 3.1 Driving-Specific VLMs

| Model | Base | Input | Key Capability | Year |
|-------|------|-------|----------------|------|
| **DriveVLM** | InternVL | Multi-cam images | Scene description + analysis + planning CoT | 2024 |
| **DriveVLM-Dual** | InternVL + classical | Multi-cam + LiDAR | Hybrid: VLM reasoning + classical spatial | 2024 |
| **DriveLM** | LLaMA-Adapter | nuScenes images | Graph-structured QA (perception→prediction→planning) | 2024 |
| **DriveMLM** | LLaMA-2 | Multi-cam + LiDAR | Behavioral planning states + language explanation | 2024 |
| **DriveLLaVA** | LLaVA | Camera images | Human-level behavior decisions | 2024 |
| **Talk2BEV** | LLaMA | BEV map | Language-enhanced BEV for spatial QA | 2023 |
| **VLM-AutoDrive** | Various | Multi-cam | Safety-critical anomaly detection | 2026 |
| **LMGenDrive** | LLM + world model | Multi-modal | Reasoning + world model prediction | 2025 |

### 3.2 General-Purpose VLMs Applied to Driving

| Model | Size | Driving Performance | Limitations |
|-------|------|--------------------|-----------| 
| **GPT-4V/4o** | Unknown (cloud) | Good scene description, poor spatial reasoning | Cloud-only, high latency, expensive |
| **Gemini 1.5 Pro** | Unknown (cloud) | Strong video understanding | Cloud-only, privacy concerns |
| **LLaVA-1.6** | 7B/13B | Good general VQA, needs driving fine-tune | Can run on Orin (7B) |
| **InternVL2** | 2B-76B | Strong multi-modal, basis for DriveVLM | 2B version runs on edge |
| **Qwen2-VL** | 2B-72B | Good spatial grounding | 2B deployable on Orin |
| **Phi-3.5-Vision** | 4.2B | Fast, efficient for edge | Moderate accuracy |

### 3.3 DriveVLM Deep Dive

DriveVLM introduces a three-stage Chain-of-Thought reasoning pipeline:

```
Stage 1: Scene Description
  "The ego vehicle is on the airport apron. Ahead at 25m is a parked 
   A320 aircraft at stand 42. A belt loader is positioned at the 
   forward cargo door. Three ground crew members are visible near 
   the nose gear area."

Stage 2: Scene Analysis  
  "The belt loader appears to be completing cargo operations (door is 
   closing). The crew near the nose gear may be preparing for pushback. 
   The area between the ego vehicle and the aircraft nose is currently 
   clear but may become occupied as crew repositions."

Stage 3: Hierarchical Planning
  "Meta-action: SLOW_AND_YIELD
   Reasoning: Approaching active turnaround area. Crew may cross path.
   Decision: Reduce speed to 5 km/h. Maintain 10m clearance from aircraft.
   Contingency: If crew enters path, stop and wait."
```

**Key result**: DriveVLM-Dual combines this reasoning with classical spatial planning, achieving better safety scores than either system alone.

---

## 4. Scene Description and Captioning

### 4.1 Automatic Scene Narration

Generate natural language descriptions of the current driving scene for logging and operator awareness:

```python
class AirsideSceneNarrator:
    """
    Generate natural language descriptions of airside scenes.
    Runs at 1-2 Hz alongside main perception pipeline.
    """
    
    def __init__(self, vlm_model, perception_output):
        self.vlm = vlm_model
        self.perception = perception_output
    
    def narrate_scene(self, images, detections, ego_state):
        """
        Generate structured scene description.
        
        Input: camera images + detection results + ego vehicle state
        Output: natural language scene description
        """
        # Build structured context from perception
        context = self._build_context(detections, ego_state)
        
        prompt = f"""You are an airside safety observer for an autonomous GSE vehicle.
        
Current scene context:
- Location: {context['location']}
- Ego speed: {context['speed_kmh']:.1f} km/h
- Nearby objects: {context['objects']}
- Current task: {context['task']}

Describe the current scene focusing on:
1. Safety-relevant objects and their states
2. Any unusual or potentially hazardous conditions  
3. Expected next actions of nearby actors

Be concise (3-5 sentences). Use aviation terminology."""
        
        description = self.vlm.generate(images, prompt, max_tokens=200)
        return description
    
    def _build_context(self, detections, ego_state):
        return {
            'location': f"Stand {ego_state.nearest_stand}, {ego_state.zone}",
            'speed_kmh': ego_state.speed * 3.6,
            'objects': self._format_detections(detections),
            'task': ego_state.current_mission,
        }
```

### 4.2 Structured Scene QA

Instead of free-form narration, use structured question-answer pairs (DriveLM approach):

```python
AIRSIDE_QA_TEMPLATES = {
    # Perception questions
    'object_count': "How many {class_name} are within {distance}m of the ego vehicle?",
    'object_state': "What is the {class_name} at position ({x:.0f}, {y:.0f}) doing?",
    'clearance': "What is the clearance between the ego vehicle and the nearest aircraft?",
    
    # Prediction questions  
    'intent': "What is the likely next action of the {class_name} at ({x:.0f}, {y:.0f})?",
    'risk': "Is any actor likely to enter the ego vehicle's planned path?",
    'turnaround_phase': "What phase of the turnaround is currently in progress?",
    
    # Planning questions
    'action': "Should the ego vehicle proceed, slow down, stop, or yield?",
    'reason': "Why should the ego vehicle {action}?",
    'alternative': "If the current path is blocked, what is the best alternative?",
    
    # Safety questions
    'anomaly': "Is anything unusual or potentially hazardous in the current scene?",
    'jet_blast': "Is any aircraft engine running within 150m? If so, are we within the blast zone?",
    'fod': "Are there any objects on the ground that could be FOD?",
}
```

---

## 5. Anomaly Detection with VLMs

### 5.1 VLM-AutoDrive Framework (2026)

VLM-AutoDrive demonstrates post-training VLMs for safety-critical anomaly detection:

```
Pipeline:
  1. Metadata-derived captions (structured perception output → text)
  2. LLM-generated descriptions (enriched context from LLM)
  3. Visual question answering pairs (domain-specific QA)
  4. Chain-of-thought reasoning supervision (explicit reasoning traces)
  
Result: Significant improvement in detecting rare, safety-critical events
        that rule-based systems miss (e.g., "construction vehicle where 
        there should be none", "crew member not wearing hi-vis")
```

### 5.2 Anomaly Categories for Airside

| Category | Example | Rule-Based Detection | VLM Detection |
|----------|---------|---------------------|---------------|
| **Spatial anomaly** | Cargo loader in wrong position relative to aircraft | Possible with zone rules | Richer: "loader approaching starboard but cargo door is port side" |
| **Temporal anomaly** | Pushback starting before door close | Possible with state machine | "Passenger door still open, pushback should not begin" |
| **Behavioral anomaly** | Crew member running (emergency?) | Speed threshold only | "Crew member running toward terminal, may indicate medical emergency" |
| **Equipment anomaly** | Damaged GSE, oil leak | Very difficult | "Dark fluid trail behind fuel truck, possible fuel leak" |
| **Procedural anomaly** | Wrong sequence of turnaround | Complex state machine | "Belt loader arriving before cargo doors opened" |
| **Environmental anomaly** | FOD, bird flock, unusual surface | Limited (object detection) | "Flock of birds on taxiway center line at 80m, FOD risk" |

### 5.3 OOD Detection + VLM Explanation

Combine geometric OOD detection (Mahalanobis distance on features) with VLM explanation:

```python
class AnomalyDetector:
    """
    Two-stage anomaly detection:
    1. Fast OOD score from perception features (ms)
    2. Slow VLM explanation when OOD detected (200ms-1s)
    """
    
    def __init__(self, ood_detector, vlm):
        self.ood = ood_detector      # Mahalanobis / energy-based
        self.vlm = vlm               # VLM for explanation
        self.ood_threshold = 0.8     # trigger VLM analysis
    
    def detect_and_explain(self, features, images, detections):
        # Stage 1: Fast OOD scoring
        ood_score = self.ood.score(features)
        
        if ood_score < self.ood_threshold:
            return None  # normal scene, no VLM call needed
        
        # Stage 2: VLM explanation (only when OOD detected)
        prompt = f"""An anomaly detection system flagged this scene as unusual 
(confidence: {ood_score:.2f}).

Detected objects: {self._format_detections(detections)}

Analyze the scene and explain:
1. What is unusual about this scene?
2. Is this a safety hazard? (rate: none/low/medium/high/critical)
3. Recommended action for the autonomous vehicle
4. Should ground control be notified?"""
        
        explanation = self.vlm.generate(images, prompt, max_tokens=300)
        
        return {
            'ood_score': ood_score,
            'explanation': explanation,
            'timestamp': time.time(),
            'images': images,  # save for review
        }
```

---

## 6. Safety Reasoning and Explanation

### 6.1 Explainable Autonomous Decisions

VLMs can generate natural language explanations for every autonomous decision — critical for:
- **Safety case**: Demonstrating the system's reasoning to regulators
- **Operator trust**: Ground control can understand why the vehicle behaved a certain way
- **Post-incident investigation**: Natural language logs complement sensor data
- **Continuous improvement**: Identify reasoning failures without reviewing raw sensor data

### 6.2 Risk Semantic Distillation

Recent work (2025) shows VLM risk reasoning can be distilled into the perception pipeline:

```
Teacher: Large VLM (cloud, 2-5s per frame)
  → Generates risk descriptions for training data
  → "High risk: personnel crossing path at 15m, occluded by cargo container"

Student: Lightweight risk scorer (on-vehicle, 10ms)
  → Trained to predict risk scores from LiDAR features
  → Inherits VLM's semantic understanding of risk without VLM cost
  → Outputs per-object risk score + risk category
```

### 6.3 Chain-of-Thought for Safety Decisions

```
Scenario: Approaching active turnaround at stand 42

Perception: A320 parked, 2 belt loaders (active), 4 crew visible, fuel truck departing

CoT Reasoning:
  Step 1: "Fuel truck departing — fueling complete, no fire risk from fuel"
  Step 2: "Belt loaders active — cargo operations in progress, crew near cargo doors"
  Step 3: "4 crew visible but turnaround typically has 6-8 — some may be occluded by aircraft"
  Step 4: "Path clearance: 3.5m between ego lane and nearest belt loader — marginal"
  Step 5: "Risk assessment: MEDIUM — active turnaround, possible occluded crew"
  
Decision: SLOW to 5 km/h, maintain current lane, activate proximity warning
Explanation: "Proceeding slowly past active turnaround. Belt loader operations ongoing.
             Reduced speed due to possible occluded personnel behind aircraft fuselage."
```

---

## 7. Airside-Specific Applications

### 7.1 NOTAM Interpretation

NOTAMs (Notice to Air Missions) are text-based alerts that affect airside routing:

```python
NOTAM_INTERPRETATION_PROMPT = """You are an airside vehicle route planner.

Current NOTAM: "{notam_text}"

Vehicle current location: {location}
Planned route: {route}

Questions:
1. Does this NOTAM affect the planned route?
2. If yes, what specific areas should be avoided?
3. Suggest an alternative route if needed.
4. What additional hazards does this NOTAM imply?

Respond in structured JSON format."""

# Example NOTAM:
# "TWY A CLSD BTN A3 AND A5 FOR RESURFACING UNTIL 2026-04-15 2359Z.
#  CONSTRUCTION VEHICLES OPERATING. MARSHALLER REQUIRED FOR GSE PASSING A2."
#
# VLM output:
# {
#   "affects_route": true,
#   "closed_area": "Taxiway A between intersection A3 and A5",
#   "alternative": "Use Taxiway B or service road SR-2",
#   "additional_hazards": [
#     "Construction vehicles may be present near A2",
#     "Marshaller required at A2 — must stop and wait for guidance",
#     "Loose materials/debris possible near construction zone"
#   ]
# }
```

### 7.2 Turnaround Status Assessment

VLM can assess turnaround progress from visual observation:

```
Input: Camera images of aircraft stand
VLM assessment:
  "Stand 42 turnaround status:
   - Phase: Cargo unloading (estimated 40% complete)
   - Belt loader: Active at forward cargo door
   - Catering: Not yet arrived (expected)
   - Fuel: Completed (truck departed)
   - Passenger: Jetbridge connected, deboarding in progress
   - Estimated time to pushback: 25-35 minutes
   - Current safety status: Active operations, restricted zone"
```

### 7.3 FOD Classification and Reporting

Beyond detection, VLMs can classify and report FOD:

```
Detection system: "Unknown object on taxiway at (x=45.2, y=-12.8)"
VLM classification: "Object appears to be a cargo strap/tie-down, 
  approximately 0.5m length. Not a flight safety hazard but should be 
  reported and collected. Recommend: continue at reduced speed, log GPS 
  coordinates for ground crew collection, report to FOD management system."
```

### 7.4 Ground Crew Safety Monitoring

VLM can assess crew safety compliance:

```
Observations:
  - "Crew member #3 not wearing ear protection near running APU"
  - "Two crew members standing in engine intake danger zone (B737 intake radius 2.8m)"
  - "Hi-vis vest on crew member #5 appears partially obscured by equipment"
  
Recommended actions:
  - Alert ground supervisor via radio
  - Log safety observation for shift report
  - If crew enters ego vehicle path, stop and wait
```

---

## 8. Benchmarks and Evaluation

### 8.1 Driving VLM Benchmarks

| Benchmark | Focus | Size | Metric | Best Method |
|-----------|-------|------|--------|-------------|
| **DriveLM** | Graph QA (perception→planning) | 5K QA pairs | BLEU, CIDEr, accuracy | DriveLM-Agent |
| **LingoQA** | Video QA for driving | 28K QA pairs | Lingo-Judge (GPT-4 eval) | DriveVLM |
| **Reason2Drive** | Reasoning chain correctness | 600K QA pairs | Chain accuracy | — |
| **nuScenes-QA** | 3D spatial QA | 460K QA | Accuracy | Talk2BEV |
| **DRAMA** | Risk assessment QA | 17K QA pairs | AUC | GPT-4V |

### 8.2 Airside-Specific Evaluation

No airside VLM benchmark exists. Proposed evaluation categories:

```
1. Scene Description Accuracy
   - Object identification correctness (F1 score)
   - Spatial relationship accuracy (within 2m tolerance)
   - Activity recognition accuracy (turnaround phase)

2. Anomaly Detection
   - True positive rate for injected anomalies
   - False positive rate on normal operations
   - Explanation quality (human rating 1-5)

3. Safety Reasoning
   - Decision alignment with safety officer judgment
   - Risk level assignment accuracy
   - Explanation completeness (covers all relevant factors)

4. NOTAM Interpretation
   - Route impact identification accuracy
   - Alternative route quality
   - Hazard enumeration completeness
```

---

## 9. Architecture: VLM as Co-Pilot

### 9.1 Integration with reference airside AV stack Stack

```
┌──────────────────────────────────────────────────────┐
│                  REFERENCE AIRSIDE AV STACK AV STACK                      │
│                                                        │
│  10Hz Primary Loop (latency-critical):                │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐ │
│  │ LiDAR   │→ │ Detect/  │→ │ Track/  │→ │ Frenet │ │
│  │ Preproc │  │ Segment  │  │ Predict │  │ Plan   │ │
│  └─────────┘  └──────────┘  └─────────┘  └────────┘ │
│                     │              │                    │
│                     ▼              ▼                    │
│  1-2Hz VLM Loop (reasoning, NOT latency-critical):    │
│  ┌─────────────────────────────────────────┐          │
│  │  VLM Co-Pilot                           │          │
│  │  ┌──────────────┐  ┌─────────────────┐ │          │
│  │  │ Scene        │  │ Anomaly         │ │          │
│  │  │ Narrator     │  │ Detector+Explnr │ │          │
│  │  └──────────────┘  └─────────────────┘ │          │
│  │  ┌──────────────┐  ┌─────────────────┐ │          │
│  │  │ Safety       │  │ NOTAM           │ │          │
│  │  │ Reasoner     │  │ Interpreter     │ │          │
│  │  └──────────────┘  └─────────────────┘ │          │
│  └──────────────┬──────────────────────────┘          │
│                  │                                      │
│                  ▼                                      │
│  ┌──────────────────────────────────────────┐         │
│  │  Safety Override (if VLM flags CRITICAL)  │         │
│  │  → Can request: speed reduction, stop,    │         │
│  │    reroute, alert ground control          │         │
│  └──────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────┘
```

### 9.2 VLM Override Authority

VLMs should NOT directly control the vehicle. Instead:

| VLM Output | Authority | Action |
|-----------|-----------|--------|
| "Scene normal" | None | Log only |
| "Unusual but safe" | Advisory | Log + alert operator |
| "Potential hazard" | Request | Request speed reduction via Simplex |
| "Safety-critical" | Demand | Demand stop via safety system |

**The Simplex architecture mediates**: VLM outputs feed into the decision module alongside perception. The safety controller (BC) always has veto power.

---

## 10. Deployment Considerations

### 10.1 On-Vehicle VLM Options

| Model | Size | Orin FP16 Latency | Memory | Quality |
|-------|------|-------------------|--------|---------|
| Phi-3.5-Vision | 4.2B | ~500ms | 5 GB | Adequate |
| InternVL2-2B | 2B | ~300ms | 3 GB | Good |
| Qwen2-VL-2B | 2B | ~350ms | 3 GB | Good |
| LLaVA-1.6-7B | 7B | ~1.5s | 8 GB | Better |
| DriveVLM (custom) | ~3B | ~400ms | 4 GB | Best (driving-specific) |

**Recommendation**: InternVL2-2B or Qwen2-VL-2B for on-vehicle at 1-2 Hz. Use INT4 quantization via GPTQ or AWQ for further speedup.

### 10.2 Edge Server Option

For fleets >10 vehicles, a shared edge server at the airport can run larger VLMs:

```
Airport edge server (1× A100 or 2× L40S):
  - Serves 10-20 vehicles simultaneously
  - Runs 7B+ model with better reasoning
  - <500ms round-trip via airport 5G/WiFi
  - Handles NOTAM interpretation (batch, not real-time)
  - Processes anomaly explanations when OOD detected
  - Stores and indexes all scene descriptions for post-hoc analysis

Cost: $20-40K hardware, $5-10K/yr maintenance
ROI: Shared across fleet, enables capabilities too large for on-vehicle
```

### 10.3 Privacy and Security

Airside operations may involve sensitive information:
- Aircraft tail numbers → flight identification → passenger data
- Airline operations procedures → competitive intelligence
- Security personnel positions → vulnerability exposure

**Mitigation**: Run VLMs on-premise (on-vehicle or airport edge server). Do NOT send airside images to cloud APIs (GPT-4V, Gemini).

---

## 11. Recommended Strategy for reference airside AV stack {#11-recommended-strategy}

### 11.1 Phased Deployment

```
Phase 1 (3 months): Cloud-based scene description for data curation
  - Use GPT-4V/Gemini on recorded (not live) data
  - Generate scene descriptions for training data quality assessment
  - Auto-caption dataset for active learning prioritization
  - Cost: ~$500/month API costs for 10K images/day

Phase 2 (3 months): On-vehicle anomaly detection
  - Deploy InternVL2-2B on Orin (INT4, 300ms, 3GB)
  - Run at 1 Hz alongside perception pipeline
  - Log anomaly scores + explanations
  - Shadow mode: compare VLM flags vs human operator observations

Phase 3 (6 months): VLM co-pilot with safety integration
  - VLM anomaly detector feeds into Simplex decision module
  - NOTAM interpreter runs on airport edge server
  - Scene narrator generates shift reports automatically
  - Ground control dashboard shows VLM scene descriptions

Phase 4 (ongoing): Continuous improvement
  - Fine-tune on airside-specific data (DriveLM-style QA pairs)
  - Distill VLM reasoning into lightweight risk scorer
  - Expand to turnaround status monitoring
```

### 11.2 Cost Estimate

| Item | Cost | Notes |
|------|------|-------|
| Phase 1: Cloud API costs | $1,500 (3 months) | GPT-4V for data curation |
| Phase 2: Model fine-tuning | $3,000 | InternVL2-2B on airside data |
| Phase 2: Integration engineering | $10,000 | ROS node, Orin deployment |
| Phase 3: Edge server (optional) | $25,000 | 1× A100 for fleet serving |
| Phase 3: Safety integration | $15,000 | Simplex integration, testing |
| **Total (Phases 1-3)** | **$30,000-55,000** | |

---

## 12. References

### Driving VLMs
- **DriveVLM**: Tian et al., "DriveVLM: The Convergence of Autonomous Driving and Large Vision-Language Models" (2024) — [arxiv.org/abs/2402.12289](https://arxiv.org/abs/2402.12289)
- **DriveLM**: Sima et al., "DriveLM: Driving with Graph Visual Question Answering" (2024)
- **DriveMLM**: Wang et al., "DriveMLM: Aligning Multi-Modal Large Language Models with Behavioral Planning States" (Visual Intelligence 2025) — [Springer](https://link.springer.com/article/10.1007/s44267-025-00095-w)
- **Talk2BEV**: Dewangan et al., "Talk2BEV: Language-Enhanced Bird's-Eye View Maps for Autonomous Driving" (2023)
- **DriveLLaVA**: "DriveLLaVA: Human-Level Behavior Decisions via Vision Language Model" (2024) — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243790/)

### Anomaly Detection & Safety
- **VLM-AutoDrive**: "Post-Training Vision-Language Models for Safety-Critical Autonomous Driving Events" (2026) — [arxiv.org/abs/2603.18178](https://arxiv.org/html/2603.18178)
- "Evaluation of Large Language Models for Anomaly Detection in Autonomous Vehicles" (2025) — [arxiv.org/abs/2509.05315](https://arxiv.org/abs/2509.05315)
- "Enhancing End-to-End Autonomous Driving with Risk Semantic Distillation from VLM" (2025) — [arxiv.org/abs/2511.14499](https://arxiv.org/abs/2511.14499)

### Surveys
- "Vision Language Models in Autonomous Driving: A Survey and Outlook" (2024) — [arxiv.org/abs/2310.14414](https://arxiv.org/abs/2310.14414)
- "Vision-Language-Action Models for Autonomous Driving: Past, Present, and Future" (2025) — [arxiv.org/abs/2512.16760](https://arxiv.org/abs/2512.16760)
- Awesome-LLM4AD — [github.com/Thinklab-SJTU/Awesome-LLM4AD](https://github.com/Thinklab-SJTU/Awesome-LLM4AD)

### Benchmarks
- **LingoQA**: Video QA evaluation for driving
- **Reason2Drive**: Reasoning chain correctness measurement
- **DRAMA**: Risk assessment QA dataset
- "Automated Evaluation of Large Vision-Language Models on Self-Driving Corner Cases" (WACV 2025)
