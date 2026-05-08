# V2 Deep Dive: Ground Segmentation & Occupancy (#14-16) and Safety & Redundancy Architecture (#17-21)

**Feasibility verification against reference airside AV stack source code**
**Date: 2026-03-16**

---

## Source Code Baseline

The analysis below is grounded in direct reading of:

| File | Role |
|------|------|
| `GroundGridNodelet.cpp` (766 lines) | ROS nodelet: point transform, ground/non-ground split, low-lying obstacle filter, occupancy grid publishing |
| `GroundGrid.cpp` (148 lines) | Grid map lifecycle: init 60m x 60m grid at 0.33m resolution, move with odometry |
| `GroundSegmentation.cpp` (507 lines) | Core algorithm: multi-threaded point insertion, variance-based ground patch detection (3x3/5x5), spiral interpolation |
| `GroundGrid.h` / `GroundSegmentation.h` | Class interfaces, grid_map layers: `points`, `ground`, `groundpatch`, `minGroundHeight`, `maxGroundHeight`, `variance`, `groundCandidates`, `planeDist`, `m2`, `meanVariance`, `pointsRaw` |
| `GroundGrid.cfg` | Dynamic reconfigure: 13 parameters including `distance_factor`, `outlier_tolerance`, `ground_height_above_vehicle_tolerance` |
| `ground_filter.yaml` | Runtime config: odom topic, vehicle footprint, low-lying obstacle filter params |
| `polygon_detector_node.cpp` (~1400 lines) | Two-phase detection: lock-free clustering + locked tracking. Subscribes to `/ground_filter/non_ground`. Publishes `DetectedObjectArray`, polygon markers, velocity markers |
| `polygon_detector.hpp` (~520 lines) | Template class: filterCloud, segmentPlane, sphericalClustering, obstacleTracking (Hungarian) |
| `polygon_detector.yaml` | Full config: spherical clustering, Kalman tracking, velocity estimation, polygon inflation |
| `perception.launch` | Pipeline: aggregator -> preprocessor -> ground_filter -> segmentation -> deck/trailer/uld detection + rain detection. All nodelets in shared manager (16 worker threads) |

**Key architecture facts established from code:**
- GroundGrid is the BSD-licensed algorithm from Freie Universitat Berlin (Steinke, Goehring, Rojas -- IEEE RAL 2024). reference airside AV stack uses it directly as a nodelet.
- The grid is 60m x 60m at 0.33m resolution = 181x181 cells = 32,761 cells. Layers stored in `grid_map::GridMap`.
- Ground segmentation uses Welford's online variance algorithm per cell, ground patches detected via variance thresholding, confidence-weighted height estimation, and spiral interpolation from vehicle center outward.
- Non-ground classification: `intensity = 99` marker. Ground: `intensity = 49`.
- Existing occupancy grid published via `grid_map::GridMapRosConverter::toOccupancyGrid(*map_ptr_, "points", 0, 1, occupancy_grid)` -- this is a **point-count-based** occupancy grid, NOT a proper log-odds ray-cast occupancy grid.
- Polygon Detector subscribes to `/ground_filter/non_ground` and runs its own pipeline (filter, optional RANSAC ground removal, spherical clustering, polygonizer, Kalman tracking, Hungarian matching).
- No independent safety layer exists. No TTC computation. No sensor health monitoring in perception.

---

## Recommendation #14: Occupancy Grid for Free Space Estimation

### [Occupancy Grid for Free Space Estimation]
**Original Priority:** High
**Revised Priority:** Critical -- upgraded because code review reveals the current "occupancy grid" is NOT a real occupancy grid
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The current system already publishes a `nav_msgs::OccupancyGrid` on topic `obstacle_grid` from `GroundGridNodelet.cpp` line 432:
```cpp
grid_map::GridMapRosConverter::toOccupancyGrid(*map_ptr_, "points", 0, 1, occupancy_grid);
```
This converts the `"points"` layer (raw point count per cell) into an occupancy grid. This is fundamentally flawed: it only marks cells where points fell, but does NOT mark cells as free based on ray traversal. A cell with zero points could be free space OR could be occluded/unobserved -- there is no distinction.

**Integration approach -- two options:**

**Option A: New layer in existing GroundGrid (lower effort, tighter coupling)**
- Add a `"log_odds"` layer to the grid_map in `GroundGrid::initGroundGrid()` at line 56 of `GroundGrid.cpp`:
  ```cpp
  mMap_ptr = std::make_shared<grid_map::GridMap, const std::vector<std::string>>(
      {"points", "ground", "groundpatch", "minGroundHeight", "maxGroundHeight", "log_odds"});
  ```
- In `GroundSegmentation::filter_cloud()`, after point insertion (line 107 join), add a Bresenham ray-cast from `cloudOrigin` through each point. Cells along the ray get `log_odds -= l_free` (0.4); the hit cell gets `log_odds += l_occ` (0.85). Clamp to [-5, +5].
- Replace the `toOccupancyGrid` call at line 432 of `GroundGridNodelet.cpp` to use `"log_odds"` instead of `"points"`.
- Concern: GroundSegmentation already uses multi-threading (line 100-107, threadcount threads). Ray-casting into shared `log_odds` layer requires atomic operations or per-thread accumulation buffers.

**Option B: Separate nodelet (recommended -- decoupled, independently testable)**
- New nodelet `OccupancyGridNodelet` subscribing to the same raw point cloud topic (`/pointcloud_aggregator/output`) and odometry.
- Maintains its own `nav_msgs::OccupancyGrid` at configurable resolution (0.25m recommended for 100m x 100m = 160,000 cells).
- Uses Bresenham ray-casting with log-odds update.
- Publishes on a new topic `/occupancy_grid/free_space`.
- Can be added to `perception.launch` as another nodelet in the shared manager.
- Grid follows ego vehicle (same move semantics as GroundGrid).

**Data structures that need modification (Option B):**
- New `OccupancyGrid` class with `std::vector<float> log_odds_` (flat array, row-major).
- Bresenham line function: `void raycast(float x0, float y0, float x1, float y1, std::vector<float>& log_odds, int cols, float l_free, float l_occ)`.
- `nav_msgs::OccupancyGrid` message conversion: `p = 1 - 1/(1 + exp(log_odds))`, mapped to [0, 100] integer.

