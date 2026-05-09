# Knowledge Base Visual Reassessment Assuming Generated Figures Are Removed

Date: 2026-05-09

Scope: `10-knowledge-base` only. This reassessment covers all 103 live Markdown research files.

## Assumption Change

The previous audit counted the existing one-figure-per-page coverage as baseline visual coverage. This reassessment deliberately does not count those visuals because they are treated as generic auto-generated figures that will be removed.

Under this assumption, every knowledge-base research note needs at least one purpose-built visual. The decision below is therefore not whether to keep the generated visual, but what replacement visual each file needs to preserve or improve baseline understanding.

## Procedure

Each file was reassessed as its own research note:

1. Re-read the live file inventory under `10-knowledge-base`.
2. Use each file title and section structure to identify the primary teaching burden.
3. Ignore the current generated SVG as visual evidence.
4. Decide whether a purpose-built visual is needed after removal of the generated figure.
5. Specify the visual that should replace the generated figure.

## Summary

- Live knowledge-base Markdown files: 103.
- Files requiring a replacement visual if generated figures are removed: 103.
- Files that can safely lose the generated visual without replacement: 0.
- Recommended default: one carefully designed replacement diagram per file.
- Multi-diagram expansion should be reserved for later deepening passes; the current goal is baseline replacement coverage.

## File-by-File Reassessment

### Controls

- `10-knowledge-base/controls/constrained-optimization-mpc-ilqr-first-principles.md` - Visual needed: yes. Replacement visual: receding-horizon control loop showing state estimate, prediction model, constraints, cost, QP/NLP solve, first-control application, and warm-start feedback.
- `10-knowledge-base/controls/frenet-trajectory-math.md` - Visual needed: yes. Replacement visual: road centerline with Frenet `s` and `d` axes, sampled lateral offsets, jerk-optimal profile, vehicle envelope, and collision-check corridor.
- `10-knowledge-base/controls/mdp-pomdp-belief-space-rl-first-principles.md` - Visual needed: yes. Replacement visual: POMDP belief-update loop connecting hidden state, action, observation, Bayes belief update, policy, value, and uncertainty.
- `10-knowledge-base/controls/vehicle-dynamics-and-control.md` - Visual needed: yes. Replacement visual: model-fidelity ladder from kinematic bicycle to dynamic bicycle, tire force/slip, actuator delay, controller output, and failure diagnostics.

### Geometry 3D

