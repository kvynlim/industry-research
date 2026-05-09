# Continuous Research Loop

This page turns the repo's gap audits into a repeatable research loop. It exists so perception, SLAM, mapping, sensors, and platform coverage keep moving from discovery to atomic files instead of remaining as broad backlog rows.

## Loop Contract

| Stage | Output | Done when |
|---|---|---|
| Discover | Web-search and repo-audit findings | Missing techniques, methods, datasets, fundamentals, and platform topics are named with primary sources. |
| Triage | P0/P1/P2 queue | Each item has a target directory, owner type, and reason it matters to AV, indoor/outdoor, mapping, or airside use. |
| Promote | Atomic research files | One method, technique, sensor model, or platform primitive gets its own source-backed file. |
| Cross-link | Overviews, audits, README, INDEX, methodology | Readers can find the new file from the static portal without knowing the path. |
| Verify | Link checks, tests, build, stale-path scan | The corpus remains navigable and deployable through VitePress. |
| Repeat | Next queue | Remaining backlog items are smaller, better prioritized, and ready for the next agent wave. |

## Current Promotion Waves

The 2026-05-09 loops promoted twelve high-value gap clusters into first-class pages.

| Track | Promoted coverage |
|---|---|
| Gaussian and 4D perception | SplatAD, GaussianFormer, GaussianOcc, streaming Gaussian occupancy, Cam4DOcc, StreamingFlow, Sparse4D, TacoDepth, and RaCFormer. |
| SLAM and mapping methods | MOLA, KISS-SLAM, KISS-Matcher, LVI-SAM, FAST-LIVO/FAST-LIVO2, R2LIVE/R3LIVE, Splat-SLAM, S3PO-GS, Gaussian-LIC, GS-LIVM, VIGS-SLAM, dynamic 4D Gaussian SLAM, and RadarSplat-RIO. |
| Sensor and estimation fundamentals | LiDAR, camera, IMU, GNSS/RTK, radar, event/thermal, time synchronization, multi-sensor calibration observability, wheel odometry, visible-camera hardware, and IMU/GNSS/RTK hardware. |
| First-principles foundations | Gaussian noise, Mahalanobis gating, MAP/MLE, robust statistics, mixtures, Gauss-Newton, LM, dogleg, Cholesky, QR/SVD, sparse solvers, Lie groups, PnP, ICP/GICP/NDT, occupancy grids, data association, JPDA/MHT/RFS, filters, sensor likelihoods, signal processing, radar ambiguity, CFAR, timestamping, and statistical benchmarking. |
| LiDAR artifact removal and map cleaning | LIORNet, LiSnowNet, SLiDE, TripleMixer, 3D-KNN blind-spot de-snowing, 3D-OutDet, AdverseNet, DenoiseCP-Net, classical outlier filters, broad weather artifact removal, LiDAR ghost/multipath artifacts, ERASOR, Removert, dynamic map cleaning, and artifact-removal validation. |
| ML foundations for autonomy | Perceptrons, logistic/softmax cross-entropy, MLPs, backprop/autodiff, optimization dynamics, initialization/normalization/regularization, CNNs, RNN/LSTM/GRU, attention/transformers, vision transformers, SSL, sequence models, foundation training, JEPA, and world-model first principles. |
| Dynamic/static object removal | MapCleaner, ERASOR++, 4dNDF, FreeDOM, STATIC-LIO dynamic-point removal, MotionSeg3D, MambaMOS, neural scene-flow priors, moving/static separation datasets, moved-object map-change datasets, scene-flow benchmarks, 4D occupancy benchmarks, and airside dynamic-map cleaning validation. |
| ML objective and evaluation foundations | Autoencoders/VAEs, contrastive InfoNCE, masked modeling, EBMs, tokenization/discretization, positional encodings, S4/Mamba first principles, diffusion-score-flow samplers, multi-task losses, calibration/leakage, and world-model evaluation objectives. |
| Latest perception/radar/neural-field gaps | CVFusion, 4D radar-camera occupancy, POD/FMCW LiDAR predictive detection, DrivingGaussian, HUGS, SplatFlow, DistillNeRF, TrackOcc, cross-domain LiDAR scene flow, self-supervised occupancy flow, and UniScene occupancy-centric generation. |
| Latest SLAM robust/lifelong gaps | Robust PGO/GNC/riSAM, certifiable pose-graph optimization, Kimera-RPGO/PCM, distributed multi-robot PGO, LT-mapper/Khronos, RTMap/DUFOMap, GPR localization, radar teach-repeat, and MOVES. |
| KB probability/control foundations | Probabilistic graphical models and message passing, information theory for perception/ML, uncertainty quantification/calibration/conformal prediction, constrained optimization/MPC/iLQR, and MDP/POMDP/belief-space/RL foundations. |
| Dataset and validation gaps | MUSES, sensor-corruption robustness benchmarks, open-world/OOD anomaly segmentation benchmarks, FOD and airport apron detection datasets, FOD perception validation, and knowledge-base evaluation protocol. |

