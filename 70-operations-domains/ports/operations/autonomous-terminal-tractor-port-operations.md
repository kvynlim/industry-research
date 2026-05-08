# Autonomous Terminal Tractor Port Operations

> Key takeaway: port terminal autonomy is a terminal operating system problem with safety-critical horizontal transport. Autonomous terminal tractors must synchronize quay, yard, gate, rail, and vessel schedules while operating in mixed traffic around cranes and container stacks.

## Operational Domain Model

| Layer | Port terminal pattern |
|---|---|
| Vehicles | Terminal tractors, autonomous terminal tractors, automated guided vehicles, straddle carriers, reach stackers, RTGs, ASCs, and shuttle carriers. |
| Site | Container terminal, multipurpose terminal, ro-ro terminal, intermodal yard, or inland terminal. |
| Mission source | Terminal Operating System (TOS), equipment control system, vessel plan, yard plan, gate appointments, rail schedules, and crane work queues. |
| Main moves | Quay-to-yard, yard-to-quay, stack reshuffle, gate-to-stack, stack-to-rail, rail-to-stack, empty-container moves, and maintenance repositioning. |
| ODD boundary | Controlled port terminal, marked routes, approved terminal sectors, known crane interface zones, weather limits, and defined mixed-traffic policy. |

Terminal tractors sit at the center of horizontal transport. If they are late, quay cranes wait, yard cranes queue, and vessel turn time suffers. The autonomy system therefore needs dispatch quality, not only safe driving.

## ODD And Site Workflow

1. **Vessel and yard plan**: the TOS assigns container moves based on vessel bay plan, yard strategy, crane sequence, gate/rail commitments, and container attributes.
2. **Mission allocation**: equipment control assigns terminal tractors to quay, stack, rail, or gate-side jobs while balancing crane productivity and traffic congestion.
3. **Pickup**: the tractor moves to a crane handoff point or stack area, waits outside lifting exclusion zones, confirms container/chassis state, and accepts the load.
4. **Horizontal transport**: the tractor follows terminal routes, obeys controlled intersections, yields to manned equipment, and reacts to temporary closures.
5. **Dropoff**: the vehicle aligns to the yard crane, quay crane, rail interface, or parking lane and confirms final pose and container handoff.
6. **Exception handling**: blocked lanes, crane delay, wrong container ID, failed twist-lock/chassis status, worker in exclusion zone, or localization degradation triggers a safe hold and terminal-ops escalation.
7. **Shift and mode transition**: the terminal may run manual, remote-assisted, and autonomous equipment simultaneously. Shift-change traffic and lunch breaks are high-risk transition periods.

Port ODDs are dynamic because vessel calls create surges, stacks change shape, temporary lanes appear, and terminal layout changes as yard utilization changes.

## Integration Points

| Interface | Why it matters |
|---|---|
| TOS | Authoritative source for container ID, move order, yard slot, vessel plan, gate/rail priority, and exception state. |
| Equipment control / fleet manager | Assigns tractors, manages queues, reserves routes, and coordinates with cranes and yard equipment. |
| Crane PLCs and crane management | Safe handoff timing, crane work queue, spreader position, lifting exclusion, and ready/not-ready signals. |
| OCR and ID systems | Container number, chassis ID, lane ID, gate transaction, damage inspection, and wrong-container detection. |
| Terminal traffic controls | Stop bars, barriers, signal lights, temporary closures, speed zones, and worker access control. |
| Connectivity and positioning | Private LTE/5G, Wi-Fi, RTK GNSS, UWB/RTLS, V2X, and edge servers for terminal awareness. |
| Cybersecurity / OT | Ports are critical infrastructure; TOS and equipment control interfaces need segmentation, audit, and incident response. |

Kalmar's Kalmar One positioning is instructive: a unified automation layer must interface between TOS, automated equipment, and other terminal systems, not leave each equipment vendor as a silo.

## Safety And Regulatory Issues

