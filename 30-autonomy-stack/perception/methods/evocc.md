# EvOcc

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "prototype"
  tags: ["perception", "fallback", "validation", "adverse-weather", "road-av"]
  reason: "EvOcc is rated for alternative-sensor perception and adverse-weather fallback evaluation."
method-priority:end -->

## What It Is

- EvOcc is a CVPR 2025 framework for evidential semantic occupancy mapping and prediction.
- The full title is "EvOcc: Accurate Semantic Occupancy for Automated Driving Using Evidence Theory."
- It has two linked pieces: evidential reconstruction of semantic occupancy ground truth from noisy LiDAR and training of camera models to predict evidential occupancy.
- It uses evidence theory to represent support, conflict, and unknown state rather than forcing every voxel into one hard class.
- It is an uncertainty-aware occupancy supervision method and prediction target.
- It is not only an inference-time calibration wrapper; it changes how the ground truth occupancy map is built.

## Core Technical Idea

- Extend evidential mapping from binary occupancy to semantic occupancy.
- Represent key hypotheses such as free, occupied-by-class, generally occupied with unknown semantics, and total uncertainty.
- Build a semantic basic belief assignment from LiDAR transmissions, labeled reflections, and unlabeled reflections.
- Explicitly model conflicting evidence, such as free-space rays crossing areas with noisy returns.
- Use the evidential occupancy maps as ground truth to train multi-camera semantic occupancy predictors.
- Predict both semantic occupancy and uncertainty so planners can see where the model is unsure due to occlusion or conflicting measurements.

## Inputs and Outputs

- Ground-truth construction input: LiDAR scans, semantic point labels where available, ray transmissions, and calibration.
- Model inference input: multi-view camera images with camera calibration and ego-pose metadata.
- Training target: semantic occupancy belief masses and uncertainty derived from evidence theory.
- Output: semantic occupancy voxel grid.
- Output: voxel-level uncertainty or belief mass over uncertainty-related hypotheses.
- Optional output: BEV uncertainty map for planner gating and data mining.

## Architecture or Pipeline

- Convert LiDAR scans into transmission and reflection evidence per voxel.
- Assign support to semantic class hypotheses when labeled reflections are available.
- Assign support to a general occupied hypothesis when the voxel is occupied but the semantic class is unknown.
- Track free-space evidence from ray transmissions.
- Combine supporting and conflicting evidence into belief masses for the selected hypothesis set.
- Train a camera-based occupancy model with an evidential loss that matches both semantics and uncertainty.
- Use the predicted uncertainty map downstream instead of discarding it after semantic argmax.

## Training and Evaluation

- EvOcc is evaluated on semantic occupancy prediction for automated driving.
- The paper reports that replacing heuristic LiDAR occupancy labels with evidential mapping substantially improves reconstructed occupancy quality.
- It reports improved training outcomes for camera occupancy models while keeping the model architecture fixed and changing the supervision.
- The CVPR paper emphasizes uncertainty maps for both ground truth and trained predictions, especially in occluded regions.
- Evaluation should include semantic IoU, occupancy IoU, uncertainty calibration, occlusion slices, and disagreement between evidence and prediction.
- Do not compare only semantic argmax maps; the evidential contribution is the uncertainty and conflict representation.

## Strengths

- Treats occupancy labels as uncertain measurements instead of perfect truth.
- Handles noisy and partially annotated LiDAR data more honestly than hard voxelization.
- The general occupied hypothesis is useful when geometry is visible but semantics are unknown.
- Provides uncertainty targets for camera-only occupancy models, not only uncertainty heuristics after training.
- Makes occluded and contradictory areas explicit in the output.
- Supports safety cases where "unknown" must be distinguishable from "free."

## Failure Modes

- Belief assignments depend on sensor hyperparameters and ray-model assumptions.
- LiDAR shadowing, multipath, rain, spray, and reflective surfaces can still create misleading evidence.
- Camera models trained on evidential targets can learn dataset-specific uncertainty patterns instead of causal uncertainty.
- Evidence-theory outputs require downstream consumers that understand belief and uncertainty fields.
- A conservative uncertainty map can reduce availability if thresholds are not calibrated to the ODD.
- Sparse semantic labels still limit class-specific evidence, especially for rare airside objects.

## Airside AV Fit

- Strong fit because airside operation requires distinguishing free, occupied, unknown, and semantically ambiguous space.
- Evidential labels are useful for reflective aircraft surfaces, occlusions under wings, jet bridges, service equipment, cones, chocks, hoses, and personnel near clutter.
- The general occupied state is valuable for FOD-like or unknown ramp objects whose exact class is less important than avoiding them.
- Camera predictions should preserve uncertainty near floodlights, wet pavement, rain, de-icing mist, and aircraft glare.
- Use uncertainty to increase buffers and trigger teleoperation rather than only to suppress detections.
- Airside validation needs independent 3D ground truth or manual review because LiDAR-derived evidence can be wrong around metal structures.

## Implementation Notes

- Keep belief masses or uncertainty channels through the perception-planning interface.
- Version LiDAR ray-casting parameters, voxel size, class taxonomy, and evidence hyperparameters with every generated label set.
- Add an explicit "unknown occupied" channel if the planner can use it.
- Check calibration between camera predictions and evidential uncertainty using held-out adverse-condition logs.
- Inspect disagreement cases where the semantic argmax is correct but uncertainty is high, and where uncertainty is low but geometry is wrong.
- Use uncertainty-triggered data collection for repeated high-uncertainty airport locations.

## Sources

- CVPR 2025 open-access paper: https://openaccess.thecvf.com/content/CVPR2025/papers/Kalble_EvOcc_Accurate_Semantic_Occupancy_for_Automated_Driving_Using_Evidence_Theory_CVPR_2025_paper.pdf
- CVPR 2025 paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Kalble_EvOcc_Accurate_Semantic_Occupancy_for_Automated_Driving_Using_Evidence_Theory_CVPR_2025_paper.html
- Uncertainty overview: [Uncertainty Quantification and Calibration](../overview/uncertainty-quantification-calibration.md)
