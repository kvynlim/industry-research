# V2 Deep Dive: Sensor Fusion, Geometric Methods, and Data Association

**Recommendations #22-29 Feasibility Analysis**
**Date: 2026-03-16**

This section covers three clusters of recommendations from the v1 document:
- **Sensor Fusion & New Modalities** (#22-24): LWIR Thermal, Acoustic Detection, 4D Imaging Radar
- **Geometric Methods** (#25-27): Reflectivity-Based Markings, L-Shape Fitting, Swept-Path Collision
- **Data Association & Track Management** (#28-29): JPDA, Track Re-Identification

Each recommendation has been verified against the actual reference airside AV stack perception source code to identify precise integration points, incompatibilities, and realistic implementation plans.

---

## Codebase Architecture Summary (for context)

The perception stack runs as a nodelet pipeline under a shared `perception_nodelet_manager` (16 worker threads):

```
perception.launch pipeline:
  PointcloudAggregator (5x RS32 LiDAR -> single cloud @ 10Hz)
    -> PointcloudPreprocessor (cropbox, voxel, SOR)
      -> GroundGrid (ground/non-ground separation)
        -> PointcloudSegmentation (deck/trailer/ULD segmentation)
          -> DeckDetection (RANSAC edge fitting, waypoint generation)
          -> UldDetection (PCA + EKF pose estimation, ICP refinement)
          -> TrailerDetection
        -> PolygonDetector (spherical clustering + Kalman tracking + Hungarian assignment)
```

Key data structures:
- `sensor_msgs::PointCloud2` flows between all nodes
- `Box` struct (polygon_detector): `{id, position(Vector3f), polygon_vertices(vector<Vector2f>), z_min, z_max, velocity(Vector3f), tracking_count, has_velocity}`
- `KalmanTracker`: 4-state `[x, y, vx, vy]` with OpenCV KalmanFilter, velocity measured from position diff
- `MultiObjectKalmanTracker`: manages vector of `KalmanTracker`, uses Hungarian assignment with cascade matching
- `UldEkf`: 3-state `[px, py, theta]` with diagonal covariance, static process model (no velocity states)
- `airside_perception_msgs::DetectedObjectArray` is the output message type

---

## 6. Sensor Fusion & New Modalities

### Rec #22: LWIR Thermal Camera Integration

**Original Priority:** High
**Revised Priority:** High (confirmed -- this is the single most impactful hardware addition for worker safety)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

#### Code Integration Points

**1. New ROS Node: `airside_thermal_detector`**

This requires a standalone ROS node (NOT a nodelet in the perception pipeline) because thermal processing is independent of the LiDAR pipeline and should not block or be blocked by it.

```
New package: airside_thermal_detector/
  src/ThermalDetector.cpp          -- blob detection, temperature thresholding
  src/ThermalFusion.cpp            -- BEV gated nearest-neighbor with LiDAR tracks
  src/ThermalDetectorNodelet.cpp   -- optional nodelet wrapper
  include/...
  config/thermal_detector.yaml
  launch/thermal_detector.launch
```

**2. Fusion with existing PolygonDetector output**

The fusion node subscribes to:
- `/obstacle_detector/detected_objects_refined` (from PolygonDetector, `airside_perception_msgs::DetectedObjectArray`)
- `/thermal_detector/detections` (new topic, custom msg with BEV position + confidence)

Integration point in the PolygonDetector node (`polygon_detector_node.cpp` line 812, `lidarPointsCallback`): The thermal fusion should NOT be embedded inside this callback. Instead, a separate fusion node receives both streams and publishes a merged `/perception/fused_objects` topic. This keeps the LiDAR pipeline's tight 10Hz loop unaffected.

**3. Aggregator modification for multi-modal staleness**

The `PointcloudAggregator::update()` method (line 97-170) already implements staleness checking with `STALE_THRESHOLD`. The thermal fusion node needs analogous staleness logic: if thermal data is >200ms stale, fall back to LiDAR-only output rather than fusing stale thermal detections.

**4. Launch file integration**

Add to `perception.launch` (after line 87):
```xml
<!-- THERMAL DETECTION (independent of LiDAR pipeline) -->
<node name="thermal_detector" pkg="airside_thermal_detector" type="thermal_detector_node"
      output="screen">
    <rosparam command="load" file="$(find airside_thermal_detector)/config/thermal_detector.yaml" />
</node>
```

This is NOT loaded as a nodelet because thermal processing uses different data types (images vs point clouds) and different timing (camera frame rate vs LiDAR aggregation rate).

#### Hardware Requirements and Costs

| Component | Qty | Unit Cost | Total |
|-----------|-----|-----------|-------|
| FLIR Boson+ 640 (14mm, 32deg HFoV) | 4 | ~$1,800 | $7,200 |
| USB-C adapter/interface board | 4 | ~$200 | $800 |
| Mounting brackets (custom) | 4 | ~$100 | $400 |
| IP67 enclosure per camera | 4 | ~$150 | $600 |
| **Total per vehicle** | | | **~$9,000** |

The Boson+ 640 weighs 7.5g per module, draws <1W, outputs 640x512 @ 60Hz via USB. No additional compute board is needed -- the existing vehicle compute can handle 4x LWIR streams at 640x512. NUC/AGC are performed on-module by the Boson's Myriad 2 VPU.

#### Industry Reality Check

**Does this work in similar industrial environments?**
- YES. Zoox has validated FLIR Boson integration on their autonomous fleet for pedestrian detection. Nuro uses LWIR for their delivery vehicles.
- Thermal cameras are standard in port/logistics automation (Kalmar, Konecranes terminal tractors) for personnel detection around heavy equipment.
- Airport-specific: LWIR is unaffected by jet exhaust shimmer (which degrades visible cameras) because it reads body temperature, not reflected light. Jet exhaust at >200C is easily distinguished from human body heat at 37C.

**Known integration challenges:**
- **Calibration**: There is no direct extrinsic calibration method for thermal-to-LiDAR. The Zoox approach uses halogen-heated dots on a calibration board visible in both modalities. Recent research (2024-2025) demonstrates targetless calibration using human silhouettes visible in both LiDAR and thermal, achieving <3cm translation error and <0.5deg rotation error.
- **Rain/fog**: LWIR penetrates fog and light rain well but heavy rain droplets on the lens degrade performance. Hydrophobic coatings and heated lens windows are standard mitigations.
- **Sun loading**: Direct sunlight on hot surfaces (metal, asphalt >50C) can reduce thermal contrast with humans. Mitigation: use adaptive thresholding based on ambient temperature, not fixed temperature gates.

**Cost-benefit analysis:**
- Cost: ~$9,000/vehicle hardware + 6-8 weeks engineering
- Benefit: Near-100% pedestrian detection reliability at night, in fog, and in jet exhaust zones
- ROI: A single avoided worker collision justifies the cost many times over. This is a safety-critical improvement.

#### Revised Implementation Plan

1. **Week 1-2**: Hardware procurement and mechanical mounting design. Order FLIR Boson+ 640 modules (lead time: 2-4 weeks for industrial quantities). Design IP67 enclosures and mounting brackets for front, rear, and both sides.

2. **Week 3-4**: ROS driver integration. The Boson outputs via USB -- use the `flir_boson_usb` ROS driver (available on GitHub) or write a thin V4L2 wrapper. Verify frame delivery at 30Hz on the vehicle compute. Write thermal-to-`sensor_msgs/Image` publisher.

3. **Week 4-5**: Thermal-to-LiDAR extrinsic calibration. Use heated calibration targets (halogen lamps behind a board with holes) visible in both LiDAR intensity and thermal. Compute 6-DOF extrinsic transforms and add to the vehicle URDF/xacro (in `src/airside_vehicle_description/urdf/`).

4. **Week 5-6**: Blob detection + temperature thresholding node. Classical pipeline: NUC (on-module) -> AGC normalization -> binary threshold (T > ambient + 10C) -> morphological opening -> connected components -> filter by area (consistent with human-sized blob at known range). Publish detections as BEV positions using the calibrated extrinsic.

5. **Week 6-7**: Gated nearest-neighbor fusion with LiDAR tracks. For each thermal detection, find the nearest LiDAR track within a 2m gate. If matched, boost LiDAR track confidence. If unmatched (thermal-only detection), publish as a low-confidence "thermal-only pedestrian" detection that triggers cautious behavior in the planner.

6. **Week 7-8**: Field testing on airport apron at night, dawn, dusk, and in simulated fog. Validate detection range, false positive rate, fusion latency.

**Estimated effort:** 6-8 weeks (1 senior + 1 mid-level engineer)
**Hardware procurement timeline:** 2-4 weeks for Boson+ modules

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Calibration drift over time | Thermal-LiDAR misalignment causes fusion errors | Online calibration monitoring (use ground markings visible in both modalities as persistent reference) |
| Hot surface false positives (summer apron) | False pedestrian detections on hot metal surfaces | Adaptive ambient-relative thresholding; size/aspect ratio filtering |
| Lens contamination (rain, dust, deicing fluid) | Degraded thermal image quality | Hydrophobic coatings, periodic lens wiper/air blast, staleness detection when contrast drops below threshold |
| Compute budget | 4 camera streams may strain CPU | Boson does NUC/AGC on-module; blob detection is lightweight (<5ms/frame at 640x512) |

---

### Rec #23: Acoustic Siren and Alert Detection (Microphone Array)

**Original Priority:** Medium
**Revised Priority:** Low (downgraded -- airport noise environment is fundamentally hostile to this approach)
**Feasibility Verdict:** NEEDS RESEARCH (significant domain-specific challenges)

#### Code Integration Points

This would be a fully independent ROS node publishing to a new topic `/audio_alerts` consumed by the planner, not the perception stack.

```
New package: airside_audio_detector/
  src/AudioDetector.cpp       -- STFT, spectrogram analysis, pattern matching
  src/DoadEstimator.cpp       -- GCC-PHAT direction-of-arrival estimation
  config/audio_detector.yaml  -- frequency bands, threshold profiles
```

No existing perception code needs modification. The output topic would be consumed by the behavior planner (`behavior_planner_nodelet` in `airside_nav`).

#### Hardware Requirements and Costs

| Component | Qty | Unit Cost | Total |
|-----------|-----|-----------|-------|
| MEMS microphone module (IP67 rated) | 4-8 | ~$50 | $200-400 |
| Multi-channel audio ADC (e.g., Cirrus Logic) | 1 | ~$200 | $200 |
| Weatherproof housings | 4-8 | ~$30 | $120-240 |
| **Total per vehicle** | | | **~$600-900** |

#### Industry Reality Check

**Does this work in airport environments?**
- **PROBLEMATIC.** Airport aprons are among the noisiest outdoor environments on earth:
  - Aircraft engine idle: 80-90 dB at 50m
  - Aircraft taxiing: 90-100 dB at 30m
  - Ground power units (GPU): 75-85 dB continuous
  - Aircraft APU: 85-95 dB
  - Baggage conveyor belts: 70-80 dB
  - Multiple simultaneous sources from different directions

- The Fraunhofer "Hearing Car" system (tested 2025) uses 3-microphone EMMs with CNN-based classification, but was tested on PUBLIC ROADS where ambient noise is 60-70 dB. Airport apron ambient is 80-95 dB -- a fundamentally different acoustic environment.

- Bosch's embedded siren detection system targets emergency vehicle sirens (600-1600 Hz, high-power, standardized waveform). Airport reversing beepers (1000-2500 Hz pulsed) would need separate training data and would compete with aircraft engine harmonics in the same frequency band.

- GCC-PHAT direction-of-arrival estimation requires microphone spacing of ~15cm for 1000-2500 Hz signals (half-wavelength). This works in principle but spatial aliasing becomes severe with multiple simultaneous broadband noise sources.

**Known blockers:**
- Aircraft engine broadband noise masks siren/beeper frequencies
- Jet blast turbulence creates wind noise artifacts on microphones
- No existing training data for airport-specific alert sounds
- Real-time spectrogram classification in 90+ dB ambient has not been demonstrated

**Cost-benefit analysis:**
- Cost: ~$800/vehicle hardware + 4-6 weeks engineering + extensive data collection
- Benefit: Marginal early warning for approaching vehicles (already detected by LiDAR + thermal)
- ROI: Low. The LiDAR + thermal combination already provides superior detection of approaching vehicles before they are close enough to be acoustically relevant.

#### Revised Implementation Plan

**Not recommended for near-term deployment.** If pursued as a research project:

1. **Month 1**: Deploy microphone array on one test vehicle. Record >100 hours of airport apron audio across different operations (aircraft on stand, taxiing, GPU running, etc.). Characterize the noise floor and frequency spectrum.

2. **Month 2**: Analyze whether target signals (reversing beepers, horns) are reliably separable from ambient noise using classical FFT/spectrogram methods. If SNR < 10 dB for target signals, acoustic detection is not viable with classical methods.

3. **Month 3**: If viable, implement STFT-based detector with hand-tuned frequency band filters for known alert patterns. Evaluate detection rate and false alarm rate.

**Estimated effort:** 3+ months research phase before any production path is clear
**Hardware procurement timeline:** 1-2 weeks (commodity MEMS microphones)

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Airport ambient noise masks target signals | System is non-functional | Extensive site characterization before committing to development |
| Wind noise from jet blast | False triggers, microphone overload | Wind screens, adaptive gain, silence detection during known blast events |
| No airport-specific training data exists | Cannot train classifiers | Requires extensive on-site data collection campaign |
| Regulatory: microphone recording on airfield | Privacy/security concerns from airport authority | Consult airport operations team before deployment; may need data retention policies |

---

### Rec #24: 4D Imaging Radar Integration

**Original Priority:** Medium
**Revised Priority:** Medium-High (upgraded -- radar provides the only weather-robust sensing modality and instantaneous Doppler velocity)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

#### Code Integration Points

**1. Radar point cloud ingestion via PointcloudAggregator**

The ARS548 outputs 4D point clouds (x, y, z, Doppler velocity) that can be published as `sensor_msgs::PointCloud2` with custom fields. However, the existing `PointcloudAggregator` (line 1-205) performs simple concatenation with staleness checking and TF transforms -- it is LiDAR-agnostic and can accept ANY `PointCloud2` message.

**Integration approach A (simple):** Add radar topics to the `cloud_in` parameter array in the aggregator config. The radar points would be concatenated with LiDAR points. This is the simplest path but loses the Doppler velocity field during concatenation (standard PCL concatenation only preserves x,y,z,intensity).

**Integration approach B (recommended):** Create a separate `airside_radar_processor` node that:
- Subscribes to raw ARS548 radar point clouds (via the `ars548_ros` ROS driver -- an existing open-source ROS2 driver that can be ported to ROS1)
- Filters by RCS (radar cross section) and Doppler SNR
- Publishes processed radar detections on a parallel topic
- A new `airside_sensor_fusion` node fuses LiDAR tracks (from PolygonDetector) with radar detections using Mahalanobis gating

**2. Doppler velocity integration with KalmanTracker**

The `KalmanTracker::update()` method (kalman_tracker.cpp, line 144-235) currently computes velocity from position differences:
```cpp
float measured_vx = dx / static_cast<float>(dt);
float measured_vy = dy / static_cast<float>(dt);
```

Radar Doppler provides DIRECT radial velocity measurement. To integrate:
- Add a new `updateWithDoppler()` method to `KalmanTracker` that uses the radar Doppler as an additional velocity measurement
- The Doppler velocity is RADIAL (toward/away from radar), so it must be decomposed into x/y components using the detection angle
- This can be injected as an additional measurement in the Kalman filter's measurement vector, extending it from `[x, y, vx, vy]` to `[x, y, vx, vy, v_radial]` with appropriate H matrix

**3. Track-level fusion in MultiObjectKalmanTracker**

The `MultiObjectKalmanTracker::update()` method (kalman_tracker.cpp, line 576-620) processes detections through predict->match->update cycle. Radar detections can be injected as additional measurements for existing tracks:

```cpp
// After line 598 (mark missed tracks), before line 602 (create new tracks):
// For each radar detection within gate of an existing track,
// call tracker->updateWithDoppler(radar_position, doppler_velocity)
```

**4. Weather-adaptive weighting**

When a weather estimation node (Rec #30 in the v1 doc) reports degraded LiDAR conditions, the fusion node should shift weighting toward radar detections. This requires a `/weather_condition` topic (string/enum) that the fusion node subscribes to.

#### Hardware Requirements and Costs

| Component | Qty | Unit Cost | Total |
|-----------|-----|-----------|-------|
| Continental ARS548 RDI | 2-4 | ~$1,500-2,500 | $3,000-10,000 |
| Ethernet interface (PoE) | per radar | included | -- |
| Mounting brackets | 2-4 | ~$200 | $400-800 |
| **Total per vehicle** | | | **~$4,000-11,000** |

The ARS548 provides:
- 1500m max detection range (far exceeds the ~80m operational range of the AGV)
- 20 Hz update rate
- Per-detection Doppler velocity (no multi-frame tracking needed)
- Works through rain, fog, dust, and jet exhaust with negligible degradation
- Ethernet output, PoE powered

#### Industry Reality Check

**Does this work in airport/industrial environments?**
- YES. 4D imaging radar is being deployed in:
  - Aurora autonomous trucks (Continental ARS548) for highway operation in rain/fog
  - Kodiak trucks (ZF 4D radar) for adverse weather robustness
  - Port automation: terminal tractors at Rotterdam and Singapore use radar-LiDAR fusion
  - The $5.1B market (2025) is driven by exactly this use case: weather-robust perception

**Known integration challenges:**
- **Multipath reflections**: Airport aprons have large metal surfaces (aircraft, hangars) that create radar multipath. Mitigation: filter by RCS (reject returns with anomalous RCS), use Doppler to discriminate static multipath from moving targets.
- **Ground clutter**: Airport apron is flat and reflective. Mitigation: elevation angle filtering (the ARS548's 4D capability provides elevation), ground plane estimation.
- **ROS1 driver**: The `ars548_ros` driver is ROS2-native. A ROS1 port is needed, or use the `ros1_bridge` approach. The driver is ~2000 lines of C++ and straightforward to port.
- **Calibration**: Radar-to-LiDAR extrinsic calibration can use corner reflectors (trihedral) visible in both modalities.

**Cost-benefit analysis:**
- Cost: $4,000-11,000/vehicle hardware + 6-10 weeks engineering
- Benefit: Weather-robust detection (the LiDAR-only stack is BLIND in heavy rain), instantaneous velocity measurement (eliminates multi-frame tracking lag for TTC computation), sensor redundancy
- ROI: High for airports that operate in all-weather conditions. Moderate for fair-weather-only operations.

#### Revised Implementation Plan

1. **Week 1-2**: Procure 2x ARS548 (front + rear). Port the `ars548_ros` ROS2 driver to ROS1 (or wrap with `ros1_bridge`). Verify data reception on vehicle compute via Ethernet.

2. **Week 3-4**: Radar-to-LiDAR extrinsic calibration using trihedral corner reflectors. Add radar frames to vehicle URDF. Verify point cloud registration in RViz.

3. **Week 4-6**: Implement `airside_radar_processor` node: RCS filtering, ground clutter removal, Doppler noise rejection. Publish clean radar detections.

4. **Week 6-8**: Implement track-level fusion: Mahalanobis gating between PolygonDetector tracks and radar detections. Add `updateWithDoppler()` to `KalmanTracker`. Test velocity estimation accuracy improvement.

5. **Week 8-10**: Weather-adaptive weighting. When rain/fog reduces LiDAR track count, increase radar detection weight. Validate in controlled rain/fog conditions (or with LiDAR-attenuating filters).

**Estimated effort:** 6-10 weeks (1 senior engineer)
**Hardware procurement timeline:** 2-6 weeks for ARS548 units (automotive supply chain)

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multipath from aircraft/hangar surfaces | False radar detections | RCS + Doppler filtering; static map of known reflector positions |
| ROS1 driver port issues | Delays integration | Alternatively use ros1_bridge; the driver is well-documented |
| Radar-LiDAR time synchronization | Misaligned fusion | Use PTP/gPTP time sync (Rec #7 from v1 doc); the ARS548 supports PTP |
| Compute budget for radar processing | CPU contention with LiDAR pipeline | Radar processing is lightweight (CFAR + FFT done on-sensor); fusion is ~1ms/frame |

---

## 7. Geometric Methods & Classical CV

### Rec #25: LiDAR Reflectivity-Based Apron Marking Detection

**Original Priority:** High
**Revised Priority:** Medium (downgraded -- useful but depends on prerequisite intensity calibration work)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

#### Code Integration Points

**1. Intensity data availability**

The current pipeline uses `pcl::PointXYZI` throughout (confirmed in DeckDetection.h line 33: `using PointT = pcl::PointXYZI;`, and PointcloudSegmentation.cpp line 229: `pcl::PointCloud<pcl::PointXYZI>::Ptr`). The intensity field IS preserved through the pipeline. However, the PolygonDetector uses `pcl::PointXYZ` (polygon_detector_node.cpp line 833: `pcl::PointCloud<pcl::PointXYZ>::Ptr raw_cloud`), which DROPS intensity.

**Blocker**: The obstacle detection pipeline loses intensity information. Marking detection must tap into the pipeline BEFORE the PolygonDetector, specifically from the GroundGrid's ground-classified points.

**2. Integration after GroundGrid**

The GroundGrid nodelet (perception.launch line 48-52) outputs ground and non-ground point clouds. The ground points contain the apron surface with markings. A new `airside_marking_detector` node subscribes to the ground points output:

```
GroundGrid -> ground points (PointXYZI) -> MarkingDetector
                                              -> /marking_detector/markings (nav_msgs/OccupancyGrid or custom msg)
```

**3. Implementation within marking detector**

```cpp
// Pseudocode for marking detection
void MarkingDetector::processGroundCloud(const PointCloudConstPtr& ground_cloud) {
  // 1. Range-normalize intensity: I_norm = I_raw * (range / ref_range)^2
  //    (RS32 intensity drops with range squared)

  // 2. Threshold: marking_points = points where I_norm > threshold
  //    (retroreflective paint: I_norm > 2x median ground intensity)

  // 3. Project to BEV grid (matching ground grid resolution)

  // 4. Cluster adjacent marking cells

  // 5. Fit lines/curves to marking clusters (Hough transform or RANSAC)

  // 6. Compare against stored apron map for localization refinement
}
```

**4. Dependency: Intensity calibration**

The RS32 LiDARs have uncalibrated intensity that varies with:
- Range (inverse-square law)
- Incidence angle
- Target material
- Individual sensor unit variation

Without intensity calibration (Rec #5 from v1), reflectivity thresholding will produce inconsistent results. This is a HARD PREREQUISITE.

#### Industry Reality Check

**Does this work on airport aprons?**
- YES, with caveats. Research demonstrates R^2=0.87 linear correlation between LiDAR intensity and retroreflectometer readings for pavement markings on roads.
- Airport apron markings use retroreflective paint (same glass bead technology as road markings), so the physics is identical.
- Works identically day and night (unlike camera-based marking detection).
- Wet conditions reduce retroreflectivity by up to 80% -- a known issue for both LiDAR and camera-based approaches.
- Dirty or worn markings have reduced retroreflectivity and may fall below detection threshold.

**Cost-benefit analysis:**
- Cost: 0 hardware (uses existing LiDAR), 3-4 weeks engineering (plus intensity calibration prerequisite)
- Benefit: Localization refinement on apron, safety zone verification, works at night
- ROI: Moderate. Most valuable as a localization input rather than a safety feature.

#### Revised Implementation Plan

1. **Prerequisite**: Implement intensity calibration (Rec #5) first. Collect reference reflectivity measurements from known apron markings using a retroreflectometer. Build per-sensor range-intensity lookup tables.

2. **Week 1-2**: Implement `airside_marking_detector` node. Subscribe to GroundGrid ground points. Apply range normalization. Binary threshold with adaptive ambient reference (median ground intensity per scan).

3. **Week 2-3**: BEV projection and line fitting. Use Hough transform for straight line detection (taxi lines) and arc fitting for stand markings.

4. **Week 3-4**: Map matching. Load apron marking map from configuration. Compute alignment between detected markings and map. Publish correction as a localization refinement on `/marking_detector/localization_correction`.

**Estimated effort:** 3-4 weeks (1 engineer) + intensity calibration prerequisite (2 weeks)
**Hardware procurement timeline:** None

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Intensity calibration quality | Threshold doesn't generalize across sensors | Per-sensor calibration tables; adaptive thresholding relative to local median |
| Worn/dirty markings | Missed detections | Treat markings as a SUPPLEMENTARY localization input, not primary |
| Wet apron reduces retroreflectivity | Markings undetectable in rain | Accept degradation; rain detection (existing `airside_rain_detection`) can flag unreliable marking data |
| RS32 intensity resolution | May be too coarse for fine marking discrimination | Test with actual RS32 data before committing; 8-bit intensity may suffice for binary marking/non-marking |

---

### Rec #26: L-Shape Fitting for Vehicle Orientation Estimation

**Original Priority:** Medium
**Revised Priority:** Medium-High (upgraded -- directly addresses a known PCA limitation in the polygon detector)
**Feasibility Verdict:** FEASIBLE

#### Code Integration Points

**1. Current bounding box fitting in PolygonDetector**

The current pipeline uses `Polygonizer::boundingBoxRotatingCalipers()` (polygonizer.cpp line 73-170) which computes a minimum-area oriented bounding box from the convex hull using rotating calipers. This is geometrically optimal for the VISIBLE hull but does not account for partial observability.

The `Box` struct (box.hpp) stores polygon vertices directly -- no explicit orientation field. The system uses "pure polygon tracking" where convex hull vertices are tracked rather than oriented bounding boxes.

**2. Where L-shape fitting integrates**

L-shape fitting should be applied as an ALTERNATIVE to rotating calipers for clusters that appear to be partially-observed vehicles. The integration point is in `polygon_detector_node.cpp` within the `lidarPointsCallback()` method, specifically in Phase 1 (detection, lock-free) where clusters are processed into `Box` structures.

Currently (polygon_detector_node.cpp, approximately line 880-900), after spherical clustering produces `cloud_clusters`, each cluster is processed through:
1. Convex hull computation
2. Rotating calipers bounding box

L-shape fitting would be inserted as step 1.5:
```cpp
// After convex hull, before rotating calipers:
// 1. Attempt L-shape fitting on the cluster boundary points
// 2. If two approximately perpendicular edges are found (residual < threshold):
//    - Use L-shape corner as the reference point
//    - Estimate full bounding box from L-shape + known class dimensions
//    - Override the rotating calipers result
// 3. If L-shape fitting fails (no clear perpendicular edges):
//    - Fall back to rotating calipers (current behavior)
```

**3. Implementation using existing RANSAC infrastructure**

The codebase already uses RANSAC for line fitting in DeckDetection (`fitEdgeLineRANSAC()` in DeckDetection.cpp). The same approach can be adapted:

```cpp
// In a new file: l_shape_fitter.cpp
struct LShapeResult {
  bool is_valid;
  Eigen::Vector2f corner_point;       // L-shape corner
  Eigen::Vector2f edge1_direction;    // First edge direction
  Eigen::Vector2f edge2_direction;    // Second edge direction
  float edge1_length;                 // Visible length of first edge
  float edge2_length;                 // Visible length of second edge
  float perpendicularity_error;       // Angle deviation from 90 degrees
};

LShapeResult fitLShape(const std::vector<Eigen::Vector2f>& boundary_points) {
  // 1. RANSAC fit first dominant line through boundary points
  // 2. Classify points as inliers/outliers of first line
  // 3. RANSAC fit second line through outliers
  // 4. Check perpendicularity (angle between lines within 90 +/- threshold)
  // 5. Compute intersection point (the L-shape corner)
}
```

**4. Integration with KalmanTracker**

The `KalmanTracker` (kalman_tracker.hpp) does NOT track orientation -- it uses a 4-state `[x, y, vx, vy]` model. L-shape orientation would be stored in the `Box` struct as an additional field:

```cpp
// In box.hpp, add:
float orientation_rad;           // From L-shape fitting (if valid)
bool has_l_shape_orientation;    // Flag for quality
```

This does NOT require modifying the Kalman filter state vector. Orientation is a per-frame geometric computation, not a tracked state. The velocity direction (from `vx, vy`) already provides heading for moving objects; L-shape provides heading for stationary or slow objects.

**5. Application to ULD tracking**

The UldDetection module already uses PCA for orientation estimation (UldDetection.h includes `<pcl/common/pca.h>`). L-shape fitting would provide a more robust alternative for the ULD's rectangular geometry, particularly when only two faces are visible during approach.

Integration point: `UldDetection::publishPoseAndVisualization()` where PCA eigenvalues/eigenvectors are used to compute orientation. L-shape fitting would run in parallel with PCA, and the result with lower residual error would be selected.

#### Industry Reality Check

**Does this work for airport objects?**
- YES. L-shape fitting is standard in AV industry for partially-observed vehicles. Published methods achieve <2deg heading error for two-face observations.
- Airport objects (ULDs, baggage carts, tugs) are rectangular/boxy -- ideal for L-shape fitting.
- The CMU implementation (Zhang et al., IV 2017) runs in <1ms for thousands of objects, well within the 10Hz budget.
- Limitation: L-shape fails for non-rectangular objects (pedestrians, round bollards). The fallback to rotating calipers handles these cases.

**Cost-benefit analysis:**
- Cost: 0 hardware, 2-3 weeks engineering
- Benefit: More accurate orientation for partially-observed vehicles/ULDs, reducing docking alignment errors
- ROI: High for the ULD detection pipeline; moderate for general obstacle tracking

#### Revised Implementation Plan

1. **Week 1**: Implement `LShapeFitter` class with RANSAC-based two-line fitting. Unit test against synthetic boundary point clouds (known L-shapes with noise). Reference implementation: Zhang et al., IV 2017 optimization formulation.

2. **Week 1-2**: Integrate into PolygonDetector's Phase 1 processing. For each cluster, attempt L-shape fitting on boundary points. If perpendicularity error < 15deg and both edges have >5 inlier points, use L-shape result. Otherwise fall back to rotating calipers.

3. **Week 2-3**: Integrate into UldDetection as an alternative to PCA. Compare L-shape vs PCA orientation on recorded ULD approach sequences. Select the method with lower residual per frame.

4. **Week 3**: Validation on recorded bag files. Measure orientation estimation error against manually-annotated ground truth. Target: <5deg heading error for two-face observations.

**Estimated effort:** 2-3 weeks (1 engineer)
**Hardware procurement timeline:** None

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| L-shape fitting on non-rectangular objects (people, trees) | Poor orientation estimate | Only apply when cluster aspect ratio suggests rectangular shape; fall back to rotating calipers |
| Noisy boundary points cause RANSAC failure | L-shape not detected when it should be | Tune RANSAC iterations (100-200), distance threshold (5-10cm), minimum inlier ratio |
| Orientation flip ambiguity (L-shape has 2 possible headings) | 180-degree heading error | Use velocity direction to disambiguate; if stationary, use prior heading from track history |

---

### Rec #27: Swept-Path Collision Checking (GJK/SAT)

**Original Priority:** Medium
**Revised Priority:** Medium (confirmed -- valuable for the baggage tractor + trailer configuration)
**Feasibility Verdict:** FEASIBLE

#### Code Integration Points

**1. Current collision checking**

The current system publishes `airside_perception_msgs::DetectedObjectArray` (from PolygonDetector) and optionally inflated polygons (polygon_detector_node.cpp line 738-741). The behavior planner in `airside_nav` uses these for proximity-based collision avoidance. There is NO swept-path collision checking.

**2. Where SAT integrates**

This is a PLANNER-SIDE feature, not a perception feature. The swept-path collision check belongs in the local planning nodelet (`local_planning_nodelet` in `airside_nav/src/`) which generates Frenet trajectory candidates (175 per cycle). Each candidate trajectory should be checked against tracked obstacle polygons.

However, the perception stack needs to provide the data in the right format. Currently, the PolygonDetector publishes `DetectedObjectArray` with polygon vertices. The planner needs:
- Object polygons (already published)
- Object predicted future positions (requires velocity, already published)
- Ego vehicle polygon (from URDF/vehicle description)

**3. SAT implementation**

SAT (Separating Axis Theorem) for 2D convex polygons is simpler and faster than GJK for this use case. The number of candidate separating axes equals the total number of edges across both polygons. For typical convex hulls with 4-8 vertices, this is 8-16 axis checks.

```cpp
// New utility: sat_collision.hpp (can be shared between perception and planning)
struct ConvexPolygon2D {
  std::vector<Eigen::Vector2f> vertices;
};

// Returns true if two convex polygons overlap
bool checkCollisionSAT(const ConvexPolygon2D& a, const ConvexPolygon2D& b);

// Returns minimum penetration depth (for TTC estimation)
float penetrationDepthSAT(const ConvexPolygon2D& a, const ConvexPolygon2D& b);

// Swept volume: union of vehicle polygon at discrete trajectory samples
ConvexPolygon2D computeSweptVolume(
    const ConvexPolygon2D& vehicle_footprint,
    const std::vector<Eigen::Affine2f>& trajectory_samples);
```

**4. Integration with existing polygon inflation**

The PolygonDetector already has `inflatePolygon()` (polygon_detector_node.cpp line 344). The swept-volume computation is conceptually similar: sample the ego trajectory at discrete time steps, transform the ego polygon to each sample pose, and compute the convex hull of the union.

**5. Performance budget**

SAT for two convex polygons with N+M total edges: O(N+M) per check. With 175 trajectory candidates and ~20 tracked objects: 175 * 20 = 3,500 SAT checks per planning cycle. At ~1us per SAT check, total is ~3.5ms -- well within budget.

#### Industry Reality Check

**Does this work for long vehicle + trailer combinations?**
- YES. This is exactly the use case SAT excels at. A baggage tractor making a turn with a loaded trailer sweeps a much larger area than its instantaneous footprint. SAT catches these scenarios that point-based proximity checks miss.
- Open-source C++ implementations of GJK and SAT are available (github: kroitor/gjk.c, Discordia/gjk-epa, albertnadal/GJKCollisionDetection).
- Waymo uses GJK for this purpose; SAT is sufficient and simpler for 2D convex polygon checks.

**Cost-benefit analysis:**
- Cost: 0 hardware, 3-4 weeks engineering (mostly in the planner, not perception)
- Benefit: Prevents collisions during turns with trailer, especially in tight apron spaces
- ROI: High for the trailer/dolly configuration; the swept path during a 90-degree turn can extend 2-3m beyond the instantaneous footprint

#### Revised Implementation Plan

1. **Week 1**: Implement `sat_collision.hpp` utility library with unit tests. Test against known collision/non-collision polygon pairs. Include penetration depth computation.

2. **Week 2**: Implement `computeSweptVolume()` function. Sample trajectory at 0.1s intervals. Transform ego polygon (from vehicle description URDF) to each sample pose. Compute convex hull of the union using the existing `Polygonizer::convexHull()` template function.

3. **Week 3**: Integrate into local planner's trajectory scoring. For each candidate trajectory, compute swept volume and check SAT collision against all tracked objects (with their predicted positions from Kalman extrapolation). Reject trajectories with collisions.

4. **Week 4**: Validation with recorded and simulated scenarios. Focus on tight turns with trailer, passing through narrow gaps between parked vehicles.

**Estimated effort:** 3-4 weeks (1 engineer, primarily planner-side work)
**Hardware procurement timeline:** None

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Convex hull approximation of ego vehicle underestimates swept area | Missed collision detection for concave vehicle shapes | Use conservative (slightly enlarged) convex approximation of vehicle footprint |
| Trajectory sampling too coarse | Misses collision between samples | Sample at 0.1s intervals; for high-speed scenarios, use 0.05s |
| Compute budget exceeded with many objects | Planning cycle delayed | Pre-gate by distance (skip SAT for objects >20m from trajectory); use bounding circle quick-reject |

---

## 8. Data Association & Track Management

### Rec #28: Joint Probabilistic Data Association (JPDA)

**Original Priority:** High
**Revised Priority:** Medium (downgraded -- the current Hungarian + cascade matching is already quite good; JPDA adds complexity for marginal improvement in the airport domain)
**Feasibility Verdict:** FEASIBLE WITH MODIFICATIONS

#### Code Integration Points

**1. Current data association architecture**

The `MultiObjectKalmanTracker` (kalman_tracker.cpp, line 567-906) uses:
- `buildCostMatrix()` (line 646-690): Euclidean distance + bbox ratio pre-gated cost matrix
- `hungarianAssignment()` (line 732-747): dlib-based optimal assignment, O(n^3)
- `cascadeMatch()` (line 749-846): Two-pass matching -- confirmed tracks first, then tentative

The Hungarian algorithm makes HARD one-to-one assignments. JPDA would replace this with SOFT probabilistic assignments where each track is updated using a weighted combination of all gated detections.

**2. Where JPDA replaces Hungarian**

JPDA would replace the `standardMatch()` and/or the per-pass matching within `cascadeMatch()`. The key change is in how track updates are computed:

**Current** (hard assignment):
```cpp
// kalman_tracker.cpp line 783:
trackers_[tracker_idx]->update(detections[det_idx].position,
                               detections[det_idx].dimensions);
```

**JPDA** (soft assignment):
```cpp
// Each track is updated with a weighted combination:
Eigen::Vector3f weighted_position = Eigen::Vector3f::Zero();
Eigen::Vector3f weighted_dimensions = Eigen::Vector3f::Zero();
float total_weight = 0.0f;

for (size_t d = 0; d < gated_detections.size(); ++d) {
  float beta = association_probabilities[track_idx][d];  // P(detection d -> track t)
  weighted_position += beta * detections[d].position;
  weighted_dimensions += beta * detections[d].dimensions;
  total_weight += beta;
}

// Include probability of no detection (missed detection hypothesis)
float beta_0 = 1.0f - total_weight;  // P(no detection for this track)

if (total_weight > 0.01f) {
  trackers_[tracker_idx]->update(weighted_position / total_weight,
                                 weighted_dimensions / total_weight);
} else {
  trackers_[tracker_idx]->markMissed();
}
```

**3. Association probability computation**

JPDA requires computing the probability of each track-detection association based on:
- Mahalanobis distance (already implemented in `KalmanTracker::mahalanobisDistance()`, line 302-324)
- Detection density (clutter rate)
- Detection probability

This is implemented as a new method in `MultiObjectKalmanTracker`:

```cpp
// New method: compute JPDA association probabilities
// Returns matrix of probabilities: beta[track][detection]
std::vector<std::vector<float>> computeJPDAWeights(
    const std::vector<Detection>& detections,
    float clutter_density,      // Expected false detections per unit area
    float detection_probability  // P(detect) for true targets
);
```

**4. Covariance update modification**

JPDA requires a modified covariance update in the Kalman filter to account for the spread of the association:
```cpp
P_jpda = beta_0 * P_predicted + (1 - beta_0) * P_standard_update + P_spread
```
where `P_spread` accounts for the variance across different possible associations. This requires adding a `updateJPDA()` method to `KalmanTracker` that takes the weighted innovation and the spread covariance.

#### Industry Reality Check

**Does JPDA improve tracking on airport aprons?**
- **Marginally.** JPDA's primary advantage is in DENSE clutter where multiple detections fall within a single track's gate. On airport aprons:
  - Objects are typically >1m apart (ULDs, baggage carts)
  - The current cascade matching + Hungarian already handles most scenarios well
  - JPDA's computational cost is O(2^n) in the worst case for n detections in a gate (though practical implementations are much faster)

- **Where JPDA helps most**: Closely-spaced baggage dollies in a train (separated by <0.5m), and ULDs stacked on adjacent stand positions.

- The MATLAB Sensor Fusion Toolbox provides a reference JPDA implementation. The Stone Soup library (Python) has an excellent tutorial implementation.

- A 2025 study combining JPDA with EKF for LiDAR-camera fusion showed significant reduction in ID switches in cluttered environments.

**Cost-benefit analysis:**
- Cost: 0 hardware, 3-5 weeks engineering (complex algorithm, careful tuning needed)
- Benefit: Reduced ID switches in dense clutter scenarios (baggage dolly trains, adjacent ULDs)
- ROI: Moderate. The cascade matching + Hungarian already handles 90%+ of scenarios correctly. JPDA improves the remaining 10% edge cases.

#### Revised Implementation Plan

1. **Week 1-2**: Implement JPDA probability computation. Use the gating mechanism from existing `buildCostMatrix()` (Euclidean pre-gate + Mahalanobis). Compute beta weights for all gated track-detection pairs using the standard JPDA formula.

2. **Week 2-3**: Implement beta-weighted Kalman update in `KalmanTracker`. Add `updateJPDA(weighted_position, weighted_dimensions, spread_covariance)` method. Add the spread covariance term to the Kalman P update.

3. **Week 3-4**: Replace `standardMatch()` with JPDA (keep `cascadeMatch()` structure -- JPDA within each cascade level). Tune clutter density and detection probability parameters for the airport domain.

4. **Week 4-5**: A/B testing against current Hungarian approach on recorded bag files with ground truth annotations. Measure: ID switch rate, track fragmentation, position error RMSE.

**Estimated effort:** 3-5 weeks (1 senior engineer)
**Hardware procurement timeline:** None

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| JPDA computational cost in dense scenes | Planning cycle exceeded | Limit JPDA to gates with 2+ detections; use Hungarian for 1:1 cases (vast majority) |
| Tuning clutter density parameter | Wrong clutter rate causes over/under-smoothing | Learn clutter density from data (count detections outside all gates per frame) |
| Covariance inflation from spread term | Track uncertainty grows, eventually causing gate to encompass too many detections | Apply covariance regularization; cap P eigenvalues |
| Regression in simple scenarios | JPDA worse than Hungarian for clearly-separated objects | Hybrid approach: use Hungarian when gate overlap is zero, JPDA only when gates overlap |

---

### Rec #29: Track Re-Identification After Occlusion

**Original Priority:** Medium
**Revised Priority:** High (upgraded -- this directly addresses a real operational issue on airport aprons with frequent brief occlusions)
**Feasibility Verdict:** FEASIBLE

#### Code Integration Points

**1. Current track deletion behavior**

The `KalmanTracker::shouldDelete()` method (kalman_tracker.cpp, line 430-447) uses a simple threshold:
```cpp
bool KalmanTracker::shouldDelete() const {
  int invisible_threshold = config_.max_age_since_update;  // Default: 6
  if (time_since_update_ >= invisible_threshold) {
    return true;
  }
  return false;
}
```

The `pruneDeadTracks()` method (line 883-890) simply erases tracks that `shouldDelete()` returns true for. There is NO dormant state -- tracks are permanently deleted.

**2. Adding a DORMANT track state**

The `KalmanTracker::TrackState` enum (kalman_tracker.hpp, line 88-92) currently has:
```cpp
enum class TrackState {
  TENTATIVE,    // New track, not yet confirmed
  CONFIRMED,    // Track with sufficient hits
  LOST          // Track lost but may recover
};
```

Add `DORMANT` state:
```cpp
enum class TrackState {
  TENTATIVE,
  CONFIRMED,
  LOST,
  DORMANT       // Previously confirmed, now deleted but held for re-identification
};
```

**3. Modified track lifecycle**

In `KalmanTracker::shouldDelete()`, instead of returning true for tracks past the invisible threshold, transition to DORMANT:

```cpp
bool KalmanTracker::shouldDelete() const {
  // Previously confirmed tracks become DORMANT instead of deleted
  if (state_ == TrackState::DORMANT) {
    // Delete dormant tracks after extended timeout (e.g., 5 additional seconds)
    return time_since_update_ >= (config_.max_age_since_update + config_.dormant_timeout);
  }

  if (time_since_update_ >= config_.max_age_since_update) {
    if (state_ == TrackState::CONFIRMED || state_ == TrackState::LOST) {
      // Don't delete -- transition to DORMANT (handled in markMissed())
      return false;
    }
    return true;  // TENTATIVE tracks are still deleted normally
  }
  return false;
}
```

In `KalmanTracker::markMissed()` (line 237-258), add DORMANT transition:
```cpp
void KalmanTracker::markMissed() {
  miss_count_++;
  time_since_update_++;
  age_++;

  if (state_ == TrackState::CONFIRMED &&
      time_since_update_ > config_.max_age_since_update) {
    state_ = TrackState::LOST;
  }

  // NEW: Transition from LOST to DORMANT
  if (state_ == TrackState::LOST &&
      time_since_update_ > config_.max_age_since_update + config_.lost_to_dormant_frames) {
    state_ = TrackState::DORMANT;
  }
}
```

**4. Re-identification matching in MultiObjectKalmanTracker**

After standard matching (Hungarian/JPDA) finds unmatched detections, attempt to match them against dormant tracks:

In `MultiObjectKalmanTracker::update()` (line 576-620), add a re-identification pass after line 607 (create new tracks for unmatched detections):

```cpp
// BEFORE creating new tracks for unmatched detections:
// Try to re-identify with dormant tracks first
for (size_t i = 0; i < detections.size(); ++i) {
  if (!detection_matched[i]) {
    int best_dormant = findBestDormantMatch(detections[i]);
    if (best_dormant >= 0) {
      // Reactivate dormant track with new detection
      reactivateTrack(best_dormant, detections[i]);
      detection_matched[i] = true;
    }
  }
}
```

The `findBestDormantMatch()` method uses:
- Euclidean distance to dormant track's PREDICTED position (Kalman extrapolation continues even while dormant, but with growing uncertainty)
- Relaxed gate (2-3x normal gate, since dormant track position is highly uncertain)
- Size consistency check: `|detection.dimensions - dormant_track.dimensions| < 30%`

**5. Configuration additions to polygon_detector.yaml**

Add to the existing config (after line 152):
```yaml
# Track Re-Identification Parameters
enable_track_reidentification: true
dormant_timeout_frames: 50        # 5 seconds at 10Hz -- max time to hold dormant track
dormant_gate_multiplier: 3.0      # Gate is 3x wider for dormant re-identification
dormant_size_tolerance: 0.30      # 30% max dimension change for re-identification
```

#### Industry Reality Check

**Does this solve a real problem on airport aprons?**
- YES. Airport aprons have frequent brief occlusions:
  - Workers walking behind parked baggage carts
  - ULDs temporarily hidden by passing tugs
  - Vehicles disappearing behind aircraft landing gear
  - Objects at the edge of LiDAR FOV going in/out of coverage

- Without re-identification, each occlusion event creates a new track with a new ID, losing velocity history and requiring the track to re-confirm through the TENTATIVE/CONFIRMED lifecycle. This causes:
  - Momentary loss of velocity information (safety-critical for TTC computation)
  - Track count inflation in the behavior planner's world model
  - Potential "phantom stop" events where a briefly-occluded object is treated as newly-appeared

- Research (2025) shows multi-level association with dormant tracks reduces ID switches by 30-50% in cluttered environments. The approach is well-understood and straightforward to implement.

**Cost-benefit analysis:**
- Cost: 0 hardware, 2-3 weeks engineering
- Benefit: Continuous track identity through brief occlusions, preserved velocity/history, reduced track fragmentation
- ROI: High. This is a low-cost improvement that directly impacts tracking quality in daily operations.

#### Revised Implementation Plan

1. **Week 1**: Add `DORMANT` state and modified lifecycle to `KalmanTracker`. Update `shouldDelete()`, `markMissed()`, and the `TrackState` enum. Add configurable `dormant_timeout` and `lost_to_dormant_frames` to `KalmanTracker::Config`.

2. **Week 1-2**: Implement `findBestDormantMatch()` in `MultiObjectKalmanTracker`. Use relaxed Euclidean gate + dimension consistency. Implement `reactivateTrack()` that restores the dormant track to CONFIRMED state with the new detection.

3. **Week 2**: Add re-identification pass to `MultiObjectKalmanTracker::update()` between the matching and new-track-creation steps. Add config parameters to `polygon_detector.yaml` and dynamic_reconfigure.

4. **Week 2-3**: Validation on recorded bag files with known occlusion scenarios. Measure:
   - ID switch rate (target: >30% reduction)
   - Track fragmentation rate
   - False re-identification rate (dormant track matched to WRONG detection)

5. **Week 3**: Edge case testing: ensure dormant tracks don't accumulate unboundedly, verify memory cleanup, stress test with many simultaneous occlusions.

**Estimated effort:** 2-3 weeks (1 engineer)
**Hardware procurement timeline:** None

#### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| False re-identification (dormant track matched to wrong object) | Incorrect track history, wrong velocity attributed to new object | Strict dimension consistency check + Mahalanobis gate; if ambiguous, create new track instead |
| Memory growth from dormant tracks | Increasing memory/CPU usage over time | Hard cap on dormant track count (e.g., max 50); oldest dormant tracks evicted first |
| Dormant track's predicted position drifts too far | Extrapolated position is meaningless after several seconds | Cap Kalman prediction to max 3 seconds; beyond that, use position-only matching with large gate |
| Interaction with cascade matching | Dormant re-identification may interfere with confirmed/tentative matching order | Run re-identification AFTER cascade matching completes, BEFORE new track creation |

---

## Summary: Priority-Ordered Implementation Roadmap

| # | Recommendation | Revised Priority | Effort | Hardware Cost | Verdict |
|---|---------------|-----------------|--------|---------------|---------|
| 29 | Track Re-Identification After Occlusion | **High** | 2-3 weeks | $0 | FEASIBLE |
| 22 | LWIR Thermal Camera Integration | **High** | 6-8 weeks | ~$9,000/vehicle | FEASIBLE WITH MODIFICATIONS |
| 26 | L-Shape Fitting | **Medium-High** | 2-3 weeks | $0 | FEASIBLE |
| 24 | 4D Imaging Radar Integration | **Medium-High** | 6-10 weeks | ~$4,000-11,000/vehicle | FEASIBLE WITH MODIFICATIONS |
| 25 | Reflectivity-Based Marking Detection | **Medium** | 3-4 weeks (+prereq) | $0 | FEASIBLE WITH MODIFICATIONS |
| 27 | Swept-Path Collision Checking (SAT) | **Medium** | 3-4 weeks | $0 | FEASIBLE |
| 28 | JPDA | **Medium** | 3-5 weeks | $0 | FEASIBLE WITH MODIFICATIONS |
| 23 | Acoustic Siren Detection | **Low** | 3+ months research | ~$800/vehicle | NEEDS RESEARCH |

**Recommended implementation order:**
1. **Track Re-Identification** (#29) -- pure software, 2-3 weeks, high impact, no risk
2. **L-Shape Fitting** (#26) -- pure software, 2-3 weeks, improves orientation for ULD/vehicle tracking
3. **LWIR Thermal** (#22) -- hardware procurement in parallel with #1 and #2, engineering starts week 5
4. **Swept-Path Collision** (#27) -- pure software, can be done in parallel with #22 hardware integration
5. **4D Radar** (#24) -- hardware procurement in parallel, engineering after thermal is stable
6. **Reflectivity Markings** (#25) -- depends on intensity calibration prerequisite (Rec #5 from v1)
7. **JPDA** (#28) -- only after #29 is deployed and evaluated; may not be needed
8. **Acoustic Detection** (#23) -- research project only, do not commit engineering resources without site characterization data
