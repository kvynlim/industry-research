# Kimera-RPGO and Pairwise Consistency Maximization

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "mapping", "validation", "runtime-localization"]
  reason: "Kimera-RPGO and Pairwise Consistency Maximization is rated for robust or collaborative backend design in multi-session SLAM and validation."
method-priority:end -->

## Executive Summary

Kimera-RPGO is the robust pose graph optimization component associated with the MIT-SPARK Kimera stack. Its original role is to take odometry edges and loop-closure edges from Kimera-VIO/Kimera and produce a globally consistent trajectory while rejecting inconsistent loop closures. The important backend idea is Pairwise Consistency Maximization (PCM): build a consistency graph over candidate loop closures, connect candidates that are mutually compatible, then select a large mutually consistent subset before pose graph optimization.

PCM is different from simply attaching a Huber or Cauchy loss to every loop closure. A robust loss asks whether each edge has a large residual under the current state estimate. PCM asks whether loop closures are mutually compatible before trusting them as a set. This is especially useful in multi-robot and multi-session mapping, where there may be no single shared odometry backbone strong enough to expose bad inter-robot loop closures by residual alone.

This page focuses on Kimera-RPGO and PCM as a robust loop-closure backend. Kimera-VIO itself is covered separately in [Kimera-VIO](kimera-vio.md), while generic graph optimization is covered in [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md).

## Method Class

- Robust pose graph optimization library.
- Loop-closure outlier rejection through consistency maximization.
- Maximum-clique-style selection of mutually consistent measurements.
- GTSAM-based backend component for Kimera-style SLAM systems.
- Useful for single-robot, multi-session, and multi-robot graph merging.

## Core Idea

Suppose the front end proposes a set of loop closures:

```text
L = {l_1, l_2, ..., l_m}
```

Each loop closure `l_a` is a relative transform between two poses. A pair of loop closures is pairwise consistent if using both does not imply a contradiction larger than a threshold. PCM builds a graph:

```text
C = (V_C, E_C)
V_C: candidate loop closures
E_C: pair (l_a, l_b) is mutually consistent
```

Then it finds a maximum or large clique in `C`. The clique is a subset of candidate loop closures where every pair is consistent:

```text
L_inlier = maximum_clique(C)
```

Only those loop closures are inserted into the PGO backend. In Kimera-RPGO, this is used as an outlier rejection front end for robust global trajectory estimation.

The strength of this approach is that it does not need a high-quality global initialization in the same way residual-based methods do. It exploits relative consistency among measurements.

## Formulation

For two loop closures:

```text
l_a: X_i -> X_j with measurement Z_ij
l_b: X_k -> X_l with measurement Z_kl
```

Pairwise consistency compares the relative transformation implied by the odometry paths and the two loop closures. In simplified form, each candidate should agree with the graph's existing relative pose estimates and with other candidates:

```text
d(l_a, l_b) <= threshold
```

where `d` is often a Mahalanobis-style distance using measurement covariance. A thresholded consistency relation becomes the adjacency matrix of the consistency graph:

```text
A_ab = 1 if l_a and l_b are pairwise consistent
A_ab = 0 otherwise
```

The inlier selection problem becomes:

```text
maximize |S|
subject to A_ab = 1 for all a,b in S
```

This is the maximum clique problem. It is NP-hard in general, but practical maximum clique solvers can handle many SLAM consistency graphs quickly because graph structure and candidate counts are manageable after front-end gating.

After selecting `S`, Kimera-RPGO solves the normal PGO objective over odometry and accepted loop closures:

```text
min_X sum odometry ||e_ij||^2_Omega + sum_(l in S) ||e_l||^2_Omega
```

Modern Kimera2 updates also use Graduated Non-Convexity in Kimera-RPGO/Kimera-PGMO for improved robustness to spurious loop closures, making PCM and robust losses complementary rather than mutually exclusive.

## Pipeline

1. **Run local odometry.** Kimera-VIO or another front end produces keyframe poses and odometry edges.

2. **Propose loop closures.** Visual place recognition, LiDAR descriptors, or cross-session matching proposes candidate edges.

3. **Geometrically verify candidates.** Estimate relative pose and covariance for each candidate.

4. **Build the consistency graph.** Each candidate is a node; pairwise tests add edges between mutually consistent candidates.

5. **Find a maximum clique or strong clique approximation.** Select the largest mutually consistent candidate set.

6. **Insert accepted loop closures.** Add accepted closures to the pose graph.

7. **Optimize globally.** Run Kimera-RPGO/GTSAM backend optimization.

8. **Publish corrected trajectory.** Use global correction for map alignment and downstream map products.

9. **Log rejected closures.** Rejected candidates are important diagnostics for aliasing and front-end failure.

## Assumptions

- The true loop closures form a large mutually consistent set.
- False loop closures are not numerous enough to form a larger self-consistent clique.
- Candidate loop closures include covariances or thresholds meaningful enough for consistency tests.
- Odometry paths between loop endpoints are reliable enough to support consistency checks.
- Candidate count is bounded by front-end retrieval and geometric gating.

## Failure Modes

