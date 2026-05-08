# HD Map Lifecycle Operations

**Last updated:** 2026-05-09

HD maps are runtime safety artifacts. They encode lane topology, drivable boundaries, localization priors, geofences, speed zones, stand/gate rules, loading zones, and temporary restrictions. Treating them as static engineering inputs creates a deployment risk: the real site changes faster than the autonomy stack's assumptions.

This file defines the map operations system needed for warehouses, yards, ports, airports, campuses, and roads.

## Practical Evidence and Artifact Model

Each map release should be auditable like software:

| Artifact | Contents | Why it matters |
|---|---|---|
| Map package manifest | Map ID, site, tiles/zones, semantic map version, point-cloud/localization map version, coordinate frame, compatible vehicle/software/model/config versions | Prevents partial or incompatible activation |
| Survey source record | Survey date, vehicle/sensor rig, control points, GNSS/total-station references, environmental conditions, raw data location | Establishes map provenance and accuracy basis |
| Coordinate frame contract | Site origin, ENU/local grid definition, WGS84 transform, map-to-vehicle TF assumptions, units, timestamp standard | Prevents meter-scale localization and geofence errors |
| Semantic diff | Added/removed/changed lanelets, routes, stop/yield zones, speed zones, no-go polygons, docks/stands, crosswalks, restricted areas | Makes review tractable |
| Validation report | Replay localization, route generation, planner constraints, geofence checks, speed-zone checks, simulator scenarios, target vehicle test results | Supports safety release decision |
| Change impact analysis | Which safety claims, ODD assumptions, procedures, and operating zones are affected | Feeds safety case and site approval |
| Deployment plan | Cohorts, rollout window, activation criteria, rollback map, vehicle cache state, operator briefing | Keeps rollout controlled |
| Runtime freshness signal | Map age, confidence, site change reports, perception-map disagreement, localization residuals by zone | Detects stale or wrong maps in operation |
| Retirement record | Superseded versions, vehicles confirmed off old map, retention and legal hold status | Avoids orphaned map states |

Use immutable object storage for released map packages. Vehicles should receive signed map bundles and report back the active map ID in every mission log, incident record, and safety event.

## Lifecycle Workflow

### 1. Define map scope and ownership

For each site, assign a map owner and zone owners. Define:

- Map layers: localization point cloud, semantic lane graph, geofences, speed zones, docking/stand geometry, route graph, no-go areas, temporary work zones.
- Freshness SLOs by zone. A public-road map might need crowd-driven updates; an airport stand under construction may need daily checks; a stable indoor warehouse aisle may need change-driven updates only.
- Change sources: survey teams, fleet perception, site operations, construction permits, NOTAMs, A-CDM/AODB feeds, warehouse WMS/YMS/TOS changes, operator reports.

### 2. Build and review changes

Map changes should flow through a review lane:

1. Collect source data from survey runs, fleet logs, aerial/site plans, or operator change tickets.
2. Generate candidate updates for geometric and semantic layers.
3. Run automated validation: geometry topology, disconnected lanelets, self-intersections, missing regulatory attributes, invalid speed zones, route reachability, geofence containment.
4. Run replay validation against recent vehicle logs in affected zones.
5. Produce a human-readable semantic diff.
6. Review with autonomy, safety, and site operations.

Lanelet2 and Autoware patterns are useful for separating semantic lane graph data from point-cloud/localization data. The operational requirement is not a specific map format; it is the ability to diff, validate, sign, deploy, and roll back every safety-relevant layer.

### 3. Validate before deployment

Validation should cover:

| Validation class | Example checks |
|---|---|
| Localization | Replay residuals, relocalization time, covariance by zone, map-to-sensor frame consistency |
| Planning | Route existence, lane-change constraints, docking paths, stop lines, right-of-way, emergency pull-over or stop zones |
| Runtime assurance | Geofence containment, speed-zone enforcement, restricted-area exclusion, ODD monitors |
| Site operations | Construction zones, aircraft stand rules, dock assignments, pedestrian areas, operator procedures |
| Regression | Previous incidents and near misses in affected zones replayed on the candidate map |
| Fallback | Vehicle behavior when map tile is missing, stale, or disagrees with perception |

No map should enter production without a named rollback target and a vehicle cache check proving the rollback bundle is still available or fetchable.

### 4. Deploy as a controlled release

Deployment is a SUMS/OTA event even when only map data changes:

- Sign the map bundle and manifest.
- Deploy first to non-operational vehicles or shadow localization/planning.
- Canary by site zone and vehicle cohort, not only by percentage.
- Monitor map-specific KPIs: localization residuals, route replans, planner infeasibility, geofence warnings, manual interventions, perception-map disagreement.
- Promote only after observation windows cover the operational conditions relevant to the change, such as night, rain, busy stand operations, or shift handover.

### 5. Operate freshness monitoring

Fleet operations should maintain a live map health dashboard:

| Indicator | Interpretation |
|---|---|
| Persistent perception-map disagreement in one zone | Possible construction, new obstacle, missing marking, or changed traffic flow |
| Localization residual spike after map release | Bad point-cloud alignment, coordinate frame issue, sensor calibration mismatch |
| Planner infeasibility at the same route segment | Topology break, lanelet attribute error, changed dock/stand access |
| Operator interventions clustered by map tile | Map or site-procedure mismatch |
| Frequent temporary no-go overrides | Permanent map update may be needed |

## Deployment Operations

| Operation | Required practice |
|---|---|
| New site onboarding | Baseline survey, site coordinate contract, route graph, geofence approval, first mission replay, site acceptance signoff |
| Temporary work zone | Time-bounded map overlay, expiry date, owner, runtime alert before expiry, automatic removal review |
| Emergency restriction | Fast no-go overlay with separate approval path and post-change review within one business day |
| Map rollback | Preserve current vehicle state, roll back semantic and localization layers as a compatible set, verify route graph before dispatch |
| Multi-site release | Do not reuse site-specific attributes blindly; maintain site-local rule packs and coordinate transforms |
| Incident investigation | Freeze active and prior map bundles, source data, diffs, and vehicle-reported active map IDs |

## Risks and Failure Modes

| Failure mode | Example | Mitigation |
|---|---|---|
| Stale map | Construction barrier or changed aircraft stand layout is not reflected | Change feeds, perception-map disagreement alerts, temporary overlays |
| Coordinate frame error | ENU origin or map transform shifts geofence by meters | Coordinate contract, surveyed control points, transform unit tests |
| Semantic topology break | Route planner cannot reach a dock or gate | Automated graph validation and replay tests |
| Partial layer update | Lane graph updates but point-cloud map remains old | Atomic map bundle with signed manifest |
| Over-trust in map | Vehicle ignores real cones or workers because map says lane is open | Perception has priority for obstacles; map disagreement triggers conservative mode |
| Silent rollback loss | Vehicle cannot return to previous map after bad release | On-vehicle rollback cache verification |
| Temporary overlay never expires | No-go zone or speed restriction becomes operational debt | Owner, expiry, and weekly overlay review |
| Vendor map black box | Source and diff cannot be inspected during incident | Require release notes, diff artifacts, confidence/quality metadata |

## Related Repository Docs

- `30-autonomy-stack/localization-mapping/overview/`
- `50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md`
- `50-cloud-fleet/ota/ota-fleet-management.md`
- `50-cloud-fleet/data-platform/fleet-data-pipeline.md`
- `40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md`
- `60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md`
- `60-safety-validation/verification-validation/airside-scenario-taxonomy.md`

## Sources

- HERE HD Live Map product page. https://www.here.com/platform/HD-live-map
- HERE automated driving map solutions. https://www.here.com/solutions/automated-driving
- Autoware map interface documentation. https://autowarefoundation.github.io/autoware-documentation/latest/design/autoware-interfaces/components/map/
- Autoware.Auto Lanelet2 map documentation. https://autowarefoundation.gitlab.io/autoware.auto/AutowareAuto/lanelet2-map-for-autoware-auto.html
- "Exploring Real World Map Change Generalization of Prior-Informed HD Map Prediction Models," arXiv, 2024-06-04. https://arxiv.org/abs/2406.01961
- "ExelMap: Explainable Element-based HD-Map Change Detection and Update," arXiv, 2024-09-16. https://arxiv.org/abs/2409.10178
- "A Review of Crowdsourcing Update Methods for High-Definition Maps," ISPRS International Journal of Geo-Information, 2024. https://www.mdpi.com/2220-9964/13/3/104
- "Simultaneous Localization and Map Change Update for the High Definition Map-Based Autonomous Driving Car," Sensors, 2018. https://www.mdpi.com/1424-8220/18/9/3145
