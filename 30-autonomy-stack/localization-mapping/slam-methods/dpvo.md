# DPVO and DPV-SLAM

<!-- method-priority:start
priority:
  learning: 4
  deployment: 3
  type: "method-family"
  stage: "modern-core"
  maturity: "fielded-pattern"
  tags: ["slam", "fallback", "gnss-denied", "indoor", "validation"]
  reason: "DPVO and DPV-SLAM is rated for visual or visual-inertial SLAM coverage, especially fallback and GNSS-denied use."
method-priority:end -->

## Executive Summary

DPVO, Deep Patch Visual Odometry, is a learned monocular visual odometry system from Princeton that keeps the optimization-inspired structure of [DROID-SLAM](droid-slam.md) but replaces dense flow with sparse learned patch correspondence. The result is a much faster and lighter visual odometry front end: it tracks a small set of learned patches, uses a recurrent update operator, and applies differentiable bundle adjustment over poses and patch depths.

DPV-SLAM extends DPVO from local odometry toward visual SLAM by adding loop-closure mechanisms and global optimization while retaining a single-GPU, low-memory design. The official DPVO repository now covers both the NeurIPS 2023 DPVO paper and the ECCV 2024 Deep Patch Visual SLAM work. In this method library, "DPVO" is therefore best treated as the family: DPVO for fast monocular learned VO, and DPV-SLAM/DPV-SLAM++ for loop closure and global correction.

For autonomous vehicles and airport airside autonomy, DPVO is more practically interesting than DROID-SLAM when compute and latency matter. It is still camera-only monocular in its core form, lacks native IMU/GNSS/LiDAR/wheel fusion, and can suffer scale drift outdoors. It should be evaluated as a learned visual odometry/SLAM research signal alongside [Kimera-VIO](kimera-vio.md), [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md), and [ORB-SLAM2 / ORB-SLAM3](orb-slam2-orb-slam3.md), then fused under the broader [Mapping and Localization](../overview/mapping-and-localization.md) architecture rather than used as an authoritative pose source.

## Historical Context

DROID-SLAM showed that a learned SLAM system could combine recurrent optical-flow-style updates with geometric bundle adjustment and outperform many classical methods on public benchmarks. Its weakness was cost: dense flow and dense bundle adjustment require substantial GPU memory and compute, especially for long sequences.

DPVO was introduced as a sparse patch-based alternative. It asks whether dense flow is actually necessary for learned visual odometry. The answer shown by the paper is that a carefully designed sparse patch representation can retain the robustness benefits of learned correspondence while dramatically reducing compute. DPVO tracks learned patches instead of predicting dense flow everywhere.

The original DPVO paper is a visual odometry system, not complete SLAM. It runs a local sliding-window optimizer and does not by itself provide long-range loop closure or persistent map reuse. DPV-SLAM extends the design with two loop-closure mechanisms: proximity-based loop closure integrated into the patch graph and a more classical image-retrieval backend. This matters for a method-level SLAM library because operational systems care about global consistency, not only short-term odometry.

Relative to [MASt3R-SLAM](mast3r-slam.md), DPVO stays closer to the DROID/RAFT lineage: learned features, patch tracking, and bundle adjustment. MASt3R-SLAM instead uses a two-view 3D reconstruction prior that outputs pointmaps.

## Sensor Assumptions

Core DPVO assumptions:

- Monocular video input.
- Known or consistently handled camera intrinsics.
- Time-ordered frames with sufficient overlap.
- Mostly static scene.
- Enough visual texture or learned-patch distinctiveness.
- CUDA-capable GPU for real-time operation.

DPV-SLAM assumptions:

- Same monocular input assumption as DPVO.
- Enough revisits or proximity relationships for loop closure to help.
- Image retrieval and patch-graph loop candidates must be reliable enough to avoid false global corrections.

What DPVO does not assume natively:

- No built-in IMU preintegration.
- No stereo scale constraint in the base method.
- No wheel odometry.
- No GNSS factor.
- No LiDAR or map-matching input.

