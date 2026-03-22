# Open-Vocabulary and Zero-Shot Object Detection for Airport Airside Operations

## Problem Statement

Airport airside environments present a uniquely challenging detection problem. An autonomous vehicle operating on ramps, taxiways, and aprons must reliably detect and classify 30+ types of ground support equipment (GSE), 100+ aircraft variants, ground crew in various roles, and foreign object debris (FOD) -- all in a safety-critical domain where training data is scarce and new object classes appear regularly (new GSE models, airline liveries, seasonal equipment). Traditional closed-set detectors trained on a fixed taxonomy fail when confronted with novel objects. Open-vocabulary detection provides a path to handle this long-tail distribution by leveraging vision-language alignment rather than per-class training data.

This report evaluates the practical landscape of open-vocabulary and zero-shot detection models, their adaptation strategies, and deployment feasibility for airside autonomous vehicle perception.

---

## 1. Grounding DINO

### 1.1 Architecture

Grounding DINO (ECCV 2024) marries the DINO transformer-based detector with grounded pre-training for open-set detection. The architecture has five core components:

**Dual Backbones:**
- **Image backbone**: Swin Transformer (Swin-T at 86M params or Swin-B at 145M params, trained on ImageNet-1k/22k respectively)
- **Text backbone**: BERT-base from HuggingFace (110M params), encoding arbitrary text prompts into token embeddings

**Feature Enhancer (Neck):** Stacks alternating self-attention and cross-attention layers to fuse image and text features early. Each enhancer layer executes:
1. Deformable self-attention on image tokens (multi-scale)
2. Vanilla self-attention on text tokens
3. Image-to-text cross-attention (language tokens read visual cues)
4. Text-to-image cross-attention (image tokens attend to text prompt)

This deep early fusion is the key differentiator from prior methods like GLIP that fuse modalities only in the decoder.

**Language-Guided Query Selection:** Instead of random or learned queries, Grounding DINO selects the top-N (default 900) features from the enhanced image features based on their similarity to text features. This ensures decoder queries are already text-aligned.

**Cross-Modality Decoder (Head):** A 6-layer transformer decoder with:
- Self-attention among queries
- Deformable cross-attention to image features
- Cross-attention to text features
- Each query predicts a box and a text-alignment score (not a fixed class logit)

**Total model sizes:**
- Grounding DINO with Swin-T: ~172M parameters
- Grounding DINO with Swin-B: ~341M parameters

### 1.2 Performance on Novel Objects

| Benchmark | Metric | Score |
|-----------|--------|-------|
| COCO zero-shot transfer | AP | 52.5 |
| LVIS minival (zero-shot) | AP | ~30 |
| ODinW (13 datasets avg) | AP | ~50 |
| ODinW (35 datasets avg) | AP | 26.1 |

The ODinW (Object Detection in the Wild) benchmark is particularly relevant for airside -- it tests zero-shot transfer across 35 diverse domains including aerial imagery, wildlife, manufacturing, and medical imaging. The 26.1 mean AP demonstrates genuine open-set capability but also highlights the gap from supervised performance.

### 1.3 Grounding DINO 1.5 and 1.6

IDEA Research has released improved variants:

**Grounding DINO 1.5 Pro:**
- ViT-L backbone with deep early fusion
- Trained on Grounding-20M (20M+ images with grounding annotations)
- COCO zero-shot: 54.3 AP | LVIS-minival: 55.7 AP | LVIS-val: 47.6 AP
- ODinW35: 30.2 AP average

**Grounding DINO 1.5 Edge:**
- EfficientViT-L1 backbone (optimized for edge deployment)
- Cross-modality fusion limited to P5-level features only
- Vanilla self-attention (replacing deformable attention for TensorRT compatibility)
- COCO (800x1333): 45.0 AP | LVIS-minival: 36.2 AP

**Grounding DINO 1.6 Edge:**
- Removes P3 features, uses P4/P5/P6 only
- Reduces queries from 900 to 300
- FP16 inference support
- COCO: 44.8 AP | LVIS-minival: 34.6 AP
- 40-50% faster than 1.5 Edge on Orin

### 1.4 Inference Speed

| Platform | Model | Resolution | Framework | FPS |
|----------|-------|-----------|-----------|-----|
| A100 | GD 1.5 Edge | 640x640 | PyTorch | 21.7 |
| A100 | GD 1.5 Edge | 640x640 | TensorRT FP32 | 111.6 |
| A100 | GD 1.5 Edge | 800x1333 | TensorRT FP32 | 75.2 |
| Orin NX | GD 1.5 Edge | 640x640 | TensorRT | 10.7 |
| Orin NX | GD 1.6 Edge | 640x640 | TensorRT FP16 | 15.1 |
| Orin NX | GD 1.6 Edge | 800x800 | TensorRT | 14.0 |
| AGX Orin | GD 1.5 Edge | 1080p | JPS Container | 11.8 |
| A100 | GD 1.0 (Swin-B) | 800x1333 | PyTorch | ~7 |

