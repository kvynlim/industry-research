# Sidewalk Delivery Robot Operations

> Key takeaway: sidewalk delivery robots are a pedestrian-realm operations problem. The hard parts are not highway-speed autonomy; they are municipal permission, ADA-compatible sidewalk use, merchant handoff, short-range pedestrian interaction, curb and crosswalk behavior, remote assistance, charging logistics, and fast retrieval when a robot blocks the public right-of-way.

## Operational Domain Model

| Layer | Sidewalk delivery pattern |
|---|---|
| Vehicles | Small electric delivery robots with locked cargo bins, low-speed sidewalk motion, onboard perception, telematics, remote-assistance hooks, lights/markers, brakes, and weatherized enclosures. |
| Site | University campuses, planned communities, dense urban neighborhoods, downtown districts, retail corridors, and controlled private/public pedestrian networks. |
| Actors | Customers, restaurant/store staff, pedestrians, wheelchair and mobility-device users, cyclists/scooter riders on shared paths, delivery platform support, city/campus mobility staff, remote assistants, field technicians, and police/311 responders. |
| Mission source | Delivery marketplace order, merchant tablet/POS integration, campus dining app, grocery/convenience order, parcel handoff, return pickup, or partner dispatch API. |
| Control owner | Fleet operator owns robot availability and safety case; platform/merchant owns order promise and customer support; city/campus owns right-of-way permission and accessibility conditions. |
| ODD boundary | Geofenced sidewalks, shared-use paths, crosswalks, approved street crossings, mapped curb ramps, suitable weather/lighting, approved cargo class, speed/weight limits, and no unsupported road-lane operation. |

The domain has three common operating patterns:

- **Campus or private-site service**: the operator negotiates with one owner, maps a bounded network, and serves repeat merchants and repeat customers. This is the cleanest deployment model because routes, pickup points, charging, and incident escalation can be standardized.
- **Urban food delivery**: the robot operates in public right-of-way near restaurants, apartment buildings, curb ramps, construction, tourists, nightlife, scooters, and sidewalk clutter. Municipal governance and field support become as important as autonomy.
- **Partner-platform delivery**: the customer order begins in Uber Eats, DoorDash, Just Eat, Bolt, a campus dining app, or a merchant app. The robot fleet is an execution layer, so order assignment, pickup timing, customer unlock, refunds, and support must be integrated.

## ODD And Site Workflow

1. **Jurisdiction and site authorization**: confirm whether the state, city, campus, business improvement district, or private-property owner permits personal delivery devices. Capture fleet caps, insurance, reporting, speed, parking/dwelling, data-sharing, and accessibility obligations before mapping routes.
2. **Route and sidewalk survey**: map sidewalks, curb ramps, crosswalks, curb cuts, steep grades, poor pavement, construction zones, outdoor dining, transit stops, school zones, high-pedestrian-density blocks, stairs, bollards, gates, and no-go areas.
3. **Merchant onboarding**: define pickup shelves or robot loading spots, staff confirmation steps, food temperature policy, order timeout, packaging constraints, oversized-item rejection, and who resolves a missed handoff.
4. **Hub and charging setup**: place robots and chargers where they do not consume required pedestrian access width. Define staging, cleaning, battery swap/charge cadence, field repair, and retrieval routes.
5. **Digital integration**: connect the fleet manager to platform order assignment, merchant status, customer app unlock, payment/refund support, ETA calculation, and customer communication.
6. **Mission release**: dispatch only if the delivery fits cargo, distance, battery, weather, sidewalk, crosswalk, and local permit constraints. The fleet manager should reject missions that require unsupported roads, blocked sidewalks, hazardous cargo, or inaccessible drop-off paths.
7. **Pickup execution**: robot arrives at the merchant, positions at the agreed loading point, authenticates the staff handoff, locks the cargo bin, and confirms order custody.
8. **Sidewalk and crossing execution**: robot proceeds at pedestrian-compatible speed, yields to people, avoids blocking curb ramps and entrances, crosses only at approved crossings, and requests remote assistance when blocked or uncertain.
9. **Drop-off execution**: robot stops at an accessible and legal drop-off point, alerts the customer, unlocks only through the authorized app or code, confirms retrieval, and clears the sidewalk.
10. **Exception handling**: blocked route, curb-ramp failure, robot immobilization, low battery, vandalism, customer no-show, cargo issue, or public complaint routes to remote assistance, customer support, field retrieval, or local authority escalation.
11. **Closeout and learning**: record delivery completion, intervention reason, route delay, pedestrian conflict, support contact, field repair, map defect, and permit-reporting events.

