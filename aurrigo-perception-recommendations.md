# Aurrigo Perception Stack: Non-ML Upgrade Recommendations

**Derived from analysis of 11 AV industry perception stacks**
**Date: 2026-03-16**

---

## How to Read This Document

Each recommendation is sourced from techniques used by leading AV companies (Waymo, Tesla, Zoox, Aurora, Cruise, Mobileye, Wayve, Pony.ai, Kodiak, Motional, Nuro) and evaluated for relevance to Aurrigo's airport ground vehicle domain. Recommendations are organized into 10 categories and prioritized as Critical (deploy urgently for safety), High (significant value, near-term), Medium (meaningful improvement, plan for), or Low (nice-to-have, opportunistic).

**Aurrigo's current stack summary for reference:**
- 5x RoboSense RS32 LiDAR (no camera, radar, IMU in perception)
- Classical pipeline: Aggregator, Preprocessor (cropbox, voxel, SOR), GroundGrid, Segmentation, Deck Detection (RANSAC), ULD Detection (PCA + EKF), Polygon Detector (spherical clustering + Kalman)
- ROS Noetic, PCL, Eigen, nanoflann, nodelets (zero-copy)
- 4-state obstacle Kalman, 3-state ULD EKF, Hungarian matching
- No: online calibration, occupancy grids, sensor staleness handling, IMM, formal safety verification, multi-model tracking

---

## 1. Sensor Signal Processing & Preprocessing

### [PRIORITY: Critical] -- LiDAR Multi-Return Processing for Adverse Weather
**Source:** Waymo, Zoox (Hesai AT128), Kodiak (Luminar Iris, Hesai OT128), Aurora (FirstLight)
**What it is:** Processing multiple return echoes per laser pulse to distinguish weather artifacts (rain, fog, jet exhaust, spray) from solid objects. The first return often hits a rain droplet or fog particle; the strongest or last return passes through to the real surface behind. Dual-return mode effectively doubles useful point density in adverse conditions.
**What Aurrigo lacks:** The RoboSense RS32 supports dual-return mode, but Aurrigo's pipeline does not appear to exploit the first/strongest/last return distinction. All returns are treated uniformly. On an airport apron exposed to jet blast, engine exhaust, rain spray from taxiing aircraft, and fuel vapour, this is a significant blind spot.
**How to implement:**
1. Enable dual-return mode on the RS32 if not already active (firmware configuration).
2. In the Aggregator nodelet, tag each point with its return type (first vs. strongest).
3. Add a return-pair analysis step before SOR: if the first return is at short range with low intensity and the second return is at longer range with normal intensity, classify the first as weather/exhaust noise and suppress it.
4. Publish a diagnostic topic tracking the percentage of divergent first/strongest returns per frame as a weather severity metric.
**Value added:** Prevents false obstacle detections from jet exhaust plumes, rain spray behind aircraft wheels, and fog/mist common at dawn on airport aprons. Reduces unnecessary emergency stops.
**Complexity:** Low-Medium (2-4 weeks). Mostly configuration and a lightweight filter nodelet.
**Key references:** Hesai AT128 dual-return documentation; Zoox rain/spray filtering (Section 5.5 of zoox-non-ml-perception.md); Kodiak Hesai IPE environmental filtering.

---

### [PRIORITY: High] -- Dynamic Statistical Outlier Removal (DSOR)
**Source:** Zoox
**What it is:** An extension of standard SOR that adapts the outlier threshold based on range. At long range, points are naturally sparser, so a fixed SOR threshold incorrectly removes valid distant points. DSOR relaxes the threshold proportionally with range.
**What Aurrigo lacks:** Aurrigo uses standard SOR with fixed thresholds. Airport aprons have long sightlines (100m+) where sparse but valid returns from distant aircraft, GSE, or apron boundaries are critical for early detection.
**How to implement:**
1. In the Preprocessor nodelet, replace or augment the existing `pcl::StatisticalOutlierRemoval` with a range-adaptive variant.
2. Compute the mean k-NN distance per point. Set the rejection threshold as `mean + alpha(r) * stddev`, where `alpha(r)` increases linearly or logarithmically with range `r`.
3. Typical parameters: k=20, alpha(r) = 1.0 + 0.5 * (r / r_max).
**Value added:** Retains valid sparse points at long range (e.g., an aircraft 80m away producing only 15 points) while still aggressively filtering rain/noise at close range. Improves early detection of approaching aircraft and vehicles.
**Complexity:** Low (1 week). Drop-in replacement for existing SOR.
**Key references:** Zoox Section 5.5 (rain and spray filtering with range-adaptive thresholds).

---

### [PRIORITY: High] -- Low-Intensity Outlier Removal (LIOR) for Jet Exhaust and Heat Shimmer
**Source:** Zoox
**What it is:** Points below a range-normalized intensity threshold are flagged as potential atmospheric noise. Exhaust particles, heat shimmer, and airborne debris produce weak, diffuse returns with characteristically low intensity compared to solid surfaces at the same range.
**What Aurrigo lacks:** No intensity-based filtering. Jet exhaust plumes from idling aircraft engines generate LiDAR returns that can be misclassified as obstacles, triggering false stops on the apron.
**How to implement:**
1. After range normalization (I_corrected = I_raw * (r / r_ref)^2), apply a per-point intensity threshold.
2. Points with corrected intensity below threshold T_low are marked as suspect.
3. Combine with spatial clustering: if suspect points form isolated, sparse clusters (not part of a dense object cluster), remove them.
4. Configurable via rosparam to tune for specific apron conditions.
**Value added:** Directly addresses jet exhaust and heat shimmer false positives -- a problem unique to airport operations.
**Complexity:** Low (1 week). Simple filter addition to preprocessing pipeline.
**Key references:** Zoox Section 5.5 (LIOR technique).

---

### [PRIORITY: Medium] -- Temporal Consistency Filtering
**Source:** Zoox, Kodiak (Hesai IPE)
**What it is:** Real objects produce returns at consistent locations across multiple scans. Returns that appear in a single scan but not in adjacent scans (within ego-motion-compensated comparison) are likely transient noise (rain, dust, exhaust). Requiring temporal persistence over 2-3 frames before classifying a cluster as a real object suppresses transient false positives.
**What Aurrigo lacks:** Each frame is processed independently. A momentary exhaust plume or splash generates a one-frame detection that can trigger an emergency response.
**How to implement:**
1. Maintain a short rolling buffer of the last 3 point clouds (already available via Aggregator).
2. For each new cluster from the Polygon Detector, check whether a spatially-consistent cluster existed in at least 2 of the last 3 frames (after ego-motion compensation).
3. Clusters failing temporal consistency are marked as "unconfirmed" and excluded from safety-critical obstacle reporting.
4. Exceptions: very-close-range detections (<3m) should bypass temporal filtering for immediate safety response.
**Value added:** Eliminates single-frame false positives from exhaust, splash, and transient debris without adding latency for close-range threats.
**Complexity:** Medium (2-3 weeks). Requires ego-motion compensation for frame alignment.
**Key references:** Zoox temporal consistency (Section 5.5); Kodiak IPE temporal analysis.

---