For airside AVs, the monocular-only assumption is the major operational weakness. Without stereo, IMU, wheel, or GNSS fusion, metric scale and drift control must come from outside the method. This is why DPVO should be a measurement source in the fusion stack, not the owner of vehicle pose.

## State/Map Representation

DPVO maintains a local sparse learned patch representation:

- Camera poses for active frames.
- Inverse depths or depth-like variables for selected patches.
- Learned patch descriptors/features.
- Dense feature maps for recent frames used by the correlation operator.
- A patch graph connecting source patches to destination frames.
- A sliding optimization window.

The map is sparse in patches but learned in representation. It is not a classical ORB landmark map, not a direct photometric map like [LSD-SLAM / DSO](lsd-slam-dso.md), and not a dense depth map like [DROID-SLAM](droid-slam.md). The sparse patches act as learned, trackable geometric entities that support differentiable bundle adjustment.

DPV-SLAM extends the representation:

- Patch features from older frames can be retained compactly.
- Proximity factors connect old patches to recent frames.
- Loop-closure factors are inserted into the same global optimization problem.
- DPV-SLAM++ adds classical image retrieval and pose-graph style correction for larger drift.

For AV integration, the output is an estimated camera trajectory and sparse 3D structure. It is not a semantic map, occupancy grid, airport map, or safety-zone representation.

## Algorithm Pipeline

DPVO pipeline:

1. Frame input:
   - Receive monocular video frames.
   - Resize and preprocess images for the network.
   - Extract learned dense feature maps and sparse patch features.

2. Patch selection:
   - Select a small number of patches per frame.
   - Store learned patch representations with local context.
   - Maintain a bounded number of active patches.

3. Patch correspondence:
   - Use a recurrent update operator to update patch trajectories across frames.
   - Use correlation between patch features and destination frame features.
   - Predict confidence and correspondence updates.

4. Differentiable bundle adjustment:
   - Optimize active camera poses and patch depths.
   - Alternate learned correspondence updates with geometric optimization.
   - Keep runtime bounded with a sliding window.

5. Keyframe/window management:
   - Add new frames or keyframes.
   - Remove old frames and features outside the window.
   - Output monocular visual odometry.

DPV-SLAM adds:

1. Compact storage of older patch features.
2. Proximity-based factors from old frames to recent frames.
3. Global or larger-window optimization over a patch graph.
4. Classical image retrieval for loop candidates in DPV-SLAM++.
5. Sim(3)-style drift estimation and correction for loop closure.

The practical distinction from DROID-SLAM is resource allocation. DPVO spends less on dense flow and more on sparse learned patch matching, which gives higher speed and lower memory.

## Formulation

DPVO can be viewed as learned sparse bundle adjustment over patch tracks. For a patch `p` hosted in frame `i`, with inverse depth `d_p`, and observed in frame `j`, the geometric relation is:

```text
u_j_hat = project(T_j^-1 * T_i * backproject(u_i, d_p))
```

The learned recurrent operator predicts correspondence updates and confidence weights from patch/frame correlations:

```text
delta_u, w = UpdateOperator(patch_features_i, frame_features_j, current_track_state)
```

Bundle adjustment updates active poses and patch depths:

```text
min over T, d:
  sum_patch_edges w_ij_p *
    ||u_ij_target - project(T_j^-1 * T_i * backproject(u_i, d_p))||^2
```

The actual method learns the update dynamics end to end, so the residual targets and weights are not handcrafted feature matches. The important structural point is that DPVO retains differentiable geometric optimization while using sparse learned patch correspondence instead of dense flow.

DPV-SLAM adds loop constraints to the patch graph. A simplified global objective is:

```text
min over poses and patch depths:
  odometry_patch_factors
  + proximity_loop_patch_factors
  + optional classical_loop_pose_factors
```

Because monocular visual SLAM has scale ambiguity and drift, loop closure may need Sim(3)-style correction. This is one reason DPV-SLAM++ includes a classical loop closure path for larger drift events.

## Failure Modes

DPVO and DPV-SLAM failure modes:

- Monocular scale ambiguity and scale drift, especially outdoors.
- Long straight motion with weak parallax.
- Low-texture scenes where patch selection has little stable information.
- Motion blur and rolling shutter from vibration or fast turns.
- Exposure shock moving between terminal shade and apron sunlight.
- Wet pavement, reflective aircraft fuselage, glass, and specular markings.
- Dynamic objects dominating patches: aircraft, loaders, carts, buses, workers, and baggage.
- Domain shift from synthetic or public training datasets to airport camera imagery.
- False loop closure in repeated gate, corridor, or stand geometry.
- GPU dependency and potential runtime contention with perception networks.
- Opaque learned confidence under out-of-distribution inputs.

DPV-SLAM reduces unbounded local drift but creates a new risk: a global correction can be wrong. In safety-critical use, loop closures should be validated against independent sensors and map constraints.

## AV Relevance

DPVO is relevant to AVs because it targets the compute problem that made DROID-SLAM difficult to deploy. It offers:

- Fast learned visual odometry.
- Low memory relative to dense learned SLAM.
- Better robustness than many classical VO methods on public benchmarks.
- A path toward single-GPU learned visual SLAM through DPV-SLAM.

However, core AV localization usually needs:

- Metric scale observability.
- Continuous uncertainty and health reporting.
- IMU/wheel/GNSS/LiDAR fusion.
- Failure modes that can be tested and bounded.
- Long-route map consistency and relocalization.

DPVO does not provide those as a complete stack. It is best used as an auxiliary visual odometry signal, a learned baseline, or a shadow-mode comparator. For vehicle systems where interpretable state estimation is needed, classical VIO such as [Kimera-VIO](kimera-vio.md), [OpenVINS](openvins.md), and [VINS-Mono / VINS-Fusion](vins-mono-vins-fusion.md) remain more straightforward integration candidates.

## Indoor/Outdoor Relevance

Indoor:

- Strong potential in visually structured indoor routes, baggage halls, service corridors, and maintenance areas.
- Learned patches can survive some cases where handcrafted features fail.
- DPV-SLAM loop closure is useful for repeated indoor routes.
- Repetitive corridors, glass, low texture, and moving people/equipment remain risks.

Outdoor:

- More challenging in monocular mode because scale drift and long-range geometry become important.
- Urban roads with facades, signs, and close structure are more favorable than open aprons.
- Airports add wide pavement, sky, distant terminal features, wet reflectance, aircraft surfaces, and dynamic GSE.
- Outdoor airside deployment should not rely on monocular DPVO without external scale and drift correction.

Indoor/outdoor transition can be an interesting research use case, especially when GNSS drops near terminal structures. The operational system should still manage the global frame, quality gating, and handoff through multi-sensor fusion.

## Airside Deployment Notes

Recommended airside use:

- Run DPVO/DPV-SLAM in offline evaluation or shadow mode before any closed-loop use.
- Compare against [DROID-SLAM](droid-slam.md), [Kimera-VIO](kimera-vio.md), [OpenVINS](openvins.md), and LiDAR-inertial odometry on identical logs.
- Use global-shutter HDR cameras with rigid mounts and stable timestamps.
- Add external scale sources: wheel odometry, IMU, stereo/depth extension if available, RTK-GNSS, or LiDAR map localization.
- Do not accept DPV-SLAM loop closures in the vehicle frame without independent validation.
- Track GPU memory, frame rate, minimum frame rate, number of active patches, optimizer residuals, loop events, and pose jumps.
- Include apron night, rain, glare, terminal overhang, aircraft parked/absent, repeated stands, service-road straightaways, and baggage hall transitions in tests.

Airside suitability is highest for research into learned visual odometry availability and lowest for production primary localization. Its likely role is a low-cost camera-based redundancy signal when classical features degrade but images remain informative.

## Datasets/Metrics

Datasets used by DPVO/DPV-SLAM papers and code:

