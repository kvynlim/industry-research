# Autonomous Earthmoving Site Operations

> Key takeaway: construction autonomy is harder than mining because the site changes every day. Production autonomy must connect machine control, survey, temporary traffic plans, worker exclusion, and as-built feedback into one controlled operating loop.

## Operational Domain Model

| Layer | Construction autonomy pattern |
|---|---|
| Vehicles | Excavators, dozers, compactors, graders, articulated dump trucks, off-highway trucks, loaders, robotic pile drivers, and support pickups. |
| Site | Construction site, quarry, solar farm, road project, civil earthworks site, trenching project, or large infrastructure job. |
| Mission source | Civil model, BIM/CAD design, survey control, cut/fill plan, haul plan, daily work package, and superintendent instructions. |
| Control owner | Site superintendent owns sequencing; survey/engineering owns design intent; safety owns exclusion zones; equipment manager owns fleet readiness. |
| ODD boundary | Private jobsite or controlled quarry, approved work zone, surveyed geofence, temporary haul routes, known utilities, and no unsupported public-road movement. |

The operational difference between "autonomous machine" and "autonomous site" is large. A machine can dig a trench, but the site system must know where utilities are, when crews enter, whether grade is correct, and what changed since yesterday.

## ODD And Site Workflow

1. **Digital work package**: ingest design surface, trench alignment, pile plan, haul route, stockpile location, temporary access, utility locates, and exclusion zones.
2. **Survey and map update**: capture current terrain, cones, barriers, laydown areas, workers' access paths, and any field change from the previous shift.
3. **Task generation**: convert design intent into machine-level work: cut, fill, trench, load-haul-dump, compact, grade, pile, or material move.
4. **Site clearance**: verify no workers, spotters, or third-party equipment are in the autonomous zone; activate barriers, signage, and access control.
5. **Execution**: the machine performs the task under speed, geofence, tool, slope, and visibility constraints while reporting progress.
6. **Quality feedback**: compare as-built/as-dug/as-driven state with design tolerance and update the work package.
7. **Exception handling**: utility conflict, unexpected soil, obstacle, worker entry, map mismatch, blocked haul road, stuck machine, or poor sensor visibility triggers a safe hold.

Construction ODDs should be shift-scoped. A site map that was valid yesterday can be unsafe after one crane move, spoil pile, trench plate, or concrete pour.

## Integration Points

| Interface | Why it matters |
|---|---|
| BIM/CAD/civil model | Source of cut/fill surfaces, trench lines, pile coordinates, tolerances, and as-built comparison. |
| Survey / machine control | RTK base, total station, drone photogrammetry, lidar scans, grade control, and control points. |
| Site safety system | Worker access, exclusion zones, lockout/tagout, spotter procedures, utility permits, and emergency response. |
| Fleet dispatch | Haul routes, queueing, dump/stockpile availability, charger/fuel status, and maintenance windows. |
| Teleoperation / remote assist | Recovery, machine repositioning, ambiguous obstacle handling, and supervisor approval. |
| Project controls | Quantity tracking, production rate, schedule impact, equipment utilization, and subcontractor coordination. |

The automation system must produce evidence the construction team already values: quantities moved, tolerances achieved, delays, exceptions, and rework risk.

## Safety And Regulatory Issues

- **Functional safety for earth-moving machinery**: ISO 19014-1 defines a methodology for determining safety-related control system performance requirements for earth-moving machinery.
- **Autonomous mining/earth-moving safety**: ISO 17757 applies to autonomous and semi-autonomous earth-moving and mining machine systems and is relevant for off-road heavy equipment.
- **OSHA construction equipment controls**: U.S. construction sites need controls for motor vehicles and mechanized equipment under OSHA 29 CFR 1926 Subpart O, plus struck-by hazard management.
- **Utility and underground risk**: autonomous excavation must not proceed on stale utility information. Permits, potholing, dig limits, and utility-clearance evidence are safety inputs.
- **Worker proximity**: construction workers routinely enter work zones for inspection, grade checks, material delivery, and trade coordination. Access control must be operational, not only digital.
- **Temporary geometry**: cones, barricades, trench plates, ramps, spoil piles, and equipment staging alter the ODD daily.
- **Manual/autonomous transitions**: machines may switch between manual, remote, assisted, and autonomous modes. Mode authority and recovery procedures need explicit signoff.

## Economics And Scale Signals

- Caterpillar launched autonomous Cat 777 trucks at Luck Stone's Bull Run quarry in 2024, its first aggregates deployment, and later described four 100-ton trucks working a single shift at the site.
- Caterpillar reported that the Luck Stone autonomous fleet hauled more than 2 million tons in its first year with no reported safety injuries, showing a quarry-scale bridge from mining autonomy toward construction materials.
- Kawasaki announced in November 2024 that it had developed an autonomous excavation system for excavators and achieved autonomous trench excavation for construction and civil engineering sites.
- Built Robotics' RPD 35 autonomous piling system packages survey, pile distribution, pile driving, and data collection into one robot for utility-scale solar construction, with published specs such as up to 224 piles carried and 10% maximum grade.

Construction autonomy economics come from labor scarcity, 24-hour or low-exposure operation, fewer survey rework loops, faster quantity completion, and safer execution of repetitive heavy-equipment tasks.

## AV Stack Implications

- **Dynamic mapping**: the site map must be easy to update from survey data, drones, machine perception, and supervisor edits.
- **Terrain reasoning**: autonomy needs traversability, slope stability, traction, mud, edge, trench, and pile/stockpile reasoning, not just lane following.
- **Tool control**: earthmoving autonomy requires bucket, blade, compactor, hammer, and implement state integrated with vehicle planning.
- **Human detection**: PPE, spotters, workers behind materials, and workers stepping into blind zones are central perception cases.
- **Teleoperation fallback**: remote operation is often necessary for recovery, low-frequency tasks, or work near uncertain utilities.
- **As-built data loop**: perception and survey outputs should close the loop into QA, progress payment, and next-day planning.

## Related Repo Docs

- `30-autonomy-stack/planning/safety-critical-planning-cbf.md`
- `30-autonomy-stack/localization-mapping/maps/hd-map-change-detection-maintenance.md`
- `30-autonomy-stack/localization-mapping/maps/map-construction-pipeline.md`
- `40-runtime-systems/monitoring-observability/teleoperation-systems.md`
- `60-safety-validation/safety-case/failure-modes-analysis.md`

## Sources

- [Caterpillar: Autonomous Cat 777 at Luck Stone Quarry](https://investors.caterpillar.com/news/news-details/2024/Caterpillar-Paves-the-Way-for-Future-Technology-Advancements-with-Launch-of-Autonomous-Cat-777-Off-Highway-Truck-at-Luck-Stone-Quarry/default.aspx)
- [Caterpillar: Cat Autonomy Solutions](https://www.caterpillar.com/en/news/caterpillarNews/2026/cat-autonomy-solutions.html)
- [Kawasaki: Autonomous Excavation System for Excavators](https://global.kawasaki.com/en/corp/newsroom/news/detail/?f=20241127_7850)
- [Built Robotics: Autonomous Solar Piling](https://www.builtrobotics.com/solutions/solar-piling)
- [Built Robotics: Construction Robotics Platform](https://www.builtrobotics.com/)
- [ISO 19014-1:2018, Earth-Moving Machinery Functional Safety](https://www.iso.org/standard/70715.html)
- [ISO 17757:2019, Autonomous and Semi-Autonomous Machine System Safety](https://www.iso.org/standard/76126.html)
- [OSHA Construction Struck-By and Subpart O Reference](https://www.osha.gov/etools/construction/struck-by)
