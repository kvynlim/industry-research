# 2024-2026 Autonomy Deployment Index

**Last updated:** 2026-05-09

## Why It Matters

Autonomy maturity is easiest to misread when every domain is described with the same words: "pilot", "commercial", "driverless", "L4", or "deployed". A warehouse AMR fleet, a mine haulage system, an airside baggage tractor, and a sidewalk delivery robot all prove different things. The practical question is not whether autonomy exists. It is what operational envelope has been proven, who accepted the residual risk, and what evidence can be reused for the next regulated deployment.

Use this page as a compact index for 2024-2026 deployment signals that are useful for airside, yard, warehouse, mining, sidewalk delivery, and road ADS strategy.

## Evidence/Map

| Deployment signal | What is proven | Regulatory or acceptance gate | Practical takeaway |
|---|---|---|---|
| Changi Airport / UISEE autonomous baggage tractors | Two autonomous tractors entered live airside baggage transfer between Terminal 1 and Terminal 4 after nearly a year of trials and more than 5,000 trial runs, according to UISEE. | CAAS-style airside AV acceptance: aerodrome operator evaluation, staged trials, trained safety/remote operators, data recording, reporting, contingency plans, and safety performance monitoring. | Best public airside comparator for limited-route autonomous GSE. Treat it as proof of controlled-route operations, not proof of general apron autonomy. |
| DHL Supply Chain / Locus Robotics AMRs | DHL reported a 500 million picks milestone in May 2024 using LocusBots across 35 global sites. | Warehouse AMR acceptance is closer to ISO 3691-4 and ANSI/A3 R15.08-2 system/application safety than to road vehicle approval. | Strong evidence for multi-site fleet scaling, workforce integration, and warehouse traffic management. Weak evidence for mixed aircraft/vehicle right-of-way risk. |
| Komatsu FrontRunner autonomous haulage | Komatsu reported 700+ autonomous haul trucks in February 2024 across 23 mine sites in five countries, and later reported 750+ commissioned trucks and more than 10 billion metric tons hauled. | Mine-site operating rules, segregated or highly managed ODDs, and heavy-equipment safety management. | Strongest industrial proof point for high-utilization heavy autonomy. Transfer the fleet supervision and ODD discipline, not the mine-only traffic assumptions. |
| Serve Robotics sidewalk delivery | Serve reported Q1 2025 service coverage for more than 320,000 households; NVIDIA describes Serve's goal of scaling toward 2,000 robots by the end of 2025. | Local sidewalk robot permissions, city rules, pedestrian safety expectations, teleoperation/remote assistance, and incident handling. | Useful comparator for low-speed public-space operations. Regulatory risk is local and reputational as much as technical. |

### Readiness Lens

| Readiness band | Meaning | Examples from this index | Reuse value |
|---|---|---|---|
| R1: supervised trial | Real vehicle, constrained route, safety driver/operator ready to intervene. | Pre-launch Changi/UISEE trials. | Good for scenario discovery and training evidence. |
| R2: limited live operation | Driverless or near-driverless operation on a narrow route or defined service area. | Changi/UISEE T1-T4 baggage route; Serve limited neighborhoods. | Good for ODD governance, incident playbooks, fleet monitoring, and stakeholder coordination. |
| R3: multi-site production | Repeated deployments with repeatable installation and operations playbooks. | DHL/Locus across 35 sites. | Good for rollout economics and change management. |
| R4: mature industrial scale | Large fleets with long operating history and quantified production throughput. | Komatsu FrontRunner AHS. | Good for fleet reliability, maintenance, remote operations, and safety management discipline. |

## Practical Use

Use deployment evidence as domain-specific proof, not as generic "autonomy is solved" proof.

For airside autonomous GSE, Changi/UISEE is the closest operational reference. Pair it with CAAS AC 139-7-7 because the acceptance evidence is specific: route definition, onboard or remote operator competence, contingency plans, data recording, monthly safety indicators, and stop/restart rules after incidents.