ODD changes that should trigger a release gate include new city/campus launch, sidewalk reconstruction, new pedestrianized district, changed law or permit rule, expanded nighttime/weather operation, new robot generation, new cargo class, higher fleet density, or a shift from private property to public right-of-way.

## Integration Points

| Interface | Why it matters |
|---|---|
| Marketplace / ordering app | Source of delivery demand, customer eligibility, ETA, substitution/cancellation, tips/fees, support, and refund workflow. |
| Merchant POS or tablet | Order readiness, robot assignment, pickup authentication, temperature window, and missed-handoff handling. |
| Customer app / unlock | Identity, robot tracking, secure cargo access, no-show timer, delivery confirmation, and accessibility preferences. |
| Fleet manager | Dispatch, geofence, route choice, battery, charging, intervention queue, robot health, map version, and incident logging. |
| Remote assistance | Handles blocked paths, ambiguous crossings, construction detours, public interaction, and recovery while preserving clear authority boundaries. |
| City/campus permitting | Fleet caps, operating zones, speed rules, insurance, data/reporting, 311 integration, community complaints, and suspension/revocation risk. |
| Field operations | Robot placement, cleaning, battery charging, tire/wheel wear, sensor cleaning, cargo-bin sanitation, retrieval, and sidewalk obstruction response. |
| Map and sidewalk data | Curb ramps, crosswalks, grades, surface defects, closures, no-parking zones, stairs, bollards, transit stops, and robot-friendly drop-off points. |
| Support and incident systems | Customer support, merchant support, 311 tickets, police/fire escalation, insurance claims, and post-incident evidence preservation. |

The operational contract should be closed-loop: the platform can assign a delivery only when the fleet manager can prove that the robot, route, cargo, weather, permit zone, and customer handoff are valid.

## Safety And Regulatory Issues

- **Patchwork legal status**: U.S. personal delivery device rules are state and local. Virginia authorizes personal delivery devices on sidewalks and crosswalks, caps sidewalk/crosswalk speed at 10 mph, requires visible operator identification and braking, and requires at least $100,000 liability coverage. Florida allows sidewalk/crosswalk operation, requires yielding to pedestrians, active control or monitoring, unique identification, braking, and $100,000 liability coverage. Washington is stricter in key respects: its definition limits devices to under 120 lb excluding cargo and 6 mph, requires local-rule compliance, active monitoring, annual self-certification, lights for nighttime operation, and incident reporting within 48 hours for qualifying injury/property-damage events.
- **Municipal permits and fleet control**: cities can add permit layers even where state law allows operation. Los Angeles requires a Personal Delivery Device permit and can suspend, revoke, or reduce permitted fleet size for noncompliance. Santa Monica regulates PDDs through a local program and lists 5 mph operation, ADA compliance, business licensing, and device-size/weight constraints in its program materials.
- **Accessibility is a first-order safety requirement**: PROWAG requires a 48 inch minimum continuous clear width for pedestrian access routes, with wider passing spaces where routes are narrow. Robots must not park, dwell, queue, or fail in ways that block curb ramps, crosswalk entries, transit stops, doors, or required passing space.
- **Pedestrian interaction**: low speed does not eliminate harm. The robot must yield predictably, avoid following too closely, handle wheelchairs, service animals, canes, strollers, groups, children, runners, bikes on shared paths, and people who intentionally or accidentally interfere with the robot.
- **Crosswalk and curb-ramp risk**: crossing a road is the highest-consequence part of a sidewalk delivery mission. The robot needs conservative signal compliance, curb-ramp localization, occlusion handling, stuck-in-crosswalk recovery, and a policy for crosswalks blocked by parked vehicles or construction.
- **Remote assistance governance**: many laws and permits assume a person can monitor or control the device. Operations must define when remote staff can nudge, reroute, pause, or recover a robot, what network quality is required, and how every intervention is logged.
- **Sidewalk obstruction response**: a disabled robot is a public-right-of-way incident, not merely a failed delivery. Cities may expect fast 311/customer complaint response and physical retrieval, especially where the robot blocks ADA access.
- **Cargo restrictions**: hazardous materials, alcohol, medicine, age-restricted goods, high-value parcels, hot liquids, and temperature-sensitive food may require separate policy. Florida and Virginia explicitly restrict hazardous-material transport in their PDD statutes.
- **Privacy and data governance**: sidewalk robots collect imagery and telemetry in public spaces near homes, restaurants, campuses, and pedestrians. Operators need retention limits, access controls, redaction, public-records handling where data is shared with cities, and incident-forensics procedures.
- **Safety case standards gap**: there is no single sidewalk-delivery-robot safety standard that substitutes for a deployment safety case. UL 4600 is useful for autonomous-product safety arguments that include supporting services and infrastructure; ISO 13482 is relevant for service-robot physical human interaction and functional safety, but local PDD law and right-of-way accessibility still drive deployment approval.

