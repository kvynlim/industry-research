# Edge Runtime Supervision and Configuration Management

**Last updated:** 2026-05-09

## Why It Matters

Vehicle edge software fails in operationally boring ways: a stale config, a missing container, a bad route between modules, a local override left after field support, or an offline device that never receives the intended deployment. Runtime supervision and configuration management must make the desired state explicit, compare it with reported state, and keep the vehicle safe when cloud connectivity is unavailable.

This page covers edge desired-state operations for applications, runtime modules, config bundles, and local supervision. It does not replace secure update signing or safety controller design.

## Operating Model

1. Define one signed desired-state manifest per vehicle class and ODD. The manifest includes module images, versions, config bundle hashes, routes, environment, resources, restart policy, and rollback target.
2. Deploy through an edge orchestrator pattern. AWS IoT Greengrass uses deployments of components and configurations to things or thing groups. Azure IoT Edge uses deployment manifests with `$edgeAgent`, `$edgeHub`, module twins, and desired properties. Eclipse Kanto uses desired-state specifications and domain update agents.
3. Run a local supervisor that compares desired state, reported state, process health, resource health, and dependency health.
4. Keep offline behavior explicit. The vehicle should continue with the last approved manifest, preserve local reported state, and sync state when connectivity returns.
5. Separate safety-critical runtime state from convenience configuration. Any config that can alter autonomy behavior, speed limits, ODD limits, sensor use, or planner policy requires release approval.
6. Roll out by rings: lab, single vehicle, airport canary, limited fleet, full fleet. Each ring has a hold period and health threshold.

## Evidence Artifacts

| Artifact | Minimum contents | Owner |
|---|---|---|
| Desired-state manifest | Modules, versions, routes, config hashes, resources, restart policy | Runtime owner |
| Config bundle | Typed settings, schema version, default values, ODD scope, signer | Config owner |
| Deployment record | Target vehicles/groups, rollout ring, start/end time, result, failures | Fleet operations |
| Reported-state snapshot | Running modules, image digests, config hashes, health, uptime | Edge supervisor |
| Drift report | Desired vs reported diff, local overrides, stale devices, pending restarts | Runtime SRE |
| Offline-state log | Last approved manifest, offline duration, queued state changes, sync result | Fleet operations |
| Rollback record | Trigger, previous manifest, affected vehicles, recovery verification | Release manager |

## Acceptance Checks

- Every running module and config hash appears in the active desired-state manifest.
- The supervisor reports module health, restart count, resource saturation, route status, and config drift.
- Vehicles with stale or unknown reported state are excluded from rollout expansion.
- Offline vehicles receive or reject the latest approved manifest deterministically when they reconnect.
- Config schema validation runs before deployment and on the vehicle before activation.
- A local override cannot persist without a ticket, expiry, and visible drift status.
- Rollback activation is tested for the same vehicle class and runtime version before fleet rollout.

## Failure Modes

| Failure mode | Consequence | Control |
|---|---|---|
| Desired state stored only in cloud UI | Cannot reconstruct what was intended | Store signed manifests in version control and release records |
| Module is healthy but route is broken | Sensor or telemetry path silently fails | Supervise routes and dependencies, not only processes |
| Offline device misses config update | Fleet runs mixed behavior without visibility | Report last manifest and offline duration on reconnect |
| Local support override remains active | Vehicle behavior diverges from evidence | Drift detection with expiry and release-manager review |
| Rollout target group is too broad | Bad config reaches too many vehicles | Ringed rollout with health gates |
| Config schema is weak | Runtime accepts invalid units or missing fields | Typed schema validation before activation |
| Restart loop hides root cause | Service appears managed but unavailable | Alert on restart rate and preserve failure logs |

## Related Repository Docs

- `40-runtime-systems/software-operations/on-vehicle-supply-chain-runtime-security.md`
- `50-cloud-fleet/ota/software-update-management-system-ops.md`
- `50-cloud-fleet/ota/ota-fleet-management.md`
- `40-runtime-systems/ml-deployment/production-ml-deployment.md`
- `40-runtime-systems/monitoring-observability/teleoperation-systems.md`
- `50-cloud-fleet/operations/fleet-sre-incident-response.md`
- `60-safety-validation/runtime-assurance/fail-operational-architecture.md`

## Sources

- AWS IoT Greengrass V2, "Deploy AWS IoT Greengrass components to devices." https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-deployments.html
- Azure IoT Edge, "Deploy modules and establish routes in IoT Edge." https://learn.microsoft.com/en-us/azure/iot-edge/module-composition
- Eclipse Kanto, "Update manager." https://eclipse.dev/kanto/docs/concepts/update-manager/
- Eclipse Kanto, "Container management." https://eclipse.dev/kanto/docs/concepts/container-management/
- Eclipse Kanto, "Local digital twins." https://eclipse.dev/kanto/docs/concepts/local-digital-twins/
