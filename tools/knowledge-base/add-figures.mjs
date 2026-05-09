#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const figureRoot = path.join(repoRoot, '10-knowledge-base', '_assets', 'figures')
const markerStart = '<!-- kb-figure:start -->'
const markerEnd = '<!-- kb-figure:end -->'

const figures = [
  ['controls', 'constrained-optimization-mpc-ilqr-first-principles', 'loop', 'Receding-horizon constrained control loop', ['state estimate', 'model rollout', 'costs and limits', 'NLP or QP solve', 'first control'], 'how MPC and iLQR repeatedly convert state estimates, constraints, and costs into the next applied control.'],
  ['controls', 'frenet-trajectory-math', 'geometry', 'Frenet trajectory frame', ['centerline s', 'lateral d', 'curvature', 'sampled path', 'vehicle bounds'], 'how road-aligned s-d coordinates turn a curved operating corridor into a tractable trajectory optimization space.'],
  ['controls', 'mdp-pomdp-belief-space-rl-first-principles', 'graph', 'Belief-space decision model', ['state', 'action', 'observation', 'belief', 'value'], 'how an agent updates hidden-state belief from observations before choosing actions under uncertainty.'],
  ['controls', 'vehicle-dynamics-and-control', 'stack', 'Vehicle model fidelity ladder', ['kinematic bicycle', 'dynamic bicycle', 'tire forces', 'actuators', 'controller'], 'how control models move from simple path tracking to force, slip, and actuator-limited vehicle behavior.'],

  ['geometry-3d', 'camera-imaging-noise-calibration', 'geometry', 'Camera measurement and calibration chain', ['scene point', 'lens distortion', 'sensor noise', 'calibration target', 'timestamp'], 'how photons, lens geometry, sensor noise, and timing all affect the pixel measurement used by perception and SLAM.'],
  ['geometry-3d', 'camera-projective-geometry-pnp-triangulation', 'geometry', 'Projection, PnP, and triangulation geometry', ['3D landmark', 'camera pose', 'image ray', 'PnP solve', 'triangulated point'], 'how 3D points, camera poses, and image rays form the core constraints behind PnP and triangulation.'],
  ['geometry-3d', 'coordinate-frames-projections-se3', 'graph', 'SE(3) frame chain', ['map', 'odom', 'base_link', 'sensor', 'image'], 'how autonomy stacks compose map, odometry, vehicle, sensor, and image frames through SE(3) transforms.'],
  ['geometry-3d', 'correspondence-search-data-structures', 'split', 'Correspondence search choices', ['query point', 'KD-tree', 'voxel hash', 'candidate set', 'match gate'], 'how nearest-neighbor data structures reduce raw geometric matching to a gated candidate set.'],
  ['geometry-3d', 'event-thermal-camera-models', 'timeline', 'Event and thermal sensing timeline', ['brightness event', 'contrast threshold', 'thermal frame', 'sync point', 'fusion update'], 'how asynchronous event streams and slower thermal frames carry different timing and noise assumptions.'],
  ['geometry-3d', 'geodesy-map-projections-datums', 'geometry', 'Global-to-local map frame conversion', ['WGS84', 'ECEF', 'ENU', 'projection', 'local map'], 'how satellite coordinates become a local metric frame that localization, mapping, and planning can share.'],
  ['geometry-3d', 'lidar-working-principles-noise-models', 'geometry', 'LiDAR point formation', ['laser pulse', 'time of flight', 'scan angle', 'intensity', 'range noise'], 'how timing, beam geometry, reflectance, and range noise produce each point in a LiDAR scan.'],
  ['geometry-3d', 'lie-groups-se3-so3-jacobians', 'graph', 'Lie-group residual linearization', ['tangent update', 'Exp map', 'SE(3) pose', 'Adjoint', 'residual'], 'how small tangent-space updates become pose updates and Jacobians on SO(3) and SE(3).'],
  ['geometry-3d', 'multi-sensor-calibration-observability', 'graph', 'Calibration observability graph', ['camera', 'LiDAR', 'IMU', 'target', 'time offset'], 'how extrinsics, time offsets, targets, and motion excitation determine whether calibration states are observable.'],
  ['geometry-3d', 'point-cloud-registration-math-icp-ndt-gicp', 'loop', 'Point-cloud registration loop', ['source cloud', 'correspondence', 'residual model', 'solve transform', 'aligned cloud'], 'how ICP, GICP, VGICP, and NDT iterate between matching, residual construction, and pose update.'],
  ['geometry-3d', 'pointpillars', 'pipeline', 'PointPillars tensor path', ['raw points', 'pillars', 'PFN features', 'BEV canvas', 'detection head'], 'how unordered points become pillar features, a BEV feature map, and final 3D detections.'],
  ['geometry-3d', 'rolling-shutter-lidar-deskew-motion-distortion', 'timeline', 'Motion distortion and deskew timeline', ['exposure start', 'ego motion', 'per-point time', 'pose interpolation', 'deskewed scan'], 'how rolling cameras and spinning LiDARs require per-row or per-point pose correction during vehicle motion.'],
  ['geometry-3d', 'sensor-calibration-time-synchronization', 'timeline', 'Calibration and synchronization contract', ['sensor clock', 'trigger', 'timestamp', 'extrinsic', 'validation log'], 'how time, trigger semantics, and extrinsic calibration must agree before multi-sensor fusion is trustworthy.'],
  ['geometry-3d', 'volume-rendering-radiance-fields-gaussian-splatting', 'pipeline', 'Radiance-field rendering path', ['camera ray', 'samples', 'opacity weights', 'rendered pixel', 'robotics map'], 'how NeRF-style volume rendering and Gaussian splatting turn scene representations into pixels and map evidence.'],

  ['machine-learning', 'attention-transformers-first-principles', 'matrix', 'Attention score matrix', ['tokens', 'QK scores', 'softmax', 'values', 'heads'], 'how token-to-token scores become normalized attention weights and multi-head feature mixing.'],
  ['machine-learning', 'autoencoders-vae-and-latent-variable-models-first-principles', 'pipeline', 'Latent variable reconstruction path', ['input', 'encoder', 'latent z', 'decoder', 'reconstruction'], 'how autoencoders compress observations and how latent-variable models add a probabilistic bottleneck.'],
  ['machine-learning', 'backprop-computational-graphs-autodiff', 'graph', 'Reverse-mode autodiff graph', ['loss', 'local Jacobian', 'VJP', 'parameter', 'gradient'], 'how backprop moves vector-Jacobian products backward through the computational graph to train parameters.'],
  ['machine-learning', 'contrastive-learning-infonsce-first-principles', 'chart', 'InfoNCE embedding geometry', ['anchor', 'positive', 'negatives', 'temperature', 'softmax loss'], 'how contrastive learning pulls paired views together while pushing competing negatives apart.'],
  ['machine-learning', 'convolutional-neural-networks', 'matrix', 'Convolutional receptive field', ['local patch', 'shared kernel', 'feature map', 'stride', 'receptive field'], 'how locality and weight sharing turn image or BEV grids into increasingly abstract feature maps.'],
  ['machine-learning', 'diffusion-models', 'timeline', 'Diffusion forward and reverse processes', ['clean sample', 'noise step', 'score model', 'denoise step', 'generated sample'], 'how diffusion models destroy structure with noise and learn the reverse denoising trajectory.'],
  ['machine-learning', 'diffusion-score-flow-samplers-first-principles', 'chart', 'Score and flow sampler paths', ['data manifold', 'noisy state', 'score field', 'ODE path', 'SDE path'], 'how score models and flow matching define vector fields that guide samples back toward the data distribution.'],
  ['machine-learning', 'energy-based-models-first-principles', 'chart', 'Energy landscape view', ['low energy data', 'high energy negatives', 'partition function', 'sampler', 'gradient'], 'how energy-based models represent compatibility through an energy surface rather than a direct normalized predictor.'],
  ['machine-learning', 'evaluation-calibration-and-data-leakage-first-principles', 'split', 'Evaluation split firewall', ['training data', 'validation tuning', 'test set', 'calibration set', 'leakage barrier'], 'how dataset partitioning, calibration, and leakage control define whether evaluation evidence is credible.'],
  ['machine-learning', 'foundation-model-training-first-principles', 'pipeline', 'Foundation-model training lifecycle', ['data mixture', 'tokenizer', 'pretraining', 'adaptation', 'evaluation'], 'how large reusable models move from broad data mixtures to task-specific AV evaluation.'],
  ['machine-learning', 'initialization-normalization-regularization', 'stack', 'Trainability stabilizers', ['initialization', 'activation scale', 'normalization', 'regularization', 'gradient flow'], 'how initialization, normalization, and regularization keep deep networks numerically trainable.'],
  ['machine-learning', 'jepa-latent-predictive-learning', 'split', 'JEPA latent prediction path', ['context view', 'context encoder', 'target encoder', 'predictor', 'latent loss'], 'how JEPA predicts target representations from context without reconstructing pixels.'],
  ['machine-learning', 'logistic-softmax-cross-entropy', 'chart', 'Scores to probabilities to loss', ['logit', 'sigmoid', 'softmax', 'threshold', 'cross entropy'], 'how classifier scores become probabilities, decisions, and calibration-sensitive losses.'],
  ['machine-learning', 'mamba-ssm-for-driving', 'pipeline', 'Selective state-space sequence model', ['input stream', 'selective SSM', 'scan state', 'output token', 'long context'], 'how Mamba-style selective state spaces process long driving sequences with recurrent state rather than full attention.'],
  ['machine-learning', 'masked-modeling-first-principles', 'pipeline', 'Masked modeling objective', ['visible tokens', 'mask', 'encoder', 'predictor', 'reconstruction'], 'how masked objectives force representations to infer missing visual, BEV, or sequence content.'],
  ['machine-learning', 'multi-task-losses-and-objectives-first-principles', 'graph', 'Shared trunk and task losses', ['shared features', 'classification', 'regression', 'occupancy', 'weighted sum'], 'how multiple task heads compete or cooperate through a shared feature extractor and weighted objective.'],
  ['machine-learning', 'multilayer-perceptrons-activations', 'stack', 'MLP nonlinear feature stack', ['input', 'linear layer', 'activation', 'hidden layer', 'output'], 'why nonlinear activations make stacked linear transforms useful as function approximators.'],
  ['machine-learning', 'optimization-training-dynamics', 'chart', 'Training trajectory dynamics', ['gradient descent', 'momentum', 'Adam', 'learning rate', 'validation curve'], 'how optimizer state, learning rate, and noisy gradients shape the route through the loss landscape.'],
  ['machine-learning', 'overview', 'hierarchy', 'Machine-learning foundations ladder', ['linear models', 'CNN and RNN', 'transformers', 'SSL and tokens', 'world models'], 'how the machine-learning knowledge base builds from simple classifiers toward AV world models.'],
  ['machine-learning', 'perceptron-linear-classifiers', 'geometry', 'Linear decision boundary', ['feature point', 'hyperplane', 'margin', 'mistake', 'weight update'], 'how perceptrons and linear classifiers separate feature space and update after mistakes.'],
  ['machine-learning', 'positional-encodings-and-coordinate-tokenization-first-principles', 'matrix', 'Position-aware token grid', ['token grid', 'absolute code', 'relative bias', 'RoPE', 'time code'], 'how coordinates and time become model inputs so sequence or spatial tokens keep geometric meaning.'],
  ['machine-learning', 'recurrent-neural-networks-lstm-gru', 'timeline', 'Recurrent hidden-state flow', ['input t', 'hidden state', 'gates', 'output t', 'state reset'], 'how RNN, LSTM, and GRU models carry temporal memory across a sequence.'],
  ['machine-learning', 'self-supervised-learning-first-principles', 'split', 'Self-supervised two-view training', ['view A', 'online encoder', 'view B', 'target encoder', 'pretext loss'], 'how unlabeled data creates paired prediction or contrastive tasks for representation learning.'],
  ['machine-learning', 'sequence-models-rnn-ssm-attention-first-principles', 'timeline', 'Sequence model memory choices', ['RNN state', 'SSM scan', 'attention memory', 'Mamba state', 'reset policy'], 'how recurrent, state-space, attention, and Mamba models store and update temporal context.'],
  ['machine-learning', 'sparse-attention-3d-perception', 'map', 'Sparse 3D attention pattern', ['point cloud', 'voxel window', 'sparse attention', 'BEV feature', 'detector'], 'how point or voxel sparsity limits attention to useful neighborhoods for real-time 3D perception.'],
  ['machine-learning', 'state-space-models-s4-mamba-first-principles', 'chart', 'State-space model views', ['continuous state', 'discretization', 'convolution', 'selective scan', 'output'], 'how continuous dynamics, convolution views, and selective scanning connect S4 and Mamba models.'],
  ['machine-learning', 'tokenization-and-discretization-first-principles', 'pipeline', 'Sensor-to-token conversion', ['raw sensor', 'patches or voxels', 'quantizer', 'tokens', 'sequence model'], 'how continuous sensor signals become discrete or structured tokens for foundation and world models.'],
  ['machine-learning', 'transformer-world-models', 'pipeline', 'Autoregressive world-model rollout', ['scene tokens', 'causal attention', 'action condition', 'future rollout', 'planner cost'], 'how transformer world models condition on past scene tokens and actions to forecast futures for planning.'],
  ['machine-learning', 'vision-transformers-first-principles', 'matrix', 'Vision transformer patch flow', ['image patches', 'embeddings', 'attention', 'dense head', 'BEV output'], 'how ViT-style models tokenize images and recover dense spatial outputs for perception.'],
  ['machine-learning', 'vqvae-tokenization', 'pipeline', 'VQ-VAE discrete bottleneck', ['encoder', 'nearest code', 'straight-through', 'decoder', 'code usage'], 'how vector quantization turns continuous features into reusable discrete tokens while preserving gradient flow.'],
  ['machine-learning', 'world-model-evaluation-and-planning-objectives-first-principles', 'split', 'World-model evaluation modes', ['open loop', 'closed loop', 'action condition', 'planning cost', 'uncertainty'], 'how predictive quality, closed-loop behavior, planner costs, and uncertainty must be evaluated together.'],
  ['machine-learning', 'world-models-first-principles', 'loop', 'World-model sense-predict-act loop', ['perception tokens', 'latent dynamics', 'future prediction', 'planner', 'action'], 'how a world model learns latent dynamics that support prediction, planning, and action selection.'],

  ['mapping', 'occupancy-bayes-evidential-dynamic-grids', 'map', 'Occupancy grid evidence update', ['prior cell', 'sensor ray', 'log odds', 'evidence mass', 'dynamic state'], 'how grid cells accumulate probabilistic or evidential updates and track dynamic occupancy over time.'],
  ['mapping', 'volumetric-map-representations-tsdf-esdf-octree-surfels', 'stack', 'Volumetric map representation ladder', ['occupancy', 'TSDF', 'ESDF', 'octree', 'surfels'], 'how different volumetric maps trade surface accuracy, free-space distance, sparsity, and rendering detail.'],

  ['numerical-linear-algebra', 'cholesky-ldlt-normal-equations', 'matrix', 'Normal-equation factorization path', ['J transpose J', 'SPD check', 'Cholesky', 'LDLT', 'backsolve'], 'how least-squares systems become factored matrices and why conditioning matters before back-substitution.'],
  ['numerical-linear-algebra', 'eigenvalues-hessian-conditioning-observability', 'chart', 'Hessian spectrum and observability', ['large eigenvalue', 'small eigenvalue', 'nullspace', 'condition number', 'damping'], 'how Hessian eigenvalues reveal well-constrained, weakly constrained, and unobservable directions.'],
  ['numerical-linear-algebra', 'qr-svd-rank-revealing-solvers', 'matrix', 'Rank-revealing solver choices', ['QR', 'SVD', 'rank', 'least squares', 'nullspace'], 'how QR and SVD expose rank and solve least-squares problems without relying only on normal equations.'],
  ['numerical-linear-algebra', 'schur-complement-marginalization-pcg', 'graph', 'Schur complement elimination', ['pose states', 'landmarks', 'eliminate', 'reduced system', 'PCG'], 'how landmark or nuisance-state elimination creates a smaller reduced system for iterative solving.'],
  ['numerical-linear-algebra', 'sparse-matrices-fill-in-ordering', 'matrix', 'Sparse factor fill-in', ['sparsity graph', 'ordering', 'permutation', 'fill-in', 'factor'], 'how variable ordering changes fill-in and therefore runtime and memory for sparse factorization.'],
  ['numerical-linear-algebra', 'square-root-information-and-covariance-recovery', 'matrix', 'Square-root information workflow', ['residual Jacobian', 'QR factor', 'sqrt information', 'marginal', 'covariance'], 'how square-root forms improve numerical stability and support covariance recovery.'],

  ['optimization', 'factor-graph-solver-patterns-ceres-gtsam-g2o', 'graph', 'Factor-graph solver workflow', ['variables', 'factors', 'linearize', 'sparse solve', 'update'], 'how Ceres, GTSAM, and g2o share the same factor-graph optimization skeleton.'],
  ['optimization', 'gauss-newton-levenberg-marquardt-dogleg', 'chart', 'Nonlinear optimizer step geometry', ['Gauss-Newton', 'LM damping', 'trust region', 'dogleg path', 'accept ratio'], 'how Gauss-Newton, Levenberg-Marquardt, and Dogleg choose update steps under nonlinearity.'],
  ['optimization', 'jacobians-autodiff-manifold-linearization', 'split', 'Jacobian construction choices', ['analytic', 'numeric', 'autodiff', 'retract', 'residual'], 'how derivative source and manifold update convention affect the linearized residual used by solvers.'],
  ['optimization', 'nonlinear-least-squares-first-principles', 'loop', 'Nonlinear least-squares iteration', ['residuals', 'linearize', 'normal equations', 'state update', 'convergence'], 'how residual minimization repeatedly linearizes, solves, updates, and checks convergence.'],
  ['optimization', 'trust-region-line-search-globalization', 'chart', 'Globalization decision surface', ['local model', 'trust radius', 'line search', 'accept step', 'shrink or grow'], 'how globalization methods keep nonlinear solvers from taking unstable or overconfident steps.'],

  ['probability-statistics', 'detection-theory-roc-pr-operating-points', 'chart', 'Detection operating point tradeoff', ['score distributions', 'threshold', 'ROC', 'precision-recall', 'operating point'], 'how thresholds move between misses, false alarms, ROC behavior, and precision-recall behavior.'],
  ['probability-statistics', 'gaussian-noise-covariance-information', 'geometry', 'Gaussian covariance and whitening', ['mean', 'covariance ellipse', 'whitening', 'information matrix', 'uncertainty'], 'how covariance shape, information form, and whitening change the geometry of Gaussian uncertainty.'],
  ['probability-statistics', 'information-theory-for-perception-ml', 'chart', 'Information-theory quantities', ['entropy', 'cross entropy', 'KL', 'mutual information', 'active sensing'], 'how information measures quantify uncertainty, compression, prediction error, and sensor value.'],
  ['probability-statistics', 'likelihood-map-mle-least-squares', 'chart', 'Likelihood to MAP estimate', ['likelihood', 'prior', 'posterior', 'MLE', 'MAP'], 'how likelihoods and priors become MLE, MAP, and least-squares objectives.'],
  ['probability-statistics', 'mahalanobis-chi-square-gating', 'geometry', 'Mahalanobis gating ellipse', ['innovation', 'covariance', 'chi-square gate', 'NIS', 'NEES'], 'how covariance-normalized distance decides whether a measurement is statistically plausible.'],
  ['probability-statistics', 'mixture-models-multimodal-beliefs', 'chart', 'Multimodal belief mixture', ['mode A', 'mode B', 'weights', 'responsibility', 'hypothesis'], 'how mixture components preserve multiple plausible explanations instead of collapsing to one mean.'],
  ['probability-statistics', 'probabilistic-graphical-models-message-passing', 'graph', 'Message-passing graphical model', ['variable', 'factor', 'message', 'belief', 'marginal'], 'how graphical models move local messages through a dependency graph to compute beliefs and marginals.'],
  ['probability-statistics', 'robust-statistics-ransac-hypothesis-testing', 'chart', 'Robust estimation with outliers', ['inliers', 'outliers', 'sample', 'consensus', 'robust loss'], 'how RANSAC and robust losses protect estimates from outlier-dominated residuals.'],
  ['probability-statistics', 'uncertainty-quantification-calibration-conformal', 'chart', 'Calibration and conformal coverage', ['probability bin', 'observed accuracy', 'ECE', 'prediction set', 'coverage'], 'how reliability diagrams and conformal prediction connect confidence to empirical coverage.'],

  ['robotics', 'embodied-ai-crossover', 'pipeline', 'Embodied AI transfer path', ['robot data', 'foundation policy', 'skill prior', 'vehicle adaptation', 'safety layer'], 'how robotics foundation models transfer useful priors into vehicle autonomy while requiring safety constraints.'],
  ['robotics', 'lanelet2-maps', 'map', 'Lanelet2 routing primitives', ['lanelet', 'boundary', 'regulatory element', 'routing graph', 'airport extension'], 'how lanelets, boundaries, regulatory elements, and routing graphs encode drivable structure.'],
  ['robotics', 'planning-taxonomy-and-trajectory-generation', 'hierarchy', 'Planning stack taxonomy', ['route', 'behavior', 'motion', 'trajectory', 'control'], 'how route, behavior, motion, trajectory, and control layers divide planning responsibilities.'],

  ['sensors', 'sensor-likelihoods-noise-error-budgets', 'stack', 'Sensor likelihood error budget', ['sensor model', 'noise source', 'likelihood', 'covariance', 'fusion gate'], 'how physical sensor noise becomes likelihoods, covariances, gates, and fusion decisions.'],

  ['signal-processing', 'cfar-detection-thresholding', 'chart', 'CFAR threshold window', ['training cells', 'guard cells', 'cell under test', 'threshold', 'detection'], 'how CFAR estimates local clutter statistics and sets an adaptive detection threshold.'],
  ['signal-processing', 'radar-ambiguity-chirp-design-doppler-limits', 'chart', 'Radar range-Doppler ambiguity', ['chirp slope', 'range bin', 'Doppler shift', 'ambiguity', 'limits'], 'how chirp design and sampling choices bound unambiguous radar range and velocity.'],
  ['signal-processing', 'radar-fmcw-mimo-doppler', 'pipeline', 'FMCW MIMO radar processing chain', ['chirp', 'mixer', 'range FFT', 'Doppler FFT', 'angle estimate'], 'how FMCW radar turns beat frequencies and antenna phase into range, velocity, and angle.'],
  ['signal-processing', 'sampling-fft-windowing-filtering', 'chart', 'Sampling and spectral leakage', ['sampled signal', 'window', 'FFT bins', 'filter', 'aliasing'], 'how sampling, windowing, and filtering control frequency-domain artifacts and aliasing.'],
  ['signal-processing', 'sensor-filtering-alpha-beta-kalman-complementary', 'loop', 'Filtering predict-correct loop', ['prediction', 'measurement', 'gain', 'correction', 'smoothed state'], 'how alpha-beta, Kalman, and complementary filters blend prediction and measurement updates.'],

  ['state-estimation', 'bayesian-filtering-and-eskf', 'loop', 'Bayesian ESKF cycle', ['predict', 'error state', 'measurement', 'covariance', 'reset'], 'how filters propagate nominal state, estimate error-state corrections, and reset after measurement updates.'],
  ['state-estimation', 'continuous-time-trajectory-splines-gp-priors', 'timeline', 'Continuous-time trajectory interpolation', ['knot pose', 'spline segment', 'GP prior', 'measurement time', 'interpolated pose'], 'how splines and Gaussian-process priors support measurements arriving between discrete keyframes.'],
  ['state-estimation', 'data-association-and-gating', 'map', 'Track-to-detection association', ['track prediction', 'gate', 'detections', 'assignment', 'updated track'], 'how gating and assignment connect uncertain detections to existing tracks.'],
  ['state-estimation', 'gnss-rtk-error-models', 'geometry', 'RTK-GNSS correction geometry', ['satellite', 'carrier phase', 'base station', 'integer ambiguity', 'rover pose'], 'how RTK uses carrier phase, base corrections, and ambiguity resolution to improve GNSS localization.'],
  ['state-estimation', 'gtsam-factor-graphs', 'graph', 'GTSAM factor graph and Bayes tree', ['pose variable', 'IMU factor', 'GNSS factor', 'Bayes tree', 'marginal'], 'how GTSAM represents multi-sensor constraints and updates them through factor graph inference.'],
  ['state-estimation', 'imu-error-models-preintegration', 'timeline', 'IMU preintegration between keyframes', ['keyframe i', 'IMU samples', 'bias model', 'preintegrated factor', 'keyframe j'], 'how many high-rate IMU samples become one bias-aware factor between estimator keyframes.'],
  ['state-estimation', 'information-filters-and-smoothers', 'graph', 'Information-form smoothing graph', ['information matrix', 'prediction', 'measurement', 'smoother', 'marginal'], 'how information filters and smoothers accumulate constraints in precision form.'],
  ['state-estimation', 'particle-filters-and-hypothesis-management', 'chart', 'Particle posterior update', ['particles', 'weights', 'resampling', 'hypotheses', 'posterior'], 'how sample sets approximate multimodal beliefs and manage competing hypotheses.'],
  ['state-estimation', 'probabilistic-multi-object-association', 'matrix', 'Probabilistic association matrix', ['tracks', 'detections', 'association probability', 'JPDA', 'MHT'], 'how multi-object trackers represent ambiguous detection-to-track assignments probabilistically.'],
  ['state-estimation', 'rtk-gps-imu-localization', 'pipeline', 'Multi-sensor localization fusion', ['GNSS/RTK', 'IMU', 'wheel odometry', 'LiDAR match', 'factor graph pose'], 'how GNSS, inertial, wheel, and LiDAR evidence combine into a fused localization estimate.'],
  ['state-estimation', 'tracking-motion-models-track-lifecycle-metrics', 'timeline', 'Track lifecycle timeline', ['birth', 'tentative', 'confirmed', 'coast', 'delete'], 'how a tracker manages object existence from birth through confirmation, missed detections, and deletion.'],
  ['state-estimation', 'wheel-odometry-encoder-models', 'geometry', 'Wheel encoder odometry model', ['encoder ticks', 'wheel radius', 'baseline', 'slip', 'pose increment'], 'how encoder ticks, vehicle geometry, slip, and covariance produce a local odometry constraint.'],

  ['systems-engineering', 'architecture-innovations', 'hierarchy', 'World-model architecture menu', ['SSM/Mamba', 'MoE', 'diffusion transformer', 'GNN', 'retrieval'], 'how architecture choices offer different scaling, memory, routing, and generation tradeoffs for world models.'],
  ['systems-engineering', 'benchmarking-metrics-statistical-validity', 'pipeline', 'Benchmark evidence pipeline', ['scenario split', 'metric estimator', 'confidence interval', 'significance', 'release decision'], 'how benchmark design turns scenario samples into statistically defensible release evidence.'],
  ['systems-engineering', 'signal-processing-weather', 'pipeline', 'Weather-robust signal-processing chain', ['multi-return', 'DSOR/LIOR', 'temporal filter', 'weather state', 'health monitor'], 'how adverse-weather filtering chains combine signal cleanup, temporal consistency, and sensor health evidence.'],
  ['systems-engineering', 'theoretical-foundations', 'graph', 'World-model theory dependency graph', ['predictive coding', 'representation', 'causality', 'control', 'safety'], 'how theoretical views connect prediction, representation learning, control, causality, and safety.'],
  ['systems-engineering', 'time-sync-ptp-timestamping-latency-models', 'timeline', 'PTP timestamp exchange', ['grandmaster', 'sync message', 'hardware timestamp', 'latency model', 'clock correction'], 'how PTP-style exchanges and hardware timestamps estimate and correct sensor clock offsets.'],
  ['systems-engineering', 'time-synchronization-error-budgets', 'timeline', 'Time error to spatial error budget', ['clock offset', 'exposure delay', 'transport latency', 'fusion time', 'spatial error'], 'how timing errors become spatial misalignment in moving multi-sensor autonomy systems.']
]

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeMarkdown(value) {
  return String(value).replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function wrapText(value, maxChars = 15) {
  const words = String(value).split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function textBlock(value, x, y, options = {}) {
  const lines = wrapText(value, options.maxChars ?? 16)
  const size = options.size ?? 22
  const weight = options.weight ?? 700
  const fill = options.fill ?? '#0f172a'
  const anchor = options.anchor ?? 'middle'
  const lineHeight = size * 1.15

  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join('\n')
}

function arrow(x1, y1, x2, y2, color = '#2563eb') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>`
}

function nodeRect(x, y, w, h, label, color = '#dbeafe') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" stroke="#2563eb" stroke-width="2"/>
${textBlock(label, x + w / 2, y + h / 2 - 6, { maxChars: 13, size: 20 })}`
}

function svgFrame(spec, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(spec.title)}</title>
  <desc id="desc">${escapeXml(spec.caption)}</desc>
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#2563eb"/>
    </marker>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="1200" height="620" fill="#f8fafc"/>
  <rect x="36" y="34" width="1128" height="552" rx="28" fill="#ffffff" stroke="#d8dee9" filter="url(#shadow)"/>
  <text x="70" y="88" font-size="32" font-weight="800" fill="#0f172a">${escapeXml(spec.title)}</text>
  <rect x="70" y="108" width="1060" height="2" fill="#dbeafe"/>
  ${inner}
</svg>
`
}

function renderPipeline(spec, loop = false) {
  const w = 176
  const gap = 34
  const x0 = 86
  const y = 245
  const parts = spec.nodes.map((label, index) => {
    const x = x0 + index * (w + gap)
    const rect = nodeRect(x, y, w, 104, label)
    const link = index < spec.nodes.length - 1 ? arrow(x + w + 7, y + 52, x + w + gap - 8, y + 52) : ''
    return `${rect}\n${link}`
  }).join('\n')
  const feedback = loop
    ? `<path d="M1006 372 C1006 470 178 470 178 372" fill="none" stroke="#0f766e" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>
${textBlock('feedback', 590, 500, { size: 18, fill: '#0f766e' })}`
    : ''
  return svgFrame(spec, `${parts}\n${feedback}`)
}

function renderStack(spec) {
  const x = 370
  const y0 = 150
  const h = 70
  const gap = 18
  const colors = ['#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fee2e2']
  const blocks = spec.nodes.map((label, index) => {
    const y = y0 + index * (h + gap)
    return `<rect x="${x}" y="${y}" width="460" height="${h}" rx="16" fill="${colors[index % colors.length]}" stroke="#334155" stroke-width="1.5"/>
${textBlock(label, x + 230, y + 43, { maxChars: 24, size: 21 })}`
  }).join('\n')
  return svgFrame(spec, `${blocks}
${arrow(600, 128, 600, 565, '#0f766e')}`)
}

function renderHierarchy(spec) {
  const rootX = 600
  const rootY = 160
  const childY = 350
  const xs = [150, 375, 600, 825, 1050]
  const root = nodeRect(rootX - 145, rootY - 48, 290, 92, spec.title.split(' ').slice(0, 3).join(' '), '#eef2ff')
  const children = spec.nodes.map((label, index) => {
    const x = xs[index]
    return `${arrow(rootX, rootY + 50, x, childY - 54, '#64748b')}
${nodeRect(x - 82, childY - 44, 164, 88, label, '#dbeafe')}`
  }).join('\n')
  return svgFrame(spec, `${root}\n${children}`)
}

function renderGraph(spec) {
  const vars = [[190, 205], [415, 170], [640, 205], [865, 170], [1010, 310]]
  const factors = [[300, 335], [530, 345], [760, 335], [905, 430]]
  const labels = spec.nodes
  const edges = [
    [vars[0], factors[0]], [vars[1], factors[0]], [vars[1], factors[1]], [vars[2], factors[1]],
    [vars[2], factors[2]], [vars[3], factors[2]], [vars[3], factors[3]], [vars[4], factors[3]]
  ].map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#94a3b8" stroke-width="3"/>`).join('\n')
  const varNodes = vars.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="48" fill="#dbeafe" stroke="#2563eb" stroke-width="3"/>