## Economics And Scale Signals

- Serve Robotics announced in December 2025 that it had achieved its goal of deploying more than 2,000 delivery robots, described as the largest sidewalk delivery fleet in the United States. It also reported a twentyfold active-fleet increase in 2025, expansion across Los Angeles, Atlanta, Dallas-Fort Worth, Miami, Fort Lauderdale, Chicago, and Alexandria, and 110 high-density neighborhoods launched during the year.
- Serve's third-generation robot announcement states that the new platform halves manufacturing cost, moves roughly twice as fast, travels roughly twice as far per charge, spends six more hours in the field each day, carries more cargo, and adds Nvidia Jetson Orin, Ouster REV7 digital lidar, and sensor-suite upgrades.
- Starship Technologies and Uber announced a November 2025 partnership to roll out autonomous sidewalk delivery across multiple markets. Starship reported more than 9 million deliveries, 2,700+ robots, 270+ locations, and a plan to scale to 12,000+ robots by 2027.
- Starship states that its robots operate at Level 4 autonomy, usually with little human interaction, while human remote assistants remain on standby. Its operating claims include under-30-minute deliveries for distances up to 2 miles in the Uber Eats partnership and over 100,000 road crossings per day across its fleet.
- The business case is strongest where delivery density is high, sidewalks are continuous, trips are short, merchants can load quickly, customers accept curbside robot pickup, and one local operations team can support many robots. It weakens with poor curb ramps, dispersed restaurants, low order density, heavy rain/snow, vandalism, high remote-assistance rates, and strict fleet caps.

The operating KPI set should include deliveries per robot-day, delivery completion rate, intervention rate per mile/delivery, customer no-show rate, merchant loading delay, field retrieval rate, complaint rate, sidewalk blockage minutes, battery utilization, charge downtime, and municipal incident-reporting count.

## AV Stack Implications

