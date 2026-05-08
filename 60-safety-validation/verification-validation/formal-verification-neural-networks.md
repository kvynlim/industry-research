# Formal Verification of Neural Networks for Safety Certification

## Proving Properties of Learned Components in Airside Autonomous Vehicle Stacks

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Formal verification of neural networks provides mathematical guarantees about the behavior of learned components -- guarantees that testing alone cannot supply. For the reference airside AV stack's airside AV stack, the critical question is not whether to verify neural networks (regulatory pressure from ISO 3691-4, UL 4600, the EU AI Act, and the 2027 EU Machinery Regulation makes this inevitable) but which components to verify, to what degree, and with which methods. Complete verification (SMT/MILP) can prove exact properties but scales only to networks under ~100K parameters. Over-approximation methods (alpha-beta-CROWN, DeepPoly, PRIMA) scale to millions of parameters but provide conservative bounds. Certified training (IBP, SABR) builds robustness into the model from the start. The practical strategy for reference airside AV stack is a layered approach: formally verify small safety-critical components (policy networks, CBF approximators, Simplex decision modules) with complete methods; certify robustness of perception backbones (PointPillars, CenterPoint) with scalable bound propagation; and complement both with runtime verification monitors that catch what static analysis misses. This layered verification strategy directly maps onto the existing Simplex architecture and defense-in-depth philosophy.

---

## Table of Contents

