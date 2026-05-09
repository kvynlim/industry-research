# ProOOD

## What It Is

- ProOOD is a prototype-guided out-of-distribution method for 3D semantic occupancy prediction.
- It targets two linked failures in dense occupancy: long-tail class bias and overconfident assignment of unknown objects to rare known classes.
- The method is designed as a lightweight, plug-in layer for existing occupancy predictors rather than a full replacement backbone.
- It was submitted in April 2026 and listed by the authors as accepted to CVPR 2026.
- The output is both a refined semantic occupancy prediction and a voxel-level OOD score.
- It is most relevant when occupancy is used as a planning state, not only as a visualization.

## Core Technical Idea

- Learn or maintain semantic prototypes for known occupancy classes.
- Use prototype-guided semantic imputation to fill occluded or weakly observed voxels with class-consistent features.
- Use prototype-guided tail mining to strengthen rare-class representations so anomalies are less likely to be absorbed into tail classes.
- Add EchoOOD, a training-free OOD scoring module that combines local logit coherence with local and global prototype matching.
- Produce OOD evidence at voxel level, allowing the planner to distinguish "occupied by known class" from "occupied or uncertain but semantically unfamiliar."
- Keep the refinement compatible with different 3D occupancy backbones.

## Inputs and Outputs

- Input: voxel features and semantic logits from a 3D occupancy model.
- Input: class prototypes or prototype statistics derived from the trained occupancy feature space.
- Training input: standard semantic occupancy labels for known classes.
- Optional input: occlusion masks, visibility masks, or voxel confidence from the upstream occupancy system.
- Output: refined semantic occupancy logits or labels.
- Output: voxel-level OOD score map.
- Output for monitoring: tail-class confidence, prototype match scores, and local coherence scores.

## Architecture or Pipeline

- Start with a conventional semantic occupancy predictor over a 3D voxel grid.
- Build class prototypes from feature embeddings associated with known semantic occupancy classes.
- Run prototype-guided semantic imputation over uncertain or occluded regions to regularize features toward known class manifolds where evidence supports that choice.
- Run prototype-guided tail mining to keep rare known classes separated from unknown-object evidence.
- Compute EchoOOD from three cues: local logit coherence, local prototype similarity, and global prototype compatibility.
- Combine the semantic refinement and OOD score with the upstream occupancy output.
- Pass unknown or high-OOD voxels downstream as risk, not as a new hard object class unless a separate labeling loop validates the object.

## Training and Evaluation

- The paper reports experiments across five datasets for in-distribution occupancy and OOD detection.
- On SemanticKITTI, ProOOD improves the reported occupancy baseline by +3.57 percentage points mIoU overall.
- On SemanticKITTI tail classes, it reports a +24.80 percentage point tail-class mIoU gain.
- On VAA-KITTI, it reports a +19.34 point AuPRC improvement for OOD detection.
- Benchmark interpretation should separate semantic occupancy quality, tail-class quality, and OOD ranking quality.
- A high OOD AUROC or AuPRC does not by itself prove safe behavior; the downstream action policy must use the score conservatively.

## Strengths

- Directly attacks a deployability gap in occupancy: unknown objects inside a dense planning grid.
- Voxel-level OOD maps are more useful for planning than a scene-level novelty flag.
- Prototype matching is interpretable enough to audit against class imbalance and tail-class drift.
- Tail mining reduces the common failure where rare classes become catch-all anomaly labels.
- It can be attached to an existing occupancy stack with less disruption than retraining a full foundation model.
- Useful for data mining because high-OOD voxels can trigger labeling and taxonomy review.

## Failure Modes

- Prototype quality depends on the training feature space; biased training data creates biased prototypes.
- Unknown objects visually or geometrically close to tail classes can still be under-flagged.
- Semantic imputation can make occluded regions look more certain than the raw evidence supports.
- OOD score calibration may shift across weather, airport surfaces, camera rigs, LiDAR density, or voxel range.
- Treating OOD as an object class can create false precision; it should remain a risk signal until reviewed.
- Prototype methods can become brittle when new known classes are added without recalibrating old prototypes.

## Airside AV Fit

- Strong fit for airside because aprons contain non-road, long-tail, and site-specific objects: chocks, hoses, tow bars, cones, covers, dollies, belt loaders, aircraft gear, and temporary maintenance equipment.
- Voxel OOD scores can protect against overconfident freespace around unknown equipment near stands.
- Tail-class handling is valuable because rare but safety-critical airside objects may have few labeled examples.
- OOD triggers should increase clearance buffers, reduce speed, request teleoperation, or start a data-upload event.
- The method should be validated separately on wet concrete, floodlights, reflective aircraft skin, de-icing spray, jet exhaust shimmer, and night ramp operations.
- It is a complement to range-sensor geometry, not a substitute for verified obstacle occupancy.

## Implementation Notes

- Preserve the raw occupancy confidence and the ProOOD OOD score as separate channels.
- Calibrate OOD thresholds per airport, sensor rig, weather slice, and voxel range.
- Track OOD false positives around regular-but-rare equipment so the data engine can promote them to known classes.
- Do not let semantic imputation clear occupied space; conservative occupancy should dominate semantic guesswork.
- Compare OOD maps against open-world anomaly datasets and airside-specific negative examples.
- Log prototype match scores for post-incident inspection and label-taxonomy decisions.

## Sources

- ProOOD arXiv paper: https://arxiv.org/abs/2604.01081
- Official ProOOD repository: https://github.com/7uHeng/ProOOD
- Open-world OOD benchmark context: [Open-World OOD and Anomaly Segmentation Benchmarks](../datasets-benchmarks/open-world-ood-anomaly-segmentation-benchmarks.md)
