# Autonomous Yard Truck Operations

> Key takeaway: autonomous yard trucks are a closed-site trucking system. The hard operational problems are trailer identity, coupling, backing, dock coordination, gate flow, mixed traffic, and YMS/TMS/WMS synchronization.

## Operational Domain Model

| Layer | Logistics yard pattern |
|---|---|
| Vehicles | Electric or diesel terminal tractors / yard trucks, usually moving semi-trailers between gates, parking bays, dock doors, maintenance areas, scales, and staging zones. |
| Site | Distribution center, parcel hub, intermodal yard, manufacturing campus, retail DC, or 3PL facility with private roads and controlled entrances. |
| Actors | Yard jockeys, OTR drivers, security gate staff, warehouse dock teams, spotter supervisors, maintenance, pedestrians, and sometimes third-party carriers. |
| Mission source | YMS/TMS/WMS dock appointment, trailer move, trailer search, door assignment, empty/full status change, and priority pull. |
| ODD boundary | Private yard, mapped lanes, known trailer parking areas, defined speed limits, approved weather bands, and no unsupported public-road operation. |

The autonomous vehicle does not replace the yard management system. It becomes the physical execution layer for a digital trailer-move workflow.

## ODD And Site Workflow

1. **Gate-in and trailer registration**: trailer ID, carrier, appointment, load status, seal, and required dock door are captured through guard entry, RFID, OCR, or YMS entry.
2. **Move planning**: YMS/TMS/WMS releases a move from parking bay to dock, dock to parking, dock to gate, yard-to-yard shuttle, wash/fuel/charge, or maintenance.
3. **Trailer localization**: the autonomous yard truck validates the trailer location with perception, yard map, trailer ID, and parking-bay occupancy.
4. **Coupling**: the tractor backs under the trailer, verifies kingpin/fifth-wheel engagement, raises/lowers air suspension if available, and either uses robotic line connection or invokes a human/remote-assist step.
5. **Transport**: the truck follows yard routes, yields to manual vehicles and pedestrians, respects stop signs and one-way lanes, and handles blocked aisles.
6. **Dock or bay placement**: the truck backs to a door or parking slot, verifies final pose, uncouples, updates trailer state, and releases the mission result.
7. **Exception handling**: damaged trailers, blocked bays, unregistered trailer IDs, failed air-line connection, bad dock alignment, or low localization confidence are routed to a local yard lead.

Mature yards should treat lane geometry, parking-bay numbering, door state, and trailer ID as safety-relevant map data. Paint changes and temporary parking should require controlled map updates.

## Integration Points

| Interface | Why it matters |
|---|---|
| YMS | Authoritative source for trailer location, move queue, yard inventory, door status, and trailer search. |
| TMS | Carrier appointment, inbound/outbound loads, customer priority, detention/dwell metrics, and linehaul handoff. |
| WMS | Dock readiness, pallet loading completion, unload status, door availability, and warehouse wave timing. |
| Gate systems | OCR, RFID, scale, seal status, driver check-in, and yard access control. |
| Dock equipment | Dock locks, door open/closed state, lights, chocks, restraints, and yard-driver signals. |
| Network and positioning | RTK GNSS, private LTE/5G, Wi-Fi, camera infrastructure, V2X beacons, and edge compute. |
| Remote operations | Fleet monitor, exception resolution, manual recovery authorization, and incident command. |

The highest-value integration is closed-loop status: every physical move should update YMS state fast enough that dock teams and gate teams stop relying on radio calls.

## Safety And Regulatory Issues

