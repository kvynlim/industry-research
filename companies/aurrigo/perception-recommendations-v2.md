# Aurrigo Perception Stack: Non-ML Upgrade Recommendations -- V2

**Verified against Aurrigo source code and industry deployment evidence**
**Date: 2026-03-16**
**Revision: V2 (code-verified)**

---

## Change Summary: V1 to V2

This document is a comprehensive revision of the v1 recommendations, now verified against the actual Aurrigo perception source code. Every recommendation has been traced through the codebase to identify exact integration points, blockers, and realistic effort estimates.

### Recommendations Already Implemented (Downgraded or Killed)

| v1 # | Name | v1 Priority | v2 Status | Reason |
|-------|------|------------|-----------|--------|
| 10 | Track Lifecycle M-of-N | High | **ALREADY EXISTS** | `TrackState` enum with TENTATIVE/CONFIRMED/LOST and `min_hits_to_confirm=3` already in `kalman_tracker.cpp` |
| 11 | Mahalanobis Distance Gating | High | **ALREADY EXISTS** | `mahalanobisDistance()` method at line 302-324, chi-squared gate at 9.21, used in `associationCost()` |
| 12 | Multi-Stage Data Association | Medium | **ALREADY EXISTS** | `cascadeMatch()` at line 693-782 implements two-pass confirmed-first matching with Hungarian |

### Recommendations Upgraded in Priority