**Key takeaway for airside:** The original Grounding DINO (Swin-B) at ~7 FPS on an A100 is too slow for real-time AV perception. Grounding DINO 1.6 Edge on Orin NX at 14-15 FPS approaches usability for slower airside speeds (15-25 km/h). On AGX Orin (which has 2x the GPU cores vs Orin NX), FP16 performance should reach 20+ FPS, adequate for the speed regime.

### 1.5 Setup

```bash
# Clone and install
git clone https://github.com/IDEA-Research/GroundingDINO.git
cd GroundingDINO
pip install -e .

# Download weights
mkdir weights && cd weights
wget https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha2/groundingdino_swinb_cogcoor.pth

# Inference
python demo/inference_on_a_image.py \
  -c groundingdino/config/GroundingDINO_SwinB_cfg.py \
  -p weights/groundingdino_swinb_cogcoor.pth \
  -i input.jpg \
  -t "pushback tractor . belt loader . fuel truck . ground crew" \
  --box_threshold 0.35 \
  --text_threshold 0.25
```

**Text prompt format:** Categories separated by periods (`.`). Example: `"baggage tug . catering truck . aircraft . person"`. Each sub-phrase is encoded independently by BERT and matched against visual features.

**Threshold tuning:**
- `box_threshold` (default 0.35): Minimum similarity between a query box and any text token to count as a detection. Lower for higher recall on rare objects.
- `text_threshold` (default 0.25): Minimum similarity to assign a class label. Lower values allow more liberal labeling.

For airside safety-critical detection, start with `box_threshold=0.25` and `text_threshold=0.20` to maximize recall, then filter downstream.

### 1.6 DINO-X: The Latest Evolution

DINO-X (November 2024) represents the most capable model in the Grounding DINO family:

- Same encoder-decoder architecture as GD 1.5 but trained on Grounding-100M (100M+ grounding samples)
- Supports text prompts, visual prompts, and prompt-free detection
- **DINO-X Pro**: COCO 56.0 AP, LVIS-minival 59.8 AP, LVIS-val 52.4 AP
- **DINO-X Edge**: LVIS-minival 48.3 AP, LVIS-val 42.0 AP
- LVIS rare classes: 63.3 AP on minival (vs 55.7 for GD 1.5 Pro) -- critical for long-tail GSE detection
- Currently API-only (DDS Cloud API), not available for local deployment

---

## 2. YOLO-World

### 2.1 Architecture

YOLO-World (CVPR 2024, Tencent AI Lab) brings open-vocabulary capability to the YOLO family with three innovations:

**Re-parameterizable Vision-Language Path Aggregation Network (RepVL-PAN):**
- Extends YOLOv8's PAN neck with text-guided feature fusion
- Text-guided CSPLayer uses max-sigmoid attention to inject language embeddings into multi-scale image features
- Image-Pooling Attention generates 3x3 patch tokens for vision-aware text embeddings
- During deployment, text embeddings are re-parameterized into network weights, eliminating the text encoder entirely

**Region-Text Contrastive Loss:**
- Replaces fixed class logits with region-text similarity scores
- Contrastive learning between region features and text embeddings from CLIP text encoder

**Pre-training Strategy:**
- Trained on: Objects365 V1 (609K images), GQA (621K images), Flickr30k (149K images), pseudo-labeled CC3M (246K images, 821K annotations)
- Total: ~1.6M images with diverse grounding annotations

### 2.2 Model Variants and Performance

| Model | Params (w/o text enc) | Params (w/ text enc) | LVIS AP | LVIS APr | LVIS APf | FPS (V100) |
|-------|----------------------|---------------------|---------|----------|----------|------------|
| YOLO-World-S | 13M | 77M | 26.2 | - | - | 74.1 |
| YOLO-World-M | 29M | 92M | 31.0 | - | - | 63.8 |
| YOLO-World-L | 48M | 110M | 35.4 | 27.6 | 38.0 | 52.0 |

**COCO zero-shot transfer (v2 via Ultralytics):**

| Model | mAP | mAP50 | mAP75 |
|-------|-----|-------|-------|
| yolov8s-worldv2 | 37.7 | 52.2 | 41.0 |
| yolov8m-worldv2 | 43.0 | 58.4 | 46.8 |
| yolov8l-worldv2 | 45.8 | 61.3 | 49.8 |
| yolov8x-worldv2 | 47.1 | 62.8 | 51.4 |

### 2.3 Prompt-Then-Detect Paradigm

The critical deployment advantage of YOLO-World: at inference time, the text encoder is removed entirely. Text embeddings for the target vocabulary are pre-computed and baked into the model weights through re-parameterization.

```python
from ultralytics import YOLO

model = YOLO("yolov8l-worldv2.pt")

# Set custom vocabulary (one-time operation)
model.set_classes([
    "pushback tractor", "baggage tug", "belt loader",
    "fuel truck", "catering truck", "ground power unit",
    "aircraft", "person", "cone", "FOD"
])

# Export with baked vocabulary (no text encoder needed at runtime)
model.save("yolo_world_airside.pt")

# Deploy -- runs as a standard YOLO detector
model = YOLO("yolo_world_airside.pt")
results = model.predict("airside_frame.jpg")
```

