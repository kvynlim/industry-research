# COVINS and COVINS-G

## Executive Summary

COVINS is a centralized collaborative visual-inertial SLAM system. Each agent runs visual-inertial odometry onboard and sends selected map information to a server backend. The backend performs place recognition, global optimization, map merging, redundancy reduction, and multi-agent 3D mapping. The design prioritizes scalable collaboration for large environments and teams of more than ten agents while preserving onboard autonomy.

COVINS-G generalizes the backend so it can work with arbitrary VIO front ends, including tracking cameras and different VIO systems. The key tradeoff is that COVINS-G uses a more generic keyframe/pose interface and multi-camera relative pose estimation from 2D image data, but it does not use map points in the backend and therefore cannot run the same global bundle adjustment as the original COVINS backend.

This page treats the pair as a practical centralized collaborative SLAM pattern, complementary to decentralized systems such as [Kimera-Multi](kimera-multi.md) and [D2SLAM](d2slam.md).

## Method Class

- Centralized collaborative visual-inertial SLAM.
- Multi-agent server backend for map merging and optimization.
- ORB-SLAM3-oriented original system plus generic VIO backend extension.
- Place recognition and relative pose estimation for inter-agent loop closures.
- Multi-agent 3D mapping and keyframe redundancy management.

## Method Summary

The COVINS paradigm is:

```text
agent 1 VIO  \
agent 2 VIO   -> COVINS server backend -> global collaborative map
agent N VIO  /
```

Agents perform local tracking onboard so they remain autonomous. The server receives selected keyframes and map data, detects overlaps between agents, estimates relative constraints, optimizes the joint map, and reduces redundancy.

COVINS-G changes the interface:

```text
arbitrary VIO / tracking camera / VINS-Fusion / ORB-SLAM3
  -> generic front-end wrapper
  -> COVINS-G server backend
```

This makes the backend easier to integrate with heterogeneous robots. The cost is reduced access to front-end-specific map-point structure, so the generic backend relies on pose/keyframe information and image-based relative pose estimation rather than full map-point global BA.

## Factor and State Representation

Original COVINS state:

```text
X_i^a: keyframe pose for agent a
L_k: visual map point, for front ends that expose map points
```

Factors:

```text
visual-inertial local constraints from each agent
map-point reprojection / bundle adjustment constraints
intra-agent loop closure constraints
inter-agent loop closure constraints
priors / gauge-fixing constraints
```

COVINS-G generic state:

```text
X_i^a: keyframe pose from arbitrary VIO
image observations / features for relative pose estimation
```

COVINS-G backend constraints:

```text
relative pose edge between keyframes
estimated by multi-camera relative pose from 2D data
```

The practical distinction:

- **COVINS:** more tightly coupled to ORB-SLAM3-style map data; can perform more accurate global bundle adjustment when map points are available.
- **COVINS-G:** more flexible across front ends; no backend GBA because map points are not utilized in the generic backend.

## Front-End Mechanics

1. **Onboard VIO.** Each agent runs an independent local VIO or tracking-camera estimator.

2. **Communication start.** Agents wait until enough keyframes exist before sending data to reduce initialization failures.

3. **Keyframe upload.** Selected keyframes, descriptors, poses, and optional map data are sent to the server.

4. **Place recognition.** The backend searches for overlaps between agents and sessions.

5. **Relative pose estimation.** COVINS-G uses multi-camera relative pose estimation and geometric verification from image data.

6. **Map merging.** Once a valid inter-agent transform exists, the server merges maps into a common reference frame.

7. **Redundancy reduction.** Duplicate or weak keyframes are removed to keep the joint map efficient.

## Back-End Mechanics

The centralized backend solves a joint estimation problem:

```text
min_X,L local VIO/map residuals
      + loop closure residuals
      + inter-agent relative pose residuals
      + optional map-point BA residuals
```

COVINS runs this on a powerful local PC or remote server. This reduces onboard compute and makes global optimization easier to supervise, but it creates a dependence on server availability and network connectivity.

For COVINS-G, the backend is intentionally generic. It accepts outputs from multiple front ends and computes loop-closure constraints using multi-camera geometry. The generic interface is useful for heterogeneous teams, but backend observability and final accuracy depend strongly on the quality and consistency of each front end's pose stream and keyframe data.

## Assumptions

- Each agent can run local VIO robustly.
- Network connectivity to the server is available often enough.
- Keyframes contain enough visual overlap for place recognition and relative pose estimation.
- Camera calibration, timestamps, and frame conventions are consistent.
- The server has enough compute for global optimization and map management.
- Agents do not reset or reuse keyframe IDs in a way that violates backend assumptions.