| v1 # | Name | v1 Priority | v2 Priority | Reason |
|-------|------|------------|-------------|--------|
| 5 | Intensity Calibration | Medium | **High** | Discovered to be a hard prerequisite for DSOR (#2), LIOR (#3), weather estimation (#29), and marking detection (#25) |
| 14 | Occupancy Grid | High | **Critical** | Code review revealed the current "occupancy grid" is NOT a real occupancy grid -- it is a point-count grid with no ray-casting, no free space estimation |
| 15 | Negative Obstacle Detection | Medium | **High** | Airport ramp edges are a real operational hazard; spiral interpolation actively masks drop-offs |
| 21 | Trajectory Validation | Medium | **Medium-High** | No independent safety layer exists between planner and controller |
| 25 | Reflectivity Markings | High | **Medium** | Depends on intensity calibration prerequisite; not safety-critical |
| 26 | L-Shape Fitting | Medium | **Medium-High** | Directly addresses known PCA limitation for partial observations |
| 29 | Track Re-Identification | Medium | **High** | Genuine gap -- tracks are permanently deleted after 0.6s occlusion with no dormant state |
| 30 (Sec 5) | Jet Blast Zone Modeling | Medium | **High** | Airport-specific safety hazard with direct regulatory implications for NUIC |
| 31 | Sensor Staleness | Medium | **High** | Aggregator has basic binary staleness but no motion compensation, no health publishing, no degraded mode |
| 35 | ISO 26262/SOTIF Alignment | Low | **High** | Prerequisite for NUIC certification pathway; IAG framework requires documented safety case |

### Recommendations Downgraded in Priority

| v1 # | Name | v1 Priority | v2 Priority | Reason |
|-------|------|------------|-------------|--------|
| 9 | IMM Filter | Critical | **High** | Existing 4-state CV Kalman with velocity measurement already handles low-speed airport domain; cascade matching and velocity deque filtering are more sophisticated than assumed |
| 23 | Acoustic Detection | Medium | **Low** | Airport apron ambient noise (80-95 dB) is fundamentally hostile; no existing training data; ROI is marginal given LiDAR+thermal coverage |
| 28 | JPDA | High | **Medium** | Current Hungarian + cascade + Mahalanobis is already robust; JPDA adds O(2^N) complexity for marginal improvement in well-separated airport objects |

### New Recommendations Added

| # | Name | Priority | Reason |
|---|------|----------|--------|
| NEW | ULD Yaw Wrapping Bug Fix | **Critical (Bug)** | Arithmetic mean of angles breaks at +/-180 deg boundary in UldDetection.cpp lines 414-430 and 654-658 |
| NEW | Rain Detection Orphan Fix | **Critical (Bug)** | `rain_state` topic published but consumed by NOTHING; 0.2 Hz polling architecture is fragile |
| NEW | Formal Verification of State Machines | Medium | UldStateMachine and BehaviorPlanner FSMs are small enough for exhaustive model checking |
| 32 | RSS Safety Distance Model | High | Elevated to near-Critical for NUIC pathway; Intel `ad-rss-lib` is open-source and directly integrable |
| 33 | Temporal Logic (STL) Safety Specs | Medium | Critical dependency for NUIC; `rtamt4ros` provides ready-made runtime monitoring |

### Key Blockers Discovered

1. **Point type pipeline bottleneck**: rslidar_sdk publishes `XYZIRT` (with ring and timestamp), but the preprocessor converts to `pcl::PointXYZI`, losing ring, timestamp, AND any future return-type field. Multi-return processing (#1) requires either a custom point type or a pre-preprocessor filter stage.

2. **PolygonDetector drops intensity**: `polygon_detector_node.cpp` line 833 converts to `pcl::PointXYZ`, losing intensity. Reflectivity-based marking detection (#25) must tap the pipeline before this point.

3. **GroundGrid spiral interpolation masks negative obstacles**: The spiral interpolation actively fills unknown cells with interpolated ground heights, defeating negative obstacle detection. Must be modified to skip flagged cells.

4. **Network bandwidth for dual-return**: 5 sensors in dual-return mode = ~582 Mbps. If vehicle uses 100 Mbps switches, this is a hard blocker for recommendation #1.

### Key Code-Level Findings

- **ULD detector uses moving average, not EKF**: v1 assumed a 3-state EKF. The actual code uses `std::deque` moving averages for position and yaw smoothing. This makes UKF (#13) even more impactful than expected.
- **Rain detection is an orphan node**: Publishes `rain_state` as `Float32` on a topic that nothing subscribes to. Uses `waitForMessage` polling at 0.2 Hz. Not a nodelet (misses zero-copy pipeline).
- **Existing intensity filter is dormant**: Per-region `enable_intensity_filter` exists in the preprocessor but no region config activates it. Min/max intensity defaults (0, 255) make it a no-op.
- **The "occupancy grid" is not an occupancy grid**: `toOccupancyGrid(*map_ptr_, "points", ...)` converts raw point counts to occupancy values. No ray-casting, no free space, no log-odds.

---

## Recommendations (Renumbered by Priority)

---

### [PRIORITY: Critical] -- #1 Geometric Collision Avoidance (GCA) System
**Source:** Zoox (US11500385B2), Nuro
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed Critical -- the single highest-impact safety improvement

**What it is:** An architecturally independent safety layer that operates on raw LiDAR returns, defines a trajectory corridor, fits a ground profile, and triggers emergency braking when any obstruction is detected within the stopping distance. Requires NO object classification.

**Current Aurrigo State:** No independent safety backup exists. If the main perception pipeline misses an object (segmentation bug, parameter misconfiguration, novel obstacle type), there is no fallback. The SafetyMonitor in `safety_monitor.cpp` only checks remote e-stop and system health -- no perception-based safety check.

**Code Integration Points:**
- Input: `/pointcloud_aggregator/output` (same as `ground_filter` subscribes to, `GroundGridNodelet.cpp` line 93)
- Input: `/odom/fused` (same as ground_filter, line 92)
- Input: Planned trajectory from `local_planning_nodelet`
- Output: CAS trigger to `StopArbiter` priority chain
- Vehicle footprint defined in `ground_filter.yaml`: `[[3.7,-1.0635],[-1.0,-1.0635],[-1.0,1.0635],[3.7,1.0635]]`
- Must be a standalone ROS node (NOT nodelet) for process isolation from the perception nodelet manager
- At v=5 m/s: d_stop = 5*0.3 + 25/4 = 7.75m; at v=10 m/s: d_stop = 28.0m

**Industry Validation:**
- Zoox's GCA system (US11500385B2) has been in production since public deployment: trajectory corridor computation, raw sensor point extraction, B-spline ground fitting, CAS trigger
- Nuro's safety architecture includes a similar geometric fallback layer
- Key advantage: any physical mass in the corridor triggers braking -- robust to novel obstacle types (FOD, dropped cargo, collapsed fencing)
- Known limitation: false positives from rain/exhaust cause unnecessary stops (safety-conservative, not dangerous)

**Implementation Plan:**
1. Week 1: Implement `gca_node` with corridor computation and point extraction. Publish corridor visualization.
2. Week 2: Implement binned ground fitting (divide corridor into 0.5m distance bins, compute minimum height per bin). Classify obstructions as points significantly above ground.
3. Week 3: Implement CAS trigger logic with stopping distance model. Define CAS trigger message type.
4. Week 4: Integration with vehicle controller via `StopArbiter` priority chain (minimum-takes-all on deceleration command).
5. Week 5-6: Testing and parameter tuning. False positive analysis. Target: <1 false trigger per hour.

**Value Added:** Formally verifiable safety guarantee independent of the main perception stack. Catches objects the main pipeline misses.
**Effort:** 5-6 weeks (1 engineer)
**Risk:** False CAS triggers from rain/exhaust (mitigated by N-consecutive-frame requirement, N=2 at 10Hz adds only 100ms latency). Stopping distance model inaccuracy on wet surfaces (mitigated by conservative friction coefficient 0.3).

---

### [PRIORITY: Critical] -- #2 Sensor Health Monitoring and Degraded Mode Operation
**Source:** Waymo, Kodiak (1000+ safety checks at 10Hz), Nuro
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed Critical

**What it is:** Continuous per-sensor health monitoring (point count, timestamp freshness, mean intensity, angular coverage) with automatic transition to degraded-mode operation when sensors are compromised.

**Current Aurrigo State:** No systematic sensor health monitoring in the perception stack. The Aggregator tracks some per-sensor statistics (`cloud_age_sum`, `cloud_stale_count`) but only logs them every 30 seconds -- nothing publishes health status to other nodes. No degraded mode behavior exists.

**Code Integration Points:**
- New standalone ROS node `sensor_health_monitor_node` (process isolation)
- Subscribes to the same individual RS32 topics as the Aggregator (configured via `cloud_in` parameter array)
- Publishes `/sensor_health/status` as `diagnostic_msgs::DiagnosticArray`
- Publishes `/sensor_health/system_status` with enum: NOMINAL, DEGRADED, MRC
- Behavior planner subscribes: DEGRADED -> reduce max speed; MRC -> controlled stop
- Health thresholds: <5,000 pts = DEGRADED, <1,000 = FAILED; staleness >200ms = DEGRADED, >500ms = FAILED; intensity drop >50% = DEGRADED (lens contamination)

**Industry Validation:**
- Kodiak runs 1,000+ safety checks at 10Hz on their autonomous trucks
- Waymo's safety report describes per-sensor monitoring with automatic degraded mode transitions
- PHM Society (2023) documented RS32-relevant failure modes: motor bearing wear, lens contamination, cable faults
- RoboSense RS32 is a mechanical spinning LiDAR; motor bearing wear and dust contamination are primary failure modes caught by point count monitoring

**Implementation Plan:**
1. Week 1: Implement health monitor node with point count and timestamp staleness checks.
2. Week 2: Add intensity monitoring and angular coverage analysis (bin points by azimuth, flag >30% empty bins as partial blockage).
3. Week 3: Integration testing with simulated sensor failures (rate-limit/mute individual topics).
4. Week 4: Behavior planner subscription and degraded mode speed reduction.

**Value Added:** Prevents operating with unknowingly degraded perception. Critical for safety case and NUIC regulatory compliance.
**Effort:** 2-3 weeks for monitor node; +1 week for behavior planner integration
**Risk:** Threshold tuning -- too sensitive causes nuisance alerts, too loose misses real degradation. Mitigated by 1-week baseline logging before setting thresholds. Health monitor heartbeat ensures silent failure triggers MRC.

---

### [PRIORITY: Critical] -- #3 Occupancy Grid for Free Space Estimation
**Source:** Waymo, Aurora, Motional, Nuro
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Upgraded from High to Critical -- the current "occupancy grid" is NOT a real occupancy grid

**What it is:** A 2D log-odds grid where each cell stores occupancy probability, updated via Bresenham ray-casting. Every LiDAR beam passing through a cell provides free-space evidence; every return in a cell provides occupied evidence.

**Current Aurrigo State:** The system publishes `nav_msgs::OccupancyGrid` on `obstacle_grid` from `GroundGridNodelet.cpp` line 432: `grid_map::GridMapRosConverter::toOccupancyGrid(*map_ptr_, "points", 0, 1, occupancy_grid)`. This converts raw point counts to occupancy values. A cell with zero points could be free space OR occluded/unobserved -- there is no distinction. This is fundamentally flawed for path planning.

**Code Integration Points:**
- Option B (recommended): New `OccupancyGridNodelet` in the shared `perception_nodelet_manager`
- Subscribes to `/pointcloud_aggregator/output` and `/odom/fused`
- New `std::vector<float> log_odds_` flat array at 0.25m resolution, 100m x 100m = 160,000 cells
- Bresenham ray-cast from sensor origin through each point: cells along ray get `log_odds -= l_free` (0.4); hit cell gets `log_odds += l_occ` (0.85); clamp to [-5, +5]
- Publish `nav_msgs::OccupancyGrid` on `/occupancy_grid/free_space` at 10Hz
- Grid follows ego vehicle (same move semantics as GroundGrid)
- Performance: 50,000 pts * ~50 cells/ray = 2.5M cell updates/frame, ~2.5ms on single core

**Industry Validation:**
- Log-odds occupancy grids are the most battle-tested representation in robotics (Elfes 1989, Thrun 2005)
- Autoware Universe has open-source `probabilistic_occupancy_grid_map` package with Bresenham ray-casting -- reference implementation
- Every major AV stack uses occupancy grids for free-space reasoning

**Implementation Plan:**
1. Create `aurrigo_occupancy_grid` package with `OccupancyGridNodelet`.
2. Implement 2D log-odds grid with Bresenham ray-casting.
3. Subscribe to aggregated cloud and odometry, transform points, ray-cast from sensor origin.
4. Publish at 10Hz. Add to `perception.launch`.
5. Unit test with synthetic point clouds; integration test with bag file replay in RViz.

**Value Added:** Unified, sensor-agnostic free-space representation. Detects arbitrary obstacles that may not match any predefined class. Essential for safe path planning.
**Effort:** 2-3 weeks
**Risk:** Multi-sensor aggregated cloud has single origin (acceptable for 5 sensors on small vehicle; extend to per-sensor ray-casting later). Moving objects create shadow trails (mitigated by temporal decay).

---

### [PRIORITY: Critical] -- #4 Online Extrinsic Calibration Monitoring
**Source:** Zoox (CLAMS), Aurora, Kodiak, Motional, Nuro
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Critical

**What it is:** Continuous ICP-based monitoring of relative alignment between the 5 LiDAR sensors. Detects calibration drift from thermal expansion, vibration, mechanical shock, and cargo loading without requiring return to calibration bay.

**Current Aurrigo State:** The Aggregator stores per-sensor clouds in `std::vector<sensor_msgs::PointCloud2> clouds_` (line 42, header) and transforms to `target_frame_` using `tf2_ros::Buffer` (lines 132-143). It tracks per-cloud staleness statistics but has NO calibration monitoring. If a LiDAR mount shifts, the system operates with degraded registration until next manual recalibration. A 1-degree yaw drift causes 1.7m lateral error at 100m.

**Code Integration Points:**
- New class `CalibrationMonitor` as separate nodelet (not inside Aggregator)
- Subscribes to same 5 LiDAR topics as Aggregator
- For each overlapping LiDAR pair (determined from static TF at startup), crops to overlap region using `pcl::CropBox`
- Runs `pcl::IterativeClosestPointWithNormals` at 1Hz on cropped overlap regions
- Publishes registration error (translation norm, rotation angle) as `aurrigo_perception_msgs::CalibrationHealth`
- Parameters: `translation_warn_threshold_m: 0.02`, `rotation_warn_threshold_deg: 0.1`, `icp_max_iterations: 50`
- 5C2=10 ICP pairs at 1Hz: <50ms each on downsampled overlap = <500ms/s = 50% of one core

**Industry Validation:**
- Zoox CLAMS system monitors LiDAR-to-LiDAR registration drift
- Industry consensus: monitoring is safe and recommended; automatic correction is risky (ICP can converge to local minimum on degenerate geometry)
- Kodiak approach: post-shift calibration analysis (offline)

**Implementation Plan:**
1. Create `aurrigo_calibration_monitor` package with nodelet (1 week)
2. Implement overlap region detection from TF tree (2 days)
3. Implement ICP-based monitoring at 1Hz (3 days)
4. Add diagnostic publishing and alerting (2 days)
5. Test with intentionally perturbed calibration on bags (3 days)

**Value Added:** Prevents insidious degradation of multi-LiDAR fusion accuracy.
**Effort:** 3 weeks
**Risk:** ICP false alarms from degenerate geometry (mitigated by eigenvalue check on covariance). Operators ignoring alerts (mitigated by vehicle health dashboard integration).

---

### [PRIORITY: Critical] -- #5 LiDAR Multi-Return Processing for Adverse Weather
**Source:** Waymo, Zoox (Hesai AT128), Kodiak (Luminar Iris, Hesai OT128), Aurora (FirstLight)
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Critical, with prerequisite discovery

**What it is:** Processing multiple return echoes per laser pulse to distinguish weather artifacts (rain, fog, jet exhaust, spray) from solid objects.

**Current Aurrigo State:** The RS32 decoder (`decoder_RS32.hpp`) already handles dual-return mode via `DualReturnBlockIterator`. Return mode byte 0x00=dual, 0x01=strongest, 0x02=last. Auto-detects from DIFOP packets. However, the driver publishes `XYZIRT` (no return-type field) and the preprocessor converts to `pcl::PointXYZI` (losing ring and timestamp). All returns are treated uniformly.

**Code Integration Points:**
- **Blocker #1**: Point type `XYZIRT` has no return-type field. Options: change `CMakeLists.txt` line 8 to `set(POINT_TYPE XYZIRTF)` (adds `uint8_t feature` field), or publish two separate topics per sensor.
- **Blocker #2**: Preprocessor converts to `pcl::PointXYZI` at line 422, discarding ring, timestamp, and return-type. Dual-return filter must operate BEFORE this conversion.
- Recommended insertion: new `DualReturnFilterNodelet` between Aggregator and Preprocessor
- At 5 sensors dual-return = ~582 Mbps total bandwidth. Must verify Gigabit Ethernet capacity.
- `/home/kvyn/ubuntu_20-04/z-aurrigo-ws/src/rslidar_sdk/src/rs_driver/src/rs_driver/driver/decoder/decoder_RS32.hpp` lines 185-229

**Industry Validation:**
- Hesai IPE in AT128/OT128 filters >99.9% environmental noise using dual-return; deployed at scale in Zoox and Kodiak
- RS32 dual-return doubles data rate (116.4 Mbps/sensor); 100 Mbps switches are a hard blocker if present
- Dual-return does NOT help with dense fog (both returns hit fog wall) or extreme rain (>40mm/h)
- Survey on LiDAR Perception in Adverse Weather (arXiv:2304.06312) confirms multi-return as primary defense

**Implementation Plan:**
1. Week 1: Enable dual-return on one RS32 via RSView. Verify bandwidth. Record baseline bags.
2. Week 1-2: Modify rslidar_sdk to publish return type (Option A: change to XYZIRTF; Option B: two separate topics).
3. Week 2-3: Create `DualReturnFilterNodelet`: group points by ring+azimuth, compute range divergence and intensity ratio, remove weather noise.
4. Week 3-4: Integrate with rain detection for weather severity metric.
5. Testing: Record bags in rain at airport. Compare false positive rates.

**Value Added:** Prevents false obstacle detections from jet exhaust, rain spray, fog.
**Effort:** 3-4 weeks
**Risk:** Network bandwidth saturation at 582 Mbps (mitigate: verify hardware, or enable dual-return on front sensors only). Computational overhead from 2x points (mitigate: dual-return filter reduces total points before SOR). Point type change breaks consumers (mitigate: `pcl::fromROSMsg` to `PointXYZI` ignores unknown fields).

---

### [PRIORITY: Critical (Bug Fix)] -- #6 ULD Yaw Angle Wrapping Bug
**Source:** Code review finding
**Feasibility:** FEASIBLE (trivial fix)
**v1 to v2 Change:** NEW -- bug discovered during code verification

**What it is:** The ULD detector computes yaw angle by arithmetic mean of a `std::deque<double> yaw_history_`. This breaks at angle wrapping boundaries: averaging -179 deg and +179 deg gives 0 deg instead of the correct 180 deg.

**Current Aurrigo State:** `UldDetection.cpp` lines 414-430 and 654-658 compute a simple arithmetic mean of angles without wrapping correction. This causes incorrect ULD orientation estimation whenever the detected yaw crosses the +/-180 degree boundary, which can occur during vehicle approach from certain angles.

**Code Integration Points:**
- File: `/home/kvyn/ubuntu_20-04/z-aurrigo-ws/src/aurrigo_perception/aurrigo_uld_detection/src/UldDetection.cpp`
- Lines 414-430: yaw moving average in `publishPoseAndVisualization()`
- Lines 654-658: yaw moving average in `cloudUldOnVehicleCallback()`
- Fix: replace arithmetic mean with circular mean using `atan2(sum(sin(theta_i)), sum(cos(theta_i)))`

**Industry Validation:**
- Circular mean is the standard approach for averaging angular data. This is a textbook fix.

**Implementation Plan:**
1. Replace arithmetic yaw average with circular mean at both locations (1 hour)
2. Add unit test for wrapping boundary case (1 hour)
3. Verify with bag file replay containing ULD approach near wrapping boundary

**Value Added:** Prevents incorrect ULD orientation during docking from certain approach angles.
**Effort:** 1 day
**Risk:** None. The fix is strictly correct and backward-compatible.

---

### [PRIORITY: Critical (Bug Fix)] -- #7 Rain Detection Orphan Node Fix
**Source:** Code review finding
**Feasibility:** FEASIBLE
**v1 to v2 Change:** NEW -- discovered during code verification

**What it is:** The rain detection node publishes `rain_state` (0=NO_RAIN through 4=MONSOON_RAIN) on `~rain_state` topic as `std_msgs::Float32`. Nothing in the entire codebase subscribes to this topic. Additionally, the node uses `ros::topic::waitForMessage()` polling at 0.2 Hz (every 5 seconds) instead of callbacks, and it is a standalone node (not nodelet), missing zero-copy benefits.

**Current Aurrigo State:**
- File: `/home/kvyn/ubuntu_20-04/z-aurrigo-ws/src/aurrigo_perception/aurrigo_rain_detection/src/RainDetection.cpp`
- Lines 168-214: `calculateRainMetrics()` publishes rain state that no node consumes
- Timer rate: 0.2 Hz -- too slow for rapid weather changes (e.g., driving through exhaust plume)
- Measurement volume: fixed 1m^3 cube at [6.5,7.5] x [-0.5,0.5] x [2.0,3.0] -- captures very few points

**Code Integration Points:**
- Current node at `aurrigo_rain_detection` package
- Config at `rain_detection.yaml`
- Should be refactored into nodelet with callback-based subscription
- Output should be consumed by preprocessor to adapt SOR parameters
- Output should be consumed by planner to reduce speed in adverse weather

**Industry Validation:**
- Every production AV stack with weather awareness has a closed-loop: weather detection -> parameter adaptation -> speed reduction. Aurrigo has the detection but no loop closure.

**Implementation Plan:**
1. Day 1: Wire rain_state subscriber into preprocessor or planner as a quick fix (even without refactoring the node itself)
2. Week 1: Refactor into nodelet with callback-based cloud subscription; expand measurement volume from 1m^3 to full front-near region
3. Week 2: Implement adaptive SOR parameter scaling based on weather state (fold into recommendation #29)

**Value Added:** Closes the detection-to-action loop for weather adaptation. The data is already being computed but wasted.
**Effort:** 1-2 days for quick wire-up; 1-2 weeks for full refactor (combined with #29)
**Risk:** None for the quick wire-up. The rain state is already being published; consuming it is zero risk.

---

### [PRIORITY: High] -- #8 Intensity Calibration and Range Normalization
**Source:** Waymo, Zoox, Kodiak, Nuro
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Upgraded from Medium to High -- discovered to be a hard prerequisite for DSOR (#9), LIOR (#10), weather estimation (#29), and marking detection (#25)

**What it is:** Range-squared normalization of raw LiDAR intensity to produce range-independent reflectivity values.

**Current Aurrigo State:** The preprocessor has an existing intensity filter infrastructure (`applyIntensityFilter()` at lines 697-733 of `PointcloudPreprocessor.cpp`) but it is dormant -- no region config activates it. Raw RS32 intensity is `uint8_t` (0-255), stored as `float` in `pcl::PointXYZI`. No range normalization exists.

**Code Integration Points:**
- File: `/home/kvyn/ubuntu_20-04/z-aurrigo-ws/src/aurrigo_perception/aurrigo_pointcloud_preprocessor/src/PointcloudPreprocessor.cpp`
- Lines 418-462: `applyConversionAndTransformation()` -- insert range normalization after PCL conversion at line 422
- File: `PointcloudPreprocessor.h` -- add `enable_intensity_calibration_` and `intensity_range_ref_` members
- File: `pointcloud_preprocessor.yaml` -- add `enable_intensity_calibration: true`, `intensity_range_ref: 10.0`
- After normalization, a point at 50m with raw intensity 100 becomes 2500 -- all downstream intensity thresholds must be re-tuned

**Industry Validation:**
- Standard practice: range-squared normalization grounded in LiDAR equation; used by virtually all surveying LiDAR systems
- "Reflectivity Is All You Need!" (arXiv:2403.13188, 2024): 4% mIoU improvement in semantic segmentation with calibrated vs raw intensity
- Waymo, Zoox, Kodiak all perform intensity calibration

**Implementation Plan:**
1. Day 1: Add parameters and implement range-squared normalization in `applyConversionAndTransformation()`.
2. Day 2: Re-tune ALL intensity-dependent parameters (rain detection SOR `std_dev: 0.2`, future LIOR thresholds, existing `min_intensity`/`max_intensity`).
3. Day 3: Record test bags with/without calibration. Compare intensity histograms at 5m, 15m, 30m.
4. Day 4-5: Document per-sensor calibration procedure for future Level 2 calibration.

**Value Added:** Enables DSOR, LIOR, weather estimation, and marking detection. All intensity-based features depend on this.
**Effort:** 1 week
**Risk:** Low for the normalization itself. Medium for downstream impact -- changing the intensity value range affects rain detection thresholds and all future intensity-dependent logic. Recommendation: implement FIRST, before DSOR and LIOR.

---

### [PRIORITY: High] -- #9 Dynamic Statistical Outlier Removal (DSOR)
**Source:** Zoox, DSOR paper (arXiv:2109.07078)
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed High

**What it is:** Range-adaptive SOR that relaxes the outlier threshold proportionally with range, compensating for the natural 1/r^2 point density decrease.

**Current Aurrigo State:** Custom nanoflann-based SOR at `PointcloudPreprocessor.cpp` lines 761-862. Line 833: `const double threshold = global_mean + std_dev_mul_thresh * global_stddev;` -- this is the exact line to make range-adaptive. The per-point KNN loop already computes `mean_distances[i]` and point range is trivially available.

**Code Integration Points:**
- File: `PointcloudPreprocessor.cpp` line 833: replace fixed threshold with per-point range-adaptive threshold
- File: `PointcloudPreprocessor.h` lines 62-63: add `bool enable_dsor` and `double dsor_range_scale` to `CropBoxConfig`
- File: `pointcloud_preprocessor.yaml`: add per-region `dsor_range_scale: 0.5`, `dsor_max_range: 30.0`
- Code change: ~15 lines (add range computation and per-point threshold scaling in the existing filter loop)

**Industry Validation:**
- DSOR paper (2021): 28% faster than state-of-art snow de-noising with higher recall
- IDSOR (arXiv:2602.05876, 2025): adds intensity-awareness, outperforms both DSOR and DROR on real data
- Production deployment evidence: Waymo, Zoox, and Hesai IPE all use range-adaptive filtering internally

**Implementation Plan:**
1. Day 1-2: Add `dsor_range_scale` and `dsor_max_range` parameters to `CropBoxConfig` and `loadParameters()`.
2. Day 2-3: Modify `applyStatisticalOutlierRemoval()` to compute per-point range-adaptive thresholds.
3. Day 3-4: Tune parameters per region (front_near: 0.3, front_mid: 0.5, front_far: 0.8).
4. Day 5: Record test bags. Compare point counts at 20m, 40m, 60m. Verify distant objects retained.

**Value Added:** Retains valid sparse points at long range (e.g., aircraft 80m away producing only 15 points) while filtering noise at close range.
**Effort:** 3-5 days
**Risk:** Very low. Backward-compatible (dsor_range_scale=0.0 gives identical behavior). Adds one `sqrt()` per point per SOR level (<0.1ms overhead).

---

### [PRIORITY: High] -- #10 Low-Intensity Outlier Removal (LIOR)
**Source:** Zoox, DVIOR (Electronics 14(18):3662, 2025)
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed High, with significant finding about existing dormant infrastructure

**What it is:** Range-normalized intensity thresholding to remove low-intensity noise from atmospheric particles, jet exhaust, and heat shimmer.

**Current Aurrigo State:** `applyIntensityFilter()` exists at lines 697-733 but uses simple min/max thresholding without range normalization. No region activates it. The infrastructure is present but dormant.

**Code Integration Points:**
- File: `PointcloudPreprocessor.cpp` lines 697-733: extend `applyIntensityFilter()` with range normalization
- New parameters per region: `enable_lior: true`, `lior_range_ref: 10.0`, `lior_min_corrected_intensity: 5.0`
- Option B (preferred): combine with DSOR as IDSOR -- joint distance+intensity threshold in SOR
- LIOR should run AFTER ground filtering to avoid removing wet ground points, or use a conservative threshold

**Industry Validation:**
- LIOR documented in Zoox patent portfolio; DVIOR (2025) reports F1 > 90% combined with distance methods
- DOT research at Denver International Airport confirms exhaust plumes produce measurable LiDAR backscatter with characteristically low intensity
- Known failure mode: dark-clothed personnel have genuinely low reflectivity. Mitigated by cluster-size guard (don't remove low-intensity points forming clusters > N points)

**Implementation Plan:**
1. Day 1: Add range normalization to `applyIntensityFilter()` with feature flag.
2. Day 2: Add spatial clustering guard (only remove low-intensity points NOT part of dense cluster).
3. Day 3: Tune thresholds using recorded bags (clear weather, jet exhaust, rain, dark-clothed personnel).
4. Day 4-5: Integrate with weather-adaptive parameters.

**Value Added:** Directly addresses jet exhaust and heat shimmer false positives unique to airport operations.
**Effort:** 1 week
**Risk:** Medium -- false removal of dark/low-reflectivity objects. Mitigated by conservative thresholds + cluster-size guard. Dependency: intensity calibration (#8) makes LIOR significantly more reliable.

---

### [PRIORITY: High] -- #11 Sensor Staleness Detection Enhancement
**Source:** Zoox (arXiv:2506.05780)
**Feasibility:** FEASIBLE (partially already implemented)
**v1 to v2 Change:** Upgraded from Medium to High -- existing implementation has critical gaps

**What it is:** Three-tier staleness handling (use normally / use with ego-motion compensation / discard) with health publishing and degraded mode operation.

**Current Aurrigo State:** The Aggregator has basic binary staleness at `PointcloudAggregator.hpp` line 23: `static constexpr double STALE_THRESHOLD = 0.2;` and lines 116-123 of the cpp file. Binary: either use data as-is or skip entirely. No ego-motion compensation for mildly stale data. No health publishing (staleness only logged, not available to other nodes). No degraded mode behavior.

**Code Integration Points:**
- File: `PointcloudAggregator.hpp` -- replace hardcoded `STALE_THRESHOLD` with configurable two-tier thresholds
- File: `PointcloudAggregator.cpp` lines 116-123 -- add three-tier logic with motion compensation using `tf_buffer_->lookupTransform()` between timestamps
- Add `diagnostic_msgs::DiagnosticArray` publisher for per-sensor health
- Add degraded mode: 5/5 healthy -> full speed; 3/5 -> WARNING + 50% speed; 2/5 -> STOP

**Industry Validation:**
- Zoox published sensor staleness framework (June 2025): per-point timestamp offsets, two-tier strategy, significant improvement in trajectory prediction
- Universal need: every multi-sensor AV system needs staleness handling

**Implementation Plan:**
1. Day 1-2: Make thresholds configurable. Add two-tier logic (50ms / 200ms).
2. Day 2-3: Implement ego-motion compensation for mildly stale clouds via TF lookupTransform.
3. Day 3-4: Add `diagnostic_msgs::DiagnosticArray` publisher for per-sensor health.
4. Day 4-5: Add staleness statistics to existing 30-second diagnostic printout.
5. Week 2: Integrate degraded mode into `SafetyMonitor` as new `checkSensorAvailability()` check.

**Value Added:** Prevents spatial misalignment from stale data. Provides early warning of sensor issues. Enables graceful degradation.
**Effort:** 1.5-2 weeks
**Risk:** Low. Existing binary skip preserved for high threshold. Motion compensation is additive with graceful fallback. TF dependency is already established infrastructure.

---

### [PRIORITY: High] -- #12 Hardware Time Synchronization (PTP/gPTP)
**Source:** Waymo, Zoox, Aurora, Motional, Nuro
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed High

**What it is:** IEEE 1588 PTP synchronization of all sensor clocks to a common GPS-disciplined time base with sub-microsecond accuracy.

**Current Aurrigo State:** Sensor timestamps assigned by ROS message arrival time. `PointcloudAggregator.cpp` lines 96-101 (`cloudCallback`) stores raw message timestamps; line 121-128 (`update()`) uses `header.stamp` for staleness and TF lookup. The rslidar_sdk has a `use_lidar_clock` parameter that can enable hardware timestamps. RS-LiDAR-32 firmware versions after V1.7 support PTP.

**Code Integration Points:**
- Driver: set `use_lidar_clock: true` in rslidar_sdk config
- RS32 sensor: set `time_sync_mode: ptp` via web interface
- PTP grandmaster: GPS-disciplined device on vehicle Ethernet (Meinberg microSync ~$2000 or software `linuxptp`)
- Aggregator: no code changes needed -- already uses `header.stamp` correctly
- RS32 firmware version >= V1.7 required (verify on all 5 units)

**Industry Validation:**
- PTP is universal in production AV stacks
- At 10 km/h, 10ms sync error = 2.8cm (within RS32 range accuracy). PTP becomes critical for future camera/radar integration and for NUIC certification (timestamp traceability)
- RoboSense community reports mixed PTP experiences on RS32; GPS+PPS fallback is more reliable

**Implementation Plan:**
1. Verify RS32 firmware versions, update if needed (2 days)
2. Procure and install PTP grandmaster with GPS antenna (1 week lead time)
3. Configure RS32 PTP slave mode on all 5 sensors (1 day)
4. Modify rslidar_sdk config (1 day)
5. Validate timestamp accuracy, regression test pipeline (4 days)

**Value Added:** Consistent multi-sensor fusion. Critical prerequisite for future camera/radar integration and NUIC certification.
**Effort:** 2 weeks (mostly hardware procurement). Engineering time: ~4 days.
**Risk:** RS32 PTP compatibility issues (mitigated by GPS+PPS fallback). Network infrastructure changes (low -- PTP uses existing Ethernet).

---

### [PRIORITY: High] -- #13 Time-to-Collision (TTC) Computation
**Source:** Waymo, Zoox, Nuro
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed High

**What it is:** For each tracked object, continuously compute collision imminence: `TTC = distance / closing_rate`.

**Current Aurrigo State:** No explicit TTC computation anywhere in the perception stack. The behavior planner has `emergency_ttc_threshold_` (1.5s) suggesting TTC awareness at the planning level, but the perception stack does not provide TTC data. Track position, velocity, and ego odometry are all available.

**Code Integration Points:**
- Insertion point: `polygon_detector_node.cpp` `publishDetectedObjects()` method (line ~312), after tracking and TF to base_link
- Uses existing `box.position` (Vector3f), `box.velocity` (Vector3f from KalmanTracker), and ego velocity from `/odom/fused`
- `DetectedObject.msg` may need `float64 time_to_collision` field (rebuild message package)
- Compute: nearest-point TTC (polygon vertices) and centroid TTC; report minimum
- Publish `/obstacle_detector/ttc` topic for behavior planner consumption
- Only compute for objects with x > 0 (forward hemisphere) and closing rate > 0.1 m/s

**Industry Validation:**
- TTC is universal in production AV systems. Kalman-filtered velocity is suitable for TTC at 10Hz.
- Challenge at 10Hz: noisy velocity -> noisy TTC. Aurrigo's Kalman-filtered velocity already smooths this.
- Radar-based TTC (Zoox, Aurora) provides instantaneous Doppler-based closing rate -- one reason 4D radar (#24) is valuable

**Implementation Plan:**
1. Day 1-2: Add TTC computation to polygon detector's publishing loop.
2. Day 3-4: Extend `DetectedObject.msg` with `time_to_collision` field.
3. Day 5: Add nearest-point TTC variant. Publish minimum of centroid and nearest-point TTC.
4. Week 2: Add TTC topic and integrate with behavior planner for threshold-based responses.

**Value Added:** Physics-based, velocity-aware safety metric that adapts to approach speed.
**Effort:** 1-2 weeks
**Risk:** Noisy TTC on stationary objects due to residual velocity noise (mitigated: only compute when closing rate > 0.5 m/s or object within 20m).

---

### [PRIORITY: High] -- #14 Weather Severity Estimation and Adaptive Perception
**Source:** Aurora, Kodiak (Hesai IPE), Zoox
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed High, with major finding about rain detection gap (see #7)

**What it is:** Classify weather conditions from LiDAR statistics and adapt perception parameters in real-time.

**Current Aurrigo State:** The rain detection node at `RainDetection.cpp` computes weather severity but its output is consumed by nothing (see bug fix #7). Uses `waitForMessage` polling at 0.2 Hz with a 1m^3 measurement volume.

**Code Integration Points:**
- Refactor `aurrigo_rain_detection` into a nodelet with callback-based subscription
- Expand metrics: SOR rejection ratio (full cloud, not tiny cube), mean free-path, low-intensity ratio, dual-return divergence
- New message type: `WeatherState.msg` with `weather_class` (CLEAR/LIGHT_PRECIP/HEAVY_PRECIP/FOG/EXHAUST), confidence, and individual metrics
- Adaptive parameter server: subscribe to weather state, scale SOR `std_devs` (CLEAR: 1.0x, LIGHT_PRECIP: 0.7x, HEAVY_PRECIP: 0.5x), adjust LIOR thresholds, reduce detection range
- Hysteresis state machine: require 3 consecutive readings above threshold to escalate, 5 to de-escalate

**Industry Validation:**
- Hesai IPE classifies weather and adapts filtering in real-time (built into sensor firmware). Aurrigo builds the software equivalent.
- Aurora's velocity-based rain filtering (2024) adapts aggressiveness based on precipitation rate
- Survey on LiDAR Perception in Adverse Weather (arXiv:2304.06312) identifies rain detection rate, mean free-path, and intensity statistics as primary indicators

**Implementation Plan:**
1. Week 1: Refactor rain detection into nodelet with callback-based subscription. Expand measurement volume.
2. Week 1-2: Add additional metrics: mean free-path, low-intensity ratio, SOR rejection ratio.
3. Week 2: Implement weather state machine with hysteresis.
4. Week 2-3: Implement adaptive SOR parameter scaling.
5. Week 3-4: Integrate with planner for speed reduction. Add diagnostics.

**Value Added:** Maintains perception quality across all airport weather conditions.
**Effort:** 3-4 weeks
**Risk:** Adaptive parameters could cause unexpected behavior if classification is wrong. Mitigated by safety floor (never remove >50% of points in any region). Benefits significantly from dual-return (#5) and intensity calibration (#8).

---

### [PRIORITY: High] -- #15 Geometric Consistency Checks on Detections
**Source:** Waymo, Zoox, Kodiak
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed High

**What it is:** Post-detection validation ensuring physical plausibility: bottom face near ground, dimensions within class ranges, velocities kinematically feasible.

**Current Aurrigo State:** The PolygonDetector already validates cluster dimensions, minimum polygon height, IoU overlap, velocity outliers (threshold 2.0), and size change percentage. What is MISSING: ground plane consistency check (z_min vs local ground height) -- the polygon detector has no access to GroundGrid data. Also missing: ULD-specific dimension validation against known standard sizes.

**Code Integration Points:**
- Option B (recommended): new `detection_validator` nodelet subscribing to both `/obstacle_detector/detected_objects` and `/ground_filter/grid_map`
- Ground plane check: `box.z_min` within 0.3m of ground height looked up from `grid_map::GridMap`
- ULD dimension validation in `aurrigo_uld_detection` against LD3 (1.56x1.53x1.63m), LD6, LD8 sizes
- Immediate config change: lower `max_velocity_threshold` from 15.0 to 14.0 m/s in `polygon_detector.yaml`

**Industry Validation:**
- Standard post-processing in production AV systems. Cheap (O(1) per detection) and catches 2-5% of spurious detections in cluttered environments.

**Implementation Plan:**
1. Immediate (1 day): Lower max velocity threshold in config.
2. Week 1: Create `detection_validator` nodelet with ground plane consistency check.
3. Week 2: Add ULD dimension validation. Add airport-specific dimension ranges.

**Value Added:** Catches spurious detections before they propagate to planning.
**Effort:** 1-2 weeks
**Risk:** Ground plane check rejects legitimate detections on ramps/slopes (mitigated by 0.3m tolerance and skipping when ground confidence is low).

---

### [PRIORITY: High] -- #16 GroundGrid Enhancement with Negative Obstacle Detection
**Source:** Kodiak (off-road perception), Zoox (GCA ground continuity)
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Upgraded from Medium to High -- airport ramp edges are a real operational hazard

**What it is:** Detection of surface drop-offs, ramp edges, and drainage channels by analyzing where the ground surface terminates or dips below expected elevation.

**Current Aurrigo State:** GroundGrid already has the data: `groundpatch` confidence layer (values near 0 for undetected ground), `ground` height layer, `pointsRaw` count layer. However, the spiral interpolation (line 431-473 of `GroundSegmentation.cpp`) actively fills unknown cells with interpolated heights, MASKING negative obstacles. The interpolation at line 495 sets `height = (1.0f - occupied) * avg + occupied * height` -- exactly what a negative obstacle cell would do.

**Code Integration Points:**
- Add `"negativeObstacle"` layer to grid_map in `GroundGrid::initGroundGrid()` (line 56, `GroundGrid.cpp`)
- New method `detect_negative_obstacles()` after `spiral_ground_interpolation()` returns (line 148, `GroundSegmentation.cpp`)
- CRITICAL: Modify `interpolate_cell()` (line 476) to skip cells flagged as negative obstacles
- Ground continuity check: if `max_ground_range < stopping_distance` from odometry velocity, publish warning
- Publish negative obstacles as grid_map layer and separate PointCloud2 topic

**Industry Validation:**
- Negative obstacle detection well-studied in off-road robotics (DARPA Grand Challenge era)
- GroundGrid's 0.33m resolution suitable for ramp edges (>0.3m drop) but marginal for shallow potholes (<0.1m)
- Key limitation: spiral interpolation must be modified -- this is the critical code change

**Implementation Plan:**
1. Add `"negativeObstacle"` layer to GroundGrid.
2. Implement `detect_negative_obstacles()` using ground confidence + height gradient analysis.
3. Modify spiral interpolation to skip negative obstacle cells.
4. Add ground continuity check using odometry velocity.
5. Publish on new topics.

**Value Added:** Prevents driving off apron edges, into drainage channels, or onto unstable surfaces.
**Effort:** 3-4 weeks
**Risk:** Over-sensitive detection on rough pavement (mitigated by configurable height gradient threshold starting at 0.15m). Spiral interpolation modification degrades ground quality elsewhere (mitigated by only skipping when confidence > 0.8).

---

### [PRIORITY: High] -- #17 Track Re-Identification After Occlusion
**Source:** Waymo, Zoox
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Upgraded from Medium to High -- genuine gap with real operational impact

**What it is:** When an object re-emerges from occlusion, match it to a dormant track rather than creating a new one, preserving track ID, velocity history, and avoiding re-confirmation delay.

**Current Aurrigo State:** `KalmanTracker::shouldDelete()` (kalman_tracker.cpp lines 430-447) permanently deletes tracks after `max_age_since_update` (default 6) consecutive misses (0.6s at 10Hz). `pruneDeadTracks()` (line 883-890) simply erases tracks. No DORMANT state exists. Each occlusion creates a new track with new ID, losing all history.

**Code Integration Points:**
- Add `DORMANT` to `TrackState` enum (kalman_tracker.hpp line 88)
- New `dormant_trackers_` vector in `MultiObjectKalmanTracker`
- Modified `pruneDeadTracks()`: move confirmed/lost tracks to dormant instead of deleting
- Re-identification pass in `update()` between matching and new-track-creation: check unmatched detections against dormant tracks with relaxed Euclidean gate (2-3x normal) + dimension consistency (<30% change)
- Config: `dormant_timeout_frames: 50` (5s at 10Hz), `dormant_gate_multiplier: 3.0`, `dormant_size_tolerance: 0.30`

**Industry Validation:**
- Standard practice at Waymo, Zoox, and most production trackers. 3-stage approach (active -> lost -> dormant -> reactivated) well-established.
- Research (2025): multi-level association reduces ID switches by 30-50% in cluttered environments.
- Airport aprons have frequent brief occlusions: workers behind carts, ULDs hidden by passing tugs, objects at FOV edges.

**Implementation Plan:**
1. Week 1: Add DORMANT state and modified lifecycle. Implement `findBestDormantMatch()`.
2. Week 1-2: Implement re-identification pass in `update()`.
3. Week 2: Add config parameters and dynamic_reconfigure.
4. Week 2-3: Validation on bags with known occlusion scenarios.

**Value Added:** Continuous track identity through brief occlusions, preserved velocity/history, reduced track fragmentation.
**Effort:** 2-3 weeks
**Risk:** False re-identification (mitigated by dimension consistency check + Mahalanobis gate). Memory growth (mitigated by hard cap on dormant count and age-based eviction).

---

### [PRIORITY: High] -- #18 Formal Safety Distance Model (RSS-Inspired)
**Source:** Mobileye (RSS), Intel ad-rss-lib (open-source, Apache 2.0)
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed High, elevated to near-Critical for NUIC pathway

**What it is:** Mathematical model defining minimum safe following distance and lateral clearance as a function of velocities, braking capabilities, and reaction time. Provides provable collision freedom.

**Current Aurrigo State:** The `SafetyMonitor` (`safety_monitor.cpp`) only performs 2 checks (remote e-stop and system health). The `LocalPlanningNodelet` evaluates 420 Frenet trajectory candidates per cycle with `checkTrajectoryCollisions()` but uses informal TTC approximation (`emergency_ttc_threshold_: 1.5s`). RSS would formalize what TTC approximates informally.

**Code Integration Points:**
- Integrate Intel `ad-rss-lib` as third-party dependency
- New `RssSafetyChecker` class subscribing to `/polygon_detector/objects` and `/odom/fused`
- Add as third check in `SafetyMonitor::checkAll()`: `checkRssSafeDistance()`
- Wire RSS violations into `StopArbiter` at priority level 3
- Add as hard constraint in Frenet trajectory evaluation: trajectories violating RSS minimums marked `has_collision = true`
- Airport parameters: rho=0.5-1.0s, a_min_brake=2.0 m/s^2, v_max=7 m/s, mu_lat=1.5m from aircraft

**Industry Validation:**
- Mobileye RSS deployed in 230M+ vehicles. Volkswagen robotaxi uses RSS. China ITS approved as basis for AV safety standard. IEEE P2846 references RSS.
- Intel `ad-rss-lib` is open-source, integrated into CARLA and Apollo
- At v_ego=7 m/s: d_safe_long = 9.625m. Reasonable for apron.
- IATA AHM 908 requires risk assessment for autonomous vehicles; RSS provides mathematically auditable response

**Implementation Plan:**
1. Week 1: Integrate `ad-rss-lib`. Build and test standalone with airport-parameterized scenarios.
2. Week 2: Create `RssSafetyChecker` class with topic subscriptions and `isViolated()` API.
3. Week 3: Integrate into `SafetyMonitor`. Wire into `StopArbiter`.
4. Week 4: Integrate as hard constraint in Frenet trajectory evaluation. Validate with bag file replay.

**Value Added:** Mathematically provable collision avoidance. Core of NUIC safety case.
**Effort:** 4 weeks
**Risk:** Technical: LOW (library exists, integration points clear). Operational: MEDIUM (if parameters too conservative for tight docking, mitigated by "docking mode" with relaxed lateral margins when `UldStateMachine` is in LOADING/UNLOADING state and speed < 0.5 m/s).

---

### [PRIORITY: High] -- #19 Jet Blast and Engine Exhaust Zone Modeling
**Source:** IATA Engine Danger Areas, airport domain-specific
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Upgraded from Medium to High -- airport-specific safety hazard with direct regulatory implications

**What it is:** Static and dynamic exclusion zones behind aircraft engines, integrated into trajectory planning and perception filtering.

**Current Aurrigo State:** No domain-specific awareness of jet blast zones. Signal-level filtering (#5 multi-return, #10 LIOR, temporal consistency) partially addresses exhaust plume false returns, but physical hazard of jet blast force on the vehicle is not modeled.

**Code Integration Points:**
- New `JetBlastZoneManager` class loading static stand layout + aircraft type database from YAML
- Conical exclusion zones per engine (half-angle ~30 deg, length 60m at idle per IATA data)
- Integration 1: Hard constraint in `LocalPlanningNodelet` -- jet blast zones added to `obstacles_` vector as permanent `ObstaclePolygon` entries
- Integration 2: Perception filtering in `PointcloudPreprocessor` -- classify points in jet blast zones matching exhaust signature (low intensity, temporal variance) as `JET_EXHAUST`
- Integration 3: RSS extension -- `mu_lat` dynamically increased near engine exhaust zones

**Industry Validation:**
- No AV industry analog (airport-domain-specific). IATA Engine Danger Areas provides exclusion zone dimensions per aircraft type.
- Jet blast can physically move/overturn a baggage tractor. The perception hazard (false returns) is secondary.
- DOT research at Denver International confirms exhaust plumes produce LiDAR backscatter with low intensity and high temporal variability

**Implementation Plan:**
1. Week 1: Create `JetBlastZoneManager` with YAML config, conical zone computation, visualization markers.
2. Week 2: Integrate as hard constraint in trajectory planning.
3. Week 3: Add perception-layer exhaust filtering in preprocessor.
4. Week 4: Integration testing with real airport data.

**Value Added:** Prevents vehicle from entering active exhaust zones (physical safety) and filters exhaust false positives (perception quality).
**Effort:** 3-4 weeks
**Risk:** Data dependency (aircraft stand positions/types must be available from airport ops or configured statically). If omitted: vehicle may enter active exhaust zone causing physical damage or repeated emergency stops.

---

### [PRIORITY: High] -- #20 LWIR Thermal Camera Integration
**Source:** Zoox (FLIR Boson), Nuro
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed High -- single most impactful hardware addition for worker safety

**What it is:** LWIR thermal cameras for pedestrian detection independent of ambient lighting, clothing color, or weather. Human body heat (37C) creates 10-20C contrast against ambient.

**Current Aurrigo State:** No thermal sensing. LiDAR-only perception is vulnerable to dark-clothed personnel at night and in fog. This is identified as a **Critical gap** in the SOTIF triggering condition analysis.

**Code Integration Points:**
- New standalone ROS node `aurrigo_thermal_detector` (NOT a nodelet -- independent of LiDAR pipeline)
- 4x FLIR Boson+ 640 (14mm, 32deg HFoV): $7,200 + $1,800 mounting/enclosures = ~$9,000/vehicle
- Classical pipeline: NUC (on-module) -> AGC -> binary threshold (T > ambient+10C) -> morphological opening -> connected components -> BEV position
- Fusion: gated nearest-neighbor with LiDAR tracks from PolygonDetector
- Thermal-only detections (no LiDAR match) trigger cautious behavior in planner
- Add thermal frames to vehicle URDF (`aurrigo_vehicle_description/urdf/`)

**Industry Validation:**
- Zoox validated FLIR Boson integration. Nuro uses LWIR for delivery vehicles.
- Thermal cameras standard in port/logistics automation (Kalmar, Konecranes terminal tractors)
- LWIR unaffected by jet exhaust shimmer (reads body temperature, not reflected light)
- Known challenges: thermal-to-LiDAR calibration uses halogen-heated dots visible in both modalities; heavy rain on lens degrades performance (hydrophobic coatings + heated lens windows)

**Implementation Plan:**
1. Week 1-2: Hardware procurement and mounting design (lead time: 2-4 weeks).
2. Week 3-4: ROS driver integration (FLIR Boson USB driver, verify 30Hz).
3. Week 4-5: Thermal-to-LiDAR extrinsic calibration with heated targets.
4. Week 5-6: Blob detection + temperature thresholding node.
5. Week 6-7: Gated nearest-neighbor fusion with LiDAR tracks.
6. Week 7-8: Field testing at night, dawn, dusk, simulated fog.

**Value Added:** Near-100% pedestrian detection at night, in fog, and in jet exhaust zones.
**Effort:** 6-8 weeks (1 senior + 1 mid-level engineer). Hardware: ~$9,000/vehicle.
**Risk:** Hot surface false positives in summer (mitigated by adaptive ambient-relative thresholding). Lens contamination (mitigated by hydrophobic coatings, heated windows).

---

### [PRIORITY: High] -- #21 ISO 26262 / SOTIF Alignment for Perception Safety Case
**Source:** Zoox (ISO 26262, SOTIF, ARP4754A), Kodiak (ASIL-D), EASA AI framework
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Upgraded from Low to High -- prerequisite for NUIC certification pathway

**What it is:** Structured safety analysis following ISO 26262 and ISO 21448 (SOTIF) methodology, adapted for airport ground vehicles. Primarily documentation and process, with some instrumentation requirements.

**Current Aurrigo State:** Aurrigo is co-developing a NUIC framework with IAG. The regulatory landscape spans ICAO Annex 14, IATA AHM 908, UK CAA/Airports Regulations 1997, and EASA AI framework (RMT 0742). ISO 26262/SOTIF are formally scoped to "road vehicles" but serve as de facto reference frameworks. Changi Airport precedent (Uisee tractors, January 2026) demonstrates achievable deployment.

**Code Integration Points:**
- Primarily documentation and analysis, not code changes
- Requires publishing perception confidence metrics: `computeConfidence()` in `UldDetection.cpp` (lines 16-26) to diagnostic topic
- Aggregator statistics (`cloud_received_count`, `cloud_stale_count`, `cloud_age_sum`) should be published as `diagnostic_msgs::DiagnosticArray`
- STL specifications from #23 directly support SOTIF by monitoring triggering conditions at runtime
- SOTIF triggering condition analysis identifies critical gaps: heavy rain (no multi-return), dark personnel at night (no thermal), sensor failure (partial staleness only)

**Industry Validation:**
- Zoox cites ISO 26262, SOTIF, and ARP4754A. Kodiak claims ASIL-D compliance.
- EASA AI trustworthiness framework (NPA 2025-07, RMT 0742) will extend to ground systems in 2026-2027
- IATA AHM 908 (45th Edition, 2025) includes explicit provisions for autonomous vehicle operations airside

**Implementation Plan:**
1. Phase 1 (Weeks 1-4): SOTIF triggering condition analysis (structured HARA adapted for airport operations)
2. Phase 2 (Weeks 4-8): Gap mitigation plan mapping hazards to perception recommendations
3. Phase 3 (Weeks 8-12): Safety case document in GSN format
4. Phase 4 (Continuous): Quarterly review after any perception stack change

**Value Added:** Core deliverable for NUIC framework and future CAA/EASA certification.
**Effort:** 3-4 months elapsed (1 safety engineer, ~50% FTE). External safety consultant recommended.
**Risk:** Resource risk HIGH (requires safety engineering expertise). Schedule risk MEDIUM (HARA must complete before NUIC certification proceeds). Regulatory risk LOW (voluntary adoption viewed positively).

---

### [PRIORITY: High] -- #22 IMM Filter for Multi-Model Tracking
**Source:** Waymo, Kodiak, Motional
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Downgraded from Critical to High -- existing tracker more sophisticated than assumed

**What it is:** Bank of Kalman filters (CV, CA, CTRV) combined based on model probabilities. Automatically shifts weight when objects transition between motion modes.

**Current Aurrigo State:** `KalmanTracker` at `kalman_tracker.cpp` uses 4-state `[x, y, vx, vy]` CV model with `cv::KalmanFilter`. Already more sophisticated than assumed: velocity measured directly (not derived from acceleration), velocity deque filtering with outlier rejection (lines 512-548), cascade matching. IMM's main benefit (turning vehicles at highway speeds) is less critical at 5-15 km/h airport operations.

**Code Integration Points:**
- Wrap existing `KalmanTracker` as one model in IMM bank
- Same-dimension approach: all 3 models use [x, y, vx, vy] state
- CA model: higher Q on velocity states; CTRV: EKF-style linearization with turn rate
- Challenge: `cv::KalmanFilter` does not natively support IMM -- requires custom state mixing code
- Make IMM enable/disable a config parameter

**Industry Validation:**
- IMM-MOT (arXiv:2502.09672, 2025): 73.8% AMOTA on NuScenes. Benefit mostly from highway scenarios with sharp lane changes -- uncommon on airport apron.
- Practical improvement over well-tuned CV at airport speeds: 5-15% tracking accuracy improvement.

**Implementation Plan:**
1. Implement same-dimension IMM wrapper with CV and CA models (2 weeks)
2. Add CTRV model with Jacobian computation (1 week)
3. Tune transition probability matrix on recorded bags (1 week)
4. A/B test against current tracker (1 week)

**Value Added:** Improved tracking of maneuvering airport vehicles (tugs turning, aircraft taxiing).
**Effort:** 4-5 weeks
**Risk:** Regression on stationary/slow objects (mitigated by high self-transition probability 0.95). Complexity increase in maintenance.

---

### [PRIORITY: Medium-High] -- #23 Rule-Based Safety Validation of Planned Trajectories
**Source:** Waymo ("Demonstrably Safe AI"), Mobileye (RSS), Motional (Rulebooks)
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Upgraded from Medium to Medium-High -- no independent safety layer between planner and controller

**What it is:** Independent validation layer checking every planned trajectory against deterministic safety rules before execution: kinematic feasibility, collision freedom (SAT on convex polygons), drivable area, minimum safe distance, aircraft clearance.

**Current Aurrigo State:** No independent validation between the local planner output and the vehicle controller. Vehicle footprint defined in `ground_filter.yaml`. SAT for ~20 tracked objects and ~50 trajectory samples = ~1000 checks/cycle at ~1us/check = 1ms total.

**Code Integration Points:**
- New standalone ROS node `TrajectoryValidator` (process isolation)
- Subscribes to: planned trajectory from `local_planning_nodelet`, tracked objects from polygon detector, `/odom/fused`, occupancy grid from #3
- SAT collision checking using existing `Polygonizer::convexHull()` infrastructure
- Depends on occupancy grid (#3) for drivable area checking (can operate without it for collision/kinematic checks)

**Industry Validation:**
- Waymo requires provable collision freedom. Mobileye RSS validates trajectories. Intel `ad-rss-lib` can validate trajectories directly.
- Motional Rulebook: priority-ordered rules (no collision > safe distance > marking compliance > minimize time)

**Implementation Plan:**
1. Week 1: Identify trajectory message type from `aurrigo_nav`. Define validation interface.
2. Week 2: Implement kinematic feasibility and SAT collision-free checks.
3. Week 3: Implement drivable area check (requires #3).
4. Week 4: RSS-inspired minimum safe distance check.
5. Week 5-6: Integration testing with behavior planner.

**Value Added:** Provably correct safety layer on top of planner.
**Effort:** 4-6 weeks
**Risk:** Too conservative -> rejects all trajectories in cluttered environments (mitigated by tuned collision margins). Validator latency (SAT is ~1ms, negligible). Trajectory format mismatch (resolve in Week 1).

---

### [PRIORITY: Medium-High] -- #24 L-Shape Fitting for Vehicle Orientation Estimation
**Source:** Zhang et al. IV 2017; widely used in AV industry
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Upgraded from Medium to Medium-High -- directly addresses known PCA limitation

**What it is:** Fit an L-shape to visible point cloud edges for partially-observed rectangular objects, providing orientation when only one or two faces are visible (where PCA produces 90-degree errors).

**Current Aurrigo State:** PolygonDetector uses `Polygonizer::boundingBoxRotatingCalipers()` (polygonizer.cpp line 73-170) for minimum-area OBB. Geometrically optimal for visible hull but does not account for partial observability. UldDetection uses PCA for orientation. The `Box` struct has no explicit orientation field. Existing RANSAC line fitting in DeckDetection (`fitEdgeLineRANSAC()`) can be adapted.

**Code Integration Points:**
- New `LShapeFitter` class with RANSAC-based two-line fitting
- Insert in `polygon_detector_node.cpp` Phase 1, after convex hull, before rotating calipers
- If two perpendicular edges found (angle within 90 +/- 15deg, both >5 inlier points), use L-shape; else fall back to rotating calipers
- Add `float orientation_rad` and `bool has_l_shape_orientation` to `Box` struct (box.hpp)
- Also integrate into `UldDetection::publishPoseAndVisualization()` as alternative to PCA

**Industry Validation:**
- Standard in AV industry for partially-observed vehicles. <2deg heading error for two-face observations.
- Airport objects (ULDs, baggage carts, tugs) are rectangular/boxy -- ideal for L-shape.
- CMU implementation runs <1ms for thousands of objects.

**Implementation Plan:**
1. Week 1: Implement `LShapeFitter` with RANSAC-based two-line fitting. Unit test.
2. Week 1-2: Integrate into PolygonDetector Phase 1.
3. Week 2-3: Integrate into UldDetection as alternative to PCA.
4. Week 3: Validation on bags. Target: <5deg heading error for two-face observations.

**Value Added:** More accurate orientation for partially-observed vehicles/ULDs, reducing docking alignment errors.
**Effort:** 2-3 weeks
**Risk:** L-shape on non-rectangular objects (mitigated by aspect ratio check, fall back to rotating calipers). Orientation flip ambiguity (mitigated by velocity direction disambiguation).

---

### [PRIORITY: Medium] -- #25 UKF for ULD Tracking
**Source:** Waymo, Kodiak, Nuro
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Medium, but with significantly different rationale -- ULD uses moving average, not EKF

**What it is:** Unscented Kalman Filter replacing the current moving average filters for ULD position and orientation estimation.

**Current Aurrigo State:** The ULD detector does NOT use a Kalman/EKF filter at all. The actual tracking uses `std::deque<Eigen::Vector2f> position_history_` (window 3) and `std::deque<double> yaw_history_` (window 3) for moving average smoothing. Moving average cannot predict during occlusion, introduces fixed delay, provides no uncertainty estimate, and breaks on angle wrapping (see bug fix #6).

**Code Integration Points:**
- New `UldStateEstimator` class: state `[x, y, yaw, v_x, v_y, yaw_rate]` (6 states), measurement `[x, y, yaw]`
- Replace moving average at `UldDetection.cpp` lines 396-430 (position/yaw filtering)
- Also replace in `cloudUldOnVehicleCallback()` (line 532)
- Sigma point generation with alpha=0.001, beta=2.0, kappa=0.0

**Industry Validation:**
- The improvement from UKF over moving average is much larger than from UKF over EKF. Even a linear KF would be massive improvement.
- UKF provides 10-30% lower RMSE for yaw estimation vs EKF when process model is nonlinear.

**Implementation Plan:**
1. Fix yaw wrapping bug first (#6, prerequisite, 1 day)
2. Implement `UldStateEstimator` with UKF using Eigen (1.5 weeks)
3. Integrate replacing moving averages (3 days)
4. Tune process/measurement noise on bags (3 days)
5. Test occlusion handling and wrapping boundary (2 days)

**Value Added:** Proper state estimation with uncertainty, prediction during occlusion, velocity estimation, orientation continuity.
**Effort:** 3 weeks
**Risk:** Implementation bugs in sigma points (mitigated by using `robot_localization` UKF as reference). Tuning difficulty (standard values work for most cases).

---

### [PRIORITY: Medium] -- #26 4D Imaging Radar Integration
**Source:** Aurora (Continental ARS548), Kodiak (ZF 4D Radar), Nuro
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Upgraded slightly to Medium-High -- only weather-robust modality + instantaneous Doppler

**What it is:** 77GHz FMCW imaging radar providing 4D point clouds with instantaneous Doppler velocity per detection. Works through rain, fog, dust, and jet exhaust.

**Current Aurrigo State:** No radar. LiDAR-only stack is vulnerable to weather degradation.

**Code Integration Points:**
- Separate `aurrigo_radar_processor` node (not adding radar to LiDAR aggregator -- preserves Doppler field)
- Track-level fusion: Mahalanobis gating between PolygonDetector tracks and radar detections
- New `updateWithDoppler()` method in `KalmanTracker` using radar Doppler as additional velocity measurement
- Weather-adaptive weighting: when LiDAR degraded, increase radar detection weight
- Hardware: 2-4x Continental ARS548 (~$1,500-2,500 each), Ethernet/PoE, $4,000-11,000/vehicle total

**Industry Validation:**
- Aurora, Kodiak use ARS548/ZF 4D radar for highway operation. Port automation uses radar-LiDAR fusion.
- $5.1B market (2025) driven by weather-robust perception use case.
- ROS1 driver port needed from `ars548_ros` (ROS2-native, ~2000 lines C++, straightforward port)

**Implementation Plan:**
1. Week 1-2: Procure 2x ARS548. Port ROS2 driver to ROS1.
2. Week 3-4: Radar-to-LiDAR calibration with corner reflectors.
3. Week 4-6: Radar processor node (RCS filtering, ground clutter removal).
4. Week 6-8: Track-level fusion with `updateWithDoppler()`.
5. Week 8-10: Weather-adaptive weighting.

**Value Added:** Weather-robust detection, instantaneous velocity, sensor redundancy.
**Effort:** 6-10 weeks (1 senior engineer). Hardware: $4,000-11,000/vehicle.
**Risk:** Multipath from aircraft/hangar surfaces (mitigated by RCS+Doppler filtering). ROS1 driver port issues (mitigated by ros1_bridge alternative).

---

### [PRIORITY: Medium] -- #27 Temporal Consistency Filtering
**Source:** Zoox, Kodiak (Hesai IPE)
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Medium, but complexity higher than v1 stated

**What it is:** Require temporal persistence over 2-3 frames before classifying a cluster as a real object.

**Current Aurrigo State:** Each frame processed independently. The Aggregator keeps only 1 frame per sensor. Cluster-level approach (at tracker) is recommended over point-level (avoids ego-motion compensation dependency).

**Code Integration Points:**
- Approach B recommended: cluster-level temporal consistency as extension to tracking infrastructure
- After segmentation produces clusters, check spatial overlap with clusters from previous 2 frames
- Close-range bypass (<3m) for immediate safety
- Integrates naturally with M-of-N track confirmation and dormant track re-identification

**Industry Validation:**
- Standard practice: Waymo M-of-N confirmation, Zoox GCA temporal persistence
- Known limitation: 200-300ms latency at 10Hz before new object confirmed. Close-range bypass critical.

**Implementation Plan:**
1. Week 1: Implement cluster-level consistency as extension to Polygon Detector.
2. Week 1-2: Add ego-motion compensation using `/odom/fused`.
3. Week 2-3: Tune spatial tolerance, test with exhaust plumes, real objects appearing suddenly, rain.

**Value Added:** Eliminates single-frame false positives from exhaust, splash, transient debris.
**Effort:** 2-3 weeks
**Risk:** Added detection latency (mitigated by close-range bypass). Interaction with track lifecycle (implement together with #17 for efficiency).

---

### [PRIORITY: Medium] -- #28 Temporal Logic Safety Specifications (STL)
**Source:** Motional/nuTonomy, rtamt4ros
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Medium, critical dependency for NUIC pathway

**What it is:** Runtime monitoring of formal safety specifications encoded as Signal Temporal Logic (STL), evaluated at 10Hz against live vehicle state.

**Current Aurrigo State:** Safety requirements are informal. No machine-checkable specifications.

**Code Integration Points:**
- New standalone `SafetySpecificationMonitor` node using `rtamt4ros`
- Subscribes to: `/odom/fused`, `/polygon_detector/objects`, `/av_nav/safety/diagnostics`, `/av_nav/cmd_twist`, `/uld_detection/state`
- Initial 10 STL specifications: min obstacle distance, speed limit, LiDAR count >=3, obstacle stop response, engine exclusion zone, sensor staleness, EKF innovation bound, TTC bound, e-stop response, ULD detection confidence
- Publishes violations to `/av_nav/safety/stl_violations` and logs to bag file
- Critical violations trigger `SafetyMonitor` via service call
- C++ backend: ~0.05ms per sample at 10Hz -- negligible overhead

**Industry Validation:**
- rtamt4ros provides native ROS integration for online STL monitoring
- Encoding RSS rules in STL demonstrated (ACM MEMOCODE 2019)
- PerceMon provides perception-specific STL monitoring integrated with ROS
- Specifications + violation logs become core NUIC safety case artefact

**Implementation Plan:**
1. Week 1-2: Install rtamt4ros. Define initial 10 STL specs in YAML. Implement monitor node.
2. Week 3: Runtime evaluation loop. Log all robustness values. Wire critical violations into SafetyMonitor.
3. Week 4-5: Replay all available bags. Catalogue existing violations. Tune thresholds.
4. Week 6: Integrate critical violations into StopArbiter. Document for NUIC safety case.

**Value Added:** Machine-checkable safety specs. Runtime violation detection and evidence trail.
**Effort:** 5-6 weeks
**Risk:** Specification risk MEDIUM (incorrect specs cause false alarms or miss hazards; mitigate with monitoring-only mode for first 2 months). Performance risk LOW (<5ms per cycle).

---

### [PRIORITY: Medium] -- #29 LiDAR-to-LiDAR Extrinsic Calibration Refinement via ICP
**Source:** Waymo, Kodiak, Motional
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Medium -- monitoring (#4) is more important than automatic refinement

**What it is:** Extending calibration monitoring (#4) with automatic correction when drift is detected and ICP fitness is good.

**Current Aurrigo State:** TF chain: `lidar_i_frame` -> `3d_base_lidar` (static from URDF at `aurrigo_vehicle_description/config/<type>/<unit>.yaml`). No field refinement.

**Code Integration Points:**
- Builds on #4 (CalibrationMonitor) infrastructure
- Phase 2: when drift > threshold AND ICP fitness < 0.001, publish corrected TF via `tf2_ros::StaticTransformBroadcaster`
- Safety constraint: never apply corrections > 1cm translation / 0.05deg rotation per step
- Require N consecutive agreements before applying
- Persist corrections to YAML for next startup

**Industry Validation:**
- Industry consensus: monitoring is safe; automatic correction is risky. Kodiak uses offline analysis. Zoox CLAMS monitors but does not auto-correct.
- Deploy monitoring (#4) first; defer auto-correction to Phase 2 after extensive validation.

**Implementation Plan:**
1. Implement #4 monitoring first (prerequisite, 3 weeks)
2. Add correction computation with strict validation (1 week)
3. Add persistence and startup loading (2 days)
4. Deploy monitoring-only for 1 month before enabling auto-correction

**Value Added:** Self-healing calibration without technician intervention.
**Effort:** 2 weeks incremental on top of #4
**Risk:** Incorrect correction degrades fusion worse than original drift (CRITICAL -- mitigated by delta limits, N-of-M agreement, monitoring-only period).

---

### [PRIORITY: Medium] -- #30 LiDAR Reflectivity-Based Apron Marking Detection
**Source:** Kodiak (Luminar reflectivity-based lane detection)
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Downgraded from High to Medium -- useful but depends on intensity calibration prerequisite

**What it is:** Detecting retroreflective apron markings (taxi lines, stand markings, safety zones) from LiDAR intensity for localization refinement.

**Current Aurrigo State:** The pipeline uses `pcl::PointXYZI` throughout (intensity preserved) except PolygonDetector which drops to `pcl::PointXYZ`. Must tap ground points BEFORE PolygonDetector. GroundGrid ground-classified points with intensity are the correct input.

**Code Integration Points:**
- New `aurrigo_marking_detector` node subscribing to GroundGrid ground points
- Range normalization -> threshold (2x median ground intensity) -> BEV projection -> cluster -> line fitting (Hough/RANSAC)
- HARD PREREQUISITE: intensity calibration (#8)
- Publish localization correction on `/marking_detector/localization_correction`

**Industry Validation:**
- R^2=0.87 correlation between LiDAR intensity and retroreflectometer readings for pavement markings
- Works identically day and night. Wet conditions reduce retroreflectivity by up to 80%.

**Implementation Plan:**
1. Prerequisite: intensity calibration (#8)
2. Week 1-2: Marking detector node with range normalization and thresholding
3. Week 2-3: BEV projection and line fitting
4. Week 3-4: Map matching and localization correction

**Value Added:** Localization refinement on apron. Safety zone verification. Works at night.
**Effort:** 3-4 weeks + prerequisite
**Risk:** Intensity calibration quality determines threshold reliability. Worn/dirty markings may be missed (treat as supplementary input, not primary).

---

### [PRIORITY: Medium] -- #31 Swept-Path Collision Checking (SAT)
**Source:** Waymo
**Feasibility:** FEASIBLE
**v1 to v2 Change:** Confirmed Medium

**What it is:** Compute vehicle's swept volume along planned trajectory and check for intersection with tracked object volumes using SAT on convex polygons.

**Current Aurrigo State:** Point-based proximity checks only. No swept-path collision checking. For tractor+trailer configuration, swept volume during turns extends 2-3m beyond instantaneous footprint.

**Code Integration Points:**
- New utility `sat_collision.hpp` (shared between perception and planning)
- `computeSweptVolume()`: sample trajectory at 0.1s, transform ego polygon to each pose, compute convex hull of union
- Uses existing `Polygonizer::convexHull()` template function
- Performance: 175 candidates * 20 objects = 3,500 SAT checks at ~1us each = 3.5ms

**Industry Validation:**
- Standard in AV industry. SAT simpler and sufficient for 2D convex polygon checks (vs GJK which is more general).
- Exactly the use case for long tractor+trailer combinations making turns on tight aprons.

**Implementation Plan:**
1. Week 1: Implement `sat_collision.hpp` with unit tests.
2. Week 2: Implement `computeSweptVolume()`.
3. Week 3: Integrate into local planner trajectory scoring.
4. Week 4: Validation with tight turn and narrow gap scenarios.

**Value Added:** Prevents collisions during turns with trailer.
**Effort:** 3-4 weeks (primarily planner-side work)
**Risk:** Convex hull approximation underestimates swept area for concave vehicles (mitigated by conservative enlarged footprint). Trajectory sampling too coarse (mitigated by 0.1s intervals).

---

### [PRIORITY: Medium] -- #32 Formal Verification of State Machines
**Source:** NuSMV, UPPAAL model checking
**Feasibility:** FEASIBLE
**v1 to v2 Change:** NEW -- discovered during code review of UldStateMachine

**What it is:** Exhaustive model checking of the UldStateMachine (5 states) and BehaviorPlannerNodelet FSM (6 states) to verify safety and liveness properties.

**Current Aurrigo State:** `UldStateMachine` (UldStateMachine.h, lines 56-84): 5-state bidirectional graph (IDLE, ULD_ON_JCPL, LOADING, ULD_ON_VEHICLE, UNLOADING). Pure function, no side effects, explicit configuration. Unit tests exist. BehaviorPlannerNodelet FSM: 6 states (IDLE, READY, NAVIGATING, AT_PAUSE, CARGO_LOADING, DONE).

**Code Integration Points:**
- Encode both state machines in NuSMV or UPPAAL model description language
- Define properties in CTL/LTL: liveness ("from any state, can reach IDLE"), safety ("never IDLE -> UNLOADING directly"), bounded response ("if confidence drops, return to IDLE within timeout")
- Run model checker to verify
- Document verified properties in safety case

**Industry Validation:**
- Both state machines are small enough (5-6 states) for exhaustive model checking. UPPAAL and NuSMV are free tools.
- UldStateMachine is already well-designed for verification: pure function, explicit config, unit tests.

**Implementation Plan:**
1. Encode state machines in model checker language
2. Define safety and liveness properties
3. Run model checker, fix any issues
4. Document in safety case

**Value Added:** Exhaustive verification of all reachable states. Complements existing unit tests.
**Effort:** 1-2 weeks (requires model checking experience)
**Risk:** None -- model checking is read-only analysis, does not modify code.

---

### [PRIORITY: Medium] -- #33 JPDA (Joint Probabilistic Data Association)
**Source:** Waymo, Kodiak
**Feasibility:** FEASIBLE WITH MODIFICATIONS (questionable value)
**v1 to v2 Change:** Downgraded from High to Medium -- existing Hungarian + cascade is already robust

**What it is:** Soft probabilistic data association replacing hard one-to-one Hungarian assignment.

**Current Aurrigo State:** `MultiObjectKalmanTracker` uses `buildCostMatrix()` (Euclidean + bbox ratio), `hungarianAssignment()` (dlib-based, O(n^3)), and `cascadeMatch()` (two-pass confirmed-first). Mahalanobis used as secondary bonus for confirmed tracks.

**Code Integration Points:**
- Would replace `hungarianAssignment()` within each cascade level
- Each track updated with weighted combination of all gated detections (beta-weighted Kalman update)
- Modified covariance update with spread term: `P_jpda = beta_0 * P_predicted + (1-beta_0) * P_standard + P_spread`
- O(2^N) worst case for N detections in gate (needs approximation for practical use)

**Industry Validation:**
- JPDA theoretically superior in cluttered environments. Airport aprons have well-separated objects -- less benefit.
- Practical improvement over cascade+Hungarian: <5% reduction in identity switches.
- Hybrid approach recommended: use Hungarian when gate overlap is zero, JPDA only when gates overlap.

**Implementation Plan:**
1. Week 1-2: Implement JPDA probability computation using existing Mahalanobis gate.
2. Week 2-3: Beta-weighted Kalman update with spread covariance.
3. Week 3-4: Replace matching within cascade levels. Tune parameters.
4. Week 4-5: A/B testing on recorded bags.

**Value Added:** Reduced ID switches in dense clutter (baggage dolly trains, adjacent ULDs).
**Effort:** 3-5 weeks
**Risk:** Computational cost in dense scenes (mitigated by limiting JPDA to overlapping gates). Regression in simple scenarios (mitigated by hybrid approach).

---

### [PRIORITY: Medium-Low] -- #34 Rulebook Framework for Airport Ground Movement Rules
**Source:** Motional/nuTonomy (Censi et al., ICRA 2019)
**Feasibility:** FEASIBLE WITH MODIFICATIONS
**v1 to v2 Change:** Confirmed Medium-Low, defer until after RSS and STL

**What it is:** Lexicographic priority ordering for trajectory selection: first minimize safety violations, then minimize rule violations, then optimize comfort.

**Current Aurrigo State:** The `StopArbiter` already implements 10-level priority-based stop resolution -- effectively a simplified Rulebook for stopping decisions. The Frenet trajectory selector uses weighted cost summation, meaning a slightly faster trajectory could be selected over a slightly safer one if weights are poorly calibrated.

**Code Integration Points:**
- Modify `selectBestFrenetTrajectory()` to use two-stage selection: hard constraints (RSS, exclusion zones, speed limits) then lexicographic soft constraints (aircraft clearance, personnel clearance, marking deviation, travel time)
- Depends on RSS (#18) providing hard constraint metrics
- Rule hierarchy in YAML config file

**Industry Validation:**
- Motional published framework (ICRA 2019) but ceased operations March 2024, reducing support.
- No open-source implementation. The StopArbiter is already a simplified Rulebook.
- Airport ground rules are naturally well-defined and static -- excellent Rulebook domain.

**Implementation Plan:**
1. Week 1: Formalize rule hierarchy in YAML config.
2. Week 2-3: Implement `RulebookEvaluator` for trajectory selection.
3. Week 4: Validate with bag file replay.

**Value Added:** Principled, auditable decision-making for trajectory selection.
**Effort:** 3-4 weeks (after RSS is integrated)
**Risk:** Lexicographic ordering can produce overly conservative behavior in edge cases (mitigated by docking mode exceptions).

---

### [PRIORITY: Low] -- #35 Piecewise Planar Ground Fitting for Ramps and Slopes
**Source:** Aurora, Kodiak, Motional
**Feasibility:** FEASIBLE WITH MODIFICATIONS (low ROI)
**v1 to v2 Change:** Confirmed Low

**What it is:** CZM-based sector fitting replacing grid-aligned patches for ground segmentation on ramps.

**Current Aurrigo State:** GroundGrid already handles local ground variation via grid-based 3x3/5x5 patch detection. GroundGrid achieves 94.78% IoU on SemanticKITTI, outperforming Patchwork++ (93.7%). The grid's spiral interpolation partially mitigates boundary artifacts. GroundGrid is already superior to Patchwork++ in temporal persistence and outlier detection.

**Code Integration Points:**
- First: tune `ground_height_above_vehicle_tolerance` from 0.2m to 0.5m in `ground_filter.yaml` (1-2 days)
- If insufficient: replace `detect_ground_patches()` with CZM-based approach (lines 328-429, ~100-line replacement)

**Industry Validation:**
- GroundGrid is already competitive or better than alternatives. The real challenge is the tolerance parameter, not the algorithm.

**Implementation Plan:**
1. First: tune existing parameter (1-2 days). Test on ramp data.
2. Only if tuning insufficient: implement full CZM (2-3 weeks).

**Value Added:** Improved ground segmentation near ramps (marginal over parameter tuning).
**Effort:** 1-2 days (tuning) to 2-3 weeks (full CZM)
**Risk:** Increasing tolerance allows obstacles at ramp height to be misclassified as ground (mitigated by distance-dependent tolerance).

---

### [PRIORITY: Low] -- #36 Acoustic Siren and Alert Detection
**Source:** Zoox, Nuro, Fraunhofer
**Feasibility:** NEEDS RESEARCH
**v1 to v2 Change:** Downgraded from Medium to Low

**What it is:** Microphone array for detecting sirens, horns, and reversing beepers.

**Current Aurrigo State:** No acoustic sensing.

**Code Integration Points:**
- New standalone `aurrigo_audio_detector` package
- Hardware: 4-8 MEMS microphones + multi-channel ADC (~$600-900/vehicle)

**Industry Validation:**
- PROBLEMATIC for airport environments. Apron ambient is 80-95 dB (aircraft idle, APU, GPUs). Fraunhofer "Hearing Car" tested at 60-70 dB public road ambient -- fundamentally different.
- Aircraft engine broadband noise masks siren/beeper frequencies. No airport-specific training data exists.
- LiDAR + thermal already provides superior detection of approaching vehicles.

**Implementation Plan:**
- NOT recommended for near-term deployment. If pursued as research:
1. Month 1: Deploy microphone array, record >100 hours airport audio
2. Month 2: Analyze if target signals separable from noise (if SNR < 10dB, abandon)
3. Month 3: If viable, implement STFT detector

**Value Added:** Marginal early warning.
**Effort:** 3+ months research before production path is clear
**Risk:** High probability of infeasibility due to noise environment. Low ROI given LiDAR+thermal coverage.

---

## Killed Recommendations

These v1 recommendations were found to be already implemented in the codebase and do not require new work (only minor enhancements noted):

### KILLED: Track Lifecycle Management with M-of-N Confirmation (v1 #10)
**Reason:** Already implemented. `TrackState` enum with TENTATIVE/CONFIRMED/LOST states exists in `kalman_tracker.hpp` line 88. `min_hits_to_confirm` defaults to 3 (line 77). `max_age_since_update` defaults to 6 frames for coasting (line 78). Cascade matching separates confirmed from tentative tracks (lines 693-782). The v1 recommendation was written without examining the actual source code.

**Minor enhancement possible:** Add sliding-window M-of-N logic (current implementation tracks cumulative hits, not hits within a window). Effort: 0.5 weeks.

### KILLED: Mahalanobis Distance Gating (v1 #11)
**Reason:** Already implemented. `mahalanobisDistance()` method at lines 302-324 computes proper Mahalanobis distance with LDLT decomposition. Chi-squared gate threshold at 9.21 (99.73% for 3 DOF). Used in `associationCost()` as secondary bonus for confirmed tracks.

**Minor enhancement possible:** Make Mahalanobis the PRIMARY gate for confirmed tracks (currently used as secondary bonus alongside Euclidean). Effort: 0.5 weeks.

### KILLED: Multi-Stage Data Association / Cascade Matching (v1 #12)
**Reason:** Already implemented. `cascadeMatch()` at lines 693-782 implements two-pass matching: confirmed tracks first (line 711), then tentative tracks with remaining detections (line 740). Uses Hungarian in each pass.

**Minor enhancement possible:** Add third stage for LOST tracks with very relaxed gates. Effort: 0.5 weeks.

---

## Revised Implementation Roadmap

### Phase 0: Bug Fixes (Week 1, <5 lines of code each)
| Item | Effort | Files |
|------|--------|-------|
| #6 ULD yaw wrapping bug | 1 day | `UldDetection.cpp` lines 414-430, 654-658 |
| #7 Rain detection orphan (quick wire-up) | 1 day | Subscribe to `~rain_state` in preprocessor or planner |

### Phase 1: Quick Wins (Weeks 1-2)
| Item | Effort | Prerequisites |
|------|--------|---------------|
| #8 Intensity Calibration | 1 week | None -- enables #9, #10, #14, #30 |
| #11 Sensor Staleness Enhancement | 1.5 weeks | None |
| #9 DSOR | 3-5 days | #8 |
| #15 Geometric Consistency (config change) | 1 day | None |

### Phase 2: Critical Safety Gaps (Weeks 2-8)
| Item | Effort | Prerequisites | Can Parallel With |
|------|--------|---------------|-------------------|
| #1 GCA System | 5-6 weeks | None | #2, #3, #4 |
| #2 Sensor Health Monitoring | 2-3 weeks | None | #1, #3, #4 |
| #3 Occupancy Grid | 2-3 weeks | None | #1, #2, #4 |
| #4 Calibration Monitoring | 3 weeks | None | #1, #2, #3 |
| #5 Multi-Return Processing | 3-4 weeks | Network bandwidth verification | #1, #2 |

### Phase 3: High-Priority Enhancements (Weeks 6-16)
| Item | Effort | Prerequisites |
|------|--------|---------------|
| #10 LIOR | 1 week | #8 |
| #12 PTP Synchronization | 2 weeks | Hardware procurement |
| #13 TTC Computation | 1-2 weeks | None |
| #14 Weather Estimation | 3-4 weeks | #7 refactor, benefits from #5 and #8 |
| #16 Negative Obstacle Detection | 3-4 weeks | None |
| #17 Track Re-Identification | 2-3 weeks | None |
| #18 RSS Safety Distance | 4 weeks | None |
| #19 Jet Blast Zone Modeling | 3-4 weeks | Airport configuration data |
| #20 LWIR Thermal Cameras | 6-8 weeks | Hardware procurement (2-4 week lead) |
| #21 ISO 26262/SOTIF | 3-4 months | Can start immediately (documentation) |

### Phase 4: Medium-Priority Improvements (Weeks 14-24)
| Item | Effort | Prerequisites |
|------|--------|---------------|
| #22 IMM Filter | 4-5 weeks | None |
| #23 Trajectory Validation | 4-6 weeks | #3, #18 |
| #24 L-Shape Fitting | 2-3 weeks | None |
| #25 UKF for ULD | 3 weeks | #6 |
| #26 4D Radar | 6-10 weeks | Hardware procurement, #12 PTP |
| #27 Temporal Consistency | 2-3 weeks | Benefits from #17 |
| #28 STL Safety Specs | 5-6 weeks | #11, #18, #19 operational |
| #29 ICP Calibration Refinement | 2 weeks | #4 validated |
| #30 Reflectivity Markings | 3-4 weeks | #8 |
| #31 Swept-Path SAT | 3-4 weeks | None |
| #32 State Machine Verification | 1-2 weeks | None |

### Phase 5: Research / Deferred Items (Weeks 24+)
| Item | Effort | Prerequisites |
|------|--------|---------------|
| #33 JPDA | 3-5 weeks | #17 deployed and evaluated |
| #34 Rulebook Framework | 3-4 weeks | #18 (RSS) |
| #35 Piecewise Ground Fitting | 1 day - 3 weeks | Only if ramp issues persist |
| #36 Acoustic Detection | 3+ months research | Site characterization data |

---

## Dependency Graph

```
                            Phase 0: Bug Fixes
                           /                   \
                    #6 Yaw Bug               #7 Rain Orphan
                       |                         |
                       v                         v
                    #25 UKF               #14 Weather Estimation
                                                 ^
                                                 |
                    #8 Intensity Calibration -----+-----> #9 DSOR
                         |                               |
                         +-----> #10 LIOR                |
                         |                               |
                         +-----> #30 Reflectivity Markings
                         |
                         +-----> #14 Weather (benefits from)

    #5 Multi-Return -----> #14 Weather (dual-return divergence metric)

    #4 Calibration Monitor -----> #29 ICP Refinement (prerequisite)

    #12 PTP Sync -----> #26 4D Radar (time alignment)

    #3 Occupancy Grid -----> #23 Trajectory Validation (drivable area)

    #18 RSS -----> #23 Trajectory Validation (hard constraints)
            \----> #34 Rulebook (RSS provides metrics)
            \----> #28 STL Specs (RSS rules encoded as STL)

    #11 Staleness -----> #28 STL Specs (staleness signals to monitor)

    #19 Jet Blast -----> #28 STL Specs (exclusion zone signals)

    #17 Track Re-ID -----> #33 JPDA (evaluate if needed after #17)

    #21 ISO 26262/SOTIF <---- (informs specifications for all others)

    Independent (no prerequisites):
    #1 GCA, #2 Sensor Health, #13 TTC, #15 Geometric Checks,
    #16 Negative Obstacles, #22 IMM, #24 L-Shape, #31 SAT,
    #32 State Machine Verification
```

### Critical Path Analysis

The longest dependency chain is:
```
#8 Intensity Calibration (1 wk) -> #10 LIOR (1 wk) -> #14 Weather (3-4 wk)
```
Total: 5-6 weeks to fully operational weather-adaptive perception.

The highest-value parallel tracks are:
- **Track A (Safety):** #1 GCA (5-6 wk) || #2 Sensor Health (2-3 wk)
- **Track B (Signal):** #8 Intensity (1 wk) -> #9 DSOR (1 wk) -> #10 LIOR (1 wk) -> #14 Weather (3-4 wk)
- **Track C (Infrastructure):** #4 Cal Monitor (3 wk) || #11 Staleness (1.5 wk) || #12 PTP (2 wk)
- **Track D (Regulatory):** #21 SOTIF (ongoing) || #18 RSS (4 wk) -> #28 STL (5-6 wk)

With 2 perception engineers and 1 safety engineer, total elapsed time to deploy all Critical and High items: approximately 16-20 weeks.

---

## Summary Statistics

| Priority | Count | Total Effort |
|----------|-------|-------------|
| Critical (including bugs) | 7 | ~17-21 weeks |
| High | 15 | ~42-57 weeks |
| Medium / Medium-High | 12 | ~38-55 weeks |
| Medium-Low / Low | 3 | ~7-10 weeks + research |
| **Killed** | **3** | **0 (already implemented)** |
| **Total Active** | **37** | **~104-143 engineer-weeks** |

**Hardware costs per vehicle:**
- LWIR Thermal (4x FLIR Boson+): ~$9,000
- 4D Radar (2-4x ARS548): ~$4,000-11,000
- PTP Grandmaster: ~$2,000
- Acoustic (if pursued): ~$800
- **Total new hardware budget: ~$15,800-22,800/vehicle**