This means YOLO-World deploys as a **fixed-vocabulary detector** after re-parameterization, running at standard YOLO speeds with zero text encoder overhead.

### 2.4 YOLO-World vs Grounding DINO: Head-to-Head

| Dimension | YOLO-World-L | Grounding DINO (Swin-B) | GD 1.5 Edge |
|-----------|-------------|------------------------|-------------|
| LVIS AP (zero-shot) | 35.4 | ~30 | 36.2 |
| COCO AP (zero-shot) | 45.8 (v2) | 52.5 | 45.0 |
| FPS (V100, PyTorch) | 52.0 | ~7 | 18.5 |
| FPS (Orin NX, TRT) | 25-30* | Not feasible | 10.7-15.1 |
| Params (deploy) | 48M | 341M | ~50M |
| Dynamic prompts | No (re-param) | Yes (runtime) | Yes (runtime) |
| Fine-grained text | Limited | Strong | Moderate |

*YOLO-World FPS on Orin estimated from YOLOv8-L TensorRT benchmarks.

**When to use which:**
- **YOLO-World**: Primary perception path. Fixed vocabulary of known airside objects, real-time requirement, edge deployment. Set vocabulary once, deploy as standard detector.
- **Grounding DINO**: Secondary/safety path. Dynamic prompts for novel object investigation, higher-accuracy verification, offline annotation pipeline, rare event detection.

### 2.5 YOLOE: Next Generation (ICCV 2025)

YOLOE improves on YOLO-World with:
- +3.5 AP over YOLO-World v2 on LVIS with 1/3 training resources
- 1.4x faster inference
- Supports text prompts, visual prompts, and prompt-free modes
- Re-parameterizable to standard YOLO head with zero overhead
- Available via Ultralytics: `YOLO("yoloe-v8l.pt")`

Worth evaluating as a YOLO-World replacement for airside -- better accuracy-speed tradeoff.

---

## 3. SAM / SAM 2 and Grounded-SAM

### 3.1 SAM 2 Architecture

SAM 2 (Meta, August 2024) extends the Segment Anything Model to video:

**Core components:**
- **Image encoder**: Hiera vision transformer for multi-scale feature extraction
- **Prompt encoder**: Encodes points, boxes, masks, or text as input prompts
- **Mask decoder**: Lightweight transformer decoder producing segmentation masks
- **Memory encoder**: Compresses predicted masks and image features into memory tokens
- **Memory attention**: Cross-attends current frame features to memory bank
- **Memory bank**: Stores features from up to N past frames plus any prompted frames

**Performance:**
- Processes ~44 FPS on images (6x faster than SAM 1)
- Outperforms prior methods on 17 zero-shot video segmentation benchmarks
- Requires 3x fewer human interactions for interactive video segmentation
- Trained on SA-V dataset: 50.9K videos, 35.5M masks, 640K+ masklets

### 3.2 Grounded-SAM 2 Pipeline

Grounded-SAM 2 combines Grounding DINO (detection) + SAM 2 (segmentation + tracking):

**Pipeline flow:**
1. Text prompt (e.g., `"pushback tractor . fuel truck . ground crew"`) is fed to Grounding DINO
2. Grounding DINO outputs bounding boxes with text-similarity scores
3. Bounding boxes are passed as box prompts to SAM 2's prompt encoder
4. SAM 2 generates per-pixel segmentation masks for each detected object
5. For video: SAM 2's memory mechanism tracks segmented objects across frames

**Installation:**
```bash
git clone https://github.com/IDEA-Research/Grounded-SAM-2.git
cd Grounded-SAM-2

# Install SAM 2
pip install -e .

# Install Grounding DINO
pip install --no-build-isolation -e grounding_dino

# Download checkpoints
cd checkpoints && bash download_ckpts.sh
cd ../gdino_checkpoints && bash download_ckpts.sh
```

**Requirements:** Python 3.10, PyTorch >= 2.3.1, CUDA 12.1, 6+ GB VRAM.

**Key demo scripts:**
```bash
# Image: detect + segment with text prompt
python grounded_sam2_local_demo.py

# Video: detect + segment + track
python grounded_sam2_tracking_demo.py

# Live camera with continuous ID tracking
python grounded_sam2_tracking_camera_with_continuous_id.py

# High-resolution with SAHI (Sliced Inference)
# Set WITH_SLICE_INFERENCE = True in demo script
```

**Configuration parameters:**
| Parameter | Default | Airside Recommendation |
|-----------|---------|----------------------|
| `TEXT_PROMPT` | varies | See Section 5 |
| `BOX_THRESHOLD` | 0.3 | 0.25 (higher recall) |
| `TEXT_THRESHOLD` | 0.25 | 0.20 (higher recall) |
| `PROMPT_TYPE_FOR_VIDEO` | "mask" | "mask" (most stable) |

### 3.3 Airside Applications of Grounded-SAM

**Pixel-precise safety zones:** Segmentation masks (not just bounding boxes) enable precise distance computation to aircraft fuselage, engine intakes, and control surfaces.

**Training data generation:** Use Grounded-SAM as an auto-labeling pipeline:
1. Run on unlabeled airside video with broad text prompts
2. Export COCO-format annotations (JSON with RLE masks)
3. Human review and correction
4. Train specialized closed-set detectors (YOLOv8-Seg) on corrected labels