${textBlock(labels[index] ?? `var ${index + 1}`, x, y + 6, { maxChars: 11, size: 17 })}`).join('\n')
  const factorNodes = factors.map(([x, y], index) => `<rect x="${x - 30}" y="${y - 30}" width="60" height="60" rx="10" fill="#fef3c7" stroke="#ca8a04" stroke-width="3"/>
<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="23" font-weight="800" fill="#713f12">f${index + 1}</text>`).join('\n')
  return svgFrame(spec, `${edges}\n${factorNodes}\n${varNodes}`)
}

function renderSplit(spec) {
  const input = nodeRect(90, 280, 190, 96, spec.nodes[0], '#dbeafe')
  const top = nodeRect(450, 170, 220, 92, spec.nodes[1], '#dcfce7')
  const mid = nodeRect(450, 310, 220, 92, spec.nodes[2], '#fef3c7')
  const bottom = nodeRect(450, 450, 220, 92, spec.nodes[3], '#ede9fe')
  const out = nodeRect(890, 310, 220, 96, spec.nodes[4], '#fee2e2')
  return svgFrame(spec, `${input}
${top}
${mid}
${bottom}
${out}
${arrow(282, 328, 448, 216)}
${arrow(282, 328, 448, 356)}
${arrow(282, 328, 448, 496)}
${arrow(672, 216, 888, 356)}
${arrow(672, 356, 888, 356)}
${arrow(672, 496, 888, 356)}`)
}

function renderTimeline(spec) {
  const x0 = 120
  const y = 330
  const gap = 230
  const events = spec.nodes.map((label, index) => {
    const x = x0 + index * gap
    const top = index % 2 === 0 ? 210 : 420
    const line = `<line x1="${x}" y1="${y}" x2="${x}" y2="${top}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 8"/>`
    const labelBox = nodeRect(x - 78, top - 42, 156, 84, label, index % 2 === 0 ? '#dbeafe' : '#dcfce7')
    return `${line}\n<circle cx="${x}" cy="${y}" r="14" fill="#2563eb"/>\n${labelBox}`
  }).join('\n')
  return svgFrame(spec, `<line x1="95" y1="${y}" x2="1110" y2="${y}" stroke="#0f172a" stroke-width="5" stroke-linecap="round" marker-end="url(#arrow)"/>
