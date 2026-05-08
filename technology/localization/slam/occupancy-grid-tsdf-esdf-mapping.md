# Occupancy Grid, TSDF, and ESDF Mapping

## Executive Summary

Occupancy grids, TSDFs, and ESDFs are classical spatial map representations built from range sensors and estimated poses. They are not SLAM backends by themselves, but they are core outputs and consumers of SLAM: pose estimates determine how sensor rays are integrated, and map quality feeds localization, planning, collision checking, and change detection.

An occupancy grid stores the probability that each cell or voxel is occupied. A TSDF, or Truncated Signed Distance Function, stores signed distance to the nearest observed surface near that surface and is strong for dense reconstruction and meshing. An ESDF, or Euclidean Signed Distance Field, stores distance to the nearest obstacle over free space and is strong for planning, trajectory optimization, and safety filters.

For airside autonomous vehicles, these representations are mandatory infrastructure. LiDAR SLAM estimates the vehicle trajectory; occupancy/TSDF/ESDF mapping turns that trajectory and the point clouds into a map that the planner can use. The implementation must handle multi-LiDAR throughput, dynamic objects, aircraft overhangs, reflective surfaces, GPS/SLAM pose corrections, and fleet map updates. For the existing repo's detailed real-time design, see [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md).

## Historical Context

Occupancy grids were introduced by Moravec and Elfes as probabilistic maps for mobile robots. The log-odds Bayesian update later became the standard formulation, popularized in probabilistic robotics. OctoMap brought 3D occupancy mapping to robotics using an octree, giving a compact representation of free, occupied, and unknown space.

TSDF mapping comes from volumetric fusion in computer graphics and vision. Curless and Levoy established volumetric integration of range images. KinectFusion demonstrated real-time TSDF reconstruction and tracking with commodity depth cameras and GPUs. Voxel hashing and sparse voxel structures then made TSDF mapping scale beyond small dense volumes.

ESDF mapping became important for onboard planning because many trajectory optimizers need distance-to-obstacle queries and gradients. Voxblox showed how to incrementally build ESDFs from TSDFs onboard MAVs. NVIDIA nvblox moved TSDF/ESDF mapping onto GPUs for real-time robotics. VDBFusion used OpenVDB to make sparse TSDF fusion efficient and flexible for LiDAR and RGB-D data.

## Sensor Assumptions

These mapping methods assume:

- A range sensor produces depth, LiDAR points, stereo depth, or RGB-D frames.
- The sensor pose is known for each measurement, usually from SLAM, odometry, or motion compensation.
- Sensor intrinsics/extrinsics are calibrated.
- Time synchronization is good enough that points align with the pose used for integration.
- The scene is static over the map integration timescale, or dynamic objects are filtered/decayed.
- A sensor model defines free-space and occupied/surface evidence.

Occupancy grids require ray visibility: a ray passing through cells is evidence of free space, while the endpoint is evidence of occupancy. TSDFs require surface observations and signed distance integration along the sensor ray. ESDFs require an occupancy or TSDF source from which obstacle distances are computed.

For LiDAR airside vehicles, multi-sensor extrinsics and ego-motion compensation are as important as the mapping algorithm. Bad calibration creates ghost obstacles and blurred surfaces.

## State and Map Representation

**Occupancy grid:**

```text
cell c:
  l(c) = log( p(occupied | observations) / p(free | observations) )
```

Representations:

- 2D dense grid for ground-plane planning.
- 3D dense voxel grid for bounded local maps.
- Octree for sparse global 3D maps.
- Voxel hash map or block-sparse grid for GPU/local maps.

**TSDF:**

```text
voxel v:
  d(v) = truncated signed distance to nearest observed surface
  w(v) = integration weight/confidence
  optional color/intensity/semantic class
```

TSDF values near zero indicate surfaces. Positive/negative sign convention depends on implementation, but usually positive is in front of the surface along the observed ray and negative is behind it within a truncation band.

**ESDF:**

```text
voxel v:
  D(v) = Euclidean distance to nearest occupied surface
  optional gradient grad D(v)
```

ESDFs are designed for fast collision checking and optimization. They usually derive from occupancy or TSDF maps.

