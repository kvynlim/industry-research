# AV Data Recorder and DSSAD Hardware

**Last updated:** 2026-05-09

## Why It Matters

AVs need two different recording systems that are often confused. A DSSAD-style
recorder captures a continuous, trustworthy record of automated-driving state,
control authority, faults, and key events for incident analysis. A bulk ADAS/AV
data logger captures high-rate raw sensor streams for validation, replay, model
improvement, and root-cause analysis. One is an accountability record; the other
is an engineering data source.

The hardware architecture should keep the DSSAD record small, time-aligned,
tamper-evident, and powered through safe stop, while the bulk recorder is sized
for worst-case sensor throughput and removable ingest workflows. IEEE 1616.1
defines DSSAD goals, metrics, common requirements, and ADS Level 3-5 data
elements; IEEE 802.1AS provides the time-synchronization basis needed to align
vehicle events, sensors, and network logs.

## Architecture Decisions

| Decision | Practical rule |
|---|---|
| Split recorders | Keep DSSAD/event ledger separate from bulk raw sensor logging. The DSSAD path must survive overload or failure of the bulk recorder. |
| Time source | Use GNSS/PPS or grandmaster-backed IEEE 802.1AS/gPTP, hardware timestamps where possible, and logged clock-offset/error states. |
| Power | Feed DSSAD recorder, trusted clock, and minimal gateway from the safe-stop rail with enough hold-up to flush the last event. |
| Data model | Define a fixed DSSAD data dictionary: ADS mode, control authority, fallback demand, fault state, vehicle motion, ODD state, command source, and safety-controller status. |
| Bulk throughput | Size ADAS logger interfaces and storage for peak sustained write, not average bitrate. Include cameras, LiDAR, radar, CAN FD, Ethernet, and debug streams. |
| Integrity | Hash event records, sign manifests, encrypt removable media, and maintain chain-of-custody for drive swaps. |
| Privacy | Separate operational evidence from raw video/audio. Apply retention, access control, and redaction policy before upload or disclosure. |

Recommended layout:

```
DSSAD / event ledger
        +-- safety controller state
        +-- ADS mode and fallback state
        +-- command authority and driver/operator interactions
        +-- faults, time quality, power state
        +-- tamper-evident storage on safe-stop rail

Bulk AV recorder
        +-- raw cameras, LiDAR, radar, CAN FD, Ethernet, GNSS/IMU
        +-- high-throughput NVMe arrays or cartridges
        +-- pre/post-trigger clips and continuous validation logging
        +-- depot ingest station and data lake manifest
```

## Evidence Artifacts

- DSSAD data dictionary mapped to IEEE 1616.1 concepts, jurisdictional
  requirements, and the vehicle safety case.
- Recorder block diagram showing safe-stop power, clock source, network taps,
  CAN/Ethernet interfaces, storage paths, and isolation from control traffic.
- Time-synchronization validation: gPTP grandmaster state, offset logs,
  hardware timestamp accuracy, holdover behavior, and clock-fault flags.
- Sustained-write test report at peak sensor load, including hot SSDs, full
  disks, worn drives, and simultaneous event extraction.
- Power-loss tests proving the last event record and manifest survive brownout,
  E-stop, and traction power loss.
- Tamper-evidence and chain-of-custody procedure for removable cartridges,
  operator access, OBD/service-port access, and depot ingest.
- Retention and privacy policy covering event records, raw sensor clips,
  operator notes, faces, license plates, aircraft identifiers, and upload rules.

## Acceptance Checks

- DSSAD recording continues when the bulk recorder is saturated, removed, or
  rebooting.
- A power cut during an event preserves the last approved time window, record
  hash, and recorder health state.
- All recorder channels can be aligned to the vehicle time base with documented
  maximum skew.
- Sustained write remains above measured peak sensor bitrate with at least the
  approved thermal, wear, and filesystem margin.
- Missing or degraded time sync is visible in the record and cannot be mistaken
  for trustworthy timing.
- Drive swaps produce signed manifests, operator identity, cartridge identity,
  vehicle identity, and time range.
- Privacy gates prevent raw camera data from leaving the vehicle or depot
  outside approved retention and redaction rules.

## Failure Modes

| Failure mode | Detection | Safe response |
|---|---|---|
| Bulk recorder backpressure | Queue growth, dropped packets, write latency spike | Preserve DSSAD path, drop lowest-priority bulk streams, alert fleet. |
| SSD thermal or wear degradation | SMART data, temp, write cliff, bad-block trend | Derate bulk recording, schedule cartridge replacement, protect event stream. |
| Time source loss | gPTP grandmaster loss, offset jump, GNSS/PPS fault | Mark records with degraded time quality and use holdover clock. |
| Event trigger missed | No clip for safety-controller event, trigger monitor mismatch | Keep continuous DSSAD ledger and add watchdog on trigger pipeline. |
| DSSAD and bulk data conflated | Raw logger failure removes event accountability record | Enforce independent storage, power, process, and health monitoring. |
| Tamper or unauthorized access | Manifest mismatch, signature failure, access log anomaly | Quarantine media and preserve audit trail. |
| Encryption key loss | Media unreadable after incident | Use escrowed key policy and tested recovery procedure. |
| Removable media mislabel | Cartridge ID mismatch, duplicate serial, ingest manifest error | Block ingest and require chain-of-custody reconciliation. |

## Related Repository Docs

- [On-Vehicle Data Triage and Selective Upload Prioritization](on-vehicle-data-triage-selective-upload.md)
- [Fleet Data Pipeline](../../50-cloud-fleet/data-platform/fleet-data-pipeline.md)
- [Perception-SLAM Fleet Data Contract](../../50-cloud-fleet/data-platform/perception-slam-fleet-data-contract.md)
- [Fleet Data Privacy Governance](../../50-cloud-fleet/data-governance/fleet-data-privacy-governance.md)
- [Deterministic Real-Time Networking (TSN)](../../20-av-platform/networking-connectivity/deterministic-networking-tsn.md)
- [NVIDIA Orin Technical](../../20-av-platform/compute/nvidia-orin-technical.md)
- [Incident Reporting and Post-Market Monitoring](../../60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md)
- [Safety Case Evidence Traceability](../../60-safety-validation/safety-case/safety-case-evidence-traceability.md)

## Sources

- IEEE, [IEEE 1616.1-2023 Standard for Data Storage Systems for Automated Driving](https://standards.ieee.org/ieee/1616.1/10939/)
- IEEE 1616 Working Group, [DSSAD and EDR information](https://sagroups.ieee.org/1616/information/)
- IEEE, [IEEE 802.1AS-2025 Timing and Synchronization for Time-Sensitive Applications](https://standards.ieee.org/ieee/802.1AS/11968/)
- Eurotech, [DynaCOR 61-10 ADAS/HIL Logger Edition](https://www.eurotech.com/products/dynacor-61-10-adas-hil-logger-edition/)
- Eurotech, [DynaCOR 40-35 Rugged High Performance Data Logger](https://www.eurotech.com/products/dynacor-40-35/)
- ViGEM, [High-end data logging systems for ADAS and autonomous driving](https://vigem.de/en/index.html)
- b-plus, [Data Recorder BRICK](https://www.b-plus.com/en/portfolio/data-collection-and-analysis/data-recorder-brick)
- b-plus, [BRICK SE Ethernet Recorder](https://www.b-plus.com/en/portfolio/industrial-generic/ethernet-recorder-brick-se)
