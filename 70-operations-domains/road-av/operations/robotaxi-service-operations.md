# Robotaxi Service Operations

> Key takeaway: robotaxi readiness is an operations system: city launch governance, depot uptime, rider experience, remote assistance, first responder coordination, incident reporting, and regulator confidence matter as much as the onboard driving stack.

## Operational Domain Model

| Layer | Robotaxi service pattern |
|---|---|
| Vehicles | SAE Level 4 passenger vehicles with ADS hardware, redundant actuation, onboard autonomy, passenger UI, telematics, and fleet health monitoring. |
| Site | Public-road service territory with mapped streets, pickup/dropoff zones, charging/cleaning depots, maintenance depots, freeways where approved, and airport interfaces where permitted. |
| Mission source | Ride-hailing app, partner app, dispatch optimizer, rider destination, city ODD state, vehicle availability, and pricing/ETA logic. |
| Operators | Fleet operations center, remote assistance/fleet response, roadside assistance, depot staff, rider support, safety case owners, city/regulatory liaisons, and first responder outreach. |
| ODD boundary | Authorized service area, approved road classes, weather/visibility limits, construction policy, speed bands, emergency-scene behavior, and vehicle-platform authorization. |

Robotaxi operations are public-facing. A stuck vehicle, inaccessible pickup, poor rider support interaction, or emergency responder conflict can become a safety and trust event even when no crash occurs.

## ODD And Site Workflow

1. **City readiness**: map service territory, collect baseline driving data, engage local agencies, validate emergency response procedures, set depot/charging plan, and define launch ODD.
2. **Safety case and deployment gate**: validate the ADS against the new city, road classes, weather, traffic behavior, construction patterns, and known edge cases.
3. **Rider-only staging**: launch employee or trusted-rider service, monitor pickup/dropoff behavior, remote assistance rate, rider support load, vehicle cleaning, and depot throughput.
4. **Public launch**: open rides to a waitlist or all riders; maintain city-specific ODD controls, customer support, incident command, and daily operations reviews.
5. **Service expansion**: add neighborhoods, airports, freeways, night/weather capability, and partner app channels only after evidence supports the change.
6. **Trip lifecycle**: app request, vehicle assignment, safe pickup point, identity confirmation, passenger boarding, in-car start, route execution, rider support, dropoff, cleaning/charge/maintenance routing.
7. **Incident lifecycle**: vehicle detects event or external report arrives, operations classifies severity, protects passengers/road users, coordinates with first responders, preserves logs, reports where required, and updates safety case evidence.

The launch artifact should be a city-specific ODD and operations dossier, not a generic "the stack works" claim.

## Integration Points

| Interface | Why it matters |
|---|---|
| Ride-hailing app | Rider request, payment, ETA, vehicle unlock, destination changes, support, accessibility preferences, and feedback. |
| Dispatch optimizer | Balances ETAs, charging, cleaning, demand hotspots, deadheading, depot capacity, and ODD state. |
| Remote assistance / fleet response | Provides contextual information in ambiguous situations while the ADS remains responsible for driving decisions. |
| Roadside assistance | Manual retrieval, flat tire, blocked vehicle, crash response, and vehicle securement. |
| Depot systems | Charging, cleaning, inspection, calibration, maintenance, parts, and daily launch readiness. |
| Regulator reporting | Crash reporting, permit reporting, disengagement or event metrics where required, and safety-case evidence updates. |
| First responder program | Training, emergency response guide, law enforcement protocols, vehicle disablement, and incident access. |

The operational goal is to keep the ADS, support teams, riders, and public agencies aligned on who has authority at every moment.

## Safety And Regulatory Issues

