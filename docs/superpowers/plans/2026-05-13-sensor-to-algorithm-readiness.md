# Sensor-to-Algorithm Readiness Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single sensor-to-algorithm readiness contract page and link it from the sensor, foundation, runtime, README, and index entry points.

**Architecture:** The implementation is Markdown-only. The new page lives in `20-av-platform/sensors/` as the practical bridge from sensor acquisition, calibration, timestamping, preprocessing, health, and provenance into downstream algorithm acceptance. Existing detailed pages remain the canonical sources for calibration math, timing models, fleet operations, runtime contracts, and validation protocols.

**Tech Stack:** Markdown, VitePress generated navigation, existing Node 20 link and content verification scripts.

---

## File Structure

- Create: `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md`
  - Responsibility: reader-facing pre-algorithm sensor readiness contract with calibration gates, modality checks, preprocessing contract, algorithm handoff rules, reject/degrade rules, and evidence artifacts.
- Modify: `20-av-platform/sensors/calibration-tracking.md`
  - Responsibility: link calibration and synchronization readers to the pre-algorithm readiness contract.
- Modify: `20-av-platform/sensors/sensor-degradation-health-monitoring.md`
  - Responsibility: link sensor-health readers to the readiness contract consumed by algorithms.
- Modify: `10-knowledge-base/geometry-3d/overview.md`
  - Responsibility: add the bridge page to the calibration and registration reading path.
- Modify: `10-knowledge-base/sensors/overview.md`
  - Responsibility: add the bridge page to the sensor foundation operational handoff path.
- Modify: `10-knowledge-base/systems-engineering/overview.md`
  - Responsibility: add the bridge page to timing and interface-contract reading paths.
- Modify: `40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md`
  - Responsibility: link runtime message acceptance rules back to the sensor-side readiness contract.
- Modify: `README.md`
  - Responsibility: expose the page in high-leverage reading paths and keep public counts consistent.
- Modify: `INDEX.md`
  - Responsibility: expose the page in AV platform, foundations, recent additions, and document statistics.

No code files, package scripts, CI workflows, or generated VitePress files are created.

---

### Task 1: Create The Sensor Readiness Contract Page

**Files:**
- Create: `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md`

- [ ] **Step 1: Verify the page is not already present**

Run:

```powershell
Test-Path 20-av-platform\sensors\sensor-to-algorithm-readiness-contract.md
```

Expected:

```text
False
```

- [ ] **Step 2: Add the readiness contract page**

Create `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md` with this content:

```markdown
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
```

- [ ] **Step 3: Verify required headings exist**

Run:

```powershell
rg -n "^# Sensor-to-Algorithm Readiness Contract|^## Readiness Stack|^## Calibration Gates|^## Modality Checks|^## Preprocessing Contract|^## Algorithm Handoff Table|^## Reject And Degrade Rules|^## Evidence Artifacts|^## Related Repository Docs" 20-av-platform\sensors\sensor-to-algorithm-readiness-contract.md
```

Expected: one match for each listed heading.

- [ ] **Step 4: Commit the new page**

Run:

```powershell
git add 20-av-platform\sensors\sensor-to-algorithm-readiness-contract.md
git commit -m "docs: add sensor readiness contract"
```

Expected: a commit is created with only `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md`.

---

### Task 2: Link The Contract From Existing Sensor, Foundation, And Runtime Pages

**Files:**
- Modify: `20-av-platform/sensors/calibration-tracking.md`
- Modify: `20-av-platform/sensors/sensor-degradation-health-monitoring.md`
- Modify: `10-knowledge-base/geometry-3d/overview.md`
- Modify: `10-knowledge-base/sensors/overview.md`
- Modify: `10-knowledge-base/systems-engineering/overview.md`
- Modify: `40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md`

- [ ] **Step 1: Verify the new contract is not already linked from these pages**

Run:

```powershell
rg -n "sensor-to-algorithm-readiness-contract" 20-av-platform\sensors\calibration-tracking.md 20-av-platform\sensors\sensor-degradation-health-monitoring.md 10-knowledge-base\geometry-3d\overview.md 10-knowledge-base\sensors\overview.md 10-knowledge-base\systems-engineering\overview.md 40-runtime-systems\ml-deployment\perception-slam-runtime-interface-contract.md
```

Expected: no matches.

- [ ] **Step 2: Add the calibration-tracking bridge link**

In `20-av-platform/sensors/calibration-tracking.md`, after:

```markdown
**Source code verified against:** `/home/kvyn/airside-ws/src/airside_perception/`
```

add:

```markdown
**Pre-algorithm handoff:** Use the [Sensor-to-Algorithm Readiness Contract](sensor-to-algorithm-readiness-contract.md) to decide whether calibration, timestamp, TF, preprocessing, health, and provenance evidence is sufficient before downstream algorithms consume sensor-derived inputs.
```

- [ ] **Step 3: Add the sensor-health bridge link**

In `20-av-platform/sensors/sensor-degradation-health-monitoring.md`, after the `**Summary:**` paragraph and before the second `---`, add:

```markdown
Use the [Sensor-to-Algorithm Readiness Contract](sensor-to-algorithm-readiness-contract.md) to connect these health states to the acceptance, rejection, and degraded-mode rules for perception, fusion, SLAM, localization, tracking, occupancy, mapping, and planning-facing consumers.
```

- [ ] **Step 4: Update the geometry overview reading path**

In `10-knowledge-base/geometry-3d/overview.md`, replace:

```markdown
For calibration and registration reviews, read [Multi-Sensor Calibration Observability](multi-sensor-calibration-observability.md), [Sensor Calibration and Time Synchronization](sensor-calibration-time-synchronization.md), and [Point Cloud Registration Math: ICP, NDT, and GICP](point-cloud-registration-math-icp-ndt-gicp.md).
```

with:

```markdown
For calibration and registration reviews, read [Multi-Sensor Calibration Observability](multi-sensor-calibration-observability.md), [Sensor Calibration and Time Synchronization](sensor-calibration-time-synchronization.md), and [Point Cloud Registration Math: ICP, NDT, and GICP](point-cloud-registration-math-icp-ndt-gicp.md). For the operational handoff before algorithms consume calibrated data, use [Sensor-to-Algorithm Readiness Contract](../../20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md).
```

- [ ] **Step 5: Update the sensor overview reading path**

In `10-knowledge-base/sensors/overview.md`, replace:

```markdown
For operational handoff, read the sensor page alongside fleet calibration and runtime operations material so the measurement contract is visible in logs and alerts.
```

with:

```markdown
For operational handoff, read the sensor page alongside the [Sensor-to-Algorithm Readiness Contract](../../20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md), fleet calibration, and runtime operations material so the measurement contract is visible in logs, alerts, and downstream algorithm acceptance gates.
```

In the `Pages In This Section` area after:

```markdown
- [Sensor Likelihoods, Noise, and Error Budgets](sensor-likelihoods-noise-error-budgets.md)
```

add:

```markdown

Operational bridge:

- [Sensor-to-Algorithm Readiness Contract](../../20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md)
```

- [ ] **Step 6: Update the systems-engineering overview reading path**

In `10-knowledge-base/systems-engineering/overview.md`, replace:

```markdown
For timing and synchronization reviews, read [Time Sync, PTP, Timestamping, and Latency Models](time-sync-ptp-timestamping-latency-models.md), then [Time Synchronization Error Budgets](time-synchronization-error-budgets.md).
```

with:

```markdown
For timing and synchronization reviews, read [Time Sync, PTP, Timestamping, and Latency Models](time-sync-ptp-timestamping-latency-models.md), then [Time Synchronization Error Budgets](time-synchronization-error-budgets.md). To see how timing, calibration, preprocessing, health, and provenance become algorithm input gates, use [Sensor-to-Algorithm Readiness Contract](../../20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md).
```

- [ ] **Step 7: Update the runtime interface related-docs list**