- **Private-site safety case**: the yard is not a public road, but it is a workplace with heavy vehicles, pedestrians, and visitors. The safety case must cover mixed manual/autonomous flow, right-of-way, blocked lanes, and emergency response.
- **Industrial truck standards**: autonomous yard tractors may be assessed with industrial-truck and machinery safety practices such as ISO 3691-4 where applicable, plus site-specific risk assessment.
- **OSHA powered industrial truck rules**: U.S. employers still need training, inspection, maintenance, and operating procedures for powered industrial trucks where the vehicle falls under PIT use.
- **Coupling hazards**: fifth-wheel engagement, trailer landing gear, gladhand/air/electrical line connection, trailer rollaway, and dock-lock status are the most yard-specific safety functions.
- **Remote support authority**: remote operators should not improvise traffic rules. They need explicit authority boundaries, logs, escalation procedures, and minimum network quality rules.
- **Weather and visibility**: rain, snow, fog, glare, night lighting, mud, and trailer occlusions directly affect trailer pose, pedestrian detection, and backing.
- **Emergency behavior**: yards need procedures for fire lanes, ambulance/police access, manual override, tow recovery, and failed vehicle removal.

## Economics And Scale Signals

- ISEE announced a commercial autonomous truck-yard deployment in Texas in 2024 at a 1.7 million square foot distribution center with 750 trailer staging bays, operating across shifts in day/night and weather.
- In 2025, ISEE and TICO announced a production-deployed integrated autonomous yard truck live at a Fortune 100 logistics service provider hub; ISEE stated that its system had completed hundreds of thousands of autonomous trailer moves.
- Outrider frames the yard automation problem around the full trailer move, not just driving. Its TrailerConnect system robotically attaches brake and electric lines, addressing a manual task the company says occurs billions of times per year worldwide.
- Outrider has reported software/hardware releases that improve trailer move speed, backing, brake-line connection, and hitch precision, which are the operating metrics that matter more than miles driven.

The yard business case is usually driven by dwell reduction, predictable dock turns, fewer yard-driver vacancies, lower trailer search time, and safer coupling/backing work.

## AV Stack Implications

- **Trailer-aware perception**: the stack needs robust trailer pose, kingpin, landing gear, dock edge, gladhand, and parking-line detection.
- **Long articulated planning**: backing a trailer into a dock or slot requires kinematic planning for tractor-trailer articulation, swing radius, and jackknife avoidance.
- **Fleet traffic management**: routes must reserve narrow lanes and backing zones, coordinate manual traffic, and prevent deadlocks near docks and gates.
- **Manipulation**: fully unattended operation requires automated air/electrical connection, connection verification, and safe fallback when the connection geometry is unexpected.
- **Localization**: RTK GNSS is useful outdoors, but yards need fallback around trailers, buildings, and metal structures where GNSS multipath is severe.
- **Operations tooling**: operators need a live yard map, trailer search, blocked-lane controls, route closures, vehicle health, and auditable exception resolution.

## Related Repo Docs

- `50-cloud-fleet/fleet-management/fleet-management-dispatch.md`
- `50-cloud-fleet/fleet-management/ev-fleet-energy-co-optimization.md`
- `40-runtime-systems/monitoring-observability/teleoperation-systems.md`
- `30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`
- `30-autonomy-stack/planning/autonomous-docking-precision-positioning.md`

## Sources

- [ISEE: Commercially Deploys World's First Fully Autonomous Truck Yard](https://www.isee.ai/news/business-wire-isee-commercially-deploys-worlds-first-fully-autonomous-truck-yard)
- [ISEE and TICO: Integrated Autonomous Yard Trucks in Customer Operations](https://www.isee.ai/news/business-wire-isee-and-tico-announce-strategic-partnership-to-deliver-industry-first-fully-integrated-autonomous-yard-trucks-to-customer-operations)
- [Outrider: TrailerConnect Robotic Brake and Electric Line Connection](https://www.outrider.ai/press-releases/outrider-equips-autonomous-trucks-with-deep-learning-driven-robotic-arms/)
- [Outrider: Commercial Outrider System Shipping Update](https://www.outrider.ai/blog/company-news/its-2024-and-we-are-shipping-the-commercial-outrider-system/)
- [Outrider: Yard Automation Checklist](https://www.outrider.ai/solutions/)
- [ISO 3691-4:2023, Driverless Industrial Trucks and Their Systems](https://www.iso.org/standard/83545.html)
- [OSHA 29 CFR 1910.178, Powered Industrial Trucks](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.178)