## Algorithm Pipeline

1. **Receive synchronized pose and range data.** Use SLAM or state-estimator pose for each scan/frame. Deskew LiDAR scans if needed.

2. **Transform points into the map frame.** Apply calibrated `T_map_base * T_base_sensor`.

3. **Filter data.**

- Remove ego vehicle points.
- Remove or label dynamic objects.
- Filter rain, spray, and isolated outliers.
- Optionally segment ground.

4. **Update occupancy.**

- Raycast from sensor origin to hit point.
- Mark traversed cells as free.
- Mark hit cell or endpoint region as occupied.
- Clamp log-odds to avoid overconfidence.

5. **Update TSDF.**

- Activate voxel blocks near observed surfaces.
- Project voxels into the depth/range image or compute ray distance.
- Integrate signed distance with weighted averaging.

6. **Update ESDF.**

- Propagate distances from occupied/surface voxels.
- Maintain incremental updates when obstacles change.

7. **Apply temporal logic.**

- Static map persists.
- Dynamic layer decays quickly.
- Unknown remains unknown unless observed.

8. **Generate downstream products.**

- 2D costmap for planning.
- Inflated obstacle map.
- ESDF for trajectory optimization or CBF safety.
- Mesh for visualization/QC.
- Change-detection layers for map maintenance.

9. **Handle pose graph corrections.** If SLAM updates old poses, either rebuild affected map blocks, use submaps, or deform/realign submaps rather than blindly integrating corrected and uncorrected data into one fixed grid.

## Formulation

### Occupancy Log-Odds

The log-odds state is:

```text
l_t(c) = log( p(m_c = occupied | z_1:t) / p(m_c = free | z_1:t) )
```

The recursive update is:

```text
l_t(c) = l_{t-1}(c) + logit(p(m_c | z_t)) - l_0
```

where `l_0` is the prior log-odds. A common implementation uses constants:

```text
if ray passes through c:
  l(c) <- clamp(l(c) + l_free)

if ray ends in c:
  l(c) <- clamp(l(c) + l_occ)
```

Convert back to probability:

```text
p(occupied) = 1 - 1 / (1 + exp(l))
```

### TSDF Integration

For voxel `v` and depth/range observation giving signed distance `d_obs(v)`:

```text
d_obs_trunc = clamp(d_obs, -mu, +mu)
d_new = (w_old d_old + w_obs d_obs_trunc) / (w_old + w_obs)
w_new = min(w_old + w_obs, w_max)
```

Only voxels within truncation distance `mu` of the observed surface are updated. This smooths sensor noise and supports mesh extraction with marching cubes.

### ESDF Update

An ESDF stores:

```text
D(v) = min_{o in occupied} || position(v) - position(o) ||
```

Incremental algorithms update distances only near changed obstacles. For planning, the gradient of `D` points away from obstacles and can be used in trajectory optimization or safety constraints.

## Failure Modes

**Pose error.** Mapping quality is bounded by pose quality. Drift creates double walls, smeared surfaces, and inconsistent obstacles.

**Dynamic objects.** Moving aircraft, vehicles, personnel, and equipment become false static obstacles unless filtered or decayed.

**Reflective/transparent surfaces.** Wet tarmac, glass, aircraft skin, and metallic equipment can create missing returns or phantom points.

**Overconfidence.** Unbounded log-odds or high TSDF weights prevent maps from adapting when conditions change.

**Unknown/free confusion.** Planning through unknown space may be unsafe; treating all unknown as occupied may be too conservative.

**Memory and bandwidth.** Dense 3D maps at fine resolution become large quickly.

**Raycasting load.** Multi-LiDAR systems can generate hundreds of thousands to millions of points per cycle.

**Height projection errors.** Collapsing 3D occupancy to 2D can incorrectly block passable overhangs or miss low obstacles.

**Pose graph correction conflicts.** Integrating scans before and after loop closure into one global grid without submap handling causes inconsistent maps.

**TSDF behind-surface artifacts.** TSDFs model surfaces well but do not directly represent unknown/free/occupied semantics unless paired with visibility logic.

## AV Relevance