- `10-knowledge-base/geometry-3d/camera-imaging-noise-calibration.md` - Visual needed: yes. Replacement visual: camera measurement chain from scene radiance through lens projection, distortion, rolling-shutter timing, sensor noise, calibration residual, and estimator covariance.
- `10-knowledge-base/geometry-3d/camera-projective-geometry-pnp-triangulation.md` - Visual needed: yes. Replacement visual: camera-pose and landmark geometry showing projection rays, PnP pose constraints, triangulation intersection, reprojection residuals, and degeneracy cases.
- `10-knowledge-base/geometry-3d/coordinate-frames-projections-se3.md` - Visual needed: yes. Replacement visual: transform tree from map to odom to base to sensors to image plane, with SE(3) composition, projection, and common frame-error points.
- `10-knowledge-base/geometry-3d/correspondence-search-data-structures.md` - Visual needed: yes. Replacement visual: correspondence-search comparison showing query point, KD-tree partition, voxel hash buckets, candidate gating, residual construction, and rejected matches.
- `10-knowledge-base/geometry-3d/event-thermal-camera-models.md` - Visual needed: yes. Replacement visual: dual-sensor timing diagram contrasting asynchronous event threshold crossings with slower thermal frames, NUC/calibration, sync, and fusion.
- `10-knowledge-base/geometry-3d/geodesy-map-projections-datums.md` - Visual needed: yes. Replacement visual: WGS84 to ECEF to ENU to projected local-map chain with datum/projection distortion and localization error budget.
- `10-knowledge-base/geometry-3d/lidar-working-principles-noise-models.md` - Visual needed: yes. Replacement visual: LiDAR point formation diagram showing emitted pulse or chirp, time-of-flight/FMCW measurement, beam angle, reflectance, incidence angle, weather dropout, and range noise.
- `10-knowledge-base/geometry-3d/lie-groups-se3-so3-jacobians.md` - Visual needed: yes. Replacement visual: manifold/tangent-space diagram showing SO(3)/SE(3), Exp/log maps, left/right perturbations, adjoint transform, and residual Jacobian linearization.
- `10-knowledge-base/geometry-3d/multi-sensor-calibration-observability.md` - Visual needed: yes. Replacement visual: calibration factor graph linking camera, LiDAR, IMU, targetless constraints, time offset, motion excitation, and observability rank.
- `10-knowledge-base/geometry-3d/point-cloud-registration-math-icp-ndt-gicp.md` - Visual needed: yes. Replacement visual: registration iteration loop comparing ICP correspondences, GICP covariances, NDT grid cells, residual model, solve step, and local-minimum failure.
- `10-knowledge-base/geometry-3d/pointpillars.md` - Visual needed: yes. Replacement visual: PointPillars tensor pipeline from raw points to pillar grid/tensor, PFN pooling, BEV scatter, 2D backbone, and detector/world-model outputs.
- `10-knowledge-base/geometry-3d/rolling-shutter-lidar-deskew-motion-distortion.md` - Visual needed: yes. Replacement visual: time-sweep diagram showing camera rows and LiDAR points captured at different poses, ego-motion interpolation, deskew transform, and object-motion caveat.
- `10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md` - Visual needed: yes. Replacement visual: calibration contract diagram linking intrinsics, extrinsics, trigger source, timestamp semantics, clock alignment, validation logs, and fusion failure modes.
- `10-knowledge-base/geometry-3d/volume-rendering-radiance-fields-gaussian-splatting.md` - Visual needed: yes. Replacement visual: rendering pipeline comparing NeRF ray sampling/alpha compositing with Gaussian splat projection/rasterization and robotics-map constraints.

### Machine Learning

