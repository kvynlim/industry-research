# Autonomous Tractor Field Operations

> Key takeaway: agricultural autonomy is seasonal, implement-driven, and connectivity-constrained. The tractor is only one part of the operating domain; the field boundary, crop state, implement, prescription map, weather window, and remote supervisor are equally important.

## Operational Domain Model

| Layer | Agricultural autonomy pattern |
|---|---|
| Vehicles | Row-crop tractors, articulated 4WD tractors, orchard/vineyard tractors, sprayers, mowers, and support vehicles. |
| Implements | Tillage tools, planters, seeders, sprayers, mowers, carts, and specialty crop equipment. |
| Site | Private fields, orchards, vineyards, farm lanes, headlands, drainage features, gates, ditches, and service yards. |
| Mission source | Farm management software, prescription maps, AB lines, field boundaries, equipment setup, agronomic task plan, and weather window. |
| ODD boundary | Geofenced field operation, approved implement, known boundary/headland, suitable soil/weather condition, and generally no public-road autonomous travel. |

Autonomous tractor operations differ from warehouse and yard autonomy because work quality matters as much as navigation. A perfectly safe tractor that misses rows, leaves skips, damages crop, or compacts wet soil is operationally unacceptable.

## ODD And Site Workflow

1. **Field setup**: import or create field boundary, headland, interior guidance lines, no-go zones, waterways, rocks, trees, ditches, and utility hazards.
2. **Implement setup**: attach implement, verify hitch, PTO/hydraulic/electrical connections, working width, depth/rate settings, calibration, and implement health.
3. **Mission planning**: choose operation type, speed, overlap, headland turns, refill/empty plan, weather limits, and supervision mode.
4. **Remote start authorization**: supervisor confirms field is clear, workers are outside the operating zone, emergency procedures are active, and the machine is in the correct mode.
5. **Autonomous execution**: tractor follows planned passes, performs headland turns, monitors implement state, detects obstacles, and reports job quality.
6. **Exception handling**: obstacle, implement plug, low tank, bad RTK correction, poor visibility, wet area, boundary violation risk, or bystander detection triggers pause and supervisor action.
7. **Job closeout**: generate coverage map, as-applied/as-worked record, exception log, fuel/charge use, machine health, and operator signoff.

Field ODD should be expressed as a machine-readable contract: field ID, boundary version, implement ID, operation type, allowed speed, weather limits, supervision ratio, and safety exclusions.

## Integration Points

| Interface | Why it matters |
|---|---|
| Farm management system | Work orders, field boundaries, crop plans, prescriptions, job history, and agronomic records. |
| John Deere Operations Center or equivalent | Remote monitoring, machine state, alerts, guidance data, and job documentation. |
| RTK / GNSS corrections | Row-level guidance, repeatability, boundary enforcement, and headland maneuvers. |
| ISOBUS / implement CAN | Implement state, rate/depth commands, section control, fault codes, and safety interlocks. |
| Weather and soil data | Determines safe/valuable operating windows, soil compaction risk, spray drift risk, and visibility. |
| Dealer/service systems | Software updates, diagnostics, calibration, repair, and seasonal readiness checks. |
| Worker safety procedures | Field clearance, lockout, chemical handling, bystander control, and emergency response. |

The autonomy controller must treat implement state as part of vehicle state. A tractor with an unhealthy implement is not in a valid autonomous operating condition.

## Safety And Regulatory Issues

