# LiSnowNet

## What It Is

- LiSnowNet is an IROS 2022 unsupervised LiDAR snow-removal method for point clouds corrupted by snowfall.
- It was designed to avoid slow nearest-neighbor snow filters such as DROR and DSOR on modern high-point-count LiDAR sweeps.
- It converts point clouds into range images and trains a CNN to output a residual/noise image without point-wise snow labels.
- It is snow-specific in its formulation and should not be treated as a universal rain, fog, spray, dust, or multipath-removal network.
- It is a useful baseline for newer self-supervised approaches such as [SLiDE](slide-lidar-desnowing.md), [3D-KNN Blind-Spot Desnowing](3d-knn-blind-spot-desnowing.md), and [LIORNet](liornet.md).

## Core Technical Idea

- Project a LiDAR sweep into a two-channel range image: distance and intensity.
- Assume clean range images are sparse under frequency and wavelet transforms, while snow corruption makes the representation less sparse.
- Train a CNN to predict the residual image representing the weather/noise component.
- Use sparsity losses based on FFT and DWT coefficients instead of supervised snow labels.
- Subtract the predicted residual from the input range image to estimate a cleaner scene representation.
- Classify snow using residual-space conditions that encode whether a point is foreground, low intensity, and not sparse.

## Inputs and Outputs

- Input: a single LiDAR point cloud with per-point coordinates and intensity.
- Preprocessed input: a spherical range image with distance and intensity channels.
- Training input: unlabeled point clouds from CADC and WADS.
- Output: a residual image estimating the snow/noise component.
- Output: a denoised point cloud containing points predicted as non-snow.
- Non-output: no semantic object classes, no rain/fog class separation, no temporal tracks, and no explicit uncertainty map.

## Architecture or Pipeline

- Convert each point to range, inclination, and azimuth, then discretize into a panoramic range image.
- Scale range and intensity so close snow-like returns matter despite the larger maximum LiDAR range.
- Fill void pixels with a limited preprocessing chain; valid measurement pixels are not modified by that void-filling step.
- Use a modified MWCNN-style architecture with residual blocks, circular convolutions, dropout, and reduced channel counts for real-time operation.
- Replace pooling and transposed convolution with DWT downsampling and inverse DWT upsampling.
- Train the network to produce the residual/noise image rather than directly producing a hard binary mask.
- Apply a residual-space decision boundary after training to decide which original points are snow.

## Training and Evaluation

- The paper trains on CADC and WADS without point-wise labels, using sequence-level train/validation splits.
- WADS labels are used for evaluation because it provides point-wise snow labels.
- Reported baselines include DROR, DSOR, and a median filter.
- The paper reports LiSnowNet variants with higher IoU than the nearest-neighbor filters and roughly 6.8 ms runtime on the tested desktop GPU.
- The arXiv abstract reports about 52x speedup versus prior state-of-the-art nearest-neighbor methods.
- The paper also shows cleaner CADC maps when denoised point clouds are fed into mapping with RTK poses or LeGO-LOAM.

## Strengths

- Does not require point-wise snow labels for training.
- Avoids per-point nearest-neighbor search at inference by using image-like operations on a range projection.
- FFT/DWT sparsity gives a clear signal-processing rationale for the loss.
- The runtime profile is attractive for 10 Hz LiDAR and GPU deployment.
- Works naturally as a preprocessing block before mapping or object detection.
- Public code and pretrained artifacts make it a practical research baseline.

## Failure Modes

- It is tuned around snowflake behavior in range and intensity images; rain, fog, road spray, de-icing mist, dust, and steam are not covered by the main evidence.
- Snow-like small foreground structures can be over-removed when they appear sparse, close, or low intensity.
- Range-image projection can lose 3D adjacency, especially near depth discontinuities, thin structures, and multi-return ambiguity.
- Static sparsity assumptions may fail around dense vegetation, chain-link fences, aircraft edges, jet bridges, and reflective wet surfaces.
- Intensity behavior changes across LiDAR vendors and weather exposure.
- It has no built-in temporal reasoning to distinguish moving objects from transient snow.
- It is research code, not a production-certified filter.

## Airside AV Fit

- Good candidate baseline for snow removal before mapping on service roads, aprons, and perimeter routes.
- Less appropriate as a sole filter around aircraft stands where de-icing mist, exhaust, wet concrete spray, and reflective metal are common.
- Needs airport-specific data before use near chocks, cones, tow bars, personnel, belt loaders, dollies, and low-profile obstacles.
- Pair with radar-based checks and weather state estimation as described in [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md).
- For deployment decisions, follow the redundancy and monitoring guidance in [Production Perception Systems](../overview/production-perception-systems.md).
- Compared with [LIORNet](liornet.md), LiSnowNet is simpler and faster but has fewer explicit physics/rule safeguards after inference.

## Implementation Notes

- Keep the spherical projection parameters tied to the exact LiDAR vertical beam layout and horizontal resolution.
- Preserve a reversible mapping from range-image pixels to original point indices.
- Validate the void-pixel filling path separately; it should not silently modify valid returns.
- Refit or verify residual thresholds when changing LiDAR model, intensity scaling, or mounting height.
- Track removed points by semantic bucket in evaluation: snow, rain, fog, spray, mist/steam, dust, multipath ghosts, and dynamic-object points.
- Benchmark end-to-end latency including projection and reprojection, not only CNN inference.
- Use it as a baseline against [SLiDE](slide-lidar-desnowing.md), [3D-OutDet](3d-outdet.md), [TripleMixer](triplemixer.md), and [LIORNet](liornet.md).

## Sources

- arXiv abstract: https://arxiv.org/abs/2211.10023
- ar5iv HTML paper: https://ar5iv.labs.arxiv.org/html/2211.10023
- Official repository: https://github.com/umautobots/lisnownet
