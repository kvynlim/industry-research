# Glossary

## Acronyms and Terms Used in This Research Corpus

---

### Aviation / Airport

| Term | Definition |
|------|-----------|
| **A-CDM** | Airport Collaborative Decision Making — shared turnaround milestones |
| **A-SMGCS** | Advanced Surface Movement Guidance and Control Systems — surface radar + routing |
| **ADS-B** | Automatic Dependent Surveillance-Broadcast — aircraft transponder positions |
| **AIXM** | Aeronautical Information Exchange Model — airport geometry standard |
| **AMDB/AMXM** | Airport Mapping Database / Exchange Model — detailed surface features |
| **AODB** | Airport Operational Database — flight schedules, gate assignments |
| **APU** | Auxiliary Power Unit — aircraft onboard generator |
| **ARP** | Aerodrome Reference Point — airport coordinate origin |
| **ATC** | Air Traffic Control |
| **CAAS** | Civil Aviation Authority of Singapore |
| **CBRS** | Citizens Broadband Radio Service — 3.5 GHz shared spectrum (US) |
| **CDM** | Collaborative Decision Making |
| **CFD** | Computational Fluid Dynamics — for jet blast modeling |
| **CTOT** | Calculated Take-Off Time |
| **DPI** | Departure Planning Information — A-CDM message type |
| **EASA** | European Union Aviation Safety Agency |
| **EIBT** | Estimated In-Block Time |
| **FAA** | Federal Aviation Administration (US) |
| **FOD** | Foreign Object Debris — objects on runway/taxiway/apron |
| **GSE** | Ground Support Equipment — vehicles servicing aircraft |
| **ICAO** | International Civil Aviation Organization |
| **IGOM** | IATA Ground Operations Manual |
| **MLAT** | Multilateration — triangulating position from multiple receivers |
| **NOTAM** | Notice to Air Missions — temporary airspace/surface restrictions |
| **ODD** | Operational Design Domain — defined conditions for autonomous operation |
| **TOBT** | Target Off-Block Time — planned pushback time |
| **TSAT** | Target Start-up Approval Time — engine start clearance |
| **ULD** | Unit Load Device — standardized cargo/baggage container |
| **URLLC** | Ultra-Reliable Low-Latency Communication — 5G service class |

### Autonomous Vehicles

| Term | Definition |
|------|-----------|
| **ADAS** | Advanced Driver Assistance Systems — L1-L2 automation |
| **AGVS** | Automated Guided Vehicle System — FAA's term for autonomous GSE |
| **AV** | Autonomous Vehicle |
| **BEV** | Bird's-Eye-View — top-down representation for driving |
| **CAN** | Controller Area Network — vehicle communication bus |
| **DBW** | Drive-by-Wire — electronic vehicle control |
| **E2E** | End-to-End — single model from sensors to controls |
| **FSD** | Full Self-Driving (Tesla) |
| **HD Map** | High-Definition Map — centimeter-accurate road map |
| **L4** | SAE Level 4 — high driving automation (no human fallback in ODD) |
| **LiDAR** | Light Detection and Ranging — laser-based 3D scanning |
| **MPC** | Model Predictive Control — optimization-based control |
| **OTA** | Over-the-Air — remote software/model updates |
| **PID** | Proportional-Integral-Derivative — basic control algorithm |
| **RSS** | Responsibility-Sensitive Safety — Mobileye's formal safety model |
| **RTK** | Real-Time Kinematic — cm-level GPS correction |
| **SLAM** | Simultaneous Localization and Mapping |
| **SOTIF** | Safety of the Intended Functionality — ISO 21448 |
| **TRL** | Technology Readiness Level — 1 (concept) to 9 (proven) |
| **V2X** | Vehicle-to-Everything — communication standard |
| **VRU** | Vulnerable Road User — pedestrians, cyclists |

### AI / ML