### [PRIORITY: Medium] -- Intensity Calibration and Range Normalization
**Source:** Waymo, Zoox, Kodiak, Nuro
**What it is:** Raw LiDAR intensity depends on range (1/R^2 falloff), angle of incidence, and atmospheric attenuation. Calibrated intensity enables material-based classification: retroreflective markers, high-vis vests, bare metal, rubber, paint, and asphalt each have distinct reflectivity signatures.
**What Aurrigo lacks:** Raw intensity values are used without range normalization. This means the same object at 20m and 60m produces very different intensity values, reducing the utility of intensity for classification.
**How to implement:**
1. Apply range-squared normalization: `I_corrected = I_raw * (range / range_ref)^2` with `range_ref = 10m`.
2. Store per-sensor calibration curves (intensity vs. range for known targets) during factory calibration.
3. Publish corrected intensity alongside XYZ coordinates.
4. Downstream benefit: enables reflectivity-based detection of retroreflective safety vests, apron markings, and aircraft markings.
**Value added:** Enables future reflectivity-based classification of airport-specific objects (high-vis personnel, retroreflective apron markings, aircraft registration). Directly improves SOR and LIOR performance.
**Complexity:** Low (1 week). Simple per-point arithmetic in the Preprocessor.
**Key references:** Waymo Section 1.6; Zoox Section 5.4; Kodiak per-point reflectivity processing.

---

## 2. Calibration & Synchronization

### [PRIORITY: Critical] -- Online Extrinsic Calibration Monitoring
**Source:** Zoox (CLAMS), Aurora, Kodiak, Motional, Nuro
**What it is:** Continuous monitoring of the relative alignment between the 5 LiDAR sensors during operation. Detects calibration drift from thermal expansion, vibration, mechanical shock, and cargo loading/unloading without requiring the vehicle to return to a calibration bay.
**What Aurrigo lacks:** No online calibration monitoring. If a LiDAR mount shifts (e.g., after a baggage cart collision, thermal cycling, or vibration from diesel operation), the system operates with degraded multi-LiDAR registration until the next manual recalibration.
**How to implement:**
1. **Cross-sensor overlap monitoring:** In regions where two LiDARs share FOV, compute the registration error between their point clouds using ICP or NDT. Publish this as a health metric.
2. **Drift detection:** Track the mean registration error over a sliding window (60 seconds). If it exceeds a threshold (e.g., >2cm translation or >0.1 degrees rotation), flag a calibration alert.
3. **Thermal compensation model (optional, Phase 2):** Log temperature from onboard sensors alongside calibration residuals. Build a lookup table mapping temperature to expected calibration drift and apply predictive correction.
4. **Post-shift calibration analysis (a la Kodiak):** After each operational shift, analyze tracker performance residuals to identify systematic per-sensor biases and recommend recalibration or apply corrections.
**Value added:** Prevents insidious degradation of multi-LiDAR fusion accuracy. A 1-degree yaw drift on a single LiDAR causes 1.7m lateral error at 100m -- enough to miss an adjacent aircraft wing.
**Complexity:** Medium (3-5 weeks). ICP overlap analysis is well-supported in PCL.
**Key references:** Zoox CLAMS (Section 10); Kodiak post-drive calibration analysis (Section 8); Aurora online recalibration (Section 17); Motional online calibration monitoring (Section 11).

---

### [PRIORITY: High] -- Hardware Time Synchronization (PTP/gPTP)
**Source:** Waymo, Zoox, Aurora, Motional, Nuro
**What it is:** IEEE 1588 Precision Time Protocol (PTP) synchronizes all sensor clocks to a common GPS-disciplined time base with sub-microsecond accuracy. Without it, multi-sensor data represents different moments in time, causing spatial misalignment.
**What Aurrigo lacks:** Sensor timestamps are assigned by ROS message arrival time, not hardware PTP timestamps. At 10 km/h (typical apron speed), a 10ms synchronization error causes a 2.8cm position offset -- manageable. But at higher speeds or for moving objects (aircraft at 20 km/h), misalignment grows to 5.5cm per LiDAR, which compounds across 5 sensors.
**How to implement:**
1. Verify whether the RS32 supports PTP timestamping (many RoboSense models do via firmware).
2. Deploy a PTP grandmaster clock (GPS-disciplined NTP/PTP server) on the vehicle network.
3. Configure each RS32 as a PTP slave clock.
4. Modify the ROS LiDAR driver to use the sensor's hardware timestamp rather than ROS `ros::Time::now()`.
5. Use the hardware timestamp in the Aggregator for proper per-point motion compensation.
**Value added:** Ensures consistent multi-sensor fusion. Critical prerequisite for adding cameras or radar in the future.
**Complexity:** Medium (2-4 weeks). Mostly firmware/driver configuration. May require RS32 firmware update.
**Key references:** Waymo Section 10; Zoox Section 14; Motional Section 8.

---

### [PRIORITY: Medium] -- LiDAR-to-LiDAR Extrinsic Calibration Refinement via ICP
**Source:** Waymo, Kodiak, Motional
**What it is:** Periodic or continuous ICP-based alignment of overlapping LiDAR point clouds to verify and refine the extrinsic calibration between the 5 RS32 sensors. Complements the online monitoring described above.
**What Aurrigo lacks:** Extrinsics are set at factory calibration and not refined in the field. Over the life of the vehicle, mounting brackets deform, bolts settle, and calibration degrades.
**How to implement:**
1. For each pair of LiDARs with overlapping FOV, extract the overlapping region.
2. Run Point-to-Plane ICP (`pcl::IterativeClosestPointWithNormals`) on the overlap region against each other.
3. If the resulting transformation deviates from identity by more than a threshold, issue a calibration correction.
4. Run as a background process (1 Hz) in a dedicated nodelet.
**Value added:** Self-healing calibration that maintains fusion accuracy without technician intervention.
**Complexity:** Medium (2-3 weeks). PCL provides ICP implementations.
**Key references:** Waymo Section 5.7 (ICP variants); Motional Section 15 (NDT/ICP localization).

---

## 3. State Estimation & Tracking Upgrades

### [PRIORITY: Critical] -- Interacting Multiple Model (IMM) Filter
**Source:** Waymo, Kodiak, Motional
**What it is:** Runs a bank of Kalman filters in parallel, each using a different motion model (Constant Velocity, Constant Acceleration, Constant Turn Rate), and combines outputs based on model probabilities. When an object transitions from straight-line motion to turning, the IMM automatically shifts weight to the turning model.
**What Aurrigo lacks:** Single-model Kalman/EKF trackers. Airport vehicles frequently change behavior: a tug drives straight, then turns sharply around an aircraft nose. A baggage cart accelerates, then brakes suddenly at a stand. The current CV/CA models cannot smoothly handle these transitions, causing track jitter and delayed state updates during maneuvers.
**How to implement:**
1. Implement IMM as a wrapper around the existing EKF in the Polygon Detector.
2. Define 3 models: Constant Velocity (CV), Constant Acceleration (CA), Constant Turn-Rate and Velocity (CTRV).
3. Set the model transition probability matrix with high self-transition (0.95) and low switching (0.025).
4. At each predict step, mix the states; at each update step, compute per-model likelihoods and update model probabilities.
5. Output the probability-weighted combined state estimate.
**Value added:** Dramatically improves tracking of maneuvering airport vehicles (tugs turning, loaders reversing, aircraft taxiing through turns). Reduces track loss during maneuvers.
**Complexity:** Medium (3-4 weeks). The mathematical framework is well-established; implementation requires extending the existing Kalman infrastructure.
**Key references:** Waymo Section 13 (IMM); Kodiak Section 17 (multi-model tracking); Bar-Shalom et al., "Estimation with Applications to Tracking and Navigation."

---