**Consistent false cluster.** Repeated airport stands or corridors can produce multiple wrong closures that agree with one another.

**Bad covariance thresholds.** Loose thresholds admit outliers; tight thresholds reject true closures under drift.

**Clique search cost.** Maximum clique is combinatorial. It is practical only when candidate counts are controlled.

**Insufficient true loops.** If the correct closures are sparse, clique selection may be unstable.

**Weak odometry backbone.** Pairwise checks use existing relative estimates; severe odometry drift or disconnected robots can weaken the test.

**Dynamic scene geometry.** Aircraft, vehicles, and temporary equipment can make wrong closures appear geometrically plausible.

**Not a final optimizer certificate.** PCM selects a set; it does not prove the final PGO solution is globally optimal.

## AV and Airside Fit

Kimera-RPGO/PCM fits airside mapping because the environment creates exactly the kind of false loop closures that can break a normal backend:

- Repeated gates and stands.
- Similar terminal facade segments.
- Similar service-road geometry.
- Parked aircraft that change the appearance of a place.
- Multi-session mapping where one vehicle revisits the same operational area under different conditions.

Recommended airside use:

- Use PCM for loop-closure set selection before global optimization.
- Add geographic, RTK, heading, and operational-zone gates before PCM.
- Use LiDAR or multi-sensor geometric verification for candidates, not visual retrieval alone.
- Combine PCM with GNC or robust losses for the accepted set.
- Treat rejected candidates as a front-end quality metric.
- Disable or heavily gate loop closure in areas with extreme aliasing until airport-specific validation is complete.

Kimera-RPGO is a useful reference backend for research and prototyping. Production use requires dependency audit, deterministic builds, runtime monitoring, and clear ownership of map-frame corrections.

## Implementation Notes

- Kimera-RPGO depends on GTSAM and requires specific GTSAM compile options in the reference README.
- The repository is BSD-2-Clause licensed, which is integration-friendly, but downstream dependencies still need review.
- Keep candidate loop closures as first-class records with descriptor score, geometric score, covariance, consistency decision, and final residual.
- Run PCM on candidates after geometric verification; raw place-recognition matches are too noisy.
- Use maximum clique results as a selection mechanism, not as a guarantee that all accepted edges are true.
- For large-scale systems, use temporal, spatial, and semantic gating to reduce clique problem size.
- If using Kimera2-era GNC support, tune robust thresholds separately from PCM consistency thresholds.

## Open-Source Implementations

- Kimera-RPGO official repository: https://github.com/MIT-SPARK/Kimera-RPGO
- Kimera main repository: https://github.com/MIT-SPARK/Kimera
- Kimera-VIO repository: https://github.com/MIT-SPARK/Kimera-VIO
- Kimera-Multi repository for distributed dense metric-semantic SLAM: https://github.com/MIT-SPARK/Kimera-Multi
- GTSAM: https://github.com/borglab/gtsam

## Practical Recommendation

Use Kimera-RPGO/PCM when loop-closure outliers are expected and when candidate loop closures arrive in sets. It is especially valuable for multi-session and multi-robot graph merging where residual-only robust losses can fail due to poor initialization.

For airside use, PCM should be one layer in a conservative loop-closure stack:

```text
retrieval -> geometry -> context gating -> PCM -> robust PGO -> post-optimization audit
```

Do not use PCM as a reason to relax front-end verification. It is a backend consistency filter, not a semantic place-recognition oracle.

## Related Repository Docs

- [Kimera-VIO](kimera-vio.md)
- [Loop Closure and Place Recognition](loop-closure-place-recognition.md)
- [Robust Pose Graph Optimization with GNC and riSAM](robust-pgo-gnc-risam.md)
- [Distributed Multi-Robot Pose Graph Optimization](distributed-multi-robot-pgo.md)
- [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md)

## Sources

- Kimera-RPGO official repository: https://github.com/MIT-SPARK/Kimera-RPGO
- Rosinol, Abate, Chang, and Carlone, "Kimera: an Open-Source Library for Real-Time Metric-Semantic Localization and Mapping," ICRA, 2020: https://www.mit.edu/~arosinol/papers/Rosinol20icra-Kimera.pdf
- Kimera paper arXiv page: https://arxiv.org/abs/1910.02490
- Mangelson, Dominic, Eustice, and Vasudevan, "Pairwise Consistent Measurement Set Maximization for Robust Multi-robot Map Merging," ICRA, 2018: https://robots.engin.umich.edu/publications/jmangelson-2018a.pdf
- Forsgren, Vasudevan, Kaess, McLain, and Mangelson, "Group-k consistent measurement set maximization via maximum clique over k-Uniform hypergraphs for robust multi-robot map merging," 2023: https://arxiv.org/abs/2308.02674
- Abate, Chang, Hughes, and Carlone, "Kimera2: Robust and Accurate Metric-Semantic SLAM in the Real World," ISER, 2023: https://arxiv.org/abs/2401.06323
- Note on seed-source hygiene: the provided seed URLs https://arxiv.org/abs/2003.12932 and https://arxiv.org/abs/1711.08632 resolve to unrelated papers, so they are not used as evidence for Kimera-RPGO or PCM.
