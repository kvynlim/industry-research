# GaussianFormer

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method"
  stage: "frontier"
  maturity: "research"
  tags: ["perception", "simulation", "validation", "road-av"]
  reason: "GaussianFormer is rated for neural scene representation learning and simulation-oriented perception research."
method-priority:end -->

## What It Is

- GaussianFormer is an ECCV 2024 camera-based 3D semantic occupancy method that represents a driving scene as sparse semantic 3D Gaussians.
- GaussianFormer-2 is the CVPR 2025 follow-up that improves the representation with probabilistic Gaussian superposition.
- The family targets vision-centric 3D occupancy, not object-box detection or offline photorealistic reconstruction.
- Its key move is to replace dense voxel features with object-centric Gaussian primitives, then splat them back to voxels only for occupancy output and benchmark evaluation.
- It is a method-level complement to [3D Gaussian Splatting for Driving](../overview/gaussian-splatting-driving.md) and [Occupancy Network Architectures](../../world-models/occupancy-networks-comparison.md).

## Core Technical Idea

- Dense voxel grids allocate memory and computation to empty 3D space; road scenes are sparse and have object scales ranging from pedestrians to buses.
- GaussianFormer predicts a set of sparse 3D semantic Gaussians, where each Gaussian carries position, scale, rotation, and semantic logits.
- Image features are aggregated into Gaussian queries through cross-attention and refined over several blocks.
- Sparse convolution over Gaussian means models local interactions without processing a full voxel tensor.
- Gaussian-to-voxel splatting converts the Gaussian set into dense semantic occupancy predictions by aggregating nearby Gaussians for each queried voxel.
- GaussianFormer-2 changes the aggregation semantics: each Gaussian is treated as a probability distribution over occupied space, and geometry is combined by probabilistic multiplication.
- GaussianFormer-2 also uses an exact Gaussian mixture formulation for semantics and a distribution-based initialization module that places Gaussians near non-empty regions rather than merely estimating surface depth.

## Inputs and Outputs

- Input: surround-view camera images for nuScenes-style evaluation.
- Input: camera intrinsics and extrinsics for cross-view feature sampling and 3D query projection.
- Optional input variant: monocular camera input for KITTI-360 evaluation.
- Training input: semantic occupancy labels for supervised occupancy learning.
- Output: 3D semantic occupancy grid over the evaluation volume.
- Intermediate output: sparse semantic Gaussians with explicit mean, scale, rotation, opacity or occupancy probability, and class distribution.
- Non-output: no native LiDAR point cloud, no object tracks, and no persistent map unless wrapped in a temporal model such as GaussianWorld.

## Architecture or Pipeline

- Extract multi-scale image features with an image backbone.
- Initialize learnable Gaussian queries and initial Gaussian properties.
- Run self-encoding or sparse-convolution blocks on the Gaussian set.
- Use image cross-attention to sample camera features for each Gaussian query.
- Iteratively refine Gaussian position, covariance parameters, and semantics.
- Decode final Gaussian attributes into a sparse Gaussian scene representation.
- Convert Gaussians to voxel occupancy with local Gaussian-to-voxel splatting.
- In GaussianFormer-2, add probabilistic geometry aggregation, Gaussian-mixture semantic aggregation, and distribution-based initialization before refinement.

## Training and Evaluation

- GaussianFormer is evaluated on nuScenes for surround-view 3D semantic occupancy and KITTI-360 for monocular 3D semantic occupancy.
- The ECCV paper reports comparable performance to state-of-the-art methods while using only 17.8% to 24.8% of their memory consumption.
- The official repository reports GaussianFormer checkpoints on the SurroundOcc-style nuScenes setup with 144,000 Gaussians and a 25,600-Gaussian non-empty variant.
- GaussianFormer-2 is evaluated on nuScenes and KITTI-360 and is reported as state of the art with improved efficiency.
- GaussianFormer-2 ablations show that 12,800 Gaussians outperform the 144,000-Gaussian GaussianFormer baseline in the reported setup.
- Reported metrics include IoU and mIoU; comparisons must disclose dataset label source because SurroundOcc, Occ3D, and KITTI-360 settings are not interchangeable.
- Inference includes custom Gaussian-to-voxel CUDA behavior, so throughput is not only a backbone property.

## Strengths

- Avoids the largest waste in dense 3D occupancy: processing empty voxels as if they were equally important.
- Adapts spatial support through Gaussian scale and rotation instead of forcing a fixed grid everywhere.
- Provides an explicit intermediate representation that can be inspected, visualized, and potentially carried through time.
- GaussianFormer-2 improves small-object and occupied-region utilization by discouraging Gaussians from covering empty space.
- The final voxel output remains compatible with standard occupancy metrics and planner-facing occupancy grids.
- The official code and checkpoints make the family practical for reproduction and adaptation.

## Failure Modes

- Camera-only depth ambiguity can misplace Gaussians, especially under poor texture, glare, night lighting, or calibration drift.
- Gaussian-to-voxel splatting can hide uncertainty because the final grid looks dense even when geometry came from sparse camera evidence.
- Supervised training still depends on occupancy labels, which are scarce and expensive outside road datasets.
- Sparse Gaussian allocation can miss rare small objects if initialization or attention does not place capacity near them.
- nuScenes and KITTI-360 class sets do not cover aircraft, GSE, chocks, cones in airport configurations, or jet-bridge states.
- Performance numbers from SurroundOcc labels should not be compared directly with Occ3D results without noting the label protocol.

## Airside AV Fit

- Good research fit for airside semantic occupancy once camera coverage is available.
- The sparse representation is attractive for aprons because most of a large 3D volume is empty pavement or sky.
- Needs new semantic taxonomy for aircraft, wing, engine, tug, belt loader, baggage cart, fuel truck, personnel, cone, chock, FOD, pavement, and terminal structure.
- Camera-only occupancy should be fused with LiDAR or radar for clearance-critical operation near wings, engines, and aircraft stands.
- GaussianFormer-2 is the more interesting starting point because it allocates Gaussians more explicitly to non-empty regions.
- For planner use, export occupancy with confidence and unknown-space handling rather than only hard semantic labels.

## Implementation Notes

- Start from the official GaussianFormer repository rather than reimplementing the Gaussian-to-voxel kernels.
- Reproduce the published nuScenes configuration before changing range, voxel size, class set, or Gaussian count.
- Treat Gaussian count as a deployment knob: fewer Gaussians reduce cost but can remove small-object detail.
- Calibrate camera extrinsics carefully; Gaussian means are explicit 3D quantities and will expose rig errors.
- Keep label-protocol metadata with every experiment: SurroundOcc labels, Occ3D labels, KITTI-360, or custom airside labels.
- Log Gaussian utilization metrics such as percent of centers in occupied space, distance to nearest occupied voxel, overlap, and per-class recall.
- Consider temporal wrapping with [Streaming Temporal Perception](../overview/streaming-temporal-perception.md) or GaussianWorld-style state if frame-to-frame consistency is required.

## Sources

- GaussianFormer paper: https://arxiv.org/abs/2405.17429
- GaussianFormer ECCV 2024 PDF: https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/03958.pdf
- GaussianFormer-2 CVPR 2025 paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Huang_GaussianFormer-2_Probabilistic_Gaussian_Superposition_for_Efficient_3D_Occupancy_Prediction_CVPR_2025_paper.html
- GaussianFormer-2 CVPR 2025 PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Huang_GaussianFormer-2_Probabilistic_Gaussian_Superposition_for_Efficient_3D_Occupancy_Prediction_CVPR_2025_paper.pdf
- Official repository: https://github.com/huang-yh/GaussianFormer
