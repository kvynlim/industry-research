# Linux PHC and Hardware Timestamping

**Last updated:** 2026-05-09

## Why It Matters

Linux compute nodes often sit between sensor clocks and autonomy software. If a
NIC, driver, switch, or process silently falls back to software timestamps, SLAM
and fusion receive timestamps that move with interrupt latency, scheduler load,
PCIe congestion, and recorder bursts. The platform contract should make PHC
state, timestamping capability, and clock synchronization observable.

PHC means Precision Hardware Clock. A PHC is exposed as `/dev/ptpN` and is
usually attached to an Ethernet MAC, NIC, timing card, or SoC time engine.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| PHC inventory | Map every fusion NIC to its `/dev/ptpN`, driver, firmware, and physical port. |
| Capability gate | Mission start requires hardware receive/transmit timestamp support on required PTP ports. |
| Clock ownership | One process owns each servo path: usually `ptp4l` for network-to-PHC and `phc2sys` for PHC-to-system or PHC-to-PHC. |
| Time source | The system clock may follow a PHC, but sensor timestamps should keep hardware-clock provenance. |
| Socket timestamps | Drivers and middleware must request hardware timestamps explicitly; host receive time is a diagnostic field. |
| PPS/event lines | PPS or external timestamp inputs should be captured by PHC or LinuxPPS where available and logged with sequence counters. |
| Replay | Bags/logs preserve sensor hardware time, converted vehicle time, receive time, and conversion status. |

## Linux Components

| Component | Role | Check |
|---|---|---|
| `/dev/ptpN` | PHC device exposed by the kernel PTP subsystem. | `ls /dev/ptp*`, `ethtool -T <iface>` |
| `ptp4l` | Runs PTP/gPTP protocol and disciplines a PHC. | Port state should become `SLAVE`, `MASTER`, or `GM` as designed. |
| `phc2sys` | Synchronizes PHC to system clock, system clock to PHC, or PHC to PHC. | Offset should stay within the platform budget. |
| `ts2phc` | Disciplines a PHC from external timestamp inputs such as PPS. | PPS edge age and servo state must be monitored. |
| `SO_TIMESTAMPING` | Socket API for software and hardware packet timestamps. | Require `SOF_TIMESTAMPING_RX_HARDWARE` or `TX_HARDWARE` where relevant. |
| `hwtstamp_config` | Driver configuration for packet timestamp filters. | Confirm filters cover PTP event packets and required application traffic. |
| LinuxPPS | Kernel PPS API for precise pulse events. | Useful when GNSS PPS enters the host directly. |

## Bring-Up Checklist

Use the actual interface names and expected PHC mapping from the vehicle BOM.

```bash
ethtool -T eth0
ls -l /dev/ptp*
ptp4l -i eth0 -m -H -f vehicle-gptp.cfg
pmc -u -b 0 'GET CURRENT_DATA_SET'
pmc -u -b 0 'GET TIME_STATUS_NP'
phc2sys -s eth0 -c CLOCK_REALTIME -w -m
```

Acceptance rules:

- `ethtool -T` reports hardware transmit and receive timestamping plus a PTP
  hardware clock for each required interface.
- `ptp4l` uses hardware timestamping, not software mode.
- The selected PHC and Linux system clock offset remain within the estimator
  budget under CPU, GPU, storage, and network load.
- Sensor drivers publish acquisition timestamps from sensor or PHC time, not
  only ROS message creation time.

## Timestamp Provenance Model

For each incoming sensor message, preserve at least these fields in logs or
metadata:

| Field | Meaning |
|---|---|
| `sensor_time` | Native timestamp from the sensor, packet, frame, chunk, or radar message. |
| `vehicle_time` | Converted timestamp in the vehicle PTP/gPTP domain. |
| `host_rx_time` | Host receive timestamp, preferably hardware RX time if supported. |
| `stamp_source` | `ptp`, `gptp`, `pps`, `gnss`, `host_hw_rx`, `host_sw_rx`, or `sensor_local`. |
| `sync_state` | Locked, holdover, free-run, unknown, or invalid. |
| `clock_identity` | Grandmaster or source clock identity used for conversion. |
| `conversion_id` | Versioned config for offsets, UTC/TAI conversion, cable delay, and sensor mode. |

This lets offline SLAM replay distinguish a bad sensor measurement from a good
measurement with a bad timestamp conversion.

## Failure Modes

| Failure mode | Detection | Response |
|---|---|---|
| PHC index changes after reboot | `/dev/ptpN` no longer matches expected NIC. | Bind by interface and driver metadata, not by static index alone. |
| Hardware timestamp unavailable | `ethtool -T` lacks required capabilities or driver rejects `SIOCSHWTSTAMP`. | Block timing-critical autonomy on that port. |
| Software timestamp fallback | Offset noise follows CPU load and interrupt latency. | Raise timing degraded state and stop using that source for metric fusion. |
| Multiple servos fight | `ptp4l`, `phc2sys`, NTP, or Chrony discipline the same clock. | Enforce one clock owner per clock edge and monitor process config hashes. |
| Wrong PHC selected | Sensor NIC follows one clock, fusion process reads another. | Validate PHC-to-interface mapping at boot and in mission health checks. |
| System time step | Logs or ROS stamps jump due to time service correction. | Use monotonic/PHC-based acquisition time for fusion and treat wall time as presentation. |
| PPS polarity or cable delay wrong | Constant offset to GNSS/GM despite stable servo. | Validate with oscilloscope or known timing receiver and version cable delay. |

## Validation Hooks

- Unit-level: driver timestamp test for one received PTP event packet and one
  application packet path where hardware RX timestamps are required.
- Integration: compare GNSS PPS, PHC time, system time, and sensor-reported PTP
  time over cold boot, warm restart, and network failover.
- Stress: run worst-case point-cloud logging, camera capture, GPU inference, and
  storage flush while checking PHC and system-clock offset.
- Replay: verify that a bag contains acquisition time, receive time, source
  state, and conversion metadata for each fused topic.
- Fault injection: disable hardware timestamping, change PHC mapping, kill
  `ptp4l`, and confirm degraded mode triggers before fusion trusts new data.

## Related Repository Docs

- [PTP and gPTP Profiles for Vehicle Ethernet](../networking-connectivity/ptp-gptp-profiles-vehicle-ethernet.md)
- [PTP Grandmaster Failover and BMCA](../networking-connectivity/ptp-grandmaster-failover-bmca.md)
- [Time Sync Health Monitoring and Degraded Mode](../diagnostics/time-sync-health-monitoring-degraded-mode.md)
- [Safety-Certified Runtime Compute](safety-certified-runtime-compute.md)
- [Visible Cameras](../sensors/visible-cameras.md)

## Sources

- Linux kernel docs, [PTP hardware clock infrastructure](https://docs.kernel.org/driver-api/ptp.html)
- Linux kernel docs, [Timestamping](https://docs.kernel.org/networking/timestamping.html)
- Linux kernel docs, [PPS](https://docs.kernel.org/driver-api/pps.html)
- Linux PTP Project, [ptp4l documentation](https://www.linuxptp.org/documentation/ptp4l/)
- Linux PTP Project, [phc2sys documentation](https://www.linuxptp.org/documentation/phc2sys/)
- Linux PTP Project, [ts2phc documentation](https://www.linuxptp.org/documentation/ts2phc/)
- Linux PTP Project, [pmc documentation](https://www.linuxptp.org/documentation/pmc/)
