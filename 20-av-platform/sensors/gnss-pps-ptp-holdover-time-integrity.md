# GNSS, PPS, PTP Holdover, and Time Integrity

**Last updated:** 2026-05-09

## Why It Matters

GNSS receivers do more than estimate position. In many AV platforms they are
also the root of vehicle time through PPS, time-of-day messages, or a PTP
grandmaster. If that time source drifts, jumps, loses UTC/GPS association, or
enters unbounded holdover, LiDAR deskew, camera fusion, radar Doppler
compensation, IMU preintegration, and incident replay can all become wrong while
messages still look fresh.

The platform must monitor time integrity separately from position integrity.
RTK fix does not prove good PPS. PPS does not prove correct time-of-week. A
locked PTP slave does not prove the grandmaster is traceable to a valid source.

## Deployment Contract

| Contract item | Practical rule |
|---|---|
| Time root | Declare the primary time root: GNSS timing receiver, site grandmaster, atomic/OCXO appliance, or depot source. |
| PPS association | Pair every PPS edge with a valid time-of-day source and sequence; a pulse alone only gives phase. |
| Cable delay | Version antenna cable delay, PPS cable delay, and timing-appliance configuration. |
| Holdover budget | Define maximum holdover duration and accumulated time error allowed for each autonomy mode. |
| Integrity signals | Log GNSS lock, constellation health, time validity, leap/UTC offset, PPS validity, oscillator state, and holdover quality. |
| Distribution | Use PTP/gPTP to distribute time to Ethernet sensors and compute; use direct PPS/event lines only where they are validated. |
| Fusion policy | Inflate timestamp uncertainty or inhibit metric fusion when the time root is degraded. |

## Timing Architecture

```text
GNSS antenna
   |
   v
Timing receiver
   +-- PPS / TIMEPULSE phase reference
   +-- time-of-day message (UTC/GPS/TAI association)
   +-- integrity and holdover status
   |
   v
PTP/gPTP grandmaster or Linux PHC discipline
   |
   +-- Ethernet sensors
   +-- compute PHCs
   +-- recorder
   +-- diagnostics and safety supervisor
```

Important distinction:

| Signal | What it proves | What it does not prove |
|---|---|---|
| PPS edge | Precise second boundary or configured pulse phase. | Which second it is. |
| NMEA/UBX/SBF time message | Time-of-day association and receiver state. | Low-jitter edge timing by itself. |
| PTP lock | Slave follows the selected grandmaster. | Grandmaster is traceable or healthy. |
| RTK fix | GNSS position ambiguity is resolved. | PPS and UTC association are valid. |
| Holdover | Local oscillator is maintaining time after source loss. | Error is still inside the SLAM/fusion budget. |

## Holdover Policy

Holdover is a bounded-risk state, not a binary OK state.

| State | Meaning | Fusion policy |
|---|---|---|
| `LOCKED_TRACEABLE` | GNSS/site time valid, PPS valid, PTP GM healthy. | Full timing capability. |
| `LOCKED_UNVERIFIED` | PTP lock exists but root traceability is unknown. | Allow non-critical logs; block high-integrity operation. |
| `HOLDOVER_BOUNDED` | Source lost but oscillator error is within validated budget. | Continue with time uncertainty growth and mission limits. |
| `HOLDOVER_EXPIRED` | Holdover duration or estimated error exceeds budget. | Stop metric multi-sensor fusion or transition to safe/depot mode. |
| `FREE_RUN` | No valid source or bounded oscillator state. | Treat timestamps as local only; do not combine with other sensors metrically. |
| `TIME_STEP` | Timebase jumped or re-associated after loss. | Mark replay discontinuity; reset affected estimators and buffers. |

The holdover budget depends on oscillator class, temperature, vibration, aging,
and how tightly the estimator depends on time. A low-speed yard vehicle may
survive larger timestamp uncertainty than a highway AV or high-rate mapper, but
the policy must be explicit.

## Failure Modes

| Failure mode | Symptom | Response |
|---|---|---|
| PPS without valid time-of-day | Stable one-second pulses with wrong epoch. | Reject absolute timestamp conversion until ToD is valid and sequenced. |
| Leap/UTC offset mismatch | Logs are shifted by whole seconds. | Record time scale and UTC offset from the GM and receiver. |
| GNSS spoofing or jamming | Time or position changes inconsistently with IMU/wheel/LiDAR. | Cross-check GNSS time and motion; enter integrity degraded state. |
| Antenna/cable fault | GNSS lock loss, PPS invalid, receiver alarm. | Start holdover timer and apply mission policy. |
| Oscillator thermal drift | Growing offset during hot soak or cold start. | Monitor oscillator temperature and holdover error estimate. |
| Wrong cable delay | Constant timing bias across all sensors. | Calibrate and version delay; validate with a known timing reference. |
| GM recovery time step | Estimator residuals spike after reacquisition. | Gate data around reacquisition and log a time discontinuity event. |

## Telemetry and Validation Hooks

Telemetry:

- GNSS time validity, UTC/GPS/TAI offset, leap-second state, and receiver time
  accuracy estimate.
- PPS validity, pulse polarity, pulse frequency, last edge sequence, and edge
  age.
- Grandmaster identity, clock class, time source, holdover flag, and clock
  quality.
- PHC/system offset, frequency adjustment, and servo state from `ptp4l`,
  `phc2sys`, or `ts2phc`.
- Time uncertainty estimate exported to localization and sensor fusion.

Validation:

1. Cold boot with no sky view: system must not claim traceable time.
2. GNSS antenna disconnect: holdover state starts, clock quality degrades, and
   mission policy changes before the time error budget is exceeded.
3. PPS polarity/cable delay test: measured offset matches configured delay.
4. Leap/UTC conversion test: logs align with known UTC and PTP/TAI conversion.
5. Replay: estimator behavior is reproducible using recorded timestamp
   provenance and time-integrity state.

## Related Repository Docs

- [IMU, GNSS, and RTK Hardware](imu-gnss-rtk.md)
- [PTP and gPTP Profiles for Vehicle Ethernet](../networking-connectivity/ptp-gptp-profiles-vehicle-ethernet.md)
- [PTP Grandmaster Failover and BMCA](../networking-connectivity/ptp-grandmaster-failover-bmca.md)
- [Linux PHC and Hardware Timestamping](../compute/linux-phc-hardware-timestamping.md)
- [Time Sync Health Monitoring and Degraded Mode](../diagnostics/time-sync-health-monitoring-degraded-mode.md)

## Sources

- Linux kernel docs, [PPS](https://docs.kernel.org/driver-api/pps.html)
- Linux kernel docs, [PTP hardware clock infrastructure](https://docs.kernel.org/driver-api/ptp.html)
- Linux PTP Project, [ts2phc documentation](https://www.linuxptp.org/documentation/ts2phc/)
- u-blox, [ZED-F9T timing module documentation](https://www.u-blox.com/en/product/zed-f9t-module)
- Septentrio, [Timing GNSS receivers](https://www.septentrio.com/en/products/gnss-receivers/timing-receivers)
- Microchip, [GNSS timing instruments and grandmaster clocks](https://www.microchip.com/en-us/products/clock-and-timing/systems/gnss-timing-instruments)
- IEEE, [IEEE Std 1588-2019 Precision Time Protocol](https://standards.ieee.org/standard/1588-2019/)
