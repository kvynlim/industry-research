# V2 Deep Dive: Calibration & Synchronization (#6-8) and State Estimation & Tracking (#9-13)

**Date:** 2026-03-16
**Analyst:** Perception Engineering Review
**Source code verified against:** `/home/kvyn/airside-ws/src/airside_perception/`

**Pre-algorithm handoff:** Use the [Sensor-to-Algorithm Readiness Contract](sensor-to-algorithm-readiness-contract.md) to decide whether calibration, timestamp, TF, preprocessing, health, and provenance evidence is sufficient before downstream algorithms consume sensor-derived inputs.

---

## Part A: Calibration & Synchronization (Recommendations #6-8)

---

### Rec #6: Online Extrinsic Calibration Monitoring

**Original Priority:** Critical
**Revised Priority:** Critical (confirmed)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

**Code Integration Points:**

The primary integration target is the `PointcloudAggregator` class in:
- `/home/kvyn/airside-ws/src/airside_perception/airside_pointcloud_aggregator/src/PointcloudAggregator.cpp`
- `/home/kvyn/airside-ws/src/airside_perception/airside_pointcloud_aggregator/include/airside_pointcloud_aggregator/PointcloudAggregator.hpp`

**Current state of the code:**

The Aggregator already stores per-sensor clouds in `std::vector<sensor_msgs::PointCloud2> clouds_` (line 42, header) and transforms them to `target_frame_` using `tf2_ros::Buffer` (lines 132-143, cpp). It already tracks per-cloud staleness statistics (`cloud_age_sum`, `cloud_stale_count`, `cloud_tf_fail_count`). The `STALE_THRESHOLD` is hardcoded at 0.2s (line 23, header).

The 5 LiDARs are subscribed dynamically via topic array (lines 36-52, cpp). The system already has the infrastructure to identify overlap regions -- when two LiDARs share FOV, their transformed clouds occupy the same spatial region in `target_frame_`.

**Specific integration plan:**

1. **New class `CalibrationMonitor`** (separate nodelet, not inside Aggregator):
   - Subscribes to the same 5 LiDAR topics as the Aggregator.
   - For each overlapping LiDAR pair (determined from static TF geometry at startup), crops both clouds to the overlap region using `pcl::CropBox`.
   - Runs `pcl::IterativeClosestPointWithNormals` at 1Hz on cropped overlap regions.
   - Publishes registration error (translation norm, rotation angle) as `airside_perception_msgs::CalibrationHealth`.

2. **Data structures needed:**
   ```cpp
   struct CalibrationPairStatus {
     std::string sensor_a, sensor_b;
     double translation_error_m;    // ICP result - should be ~0 if calibrated
     double rotation_error_deg;     // ICP result
     double fitness_score;          // ICP fitness (mean squared error)
     ros::Time last_check;
     bool is_degraded;
   };
   ```

3. **Integration with existing DiagStats:** The Aggregator's `printDiagnostics()` (line 179) already runs on a 30s timer. Add a subscriber for calibration health to log alongside existing per-cloud diagnostics.

4. **Parameters needed:**
   - `calibration_check_hz`: 1.0 (background rate)
   - `translation_warn_threshold_m`: 0.02
   - `rotation_warn_threshold_deg`: 0.1
   - `overlap_crop_margin_m`: 2.0
   - `icp_max_iterations`: 50
   - `icp_correspondence_distance_m`: 0.5

**Industry Reality Check:**

Online calibration monitoring is standard practice at Waymo, Zoox, and Aurora. Zoox's CLAMS system (arXiv:2506.05780) specifically monitors LiDAR-to-LiDAR registration drift. IEEE research on online camera-LiDAR calibration monitoring (Moravec & Sara, IEEE T-ITS 2024) demonstrates that sensor drift detection is critical for production safety -- a finding confirmed by multiple autonomous vehicle operators.

The key practical consideration: ICP-based monitoring works well for *detecting* drift but should NOT automatically apply corrections. Automatic correction risks amplifying errors if ICP converges to a local minimum on a degenerate scene (e.g., flat ground with no features). The recommended approach is: monitor + alert + recommend recalibration, with automatic correction only in a Phase 2 after extensive validation.

**Known failure modes:**
- ICP may fail in featureless environments (flat apron with no structures). Mitigation: only compute when overlap region has sufficient geometric complexity (eigenvalue ratio check on covariance).
- Short-range overlap regions may have too few points. Mitigation: require minimum point count (e.g., 500 points) before running ICP.

For calibration failures caused by the wrong residual, inconsistent Jacobian, poor scale, brittle damping, or an invalid local model, start with the [Nonlinear Solver Diagnostics Crosswalk](../../10-knowledge-base/optimization/nonlinear-solver-diagnostics-crosswalk.md).

**Revised Implementation Plan:**
1. Create `airside_calibration_monitor` package with nodelet (1 week)
2. Implement overlap region detection from TF tree (2 days)
3. Implement ICP-based registration monitoring at 1Hz (3 days)
4. Add diagnostic publishing and alerting (2 days)
5. Test with intentionally perturbed calibration on bags (3 days)
6. Integrate alert into Aggregator diagnostics (1 day)

**Estimated effort:** 3 weeks (reduced from 3-5 -- overlap detection and ICP are straightforward with PCL)
**Dependencies:** None -- uses existing PCL and TF infrastructure.
**Testing:** Record bags with known calibration perturbation (physically shift a mount). Verify detection within 30 seconds.

**Risk Assessment:**
- ICP false alarms from degenerate geometry: MEDIUM. Mitigated by eigenvalue check.
- Computational load of 5C2=10 ICP pairs at 1Hz: LOW. Each pair is <50ms on downsampled overlap (voxel 0.1m). Total <500ms/s = 50% of one core. Run on separate thread.
- Risk of operators ignoring alerts: HIGH (human factors). Mitigated by integrating into vehicle health dashboard with severity levels.