- `10-knowledge-base/machine-learning/attention-transformers-first-principles.md` - Visual needed: yes. Replacement visual: Q/K/V attention matrix with scaled scores, mask, softmax weights, value mixing, multi-head split/merge, and transformer block context.
- `10-knowledge-base/machine-learning/autoencoders-vae-and-latent-variable-models-first-principles.md` - Visual needed: yes. Replacement visual: encoder-latent-decoder path contrasting deterministic autoencoder bottleneck with VAE mean/variance, sampling, KL term, and reconstruction loss.
- `10-knowledge-base/machine-learning/backprop-computational-graphs-autodiff.md` - Visual needed: yes. Replacement visual: computational graph with forward values and reverse-mode vector-Jacobian products flowing back to parameters, including detach/graph-break warning points.
- `10-knowledge-base/machine-learning/contrastive-learning-infonsce-first-principles.md` - Visual needed: yes. Replacement visual: anchor-positive-negative embedding geometry plus batch similarity matrix showing InfoNCE temperature, positives, negatives, and leakage risks.
- `10-knowledge-base/machine-learning/convolutional-neural-networks.md` - Visual needed: yes. Replacement visual: grid convolution diagram showing shared kernel, stride, padding, dilation, receptive-field growth, feature pyramid, and aliasing tradeoff.
- `10-knowledge-base/machine-learning/diffusion-models.md` - Visual needed: yes. Replacement visual: forward noising and reverse denoising trajectory with score model, sampler steps, conditioning, and trajectory/video/occupancy use cases.
- `10-knowledge-base/machine-learning/diffusion-score-flow-samplers-first-principles.md` - Visual needed: yes. Replacement visual: score SDE, probability-flow ODE, DDIM/EDM sampler, and flow-matching vector-field comparison from noise to data manifold.
- `10-knowledge-base/machine-learning/energy-based-models-first-principles.md` - Visual needed: yes. Replacement visual: energy landscape with low-energy data, high-energy negatives, partition-function bottleneck, Langevin sampling loop, and OOD monitoring.
- `10-knowledge-base/machine-learning/evaluation-calibration-and-data-leakage-first-principles.md` - Visual needed: yes. Replacement visual: evaluation split firewall showing train/validation/test/calibration partitions, leakage paths, reliability diagram, and uncertainty interval.
- `10-knowledge-base/machine-learning/foundation-model-training-first-principles.md` - Visual needed: yes. Replacement visual: foundation-model lifecycle from data mixture through tokenization, pretraining objective, optimizer stability, adaptation, evaluation, and contamination control.
- `10-knowledge-base/machine-learning/initialization-normalization-regularization.md` - Visual needed: yes. Replacement visual: signal/gradient variance through depth showing Xavier/He initialization, normalization layers, dropout/weight decay, and unstable training failure.
- `10-knowledge-base/machine-learning/jepa-latent-predictive-learning.md` - Visual needed: yes. Replacement visual: JEPA context-target latent prediction architecture with context encoder, target encoder, predictor, stop-gradient/non-collapse mechanism, and MAE/contrastive comparison.
- `10-knowledge-base/machine-learning/logistic-softmax-cross-entropy.md` - Visual needed: yes. Replacement visual: logits-to-probabilities-to-loss flow showing sigmoid/softmax, thresholds, odds, class imbalance, cross-entropy, and calibration curve.
- `10-knowledge-base/machine-learning/mamba-ssm-for-driving.md` - Visual needed: yes. Replacement visual: selective state-space scan for driving sequences, contrasting recurrent state update with quadratic attention and highlighting long-context deployment.
- `10-knowledge-base/machine-learning/masked-modeling-first-principles.md` - Visual needed: yes. Replacement visual: masked modeling pipeline showing visible tokens, mask policy, encoder, target design, reconstruction/prediction head, and leakage pitfalls.
- `10-knowledge-base/machine-learning/multi-task-losses-and-objectives-first-principles.md` - Visual needed: yes. Replacement visual: shared-trunk multi-head network with classification, regression, occupancy/segmentation, flow/trajectory losses, weighting, and gradient-conflict vectors.
- `10-knowledge-base/machine-learning/multilayer-perceptrons-activations.md` - Visual needed: yes. Replacement visual: half-space features transformed by stacked linear layers and nonlinear activations into piecewise decision regions.
- `10-knowledge-base/machine-learning/optimization-training-dynamics.md` - Visual needed: yes. Replacement visual: loss-landscape trajectory comparing SGD, momentum, Adam/AdamW, learning-rate schedule, gradient clipping, and mixed-precision instability.
- `10-knowledge-base/machine-learning/overview.md` - Visual needed: yes. Replacement visual: actual reading-dependency ladder from linear models to CNN/RNN, transformers, SSL/tokenization, world models, and AV review usage.
- `10-knowledge-base/machine-learning/perceptron-linear-classifiers.md` - Visual needed: yes. Replacement visual: feature-space hyperplane with margin, misclassified point, perceptron update vector, multiclass score geometry, and regularization effect.
- `10-knowledge-base/machine-learning/positional-encodings-and-coordinate-tokenization-first-principles.md` - Visual needed: yes. Replacement visual: token grid with absolute position, relative bias, RoPE rotation, ALiBI slope, 2D/3D coordinates, and time encoding.
- `10-knowledge-base/machine-learning/recurrent-neural-networks-lstm-gru.md` - Visual needed: yes. Replacement visual: unfolded sequence showing hidden-state recurrence, BPTT, LSTM/GRU gates, online inference reset, and memory failure modes.
- `10-knowledge-base/machine-learning/self-supervised-learning-first-principles.md` - Visual needed: yes. Replacement visual: SSL objective decision map covering contrastive, bootstrap/DINO, masked autoencoding, and JEPA with AV evaluation handoff.
- `10-knowledge-base/machine-learning/sequence-models-rnn-ssm-attention-first-principles.md` - Visual needed: yes. Replacement visual: side-by-side memory mechanisms for RNN, gated RNN, SSM/S4, Mamba selective scan, and attention.
- `10-knowledge-base/machine-learning/sparse-attention-3d-perception.md` - Visual needed: yes. Replacement visual: sparse 3D attention layout showing points/voxels, windowing or serialization, neighbor attention, BEV aggregation, memory/latency budget, and Orin deployment path.
- `10-knowledge-base/machine-learning/state-space-models-s4-mamba-first-principles.md` - Visual needed: yes. Replacement visual: continuous-time SSM to discretized recurrence, convolution view, S4 kernel, selective scan, and attention duality.
- `10-knowledge-base/machine-learning/tokenization-and-discretization-first-principles.md` - Visual needed: yes. Replacement visual: sensor-to-token conversion map covering text, image/video patches, BEV/voxel/point tokens, quantization, FSQ, and rate-distortion artifacts.
- `10-knowledge-base/machine-learning/transformer-world-models.md` - Visual needed: yes. Replacement visual: autoregressive scene-token rollout with causal mask, positional encoding, action conditioning, KV cache, future prediction, and planner-cost interface.
- `10-knowledge-base/machine-learning/vision-transformers-first-principles.md` - Visual needed: yes. Replacement visual: image/BEV patch tokenization through ViT attention, hierarchy/windowing, deformable attention, BEVFormer geometry, and dense output recovery.
- `10-knowledge-base/machine-learning/vqvae-tokenization.md` - Visual needed: yes. Replacement visual: VQ-VAE encoder to nearest-code lookup, straight-through gradient path, codebook update, loss decomposition, and collapse diagnostics.
- `10-knowledge-base/machine-learning/world-model-evaluation-and-planning-objectives-first-principles.md` - Visual needed: yes. Replacement visual: open-loop versus closed-loop evaluation grid linking action conditioning, planning objective, occupancy/latent costs, uncertainty, and dataset split rules.
- `10-knowledge-base/machine-learning/world-models-first-principles.md` - Visual needed: yes. Replacement visual: sense-predict-act world-model loop with latent representation, dynamics rollout, planning/imagination, uncertainty, and SLAM/perception connections.

