# Sensor-to-Algorithm Readiness Contract Design

Date: 2026-05-13
Status: Ready for user review

## Summary

Add an audit-backed bridge page that answers whether sensor data is ready before
perception, SLAM, localization, tracking, occupancy, mapping, or planning-facing
modules consume it.

The repository already has strong material on intrinsic calibration, extrinsic
calibration, temporal calibration, timestamp semantics, PTP/PPS/GNSS time,
LiDAR deskew, camera exposure timing, radar frame timing, calibration drift,
fleet calibration operations, and validation gates. The missing artifact is a
single operational contract that assembles those topics into pre-algorithm
acceptance rules.

## Audit Findings

### Existing Strong Coverage

The repo already covers the core sensor-readiness topics across several layers:

| Topic | Existing coverage |
|---|---|
| Sensor calibration fundamentals | `10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md` |
| Multi-sensor calibration observability | `10-knowledge-base/geometry-3d/multi-sensor-calibration-observability.md` |
| Camera intrinsics, distortion, rolling shutter, exposure timing | `10-knowledge-base/geometry-3d/camera-imaging-noise-calibration.md` |
| LiDAR noise, beam geometry, deskew, calibration hooks | `10-knowledge-base/geometry-3d/lidar-working-principles-noise-models.md` |
| Rolling shutter, LiDAR deskew, motion distortion | `10-knowledge-base/geometry-3d/rolling-shutter-lidar-deskew-motion-distortion.md` |
| Radar range, Doppler, MIMO, CFAR, fusion noise models | `10-knowledge-base/signal-processing/radar-fmcw-mimo-doppler.md` |
| Time sync, timestamping, latency models | `10-knowledge-base/systems-engineering/time-sync-ptp-timestamping-latency-models.md` |
| Time synchronization error budgets | `10-knowledge-base/systems-engineering/time-synchronization-error-budgets.md` |
| Platform sensor timestamp pages | `20-av-platform/sensors/lidar-timestamping-ptp-gps-deskew-provenance.md`, `camera-ptp-trigger-exposure-timestamp-semantics.md`, `radar-frame-timestamping-doppler-integration.md`, `gnss-pps-ptp-holdover-time-integrity.md` |
| Multi-LiDAR extrinsic calibration | `20-av-platform/sensors/multi-lidar-calibration.md` |
| Sensor degradation and health monitoring | `20-av-platform/sensors/sensor-degradation-health-monitoring.md` |
| Fleet calibration operations | `40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md` |
| Runtime interface acceptance rules | `40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md` |
| Fleet data lineage | `50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md` |
| Calibration release validation | `60-safety-validation/verification-validation/multi-sensor-calibration-release-benchmark.md` |
| Timing, jitter, replay, and TF validation | `60-safety-validation/verification-validation/timestamp-shift-sweep-protocol.md`, `sensor-dropout-latency-jitter-stress-protocol.md`, `replay-time-semantics-and-tf-message-filter-validation.md` |

### Coverage Gaps

The gap is not missing first-principles content. The gap is integration and
handoff clarity.

1. There is no single "sensor-to-algorithm readiness" entrypoint.
2. Preprocessing gates are scattered across sensor, geometry, signal-processing,
   systems, runtime, and validation pages.
3. The exact acceptance rules before algorithm consumption are not visible in
   one place.
4. Camera and LiDAR readiness is easier to discover than radar, IMU, GNSS,
   wheel-odometry, thermal, or event-sensor readiness.
5. Provenance, calibration package state, TF validity, timestamp validity,
   sensor health, and algorithm input semantics are present, but not tied
   together as one pre-algorithm contract.

### Sufficiency Assessment

The repository has enough source material to support a comprehensive
pre-algorithm sensor-readiness page. The implementation should reuse and
cross-link existing pages rather than create duplicate calibration tutorials.

## Goals

1. Create a single bridge page that defines pre-algorithm sensor readiness.
2. Consolidate intrinsic, extrinsic, temporal, frame-tree, preprocessing,
   health, provenance, and acceptance-gate topics into one operational contract.