### [PRIORITY: High] -- Track Lifecycle Management with M-of-N Confirmation
**Source:** Waymo, Zoox, Kodiak, Motional
**What it is:** Formal track lifecycle with states: Tentative -> Confirmed -> Coasting -> Deleted. A new detection spawns a tentative track; it must receive M successful associations in N frames to be confirmed (e.g., 3-of-5). Confirmed tracks that lose associations coast for K frames before deletion.
**What Aurrigo lacks:** The current tracker appears to create and report tracks immediately upon first detection, without a confirmation gate. This makes the system vulnerable to one-frame false positives from rain, exhaust, or sensor noise spawning spurious tracks.
**How to implement:**
1. Add a track state machine (enum: TENTATIVE, CONFIRMED, COASTING, DELETED) to the Polygon Detector's track objects.
2. Tentative tracks are not published to downstream consumers (planner, safety system).
3. Once confirmed (M=3, N=5 is a good starting point for 10Hz LiDAR), tracks are published.
4. Coasting tracks maintain their predicted state for up to K=10 frames (1 second at 10Hz) to handle brief occlusions (e.g., a vehicle passing behind a parked loader).
5. Make M, N, K configurable via rosparam.
**Value added:** Eliminates false positive tracks from transient noise. Maintains track continuity through brief occlusions (common on cluttered aprons).
**Complexity:** Low-Medium (2-3 weeks). State machine addition to existing tracker.
**Key references:** Waymo Section 15 (track lifecycle); Zoox Section 16.4; Motional Section 18.

---