### Mapping

- `10-knowledge-base/mapping/occupancy-bayes-evidential-dynamic-grids.md` - Visual needed: yes. Replacement visual: ray-based occupancy update showing prior cell state, inverse sensor model, log-odds/evidential mass, dynamic occupancy, and diagnostic failure cases.
- `10-knowledge-base/mapping/volumetric-map-representations-tsdf-esdf-octree-surfels.md` - Visual needed: yes. Replacement visual: representation comparison showing occupancy, TSDF, ESDF, octree sparsity, surfels, and planner/collision/rendering tradeoffs.

### Numerical Linear Algebra

- `10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md` - Visual needed: yes. Replacement visual: residual Jacobian to normal equations to SPD check, Cholesky/LDLT factorization, conditioning warning, and solve/back-substitution path.
- `10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md` - Visual needed: yes. Replacement visual: Hessian eigen-spectrum separating well-constrained modes, weak modes, nullspace/gauge freedom, damping, priors, and excitation.
- `10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md` - Visual needed: yes. Replacement visual: QR and SVD least-squares factorization comparison showing rank threshold, singular values, nullspace, and why normal equations hide rank.
- `10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md` - Visual needed: yes. Replacement visual: block matrix and factor graph showing landmark/nuisance elimination, Schur complement, reduced pose system, marginalization prior, and PCG.
- `10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md` - Visual needed: yes. Replacement visual: sparse matrix before/after permutation showing fill-in, elimination graph, ordering choices, memory/runtime impact, and real-time feasibility.
- `10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md` - Visual needed: yes. Replacement visual: square-root information workflow showing whitened residuals, QR factor, information matrix, selected marginal covariance recovery, and dense inverse avoidance.

### Optimization

