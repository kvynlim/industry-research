# Sensor-to-Algorithm Readiness Contract

This contract defines the minimum conditions sensor-derived data must satisfy before perception, sensor fusion, SLAM, localization, tracking, occupancy, mapping, runtime assurance, or planning-facing modules consume it.

It does not replace the detailed calibration, timing, signal-processing, runtime, or validation pages. It is the bridge that makes their handoff explicit: sensor data is acceptable only when its acquisition time, calibration package, frame tree, preprocessing state, health state, and provenance are valid for the consuming algorithm and current release manifest.

## Readiness Stack

| Layer | Consumes | Produces | Typical failure | Affected consumers |
|---|---|---|---|---|
| Physical sensor | Optics, antenna, scanner, MEMS, IMU, GNSS, wheel encoder, thermal/event imager | Raw measurements and hardware status | Contamination, saturation, vibration, thermal drift, degraded GNSS, wheel slip | Every downstream module using that modality |
| Acquisition timestamp | Sensor clock, trigger, PTP/PPS/GNSS/vehicle clock, driver receive path | Source timestamp, receive timestamp, clock state, latency metadata | Host-receive fallback, future stamps, clock-domain mix, dropped or reordered frames | Fusion, tracking, deskew, SLAM, replay evidence |
| Calibration package | Intrinsics, extrinsics, time offsets, vehicle geometry, sensor serials, firmware, tool provenance | Versioned calibration and TF tree | Wrong package, stale transform, weak observability, untraceable serial or firmware | Projection, fusion, occupancy, localization, map building |
| Frame tree | Map, odom, base, sensor, image, radar, IMU, antenna, and vehicle-body frames | Time-valid transform lookup | Missing transform, inverted transform, stale/future TF, unapproved frame alias | Projection, registration, tracking, planning |
| Preprocessing | Raw or feature streams plus calibration and timing state | Rectified images, deskewed clouds, compensated radar, filtered features, health metadata | Invisible filtering, inconsistent deskew policy, wrong projection, missing source sensor set | Perception, occupancy, mapping, safety monitors |
| Health state | Per-sensor diagnostics, cross-sensor consistency, environmental state, runtime status | Green/yellow/red/unknown health and degradation reason | Silent confidence under soiling, rain, glare, multipath, clock drift, or packet loss | Runtime assurance, degraded mode, release gates |
| Algorithm input | Preprocessed data, covariance/confidence, frame/time/provenance/health metadata | Accepted or rejected algorithm input | Consuming stale, frame-invalid, health-unknown, or untraceable data | All autonomy decisions and evidence claims |

## Calibration Gates

| Gate | Required evidence | Blocks or degrades when |
|---|---|---|
| Intrinsics | Camera model and distortion, LiDAR beam model, radar mounting model, thermal/event model where installed | Missing package, stale package, wrong sensor serial, wrong firmware, high residual, unvalidated model family |
| Extrinsics | Sensor-to-sensor, sensor-to-IMU, sensor-to-base, sensor-kit-to-base, antenna lever arm, camera-radar and camera-LiDAR transforms | Invalid TF, unexplained transform delta, weak observability, residual drift, package applied to wrong rig |
| Temporal calibration | Sensor offset, trigger skew, LiDAR-IMU alignment, radar integration window, camera exposure midpoint, replay time policy | Offset outside validation envelope, unknown clock source, mixed timestamp domains, replay wall-time/sim-time mismatch |
| Vehicle geometry | Base frame, ego box, wheelbase, antenna lever arm, sensor occlusion mask, body-to-kit transform | Wrong collision envelope, wrong projection mask, map mismatch, planner clearance mismatch |
| Provenance | Calibration ID, tool version, operator or pipeline, sensor serials, firmware, route/session evidence, signatures | Package cannot be joined to vehicle, sensor kit, active runtime manifest, or validation evidence |

## Modality Checks