3. Make algorithm owners able to answer: "Can this sensor-derived input be
   consumed now?"
4. Improve discoverability for readers moving from sensors and calibration into
   perception, SLAM, localization, tracking, occupancy, mapping, and planning.
5. Use existing repo pages as canonical references for details.

## Non-Goals

- Do not rewrite calibration fundamentals.
- Do not duplicate the multi-LiDAR calibration deep dive.
- Do not create a new validation protocol in this change.
- Do not define exact numeric thresholds for all fleets or sensors. Thresholds
  remain deployment-specific and should be linked to validation pages.
- Do not change runtime schemas or add code as part of this design.

## Placement And Links

Add the bridge page at:

`20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md`

Link it from:

- `20-av-platform/sensors/calibration-tracking.md`
- `20-av-platform/sensors/sensor-degradation-health-monitoring.md`
- `10-knowledge-base/geometry-3d/overview.md`
- `10-knowledge-base/sensors/overview.md`
- `10-knowledge-base/systems-engineering/overview.md`
- `40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md`
- `README.md`
- `INDEX.md`

The page belongs under platform sensors because it is the practical handoff from
sensor hardware, calibration, timestamping, and preprocessing to downstream
runtime consumers.

## Page Structure

### 1. Purpose

Define the page as the acceptance contract for sensor-derived data before it is
used by autonomy algorithms. The page should cover raw sensor streams,
preprocessed features, calibrated point clouds, image tensors, radar objects,
IMU/GNSS/odometry measurements, projection products, and health metadata.

### 2. Readiness Stack

Present the readiness stack as:

`physical sensor -> acquisition timestamp -> calibration package -> frame tree -> preprocessing -> health state -> algorithm input`

Each layer should state what it consumes, what it produces, what can fail, and
which downstream modules are affected.

### 3. Calibration Gates

Define the required gates:

| Gate | Required evidence | Blocks or degrades when |
|---|---|---|
| Intrinsics | Camera model, distortion, LiDAR beam model, radar mounting model, thermal/event model where installed | Missing, stale, wrong sensor serial, wrong firmware, high residual |
| Extrinsics | Sensor-to-sensor, sensor-to-IMU, sensor-to-base, sensor-kit-to-base, antenna lever arm | Invalid TF, unexplained transform delta, weak observability, residual drift |
| Temporal calibration | Sensor offset, trigger skew, LiDAR-IMU alignment, radar integration window, camera exposure midpoint | Offset outside validation envelope, unknown clock source, mixed timestamp domains |
| Vehicle geometry | Base frame, ego box, wheelbase, antenna lever arm, occlusion mask | Wrong collision envelope, wrong projection mask, map or planner mismatch |
| Provenance | Calibration ID, tool version, operator or pipeline, sensor serials, firmware, route/session evidence | Package cannot be joined to vehicle and active manifest |

### 4. Modality Checks

Add a modality checklist for:

- Cameras: intrinsics, distortion model, trigger mode, exposure timestamp,
  rolling/global shutter assumption, ISP/RAW contract, rectification state.
- LiDAR: per-point or per-column time, scan start/end semantics, beam model,
  return policy, deskew reference time, intensity/ring availability, overlap
  alignment for multi-LiDAR rigs.
- Radar: frame timestamp, chirp/integration window, Doppler sign convention,
  ego-velocity compensation, radar-camera/radar-LiDAR association residual,
  covariance model.
- IMU/GNSS/RTK/wheel odometry: clock source, lever arms, antenna phase center,
  covariance/protection-level semantics, outage/holdover state, wheel scale and
  slip health.
- Thermal and event cameras where installed: timestamp semantics, calibration
  model, NUC/dead-pixel health, contrast or radiometry assumptions, fusion
  limitations.

### 5. Preprocessing Contract

Define preprocessing as a monitored, versioned contract rather than invisible
cleanup. Include:

- image undistortion and rectification
- camera exposure and rolling-shutter handling
- LiDAR deskew and ego-motion compensation
- multi-LiDAR merge policy
- radar Doppler ego compensation and clutter filtering
- point cloud filtering and weather artifact handling
- projection from 3D to image and image to BEV or voxel frames
- covariance, confidence, validity, and health metadata
- source sensor set and provenance carried through fused outputs

### 6. Algorithm Handoff Table

Add a table that maps each downstream algorithm family to required sensor
readiness inputs:

| Consumer | Required before consumption |
|---|---|
| 2D/3D perception | Valid frames, timestamps, intrinsics/extrinsics, preprocessing version, sensor health, source sensor IDs |
| Sensor fusion | Cross-modal time alignment, transform validity, covariance/confidence semantics, modality health |
| SLAM/localization | Deskewed or consistently raw scans, IMU timing, extrinsics, map frame, covariance/protection level, residual health |
| Tracking | Measurement timestamp, source frame, object covariance, latency budget, association confidence |
| Occupancy/free-space | Source sensor set, blind-spot policy, unknown/free semantics, projection and map-frame validity |
| Mapping | Calibration package, pose source, source traversal provenance, dynamic/static filtering state |
| Runtime assurance/planning | Freshness, health state, unknown policy, degraded-mode action, safety monitor state |

### 7. Reject And Degrade Rules

Define fail-closed rules that align with the existing runtime contract:

- Reject or degrade stale source timestamps, host-receive fallback without an
  approved degraded mode, future timestamps, and mixed clock domains.
- Reject or degrade missing, stale, future, or unapproved TF transforms.
- Reject or degrade red calibration for any consumed sensor pair.
- Reject or degrade algorithm inputs that cannot join to active build, model,
  map, calibration, config, vehicle, and sensor-kit IDs.
- Reject or degrade missing sensor health for safety-relevant inputs.
- Reject release evidence when replay uses mixed wall time and simulation time.

### 8. Evidence Artifacts

List artifacts needed for audit and incident reconstruction:

- calibration package with intrinsics, extrinsics, time offsets, frame tree,
  vehicle geometry, sensor serials, firmware, and signatures
- timing validation report
- TF tree hash and schema version
- sensor health and degradation logs
- preprocessing version and parameter set
- projection or registration previews for calibration events
- replay acceptance report
- release-gate links and active runtime manifest
- bag/MCAP IDs with raw and preprocessed topics

### 9. Related Docs

Link to the relevant existing foundation, platform, runtime, data, and
validation pages so readers can move from the contract into detailed mechanics.

## Integration Pattern

The new page should be written as a contract and checklist, not as a survey.
Use compact tables, direct failure rules, and links to existing details. It
should be readable by sensor owners, perception owners, SLAM/localization
owners, runtime owners, fleet operations, and validation reviewers.

## Acceptance Criteria

The implementation is complete when:

1. `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md` exists.
2. The page includes audit-backed coverage of calibration, synchronization,
   preprocessing, health, provenance, and algorithm input acceptance.
3. The page links to the existing detailed foundation, platform, runtime, data,
   and validation pages instead of duplicating them.
4. The page includes modality-specific checks for cameras, LiDAR, radar,
   IMU/GNSS/RTK/wheel odometry, and optional thermal/event cameras.
5. The page includes an algorithm handoff table for perception, fusion,
   SLAM/localization, tracking, occupancy/free-space, mapping, and runtime
   assurance/planning.
6. `README.md`, `INDEX.md`, and relevant overview pages link to the new bridge
   page.
7. Existing content smoke tests, navigation tests, and link checks pass.

## Resolved Placement Choice

The recommended location is `20-av-platform/sensors/` because the page is a
sensor-readiness contract. If later repo taxonomy prefers runtime interfaces as
the owning layer, the page can be moved under `40-runtime-systems/` and linked
back from sensors. The first implementation should keep it in sensors to match
the user's stated concern: sensor content before algorithm processing.