${events}
<text x="1090" y="${y + 45}" text-anchor="end" font-size="20" font-weight="700" fill="#334155">time</text>`)
}

function renderMatrix(spec) {
  const x0 = 390
  const y0 = 150
  const cell = 56
  let cells = ''
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      const active = r === c || Math.abs(r - c) === 1 || (r < 2 && c > 3)
      const fill = active ? (r === c ? '#2563eb' : '#bfdbfe') : '#f8fafc'
      cells += `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell - 5}" height="${cell - 5}" rx="8" fill="${fill}" stroke="#cbd5e1"/>\n`
    }
  }
  const labels = spec.nodes.map((label, index) => {
    const positions = [[180, 205], [180, 370], [600, 525], [960, 205], [960, 370]]
    const [x, y] = positions[index]
    return nodeRect(x - 92, y - 38, 184, 76, label, ['#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fee2e2'][index])
  }).join('\n')
  return svgFrame(spec, `${cells}
<rect x="${x0 - 10}" y="${y0 - 10}" width="${cell * 6 + 5}" height="${cell * 6 + 5}" rx="12" fill="none" stroke="#0f172a" stroke-width="3"/>
${labels}
${arrow(280, 205, 380, 210, '#64748b')}
${arrow(822, 210, 868, 205, '#64748b')}`)
}