| Modality | Must be explicit before algorithm use | Primary downstream risk |
|---|---|---|
| Camera | Intrinsics, distortion model, trigger mode, exposure timestamp, rolling/global shutter assumption, ISP or RAW contract, rectification state, image frame, camera health | Projected boxes or lifted BEV features align visually but are geometrically wrong |
| LiDAR | Per-point or per-column time, scan start/end semantics, beam model, return policy, deskew reference time, intensity/ring availability, multi-LiDAR overlap alignment | Aggregated clouds smear, duplicate obstacles, or corrupt scan-to-map residuals |
| Radar | Frame timestamp, chirp/integration window, Doppler sign convention, ego-velocity compensation, radar-camera or radar-LiDAR association residual, covariance model | Velocity and range evidence is fused at the wrong time or with the wrong sign |
| IMU/GNSS/RTK/wheel odometry | Clock source, IMU axis convention, antenna phase center, lever arms, covariance/protection-level semantics, outage/holdover state, wheel scale, slip health | Pose propagation appears stable while biases or lever arms corrupt map or planner coordinates |
| Thermal camera | Timestamp semantics, lens/window material, NUC/dead-pixel health, radiometry or contrast assumption, extrinsics to visible/LiDAR frames | Night or jet-blast cues are trusted outside their calibration and health envelope |
| Event camera | Event timestamp resolution, contrast threshold, polarity convention, hot-pixel filtering, extrinsics, clock source | High-rate events are fused with frame sensors under inconsistent time and contrast assumptions |

## Preprocessing Contract

Preprocessing is a monitored and versioned contract, not invisible cleanup.

| Preprocessing step | Required metadata | Reject or degrade when |
|---|---|---|
| Image undistortion and rectification | Intrinsic ID, distortion model, rectification map version, output frame ID | Unknown distortion model, stale intrinsics, untraceable rectification map |
| Camera exposure and rolling-shutter handling | Exposure start/end or midpoint, shutter model, trigger mode, motion model if corrected | Timestamp means receive time, rolling shutter ignored under high ego motion |
| LiDAR deskew and ego-motion compensation | Per-point or per-column time, reference time, pose interpolation source, deskew version | Per-point time unavailable but downstream assumes deskewed geometry |
| Multi-LiDAR merge | Source sensor IDs, pairwise extrinsics, overlap health, merge frame, duplicate policy | Any consumed pair is calibration-red or frame-invalid |
| Radar Doppler compensation | Radar time model, ego velocity source, Doppler sign convention, covariance model | Ego compensation source is stale, sign convention is undocumented, integration window is unknown |
| Point-cloud filtering | Filter version, weather-artifact policy, removed-point class or reason, source topic | Filtered points cannot be distinguished from unobserved space |
| Projection and lifting | Source/target frames, calibration IDs, timestamp used for transform lookup, projection covariance | TF lookup fails, calibration package mismatches, or target frame is ambiguous |
| Fused outputs | Source sensor set, per-modality health, covariance/confidence semantics, provenance IDs | Fused output drops the ability to trace which sensors and transforms produced it |

## Algorithm Handoff Table

| Consumer | Required before consumption |
|---|---|
| 2D/3D perception | Valid frames, source timestamps, intrinsics/extrinsics, preprocessing version, sensor health, source sensor IDs, and ODD validity |
| Sensor fusion | Cross-modal time alignment, transform validity, covariance/confidence semantics, modality health, and source provenance |
| SLAM/localization | Deskewed or consistently raw scans, IMU timing, extrinsics, map frame, pose covariance/protection level, residual health, and map/calibration compatibility |
| Tracking | Measurement timestamp, source frame, object covariance, latency budget, association confidence, and dropout/jitter state |
| Occupancy/free-space | Source sensor set, blind-spot policy, unknown/free semantics, projection validity, map-frame validity, and health-aware confidence |
| Mapping | Calibration package, pose source, traversal provenance, dynamic/static filtering state, raw-log references, and map datum/frame compatibility |
| Runtime assurance/planning | Freshness, health state, unknown policy, degraded-mode action, safety monitor state, and fail-closed behavior for invalid inputs |

## Reject And Degrade Rules

| Rule | Reject or degrade condition | Required response |
|---|---|---|
| Time validity | Stale source timestamp, future timestamp, mixed clock domain, host-receive fallback without approved degraded mode | Reject the message or enter a validated degraded mode |
| TF validity | Missing transform, stale transform, future transform, unapproved frame alias, unapproved TF tree hash | Reject the message and raise frame/TF diagnostics |
| Calibration validity | Red or unknown calibration for a consumed sensor pair, wrong calibration package, unexplained transform delta | Remove affected modality or stop according to the safety case |
| Provenance join | Input cannot join to active build, model, map, calibration, config, vehicle, and sensor-kit IDs | Exclude from release evidence and raise runtime/fleet diagnostics |
| Health state | Sensor health missing, stale, unknown, or red for a safety-relevant input | Treat confidence as invalid and trigger runtime assurance policy |
| Replay consistency | Replay mixes wall time and simulation time or lacks bag/MCAP IDs and active manifest IDs | Reject replay as release evidence |
| Free-space conservatism | Unknown or low-observation cells are promoted to traversable free space in protected zones | Reject the free-space output and trigger safety monitor action |

