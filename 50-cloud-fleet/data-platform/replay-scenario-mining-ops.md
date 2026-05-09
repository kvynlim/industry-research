# Replay and Scenario Mining Operations

**Last updated:** 2026-05-09

## Why It Matters

Autonomous fleet logs contain many routine miles and a small number of high-value moments. Scenario mining turns uncurated logs into replayable evidence: near conflicts, strange object interactions, failed localization, blocked routes, rare weather, confusing ground markings, and other long-tail cases that should become regression tests.

This page covers the operational loop from mined fleet event to replayable scenario asset. It does not define simulator physics or the full safety validation strategy.

## Operating Model

1. Ingest candidate events from triggers, operator notes, incident reports, model disagreement, anomaly detectors, and natural-language scenario search.
2. Index clips with map context, ego trajectory, actor tracks, weather, lighting, airport zone, model versions, and intervention metadata.
3. Mine scenarios using both rule queries and embedding or language search. Argoverse's scenario-mining task frames the problem as retrieving specific safety-relevant scenarios from large multi-modal logs localized to HD maps.
4. Normalize each accepted scenario into a scenario record: intent, actors, dynamic sequence, trigger conditions, ODD tags, source clip, and expected system response.
5. Represent dynamic replay intent using ASAM OpenSCENARIO concepts where practical: entities, storyboard, maneuvers, events, actions, triggers, conditions, and external road-network references.
6. Represent object and scene annotations using ASAM OpenLABEL-compatible fields where practical: object identity, class, 2D/3D geometry, segmentation, relations, actions, intentions, and taxonomy references.
7. Promote scenarios by state: `candidate`, `triaged`, `replay_ready`, `regression_required`, `retired`.

## Evidence Artifacts

| Artifact | Minimum contents | Owner |
|---|---|---|
| Scenario mining query | Query text or rule, search index version, time window, filters, requester | Scenario curator |
| Candidate clip manifest | Source log IDs, timestamps, map version, sensor availability, model versions | Data platform |
| Triage record | Why the clip matters, duplicate check, severity, regression priority | Safety validation |
| Scenario metadata | Actors, maneuvers, triggers, ODD tags, expected behavior, acceptance metric | Scenario curator |
| Annotation package | OpenLABEL-style labels, taxonomy version, QA result, reviewer | Label operations |
| Replay package | Simulator version, maps, seed, initial state, scenario file, runtime config | Simulation owner |
| Regression result | Pass/fail, metric deltas, videos, logs, model version, waiver if any | Safety validation |

## Acceptance Checks

- Every replay scenario links back to immutable raw log, map, label, and processing snapshots.
- Scenario metadata has enough structure for search, replay selection, and coverage accounting.
- Scenario labels use a controlled taxonomy and record the schema version.
- The replay package can be executed by a clean worker without local manual files.
- The expected behavior is measurable: clearance, stop distance, yield behavior, route recovery, localization bound, or intervention avoidance.
- Regression-required scenarios are included in release gates before a model can be promoted.
- Retired scenarios keep a reason, replacement scenario if any, and last passing release.

## Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Scenario remains a video bookmark | Cannot run regression or measure improvement | Require replay package before promotion |
| Query results are not versioned | Mining cannot be repeated after index changes | Store query and index version |
| Duplicate scenarios flood the suite | Release gates become slow without added coverage | Cluster and deduplicate before promotion |
| Labels drift across teams | Scenario semantics change over time | Version taxonomy and run label QA |
| Replay omits map or weather context | Test no longer represents the field event | Store map, zone, weather, lighting, and initial state |
| Expected behavior is vague | Review becomes subjective | Define quantitative pass criteria |
| Scenario suite only includes failures | Overfits to known bad cases and misses normal behavior | Maintain balanced coverage by ODD and maneuver |

## Related Repository Docs

- `50-cloud-fleet/mlops/data-flywheel-airside.md`
- `50-cloud-fleet/data-platform/fleet-data-pipeline.md`
- `30-autonomy-stack/simulation/simulators-for-airside.md`
- `30-autonomy-stack/end-to-end-driving/airside-autonomy-benchmark-spec.md`
- `60-safety-validation/verification-validation/airside-scenario-taxonomy.md`
- `60-safety-validation/verification-validation/shadow-mode.md`
- `60-safety-validation/verification-validation/testing-validation-methodology.md`

## Sources

- Argoverse User Guide, "Scenario Mining." https://argoverse.github.io/user-guide/tasks/scenario_mining.html
- ASAM OpenSCENARIO User Guide. https://www.asam.net/fileadmin/Standards/OpenSCENARIO/QUICK_READ_ASAM_OpenSCENARIO_BS-1-2_User-Guide_V1-0-0.html
- ASAM OpenLABEL. https://www.asam.net/standards/detail/openlabel/
- Apache Iceberg, "Spec." https://iceberg.apache.org/spec/
- Waymo, "Safe to Deploy: How We Know The Waymo Driver Is Ready For The Road," 2025-06. https://waymo.com/blog/2025/06/safe-to-deploy/