**Industry Reality Check:**
- Log-odds occupancy grids are the most battle-tested representation in robotics, dating to Elfes (1989) and Thrun (2005). Every major AV stack uses them.
- Waymo's system uses occupancy grids for free-space reasoning (public safety report). Aurora's free-space estimation is a core component of their autonomy system.
- Autoware Universe has an open-source `probabilistic_occupancy_grid_map` package that does exactly this with Bresenham ray-casting -- can be used as a reference implementation.
- At 0.25m resolution, 100m x 100m = 160,000 cells. With 50,000 points per frame and ~50 cells per ray average, that is ~2.5M cell updates per frame. On a single core at ~1ns per update (cache-friendly sequential access), this is ~2.5ms. Trivially real-time.
- Known limitation: ray-casting assumes a clear line of sight from sensor to point. In multi-sensor setups, each sensor should cast rays from its own origin. reference airside AV stack already has `cloudOrigin` computed per frame (GroundGridNodelet.cpp line 288-290), but this is a single origin for the aggregated cloud. For proper multi-sensor ray-casting, need per-sensor origins. This is a refinement, not a blocker.

**Revised Implementation Plan:**
1. Create `airside_occupancy_grid` package with `OccupancyGridNodelet`.
2. Implement 2D log-odds grid with Bresenham ray-casting.
3. Subscribe to `/pointcloud_aggregator/output` and `/odom/fused`.
4. Transform points to map frame (reuse existing tf2 pattern from GroundGridNodelet).
5. Ray-cast from sensor origin through each point.
6. Publish `nav_msgs::OccupancyGrid` at 10Hz.
7. Add to `perception.launch`.

**Estimated effort:** 2-3 weeks (simpler than original estimate because Autoware reference code exists).

**Testing approach:**
- Unit test: synthetic point clouds with known geometry, verify free/occupied cells.
- Integration test: replay bag files, visualize occupancy grid in RViz overlaid on point cloud.
- Regression test: compare free-space extent against manual annotation on 10 representative scenes.

**Risk Assessment:**
- Risk: Multi-sensor aggregated cloud has a single origin, losing per-sensor ray geometry. Mitigation: initially use the aggregated origin (acceptable for 5 sensors on a small vehicle), later extend to per-sensor ray-casting.
- Risk: Moving objects create "shadow trails" in the grid (cells behind a moving object marked as occupied from a previous frame). Mitigation: Use temporal decay (reduce log-odds toward zero at each timestep for cells not observed).
- Risk: Computational load if resolution is too fine. Mitigation: 0.25m is well within budget; parameterize resolution.

---

## Recommendation #15: GroundGrid Enhancement with Negative Obstacle Detection

### [GroundGrid Enhancement with Negative Obstacle Detection]
**Original Priority:** Medium
**Revised Priority:** High -- upgraded because airport ramp edges are a real operational hazard
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

**Code Integration Points:**

Negative obstacle detection fits naturally into the existing GroundGrid architecture. The key data is already present:

1. **Ground confidence layer** (`groundpatch`): values near 0 indicate cells where ground was never confidently detected. In `GroundSegmentation::detect_ground_patch<S>()` (line 358-429 of `GroundSegmentation.cpp`), cells are only updated when variance and point count thresholds are met. Cells beyond the observed area or at drop-offs remain at their initial value of `0.0000001` (set in `GroundGrid.cpp` line 74).

2. **Ground height layer** (`ground`): sharp height discontinuities between adjacent cells indicate potential drop-offs. The spiral interpolation (`spiral_ground_interpolation`, line 431-473) smooths ground estimates outward from the vehicle center, which could mask genuine discontinuities.

3. **Point count layer** (`pointsRaw`): cells with zero observed points in front of the vehicle (within expected LiDAR range) are candidates for "missing ground" -- a hallmark of negative obstacles.

**Specific insertion point for negative obstacle detection:**

After `spiral_ground_interpolation()` returns (GroundSegmentation.cpp line 148), add a new method `detect_negative_obstacles()`:

```
// In GroundSegmentation.h, add:
struct NegativeObstacle {
    grid_map::Index index;
    float height_drop;        // meters below expected ground
    float confidence;          // 0-1
};
std::vector<NegativeObstacle> detect_negative_obstacles(
    const grid_map::GridMap& map,
    const PCLPoint& cloudOrigin) const;
```

The method should:
1. Iterate cells in a forward arc from vehicle center (direction of travel from odometry).
2. For each cell, check: (a) `groundpatch` confidence < threshold AND (b) neighboring cells DO have confident ground at a significantly different height, OR (c) `pointsRaw` count is zero but the cell is within expected LiDAR range (not occluded by a closer obstacle).
3. Flag cells meeting criteria as negative obstacles.

**Publishing:** Add a `"negative_obstacle"` layer to the grid_map, or publish as a separate point cloud on `/ground_filter/negative_obstacles`. The simplest integration is adding the layer in `initGroundGrid()`:
```cpp
// GroundGrid.cpp line 56, extend layer list:
{"points", "ground", "groundpatch", "minGroundHeight", "maxGroundHeight", "negativeObstacle"}
```

**Ground continuity check (Zoox GCA concept):**
In `GroundGridNodelet::points_callback()`, after ground segmentation completes (line 293), compute:
- `max_ground_range`: the furthest cell along the vehicle's heading with confident ground (`groundpatch > threshold`).
- `stopping_distance`: from current velocity (available from `/odom/fused` odometry).
- If `max_ground_range < stopping_distance`, publish a warning on a new topic `/ground_filter/ground_continuity_alert`.

**Industry Reality Check:**
- Negative obstacle detection with LiDAR is a well-studied problem, particularly in off-road robotics (DARPA Grand Challenge era). The fundamental challenge is distinguishing "no returns because there is a hole" from "no returns because nothing is there" (e.g., smooth flat ground at long range).
- The GroundGrid's 0.33m resolution is suitable for detecting ramp edges (typically >0.3m drop) but marginal for shallow potholes (<0.1m). Airport ramp edges (0.1-0.3m curbs) are at the resolution limit.
- Kodiak's approach (off-road negative obstacle detection) uses multi-frame accumulation and expected-vs-observed point count comparison, which maps well to GroundGrid's `pointsRaw` layer.
- Key limitation: GroundGrid's spiral interpolation actively fills in unknown cells with interpolated ground heights. This MASKS negative obstacles by propagating ground height estimates into cells where no ground was actually observed. The interpolation (line 495 in `GroundSegmentation.cpp`) sets `height = (1.0f - occupied) * avg + occupied * height` -- when `occupied` is near zero, the cell takes the neighbor's average, which is exactly what a negative obstacle cell would do.

