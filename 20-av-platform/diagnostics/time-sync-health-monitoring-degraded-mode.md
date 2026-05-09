# Time Sync Health Monitoring and Degraded Mode

**Last updated:** 2026-05-09

## Why It Matters

Timing faults are system faults. A vehicle can keep publishing LiDAR, camera,
radar, IMU, and control messages while their timestamps are no longer mutually
valid. Without a typed health model, the autonomy stack may continue fusing
fresh-looking data into an inconsistent world model.

Time sync diagnostics should turn raw clock data into operational decisions:
mission allowed, continue with restrictions, reject a sensor, stop map updates,
or safe stop.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| Health state | Publish a vehicle time-sync health state, not only raw `ptp4l` logs. |
| Clock graph | Monitor every edge: GM to switch, switch to PHC, PHC to system clock, GM to sensor, PPS to timing source. |
| Thresholds | Define offset, jitter, path-delay, last-sync-age, holdover, and packet-loss thresholds per autonomy mode. |
| Provenance | Every fused topic records timestamp source and sync state. |
| Degraded policy | Fusion, localization, mapping, planning, and recorder behavior change when timing confidence degrades. |
| Fault memory | Store DTC/freeze-frame evidence for timing faults, including GM identity and affected sensors. |
| Recovery | Require stable timing for a configured dwell time before returning to full mission capability. |

## Health-State Model

| State | Meaning | Mission policy |
|---|---|---|
| `OK` | Required clocks locked, offsets inside budget, root traceable. | Full mission allowed. |
| `DEGRADED` | Timing is bounded but outside nominal limits or root is in bounded holdover. | Continue with ODD/speed limits and inflated timestamp uncertainty. |
| `LIMITED` | Some sensors have invalid timing but a fallback perception/localization set remains. | Complete safe maneuver or depot movement only. |
| `FAILED_SAFE` | Timebase is invalid for required fusion or control evidence. | Safe stop or mission inhibit. |
| `UNKNOWN` | Monitor stale, missing, or rebooting. | Treat as degraded or failed according to safety allocation. |
| `SERVICE_REQUIRED` | Fault cleared but evidence requires inspection, config fix, or recalibration. | Mission allowed only if release gate permits. |

## Signals to Monitor

| Layer | Signals |
|---|---|
| Grandmaster | Identity, domain, profile, clock class, time source, GNSS/PPS validity, UTC offset, holdover state. |
| PTP/gPTP network | Port state, selected master, offset from master, path delay, announce/sync timeout, packet loss, BMCA changes. |
| Linux PHC/system | PHC offset, system offset, servo state, frequency adjustment, PHC-to-interface mapping, process ownership. |
| Sensors | PTP lock, timestamp mode, last sync age, frame/packet counters, local clock drift, trigger counters. |
| Fusion topics | Acquisition time, receive time, timestamp source, conversion version, per-topic age and monotonicity. |
| Recorder | Raw timing metadata present, dropped metadata count, replay conversion status. |

Useful commands and probes:

```bash
ptp4l -m -i eth0 -f vehicle-gptp.cfg
phc2sys -m -s eth0 -c CLOCK_REALTIME -w
pmc -u -b 0 'GET CURRENT_DATA_SET'
pmc -u -b 0 'GET PARENT_DATA_SET'
pmc -u -b 0 'GET TIME_STATUS_NP'
ethtool -T eth0
```

## Degraded-Mode Actions

| Fault | Immediate action | Continued operation |
|---|---|---|
| One camera loses PTP | Stop metric camera fusion from that camera; keep image for human context if clearly marked. | Use remaining cameras/LiDAR/radar if coverage and ODD allow. |
| One LiDAR free-runs | Stop using it for localization and map updates after holdover budget. | Keep as low-confidence obstacle evidence only if safety case permits. |
| Radar timestamp invalid | Drop Doppler updates that require metric alignment. | Use radar presence detections with conservative gating if validated. |
| GNSS GM holdover | Start time uncertainty growth and mission timer. | Continue only inside holdover budget and speed/ODD limits. |
| GM identity changes | Mark timebase transition; gate fusion buffers. | Resume after offset and sensor relock dwell time. |
| PHC hardware timestamp unavailable | Block timing-critical Ethernet fusion on that interface. | Use non-metric monitoring or depot diagnostics only. |
| Unknown timing state | Treat affected source as stale. | Do not let stale-but-recent messages update localization or maps. |

## DTC and Freeze-Frame Fields

| Field | Purpose |
|---|---|
| `dtc_id` | Stable identifier such as `TIME_GM_LOST`, `TIME_SENSOR_PTP_UNLOCKED`, or `TIME_PHC_HWTS_DISABLED`. |
| `affected_clock` | GM identity, PHC device, interface, sensor serial, or trigger controller. |
| `first_seen_time` / `last_seen_time` | Incident sequencing and intermittent fault triage. |
| `max_offset_ns` / `rms_offset_ns` | Severity and correlation with perception residuals. |
| `path_delay_ns` | Network asymmetry or switch/path change evidence. |
| `clock_class` / `time_source` | Root quality and holdover state. |
| `sync_state_before_after` | Recovery and time-step analysis. |
| `software_config_id` | PTP profile, domain, firmware, and timing calibration version. |
| `mission_effect` | No effect, degraded fusion, ODD restriction, safe stop, or mission inhibit. |

## Validation Hooks

- Fault injection: kill `ptp4l`, stop `phc2sys`, disable hardware timestamping,
  unplug GNSS antenna, block PTP multicast, and force a sensor into free-run.
- Threshold tests: inject synthetic offset/jitter into logs or a hardware test
  bench and confirm state transitions.
- Recovery tests: restore time source and verify dwell time before returning to
  `OK`.
- Replay tests: confirm degraded-mode decisions can be reproduced from logged
  timing metadata alone.
- Cross-modal residual tests: correlate timing health events with LiDAR map
  residuals, camera reprojection errors, radar static-target velocity, and IMU
  preintegration residuals.

## Related Repository Docs

- [Functional Diagnostics with UDS, DoIP, and SOVD](functional-diagnostics-uds-doip-sovd.md)
- [PTP and gPTP Profiles for Vehicle Ethernet](../networking-connectivity/ptp-gptp-profiles-vehicle-ethernet.md)
- [PTP Grandmaster Failover and BMCA](../networking-connectivity/ptp-grandmaster-failover-bmca.md)
- [Linux PHC and Hardware Timestamping](../compute/linux-phc-hardware-timestamping.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](../sensors/gnss-pps-ptp-holdover-time-integrity.md)

## Sources

- Linux PTP Project, [ptp4l documentation](https://www.linuxptp.org/documentation/ptp4l/)
- Linux PTP Project, [phc2sys documentation](https://www.linuxptp.org/documentation/phc2sys/)
- Linux PTP Project, [pmc documentation](https://www.linuxptp.org/documentation/pmc/)
- Linux kernel docs, [PTP hardware clock infrastructure](https://docs.kernel.org/driver-api/ptp.html)
- Linux kernel docs, [Timestamping](https://docs.kernel.org/networking/timestamping.html)
- ROS 2, [diagnostic_msgs package documentation](https://docs.ros.org/en/rolling/p/diagnostic_msgs/)
- ROS 2, [diagnostic_msgs DiagnosticStatus message](https://docs.ros2.org/latest/api/diagnostic_msgs/msg/DiagnosticStatus.html)
- AUTOSAR, [Time Synchronization over Ethernet Protocol R25-11](https://www.autosar.org/fileadmin/standards/R25-11/FO/AUTOSAR_FO_PRS_TimeSyncOverEthernetProtocol.pdf)
