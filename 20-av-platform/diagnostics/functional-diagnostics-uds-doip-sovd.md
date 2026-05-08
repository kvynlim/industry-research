# Functional Diagnostics with UDS, DoIP, and SOVD

**Last updated:** 2026-05-09

Fleet AVs need a diagnostic architecture that can explain the vehicle's health
state before, during, and after a mission. A ROS topic called `diagnostics` is
not enough: service teams need stable diagnostic trouble codes, freeze-frame
data, session control, secured maintenance routines, remote access policy,
vehicle discovery, and a way to diagnose both classic ECUs and software-defined
high-performance computers.

The practical pattern is layered:

- **Local health monitors** detect component and functional faults.
- **DTC and fault memory** normalize those faults into persistent service data.
- **UDS** provides the ECU-level diagnostic service model.
- **DoIP** carries diagnostics over Ethernet/IP and enables vehicle discovery.
- **SOVD** exposes a service-oriented API for HPCs, legacy ECUs, logs, routines,
  and remote/fleet workflows.

This document focuses on the vehicle platform diagnostics layer, not on cloud
observability. The boundary is simple: platform diagnostics determines what is
wrong with the vehicle; fleet observability determines how often, where, and
why it happens across the fleet.

---

## AV, Indoor, Outdoor, and Airside Relevance

| Domain | Diagnostic need | Design implication |
|---|---|---|
| Generic AV | Multiple ECUs, sensors, compute nodes, and safety controllers must agree on whether the ADS is mission-capable. | Use a typed health-state model and traceable DTCs instead of ad hoc logs. |
| Indoor warehouse | AMRs and autonomous forklifts need fast triage by maintenance staff who may not be autonomy engineers. | Expose scanner, bumper, charger, lift, brake, and localization faults through a service workflow. |
| Outdoor campus and yard | Remote sites may have intermittent connectivity and dusty, wet, high-vibration faults. | Store local fault memory and freeze-frame evidence for later sync. |
| Airside | A vehicle may stop near aircraft, ground crew, fuel, or active stands; recovery must be controlled and auditable. | Separate remote readout from remote actuation; require service modes and safety preconditions for routines. |

---

## Protocol Stack

| Layer | Primary role | AV design use |
|---|---|---|
| Health monitor | Converts raw signals into health states. | Sensor contamination, PDU branch trips, DBW timeout, timebase loss, calibration drift. |
| DTC manager | Persists fault identity, status, counters, aging, and freeze-frame data. | Stable service evidence across power cycles and OTA releases. |
| UDS (ISO 14229) | Application-layer diagnostic services between tester/client and ECU/server. | Read DTCs, read data identifiers, run routines, control I/O, session management. |
| DoIP (ISO 13400) | IP-based diagnostic communication, discovery, routing, and gateway access. | Ethernet service port, remote depot tooling, high-bandwidth diagnostics. |
| AUTOSAR Adaptive diagnostics | Standardized diagnostic behavior in Adaptive Platform systems. | HPC diagnostic service instances, DIDs, routines, security events, DoIP integration. |
| SOVD (ISO 17978 / ASAM SOVD) | Service-oriented API over HTTP/OpenAPI style interfaces. | Unified API for HPCs and legacy ECUs, remote diagnosis, logs, software update linkage. |
| Fleet backend | Aggregation and workflow. | Maintenance cases, trend mining, release gating, post-incident evidence packages. |

---

## Architecture

```
Sensors, DBW, PDU, BMS, timebase, compute, network
        |
        v
Component health monitors
        |
        v
Functional health supervisor
        |
        +--> Safety state machine / ODD restrictions
        |
        +--> DTC manager + freeze-frame store
                 |
                 +--> UDS servers on classic ECUs
                 +--> Adaptive diagnostics on HPC
                 +--> DoIP gateway and service connector
                 +--> SOVD server / vehicle diagnostic facade
                         |
                         +--> Local service tablet
                         +--> Depot tool
                         +--> Fleet maintenance backend
                         +--> Incident evidence exporter
```

The diagnostic gateway must be a controlled trust boundary. It routes and
normalizes data, but it should not allow cloud tools to invoke unsafe routines
while the vehicle is moving or while people are in the safeguarded zone.

### Health-State Model

Use one common platform health vocabulary across UDS, SOVD, fleet telemetry, and
operator UI.

| State | Meaning | Mission policy |
|---|---|---|
| `OK` | Component is operating inside validated range. | Mission allowed. |
| `DEGRADED` | Function remains available with reduced performance or redundancy. | Mission may continue with ODD or speed restriction. |
| `LIMITED` | Function is available only for fallback or depot movement. | Finish safe maneuver; do not accept new mission. |
| `FAILED_SAFE` | Fault detected and safety path has put the function into safe state. | Vehicle stopped or safety mode active. |
| `UNKNOWN` | Health monitor stale, reset, or unable to prove status. | Treat as degraded or failed depending on safety case. |
| `SERVICE_REQUIRED` | Fault is no longer active but evidence requires inspection or calibration. | Mission allowed only if release gate permits. |