In `40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md`, under `## Related Repository Docs`, add this first bullet:

```markdown
- `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md`
```

- [ ] **Step 8: Verify every modified page links to the contract**

Run:

```powershell
rg -n "sensor-to-algorithm-readiness-contract" 20-av-platform\sensors\calibration-tracking.md 20-av-platform\sensors\sensor-degradation-health-monitoring.md 10-knowledge-base\geometry-3d\overview.md 10-knowledge-base\sensors\overview.md 10-knowledge-base\systems-engineering\overview.md 40-runtime-systems\ml-deployment\perception-slam-runtime-interface-contract.md
```

Expected: each of the six files appears at least once.

- [ ] **Step 9: Commit the internal cross-links**

Run:

```powershell
git add 20-av-platform\sensors\calibration-tracking.md 20-av-platform\sensors\sensor-degradation-health-monitoring.md 10-knowledge-base\geometry-3d\overview.md 10-knowledge-base\sensors\overview.md 10-knowledge-base\systems-engineering\overview.md 40-runtime-systems\ml-deployment\perception-slam-runtime-interface-contract.md
git commit -m "docs: link sensor readiness contract"
```

Expected: a commit is created with only the six modified Markdown files.

---

### Task 3: Expose The Contract In README And INDEX

**Files:**
- Modify: `README.md`
- Modify: `INDEX.md`

- [ ] **Step 1: Verify the new contract is not already linked from README or INDEX**

Run:

```powershell
rg -n "sensor-to-algorithm-readiness-contract" README.md INDEX.md
```

Expected: no matches.

- [ ] **Step 2: Update `README.md` counts**

In `README.md`, update `## Current Shape`:

```markdown
| Reader pages | 601 |
| Core research documents | 597 |
| AV platform docs | 29 |
```

In `README.md`, update the `20-av-platform/` row in `## Corpus Map`:

```markdown
| `20-av-platform/` | 29 | [NVIDIA Orin Technical](20-av-platform/compute/nvidia-orin-technical.md) | Compute, sensors, sensor-to-algorithm readiness, connectivity, drive-by-wire, power, diagnostics, ruggedization, and edge-cloud architecture. |
```

In `README.md`, update the `AV Platform` domain snapshot:

```markdown
| Sensors | 14 |
```

- [ ] **Step 3: Add the README reading-path row**

In `README.md`, in `## High-Leverage Reading Paths`, add this row after `Sensor and estimation fundamentals`:

```markdown
| Sensor readiness before algorithms | [Sensor-to-Algorithm Readiness Contract](20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md) | Consolidates calibration, synchronization, preprocessing, health, provenance, and fail-closed gates before perception, fusion, SLAM, tracking, occupancy, mapping, or planning consumes sensor-derived inputs. |
```

- [ ] **Step 4: Add the INDEX AV platform row**

In `INDEX.md`, in the AV platform section, add this row after `Multi-LiDAR calibration`:

```markdown
| Sensor-to-algorithm readiness | `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md` | Pre-algorithm contract for calibration, timestamp, TF, preprocessing, health, provenance, and reject/degrade gates before perception, fusion, SLAM, tracking, occupancy, mapping, and planning consume sensor data |
```

- [ ] **Step 5: Add the INDEX foundation row**

In `INDEX.md`, after the existing `Sensor foundations` row, add:

```markdown
| Sensor readiness handoff | `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md` | Operational bridge from sensor foundations into algorithm input acceptance gates |
```

- [ ] **Step 6: Add the INDEX recent-additions row**

In `INDEX.md`, under `## Recently Added (Latest Sessions)`, add this row at the top of the table body:

```markdown
| `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md` | Bridge contract for sensor acquisition, calibration, synchronization, preprocessing, health, provenance, and algorithm input acceptance before perception/SLAM/fusion consumers run |
```

- [ ] **Step 7: Add the INDEX detailed-file row**

In `INDEX.md`, near the other `20-av-platform/sensors/` detailed rows, add:

```markdown
| `20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md` | Sensor readiness contract: acquisition timestamps, calibration package, frame tree, preprocessing, health state, provenance, modality-specific checks, algorithm handoff table, reject/degrade rules, and evidence artifacts |
```

- [ ] **Step 8: Update INDEX document statistics**

In `INDEX.md`, update `## Document Statistics`:

```markdown
| Reader Markdown pages | 601 |
| Core research documents | 597 |
| `20-av-platform/` documents | 29 |
| AV platform documents | 29 |
```

- [ ] **Step 9: Verify README and INDEX link to the contract**

Run:

```powershell
rg -n "sensor-to-algorithm-readiness-contract|Reader pages \\| 601|Core research documents \\| 597|AV platform docs \\| 29|`20-av-platform/` documents \\| 29|AV platform documents \\| 29" README.md INDEX.md
```

Expected: matches for the new link and each updated count.

- [ ] **Step 10: Commit README and INDEX updates**

Run:

```powershell
git add README.md INDEX.md
git commit -m "docs: expose sensor readiness contract"
```

Expected: a commit is created with only `README.md` and `INDEX.md`.

---

### Task 4: Verify The Public Reader

**Files:**
- No planned source edits unless verification exposes a defect.

- [ ] **Step 1: Run the link checker**

Run:

```powershell
npm run links:check
```

Expected:

```text
> industry-research@1.0.0 links:check
> node tools/restructure/check-links.mjs
No missing local Markdown link targets.
```

The command must exit with code 0.

- [ ] **Step 2: Run the navigation and content tests**

Run:

```powershell
npm test
```

Expected:

```text
> industry-research@1.0.0 test
> node --test tests/navigation.test.mjs tests/site-config.test.mjs tests/content-smoke.test.mjs tests/workflow.test.mjs tests/restructure-map.test.mjs tests/autonomy-priority.test.mjs tests/domain-balance.test.mjs
```

The command must exit with code 0 and no failing tests.

- [ ] **Step 3: Run the priority metadata check**

Run:

```powershell
npm run priority:check
```

Expected:

```text
> industry-research@1.0.0 priority:check
> node tools/autonomy-priority/priority-metadata.mjs --check
```

The command must exit with code 0.

- [ ] **Step 4: Build the VitePress reader**

Run:

```powershell
npm run docs:build
```

Expected:

```text
> industry-research@1.0.0 docs:build
> vitepress build .
```

The command must exit with code 0.

- [ ] **Step 5: Run full verification**

Run:

```powershell
npm run verify
```

Expected:

```text
> industry-research@1.0.0 verify
> npm test && npm run priority:check && npm run docs:build
```

The command must exit with code 0.

- [ ] **Step 6: Check the committed file set**

Run:

```powershell
git log --oneline -3 --name-only
```

Expected: the last three implementation commits contain only these planned files:

```text
20-av-platform/sensors/sensor-to-algorithm-readiness-contract.md
20-av-platform/sensors/calibration-tracking.md
20-av-platform/sensors/sensor-degradation-health-monitoring.md
10-knowledge-base/geometry-3d/overview.md
10-knowledge-base/sensors/overview.md
10-knowledge-base/systems-engineering/overview.md
40-runtime-systems/ml-deployment/perception-slam-runtime-interface-contract.md
README.md
INDEX.md
```

- [ ] **Step 7: Check the worktree**

Run:

```powershell
git status --short
```

Expected:

```text
```

No output means the implementation worktree is clean after the planned commits and verification.

---

## Self-Review Checklist

- Spec coverage: Task 1 creates the bridge page with calibration, synchronization, preprocessing, health, provenance, modality checks, algorithm handoff, reject/degrade rules, and evidence artifacts. Task 2 links relevant overview and runtime pages. Task 3 links README and INDEX and updates counts. Task 4 runs the requested verification commands.
- Placeholder scan: The plan contains no deferred requirements, empty sections, or undefined future work.
- Type and path consistency: All planned paths use existing repository directories and relative Markdown links consistent with the current corpus.