## Evidence Artifacts

| Artifact | Contents |
|---|---|
| Calibration package | Intrinsics, extrinsics, time offsets, frame tree, vehicle geometry, sensor serials, firmware, tool version, signatures |
| Timing validation report | Clock source, offset envelope, skew, jitter, dropout, timestamp-shift sweep, latency-jitter stress result |
| TF tree evidence | Frame names, transform authorities, static/dynamic split, TF tree hash, lookup failure counts |
| Sensor health log | Per-sensor diagnostics, cross-sensor consistency, environmental state, green/yellow/red/unknown transitions |
| Preprocessing manifest | Rectification maps, deskew policy, filter versions, radar compensation settings, source topic list |
| Projection or registration preview | Before/after visual or numeric evidence for calibration and drift events |
| Replay acceptance report | Bag/MCAP IDs, sim-time policy, active manifest IDs, deterministic replay settings, pass/fail gates |
| Runtime manifest | Build, model, map, calibration, config, vehicle, route, site, sensor-kit, and evidence IDs |

## Related Repository Docs

Foundations:

- [Sensor Calibration and Time Synchronization Fundamentals](../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md)
- [Multi-Sensor Calibration Observability](../../10-knowledge-base/geometry-3d/multi-sensor-calibration-observability.md)
- [Camera Imaging, Noise, and Calibration](../../10-knowledge-base/geometry-3d/camera-imaging-noise-calibration.md)
- [LiDAR Working Principles and Noise Models](../../10-knowledge-base/geometry-3d/lidar-working-principles-noise-models.md)
- [Rolling Shutter, LiDAR Deskew, and Motion Distortion](../../10-knowledge-base/geometry-3d/rolling-shutter-lidar-deskew-motion-distortion.md)
- [FMCW, MIMO, and Doppler Radar Fundamentals](../../10-knowledge-base/signal-processing/radar-fmcw-mimo-doppler.md)
- [Time Sync, PTP, Timestamping, and Latency Models](../../10-knowledge-base/systems-engineering/time-sync-ptp-timestamping-latency-models.md)
- [Time Synchronization Error Budgets](../../10-knowledge-base/systems-engineering/time-synchronization-error-budgets.md)

Platform sensors:

- [Calibration and Synchronization Tracking](calibration-tracking.md)
- [Multi-LiDAR Extrinsic Calibration](multi-lidar-calibration.md)
- [LiDAR Timestamping, PTP/GPS Sync, Deskew, and Provenance](lidar-timestamping-ptp-gps-deskew-provenance.md)
- [Camera PTP, Trigger, Exposure, and Timestamp Semantics](camera-ptp-trigger-exposure-timestamp-semantics.md)
- [Radar Frame Timestamping and Doppler Integration](radar-frame-timestamping-doppler-integration.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](gnss-pps-ptp-holdover-time-integrity.md)
- [Sensor Degradation Detection and Health Monitoring](sensor-degradation-health-monitoring.md)

Runtime, fleet, and validation:

- [Perception-SLAM Runtime Interface Contract](../../40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md)
- [Sensor Calibration Fleet Operations](../../40-runtime-systems/software-operations/sensor-calibration-fleet-ops.md)
- [Perception-SLAM Fleet Data Contract](../../50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md)
- [Multi-Sensor Calibration Release Benchmark](../../60-safety-validation/verification-validation/multi-sensor-calibration-release-benchmark.md)
- [Timestamp Shift Sweep Protocol](../../60-safety-validation/verification-validation/timestamp-shift-sweep-protocol.md)
- [Sensor Dropout, Latency, and Jitter Stress Protocol](../../60-safety-validation/verification-validation/sensor-dropout-latency-jitter-stress-protocol.md)
- [Replay Time Semantics and TF Message Filter Validation](../../60-safety-validation/verification-validation/replay-time-semantics-and-tf-message-filter-validation.md)