---

### Rec #7: Hardware Time Synchronization (PTP/gPTP)

**Original Priority:** High
**Revised Priority:** High (confirmed, but urgency depends on operating speed)
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The primary integration point is the RoboSense ROS driver (external package, not in the perception stack) and the Aggregator's timestamp handling:

- `/home/kvyn/airside-ws/src/airside_perception/airside_pointcloud_aggregator/src/PointcloudAggregator.cpp` lines 96-101 (`cloudCallback`) -- currently stores raw message timestamps.
- Lines 121-128 (`update()`) -- uses `clouds_[i].header.stamp` for staleness computation: `double age = (now - clouds_[i].header.stamp).toSec()`.
- Line 136 -- TF transform uses message timestamp for lookup: `pcl_ros::transformPointCloud(target_frame_, clouds_[i], transformed, *tf_buffer_)`.

**Current timestamp flow:** The RS32 driver publishes `sensor_msgs::PointCloud2` with `header.stamp` set by ROS message arrival time (unless PTP is configured). The Aggregator trusts these timestamps for both staleness detection and TF lookup.

**RoboSense RS32 PTP support confirmed:** According to RoboSense documentation, the RS-LiDAR-32 firmware versions after V1.7 support time mode configuration, including GPS (GPRMC + PPS) and PTP (IEEE 1588v2) synchronization. The RS-Ruby Plus (their higher-end model) explicitly supports both GPS and gPTP. The RS32's PTP support needs firmware version verification on the reference airside AV stack's specific units.

**Specific integration plan:**

1. **Firmware check:** Verify RS32 firmware version is >= V1.7 on all 5 units. If not, update firmware.
2. **PTP grandmaster:** Deploy a GPS-disciplined PTP grandmaster on the vehicle Ethernet network. Options:
   - Dedicated PTP grandmaster appliance (e.g., Meinberg microSync, ~$2000)
   - Software PTP grandmaster using `linuxptp` on the compute platform with a GPS receiver providing PPS input
3. **RS32 configuration:** Set each RS32 to PTP slave mode via the sensor's web configuration interface.
4. **Driver modification:** Modify the `rslidar_sdk` ROS driver to use the LiDAR's hardware timestamp from the MSOP packet rather than `ros::Time::now()`. The rslidar_sdk already has a `use_lidar_clock` parameter that enables this.
5. **Aggregator impact:** No code changes needed in the Aggregator itself -- it already uses `header.stamp` correctly. PTP will simply make those timestamps more accurate.

**Parameters to add (driver level):**
- `use_lidar_clock: true` (in rslidar_sdk config)
- `time_sync_mode: ptp` (RS32 sensor config)

**Industry Reality Check:**

PTP is universal in production AV stacks. Waymo, Zoox, Aurora, and Motional all use GPS-disciplined PTP. The practical benefit at the reference airside AV stack's operating speeds (5-15 km/h) is modest: at 10 km/h, a 10ms sync error = 2.8cm spatial offset. This is within the LiDAR's own range accuracy (+-2cm for RS32). However, PTP becomes critical for:
- Future camera/radar integration (cameras are timestamp-sensitive)
- Moving object tracking accuracy (an aircraft at 20 km/h creates 5.5cm error per LiDAR per 10ms)
- Regulatory/certification requirements (traceability of sensor timestamps)

The RoboSense community has reported mixed experiences with PTP on RS32 units -- some firmware versions have PTP jitter issues. The `rslidar_sdk` GitHub issue #138 discusses PTP time synchronization specifically. GPS + PPS is generally more reliable on RoboSense units than PTP.

**Known failure modes:**
- PTP lock loss during GPS outage (indoor areas, tunnels): Mitigated by holdover oscillator in PTP grandmaster.
- RS32 firmware PTP jitter: If encountered, fall back to GPS + PPS synchronization.
- Network switch must support PTP pass-through or boundary clock: Verify vehicle network switch supports IEEE 1588.

**Revised Implementation Plan:**
1. Verify RS32 firmware versions, update if needed (2 days)
2. Procure and install PTP grandmaster with GPS antenna (1 week lead time for hardware)
3. Configure RS32 PTP slave mode on all 5 sensors (1 day)
4. Modify rslidar_sdk configuration to use hardware timestamps (1 day)
5. Validate timestamp accuracy with oscilloscope or PTP monitoring tool (2 days)
6. Regression test perception pipeline with hardware timestamps (2 days)

**Estimated effort:** 2 weeks (mostly hardware procurement lead time). Engineering time: ~4 days.
**Dependencies:** GPS antenna mounting, PTP-capable network switch verification.
**Testing:** Compare pre/post PTP point cloud alignment in overlap regions. Measure reduction in per-cloud age variance in Aggregator diagnostics.

**Risk Assessment:**
- RS32 PTP compatibility issues: MEDIUM. Mitigated by GPS+PPS fallback.
- Network infrastructure changes: LOW. PTP uses existing Ethernet.
- Operational disruption during rollout: LOW. PTP is transparent to the software stack.

---

### Rec #8: LiDAR-to-LiDAR Extrinsic Calibration Refinement via ICP