For warehouse or logistics-yard autonomy, DHL/Locus and ISO/ANSI mobile robot standards are more relevant than road ADS rules. The key artifacts are site risk assessment, fleet traffic rules, worker interaction controls, protective stops, and system/application validation.

For mining and construction, Komatsu is the maturity benchmark. Its value is not that airports are like mines; it is that high-value heavy autonomy can be managed when the ODD, dispatch system, maintenance system, and operational controls are engineered together.

For sidewalk delivery and public-road pilots, Serve is a reminder that public acceptance, city permissions, vulnerable road user interactions, and incident transparency can dominate the technical story.

## Failure Modes or Caveats

- Deployment counts are not safety rates. A fleet milestone needs exposure data, incident definitions, and reporting rules before it can support a safety comparison.
- "Driverless" can still include remote monitoring, remote assistance, geofenced ODDs, staged rollout limits, and manual recovery.
- Warehouse and mine autonomy are strong evidence for fleet operations, but they underrepresent aircraft priority, jet blast, FOD, apron congestion, and airside stakeholder coordination.
- Sidewalk robot evidence is useful for low-speed interaction design, but city-level permissions and public tolerance can change quickly.
- Vendor press releases are useful deployment markers but should be backed by airport/operator statements, regulator records, or audited operating data before procurement decisions.

## Related Repository Docs

- [Airside AGVS FAA/CAAS Regulatory Map](../regulations/airside-agvs-faa-caas-regulatory-map.md)
- [Cross-Domain Autonomy Regulatory Map](../regulations/cross-domain-autonomy-regulatory-map.md)
- [Changi Autonomous GSE Programme](../companies/changi-programme/autonomous-gse-programme.md)
- [ISO 3691-4 Deep Dive](../../60-safety-validation/standards-certification/iso-3691-4-deep-dive.md)
- [AMR and Autonomous Forklift Operations](../../70-operations-domains/warehouse/operations/amr-autonomous-forklift-operations.md)
- [Autonomous Haulage Operations](../../70-operations-domains/mining/operations/autonomous-haulage-operations.md)
- [Sidewalk Delivery Robot Operations](../../70-operations-domains/delivery-robots/operations/sidewalk-delivery-robot-operations.md)

## Sources

- UISEE, [Singapore Changi Airport Partners with UISEE Launch First Fully Autonomous Tractor Fleet](https://www.uisee.com/en/article226-news2.html)
- DHL Group, [DHL Supply Chain Passes 500 Million Picks Milestone Using Locus Robotics AMRs](https://group.dhl.com/en/media-relations/press-releases/2024/dhl-supply-chain-passes-unprecedented-500-million-picks-milestone-using-locus-robotics-autonomous-mobile-robots.html)
- Komatsu, [700+ Autonomous Trucks Operating Worldwide with Komatsu FrontRunner System](https://www.komatsu.jp/en/newsroom/2024/20240314)
- Komatsu, [Komatsu Achieves Major Autonomous Milestones](https://www.komatsu.com/en/newsroom/2024/komatsu-achieves-major-autonomous-milestones)
- Serve Robotics, [First Quarter 2025 Results](https://ir.serverobotics.com/news-releases/news-release-details/serve-robotics-announces-first-quarter-2025-results)
- NVIDIA, [Serve Robotics Autonomous Sidewalk Delivery](https://www.nvidia.com/en-us/customer-stories/serve-robotics/)
- CAAS, [AC 139-7-7 Rev 1: Guidance on the Use of Autonomous Vehicles at the Airside](https://www.caas.gov.sg/docs/default-source/docs---srg/ac-139-7-7%281%29-guidance-on-use-of-autonomous-vehicles-at-the-airside%28rev1%29--final.pdf)
- ISO, [ISO 3691-4:2023 Driverless Industrial Trucks and Their Systems](https://www.iso.org/standard/83545.html)
- ANSI, [ANSI/A3 R15.08-2-2023 Industrial Mobile Robots - Safety Requirements](https://webstore.ansi.org/standards/ria/ansia3r15082023)