- **Localization and mapping**: sidewalk robots need curb-ramp, crosswalk, sidewalk-edge, driveway, storefront, and pedestrian-path maps, not just road-centerline HD maps. Map freshness matters because a single construction barrier or outdoor dining setup can invalidate a route.
- **Perception**: near-field sensing dominates. The robot must detect legs, wheelchairs, canes, dogs, strollers, scooters, curb lips, potholes, puddles, trash bags, signs, patio furniture, gates, and low obstacles close to the chassis.
- **Prediction and social navigation**: the planner should model pedestrians as right-of-way users with uncertain intent. The robot should avoid cutting across groups, trapping wheelchair users, blocking desire lines, or inducing people to step into the street.
- **Crossing policy**: crosswalk execution needs signal interpretation, pedestrian phase timing, curb-ramp alignment, vehicle-yield verification, occlusion handling, and a conservative fallback when the robot cannot finish before the signal changes.
- **Fleet routing**: routing should optimize for accessible, wide, low-conflict sidewalks, not only distance. Wider, slower, or more reliable routes may beat shortest paths in real delivery time.
- **Runtime assurance**: independent speed limits, braking health, geofence enforcement, tilt/stuck detection, battery reserve, cargo-lock state, and remote stop should supervise the autonomy stack.
- **Remote-assistance interface**: the vehicle should expose concise scene state, route context, permit constraints, map uncertainty, and recovery options. Remote staff need tools to pause safely, request field retrieval, mark map defects, and explain behavior to customer/city support.
- **Data flywheel**: route failures, blocked sidewalks, intervention clusters, curb-ramp misses, customer handoff failures, and complaint locations are the highest-value training and operations backlog.

## Related Repo Docs

- `20-av-platform/sensors/close-range-proximity-safety-sensors.md`
- `30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md`
- `30-autonomy-stack/localization-mapping/maps/map-tile-versioning-distribution.md`
- `40-runtime-systems/monitoring-observability/teleoperation-systems.md`
- `40-runtime-systems/monitoring-observability/hmi-operator-interface.md`
- `50-cloud-fleet/fleet-management/fleet-management-dispatch.md`
- `50-cloud-fleet/data-governance/fleet-data-privacy-governance.md`
- `60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md`
- `60-safety-validation/safety-case/incident-reporting-post-market-monitoring.md`

## Sources

- [Serve Robotics: Builds 2,000 Autonomous Delivery Robots, Creating Largest Sidewalk Delivery Fleet in the U.S.](https://serverobotics.gcs-web.com/news-releases/news-release-details/serve-robotics-builds-2000-autonomous-delivery-robots-creating)
- [Serve Robotics: Rolls Out Third-Generation Autonomous Delivery Robot](https://serverobotics.gcs-web.com/news-releases/news-release-details/serve-robotics-rolls-out-third-generation-autonomous-delivery)
- [Starship Technologies and Uber Eats: Autonomous Delivery Partnership](https://www.starship.xyz/press/starship-technologies-and-uber-eats-launch-autonomous-delivery-partnership/)
- [Starship Technologies: Our Robots](https://www.starship.xyz/our-robots/)
- [Virginia Code Sec. 46.2-908.1:1, Personal Delivery Devices](https://law.lis.virginia.gov/vacode/title46.2/chapter8/section46.2-908.1%3A1/)
- [Florida Statutes Sec. 316.2071, Personal Delivery Devices and Mobile Carriers](https://www.leg.state.fl.us/STATUTES/index.cfm?App_mode=Display_Statute&Search_String=&URL=0300-0399%2F0316%2FSections%2F0316.2071.html)
- [Washington RCW Chapter 46.75, Personal Delivery Devices](https://app.leg.wa.gov/RCW/default.aspx?cite=46.75&full=true)
- [Los Angeles Municipal Code Sec. 71.30, Regulation of Personal Delivery Devices](https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-359662)
- [Los Angeles DOT: Personal Delivery Devices Rules and Guidelines](https://ladot.lacity.gov/docs/personal-delivery-devices-pdd-rules-and-guidelines)
- [City of Santa Monica: Personal Delivery Devices](https://www.santamonica.gov/programs/personal-delivery-devices)
- [U.S. Access Board: PROWAG R3 Technical Requirements](https://www.access-board.gov/prowag/technical.html)
- [ISO/FDIS 13482, Robotics - Safety Requirements for Service Robots](https://www.iso.org/standard/83498.html)
- [ANSI/UL 4600 Ed. 3-2023, Evaluation of Autonomous Products](https://webstore.ansi.org/standards/ul/ul4600ed2023)