**Continuous ID tracking:** The `grounded_sam2_tracking_camera_with_continuous_id.py` script detects new objects throughout the video, assigning persistent IDs -- directly applicable to tracking GSE movement around aircraft.

**Output format (JSON):**
```json
{
  "annotations": [
    {
      "class_name": "pushback tractor",
      "bbox": [x1, y1, x2, y2],
      "segmentation": {"size": [H, W], "counts": "rle_encoded_mask"},
      "score": 0.87
    }
  ]
}
```

### 3.4 Limitation: Latency

The combined Grounded-SAM 2 pipeline (Grounding DINO + SAM 2) runs at approximately 3-5 FPS on an A100 for images, making it unsuitable as the primary real-time perception path. Use it for:
- Offline annotation and dataset generation
- Periodic high-fidelity scene understanding (every Nth frame)
- Safety verification pipeline running in parallel with a faster primary detector

---

## 4. Open-Vocabulary 3D Detection

### 4.1 The Lifting Problem

Airside AVs need 3D detections (position, dimensions, heading) for path planning and collision avoidance. Open-vocabulary detectors produce 2D boxes. Bridging this gap requires either:

1. **Lifting 2D detections to 3D using depth** (LiDAR or stereo)
2. **Native open-vocabulary 3D detectors** operating on point clouds

### 4.2 2D-to-3D Lifting Pipeline

The most practical current approach for airside:

```
Camera Image --> Open-Vocab 2D Detector --> 2D Boxes
                                               |
LiDAR Point Cloud --> Projection (K, T) -------+
                                               |
                                    Frustum Point Selection
                                               |
                                    3D Box Estimation (clustering)
                                               |
                                    3D Detection with Class Label
```

**Step-by-step:**
1. **2D detection**: Run Grounding DINO or YOLO-World on camera images to get 2D bounding boxes with class labels
2. **LiDAR projection**: Project LiDAR points into camera frame using extrinsic (T) and intrinsic (K) calibration matrices
3. **Frustum selection**: For each 2D box, select all LiDAR points whose projections fall within the box, forming a 3D frustum
4. **Point clustering**: Within each frustum, apply DBSCAN or region-growing to isolate the densest point cluster (removing background points)
5. **3D box fitting**: Fit a 3D bounding box to the cluster using extremal coordinates along each axis, or use L-shape fitting for vehicles
6. **Size prior refinement**: Apply known size priors for detected class (e.g., pushback tractor: ~4m x 2.5m x 2.5m) to refine box dimensions

**Advantages:**
- Uses mature, well-tested 2D open-vocab detectors
- LiDAR provides accurate depth without estimation error
- Class labels transfer directly from 2D to 3D
- Can be implemented with standard PCL/Open3D libraries

**Challenges:**
- Requires precise camera-LiDAR calibration
- Objects occluded in camera but visible in LiDAR are missed
- Sparse LiDAR returns on distant objects degrade 3D box quality
- Multi-camera setups needed for 360-degree coverage

### 4.3 OpenSight: Native Open-Vocab LiDAR Detection

OpenSight (ECCV 2024) is the most mature native open-vocabulary framework for LiDAR:

**Pipeline:**
1. Generate 2D boxes for generic (class-agnostic) objects from multi-view camera images
2. Lift 2D boxes to 3D frustums using camera-LiDAR calibration
3. Apply temporal awareness (correlate across consecutive frames to recover missed detections)
4. Apply spatial awareness using LLM-derived size priors for box quality maintenance
5. Train a class-agnostic 3D detector on the enhanced pseudo-labels
6. Project detected 3D boxes back to images, match with Grounding DINO 2D detections
7. Align 3D LiDAR features with 2D image features through contrastive learning
8. Classify using aligned embeddings

**nuScenes results:** 23.5 mAP across all classes (treated as novel), vs 5.7-5.8 mAP for prior methods (OV-3DET, Detic-3D). For comparison, fully supervised methods achieve 57.3 mAP.

### 4.4 Other Open-Vocab 3D Approaches

**OV-3DET:** Uses triplet cross-modal contrastive learning (image, point cloud, text). Trains without 3D annotations. Achieves 3.4-7.1 AP on nuScenes depending on pseudo-LiDAR usage.

**CoDA:** Generates pseudo 3D box labels for novel categories using 3D box geometry priors and 2D semantic open-vocabulary priors. Does not require external 2D detectors at inference time.

**OV-Uni3DETR (ECCV 2024):** Unified 3D detector using cycle-modality propagation between camera, LiDAR, and text. Handles both indoor and outdoor scenes.

**Open 3D World:** BEV-based approach fusing LiDAR BEV features with CLIP text encodings via Max-Sigmoid Attention. Achieves ~0.45 mAP on NuScenes-T with OpenSECOND backbone (76M params, 14 FPS).

### 4.5 Recommended Airside 3D Pipeline

For practical deployment, the 2D-to-3D lifting approach is recommended:

```
Primary path (real-time, 20+ FPS):
  YOLO-World (fixed vocab) --> 2D boxes --> Frustum lifting --> 3D boxes

Secondary path (periodic, 2-5 FPS):
  Grounding DINO 1.6 Edge --> 2D boxes --> Frustum lifting --> 3D boxes
  (with dynamic/expanded text prompts for novel object discovery)

Offline / safety audit:
  Grounded-SAM 2 --> Masks --> Dense 3D reconstruction
```

---

## 5. Airside Prompt Engineering

### 5.1 Text Prompt Design Principles

Grounding DINO's performance is highly sensitive to prompt phrasing. Key principles:

1. **Period-separated categories**: `"pushback tractor . belt loader . fuel truck"`
2. **Specificity over generality**: `"aircraft pushback tractor"` detects better than just `"tractor"` (avoids confusion with farm tractors in training data)
3. **Natural language alignment**: The BERT text encoder was trained on natural language, so prompts that resemble natural descriptions work better than technical codes
4. **Avoid over-long prompts**: BERT has a 256-token limit. With 30+ GSE types, split into multiple inference passes or use the most critical subset
5. **Contextual modifiers**: Add context when disambiguation is needed: `"yellow baggage tug on airport ramp"` vs `"tug"`

### 5.2 GSE Prompt Library

**Aircraft Movement GSE:**
```
aircraft pushback tractor .
aircraft tow tractor .
towbarless pushback tug .
aircraft tow bar .
```

**Baggage and Cargo GSE:**
```
baggage tug .
baggage cart .
baggage dolly .
belt loader .
cargo loader .
container loader .
ULD dolly .
cargo pallet transporter .
forklift .
```

**Servicing GSE:**
```
fuel truck .
fuel hydrant cart .
catering truck .
lavatory service truck .
potable water truck .
ground power unit .
air start unit .
preconditioned air unit .
de-icing truck .
anti-icing vehicle .
```

**Passenger Access:**
```
passenger boarding stairs .
passenger bus .
ambulift .
crew transport van .
```

**Maintenance and Safety:**
```
maintenance platform .
engine cowl stand .
aircraft jack .
wheel chock .
traffic cone .
safety barrier .
fire extinguisher .
```

### 5.3 Aircraft Prompt Strategies

Detecting 100+ aircraft variants is impractical per-variant. Use a hierarchical approach:

**Level 1 -- Generic detection (always):**
```
aircraft . airplane . jet . helicopter .
```

**Level 2 -- Category classification (if needed):**
```
narrow body aircraft .
wide body aircraft .
regional jet .
turboprop aircraft .
business jet .
cargo aircraft .
helicopter .
```

**Level 3 -- Type identification (offline/verification):**
```
Boeing 737 . Airbus A320 . Boeing 777 . Airbus A350 .
Embraer E190 . Bombardier CRJ . ATR 72 . Boeing 747 .
Airbus A380 . Boeing 787 Dreamliner .
```

For real-time operation, Level 1 is sufficient -- the AV needs to know "there is an aircraft there" and its 3D extent, not whether it is a 737-800 or A320neo. Aircraft type identification can be handled by ADS-B data correlation or a specialized classifier running offline.

### 5.4 Personnel Prompt Library

```
ground crew . airport ground worker .
aircraft marshaller with wands .
ramp agent .
baggage handler .
fueling operator .
aircraft mechanic .
pilot in uniform .
airline crew .
airport security officer .
person wearing high visibility vest .
```

**Key insight:** `"person wearing high visibility vest"` is highly effective because Grounding DINO's vision-language alignment strongly associates "high visibility vest" with the visual pattern. This captures most ramp workers regardless of specific role.

### 5.5 FOD Prompt Library

FOD detection is the hardest open-vocab challenge due to the small size and diverse nature of debris:

```
debris on runway .
metal debris .
loose bolt on ground .
wire on pavement .
plastic bag on runway .
tool on ground .
piece of luggage on taxiway .
cone knocked over .
loose panel .
rock on pavement .
```

**Reality check:** Zero-shot FOD detection with current open-vocab models will have poor recall for small objects (< 20px). Grounding DINO's minimum reliable detection size is approximately 32x32 pixels at 800x1333 resolution. For small FOD:
- Use SAHI (Sliced Aided Hyper Inference) to tile high-resolution images into overlapping patches
- Combine with a dedicated small-object detector (e.g., anomaly detection on pavement texture)
- Consider radar or dedicated FOD detection systems (e.g., Tarsier FOD, Moog) for runway operations

### 5.6 Prompt Optimization Workflow

1. **Baseline prompts**: Start with the libraries above
2. **Threshold sweep**: For each prompt, sweep `box_threshold` from 0.15 to 0.55 and `text_threshold` from 0.10 to 0.45 on a validation set
3. **Synonym testing**: Test multiple phrasings (e.g., `"baggage tug"` vs `"luggage tractor"` vs `"airport tow vehicle"`) and keep the highest-AP variant
4. **Negative prompts**: If false positives are an issue (e.g., detecting parked cars as "tug"), add disambiguation: `"yellow airport baggage tug"`
5. **Prompt batching**: Group related prompts to stay within BERT's 256-token limit. For 30+ GSE types, use 3-4 inference passes with different prompt groups
6. **Per-prompt threshold**: Different object types may need different thresholds. Large, distinct objects (aircraft, pushback tractor) tolerate higher thresholds; small, ambiguous objects (cones, chocks) need lower thresholds

