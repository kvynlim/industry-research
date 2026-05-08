# Autonomous Haulage Operations

> Key takeaway: mining is the most mature heavy-vehicle autonomy domain. It works because the roads are private, the traffic rules are engineered, dispatch is centralized, and the ODD can be enforced through mine planning, exclusion zones, and production control.

## Operational Domain Model

| Layer | Mining haulage pattern |
|---|---|
| Vehicles | Ultra-class haul trucks, quarry trucks, water trucks, dozers, graders, loaders, excavators, drills, light vehicles, and service vehicles. |
| Site | Open-pit mine, quarry, oil-sands mine, or controlled haul-road network with dumps, crushers, stockpiles, workshops, and refuel/charge zones. |
| Mission source | Mine dispatch / fleet management system assigns shovel-to-dump or shovel-to-crusher moves based on mine plan, production targets, and equipment state. |
| Control owner | Mine operations owns production; dispatch owns traffic and queueing; safety owns exclusion zones and light-vehicle interaction; maintenance owns availability. |
| ODD boundary | Private haul roads, controlled intersections, surveyed routes, defined grades/berms, blast-zone closures, weather limits, and restricted human access. |

Unlike road AVs, autonomous haulage can modify the world to simplify autonomy: roads can be widened, intersections redesigned, berms improved, light vehicles fitted with transponders, and autonomous operating zones enforced.

## ODD And Site Workflow

1. **Mine plan and road design**: haul roads, ramps, intersections, dumps, crushers, fuel/charge areas, and exclusion zones are designed and maintained as production infrastructure.
2. **Dispatch assignment**: the FMS assigns a truck to a loader, dump point, crusher, or service location based on cycle time, queue length, material type, and payload requirements.
3. **Loading**: the autonomous truck approaches a shovel/excavator loading area, aligns to the assigned loading pose, waits for loading, validates payload state, and departs when released.
4. **Haul**: the truck follows approved haul roads, coordinates at intersections, adjusts for grade, traction, dust, water trucks, and slow equipment, and reports progress to dispatch.
5. **Dump/crusher**: the truck aligns to a dump edge, crusher, or stockpile tip point with strict berm, edge, and stability controls.
6. **Service loop**: trucks route to fuel, charge, tire inspection, wash, maintenance, or safe-parking locations based on health state and shift plan.
7. **ODD changes**: blasting, road works, water events, slope risk, visibility, or equipment failure cause geofence changes, speed changes, reroutes, or fleet holds.

The live mine map is a production artifact. A map error can become a dispatch error, a safety error, and a production loss at the same time.

## Integration Points

| Interface | Why it matters |
|---|---|
| Fleet management / dispatch | Assigns missions, optimizes queues, manages intersections, and balances production against equipment health. |
| Mine planning / survey | Provides road centerlines, grades, dump edges, berms, exclusion zones, and approved operating areas. |
| Loading equipment | Shovel state, loader bucket count, payload estimate, loading pose, and release-to-depart signals. |
| Crusher / dump systems | Dump availability, crusher status, stockpile state, tipping locations, and blockage events. |
| Proximity and light-vehicle systems | Location, identity, speed, and permission state for supervised vehicles inside autonomous zones. |
| Network infrastructure | Private LTE/5G, Wi-Fi mesh, GNSS corrections, edge servers, and radio fallback for mine operations. |
| Maintenance systems | Tire health, payload, brake temperature, suspension state, fuel/charge state, fault codes, and planned service. |

Autonomous haulage is dispatch-led. The onboard autonomy stack needs enough independence to reach a safe state, but the production system decides where the truck should create value.

## Safety And Regulatory Issues