## Active Next Queue

| Priority | Queue | Next atomic files to consider |
|---|---|---|
| P0 | Perception occupancy and radar | UnO, Drive-OccWorld, ST-Occ, STCOcc, EvOcc, RobuRCDet, SAMFusion, DepthOcc, and LinkOcc. |
| P0 | Sparse and end-to-end perception | SparseBEV, DETR4D, ForeSight, SparseDrive, DiffusionDrive, SAM4D, DriveBench. |
| P0 | Removal validation and adverse-weather datasets | Airside dust, de-icing mist, steam, glycol film, wet apron multipath, retroreflector bloom, do-not-delete hazard labels, DR-REMOVER, ExelMap, and FOD synthetic data generation. |
| P0 | SLAM robustness and backends | Scan Context family, LiDAR bundle-adjustment factors, Kimera-Multi/COVINS/D2SLAM collaborative SLAM systems, and benchmark pages for SNAIL Radar, HeRCULES, GEODE, and COSMO-Bench. |
| P0 | Sensor and calibration fundamentals | Ultrasonic proximity models, thermal IR radiometry as a standalone file, fleet calibration operations, calibration-bay fixtures, and online calibration drift response. |
| P0 | First-principles extensions | Continuous-time estimation, spline/GP trajectory representations, optimal experiment design for calibration, covariance consistency under robust losses, robust-loss uncertainty, and dataset-evaluation fundamentals. |
| P1 | Collaborative and infrastructure perception | V2XScenes, UrbanIng-V2X, QuantV2X, RCP-Bench, TruckV2X, collaborative Gaussian occupancy. |
| P1 | Alternative localization sensors | UWB/range-only SLAM, event-camera VIO, thermal RGBT VIO, wheel/LiDAR/IMU factor graphs, and infrastructure-aided localization. |

## Promotion Rules

1. Prefer one file per method or technique when the user needs depth.
2. Keep family synthesis in overview files; put method evidence in method files.
3. Use primary sources first: papers, official project pages, official repos, standards, or vendor documentation.
4. Every method page should state inputs, outputs, assumptions, failure modes, AV relevance, indoor/outdoor transfer, and airside fit where relevant.
5. Every sensor/foundation page should connect measurement physics to perception, SLAM, mapping, validation, and operational monitoring.
6. After every wave, update the relevant coverage audit, [Research Index](../../INDEX.md), [README](../../README.md), and [Methodology](../../METHODOLOGY.md).

## Source Audits

| Audit | Role |
|---|---|
| [Perception Coverage Audit](../../30-autonomy-stack/perception/overview/coverage-audit-2026.md) | Tracks perception methods, benchmarks, datasets, and robustness gaps. |
| [SLAM Coverage Audit](../../30-autonomy-stack/localization-mapping/slam-methods/coverage-audit-2026.md) | Tracks SLAM, odometry, localization, backend, sensor-fusion, and benchmark gaps. |
| [Knowledge Gap Backlog](knowledge-gap-backlog.md) | Tracks cross-architecture gaps outside the dedicated perception and SLAM audits. |