### [PRIORITY: High] -- Mahalanobis Distance Gating for Data Association
**Source:** Waymo, Zoox, Kodiak, Motional
**What it is:** Before running the Hungarian algorithm, exclude implausible track-detection pairings using the Mahalanobis distance (a statistical distance that accounts for the track's uncertainty covariance). Only pairs within a chi-squared threshold are considered as candidates.
**What Aurrigo lacks:** The current Hungarian matching likely uses Euclidean distance without accounting for track uncertainty. This causes incorrect associations when tracks have grown uncertain (during occlusion coasting) or when multiple closely-spaced objects (baggage carts in a train) create ambiguous distances.
**How to implement:**
1. Compute the innovation covariance `S = H * P_predicted * H^T + R` for each track.
2. For each detection, compute the Mahalanobis distance: `d_M = sqrt((z - H*x_pred)^T * S^{-1} * (z - H*x_pred))`.
3. Gate: only allow associations where `d_M < chi2_threshold` (e.g., chi-squared(3, 0.99) = 11.34 for 3D position).
4. Feed the gated cost matrix to the existing Hungarian solver.
**Value added:** Prevents incorrect associations in dense apron environments (multiple baggage carts, clustered GSE). Reduces identity switches.
**Complexity:** Low (1-2 weeks). Extends existing data association code.
**Key references:** Waymo Section 14.4; Zoox Section 16.3.

---

### [PRIORITY: Medium] -- Multi-Stage Data Association
**Source:** Waymo (2020 challenge 1st-place solution)
**What it is:** Instead of a single association pass, use 3 stages with progressively relaxed thresholds: (1) high-confidence detections matched to confirmed tracks with tight gating, (2) unmatched young tracks matched with relaxed thresholds, (3) remaining tracks matched against low-confidence detections.
**What Aurrigo lacks:** Single-pass association. On a cluttered apron with many objects of similar size (multiple ULDs, baggage carts, dollies), a single-pass approach forces suboptimal global assignments.
**How to implement:**
1. Stage 1: Match high-confidence detections (large, close objects) to confirmed tracks using tight Mahalanobis gate (3-sigma).
2. Stage 2: Match remaining tentative tracks using enlarged gates (5-sigma).
3. Stage 3: Match remaining tracks to low-confidence or marginal detections (7-sigma).
4. Unmatched detections after Stage 3 spawn new tentative tracks.
**Value added:** Improves association accuracy in dense airport scenes. Reduces track fragmentation for closely-spaced objects.
**Complexity:** Medium (2-3 weeks). Restructuring of existing association logic.
**Key references:** Waymo Section 14.4 (multi-stage gating, CasTrack).

---

### [PRIORITY: Medium] -- Unscented Kalman Filter (UKF) for ULD Tracking
**Source:** Waymo, Kodiak, Nuro
**What it is:** The UKF uses deterministic sigma points to propagate the state distribution through nonlinear models without computing Jacobians, providing better accuracy than EKF for strongly nonlinear dynamics. For the 3-state ULD EKF (which uses PCA orientation estimation), the nonlinearity in the heading/orientation state makes UKF beneficial.
**What Aurrigo lacks:** EKF linearization introduces approximation errors in the ULD heading estimate, particularly when ULDs are observed from varying angles as the vehicle approaches.
**How to implement:**
1. Replace the 3-state ULD EKF with a UKF using the same state vector and process model.
2. Generate 2n+1 = 7 sigma points around the current state estimate.
3. Propagate sigma points through the nonlinear motion model and measurement model.
4. Compute the weighted mean and covariance from propagated sigma points.
5. Use Eigen's matrix operations for efficient sigma point generation.
**Value added:** More accurate ULD orientation estimation, reducing docking alignment errors.
**Complexity:** Medium (2-3 weeks). Well-documented algorithm; Eigen supports the required matrix operations.
**Key references:** Waymo Section 12.4 (UKF); Kodiak Section 17 (UKF discussion).

---

## 4. Ground Segmentation & Occupancy

### [PRIORITY: High] -- Occupancy Grid for Free Space Estimation
**Source:** Waymo, Aurora, Motional, Nuro
**What it is:** A 2D (or 3D) grid where each cell stores a log-odds probability of occupancy, updated via Bayesian inference from LiDAR ray-casting. Every LiDAR beam that passes through a cell provides evidence the cell is free; every return in a cell provides evidence it is occupied. Over time, the grid converges to a high-confidence map of free vs. occupied space.
**What Aurrigo lacks:** No explicit free space representation. The system detects individual objects but has no unified understanding of where it is safe to drive. The planner must reason about object absence indirectly.
**How to implement:**
1. Create a BEV occupancy grid nodelet with configurable resolution (0.25m cells for a 100m x 100m grid = 160,000 cells -- computationally trivial).
2. For each LiDAR frame, perform ray-casting from each sensor origin through each point:
   - Cells along the ray: decrement log-odds by `l_free` (e.g., -0.4).
   - Cell at the point: increment log-odds by `l_occ` (e.g., +0.85).
   - Clamp log-odds to [-5, +5] to prevent saturation.
3. Publish the occupancy grid as a `nav_msgs::OccupancyGrid` message at 10Hz.
4. The planner can use this to verify drivable corridors and detect unexpected obstructions.
**Value added:** Provides a unified, sensor-agnostic free space representation. Detects arbitrary obstacles that may not match any predefined class (dropped cargo, FOD, maintenance equipment). Essential for safe path planning in unstructured apron areas.
**Complexity:** Medium (3-4 weeks). Well-established algorithm with efficient implementations.
**Key references:** Waymo Section 22 (occupancy grids, log-odds); Aurora Section 20 (free space estimation); Motional Section 13 (DOG patent).

---

### [PRIORITY: Medium] -- GroundGrid Enhancement with Negative Obstacle Detection
**Source:** Kodiak (off-road perception), Zoox (GCA ground continuity)
**What it is:** Detection of negative obstacles -- surface drop-offs, potholes, drainage grates, ramp edges -- by analyzing where the ground surface terminates or dips below expected elevation. On an airport apron, ramp edges, aircraft stand boundaries, and drainage channels present negative obstacles.
**What Aurrigo lacks:** GroundGrid filters above-ground obstacles well but does not explicitly detect negative obstacles (ground surface termination or significant dips).
**How to implement:**
1. In the GroundGrid output, check for cells where the ground confidence is low or the fitted ground elevation drops sharply relative to neighbors (delta_z > threshold over delta_xy < step_distance).
2. Flag cells where no ground returns are observed within the expected range as "potential drop-off."
3. Use the Zoox GCA concept: if the furthest point classified as ground is closer than the stopping distance, issue a warning (the ground terminates before the vehicle can stop).
4. Publish negative obstacle detections as a separate point cloud layer or as part of the occupancy grid.
**Value added:** Prevents driving off apron edges, into drainage channels, or onto unstable surfaces. Addresses a category of hazard invisible to above-ground-only detection.
**Complexity:** Medium (2-3 weeks). Extends existing GroundGrid analysis.
**Key references:** Kodiak Section 24 (negative obstacle detection); Zoox Section 3 (GCA ground continuity guarantee).

---

### [PRIORITY: Low] -- Piecewise Planar Ground Fitting for Ramps and Slopes
**Source:** Aurora, Kodiak, Motional
**What it is:** Instead of fitting a single ground plane (RANSAC), divide the BEV space into sectors and fit independent planes per sector. This captures airport apron slopes, ramps, and drainage crown that defeat single-plane models.
**What Aurrigo lacks:** GroundGrid uses a grid-based approach (which already handles some local variation), but may not capture long-range slope transitions where a loading ramp meets the flat apron.
**How to implement:**
1. Divide the point cloud into concentric annular sectors (as in the Concentric Zone Model / Regional GPF).
2. Fit independent ground planes per sector using PCA on the local points.
3. Enforce continuity constraints at sector boundaries (neighboring sectors' planes should be consistent within a tolerance).
**Value added:** Improved ground segmentation near ramps, aircraft loading bridges, and sloped apron sections.
**Complexity:** Medium (2-3 weeks).
**Key references:** Aurora Section 18 (piecewise planar ground fitting); Motional Section 12 (Regional GPF with CZM).

---

## 5. Safety & Redundancy Architecture

### [PRIORITY: Critical] -- Geometric Collision Avoidance (GCA) System
**Source:** Zoox (primary inspiration), Nuro (geometric fallback layer)
**What it is:** An independent, non-ML safety layer that operates on raw LiDAR returns. It defines a trajectory corridor (the volume the vehicle will physically occupy along its planned path), projects raw sensor returns into this corridor, classifies them as ground or obstacle using deterministic curve-fitting, and triggers emergency braking if an obstruction is detected within the stopping distance. It is architecturally isolated from the main perception pipeline.
**What Aurrigo lacks:** No independent safety backup to the main perception pipeline. If the main pipeline misses an object (e.g., due to a segmentation bug, parameter misconfiguration, or novel obstacle type), there is no independent safety check.
**How to implement:**
1. Create a new nodelet (or standalone node for isolation) that subscribes directly to raw LiDAR point cloud topics -- not to the output of any perception node.
2. Receive the planned trajectory from the planner.
3. Compute the trajectory corridor: vehicle width + lateral margin, length = stopping distance at current velocity.
4. Extract points within the corridor, project to an elevation profile (distance-along-trajectory vs. height).
5. Fit a B-spline to the ground returns using weighted least-squares (weight below-curve points higher).
6. Classify above-curve points as obstructions.
7. If the nearest obstruction is within the stopping distance, publish a CAS (Collision Avoidance System) trigger to the vehicle controller.
8. The stopping distance is computed from current velocity and a conservative friction/deceleration model.
**Value added:** Provides a formally verifiable safety guarantee independent of the main perception stack. Catches objects the main pipeline misses (novel obstacles, sensor misconfiguration, software bugs). Does not require classification -- any physical obstruction in the path triggers braking.
**Complexity:** High (4-6 weeks). Requires careful integration with the vehicle controller, but the algorithm itself is straightforward.
**Key references:** Zoox Sections 1-4 (GCA architecture, sensor processing, safety guarantees, trigger conditions); Nuro Section 14 (geometric fallback layer).

---

### [PRIORITY: Critical] -- Sensor Health Monitoring and Degraded Mode Operation
**Source:** Waymo, Kodiak (1000+ safety checks), Nuro
**What it is:** Continuous per-sensor health monitoring (point count, return rate, SNR, timestamp freshness, rotation speed) with automatic transition to degraded-mode operation when sensors are compromised.
**What Aurrigo lacks:** No systematic sensor health monitoring. If an RS32 fails (dust contamination, cable fault, internal error), the system may continue operating with silently degraded perception.
**How to implement:**
1. Create a Sensor Health Monitor nodelet that subscribes to each RS32 point cloud topic.
2. At 1Hz, compute per-sensor metrics:
   - Point count (detect dropout if below threshold, e.g., <1000 points)
   - Timestamp freshness (detect stale data if newest point is >200ms old)
   - Mean intensity (detect lens contamination if intensity drops uniformly)
   - Spatial coverage (detect partial blockage by checking angular coverage)
3. Publish a `/sensor_health` diagnostic topic with per-sensor status (NOMINAL, DEGRADED, FAILED).
4. On degradation: alert the operator, reduce maximum speed proportionally to remaining sensor coverage, and log the event.
5. On failure: if 2+ sensors fail simultaneously, trigger a Minimum Risk Condition (controlled stop).
**Value added:** Prevents operating with unknowingly degraded perception. Critical for safety case and regulatory compliance.
**Complexity:** Medium (2-3 weeks). Monitoring is straightforward; integration with the vehicle controller requires coordination.
**Key references:** Waymo Section 21.2-21.4 (sensor health, degraded mode, MRC); Kodiak Section 28 (1000+ safety checks at 10Hz).

---

### [PRIORITY: High] -- Geometric Consistency Checks on Detections
**Source:** Waymo, Zoox, Kodiak
**What it is:** Post-detection validation ensuring that reported objects are physically plausible: bottom face near the ground plane, dimensions within class-specific ranges, velocities kinematically feasible. Catches detection pipeline errors before they propagate to planning.
**What Aurrigo lacks:** Detections from the segmentation/detection pipeline are passed directly to the planner without physical plausibility checks.
**How to implement:**
1. After Deck Detection and ULD Detection, validate each detection:
   - Ground plane consistency: bottom face within 0.3m of estimated ground height.
   - Size validation: deck dimensions within [2.0m, 4.5m] x [1.5m, 3.0m]; ULD dimensions within known standard sizes (LD3, LD6, LD8, etc.).
   - Velocity feasibility: speed < 30 km/h for airport vehicles, < 50 km/h for aircraft.
2. Detections failing plausibility checks are flagged and logged but not passed to the planner.
**Value added:** Catches spurious detections (e.g., a "ULD" with dimensions 0.2m x 0.2m x 0.2m) before they cause incorrect planning decisions.
**Complexity:** Low (1-2 weeks). Simple threshold checks on existing detection outputs.
**Key references:** Waymo Section 23.2 (geometric consistency checks).

---

### [PRIORITY: High] -- Time-to-Collision (TTC) Computation
**Source:** Waymo, Zoox, Nuro
**What it is:** For each tracked object, continuously compute the time until collision assuming current relative velocity is maintained: `TTC = -d / d_dot`, where `d` is the distance and `d_dot` is the closing rate. TTC below a threshold triggers escalating responses (warning, braking, emergency stop).
**What Aurrigo lacks:** No explicit TTC computation. The planner reasons about following distance but does not have a direct measure of collision imminence.
**How to implement:**
1. In the Polygon Detector, for each confirmed track, compute:
   - Range `d` = distance from ego vehicle to nearest point of the tracked object.
   - Range rate `d_dot` = time derivative of `d` (from Kalman velocity estimate projected along the line of sight).
   - `TTC = -d / d_dot` (only meaningful when d_dot < 0, i.e., closing).
2. Publish TTC per track on a `/ttc` topic.
3. Integrate TTC thresholds into the safety system:
   - TTC < 3.0s: alert the planner to begin deceleration.
   - TTC < 1.5s: trigger pre-staged braking.
   - TTC < 0.5s: trigger emergency stop (CAS).
**Value added:** Provides a physics-based, velocity-aware safety metric that adapts to approach speed. Critical for aircraft proximity operations where closure rates vary.
**Complexity:** Low (1-2 weeks). Simple arithmetic on existing track state.
**Key references:** Waymo Section 20.2 (TTC); Zoox Section 7.4 (radar-based TTC); Nuro Section 22 (airbag trigger TTC).

---

### [PRIORITY: Medium] -- Rule-Based Safety Validation of Planned Trajectories
**Source:** Waymo ("Demonstrably Safe AI"), Mobileye (RSS), Motional (Rulebooks)
**What it is:** An independent validation layer that checks every planned trajectory against deterministic safety rules before it is sent to the vehicle controller. Rules include: trajectory is kinematically feasible, does not intersect any tracked object, does not leave the drivable area, respects minimum following distance, and is consistent with airport ground movement rules.
**What Aurrigo lacks:** No independent validation layer between the planner and the vehicle controller.
**How to implement:**
1. Create a Trajectory Validator nodelet that receives planned trajectories and current tracked objects.
2. Check each trajectory against rules:
   - Kinematic feasibility: acceleration < a_max, curvature < kappa_max.
   - Collision check (GJK or SAT on oriented bounding boxes): the ego vehicle's swept volume along the trajectory must not intersect any tracked object's predicted volume.
   - Road boundary: trajectory must remain within the defined apron operating area.
   - Minimum safe distance from aircraft: configurable buffer (e.g., 3m from fuselage, 10m from engine intake).
3. If any rule is violated, reject the trajectory and request replanning.
**Value added:** Provides a provably correct safety layer on top of the planner. Essential for certification and safety case.
**Complexity:** Medium-High (4-6 weeks). Collision checking algorithms (GJK, SAT) are well-documented but require careful implementation.
**Key references:** Waymo Section 20-21 (geometric safety checks, rule-based fallbacks); Mobileye Section 3 (RSS formal safety); Motional Section 2 (Rulebooks).

---

## 6. Sensor Fusion & New Modalities

### [PRIORITY: High] -- LWIR Thermal Camera Integration
**Source:** Zoox (Teledyne FLIR Boson), Nuro
**What it is:** Long-Wave Infrared (8-14 micrometer) thermal cameras detect objects by their emitted heat radiation, independent of ambient lighting. Human body temperature (37C) creates 10-20C contrast against ambient, producing a signal-to-noise ratio exceeding 400:1 at typical NETD values.
**What Aurrigo lacks:** No thermal sensing. Airport aprons have critical nighttime and low-visibility scenarios (pre-dawn operations, fog, rain) where ground personnel in dark clothing are difficult to detect by LiDAR alone (few returns from dark fabric). Thermal cameras detect humans with near-perfect reliability regardless of clothing color, ambient lighting, or weather.
**How to implement:**
1. Mount 2-4 FLIR Boson 640 modules (compact, low-power, ~$1500 each) covering the forward hemisphere and sides.
2. Process thermal images through classical NUC (non-uniformity correction), bad pixel replacement, and AGC (automatic gain control) -- these are performed on-module by the Boson's Myriad 2 VPU.
3. Use blob detection with temperature thresholding for pedestrian detection: connected regions with apparent temperature >28C and area consistent with human body size.
4. Fuse thermal detections with LiDAR tracks using gated nearest-neighbor association in BEV coordinates.
5. A thermal-only detection (no corresponding LiDAR track) should trigger cautious behavior (slow down, increase awareness).
**Value added:** Dramatically improves ground personnel detection at night and in low-visibility conditions. Thermal cameras are the only passive sensor that detects humans with near-100% reliability in all lighting and weather conditions. Airport worker safety is the highest priority.
**Complexity:** High (6-8 weeks). Includes hardware integration, calibration (thermal-to-LiDAR extrinsic), and fusion algorithm development. The Zoox factory calibration approach using halogen-heated dots provides a proven cross-modal calibration technique.
**Key references:** Zoox Section 6 (FLIR Boson processing, NUC, NETD); Zoox Section 12 (thermal-to-RGB calibration); Nuro Section 3 (LWIR processing, temperature-based detection).

---

### [PRIORITY: Medium] -- Acoustic Siren and Alert Detection (Microphone Array)
**Source:** Zoox, Nuro
**What it is:** A microphone array for detecting emergency vehicle sirens and other audible airport alerts (aircraft horn, ground vehicle warning beepers, communication systems). Uses classical FFT/spectrogram analysis to identify siren frequency patterns and GCC-PHAT for direction-of-arrival estimation.
**What Aurrigo lacks:** No acoustic sensing. Airport aprons have rich acoustic cues: aircraft engine spool-up, reversing alarms on GSE, communication horns, and emergency vehicles. These are detectable before the source is visible.
**How to implement:**
1. Mount 4-8 microphones around the vehicle for omnidirectional coverage.
2. Implement STFT-based spectrogram analysis to detect characteristic alert patterns (reversing beepers: 1000-2500Hz pulsed; vehicle horns: 200-500Hz sustained).
3. Use GCC-PHAT between microphone pairs for DOA estimation.
4. Publish detected alerts with estimated direction on a `/audio_alerts` topic.
5. The planner can use this for early warning of approaching vehicles before LiDAR detection.
**Value added:** Early warning of approaching emergency or reversing vehicles, especially in blind spots. Detects audible alerts before visual contact.
**Complexity:** Medium-High (4-6 weeks). Requires audio hardware, DSP pipeline, and integration with the perception stack.
**Key references:** Zoox Section 9 (acoustic processing, FFT/spectrogram, GCC-PHAT, DOA); Nuro Section 5 (microphone array, siren detection).

---

### [PRIORITY: Medium] -- 4D Imaging Radar Integration
**Source:** Aurora (Continental ARS548), Kodiak (ZF 4D Radar), Nuro, Zoox
**What it is:** 77GHz FMCW imaging radar providing 4D point clouds (range, azimuth, elevation, Doppler velocity). Radar operates through rain, fog, dust, and jet exhaust with negligible degradation. Provides instantaneous radial velocity per detection -- no multi-frame tracking needed.
**What Aurrigo lacks:** No radar. The LiDAR-only stack is vulnerable to weather degradation (rain, fog, jet exhaust). Radar provides a fundamentally different sensing modality that is robust to all conditions that degrade LiDAR.
**How to implement:**
1. Mount 2-4 automotive 4D imaging radar modules (e.g., Continental ARS548, ZF Full Range Radar) for 360-degree coverage.
2. Process radar detections through classical FMCW pipeline (range FFT, Doppler FFT, CFAR, DOA -- all performed on-sensor).
3. Fuse radar detections with LiDAR tracks using Mahalanobis distance gating and Hungarian assignment.
4. Use radar Doppler for:
   - Instantaneous velocity estimation (bypasses multi-frame tracking latency).
   - Static vs. moving object discrimination.
   - TTC computation with direct closing-rate measurement.
5. In degraded LiDAR conditions (heavy rain, fog), shift weight toward radar detections.
**Value added:** Weather-robust detection. Instantaneous velocity measurement. Redundant modality for sensor failure resilience. Direct Doppler velocity eliminates multi-frame tracking velocity lag.
**Complexity:** High (6-10 weeks). Hardware integration, calibration (radar-to-LiDAR extrinsic), and fusion algorithm development.
**Key references:** Aurora Section 8-9 (ARS548 processing, radar-LiDAR fusion); Kodiak Section 3 (ZF 4D radar signal processing); Nuro Section 2 (imaging radar FMCW chain).

---

## 7. Geometric Methods & Classical CV

### [PRIORITY: High] -- LiDAR Reflectivity-Based Apron Marking Detection
**Source:** Kodiak (Luminar reflectivity-based lane detection)
**What it is:** Airport apron markings (taxi lines, stand markings, safety zones) use retroreflective paint with significantly higher reflectivity than the surrounding asphalt. LiDAR reflectivity (after range normalization) can detect these markings identically by day and by night, providing an alternative to camera-based marking detection.
**What Aurrigo lacks:** No apron marking detection. The vehicle operates in a known apron environment but does not perceive the markings that define stand boundaries, taxi routes, and restricted zones.
**How to implement:**
1. After intensity calibration (Section 1, Intensity Calibration), apply a reflectivity threshold to ground-classified points from GroundGrid.
2. High-reflectivity ground points are candidates for apron markings.
3. Cluster adjacent marking points and fit lines/curves to extract marking geometry.
4. Compare detected markings against a stored apron map for localization refinement and safety zone verification.
**Value added:** Enables localization on the apron using painted markings. Verifies the vehicle is within its designated operating zone. Works identically day and night.
**Complexity:** Medium (3-4 weeks). Requires intensity calibration as a prerequisite.
**Key references:** Kodiak Section 12 (LiDAR-based lane detection from reflectivity).

---

### [PRIORITY: Medium] -- L-Shape Fitting for Vehicle Orientation Estimation
**Source:** Widely used in AV industry (Waymo, Motional, Kodiak)
**What it is:** For partially-observed vehicles (where LiDAR sees only one or two sides), fit an L-shape to the visible point cloud edges to estimate the vehicle's orientation and full extent. This is a classical alternative to PCA when only two faces of a rectangular object are visible.
**What Aurrigo lacks:** PCA-based orientation estimation works well when all sides of an object are visible but can produce 90-degree orientation errors when only one face is observed (PCA's first principal component aligns with the visible face, not the vehicle heading).
**How to implement:**
1. For each tracked object cluster, attempt L-shape fitting:
   - Search for two dominant edge directions (RANSAC line fitting on the cluster boundary).
   - If two approximately perpendicular edges are found, the L-shape defines the corner, and the object's full bounding box can be estimated from known class dimensions.
2. Use L-shape orientation when the fitting quality is high (low residual); fall back to PCA when the L-shape fit is poor.
3. Apply this to both vehicle and ULD tracking.
**Value added:** More accurate orientation estimation for partially-observed objects, reducing docking alignment errors and improving predicted trajectories.
**Complexity:** Medium (2-3 weeks). Well-documented algorithm in autonomous driving literature.
**Key references:** Zhang et al., "Efficient L-Shape Fitting for Vehicle Detection Using LiDAR Point Clouds" (IV 2017).

---

### [PRIORITY: Medium] -- Swept-Path Collision Checking (GJK/SAT)
**Source:** Waymo
**What it is:** Before executing a trajectory, compute the vehicle's swept volume along the planned path and check for intersection with all tracked object volumes. GJK (Gilbert-Johnson-Keerthi) or SAT (Separating Axis Theorem) provides efficient convex-convex collision detection.
**What Aurrigo lacks:** Point-based proximity checks rather than volumetric collision checking. For a long baggage tractor with trailers, the swept volume during turns is significantly larger than the point-based footprint.
**How to implement:**
1. Compute the ego vehicle's swept volume by sampling the planned trajectory at discrete time steps and taking the union of the vehicle's oriented bounding box at each sample.
2. For each tracked object, compute its predicted bounding box at each time step (from Kalman prediction).
3. Check intersection using SAT (15 candidate separating axes for two OBBs) at each time step.
4. If any intersection is detected, flag the trajectory as unsafe.
**Value added:** Volumetric collision checking catches scenarios that point-based checks miss, especially during turns with long vehicle/trailer combinations.
**Complexity:** Medium (3-4 weeks). SAT is the simpler choice for OBB-OBB checks.
**Key references:** Waymo Section 20.1 (GJK, SAT, swept volume collision checking).

---

## 8. Data Association & Track Management

### [PRIORITY: High] -- Joint Probabilistic Data Association (JPDA)
**Source:** Waymo, Kodiak
**What it is:** Instead of making hard one-to-one associations (as Hungarian does), JPDA computes a weighted combination of all plausible associations for each track. Each track's state is updated using a weighted average of all detections in its gate, with weights proportional to association probabilities. This is more robust in cluttered environments where multiple detections fall near a single track.
**What Aurrigo lacks:** Hard one-to-one Hungarian assignment. On cluttered aprons with closely-spaced baggage carts, ULDs, and dollies, hard assignment frequently makes incorrect choices that cause identity switches and track fragmentation.
**How to implement:**
1. For each track, identify all detections within its Mahalanobis gate.
2. Compute association probabilities for each feasible track-detection pair based on the Mahalanobis distance and detection density.
3. Update each track's state using the probability-weighted combination of associated detections (beta-weighted Kalman update).
4. JPDA naturally handles clutter by assigning a portion of the probability to "no detection" (missed detection hypothesis).
**Value added:** Significant improvement in tracking accuracy in dense, cluttered airport environments. Reduces identity switches between closely-spaced objects.
**Complexity:** Medium-High (3-5 weeks). More complex than Hungarian but well-documented in tracking literature.
**Key references:** Waymo Section 14.3 (JPDA); Bar-Shalom and Fortmann, "Tracking and Data Association."

---

### [PRIORITY: Medium] -- Track Re-Identification After Occlusion
**Source:** Waymo, Zoox
**What it is:** After an object re-emerges from occlusion, match it to a coasting track rather than creating a new track. This is done by comparing the reappearing detection's position and velocity against coasting tracks' predicted states, using a relaxed Mahalanobis gate (since the coasting track has high uncertainty).
**What Aurrigo lacks:** When an object is briefly occluded (e.g., a worker walks behind a parked vehicle for 2 seconds), the track is deleted and a new one is created when the object reappears. This causes track fragmentation and loss of velocity/acceleration history.
**How to implement:**
1. When a coasting track reaches its deletion timeout, do not immediately delete it -- move it to a "dormant" state with further-relaxed coasting (e.g., 5 additional seconds).
2. When a new detection appears near a dormant track's predicted position (within a wide gate), reactivate the track with the new detection rather than creating a new track.
3. Size consistency: the reappearing object's dimensions should be similar to the dormant track's stored dimensions.
**Value added:** Maintains continuous track identity through brief occlusions, preserving velocity and behavioral history. Critical for safe following behavior when objects are intermittently occluded by apron clutter.
**Complexity:** Low-Medium (2-3 weeks). Extension of track lifecycle management.
**Key references:** Waymo Section 15.5 (track re-identification); Zoox Section 16.4.

---

## 9. Weather & Degraded Operation

### [PRIORITY: High] -- Weather Severity Estimation and Adaptive Perception
**Source:** Aurora, Kodiak (Hesai IPE), Zoox
**What it is:** Classify the current weather condition (clear, light rain, heavy rain, fog, snow) from LiDAR data statistics and adapt perception parameters accordingly. In heavy rain, relax SOR thresholds, increase temporal filtering, extend dual-return discrimination, and reduce maximum operating speed.
**What Aurrigo lacks:** Fixed perception parameters regardless of weather. The same SOR threshold that works well in clear conditions may remove valid long-range returns in light fog, or fail to filter rain returns in a downpour.
**How to implement:**
1. Compute weather metrics from the LiDAR data at 1Hz:
   - Ratio of divergent first/strongest returns (high ratio = precipitation).
   - Percentage of low-intensity points at short range (high = fog/rain/exhaust).
   - Mean free-path (average distance to first return along the beam; low = dense fog).
2. Classify weather as CLEAR, LIGHT_PRECIP, HEAVY_PRECIP, FOG, EXHAUST based on these metrics.
3. Adjust perception parameters adaptively:
   - CLEAR: standard thresholds.
   - LIGHT_PRECIP: enable LIOR, relax SOR at long range, activate temporal filtering.
   - HEAVY_PRECIP: enable aggressive multi-return filtering, reduce max detection range, reduce max speed.
   - FOG: increase SOR k-NN distance, enable fog-specific intensity filtering.
   - EXHAUST: enable LIOR with hot-exhaust-specific intensity profile.
4. Publish the weather state on `/weather_condition` for planner adaptation.
**Value added:** Maintains perception quality across the full range of airport weather conditions. Prevents false positives in rain/fog while maintaining detection capability.
**Complexity:** Medium (3-4 weeks). The weather classification logic is straightforward; the adaptive parameter tuning requires testing across conditions.
**Key references:** Aurora Section 5 (velocity-based rain filtering); Kodiak Section 2 (Hesai IPE weather classification); Zoox Section 5.5 (multi-method rain filtering).

---

### [PRIORITY: Medium] -- Jet Blast and Engine Exhaust Zone Modeling
**Source:** No direct AV industry analog -- this is airport-domain-specific. Derived from Zoox/Aurora weather filtering principles and Kodiak dust handling.
**What it is:** Model the expected jet exhaust plume zones behind aircraft engines and proactively filter or downweight LiDAR returns within these zones. Jet blast from idling aircraft produces turbulent hot air that creates persistent LiDAR false returns, distinct from rain or fog.
**What Aurrigo lacks:** No domain-specific awareness of jet blast zones. The system treats exhaust plume returns as potential obstacles.
**How to implement:**
1. If the position of aircraft on stands is known (from the apron management system or from perception), compute the expected exhaust plume zone behind each engine based on engine position, aircraft type, and wind direction.
2. Points falling within the plume zone that match the exhaust signature (low intensity, high elongation, short range, temporally transient) are classified as exhaust rather than obstacle.
3. Alternatively, maintain a plume zone map as a static exclusion zone behind known engine positions, loaded from airport configuration data.
4. Even without exact aircraft positions, the intensity + temporal consistency filters (Sections 1) provide good exhaust rejection.
**Value added:** Eliminates a major source of false positives unique to airport operations. Enables confident operation near idling aircraft.
**Complexity:** Medium (3-4 weeks). Requires integration with airport operations data (optional) or relies on signal-level filtering.
**Key references:** Kodiak Section 24 (dust handling with IPE and multi-return); Zoox Section 5.5 (environmental noise filtering).

---

### [PRIORITY: Medium] -- Sensor Staleness Detection and Handling
**Source:** Zoox (sensor staleness framework, arXiv:2506.05780)
**What it is:** Explicit handling of sensor data that arrives late ("stale"). When one LiDAR's data arrives late (due to processing delays, communication hiccups, or buffering), the fusion system can either compensate for the staleness using the timestamp offset or discard the data if it is too old.
**What Aurrigo lacks:** No explicit staleness handling. If one of the 5 RS32s is delayed, its data is fused at the wrong time without awareness of the temporal offset.
**How to implement:**
1. In the Aggregator, compute the staleness of each LiDAR's data: `staleness_i = t_current - t_sensor_i`.
2. If `staleness_i < threshold_low` (e.g., 50ms): use the data normally.
3. If `threshold_low <= staleness_i < threshold_high` (e.g., 50-150ms): use the data but apply ego-motion compensation to shift it to the current time.
4. If `staleness_i >= threshold_high`: discard the data and flag the sensor for health monitoring.
5. Publish staleness metrics on a diagnostic topic.
**Value added:** Prevents spatial misalignment from stale sensor data. Provides early warning of sensor communication issues.
**Complexity:** Low-Medium (2-3 weeks). Mostly timestamp arithmetic and threshold logic.
**Key references:** Zoox Section 15 (sensor staleness framework, per-point timestamp offset, two-tier strategy).

---

## 10. Formal Methods & Safety Verification

### [PRIORITY: High] -- Formal Safety Distance Model (RSS-Inspired)
**Source:** Mobileye (Responsibility-Sensitive Safety), Motional (Rulebooks)
**What it is:** A mathematical model defining the minimum safe following distance and lateral clearance as a function of velocities, maximum braking capabilities, and reaction time. RSS provides provable collision freedom when all parties respect the model, even though the ego vehicle uses conservative assumptions about others' behavior.
**What Aurrigo lacks:** Following distance and clearance rules are likely empirical/tuned rather than formally derived. Airport operations have clear physical constraints (max vehicle speeds, max aircraft taxi speeds, known braking capabilities) that make formal safety distance computation tractable.
**How to implement:**
1. Define the longitudinal safe distance:
   `d_safe_long = v_ego * rho + (v_ego^2) / (2 * a_min_brake) - (v_front^2) / (2 * a_max_brake_front)`
   where `rho` is reaction time, `a_min_brake` is ego's minimum braking deceleration (conservative), and `a_max_brake_front` is the front vehicle's maximum braking (generous assumption).
2. Define the lateral safe distance:
   `d_safe_lat = v_lat * rho + (v_lat^2) / (2 * a_lat_min) + mu_lat`
   where `v_lat` is relative lateral velocity and `mu_lat` is a static lateral margin (e.g., 1.0m from aircraft fuselage).
3. Implement these as real-time constraints in the planner and trajectory validator.
4. For airport-specific constraints, add minimum distances from aircraft engines (jet intake/exhaust hazard zones) as hard constraints.
**Value added:** Provides mathematically provable collision avoidance guarantees under stated assumptions. Strengthens the safety case for regulatory approval. Directly computable from vehicle dynamics and perception state.
**Complexity:** Medium (3-4 weeks). The mathematics is straightforward; the challenge is calibrating the parameters (reaction time, braking capabilities) for Aurrigo's specific vehicles.
**Key references:** Mobileye Section 3 (RSS formal safety distance); Shalev-Shwartz et al., "On a Formal Model of Safe and Scalable Self-driving Cars" (2017).

---

### [PRIORITY: Medium] -- Temporal Logic Safety Specifications
**Source:** Motional/nuTonomy (LTL/STL specifications, TuLiP toolbox)
**What it is:** Express safety requirements as formal temporal logic specifications (e.g., "the vehicle shall always maintain d_safe_long from the preceding vehicle," "the vehicle shall never enter a restricted zone," "the vehicle shall eventually reach its destination"). These specifications can be automatically verified against the control software using model checking.
**What Aurrigo lacks:** Safety requirements are expressed informally (in natural language or code comments) rather than as machine-checkable formal specifications.
**How to implement:**
1. Identify the 10-20 most critical safety invariants for airport operations:
   - G(distance_to_aircraft > d_min_aircraft)
   - G(distance_to_personnel > d_min_personnel)
   - G(speed < v_max_apron)
   - G(not_in_restricted_zone OR authorized)
   - G(sensor_health >= DEGRADED) -- always have minimum sensor capability.
2. Encode these as Signal Temporal Logic (STL) specifications with time bounds.
3. Implement a runtime monitor that evaluates each specification against the current vehicle state at 10Hz.
4. Log violations with timestamps for offline analysis. Critical violations (safety invariants) trigger immediate safe-stop.
**Value added:** Machine-checkable safety specifications that can be verified at runtime and audited for regulatory compliance. Transforms informal safety rules into provable system properties.
**Complexity:** Medium-High (4-6 weeks for initial implementation). Significant effort in specification elicitation and parameter calibration.
**Key references:** Motional Section 1 (temporal logic specifications, model checking, TuLiP); Mobileye Section 3 (RSS as a formal safety framework).

---

### [PRIORITY: Medium] -- Rulebook Framework for Airport Ground Movement Rules
**Source:** Motional/nuTonomy (Rulebooks)
**What it is:** A formally defined pre-ordered set of rules where each rule is a violation metric on possible trajectories. Higher-priority rules (e.g., no collision) must be satisfied before lower-priority rules (e.g., minimize travel time) are even considered. The rulebook provides a principled way to resolve conflicts between competing objectives.
**What Aurrigo lacks:** Behavioral rules are likely encoded as ad-hoc conditional logic rather than a prioritized formal framework. Airport ground operations have a natural rule hierarchy: avoid aircraft > avoid personnel > follow taxi markings > maintain schedule.
**How to implement:**
1. Define the rule hierarchy:
   - Priority 1: No collision with any object (safety invariant).
   - Priority 2: Maintain safe distance from aircraft and personnel.
   - Priority 3: Obey airport speed limits and restricted zone boundaries.
   - Priority 4: Follow designated taxi routes and stand approach paths.
   - Priority 5: Minimize travel time and energy consumption.
2. For each candidate trajectory, compute violation scores for all rules.
3. Select the trajectory that is optimal under the pre-order: first minimize Priority 1 violations, then break ties with Priority 2, and so on.
4. This naturally handles dilemmas: if following the taxi route would violate the safe distance rule (e.g., an unexpected obstacle on the route), the vehicle deviates from the route while maintaining safety.
**Value added:** Principled, auditable decision-making that resolves conflicting objectives correctly and consistently. Simplifies behavioral specification and testing.
**Complexity:** Medium (3-5 weeks). The framework is well-defined; the work is in specifying rules and integrating with the planner.
**Key references:** Motional Section 2 (Rulebook framework, rule priority hierarchy, compositional properties); Censi et al., "Liability, Ethics, and Culture-Aware Behavior Specification using Rulebooks" (ICRA 2019).

---

### [PRIORITY: Low] -- ISO 26262 / SOTIF Alignment for Perception Safety Case
**Source:** Zoox (ISO 26262, SOTIF, ARP4754A), Kodiak (ASIL-D ACE), Mobileye (RSS)
**What it is:** Structured safety analysis of the perception system following ISO 26262 (functional safety) and ISO 21448 SOTIF (Safety of the Intended Functionality). SOTIF specifically addresses perception failures -- scenarios where the system is functioning correctly but its intended functionality is insufficient (e.g., failing to detect a dark-clothed person at night because LiDAR has low reflectivity from dark fabric).
**What Aurrigo lacks:** Unclear whether a formal SOTIF analysis has been performed on the perception stack.
**How to implement:**
1. Conduct a SOTIF analysis: identify triggering conditions (environmental conditions that may cause the perception system to produce incorrect output) and resulting hazardous behaviors.
2. For each triggering condition, implement mitigation:
   - Dark clothing + night: thermal camera integration (Section 6).
   - Rain + jet exhaust: multi-return + LIOR filtering (Section 1).
   - Sensor failure: sensor health monitoring + degraded mode (Section 5).
   - Novel objects (FOD): occupancy grid free space (Section 4).
3. Document the safety case: for each identified hazard, trace the mitigation through the perception architecture.
**Value added:** Structured safety argument for regulatory approval. Identifies gaps in perception coverage before they cause incidents.
**Complexity:** High (ongoing effort). This is a process and documentation activity more than a software implementation.
**Key references:** Zoox Section 3.1 (ISO 26262, SOTIF, ARP4754A alignment); Kodiak Section 23 (ASIL-D compliance requirements).

---

## Implementation Roadmap

### Phase 1: Critical Safety (Weeks 1-8)
1. Sensor Health Monitoring (2-3 weeks)
2. Multi-Return Processing for weather (2-4 weeks)
3. Geometric Collision Avoidance (GCA) system (4-6 weeks, parallel)
4. TTC computation (1-2 weeks, parallel)

### Phase 2: Tracking and Robustness (Weeks 4-14)
1. Track Lifecycle Management with M-of-N (2-3 weeks)
2. Mahalanobis Distance Gating (1-2 weeks)
3. IMM Filter (3-4 weeks)
4. Online Calibration Monitoring (3-5 weeks, parallel)
5. Geometric Consistency Checks (1-2 weeks)

### Phase 3: Occupancy and Weather (Weeks 10-18)
1. Occupancy Grid (3-4 weeks)
2. Weather Severity Estimation (3-4 weeks)
3. DSOR and LIOR filtering (2 weeks)
4. Intensity Calibration (1 week)
5. Sensor Staleness Handling (2-3 weeks)

### Phase 4: New Sensing Modalities (Weeks 14-24)
1. LWIR Thermal Camera Integration (6-8 weeks)
2. RSS-Inspired Safety Distance Model (3-4 weeks, parallel)
3. LiDAR Reflectivity-Based Marking Detection (3-4 weeks, parallel)

### Phase 5: Advanced Tracking and Formal Methods (Weeks 20-30)
1. JPDA Data Association (3-5 weeks)
2. Multi-Stage Association (2-3 weeks)
3. Rulebook Framework (3-5 weeks)
4. Temporal Logic Safety Specifications (4-6 weeks)
5. 4D Imaging Radar Integration (6-10 weeks, parallel)

---

## Summary of Recommendations by Priority

| Priority | Count | Key Themes |
|----------|-------|------------|
| **Critical** | 5 | Multi-return weather filtering, online calibration monitoring, GCA safety system, sensor health monitoring, IMM tracking |
| **High** | 12 | DSOR, LIOR, track lifecycle, Mahalanobis gating, occupancy grid, thermal cameras, TTC, geometric consistency, weather estimation, PTP sync, reflectivity marking detection, RSS safety distance |
| **Medium** | 14 | Temporal consistency, intensity calibration, ICP calibration refinement, negative obstacle detection, piecewise ground fitting, acoustic sensing, 4D radar, L-shape fitting, swept-path collision, JPDA, track re-ID, jet blast modeling, staleness handling, temporal logic specs, rulebook framework |
| **Low** | 2 | Piecewise planar ground fitting, ISO 26262/SOTIF alignment |

**Total: 33 actionable recommendations spanning all 10 categories.**