## Strengths

- Clear engineering split between onboard local autonomy and centralized map optimization.
- Scales to larger teams more easily than peer-to-peer raw-data sharing.
- COVINS-G supports arbitrary VIO front ends through a generic wrapper.
- Central server simplifies logging, debugging, map storage, and global consistency checks.
- Redundancy detection keeps keyframe-based maps from growing unnecessarily.
- Useful for collaborative AR, inspection, drones, and ground robots.

## Limitations

- Central server is a dependency and potential single point of failure.
- Visual place recognition can fail under lighting changes, low texture, motion blur, or repeated structure.
- Original COVINS is more accurate when its expected map-point structure is available; generic front ends lose some backend coupling.
- COVINS-G cannot perform map-point global BA in the same way because map points are not utilized in its backend.
- Map reset behavior in front ends can break backend assumptions.
- Server-agent network design, timestamps, and serialization become operational risks.

## Datasets and Benchmarks

Common evaluation contexts include:

- **EuRoC MAV.** Frequently used for ORB-SLAM3/VIO front-end evaluation and COVINS examples.
- **TUM-VI and VIO datasets.** Useful for generic front-end wrappers.
- **Multi-session visual SLAM datasets.** Needed for map merge and inter-agent loop closure.
- **In-house multi-agent data.** Essential for communication, reset, and heterogeneous-front-end testing.

Metrics:

- per-agent ATE/RPE before and after server optimization;
- inter-agent alignment error;
- place-recognition precision after geometric verification;
- keyframe and map-point count after redundancy reduction;
- server CPU/GPU/memory load;
- upload bandwidth per agent;
- latency from keyframe creation to global correction.

## AV Relevance

COVINS/COVINS-G is not a direct full-size road-AV localization stack, but the architecture is relevant to centralized fleet mapping and multi-robot facilities. For AV operations, a central backend can build and refine shared maps from multiple vehicles while each vehicle continues to run its local estimator.

For airside or industrial fleets, COVINS-G's generic front-end idea is attractive because different vehicles may expose different VIO or tracking-camera outputs. The risk is that airside visual conditions are often hostile: glare, night, rain, repeated stands, and texture-poor aprons. A production system should fuse visual constraints with LiDAR, radar, GNSS/RTK, or surveyed landmarks rather than relying on vision-only map merging.

## Indoor and Outdoor Relevance

- **Indoor:** Strong fit for multi-agent AR, drones, warehouses, labs, and inspection when Wi-Fi/server connectivity is available.
- **Outdoor:** Works when visual features are stable; requires validation under exposure and weather variation.
- **Indoor/outdoor transitions:** Front-end resets and exposure changes need special monitoring because server map assumptions depend on continuous keyframe identities.

## Integration Checklist

- Choose COVINS if the front end exposes compatible map points and global BA is important.
- Choose COVINS-G if heterogeneous VIO front ends and generic integration matter more.
- Define server deployment, network QoS, and agent reconnect behavior.
- Verify frame conventions for every front end wrapper.
- Add tests for keyframe ID uniqueness, map reset behavior, and timestamp ordering.
- Gate inter-agent loop closures with geometry and operational context.
- Log server-side accepted/rejected loop closures and map merges.
- Bound keyframe upload rate and configure redundancy reduction.
- Keep onboard local odometry independent from server corrections.
- Evaluate server failure and delayed-correction modes before field use.

## Related Repository Docs

- [ORB-SLAM2 and ORB-SLAM3](orb-slam2-orb-slam3.md)
- [VINS-Mono and VINS-Fusion](vins-mono-vins-fusion.md)
- [OpenVINS](openvins.md)
- [GraphSLAM and Pose Graph Optimization](graphslam-pose-graph-optimization.md)
- [Loop Closure and Place Recognition](loop-closure-place-recognition.md)
- [Kimera-Multi](kimera-multi.md)
- [D2SLAM](d2slam.md)

## Sources

- Schmuck et al., "COVINS: Visual-Inertial SLAM for Centralized Collaboration," arXiv, 2021: https://arxiv.org/abs/2108.05756
- Patel, Karrer, Baenninger, and Chli, "COVINS-G: A Generic Back-end for Collaborative Visual-Inertial SLAM," arXiv / ICRA 2023: https://arxiv.org/abs/2301.07147
- Official COVINS/COVINS-G repository: https://github.com/VIS4ROB-lab/covins
- CCM-SLAM predecessor listed by the project: https://github.com/VIS4ROB-lab/ccm_slam