- `10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md` - Visual needed: yes. Replacement visual: unified factor-graph solver loop showing variables, factors, linearization, sparse solve, update, and Ceres/GTSAM/g2o API differences.
- `10-knowledge-base/optimization/gauss-newton-levenberg-marquardt-dogleg.md` - Visual needed: yes. Replacement visual: nonlinear step geometry comparing Gauss-Newton, LM damping, trust-region radius, dogleg path, accept/reject ratio, and failure modes.
- `10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md` - Visual needed: yes. Replacement visual: Jacobian-source comparison showing analytic, numeric, autodiff, manifold retraction, perturbation convention, and residual linearization.
- `10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md` - Visual needed: yes. Replacement visual: nonlinear least-squares iteration loop from residual construction to linearization, normal equations/solver, state update, convergence test, and diagnostics.
- `10-knowledge-base/optimization/trust-region-line-search-globalization.md` - Visual needed: yes. Replacement visual: trust-region versus line-search decision geometry showing local model, step candidate, ratio test, backtracking, radius update, and instability prevention.

### Probability And Statistics

- `10-knowledge-base/probability-statistics/detection-theory-roc-pr-operating-points.md` - Visual needed: yes. Replacement visual: detection-score distributions with threshold slider connected to confusion matrix, ROC curve, PR curve, operating point, and calibration.
- `10-knowledge-base/probability-statistics/gaussian-noise-covariance-information.md` - Visual needed: yes. Replacement visual: Gaussian covariance ellipse, whitening transform, information matrix dual, residual normalization, and estimator uncertainty interpretation.
- `10-knowledge-base/probability-statistics/information-theory-for-perception-ml.md` - Visual needed: yes. Replacement visual: relationship map for entropy, cross-entropy, KL, mutual information, compression, prediction error, and active sensing value.
- `10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md` - Visual needed: yes. Replacement visual: likelihood-prior-posterior flow showing MLE versus MAP, Gaussian residual to least squares, and objective surface.
- `10-knowledge-base/probability-statistics/mahalanobis-chi-square-gating.md` - Visual needed: yes. Replacement visual: innovation covariance ellipse with Mahalanobis distance, chi-square gate, NIS/NEES consistency, accepted/rejected measurements, and threshold tuning.
- `10-knowledge-base/probability-statistics/mixture-models-multimodal-beliefs.md` - Visual needed: yes. Replacement visual: multimodal density with mixture components, responsibilities, hypothesis weights, mean-collapse warning, and tracking/localization examples.
- `10-knowledge-base/probability-statistics/probabilistic-graphical-models-message-passing.md` - Visual needed: yes. Replacement visual: factor graph or Bayesian network with local messages, variable elimination, belief/marginal computation, and AV factor examples.
- `10-knowledge-base/probability-statistics/robust-statistics-ransac-hypothesis-testing.md` - Visual needed: yes. Replacement visual: inlier/outlier scatter with RANSAC hypotheses, consensus set, robust loss curve, hypothesis-test threshold, and failure diagnostics.
- `10-knowledge-base/probability-statistics/uncertainty-quantification-calibration-conformal.md` - Visual needed: yes. Replacement visual: reliability diagram plus conformal prediction-set construction showing calibration data, coverage guarantee, uncertainty type, and AV decision use.

### Robotics

- `10-knowledge-base/robotics/embodied-ai-crossover.md` - Visual needed: yes. Replacement visual: transfer map from robotics foundation models, diffusion policy, action tokenization, and embodied priors into constrained vehicle autonomy.
- `10-knowledge-base/robotics/lanelet2-maps.md` - Visual needed: yes. Replacement visual: Lanelet2 map primitive diagram showing lanelets, left/right bounds, regulatory elements, routing graph, airport extensions, and dynamic zones.
- `10-knowledge-base/robotics/planning-taxonomy-and-trajectory-generation.md` - Visual needed: yes. Replacement visual: layered planning stack from route to behavior to motion to trajectory validation to controller/runtime assurance.

### Sensors

