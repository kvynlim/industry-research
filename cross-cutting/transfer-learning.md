# Transfer Learning: Road-Driving Models to Airport Airside Operations

> Comprehensive technical report on strategies for adapting autonomous driving perception, prediction, and world models trained on road-driving datasets (nuScenes, Waymo, KITTI) to the airport airside operational design domain.

---

## Table of Contents

1. [Domain Gap Analysis](#1-domain-gap-analysis)
2. [Transfer Learning Strategies](#2-transfer-learning-strategies)
3. [Domain Adaptation Techniques](#3-domain-adaptation-techniques)
4. [Few-Shot and Zero-Shot Approaches](#4-few-shot-and-zero-shot-approaches)
5. [Practical Pipeline: nuScenes Pre-trained to Airside Fine-tuned](#5-practical-pipeline-nuscenes-pre-trained-to-airside-fine-tuned)
6. [Transfer for World Models](#6-transfer-for-world-models)
7. [Published Results: Non-Road Domain Transfer](#7-published-results-non-road-domain-transfer)
8. [Recommendations for Airside AV Stack](#8-recommendations-for-airside-av-stack)

---

## 1. Domain Gap Analysis

The domain gap between on-road driving datasets and airport airside operations is substantial and multi-dimensional. Understanding each axis of divergence is essential for selecting appropriate transfer strategies.

### 1.1 Object Distribution and Taxonomy

**Road-driving datasets** (nuScenes, Waymo, KITTI) are annotated for 10 standard detection classes:
- car, truck, bus, trailer, construction_vehicle, pedestrian, motorcycle, bicycle, barrier, traffic_cone

**Airport airside** introduces a fundamentally different object taxonomy:
- **Aircraft**: parked, taxiing, under pushback — objects far larger than anything in road datasets (wingspan 30-80m vs. cars at ~4.5m)
- **Ground Support Equipment (GSE)**: baggage tractors, belt loaders, cargo loaders, pushback tugs, fuel trucks, catering trucks, lavatory trucks, ground power units, air start units, de-icing trucks
- **Personnel**: ramp agents, marshallers, fueling crews — pedestrians in high-visibility vests, often in close proximity to heavy equipment
- **Baggage trains**: articulated chains of dollies towed behind tractors, creating unique multi-body dynamics that have no road equivalent
- **Infrastructure**: jet bridges, terminal buildings, blast fences, FOD detection zones, runway/taxiway markings

The critical implication: **none of the airside-specific classes exist in standard road-driving datasets**. A nuScenes-pretrained detection head recognizes zero GSE categories out of the box. However, the backbone feature extractors that learn general 3D geometric priors (surfaces, edges, spatial relationships) remain highly transferable.

A Roboflow dataset ("airport-ground-vehicles" by Airport GSE) provides some labeled 2D imagery of airside vehicle categories, but no large-scale 3D point cloud dataset for airport apron objects exists publicly. This data scarcity makes transfer learning not just useful but necessary.

### 1.2 Scene Geometry and Layout

| Characteristic | Road Driving | Airport Airside |
|---|---|---|
| Lane structure | Marked lanes, intersections, roundabouts | Service roads, apron markings, stand lines, virtual channels |
| Open space | Constrained by lanes/curbs | Large open apron areas with sparse structure |
| Vertical elements | Buildings, trees, poles, signs | Aircraft fuselages/tails, jet bridges, terminal facades |
| Ground plane | Road surface with curbs, median | Flat concrete/asphalt, minimal elevation changes |
| Occlusion patterns | Vehicle-behind-vehicle, intersection occlusions | Aircraft-body occlusions, GSE clustered at stands |
| Scale range | 1-20m objects, mostly 4-5m cars | 0.5m (cone) to 80m (aircraft wingspan) |

The airport apron is characterized by large open areas punctuated by massive aircraft objects that create severe occlusion zones. GSE often clusters tightly around aircraft on stand, creating dense, overlapping detection challenges unlike the relatively ordered lane-following scenarios in road driving.

### 1.3 Speed Regime and Dynamics

| Parameter | Road Driving | Airport Airside |
|---|---|---|
| Typical ego speed | 30-120 km/h | 5-25 km/h (15 mph general, 5 mph near aircraft) |
| Max target speed | 130+ km/h (highway) | 40 km/h (perimeter roads), 8 km/h (aircraft pushback) |
| Acceleration profiles | Moderate to high | Very low, slow ramp-up |
| Prediction horizon needed | 3-8 seconds at highway speed | 5-15 seconds due to slow-speed close-quarters operations |
| Interaction complexity | Lane-following, merging, intersection turns | Non-lane-following, 360-degree interactions, docking maneuvers |
| Stopping precision | ~30 cm at parking | Sub-3 cm for GSE-to-aircraft docking |

The slow-speed regime fundamentally changes the prediction problem. Road driving models optimize for high-speed trajectory prediction where small angular errors compound into large positional errors. Airside operations require centimeter-level precision at low speed — a different optimization landscape entirely.

### 1.4 LiDAR Characteristics and Point Cloud Differences

**Road-driving LiDAR configurations:**
- Waymo: 1x 64-beam top LiDAR + 4x short-range LiDARs
- nuScenes: 1x 32-beam Velodyne HDL-32E
- KITTI: 1x 64-beam Velodyne HDL-64E

**Airside LiDAR configurations:**
- Often 2D LiDAR (e.g., RPLIDAR A1M8, 0.1-12m range) for cost reasons on GSE
- Some deployments use Velodyne VLP-16 or similar on autonomous tractors
- Infrastructure-mounted 3D LiDAR for area surveillance

Key point cloud domain gaps:
- **Beam density**: 16-32 beam sensors common on airside GSE vs. 64-128 beam on road AV platforms. Research shows beam density changes cause up to 50% performance degradation without adaptation (LiDAR Distillation, ECCV 2022).
- **Mounting height**: Road AVs mount LiDAR at ~1.8m. GSE vehicles vary from 0.5m (low tractors) to 3m+ (cargo loaders), fundamentally changing the scan geometry.
- **Object point density**: Aircraft at close range can generate extremely dense returns (thousands of points on fuselage), while small GSE at range may have fewer than 10 points — an inverted distribution compared to road driving where cars at similar ranges produce moderate point counts.
- **Reflectivity patterns**: Aircraft aluminum surfaces, high-visibility markings, wet tarmac create different intensity distributions than road surfaces/vehicles.

The CMD dataset (ECCV 2024) demonstrated that cross-sensor-mechanism domain gaps (e.g., mechanical spinning vs. solid-state LiDAR) can be more severe than cross-geography gaps, directly relevant to airside deployments that may use different sensor types than training data.

### 1.5 Environmental and Regulatory Differences

- **Lighting**: 24/7 operations with runway/apron lighting at night; aircraft landing lights creating transient bright spots
- **Weather sensitivity**: Operations continue in conditions that would stop road driving; jet blast creates localized wind/debris effects
- **Regulatory**: FAA Advisory Circular 150/5210-20 governs ground vehicle operations; autonomous vehicles face additional certification requirements from aviation authorities
- **Safety stakes**: GSE-aircraft incidents cause approximately $4 billion in annual losses; collision with aircraft can ground fleets

---

## 2. Transfer Learning Strategies

### 2.1 Feature Extraction (Frozen Backbone)

**Approach**: Keep all pre-trained backbone layers frozen; train only a new detection head with airside-specific classes.

**When to use**: Very small airside dataset (<500 labeled frames), or when compute budget is minimal.

**Mechanism**:
```
[Pre-trained backbone (frozen)] → [New detection head (trainable)]
                                    - New class count (GSE types, aircraft, personnel)
                                    - New anchor sizes (aircraft: 30-80m vs. car: 4.5m)
                                    - New aspect ratios
```

**Data requirements**: As few as 50-200 annotated frames can produce usable results when the backbone features are strong, but expect 15-25% lower mAP than full fine-tuning. This is because the backbone features learned on road objects (car-shaped, pedestrian-shaped) do not optimally represent aircraft fuselages or baggage train chains.

**Practical note**: When using mmdetection3d or OpenPCDet with a nuScenes checkpoint, you must explicitly exclude head weights when loading, since class counts differ (nuScenes: 10 classes vs. airside: potentially 15-20 GSE categories). The mmdetection3d issue #3120 documents this exact workflow: reuse backbone weights while training the head from scratch.

### 2.2 Full Fine-Tuning

**Approach**: Initialize from pre-trained weights, then update all layers on airside data.

**When to use**: Sufficient airside data available (>2,000 annotated frames), and the domain gap is large enough that frozen features underperform.

**Key considerations**:
- Use a learning rate 10-100x smaller than training from scratch (e.g., 1e-4 → 1e-6 for backbone, 1e-4 for head)
- Monitor for catastrophic forgetting if you need to retain road-driving capability
- Risk of overfitting on small airside datasets — regularization (dropout, weight decay) becomes critical

**Data requirements**: 2,000-10,000 annotated frames for robust performance. With fewer than 2,000 frames, prefer progressive unfreezing or LoRA.

### 2.3 LoRA and Adapter-Based Fine-Tuning

**Approach**: Insert small trainable rank-decomposition matrices (LoRA) or adapter modules into the frozen backbone, updating less than 10% of total parameters.

**LoRA mechanics**:
- For a pre-trained weight matrix W ∈ R^(d×k), LoRA decomposes the update as ΔW = BA where B ∈ R^(d×r) and A ∈ R^(r×k), with rank r << min(d,k)
- Typical r values: 4-16 for detection backbones
- Reduces trainable parameters by up to 10,000x vs. full fine-tuning

**PEFT-DML** (Dec 2024) demonstrates this approach specifically for multi-modal 3D object detection in autonomous driving:
- Integrates LoRA and adapter layers into multi-modal fusion architectures
- Achieves accuracy matching or exceeding full fine-tuning while updating <10% of parameters
- Shows robustness to domain shifts, weather variability, and sensor dropout
- Validated on nuScenes with superior AP3D scores across conditions

**LoGenE** (Adaptive Control via LoRA-based Genetic Evolution) offers a gradient-free alternative:
- Evolves lightweight LoRA adapter modules offline using control logs
- Eliminates need for gradient updates or real-time simulation
- Particularly suited for adapting driving policies to new operational domains

**When to use**: Medium airside dataset (500-2,000 frames), when compute budget matters, or when you want to maintain separate "road" and "airside" adapter sets on a shared backbone.

**Data requirements**: 500-2,000 annotated frames. LoRA's regularization effect (constraining updates to a low-rank subspace) naturally prevents overfitting on small datasets.

### 2.4 Progressive Unfreezing

**Approach**: Start by training only the detection head, then progressively unfreeze deeper backbone layers in stages.

**Strategy**:
```
Stage 1: Unfreeze head only → train for N epochs
Stage 2: Unfreeze last backbone block → train with lower LR
Stage 3: Unfreeze second-to-last block → train with even lower LR
Stage 4 (optional): Unfreeze all → very low LR fine-tuning
```

**Learning rate schedule**: Use discriminative learning rates — deeper (earlier) layers get 2-10x smaller learning rates than later layers, as they capture more general features (edges, surfaces) that transfer well and should change less.

**When to use**: Medium dataset (1,000-5,000 frames) where you want to control how much domain-specific adaptation occurs in each network layer.

**Monitoring**: If accuracy stalls at a given stage, unfreeze the next layer group. If accuracy degrades after unfreezing, the dataset is too small for that depth of adaptation — revert and use LoRA instead.

### 2.5 Data Requirements Summary

| Strategy | Min Frames | Recommended Frames | Trainable Params | Risk |
|---|---|---|---|---|
| Feature extraction | 50-200 | 200-500 | ~5% (head only) | Suboptimal features for new domain |
| LoRA/Adapters | 500-1,000 | 1,000-3,000 | <10% | May miss large domain shifts |
| Progressive unfreezing | 1,000-2,000 | 2,000-5,000 | 10-100% staged | Requires careful LR tuning |
| Full fine-tuning | 2,000-5,000 | 5,000-20,000 | 100% | Overfitting, catastrophic forgetting |

**Critical caveat**: These estimates assume reasonable class balance. Rare GSE types (e.g., de-icing trucks that only appear in winter operations) may need targeted data collection or synthetic augmentation regardless of overall dataset size.

---

## 3. Domain Adaptation Techniques

### 3.1 Unsupervised Domain Adaptation (UDA)

UDA methods aim to align feature distributions between source (road) and target (airside) domains without requiring target-domain labels.

#### 3.1.1 DANN (Domain-Adversarial Neural Networks)

**Mechanism**: A gradient reversal layer forces the feature extractor to produce domain-invariant features by adversarially training a domain classifier. The backbone learns features that are discriminative for the detection task but cannot distinguish between road and airside domains.

**Application to road→airside**:
- Train domain classifier on road vs. airside features
- Gradient reversal penalizes domain-specific features
- Detection head operates on domain-invariant representations

**Limitation for airside**: DANN assumes shared label space between domains. Since airside has fundamentally different object classes (GSE vs. cars), vanilla DANN may align features in ways that discard class-relevant information. Partial domain adaptation variants (class-conditional alignment) are more appropriate.

#### 3.1.2 MMD (Maximum Mean Discrepancy)

**Mechanism**: Minimize the MMD distance between source and target feature distributions in a reproducing kernel Hilbert space.

**Class-wise MMD**: Align features per-class rather than globally. This is critical for airside adaptation because:
- "Vehicle" features from road driving should align with "GSE vehicle" features from airside
- "Pedestrian" features should align with "ramp personnel" features
- Aircraft have no road equivalent — these classes must be learned purely from target data

**Discriminative class-wise MMD** (DCMMD) has shown that class-conditional alignment outperforms marginal alignment by 3-8% mAP across domain adaptation benchmarks.

#### 3.1.3 Self-Training (ST3D / ST3D++)

ST3D (CVPR 2021) provides the most directly applicable UDA framework for 3D object detection:

**Pipeline**:
1. **Source pre-training with Random Object Scaling (ROS)**: Augments source objects by random scale factors to reduce source-domain size bias — critical since airside objects span a much wider size range than road objects
2. **Pseudo-label generation**: Run pre-trained detector on unlabeled airside data to generate pseudo labels
3. **Quality-Aware Triplet Memory Bank**: Stores multiple pseudo-label proposals per object, selecting high-quality labels based on IoU consistency across training iterations
4. **Curriculum Data Augmentation**: Gradually increases augmentation difficulty to prevent overfitting to easy pseudo-labeled examples

**Results on road-to-road transfer**:
- Waymo→KITTI: Surpasses fully supervised KITTI results
- nuScenes→KITTI: State-of-the-art UDA performance

**Airside applicability**: ST3D's ROS strategy is directly relevant because it explicitly addresses object size bias — the primary domain gap between road vehicles (~4m) and aircraft (~50m). However, ST3D assumes shared classes between domains. For airside, a modified pipeline would:
1. Pre-train on nuScenes road data for general 3D feature learning
2. Generate pseudo-labels on unlabeled airside data for "vehicle-like" and "person-like" categories
3. Iteratively refine with human annotation of airside-specific classes

#### 3.1.4 STAL3D and MA-ST3D (2024)

Recent extensions combine self-training with adversarial learning:
- **STAL3D**: Collaborates self-training and adversarial learning for UDA in 3D detection
- **MA-ST3D**: Incorporates motion association into self-training, using temporal consistency to improve pseudo-label quality — particularly relevant for airside where objects move slowly and consistently

### 3.2 Style Transfer for Point Clouds

#### 3.2.1 CycleGAN for LiDAR Domain Mapping

**Approach**: Convert 3D point clouds to 2D bird's-eye-view (BEV) images, apply CycleGAN-based style transfer to transform source-domain BEV representations into target-domain style, then train detectors on the styled data.

**Pipeline**:
```
Source 3D points → BEV projection → CycleGAN(source BEV → target BEV) → Train detector
```

**Key considerations for airside**:
- BEV projection preserves spatial layout while enabling 2D style transfer
- Semantic consistency enforcement prevents layout distortion during style transfer
- Aircraft silhouettes in BEV are dramatically different from any road object — CycleGAN may hallucinate unrealistic geometries if not constrained

**LiDAR sensor modeling with GANs**: CycleGANs have been used to transform simulated LiDAR to realistic LiDAR distributions (sim2real), which is directly applicable to generating synthetic airside LiDAR data from simulation environments like airport digital twins.

#### 3.2.2 DIG Method

The DIG (Density, Intensity, Geometry) method addresses three axes of point cloud domain gap:
- **Density adaptation**: Resample point clouds to match target sensor density
- **Intensity normalization**: Align reflectivity distributions (important for airside where aircraft aluminum vs. road asphalt creates different intensity profiles)
- **Geometry alignment**: Normalize object sizes using target-domain statistics

This multi-axis approach is well-suited for road→airside transfer where all three axes shift simultaneously.

#### 3.2.3 Statistical Normalization (SN)

SN rescales source-domain objects (bounding boxes and enclosed points) to match size statistics in the target domain. For airside:
- Road "car" objects (4.5×1.8×1.5m) → airside "baggage tractor" (3.5×1.5×1.5m)
- Road "truck" objects (6.9×2.5×2.8m) → airside "fuel truck" (8×2.5×3.2m)
- No road equivalent for "aircraft" → requires direct target-domain learning

**Limitation**: SN is sensitive to target-domain size statistics accuracy. If target-domain data is scarce, size estimates may be noisy, degrading performance.

### 3.3 Domain Randomization

**Mechanism**: Train on synthetic data with randomly varied domain-specific attributes (textures, lighting, object placement, sensor noise) so the model learns domain-invariant representations.

**Application to airside**:
1. Generate synthetic airside scenes in simulation (CARLA with airport maps, or custom Unity/Unreal environments)
2. Randomize: weather, lighting, ground texture, GSE placement around aircraft, personnel positions
3. Randomize sensor parameters: LiDAR beam count, mounting height, noise profile
4. Train detector on randomized synthetic data → deploy to real airside environment

**Key challenge**: The LiDAR sim-to-real gap can be as large as 50% mAP degradation. Real-world models achieve >70% mAP while synthetic-only models reach <20% mAP on real test data. Domain randomization alone is insufficient — it should be combined with a small amount of real airside data or style transfer.

**CTS (Sim-to-Real UDA)**: Recent methods combine domain randomization with consistency-based self-training to bridge the sim-to-real gap more effectively.

### 3.4 Test-Time Adaptation (TTA)

**Mechanism**: Adapt model parameters during inference on the target domain using self-supervised objectives, without any target labels.

**MonoTTA** (CUHK Shenzhen, 2024): Real-time test-time adaptation for monocular 3D detection:
- Enables rapid unsupervised learning during testing
- Guides the model through self-supervised learning to enhance generalization in out-of-distribution scenarios
- Computationally lightweight, suitable for edge deployment on GSE vehicles

**Airside TTA strategy**:
1. Deploy road-pretrained model to airside vehicle
2. During initial operation, TTA continuously adapts batch normalization statistics and lightweight parameters to airside data distribution
3. As adaptation progresses, model adjusts to airside-specific point cloud density, object sizes, and scene geometry
4. Periodic "adaptation checkpoints" can be saved and distributed across fleet

**Advantage for airside**: TTA requires no labeled airside data at all — the model adapts itself during operation. This is valuable for initial deployment before a labeled airside dataset exists.

**Risk**: Without ground-truth supervision, TTA can accumulate errors over time. It should be viewed as a bootstrapping mechanism, not a permanent solution.

---

## 4. Few-Shot and Zero-Shot Approaches

### 4.1 Foundation Model Capabilities

Foundation models trained on web-scale data offer the most promising path to bootstrapping perception in the airside domain with minimal labeled data.

#### 4.1.1 Vision-Language Models (VLMs) for Open-Vocabulary Detection

**Grounding DINO** (ECCV 2024):
- Detects arbitrary objects described by text prompts, zero-shot
- "Find all baggage tractors" → detects without any fine-tuning
- Grounding DINO 1.5 Pro offers stronger generalization; Edge variant targets deployment on vehicles
- Zero-shot performance: 48 AP on COCO vs. 33 AP for state-of-the-art few-shot detectors
- For airside: can detect "pushback tug," "belt loader," "fuel truck," "aircraft" via text prompts alone

**Grounded SAM** (combining Grounding DINO + Segment Anything Model):
- Open-vocabulary detection + instance segmentation
- Directly applicable to real-time airside scene annotation
- Can segment novel GSE categories never seen during training
- Enables automatic pseudo-label generation for building labeled airside datasets

**Airside application pipeline**:
```
Camera image → Grounding DINO("pushback tug, belt loader, fuel truck, aircraft,
                                baggage cart, personnel")
             → SAM(detected boxes)
             → Instance masks + class labels (pseudo-labels)
             → Use as training data for specialized 3D detector
```

#### 4.1.2 Open3DWorld and 3D Open-Vocabulary Detection

Open3DWorld uses CLIP's text encoder to enhance 3D object detection by transforming category labels into embeddings, supporting detection of unseen classes in 3D space. This enables:
- Detecting "baggage tractor" in 3D point clouds using language embedding, even if no 3D annotations exist for that class
- Bridging the 2D VLM capability gap into 3D perception via feature distillation

#### 4.1.3 CLIP-Based Domain Adaptation

CLIP's joint image-text embedding space enables:
- **Zero-shot classification**: Compare airside image features against text descriptions of GSE categories
- **Few-shot adaptation**: Fine-tune with as few as 1-16 examples per class using prompt tuning
- **Domain-invariant features**: CLIP features are more robust to domain shift than ImageNet features, since they encode semantic meaning rather than domain-specific texture/style

### 4.2 Few-Shot 3D Object Detection

#### 4.2.1 Meta-Det3D

Meta-Det3D (ACCV 2022) is the first meta-learning framework for few-shot 3D object detection:
- Trains a 3D meta-detector over different detection tasks to learn task distributions
- Dynamically adapts to new object classes with only a few labeled examples
- Uses MAML-style optimization: learn initialization parameters that, after minimal gradient steps on few-shot support set, produce good detection performance

**Airside relevance**: Train on road-driving detection tasks, then adapt to airside GSE classes with 5-10 labeled examples per category.

#### 4.2.2 Prototypical VoteNet

Uses prototypical networks for 3D point cloud detection:
- Computes class prototypes by averaging features from support examples
- Classifies query objects by distance to prototypes in feature space
- Metric-based approaches outperform optimization-based (MAML) in most few-shot 3D settings

#### 4.2.3 Generalized Cross-Domain Few-Shot (GCFS) Detection

The GCFS framework (2025) directly addresses the scenario of deploying to a new domain with novel classes and limited data:

**Method**:
1. **Image-guided multi-modal fusion**: Uses Grounding DINO + SAM to extract 2D semantic information, then converts to 3D via physically-aware box searching
2. **Contrastive-enhanced learnable prototypes**: Builds class prototypes optimized during fine-tuning with contrastive learning on few-shot anchors

**Results on 5-shot cross-domain tasks**:
- nuScenes→KITTI: 13.55% mAP (common: 15.99%, novel: 11.72%)
- Waymo→KITTI: 21.03% mAP (common: 25.40%, novel: 17.75%)
- KITTI→A2D2: 6.50% mAP (common: 7.78%, novel: 5.22%)

These results demonstrate that cross-domain few-shot 3D detection is feasible but challenging — the larger the domain gap, the lower the performance. The road→airside gap is likely larger than KITTI→A2D2, suggesting that more than 5 shots per class will be needed.

### 4.3 Prompt Tuning for VLMs

#### 4.3.1 Context-Conditional Prompt Tuning

**CoCoOp and similar methods** learn a small set of continuous prompt vectors conditioned on input images, enabling:
- Few-shot classification of airside scenes and objects
- Domain-specific prompts that capture airside visual characteristics
- Transferable prompts that generalize across VLM tasks

#### 4.3.2 Test-Time Prompt Tuning (TPT / C-TPT / DynaPrompt)

These methods adapt prompts during inference without any training data:
- **C-TPT** (ICLR 2024): Calibrated test-time prompt tuning via text feature dispersion
- **DynaPrompt** (ICLR 2025): Dynamic prompt selection at test time
- **R-TPT** (CVPR 2025): Robust test-time prompt tuning for adversarial conditions

**Airside application**: Deploy a CLIP-based perception system with test-time prompt adaptation. As the system encounters airside scenes, prompts adapt to better represent the operational domain without any labeled data.

#### 4.3.3 ContextVLM for Autonomous Driving

ContextVLM (2024) defines 24 environmental contexts capturing weather, lighting, traffic, and road conditions. For airside, analogous contexts could include:
- Aircraft on stand / aircraft taxiing / pushback in progress
- Ramp congested / ramp clear
- Night operations / day operations
- Wet apron / dry apron / de-icing conditions

### 4.4 Practical Few-Shot Strategy for Airside

**Recommended pipeline**:
1. **Week 1**: Deploy Grounding DINO + SAM on airside camera feeds to generate initial pseudo-labels for all visible GSE categories
2. **Week 2**: Human annotators review and correct pseudo-labels, building a curated 5-20 shot per class dataset
3. **Week 3**: Fine-tune 3D detector using GCFS approach with VLM-assisted box proposals
4. **Week 4**: Iterative refinement — model generates new pseudo-labels, humans correct, retrain

This reduces labeling cost from "annotate thousands of 3D boxes from scratch" to "correct VLM-generated proposals."

---

## 5. Practical Pipeline: nuScenes Pre-trained to Airside Fine-tuned

### 5.1 Framework Selection

**Recommended frameworks**:
- **OpenPCDet**: General PyTorch codebase for 3D detection, supports multiple architectures (PointPillars, PV-RCNN, VoxelRCNN, CenterPoint). Data-model separation with unified point cloud coordinate system makes custom dataset extension straightforward.
- **mmdetection3d**: Comprehensive 3D detection toolbox with strong nuScenes support, built-in data pipeline customization, and config-based experiment management.

Both support loading pre-trained checkpoints and fine-tuning with modified class configurations.

### 5.2 Step-by-Step Pipeline

#### Step 1: Airside Data Collection

```
Sensors:
  - Primary: 3D LiDAR (Velodyne VLP-32C or Ouster OS1-128)
  - Secondary: 6x surround cameras (synchronized)
  - GPS/IMU for ego-pose

Collection protocol:
  - Cover all GSE types across multiple stands
  - Include day/night, dry/wet conditions
  - Capture pushback, servicing, and idle scenarios
  - Minimum: 100 hours of raw data → ~50,000 LiDAR sweeps
```

#### Step 2: Annotation and Class Mapping

**nuScenes class mapping to airside**:

| nuScenes Class | Airside Equivalent | Transfer Quality |
|---|---|---|
| car | Staff car, follow-me car | High (similar size/shape) |
| truck | Fuel truck, catering truck | Medium (different proportions) |
| bus | Apron bus | High (similar size) |
| trailer | Baggage dolly (single) | Low (different articulation) |
| construction_vehicle | Cargo loader, de-icer | Low (different geometry) |
| pedestrian | Ramp personnel | High (same class) |
| motorcycle | — | No equivalent |
| bicycle | — | No equivalent |
| barrier | Wheel chock, cone barrier | Medium |
| traffic_cone | Marker cone | High (identical function) |
| — (new) | Aircraft | No source equivalent |
| — (new) | Pushback tug | No source equivalent |
| — (new) | Belt loader | No source equivalent |
| — (new) | Baggage tractor + train | No source equivalent |
| — (new) | Jet bridge | No source equivalent |

**Annotation format**: Convert airside annotations to nuScenes format (JSON with 3D bounding boxes in global coordinates, ego-pose transforms, sensor calibration). Alternatively, convert to KITTI format for broader framework compatibility.

```python
# Example class mapping for mmdetection3d config
class_names = [
    'aircraft', 'pushback_tug', 'baggage_tractor', 'baggage_train',
    'belt_loader', 'cargo_loader', 'fuel_truck', 'catering_truck',
    'apron_bus', 'staff_car', 'personnel', 'cone', 'wheel_chock',
    'jet_bridge', 'ground_power_unit'
]

# Anchor sizes (length, width, height in meters)
anchor_sizes = {
    'aircraft': [40.0, 36.0, 12.0],      # Wide range - may need subclasses
    'pushback_tug': [4.0, 2.0, 2.5],
    'baggage_tractor': [3.5, 1.5, 1.5],
    'baggage_train': [8.0, 1.5, 1.2],    # Multi-dolly chain
    'belt_loader': [8.0, 2.5, 3.0],
    'cargo_loader': [12.0, 3.0, 4.0],
    'fuel_truck': [8.0, 2.5, 3.0],
    'catering_truck': [7.0, 2.5, 4.0],
    'apron_bus': [12.0, 2.5, 3.2],
    'staff_car': [4.5, 1.8, 1.5],
    'personnel': [0.8, 0.6, 1.8],
    'cone': [0.4, 0.4, 0.7],
    'wheel_chock': [0.3, 0.2, 0.2],
    'jet_bridge': [15.0, 3.5, 3.5],
    'ground_power_unit': [2.0, 1.5, 1.5],
}
```

#### Step 3: Format Conversion

**Option A: Convert to nuScenes format**
```python
# Create nuScenes-compatible database
# Required tables: scene, sample, sample_data, sample_annotation,
#                  ego_pose, calibrated_sensor, sensor, log, map

# Key fields per annotation:
{
    "token": "unique_id",
    "sample_token": "frame_id",
    "translation": [x, y, z],      # Global coordinates
    "size": [width, length, height], # Note: nuScenes uses [w, l, h]
    "rotation": [w, x, y, z],       # Quaternion
    "category_name": "pushback_tug",
    "num_lidar_pts": 245,
    "num_radar_pts": 3
}
```

**Option B: Convert to KITTI format** (simpler, supported by more frameworks)
```
# Per-frame label file:
# type truncated occluded alpha bbox_2d(x4) dimensions(h,w,l) location(x,y,z) rotation_y
pushback_tug 0.0 0 -1.57 100 200 300 400 2.5 2.0 4.0 5.0 1.2 20.0 -1.57
```

#### Step 4: Checkpoint Loading and Head Replacement

**mmdetection3d config modification**:
```python
# Load nuScenes pre-trained backbone, discard head weights
load_from = 'checkpoints/centerpoint_nuscenes_pretrained.pth'

model = dict(
    type='CenterPoint',
    pts_voxel_layer=dict(
        max_num_points=20,
        voxel_size=[0.1, 0.1, 0.2],        # May need adjustment for airside
        max_voxels=(60000, 60000),
        point_cloud_range=[-100, -100, -5, 100, 100, 5],  # Larger range for aircraft
    ),
    pts_bbox_head=dict(
        type='CenterHead',
        in_channels=256,
        tasks=[
            dict(num_class=1, class_names=['aircraft']),
            dict(num_class=4, class_names=['pushback_tug', 'baggage_tractor',
                                            'belt_loader', 'cargo_loader']),
            dict(num_class=3, class_names=['fuel_truck', 'catering_truck', 'apron_bus']),
            dict(num_class=1, class_names=['personnel']),
            dict(num_class=3, class_names=['staff_car', 'cone', 'wheel_chock']),
        ],
    ),
)
```

#### Step 5: Training Strategy

**Phase 1: Head warmup** (5 epochs)
- Freeze all backbone layers
- Train only new detection head
- LR: 1e-3 with cosine annealing

**Phase 2: Progressive unfreezing** (20 epochs)
- Unfreeze last 2 backbone blocks
- LR: 1e-4 for unfrozen backbone, 1e-3 for head
- Add airside-specific augmentations (ground-truth paste of GSE objects)

**Phase 3: Full fine-tuning** (10 epochs, if dataset is large enough)
- Unfreeze all layers
- LR: 1e-5 for early backbone, 1e-4 for late backbone, 1e-3 for head
- Strong augmentation: random flip, global rotation, global scaling, ground-truth sampling

#### Step 6: Evaluation

**Metrics**: Use nuScenes Detection Score (NDS) adapted for airside classes:
- mAP at IoU thresholds appropriate for each class size
- ATE (Average Translation Error) — critical for docking precision
- ASE (Average Scale Error)
- AOE (Average Orientation Error)
- AVE (Average Velocity Error) — less critical at slow airside speeds

**Airside-specific metrics**:
- Detection rate within "circle of safety" (15m radius around aircraft)
- Personnel detection recall >99.9% (safety-critical)
- False positive rate on aircraft structural features (wings, engines should not be detected as separate objects)

### 5.3 Voxel Size and Range Considerations

Road-driving models typically use:
- Point cloud range: [-54, -54, -5, 54, 54, 3] meters
- Voxel size: [0.075, 0.075, 0.2] meters

Airside may need:
- Point cloud range: [-100, -100, -5, 100, 100, 10] meters (aircraft tails can reach 12m+)
- Voxel size: [0.1, 0.1, 0.2] or [0.15, 0.15, 0.3] (compensate for larger range with larger voxels)
- This changes the spatial resolution of the BEV feature map — backbone architectures using fixed kernel sizes may need stride adjustments

---

## 6. Transfer for World Models

### 6.1 What Transfers: Physics and Motion Priors

World models learn internal representations of how the physical world evolves. Several aspects transfer well across domains:

**Physics priors that transfer**:
- **Rigid body dynamics**: Objects maintain shape and volume over time — a car doesn't deform, and neither does a baggage tractor
- **Inertial motion**: Objects tend to continue moving in their current direction — applicable at any speed regime
- **Collision avoidance**: The principle that agents avoid collisions is universal
- **Gravity and ground plane**: Objects rest on and move along ground surfaces
- **Occlusion reasoning**: Objects continue to exist when occluded — a universal physical prior

**Motion pattern priors that partially transfer**:
- **Lane-following behavior**: Transfers to airside service road following, but NOT to open apron navigation
- **Pedestrian motion patterns**: Walk speeds, group behavior, path planning around obstacles — these transfer reasonably well from road pedestrians to ramp personnel
- **Vehicle turning dynamics**: Basic Ackermann steering geometry transfers, though articulated baggage trains have fundamentally different kinematics

**Representation learning that transfers**:
- **3D scene reconstruction**: Learned 3D representations (NeRF-style, Gaussian splatting, occupancy grids) encode general geometric understanding
- **Depth estimation**: Monocular/stereo depth priors transfer across domains
- **Optical flow**: Motion field estimation is domain-agnostic

### 6.2 What Does Not Transfer: Domain-Specific Knowledge

**Object-specific knowledge that doesn't transfer**:
- **Object appearance models**: Aircraft, GSE, jet bridges have no visual or geometric equivalent in road datasets
- **Object behavior models**: Pushback procedures, loading/unloading choreography, marshalling sequences are entirely airside-specific
- **Interaction patterns**: The dance of GSE around an aircraft on stand has no road equivalent — multiple vehicles converge on a single point (the aircraft) in a choreographed sequence
- **Traffic rules**: Road traffic rules (stop signs, traffic lights, right-of-way) don't apply; airside has different rules (circle of safety, speed zones, right-of-way for aircraft)

**Scene-level knowledge that doesn't transfer**:
- **Map structure**: Road networks with lanes, intersections, and traffic control don't map to apron/taxiway layouts
- **Semantic context**: "Approaching intersection" triggers different predictions than "approaching aircraft on stand"
- **Event sequences**: Road scenarios (merge, lane change, intersection crossing) vs. airside scenarios (turnaround sequence, pushback, tow-out)

### 6.3 World Model Transfer Strategies

#### 6.3.1 GAIA-1 Style Transfer

GAIA-1 (Wayve, 2023) demonstrates that generative world models can:
- Learn high-level structures and scene dynamics from video
- Generalize beyond training data (e.g., simulating driving off designated roads)
- Understand 3D geometry and causal relationships

**Transfer approach**: Fine-tune a GAIA-1-style model on airside video data:
- The video prediction backbone (learned physical dynamics) transfers
- The action-conditioned generation (ego-vehicle control response) partially transfers
- The scene-specific content (road scenes) does NOT transfer — requires airside fine-tuning

#### 6.3.2 OccWorld Transfer

OccWorld (ECCV 2024) learns 4D occupancy forecasting — predicting future 3D occupancy grids given historical inputs.

**What transfers**:
- The temporal prediction mechanism (how occupancy grids evolve)
- Free-space reasoning (unoccupied regions stay unoccupied unless an object enters)
- Object permanence in occupancy space

**What requires retraining**:
- Semantic occupancy categories (road classes → airside classes)
- Prediction horizons (road: 3s at 30 km/h = 25m; airside: 10s at 10 km/h = 28m — similar distances but different dynamics)
- Spatial resolution (may need coarser voxels to cover larger aircraft footprints)

#### 6.3.3 UniSim for Airside Simulation

UniSim (Waabi, CVPR 2023) creates neural closed-loop sensor simulation from recorded logs:
- Reconstructs static background and dynamic actors as neural feature grids
- Composites them for novel viewpoint synthesis with actor manipulation

**Airside application**:
1. Record airside logs with sensor-equipped vehicle
2. Reconstruct airside scenes as neural feature grids
3. Generate counterfactual scenarios: "What if a pedestrian walked behind the aircraft?" or "What if the pushback tug stopped unexpectedly?"
4. Evaluate AV stack in closed-loop on these safety-critical airside scenarios

**Transfer from road UniSim**: The reconstruction and rendering architecture transfers; the scene content must be retrained on airside data.

### 6.4 Evaluation Methodology for World Model Transfer

**Metric categories**:

1. **Visual fidelity** (for video-based world models):
   - FID/FVD scores computed on airside-specific test set
   - Perceptual similarity to real airside footage

2. **Prediction accuracy**:
   - Occupancy prediction IoU at future timesteps
   - Object trajectory prediction ADE/FDE
   - Semantic occupancy accuracy per airside class

3. **Physical plausibility**:
   - Do predicted trajectories obey kinematic constraints?
   - Do objects maintain constant mass/volume?
   - Are collision physics realistic?

4. **Downstream task performance**:
   - Planning success rate using world model predictions
   - Closed-loop driving score in airside scenarios
   - Safety metric: collision rate in simulated scenarios

5. **Transfer efficiency**:
   - Performance vs. amount of airside fine-tuning data
   - Compare: road-pretrained + airside-finetuned vs. airside-only training
   - Measure: how many airside frames are needed to match X% of fully-supervised performance

### 6.5 Alpamayo and Foundation Model Transfer

NVIDIA Alpamayo provides an open portfolio of reasoning-based VLA models for autonomous driving. Its transfer relevance:

- **Reasoning capability**: Alpamayo's chain-of-thought reasoning ("I see a stopped vehicle, I should slow down") can be adapted to airside reasoning ("I see a belt loader approaching the aircraft, I should yield")
- **Vision-language grounding**: Understanding spatial relationships in natural language transfers across domains
- **Action generation**: The mapping from perception to control is domain-specific and requires fine-tuning on airside driving data
- **Open ecosystem**: The open-source nature enables custom fine-tuning on airside data without vendor lock-in

For airside, Alpamayo's reasoning traces could be adapted:
```
Road: "The traffic light is red. Pedestrian crossing ahead. I should stop."
Airside: "Pushback in progress at stand 42. Marshaller signaling hold.
          I should stop and wait for clearance."
```

---

## 7. Published Results: Non-Road Domain Transfer

### 7.1 Mining Operations

**Most mature non-road AV domain.** Key findings:

**Scale**: As of 2024, 2,080+ autonomous haul trucks are deployed at surface mines globally. Komatsu's 780 autonomous units have moved >10 billion metric tons and traveled >200 million miles.

**Perception approach**: Mining trucks use LiDAR, radar, GPS, and cameras — the same sensor modalities as road AVs. Caterpillar partners with Torc Robotics (a road-driving AV company) for perception system development, explicitly leveraging road-driving expertise for mining applications.

**Transfer techniques documented**:
- **CycleGAN domain transfer**: Researchers leverage public road-driving datasets to facilitate domain transfer of sensor data using CycleGAN. Specifically, they convert mining data collected on sunny days into other weather conditions using style transfer learned from road-driving datasets.
- **Perception architecture reuse**: Mining perception systems use architectures (PointPillars, CenterPoint) originally developed and validated on road datasets (nuScenes, Waymo), then fine-tuned on mine-site data.
- **HD map analogy**: Mine environments include 3D models with semantic information resembling HD maps — main roads, road edges, hanging walls, loading/unloading sites — analogous to road HD maps with lanes, intersections, and zones.

**Key domain differences from road driving**:
- Object types: haul trucks (300+ tons), excavators, dozers, light vehicles
- Terrain: unpaved, graded roads with dust
- Speed: 30-60 km/h on haul roads
- Environment: open pit geometry, ramps, dumps

### 7.2 Warehouse and Logistics (AGV/AMR)

**Transfer approaches**:
- AGVs/AMRs use simpler perception (2D LiDAR, cameras) compared to road AVs
- VisionNav and similar companies employ deep learning for environment perception and servo control
- Transfer from road driving is less common here — warehouse perception is typically trained from scratch due to the controlled indoor environment
- However, pedestrian detection models (YOLO, SSD) trained on road/COCO datasets are commonly fine-tuned for warehouse worker detection

**Relevance to airside**: Limited. Warehouse environments are indoor, structured, and have different sensor configurations. The primary transferable insight is that small, domain-specific datasets (1,000-5,000 images) are sufficient to fine-tune pre-trained detection models for new object types in controlled environments.

### 7.3 Construction Sites

- Construction vehicle detection models have been fine-tuned from COCO-pretrained backbones
- nuScenes includes a "construction_vehicle" class, providing some foundation
- Domain gaps include: unpaved surfaces, irregular terrain, large equipment with articulated arms

### 7.4 Agricultural Autonomy

- Transfer from road driving to agricultural settings has been explored for path planning and obstacle detection
- Sim-to-real transfer using domain randomization has shown promise for off-road environments
- Key finding: physics-based features (terrain modeling, vehicle dynamics) transfer better than appearance-based features

### 7.5 Roadside LiDAR and Infrastructure Perception

While not a vehicle-to-vehicle transfer, the roadside LiDAR domain adaptation literature is relevant:
- Models trained on vehicle-mounted LiDAR (road datasets) perform poorly on infrastructure-mounted LiDAR due to different viewpoint, density, and range characteristics
- This parallels the airside scenario where LiDAR may be mounted on infrastructure (terminal buildings, poles) rather than on vehicles
- Adaptation techniques: viewpoint-aware feature alignment, density normalization, geometric transform

### 7.6 Key Cross-Domain Transfer Results Summary

| Transfer Direction | Method | Key Result |
|---|---|---|
| Waymo→KITTI | ST3D | Surpasses fully supervised KITTI |
| nuScenes→KITTI | ST3D++ | State-of-the-art UDA |
| Waymo→nuScenes | ReSimAD (zero-shot) | Surpasses some UDA baselines without target data |
| Waymo→KITTI | GCFS (5-shot) | 21.03% mAP with novel classes |
| Sim→Real (LiDAR) | Domain randomization | 50% gap without adaptation |
| Road→Mining | CycleGAN + fine-tune | Successful deployment (Caterpillar/Komatsu) |
| Road→Airside | (No published results) | Open research opportunity |

---

## 8. Recommendations for Airside AV Stack

### 8.1 Prioritized Transfer Strategy

Based on the analysis above, the recommended approach for adapting road-driving models to airside operations:

**Phase 1: Bootstrap (Weeks 1-4)**
1. Deploy Grounding DINO 1.5 + SAM on airside cameras for zero-shot GSE detection
2. Generate pseudo-labels for all visible object categories
3. Human review and correction of pseudo-labels (target: 20+ examples per GSE class)
4. Apply test-time adaptation on road-pretrained LiDAR detector during initial data collection

**Phase 2: Initial Fine-tuning (Weeks 5-8)**
1. Train 3D detector using LoRA adapters on road-pretrained backbone
2. Use nuScenes CenterPoint or PV-RCNN checkpoint as initialization
3. Replace detection head with airside-specific classes and anchor sizes
4. Progressive unfreezing: head → last blocks → full backbone
5. Target: 1,000-2,000 annotated LiDAR frames

**Phase 3: Domain-Adapted Training (Weeks 9-16)**
1. Apply ST3D-style self-training with Random Object Scaling
2. Use unlabeled airside data for pseudo-label expansion
3. Statistical normalization for object size alignment
4. DIG method for density/intensity/geometry adaptation
5. Target: 5,000+ annotated frames + 50,000 unlabeled frames

**Phase 4: World Model Training (Months 4-6)**
1. Fine-tune OccWorld-style occupancy prediction on airside data
2. Transfer temporal prediction mechanics from road-pretrained model
3. Retrain semantic categories for airside objects
4. Build UniSim-style neural simulator from recorded airside logs
5. Generate safety-critical counterfactual scenarios for closed-loop evaluation

### 8.2 Expected Performance Trajectory

| Phase | Airside Data | Expected mAP (common classes) | Expected mAP (novel GSE) |
|---|---|---|---|
| Zero-shot (VLM) | 0 labeled | ~35-45% (2D only) | ~20-30% (2D only) |
| LoRA fine-tune | 1,000 frames | ~40-50% (3D) | ~25-35% (3D) |
| Full pipeline | 5,000 frames | ~55-65% (3D) | ~40-50% (3D) |
| Mature system | 20,000+ frames | ~70-80% (3D) | ~60-70% (3D) |

### 8.3 Critical Success Factors

1. **Data quality over quantity**: 1,000 carefully annotated airside frames with diverse GSE types outperform 10,000 poorly annotated frames
2. **Class hierarchy**: Consider hierarchical detection (vehicle → GSE → specific type) to leverage road-driving vehicle detection as an intermediate feature
3. **Safety-critical classes first**: Prioritize personnel and aircraft detection — these have the highest safety impact and benefit most from transfer (personnel ≈ pedestrian, aircraft unique but large/easy to detect)
4. **Sensor matching**: If possible, use similar LiDAR sensors to nuScenes (32-beam Velodyne) to minimize sensor-configuration domain gap, or apply DIG/SN normalization if sensors differ
5. **Continuous learning**: Implement a data flywheel — deployed models flag uncertain detections for human review, expanding the training set organically

### 8.4 Open Research Questions

1. **Articulated object detection**: Baggage trains (tractor + N dollies) are articulated multi-body objects with no road equivalent. How to represent and detect these?
2. **Aircraft sub-structure reasoning**: Should the world model understand aircraft parts (engines, wings, doors) or treat aircraft as monolithic objects?
3. **Turnaround sequence prediction**: Can world models learn the choreographed sequence of GSE servicing an aircraft? This requires long-horizon (30-60 minute) prediction capabilities beyond current world models.
4. **Regulatory acceptance**: What level of transfer learning validation satisfies aviation safety authorities? Is a model partially trained on road data acceptable for safety-critical airside operations?
5. **Multi-agent coordination**: Airside operations involve tightly coordinated multi-agent behavior (multiple GSE servicing one aircraft). Road-driving multi-agent prediction focuses on independent agents — a fundamentally different assumption.

---

## References and Key Resources

### Domain Adaptation for 3D Detection
- ST3D: Self-training for Unsupervised Domain Adaptation on 3D Object Detection (CVPR 2021) — https://arxiv.org/abs/2103.05346
- ReSimAD: Zero-Shot 3D Domain Transfer (ICLR 2024) — https://arxiv.org/abs/2309.05527
- Domain Adaptation for Different Sensor Configurations (2025) — https://arxiv.org/abs/2509.04711
- CMD: Cross Mechanism Domain Adaptation Dataset (ECCV 2024) — https://link.springer.com/chapter/10.1007/978-3-031-72998-0_13
- LiDAR Distillation: Bridging the Beam-Induced Domain Gap (ECCV 2022) — https://github.com/weiyithu/LiDAR-Distillation
- STAL3D: Self-Training and Adversarial Learning (2024) — https://arxiv.org/html/2406.19362v1

### Parameter-Efficient Fine-Tuning
- PEFT-DML: Parameter-Efficient Fine-Tuning for Robust 3D Detection (2024) — https://arxiv.org/abs/2512.00060
- LoGenE: Reward-guided Genetic Evolution of LoRA Adapters — https://link.springer.com/article/10.1007/s12555-025-0541-4
- Point-PEFT: Parameter-Efficient Fine-Tuning for 3D Pre-trained Models — https://arxiv.org/html/2310.03059

### Foundation Models and VLMs
- Grounding DINO (ECCV 2024) — https://github.com/IDEA-Research/GroundingDINO
- Grounded SAM — https://arxiv.org/html/2401.14159v1
- Foundation Models for AD Perception Survey (2025) — https://arxiv.org/html/2509.08302v1
- ContextVLM: Zero/Few-Shot Context Understanding — https://arxiv.org/abs/2409.00301
- GCFS: Cross-Domain Few-Shot 3D Detection (2025) — https://arxiv.org/html/2503.06282v1

### Few-Shot and Meta-Learning
- Meta-Det3D: Learn to Learn Few-Shot 3D Detection (ACCV 2022) — https://link.springer.com/chapter/10.1007/978-3-031-26319-4_15
- Prototypical VoteNet — https://openreview.net/pdf?id=kCTZt0b9DQz
- SSDA3D: Semi-supervised Domain Adaptation (AAAI 2023) — https://ojs.aaai.org/index.php/AAAI/article/view/25370

### World Models
- GAIA-1 (Wayve, 2023) — https://arxiv.org/abs/2309.17080
- OccWorld (ECCV 2024) — https://wzzheng.net/OccWorld/
- UniSim (Waabi, CVPR 2023) — https://arxiv.org/abs/2308.01898
- World Models for AD Survey (2025) — https://arxiv.org/pdf/2501.11260
- TrafficBots — https://arxiv.org/abs/2303.04116

### Airport/Airside Specific
- Detection and Control Framework for Unpiloted GSE (2024) — https://pmc.ncbi.nlm.nih.gov/articles/PMC10781360/
- Airport Ground Vehicles Dataset — https://universe.roboflow.com/airport-gse/airport-ground-vehicles
- FAA Ground Vehicle Operations Advisory Circular — https://www.faa.gov/documentLibrary/media/advisory_circular/150-5210-20/150_5210_20.pdf
- Computer Vision for Airport-Airside Surveillance — https://www.sciencedirect.com/science/article/abs/pii/S0968090X22000365
- TLD Autonomous Baggage Tractor (Velodyne LiDAR) — https://www.autonomousvehicleinternational.com/news/velodyne-lidar-sensors-advance-tlds-autonomous-solutions-for-airports-and-industrial-sites.html

### Non-Road Domain Transfer
- Autonomous Mining Trucks (Caterpillar, Komatsu) — https://im-mining.com/2025/11/07/caterpillar-sets-out-to-hit-over-2000-autonomous-mining-trucks-by-2030/
- Deep Transfer Learning for Intelligent Vehicle Perception Survey — https://www.sciencedirect.com/science/article/pii/S2773153723000610
- Domain Randomization for Sim2Real — https://lilianweng.github.io/posts/2019-05-05-domain-randomization/

### Toolkits and Frameworks
- OpenPCDet — https://github.com/open-mmlab/OpenPCDet
- mmdetection3d — https://mmdetection3d.readthedocs.io/en/latest/
- 3DTrans (Pre-training and Transfer for 3D Detection) — https://github.com/PJLab-ADG/3DTrans
- Awesome 3D Domain Adaptation — https://github.com/ldkong1205/awesome-3d-da

### NVIDIA Alpamayo
- Alpamayo Overview — https://www.nvidia.com/en-us/solutions/autonomous-vehicles/alpamayo/
- Alpamayo Technical Blog — https://developer.nvidia.com/blog/building-autonomous-vehicles-that-reason-with-nvidia-alpamayo/
- Alpamayo GitHub — https://github.com/NVlabs/alpamayo
