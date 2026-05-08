# Vision Foundation Models for Autonomous Driving Perception
## Comprehensive Technical Report — With Focus on Airport Airside Applications

---

## Table of Contents

1. [Vision Foundation Models for Driving](#1-vision-foundation-models-for-driving)
2. [Open-Vocabulary / Zero-Shot Detection for Driving](#2-open-vocabulary--zero-shot-detection-for-driving)
3. [3D Foundation Models](#3-3d-foundation-models)
4. [Video Foundation Models](#4-video-foundation-models)
5. [Domain Adaptation Strategies for Airside](#5-domain-adaptation-strategies-for-airside)
6. [Synthesis: A Roadmap for Airport Airside Perception](#6-synthesis-a-roadmap-for-airport-airside-perception)

---

## 1. Vision Foundation Models for Driving

### 1.1 Segment Anything Model (SAM / SAM 2)

**SAM (Kirillov et al., 2023)** introduced a promptable segmentation foundation model trained on SA-1B (1 billion masks, 11 million images). The model accepts points, boxes, or text prompts and generalizes to novel image distributions in a zero-shot manner, often matching or exceeding supervised approaches.

**SAM 2 (Meta, 2024)** extends SAM to video through a per-session streaming memory module. Key advances:
- Processes video frames sequentially with a memory bank that captures target object information across frames
- Tracks objects even through temporary occlusions
- Requires as little as a single click on one frame to track objects through an entire video
- When applied to images, the memory module is empty, making it functionally equivalent to SAM 1
- Trained on SA-V dataset: ~600K object masks across 51K videos from 47 countries
- Outperforms all prior video object segmentation models, with particular strength on tracking object parts

**Applications to driving perception:**

| Paper | Key Contribution |
|-------|-----------------|
| **VFMM3D** (Ding et al., 2024) | Combines SAM + Depth Anything to convert monocular images to pseudo-LiDAR for 3D detection; SOTA on KITTI and Waymo |
| **FusionSAM** (Li et al., 2024) | First application of SAM to multimodal (RGB + thermal) segmentation for driving; +4.1% mIoU improvement |
| **Multi-modal NeRF Self-Supervision** (Timoneda et al., IROS 2024) | Uses SAM masks from camera imagery to supervise LiDAR semantic segmentation via NeRF rendering; evaluated on nuScenes, SemanticKITTI, ScribbleKITTI |
| **SAM Zero-shot Robustness** (Yan et al., 2024) | Demonstrates SAM achieves "acceptable" adversarial robustness for driving segmentation without any fine-tuning, attributed to scale of parameters and training data |
| **Segment, Lift and Fit** (Li et al., ECCV 2024) | Uses SAM for automatic 3D shape labeling from 2D prompts; achieves ~90% AP@0.5 IoU on KITTI |
| **RMP-SAM** (Xu et al., 2024) | Real-time multi-purpose SAM variant for driving; supports interactive, panoptic, and video instance segmentation |
| **VideoSAM** (Guo et al., 2024) | Extends SAM to open-world video segmentation for robotics and autonomous driving |
| **Weather Robustness** (Kou et al., 2024) | SAM for pseudo-label generation to train segmentation models robust to adverse weather; +88.56% mIoU improvement |

**Airside relevance:** SAM's zero-shot segmentation is exceptionally relevant for airport airside because it can segment novel objects (aircraft, GSE, baggage carts) without training on airside-specific data. SAM 2's video tracking enables consistent object tracking across frames as vehicles navigate the apron.

---

### 1.2 Grounding DINO / Grounded SAM

**Grounding DINO** (Liu et al., 2023) marries the DINO detector with grounded pre-training for open-set object detection. Architecture consists of:
- Feature enhancer for multi-scale visual features
- Language-guided query selection that uses text to initialize detection queries
- Cross-modality decoder for tight vision-language fusion

**Performance:** 52.5 AP on COCO zero-shot transfer; 26.1 AP mean on ODinW zero-shot benchmarks. Accepts arbitrary text prompts describing objects to detect.

**Grounded SAM** combines Grounding DINO with SAM in a pipeline:
1. Grounding DINO detects bounding boxes from text prompts
2. SAM generates precise segmentation masks within those boxes

**Applications to driving:**
- **Segment, Lift and Fit** (ECCV 2024) uses this pipeline for automatic 3D annotation in driving datasets
- **ZOPP** (Ma et al., NeurIPS 2024) integrates vision foundation models including Grounding DINO for zero-shot offboard panoptic perception and auto-labeling on the Waymo dataset

**Airside relevance:** Grounded SAM is the most immediately applicable tool for airside perception because operators can specify text prompts like "aircraft," "baggage loader," "fuel truck," "pushback tug," "ground power unit" to detect and segment objects never seen in standard driving datasets. This eliminates the cold-start problem for novel object classes.

---

### 1.3 DINOv2 as Backbone

**DINOv2** (Oquab et al., 2023) produces versatile visual features through self-supervised pre-training on a curated, diverse dataset. Key properties:
- 1-billion-parameter ViT trained without supervision
- Features transfer across image distributions and tasks without fine-tuning
- Distilled smaller models surpass OpenCLIP at both image and pixel levels
- Effective for dense prediction tasks (depth, segmentation, surface normals)

**Applications to driving:**
- **DistillNeRF** (Wang et al., NeurIPS 2024): Distills DINOv2 and CLIP features into a 3D neural field representation for autonomous driving; enables zero-shot 3D semantic occupancy prediction without 3D annotations
- **LargeAD** (Kong et al., TPAMI 2025): Uses DINOv2-driven superpixels to align 2D semantics with 3D LiDAR point clouds across 11 driving datasets

DINOv2's dense features are particularly strong for:
- Monocular depth estimation (competitive with supervised methods)
- Semantic segmentation with linear probes
- Instance retrieval and matching
- Surface normal estimation

**Airside relevance:** DINOv2 features can serve as a backbone for airside perception models without large-scale airside training data. Its dense features enable depth estimation and segmentation on novel environments. Linear probes on frozen DINOv2 features can be trained with minimal airside annotations.

---

### 1.4 CLIP / SigLIP for Driving Scene Understanding

**CLIP** (Radford et al., 2021) learns joint image-text embeddings through contrastive pre-training on 400M image-text pairs. Its zero-shot classification and open-vocabulary capabilities make it foundational for driving.

**SigLIP** (Zhai et al., 2023) improves on CLIP by using sigmoid loss instead of softmax:
- Operates on image-text pairs without requiring global pairwise similarity computation
- Works effectively at both large and small batch sizes (32K is sufficient)
- Achieves 84.5% ImageNet zero-shot accuracy with locked-image tuning on just 4 TPUv4 chips

**Applications to driving:**
- **DistillNeRF**: Uses CLIP features for zero-shot semantic understanding of 3D driving scenes
- **Clipomaly** (Reichard et al., 2024): First CLIP-based open-world anomaly segmentation for driving; dynamically extends vocabulary at inference time to assign human-interpretable names to unknown objects without retraining
- **Hazardous Object Detection** (Shriram et al., 2025): Uses CLIP to match VLM-predicted hazard descriptions with bounding boxes in traffic scenes
- **DistillNeRF** demonstrates that CLIP embeddings enable zero-shot 3D semantic occupancy prediction

**Airside relevance:** CLIP/SigLIP embeddings can bridge the vocabulary gap between road driving and airside environments. Text queries like "Boeing 737," "aircraft tow bar," or "jet bridge" can retrieve or classify objects without airside training data. SigLIP's efficiency makes it practical for real-time on-vehicle deployment.

---

### 1.5 EVA / InternImage / InternVL

**EVA** (Fang et al., 2022): A 1-billion-parameter ViT trained via masked image-text aligned feature reconstruction.
- SOTA on image recognition, video action recognition, object detection, instance segmentation, semantic segmentation
- Competitive on both LVIS (1000+ categories) and COCO (80 categories) instance segmentation
- Functions as an effective CLIP vision encoder, improving training stability

**EVA-02** (Fang et al., 2023): A more efficient successor.
- 304M parameters; 90.0% ImageNet fine-tuning accuracy
- CLIP variant achieves 80.4% zero-shot accuracy with ~1/6 parameters and ~1/6 data compared to prior open-source CLIP
- Released in four sizes (6M to 304M parameters)

**InternImage** (Wang et al., 2022): CNN-based foundation model using deformable convolutions.
- 65.4 mAP on COCO test-dev; 62.9 mIoU on ADE20K
- Achieves adaptive spatial aggregation conditioned on input and task
- Surpasses both CNN and ViT baselines across vision benchmarks

**InternVL 1.5** (Chen et al., 2024): Open-source multimodal model approaching GPT-4V.
- InternViT-6B vision encoder with continuous learning
- Dynamic high-resolution processing: 1-40 tiles of 448x448 pixels, supporting up to 4K inputs
- SOTA on 8 of 18 multimodal benchmarks

**DriveLM** (Sima et al., ECCV 2024): Uses InternVL-style models for driving with Graph VQA.
- Models perception, prediction, and planning as structured QA
- Competitive with driving-specific architectures
- Strong zero-shot generalization to unseen scenarios

**Airside relevance:** InternVL's multimodal reasoning can interpret complex airside scenes where spatial relationships matter (e.g., "is the pushback tug connected to the aircraft?"). EVA and InternImage provide strong backbones for fine-tuning on limited airside data.

---

### 1.6 How Foundation Models Handle Novel/Unseen Object Classes

Foundation models address novel objects through several mechanisms:

1. **Zero-shot transfer via language:** CLIP, Grounding DINO, and SigLIP use natural language to specify arbitrary object categories at inference time, bypassing the closed-set assumption.

2. **Promptable segmentation:** SAM segments any object given a spatial prompt (point, box), regardless of whether that class was in training data.

3. **Open-vocabulary anomaly detection:** Clipomaly dynamically extends its vocabulary at inference time to detect and name unknown objects without retraining.

4. **Emergent robustness:** SAM demonstrates zero-shot adversarial robustness for driving tasks, attributed to the scale of its training.

5. **Cross-modal knowledge transfer:** Models like DetAny3D and VFMM3D transfer 2D foundation model knowledge to 3D detection of novel objects.

**Critical insight for airside:** The combination of Grounding DINO (detect novel objects by name) + SAM (precise segmentation) + CLIP (semantic understanding) provides a complete pipeline for perceiving airside-specific objects without any airside training data as a starting point.

---

## 2. Open-Vocabulary / Zero-Shot Detection for Driving

### 2.1 OWL-ViT

**OWL-ViT** (Minderer et al., ECCV 2022): "Simple Open-Vocabulary Object Detection with Vision Transformers."
- Combines standard ViT architecture with contrastive image-text pre-training and end-to-end detection fine-tuning
- Minimal architectural modifications needed to adapt image-level models to detection
- Supports both zero-shot text-conditioned and one-shot image-conditioned detection
- Key finding: larger models and more pre-training consistently improve detection performance

**Strengths for driving:** Requires only a text description or a single reference image to detect novel objects. One-shot image-conditioned detection is particularly useful when text descriptions are ambiguous (e.g., showing an image of a specific GSE type).

### 2.2 YOLO-World

**YOLO-World** (Cheng et al., 2024): Real-time open-vocabulary object detection.
- **RepVL-PAN**: Re-parameterizable Vision-Language Path Aggregation Network that fuses visual and linguistic features
- **Region-Text Contrastive Loss** for aligning visual regions with text descriptions
- **Performance**: 35.4 AP on LVIS with 52.0 FPS on V100 -- combines accuracy with real-time speed
- Zero-shot detection across hundreds of categories without fine-tuning
- Strong downstream performance on instance segmentation

**Airside relevance:** YOLO-World's real-time speed (52 FPS) makes it deployable for live airside perception. The open vocabulary means it can detect "aircraft," "baggage cart," "fuel bowser," "marshaller" etc. using only text prompts, without ever training on airside imagery.

### 2.3 Open-Vocabulary 3D Detection

A rapidly emerging field that bridges 2D foundation model capabilities with 3D perception:

| Paper | Approach | Key Results |
|-------|----------|-------------|
| **Open 3D World** (Cheng & Li, 2024) | Fuses BEV features with text embeddings for open-vocabulary 3D detection | Zero-shot generalization on Lyft Level 5 |
| **DetAny3D** (Zhang et al., 2025) | Foundation model for zero-shot monocular 3D detection using 2D-to-3D knowledge transfer | SOTA on unseen categories and novel camera configs |
| **OV-SCAN** (Chow et al., 2025) | Semantically consistent alignment for novel object discovery in open-vocab 3D detection | Improved robustness on nuScenes |
| **BoxFusion** (Lan et al., 2025) | Real-time multi-view box fusion using CLIP semantics, no dense 3D reconstruction | Real-time performance on large-scale environments |
| **OpenBox** (Lee et al., 2025) | Automatic 3D annotation pipeline using 2D vision foundation models | Associates 2D cues with 3D point clouds |
| **VESPA** (Tempfli et al., 2025) | Multimodal LiDAR+camera with VLMs for open-vocabulary 3D labeling | Strong pseudolabel performance on nuScenes |
| **Monocular OV-3D** (Huang et al., 2024) | RGB-only training using pseudo-LiDAR with LLM-refined labels | No LiDAR sensor required |

### 2.4 Language-Guided Detection and Segmentation

**ZOPP** (Ma et al., NeurIPS 2024): Zero-shot offboard panoptic perception framework.
- Combines vision foundation model zero-shot recognition with 3D point cloud representations
- Unified framework for detection, segmentation, and classification
- Validated extensively on Waymo Open Dataset
- Addresses data imbalance and long-tail distribution challenges

**Clipomaly** (Reichard et al., 2024): CLIP-based open-world anomaly segmentation.
- Dynamically extends vocabulary at inference time
- Assigns human-interpretable names to unknown objects
- Zero anomaly-specific training data required
- SOTA on anomaly segmentation benchmarks

**Hazardous Object Detection** (Shriram et al., 2025): Multi-agent VLM system.
- Integrates VLM reasoning with zero-shot detection via CLIP
- Detects novel hazardous objects in video streams
- Enhanced COOOL anomaly detection benchmark with natural language descriptions

### 2.5 Few-Shot Adaptation to New Domains

Foundation models enable efficient adaptation to new domains through several strategies:

1. **One-shot detection (OWL-ViT):** Provide a single reference image of the target object to detect it in new scenes.
2. **Text prompting (Grounding DINO, YOLO-World):** Describe novel objects in natural language for immediate zero-shot detection.
3. **Linear probing (DINOv2):** Train a simple linear layer on frozen DINOv2 features with as few as 10-50 labeled examples per class.
4. **Pseudo-label generation:** Use foundation models to generate labels on unlabeled data, then train specialized detectors.

---

## 3. 3D Foundation Models

### 3.1 UniPAD: Universal Pre-training for Autonomous Driving

**UniPAD** (Yang et al., CVPR 2024): Universal pre-training paradigm for autonomous driving.
- Uses 3D volumetric differentiable rendering to implicitly encode 3D space
- Reconstructs both continuous 3D shapes and their 2D projections
- Integrates with both 2D and 3D perception frameworks
- **Results**: 73.2 NDS for 3D object detection, 79.4 mIoU for 3D semantic segmentation on nuScenes validation (SOTA)

**Key insight:** By pre-training on the task of rendering realistic views from 3D representations, the model learns rich 3D structural priors that transfer to downstream detection and segmentation.

### 3.2 Point-BERT for LiDAR

**Point-BERT** (Yu et al., 2022): BERT-style pre-training for 3D point cloud Transformers.
- Masked Point Modeling (MPM): divides point clouds into patches, masks random patches, recovers original tokens
- Discrete VAE tokenizer generates meaningful local representations
- **Results**: 93.8% on ModelNet40, 83.1% on ScanObjectNN (hardest setting)
- Strong few-shot transfer learning for point cloud classification

**Airside relevance:** Point-BERT's few-shot capabilities mean a LiDAR-based airside perception system could be pre-trained on large-scale driving LiDAR data, then adapted to airside-specific object classes with very few labeled examples.

### 3.3 PonderV2: 3D Foundation Model

**PonderV2** (Zhu et al., 2024): Universal pre-training paradigm for 3D foundation models.
- Uses differentiable neural rendering as the pre-training objective
- Encodes rich geometry and appearance cues into 3D features
- SOTA on 11 indoor and outdoor benchmarks
- Complementary to UniPAD but with broader scope beyond driving

### 3.4 Cross-Modal Pretraining (2D Images <-> 3D Point Clouds)

**LargeAD** (Kong et al., TPAMI 2025): The most comprehensive cross-modal pretraining framework for driving.
- Extracts semantically rich superpixels from 2D images using vision foundation models (DINOv2)
- Aligns superpixels with LiDAR point clouds via contrastive learning
- Temporal consistency across sequential frames
- Pre-trained on 11 large-scale multi-sensor driving datasets
- Generalizes across different LiDAR sensor configurations

**Multi-modal NeRF Self-Supervision** (Timoneda et al., IROS 2024):
- Uses SAM masks from cameras to supervise LiDAR segmentation
- NeRF rendering bridges the viewpoint gap between camera and LiDAR
- Drops the NeRF head at inference (LiDAR-only)

**DistillNeRF** (Wang et al., NeurIPS 2024):
- Distills CLIP and DINOv2 features into 3D neural fields
- Self-supervised (no 3D annotations needed)
- Enables zero-shot 3D semantic occupancy prediction

### 3.5 Zero-Shot 3D Understanding

The state of the art in zero-shot 3D understanding combines:
1. **2D foundation model features** (CLIP, DINOv2, SAM) for semantic richness
2. **Cross-modal alignment** to transfer knowledge to 3D representations
3. **Language conditioning** for open-vocabulary 3D queries

**DetAny3D** exemplifies this: a promptable 3D detection foundation model that uses 2D Aggregator and 3D Interpreter modules with Zero-Embedding Mapping to detect novel 3D objects from monocular images, achieving SOTA on unseen categories.

---

## 4. Video Foundation Models

### 4.1 VideoMAE

**VideoMAE** (Tong et al., NeurIPS 2022): Masked autoencoders for self-supervised video pre-training.
- Applies 90-95% masking ratio (much higher than image MAE), leveraging temporal redundancy in video
- Data-efficient: strong results on datasets with only 3K-4K videos
- Key finding: data quality matters more than quantity; domain shift is critical
- **Results**: 87.4% on Kinetics-400, 75.4% on Something-Something V2, 91.3% on UCF101

**VideoMAE's domain sensitivity insight is critical for airside:** Since domain shift matters more than data quantity, pre-training or fine-tuning on even a small airside video dataset could yield substantial improvements over using only road-driving video data.

### 4.2 InternVideo / InternVideo2

**InternVideo** (Wang et al., 2022): Combines masked video modeling + video-language contrastive learning.
- SOTA across 39 video datasets
- 91.1% on Kinetics-400, 77.2% on Something-Something V2
- Covers action recognition, action detection, video-language alignment, open-world video applications

**InternVideo2** (Wang et al., ECCV 2024): Scaled to 6B-parameter video encoder.
- Progressive training: masked video modeling -> crossmodal contrastive -> next token prediction
- Spatiotemporal consistency via semantic video segmentation and video-audio-speech captions
- SOTA on 60+ video and audio tasks
- Extended video comprehension capabilities

### 4.3 Video Understanding for Driving Scenarios

**Neuro-Symbolic Video Understanding** (Choi et al., ECCV 2024):
- Identifies that video foundation models (VideoLLaMA, ViCLIP) excel at short-term understanding but struggle with extended temporal reasoning
- Proposes decoupling semantic understanding from temporal analysis
- Uses VLMs for per-frame perception + state machines for long-term event tracking
- 9-15% F1 improvement for complex event identification on Waymo and NuScenes

**MVBench** (Li et al., 2023): Benchmark with 20 video understanding tasks.
- Demonstrates that current multimodal LLMs struggle with temporal reasoning
- VideoChat2 baseline outperforms existing models by >15% on temporal tasks

### 4.4 Action Recognition in Driving Context

Video foundation models enable:
- **Trajectory prediction** from temporal sequences
- **Behavior recognition** of other road users (pedestrians, cyclists, other vehicles)
- **Anomaly detection** in video streams (unusual maneuvers, near-misses)
- **Scene dynamics understanding** (traffic flow, construction zone behavior)

**Airside relevance:** Video models are critical for airside because:
- Aircraft movements follow specific taxiing protocols
- GSE has predictable but varied operational patterns (loading, unloading, towing)
- Safety-critical events (jet blast, FOD on apron) need temporal context
- Marshaller gesture recognition requires action understanding

---

## 5. Domain Adaptation Strategies for Airside

### 5.1 The Airside Domain Gap

Airport airside differs fundamentally from standard road driving:

| Dimension | Road Driving | Airport Airside |
|-----------|-------------|----------------|
| **Object classes** | Cars, trucks, pedestrians, cyclists | Aircraft, GSE (tugs, loaders, fuel trucks), baggage carts, marshallers |
| **Scene layout** | Lanes, intersections, sidewalks | Aprons, taxiways, stands, jetbridges |
| **Scale variation** | Moderate (cars ~4m, trucks ~12m) | Extreme (baggage cart ~2m, A380 ~73m) |
| **Dynamics** | High-speed, predictable lanes | Low-speed, complex multi-agent coordination |
| **Markings** | Lane markings, traffic signs | Stand lines, taxiway markings, safety zones |
| **Regulations** | Road traffic rules | ICAO/airport-specific procedures |

### 5.2 Adapting Road-Driving Models to Airside

**Strategy 1: Zero-Shot Foundation Models (No Airside Data)**

The fastest path to airside perception with zero labeled airside data:
- **Grounding DINO + SAM** for open-vocabulary detection and segmentation with text prompts ("aircraft," "pushback tug," "fuel bowser," "baggage loader," "ground power unit")
- **YOLO-World** for real-time open-vocabulary detection at 52 FPS
- **Clipomaly** for anomaly detection (detecting unknown objects and assigning interpretable names)
- **OWL-ViT** one-shot detection: provide a single reference image of each GSE type

Expected performance: Moderate. Foundation models will detect and segment objects at a general level but may confuse similar GSE types or struggle with airside-specific spatial reasoning.

**Strategy 2: Pseudo-Label Generation + Specialized Model Training**

Use foundation models to bootstrap training data:
1. Deploy Grounded SAM on unlabeled airside footage to generate pseudo-labels
2. Human annotators correct only the errors (significantly faster than annotation from scratch)
3. Train a specialized detector (e.g., RT-DETR, YOLOv8) on the corrected labels
4. Iterate with active learning

The **ZOPP** framework validates this approach: foundation model pseudo-labels on Waymo data are sufficient for training competitive downstream models.

**Strategy 3: Foundation Model Fine-Tuning with Limited Airside Data**

Adapt foundation models directly using parameter-efficient methods.

### 5.3 Fine-Tuning Strategies (LoRA, Adapters)

**LoRA** (Hu et al., 2021) is the primary technique for efficient foundation model adaptation:
- Freezes pre-trained weights; injects low-rank trainable matrices into transformer layers
- Reduces trainable parameters by 10,000x compared to full fine-tuning
- No additional inference latency (weight matrices are merged at deployment)
- GPU memory reduction of ~3x

**Application to airside:**

| Foundation Model | LoRA Application | Expected Outcome |
|-----------------|-----------------|-----------------|
| **SAM** | Adapt mask decoder for airside-specific object boundaries | Better segmentation of aircraft components, GSE |
| **Grounding DINO** | Adapt detection head for airside vocabulary | Improved detection precision for GSE subclasses |
| **DINOv2** | Add LoRA to ViT backbone for airside feature extraction | Better features for airside-specific tasks |
| **YOLO-World** | Fine-tune with airside image-text pairs | Improved airside vocabulary understanding |
| **InternVL** | Adapt for airside visual question answering | Scene understanding ("Is the aircraft door open?") |

**Adapter-based approaches:**
- Add small adapter modules between frozen transformer layers
- Train only adapter parameters (~2-5% of total model parameters)
- Can be swapped at inference time (e.g., switch between road and airside adapters)

**Visual prompting** (Bahng et al., 2022): Learns a single image perturbation that enables frozen models to perform new tasks.
- Particularly effective for CLIP; robust to distribution shift
- Could enable CLIP-based airside perception without modifying model weights

### 5.4 How Much Airside Data Is Needed?

Based on the literature, the data requirements follow a progression:

**Zero-shot (0 airside examples):**
- Open-vocabulary detection (Grounding DINO, YOLO-World): functional but noisy
- SAM segmentation: works well for clear object boundaries
- CLIP classification: works for well-known categories (aircraft types)
- Estimated performance: 40-60% mAP for common airside objects

**Few-shot (5-50 examples per class):**
- OWL-ViT one-shot detection with reference images
- DINOv2 linear probes with 10-50 labeled examples
- Point-BERT few-shot classification for LiDAR objects
- Estimated performance: 55-70% mAP

**Limited annotation (100-500 examples per class):**
- LoRA fine-tuning of foundation models
- Pseudo-label correction (foundation model generates, human corrects)
- Estimated performance: 65-80% mAP

**Moderate annotation (1,000-5,000 examples per class):**
- Full adapter training
- Specialized model training on pseudo-labeled + corrected data
- Estimated performance: 75-90% mAP

**Key insight from VideoMAE research:** Data quality (domain match) matters more than quantity. 3K-4K well-chosen airside video clips may outperform 100K road driving clips for airside-specific tasks.

### 5.5 Prompt Engineering for Zero-Shot Airside Perception

Effective prompts for airside detection with Grounding DINO / YOLO-World:

**Aircraft detection:**
- Generic: "aircraft . airplane . jet"
- Specific: "narrow-body aircraft . wide-body aircraft . turboprop aircraft . helicopter"
- Component-level: "aircraft engine . landing gear . aircraft wing . cockpit window"

**Ground Support Equipment:**
- "pushback tug . aircraft tug . towbarless tractor"
- "belt loader . container loader . high loader . cargo loader"
- "fuel truck . fuel bowser . refueling vehicle"
- "ground power unit . air start unit . hydraulic power unit"
- "baggage cart . baggage dolly . ULD dolly"
- "passenger stairs . airstairs . mobile stairway"
- "catering truck . catering high-lift"
- "deicing truck . deicing vehicle"
- "follow-me car . marshalling vehicle"

**Prompt engineering best practices:**
1. Use multiple synonyms separated by " . " for each category
2. Include both generic and specific terms
3. Test with negative examples to calibrate false-positive thresholds
4. For ambiguous categories, use descriptive phrases: "small yellow vehicle towing baggage carts"
5. Leverage CLIP similarity scores to rank detections by confidence

### 5.6 Active Learning with Foundation Models

**Foundation-model-assisted active learning pipeline:**

1. **Initial deployment:** Run Grounding DINO + SAM on unlabeled airside data
2. **Uncertainty identification:** Flag detections where:
   - Grounding DINO confidence is between 0.3-0.7 (uncertain)
   - Multiple text prompts produce conflicting results
   - SAM mask quality score is low
3. **Human review:** Annotators review only uncertain cases (reduces annotation effort by 60-80%)
4. **Model update:** LoRA fine-tune on corrected annotations
5. **Iterate:** New model identifies new uncertain cases

This approach was validated by **Multi-label Scene Classification** (Li et al., 2025), which combined Knowledge Acquisition and Accumulation (KAA) with Consistency-based Active Learning (CAL) for autonomous vehicle perception, achieving significant improvements with reduced annotation.

---

## 6. Synthesis: A Roadmap for Airport Airside Perception

### 6.1 Recommended Architecture Stack

```
Layer 4: Scene Understanding
  InternVL / GPT-4V for complex spatial reasoning
  "Is the pushback complete?" "Is Stand 42 occupied?"

Layer 3: Temporal Understanding
  SAM 2 for video object tracking
  InternVideo2 features for action recognition
  Marshaller gesture recognition, GSE activity classification

Layer 2: 3D Perception
  Cross-modal alignment (LargeAD approach)
  DINOv2 superpixels aligned with LiDAR points
  DetAny3D for zero-shot monocular 3D detection

Layer 1: 2D Perception (Foundation)
  YOLO-World for real-time open-vocabulary detection (52 FPS)
  Grounding DINO + SAM for high-quality segmentation
  DINOv2 backbone for dense features
  Clipomaly for anomaly detection
```

### 6.2 Phased Deployment Strategy

**Phase 1: Zero-Shot Baseline (Week 1-2)**
- Deploy YOLO-World + Grounding DINO + SAM with airside text prompts
- Evaluate on representative airside footage
- Identify gaps (which objects are missed, which are confused)

**Phase 2: Few-Shot Adaptation (Week 3-4)**
- Collect 50-100 reference images per critical object class
- OWL-ViT one-shot detection for rare GSE types
- DINOv2 linear probes for object classification
- Active learning to identify the most valuable annotations

**Phase 3: Efficient Fine-Tuning (Month 2-3)**
- LoRA fine-tuning of detection models on corrected pseudo-labels
- Adapter training for SAM mask decoder on airside boundaries
- Specialized 3D detection using foundation model knowledge transfer

**Phase 4: Full System (Month 4-6)**
- Integrate video understanding (SAM 2 tracking, temporal models)
- 3D perception with cross-modal alignment
- Scene-level reasoning with VLMs
- Continuous active learning pipeline

### 6.3 Key Research Gaps and Opportunities

1. **No airside-specific foundation model benchmarks exist.** Creating an "AirsideNet" dataset with GSE annotations would accelerate the field.

2. **Scale variation handling:** Current foundation models are not explicitly designed for the extreme scale variation on airside (2m baggage cart next to 73m A380). Multi-scale attention mechanisms may need adaptation.

3. **Multi-agent coordination understanding:** Airside operations involve complex choreography between multiple GSE, aircraft, and personnel. Current VLMs can describe individual objects but struggle with relational reasoning at this complexity.

4. **Regulatory compliance verification:** Foundation models could be trained to verify compliance with safety procedures (e.g., checking that FOD walks are performed, that vehicles maintain safe distances from active engines).

5. **Weather and lighting robustness:** Airside operations occur 24/7 in all weather conditions. Foundation models show promising robustness (SAM maintains performance under weather perturbations), but this needs systematic validation for airside conditions.

### 6.4 Critical References

| Reference | Year | Venue | Relevance |
|-----------|------|-------|-----------|
| SAM (Kirillov et al.) | 2023 | ICCV | Zero-shot segmentation foundation |
| SAM 2 (Meta) | 2024 | - | Video segmentation + tracking |
| Grounding DINO (Liu et al.) | 2023 | ECCV | Open-set detection by text |
| YOLO-World (Cheng et al.) | 2024 | CVPR | Real-time open-vocabulary detection |
| DINOv2 (Oquab et al.) | 2023 | TMLR | Self-supervised visual features |
| CLIP (Radford et al.) | 2021 | ICML | Vision-language alignment |
| SigLIP (Zhai et al.) | 2023 | ICCV | Efficient image-text pretraining |
| OWL-ViT (Minderer et al.) | 2022 | ECCV | Open-vocabulary + one-shot detection |
| EVA (Fang et al.) | 2022 | CVPR | Scaled vision foundation model |
| EVA-02 (Fang et al.) | 2023 | - | Efficient vision representations |
| InternImage (Wang et al.) | 2022 | CVPR | CNN-based foundation model |
| InternVL 1.5 (Chen et al.) | 2024 | - | Open-source multimodal model |
| UniPAD (Yang et al.) | 2024 | CVPR | 3D pre-training for driving |
| Point-BERT (Yu et al.) | 2022 | CVPR | 3D point cloud pre-training |
| LargeAD (Kong et al.) | 2025 | TPAMI | Cross-sensor pretraining |
| LoRA (Hu et al.) | 2021 | ICLR | Parameter-efficient fine-tuning |
| VideoMAE (Tong et al.) | 2022 | NeurIPS | Video self-supervised learning |
| InternVideo2 (Wang et al.) | 2024 | ECCV | Video foundation model |
| DistillNeRF (Wang et al.) | 2024 | NeurIPS | 3D scene understanding with VFMs |
| ZOPP (Ma et al.) | 2024 | NeurIPS | Zero-shot panoptic perception |
| DetAny3D (Zhang et al.) | 2025 | - | Zero-shot 3D detection |
| Clipomaly (Reichard et al.) | 2024 | - | Open-world anomaly segmentation |
| VFMM3D (Ding et al.) | 2024 | - | SAM + Depth for monocular 3D |
| FusionSAM (Li et al.) | 2024 | - | Multimodal SAM for driving |
| DriveLM (Sima et al.) | 2024 | ECCV | VLM-based driving reasoning |
| MobileSAM (Zhang et al.) | 2023 | - | Lightweight SAM for deployment |
| OMG-Seg (Li et al.) | 2024 | CVPR | Unified segmentation model |

---

*Report compiled March 2026. Research landscape is evolving rapidly; key papers from late 2024 through early 2026 represent the frontier of foundation model application to autonomous driving perception.*
