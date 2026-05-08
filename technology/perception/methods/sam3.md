# SAM 3

## What It Is

- SAM 3 is Meta's Segment Anything Model 3.
- The paper title is "SAM 3: Segment Anything with Concepts".
- It extends promptable segmentation from visual prompts to Promptable Concept Segmentation.
- Concept prompts can be short noun phrases, image exemplars, or combinations of the two.
- The model detects, segments, and tracks all matching object instances in images and videos.
- It is a foundation segmentation model, not an autonomous-driving-specific detector.
- Meta released code, checkpoints, examples, and the SA-Co benchmark.

## Core Technical Idea

- Decouple concept recognition from precise mask localization.
- Use a shared backbone for image-level detection and memory-based video tracking.
- Add a presence head to improve decisions about whether a queried concept exists in the scene.
- Train with hard negatives so visually similar but wrong concepts are rejected.
- Scale supervision with a data engine that annotates millions of open-vocabulary concepts.
- Return masks and stable identities for all instances matching the prompt.
- Unify image segmentation and video tracking under one promptable concept interface.

## Inputs and Outputs

- Inputs can be still images or videos.
- Prompt inputs include text concepts, image exemplars, points, boxes, and masks in the released code path.
- Text prompts are short object or concept phrases rather than full task instructions.
- Outputs are instance masks for all matching objects.
- Video outputs include object identities tracked over time.
- The model can also support classic visual segmentation prompts from the SAM lineage.

## Architecture or Evaluation Protocol

- SAM 3 combines an image-level detector with a memory-based tracker.
- Recognition and localization are separated to reduce interference between concept matching and mask quality.
- The presence head checks whether a concept is present before mask prediction dominates the decision.
- The SA-Co benchmark evaluates Promptable Concept Segmentation at large vocabulary scale.
- The official GitHub describes SA-Co as containing 270K unique concepts.
- The data engine is reported to annotate over 4M unique concepts.
- The paper reports about a 2x gain over existing systems in image and video PCS.

## Training and Evaluation

- SAM 3 is trained with large-scale image and video segmentation data plus concept labels.
- Hard negatives are included to improve fine-grained text discrimination.
- The released repository includes inference and finetuning code.
- The official Meta page reports improvements over previous SAM capabilities on visual segmentation tasks.
- The GitHub page reports 75 to 80 percent of human performance on SA-Co.
- Evaluation includes image PCS, video PCS, and prior SAM-style promptable segmentation tasks.

## Strengths

- Text and exemplar prompts make segmentation usable without drawing precise boxes for every object.
- Returning all matching instances is more useful than single-object click segmentation for scene parsing.
- Video identity tracking helps with temporal review and annotation.
- The model is broadly useful for label generation, dataset triage, and open-vocabulary mask extraction.
- Official code and checkpoints make it a practical foundation component.
- Hard negatives and a presence head directly address prompt confusion.

## Failure Modes

- It outputs 2D or video masks, not metric 3D boxes, velocity, or occupancy.
- Text prompts can be under-specified; "cart" or "loader" may mean different airside objects.
- It can still miss small, thin, distant, reflective, or heavily occluded items.
- Video identities can drift under long occlusion or camera cuts.
- Compute and memory requirements may be high for embedded deployment.
- Licensing and checkpoint terms need review before commercial use.

## Airside AV Fit

- SAM 3 is highly useful for airside data annotation and open-vocabulary mask mining.
- It can segment all instances of prompts such as "traffic cone", "baggage cart", or "tow bar" in images and video.
- Exemplar prompts are useful when airport-specific objects lack stable public names.
- Runtime use needs fusion with depth or LiDAR before masks become drivable-space constraints.
- It should be tested on night operations, glare, rain, aircraft reflections, and apron paint.
- Best near-term fit is human-in-the-loop labeling, perception QA, and offline dataset expansion.

## Implementation Notes

- Build prompt templates and exemplar banks for airport equipment to reduce text ambiguity.
- Save the exact prompt, model checkpoint, and post-processing threshold with each generated mask.
- Use video mode for annotation consistency, but still audit identity switches.
- Pair masks with camera calibration and depth to create 3D training labels.
- Add negative prompts or hard-negative review sets for aircraft parts versus ground equipment.
- Do not treat SAM 3 masks as safety-certified obstacle detections without independent validation.

## Sources

- Official Meta publication page: https://ai.meta.com/research/publications/sam-3-segment-anything-with-concepts/
- arXiv paper: https://arxiv.org/abs/2511.16719
- Official GitHub repository: https://github.com/facebookresearch/sam3
- Hugging Face paper page: https://huggingface.co/papers/2511.16719
