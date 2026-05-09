# PTP and gPTP Profiles for Vehicle Ethernet

**Last updated:** 2026-05-09

## Why It Matters

SLAM and sensor fusion assume that timestamps describe when photons, laser
pulses, radar chirps, IMU samples, and wheel pulses were measured. Ethernet
arrival time is not enough. A 5 ms timestamp error at 10 m/s is 5 cm of ego
motion before calibration, rolling shutter, LiDAR deskew, radar Doppler
compensation, or object tracking even start.

PTP and gPTP turn time into a platform interface. The vehicle needs one
declared clock domain, one grandmaster policy, hardware timestamping, and a
clear rule for how each sensor maps acquisition time into published messages.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| Time domain | Use one vehicle time domain for fused perception unless there is a documented bridge between domains. |
| Grandmaster | Prefer a GNSS/PPS-disciplined grandmaster or timing receiver with a holdover state exposed to diagnostics. |
| Profile | Use IEEE 802.1AS/gPTP for TSN vehicle Ethernet domains and IEEE 1588 PTP profiles only when every endpoint explicitly supports that profile. |
| Timestamping | Require hardware timestamping on NICs, switches, and sensors that participate in the fusion timebase. |
| Time scale | Declare whether timestamps are PTP/TAI, UTC, GPS time, or sensor-local ticks, and publish conversion metadata. |
| Transport | Freeze L2 multicast, UDP/IPv4, VLAN, domain number, delay mechanism, and message intervals in the vehicle network baseline. |
| Priority | Give PTP event messages deterministic treatment through TSN queues or strict QoS; do not let logging bursts starve sync traffic. |
| Evidence | Log grandmaster identity, clock class, offset, path delay, port state, time source, and sensor timestamp mode with every mission. |

Reference architecture:

```text
GNSS timing receiver / time appliance
        |
        | PPS + time of day, or direct PTP grandmaster
        v
PTP/gPTP grandmaster on vehicle Ethernet
        |
        +-- TSN switches with residence-time correction
        +-- LiDAR, camera, radar, IMU bridges
        +-- Linux compute PHCs
        +-- recorder and diagnostics
```

## Profile Selection

| Profile family | Use it when | Watchouts |
|---|---|---|
| IEEE 802.1AS / gPTP | The vehicle uses TSN, peer delay, bridge time awareness, and automotive Ethernet switches. | gPTP is not "generic PTP with another name"; endpoints must support the profile behavior and peer-delay model. |
| IEEE 1588 default or telecom-style PTP | A timing appliance, lab network, or sensor only supports a specific PTPv2 profile. | Mixing default PTP, telecom profiles, and gPTP can create silent non-interoperability. |
| AUTOSAR TimeSyncOverEthernet | Classic AUTOSAR ECUs need standardized time sync over Ethernet and global time services. | Configure the AUTOSAR stack and Linux/sensor PTP domain so they agree on grandmaster, domain, and time-base semantics. |
| Vendor sensor PTP mode | A LiDAR, camera, or radar exposes an IEEE 1588/802.1AS compatible mode. | Confirm whether the sensor timestamps packet start, scan start, exposure start, frame midpoint, or local clock conversion. |
| NTP or host receive time | Lab visualization, non-fused monitoring, or non-safety logs. | Do not use it for metric SLAM, LiDAR deskew, rolling-shutter correction, or radar-camera fusion. |

## Parameters to Freeze

Treat timing parameters like a DBC or calibration file. Version them and block
mission start on mismatches.

| Parameter | Why it matters |
|---|---|
| `domainNumber` | Prevents a lab grandmaster or depot tool from joining the production time domain. |
| `priority1`, `priority2`, clock class | Controls BMCA and grandmaster failover behavior. |
| Delay mechanism | gPTP peer delay and default PTP end-to-end delay are not interchangeable. |
| `logSyncInterval`, `logAnnounceInterval`, `logMinPdelayReqInterval` | Sets convergence, bandwidth, and diagnostic sensitivity. |
| Two-step vs one-step | Must match endpoint and switch capabilities for correction fields. |
| UTC offset and time source | Needed to convert PTP timescale to UTC/GNSS logs and incident evidence. |
| VLAN/PCP/DSCP | Prevents sync packets from competing with bulk point clouds or recorder traffic. |
| Switch residence-time support | Required for bounded error through multi-hop TSN topologies. |

