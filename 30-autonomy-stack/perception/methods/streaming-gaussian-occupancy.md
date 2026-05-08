# Streaming Gaussian Occupancy

## What It Is

- Streaming Gaussian Occupancy is a lineage of temporal occupancy methods that carry a compact Gaussian or query state across frames.
- This page covers GaussianWorld and S2GO as one method family because both use Gaussian-based scene representations for streaming 3D occupancy.
- GaussianWorld is a CVPR 2025 Gaussian world model for streaming 3D occupancy prediction.
- S2GO is an ICLR 2026 streaming sparse Gaussian occupancy method that keeps a small persistent query state and decodes it into semantic Gaussians.
- The common goal is temporal consistency and planner-facing 3D semantic occupancy without rebuilding a dense world representation from scratch each frame.
- This topic connects to [Streaming Temporal Perception](../overview/streaming-temporal-perception.md), [3D Gaussian Splatting for Driving](../overview/gaussian-splatting-driving.md), and [Occupancy World Models](../../world-models/occupancy-world-models.md).

## Core Technical Idea

- Single-frame occupancy estimates flicker because each frame re-solves the 3D scene independently.
- Dense temporal fusion is expensive because it carries voxels or dense Gaussian sets through mostly empty space.
- GaussianWorld models scene evolution in Gaussian space by aligning static scene Gaussians with ego motion, moving dynamic regions locally, and completing newly observed areas.
- It reformulates current 3D occupancy prediction as a 4D forecasting problem conditioned on current RGB observations.
- S2GO pushes the idea further by storing roughly a thousand sparse 3D queries as the persistent streaming world state.
- At each timestep, S2GO refines current queries with historical queries and camera features, decodes each query into semantic Gaussians, and splats those Gaussians into a dense occupancy grid.
- The planner sees a conventional occupancy output, while the temporal memory stays compact and query-based.

## Inputs and Outputs

- Input: sequential camera images, usually surround-view for nuScenes-style occupancy.
- Input: camera calibration and ego-motion or pose information for aligning history.
- GaussianWorld input state: historical semantic Gaussians plus the current RGB observation.
- S2GO input state: a queue of past sparse 3D queries plus current multi-camera image features.
- Output: current 3D semantic occupancy grid for downstream perception, prediction, and planning.
- Intermediate output: persistent temporal Gaussian or query state, refined semantic Gaussians, and sometimes future or next-frame Gaussian predictions.
- Non-output: these methods are not HD map builders by themselves, although their state can feed mapping and planning modules.

## Architecture or Pipeline

- GaussianWorld begins from a GaussianFormer-style semantic Gaussian representation.
- It aligns historical Gaussians into the current ego frame.
- It completes newly observed areas with random or learned prior Gaussians.
- It refines aligned and completed Gaussians through Gaussian world layers with self-encoding, cross-attention to current image features, and unified refinement blocks.
- It splats refined Gaussians into occupancy through a Gaussian-to-occupancy head.
- S2GO maintains a compact set of sparse 3D queries as the recurrent state.
- S2GO refines queries with a temporal transformer, decodes queries into semantic Gaussians, and uses efficient Gaussian-to-voxel splatting to generate dense occupancy.
- S2GO adds geometry-first pretraining with query denoising and RGB/depth rendering supervision so sparse queries learn to move toward real 3D structure.

## Training and Evaluation

- GaussianWorld is evaluated on nuScenes and reports over 2% mIoU improvement over the single-frame GaussianFormer counterpart without additional computation overhead.
- The official GaussianWorld repository provides single-frame GaussianFormer and streaming GaussianWorld configurations and checkpoints for the SurroundOcc setup.
- S2GO is evaluated on nuScenes and KITTI occupancy benchmarks.
- The ICLR 2026 version reports state-of-the-art performance, outperforming GaussianWorld by 2.7 IoU with 4.5 times faster inference.
- Earlier arXiv and project summaries reported different speed and IoU deltas; use the ICLR 2026 paper numbers when citing the latest published version.
- S2GO ablations emphasize geometry-first pretraining, query propagation strategy, velocity modeling, and optimized Gaussian-to-voxel CUDA kernels.
- Standard metrics include IoU and mIoU, but deployment assessment should also track temporal flicker, history horizon, stale-obstacle behavior, and latency.

## Strengths

- Persistent state improves temporal consistency over independent per-frame occupancy.
- Gaussian or query state is much lighter than carrying dense 3D voxels through time.
- Explicit 3D primitives make ego-motion alignment and dynamic-region updates easier to reason about than opaque BEV feature fusion.
- Planner-facing output remains a dense semantic occupancy grid, so downstream planners do not need to understand Gaussians.
- S2GO's query state scales better to long temporal horizons because compute is tied to query count, not full volume size.
- The lineage is a good fit for camera-only or camera-primary stacks that need stable occupancy under occlusion.

## Failure Modes

- Persistent state can preserve stale obstacles after objects move away or after false positives enter memory.
- Ego-motion, timestamp, or calibration errors create temporal ghosting and duplicated structures.
- Camera-only updates may fail to clear occluded regions or may hallucinate geometry behind large aircraft and GSE.
- Query bottlenecks can underrepresent rare small objects if query allocation is dominated by large static surfaces.
- Dynamic-object modeling is still learned and may not respect operational rules around pushback, towing, or aircraft taxi.
- Temporal smoothing can make outputs look stable while hiding delayed reaction to sudden hazards.

## Airside AV Fit

- Strong fit for planner-facing occupancy because airside planning needs stable freespace, obstacle persistence, and occlusion reasoning.
- Useful around aircraft stands where objects disappear behind GSE, aircraft wings, jet bridges, or parked vehicles.
- Persistent state can help avoid frame-to-frame flicker in open aprons with low visual texture.
- Needs explicit stale-state handling for moved baggage carts, temporary cones, chocks, and personnel.
- Planner integration should expose occupancy age, confidence, source modality, and whether a voxel is observed, inferred, or carried from history.
- For airside safety, use streaming Gaussian occupancy as a temporal semantic layer fused with LiDAR/radar occupancy, not as the only obstacle source.

## Implementation Notes

- Start with a single-frame Gaussian occupancy baseline before adding streaming state.
- Keep a strict time model: ego pose timestamps, camera exposure timing, and history transforms must be consistent.
- Limit history by distance, time, and confidence decay so stale Gaussians or queries cannot dominate current evidence.
- Export planner-facing grids with separate occupied, free, unknown, and stale/inferred channels where possible.
- Evaluate temporal metrics: flicker rate, persistence after occlusion, stale-object clearing time, and missed sudden-object insertion.
- For airport data, test long static horizons and slow-moving operations, not only urban traffic clips.
- If using S2GO-style sparse queries, monitor query coverage around small safety-critical objects and thin structures.

## Sources

- GaussianWorld CVPR 2025 paper PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Zuo_GaussianWorld_Gaussian_World_Model_for_Streaming_3D_Occupancy_Prediction_CVPR_2025_paper.pdf
- GaussianWorld arXiv paper: https://arxiv.org/abs/2412.10373
- GaussianWorld official repository: https://github.com/zuosc19/GaussianWorld
- S2GO ICLR 2026 paper PDF: https://openreview.net/pdf?id=z8ggdMlSco
- S2GO arXiv paper: https://arxiv.org/abs/2506.05473
- S2GO Applied Intuition project blog: https://www.appliedintuition.com/kr/research-blog/s2go