- **Agricultural autonomy standard**: ISO 18497-1:2024 specifies design principles and vocabulary for partially automated, semi-autonomous, and autonomous agricultural machinery and tractors, including residual-risk information for safe use.
- **Public-road boundary**: ISO 18497-1 explicitly does not cover public-road operation. Road transport between fields remains a separate regulatory and safety problem.
- **California example**: Cal/OSHA materials in 2024 stated that California Title 8 did not currently allow autonomous tractors in the relevant agricultural equipment rule, and an advisory process was initiated to examine changes. This illustrates how farm-autonomy legality can vary by jurisdiction.
- **Worker exclusion**: autonomy should require positive field clearance when employees, contractors, livestock handlers, or public visitors may enter the operating area.
- **Implement hazards**: PTO, hydraulic pressure, rotating parts, sprayer chemicals, blades, and pinch points are often more dangerous than the tractor motion itself.
- **Remote supervision**: supervisors need clear authority for pause, resume, reroute, and recovery. Supervision ratios should be based on exception rate and connectivity, not vendor aspiration.
- **Connectivity limits**: loss of cellular service is normal in rural operations. The machine must continue safely, pause, or return based on pre-approved degraded-mode rules.

## Economics And Scale Signals

- John Deere announced a next-generation perception system in February 2025 as a precision upgrade kit for select 8R/8RX and 9R/9RX tractors, expanding autonomy beyond new machines into parts of the installed base.
- Deere stated that it had worked with test customers for five years and framed tillage autonomy around extending the working day, freeing labor, and helping farmers hit narrow seasonal operating windows.
- Deere's CES 2025 autonomy announcements covered multiple off-highway domains, including a 9RX tractor for large-scale agriculture and a 5ML orchard tractor, signaling a shared autonomy architecture across crop types.
- Deere's Autonomy Ready materials emphasize integrated vehicle automation, perception, StarFire/RTK positioning, and connected remote management through Operations Center.

The business case is not only labor replacement. It is also timeliness: planting, tillage, spraying, and harvest-adjacent tasks lose value when weather windows close.

## AV Stack Implications

- **Localization**: RTK GNSS remains primary, but the system needs dead reckoning, row/feature localization, and safe degradation when corrections drop.
- **Perception**: obstacle detection must handle people, animals, vehicles, trees, poles, ditches, rocks, standing crop, dust, low sun, and mud on sensors.
- **Planning**: field planning is coverage planning with headland turns, implement width, overlap, compaction, and refill logistics.
- **Control**: implement dynamics, soil slip, grade, articulation, and hitch geometry must be part of trajectory tracking.
- **Runtime assurance**: boundary monitors, implement interlocks, speed/turn limits, bystander detection, and emergency stop must supervise the autonomy stack.
- **Offline-first operations**: mission plans, maps, safety limits, and recovery behavior must run locally when cloud links are unavailable.

## Related Repo Docs

- `10-knowledge-base/state-estimation/rtk-gps-imu-localization.md`
- `10-knowledge-base/controls/frenet-trajectory-math.md`
- `30-autonomy-stack/localization-mapping/maps/map-tile-versioning-distribution.md`
- `50-cloud-fleet/fleet-management/ev-fleet-energy-co-optimization.md`
- `60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md`

## Sources

- [John Deere: Next Generation Perception System Brings Autonomy to Tillage](https://www.deere.com/en/news/all-news/next-generation-perception-system/)
- [John Deere: New Autonomous Machines and Technology at CES 2025](https://www.deere.com/en/news/all-news/autonomous-9RX/)
- [John Deere: Autonomy Ready 8R and 8RX Tractors](https://www.deere.com/en/tractors/row-crop-tractors/high-horsepower-8r-8rx-tractors/autonomy/)
- [ISO 18497-1:2024, Safety of Partially Automated, Semi-Autonomous and Autonomous Agricultural Machinery](https://www.iso.org/standard/82684.html)
- [Cal/OSHA Standards Board Meeting Packet, Autonomous Agricultural Vehicles Advisory Committee](https://www.dir.ca.gov/oshsb/documents/meetingpacketNov2024.pdf)
- [Cal/OSHA Advisory Committee Invite: Autonomous Agricultural Tractors](https://www.dir.ca.gov/oshsb/documents/Autonomous-Agricultural-Tractors-AC-invite.pdf)