## Effects on SLAM and Fusion

| Function | Timing dependency |
|---|---|
| LiDAR deskew | Each point or block must be transformed with ego pose at its acquisition time. |
| Camera fusion | Exposure timestamp must line up with LiDAR/radar points and rolling-shutter row times. |
| Radar fusion | The timestamp must represent the radar integration interval, not only CAN/Ethernet reception. |
| IMU preintegration | IMU samples need monotonic, high-rate timestamps tied to the same timebase as exteroceptive sensors. |
| Multi-sensor calibration | Time offset errors can masquerade as extrinsic rotation or lever-arm errors. |
| Mapping and replay | Raw logs must preserve timestamp provenance so offline replay can reproduce online alignment. |

## Failure Modes

| Failure mode | Symptom | Response |
|---|---|---|
| Wrong profile | Some endpoints sync, others free-run. | Block mission start until all required ports report the expected profile and port state. |
| Rogue grandmaster | Sudden grandmaster identity change or clock-class improvement from an unexpected MAC. | Reject the GM through allowlist, domain isolation, or switch filtering; enter degraded timing mode. |
| Software timestamp fallback | Offsets look noisy or step under CPU/network load. | Fail integration check if hardware timestamping is unavailable on required ports. |
| UTC/TAI mismatch | Logs are off by whole seconds or leap-second offset. | Record timescale and UTC offset; convert only at system boundaries. |
| Sensor local-time leak | Sensor publishes plausible but unconverted local ticks. | Require timestamp provenance fields and compare against PTP time during bring-up. |
| Sync traffic congestion | Offset spikes during LiDAR bursts or recorder uploads. | Reserve queue priority and validate under worst-case network load. |

## Telemetry and Validation Hooks

- `ptp4l` port state, selected best master, RMS/max offset, path delay, and
  frequency adjustment.
- `pmc` reads for `CURRENT_DATA_SET`, `PARENT_DATA_SET`,
  `TIME_PROPERTIES_DATA_SET`, and `TIME_STATUS_NP`.
- `phc2sys` system-clock offset to the active PHC and servo state.
- Switch counters for PTP event/general packets, dropped multicast, queue
  congestion, and VLAN priority mapping.
- Sensor-reported timestamp mode, lock state, last sync age, and PPS/PTP status.
- Replay check that aligns a sharp braking/turning event across IMU, wheel,
  LiDAR, camera, radar, and control logs.

Acceptance checks:

1. Cold boot converges to the expected grandmaster before mission start.
2. Worst-case logging and sensor bursts do not violate the offset budget.
3. Removing the primary grandmaster causes the documented failover path and
   diagnostic state.
4. A deliberately misconfigured domain or profile is detected before autonomy
   uses fused data.

## Related Repository Docs

- [Deterministic Real-Time Networking (TSN)](deterministic-networking-tsn.md)
- [PTP Grandmaster Failover and BMCA](ptp-grandmaster-failover-bmca.md)
- [Linux PHC and Hardware Timestamping](../compute/linux-phc-hardware-timestamping.md)
- [GNSS, PPS, PTP Holdover, and Time Integrity](../sensors/gnss-pps-ptp-holdover-time-integrity.md)
- [Sensor Calibration Time Synchronization](../../10-knowledge-base/geometry-3d/sensor-calibration-time-synchronization.md)

## Sources

- IEEE, [IEEE Std 1588-2019 Precision Time Protocol](https://standards.ieee.org/standard/1588-2019/)
- IEEE, [IEEE Std 802.1AS-2020 Timing and Synchronization for Time-Sensitive Applications](https://standards.ieee.org/standard/802_1AS-2020.html)
- AUTOSAR, [Time Synchronization over Ethernet Protocol R25-11](https://www.autosar.org/fileadmin/standards/R25-11/FO/AUTOSAR_FO_PRS_TimeSyncOverEthernetProtocol.pdf)
- Linux PTP Project, [ptp4l documentation](https://www.linuxptp.org/documentation/ptp4l/)
- Linux PTP Project, [default configuration reference](https://www.linuxptp.org/documentation/default/)
- Linux kernel docs, [Timestamping](https://docs.kernel.org/networking/timestamping.html)