---

## 6. Few-Shot Adaptation

### 6.1 Why Few-Shot Matters for Airside

Zero-shot performance on airside-specific objects will be limited because:
- Many GSE types (preconditioned air units, lavatory trucks) are underrepresented in web-scale training data
- Airport-specific visual contexts (ramp markings, jetway geometry) differ from training distributions
- Safety requirements demand higher precision than zero-shot can deliver

Few-shot adaptation bridges the gap with minimal labeled data.

### 6.2 Approach 1: Text Embedding Fine-Tuning

From the agricultural domain adaptation paper (April 2025), the most efficient approach:

**Method:** Remove BERT text encoder entirely. Replace with randomly initialized trainable text embeddings (768-dimensional vectors, one per class). Keep all other Grounding DINO parameters frozen. Only a few thousand parameters are trained.

**Training configuration:**
- Images per class: 4-24 (optimal at 16-24)
- Total training: 400 iterations
- Learning rate: 2.0 with cosine decay
- Optimizer: AdamW
- Batch size: 4
- Loss: Focal (weight 1) + L1 (weight 5) + GIoU (weight 2)

**Results:**
| Dataset | Zero-shot mAP | Few-shot mAP (16 images) | Improvement |
|---------|--------------|-------------------------|-------------|
| Crop-Weed | 10.5 | 43.0 | 4.1x |
| Wheat Head | 10.2 | 40.1 | 3.9x |
| Remote Sensing | - | 40.0 (3-shot) | +8.3 over SOTA |

**Airside projection:** If zero-shot mAP on airside GSE is ~15-20% (estimated from ODinW cross-domain performance), few-shot adaptation with 16-24 images per class could push to 45-55% mAP. With 30 GSE classes, this requires only 480-720 labeled images total.

### 6.3 Approach 2: LoRA Fine-Tuning (PLG-DINO)

PLG-DINO demonstrates LoRA adaptation for industrial defect detection:

**Method:** Insert LoRA modules into self-attention and cross-attention layers of Grounding DINO's feature enhancer and decoder. Combine with soft prompt learning (learnable text prefix tokens).

**Key properties:**
- Trains < 2% of total parameters
- LoRA modules are merged into base weights at inference (zero overhead)
- Particularly effective for domains with complex textures and low contrast (similar to airside pavement scenes)
- Outperforms full fine-tuning when data is limited (< 100 images per class)
- Outperforms vision-only detectors in detection accuracy across diverse categories

### 6.4 Approach 3: Full Fine-Tuning via NVIDIA TAO

NVIDIA TAO Toolkit provides the most production-ready fine-tuning pipeline:

**Dataset format:** COCO JSON for validation, ODVG (JSONL) for training. Category IDs must be contiguous starting from 0.

**Training spec:**
```yaml
model:
  backbone: swin_tiny_224_1k  # or swin_base_224_22k
  num_queries: 900
  max_text_len: 256

train:
  num_epochs: 30
  batch_size: 4
  optimizer:
    type: AdamW
    lr: 0.0002
    lr_backbone: 2e-05
    weight_decay: 0.0001
  scheduler: MultiStep
  precision: bf16
  activation_checkpoint: true  # saves GPU memory

dataset:
  augmentation:
    fixed_padding: true  # stabilizes CPU memory
  dataset_type: serialized  # shares annotations across workers
```

**Hardware:** V100/A100 with >= 15GB VRAM. For bf16 training with activation checkpointing, a single A100-40GB is sufficient for batch_size=4.

**Export to TensorRT:**
```bash
# Export to ONNX
tao model grounding_dino export -e spec.yaml

# Build TensorRT engine
tao deploy grounding_dino gen_trt_engine \
  -e spec.yaml \
  gen_trt_engine.onnx_file=model.onnx \
  gen_trt_engine.trt_engine=model.engine \
  gen_trt_engine.tensorrt.data_type=FP16
```

Supported precisions: FP32, FP16 (no INT8 for Grounding DINO via TAO currently).

### 6.5 Data Requirements Summary

| Adaptation Method | Images per Class | Total (30 classes) | Expected mAP Gain | Training Time |
|------------------|-----------------|-------------------|-------------------|---------------|
| Text embedding only | 16-24 | 480-720 | +25-35 AP over zero-shot | ~30 min (1 GPU) |
| LoRA (rank 8-16) | 20-50 | 600-1500 | +20-30 AP over zero-shot | ~2 hours (1 GPU) |
| Full fine-tune (TAO) | 50-200 | 1500-6000 | +30-40 AP over zero-shot | ~8 hours (1 A100) |
| YOLO-World custom vocab | 100-500 | 3000-15000 | +15-25 AP over zero-shot | ~4 hours (1 A100) |