- **Marine terminal traffic safety**: OSHA marine-terminal guidance emphasizes traffic programs, pedestrian controls, powered industrial truck practices, and safe vehicle operations in terminal environments.
- **Powered industrial trucks in ports**: OSHA 29 CFR 1917.43 applies to powered industrial trucks used for material or equipment handling within marine terminals in the U.S.
- **Driverless industrial truck baseline**: ISO 3691-4 is a useful safety reference for driverless industrial truck systems, though ports often need additional machinery, crane, and terminal-specific controls.
- **EU machinery compliance**: Fernride's HHLA TK Estonia transition is notable because it cites TUV SUD certification under the EU Machinery Directive and approval by the Estonian Transport Administration.
- **Crane interaction**: the vehicle must never create ambiguity under suspended loads, near twist-lock operations, or in crane travel paths.
- **Workforce and union constraints**: terminal automation affects job roles, remote operations, maintenance, and training. Operational rollout must include workforce procedures, not only a technical safety case.
- **Weather and environment**: salt spray, rain, fog, wind, glare, ice, dust, and metal-container multipath affect perception, localization, and braking.

## Economics And Scale Signals

- HHLA and Fernride began transitioning HHLA TK Estonia near Tallinn to driverless terminal tractor operations in July 2025. HHLA reported three Fernride tractors in operation and a gradual rollout into live terminal moves.
- Kalmar introduced Kalmar One as a standalone automation system in 2025, emphasizing vendor-agnostic fleet management, TOS integration, and end-to-end optimization from stack to quay.
- APM Terminals Pier 400's 2025 electric terminal tractor deployment is not autonomous, but it is a useful scale signal: terminal tractor electrification is already entering production procurement, which creates a platform path for later automation.

The economic levers are crane productivity, vessel turn time, truck turnaround, labor scheduling, safer night operations, and equipment utilization. Ports will accept autonomy when it protects crane productivity rather than adding operational fragility.

## AV Stack Implications

- **Mission planning**: the AV stack needs terminal dispatch as a first-class input. Optimal behavior depends on crane queues, stack congestion, and vessel priority.
- **Infrastructure-aware perception**: containers, cranes, spreaders, chassis, twist-locks, workers, rail, and straddle carriers are domain objects, not generic obstacles.
- **Precise docking and handoff**: terminal tractor alignment must be reliable under cranes and at stack handoff points where centimeter-to-decimeter errors can slow operations.
- **Map lifecycle**: terminal maps change with yard reconfiguration, construction, temporary traffic plans, and lane closures. Map updates need operational approval gates.
- **V2X / cooperative perception**: crane state, barrier state, gate/OCR events, and terminal cameras can reduce occlusion risk and improve dispatch.
- **Cyber/OT safety**: TOS, equipment control, and vehicle fleet management form a cyber-physical control loop; incident response must include fleet-stop and terminal fallback.

## Related Repo Docs

- `30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`
- `30-autonomy-stack/multi-agent-v2x/fleet-coordination.md`
- `50-cloud-fleet/fleet-management/fleet-management-dispatch.md`
- `20-av-platform/networking-connectivity/deterministic-networking-tsn.md`
- `60-safety-validation/cybersecurity/cybersecurity-airside-av.md`

## Sources

- [HHLA: HHLA TK Estonia and Fernride Begin Transition to Driverless Operations](https://hhla.de/en/media/news/detail-view/hhla-tk-estonia-fernride-begins-transition-to-driverless-operations)
- [Fernride: Automated Horizontal Transport in Container Terminals](https://www.fernride.com/container-terminals)
- [Kalmar: Kalmar One Standalone Automation Solution](https://www.kalmarglobal.com/news--insights/press_releases/2025/kalmar-introduces-kalmar-one-as-a/)
- [Kalmar: Kalmar One Automation System](https://www.kalmarglobal.com/automation/kalmar-one-automation-system/)
- [APM Terminals: Pier 400 Electrifies Terminal Tractor Fleet](https://www2.apmterminals.com/en/news/news-releases/2025/250605-pier-400-electrifies-fleet)
- [OSHA: Traffic Safety in Marine Terminals](https://www.osha.gov/sites/default/files/publications/3337-07-2007-English-07192007.pdf)
- [OSHA 29 CFR 1917.43, Powered Industrial Trucks in Marine Terminals](https://www.osha.gov/laws-regs/regulations/standardnumber/1917/1917.43)
- [ISO 3691-4:2023, Driverless Industrial Trucks and Their Systems](https://www.iso.org/standard/83545.html)
