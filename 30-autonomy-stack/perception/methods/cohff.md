# CoHFF

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "prototype"
  tags: ["perception", "road-av", "validation", "data-engine"]
  reason: "CoHFF is rated for cooperative perception and infrastructure-assisted sensing evaluation."
method-priority:end -->

## What It Is

CoHFF is a CVPR 2024 method for collaborative semantic occupancy prediction in connected autonomous driving.

The name refers to collaborative hybrid feature fusion.

It is a method paper, not only a dataset.

The task is semantic occupancy: predict which 3D voxels are occupied and assign semantic classes.

CoHFF is notable because it studies camera-based collaborative occupancy, not only LiDAR-based cooperative detection.

## Core Technical Idea

CoHFF fuses two kinds of information:

- Task-level features from occupancy and semantic segmentation branches.
- V2X features shared between cooperative vehicles.

The method tries to solve two problems at once.

First, a single vehicle's camera view has depth uncertainty and occlusion.

Second, direct sharing of dense 3D occupancy features is too expensive.

CoHFF therefore compresses and exchanges lower-dimensional hybrid features, then reconstructs a richer occupancy representation after fusion.

The paper reports a major communication reduction by using orthogonal plane features instead of sending the full dense voxel feature tensor.

## Inputs and Outputs

Inputs:

- Multi-camera images from connected vehicles.
- Ego and cooperative vehicle poses.
- Camera calibration.
- Cooperative feature messages.
- Semantic occupancy labels during training.

Outputs:

- 3D semantic occupancy grids.
- Occupancy probabilities per voxel.
- Semantic class predictions per occupied voxel.
- Optional downstream object-detection features.

The original benchmark uses road-driving semantic classes from a simulation-derived cooperative dataset.

## Architecture or Benchmark Protocol

The CoHFF pipeline includes:

- Image backbone and neck for camera feature extraction.
- Depth-aware lifting into 3D or BEV-style representations.
- Occupancy prediction task branch.
- Semantic segmentation task branch.
- Task feature fusion.
- V2X feature fusion across cooperative agents.
- Decoder for semantic occupancy prediction.

The official code is built on OpenCOOD and extends OPV2V-style cooperative simulation with semantic occupancy labels.

The benchmark evaluates collaborative semantic occupancy rather than only 3D object boxes.

## Training and Evaluation

Training uses simulated connected-driving data with generated semantic occupancy labels.

Evaluation reports occupancy and semantic metrics such as IoU and mean IoU.

The paper also studies downstream 3D object detection to show whether occupancy features improve detection.

Important comparisons:

- Single-vehicle camera occupancy.
- Cooperative camera occupancy.
- Different feature-fusion designs.
- Communication cost versus occupancy quality.

The paper reports large accuracy gains from collaboration and a large feature-size reduction compared with dense feature transmission.

## Strengths

- Moves cooperative perception beyond bounding boxes into semantic occupancy.
- Camera-based design is useful where LiDAR coverage is limited or expensive.
- Hybrid fusion explicitly combines task and V2X information.
- Communication-aware feature design is more deployable than dense voxel sharing.
- OpenCOOD integration makes it easier to compare with cooperative perception baselines.
- Occupancy outputs are planner-friendly.

## Failure Modes

- The original evaluation is simulation-heavy.
- Camera depth errors can produce false occupied or free voxels.
- Semantic occupancy labels generated from simulation may not match real sensor noise.
- Cooperative camera overlap may be limited in real traffic or airport stands.
- Calibration and pose errors can smear voxel occupancy.
- Semantic classes are not airport-specific.
- Occupancy IoU can look good while rare safety-critical actors are missed.

## Airside AV Fit

CoHFF is useful for thinking about collaborative airport occupancy grids.

Airside autonomy often needs free-space and occupancy state more than public-road lane semantics.

Potential transfer:

- Shared semantic occupancy around an aircraft stand.
- Camera-assisted occupancy under equipment occlusion.
- Infrastructure-to-vehicle occupancy hints from fixed cameras.
- Planner inputs that represent unknown, free, occupied, and class-tagged voxels.

Direct deployment would require real airport occupancy labels, careful privacy controls for cameras, and airport-specific classes such as worker, cone, tug, belt loader, aircraft, dolly, fuel truck, and FOD candidate.

## Implementation Notes

- Start from the official CoHFF OpenCOOD code and reproduce the OPV2V semantic occupancy result.
- Keep communication size as a logged metric for every experiment.
- Add unknown-space handling; airport safety cases should distinguish free from unobserved.
- Validate occupancy near thin objects such as cones, tow bars, chocks, and workers.
- For airside transfer, use LiDAR accumulation or surveyed infrastructure sensors to generate occupancy supervision.
- Evaluate planner impact, not only voxel IoU.

## Sources

- CVPR 2024 paper: https://openaccess.thecvf.com/content/CVPR2024/html/Song_Collaborative_Semantic_Occupancy_Prediction_with_Hybrid_Feature_Fusion_in_Connected_CVPR_2024_paper.html
- CVPR 2024 PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Song_Collaborative_Semantic_Occupancy_Prediction_with_Hybrid_Feature_Fusion_in_Connected_CVPR_2024_paper.pdf
- Official GitHub: https://github.com/rruisong/CoHFF