This vocabulary should drive both autonomy behavior and maintenance workflow.
DTCs should not merely describe broken parts; they should also encode the
operational consequence.

---

## Design Details

### Diagnostic Data Model

### DTC Record

| Field | Purpose |
|---|---|
| `dtc_id` | Stable identifier with domain, component, failure mode, and severity. |
| `status_bits` | Active, pending, confirmed, test failed this cycle, warning indicator requested, aged, cleared. |
| `first_seen_time` / `last_seen_time` | Supports incident sequencing and intermittent fault analysis. |
| `occurrence_counter` | Distinguishes one transient from a chronic harness or software issue. |
| `freeze_frame_id` | Links to environment data captured at the first or worst occurrence. |
| `software_config_id` | Maps fault to vehicle software, model, calibration, and PDU/DBC config. |
| `safety_effect` | No effect, ODD restriction, speed restriction, safe-stop, mission inhibit. |
| `service_action` | Inspect, clean, calibrate, replace, rerun routine, update config, escalate. |

### Freeze-Frame Data

Freeze-frame data should be specific enough to reproduce the fault but small
enough to preserve under power loss.

| Fault type | Freeze-frame fields |
|---|---|
| Sensor degradation | Sensor ID, health metrics, temperature, cleaning state, detection coverage, timestamp source. |
| PDU fault | Rail voltage, branch current, switch state, fault reason, safe-stop reserve, charger state. |
| DBW timeout | Command age, feedback age, CAN/TSN gateway status, actuator mode, speed, steering angle. |
| Timebase fault | Grandmaster ID, clock domain, offset estimate, holdover state, timestamp provenance. |
| Localization/calibration | Map ID, calibration ID, localization covariance, GNSS/INS status, route segment. |
| Safety scanner trip | Active field set, speed, direction, object range/bearing, safety output state. |

### DID and Routine Catalog

Diagnostic identifiers and routines should be planned as a product interface:

- **Read-only data identifiers:** VIN/vehicle ID, software version, calibration
  version, sensor serial numbers, PDU config, map ID, current health state.
- **Live measurements:** branch current, rail voltage, actuator feedback, sensor
  temperatures, clock offset, packet-loss counters, scanner field set.
- **Routines:** sensor self-test, scanner field validation, brake hold test,
  PDU branch test, calibration check, log export, cleaning-cycle test.
- **I/O controls:** service-only actuation of lights, horn, cleaning pump, fans,
  and non-motion outputs. Motion-related I/O control requires a local service
  mode and safeguarded area.
- **Write operations:** variant coding, calibration import, component replacement
  acknowledgment, DTC clear. All require authentication, audit logging, and
  state preconditions.

---

### UDS, DoIP, and SOVD

### UDS

UDS is the right abstraction for ECU-level diagnostics because it is data-link
independent and structured around diagnostic services. Keep these design rules:

- Implement diagnostic sessions with explicit timing and safety preconditions.
- Maintain a minimal default session for read-only status and DTC readout.
- Put routine control and I/O control behind extended/programming/service modes.
- Use security access or certificate-backed authorization for routines that can
  change configuration, clear evidence, or actuate hardware.
- Never make a safety function depend on a diagnostic client staying connected.

### DoIP

DoIP is the natural diagnostic transport for Ethernet vehicles and depot tools.
It also changes the attack surface.

- Vehicle discovery and routing activation should be available only on intended
  service networks or through a secured remote gateway.
- Diagnostic Ethernet should be segmented from sensor TSN traffic and the safety
  control plane.
- DoIP gateway logs should capture source identity, requested ECU, session
  changes, routine invocations, clear-DTC requests, and failed authorization.
- Remote DoIP tunneling should be read-mostly by default. Write/routine access
  requires a parked vehicle, local inhibit, and operator or maintainer approval.

### SOVD

SOVD is the better facade for software-defined vehicles because an AV is not just
a collection of static ECUs. It has HPC services, model versions, logs, runtime
health, and software-update state.

SOVD should expose:

- Vehicle-level health summary with functional domains, not only ECU addresses.
- Fault entries and environment data from both classic ECUs and HPC services.
- Diagnostic capabilities discovery, so tools know which DIDs/routines are
  present on this vehicle and release.
- Log and evidence export from the HPC without requiring direct SSH access.
- Software update and configuration state needed for release triage.
- Explicit execution modes and state preconditions for routines.

The SOVD server should not be the safety controller. It is an authorized service
interface over the diagnostic system. Safety enforcement remains local.

---

## Deployment Workflow

### Mission Health Gate

Before accepting a mission:

1. Confirm no active DTC with `safe_stop`, `mission_inhibit`, or unresolved
   `SERVICE_REQUIRED` effect.