function renderChart(spec) {
  const axis = `<line x1="150" y1="470" x2="1040" y2="470" stroke="#0f172a" stroke-width="4" marker-end="url(#arrow)"/>
<line x1="150" y1="470" x2="150" y2="145" stroke="#0f172a" stroke-width="4" marker-end="url(#arrow)"/>`
  const grid = [220, 290, 360, 430].map((y) => `<line x1="150" y1="${y}" x2="1040" y2="${y}" stroke="#e2e8f0" stroke-width="2"/>`).join('\n')
  const curveA = '<path d="M170 430 C280 350 350 250 470 230 C590 210 700 320 830 210 C920 150 980 190 1030 165" fill="none" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>'
  const curveB = '<path d="M170 455 C310 440 410 390 530 330 C650 270 800 250 1030 240" fill="none" stroke="#0f766e" stroke-width="5" stroke-linecap="round" stroke-dasharray="12 10"/>'
  const labels = spec.nodes.map((label, index) => {
    const positions = [[250, 160], [390, 405], [585, 170], [780, 405], [960, 160]]
    const [x, y] = positions[index]
    return nodeRect(x - 82, y - 34, 164, 68, label, ['#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fee2e2'][index])
  }).join('\n')
  return svgFrame(spec, `${grid}
${axis}
${curveA}
${curveB}
${labels}`)
}

