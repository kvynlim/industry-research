# Vehicle Middleware: DDS, SOME/IP, and Zenoh

**Last updated:** 2026-05-09

## Why It Matters

Vehicle middleware is the contract between autonomy software, production ECUs,
diagnostics, logging, simulation, and fleet systems. The wrong boundary turns
middleware into a safety hazard: discovery storms, stale samples, serialization
mismatch, or unbounded queues can look like perception, planning, or actuator
failures.

For an AV stack, DDS, SOME/IP, and Zenoh should not be treated as interchangeable
message buses. DDS is a data-centric publish/subscribe fit for ROS 2 graphs and
QoS-controlled autonomy data. SOME/IP is the common AUTOSAR service interface
for production ECU services. Zenoh is useful for routed pub/sub/query patterns
across edge, depot, cloud, and constrained networks. The architecture should make
their roles explicit and keep safety-critical actuation protected by independent
watchdogs and end-to-end checks.

## Architecture Decisions

| Boundary | Use | Avoid |
|---|---|---|
| ROS 2 / DDS domain | High-rate autonomy topics, component composition, local service calls, rosbag/MCAP replay, QoS experiments. | Treating default DDS discovery and QoS as production-safe without profiling. |
| AUTOSAR / SOME/IP domain | Versioned services to vehicle ECUs, diagnostics gateways, vehicle state services, command/status APIs. | Streaming raw sensor firehoses or unbounded perception debug blobs through ECU service interfaces. |
| Zenoh domain | Fleet edge routing, store/query access, cross-subnet robotics data, depot tools, selective upload metadata. | Direct safety actuation or replacing local safety supervision. |
| Safety channel | Heartbeat, E-stop, brake enable, speed limit, geofence status, safety controller command validation. | Depending on any middleware alone as the safety mechanism. |

Recommended layout:

```
Autonomy graph
ROS 2 nodes <-> RMW DDS or RMW Zenoh
        |
        +-- middleware gateway with explicit schema and QoS mapping
        |
        +-- AUTOSAR Adaptive service boundary
        |       +-- SOME/IP services: vehicle state, diagnostics, actuator APIs
        |       +-- DDS service communication where AUTOSAR interoperability requires it
        |
        +-- Fleet edge boundary
                +-- Zenoh router/store/query: logs, metadata, depot tooling
```

The gateway is a controlled product, not glue code. It owns schema conversion,
timestamp preservation, QoS downgrade rules, sequence numbers, health state,
version negotiation, and replay behavior. It should reject messages it cannot
map exactly.

## Evidence Artifacts

- Interface matrix covering ROS topic/service/action names, DDS IDL, AUTOSAR
  service interfaces, SOME/IP service IDs, event groups, methods, and fields.
- QoS contract for each autonomy topic: reliability, durability, history depth,
  deadline, lifespan, liveliness, and maximum serialized size.
- ARXML, IDL, and generated code version records tied to a software release.
- Gateway mapping tests showing exact field conversions, units, coordinate
  frames, time bases, covariance semantics, and error handling.
- Discovery and startup captures for cold boot, node restart, service restart,
  and a depot laptop joining the network.
- Latency and jitter histograms for sensor-to-fusion, planner-to-controller,
  controller-to-gateway, and gateway-to-ECU paths.
- Rosbag or MCAP replay traces proving middleware configuration can reproduce
  critical scenarios without hidden live-network dependencies.

## Acceptance Checks

- Adding a diagnostic tool, RViz instance, or depot client cannot starve the
  control graph or change safety-controller timing.
- QoS mismatches are detected at startup and surfaced as release-blocking
  configuration errors.
- Gateway loss produces a typed degraded state and bounded safe response, not
  silent stale commands.
- Every command crossing into the production ECU domain carries sequence,
  timestamp, source identity, and application-level validity checks.
- Large sensor messages have explicit maximum sizes and backpressure policy.
- Service version changes are backward-compatible or blocked by manifest checks.
- Replay can reconstruct middleware-visible state for a safety event with the
  same schemas and time base used on vehicle.

## Failure Modes

| Failure mode | Symptom | Control |
|---|---|---|
| DDS discovery storm | CPU spike, missed deadlines, high multicast traffic | Static peers, participant limits, domain isolation, discovery server or router where appropriate. |
| QoS mismatch | Subscriber receives nothing or receives stale samples | Contract tests and startup compatibility checks. |
| Stale command replay | Old command is accepted after reconnect | Lifespan, sequence checks, command lease, safety-controller timeout. |
| Serialization drift | Fields swapped, unit mismatch, dropped covariance | Schema lockstep, generated code, golden sample tests. |
| Bridge backpressure | Logger or fleet link blocks autonomy traffic | Separate queues, drop policy by criticality, network shaping. |
| Time-base drift | Fusion or incident replay cannot align samples | Hardware timestamping, gPTP monitoring, clock-offset logs. |
| Duplicate service instance | Two gateways offer the same vehicle service | Service registry checks and single-writer ownership rules. |
| Security bypass | Unauthorized client publishes command-like data | Network segmentation, DDS/Zenoh security where used, application authorization, ECU-side validation. |

## Related Repository Docs

- [ROS 2 Migration](../ros-autoware/ros2-migration.md)
- [Autoware Universe Deep Dive](../ros-autoware/autoware-universe-deep-dive.md)
- [On-Vehicle Data Triage and Selective Upload Prioritization](../data-logging/on-vehicle-data-triage-selective-upload.md)
- [On-Vehicle Supply Chain and Runtime Security](../software-operations/on-vehicle-supply-chain-runtime-security.md)
- [Deterministic Real-Time Networking (TSN)](../../20-av-platform/networking-connectivity/deterministic-networking-tsn.md)
- [Functional Diagnostics, UDS, DoIP, and SOVD](../../20-av-platform/diagnostics/functional-diagnostics-uds-doip-sovd.md)
- [Runtime Verification and Monitoring](../../60-safety-validation/runtime-assurance/runtime-verification-monitoring.md)

## Sources

- AUTOSAR, [Adaptive Platform](https://www.autosar.org/standards/adaptive-platform)
- AUTOSAR R24-11, [Explanation of Adaptive Platform Design](https://www.autosar.org/fileadmin/standards/R24-11/AP/AUTOSAR_AP_EXP_PlatformDesign.pdf)
- AUTOSAR R24-11, [SOME/IP Protocol Specification](https://www.autosar.org/fileadmin/standards/R24-11/FO/AUTOSAR_FO_PRS_SOMEIPProtocol.pdf)
- AUTOSAR R24-11, [DDS Service Communication Protocol](https://www.autosar.org/fileadmin/standards/R24-11/FO/AUTOSAR_FO_PRS_DDSCommunicationProtocol.pdf)
- OMG, [Data Distribution Service Specification Version 1.4](https://www.omg.org/spec/DDS/)
- ROS 2 Documentation, [About ROS 2 middleware implementations](https://docs.ros.org/en/rolling/Concepts/Advanced/About-Middleware-Implementations.html)
- ROS 2 Documentation, [rmw: ROS Middleware Abstraction Interface](https://docs.ros.org/en/rolling/p/rmw/)
- Zenoh, [What is Zenoh?](https://zenoh.io/docs/overview/what-is-zenoh/)
- ROS 2, [rmw_zenoh](https://github.com/ros2/rmw_zenoh)