2. Confirm safety scanner field sets, brake/steer health, PDU safe-stop reserve,
   timebase, event recorder, and network health.
3. Confirm calibration IDs and map IDs match the route/site release.
4. Confirm remote diagnostic sessions are closed or in read-only mode.
5. Emit a signed mission-readiness snapshot for the fleet backend.

### Remote Service Session

```
Fleet maintenance ticket
        |
        v
Read-only SOVD health summary
        |
        +--> Active safety effect? Keep vehicle stopped.
        |
        v
Fetch DTCs + freeze frames + recent event bundle
        |
        v
Decide local vs remote remediation
        |
        +--> Remote read/config check allowed
        +--> Routine only if parked, inhibited, authorized
        +--> Motion-related service requires local safeguarded mode
```

### DTC Governance

- DTC namespaces belong to platform owners, not individual feature teams.
- Every DTC needs an owner, service action, severity, safety effect, aging rule,
  and clear rule.
- DTCs should be backward-compatible across OTA releases where possible.
- Retired DTCs remain documented for historical fleet data.
- DTC clear is itself an auditable diagnostic event.

---

## Failure Modes

| Failure mode | Diagnostic symptom | Response |
|---|---|---|
| Silent sensor degradation | Health monitor reports degraded but no device fault code | Raise functional DTC with freeze-frame; restrict ODD or speed. |
| Flapping connector or branch power | Repeated reset counter, PDU branch trip, intermittent missing frames | Confirm DTC after threshold; route to maintenance; prevent remote reset loops. |
| DoIP gateway exposed on wrong network | Unexpected discovery/routing activation from untrusted source | Log security event, deny session, isolate diagnostic gateway. |
| SOVD facade out of sync with ECU state | SOVD health summary disagrees with UDS DTC readout | Mark vehicle diagnostic state `UNKNOWN`; block mission until resync. |
| DTC clear hides active problem | Clear request while monitor still failed | Reject clear or immediately re-confirm DTC; audit client identity. |
| Routine invoked in unsafe state | Routine request while vehicle moving or scanner field occupied | Deny routine; create security/safety event if repeated. |
| Clock-domain fault corrupts freeze frames | Event timestamps have unknown source or high uncertainty | Mark timestamp provenance and uncertainty; preserve raw local counters. |
| OTA changes diagnostic meaning | DTC or DID semantics change without version mapping | Block release gate; require migration table and service-tool update. |

---

## Related Repository Documents

- [CAN Bus Communication and Drive-by-Wire Interfaces](../drive-by-wire/can-bus-dbw.md)
- [Deterministic Real-Time Networking (TSN)](../networking-connectivity/deterministic-networking-tsn.md)
- [Autonomy Power Distribution and Safe-Stop Energy](../power-electrical/autonomy-power-distribution.md)
- [Sensor Degradation Detection and Health Monitoring](../sensors/sensor-degradation-health-monitoring.md)
- [Fleet Predictive Maintenance](../../50-cloud-fleet/fleet-management/fleet-predictive-maintenance.md)
- [Fleet Anomaly Root Cause Attribution](../../50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md)
- [OTA Fleet Management](../../50-cloud-fleet/ota/ota-fleet-management.md)
- [Cybersecurity for Airside AV](../../60-safety-validation/cybersecurity/cybersecurity-airside-av.md)
- [Safety Incidents and Lessons](../../60-safety-validation/safety-case/safety-incidents-lessons.md)

---

## Sources

- ISO, [ISO 14229-1:2020 Road vehicles - Unified diagnostic services - Application layer](https://www.iso.org/standard/72439.html)
- ISO, [ISO 13400-2:2025 Road vehicles - Diagnostic communication over Internet Protocol - Transport protocol and network layer services](https://www.iso.org/standard/87961.html)
- ISO, [ISO 13400-3:2016 DoIP wired vehicle interface based on IEEE 802.3](https://www.iso.org/standard/68424.html)
- ISO, [ISO 17978-1 Road vehicles - Service-oriented vehicle diagnostics - General information, definitions, rules and basic principles](https://www.iso.org/standard/85133.html)
- ISO, [ISO 17978-2:2026 Road vehicles - SOVD - Use cases definition](https://www.iso.org/standard/86586.html)
- ISO, [ISO 17978-3:2026 Road vehicles - SOVD - Application programming interface](https://www.iso.org/standard/86587.html)
- ASAM, [ASAM SOVD standard page](https://www.asam.net/standards/detail/sovd/)
- AUTOSAR, [Adaptive Platform R24-11 Specification of Diagnostics](https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_SWS_Diagnostics.pdf)
- AUTOSAR, [R24-11 Requirements on Diagnostics](https://www.autosar.org/fileadmin/standards/R24-11/FO/AUTOSAR_FO_RS_Diagnostics.pdf)
