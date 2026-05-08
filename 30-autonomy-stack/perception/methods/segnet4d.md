# SegNet4D

## What It Is

- SegNet4D is an efficient instance-aware 4D LiDAR semantic segmentation network.
- It treats 4D LiDAR semantic segmentation as multi-scan semantic segmentation.
- The method predicts semantic class and dynamic state for LiDAR measurements.
- It is positioned as a real-time alternative to heavy 4D convolution or recursive approaches.
- The paper was first posted in 2024 and the repository notes T-ASE 2025 acceptance.
- It extends the authors' InsMOS line from moving-object segmentation to complete 4D semantic segmentation.

## Core Technical Idea

- Decompose 4D segmentation into two linked tasks.
- Task 1: single-scan semantic segmentation for current-frame class labels.
- Task 2: moving object segmentation for dynamic state.
- Fuse the two outputs through a motion-semantic fusion module.
- Extract current-scan instance information to enforce instance-wise segmentation consistency.
- Avoid relying solely on expensive 4D convolutions over all temporal points.

## Inputs and Outputs

- Input: sequential LiDAR scans.
- Input: current scan for single-scan semantic segmentation.
- Input: temporal context for motion feature encoding.
- Output: semantic category per LiDAR point.
- Output: dynamic/static state per LiDAR point.
- Output: fused 4D segmentation that distinguishes moving variants from static semantic classes.

## Architecture or Dataset/Pipeline

- The framework includes a motion feature encoding module for sequential LiDAR scans.
- Separate semantic and motion heads produce complementary predictions.
- Motion-semantic fusion combines semantic class and MOS evidence.
- Instance information is extracted from the current scan to improve consistency across points in the same object.
- The official code includes evaluation scripts for SemanticKITTI and nuScenes-style settings.
- The implementation is MIT licensed.

## Training and Evaluation

- The arXiv paper evaluates both multi-scan semantic segmentation and moving object segmentation.
- It reports state-of-the-art results at the time of posting while emphasizing real-time operation.
- The authors also validate effectiveness and efficiency on a real-world unmanned ground platform.
- Training depends on datasets with point semantic labels and dynamic labels.
- Evaluation should include semantic mIoU, moving-object metrics, and runtime.
- The repository released code in 2025 after the arXiv paper.

## Strengths

- Produces richer output than binary MOS while retaining explicit motion reasoning.
- Task decomposition is more deployment-friendly than monolithic 4D sparse models.
- Instance consistency improves object-level label stability.
- Real-time orientation is important for embedded autonomy.
- Public implementation supports reproduction and adaptation.
- Good bridge between existing LiDAR semantic segmentation and dynamic scene understanding.

## Failure Modes

- The semantic taxonomy comes from road datasets and may not cover airport-specific classes.
- Motion-semantic fusion can propagate errors from either branch.
- Instance extraction errors can create overly consistent but wrong object labels.
- Slow start/stop behavior remains difficult if training motion labels are road-biased.
- Multi-scan inputs require accurate ego-motion and timestamps.
- Runtime claims still need validation on the exact embedded GPU, sensor count, and ROS pipeline.

## Airside AV Fit

- High relevance for an Aurrigo-style LiDAR stack because it unifies semantics and motion without cameras.
- Supports airside questions such as "static aircraft part" versus "moving tug" better than semantic segmentation alone.
- Needs a custom airside label schema: aircraft fuselage, wing, engine, tail, GSE types, personnel, cone, FOD, lane marking.
- Instance consistency is valuable around baggage trains and clustered dollies.
- Dynamic state should feed prediction and planner risk, while semantic class feeds clearance and right-of-way logic.
- Safety use requires airport-specific evaluation under night, rain, de-icing spray, jet blast, and high-reflectance aircraft skins.

## Implementation Notes

- Use SegNet4D as a candidate upgrade path from a single-scan LiDAR semantic network.
- Keep semantic and dynamic outputs separate in ROS messages before fusing at the planner.
- Add calibration tests for multi-LiDAR timestamp skew because temporal motion features are sensitive.
- Fine-tune from public weights only after creating a small airside semantic/MOS validation set.
- Measure latency with the full stack: preprocessing, voxelization/projection, inference, postprocessing, and message publication.
- Compare against a two-model baseline: fast semantic segmentation plus 4DMOS dynamic masking.

## Sources

- Paper: https://arxiv.org/abs/2406.16279
- Official repository: https://github.com/nubot-nudt/SegNet4D
- InsMOS predecessor repository: https://github.com/nubot-nudt/InsMOS
- SemanticKITTI dataset: https://semantic-kitti.org/index
