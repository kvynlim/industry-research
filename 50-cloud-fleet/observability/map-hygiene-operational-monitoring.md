# Map Hygiene Operational Monitoring

**Last updated:** 2026-05-09

Map hygiene needs runtime monitoring after publication. A map that passed offline validation can still fail in operation because the site changed, a temporary overlay expired, a vehicle received the wrong bundle, or perception disagrees with static assumptions.

## Monitoring Goals

| Goal | Signal |
|---|---|
| detect stale or wrong map | perception-map disagreement, operator reports, repeated route failures |
| catch localization regression | residuals, covariance, inlier count, NDT score, relocalization time |
| catch false-free-space risk | current obstacle where map says clear, FOD ticket in route corridor |
| control temporary overlays | expiry, owner acknowledgement, active vehicle count |
| support incident review | active map ID, prior map ID, rejected layer, raw evidence links |
| guide data collection | zones with repeated uncertainty, sparse features, or reviewer burden |

## Telemetry Fields

| Field | Type | Notes |
|---|---|---|
| `map.site_id` | string | airport or test-site identifier |
| `map.tile_id` | string | stable tile/zone/stand identifier |
| `map.bundle_id` | string | signed map package ID |
| `map.layer_ids` | string array | point cloud, semantic, overlay, hazard, unknown |
| `map.cleaner.version` | string | algorithm/model/config version |
| `map.release_state` | enum | draft, validation, canary, active, rolled_back, retired |
| `map.hygiene.static_preservation_rate` | double | by zone or asset class |
| `map.hygiene.ghost_rate` | double | residual dynamic clutter per tile or route |
| `map.hygiene.fod_candidates` | int | retained/reviewed FOD-like objects |
| `map.hygiene.unknown_area_m2` | double | unknown or quarantined area |
| `localization.ndt_score` | double | align with Autoware NDT debug/diagnostic outputs |
| `localization.covariance_xy` | double array | covariance or derived error ellipse |
| `localization.inlier_ratio` | double | scan-to-map health |
| `map.disagreement.count` | int | current perception disagrees with map |
| `map.overlay.expiry_time` | timestamp | required for temporary assets |
| `vehicle.active_map_id` | string | vehicle-reported active bundle |

Use OpenTelemetry semantic conventions where they fit, and publish a map-specific schema URL for custom fields so dashboards and offline analysis can handle schema evolution.

## Alerts

| Alert | Trigger | Action |
|---|---|---|
| map mismatch | vehicle active map differs from dispatch expectation | stop dispatch or force reload |
| localization degradation | sustained residual/covariance increase by tile | canary pause or rollback |
| high disagreement | repeated perception-map conflict in same zone | create map-change ticket |
| expired overlay | temporary overlay active past expiry | block route or renew approval |
| FOD conflict | FOD/hazard candidate overlaps cleaned/removed layer | safety review ticket |
| unknown growth | unknown/quarantine area exceeds route threshold | block publication or data collection |
| intervention cluster | remote assist/manual takeover by map tile | incident triage |

## Dashboard Views

| View | Contents |
|---|---|
| release health | map bundle, release state, cohort, rollback readiness |
| localization by tile | NDT score, covariance, residuals, relocalization failures |
| hygiene by asset | static preservation, ghost rate, movable-static decisions |
| FOD and hazards | retained candidates, inspection status, false alarms, closures |
| overlays | owner, expiry, affected routes, active vehicles |
| incidents | active/prior map ID, logs, reviewer records, source evidence |

## Operational Rules

1. Every mission log must include the active map bundle ID and active overlay IDs.
2. Every map-related alert must include tile, route, vehicle, software, sensor config, and timestamp.
3. Canary promotion requires monitoring coverage for the operational slices affected by the release.
4. Diagnostics should feed the same incident workflow as software and vehicle health alerts.
5. Map schema changes must be versioned so older dashboards do not silently misread fields.
6. Retain telemetry, raw evidence, and map bundles for any incident or safety event.

## Sources

- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- OpenTelemetry telemetry schemas: https://opentelemetry.io/docs/specs/otel/schemas/
- Autoware diagnostics API: https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/ad-api/features/diagnostics/
- Autoware diagnostic graph aggregator: https://autowarefoundation.github.io/autoware_universe/main/system/autoware_diagnostic_graph_aggregator/
- Autoware topic state monitor: https://autowarefoundation.github.io/autoware_universe/pr-10047/system/autoware_topic_state_monitor/
- Autoware NDT scan matcher: https://autowarefoundation.github.io/autoware_core/pr-602/localization/autoware_ndt_scan_matcher/
- Local context: ../map-operations/map-publication-gates-airside-hygiene.md
- Local context: ../map-operations/hd-map-lifecycle-operations.md