| Term | Definition |
|------|-----------|
| **3DGS** | 3D Gaussian Splatting — neural scene representation |
| **CFG** | Classifier-Free Guidance — controlling generation quality |
| **CoC** | Chain-of-Causation — Alpamayo's reasoning format |
| **DDIM** | Denoising Diffusion Implicit Models — fast diffusion sampling |
| **DDPM** | Denoising Diffusion Probabilistic Models |
| **DiT** | Diffusion Transformer — transformer-based diffusion model |
| **DLA** | Deep Learning Accelerator — NVIDIA dedicated inference hardware |
| **DRL/MARL** | Deep/Multi-Agent Reinforcement Learning |
| **EMA** | Exponential Moving Average — codebook update method |
| **FID** | Fréchet Inception Distance — image quality metric |
| **FSQ** | Finite Scalar Quantization — codebook-free tokenization (used by Cosmos) |
| **FVD** | Fréchet Video Distance — video quality metric |
| **GTSAM** | Georgia Tech Smoothing and Mapping — factor graph library |
| **IoU** | Intersection over Union — overlap metric |
| **ISAM2** | Incremental Smoothing and Mapping — fast factor graph optimization |
| **JEPA** | Joint Embedding Predictive Architecture — LeCun's world model paradigm |
| **KV-cache** | Key-Value cache — transformer inference optimization |
| **LoRA** | Low-Rank Adaptation — efficient fine-tuning method |
| **mAP** | Mean Average Precision — detection accuracy metric |
| **MBRL** | Model-Based Reinforcement Learning |
| **MoE** | Mixture of Experts — conditional computation |
| **NDS** | nuScenes Detection Score — composite metric |
| **NeRF** | Neural Radiance Fields — neural scene representation |
| **ONNX** | Open Neural Network Exchange — model interchange format |
| **OOD** | Out-of-Distribution — input outside training distribution |
| **PAC** | Probably Approximately Correct — learning theory bound |
| **POMDP** | Partially Observable Markov Decision Process |
| **PTQ/QAT** | Post-Training Quantization / Quantization-Aware Training |
| **RoPE** | Rotary Position Embedding |
| **RSSM** | Recurrent State-Space Model — Dreamer's dynamics model |
| **SSM** | State Space Model — O(n) sequence model (Mamba) |
| **TOPS** | Tera Operations Per Second — compute performance |
| **TRT** | TensorRT — NVIDIA inference optimization |
| **VGICP** | Voxelized Generalized Iterative Closest Point — scan matching |
| **VLA** | Vision-Language-Action model — unified perception+reasoning+control |
| **VLM** | Vision-Language Model — multimodal AI model |
| **VQ-VAE** | Vector Quantized Variational Autoencoder — discrete tokenization |

### Optimization and Numerical Linear Algebra