Occupancy and distance-field maps are highly relevant to AVs:

- Local collision checking.
- Planning costmaps.
- Unknown-object detection.
- Drivable-space reasoning.
- Map construction and QA.
- Fleet-shared situational awareness.
- Change detection against prior maps.
- Safety filters that need distance-to-obstacle gradients.

They are complementary to SLAM backends. SLAM estimates pose; occupancy/TSDF/ESDF mapping estimates space. A strong AV stack needs both.

For airside autonomous vehicles, these maps are especially valuable because not every obstacle is a learned object class. FOD, cones, hoses, carts, temporary barriers, and unusual equipment should still appear as occupied or unsafe space.

## Indoor/Outdoor Relevance

**Indoor:** RGB-D and 2D/3D LiDAR occupancy/TSDF mapping are mature. ESDFs are useful for mobile robots and drones in cluttered interiors.

**Outdoor:** LiDAR occupancy grids and voxel maps are standard for local planning. TSDF/ESDF mapping is harder outdoors because maps are large, surfaces are sparse, and dynamic objects are common.

**Large sites:** Use submaps, rolling local grids, multi-resolution storage, or sparse voxel hashing. Do not rely on one monolithic dense global grid.

## Airside Deployment Notes

Airside mapping has specific requirements:

- **3D awareness:** Aircraft wings and jet bridges can overhang the vehicle. A 2D max-height projection can be too conservative; a height-filtered projection must account for vehicle envelope.
- **FOD detection:** Small debris requires fine near-field resolution and multi-frame persistence.
- **Dynamic layers:** Moving GSE and personnel need fast decay; buildings and terminal structure should persist.
- **Virtual obstacles:** Jet blast zones, engine intake zones, fuel spill areas, and runway-protection zones may be invisible to LiDAR and must be injected from operational data.
- **Reflective surfaces:** Wet tarmac and aircraft skins require outlier filtering and temporal consistency.
- **Multi-LiDAR fusion:** 4-8 LiDARs need calibrated extrinsics and GPU-friendly integration.
- **Fleet sharing:** Occupancy summaries from nearby vehicles can fill occlusions around aircraft.

Recommended airside map stack:

```text
local dynamic occupancy grid -> immediate collision checking
local ESDF -> optimization/safety filters
static localization point cloud or TSDF -> map construction and QA
height-filtered 2D costmap -> Frenet/planning layer
fleet-shared BEV occupancy -> cooperative awareness
```

This should be integrated with the localization outputs from [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md) and the offline workflow in [Map Construction Pipeline](../map-construction-pipeline.md).

## Datasets and Metrics

Useful datasets:

- **TUM RGB-D:** RGB-D trajectories for indoor reconstruction.
- **ICL-NUIM:** Synthetic RGB-D with trajectory and surface ground truth.
- **EuRoC MAV:** Visual-inertial data with 3D structure scans for some sequences.
- **KITTI:** Outdoor LiDAR/camera driving data.
- **Newer College:** Modern LiDAR/vision/inertial data with ground truth for mapping.
- **SemanticKITTI:** Useful for dynamic/static and semantic occupancy experiments.

Metrics:

- Occupancy precision/recall against ground truth.
- IoU for occupied/free/unknown classes.
- Surface reconstruction accuracy and completeness.
- Chamfer distance or point-to-mesh distance.
- ESDF distance error and gradient quality.
- Planning collision rate and clearance.
- Map update latency and worst-case runtime.
- Memory per square meter or cubic meter.
- Dynamic obstacle clearing time.
- FOD detection probability and false-positive rate.

For airside, evaluate under wet tarmac, night, rain, aircraft occlusion, de-icing spray, and temporary equipment changes.

## Open-Source Implementations

