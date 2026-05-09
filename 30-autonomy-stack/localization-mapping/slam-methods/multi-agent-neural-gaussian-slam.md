# Multi-Agent Neural and Gaussian SLAM

Related docs: [Distributed Multi-Robot PGO](distributed-multi-robot-pgo.md), [COVINS / COVINS-G](covins-covins-g.md), [Kimera-Multi](kimera-multi.md), [CO-SLAM / ESLAM](co-slam-eslam.md), [Gaussian SLAM / MonoGS](gs-slam-monogs.md), and [SplaTAM](splatam.md).

**Last updated:** 2026-05-09

## Executive Summary

MAGiC-SLAM and MNE-SLAM extend dense neural or Gaussian SLAM from a single camera rig to multiple cooperating agents. They target a hard problem: several robots should jointly estimate their trajectories and build one dense map without streaming all raw observations to a central machine.

MAGiC-SLAM uses a rigidly deformable 3D Gaussian scene representation for multi-agent RGB-D SLAM with novel-view-synthesis-quality maps. It adds tracking, map merging, and loop closure around Gaussian maps. MNE-SLAM uses a distributed neural implicit representation with peer-to-peer communication, distributed mapping/tracking, intra-to-inter loop closure, and multi-submap fusion.

For airside autonomy, these methods are best viewed as research references for fleet-shared dense mapping. They are not near-term production fleet localization backends, but their communication-aware map fusion ideas matter for multi-vehicle airport mapping, hangar inspection, and collaborative digital-twin construction.

## What They Are

- Multi-agent dense visual SLAM systems.
- Neural implicit or 3D Gaussian map representations.
- RGB-D oriented in the published systems.
- Designed for collaborative mapping and globally consistent dense reconstruction.
- Research-stage systems with substantial GPU and dependency requirements.

## Method Summary

| Method | Map representation | Collaboration idea | Practical interpretation |
|---|---|---|---|
| MAGiC-SLAM | Rigidly deformable 3D Gaussians | Multi-agent tracking, map merging, loop closure | Faster renderable collaborative Gaussian mapping |
| MNE-SLAM | Joint neural implicit scene representation | Peer-to-peer distributed mapping/tracking and submap fusion | Communication-aware neural collaborative SLAM |

MAGiC-SLAM emphasizes Gaussian map speed and rendering quality. MNE-SLAM emphasizes distributed operation and communication constraints.

## Inputs and Outputs

Inputs:

- RGB-D streams from multiple agents.
- Agent-local camera trajectories or tracking estimates.
- Inter-agent loop candidates or shared submap information.
- GPU resources for neural rendering, mapping, and optimization.

Outputs:

- Per-agent trajectories in a shared frame.
- Globally consistent dense neural or Gaussian scene map.
- Rendered RGB/depth views for evaluation and visualization.
- Inter-agent loop or submap-fusion corrections.

## Pipeline

1. Each agent performs local tracking and mapping from its RGB-D stream.
2. Local keyframes or submaps are represented with neural features or 3D Gaussians.
3. Agents search for intra-agent and inter-agent loop candidates.
4. Accepted overlaps create constraints between local maps.
5. The system performs map merging or submap fusion.
6. Global consistency is restored through loop closure and optimization.
7. A joint dense map is rendered or meshed for inspection.
8. Communication is limited to map/submap/feature products rather than all raw video when possible.

## Strengths

- Multiple agents can cover large indoor scenes faster than one robot.
- Dense maps are useful for inspection, AR, simulation, and digital twins.
- 3D Gaussian maps can render efficiently and support visual QA.
- Neural submap fusion is more compact than raw data sharing.
- Inter-agent loop closure can reduce drift across separate traversals.
- MNE-SLAM's peer-to-peer framing is closer to field robotics constraints than central raw-data upload.

## Failure Modes

- RGB-D assumptions limit direct transfer to outdoor airside vehicles.
- Depth sensors struggle outdoors, in sunlight, at long range, and on reflective aircraft surfaces.
- Communication loss or delayed loop discovery can leave agents in inconsistent frames.
- Dynamic objects corrupt dense maps unless filtered.
- Neural/Gaussian maps can be visually plausible but metrically inconsistent.
- GPU memory and runtime grow with scene size and agent count.
- Multi-agent false loops are especially damaging because they can couple otherwise independent maps.

## Airside, Indoor, and Outdoor Fit

**Indoor:** Strongest fit. Terminals, warehouses, hangars, baggage halls, and maintenance spaces match RGB-D multi-agent mapping better than open aprons.

**Outdoor:** More difficult because RGB-D sensing and visual appearance degrade with sunlight, range, weather, and reflective surfaces. LiDAR or radar would be needed for robust outdoor airport use.

**Airside:** Useful as a research template for fleet mapping and digital twins, especially in hangars and covered areas. For live vehicle localization, prefer conventional multi-robot pose graphs with LiDAR/IMU/RTK factors and use neural/Gaussian maps as auxiliary QA or reconstruction layers.

## Implementation Notes

- Treat agent identity, clock synchronization, and frame conventions as first-class data.
- Use robust inter-agent loop verification before map merging.
- Track communication payload sizes separately from mapping quality.
- Keep raw logs or explicit point maps for audit, because dense neural maps are hard to inspect numerically.
- Evaluate per-agent ATE/RPE, map completeness, rendering metrics, bandwidth, loop false positives, and recovery after communication loss.
- For airport work, prototype indoors first, then adapt the representation to LiDAR or multi-modal data before outdoor use.

## Sources

- Yugay, Gevers, and Oswald, "MAGiC-SLAM: Multi-Agent Gaussian Globally Consistent SLAM." https://arxiv.org/abs/2411.16785
- MAGiC-SLAM project page. https://vladimiryugay.github.io/magic_slam/index.html
- Official MAGiC-SLAM repository. https://github.com/VladimirYugay/MAGiC-SLAM
- Deng et al., "MNE-SLAM: Multi-Agent Neural SLAM for Mobile Robots," CVPR 2025. https://openaccess.thecvf.com/content/CVPR2025/html/Deng_MNE-SLAM_Multi-Agent_Neural_SLAM_for_Mobile_Robots_CVPR_2025_paper.html
- Official MNE-SLAM repository. https://github.com/dtc111111/MNESLAM
