# Vision-Language-Action Models (VLAs) and Their Application to Autonomous Driving

**Technical Research Report -- March 2026**

---

## Table of Contents

1. [What Are VLAs?](#1-what-are-vlas)
2. [Key VLA Architectures and Papers](#2-key-vla-architectures-and-papers)
3. [How VLAs Could Improve AV Stacks](#3-how-vlas-could-improve-av-stacks)
4. [Advantages for Airside (Airport Tarmac) Operations](#4-advantages-for-airside-airport-tarmac-operations)
5. [Limitations and Challenges](#5-limitations-and-challenges)
6. [Sources](#sources)

---

## 1. What Are VLAs?

### 1.1 Definition and Motivation

A Vision-Language-Action (VLA) model is a multimodal foundation model that jointly processes visual observations and natural language instructions to directly output executable actions (robot motor commands, driving trajectories, or control signals). VLAs extend Vision-Language Models (VLMs) -- which map images and text to semantic understanding -- by adding an **action prediction head** that grounds language-informed visual reasoning in physical behavior.

The motivation is straightforward: traditional perception-planning-control pipelines decompose driving into isolated modules, each with its own failure modes and information loss at module boundaries. VLAs promise to collapse this pipeline into a single learned model that can leverage Internet-scale knowledge (from VLM pre-training) while producing physically grounded actions.

### 1.2 Canonical Architecture

All VLA systems follow a common formulation:

```
a_t = H(F(x | theta))
```

Where:
- **x** aggregates multimodal inputs: camera images, optional LiDAR, language instructions, ego-vehicle state
- **F(.)** is the VLM backbone that encodes multimodal inputs into a shared latent representation
- **H(.)** is the action prediction head that maps latent representations to executable actions
- **theta** are the learned parameters

The architecture decomposes into three principal components:

#### 1.2.1 Vision Encoder

Converts raw image(s) into visual token sequences. Common choices include:

| Encoder | Used By | Key Property |
|---------|---------|-------------|
| ViT (CLIP) | RT-2, EMMA | Semantic alignment with language |
| SigLIP | OpenVLA, pi0 | Improved contrastive learning |
| DINOv2 | OpenVLA | Strong spatial/geometric features |
| DINOv2 + SigLIP (fused) | OpenVLA | Best of both: spatial + semantic |
| Custom CNN/ViT | LINGO-2, DriveVLM | Domain-specific adaptation |

Some architectures (e.g., OpenVLA) fuse features from complementary encoders by concatenating them channel-wise before projecting into the language model's embedding space via a small MLP.

#### 1.2.2 Language Model Backbone

A pre-trained LLM serves as the central reasoning hub, processing interleaved sequences of visual tokens, language tokens, and (optionally) proprioceptive state tokens. The LLM's auto-regressive attention mechanism performs cross-modal fusion and sequential reasoning. Common backbones:

- **Llama 2 (7B)**: OpenVLA
- **PaLM-E (12B) / PaLI-X (55B)**: RT-2
- **PaliGemma (3B)**: pi0
- **Gemini**: EMMA (Waymo)
- **Qwen-VL (9.7B)**: DriveVLM
- **InternVL2 (1B)**: SimLingo

#### 1.2.3 Action Prediction Head

The action head is the critical differentiator among VLA designs. Four principal architectures have emerged:

**1. Language/Token Head (Autoregressive)**
Robot actions are discretized into bins and mapped to vocabulary tokens. The LLM generates action tokens just as it generates text. Used by RT-2, OpenVLA, GPT-Driver.
- *Pros*: Leverages full LLM reasoning; simple implementation
- *Cons*: Quantization errors; sequential decoding creates latency that scales linearly with action chunk length; repetitive token patterns degrade quality

**2. Regression Head (MLP)**
A small MLP directly regresses continuous action values from the LLM's hidden states. Used by LMDrive.
- *Pros*: Fast inference; continuous outputs
- *Cons*: Unimodal; struggles with multimodal action distributions

**3. Flow Matching / Diffusion Head**
A separate "action expert" module uses iterative denoising (flow matching or diffusion) to generate continuous action chunks. Used by pi0, Octo.
- *Pros*: Captures multimodal action distributions; high-frequency control (50 Hz); decouples latency from sequence length
- *Cons*: Additional parameters; iterative inference steps

**4. Trajectory Selection Head**
Evaluates and scores a set of candidate trajectories using a learned cost function. Used by LanguageMPC, some dual-system VLAs.
- *Pros*: Can integrate safety constraints; leverages existing planners
- *Cons*: Limited to pre-defined trajectory space

### 1.3 Training Paradigms

VLAs are typically trained in stages:

1. **VLM Pre-training**: The vision-language backbone is pre-trained on Internet-scale image-text data (LAION-5B, WebLI, etc.) to acquire world knowledge, semantic understanding, and visual grounding.

2. **Robot/Driving Data Co-Fine-Tuning**: The pre-trained VLM is fine-tuned on domain-specific data (robot trajectories, driving demonstrations) while retaining some web data to prevent catastrophic forgetting. RT-2 pioneered this "co-fine-tuning" approach.

3. **Task-Specific Post-Training**: Optional fine-tuning on narrow task distributions for deployment. Parameter-efficient methods (LoRA, adapters) enable this on modest hardware -- OpenVLA demonstrated that LoRA (rank 32-64) matches full fine-tuning while training only 1.4% of parameters on a single A100 GPU.

4. **Reinforcement Fine-Tuning**: Emerging approaches (AutoVLA) apply GRPO or similar RL methods to optimize action quality beyond behavior cloning.

---

## 2. Key VLA Architectures and Papers

### 2.1 Foundational Robotics VLAs

#### RT-2: Robotic Transformer 2 (Google DeepMind, July 2023)

RT-2 is the seminal VLA paper that established the paradigm of representing robot actions as language tokens within a vision-language model.

- **Architecture**: Two variants -- 12B parameters (PaLM-E backbone) and 55B parameters (PaLI-X backbone). Robot actions are encoded as text strings of discretized token numbers (e.g., "1 128 91 241 5 101 127 217"), each representing a dimension of the 7-DoF action space.
- **Training**: Co-fine-tuned on a mixture of web-scale vision-language data and robot demonstration data. The robot data pairs current images + language commands with timestep-level actions.
- **Key Result**: Performance on unseen scenarios jumped from RT-1's 32% to 62%, demonstrating that Internet-scale pre-training provides emergent generalization to novel objects, instructions, and semantic categories.
- **Significance**: Proved that VLMs can serve as effective robot controllers by treating actions as "another language," without architectural changes to the underlying model.

#### RT-X / Open X-Embodiment (Google DeepMind + 33 Labs, October 2023)

The Open X-Embodiment project pooled 60 existing robot datasets from 34 labs worldwide, covering 22 robot types, 527 skills, and 160,266 tasks.

- **RT-1-X**: RT-1 architecture trained on the full Open X-Embodiment dataset. Achieved 50% average success rate improvement across 5 robot platforms compared to platform-specific methods.
- **RT-2-X**: RT-2 (55B, PaLI-X) co-fine-tuned on Open X-Embodiment data. Outperformed standard RT-2 by 3x on emergent skill evaluations.
- **Significance**: Established the first large-scale, cross-embodiment robot learning dataset and demonstrated positive transfer across robot morphologies -- a critical prerequisite for generalist robot policies.

#### Octo (UC Berkeley et al., May 2024)

Octo is the first fully open-source generalist robot policy, designed for maximum flexibility.

- **Architecture**: Transformer-based diffusion policy with modular attention structure. Available in two sizes: Octo-Small (27M parameters) and Octo-Base (93M parameters).
- **Training**: Pre-trained on 800K robot episodes from 25 datasets in the Open X-Embodiment collection.
- **Key Innovation**: Modular token-based input design allows the same model to accept different camera configurations (workspace/wrist), different robot morphologies, and either language commands or goal images -- without retraining.
- **Action Head**: Diffusion-based decoder for continuous action generation.
- **Performance**: Matches RT-2-X (55B parameters) using language task specification, despite being orders of magnitude smaller.

#### OpenVLA (Stanford, June 2024)

OpenVLA democratized VLA research by releasing a fully open-source 7B-parameter model.

- **Architecture**: Prismatic VLM backbone = fused DINOv2 + SigLIP vision encoders + Llama 2 (7B) LLM. Actions discretized into 256 bins per dimension, mapped to the 256 least-used Llama vocabulary tokens.
- **Training**: Fine-tuned on 970K curated robot manipulation trajectories from Open X-Embodiment across 27 epochs. Critically, the vision encoder is also fine-tuned (freezing it dropped success rate from ~70% to 47%).
- **Fine-Tuning**: LoRA (rank 32-64) achieves 68.2% success rate vs. 69.7% for full fine-tuning, while requiring 8x less GPU memory. Enables adaptation on a single A100 in 10-15 hours.
- **vs. RT-2-X**: Outperforms RT-2-X by 16.5% absolute success rate on BridgeData V2 despite being 7.8x smaller (7B vs. 55B). RT-2-X retains an advantage in semantic generalization due to larger-scale pre-training.

#### pi0 (Physical Intelligence, October 2024)

pi0 introduced flow matching as a superior action decoding mechanism for VLAs.

- **Architecture**: PaliGemma (3B) VLM backbone + 300M-parameter "action expert" module (total 3.3B parameters). The action expert uses separate transformer weights with full bidirectional attention across action tokens, inspired by Mixture-of-Experts designs.
- **Action Generation**: Flow matching (a variant of diffusion models) generates continuous action chunks at up to 50 Hz. At inference, the model denoises random noise into action sequences by integrating the learned flow field over tau in [0, 1].
- **Training**: Two-phase strategy:
  - *Pre-training*: 10,000+ hours of data from 7 robot configurations and 68 tasks, plus Open X-Embodiment public data
  - *Post-training*: 5-100 hours of task-specific curated data
- **Key Result**: 2x+ improvement over the non-VLM variant (pi0-small, 470M), validating the value of Internet-scale pre-training for physical manipulation.
- **Significance**: Demonstrated that flow matching overcomes the precision and frequency limitations of autoregressive action tokenization, enabling dexterous manipulation of deformable objects (folding laundry, assembling boxes).

### 2.2 Driving-Specific VLAs and VLAMs

#### LINGO-1 and LINGO-2 (Wayve, 2023-2024)

LINGO-2 is the first closed-loop Vision-Language-Action driving Model (VLAM) tested on public roads.

- **Architecture**: Two modules -- (1) Wayve's vision model processes multi-frame camera images into token sequences; (2) an autoregressive language model receives vision tokens plus conditioning variables (route info, current speed, speed limits) and jointly predicts driving trajectories and commentary text.
- **Closed-Loop Operation**: Unlike LINGO-1 (open-loop commentary only), LINGO-2 directly controls the vehicle while simultaneously generating natural language explanations of its decisions.
- **Language-Conditioned Driving**: By swapping token ordering, language instructions ("pull over," "turn right") become prompts that condition driving behavior, enabling direct human-to-vehicle communication.
- **Validation**: Tested on public roads in London; initially validated in Wayve's Ghost Gym neural simulator before real-world deployment.

#### SimLingo (Wayve / University of Tubingen, CVPR 2025 Spotlight)

SimLingo extends the LINGO line of work with a focus on language-action alignment.

- **Architecture**: Integrates InternVL2-1B (generalist VLM) fine-tuned with LoRA, with a disentangled output representation using temporal speed waypoints and geometric path waypoints.
- **Innovation -- Action Dreaming**: A new training task where the model learns to align language instructions with driving actions without executing potentially unsafe maneuvers, enabling instruction-following evaluation.
- **Results**: 1st place at CVPR 2024 CARLA Autonomous Driving Challenge. State-of-the-art on CARLA Leaderboard and Bench2Drive. Handles VQA, commentary, and instruction following simultaneously.
- **Vision-Only**: Camera-only input (no LiDAR), demonstrating that VLA approaches can achieve competitive performance with lower sensor cost.

#### DriveVLM / DriveVLM-Dual (Tsinghua University / Li Auto, February 2024)

DriveVLM is a Chain-of-Thought reasoning VLA system with a practical hybrid deployment architecture.

- **Architecture**: Built on Qwen-VL (9.7B parameters). Processes multi-frame image sequences through three reasoning modules:
  1. **Scene Description**: Environment characterization (weather, road conditions, traffic state)
  2. **Scene Analysis**: Critical object identification, including long-tail objects that elude conventional 3D detectors (road debris, unusual obstacles)
  3. **Hierarchical Planning**: Multi-level planning decisions derived from CoT reasoning

- **DriveVLM-Dual (Hybrid System)**: Addresses VLM limitations in spatial reasoning and latency by combining DriveVLM with a traditional AV pipeline:
  - 3D object detectors generate bounding boxes, which are projected to 2D and IoU-matched with DriveVLM's critical objects, enriching the VLM's understanding with precise 3D geometry
  - A high-frequency traditional planner uses DriveVLM's low-frequency trajectory as a reference, enabling real-time control
  - **Deployed on production vehicles** at Li Auto

- **Dataset**: Custom SUP-AD dataset with annotated scene descriptions, analyses, and planning labels. Waypoint annotations auto-generated from vehicle IMU recordings.

#### LMDrive (CVPR 2024)

LMDrive is the first language-guided, closed-loop, end-to-end driving framework.

- **Architecture**: Two components -- (1) a vision encoder processing multi-view, multi-modal sensor data (cameras + LiDAR) into visual tokens; (2) an LLM that processes historical visual tokens and language instructions to predict control signals and instruction completion status.
- **Dataset**: ~64K instruction-following data clips with the LangAuto benchmark for evaluating complex instruction handling.
- **Key Capability**: Processes natural language navigation instructions ("turn left at the next intersection, then pull over after the blue building") and translates them into real-time control signals in CARLA simulation.

#### GPT-Driver (NeurIPS Workshop, 2023)

GPT-Driver pioneered the reformulation of motion planning as a language modeling problem.

- **Approach**: Represents planner inputs (scene context, map, ego state) and outputs (trajectory waypoints) as language tokens. Trajectory coordinates are described as text sequences of numerical positions.
- **Training Strategy**: Three-phase prompting-reasoning-finetuning pipeline applied to GPT-3.5:
  1. Prompting: Structured scene descriptions as LLM input
  2. Reasoning: Eliciting chain-of-thought decision rationale
  3. Fine-tuning: Optimizing for precise numerical coordinate prediction
- **Results**: Demonstrated competitive motion planning on nuScenes with superior interpretability (the model can explain its trajectory choices) and few-shot generalization.

#### Dolphins (ECCV 2024)

Dolphins is a multimodal language model designed as a conversational driving assistant.

- **Architecture**: Built on OpenFlamingo (open-source VLM). Enhanced with Grounded Chain-of-Thought (GCoT) reasoning in the general domain, then fine-tuned for driving with domain-specific instruction data.
- **Inputs**: Video/image data, text instructions, and historical control signals.
- **Tasks**: Four consolidated AV tasks on the BDD-X dataset covering perception, prediction, and planning.
- **Results**: 223.6 CIDEr for action description, 134.2 CIDEr for justification, outperforming prior LVLMs by 27% on justification. Strong zero-shot generalization to unseen driving instructions.

#### LanguageMPC (October 2023)

LanguageMPC uses LLMs as high-level decision makers interfacing with Model Predictive Control.

- **Architecture**: Dual-frequency design:
  - *Low-frequency*: LLM makes strategic decisions every few seconds (lane change, speed adjustment, yield)
  - *High-frequency*: MPC executes fine-grained trajectory planning and control between LLM decisions
- **MPC Integration**: The LLM selects weights from a learned weight pool to balance four MPC cost components: tracking, action penalty, smoothness, and safety. This allows the LLM to dynamically reprioritize driving objectives.
- **Capabilities**: Textual guidance for lane changes, driving style adjustment via natural language descriptions, and interpretable reasoning through cognitive pathways.

#### EMMA (Waymo, October 2024)

EMMA is Waymo's end-to-end multimodal model built on Gemini.

- **Architecture**: Gemini multimodal LLM processes raw camera sensor data and generates multiple driving-specific outputs: planner trajectories, perception objects, and road graph elements. All non-sensor inputs (navigation instructions, ego state) and outputs (trajectories, 3D locations) are represented as natural language text.
- **Unified Task Handling**: A single co-trained model jointly produces outputs for multiple tasks, matching or surpassing individually trained models.
- **Results**: State-of-the-art motion planning on nuScenes; competitive on Waymo Open Motion Dataset.
- **Limitations**: Processes only a small number of image frames; no LiDAR/radar; computationally expensive.

#### DriveLM (ECCV 2024 Oral)

DriveLM introduces Graph Visual Question Answering for structured driving reasoning.

- **Innovation -- Graph VQA**: Models graph-structured reasoning through Perception-Prediction-Planning (P3) question-answer pairs, mimicking the human reasoning process from object localization to interaction estimation to action.
- **Components**: DriveLM-Data (datasets on nuScenes and CARLA) and DriveLM-Agent (VLM-based baseline for joint Graph VQA and end-to-end driving).
- **Results**: Competitive with driving-specific architectures; pronounced benefits on zero-shot evaluation with unseen objects or sensor configurations.

### 2.3 Additional Notable Driving VLAs (2023-2025)

| Model | Year | Key Contribution |
|-------|------|-----------------|
| **DriveGPT4** | 2023-2024 | Interpretable end-to-end driving via multimodal LLM; processes multi-frame video + text queries; predicts low-level control signals |
| **DriveLLaVA** | 2024 | Human-level behavior decisions via VLM on driving scenarios |
| **OpenDriveVLA** | 2025 (AAAI 2026) | Open-source VLA with hierarchical 2D+3D visual token alignment and structured agent-environment interaction modeling; SOTA on nuScenes |
| **AutoVLA** | 2025 | Unifies reasoning and trajectory planning; dual thinking modes (fast/slow); GRPO reinforcement fine-tuning; top scores on Waymo Vision-based End-to-End Driving Challenge |
| **FastDriveVLA** | 2025 (AAAI 2026) | XPeng + Peking University; plug-and-play token pruning reduces visual tokens from 3,249 to 812 (7.5x compute reduction) while maintaining planning accuracy |
| **VLP** | 2024 (CVPR) | Vision Language Planning; tokenizes waypoints into planning-aware latent actions |
| **InsightDrive** | 2024 | Dual-system: causal language reasoning with MPC; assigns "why" to VLM and "how" to planner |
| **DrivingGPT** | 2024 | Unifies world modeling and planning with multi-modal autoregressive transformers |
| **LLaDA** | 2024 | Integrates system prompts, instructions, and traffic rules into VLA framework |
| **VLA-MP** | 2025 | Physics-constrained action generation for autonomous driving |
| **XPeng VLA 2.0** | 2025 | Production system using Vision-Implicit Token-Action pathway; trained on 100M+ video clips; deployed on XPeng Ultra vehicles and robotaxis |
| **Li Auto MindVLA** | 2025 | Production VLA system designed from scratch for mass-production vehicles |

### 2.4 Taxonomy: End-to-End vs. Dual-System VLAs

The field has converged on two principal paradigms:

**End-to-End VLA**: A single model integrates perception, reasoning, and planning. The VLM directly generates actions through language tokens or continuous outputs.
- *Examples*: RT-2, OpenVLA, LINGO-2, LMDrive, EMMA, AutoVLA
- *Advantage*: No information loss at module boundaries; fully differentiable
- *Risk*: Harder to verify safety; latency from large models

**Dual-System VLA**: Separates slow deliberation (VLM for high-level reasoning) from fast, safety-critical execution (specialized planner for trajectories).
- *Examples*: DriveVLM-Dual, LanguageMPC, InsightDrive
- *Advantage*: Real-time guarantees on the fast path; VLM handles only strategic decisions
- *Risk*: Information loss at the VLM-planner interface; more complex system integration

---

## 3. How VLAs Could Improve AV Stacks

### 3.1 End-to-End Driving with Language Grounding

Traditional AV stacks decompose driving into perception (detection, tracking, mapping), prediction (forecasting agent trajectories), and planning (trajectory optimization). Each module is trained independently, creating information bottlenecks and error propagation.

VLAs offer a fundamentally different approach:

- **Unified representation**: A single model maps raw sensor data + language instructions directly to driving actions, eliminating module boundaries.
- **Language as a planning prior**: Natural language captures high-level driving intent ("merge carefully into the left lane, there's a truck approaching") that is difficult to encode in traditional cost functions.
- **World knowledge transfer**: Pre-training on Internet-scale data gives VLAs implicit knowledge of traffic rules, object affordances, and social driving norms -- knowledge that would require extensive manual engineering in rule-based systems.

DriveVLM demonstrated this by identifying long-tail critical objects (road debris, unusual animals) that conventional 3D detectors miss, precisely because the VLM has seen millions of images of such objects during pre-training.

### 3.2 Explainability and Interpretability via Language

A key advantage of VLAs over traditional end-to-end driving models (which are opaque neural networks) is the ability to generate natural language explanations of driving decisions:

- **LINGO-2** generates real-time driving commentary ("slowing down for pedestrians on the road," "executing overtaking maneuver") while simultaneously controlling the vehicle.
- **GPT-Driver** produces chain-of-thought reasoning explaining trajectory choices.
- **Dolphins** achieves 134.2 CIDEr on driving justification, providing human-readable explanations for each action.
- **DriveVLM** generates structured scene descriptions and analyses that document the reasoning chain from observation to planning.

This is valuable for:
- **Debugging and development**: Engineers can inspect the model's reasoning to identify failure modes.
- **Regulatory compliance**: Regulators increasingly require explainable AI for safety-critical systems.
- **User trust**: Passengers can understand why the vehicle is behaving in a particular way.
- **Accident investigation**: Post-hoc analysis of the model's language outputs provides an interpretable decision log.

### 3.3 Zero-Shot and Few-Shot Generalization

VLAs inherit the generalization capabilities of their VLM backbones:

- **RT-2** demonstrated emergent generalization to unseen objects and instructions, with novel scenario performance jumping from 32% (RT-1) to 62%.
- **OpenVLA** excels in multi-object scenes requiring precise instruction following, generalizing to unseen object arrangements.
- **DriveLM** showed pronounced zero-shot benefits on unseen objects and sensor configurations.
- **Drive Anywhere** uses language-augmented latent space simulation to improve out-of-distribution robustness, achieving generalization to new driving environments.

For autonomous driving, this means:
- Handling rare/novel road objects without retraining (construction equipment, fallen cargo, unusual vehicles)
- Adapting to new geographic regions with different road markings, signage, and driving conventions
- Understanding and responding to new types of traffic instructions

### 3.4 Instruction Following for Complex Maneuvers

VLAs can accept and execute natural language driving instructions, enabling:

- **Navigation commands**: "Turn right at the second intersection, then immediately merge left" (LMDrive, LINGO-2)
- **Style adaptation**: "Drive more cautiously" or "Prioritize efficiency" (LanguageMPC adjusts MPC cost weights based on textual driving style descriptions)
- **Contextual behavior**: "Pull over after the blue building" (LMDrive processes complex multi-part instructions)
- **Dynamic replanning**: Real-time instruction updates during driving (LINGO-2's closed-loop language-conditioned driving)

### 3.5 Integration with Existing Perception Pipelines

The dual-system VLA paradigm (DriveVLM-Dual) demonstrates a pragmatic integration path:

1. **Existing 3D perception modules** (LiDAR-based detectors, HD maps) continue to provide precise spatial information.
2. **The VLM** adds semantic understanding, long-tail object recognition, and reasoning capabilities.
3. **IoU matching** bridges VLM outputs with 3D detector outputs, enriching both.
4. **A traditional high-frequency planner** uses VLM guidance as a reference trajectory, maintaining real-time control guarantees.

This approach is already deployed on production vehicles at Li Auto (DriveVLM-Dual) and XPeng (VLA 2.0), demonstrating that VLAs can enhance rather than replace existing AV stacks.

---

## 4. Advantages for Airside (Airport Tarmac) Operations

Airport airside environments present unique challenges and opportunities for VLA-based autonomous vehicles. The FAA recognizes autonomous ground vehicle systems (AGVS) as an emerging category, with applications including baggage tractors, aircraft tugs, fuel trucks, de-icing vehicles, passenger shuttles, and maintenance equipment.

### 4.1 Following ATC-Like Ground Instructions

Airport ground operations involve complex, dynamic instruction sets from ground controllers, ramp coordinators, and operational management systems. VLAs are uniquely suited because:

- **Natural language understanding**: A VLA can directly interpret voice or text instructions from ground controllers ("hold short of taxiway Bravo," "proceed to gate 14 via the inner apron road," "yield to the A320 pushing back from gate 7").
- **Instruction composability**: Multi-part instructions are native to language models. A VLA can process sequences like "proceed to cargo area 3, avoid the construction zone near hangar B, use the southern service road."
- **Disambiguation**: Language models can handle ambiguous or non-standard instructions by leveraging contextual understanding, a common challenge in busy airport environments.
- **Protocol adaptation**: Different airports use different terminology and procedures. A VLA's language understanding allows it to adapt to local conventions without reprogramming, similar to how human drivers adapt to local traffic customs.

### 4.2 Handling Novel Objects and Scenarios via Language Understanding

Airport tarmacs feature a diverse and constantly changing object landscape:

- **Uncommon vehicles**: GPU (Ground Power Units), lavatory carts, catering trucks, pushback tugs, and specialized maintenance vehicles that are rare in standard driving datasets.
- **Temporary obstacles**: FOD (Foreign Object Debris), construction barriers, weather covers, temporary signage, airline-specific equipment.
- **Dynamic configurations**: Gate assignments change, taxiway closures are temporary, construction zones evolve.

VLAs can handle these because:
- The VLM backbone has seen millions of images of diverse objects during pre-training, enabling recognition of unusual equipment without specific training data.
- Language descriptions of novel scenarios ("there is a large metal panel on the apron near gate 12") can condition the model's behavior appropriately.
- DriveVLM's demonstrated ability to identify long-tail critical objects that 3D detectors miss is directly applicable to the diverse object landscape of airport tarmacs.

### 4.3 Explainable Decision-Making for Regulatory Compliance

Aviation is one of the most heavily regulated industries. The FAA and international aviation authorities require:

- **Safety case documentation**: Every autonomous system must demonstrate its decision-making process. VLAs can generate natural language logs of every decision ("stopping because an aircraft is crossing the service road," "rerouting because taxiway Alpha is closed for maintenance").
- **Incident investigation support**: Language-annotated decision logs provide a human-readable audit trail far superior to opaque neural network activations.
- **Operational transparency**: Ground controllers and ramp supervisors need to understand what autonomous vehicles are doing and why. Real-time commentary (like LINGO-2's capabilities) enables human oversight.
- **Certification pathways**: The FAA's current AGVS framework requires that "associated risks are understood, properly considered, and mitigated." Explainable VLA outputs directly support this requirement.

### 4.4 Adapting to Different Airports Without Retraining

A major challenge for airport autonomous vehicles is deployment across diverse airport environments:

- **Layout diversity**: Every airport has a unique gate configuration, taxiway structure, service road network, and ramp geometry.
- **Operational procedures**: Different airports have different right-of-way rules, speed limits, restricted zones, and communication protocols.
- **Environmental variation**: Climate conditions (extreme heat, cold, rain, snow, fog) and time-of-day lighting vary dramatically.

VLA advantages for cross-airport generalization:

- **Zero-shot transfer**: Internet-scale pre-training provides general knowledge of airport environments, signage, and equipment. Language instructions can specify airport-specific procedures without retraining.
- **Few-shot adaptation**: OpenVLA demonstrated efficient fine-tuning via LoRA on a single GPU in 10-15 hours. A VLA could be adapted to a new airport with a small number of demonstration runs.
- **Language-conditioned adaptation**: Airport-specific rules can be provided as text prompts ("at this airport, always yield to aircraft at intersections," "maximum speed on apron is 15 km/h") rather than requiring retraining.
- **Map-agnostic operation**: Vision-language understanding can partially compensate for missing or outdated HD maps, a common issue at airports undergoing construction or expansion.

### 4.5 Additional Airside-Specific Advantages

- **Multi-agent coordination**: VLAs can process language-based coordination messages from other autonomous vehicles and ground control systems, enabling fleet management through natural language protocols.
- **Weather adaptation**: Language conditioning ("heavy rain, reduced visibility, slippery surfaces") can modulate driving behavior without weather-specific training.
- **Safety zone awareness**: Language understanding of restricted areas ("do not enter runway 27L safety zone," "blast zone behind aircraft engines") provides an additional safety layer beyond geofencing.

---

## 5. Limitations and Challenges

### 5.1 Latency and Real-Time Performance

This is the most critical challenge for safety-critical driving applications:

- **Inference latency**: Large VLMs (7B-55B parameters) require hundreds of milliseconds to seconds per inference on current hardware. EMMA (Gemini-based) is acknowledged by Waymo as "computationally expensive." Autoregressive action decoding with RT-2 (55B) is far too slow for real-time control.
- **Quantification**: For autoregressive VLAs without multi-token prediction, generating an action chunk of length L requires L sequential forward passes. For driving (e.g., L=8 waypoints, D_act=7 dimensions), this means 56 sequential decoding steps.
- **Mitigation strategies**:
  - Dual-system architectures (DriveVLM-Dual): VLM runs at low frequency (1-2 Hz) for strategic decisions; fast planner runs at high frequency (10-50 Hz) for control
  - Flow matching (pi0): Generates entire action chunks in T denoising steps (typically T=12), decoupling cost from sequence length
  - Token pruning (FastDriveVLA): Reduces visual tokens from 3,249 to 812 for 7.5x compute reduction
  - Model distillation: Training smaller, faster models from larger VLAs
  - Dedicated hardware: XPeng's Turing chip provides 3,000 TOPS for on-vehicle VLA inference

### 5.2 Compute Requirements

- **Training**: VLA training requires massive compute. Pi0's pre-training used 10,000+ hours of robot data; OpenVLA trained for 27 epochs on 970K episodes. Driving VLAs require even larger datasets (XPeng's VLA 2.0 used 100M+ video clips).
- **Inference hardware**: Current production deployments require high-end automotive compute platforms:
  - DriveVLM uses NVIDIA Orin (275 TOPS)
  - XPeng VLA 2.0 uses 4x Turing chips (3,000 TOPS total)
  - This represents a significant cost increase over traditional AV compute platforms
- **Edge deployment**: Running billion-parameter models on edge devices remains challenging. Quantization, pruning, and distillation are active research areas but reduce model quality.

### 5.3 Safety Guarantees

- **Hallucination risk**: LLMs can generate plausible but incorrect outputs. In driving, a hallucinated trajectory could cause a collision. "Even with carefully crafted prompts, LLMs may sometimes produce outputs that are inconsistent or unrelated to the given task."
- **Lack of formal verification**: Unlike rule-based systems, neural VLAs cannot provide formal safety guarantees. No current VLA can prove it will always stop for a red light.
- **Distribution shift sensitivity**: VLA policies can degrade under sensor corruption (rain, glare, sensor failure), linguistic noise, and regional domain shift. These are exact conditions when safety is most critical.
- **Action space coverage**: Behavior cloning from demonstrations may not cover rare but critical scenarios (emergency braking, evasive maneuvers). RL fine-tuning (AutoVLA's GRPO) partially addresses this but introduces its own instabilities.
- **Safety-critical reaction time**: Language-based reasoning adds latency to the decision loop. A dual-system architecture can mitigate this by having a fast reactive system that operates independently of the VLM, but this re-introduces the very modularity VLAs aim to eliminate.

### 5.4 Sim-to-Real Gap

- **Sensor fidelity**: Simulation environments (CARLA, SUMO) generate sensor data via game engines, which differs systematically from real camera and LiDAR outputs. Models trained or evaluated primarily in simulation (LMDrive, SimLingo on CARLA) may not transfer cleanly to real-world deployment.
- **Physics accuracy**: Simulated vehicle dynamics, tire-road interaction, and weather effects are approximations. Trajectories that are safe in simulation may be unsafe in reality.
- **Behavioral realism**: Simulated traffic agents follow programmatic behavior rules, not the full complexity of human driving behavior, construction zones, or unusual road conditions.
- **Continuous calibration**: A continuous feedback loop between simulation and live data is essential to narrow the gap, but this requires substantial operational infrastructure.

### 5.5 Data and Annotation Challenges

- **Tri-modal annotation scarcity**: VLAs require paired (image, language, action) data, which is far more expensive to collect than image-only or image-text data. Driving-specific VLA datasets are orders of magnitude smaller than web-scale pre-training data.
- **Temporal alignment**: Driving commentary must be temporally aligned with specific actions and road situations, requiring frame-level annotation that is labor-intensive.
- **Safety-critical coverage**: Training data must include rare dangerous scenarios, but these are (fortunately) rare in real driving data and difficult to simulate realistically.
- **Legal and privacy constraints**: Real-world driving data collection faces privacy regulations (faces, license plates), liability concerns, and geographic restrictions.

### 5.6 Evaluation and Benchmarking

- **Open-loop vs. closed-loop**: Many VLA papers report open-loop metrics (trajectory similarity to expert demonstrations) on nuScenes or Waymo Open Dataset. These correlate poorly with actual driving safety. Closed-loop evaluation (CARLA, real-world testing) is far more meaningful but more expensive and harder to standardize.
- **Metric fragmentation**: Different papers use different metrics, making direct comparison difficult. The field lacks a unified benchmark that measures driving safety, instruction fidelity, and explanation quality jointly.
- **Scaling evaluation**: Demonstrating safety at the level required for deployment (fewer than 1 fatal accident per billion miles, comparable to human driving) requires orders of magnitude more testing than any current VLA has undergone.

### 5.7 Regulatory and Deployment Barriers

- **Certification frameworks**: No regulatory body has established certification criteria for VLA-based driving systems. Existing frameworks (NHTSA, EU AI Act, ISO 26262) were designed for modular systems with verifiable components.
- **Liability**: When a VLA makes a wrong decision, attributing fault is complicated by the model's opaque internals, even if it can generate explanations.
- **Over-reliance on language**: VLA explanations may be convincing but wrong -- the model could generate a plausible justification for an unsafe action, creating a false sense of security.

---

## Sources

### Foundational VLA Research
- [RT-2: Vision-Language-Action Models -- Google DeepMind](https://robotics-transformer2.github.io/)
- [RT-2 Blog Post -- Google DeepMind](https://deepmind.google/blog/rt-2-new-model-translates-vision-and-language-into-action/)
- [Open X-Embodiment: Robotic Learning Datasets and RT-X Models](https://arxiv.org/abs/2310.08864)
- [Open X-Embodiment Project Page](https://robotics-transformer-x.github.io/)
- [Octo: An Open-Source Generalist Robot Policy](https://arxiv.org/abs/2405.12213)
- [Octo Project Page](https://octo-models.github.io/)
- [OpenVLA: An Open-Source Vision-Language-Action Model](https://arxiv.org/abs/2406.09246)
- [OpenVLA Project Page](https://openvla.github.io/)
- [pi0: A Vision-Language-Action Flow Model for General Robot Control](https://arxiv.org/abs/2410.24164)
- [Physical Intelligence Blog -- pi0](https://www.pi.website/blog/pi0)
- [pi0 and pi0-FAST on Hugging Face](https://huggingface.co/blog/pi0)

### Driving VLAs
- [LINGO-2: Driving with Natural Language -- Wayve](https://wayve.ai/thinking/lingo-2-driving-with-language/)
- [SimLingo: Vision-Only Closed-Loop Autonomous Driving with Language-Action Alignment](https://arxiv.org/abs/2503.09594)
- [DriveVLM: The Convergence of Autonomous Driving and Large Vision-Language Models](https://arxiv.org/abs/2402.12289)
- [DriveVLM Project Page](https://tsinghua-mars-lab.github.io/DriveVLM/)
- [LMDrive: Closed-Loop End-to-End Driving with Large Language Models (CVPR 2024)](https://arxiv.org/abs/2312.07488)
- [GPT-Driver: Learning to Drive with GPT](https://arxiv.org/abs/2310.01415)
- [Dolphins: Multimodal Language Model for Driving (ECCV 2024)](https://arxiv.org/abs/2312.00438)
- [LanguageMPC: Large Language Models as Decision Makers for Autonomous Driving](https://arxiv.org/abs/2310.03026)
- [EMMA: End-to-End Multimodal Model for Autonomous Driving -- Waymo](https://waymo.com/research/emma/)
- [DriveLM: Driving with Graph Visual Question Answering (ECCV 2024 Oral)](https://arxiv.org/abs/2312.14150)
- [DriveGPT4: Interpretable End-to-end Autonomous Driving via Large Language Model](https://arxiv.org/abs/2310.01412)
- [OpenDriveVLA: Towards End-to-end Autonomous Driving with Large Vision Language Action Model](https://arxiv.org/abs/2503.23463)
- [AutoVLA Project Page](https://autovla.github.io/)
- [Drive Anywhere: Generalizable End-to-end Autonomous Driving with Multi-modal Foundation Models](https://drive-anywhere.github.io/)

### Surveys and Overviews
- [Vision-Language-Action Models for Autonomous Driving: Past, Present, and Future](https://arxiv.org/html/2512.16760v2)
- [A Survey on Vision-Language-Action Models for Autonomous Driving (ICCV 2025 Workshop)](https://openaccess.thecvf.com/content/ICCV2025W/WDFM-AD/papers/Jiang_A_Survey_on_Vision-Language-Action_Models_for_Autonomous_Driving_ICCVW_2025_paper.pdf)
- [Vision-Language-Action Models: Concepts, Progress, Applications and Challenges](https://arxiv.org/abs/2505.04769)
- [VLA Survey Project Page](https://vla-survey.github.io/)
- [Vision Language Models in Autonomous Driving: A Survey and Outlook](https://arxiv.org/abs/2310.14414)
- [Awesome LLM for Autonomous Driving (GitHub)](https://github.com/Thinklab-SJTU/Awesome-LLM4AD)
- [Awesome VLA for AD (GitHub)](https://github.com/worldbench/awesome-vla-for-ad)

### Industry / Production Deployments
- [XPeng FastDriveVLA -- AAAI 2026](https://www.xpeng.com/news/019b649d31c59b49d00d8a028c720027)
- [XPeng VLA 2.0 Announcement](https://www.xpeng.com/pressroom/news/019a56f54fe99a2a0a8d8a0282e402b7)
- [VLA Large Model Applications in Automotive and Robotics Research Report, 2025](https://www.researchandmarkets.com/reports/6115823/vla-large-model-applications-in-automotive)

### Airport / Airside Operations
- [FAA: Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Autonomous Vehicles Gaining Traction in Ground Support -- Aviation Pros](https://www.aviationpros.com/gse/gse-technology/article/21256745/autonomous-vehicles-gaining-traction-in-ground-support)
- [Autonomous GSE and the Future of Airside Operations](https://airsideint.com/issue-article/autonomous-gse-and-the-future-of-airside-operations/)
- [Conceptual Framework for Autonomous Airside Vehicles Business Models (IEEE)](https://ieeexplore.ieee.org/document/10850355/)

### Action Head Architectures
- [DiffusionVLA: Autoregressive Reasoning and Diffusion Policies](https://diffusion-vla.github.io/)
- [HybridVLA: Collaborative Diffusion and Autoregression](https://arxiv.org/abs/2503.10631)
- [Vision-Language-Action Model -- Wikipedia](https://en.wikipedia.org/wiki/Vision-language-action_model)