- **U.S. crash reporting**: NHTSA's Standing General Order requires identified manufacturers and operators to report certain ADS and Level 2 ADAS crashes.
- **Federal framework**: NHTSA's AV STEP proposal and broader AV framework are relevant to transparency, voluntary review, exemption pathways, and public confidence.
- **State/local permits**: California separates autonomous vehicle road permits through DMV and passenger-service authority through CPUC. Other states vary.
- **Remote assistance governance**: Waymo describes fleet response as contextual assistance, not direct driving. This distinction matters for safety case and liability.
- **First responder interaction**: robotaxi fleets need training, emergency guides, vehicle disablement procedures, and local agency relationships before launch.
- **Emergency scenes and blocked roads**: the vehicle must recognize and respond to emergency vehicles, police scenes, temporary traffic control, and responder hand signals.
- **Passenger safety**: accessibility, rider identity, in-cabin support, lost items, unsafe passenger behavior, and evacuation procedures are operational safety cases.

## Economics And Scale Signals

- Waymo reported in its 2025 year review that it served 15 million rides in 2025 and surpassed 20 million lifetime rides by the end of that year.
- Waymo reported serving more than 1 million fully autonomous rides per month in spring 2025 and said it was on a path toward that volume weekly by the end of 2026.
- Waymo opened Miami and Orlando to everyone in April 2026 after an initial interest-list rollout, and began introducing highway travel in Miami.
- Waymo's ride materials report more than 20 million rides served and a 93% rider satisfaction figure, while its Waymo-on-Uber page describes Austin and Atlanta partner-app operations.

Robotaxi economics remain sensitive to vehicle cost, utilization, cleaning/charging labor, remote assistance rate, insurance, and local launch overhead. The strongest public scale signals are ride volume, service-area expansion, airport/freeway capability, and depot/manufacturing capacity.

## AV Stack Implications

- **City generalization**: maps, perception, behavior prediction, and planner policy must adapt to local road design, driving culture, weather, signage, and construction practice.
- **Pickup/dropoff planning**: curb access, double parking avoidance, accessibility, airport rules, event traffic, and rider walking distance are service-quality features.
- **Remote assistance hooks**: the stack needs safe pause, contextual query, path proposal evaluation, audit logs, and independent ADS authority.
- **Operational ODD state**: weather, construction, emergency scenes, road closures, and depot capacity should flow into dispatch and vehicle routing.
- **Safety evidence**: deployment gates need scenario coverage, simulation, closed-course testing, on-road evidence, monitor performance, incident history, and residual-risk acceptance.
- **Data flywheel**: rider-only miles, support events, near misses, map changes, and city-specific scenarios become the training and validation backlog.

## Related Repo Docs

- `80-industry-intel/companies/waymo/production-operations.md`
- `80-industry-intel/companies/waymo/safety-methodology.md`
- `60-safety-validation/safety-case/safety-incidents-lessons.md`
- `50-cloud-fleet/fleet-management/fleet-management-dispatch.md`
- `40-runtime-systems/monitoring-observability/teleoperation-systems.md`
- `30-autonomy-stack/end-to-end-driving/company-approaches.md`

## Sources

- [Waymo: 2025 Year in Review](https://waymo.com/blog/2025/12/2025-year-in-review/)
- [Waymo: Florida's New Way to Ride, Miami and Orlando](https://waymo.com/blog/2026/04/floridas-new-way-to-ride)
- [Waymo: Ride-Hailing App and Service Areas](https://waymo.com/ride/)
- [Waymo: Fleet Response](https://waymo.com/blog/2024/05/fleet-response)
- [Waymo: Independent Audits of Safety Case and Remote Assistance Programs](https://waymo.com/blog/2025/11/independent-audits)
- [Waymo: First Responders](https://waymo.com/firstresponders/)
- [NHTSA: Standing General Order on Crash Reporting](https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting)
- [NHTSA: AV STEP Proposed National Program](https://www.nhtsa.gov/press-releases/nhtsa-proposes-national-program-vehicles-automated-driving-systems)
- [California DMV: Autonomous Vehicles Program](https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/)
- [California CPUC: Autonomous Vehicle Program Permits Issued](https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/autonomous-vehicle-program-permits-issued)