function renderGeometry(spec) {
  const labels = spec.nodes
  return svgFrame(spec, `<rect x="150" y="405" width="190" height="78" rx="18" fill="#1e293b"/>
<circle cx="195" cy="492" r="24" fill="#0f172a"/>
<circle cx="295" cy="492" r="24" fill="#0f172a"/>
<polygon points="340,420 790,210 790,465" fill="#dbeafe" opacity="0.55" stroke="#2563eb" stroke-width="3"/>
<line x1="340" y1="420" x2="820" y2="340" stroke="#2563eb" stroke-width="4" marker-end="url(#arrow)"/>
<circle cx="820" cy="340" r="16" fill="#ef4444"/>
<line x1="220" y1="405" x2="220" y2="300" stroke="#0f766e" stroke-width="4" marker-end="url(#arrow)"/>
<line x1="220" y1="405" x2="340" y2="405" stroke="#0f766e" stroke-width="4" marker-end="url(#arrow)"/>
${nodeRect(80, 185, 180, 82, labels[0], '#dbeafe')}
${nodeRect(372, 145, 180, 82, labels[1], '#dcfce7')}
${nodeRect(680, 145, 180, 82, labels[2], '#fef3c7')}
${nodeRect(870, 310, 180, 82, labels[3], '#ede9fe')}
${nodeRect(720, 470, 220, 82, labels[4], '#fee2e2')}`)
}