| Term | Definition |
|------|-----------|
| **Objective** | Function minimized by a solver; in autonomy it combines residuals, priors, weights, and constraints. See [Objective and Residual Design Audit](10-knowledge-base/optimization/objective-residual-design-and-audit.md). |
| **Residual** | Difference between a predicted measurement and an observed measurement, expressed in the correct frame and units. See [Nonlinear Least Squares](10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md). |
| **Whitened residual** | Residual premultiplied by square-root information so its components are in normalized noise units. See [Objective and Residual Design Audit](10-knowledge-base/optimization/objective-residual-design-and-audit.md). |
| **Jacobian** | Derivative of a residual with respect to a local state perturbation. See [Jacobians, Autodiff, and Manifold Linearization](10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md). |
| **Manifold update** | Tangent-space update retracted back to a constrained state such as SO(3), SE(3), or a unit quaternion. See [Jacobians, Autodiff, and Manifold Linearization](10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md). |
| **Rank deficiency** | Condition where a Jacobian or Hessian has unobservable or redundant directions. See [Eigenvalues, Hessian Conditioning, and Observability](10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md). |
| **Schur complement** | Block elimination algebra used to solve reduced systems or form marginalization priors, with different interpretation in each use. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Marginalization prior** | Prior produced by eliminating old variables from a fixed-lag or reduced estimator while preserving their linearized information on remaining variables. See [Schur Complement, Marginalization, and PCG](10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md). |
| **Covariance recovery** | Process of extracting selected uncertainty blocks from a solved information or square-root system. See [Square-Root Information and Covariance Recovery](10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md). |
| **PCG** | Preconditioned conjugate gradients, an iterative method for large symmetric positive definite systems. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Linearization** | Local first-order approximation of residuals around the current estimate. See [Nonlinear Least Squares](10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md). |
| **Local coordinates** | Tangent-space coordinates used to perturb manifold states during linearization. See [Jacobians, Autodiff, and Manifold Linearization](10-knowledge-base/optimization/jacobians-autodiff-manifold-linearization.md). |
| **Normal equations** | Linear system `J^T J delta = -J^T r` formed from a least-squares linearization; fast but can square conditioning. See [Cholesky, LDLT, and Normal Equations](10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md). |
| **Damping** | Numerical regularization that changes a nonlinear step to improve local stability; it is not a physical prior. See [Solver Selection and Convergence Diagnosis](10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md). |
| **Trust-region ratio** | Actual reduction divided by predicted reduction, used to accept or reject trial steps and update the trust region. See [Trust Region and Line Search Globalization](10-knowledge-base/optimization/trust-region-line-search-globalization.md). |
| **Line-search step length** | Scalar step multiplier selected to reduce the objective along a chosen direction. See [Trust Region and Line Search Globalization](10-knowledge-base/optimization/trust-region-line-search-globalization.md). |
| **Convergence criterion** | Stopping rule based on cost change, gradient norm, step norm, solver status, or iteration budget. See [Solver Selection and Convergence Diagnosis](10-knowledge-base/optimization/solver-selection-and-convergence-diagnosis.md). |
| **Nullspace** | State direction that does not change the linearized residual. See [Eigenvalues, Hessian Conditioning, and Observability](10-knowledge-base/numerical-linear-algebra/eigenvalues-hessian-conditioning-observability.md). |
| **Gauge freedom** | Model symmetry such as global pose or scale that measurements cannot determine without a chosen gauge or prior. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Condition number** | Ratio describing how sensitive a linear solve is to perturbations. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Sparsity** | Matrix structure where most entries are zero because factors touch only a few variables. See [Sparse Matrices, Fill-In, and Ordering](10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md). |
| **Fill-in** | New nonzero entries created during sparse elimination. See [Sparse Matrices, Fill-In, and Ordering](10-knowledge-base/numerical-linear-algebra/sparse-matrices-fill-in-ordering.md). |
| **Ordering** | Variable elimination order that changes fill-in, runtime, memory, and sometimes diagnostic visibility. See [Sparse Estimation Backend Crosswalk](10-knowledge-base/numerical-linear-algebra/sparse-estimation-backend-crosswalk.md). |
| **Cholesky** | Factorization for symmetric positive definite systems, often used on normal equations. See [Cholesky, LDLT, and Normal Equations](10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md). |
| **LDLT** | Symmetric factorization that can expose indefinite or semidefinite behavior more directly than plain Cholesky. See [Cholesky, LDLT, and Normal Equations](10-knowledge-base/numerical-linear-algebra/cholesky-ldlt-normal-equations.md). |
| **QR** | Least-squares factorization that works directly on `J` and avoids explicitly forming `J^T J`. See [QR, SVD, and Rank-Revealing Solvers](10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md). |
| **SVD** | Singular value decomposition used to expose rank, weak modes, and nullspace directions. See [QR, SVD, and Rank-Revealing Solvers](10-knowledge-base/numerical-linear-algebra/qr-svd-rank-revealing-solvers.md). |
| **Square-root information** | Factor whose transpose times itself is the information matrix, commonly used for stable residual whitening and priors. See [Square-Root Information and Covariance Recovery](10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md). |
| **Marginal covariance** | Uncertainty block for selected variables after accounting for eliminated or unqueried variables. See [Square-Root Information and Covariance Recovery](10-knowledge-base/numerical-linear-algebra/square-root-information-and-covariance-recovery.md). |
| **Preconditioner** | Approximate inverse or scaling that improves PCG convergence. See [Schur Complement, Marginalization, and PCG](10-knowledge-base/numerical-linear-algebra/schur-complement-marginalization-pcg.md). |

### Safety / Certification

| Term | Definition |
|------|-----------|
| **AMLAS** | Assurance of Machine Learning for Autonomous Systems — safety methodology |
| **ASIL** | Automotive Safety Integrity Level — ISO 26262 (A-D) |
| **CE** | Conformité Européenne — EU product certification mark |
| **GSN** | Goal Structuring Notation — safety case diagram notation |
| **PL** | Performance Level — ISO 13849 safety rating (a-e) |
| **SIL** | Safety Integrity Level — IEC 61508 |
| **Simplex** | Dual-controller architecture — high-performance + verified fallback |
| **UL 4600** | Standard for evaluation of autonomous products |

### Companies

| Abbreviation | Full Name |
|-------------|-----------|
| **IAG** | International Airlines Group (British Airways parent) |
| **SATS** | Singapore Airport Terminal Services |
| **TLD** | Tracteurs et Lourds de Distribution (GSE manufacturer) |

---

*160+ terms defined. Updated as corpus grows.*