**Original Priority:** Medium
**Revised Priority:** Medium (downgraded slightly -- Rec #6 monitoring is more important than automatic refinement)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

**Code Integration Points:**

This builds directly on Rec #6 (Calibration Monitoring). The integration target is the same overlap region ICP infrastructure, extended with:

- TF broadcaster to publish corrected transforms
- `/home/kvyn/airside-ws/src/airside_perception/airside_pointcloud_aggregator/src/PointcloudAggregator.cpp` line 136 (`pcl_ros::transformPointCloud`) -- would benefit from corrected TF automatically

The current TF chain for each LiDAR is: `lidar_i_frame` -> `3d_base_lidar` (static transform from URDF calibration file at `/home/kvyn/airside-ws/src/airside_vehicle_description/config/<type>/<unit>.yaml`).

**Specific integration plan:**

1. **Phase 1 (Monitoring only -- same as Rec #6):** Detect drift, alert, log.
2. **Phase 2 (Refinement):** When drift exceeds threshold AND ICP fitness score is good (< 0.001), publish a corrected `lidar_i_frame` -> `3d_base_lidar` transform via `tf2_ros::StaticTransformBroadcaster`.
3. **Safety constraint:** Never apply corrections larger than 1cm translation / 0.05deg rotation in a single step. If ICP suggests a larger correction, flag for manual recalibration instead.
4. **Persistence:** Write accepted corrections to a YAML file for the next startup.

**Data structures:**
```cpp
struct CalibrationCorrection {
  std::string sensor_frame;
  Eigen::Isometry3d correction_tf;  // Small delta from nominal
  double confidence;                 // ICP fitness score
  int consecutive_agreements;        // How many runs agreed on this correction
  bool approved_for_application;     // Requires N consecutive agreements
};
```

**Industry Reality Check:**

Online ICP-based calibration refinement is used by Waymo and Kodiak, but with extreme caution. The industry consensus is:
- **Monitoring is safe and recommended.** Deploy immediately.
- **Automatic correction is risky.** ICP can converge to wrong solutions on degenerate geometry (long flat walls, ground-only overlap). Most production systems require human approval or very strict convergence criteria before applying corrections.
- Kodiak's approach: post-shift calibration analysis (offline), not online correction.
- Zoox CLAMS: monitors continuously, flags for recalibration, does not auto-correct.

The recommendation is to implement monitoring (Rec #6) first and defer automatic refinement to Phase 2 after extensive validation.

**Known failure modes:**
- ICP local minimum on degenerate scenes: HIGH risk. Mitigated by convergence validation (eigenvalue analysis, fitness score threshold, multi-run consistency).
- Applying incorrect correction degrades fusion worse than the original drift: CRITICAL. Mitigated by delta magnitude limits and N-of-M agreement requirement.
- Corrected TF conflicts with URDF-published static TF: MEDIUM. Requires careful TF tree management.

**Revised Implementation Plan:**
1. Implement Rec #6 monitoring first (prerequisite, 3 weeks)
2. Add correction computation with strict validation (1 week)
3. Add correction persistence and startup loading (2 days)
4. Extensive testing: intentionally perturb each LiDAR mount, verify correction (1 week)
5. Deploy monitoring-only for 1 month before enabling auto-correction

**Estimated effort:** 2 weeks incremental on top of Rec #6 (total 5 weeks for both).
**Dependencies:** Rec #6 must be deployed and validated first.
**Testing:** Physically shift LiDAR mounts by known amounts (1cm, 2cm, 5cm). Verify ICP detects and correctly estimates the shift. Test on degenerate scenes (flat apron) to verify no false corrections.

**Risk Assessment:**
- Incorrect correction applied: CRITICAL. Mitigated by delta limits, N-of-M agreement, and initial monitoring-only deployment.
- Computational load: LOW. Same as Rec #6.
- TF tree conflict: MEDIUM. Requires careful implementation to override static TF correctly.

---

## Part B: State Estimation & Tracking Upgrades (Recommendations #9-13)

---

### Rec #9: Interacting Multiple Model (IMM) Filter

**Original Priority:** Critical
**Revised Priority:** High (downgraded -- the existing 4-state CV Kalman already handles the reference airside AV stack's low-speed domain reasonably well)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

**Code Integration Points:**

The tracker lives in:
- `/home/kvyn/airside-ws/src/airside_perception/airside_polygon_detector/src/kalman_tracker.cpp`
- `/home/kvyn/airside-ws/src/airside_perception/airside_polygon_detector/include/airside_polygon_detector/kalman_tracker.hpp`

**Current Kalman architecture (verified from source):**

The `KalmanTracker` class (kalman_tracker.hpp line 20) uses:
- **State:** `[x, y, vx, vy]` -- 4-state constant velocity model (lines 59, 179)
- **Measurement:** `[x, y, vx, vy]` -- both position AND velocity measured directly (line 180-181)
- **Backend:** OpenCV `cv::KalmanFilter` (line 181)
- **Z tracking:** Separate, not part of Kalman state (line 184, `float last_z_`)
- **Process noise Q:** Diagonal `[1e-2, 1e-2, 1e-2, 1e-2]` (line 90-92, cpp)
- **Measurement noise R:** Diagonal `[1e-2, 1e-2, 1e-2, 1e-2]` (line 96-98, cpp)
- **Velocity measured from position difference** and fed as measurement (lines 166-188, cpp)

The `MultiObjectKalmanTracker` (line 216, hpp) manages multiple `KalmanTracker` instances with Hungarian assignment via `HungarianSolver` (line 268, hpp).

**IMM integration design:**

The IMM would wrap the existing `KalmanTracker` as one model in a bank. The key challenge: `cv::KalmanFilter` is used directly, and IMM requires state mixing between models with *different state dimensions*.

**Option A (Recommended): Same-dimension IMM**
- All 3 models use `[x, y, vx, vy]` state (4-state)
- CV model: current implementation unchanged (F matrix has vx*dt, vy*dt)
- CA model: approximate acceleration by increasing Q for velocity states
- CTRV model: use EKF-style linearization with turn rate estimated from velocity direction change

```cpp
class IMMTracker {
  struct ModelBank {
    cv::KalmanFilter kf_cv;    // Constant velocity
    cv::KalmanFilter kf_ca;    // Constant acceleration (high Q on velocity)
    cv::KalmanFilter kf_ctrv;  // Constant turn rate (requires Jacobian)
    Eigen::Vector3d model_prob; // [p_cv, p_ca, p_ctrv]
    Eigen::Matrix3d transition_prob; // Model transition probability matrix
  };
  // ... mixed state and covariance computation
};
```

**Option B: Different-dimension models (complex)**
- CV: 4 states, CA: 6 states, CTRV: 5 states
- Requires state augmentation/projection for mixing step
- IEEE paper (2022) addresses this specific problem but adds significant complexity

**Why Priority is downgraded from Critical to High:**

After reading the actual code, the current tracker is already more sophisticated than the recommendation assumed:
1. It already measures velocity directly (not derived from acceleration model) -- this is the key insight from LiDAR-Tracking.
2. It uses velocity deque filtering with outlier rejection (lines 512-548, cpp) -- handles velocity spikes.
3. Cascade matching (confirmed tracks first, then tentative) is already implemented (lines 693-782, cpp).
4. The airport domain operates at 5-15 km/h with gentle maneuvers. The CV model is adequate for most scenarios. IMM's main benefit (turning vehicles at highway speeds) is less critical here.

IMM becomes important when tracking *other* airport vehicles (tugs turning around aircraft noses, aircraft taxiing) that maneuver more aggressively. It is a real improvement but not "Critical" for the current operational envelope.

**Industry Reality Check:**

IMM is deployed at Waymo, Kodiak, and Motional for highway tracking. Recent research (IMM-MOT, arXiv:2502.09672, 2025) demonstrates 73.8% AMOTA on NuScenes with IMM, outperforming single-model trackers. However, most of the benefit comes from highway scenarios with sharp lane changes and sudden braking -- exactly the scenarios that are *uncommon* on an airport apron.

For low-speed airport operations, the practical benefit of IMM over a well-tuned CV model is moderate (5-15% tracking accuracy improvement based on literature). The engineering cost is significant because `cv::KalmanFilter` does not natively support IMM, requiring either a custom implementation or switching to a different filter library (e.g., Eigen-based).

**Known failure modes:**
- IMM model probability convergence lag: When transitioning between models, there is a 2-3 frame delay before the correct model dominates. At 10Hz, this is 200-300ms.
- CTRV model requires turn rate estimation, which is noisy for LiDAR-only tracking.
- Over-parameterized for slow-moving objects: IMM adds 3x the computation for minimal benefit on stationary/slow objects.

**Revised Implementation Plan:**
1. Implement same-dimension IMM wrapper class with CV and CA models (2 weeks)
2. Add CTRV model with simple Jacobian computation (1 week)
3. Tune transition probability matrix on recorded airport bags (1 week)
4. A/B test against current tracker on representative scenarios (1 week)
5. Make IMM enable/disable a config parameter (1 day)

**Estimated effort:** 4-5 weeks (increased from 3-4 due to cv::KalmanFilter limitations requiring custom mixing code)
**Dependencies:** None. Self-contained within kalman_tracker.
**Testing:** Compare tracking metrics (MOTA, identity switches, position RMSE) on bags with maneuvering vehicles.

**Risk Assessment:**
- Regression on stationary/slow object tracking: MEDIUM. IMM adds noise from model switching. Mitigated by high self-transition probability (0.95).
- Computational cost 3x per tracked object: LOW impact (tracking is not the bottleneck).
- Complexity increase in maintenance: MEDIUM. IMM is harder to tune than single-model.

---

### Rec #10: Track Lifecycle Management with M-of-N Confirmation

**Original Priority:** High
**Revised Priority:** Low (ALREADY IMPLEMENTED)
**Feasibility Verdict:** ALREADY EXISTS IN CODEBASE

**Code Integration Points (verification):**

The recommendation assumed no track lifecycle management. **This is incorrect.** The code already implements a full lifecycle:

1. **TrackState enum** (kalman_tracker.hpp line 88):
   ```cpp
   enum class TrackState {
     TENTATIVE,    // New track, not yet confirmed
     CONFIRMED,    // Track with sufficient hits
     LOST          // Track lost but may recover
   };
   ```

2. **M-of-N confirmation** (kalman_tracker.cpp line 227-231):
   ```cpp
   if (state_ == TrackState::TENTATIVE && hit_count_ >= config_.min_hits_to_confirm) {
     state_ = TrackState::CONFIRMED;
   } else if (state_ == TrackState::LOST && hit_count_ >= config_.min_hits_to_maintain) {
     state_ = TrackState::CONFIRMED;
   }
   ```
   - `min_hits_to_confirm` defaults to 3 (hpp line 77)
   - `max_age_since_update` defaults to 6 frames for coasting (hpp line 78)

3. **Track deletion** (kalman_tracker.cpp lines 430-447):
   ```cpp
   bool KalmanTracker::shouldDelete() const {
     if (time_since_update_ >= invisible_threshold) {
       return true;
     }
     return false;
   }
   ```

4. **Cascade matching** separates confirmed from tentative tracks (kalman_tracker.cpp lines 693-782), preventing tentative tracks from stealing detections.

5. **Config parameters** are all exposed in `polygon_detector.yaml`:
   - `min_hits_for_basic_track: 1` (fast initial confirmation)
   - `refined_max_age_since_update: 6` (coasting frames)
   - `min_frames_for_refined: 3` (refined output requires stability)

**What could still be improved:**

The current implementation lacks a formal **M-of-N window** (it tracks cumulative hits, not "3 hits within the last 5 frames"). If a track gets 3 hits in frames 1-3, then is missed for 100 frames, it stays confirmed. A true M-of-N sliding window would be more robust.

**Revised recommendation:** Add optional sliding-window M-of-N logic:
```cpp
// In KalmanTracker, add:
std::deque<bool> recent_hit_history_;  // Last N frames: true=hit, false=miss
int window_size_ = 5;  // N
int min_hits_in_window_ = 3;  // M
```

**Estimated effort:** 0.5 weeks (minor enhancement, not a new feature).

---

### Rec #11: Mahalanobis Distance Gating for Data Association

**Original Priority:** High
**Revised Priority:** Low (ALREADY IMPLEMENTED)
**Feasibility Verdict:** ALREADY EXISTS IN CODEBASE

**Code Integration Points (verification):**

The recommendation assumed Euclidean-only distance. **This is incorrect.** The code already implements Mahalanobis distance:

1. **`mahalanobisDistance()` method** (kalman_tracker.cpp lines 302-324):
   ```cpp
   double KalmanTracker::mahalanobisDistance(const Eigen::Vector3f& position) const {
     Eigen::Vector3f predicted_pos = getPosition();
     Eigen::Matrix3f cov = getPositionCovariance();
     cov += Eigen::Matrix3f::Identity() * meas_var;
     Eigen::LDLT<Eigen::Matrix3f> ldlt(cov);
     Eigen::Vector3f cov_inv_diff = ldlt.solve(diff);
     double distance = diff.transpose() * cov_inv_diff;
     return std::sqrt(std::max(0.0, distance));
   }
   ```

2. **`getPositionCovariance()` method** (kalman_tracker.cpp lines 291-300):
   Extracts the 3x3 position covariance from the Kalman error covariance matrix.

3. **Mahalanobis used in association cost** (kalman_tracker.cpp lines 389-397):
   ```cpp
   if (state_ == TrackState::CONFIRMED) {
     double maha_dist = mahalanobisDistance(position);
     if (maha_dist < config_.mahalanobis_gate_threshold) {
       maha_bonus = -0.1 * (1.0 - maha_dist / config_.mahalanobis_gate_threshold);
     }
   }
   ```

4. **Chi-squared gate threshold** (kalman_tracker.hpp line 75):
   `mahalanobis_gate_threshold(9.21)` -- Chi-squared 99.73% for 3 DOF.

**However**, the current implementation uses Mahalanobis as a secondary *bonus* for confirmed tracks, not as a primary gating mechanism. The primary cost is Euclidean distance (lines 338, 386). This is actually the LiDAR-Tracking approach (Euclidean primary, with bbox size ratio check), which the code explicitly documents as being more robust for LiDAR.

**What could still be improved:**

Replace the hard Euclidean gate (`max_association_distance: 5.0m`) with a proper Mahalanobis gate as the primary filter. For confirmed tracks with low uncertainty, this would be tighter and more accurate. For young/uncertain tracks, Mahalanobis naturally widens.

**Revised recommendation:** Make Mahalanobis the primary gate for confirmed tracks, keep Euclidean as fallback for tentative tracks:
```cpp
// In associationCost(), change for confirmed tracks:
if (state_ == TrackState::CONFIRMED) {
  double maha_dist = mahalanobisDistance(position);
  if (maha_dist > config_.mahalanobis_gate_threshold) {
    return 1e9;  // Hard Mahalanobis gate
  }
  distance_cost = maha_dist;  // Use Mahalanobis as primary cost
}
```

**Estimated effort:** 0.5 weeks (modify existing `associationCost()` function).

---

### Rec #12: Multi-Stage Data Association (Cascade Matching)

**Original Priority:** Medium
**Revised Priority:** Low (ALREADY IMPLEMENTED)
**Feasibility Verdict:** ALREADY EXISTS IN CODEBASE

**Code Integration Points (verification):**

The recommendation assumed single-pass association. **This is incorrect.** Cascade matching is already implemented:

1. **`cascadeMatch()` method** (kalman_tracker.cpp lines 693-782):
   - **Pass 1** (line 711): Match confirmed tracks first using `buildCostMatrix(detections, confirmed_indices)`.
   - **Pass 2** (line 740): Match tentative tracks with remaining (unmatched) detections.
   - Uses Hungarian algorithm (`hungarianAssignment()`) in each pass.

2. **Configuration** (polygon_detector.yaml line 188):
   `enable_cascade_matching: true`

3. **The code explicitly implements the Deep SORT / CasTrack pattern** of priority-based matching.

**What could still be improved:**

The current implementation has 2 stages (confirmed, tentative). The Waymo CasTrack approach uses 3 stages with progressively relaxed gating thresholds. Adding a third stage for "lost/coasting" tracks with very relaxed gates would improve track re-identification.

**Revised recommendation:** Add Stage 3 for LOST tracks:
```cpp
// In cascadeMatch(), add after Pass 2:
// Pass 3: Match LOST tracks with very relaxed threshold
std::vector<size_t> lost_indices;
for (size_t i = 0; i < trackers_.size(); ++i) {
  if (trackers_[i]->getState() == TrackState::LOST) {
    lost_indices.push_back(i);
  }
}
// Use 2x max_association_cost_ for LOST tracks
```

**Estimated effort:** 0.5 weeks (extend existing cascade logic).

---

### Rec #13: Unscented Kalman Filter (UKF) for ULD Tracking

**Original Priority:** Medium
**Revised Priority:** Medium (confirmed, but with significant caveats)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

**Code Integration Points:**

The ULD tracking code is in:
- `/home/kvyn/airside-ws/src/airside_perception/airside_uld_detection/src/UldDetection.cpp`
- `/home/kvyn/airside-ws/src/airside_perception/airside_uld_detection/include/airside_uld_detection/UldDetection.h`

**Current ULD tracking architecture (verified from source):**

Critical finding: **The ULD detector does NOT use a Kalman/EKF filter at all.** The recommendation's premise is incorrect.

The actual ULD tracking uses:
1. **Line fitting on intensity-grouped point clouds** (UldDetection.cpp lines 200-393): Two intensity groups are identified, lines are fit via PCA eigendecomposition, and the intersection of the two lines gives the ULD corner position.
2. **Moving average filter for position** (lines 396-412): `std::deque<Eigen::Vector2f> position_history_` with window size 3.
3. **Moving average filter for yaw** (lines 414-430): `std::deque<double> yaw_history_` with window size 3.
4. **No Kalman filter, no EKF, no state estimation.** The pose is computed geometrically from the point cloud and smoothed with moving averages.

Similarly, the `cloudUldOnVehicleCallback` (lines 532-688) uses the same pattern: line fitting + moving average smoothing.

**What a UKF would actually replace:** The moving average filters. A UKF would provide:
- Proper state estimation with uncertainty tracking
- Prediction capability (maintain estimate during brief occlusions)
- Velocity estimation for the ULD (currently not tracked)
- Orientation continuity (moving average can't handle angle wrapping properly -- see lines 654-658 where yaw average is computed without angle wrapping)

**Critical bug found:** The yaw moving average (lines 414-430 and 654-658) computes a simple arithmetic mean of angles. This breaks near angle wrapping (e.g., averaging -179 deg and +179 deg gives 0 deg instead of 180 deg). A UKF or even a simple circular mean would fix this.

**Specific integration plan:**

1. **New class `UldStateEstimator`** to replace the moving average filters:
   ```cpp
   class UldStateEstimator {
     // State: [x, y, yaw, v_x, v_y, yaw_rate] -- 6 states
     // Measurement: [x, y, yaw] -- from geometric line fitting
     Eigen::VectorXd state_;        // 6x1
     Eigen::MatrixXd P_;            // 6x6 covariance
     Eigen::MatrixXd Q_;            // 6x6 process noise
     Eigen::MatrixXd R_;            // 3x3 measurement noise

     void predict(double dt);       // Sigma point propagation
     void update(double x, double y, double yaw);  // Measurement update

     // Sigma point generation
     Eigen::MatrixXd generateSigmaPoints() const;
   };
   ```

2. **Integration in `UldDetection::publishPoseAndVisualization()`** (line 102):
   - After computing `intersection_corner` and `yaw` from line fitting, feed as measurement to UKF instead of moving average.
   - UKF output replaces lines 396-430 (position/yaw filtering).

3. **Integration in `UldDetection::cloudUldOnVehicleCallback()`** (line 532):
   - Similar replacement of moving average with separate UKF instance.

4. **Parameters needed:**
   ```yaml
   # ULD UKF parameters
   ukf_process_noise_position: 0.01   # m^2/s
   ukf_process_noise_yaw: 0.001       # rad^2/s
   ukf_process_noise_velocity: 0.1    # m^2/s^2
   ukf_measurement_noise_position: 0.05  # m
   ukf_measurement_noise_yaw: 0.1     # rad
   ukf_alpha: 0.001                   # Sigma point spread
   ukf_beta: 2.0                      # Prior knowledge (Gaussian)
   ukf_kappa: 0.0                     # Secondary scaling
   ```

**Industry Reality Check:**

UKF vs EKF for orientation tracking is well-studied. Practical comparisons show UKF provides lower RMSE for yaw estimation (by 10-30% vs EKF) when the measurement model is nonlinear. For the ULD case, the measurement model is actually *linear* (direct x, y, yaw observation), so the UKF's nonlinear advantage comes only from the *process model* (constant turn rate is nonlinear in yaw).

The bigger win here is not UKF vs EKF -- it is **any state estimator vs. moving average**. The moving average:
- Cannot predict during occlusion (output freezes on last value)
- Introduces a fixed delay of (window_size - 1) / 2 frames
- Breaks on angle wrapping (confirmed bug in code)
- Provides no uncertainty estimate

Even a linear KF would be a massive improvement over the current moving average. A UKF provides additional benefit for the yaw angle state.

**Known failure modes:**
- UKF sigma points can degenerate with poor alpha/beta/kappa tuning: MEDIUM. Use standard values (alpha=0.001, beta=2, kappa=0).
- UKF is more expensive than EKF (~3x for 6 states): LOW impact. ULD detection runs once per frame on a single object.
- UKF covariance matrix can become non-positive-definite due to numerical issues: LOW. Use Cholesky decomposition (SRUKF variant) for robustness.

**Revised Implementation Plan:**
1. Fix the immediate yaw averaging bug (circular mean) as a quick win (1 day)
2. Implement `UldStateEstimator` class with UKF using Eigen (1.5 weeks)
3. Integrate into `UldDetection` replacing moving average filters (3 days)
4. Tune process/measurement noise on recorded bags (3 days)
5. Test occlusion handling (ULD briefly blocked by vehicle) (2 days)
6. Add uncertainty output to pose message (1 day)

**Estimated effort:** 3 weeks
**Dependencies:** None. Self-contained within uld_detection.
**Testing:** Compare pose estimation accuracy and smoothness on recorded bags. Specifically test:
- ULD approach from different angles
- Brief occlusion (1-2s) and recovery
- Yaw estimation near wrapping boundaries (179 to -179 deg)

**Risk Assessment:**
- Regression vs. moving average: LOW. UKF strictly dominates moving average.
- Implementation bugs in sigma point generation: MEDIUM. Use well-tested reference implementations. Consider using the `robot_localization` package's UKF as reference.
- Tuning difficulty: MEDIUM. UKF has more parameters than moving average but standard values work for most cases.

---

## Part C: Additional Recommendations from Sections 5 and 8

---

### Rec: JPDA (Joint Probabilistic Data Association) -- Section 8.1

**Original Priority:** High
**Revised Priority:** Medium (the existing Hungarian + cascade is already robust)
**Feasibility Verdict:** FEASIBLE BUT QUESTIONABLE VALUE

**Code Integration Points:**

Would replace the `hungarianAssignment()` method in `MultiObjectKalmanTracker` (kalman_tracker.cpp line 677) and the cascade matching logic (lines 693-782).

**Current system already addresses the core problem JPDA solves:**
- Cascade matching (confirmed first, then tentative) prevents ID stealing
- Euclidean + Mahalanobis + bbox size ratio multi-criterion cost function
- Velocity deque filtering for outlier rejection
- `max_association_cost_: 5.0` (5m gate from LiDAR-Tracking)

**Industry Reality Check:**

JPDA is theoretically superior to Hungarian in cluttered environments because it uses soft association (weighted update from multiple detections). However:
- JPDA computational cost is O(2^N) in the worst case for N detections in a gate, requiring approximations for practical use.
- In airport apron environments, objects are generally well-separated (ULDs, tugs, loaders are not stacked on top of each other at pixel level). The "closely spaced objects" scenario that JPDA excels at is more common in dense highway traffic.
- Modern cascade matching with tight gating achieves most of JPDA's benefit at a fraction of the cost.

The practical improvement from JPDA over the current cascade+Hungarian would be marginal (< 5% reduction in identity switches based on literature comparisons in similar-density environments).

**Revised recommendation:** Defer to Phase 5 as originally planned. The existing tracker is already quite capable. If identity switches are observed as a real problem in production, JPDA should be revisited.

**Estimated effort:** 4 weeks (implementing JPDA with approximation for computational tractability)

---

### Rec: Track Re-Identification After Occlusion -- Section 8.2

**Original Priority:** Medium
**Revised Priority:** Medium (confirmed, genuine gap)
**Feasibility Verdict:** FEASIBLE

**Code Integration Points:**

The deletion logic in `KalmanTracker::shouldDelete()` (kalman_tracker.cpp lines 430-447) currently deletes tracks after `max_age_since_update` (default 6) consecutive misses. Once deleted, the track is gone permanently.

```cpp
// Current code (kalman_tracker.cpp line 820-827):
void MultiObjectKalmanTracker::pruneDeadTracks() {
  trackers_.erase(
      std::remove_if(trackers_.begin(), trackers_.end(),
                    [](const TrackerPtr& tracker) {
                      return tracker->shouldDelete();
                    }),
      trackers_.end());
}
```

**This is a genuine gap.** When an object is occluded for >0.6s (6 frames at 10Hz), the track is deleted. When it reappears, a new track is created with a new ID, losing all velocity history and requiring re-confirmation.

**Specific integration plan:**

1. **Add `DORMANT` state** to `TrackState` enum (kalman_tracker.hpp line 88):
   ```cpp
   enum class TrackState {
     TENTATIVE,
     CONFIRMED,
     LOST,
     DORMANT  // Deleted from active tracking but stored for re-identification
   };
   ```

2. **New dormant track store** in `MultiObjectKalmanTracker`:
   ```cpp
   std::vector<TrackerPtr> dormant_trackers_;  // Tracks waiting for re-ID
   int max_dormant_age_ = 50;  // 5 seconds at 10Hz
   ```

3. **Modified `pruneDeadTracks()`**:
   ```cpp
   void MultiObjectKalmanTracker::pruneDeadTracks() {
     for (auto it = trackers_.begin(); it != trackers_.end(); ) {
       if ((*it)->shouldDelete()) {
         if ((*it)->isConfirmed() || (*it)->getState() == TrackState::LOST) {
           // Move to dormant instead of deleting
           (*it)->setState(TrackState::DORMANT);
           dormant_trackers_.push_back(*it);
         }
         it = trackers_.erase(it);
       } else {
         ++it;
       }
     }
     // Prune truly old dormant tracks
     dormant_trackers_.erase(
       std::remove_if(dormant_trackers_.begin(), dormant_trackers_.end(),
         [this](const TrackerPtr& t) { return t->getAge() > max_dormant_age_; }),
       dormant_trackers_.end());
   }
   ```

4. **Re-identification in `createNewTracker()`**:
   ```cpp
   void MultiObjectKalmanTracker::createNewTracker(const Detection& detection) {
     // Check dormant tracks first
     double best_cost = max_dormant_association_cost_;  // e.g., 8.0m
     TrackerPtr best_dormant = nullptr;
     for (auto& dormant : dormant_trackers_) {
       double cost = dormant->associationCost(detection.position, detection.dimensions);
       if (cost < best_cost) {
         best_cost = cost;
         best_dormant = dormant;
       }
     }
     if (best_dormant) {
       // Reactivate dormant track with original ID
       best_dormant->update(detection.position, detection.dimensions);
       best_dormant->setState(TrackState::CONFIRMED);
       trackers_.push_back(best_dormant);
       dormant_trackers_.erase(
         std::remove(dormant_trackers_.begin(), dormant_trackers_.end(), best_dormant),
         dormant_trackers_.end());
       ROS_DEBUG("Re-identified track %d from dormant", best_dormant->getId());
       return;
     }
     // No dormant match -- create new track
     auto tracker = std::make_shared<KalmanTracker>(
         next_id_++, detection.position, detection.dimensions, config_);
     trackers_.push_back(tracker);
   }
   ```

5. **Parameters needed:**
   ```yaml
   max_dormant_age_frames: 50          # 5s at 10Hz
   max_dormant_association_cost: 8.0   # Relaxed gate for re-ID (wider than normal)
   enable_track_reidentification: true
   ```

**Industry Reality Check:**

Track re-identification is standard practice at Waymo, Zoox, and most production trackers. The 3-stage approach (active -> lost -> dormant -> reactivated) is well-established. Research confirms that re-identification after 1-5 seconds of occlusion is feasible with position + dimension matching, with longer occlusions requiring appearance features (not applicable to LiDAR-only).

The key practical challenge is **false re-identification**: matching a new object to a dormant track of a different object that happened to be nearby. Dimension matching and velocity consistency checks are essential to prevent this.

**Known failure modes:**
- False re-ID when a different object appears near a dormant track's predicted position: MEDIUM. Mitigated by dimension consistency check and relaxed-but-bounded gate.
- Memory growth from many dormant tracks: LOW. Bounded by `max_dormant_age_` and dormant list pruning.
- Dormant track position prediction diverges: The Kalman predictor extrapolates with constant velocity, which becomes increasingly wrong over time. Mitigated by widening the association gate with dormant age.

**Revised Implementation Plan:**
1. Add `DORMANT` state and dormant track store (2 days)
2. Modify `pruneDeadTracks()` to move tracks to dormant (1 day)
3. Implement re-identification logic in `createNewTracker()` (3 days)
4. Add dimension consistency check for re-ID (1 day)
5. Tune parameters on bags with known occlusion events (3 days)
6. Test: verify track ID continuity through brief occlusions (2 days)

**Estimated effort:** 2 weeks
**Dependencies:** None. Self-contained within kalman_tracker.
**Testing:** Use bags where vehicles pass behind parked objects. Verify same track ID is maintained through 1-3 second occlusions.

**Risk Assessment:**
- False re-identification: MEDIUM. Mitigated by dimension check and bounded gate.
- Increased complexity in track management: LOW. Well-understood pattern.
- Performance impact: NEGLIGIBLE. Dormant track list is small.

---

## Summary Table

| Rec # | Name | Original Priority | Revised Priority | Status | Effort |
|-------|------|------------------|-----------------|--------|--------|
| 6 | Online Calibration Monitoring | Critical | Critical | FEASIBLE | 3 weeks |
| 7 | PTP Time Synchronization | High | High | FEASIBLE | 2 weeks |
| 8 | ICP Calibration Refinement | Medium | Medium | FEASIBLE WITH MODS | 2 weeks (after #6) |
| 9 | IMM Filter | Critical | **High** | FEASIBLE WITH MODS | 4-5 weeks |
| 10 | Track Lifecycle M-of-N | High | **Low** | ALREADY EXISTS | 0.5 weeks (minor tweak) |
| 11 | Mahalanobis Gating | High | **Low** | ALREADY EXISTS | 0.5 weeks (minor tweak) |
| 12 | Multi-Stage Association | Medium | **Low** | ALREADY EXISTS | 0.5 weeks (add 3rd stage) |
| 13 | UKF for ULD Tracking | Medium | Medium | FEASIBLE WITH MODS | 3 weeks |
| -- | JPDA (Section 8.1) | High | **Medium** | FEASIBLE, LOW VALUE | 4 weeks (defer) |
| -- | Track Re-ID (Section 8.2) | Medium | Medium | FEASIBLE | 2 weeks |

**Key findings:**
1. **Recommendations #10, #11, #12 are already implemented** in the current codebase. The v1 recommendations were written without examining the actual source code. The tracker already has TrackState lifecycle, Mahalanobis distance computation, and cascade matching.
2. **Recommendation #9 (IMM) is downgraded** from Critical to High because the existing 4-state CV model with velocity measurement is already well-suited for the low-speed airport domain.
3. **Recommendation #13 (UKF for ULD) has a different rationale than expected** -- the ULD detector uses moving average filters, not EKF. The improvement from UKF over moving average is much larger than from UKF over EKF.
4. **A yaw angle wrapping bug was found** in UldDetection.cpp (lines 414-430 and 654-658) that causes incorrect averaging near +/-180 degrees.
5. **Track re-identification (Section 8.2) is a genuine gap** worth implementing.

**Recommended implementation order:**
1. Fix ULD yaw wrapping bug (1 day, immediate)
2. Online calibration monitoring (#6) (3 weeks)
3. PTP synchronization (#7) (2 weeks, parallel with #6)
4. Track re-identification (2 weeks)
5. UKF for ULD tracking (#13) (3 weeks)
6. ICP calibration refinement (#8) (2 weeks, after #6 validated)
7. IMM filter (#9) (4-5 weeks, Phase 3)
8. JPDA (4 weeks, Phase 5 or later)

---

## Sources

Industry validation research:
- [IMM-MOT: 3D Multi-object Tracking with IMM Filter](https://arxiv.org/html/2502.09672v1) -- 73.8% AMOTA on NuScenes
- [RoboSense PTP/GPS Time Synchronization FAQ](https://store.robosense.ai/pages/faq-hardware-lidar-time-synchronization-gps-ptp)
- [rslidar_sdk PTP Time Synchronization Issue #138](https://github.com/RoboSense-LiDAR/rslidar_sdk/issues/138)
- [Online Camera-LiDAR Calibration Monitoring and Rotational Drift Tracking (IEEE 2024)](https://ieeexplore.ieee.org/document/10374278/)
- [Probabilistic 3D Multi-Object Tracking (NeurIPS 2019, Mahalanobis 3D MOT)](https://github.com/eddyhkchiu/mahalanobis_3d_multi_object_tracking)
- [CasTrack: Cascade Matching for Waymo 3D MOT](https://github.com/hailanyi/CasTrack-waymo)
- [JPDA Revisited (ICCV 2015)](https://ieeexplore.ieee.org/document/7410706/)
- [Joint Probabilistic Data Association Multi Object Tracker (MathWorks)](https://www.mathworks.com/help/fusion/ref/jointprobabilisticdataassociationmultiobjecttracker.html)
- [UKF vs EKF for LiDAR/Radar Tracking Comparison](https://junshengfu.github.io/tracking-with-Unscented-Kalman-Filter/)
- [IMM Filtering for Vehicle Motion Models with Unequal States (IEEE 2022)](https://ieeexplore.ieee.org/document/9695349/)
- [RobMOT: Robust 3D MOT by State Estimation Drift Mitigation](https://arxiv.org/html/2405.11536v4)