- **OctoMap:** Probabilistic 3D occupancy mapping with octrees: https://octomap.github.io/ and https://github.com/OctoMap/octomap
- **octomap_server:** ROS integration for OctoMap: https://github.com/OctoMap/octomap_mapping
- **Voxblox:** CPU TSDF/ESDF mapping for planning: https://github.com/ethz-asl/voxblox
- **nvblox:** NVIDIA GPU-accelerated TSDF/ESDF mapping: https://github.com/nvidia-isaac/nvblox
- **Isaac ROS nvblox:** ROS 2 integration and Nav2 local costmap provider: https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_nvblox
- **VDBFusion:** OpenVDB-based TSDF integration for range sensors: https://github.com/PRBonn/vdbfusion
- **Open3D:** TSDF integration and 3D data processing: https://www.open3d.org/ and https://github.com/isl-org/Open3D
- **costmap_2d:** ROS 2D planning costmap infrastructure: http://wiki.ros.org/costmap_2d
- **spatio_temporal_voxel_layer:** 3D voxel layer with temporal decay for ROS navigation: https://github.com/SteveMacenski/spatio_temporal_voxel_layer

## Practical Recommendation

Use occupancy grids for safety-critical free/occupied/unknown reasoning, TSDFs for dense surface reconstruction and map QA, and ESDFs for planning and safety margins. Do not choose one representation for every task.

For airside AVs:

- Use a GPU local occupancy layer for real-time planning.
- Use ESDF where trajectory optimization or CBF-style safety filters need gradients.
- Use TSDF/submap reconstruction for offline map construction and inspection.
- Use temporal decay and semantic filtering for dynamic objects.
- Treat unknown conservatively near aircraft and restricted zones.
- Rebuild or submap-align after major pose graph corrections.

The detailed production design should follow [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md), with pose sources and uncertainty from [GTSAM Factor Graphs](../../../foundations/gtsam-factor-graphs.md).

## Related Repository Docs

- [GTSAM Factor Graphs](../../../foundations/gtsam-factor-graphs.md)
- [Robust State Estimation and Multi-Sensor Localization Fusion](../robust-state-estimation-multi-sensor.md)
- [LiDAR Place Recognition and Re-Localization](../lidar-place-recognition-relocalization.md)
- [Real-Time Occupancy Grid Mapping](../realtime-occupancy-grid-mapping.md)
- [Map Construction Pipeline](../map-construction-pipeline.md)

## Sources

- Moravec and Elfes, "High Resolution Maps from Wide Angle Sonar," ICRA 1985: https://www.ri.cmu.edu/publications/high-resolution-maps-from-wide-angle-sonar/
- Thrun, Burgard, and Fox, "Probabilistic Robotics," MIT Press, occupancy grid mapping reference: https://mitpress.mit.edu/9780262201629/probabilistic-robotics/
- Hornung et al., "OctoMap: An Efficient Probabilistic 3D Mapping Framework Based on Octrees," Autonomous Robots, 2013: https://octomap.github.io/
- OctoMap GitHub: https://github.com/OctoMap/octomap
- Curless and Levoy, "A Volumetric Method for Building Complex Models from Range Images," SIGGRAPH 1996: https://graphics.stanford.edu/papers/volrange/
- Newcombe et al., "KinectFusion: Real-Time Dense Surface Mapping and Tracking," ISMAR 2011: https://www.cs.jhu.edu/~misha/Fall13b/Papers/Newcombe11.pdf
- Oleynikova et al., "Voxblox: Incremental 3D Euclidean Signed Distance Fields for On-Board MAV Planning," IROS 2017: https://arxiv.org/abs/1611.03631
- Voxblox GitHub: https://github.com/ethz-asl/voxblox
- Millane et al., "nvblox: GPU-Accelerated Incremental Signed Distance Field Mapping," ICRA 2024: https://arxiv.org/abs/2311.00626
- nvblox GitHub: https://github.com/nvidia-isaac/nvblox
- Vizzo et al., "VDBFusion: Flexible and Efficient TSDF Integration of Range Sensor Data," Sensors 2022: https://www.mdpi.com/1424-8220/22/3/1296
- VDBFusion GitHub: https://github.com/PRBonn/vdbfusion
- Open3D TSDF integration docs: https://open3d.org/docs/release/tutorial/t_reconstruction_system/integration.html
- ICL-NUIM RGB-D benchmark: https://www.doc.ic.ac.uk/~ahanda/VaFRIC/iclnuim.html
- Newer College Dataset: https://ori-drs.github.io/newer-college-dataset/download/
