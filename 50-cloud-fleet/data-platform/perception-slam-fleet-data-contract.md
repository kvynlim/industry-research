# Perception-SLAM Fleet Data Contract

**Last updated:** 2026-05-09

## Purpose

This contract defines the minimum fleet data required to validate, monitor, debug, and release perception-SLAM and map packages for airside autonomous ground vehicles. It covers on-vehicle logging, event capture, cloud ingestion, dataset partitioning, map defect reporting, and post-release fleet reliability monitoring.

It supports the safety protocols in:

- [Perception-SLAM map reliability evidence case](../../60-safety-validation/verification-validation/perception-slam-map-reliability-evidence-case.md)
- [Perception-SLAM statistical validity protocol](../../60-safety-validation/verification-validation/perception-slam-statistical-validity-protocol.md)
- [Uncertainty calibration release gates](../../60-safety-validation/verification-validation/uncertainty-calibration-perception-slam-release-gates.md)
- [Perception-SLAM corruption and fault injection protocol](../../60-safety-validation/verification-validation/robustness/perception-slam-corruption-fault-injection-protocol.md)
- [SLAM map benchmark protocol](../../60-safety-validation/verification-validation/slam-map-benchmark-protocol.md)
- [Fleet data pipeline](fleet-data-pipeline.md)
- [Data engine from bags](data-engine-from-bags.md)

## Contract Principles

1. Every safety-relevant event must be reconstructable from immutable raw data and metadata.
2. Every bag/MCAP, map tile, calibration file, model, and release decision must be hash-addressed.
3. Fleet telemetry must preserve failures, aborted missions, upload failures, and quarantined data, not only successful drives.
4. Data must be sliced by ODD, airport, route, weather, lighting, sensor health, and map version.
5. Logging must support both safety evidence and operational root cause analysis without exposing unnecessary personal data.
6. Post-release monitoring must be able to trigger rollback, route disable, or map quarantine.

## Required Identifiers

| ID | Format | Owner | Notes |
|---|---|---|---|
| `vehicle_id` | Stable fleet identifier | Fleet ops | Never reused |
| `session_id` | Vehicle/date/start-time/uuid | Data platform | One operating session or shift segment |
| `event_id` | UUID | Vehicle logger | Unique across fleet; generated at source |
| `bag_id` / `mcap_id` | Content hash plus metadata ID | Data platform | Immutable after upload |
| `map_package_id` | Semantic version plus content hash | Mapping | Includes tile hashes |
| `map_tile_id` | Airport/zone/tile coordinate/version | Mapping | Used for quarantine and rollback |
| `calibration_id` | Sensor rig/version/hash | Perception/maintenance | Includes intrinsics, extrinsics, time sync |
| `software_build_id` | Git SHA/container digest | Release | Includes runtime config |
| `model_id` | Registry ID/hash | ML/perception | Includes training dataset manifest |
| `release_id` | Release decision record ID | Release manager | Connects build/map/model/calibration |
| `incident_id` | Safety event or external report ID | Safety | Can cross-reference SGO-style reports |

## Required Event Types

| Event type | Trigger | Required pre/post window | Priority |
|---|---|---|---|
| `localization_loss` | Pose invalid, covariance threshold, relocalization failure | 30 s before / 30 s after | P0 |
| `high_pose_uncertainty` | Pose uncertainty above route threshold | 20 s / 20 s | P1 |
| `scan_map_residual_spike` | Residual exceeds calibrated envelope | 20 s / 20 s | P1 |
| `false_free_space_candidate` | Monitor or reviewer suspects occupied space marked free | 30 s / 30 s | P0 |
| `map_change_detected` | Candidate change above threshold | 30 s / 60 s | P1 |
| `map_tile_quarantined` | Tile blocked from publication or runtime use | full context | P0 |
| `sensor_degradation` | Point density, image quality, radar health, time sync, or diagnostics degrade | 20 s / 20 s | P1 |
| `gnss_ins_degraded` | GNSS dropout/bias or INS residual issue | 30 s / 30 s | P1 |
| `fault_monitor_action` | Degraded mode, speed reduction, controlled stop, remote assist | 30 s / 60 s | P0 |
| `operator_intervention` | Safety operator, remote operator, or teleop intervenes | 60 s / 60 s | P0 |
| `collision_near_miss_incident` | Contact, near miss, aircraft/GSE/person/FOD safety event | 120 s / 120 s | P0 |