**Critical modification needed:** The spiral interpolation must be modified to NOT interpolate into cells flagged as potential negative obstacles. This requires a two-pass approach:
1. First pass: run ground segmentation and negative obstacle detection.
2. Second pass: run spiral interpolation, skipping cells flagged as negative obstacles.

This is a code-level change in `GroundSegmentation::interpolate_cell()` (line 476):
```cpp
void GroundSegmentation::interpolate_cell(grid_map::GridMap& map, const size_t x, const size_t y) const {
    // NEW: Skip cells flagged as negative obstacles
    static grid_map::Matrix& neg_obs = map["negativeObstacle"];
    if (neg_obs(x, y) > 0.5f) return;
    // ... existing interpolation logic ...
}
```

**Revised Implementation Plan:**
1. Add `"negativeObstacle"` layer to GroundGrid.
2. Implement `detect_negative_obstacles()` using ground confidence + height gradient analysis.
3. Modify spiral interpolation to skip negative obstacle cells.
4. Add ground continuity check using odometry velocity.
5. Publish negative obstacles as a grid_map layer and as a separate PointCloud2 topic.
6. Add ground continuity alert topic.

**Estimated effort:** 3-4 weeks (more than originally estimated due to spiral interpolation modification).

**Testing approach:**
- Unit test: synthetic grid with known drop-offs, verify detection.
- Field test: drive past known ramp edges at the airport, measure detection rate and false positive rate.
- Critical test: verify that spiral interpolation modification does not degrade ground segmentation quality in normal (flat) areas.

**Risk Assessment:**
- Risk: Over-sensitive negative obstacle detection on rough pavement. Mitigation: configurable height gradient threshold (start at 0.15m, tune empirically).
- Risk: Spiral interpolation modification degrades ground quality elsewhere. Mitigation: only skip interpolation when `negativeObstacle` confidence is high (>0.8); for marginal cases, interpolate normally.
- Risk: GroundGrid resolution (0.33m) may miss narrow drainage grates. Mitigation: this is an inherent limitation of the grid resolution; increasing resolution to 0.2m would address this but increases cell count from 32K to 90K. Benchmark before deciding.

---

## Recommendation #16: Piecewise Planar Ground Fitting for Ramps and Slopes