- **Autonomous mining safety standard**: ISO 17757:2019 provides safety requirements for autonomous and semi-autonomous earth-moving and mining machine systems and was confirmed current in 2024.
- **Powered haulage hazards**: MSHA identifies mobile equipment at surface mines as a major collision hazard, especially where large haul trucks interact with smaller vehicles.
- **Exclusion zones**: high-confidence separation of autonomous haulage zones from people, pickups, graders, and maintenance crews is the central control.
- **Mine traffic management**: intersections, right-of-way, speed limits, berms, dumps, road width, parking, and recovery tow routes must be engineered and audited.
- **Degraded communications**: loss of comms should not create uncontrolled vehicles. Minimal-risk behavior, local autonomy, and dispatch reconciliation need explicit design.
- **Blasting and geotechnical risk**: blast clearance, highwall risk, dump-edge conditions, and slope monitoring must feed ODD state.
- **Change management**: mines change daily. Map edits, road works, new dumps, and temporary closures need safety-reviewed release workflow.

## Economics And Scale Signals

- Komatsu announced in 2026 that it had commissioned its 1,000th ultra-class autonomous haul truck, with FrontRunner customers having moved more than 11.5 billion metric tons since commercial introduction.
- Komatsu reported in 2024 that its FrontRunner fleet had exceeded 750 commissioned autonomous haul trucks and 10 billion metric tons moved, adding material at more than 6 million metric tons per day at that time.
- Caterpillar reported that Cat MineStar Command for hauling had surpassed 8.6 billion tonnes autonomously hauled by September 2024 across dozens of sites on multiple continents.
- Caterpillar's Luck Stone quarry deployment shows transfer from mining to aggregates: four autonomous Cat 777 trucks at a single-shift operation hauled more than 2 million tons in the first year with no reported safety injuries.

Mining autonomy economics are driven by utilization, cycle-time consistency, reduced shift-change loss, less human exposure, tire/brake optimization, and the ability to run production in harsh or remote areas.

## AV Stack Implications

- **Localization**: GNSS/INS is central, but autonomy still needs lidar/radar/vision backup around highwalls, dumps, crushers, and dusty loading areas.
- **Perception**: dust, rain, fog, darkness, water spray, and high-vibration sensor mounts make sensor health and degradation monitoring mandatory.
- **Planning and control**: loaded haul trucks require grade-aware speed planning, brake thermal management, stability limits, and conservative dump-edge behaviors.
- **Fleet scheduling**: queue optimization at shovels, crushers, dumps, and maintenance bays has a direct productivity impact.
- **Runtime assurance**: independent stop envelopes, geofence monitors, speed limit monitors, dump-edge constraints, and light-vehicle proximity controls should supervise autonomy.
- **Map operations**: haul-road map lifecycle must support frequent survey updates, controlled releases, rollback, and incident reconstruction.

## Related Repo Docs

- `50-cloud-fleet/fleet-management/fleet-management-dispatch.md`
- `30-autonomy-stack/multi-agent-v2x/fleet-coordination.md`
- `30-autonomy-stack/localization-mapping/maps/hd-map-change-detection-maintenance.md`
- `60-safety-validation/safety-case/failure-modes-analysis.md`
- `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`

## Sources

- [Komatsu: First OEM to Commission 1,000 Ultra-Class Autonomous Haul Trucks](https://www.komatsu.com/en-us/newsroom/2026/komatsu-becomes-first-oem-to-commission-1000-ultra-class-autonomous-haul-trucks)
- [Komatsu: Major Autonomous Milestones](https://www.komatsu.com/en/newsroom/2024/komatsu-achieves-major-autonomous-milestones)
- [Caterpillar: Cat MineStar Command for Hauling Manages the Autonomous Ecosystem](https://www.cat.com/en_GB/news/machine-press-releases/cat-minestar-command-for-hauling-manages-the-autonomous-ecosystem.html)
- [Caterpillar: Scaling a Proven Autonomy System to Support New Industries](https://www.caterpillar.com/en/news/caterpillarNews/2026/scaling-autonomy-system.html)
- [ISO 17757:2019, Autonomous and Semi-Autonomous Machine System Safety](https://www.iso.org/standard/76126.html)
- [MSHA: Mobile Equipment at Surface Mines](https://www.msha.gov/safety-and-health/safety-and-health-materials/safety-topics/safety-topic-mobile-equipment-surface-mines)