- `10-knowledge-base/sensors/sensor-likelihoods-noise-error-budgets.md` - Visual needed: yes. Replacement visual: sensor likelihood/error-budget pipeline showing physical noise, covariance allocation, measurement model, gating/fusion, and diagnostics.

### Signal Processing

- `10-knowledge-base/signal-processing/cfar-detection-thresholding.md` - Visual needed: yes. Replacement visual: CFAR sliding window with cell-under-test, guard cells, training cells, clutter estimate, adaptive threshold, and detection output.
- `10-knowledge-base/signal-processing/radar-ambiguity-chirp-design-doppler-limits.md` - Visual needed: yes. Replacement visual: range-Doppler ambiguity diagram linking chirp slope, bandwidth, sampling rate, PRI, unambiguous range, and velocity limits.
- `10-knowledge-base/signal-processing/radar-fmcw-mimo-doppler.md` - Visual needed: yes. Replacement visual: FMCW/MIMO radar pipeline from chirps to beat frequency, range FFT, Doppler FFT, virtual array angle, CFAR, and ghost/multipath artifacts.
- `10-knowledge-base/signal-processing/sampling-fft-windowing-filtering.md` - Visual needed: yes. Replacement visual: sampling and frequency-domain diagram showing aliasing, FFT bins, spectral leakage, windowing, filter response, and implementation diagnostics.
- `10-knowledge-base/signal-processing/sensor-filtering-alpha-beta-kalman-complementary.md` - Visual needed: yes. Replacement visual: predict-correct filtering loop comparing alpha-beta, Kalman covariance gain, and complementary high/low-frequency split.

### State Estimation

- `10-knowledge-base/state-estimation/bayesian-filtering-and-eskf.md` - Visual needed: yes. Replacement visual: Bayesian/ESKF cycle showing nominal propagation, error-state covariance, measurement residual, Kalman correction, reset, and consistency checks.
- `10-knowledge-base/state-estimation/continuous-time-trajectory-splines-gp-priors.md` - Visual needed: yes. Replacement visual: continuous trajectory with spline knots, interpolated measurement times, GP prior factors, manifold state, and observability pitfalls.
- `10-knowledge-base/state-estimation/data-association-and-gating.md` - Visual needed: yes. Replacement visual: track-to-detection gating geometry with covariance ellipses, cost/assignment matrix, accepted/rejected pairs, and ambiguity cases.
- `10-knowledge-base/state-estimation/fusion-unknown-correlations-covariance-intersection.md` - Visual needed: yes. Replacement visual: two estimates with unknown cross-correlation flowing into covariance intersection, information weights, conservative covariance ellipse, and double-counting warning.
- `10-knowledge-base/state-estimation/gnss-rtk-error-models.md` - Visual needed: yes. Replacement visual: satellite/base/rover RTK geometry with carrier phase, integer ambiguity, atmospheric/multipath errors, corrections, covariance, and outage behavior.
- `10-knowledge-base/state-estimation/gtsam-factor-graphs.md` - Visual needed: yes. Replacement visual: GTSAM factor graph and Bayes tree showing pose variables, IMU/GNSS/LiDAR factors, linearization, incremental update, marginal, and custom factor lifecycle.
- `10-knowledge-base/state-estimation/imu-error-models-preintegration.md` - Visual needed: yes. Replacement visual: IMU preintegration timeline from high-rate samples through bias/noise model to preintegrated factor between keyframes, plus Allan variance cue.
- `10-knowledge-base/state-estimation/information-filters-and-smoothers.md` - Visual needed: yes. Replacement visual: covariance-form versus information-form update and smoother graph showing precision accumulation, sparse structure, and marginal recovery.
- `10-knowledge-base/state-estimation/localization-integrity-protection-levels-raim.md` - Visual needed: yes. Replacement visual: localization error distribution with alert limit, protection level, integrity risk, fault monitor, and hazardous misleading localization region.
- `10-knowledge-base/state-estimation/out-of-sequence-measurements-fixed-lag-smoothing.md` - Visual needed: yes. Replacement visual: measurement timeline showing acquisition time, arrival time, fixed-lag smoother window, retrodiction update, stale rejection, and replay policy.
- `10-knowledge-base/state-estimation/particle-filters-and-hypothesis-management.md` - Visual needed: yes. Replacement visual: particle-filter cycle showing proposal, weighting, resampling, multimodal posterior, hypothesis management, and degeneracy diagnostics.
- `10-knowledge-base/state-estimation/probabilistic-multi-object-association.md` - Visual needed: yes. Replacement visual: association probability matrix and hypothesis tree for JPDA/MHT showing ambiguous detections, track weights, and pruning.
- `10-knowledge-base/state-estimation/rtk-gps-imu-localization.md` - Visual needed: yes. Replacement visual: multi-sensor localization factor graph connecting GNSS/RTK, IMU preintegration, wheel odometry, LiDAR localization, frames, and GPS-denied fallback.
- `10-knowledge-base/state-estimation/slam-vio-observability-fej-nullspace-consistency.md` - Visual needed: yes. Replacement visual: SLAM/VIO factor graph and observability matrix showing gauge freedoms, nullspace, FEJ anchoring, rank diagnostics, and consistency checks.
- `10-knowledge-base/state-estimation/tracking-motion-models-track-lifecycle-metrics.md` - Visual needed: yes. Replacement visual: track lifecycle state machine with birth, tentative, confirmed, coasting, deletion, motion model choice, gating, and metric outputs.
- `10-knowledge-base/state-estimation/wheel-odometry-encoder-models.md` - Visual needed: yes. Replacement visual: encoder-to-pose-increment diagram showing ticks, wheel radius, baseline, Ackermann/differential/skid/crab kinematics, slip, calibration, and covariance.