1. [Why Formal Verification Matters for AV Certification](#1-why-formal-verification-matters-for-av-certification)
2. [Verification Problem Formulation](#2-verification-problem-formulation)
3. [Complete Methods: SMT and MILP](#3-complete-methods-smt-and-milp)
4. [Over-Approximation Methods](#4-over-approximation-methods)
5. [Certified Robustness Training](#5-certified-robustness-training)
6. [Lipschitz Bounds and Safety Margins](#6-lipschitz-bounds-and-safety-margins)
7. [Runtime Verification vs Static Verification](#7-runtime-verification-vs-static-verification)
8. [Practical Verification Budgets for Orin-Deployable Models](#8-practical-verification-budgets-for-orin-deployable-models)
9. [Verification for Specific AV Components](#9-verification-for-specific-av-components)
10. [Tools and Frameworks](#10-tools-and-frameworks)
11. [Integration with Existing Safety Architecture](#11-integration-with-existing-safety-architecture)
12. [Implementation Roadmap and Costs](#12-implementation-roadmap-and-costs)
13. [Key Takeaways](#13-key-takeaways)
14. [References](#14-references)

---

## 1. Why Formal Verification Matters for AV Certification

### 1.1 The Verification Gap

Traditional software verification rests on a well-understood foundation: code review, static analysis, unit tests, integration tests, and formal methods (model checking, theorem proving) can establish correctness because the program's logic is explicit. Neural networks break this foundation. A 9M-parameter PointPillars model is a sequence of matrix multiplications, nonlinear activations, and normalization layers. Its "logic" is encoded in learned weights, not in readable code. No amount of code review reveals whether the model will correctly detect a crouching ramp agent at 40m in fog.

Testing helps but cannot provide guarantees. Even with the 4,600 zero-failure tests required by the Zhao-Weng formula for 99.9% reliability at 99% confidence (see `60-safety-validation/verification-validation/testing-validation-methodology.md`), a neural network's behavior on the 4,601st input is not constrained by its behavior on the first 4,600. The input space of even a simple LiDAR point cloud (120K points x 4 features = 480K dimensions) is astronomically large -- exhaustive testing is physically impossible.

Formal verification fills this gap: it provides mathematical proofs that a neural network satisfies specified properties over entire regions of input space, not just tested points.

### 1.2 Regulatory Drivers

Multiple overlapping standards and regulations now require or strongly incentivize formal analysis of AI/ML components:

**ISO 3691-4 (Industrial Trucks -- Driverless Vehicles):**
- Clause 5.4.2 requires validation of safety-related control systems. When perception or planning uses ML, the safety case must address ML failure modes
- The 2024 harmonization with the EU Machinery Directive tightens this: "safety functions" must demonstrate reliability claims
- No explicit neural network verification requirement yet, but assessors increasingly expect evidence beyond testing alone
- Formal verification of safety-critical ML components (CBF approximators, decision modules) directly addresses assessor concerns

**UL 4600 (Safety for Autonomous Products):**
- Clause 7.4: "Analysis of machine learning components should include... formal methods where applicable"
- Clause 7.5: Robustness analysis must cover input perturbations and distributional shift
- Clause 7.6: Runtime monitoring must compensate for limitations of offline verification
- UL 4600 explicitly recognizes that complete formal verification of large neural networks is infeasible and accepts partial verification combined with runtime safeguards -- exactly the layered approach recommended here

**EU AI Act (Regulation 2024/1689):**
- Annex IV requires technical documentation including "the general logic of the AI system," testing methodology, and "the measures put in place to ensure robustness"
- Article 15 requires "an appropriate level of accuracy, robustness, and cybersecurity" with "technical redundancy solutions, which may include backup or fail-safe plans"
- High-risk classification (Annex III) likely applies to airside AVs given safety implications
- Formal robustness certificates directly address Article 15 requirements
- Compliance deadline: August 2026 for high-risk AI systems

**2027 EU Machinery Regulation (2023/1230):**
- Replaces the Machinery Directive from January 2027
- Annex III, Section 1.1.9 explicitly addresses "safety components with AI self-evolving behavior"
- Third-party conformity assessment mandatory for AI autonomous vehicles
- The regulation explicitly calls for "validation of the accuracy, robustness and cybersecurity of AI safety components" -- the closest any regulation has come to mandating formal ML verification

**DO-178C / DO-333 (Software Considerations in Airborne Systems):**
- While directly applicable to aircraft software, not GSE, the formal methods supplement (DO-333) is increasingly referenced by airside certifiers
- DO-333 provides credit for formal verification evidence, reducing required testing coverage
- Airside AVs operating near aircraft may face pressure to demonstrate DO-178C-adjacent rigor

### 1.3 The Economic Argument

Beyond compliance, formal verification has a practical economic benefit: finding bugs before deployment. The cost of discovering a safety-critical neural network failure mode scales dramatically with when it is found:

| Stage | Cost per Bug | Example |
|-------|-------------|---------|
| Training/verification | $100-500 | Formal analysis reveals misclassification region |
| Shadow mode | $1K-5K | Disagreement logged, investigated, model retrained |
| Supervised deployment | $10K-50K | Operator intervenes, root cause analysis, fleet update |
| Autonomous incident | $100K-1M+ | Vehicle damage, operational disruption, regulatory scrutiny |
| Aircraft damage | $250K-139M | Per `70-operations-domains/airside/operations/industry-overview.md` |

A formal verification campaign costing $30-60K that catches one misclassification region near an aircraft intake zone pays for itself immediately.

---

## 2. Verification Problem Formulation

### 2.1 Neural Network as Mathematical Object

A feedforward neural network f: R^n -> R^m is a composition of affine transformations and nonlinear activations:

```
f(x) = sigma_L(W_L * sigma_{L-1}(W_{L-1} * ... sigma_1(W_1 * x + b_1) ... + b_{L-1}) + b_L)
```

where:
- x in R^n is the input (e.g., a flattened pillar feature tensor)
- W_i, b_i are learned weight matrices and bias vectors
- sigma_i are activation functions (ReLU, GELU, Sigmoid, etc.)
- f(x) in R^m is the output (e.g., bounding box coordinates and class scores)

For verification purposes, the network is treated as a fixed mathematical function (weights are frozen). The goal is to prove properties about this function's behavior over specified input regions.

### 2.2 Core Verification Problems

**Reachability analysis:** Given an input set X (e.g., all point clouds within epsilon of a reference), compute or bound the output set Y = f(X). If Y can be bounded to lie within a safe output region, safety is guaranteed for all inputs in X.

```
Given: f, input set X = {x : ||x - x_0|| <= epsilon}
Compute: Y = {f(x) : x in X}
Verify: Y subset_of Y_safe
```

**Robustness verification:** Given an input x_0 with correct output y_0, prove that for all perturbations delta with ||delta|| <= epsilon, the output classification does not change.

```
Given: f, x_0, epsilon
Verify: argmax(f(x_0 + delta)) = argmax(f(x_0))  forall ||delta|| <= epsilon
```

**Safety property verification:** Given a specification phi relating inputs and outputs, prove that phi holds for all inputs in a specified region.

```
Given: f, input region X, specification phi
Verify: forall x in X : phi(x, f(x))
```

Example safety specifications for airside AVs:

| Property | Formal Specification | Component |
|----------|---------------------|-----------|
| No aircraft misclassified as GSE | forall x in X_aircraft : argmax(f(x)) = AIRCRAFT | Perception |
| Braking distance respects safety margin | forall s in S_approach : f_plan(s).decel >= a_min | Planning |
| Personnel detection confidence above threshold | forall x in X_personnel : max(f(x)[PERSON]) >= 0.95 | Perception |
| CBF constraint satisfaction | forall x in X_state : h(f_cbf(x)) >= 0 | Control |
| Policy steering within kinematic limits | forall s in S : \|f_policy(s).steer\| <= delta_max | Policy |
| Emergency stop activation | forall x in X_hazard : f_decision(x) = STOP | Decision |

### 2.3 Complexity

Neural network verification is NP-complete in general (Katz et al., 2017). For networks with ReLU activations, the problem reduces to satisfiability of a conjunction of linear constraints with disjunctions (each ReLU introduces an "active" or "inactive" case). A network with N ReLU neurons has 2^N possible activation patterns. PointPillars with ~9M parameters has millions of ReLU neurons -- complete enumeration is infeasible.

This NP-completeness result motivates the three-pronged approach: complete methods for small networks, over-approximation for large networks, and runtime verification as a catch-all.

### 2.4 Input Specification for LiDAR

Specifying meaningful input perturbation sets for LiDAR point clouds requires domain knowledge. Unlike images where L-infinity perturbations are standard, LiDAR perturbations must be physically meaningful:

| Perturbation Type | Mathematical Model | Physical Source |
|-------------------|-------------------|----------------|
| Point position noise | ||delta_xyz|| <= sigma_range | Sensor measurement noise |
| Point dropout | Bernoulli(1-p) per point | Beam occlusion, absorption |
| Intensity variation | \|delta_i\| <= sigma_i | Surface reflectivity change |
| Rotation error | ||delta_R|| <= theta_max | Calibration drift |
| Density variation | Subsample by factor k | Range-dependent density |
| Adversarial addition | k spurious points | Multipath, de-icing spray |

For PointPillars specifically, the input is a pseudo-image (pillar features projected to BEV grid). Perturbations on the BEV pseudo-image are more tractable for verification than perturbations on raw point clouds, because the pseudo-image has fixed dimensions.

---

## 3. Complete Methods: SMT and MILP

### 3.1 SMT-Based Verification

Satisfiability Modulo Theories (SMT) solvers extend SAT solvers with theories over real arithmetic, enabling direct encoding of neural network verification problems.

**Reluplex (Katz et al., 2017):** The foundational work that proved neural network verification is NP-complete and provided the first practical solver. Reluplex extends the simplex method for linear programming with a "ReLU-aware" pivot rule that lazily enforces ReLU constraints.

Key idea: Represent each ReLU y = max(0, x) as a constraint pair:
- If x >= 0 (active): y = x
- If x < 0 (inactive): y = 0

Rather than enumerating all 2^N activation patterns, Reluplex uses:
1. Relaxed LP: Solve the LP ignoring some ReLU constraints
2. Pivot: If a ReLU constraint is violated, perform a case split (branch on active/inactive)
3. Prune: Use bounds propagation to determine fixed neurons (provably active or inactive)

**Marabou (Katz et al., 2019):** The successor to Reluplex, adding:
- Support for piecewise-linear functions beyond ReLU (max-pool, abs, sign)
- Divide-and-conquer parallelism (split problem across CPU cores)
- MILP integration as a backend solver
- Support for convolutional layers (unrolled to fully connected)
- Network-level deduction (using network structure to prune search space)

**Scalability of SMT methods:**

| Network Size | Neurons | Verification Time (typical) | Feasibility |
|-------------|---------|---------------------------|-------------|
| Tiny (ACAS Xu) | 300 | Seconds | Fully tractable |
| Small policy | 1K-10K | Minutes to hours | Practical for key properties |
| Medium (small CNN) | 10K-100K | Hours to days | Selective properties only |
| PointPillars backbone | 100K+ | Intractable | Not feasible |
| Full CenterPoint | 1M+ | Intractable | Not feasible |

### 3.2 MILP-Based Verification

Mixed-Integer Linear Programming (MILP) provides an alternative complete encoding. Each ReLU neuron is encoded with a binary variable z_i in {0, 1}:

```
y_i >= 0
y_i >= x_i
y_i <= U_i * z_i            (U_i is upper bound on x_i)
y_i <= x_i - L_i * (1 - z_i)  (L_i is lower bound on x_i)
```

The entire network becomes a MILP with:
- Continuous variables: neuron activations
- Binary variables: one per ReLU neuron (active/inactive)
- Linear constraints: affine layers
- Objective: maximize/minimize target output

**Advantages over SMT:**
- Leverages decades of MILP solver optimization (Gurobi, CPLEX)
- Branch-and-bound with LP relaxation provides anytime bounds
- Natural handling of optimization (find worst-case input, not just satisfiability)
- Better parallelism in commercial solvers

**Disadvantages:**
- Same exponential worst-case as SMT (2^N binary variables)
- LP relaxation can be very loose for deep networks
- Commercial solvers (Gurobi) are expensive ($10K+/year academic, $50K+/year commercial)

### 3.3 Practical Application: Verifying Airside Decision Networks

Complete methods are practical for small, safety-critical decision networks in the reference airside AV stack:

**Simplex decision module:** The module that decides whether to switch from the neural AC (advanced controller) to the classical BC (baseline controller) is a small network (typically <1K neurons) that can be fully verified:

```
Verify: forall s in S_unsafe : f_simplex(s) = SWITCH_TO_BC
```

This ensures the Simplex architecture never fails to switch to the safe baseline when the system state enters an unsafe region.

**CBF approximator:** If a neural network approximates the CBF value function h(x) (see `30-autonomy-stack/planning/safety-critical-planning-cbf.md`), verifying that h(x) >= 0 implies safety requires:

```
Verify: forall x in X_boundary : h_nn(x) >= h_true(x) - delta
```

This bounds the approximation error of the neural CBF, ensuring it remains conservative.

**Emergency stop classifier:** A binary classifier that triggers emergency braking based on perception features:

```
Verify: forall x in X_imminent_collision : f_estop(x) = STOP
```

For a network with <5K neurons, Marabou can verify this property in minutes to hours.

---

## 4. Over-Approximation Methods

### 4.1 Abstract Interpretation

Abstract interpretation (Cousot & Cousot, 1977) provides a framework for computing sound over-approximations of a program's behavior. Applied to neural networks, it propagates abstract shapes (intervals, zonotopes, polyhedra) through each layer, maintaining an over-approximation of the set of possible activations.

**Key insight:** Rather than tracking exact output sets (exponentially complex), track a simpler shape that contains the exact set. The over-approximation is sound (if the over-approximated output is safe, the exact output is safe) but incomplete (the over-approximation may report "unsafe" when the exact output is actually safe).

**Common abstract domains for neural network verification:**

| Domain | Shape | Precision | Cost per Layer | Tightness |
|--------|-------|-----------|---------------|-----------|
| Interval (Box) | Axis-aligned box | Low | O(n) | Very loose |
| Zonotope | Affine combination of generators | Medium | O(n * k) | Medium |
| DeepPoly | Per-neuron linear bounds | Medium-High | O(n^2) | Good |
| PRIMA | Multi-neuron convex relaxation | High | O(n^3) | Very good |
| Polyhedra | Arbitrary convex polytope | Highest | O(2^n) | Exact (but intractable) |

### 4.2 DeepPoly (Singh et al., 2019)

DeepPoly maintains two linear expressions per neuron -- one upper bound and one lower bound -- in terms of the network's inputs:

```
For neuron y_i at layer l:
  Lower: y_i >= a_i^T * x + c_i   (x is the network input)
  Upper: y_i <= b_i^T * x + d_i
```

For ReLU activation y = max(0, x):
- If x >= 0 always (from bounds): y = x (exact)
- If x <= 0 always: y = 0 (exact)
- If x crosses zero: 
  - Lower bound: y >= lambda * x (where lambda is a learned or computed slope)
  - Upper bound: y <= u/(u-l) * (x - l) (triangle relaxation)

DeepPoly propagates these bounds layer by layer, tightening at each step via back-substitution (replacing intermediate variables with expressions in terms of inputs).

**Scalability:** DeepPoly handles networks with millions of neurons because each layer's bounds computation is polynomial. The tradeoff is precision: for deep networks with many ambiguous ReLU neurons (those whose input spans both positive and negative), bounds accumulate approximation error.

### 4.3 CROWN and alpha-beta-CROWN

CROWN (Zhang et al., 2018) reformulates bound propagation as a backward pass through the network, computing linear lower and upper bounds of the output with respect to the input. The key innovation is that the bound computation has the same computational structure as backpropagation, making it GPU-acceleratable.

**alpha-CROWN:** Introduces optimizable slope parameters (alpha) for the ReLU relaxation. Instead of using a fixed triangle relaxation, alpha-CROWN learns the tightest linear bounds through gradient descent:

```python
# Conceptual alpha-CROWN bound computation
for layer in reversed(network.layers):
    if isinstance(layer, ReLU):
        # alpha_i in [0, 1] is optimized per neuron
        lower_bound = alpha_i * x  # parameterized lower bound
        upper_bound = u/(u-l) * (x - l)  # triangle upper bound
    elif isinstance(layer, Linear):
        # Standard matrix propagation of bounds
        bound = W @ previous_bound + b
```

**beta-CROWN:** Adds branch-and-bound on top of alpha-CROWN. When bound propagation alone is insufficient to prove a property, beta-CROWN:
1. Selects the most ambiguous ReLU neuron
2. Splits into two sub-problems (neuron active, neuron inactive)
3. Applies alpha-CROWN to each sub-problem (tighter bounds due to fixing one neuron)
4. Recursively splits until property is proved or disproved

**VNN-COMP Dominance:** alpha-beta-CROWN has won the International Verification of Neural Networks Competition (VNN-COMP) in 2021, 2022, 2023, 2024, and 2025. It is the de facto standard for scalable neural network verification.

**Performance on relevant architectures:**

| Architecture | Parameters | Neurons | alpha-CROWN Time | beta-CROWN Time | Verified? |
|-------------|-----------|---------|-------------------|------------------|-----------|
| MLP 3x256 | 200K | 768 | 0.1s | 1-10s | Yes |
| Small CNN (CIFAR) | 500K | 5K | 1-5s | 10-60s | Yes |
| ResNet-18 | 11M | 50K | 30-120s | 5-30 min | Partial |
| PointPillars head | ~1M | 10K | 5-30s | 1-10 min | Yes (head only) |
| Full PointPillars | ~9M | 100K+ | Minutes | Hours | Partial |

### 4.4 PRIMA (Muller et al., 2022)

PRIMA (PRecIse Multi-neuron Abstraction) extends single-neuron relaxations to capture relationships between multiple neurons. Where DeepPoly and CROWN relax each ReLU independently, PRIMA jointly relaxes groups of 2-3 ReLU neurons, capturing their correlations.

This is critical for perception networks where nearby neurons in the same feature map are highly correlated. PRIMA can prove properties that single-neuron methods cannot, at ~2-5x computational overhead.

### 4.5 GNN and Point Cloud Architectures

Verifying point cloud networks presents unique challenges:

1. **Variable input size:** Point clouds have varying numbers of points. PointPillars handles this via voxelization/pillar encoding to a fixed-size pseudo-image, making verification tractable
2. **Permutation invariance:** Max-pool and mean-pool aggregation in point processing must be handled by the verifier
3. **Sparse convolution:** Submanifold sparse convolution (used in CenterPoint/VoxelNet) is not natively supported by most verifiers. Workaround: convert to dense equivalent for verification of small input regions

Current verifier support for LiDAR perception architectures:

| Architecture | Verifiable? | Method | Limitation |
|-------------|------------|--------|------------|
| PointPillars (head only) | Yes | alpha-beta-CROWN | Must fix backbone output bounds |
| PointPillars (full) | Partial | CROWN with compositional verification | Loose bounds through scatter operation |
| CenterPoint (head) | Yes | alpha-beta-CROWN | Detection head is standard CNN |
| CenterPoint (full) | No | -- | Sparse 3D conv not supported |
| FlatFormer | No | -- | Custom attention ops |
| PTv3 | No | -- | Serialized attention not supported |

The practical implication: **verify what you can (detection heads, policy networks, decision modules) and complement with runtime verification for what you cannot (full perception backbones).**

---

## 5. Certified Robustness Training

### 5.1 The Problem with Post-Hoc Verification

Standard training (empirical risk minimization) produces models that are accurate on average but have no robustness guarantees. Attempting to verify robustness post-hoc on a standardly-trained model typically fails: the verified robust radius is near zero because the model was never incentivized to be robust.

Certified training solves this by incorporating verification bounds directly into the training loss, producing models that are certifiably robust by construction.

### 5.2 Interval Bound Propagation (IBP)

IBP (Gowal et al., 2018) is the simplest certified training method. It propagates interval bounds through the network and penalizes worst-case loss:

```python
# Conceptual IBP training
def ibp_forward(model, x, epsilon):
    """Propagate interval bounds [x - epsilon, x + epsilon] through model."""
    lower, upper = x - epsilon, x + epsilon
    
    for layer in model.layers:
        if isinstance(layer, nn.Linear):
            # Affine: [W*lower + b, W*upper + b] with careful sign handling
            W_pos = torch.clamp(layer.weight, min=0)
            W_neg = torch.clamp(layer.weight, max=0)
            new_lower = W_pos @ lower + W_neg @ upper + layer.bias
            new_upper = W_pos @ upper + W_neg @ lower + layer.bias
            lower, upper = new_lower, new_upper
        elif isinstance(layer, nn.ReLU):
            lower = torch.clamp(lower, min=0)
            upper = torch.clamp(upper, min=0)
    
    return lower, upper

def ibp_loss(model, x, y, epsilon):
    """Worst-case cross-entropy loss under IBP bounds."""
    lower, upper = ibp_forward(model, x, epsilon)
    # Worst case: minimize correct class logit, maximize others
    worst_logit = lower[y]  # lower bound on correct class
    # Upper bound on all other classes
    other_upper = upper.clone()
    other_upper[y] = -float('inf')
    worst_margin = worst_logit - other_upper.max()
    return -worst_margin  # minimize negative margin
```

**Tradeoffs:**
- IBP bounds are very loose (interval domain), so IBP-trained models sacrifice significant clean accuracy for certified robustness
- Typical clean accuracy drop: 5-15% vs standard training
- But IBP training is fast (same cost as standard training) and produces models with meaningful certified radii

### 5.3 SABR (Muller et al., 2023)

Scalable Adversarial Bound Refinement (SABR) combines the speed of IBP with the precision of CROWN. During training:

1. Use IBP for the fast forward pass (compute cheap bounds)
2. Periodically refine bounds with CROWN for the most vulnerable neurons
3. Use the refined bounds in the loss function

SABR achieves certified robustness comparable to full CROWN-based training at ~2x the cost of standard training (vs ~10x for full CROWN training).

### 5.4 Certified Training for PointPillars

Applying certified training to PointPillars for airside perception:

```python
import torch
import torch.nn as nn
from auto_LiRPA import BoundedModule, BoundedTensor, PerturbationLpNorm

# Example: Certified training for PointPillars detection head
# The detection head maps BEV features -> class scores + box regression

class PointPillarsHead(nn.Module):
    """Simplified PointPillars detection head for verification."""
    def __init__(self, in_channels=384, num_classes=18, num_anchors=2):
        super().__init__()
        self.cls_head = nn.Sequential(
            nn.Conv2d(in_channels, 192, 3, padding=1),
            nn.BatchNorm2d(192),
            nn.ReLU(),
            nn.Conv2d(192, num_anchors * num_classes, 1)
        )
        self.reg_head = nn.Sequential(
            nn.Conv2d(in_channels, 192, 3, padding=1),
            nn.BatchNorm2d(192),
            nn.ReLU(),
            nn.Conv2d(192, num_anchors * 7, 1)  # x, y, z, w, l, h, theta
        )
    
    def forward(self, bev_features):
        cls = self.cls_head(bev_features)
        reg = self.reg_head(bev_features)
        return cls, reg


def certified_train_step(model, bev_features, targets, epsilon=0.01):
    """
    One step of certified training using auto_LiRPA.
    epsilon: perturbation radius on BEV features (models upstream noise).
    """
    # Wrap model for bound computation
    bounded_model = BoundedModule(model.cls_head, bev_features)
    
    # Define input perturbation
    ptb = PerturbationLpNorm(norm=float('inf'), eps=epsilon)
    bounded_input = BoundedTensor(bev_features, ptb)
    
    # Compute IBP bounds (fast)
    lb_ibp, ub_ibp = bounded_model.compute_bounds(
        x=(bounded_input,), method='IBP'
    )
    
    # Compute CROWN bounds (tighter, for refinement)
    lb_crown, ub_crown = bounded_model.compute_bounds(
        x=(bounded_input,), method='CROWN'
    )
    
    # Worst-case loss: correct class lower bound vs other classes upper bound
    # For each anchor/location, compute certified margin
    num_classes = 18
    target_lb = torch.gather(lb_crown.view(-1, num_classes), 1, 
                              targets.view(-1, 1))
    other_ub = ub_crown.view(-1, num_classes).clone()
    other_ub.scatter_(1, targets.view(-1, 1), -float('inf'))
    worst_margin = target_lb - other_ub.max(dim=1, keepdim=True).values
    
    certified_loss = torch.clamp(-worst_margin, min=0).mean()
    
    # Combined loss: standard CE + certified robustness
    standard_loss = nn.functional.cross_entropy(
        model.cls_head(bev_features).view(-1, num_classes), 
        targets.view(-1)
    )
    
    total_loss = 0.5 * standard_loss + 0.5 * certified_loss
    return total_loss
```

Expected impact on PointPillars performance:

| Metric | Standard Training | IBP Training (eps=0.01) | SABR Training (eps=0.01) |
|--------|------------------|------------------------|--------------------------|
| Clean mAP | 62.4% | 54.1% (-8.3%) | 58.7% (-3.7%) |
| Certified robust radius | ~0 | 0.008 | 0.009 |
| Inference latency (Orin INT8) | 6.84ms | 6.84ms (same arch) | 6.84ms (same arch) |
| PGD-attack mAP (eps=0.01) | 12.3% | 51.8% | 56.2% |

The 3.7% mAP drop with SABR is a worthwhile tradeoff for formal robustness certificates, especially for safety-critical classes (aircraft, personnel).

---

## 6. Lipschitz Bounds and Safety Margins

### 6.1 Lipschitz Continuity for Neural Networks

A function f is Lipschitz continuous with constant L if:

```
||f(x_1) - f(x_2)|| <= L * ||x_1 - x_2||   forall x_1, x_2
```

For neural networks, the Lipschitz constant bounds the maximum change in output for a given change in input. A network with Lipschitz constant L = 10 can change its output by at most 10x the input perturbation magnitude.

**Why this matters for airside AVs:** If the perception network has a known Lipschitz bound, and the sensor noise is bounded by epsilon, then the output uncertainty is bounded by L * epsilon. This directly feeds into safety margin calculations for planning and control.

### 6.2 Computing Lipschitz Bounds

**Naive bound (product of weight spectral norms):**

```
L_naive = prod(||W_i||_2) for all layers i
```

This is easy to compute but extremely loose. For a 10-layer network with spectral norms of 2.0 each: L_naive = 2^10 = 1024. The true Lipschitz constant is typically orders of magnitude smaller.

**LipSDP (Fazlyab et al., 2019):** Formulates Lipschitz estimation as a semidefinite program (SDP) that accounts for the constraining effect of ReLU activations. Produces tighter bounds (often 10-100x tighter than naive) but is computationally expensive for large networks.

**SeqLip (Combettes & Pesquet, 2020):** Computes per-layer Lipschitz bounds considering the coupling between consecutive layers. Tighter than naive, cheaper than SDP.

**Practical Lipschitz estimation with auto_LiRPA:**

```python
import torch
import numpy as np
from auto_LiRPA import BoundedModule, BoundedTensor, PerturbationLpNorm

def estimate_lipschitz_bound(model, input_shape, epsilon=1.0, method='CROWN'):
    """
    Estimate local Lipschitz constant of a model around zero input.
    
    The Lipschitz constant L satisfies:
        ||f(x + delta) - f(x)|| <= L * ||delta||
    for ||delta|| <= epsilon.
    
    We estimate L by computing output bounds for ||delta|| <= epsilon
    and dividing by epsilon.
    """
    # Create reference input
    x_ref = torch.zeros(1, *input_shape)
    y_ref = model(x_ref)
    
    # Wrap model
    bounded_model = BoundedModule(model, x_ref)
    
    # Perturb input
    ptb = PerturbationLpNorm(norm=float('inf'), eps=epsilon)
    bounded_input = BoundedTensor(x_ref, ptb)
    
    # Compute output bounds
    lb, ub = bounded_model.compute_bounds(
        x=(bounded_input,), method=method
    )
    
    # Maximum output deviation
    max_deviation = torch.max(
        torch.abs(ub - y_ref).max(),
        torch.abs(y_ref - lb).max()
    )
    
    # Lipschitz estimate
    lipschitz_bound = (max_deviation / epsilon).item()
    return lipschitz_bound


def compute_safety_margin(lipschitz_bound, sensor_noise_bound, 
                          safety_threshold):
    """
    Compute minimum safety margin needed to guarantee correct output
    despite sensor noise.
    
    If ||noise|| <= sensor_noise_bound and L is the Lipschitz constant,
    then ||f(x + noise) - f(x)|| <= L * sensor_noise_bound.
    
    For the output to remain on the correct side of the safety threshold,
    we need: margin >= L * sensor_noise_bound.
    """
    required_margin = lipschitz_bound * sensor_noise_bound
    return required_margin


# Example for airside: PointPillars detection confidence
# Sensor noise: +/- 0.02 on normalized BEV features (RoboSense spec)
# Lipschitz bound: estimated at 15.3 for detection head
# Safety threshold: 0.5 confidence for personnel detection

lipschitz_L = 15.3
sensor_noise = 0.02
safety_threshold = 0.5

margin = compute_safety_margin(lipschitz_L, sensor_noise, safety_threshold)
print(f"Required safety margin: {margin:.3f}")
# Output: Required safety margin: 0.306
# Interpretation: Personnel detections need confidence >= 0.806 to be
# guaranteed correct under worst-case sensor noise.
```

### 6.3 Lipschitz-Constrained Training

Training networks with explicit Lipschitz constraints produces models that are both robust and have useful bounds:

**Spectral normalization:** Divide each weight matrix by its spectral norm, ensuring ||W_i||_2 = 1 per layer. Simple but overly conservative.

**Orthogonal layers (Li et al., 2019):** Constrain weight matrices to be orthogonal (||W||_2 = 1 exactly), preserving information flow while bounding Lipschitz constant to 1 per layer.

**Practical strategy for reference airside AV stack:**

| Component | Target Lipschitz | Method | Accuracy Impact |
|-----------|-----------------|--------|-----------------|
| Detection head | L <= 20 | Spectral norm + fine-tune | -1-2% mAP |
| Policy network | L <= 5 | Orthogonal layers | -2-5% reward |
| CBF approximator | L <= 2 | LipSDP-constrained | Negligible (simple function) |
| Emergency stop classifier | L <= 3 | Orthogonal + certified training | -1-3% accuracy |

### 6.4 From Lipschitz to CBF Safety Margins

The connection between Lipschitz bounds and CBF safety filters (see `30-autonomy-stack/planning/safety-critical-planning-cbf.md`) is direct:

If the CBF value function h(x) is approximated by a neural network h_nn(x) with Lipschitz constant L_h, and the state estimation error is bounded by ||x - x_hat|| <= delta_x, then:

```
h_true(x_true) >= h_nn(x_hat) - L_h * delta_x - epsilon_approx
```

where epsilon_approx is the maximum approximation error (from verification). The CBF-QP constraint must be tightened by L_h * delta_x + epsilon_approx to maintain formal safety:

```
h_nn(x_hat) >= L_h * delta_x + epsilon_approx   (tightened constraint)
```

This directly connects to measurement-robust CBFs described in `30-autonomy-stack/planning/safety-critical-planning-cbf.md`, where GTSAM pose covariance provides delta_x.

---

## 7. Runtime Verification vs Static Verification

### 7.1 Complementary Approaches

Static verification and runtime verification (see `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`) are complementary, not competing, approaches. Understanding their respective strengths determines how to allocate verification budget:

| Dimension | Static Verification | Runtime Verification |
|-----------|-------------------|---------------------|
| **When** | Design/build time | Execution time |
| **Scope** | Entire input region | Current trace only |
| **Soundness** | Sound (over-approximation) | Sound (for observed trace) |
| **Completeness** | Complete (for exact methods) | Incomplete (one execution) |
| **Scalability** | Limited by model size | Linear in trace length |
| **Coverage** | All inputs in specified region | Only executed inputs |
| **Neural network support** | Limited (small models, simple architectures) | Architecture-agnostic |
| **Latency overhead** | Zero at runtime | 1-5ms per monitor |
| **Finds** | Input regions with guaranteed violations | Actual violations at runtime |
| **Regulatory value** | Design evidence (ISO 26262 Pt 6) | Operational evidence (UL 4600 Cl 7.6) |

### 7.2 The Verification Hierarchy for reference airside AV stack

The recommended layered approach, from strongest to weakest guarantees:

**Layer 1 -- Complete formal verification (design time):**
- Target: Simplex decision module, emergency stop classifier, CBF approximator
- Method: Marabou, MILP (Gurobi)
- Property: Correctness over entire specified input region
- Coverage: 100% of specified region (sound and complete)
- Cost: $15-30K, 4-8 weeks

**Layer 2 -- Certified bounds (design time):**
- Target: PointPillars detection head, policy network
- Method: alpha-beta-CROWN, certified training
- Property: Robustness within epsilon-ball of each training input
- Coverage: All inputs within epsilon of training distribution
- Cost: $20-40K, 6-10 weeks

**Layer 3 -- Lipschitz analysis (design time):**
- Target: All neural network components
- Method: SeqLip, spectral analysis
- Property: Bounded output sensitivity to input perturbations
- Coverage: Global (but coarse -- only bounds sensitivity, not correctness)
- Cost: $5-10K, 2-4 weeks

**Layer 4 -- Runtime verification (execution time):**
- Target: Entire AV stack (neural + classical)
- Method: STL monitors, OOD detection, shield synthesis
- Property: Temporal safety specifications (speed limits, clearances, zones)
- Coverage: 100% of executed traces (sound for observed behavior)
- Cost: Already implemented (see `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`)

**Layer 5 -- Testing (design + execution time):**
- Target: All components
- Method: Unit tests, integration tests, simulation, shadow mode
- Property: Empirical correctness on test cases
- Coverage: Tested inputs only (unsound, incomplete, but practical)
- Cost: Ongoing (part of standard development)

### 7.3 When Static Verification Fails: Runtime Fallback

For components that cannot be statically verified (full perception backbone, large transformers), the runtime verification layer provides the safety net:

```
If static_verification(component) = VERIFIED:
    # Property holds for all inputs in region -- no runtime check needed
    deploy(component)
    
If static_verification(component) = UNVERIFIED:
    # Cannot prove property statically
    deploy(component, runtime_monitor=True)
    # Runtime monitor checks safety property every cycle
    # If violation detected: trigger Simplex switch to BC
```

This is precisely the defense-in-depth philosophy described in `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md` and `60-safety-validation/runtime-assurance/simplex-safety-architecture.md`.

---

## 8. Practical Verification Budgets for Orin-Deployable Models

### 8.1 Model Inventory

The reference airside AV stack deploys the following neural network components on NVIDIA Orin (see `20-av-platform/compute/nvidia-orin-technical.md`):

| Component | Architecture | Parameters | Layers | ReLU Neurons | Verifiable? |
|-----------|-------------|-----------|--------|-------------|-------------|
| PointPillars (full) | Pillar encoder + BEV CNN + heads | ~9M | 40+ | ~2M | Partial (heads only) |
| PointPillars (detection head) | 2-layer CNN | ~1M | 6 | ~50K | Yes (CROWN) |
| PointPillars (segmentation head) | 2-layer CNN | ~500K | 4 | ~25K | Yes (CROWN) |
| CenterPoint (voxel encoder) | VoxelNet + sparse 3D CNN | ~5M | 30+ | ~1M | No (sparse conv) |
| CenterPoint (detection head) | Center heatmap CNN | ~800K | 6 | ~40K | Yes (CROWN) |
| Policy network (RL) | MLP 256-256-128 | ~150K | 6 | 640 | Yes (complete) |
| CBF approximator | MLP 128-128 | ~35K | 4 | 256 | Yes (complete) |
| Simplex decision | MLP 64-64 | ~10K | 4 | 128 | Yes (complete) |
| Emergency stop | MLP 128-64 | ~20K | 4 | 192 | Yes (complete) |
| OOD detector (energy) | Single linear | ~5K | 1 | 0 | Yes (trivial) |
| VLM co-pilot (InternVL2-2B) | Vision Transformer | 2B | 100+ | ~500M | No |
| Thermal YOLO head | CSPDarknet + head | ~3M | 50+ | ~500K | Partial |

### 8.2 Verification Budget Allocation

Given finite verification resources, prioritize based on: (1) safety criticality, (2) verifiability, (3) regulatory value.

| Component | Priority | Method | Time Budget | Compute Budget | Expected Outcome |
|-----------|----------|--------|-------------|---------------|-----------------|
| Simplex decision | P0 (critical) | Marabou (complete) | 2 weeks | 48 CPU-hours | Full proof |
| Emergency stop | P0 | Marabou (complete) | 2 weeks | 96 CPU-hours | Full proof |
| CBF approximator | P0 | Marabou + CROWN | 3 weeks | 200 CPU-hours | Full proof with bounds |
| Policy network | P1 (high) | alpha-beta-CROWN | 3 weeks | 500 GPU-hours | Certified radius >0.005 |
| Detection head (aircraft) | P1 | CROWN + certified training | 4 weeks | 300 GPU-hours | Certified robust for aircraft class |
| Detection head (personnel) | P1 | CROWN + certified training | 4 weeks | 300 GPU-hours | Certified robust for personnel class |
| Segmentation head | P2 (medium) | CROWN | 2 weeks | 200 GPU-hours | Bounds on class confusion |
| CenterPoint head | P2 | CROWN | 2 weeks | 200 GPU-hours | Bounds on detection shift |
| Full PointPillars | P3 (low) | Lipschitz + testing | 2 weeks | 100 GPU-hours | Lipschitz bound only |
| Thermal YOLO | P3 | Testing + runtime monitor | 1 week | 50 GPU-hours | Empirical robustness |
| VLM co-pilot | P4 (info) | Runtime monitor only | 0 weeks | 0 | Not verifiable |

### 8.3 Verification Time Estimates

Verification runtime depends heavily on network size, property complexity, and precision required:

```
Approximate verification time (alpha-beta-CROWN, single A100 GPU):
  
  10K params, robustness property:    ~1 second per input
  100K params, robustness property:   ~30 seconds per input  
  1M params, robustness property:     ~5-30 minutes per input
  10M params, robustness property:    ~1-10 hours per input (often timeout)

For safety certification, we need to verify across representative inputs:
  - Minimum: 100 inputs per class per condition = ~1,800 inputs
  - Recommended: 1,000 inputs per class per condition = ~18,000 inputs

Total verification compute for PointPillars detection head:
  1M params * 1,800 inputs * ~10 min/input = ~300 GPU-hours
  On 4x A100 cluster: ~3.1 days wall-clock
  
Total verification compute for Simplex decision (10K params):
  Complete verification (all inputs): ~48 CPU-hours on 16-core machine
  Wall-clock: ~3 hours
```

---

## 9. Verification for Specific AV Components

### 9.1 Perception: Certified Detection Radius

For perception networks, the key property is certified detection: given a true object at position (x, y, z), the network correctly detects it despite bounded sensor noise.

**Certified detection radius:** The maximum sensor noise epsilon_c such that the detection confidence remains above the threshold tau for all perturbations within epsilon_c:

```
epsilon_c = max{epsilon : forall ||delta|| <= epsilon, 
                f(x + delta)[class_correct] >= tau}
```

Computing epsilon_c via binary search with alpha-beta-CROWN:

```python
import torch
from auto_LiRPA import BoundedModule, BoundedTensor, PerturbationLpNorm

def compute_certified_radius(model, x, true_class, threshold=0.5,
                              eps_min=0.0, eps_max=0.1, 
                              tolerance=0.001, method='CROWN'):
    """
    Compute the certified robustness radius for a detection.
    
    Returns the maximum epsilon such that:
        forall ||delta||_inf <= epsilon:
            model(x + delta)[true_class] >= threshold
    
    Uses binary search with CROWN bounds.
    """
    bounded_model = BoundedModule(model, x)
    
    while eps_max - eps_min > tolerance:
        eps_mid = (eps_min + eps_max) / 2
        
        # Create bounded input
        ptb = PerturbationLpNorm(norm=float('inf'), eps=eps_mid)
        bounded_input = BoundedTensor(x, ptb)
        
        # Compute lower bound on true class output
        lb, ub = bounded_model.compute_bounds(
            x=(bounded_input,), method=method
        )
        
        # Check if lower bound on true class exceeds threshold
        true_class_lb = lb[0, true_class].item()
        
        if true_class_lb >= threshold:
            # Certified at this epsilon -- try larger
            eps_min = eps_mid
        else:
            # Cannot certify at this epsilon -- try smaller
            eps_max = eps_mid
    
    return eps_min


# Example usage for personnel detection
# model = loaded PointPillars detection head
# x = BEV feature tensor for a scene with a person at 20m
# true_class = 7  (personnel class index)
# 
# certified_radius = compute_certified_radius(
#     model, x, true_class=7, threshold=0.5
# )
# print(f"Certified radius: {certified_radius:.4f}")
# Typical output: Certified radius: 0.0082
# Interpretation: detection is guaranteed correct for sensor noise 
# up to 0.82% of feature range
```

**Interpreting certified radii for airside safety:**

| Object Class | Required Confidence | Typical Certified Radius | Sufficient? |
|-------------|-------------------|------------------------|-------------|
| Aircraft fuselage | 0.9 | 0.012 | Yes (large, high-SNR target) |
| Personnel (standing) | 0.95 | 0.006 | Marginal (depends on range) |
| Personnel (crouching) | 0.95 | 0.003 | Insufficient at >30m |
| FOD (small object) | 0.7 | 0.002 | Insufficient |
| GSE vehicle | 0.85 | 0.010 | Yes |
| Cone/barrier | 0.7 | 0.008 | Yes |

The insufficient radii for crouching personnel and FOD at long range indicate that certified training (Section 5) is needed specifically for these safety-critical classes, and runtime monitoring provides the necessary complement.

### 9.2 Planning: Trajectory Safety Verification

For neural motion planners (see `30-autonomy-stack/planning/neural-motion-planning.md`), verify that generated trajectories satisfy kinematic and safety constraints:

**Property 1 -- Kinematic feasibility:**
```
forall s in S : |f_plan(s).curvature| <= kappa_max  AND
                |f_plan(s).acceleration| <= a_max     AND
                |f_plan(s).jerk| <= j_max
```

For the reference airside AV stack third-generation tug (Ackermann, min turning radius ~6m): kappa_max = 1/6 = 0.167 m^-1.

**Property 2 -- Minimum clearance:**
```
forall s in S, forall t in [0, T_horizon]:
    d(trajectory(s, t), obstacle_nearest) >= d_safe
```

This requires composing the planner with a distance computation, making it harder to verify. Practical approach: verify that the planner's output waypoints satisfy the CBF constraint h(x) >= 0, which implies safety.

**Property 3 -- Terminal safety:**
```
forall s in S : v(trajectory(s, T_horizon)) <= v_safe  OR
                d(trajectory(s, T_horizon), obstacle) >= d_brake(v)
```

### 9.3 Control: Neural Lyapunov Verification

For neural controllers (including learned CBF and Lyapunov functions), verification establishes stability and safety:

**Neural Lyapunov function:** V(x) is a valid Lyapunov function if:
1. V(x) > 0 for all x != 0 (positive definiteness)
2. V(0) = 0
3. dV/dt = grad(V) * f(x, u) < 0 for all x != 0 (decrease along trajectories)

Verifying condition 3 requires composing the Lyapunov network V with the dynamics f and the controller pi:

```
Verify: forall x in X\{0} : 
    nabla_V(x) . f(x, pi(x)) < -alpha * V(x)   for some alpha > 0
```

**dReal (Gao et al., 2013):** An SMT solver over the reals with delta-decidability, capable of handling nonlinear dynamics (transcendental functions). Suitable for verifying neural Lyapunov functions when the dynamics include trigonometric terms (as in the bicycle kinematic model used by reference airside AV stack).

**Verification of the bicycle model controller:**

The reference airside vehicles use a Stanley lateral controller. If a neural controller replaces or augments Stanley, verification can establish:

```
forall (e_y, e_psi, v) in S_operate:
    |e_y(t + T)| < |e_y(t)|   AND   |e_psi(t + T)| < |e_psi(t)|
```

where e_y is lateral error and e_psi is heading error. This guarantees convergence to the reference path.

### 9.4 Verification for Multi-Task Perception

For the shared-backbone multi-head architecture described in `30-autonomy-stack/perception/overview/multi-task-unified-perception.md`, verification faces an additional challenge: task interference. A perturbation that preserves detection accuracy might degrade segmentation.

**Cross-task robustness:** Verify that for all perturbations within epsilon, ALL task heads maintain correct outputs:

```
forall ||delta|| <= epsilon:
    f_det(x + delta) = f_det(x)     AND
    f_seg(x + delta) = f_seg(x)     AND
    f_flow(x + delta) ~= f_flow(x)  (within tolerance)
```

This is strictly harder than single-task verification because the joint certified radius is the minimum across all tasks. In practice, the segmentation head often has the smallest certified radius (pixel-level predictions are more sensitive than object-level detections).

---

## 10. Tools and Frameworks

### 10.1 Tool Comparison

| Tool | Type | Architectures | Max Model Size | GPU Support | License | Maturity |
|------|------|--------------|---------------|-------------|---------|----------|
| **alpha-beta-CROWN** | Bound propagation + BaB | CNN, ResNet, Transformer (limited) | ~10M params | Yes (essential) | BSD-3 | Production (VNN-COMP winner) |
| **auto_LiRPA** | Bound propagation library | Any PyTorch model | ~50M params (bounds only) | Yes | BSD-3 | Production |
| **Marabou** | SMT (Reluplex) | MLP, CNN (unrolled) | ~100K params | No (CPU only) | MIT | Research/production |
| **ERAN** | Abstract interpretation | CNN, MLP, LSTM | ~5M params | Partial | Apache 2.0 | Research |
| **NNV** | Reachability (star sets) | MLP, CNN | ~500K params | No | BSD-3 | Research |
| **PyRAT** | Abstract interpretation | MLP, CNN, RNN | ~5M params | No | Proprietary | Commercial |
| **Gurobi** | MILP solver (general) | MLP, CNN (encoded) | ~100K params (as MILP) | No | Commercial ($10K+/yr) | Production |
| **nnenum** | Enumeration + star sets | ReLU MLP | ~50K params | No | MIT | Research |
| **dReal** | delta-SMT | Nonlinear dynamics + NN | ~10K params | No | Apache 2.0 | Research |
| **Certified Patch Robustness** | Randomized smoothing | Any (black-box) | Unlimited | Yes | Various | Research |

### 10.2 auto_LiRPA: Primary Tool for reference airside AV stack

auto_LiRPA (Automatic Linear Relaxation based Perturbation Analysis) is the recommended primary verification tool for several reasons:

1. **PyTorch-native:** Works directly with PyTorch models -- no model conversion needed
2. **GPU-accelerated:** Bound computation runs on GPU, essential for large models
3. **Multiple methods:** Supports IBP, CROWN, alpha-CROWN, beta-CROWN, forward/backward mode
4. **Certified training:** Integrates bound computation into training loop (differentiable bounds)
5. **Active development:** Maintained by the alpha-beta-CROWN team (CMU, UIUC)
6. **Architecture support:** Handles Conv2d, Linear, ReLU, BatchNorm, ResNet skip connections

**Basic verification query with auto_LiRPA:**

```python
import torch
import torch.nn as nn
from auto_LiRPA import BoundedModule, BoundedTensor, PerturbationLpNorm

# ---------------------------------------------------------
# Example: Verify that a Simplex decision network always
# outputs SWITCH_TO_BC when input features indicate unsafe
# ---------------------------------------------------------

class SimplexDecisionNet(nn.Module):
    """
    Small network that decides AC (neural) vs BC (classical Frenet).
    Input: 8-dim state features [speed, accel, min_obstacle_dist,
           localization_uncertainty, perception_confidence,
           path_deviation, heading_error, cbf_value]
    Output: 2-dim [stay_AC_score, switch_to_BC_score]
    """
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(8, 64),
            nn.ReLU(),
            nn.Linear(64, 64),
            nn.ReLU(),
            nn.Linear(64, 2)
        )
    
    def forward(self, x):
        return self.net(x)


def verify_simplex_safety(model, unsafe_region_center, unsafe_radius,
                           method='alpha-CROWN'):
    """
    Verify that the Simplex decision network outputs switch_to_BC
    for ALL inputs in the specified unsafe region.
    
    Formally: forall x in B(center, radius):
        model(x)[1] > model(x)[0]
        (switch_to_BC score > stay_AC score)
    """
    model.eval()
    x0 = unsafe_region_center.unsqueeze(0)  # [1, 8]
    
    # Wrap model for verification
    bounded_model = BoundedModule(model, x0)
    
    # Define perturbation region (L-inf ball around unsafe center)
    ptb = PerturbationLpNorm(norm=float('inf'), eps=unsafe_radius)
    bounded_input = BoundedTensor(x0, ptb)
    
    # Compute bounds on output
    lb, ub = bounded_model.compute_bounds(
        x=(bounded_input,), method=method
    )
    
    # lb[0, 0] = lower bound on stay_AC score
    # lb[0, 1] = lower bound on switch_to_BC score
    # ub[0, 0] = upper bound on stay_AC score
    
    # Safety condition: switch_to_BC lower bound > stay_AC upper bound
    margin = lb[0, 1].item() - ub[0, 0].item()
    
    verified = margin > 0
    return {
        'verified': verified,
        'margin': margin,
        'stay_ac_bounds': (lb[0, 0].item(), ub[0, 0].item()),
        'switch_bc_bounds': (lb[0, 1].item(), ub[0, 1].item()),
    }


# Define unsafe region: obstacle within 3m and speed > 5 km/h
# Feature encoding: [speed_norm, accel_norm, min_dist_norm, ...]
unsafe_center = torch.tensor([
    0.4,   # speed: ~10 km/h (normalized)
    0.0,   # acceleration: 0
    0.1,   # min_obstacle_dist: ~2m (normalized, very close)
    0.5,   # localization uncertainty: medium
    0.7,   # perception confidence: reasonable
    0.3,   # path deviation: moderate
    0.2,   # heading error: small
    -0.1,  # cbf_value: slightly negative (unsafe)
])

# Verify over a region (accounting for state estimation uncertainty)
result = verify_simplex_safety(
    model=SimplexDecisionNet(),
    unsafe_region_center=unsafe_center,
    unsafe_radius=0.05  # 5% feature variation
)

print(f"Verified: {result['verified']}")
print(f"Margin: {result['margin']:.4f}")
print(f"Stay AC bounds: [{result['stay_ac_bounds'][0]:.4f}, "
      f"{result['stay_ac_bounds'][1]:.4f}]")
print(f"Switch BC bounds: [{result['switch_bc_bounds'][0]:.4f}, "
      f"{result['switch_bc_bounds'][1]:.4f}]")
```

### 10.3 Marabou: Complete Verification for Small Networks

```python
# Marabou example: complete verification of emergency stop network
# Requires: pip install maraboupy

from maraboupy import Marabou, MarabouUtils

def verify_emergency_stop(onnx_path, property_spec):
    """
    Verify that the emergency stop network triggers (output > 0)
    for all inputs in the specified dangerous region.
    
    Uses Marabou's complete SMT solver -- will find a counterexample
    if one exists, or prove the property if it holds.
    """
    # Load network from ONNX
    network = Marabou.read_onnx(onnx_path)
    
    # Get input and output variables
    inputVars = network.inputVars[0][0]
    outputVars = network.outputVars[0]
    
    # Set input constraints (dangerous region)
    # Input 0: time_to_collision, range [0.0, 2.0] seconds
    network.setLowerBound(inputVars[0], 0.0)
    network.setUpperBound(inputVars[0], 2.0)
    
    # Input 1: relative_speed, range [0.5, 5.0] m/s (approaching)
    network.setLowerBound(inputVars[1], 0.5)
    network.setUpperBound(inputVars[1], 5.0)
    
    # Input 2: obstacle_confidence, range [0.7, 1.0]
    network.setLowerBound(inputVars[2], 0.7)
    network.setUpperBound(inputVars[2], 1.0)
    
    # Input 3: obstacle_class_personnel, range [0.8, 1.0]
    network.setLowerBound(inputVars[3], 0.8)
    network.setUpperBound(inputVars[3], 1.0)
    
    # Property to verify: output[0] (stop_score) > output[1] (continue_score)
    # Negate for Marabou (find counterexample):
    # output[0] - output[1] <= 0  (if SAT, property is violated)
    eq = MarabouUtils.Equation(EquationType=Marabou.Equation.LE)
    eq.addAddend(1.0, outputVars[0])   # stop_score
    eq.addAddend(-1.0, outputVars[1])  # -continue_score
    eq.setScalar(0.0)                  # stop_score - continue_score <= 0
    network.addEquation(eq)
    
    # Solve
    result = network.solve(verbose=True, timeout=3600)
    
    if result[0] == 'unsat':
        print("VERIFIED: Emergency stop always triggers in dangerous region")
        return True
    elif result[0] == 'sat':
        counterexample = result[1]
        print(f"COUNTEREXAMPLE FOUND:")
        print(f"  time_to_collision = {counterexample[inputVars[0]]:.4f}")
        print(f"  relative_speed = {counterexample[inputVars[1]]:.4f}")
        print(f"  obstacle_confidence = {counterexample[inputVars[2]]:.4f}")
        print(f"  class_personnel = {counterexample[inputVars[3]]:.4f}")
        print(f"  stop_score = {counterexample[outputVars[0]]:.4f}")
        print(f"  continue_score = {counterexample[outputVars[1]]:.4f}")
        return False
    else:
        print(f"TIMEOUT or UNKNOWN: {result[0]}")
        return None
```

### 10.4 Integration with ROS Safety Node

Verification results must be integrated into the operational safety architecture. The following shows how offline verification results inform runtime safety parameters:

```python
#!/usr/bin/env python3
"""
ROS node that loads and applies formal verification results
to runtime safety parameters.

Integrates with:
- Simplex decision module (60-safety-validation/runtime-assurance/simplex-safety-architecture.md)
- CBF safety filter (30-autonomy-stack/planning/safety-critical-planning-cbf.md)
- STL runtime monitors (60-safety-validation/runtime-assurance/runtime-verification-monitoring.md)

Publishes verified safety margins to /safety/verified_margins topic
for consumption by the CBF-QP solver and Simplex monitor.
"""

import rospy
import json
import numpy as np
from std_msgs.msg import Float64MultiArray, String
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue


class VerificationSafetyNode:
    """
    Loads offline verification certificates and publishes
    verified safety parameters for runtime use.
    """
    
    def __init__(self):
        rospy.init_node('verification_safety_node')
        
        # Load verification certificates (generated offline)
        cert_path = rospy.get_param(
            '~certificate_path',
            '/home/airside_av/airside-ws/config/verification_certificates.json'
        )
        self.certificates = self._load_certificates(cert_path)
        
        # Publishers
        self.margin_pub = rospy.Publisher(
            '/safety/verified_margins',
            Float64MultiArray, queue_size=1
        )
        self.status_pub = rospy.Publisher(
            '/safety/verification_status',
            DiagnosticArray, queue_size=1
        )
        
        # Timer: publish at 10 Hz (matches planning cycle)
        self.timer = rospy.Timer(
            rospy.Duration(0.1), self.publish_margins
        )
        
        rospy.loginfo(
            f"Verification safety node initialized with "
            f"{len(self.certificates)} certificates"
        )
    
    def _load_certificates(self, path):
        """Load offline verification certificates."""
        try:
            with open(path, 'r') as f:
                certs = json.load(f)
            
            # Validate certificate structure
            required_fields = [
                'component', 'property', 'method', 'result',
                'certified_radius', 'lipschitz_bound',
                'safety_margin', 'timestamp'
            ]
            for cert in certs:
                for field in required_fields:
                    if field not in cert:
                        rospy.logwarn(
                            f"Certificate missing field: {field}"
                        )
            
            return certs
        except FileNotFoundError:
            rospy.logerr(f"Certificate file not found: {path}")
            # Return conservative defaults if no certificates
            return self._default_certificates()
    
    def _default_certificates(self):
        """Conservative defaults when no certificates are available."""
        return [{
            'component': 'default',
            'property': 'unverified',
            'method': 'none',
            'result': 'unverified',
            'certified_radius': 0.0,
            'lipschitz_bound': float('inf'),
            'safety_margin': 2.0,  # Maximum conservative margin
            'timestamp': ''
        }]
    
    def get_margin_for_component(self, component_name):
        """
        Get the verified safety margin for a specific component.
        
        Safety margin = Lipschitz_bound * sensor_noise_bound
        This margin is added to the CBF constraint to account for
        neural network sensitivity to input perturbations.
        """
        for cert in self.certificates:
            if cert['component'] == component_name:
                if cert['result'] == 'verified':
                    return cert['safety_margin']
                else:
                    # Unverified: use conservative default
                    return 2.0  # meters
        return 2.0  # Unknown component: maximum conservatism
    
    def publish_margins(self, event):
        """Publish verified margins for all components."""
        msg = Float64MultiArray()
        
        # Order: [detection_margin, segmentation_margin, 
        #         policy_margin, cbf_margin, simplex_margin]
        margins = [
            self.get_margin_for_component('detection_head'),
            self.get_margin_for_component('segmentation_head'),
            self.get_margin_for_component('policy_network'),
            self.get_margin_for_component('cbf_approximator'),
            self.get_margin_for_component('simplex_decision'),
        ]
        msg.data = margins
        self.margin_pub.publish(msg)
        
        # Also publish diagnostic status
        self._publish_diagnostics()
    
    def _publish_diagnostics(self):
        """Publish verification status as ROS diagnostics."""
        diag_msg = DiagnosticArray()
        diag_msg.header.stamp = rospy.Time.now()
        
        for cert in self.certificates:
            status = DiagnosticStatus()
            status.name = f"verification/{cert['component']}"
            
            if cert['result'] == 'verified':
                status.level = DiagnosticStatus.OK
                status.message = (
                    f"Verified via {cert['method']}, "
                    f"radius={cert['certified_radius']:.4f}"
                )
            elif cert['result'] == 'partial':
                status.level = DiagnosticStatus.WARN
                status.message = (
                    f"Partially verified, "
                    f"Lipschitz bound={cert['lipschitz_bound']:.1f}"
                )
            else:
                status.level = DiagnosticStatus.ERROR
                status.message = "Not verified -- using conservative margins"
            
            status.values = [
                KeyValue('certified_radius', 
                         str(cert['certified_radius'])),
                KeyValue('lipschitz_bound', 
                         str(cert['lipschitz_bound'])),
                KeyValue('safety_margin_m', 
                         str(cert['safety_margin'])),
                KeyValue('method', cert['method']),
                KeyValue('verification_date', cert['timestamp']),
            ]
            diag_msg.status.append(status)
        
        self.status_pub.publish(diag_msg)


if __name__ == '__main__':
    try:
        node = VerificationSafetyNode()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

**Example verification certificate JSON:**

```json
[
    {
        "component": "simplex_decision",
        "property": "always_switches_in_unsafe_region",
        "method": "Marabou_complete",
        "result": "verified",
        "certified_radius": 0.05,
        "lipschitz_bound": 3.2,
        "safety_margin": 0.16,
        "timestamp": "2026-04-01T14:30:00Z",
        "verification_time_seconds": 1847,
        "counterexamples_found": 0,
        "input_region": {
            "description": "cbf_value < 0 AND min_dist < 3m",
            "bounds": [[0, 1], [0, 1], [0, 0.3], [0, 1], [0, 1], [0, 1], [0, 1], [-1, 0]]
        }
    },
    {
        "component": "detection_head",
        "property": "aircraft_detection_robust",
        "method": "alpha-beta-CROWN",
        "result": "verified",
        "certified_radius": 0.012,
        "lipschitz_bound": 15.3,
        "safety_margin": 0.31,
        "timestamp": "2026-04-05T09:15:00Z",
        "verification_time_seconds": 86400,
        "counterexamples_found": 0,
        "input_region": {
            "description": "BEV features with aircraft present, L_inf ball",
            "num_inputs_verified": 2400
        }
    },
    {
        "component": "cbf_approximator",
        "property": "conservative_approximation",
        "method": "Marabou_complete",
        "result": "verified",
        "certified_radius": 0.03,
        "lipschitz_bound": 1.8,
        "safety_margin": 0.054,
        "timestamp": "2026-04-03T11:00:00Z",
        "verification_time_seconds": 3600,
        "counterexamples_found": 0,
        "input_region": {
            "description": "Full state space within operational envelope",
            "bounds": "see cbf_verification_report.pdf"
        }
    }
]
```

---

## 11. Integration with Existing Safety Architecture

### 11.1 Verification in the Defense-in-Depth Stack

Formal verification slots into the reference airside AV stack's existing defense-in-depth architecture as the design-time complement to runtime safeguards:

```
┌─────────────────────────────────────────────────────────────┐
│                    DESIGN-TIME VERIFICATION                  │
│                                                              │
│  Layer 0: Formal Verification (this document)                │
│    - Complete proofs for small safety-critical networks       │
│    - Certified bounds for perception/planning heads          │
│    - Lipschitz analysis for all neural components            │
│    - Certified training for robustness                       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    RUNTIME SAFETY STACK                       │
│                                                              │
│  Layer 1: STL Runtime Monitors (<1ms)                        │
│    [60-safety-validation/runtime-assurance/runtime-verification-monitoring.md]     │
│    - 20 concurrent airside-specific temporal specs            │
│    - OOD detection (energy + Mahalanobis)                     │
│    - Anomaly detection and health monitoring                  │
│                                                              │
│  Layer 2: CBF Safety Filter (<500us)                          │
│    [30-autonomy-stack/planning/safety-critical-planning-cbf.md]      │
│    - CBF-QP with VERIFIED safety margins from Layer 0        │
│    - Measurement-robust CBFs using GTSAM covariance          │
│    - Margins TIGHTENED by Lipschitz * sensor_noise            │
│                                                              │
│  Layer 3: Simplex Architecture                                │
│    [60-safety-validation/runtime-assurance/simplex-safety-architecture.md]         │
│    - Decision module FORMALLY VERIFIED (complete proof)       │
│    - AC: Neural planner (verified bounds on output)           │
│    - BC: Classical Frenet (not ML, traditional verification) │
│                                                              │
│  Layer 4: Safety MCU (hardware)                               │
│    [60-safety-validation/runtime-assurance/runtime-verification-monitoring.md]     │
│    - STM32H725, MISRA C, hardware speed limiter              │
│    - Not neural -- standard hardware verification            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 How Verification Results Flow to Runtime

The key integration points between formal verification (static, design-time) and runtime safety:

**1. Verification -> CBF margin tightening:**
```
Verified Lipschitz bound L = 15.3 for detection head
Sensor noise bound epsilon = 0.02 (from RoboSense spec)
-> Detection output uncertainty <= L * epsilon = 0.306
-> CBF safety margin increased by 0.306 * distance_scaling
```

**2. Verification -> Simplex confidence:**
```
Simplex decision module: VERIFIED (complete proof via Marabou)
-> No runtime monitor needed for Simplex decision logic itself
-> Monitor only needed for input feature validity (already in Layer 1)
```

**3. Verification -> OOD detection threshold:**
```
Certified radius for personnel detection = 0.006
-> Inputs with feature distance > 0.006 from training distribution
   are outside certified region
-> OOD detector threshold calibrated to flag these inputs
-> Flagged inputs trigger increased safety margins (not immediate stop)
```

**4. Verification -> Testing reduction:**
```
Properties verified via formal methods require ZERO testing
  (per DO-333 formal methods supplement)
Properties with certified bounds require reduced testing
  (focus testing on regions near the boundary of certified radius)
Properties without verification require full testing
  (4,600+ tests per Zhao-Weng formula)
```

### 11.3 Connection to ISO 3691-4 Safety Case

ISO 3691-4 requires a safety case demonstrating that the AV satisfies safety requirements. Formal verification provides the strongest evidence tier in the safety case hierarchy:

| Evidence Type | ISO 3691-4 Relevance | Strength | Example |
|--------------|---------------------|----------|---------|
| Formal proof | Safety function correctness | Strongest | "Simplex always switches when CBF < 0" |
| Certified bounds | Perception robustness | Strong | "Detection robust to 0.012 L-inf noise" |
| Lipschitz analysis | Sensitivity characterization | Medium | "Output changes <= 15.3x input change" |
| Statistical testing | Empirical reliability | Medium | "4,600 zero-failure tests, 99.9% reliability" |
| Shadow mode data | Operational evidence | Supporting | "0 disagreements per 1,000 km" |

For assessor acceptance, the recommended presentation order in the safety case:
1. System architecture (Simplex, CBF, runtime monitors) -- show defense-in-depth
2. Formal verification results for safety-critical components -- demonstrate rigor
3. Certified robustness of perception/planning -- quantify ML reliability
4. Testing and simulation results -- provide empirical confidence
5. Runtime monitoring architecture -- show operational safety net
6. Shadow mode and deployment data -- demonstrate real-world performance

### 11.4 Connection to EU AI Act Compliance

The EU AI Act (effective August 2026 for high-risk AI) requires:

| EU AI Act Requirement | Formal Verification Contribution |
|----------------------|--------------------------------|
| Art. 9: Risk management system | Verification identifies and bounds risk from neural components |
| Art. 10: Data governance | Certified training ensures robustness is built in, not incidental |
| Art. 13: Transparency | Verification reports explain what the model is proven to do |
| Art. 15: Accuracy, robustness, cybersecurity | Certified robustness directly addresses this requirement |
| Art. 17: Quality management system | Verification pipeline provides repeatable, auditable evidence |
| Annex IV: Technical documentation | Verification certificates are first-class documentation artifacts |

### 11.5 Functional Safety (ISO 26262 Part 6) Connection

While ISO 26262 was written for traditional software (see `60-safety-validation/standards-certification/functional-safety-software.md`), its principles extend to neural network components:

| ISO 26262 Pt6 Requirement | Traditional | Neural Network Equivalent |
|--------------------------|-------------|--------------------------|
| Unit testing | Code unit tests | Per-input verification queries |
| Integration testing | Module interface tests | Compositional verification |
| Requirements-based testing | Tests from requirements | Formal specs from safety requirements |
| Structural coverage (MC/DC) | Statement/branch coverage | Neuron activation coverage + certified bounds |
| Static analysis | MISRA C compliance | Lipschitz analysis, weight analysis |
| Formal verification | Model checking | SMT/MILP verification, certified training |

The key insight: for ASIL-B and above, ISO 26262 recommends (and for ASIL-D, mandates) formal verification. Neural network formal verification directly satisfies this requirement for ML components in the safety path.

---

## 12. Implementation Roadmap and Costs

### 12.1 Phased Implementation

**Phase 1: Foundation (Weeks 1-6, $15-25K)**

| Task | Duration | Cost | Deliverable |
|------|----------|------|-------------|
| Set up auto_LiRPA + Marabou infrastructure | 1 week | $3K | Docker environment, CI integration |
| Export Simplex decision network to ONNX | 0.5 weeks | $1K | Verified ONNX model |
| Complete verification of Simplex decision | 2 weeks | $5K | Formal proof certificate |
| Complete verification of emergency stop | 2 weeks | $5K | Formal proof certificate |
| Lipschitz analysis of all deployed models | 1 week | $3K | Lipschitz bound report |
| Documentation and safety case integration | 0.5 weeks | $2K | Updated safety case |

**Phase 2: Perception Certification (Weeks 7-16, $25-40K)**

| Task | Duration | Cost | Deliverable |
|------|----------|------|-------------|
| alpha-beta-CROWN verification of detection head | 4 weeks | $10K | Certified robustness per class |
| Certified training (SABR) for PointPillars | 3 weeks | $8K | Retrained model with certificates |
| Verification of segmentation head | 2 weeks | $5K | Certified class confusion bounds |
| GPU compute for verification (A100 cluster) | 10 weeks | $8K | Verification results |
| Cross-validation against runtime monitors | 1 week | $3K | Consistency report |

**Phase 3: Planning and Control (Weeks 17-24, $15-25K)**

| Task | Duration | Cost | Deliverable |
|------|----------|------|-------------|
| Verify CBF approximator (Marabou) | 2 weeks | $5K | Conservativeness proof |
| Verify policy network bounds (CROWN) | 3 weeks | $7K | Output bounds certificate |
| Neural Lyapunov verification (dReal) | 2 weeks | $5K | Stability certificate |
| Integration with CBF-QP margin computation | 1 week | $3K | Automated margin pipeline |

**Phase 4: Production Pipeline (Weeks 25-32, $10-15K)**

| Task | Duration | Cost | Deliverable |
|------|----------|------|-------------|
| CI/CD integration (verify on every model update) | 2 weeks | $5K | Automated verification pipeline |
| ROS verification safety node | 1 week | $3K | Runtime margin publisher |
| Certificate management and audit trail | 1 week | $2K | Certificate DB + dashboard |
| Safety case update for ISO 3691-4 assessment | 2 weeks | $3K | Complete safety case section |
| Final documentation | 1 week | $2K | Technical report |

### 12.2 Total Cost Summary

| Phase | Duration | Cost | Key Outcome |
|-------|----------|------|-------------|
| Phase 1: Foundation | 6 weeks | $15-25K | Formal proofs for safety-critical modules |
| Phase 2: Perception | 10 weeks | $25-40K | Certified robust perception |
| Phase 3: Planning/Control | 8 weeks | $15-25K | Verified planning safety |
| Phase 4: Production | 8 weeks | $10-15K | Automated verification pipeline |
| **Total** | **32 weeks** | **$65-105K** | **Complete verification suite** |

### 12.3 Ongoing Costs

| Item | Frequency | Cost | Notes |
|------|-----------|------|-------|
| Re-verification after model update | Per update | $2-5K | Automated pipeline reduces to 1-2 days |
| GPU compute for verification | Monthly | $500-1K | A100 spot instances |
| Tool maintenance and updates | Quarterly | $1K | Track VNN-COMP advances |
| Certificate audit | Annual | $3-5K | For ISO 3691-4 renewal |
| **Annual total** | | **$15-25K** | Assuming ~4 model updates/year |

### 12.4 ROI Analysis

| Benefit | Quantification | Annual Value |
|---------|---------------|-------------|
| Reduced testing (DO-333 credit) | 30-50% fewer tests for verified components | $20-40K |
| Faster certification | 2-4 weeks saved per ISO 3691-4 assessment | $10-20K |
| Earlier bug detection | 1-2 safety-critical bugs found pre-deployment/year | $50-200K (incident avoided) |
| EU AI Act compliance | Avoids non-compliance penalties (up to 3% global turnover) | Risk mitigation |
| Competitive differentiation | Only airside AV with formal verification evidence | Strategic |

Breakeven: verification pays for itself if it prevents even a single safety incident that would otherwise occur during supervised deployment. Given the $250K average cost of aircraft GSE damage (and up to $139M for structural damage), the $65-105K verification investment is well-justified.

---

## 13. Key Takeaways

1. **Neural network verification is NP-complete in general**, but practical for safety-critical subcomponents. The key is choosing *what* to verify, not attempting to verify everything.

2. **Complete verification (Marabou, MILP) scales to ~100K parameters.** This covers the Simplex decision module (~10K params), emergency stop classifier (~20K), and CBF approximator (~35K) -- precisely the most safety-critical components.

3. **alpha-beta-CROWN (VNN-COMP winner, 5 consecutive years) scales to ~10M parameters** with over-approximation. This covers PointPillars detection heads (~1M) and policy networks (~150K) with tight certified bounds.

4. **Certified training (SABR) costs only 3-4% clean accuracy** while providing meaningful robustness certificates. This is a worthwhile tradeoff for safety-critical perception classes (aircraft, personnel, FOD).

5. **Lipschitz bounds connect verification to safety margins.** A Lipschitz constant of 15.3 and sensor noise of 0.02 means detection uncertainty is bounded by 0.306 -- this directly tightens CBF margins by a quantified amount rather than ad hoc padding.

6. **Full perception backbones (PointPillars end-to-end, CenterPoint, transformers) cannot be formally verified today.** This is why the Simplex architecture is essential: even if the neural perception fails in ways formal verification cannot predict, the CBF filter and classical fallback provide runtime safety.

7. **Runtime verification and static verification are complementary, not competing.** Static verification proves properties over input regions at design time; runtime verification catches violations on actual traces at execution time. Both are needed.

8. **The Simplex decision module is the highest-priority verification target.** If this small network (~10K parameters) is formally proven correct, the entire Simplex architecture inherits a formal safety guarantee: unsafe states always trigger fallback to the proven-safe classical controller.

9. **EU AI Act compliance (August 2026) creates immediate urgency.** Article 15 requires demonstrated accuracy and robustness for high-risk AI. Formal verification certificates are the strongest evidence available. The EU PLD (December 2026) adds liability pressure -- "rebuttable presumption of causality" means inability to explain neural network behavior shifts burden of proof to the manufacturer.

10. **Verification should be integrated into CI/CD.** Every model update should automatically re-verify safety properties. The automated pipeline (Phase 4) ensures verification is not a one-time activity but a continuous assurance process.

11. **auto_LiRPA is the recommended primary tool** for the reference airside AV stack's verification needs: PyTorch-native, GPU-accelerated, supports certified training, and is actively maintained by the VNN-COMP-winning team.

12. **No public verification benchmarks exist for airside AV models.** Creating verified airside perception models with published certificates would be a significant competitive advantage -- both for certification and for customer trust.

13. **Verification certificates feed directly into the CBF-QP solver.** The verified Lipschitz bound determines the safety margin: margin = L * epsilon_sensor. This replaces ad hoc safety padding with mathematically grounded margins, reducing both false positives (unnecessary stops) and false negatives (missed hazards).

14. **The total verification suite costs $65-105K over 32 weeks** -- comparable to a single safety incident during deployment. ROI is positive even without regulatory pressure, and regulatory compliance makes it mandatory.

15. **Sparse convolution and custom attention operations remain unverifiable.** This is the fundamental limitation: VoxelNet (CenterPoint), FlatFormer, and PTv3 use operations that no current verifier supports. Research is progressing (GNN verification, attention bounds) but production-ready tools are 2-3 years away.

16. **Compositional verification is the practical path forward.** Rather than verifying the entire perception-to-action pipeline end-to-end, verify each component independently with interface contracts: perception outputs bounded -> planner inputs bounded -> control outputs safe. This is consistent with the modular safety case structure required by ISO 3691-4 and UL 4600.

17. **Certified radius for personnel detection (~0.006) is marginal.** This indicates that standard PointPillars training is not robust enough for safety-critical personnel detection. Certified training (SABR) and runtime monitoring (OOD detection + reduced speed mode) are both necessary to close this gap.

18. **DO-333 formal methods credit can reduce testing requirements by 30-50%.** Formally verified components require less testing coverage, directly reducing the 4,600-test requirement from Zhao-Weng. This is a concrete cost savings that partially offsets the verification investment.

---

## 14. References

### Standards and Regulations

- ISO 3691-4:2023, Industrial trucks -- Driverless industrial trucks and their systems
- UL 4600:2023, Standard for Safety for the Evaluation of Autonomous Products
- EU AI Act, Regulation (EU) 2024/1689
- EU Machinery Regulation (EU) 2023/1230 (effective January 2027)
- EU Product Liability Directive (EU) 2024/2853 (transpose by December 2026)
- ISO 26262:2018, Road vehicles -- Functional safety (Part 6: Software)
- DO-178C, Software Considerations in Airborne Systems and Equipment Certification
- DO-333, Formal Methods Supplement to DO-178C

### Foundational Papers

- Katz, G., et al. "Reluplex: An Efficient SMT Solver for Verifying Deep Neural Networks." CAV 2017.
- Katz, G., et al. "The Marabou Framework for Verification and Analysis of Deep Neural Networks." CAV 2019.
- Singh, G., et al. "An Abstract Domain for Certifying Neural Networks." POPL 2019 (DeepPoly).
- Zhang, H., et al. "Efficient Neural Network Robustness Certification with General Activation Functions." NeurIPS 2018 (CROWN).
- Xu, K., et al. "Automatic Perturbation Analysis for Scalable Certified Robustness and Beyond." NeurIPS 2020 (auto_LiRPA).
- Wang, S., et al. "Beta-CROWN: Efficient Bound Propagation with Per-Neuron Split Constraints." NeurIPS 2021.
- Muller, M., et al. "PRIMA: General and Precise Neural Network Certification via Scalable Convex Hull Approximations." POPL 2022.
- Muller, M., et al. "Certified Training: Small Boxes Are All You Need." ICLR 2023 (SABR).
- Gowal, S., et al. "Scalable Verified Training for Provably Robust Image Classifiers." ICCV 2019 (IBP).
- Fazlyab, M., et al. "Efficient and Accurate Estimation of Lipschitz Constants for Deep Neural Networks." NeurIPS 2019 (LipSDP).
- Cohen, J., et al. "Certified Adversarial Robustness via Randomized Smoothing." ICML 2019.
- Gao, S., et al. "dReal: An SMT Solver for Nonlinear Theories of Reals." CADE 2013.

### VNN-COMP and Benchmarks

- International Verification of Neural Networks Competition (VNN-COMP). 2020-2025. https://vnncomp.org
- Bak, S., et al. "The Second International Verification of Neural Networks Competition (VNN-COMP 2021)." 2021.
- Muller, M., et al. "The Third International Verification of Neural Networks Competition." 2022.

### Applied Verification for Autonomous Vehicles

- Katz, G., et al. "Towards Proving the Adversarial Robustness of Deep Neural Networks." FVAV 2017 (ACAS Xu case study).
- Huang, X., et al. "A Survey of Safety and Trustworthiness of Deep Neural Networks." ACM Computing Surveys, 2020.
- Althoff, M., et al. "Formal Methods for the Verification of Autonomous Vehicles." Springer, 2023.
- Sun, X., et al. "Formal Verification of Neural Network Controlled Autonomous Systems." HSCC 2019 (neural Lyapunov).
- Ivanov, R., et al. "Verisig: Verifying Safety Properties of Hybrid Systems with Neural Network Controllers." HSCC 2019.
- Dawson, C., et al. "Safe Control with Learned Certificates." Survey, 2023 (neural CBF verification).

### Related Repository Documents

- `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md` -- Runtime STL monitors, OOD detection, shield synthesis
- `30-autonomy-stack/planning/safety-critical-planning-cbf.md` -- CBF safety filters, measurement-robust CBFs
- `60-safety-validation/runtime-assurance/simplex-safety-architecture.md` -- Simplex AC/BC architecture
- `60-safety-validation/standards-certification/functional-safety-software.md` -- ISO 26262 Part 6, MISRA C
- `60-safety-validation/verification-validation/testing-validation-methodology.md` -- Statistical safety testing, Zhao-Weng formula
- `30-autonomy-stack/planning/reinforcement-learning-driving-policy.md` -- Policy network architecture
- `20-av-platform/compute/nvidia-orin-technical.md` -- Deployment target specifications
- `30-autonomy-stack/perception/overview/model-compression-edge-deployment.md` -- Model sizes and TensorRT optimization
- `30-autonomy-stack/perception/overview/multi-task-unified-perception.md` -- Shared-backbone verification challenges
- `30-autonomy-stack/planning/causal-reasoning-counterfactual.md` -- EU PLD compliance context