## Required Topics and Signals

| Group | Required data |
|---|---|
| Raw sensors | LiDAR point clouds, camera frames if installed, radar tracks/returns if installed, IMU, GNSS, wheel encoders |
| Time sync | Sensor timestamps, host receive time, clock source, PTP/NTP status, dropped/reordered frames |
| Localization | Pose, covariance, map frame, factor residuals, scan-match score, relocalization state |
| Perception | Objects, tracks, occupancy/free-space, class confidence, uncertainty, unknown regions |
| Map runtime | Map package ID, tile IDs loaded, layer versions, lookup failures, quarantine status |
| Sensor health | Point count, range distribution, intensity stats, image exposure/blur, radar health, temperature |
| Runtime health | Node latency, CPU/GPU/memory, queue sizes, watchdogs, diagnostics |
| Vehicle state | Speed, steering, braking, mode, commanded trajectory, safety monitor state |
| ODD context | Airport, zone, route, geofence, lighting, weather, surface, aircraft stand state when available |
| Human/operator | Operator intervention, remote assist request, safety driver notes, maintenance state |

## Metadata Schema

Each session and event must include a metadata record equivalent to:

```json
{
  "schema_version": "perception_slam_fleet_data_contract/v1",
  "vehicle_id": "AGV-001",
  "session_id": "SIN-20260509-AGV001-0001",
  "event_id": "uuid",
  "event_type": "localization_loss",
  "timestamp_start_utc": "2026-05-09T01:23:45Z",
  "timestamp_end_utc": "2026-05-09T01:25:45Z",
  "airport_id": "SIN",
  "zone_type": "apron_stand",
  "route_id": "stand_42_service_loop",
  "odd_tags": ["night", "wet_surface", "aircraft_present"],
  "software_build_id": "git-or-container-digest",
  "model_id": "perception-model-hash",
  "map_package_id": "SIN-map-2026.05.09+hash",
  "map_tile_ids": ["SIN-A42-001@v17"],
  "calibration_id": "rig-cal-2026.05.01+hash",
  "sensor_config_id": "lidar8-camera6-radar4",
  "recording_tier": "event_full_fidelity",
  "bag_ids": ["sha256:..."],
  "safety_action": "controlled_stop",
  "operator_intervention": true,
  "privacy_class": "restricted",
  "retention_class": "safety_event_permanent"
}
```

## Data Quality Gates

| Gate | Pass condition | Block/triage condition |
|---|---|---|
| DQ0 schema | Required fields present and schema version valid | Reject ingest or quarantine |
| DQ1 time | Timestamps monotonic within tolerance; clock source known | Flag for time-sync fault analysis |
| DQ2 identity | Vehicle/build/map/calibration IDs present | Cannot use for release evidence |
| DQ3 completeness | Required pre/post event windows present | P0 reroute to recovery workflow |
| DQ4 sensor integrity | Topic rates and diagnostic fields within expected envelope or fault-tagged | Quarantine unlabeled degradation |
| DQ5 map traceability | Runtime map tile IDs match map package manifest | Block map release evidence |
| DQ6 ODD tags | Zone/weather/light/route tags populated | Exclude from sliced statistical claims |
| DQ7 privacy/security | Access class, encryption, and retention controls set | Hold from general ML use |

## Dataset Partition Contract

| Partition | Source | Allowed use |
|---|---|---|
| `dev` | Curated logs and synthetic/corrupt data | Development and debugging |
| `calibration` | Independent logs by ODD slice | Thresholds, temperature scaling, conformal quantiles |
| `validation` | Candidate selection logs | Model/map selection and tuning |
| `locked_test` | Held-out logs with access control | Release claims only |
| `shadow_watch` | Supervised operational logs | Release confirmation and future campaign design |
| `incident_hold` | P0 safety events | Safety investigation, regulatory reporting, root cause |