**Recommended strategy for airside:**
1. Start with text embedding fine-tuning (fastest, cheapest, minimal data)
2. If insufficient, add LoRA on attention layers
3. Use Grounded-SAM as auto-labeler to build larger dataset for full fine-tuning
4. Fine-tune YOLO-World separately for the real-time deployment path

### 6.6 Supervised Prompt Tuning (SPT)

Grounding DINO 1.6 introduces Supervised Prompt Tuning (SPT), where prompts are optimized jointly with a small amount of supervised data. SPT particularly shines when training samples are extremely scarce (< 10 per class), consistently outperforming few-shot fine-tuning approaches. This is the recommended starting point for airside adaptation with minimal data collection effort.

---

## 7. Deployment

### 7.1 TensorRT Optimization

**Grounding DINO (via NVIDIA TAO):**
```bash
# 1. Export ONNX from TAO
tao model grounding_dino export \
  -e spec.yaml \
  export.onnx_file=gdino.onnx \
  export.input_width=640 \
  export.input_height=640

# 2. Build TensorRT engine
tao deploy grounding_dino gen_trt_engine \
  -e spec.yaml \
  gen_trt_engine.onnx_file=gdino.onnx \
  gen_trt_engine.trt_engine=gdino.engine \
  gen_trt_engine.tensorrt.data_type=FP16 \
  gen_trt_engine.tensorrt.workspace_size=1024
```

Note: Grounding DINO 1.5/1.6 Edge specifically replaced deformable attention with vanilla self-attention for TensorRT compatibility. The original Grounding DINO has known TensorRT export issues due to the custom deformable attention operator.

**YOLO-World (via Ultralytics):**
```python
from ultralytics import YOLO

model = YOLO("yolov8l-worldv2.pt")
model.set_classes(["pushback tractor", "baggage tug", ...])

# Export to TensorRT (one command)
model.export(format="engine", half=True, device=0)

# Load and run TensorRT engine
trt_model = YOLO("yolov8l-worldv2.engine")
results = trt_model.predict("frame.jpg")
```

Only worldv2 variants support export. V1 models do not.

### 7.2 Jetson Orin Feasibility

**AGX Orin (64GB, 2048 CUDA cores, 275 TOPS INT8):**

| Model | Resolution | Precision | Expected FPS | Memory |
|-------|-----------|-----------|-------------|--------|
| YOLO-World-L (TRT) | 640x640 | FP16 | 25-35 | ~2 GB |
| YOLO-World-S (TRT) | 640x640 | FP16 | 50-70 | ~1 GB |
| GD 1.6 Edge (TRT) | 640x640 | FP16 | 20-25 | ~3 GB |
| GD 1.6 Edge (TRT) | 800x800 | FP16 | 15-20 | ~4 GB |
| SAM 2 (image only) | 1024x1024 | FP16 | 8-12 | ~4 GB |

**Orin NX (16GB, 1024 CUDA cores, 100 TOPS INT8):**

| Model | Resolution | Precision | Expected FPS | Memory |
|-------|-----------|-----------|-------------|--------|
| YOLO-World-L (TRT) | 640x640 | FP16 | 15-20 | ~2 GB |
| YOLO-World-S (TRT) | 640x640 | FP16 | 30-45 | ~1 GB |
| GD 1.6 Edge (TRT) | 640x640 | FP16 | 15.1 | ~3 GB |

**Recommendation for airside AV on AGX Orin:**
- Run YOLO-World-L (TRT, FP16) as primary detector at 25-35 FPS on 640x640
- Run GD 1.6 Edge on every 5th frame (effective 4-5 FPS) for novel object scanning
- Total GPU memory: ~5-6 GB, leaving ~58 GB for world model, planning, and other perception tasks

### 7.3 Multi-Model Architecture on Orin

```
┌─────────────────────────────────────────────────────────┐
│                    AGX Orin (64GB)                       │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  Camera Stream    │    │  LiDAR Stream    │          │
│  │  (30 FPS)        │    │  (10-20 Hz)      │          │
│  └────────┬─────────┘    └────────┬─────────┘          │
│           │                       │                     │
│  ┌────────▼─────────┐            │                     │
│  │ YOLO-World TRT   │            │                     │
│  │ (25-35 FPS)      │            │                     │
│  │ Fixed airside     │            │                     │
│  │ vocabulary        │◄───────────┘                     │
│  └────────┬─────────┘    Frustum                       │
│           │              Lifting                        │
│  ┌────────▼─────────┐                                  │
│  │ 3D Detections    │                                  │
│  │ + Tracking       │                                  │
│  └────────┬─────────┘                                  │
│           │                                             │
│  ┌────────▼─────────┐    ┌──────────────────┐          │
│  │ Every 5th frame: │    │  World Model      │          │
│  │ GD 1.6 Edge      │───►│  BEV Encoding    │          │
│  │ (novel objects)   │    │  OccWorld        │          │
│  └──────────────────┘    └──────────────────┘          │
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │ Offline (on-demand):                      │          │
│  │ Grounded-SAM 2 for annotation/audit       │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### 7.4 ROS 2 Integration

**NVIDIA Jetson Platform Services (JPS):**
NVIDIA provides a containerized Grounding DINO service for Jetson:
```bash
# Pull and run the JPS container
docker run -d --runtime nvidia \
  -p 8000:8000 \
  -v /output:/ds_microservices/output \
  nvcr.io/nvidia/jps/jps-gdino:ds7.1-public-12-11-1

