# DetAny3D

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "DetAny3D is rated for open-world perception, annotation leverage, and long-tail validation workflows."
method-priority:end -->

## What It Is

- DetAny3D is a promptable monocular 3D detection foundation model.
- The paper title is "Detect Anything 3D in the Wild".
- It aims to detect novel 3D objects under arbitrary camera configurations from a single RGB image.
- It supports prompt-driven detection rather than a fixed closed-set class head.
- The official repository is released by OpenDriveLab and labels the work as ICCV 2025.
- The method is designed to transfer broad 2D foundation-model knowledge into 3D detection.
- The motivating use case is rare-object and open-world 3D detection when annotated 3D data is scarce.

## Core Technical Idea

- Use extensively pretrained 2D foundation models to compensate for limited 3D annotations.
- Embed the image with complementary 2D models that capture low-level promptable detail and high-level geometry.
- Align heterogeneous 2D features through a 2D Aggregator.
- Convert the fused representation into 3D detection outputs through a 3D Interpreter.
- Use Zero-Embedding Mapping to reduce catastrophic forgetting during 2D-to-3D transfer.
- Accept box, point, text, and optional intrinsic prompts to specify target objects and camera geometry.
- Train on a unified multi-dataset 3D detection corpus rather than a single benchmark.

## Inputs and Outputs

- Inputs are monocular RGB images.
- Optional prompts include 2D boxes, points, text prompts, and camera intrinsics.
- If intrinsics are missing, the model can estimate them and produce calibrated detections.
- Depth files are used in parts of the training setup but are not required for basic inference in the repository.
- Outputs are 3D bounding boxes and associated detection scores for prompted objects.
- Outputs can be evaluated in Omni3D-style or OVMono3D-style 3D detection protocols.

## Architecture or Evaluation Protocol

- The paper describes SAM as the low-level promptable visual backbone.
- It uses depth-pretrained DINO-style features for geometric knowledge.
- The 2D Aggregator hierarchically aligns low-level and high-level 2D features with cross-attention.
- The 3D Interpreter maps the aggregated 2D features into 3D box predictions.
- Zero-Embedding Mapping is used to preserve useful 2D priors while learning 3D-specific representations.
- Evaluation separates in-domain, novel-category, and novel-camera-configuration performance.
- Prompt strategies include Grounding DINO prompts, ground-truth prompts, and detector-generated prompts.

## Training and Evaluation

- The paper builds DA3D, a unified training setup aggregating 16 diverse datasets.
- Datasets referenced in the paper and repo include KITTI, nuScenes, Waymo, Cityscapes3D, 3RScan, Hypersim, Objectron, ARKitScenes, SUN RGB-D, and depth/intrinsic sources.
- Training standardizes monocular images, camera intrinsics, 3D boxes, and depth maps.
- The repository reports full code, training scripts, inference scripts, and released model weights.
- The authors report state-of-the-art performance on unseen categories and novel camera configurations.
- The repo notes that zero-shot evaluation still requires manual integration with external evaluation scripts in some cases.

## Strengths

- Directly addresses arbitrary camera configuration, a common weakness of monocular 3D detectors.
- Prompt support makes it useful with upstream 2D open-vocabulary detectors.
- The feature-transfer design leverages mature 2D foundation models rather than requiring massive native 3D labels.
- The multi-dataset DA3D setup improves coverage of indoor, outdoor, driving, and object-centric scenes.
- Optional intrinsics handling makes it more flexible for mixed camera fleets.
- Official code and weights reduce the barrier to reproduction and fine-tuning.

## Failure Modes

- Monocular depth and scale remain brittle when camera geometry is wrong or visually ambiguous.
- Prompt quality strongly controls output quality; weak text or noisy 2D boxes propagate into 3D boxes.
- The official repo still lists conversion and evaluation simplification tasks as in progress.
- Training is compute-intensive and depends on many third-party datasets and checkpoints.
- Foundation-model biases may underrepresent airport-specific equipment and unusual materials.
- It is a detector, not a tracker or occupancy safety layer.

## Airside AV Fit

- DetAny3D is relevant for rare equipment detection from apron cameras where fixed taxonomies miss objects.
- Arbitrary-camera handling matters for mixed vehicle cameras, fixed stand cameras, and temporary sensors.
- Prompted 3D boxes can help bootstrap labels for chocks, tow bars, ULDs, dollies, cones, and belt loaders.
- Runtime airside use would need measured latency, calibration stability, and failure detection.
- It should be fused with LiDAR/radar obstacle layers before being trusted for vehicle motion decisions.
- The best near-term use is offline data mining and human-in-the-loop annotation of open-world objects.

## Implementation Notes

- Install and version third-party dependencies such as SAM, UniDepth, Grounding DINO, and DINO checkpoints explicitly.
- Keep a prompt provenance field for every detection so reviewers know whether a box came from text, point, or 2D detector input.
- Prefer real camera intrinsics where available; treat predicted intrinsics as a fallback.
- Validate on airport-specific camera heights and lens fields of view before any transfer claims.
- Run separate tests for novel categories and novel camera configurations because they stress different model assumptions.
- If used for dataset creation, require human verification of 3D size, orientation, and ground contact.

## Sources

- arXiv paper: https://arxiv.org/abs/2504.07958
- Official GitHub repository: https://github.com/OpenDriveLab/DetAny3D
- ICCV 2025 CVF paper PDF: https://openaccess.thecvf.com/content/ICCV2025/papers/Zhang_Detect_Anything_3D_in_the_Wild_ICCV_2025_paper.pdf
- ICCV 2025 supplemental PDF: https://openaccess.thecvf.com/content/ICCV2025/supplemental/Zhang_Detect_Anything_3D_ICCV_2025_supplemental.pdf
