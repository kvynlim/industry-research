# WildDet3D

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "validation", "road-av"]
  reason: "WildDet3D is rated as a supporting perception method for autonomy-stack triage and follow-up reading."
method-priority:end -->

## What It Is

- WildDet3D is a promptable monocular 3D object detection model for in-the-wild images.
- It predicts metric 3D boxes from a single RGB image and can use optional depth or camera intrinsics.
- The method supports text prompts, point prompts, and 2D box prompts.
- It is open-vocabulary in the sense that prompts can specify categories outside narrow 3D detection taxonomies.
- The paper also introduces WildDet3D-Data and WildDet3D-Bench.
- WildDet3D-Data is described as over 1M images across 13.5K categories.
- The model targets spatial intelligence use cases such as robotics, AR, and open-world perception.

## Core Technical Idea

- Unify promptable 2D object localization with monocular 3D box regression.
- Use strong pretrained visual backbones for semantic features and depth/geometric features.
- Allow optional depth signals at inference time to resolve monocular scale ambiguity.
- Convert different prompt types into a shared prompt representation for the detector.
- Predict 2D localization, 3D box geometry, depth-related quantities, and confidence jointly.
- Scale open-world training by generating 3D boxes from existing 2D annotations and human verification.
- Evaluate both prompt flexibility and zero-shot geometry transfer.

## Inputs and Outputs

- Inputs include an RGB image plus one or more prompts: text, point, or box.
- Camera intrinsics can be supplied; if missing, the model can estimate intrinsics internally.
- Optional sparse or dense depth can be fused to improve metric 3D localization.
- Outputs include 2D boxes, 3D bounding boxes, depth maps, and predicted intrinsics.
- The 3D box output contains position, dimensions, and orientation in camera-centric coordinates.
- Scores combine 2D objectness and 3D confidence.

## Architecture or Evaluation Protocol

- The public model card describes a SAM 3 ViT backbone for visual features.
- A depth backend based on LingBot-Depth and DINOv2-style features supplies geometric latents.
- A depth fusion module injects depth information into visual features without destabilizing pretrained features.
- The promptable detector encodes text prompts and geometric prompts into a unified sequence.
- The 3D head uses camera geometry, depth latents, and decoder features to regress 3D boxes.
- The paper normalizes box orientation to reduce ambiguity for symmetric boxes.
- Evaluation uses WildDet3D-Bench, Omni3D, Argoverse 2, ScanNet, and depth-augmented settings.

## Training and Evaluation

- WildDet3D-Data is built by generating candidate 3D boxes from 2D annotations and retaining human-verified boxes.
- The paper reports 22.6 AP3D with text prompts and 24.8 AP3D with box prompts on WildDet3D-Bench.
- On Omni3D, it reports 34.2 AP3D with text prompts and 36.4 AP3D with box prompts.
- In zero-shot evaluation, it reports 40.3 ODS on Argoverse 2 and 48.9 ODS on ScanNet.
- Adding depth cues at inference gives a reported average gain of 20.7 AP across settings.
- The model card reports about 1.2B parameters, so training and inference are compute-heavy.

## Strengths

- Handles multiple interaction modes in one 3D detector.
- Can exploit real depth when available, but does not require it for every image.
- The large, diverse data pipeline directly attacks the long-tail 3D annotation bottleneck.
- Text and box prompts make it compatible with open-vocabulary 2D detectors and human review tools.
- Intrinsics prediction helps with web or ad hoc imagery where camera metadata is missing.
- Strong zero-shot results indicate useful transfer beyond the training domain.

## Failure Modes

- Monocular 3D remains sensitive to scale, camera pitch, and object truncation when depth is absent.
- Optional depth improves accuracy, so camera-only performance may not meet safety margins.
- Text prompts can match visually similar but operationally distinct objects.
- The system is heavy for edge deployment without distillation or batching.
- Single-image inference does not enforce temporal consistency.
- Licensing and dependency constraints around foundation-model weights must be checked before production use.

## Airside AV Fit

- WildDet3D is promising for operator-assisted labeling of rare apron objects from camera footage.
- Text and box prompts can bootstrap 3D annotations for equipment not present in closed-set driving datasets.
- The optional depth path maps well to camera-plus-LiDAR airside vehicles.
- It should be validated on aircraft-scale scenes, low-profile equipment, night glare, rain, and reflective surfaces.
- It is less directly suited to hard real-time safety perception until latency and calibration behavior are measured.
- A practical airside stack would use WildDet3D as an offline mining or assisted-perception module first.

## Implementation Notes

- Provide calibrated intrinsics and sparse LiDAR depth whenever possible; do not rely on intrinsics prediction in safety runs.
- Normalize prompts with airport-specific synonyms such as "baggage cart", "dolly", and "ULD cart".
- Store the prompt text, prompt type, depth availability, and camera metadata with each prediction for auditability.
- Add temporal smoothing or tracker association if outputs feed runtime obstacle reasoning.
- Benchmark separately for prompt modes; box-prompt success does not imply text-prompt success.
- Use it to generate candidate labels, then require human or rule-based verification before training production detectors.

## Sources

- arXiv paper: https://arxiv.org/abs/2604.08626
- Official GitHub repository: https://github.com/allenai/WildDet3D
- Hugging Face model card: https://huggingface.co/allenai/WildDet3D
- Hugging Face dataset page: https://huggingface.co/datasets/allenai/WildDet3D-Data