# API inference
curl -X POST http://localhost:8000/inference \
  -H "Content-Type: application/json" \
  -d '{"model": "Grounding-Dino",
       "prompt": "pushback tractor . fuel truck . person",
       "threshold": 0.35,
       "media": {"id": "asset_id"}}'
```
The service runs as a REST API. For ROS 2 integration, write a thin ROS 2 node that subscribes to image topics and calls this API.

**ROS 2 NanoOWL (NVIDIA):**
For a more integrated ROS 2 solution, NVIDIA provides `ROS2-NanoOWL`, a ROS 2 node for open-vocabulary detection using NanoOWL (TensorRT-optimized OWL-ViT). This runs real-time on Jetson Orin and publishes detection messages directly to ROS 2 topics.

**Custom ROS 2 node pattern:**
```python
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from vision_msgs.msg import Detection2DArray, Detection2D
from cv_bridge import CvBridge
from ultralytics import YOLO

class OpenVocabDetector(Node):
    def __init__(self):
        super().__init__('open_vocab_detector')
        self.model = YOLO("yolo_world_airside.engine")  # TRT engine
        self.bridge = CvBridge()

        self.sub = self.create_subscription(
            Image, '/camera/image_raw', self.detect_cb, 10)
        self.pub = self.create_publisher(
            Detection2DArray, '/detections', 10)

    def detect_cb(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, 'bgr8')
        results = self.model.predict(frame, verbose=False)
        det_array = self._to_ros_msg(results, msg.header)
        self.pub.publish(det_array)
```

**OpenNav ROS 2 pipeline:**
Academic work has demonstrated a complete ROS 2 pipeline combining Grounding DINO Swin-T for 2D detection with 3D reconstruction on Jetson Orin Nano, providing an open-vocabulary 3D detection capability within the ROS 2 ecosystem.

### 7.5 Latency Budget for Airside AV

At airside operating speeds of 15-25 km/h (4-7 m/s):

| Speed | Latency | Distance Traveled |
|-------|---------|-------------------|
| 15 km/h | 33 ms (30 FPS) | 0.14 m |
| 15 km/h | 100 ms (10 FPS) | 0.42 m |
| 25 km/h | 33 ms (30 FPS) | 0.23 m |
| 25 km/h | 100 ms (10 FPS) | 0.69 m |

At 25 km/h with 100ms perception latency, the vehicle travels 0.69m before reacting. For a 3m safety margin to the nearest object (typical airside requirement), this is acceptable. The primary YOLO-World path at 25-35 FPS (~30-40ms) provides excellent latency characteristics.

For the secondary Grounding DINO path at 4-5 effective FPS, the ~200ms latency is acceptable because its purpose is novel object discovery (not collision avoidance), and its detections are fused with the faster primary path.

### 7.6 End-to-End Latency Breakdown (AGX Orin, YOLO-World-L)

| Stage | Latency |
|-------|---------|
| Camera capture + ISP | ~5 ms |
| Pre-processing (resize, normalize) | ~2 ms |
| YOLO-World TRT inference | ~30 ms |
| NMS post-processing | ~2 ms |
| LiDAR frustum lifting | ~5 ms |
| 3D box fitting | ~3 ms |
| ROS 2 message serialization | ~1 ms |
| **Total** | **~48 ms** |

This provides ~21 FPS end-to-end including the full 2D-to-3D pipeline, well within requirements.

---

## Summary: Recommended Airside Open-Vocab Detection Stack

| Component | Model | Role | Hardware | FPS |
|-----------|-------|------|----------|-----|
| Primary detector | YOLO-World-L v2 (TRT, FP16) | Real-time detection of known GSE, aircraft, personnel | AGX Orin | 25-35 |
| Novel object scanner | GD 1.6 Edge (TRT, FP16) | Periodic scan for unexpected objects | AGX Orin | 4-5 (every 5th frame) |
| 3D lifting | Frustum projection + DBSCAN | Convert 2D boxes to 3D using LiDAR | AGX Orin CPU | 10-20 ms/frame |
| Auto-labeling | Grounded-SAM 2 | Generate training data from raw video | A100 (offline) | 3-5 |
| FOD detection | Anomaly detector + SAHI | Specialized small-object pipeline | AGX Orin | 10-15 |
| Adaptation | Text embedding fine-tuning | Adapt to new GSE/aircraft with 16-24 images | Any GPU (training) | N/A |

**Data collection priority:**
1. Collect 20 images per class for the 30 most common GSE types (600 images total)
2. Fine-tune text embeddings on this dataset (~30 min training)
3. Deploy and collect more data via auto-labeling (Grounded-SAM)
4. Iterate: fine-tune YOLO-World on expanded dataset for the primary path
5. Keep Grounding DINO on secondary path for open-ended novel detection

This architecture provides defense-in-depth: the fast primary path handles known objects at real-time rates, while the slower secondary path continuously scans for novel objects that the fixed-vocabulary detector would miss.