### [Piecewise Planar Ground Fitting for Ramps and Slopes]
**Original Priority:** Low
**Revised Priority:** Low -- confirmed after code review
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS (but low ROI given GroundGrid's existing capabilities)

**Code Integration Points:**

GroundGrid already handles local ground variation through its grid-based approach. The `detect_ground_patch<S>()` template (GroundSegmentation.cpp line 358) uses either 3x3 or 5x5 patches depending on distance from center:
```cpp
if (sqdist <= std::pow(mConfig.patch_size_change_distance, 2.0))
    detect_ground_patch<3>(map, i, j);  // close range: 3x3 = ~1m x 1m
else
    detect_ground_patch<5>(map, i, j);  // far range: 5x5 = ~1.65m x 1.65m
```

Each patch independently estimates ground height using point-count-weighted minimum heights and variance analysis. This IS a form of piecewise ground fitting, just grid-aligned rather than sector-based.

**Where CZM/Patchwork++ would improve over GroundGrid:**
- GroundGrid's patches are axis-aligned squares. On a ramp that transitions at an angle to the grid, boundary artifacts appear where one cell estimates "ramp" and an adjacent cell estimates "flat."
- Patchwork++ uses concentric zones (annular sectors from the LiDAR origin) which align with the LiDAR scan pattern and naturally handle radial gradients.
- However, GroundGrid's spiral interpolation partially mitigates boundary artifacts by smoothing estimates from center outward.

**Where GroundGrid is already superior to Patchwork++:**
- GroundGrid maintains temporal persistence via the `groundpatch` confidence layer. Cells retain ground estimates across frames and only update when new evidence arrives. Patchwork++ is single-frame.
- GroundGrid's outlier detection (insert_cloud, line 254-294) uses ray-based occlusion checking to reject spurious low points. Patchwork++ has no equivalent.
- GroundGrid already publishes a terrain grid usable for path planning. Patchwork++ only produces a ground/non-ground label per point.

**If implemented anyway:**
- Replace `detect_ground_patches()` with a CZM-based approach:
  - Divide the grid into concentric annular sectors (4 zones: 0-5m, 5-15m, 15-30m, 30-60m, each divided into 8 azimuth sectors = 32 sectors total).
  - Fit a plane to points in each sector using PCA (already available via Eigen).
  - Use the plane fit to estimate ground height per cell instead of the current min-height + variance approach.
- This would require replacing `detect_ground_patches()` and `detect_ground_patch<S>()` in GroundSegmentation.cpp (lines 328-429) -- a ~100-line replacement.

**Industry Reality Check:**
- Patchwork++ (Lee et al., IROS 2022) is the state-of-the-art single-frame ground segmentation, achieving 93.7% IoU on SemanticKITTI. GroundGrid achieves 94.78% IoU on the same dataset, meaning GroundGrid is already competitive or better.
- In production AV systems (Waymo, Aurora), ground segmentation is typically done with proprietary multi-frame grid methods similar to GroundGrid, not single-frame methods like Patchwork++.
- For airport-specific ramp handling, the transition zone is typically 5-10m long. GroundGrid's 0.33m resolution and 3x3/5x5 patch detection should capture this adequately. The real challenge is when the ramp slope exceeds `ground_height_above_vehicle_tolerance` (configured at 0.2m), causing the ground patch to be rejected entirely.

**Revised Implementation Plan:**
1. **First, tune existing GroundGrid:** Increase `ground_height_above_vehicle_tolerance` from 0.2m to 0.5m or make it distance-dependent (stricter near vehicle, relaxed at range). This single parameter change in `ground_filter.yaml` may resolve most ramp issues.
2. **If tuning insufficient:** Implement CZM-based sector fitting as described above.
3. **Effort:** Parameter tuning: 1-2 days. Full CZM implementation: 2-3 weeks.

**Risk Assessment:**
- Risk: Increasing `ground_height_above_vehicle_tolerance` allows actual obstacles at ramp height to be misclassified as ground. Mitigation: make tolerance distance-dependent (near vehicle: strict, far: relaxed).
- Risk: CZM implementation breaks temporal persistence of GroundGrid. Mitigation: keep the grid_map structure and only change the patch detection method.

---

## Recommendation #17: Geometric Collision Avoidance (GCA) System

### [Geometric Collision Avoidance (GCA) System]
**Original Priority:** Critical
**Revised Priority:** Critical -- confirmed, this is the single highest-impact safety improvement
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The GCA must be architecturally ISOLATED from the main perception pipeline. It must NOT subscribe to processed perception output -- it must subscribe to raw sensor data.

**Input topics (from perception.launch):**
- Raw aggregated point cloud: `/pointcloud_aggregator/output` (the same topic that `ground_filter` subscribes to, line 93 of `GroundGridNodelet.cpp`)
- Vehicle odometry: `/odom/fused` (same as ground_filter, line 92)
- Planned trajectory: from the navigation stack (need to identify the topic -- likely from `behavior_planner_nodelet` or `local_planning_nodelet` in `airside_nav`)

**Implementation as a new node (NOT a nodelet -- intentional isolation):**

The GCA should be a standalone ROS node, not a nodelet, to ensure process isolation from the perception pipeline. If the perception nodelet manager crashes, the GCA continues operating.

```
// gca_node.h
class GCANode {
public:
    GCANode();
private:
    // Subscribers
    ros::Subscriber raw_cloud_sub_;     // /pointcloud_aggregator/output
    ros::Subscriber odom_sub_;          // /odom/fused
    ros::Subscriber trajectory_sub_;    // /local_planner/trajectory (TBD)

    // Publishers
    ros::Publisher cas_trigger_pub_;    // /gca/cas_trigger (std_msgs::Bool or custom msg)
    ros::Publisher corridor_viz_pub_;   // /gca/corridor (visualization_msgs::MarkerArray)
    ros::Publisher ground_profile_pub_; // /gca/ground_profile (sensor_msgs::PointCloud2)

    // Core algorithm
    void cloudCallback(const sensor_msgs::PointCloud2ConstPtr& cloud);
    void odomCallback(const nav_msgs::OdometryConstPtr& odom);
    void trajectoryCallback(const nav_msgs::PathConstPtr& path);

    // GCA pipeline (runs on every cloud callback)
    struct CorridorParams {
        float width;             // vehicle width + lateral margin
        float length;            // stopping distance at current velocity
        float height_min;        // ground search lower bound
        float height_max;        // obstruction upper bound
    };

    CorridorParams computeCorridor(float velocity) const;
    std::vector<Eigen::Vector3f> extractCorridorPoints(
        const pcl::PointCloud<pcl::PointXYZI>& cloud,
        const CorridorParams& corridor,
        const nav_msgs::Path& trajectory) const;

    // B-spline ground fitting
    float fitGroundProfile(
        const std::vector<Eigen::Vector3f>& corridor_points,
        std::vector<float>& along_track_distances,
        std::vector<float>& heights,
        std::vector<bool>& is_obstruction) const;

    // Trigger logic
    float nearest_obstruction_distance_;
    float stopping_distance_;
    bool shouldTriggerCAS() const;

    // State
    nav_msgs::Odometry latest_odom_;
    nav_msgs::Path latest_trajectory_;
    float current_velocity_;
};
```

**Stopping distance computation:**
```
d_stop = v * t_reaction + v^2 / (2 * a_brake)
```
Where:
- `t_reaction` = system reaction time (sensor latency + compute + actuation) -- conservatively 0.3s for reference airside AV stack
- `a_brake` = comfortable braking deceleration -- 2.0 m/s^2 for airport ground vehicle (conservative)
- At v = 5 m/s (18 km/h, typical apron speed): d_stop = 5*0.3 + 25/4 = 1.5 + 6.25 = 7.75m
- At v = 10 m/s (36 km/h): d_stop = 10*0.3 + 100/4 = 3.0 + 25.0 = 28.0m

**Corridor definition:**
- Width: vehicle width (2.127m from footprint in ground_filter.yaml: `[[3.7,-1.0635],[-1.0,-1.0635]]`) + 0.5m margin per side = 3.127m total
- Length: stopping distance (velocity-dependent)
- Along planned trajectory, not just straight ahead

**Ground fitting within corridor:**
- Project corridor points to (distance-along-trajectory, height) 2D space.
- Weighted least-squares B-spline fit to lowest points (ground surface).
- Points above the fitted surface by more than a threshold (0.2m) are classified as obstructions.
- Simpler alternative: binned minimum-height approach. Divide corridor into distance bins (0.5m), compute minimum height per bin (ground estimate), flag any bin with points significantly above its ground as obstructed.

**Industry Reality Check:**
- Zoox's GCA system (US11500385B2) is the primary inspiration. The patent describes: trajectory corridor computation, raw sensor point extraction within the corridor, ground surface estimation via curve fitting, and CAS trigger when the nearest obstruction is within stopping distance.
- Zoox's GCA operates on raw sensor data independently from the main perception stack. It uses a B-spline fit to establish the ground profile and classifies above-ground points as obstructions. The system has been in production since Zoox's public deployment.
- Nuro's safety architecture includes a similar geometric fallback layer that operates on raw LiDAR data.
- The key advantage of GCA is that it requires NO object classification. Any physical mass in the corridor triggers braking. This makes it robust to novel obstacle types (foreign object debris, dropped cargo, collapsed fencing) that the main perception pipeline might not recognize.
- Known limitation: GCA can be triggered by false positives (dust, rain). This is acceptable -- a false CAS trigger causes an unnecessary stop (safety-conservative), not a missed detection. The main perception pipeline handles nuanced filtering; GCA is the last-resort safety net.

**Revised Implementation Plan:**
1. Week 1: Implement `gca_node` with corridor computation and point extraction. Publish corridor visualization.
2. Week 2: Implement binned ground fitting (simpler than B-spline, adequate for flat/gently-sloped apron). Classify obstructions.
3. Week 3: Implement CAS trigger logic with stopping distance computation. Define the CAS trigger message type.
4. Week 4: Integration with vehicle controller. Requires coordination with the nav stack team to define the CAS trigger interface (likely a boolean override on the behavior planner's safety input).
5. Week 5-6: Testing, parameter tuning, false positive analysis.

**Estimated effort:** 5-6 weeks (slightly longer than original estimate due to controller integration complexity).

**Testing approach:**
- Simulation: replay bag files with injected obstacles at known positions, verify CAS trigger timing.
- Static test: place physical obstacles (traffic cones) at various distances, verify trigger at correct distance.
- Dynamic test: approach a stopped vehicle at controlled speed, verify trigger before minimum stopping distance.
- False positive test: operate in rain, fog, and near aircraft exhaust. Measure false CAS trigger rate. Target: <1 false trigger per hour of operation.

**Risk Assessment:**
- Risk: CAS trigger rate too high due to false positives (rain, exhaust). Mitigation: (1) Use the existing multi-return and LIOR filtering recommendations from Section 1 to clean the raw cloud before GCA processing. (2) Require N consecutive frames of obstruction before triggering (temporal consistency). N=2 at 10Hz adds only 100ms latency.
- Risk: CAS trigger conflicts with normal braking from the planner. Mitigation: CAS is an override -- it can only request harder braking than what the planner commands, never softer. Implement as a minimum-takes-all on the deceleration command.
- Risk: Stopping distance model is inaccurate for wet/icy surfaces. Mitigation: use conservative friction coefficient (0.3 for wet pavement) in the stopping distance model. This over-estimates stopping distance, which is safety-conservative.

---

## Recommendation #18: Sensor Health Monitoring and Degraded Mode Operation

### [Sensor Health Monitoring and Degraded Mode Operation]
**Original Priority:** Critical
**Revised Priority:** Critical -- confirmed
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The perception pipeline aggregates 5x RS32 LiDAR streams. The aggregator nodelet is the natural place to monitor individual sensor health, but the recommendation calls for an independent monitoring node.

**Current data flow (from perception.launch):**
```
5x RS32 topics -> pointcloud_aggregator -> pointcloud_preprocessor -> ground_filter -> ...
```

The aggregator subscribes to individual RS32 topics. The health monitor should subscribe to the SAME individual topics, independently.

**Input topics:** Individual RS32 point cloud topics. These are NOT listed in `perception.launch` (the aggregator config determines them). Need to check the aggregator config.

**Implementation:**

New standalone ROS node `sensor_health_monitor_node` (standalone for process isolation, same reasoning as GCA):

```
// sensor_health_monitor.h
struct SensorHealth {
    std::string sensor_name;
    enum Status { NOMINAL, DEGRADED, FAILED } status;
    int point_count;
    double timestamp_staleness_ms;
    float mean_intensity;
    float angular_coverage_percent;
    ros::Time last_valid_message;
};

class SensorHealthMonitor {
    // Subscribe to each RS32 topic independently
    std::vector<ros::Subscriber> sensor_subs_;
    std::vector<SensorHealth> sensor_health_;

    // Per-sensor callback
    void sensorCallback(const sensor_msgs::PointCloud2ConstPtr& cloud, int sensor_idx);

    // Health check (called at 1Hz timer)
    void healthCheckTimer(const ros::TimerEvent& event);

    // Publisher
    ros::Publisher health_pub_;  // diagnostic_msgs::DiagnosticArray
    ros::Publisher system_status_pub_;  // custom msg: NOMINAL/DEGRADED/MRC
};
```

**Health metrics per sensor (computed at 1Hz):**
1. **Point count:** RS32 produces ~32,000 points/revolution at 10Hz. Threshold: <5,000 = DEGRADED, <1,000 = FAILED.
2. **Timestamp freshness:** `staleness = ros::Time::now() - cloud.header.stamp`. Threshold: >200ms = DEGRADED, >500ms = FAILED.
3. **Mean intensity:** Baseline during calibration. Drop of >50% = DEGRADED (lens contamination).
4. **Angular coverage:** Bin points by azimuth angle. If >30% of expected angular bins are empty, sensor has partial blockage = DEGRADED.

**Integration with vehicle controller:**
- Publish on `/sensor_health/status` (diagnostic_msgs::DiagnosticArray -- standard ROS diagnostics format).
- Publish on `/sensor_health/system_status` (custom msg with enum: NOMINAL, DEGRADED, MRC).
- The behavior planner (`behavior_planner_nodelet.cpp` in `airside_nav`) should subscribe to `/sensor_health/system_status` and:
  - On DEGRADED: reduce max speed proportionally to remaining sensor coverage.
  - On MRC (Minimum Risk Condition): trigger controlled stop.

**Industry Reality Check:**
- Kodiak runs 1,000+ safety checks at 10Hz on their autonomous trucks. Sensor health monitoring is table stakes for production AV systems.
- Waymo's safety report describes per-sensor monitoring with automatic degraded mode transitions.
- The PHM Society published "Failure Mode Investigation to Enable LiDAR Health Monitoring for Automotive Application" (2023) documenting failure modes: transmitter degradation, receiver sensitivity loss, motor bearing wear (mechanical LiDARs), lens contamination, and cable faults.
- RoboSense RS32 specific consideration: this is a mechanical spinning LiDAR. Motor bearing wear and dust contamination are primary failure modes. Point count monitoring catches both.

**Revised Implementation Plan:**
1. Week 1: Implement health monitor node with point count and timestamp staleness checks.
2. Week 2: Add intensity monitoring and angular coverage analysis.
3. Week 3: Integration testing with simulated sensor failures (rate-limit individual sensor topics to simulate degradation, mute topics to simulate failure).
4. Week 4 (overlap with nav team): Add behavior planner subscription and degraded mode speed reduction.

**Estimated effort:** 2-3 weeks for the monitor node; +1 week for behavior planner integration.

**Testing approach:**
- Inject failures: use `rostopic bw` and `rosbag play --topics` to selectively degrade/mute individual sensors.
- Verify: correct transition to DEGRADED/FAILED status.
- Verify: behavior planner reduces speed on DEGRADED, stops on MRC.
- Stress test: run for 24 hours, verify no false health alarms on healthy sensors.

**Risk Assessment:**
- Risk: Threshold tuning -- too sensitive causes nuisance alerts, too loose misses real degradation. Mitigation: log all metrics for 1 week of normal operation to establish baselines before setting thresholds.
- Risk: Health monitor itself fails silently. Mitigation: implement heartbeat -- if health monitor stops publishing for >2 seconds, behavior planner treats this as MRC. Use ROS watchdog timer.

---

## Recommendation #19: Geometric Consistency Checks on Detections

### [Geometric Consistency Checks on Detections]
**Original Priority:** High
**Revised Priority:** High -- confirmed
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The Polygon Detector already performs significant validation:
- Cluster dimension filtering (polygon_detector_node.cpp config: `cluster_min_dim_*`, `cluster_max_dim_*`)
- Minimum polygon height filter (line 997: `if (polygon_height < min_bbox_height) continue;`)
- IoU-based overlap filtering (`filterOverlappingBoxes`, line 473)
- Velocity outlier rejection (line 125-127: `VELOCITY_OUTLIER_THRESHOLD = 2.0`)
- Refined track stability checks (`isRefined()`, `calculateSizeChangePercent()`)

**What is MISSING -- specific checks to add:**

1. **Ground plane consistency check:** After TF transform to `base_link` frame (tracked boxes are published in `bbox_target_frame: "base_link"`), verify that `box.z_min` is within 0.3m of the local ground height. The ground height is available from GroundGrid's `ground` layer -- but the polygon detector does NOT currently have access to the ground grid data.

   **Integration option A:** Polygon detector subscribes to `/ground_filter/grid_map` topic and looks up ground height at each detection's XY position. Grid_map_ros provides `grid_map::GridMapRosConverter::fromMessage()` for this.

   **Integration option B:** Add a post-detection validation nodelet that subscribes to both `/obstacle_detector/detected_objects` and `/ground_filter/grid_map`, performs consistency checks, and republishes validated detections.

   Option B is cleaner architecturally (separation of concerns).

2. **Class-specific dimension validation:** For ULD detections specifically (from `airside_uld_detection`), validate against known ULD standard sizes:
   - LD3: 1.56m x 1.53m x 1.63m
   - LD6: 3.18m x 1.53m x 1.63m
   - LD8: 2.44m x 1.53m x 1.63m
   This check belongs in the ULD detection nodelet, not in the generic polygon detector.

3. **Velocity feasibility check:** Already partially implemented via `MAX_VELOCITY_THRESHOLD: 15.0` (m/s = 54 km/h). For airport operations, tighten this:
   - Ground vehicles: max 30 km/h = 8.3 m/s
   - Aircraft taxi: max 50 km/h = 13.9 m/s
   - Any detection with velocity >15 m/s on an apron is physically implausible

   Currently configured correctly at 15.0 m/s (polygon_detector.yaml line 119). Could lower to 13.9 m/s for additional safety.

4. **Size jump rejection:** Already implemented via `refined_size_stability_threshold: 0.20` (20% max dimension change). This is a geometric consistency check on temporal size stability.

**Industry Reality Check:**
- Waymo's geometric consistency checks include: bottom-face ground proximity, dimension range validation per class, velocity kinematic feasibility, and temporal consistency. These are standard post-processing steps in production AV systems.
- The key insight is that these checks are cheap (O(1) per detection) and catch a disproportionate number of spurious detections -- typically 2-5% of raw detections in cluttered environments.

**Revised Implementation Plan:**
1. **Immediate (1 day):** Lower `max_velocity_threshold` from 15.0 to 14.0 m/s in `polygon_detector.yaml`.
2. **Week 1:** Create a `detection_validator` nodelet that subscribes to detected objects and ground grid. Implement ground plane consistency check (z_min within 0.3m of ground height).
3. **Week 2:** Add ULD dimension validation in `airside_uld_detection`. Add airport-specific dimension ranges.
4. **Testing:** Replay bag files, count detections filtered by each check. Target: filter >90% of known false positives without filtering any true positives.

**Estimated effort:** 1-2 weeks.

**Risk Assessment:**
- Risk: Ground plane consistency check rejects legitimate detections on ramps/slopes where ground height estimate is inaccurate. Mitigation: use a generous tolerance (0.3m) and do not apply check when ground confidence is low.
- Risk: Class-specific dimension checks are too strict for partially-occluded objects. Mitigation: apply minimum dimension check (reject tiny detections) but relax maximum dimension check for tracks with low visibility.

---

## Recommendation #20: Time-to-Collision (TTC) Computation

### [Time-to-Collision (TTC) Computation]
**Original Priority:** High
**Revised Priority:** High -- confirmed
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The Polygon Detector already has everything needed for TTC computation:

1. **Track position:** `box.position` (Eigen::Vector3f) -- centroid in `base_link` frame after TF transform.
2. **Track velocity:** `box.velocity` (Eigen::Vector3f, set by KalmanTracker) -- velocity in tracking frame.
3. **Ego velocity:** Available from `/odom/fused` odometry.

**Specific insertion point:**

In `polygon_detector_node.cpp`, the `publishDetectedObjects()` method (line ~312) iterates over tracked boxes to build the `DetectedObjectArray`. TTC should be computed HERE, after tracking and TF transform to base_link, and stored in the `DetectedObject` message.

Check if the `airside_perception_msgs/DetectedObject` message has a TTC field:

If not, the message definition needs to be extended:
```
# In airside_perception_msgs/msg/DetectedObject.msg
float64 time_to_collision   # seconds, -1.0 if not closing
```

**TTC computation (to add inside the detected object publishing loop):**
```cpp
// For each tracked box in base_link frame:
float d = box.position.norm();  // distance from ego to object center
// Relative velocity projected along line of sight
Eigen::Vector3f los_unit = box.position.normalized();
float v_ego_along_los = ego_velocity.dot(los_unit);  // ego closing rate
float v_obj_along_los = box.velocity.dot(los_unit);   // object closing rate
float closing_rate = v_ego_along_los - v_obj_along_los;  // positive = closing

float ttc = -1.0f;
if (closing_rate > 0.1f) {  // meaningful closing rate threshold
    ttc = d / closing_rate;
}
```

**Also useful:** nearest-point TTC (instead of centroid-based):
```cpp
// More conservative: use nearest polygon vertex instead of centroid
float d_nearest = std::numeric_limits<float>::max();
for (const auto& vertex : box.polygon_vertices) {
    float dist = std::sqrt(vertex.x() * vertex.x() + vertex.y() * vertex.y());
    d_nearest = std::min(d_nearest, dist);
}
```

**Where to publish TTC thresholds:**

The TTC threshold logic does NOT belong in the perception stack. It belongs in the behavior planner or a dedicated safety monitor. The perception stack should compute and publish TTC; the planner should react.

Publish a new topic `/obstacle_detector/ttc` with per-track TTC values. The behavior planner subscribes and applies thresholds:
- TTC < 3.0s: begin deceleration
- TTC < 1.5s: pre-stage braking
- TTC < 0.5s: emergency stop (CAS trigger)

**Industry Reality Check:**
- TTC is universal in production AV systems. Waymo, Zoox, and Mobileye all compute TTC.
- The challenge at 10Hz LiDAR rate is noisy velocity estimates causing noisy TTC. Key insight from web research: "Measurements are taken at 10 Hz, therefore small errors in the estimation of the difference of distance become relevant errors in the speed estimation and therefore in TTC estimation."
- the reference airside AV stack's Kalman-filtered velocity (4-state model: x, y, vx, vy) already smooths raw position differences. The Kalman velocity is suitable for TTC computation.
- Best practice: compute TTC using BOTH centroid distance (smooth but conservative) and nearest-point distance (responsive but noisier). Report the minimum.
- Radar-based TTC (Zoox, Aurora) uses direct Doppler velocity, which is instantaneous and not subject to multi-frame noise. Without radar, LiDAR-based TTC has inherently more latency -- one reason 4D radar (Recommendation #24) is valuable.

**Revised Implementation Plan:**
1. **Day 1-2:** Add TTC computation to polygon detector's publishing loop. Use centroid-based TTC with Kalman velocity.
2. **Day 3-4:** Extend `DetectedObject.msg` with `time_to_collision` field. Rebuild message package.
3. **Day 5:** Add nearest-point TTC variant. Publish minimum of centroid and nearest-point TTC.
4. **Week 2:** Add TTC topic and integrate with behavior planner for threshold-based responses.

**Estimated effort:** 1-2 weeks (confirmed original estimate).

**Testing approach:**
- Replay bag files with known closing scenarios. Compare computed TTC against ground truth (manually computed from position timeseries).
- Edge case: stationary objects with ego vehicle approaching. TTC should be purely based on ego velocity and distance.
- Edge case: parallel-moving objects (TTC should be -1 or very large).
- Validate TTC does not produce spurious low values due to velocity noise on stationary objects. The velocity stability checks (`enable_velocity_stability_check`, `velocity_stability_threshold: 2.0`) in the existing tracker help here.

**Risk Assessment:**
- Risk: Noisy TTC on stationary objects due to residual velocity estimation noise. Mitigation: only compute TTC when track velocity magnitude exceeds a minimum threshold (e.g., closing rate > 0.5 m/s) OR when the object is within 20m (close-range detections have more points, less velocity noise).
- Risk: TTC computed for wrong objects (e.g., objects behind the vehicle). Mitigation: only compute TTC for objects with x > 0 in base_link frame (forward hemisphere) AND closing rate > 0.

---

## Recommendation #21: Rule-Based Safety Validation of Planned Trajectories

### [Rule-Based Safety Validation of Planned Trajectories]
**Original Priority:** Medium
**Revised Priority:** Medium-High -- upgraded slightly because code review reveals NO independent safety layer between planner and controller
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

**Code Integration Points:**

This recommendation spans the perception-to-planning boundary. The validation node needs:

**Inputs:**
1. Planned trajectory from `local_planning_nodelet` (trajectory format TBD -- likely `nav_msgs::Path` or custom message from `airside_planning_msgs`).
2. Tracked objects from polygon detector: `/obstacle_detector/detected_objects_refined` (the refined, high-confidence detections).
3. Vehicle state from `/odom/fused`.
4. Drivable area boundary (static map or dynamic occupancy grid from Recommendation #14).

**The validation node should be a standalone node (process isolation for safety):**

```
class TrajectoryValidator {
    // Inputs
    ros::Subscriber trajectory_sub_;
    ros::Subscriber objects_sub_;
    ros::Subscriber odom_sub_;
    ros::Subscriber occupancy_sub_;

    // Output
    ros::Publisher validated_trajectory_pub_;
    ros::Publisher rejection_pub_;  // diagnostics: why rejected

    // Validation rules (priority-ordered)
    bool checkKinematicFeasibility(const Trajectory& traj) const;
    bool checkCollisionFree(const Trajectory& traj, const Objects& objects) const;
    bool checkDrivableArea(const Trajectory& traj, const OccupancyGrid& grid) const;
    bool checkMinSafeDistance(const Trajectory& traj, const Objects& objects) const;
    bool checkAircraftClearance(const Trajectory& traj, const Objects& objects) const;
};
```

**Collision checking approach:**

The recommendation mentions GJK/SAT for OBB-OBB collision detection. Given the reference airside AV stack's polygon-based tracking (convex hull polygons, not oriented bounding boxes), SAT on convex polygons is the natural choice:

1. Sample the trajectory at discrete time steps (dt = 0.1s).
2. At each time step, compute the ego vehicle's convex polygon (vehicle footprint transformed to the trajectory pose).
3. For each tracked object, compute its predicted convex polygon (current polygon + velocity * dt).
4. Run SAT between each pair of ego polygon and object polygon.

The ego vehicle footprint is already defined in `ground_filter.yaml`:
```yaml
vehicle_footprint: [[3.7,-1.0635],[-1.0,-1.0635],[-1.0,1.0635],[3.7,1.0635]]
```

**SAT for convex polygons (2D):**
For two convex polygons with N and M vertices, test N+M candidate separating axes (edge normals). If any axis separates the polygons, they do not intersect. This is O(N+M) per pair, and with ~20 tracked objects and ~50 trajectory samples, total is ~1000 SAT tests per planning cycle -- trivially real-time.

**Industry Reality Check:**
- Waymo's safety architecture includes geometric safety checks on all planned trajectories before execution. Their "Demonstrably Safe AI" framework requires provable collision freedom.
- Mobileye's RSS model provides formal safety distance constraints that act as trajectory validation rules.
- Motional's Rulebook framework provides a priority-ordered rule system where higher-priority rules (no collision) dominate lower-priority rules (minimize travel time).
- Intel's open-source `ad-rss-lib` (GitHub) implements RSS as a C++ library that can validate trajectories against formal safety constraints. This could potentially be integrated directly.
- The key challenge in practice is NOT the algorithm but the interface with the planner. The validator must be able to reject trajectories fast enough for the planner to replan within its cycle time.

**Revised Implementation Plan:**
1. **Week 1:** Identify the exact trajectory message type from `airside_nav`. Define the validation interface (input: trajectory, output: accept/reject + reason).
2. **Week 2:** Implement kinematic feasibility checks (acceleration, curvature limits) and collision-free check (SAT on convex polygons).
3. **Week 3:** Implement drivable area check (trajectory points must be in free cells of occupancy grid -- depends on Recommendation #14).
4. **Week 4:** Implement RSS-inspired minimum safe distance check using current tracked object velocities.
5. **Week 5-6:** Integration testing with the behavior planner. Handle rejection + replanning loop.

**Estimated effort:** 4-6 weeks (confirmed original estimate).

**Dependency:** This depends on the occupancy grid (Rec #14) for drivable area checking. Without it, the validator can still perform collision checks and kinematic feasibility checks.

**Testing approach:**
- Generate synthetic trajectories that violate each rule. Verify rejection.
- Replay bag files with the validator in the loop. Verify no valid trajectories are incorrectly rejected (false rejection rate should be 0% under normal operation).
- Edge cases: trajectories near static obstacles (poles, bollards), trajectories during vehicle turns (swept path), trajectories during ramp transitions.

**Risk Assessment:**
- Risk: Validator is too conservative, rejecting all trajectories in cluttered environments. Mitigation: tune collision margins carefully. Use the polygon inflation approach already in the polygon detector (configurable `polygon_inflation_distance`).
- Risk: Validator latency blocks the planning cycle. Mitigation: SAT is O(1ms) for typical scenarios. If latency is an issue, run validator asynchronously and apply validation to the PREVIOUS trajectory while the planner generates the NEXT one (pipelined validation).
- Risk: Trajectory format mismatch between planner output and validator input. Mitigation: resolve this in Week 1 by working with the nav team.

---

## Summary Table

| # | Recommendation | Original Priority | Revised Priority | Feasibility | Effort | Key Blocker |
|---|---------------|-------------------|-----------------|-------------|--------|-------------|
| 14 | Occupancy Grid (Free Space) | High | **Critical** | FEASIBLE | 2-3 weeks | None -- well-established algorithm |
| 15 | Negative Obstacle Detection | Medium | **High** | FEASIBLE WITH MODIFICATIONS | 3-4 weeks | Spiral interpolation must be modified to preserve drop-offs |
| 16 | Piecewise Planar Ground Fitting | Low | Low | FEASIBLE WITH MODIFICATIONS | 1 day (tuning) to 2-3 weeks (full CZM) | Low ROI -- GroundGrid already competitive |
| 17 | Geometric Collision Avoidance (GCA) | Critical | **Critical** | FEASIBLE | 5-6 weeks | Controller integration complexity |
| 18 | Sensor Health Monitoring | Critical | **Critical** | FEASIBLE | 2-3 weeks | Behavior planner integration (+1 week) |
| 19 | Geometric Consistency Checks | High | High | FEASIBLE | 1-2 weeks | Need ground grid access in polygon detector |
| 20 | Time-to-Collision (TTC) | High | High | FEASIBLE | 1-2 weeks | DetectedObject.msg extension needed |
| 21 | Rule-Based Trajectory Validation | Medium | **Medium-High** | FEASIBLE WITH MODIFICATIONS | 4-6 weeks | Depends on occupancy grid (#14) and planner interface |

## Recommended Implementation Order

1. **TTC computation (#20)** -- 1-2 weeks, no dependencies, immediate safety value
2. **Sensor Health Monitoring (#18)** -- 2-3 weeks, no dependencies, critical safety gap
3. **Geometric Consistency Checks (#19)** -- 1-2 weeks, no dependencies
4. **Occupancy Grid (#14)** -- 2-3 weeks, enables #21
5. **GCA System (#17)** -- 5-6 weeks, independent track, highest safety value
6. **Negative Obstacle Detection (#15)** -- 3-4 weeks, after GCA
7. **Trajectory Validation (#21)** -- 4-6 weeks, after #14
8. **Piecewise Ground Fitting (#16)** -- only if ramp issues persist after GroundGrid tuning

Total critical path: ~16 weeks to deploy all critical/high items (with parallelism between GCA and occupancy grid tracks).

---

## Industry Sources

- [GroundGrid: LiDAR Point Cloud Ground Segmentation and Terrain Estimation (IEEE RAL 2024)](https://ieeexplore.ieee.org/document/10319084/)
- [GroundGrid GitHub (DCMLR, Freie Universitat Berlin)](https://github.com/dcmlr/groundgrid)
- [Zoox Collision Avoidance Perception System (US11500385B2)](https://patents.google.com/patent/US11500385B2/en)
- [Mobileye RSS: Responsibility-Sensitive Safety](https://www.mobileye.com/technology/responsibility-sensitive-safety/)
- [Intel ad-rss-lib (open-source RSS implementation)](https://github.com/intel/ad-rss-lib)
- [Patchwork++: Fast and Robust Ground Segmentation (IROS 2022)](https://arxiv.org/pdf/2207.11919)
- [Patchwork: Concentric Zone-based Region-wise Ground Segmentation](https://arxiv.org/pdf/2108.05560)
- [Autoware Universe Probabilistic Occupancy Grid Map](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_probabilistic_occupancy_grid_map/pointcloud-based-occupancy-grid-map/)
- [ROS grid-mapping with Bresenham's Algorithm](https://github.com/lukovicaleksa/grid-mapping-in-ROS)
- [LiDAR-Based Negative Obstacle Detection for UGVs (Sensors 2024)](https://www.mdpi.com/1424-8220/24/24/7929)
- [Failure Mode Investigation to Enable LiDAR Health Monitoring (PHM Society 2023)](https://papers.phmsociety.org/index.php/phmconf/article/view/3526)
- [Drivable Space in Autonomous Driving -- The Industry](https://medium.com/@patrickllgc/drivable-space-in-autonomous-driving-the-industry-7a4624b94d41)
- [Kodiak Driver Technology Overview](https://kodiak.ai/technology)
- [Formal Methods to Comply with Rules of the Road in Autonomous Driving](https://www.sciencedirect.com/science/article/abs/pii/S0005109822005568)