### Systems Engineering

- `10-knowledge-base/systems-engineering/architecture-innovations.md` - Visual needed: yes. Replacement visual: architecture decision matrix for world models comparing SSM/Mamba, MoE, DiT, flow matching, tokenization, efficient attention, GNNs, retrieval, and test-time compute.
- `10-knowledge-base/systems-engineering/benchmarking-metrics-statistical-validity.md` - Visual needed: yes. Replacement visual: benchmark evidence pipeline from scenario sampling and split design to metrics, confidence intervals, statistical test, and release decision.
- `10-knowledge-base/systems-engineering/signal-processing-weather.md` - Visual needed: yes. Replacement visual: weather/degraded-operation chain from multi-return evidence through DSOR/LIOR, temporal filtering, severity state, jet-exhaust model, and planner/health response.
- `10-knowledge-base/systems-engineering/theoretical-foundations.md` - Visual needed: yes. Replacement visual: world-model theory dependency map connecting formal dynamics, predictive coding, representation learning, causality, control/game theory, safety ML, and scaling/generalization.
- `10-knowledge-base/systems-engineering/time-sync-ptp-timestamping-latency-models.md` - Visual needed: yes. Replacement visual: PTP timestamp exchange and latency model showing grandmaster, sync/follow-up, hardware timestamp, path delay, offset correction, and fusion impact.
- `10-knowledge-base/systems-engineering/time-synchronization-error-budgets.md` - Visual needed: yes. Replacement visual: timing-error-to-spatial-error budget stack showing clock offset, exposure delay, transport latency, fusion timestamp, vehicle speed, and sensor-specific effects.

## Implementation Implication

If the generated figures are removed, the replacement backlog is not 14 optional pages; it is all 99 pages. Batch work should still be prioritized, but the baseline target changes to one purpose-built diagram per knowledge-base file.

Suggested replacement order:

1. Keep the already-curated Batch 1 pages as the reference quality bar.
2. Replace remaining math-heavy algorithm pages first: controls, geometry, optimization, probability/statistics, signal processing, and state estimation.
3. Replace long ML/world-model pages next because they carry many concepts and will benefit from tighter diagram layouts.
4. Replace overview and systems pages last with dependency maps, architecture decision diagrams, and evidence pipelines.