function renderMap(spec) {
  const x0 = 205
  const y0 = 145
  const cell = 58
  let grid = ''
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      const obstacle = (r === 1 && [6, 7].includes(c)) || (r === 3 && [2, 3, 4].includes(c)) || (r === 4 && c === 7)
      const fill = obstacle ? '#fecaca' : ((r + c) % 3 === 0 ? '#e0f2fe' : '#f8fafc')
      grid += `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell - 4}" height="${cell - 4}" rx="8" fill="${fill}" stroke="#cbd5e1"/>\n`
    }
  }
  const pathLine = '<path d="M235 430 C345 350 430 365 520 300 C630 220 725 260 870 180" fill="none" stroke="#0f766e" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)"/>'
  const labels = spec.nodes.map((label, index) => {
    const positions = [[150, 535], [330, 535], [545, 535], [765, 535], [985, 535]]
    const [x, y] = positions[index]
    return nodeRect(x - 85, y - 34, 170, 68, label, ['#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#fee2e2'][index])
  }).join('\n')
  return svgFrame(spec, `${grid}
${pathLine}
<rect x="${x0 - 8}" y="${y0 - 8}" width="${cell * 10 + 4}" height="${cell * 6 + 4}" rx="16" fill="none" stroke="#334155" stroke-width="3"/>
${labels}`)
}