Near-duplicate logs are assigned together by route, date, map version, and event family to prevent leakage.

## Fleet Reliability Metrics

| Metric | Definition | Watch action |
|---|---|---|
| Localization alerts per operating hour | Count by severity and ODD slice | Investigate trend or route-specific spike |
| Controlled stops due to perception/SLAM | Stops by trigger and map tile | Review within safety SLA |
| Map quarantine rate | Tiles quarantined per airport/week | Trigger mapping capacity review |
| Scan-to-map residual drift | Distribution shift vs validation envelope | Quarantine route/tile if persistent |
| Sensor degradation rate | Events by sensor and weather | Maintenance or ODD adjustment |
| False-free-space candidates | Suspected or confirmed events | Immediate safety triage |
| Relocalization failures | Failures per route and map age | Block expansion if rising |
| Calibration drift | Confidence/error distribution shift | Recalibration or release rollback |
| Upload completeness | P0/P1 events uploaded within SLA | Fleet comms/storage incident if missed |

## Incident and Regulatory Alignment

For crashes, near misses, aircraft/GSE contact, injuries, or events that may require external reporting, preserve SGO-style fields even when the operating domain is airside and not directly identical to public-road ADS reporting:

| Field family | Required data |
|---|---|
| Pre-event | Automation mode, vehicle state, route, ODD, weather, map/calibration/build IDs |
| Event | Time, location, object/actor types, impact/near-miss description, safety action |
| Post-event | Stop state, operator action, remote assist, injuries/damage if known |
| Evidence | Raw logs, derived telemetry, photos/video if available, operator narrative |
| Reporting | Internal incident ID, external report ID if applicable, updates and corrections |

## Retention

| Data class | Retention |
|---|---|
| P0 safety event raw logs | Permanent or safety-board approved legal retention |
| P1 reliability event logs | Minimum 7 years or product lifecycle policy |
| Release locked test data | Preserve for the lifetime of the released system plus audit period |
| Calibration data | Preserve while thresholds/models remain active |
| Routine operational logs | Tiered retention by value and privacy class |
| Derived metrics | Preserve with release evidence and fleet dashboards |

## Owner Handoffs

| Owner | Responsibility |
|---|---|
| Vehicle software | Emit required topics, event triggers, and local manifests |
| Data platform | Ingest, validate, store, partition, and expose lineage |
| Perception/SLAM | Define metrics, event triggers, and debugging payloads |
| Mapping | Map package/tile IDs, quarantine states, publication metadata |
| Fleet operations | Operator notes, intervention data, upload SLA, route context |
| Safety | Incident classification, retention holds, release evidence interpretation |
| Security/privacy | Access controls, encryption, redaction, export approvals |

## Sources

- AWS IoT FleetWise documentation overview: https://aws.amazon.com/documentation-overview/iot-fleetwise/
- AWS IoT FleetWise campaign documentation: https://docs.aws.amazon.com/iot-fleetwise/latest/developerguide/create-campaign.html
- AWS IoT FleetWise CreateCampaign API: https://docs.aws.amazon.com/iot-fleetwise/latest/APIReference/API_CreateCampaign.html
- Waymo Open Dataset: https://waymo.com/open/
- Waymo Open Dataset about page: https://waymo.com/intl/jp/open/about/
- Waymo Safety Impact Hub: https://waymo.com/safety/impact/
- NHTSA Standing General Order on Crash Reporting: https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
- NHTSA SGO ADS/ADAS order document: https://www.nhtsa.gov/document/sgo-crash-reporting-adas-ads
- MCAP file format: https://mcap.dev/
- Foxglove MCAP documentation: https://docs.foxglove.dev/docs/visualization/mcap/
- ISO 21448:2022, Road vehicles - Safety of the intended functionality: https://www.iso.org/standard/77490.html
