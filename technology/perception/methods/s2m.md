# S2M

## What It Is

- S2M is a framework for out-of-distribution object segmentation in semantic segmentation.
- The paper title is "Segment Every Out-of-Distribution Object".
- S2M expands to Score To segmentation Mask.
- It converts anomaly score maps into object-level segmentation masks.
- The method was published at CVPR 2024.
- It is designed for safety-critical settings such as autonomous driving where unknown objects should not be treated as background.
- S2M is a mask-generation method, not an open-vocabulary semantic naming method.

## Core Technical Idea

- Existing OoD segmentation methods often output pixel-level anomaly scores.
- Turning those scores into masks usually requires threshold selection and can fragment objects.
- S2M uses anomaly scores to generate prompts for a promptable segmentation model.
- The promptable model then segments the entire OoD object rather than thresholding individual pixels.
- This removes the need for a manually selected dataset-specific mask threshold.
- The framework keeps the anomaly scorer and mask generator modular.
- It converts uncertainty evidence into object-shaped masks.

## Inputs and Outputs

- Inputs are RGB images and anomaly score maps from an existing semantic anomaly detector.
- The anomaly map can come from methods such as energy, rejection, or reconstruction-based OoD scoring.
- S2M transforms high-anomaly regions into prompts such as boxes or points.
- A promptable segmentation model consumes those prompts.
- Outputs are binary masks for OoD objects.
- The output does not include a semantic label for the unknown object.

## Architecture or Evaluation Protocol

- The pipeline starts with a semantic segmentation or anomaly scoring model.
- Anomaly scores identify candidate object regions without committing to a global thresholded mask.
- Candidate prompts are produced from the score distribution.
- Segment Anything style promptable segmentation generates full object masks.
- Mask selection ranks or filters generated masks using the anomaly evidence.
- Evaluation measures object-level anomaly segmentation quality rather than only pixel score quality.
- Metrics include IoU and mean F1 on anomaly segmentation benchmarks.

## Training and Evaluation

- S2M is primarily a post-processing and prompting framework around existing anomaly scores.
- The CVPR paper evaluates Fishyscapes, Segment-Me-If-You-Can, and RoadAnomaly.
- The authors report average improvements of about 20 percent in IoU and 40 percent in mean F1 over prior state of the art.
- The method compares against thresholded anomaly maps and other OoD segmentation approaches.
- Its performance depends on the upstream anomaly scorer and the promptable segmentation model.
- The official code is available from the authors' GitHub repository.

## Strengths

- Avoids brittle global threshold selection for anomaly masks.
- Produces coherent object masks, which are easier to inspect and track than scattered anomaly pixels.
- Can be plugged into multiple anomaly scoring backbones.
- Uses foundation segmentation without requiring a new large anomaly dataset.
- Evaluation on driving anomaly benchmarks makes it relevant to safety perception.
- The output masks are useful for downstream review, tracking, or dataset mining.

## Failure Modes

- If the anomaly scorer misses an object, S2M has no evidence to prompt from.
- Promptable segmentation can fail on tiny, distant, overlapping, or heavily occluded objects.
- It does not name the anomaly, so operator-facing systems need another labeling module.
- High anomaly scores on boundaries, shadows, or sensor artifacts can generate false masks.
- It is 2D and does not provide distance, velocity, or occupancy.
- Dense groups of anomalies can produce merged or fragmented prompts depending on score topology.

## Airside AV Fit

- S2M is useful for detecting and masking unexpected apron objects in camera images.
- It can convert weak anomaly heatmaps for FOD, debris, animals, or unusual equipment into reviewable masks.
- Object masks are better than raw heatmaps for remote assistance and annotation workflows.
- Airside use needs upstream anomaly scoring trained or calibrated on apron imagery.
- Outputs should be projected into 3D using depth or LiDAR before affecting motion planning.
- It is a good data-mining tool for unknown-object collection, not a complete real-time hazard classifier.

## Implementation Notes

- Keep the upstream anomaly scorer replaceable; benchmark multiple scorers with the same S2M wrapper.
- Store anomaly score maps alongside final masks for audit and threshold-free debugging.
- Validate mask quality separately for small FOD, cones, chocks, hoses, and personnel equipment.
- Add temporal consistency checks to suppress one-frame mask artifacts.
- Use conservative downstream behavior when S2M produces large masks near aircraft or service vehicles.
- Combine with semantic naming methods such as Clipomaly if operator-readable labels are required.

## Sources

- CVPR 2024 paper PDF: https://openaccess.thecvf.com/content/CVPR2024/papers/Zhao_Segment_Every_Out-of-Distribution_Object_CVPR_2024_paper.pdf
- CVPR 2024 supplemental PDF: https://openaccess.thecvf.com/content/CVPR2024/supplemental/Zhao_Segment_Every_Out-of-Distribution_CVPR_2024_supplemental.pdf
- arXiv paper: https://arxiv.org/abs/2311.16516
- Official GitHub repository: https://github.com/WenjieZhao1/S2M