const renderers = {
  pipeline: (spec) => renderPipeline(spec, false),
  loop: (spec) => renderPipeline(spec, true),
  stack: renderStack,
  hierarchy: renderHierarchy,
  graph: renderGraph,
  split: renderSplit,
  timeline: renderTimeline,
  matrix: renderMatrix,
  chart: renderChart,
  geometry: renderGeometry,
  map: renderMap
}

function insertFigureBlock(markdown, block) {
  const start = markdown.indexOf(markerStart)
  const end = markdown.indexOf(markerEnd)

  if (start !== -1 && end !== -1 && end > start) {
    return `${markdown.slice(0, start)}${block}${markdown.slice(end + markerEnd.length)}`
  }

  const firstSection = markdown.search(/^##\s+/m)
  if (firstSection !== -1) {
    return `${markdown.slice(0, firstSection).trimEnd()}\n\n${block}\n\n${markdown.slice(firstSection)}`
  }

  const h1 = markdown.match(/^#\s+.+$/m)
  if (!h1) {
    return `${block}\n\n${markdown}`
  }

  const insertAt = h1.index + h1[0].length
  return `${markdown.slice(0, insertAt)}\n\n${block}${markdown.slice(insertAt)}`
}

fs.mkdirSync(figureRoot, { recursive: true })

const seen = new Set()
for (const [category, slug, kind, title, nodes, caption] of figures) {
  const spec = {
    category,
    slug,
    kind,
    title,
    nodes,
    caption
  }
  const renderer = renderers[kind]
  if (!renderer) throw new Error(`No renderer for kind ${kind}`)

  const markdownRel = `10-knowledge-base/${category}/${slug}.md`
  const markdownPath = path.join(repoRoot, markdownRel)
  if (!fs.existsSync(markdownPath)) throw new Error(`Missing markdown file: ${markdownRel}`)

  const assetName = `${category}-${slug}.svg`
  const assetPath = path.join(figureRoot, assetName)
  fs.writeFileSync(assetPath, renderer(spec), 'utf8')

  const imageRel = `../_assets/figures/${assetName}`
  const block = `${markerStart}
![${escapeMarkdown(title)}](${imageRel})

*Figure: ${caption}*
${markerEnd}`

  const markdown = fs.readFileSync(markdownPath, 'utf8')
  fs.writeFileSync(markdownPath, insertFigureBlock(markdown, block), 'utf8')
  seen.add(markdownRel)
}

function listMarkdownFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '_assets') continue
      listMarkdownFiles(absPath, files)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(path.relative(repoRoot, absPath).replace(/\\/g, '/'))
    }
  }
  return files
}

const missingSpecs = listMarkdownFiles(path.join(repoRoot, '10-knowledge-base'))
  .filter((file) => !seen.has(file))

if (missingSpecs.length > 0) {
  throw new Error(`Missing figure specs:\n${missingSpecs.join('\n')}`)
}

console.log(`Generated ${figures.length} knowledge-base figures and inserted matching Markdown blocks.`)