- TartanAir: synthetic training/evaluation and cross-domain generalization.
- TUM RGB-D: used in monocular evaluation settings without using depth as input.
- EuRoC MAV: common visual odometry benchmark, evaluated in monocular mode.
- ICL-NUIM: synthetic indoor visual odometry / SLAM benchmark.
- KITTI Odometry: outdoor driving evaluation, especially important for DPV-SLAM outdoor scale drift.
- Custom airport datasets are required for final airside assessment.

Metrics:

- ATE/APE after Sim(3) or scale alignment for monocular VO.
- RPE over fixed time/distance.
- KITTI translational and rotational drift.
- Scale drift over long outdoor routes.
- Failure rate and sequence completion.
- Loop-closure precision/recall for DPV-SLAM.
- Pose jump magnitude after global correction.
- Runtime average, minimum frame rate, and memory.
- Patch count, active graph size, and optimizer residuals.

Airside-specific metrics should include drift per 100 m on straight apron/service-road segments, recovery after terminal shadow transitions, false loop closure across similar stands, and disagreement against RTK/LiDAR localization during GNSS-degraded intervals.

## Open-Source Implementations

- Official DPVO repository: source code for Deep Patch Visual Odometry and Deep Patch Visual SLAM.
- The repository includes dataset evaluation scripts for KITTI, EuRoC, TUM, TartanAir, and ICL-NUIM.
- The project uses PyTorch/CUDA and custom components, with optional visualization tooling.

Implementation cautions:

- The official code is research software, not a production localization package.
- CUDA/PyTorch versions and compiled extensions must be pinned carefully.
- Monocular scale and trajectory alignment rules must be documented for every benchmark.
- DPV-SLAM behavior should be separated from DPVO-only behavior in reports.
- GPU contention with other perception models must be measured on target hardware.
- MIT licensing is favorable, but third-party dependencies still require review.

## Practical Recommendation

For this method library, document DPVO as the efficient learned visual odometry baseline and DPV-SLAM as its loop-closing SLAM extension. It is the right comparison against [DROID-SLAM](droid-slam.md) when compute matters and against [MASt3R-SLAM](mast3r-slam.md) when comparing learned correspondence paradigms.

For airside AVs, do not choose DPVO as the primary localization system. Use it to study whether learned patch tracking improves camera odometry availability in difficult visual conditions. Any operational use should fuse DPVO output with IMU, wheel odometry, RTK-GNSS, LiDAR scan-to-map, and map constraints, with loop closure disabled or independently verified until airport false-positive rates are known.

## Sources

### Primary Papers and Repositories

- Teed, Lipson, and Deng, "Deep Patch Visual Odometry": https://arxiv.org/abs/2208.04726
- Deep Patch Visual Odometry NeurIPS/OpenReview PDF: https://openreview.net/pdf/7a35f957decdfba2c89e9feb7494fb65af25906c.pdf
- Lipson, Teed, and Deng, "Deep Patch Visual SLAM": https://arxiv.org/abs/2408.01654
- Deep Patch Visual SLAM ECCV 2024 paper: https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/00272.pdf
- DPVO official repository: https://github.com/princeton-vl/DPVO
- Teed and Deng, "DROID-SLAM: Deep Visual SLAM for Monocular, Stereo, and RGB-D Cameras": https://arxiv.org/abs/2108.10869

### Datasets and Benchmarks

- TartanAir dataset and benchmark: https://theairlab.org/tartanair-dataset/
- TUM RGB-D dataset: https://cvg.cit.tum.de/data/datasets/rgbd-dataset
- EuRoC MAV dataset: https://projects.asl.ethz.ch/datasets/doku.php?id=kmavvisualinertialdatasets
- ICL-NUIM dataset: https://www.doc.ic.ac.uk/~ahanda/VaFRIC/iclnuim.html
- KITTI Odometry benchmark: https://www.cvlibs.net/datasets/kitti/eval_odometry.php

### Internal Cross-Links

- [Mapping and Localization](../overview/mapping-and-localization.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../overview/robust-state-estimation-multi-sensor.md)
- [DROID-SLAM](droid-slam.md)
- [MASt3R-SLAM](mast3r-slam.md)
- [Kimera-VIO](kimera-vio.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
