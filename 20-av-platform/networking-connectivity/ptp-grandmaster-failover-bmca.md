# PTP Grandmaster Failover and BMCA

**Last updated:** 2026-05-09

## Why It Matters

The best clock in the vehicle is a safety-critical dependency for fused
perception. When the active grandmaster loses GNSS, resets, or is unplugged, the
vehicle should not discover its failover behavior for the first time during an
incident. BMCA, clock class, priority fields, holdover state, and network
admission rules must be designed, tested, and diagnosed.

BMCA is the Best Master Clock Algorithm used by PTP/gPTP domains to select the
grandmaster from announced clock data. A production AV should treat BMCA inputs
as a controlled configuration surface, not as a passive default.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| GM allowlist | Only approved timing devices may become grandmaster on the vehicle time domain. |
| Priority plan | Set `priority1`, `clockClass`, `clockAccuracy`, `offsetScaledLogVariance`, and `priority2` deliberately for primary, backup, and lab modes. |
| Holdover policy | A GNSS-disciplined GM in holdover must advertise a worse class or trigger a degraded timing state according to the safety case. |
| Failover budget | Define maximum allowed time error, convergence time, and data rejection window during GM loss and recovery. |
| Switch behavior | Boundary or time-aware switches must propagate the new GM consistently and expose port state changes. |
| Sensor behavior | Sensors must report lock loss, last sync age, and timestamp mode through telemetry. |
| Recorder evidence | Logs must capture GM identity changes, BMCA data sets, offset, path delay, and degraded-mode transitions. |

## BMCA Inputs to Control

| Data set field | Design use |
|---|---|
| `priority1` | Administrative override. Use it to prefer the production GM over backup or service tools. |
| `clockClass` | Describes traceability and holdover quality. It should degrade when GNSS lock or time integrity degrades. |
| `clockAccuracy` | Advertised accuracy class. Do not overstate it during holdover. |
| `offsetScaledLogVariance` | Stability metric used in comparison. |
| `priority2` | Tie-breaker among clocks of the same role or class. |
| `clockIdentity` | Stable identity for allowlisting and incident logs. |
| `domainNumber` | Isolation between production, lab, and depot timing domains. |

Example vehicle policy:

| Role | State | BMCA intent | Mission policy |
|---|---|---|---|
| Primary GNSS GM | GNSS locked and integrity OK | Wins BMCA. | Full mission allowed. |
| Primary GNSS GM | Holdover, bounded error | May remain GM but declares degraded class. | Continue only inside holdover budget. |
| Backup GM | GNSS locked or disciplined from primary site time | Wins if primary fails. | Mission may continue after convergence gate. |
| Compute PHC | Ordinary clock only | Never wins in production. | Not a GM candidate. |
| Service laptop | Lab domain only | Never appears on production domain. | Block or isolate if detected. |

## Failover Sequence

```text
Normal:
  primary GM -> switches -> sensors and compute

Primary GNSS degraded:
  diagnostics marks holdover
  BMCA data changes if policy requires it
  fusion tracks growing time uncertainty

Primary GM lost:
  announce timeout expires
  backup GM wins BMCA
  ptp4l ports transition and servo reconverges
  sensors report relock or free-run state
  fusion rejects data during the configured uncertainty window

Primary recovers:
  recovery waits for stability and hysteresis
  BMCA may switch back only if policy allows
  recorder marks the second time discontinuity risk window
```

Use hysteresis. Repeated GM flapping is often worse for fusion than staying on a
slightly degraded but bounded holdover source.

## Failure Modes

| Failure mode | Symptom | Response |
|---|---|---|
| Rogue GM wins BMCA | Grandmaster identity changes to an unexpected device. | Isolate port, reject timebase, and inhibit mission start or continue in degraded mode. |
| Backup GM has better priority but worse time | Vehicle switches to a lab or stale source. | Version priority plan and enforce GM allowlist plus clock-class checks. |
| Holdover over-advertised | GM keeps a high-quality class after GNSS loss. | Require holdover state from timing appliance and cross-check with GNSS/UTC source. |
| Failback flapping | GM identity changes repeatedly after GNSS reacquisition. | Add holdoff timers and require stable offset before failback. |
| Boundary switch asymmetry | Different sensor branches follow different GMs. | Monitor port parent identity and timebase per branch. |
| Servo step accepted as normal | Estimator sees sudden ego-motion inconsistency. | Gate fusion on timebase-change events and reset synchronization filters deliberately. |
| Announce blocked by network policy | Endpoints stay on stale master or free-run. | Test multicast/VLAN filtering and PTP queue policy under security rules. |

## Telemetry

Capture these at 1 Hz or on change, with higher-rate samples during faults:

- Active grandmaster identity, parent identity, domain, and profile.
- Local port state and selected best-master reason.
- Clock class, accuracy, variance, priorities, time source, and UTC offset.
- Offset from master, mean path delay, frequency adjustment, servo state.
- Announce timeout count, sync timeout count, sequence gaps, and packet loss.
- Holdover state, GNSS lock, PPS validity, antenna alarm, and time integrity
  flags from the timing source.
- Per-sensor PTP lock, last sync age, and timestamp mode.

Useful commands:

```bash
pmc -u -b 0 'GET DEFAULT_DATA_SET'
pmc -u -b 0 'GET CURRENT_DATA_SET'
pmc -u -b 0 'GET PARENT_DATA_SET'
pmc -u -b 0 'GET TIME_STATUS_NP'
pmc -u -b 0 'GET PORT_DATA_SET'
```

## Validation Hooks

- Pull GNSS antenna from the primary GM and verify clock-class/holdover
  telemetry changes before the time error budget is exceeded.
- Power-cycle the primary GM while the vehicle logs high-bandwidth sensors and
  confirm backup GM convergence within the failover budget.
- Connect a service laptop running PTP in the production VLAN and confirm it
  cannot become GM.
- Reintroduce the primary GM and check failback hysteresis.
- Replay the event and verify fusion rejected or downweighted data during the
  documented uncertainty window.

## Related Repository Docs

- [PTP and gPTP Profiles for Vehicle Ethernet](ptp-gptp-profiles-vehicle-ethernet.md)
- [Linux PHC and Hardware Timestamping](../compute/linux-phc-hardware-timestamping.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](../sensors/gnss-pps-ptp-holdover-time-integrity.md)
- [Time Sync Health Monitoring and Degraded Mode](../diagnostics/time-sync-health-monitoring-degraded-mode.md)
- [Deterministic Real-Time Networking (TSN)](deterministic-networking-tsn.md)

## Sources

- IEEE, [IEEE Std 1588-2019 Precision Time Protocol](https://standards.ieee.org/standard/1588-2019/)
- IEEE, [IEEE Std 802.1AS-2020 Timing and Synchronization for Time-Sensitive Applications](https://standards.ieee.org/standard/802_1AS-2020.html)
- Linux PTP Project, [ptp4l documentation](https://www.linuxptp.org/documentation/ptp4l/)
- Linux PTP Project, [pmc documentation](https://www.linuxptp.org/documentation/pmc/)
- Linux PTP Project, [default configuration reference](https://www.linuxptp.org/documentation/default/)
- AUTOSAR, [Time Synchronization over Ethernet Protocol R25-11](https://www.autosar.org/fileadmin/standards/R25-11/FO/AUTOSAR_FO_PRS_TimeSyncOverEthernetProtocol.pdf)
