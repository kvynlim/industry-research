# Locus Robotics Production Deployment

**Last updated:** 2026-05-09

## Why It Matters

Locus Robotics is one of the clearest public examples of warehouse AMRs operating at large scale inside a major logistics network. DHL's published evidence is useful because it gives a concrete deployment milestone, site count, and operating pattern for human-robot collaboration.

For airside analysis, Locus is not evidence for autonomous tractors on the ramp. It is evidence that high-volume logistics operators can integrate mobile robots into live fulfillment workflows, fleet software, and labor models without rebuilding the whole facility around fixed guide paths.

## Deployment Evidence

**Verified operator/partner evidence:**

- DHL Supply Chain and Locus announced that DHL passed 500 million picks using LocusBot AMRs. DHL identified the 500 millionth pick as occurring on May 18, 2024 at DHL's Toledo, Spain facility.
- DHL reported LocusBot fleets deployed at more than 35 DHL-managed sites worldwide.
- DHL's AMR overview describes Locus AMRs as part of a broader warehouse AMR program, with robots using AI, machine learning, and enhanced sensors to learn warehouse environments and navigate around obstacles.
- DHL's robotic picking article says DHL has partnered with Locus Robotics since 2017 and scaled the relationship into thousands of Locus AMRs across its global warehouse network.

**Vendor/operator performance claims:**

- DHL's published materials attribute up to 180% per-hour picking improvement and an 80% training-time decrease to robotic assisted picking deployments.
- DHL says its Robotics Hub integrates AMRs into existing warehouse management or control systems.
- Locus and DHL describe the system as collaborative: humans pick and handle judgment-heavy work while AMRs reduce walking and material movement.

## Technical/Operational Pattern

The operating pattern is assisted picking. Robots move through warehouse aisles, present work to human pickers, carry picked goods, and route themselves to the next task. This reduces human walking distance and makes peak-capacity scaling easier than recruiting and training equivalent temporary labor.

The key architecture is a fleet of AMRs connected through centralized software, integrated with warehouse systems. Unlike AGVs, the public DHL material emphasizes that AMRs do not require fixed tracks or marked pathways.

## Airside Transfer

The strongest airport transfer is inside facilities: baggage halls, cargo warehouses, stores, spares logistics, and e-commerce/retail operations connected to airport campuses. A Locus-like AMR pattern could move small loads between induction, sortation, staging, and packing points while humans handle irregular items and exception decisions.

The direct ramp transfer is weak. Locus AMRs are warehouse robots, not outdoor GSE, tow tractors, or autonomous vehicles certified for mixed aircraft operations. The transferable layer is fleet orchestration, human-robot task allocation, and WMS/control-system integration.

## Caveats

- Pick count is an activity metric, not a safety case, uptime report, or autonomy disengagement metric.
- Public evidence is aggregated across DHL sites; it does not disclose site-by-site fleet size, failure modes, incident rates, or maintenance burden.
- DHL and Locus are both parties to the partnership, so performance claims should be treated as operator/vendor claims rather than independent audit results.
- The AMR ODD is mainly indoor warehouse/distribution-center work, with different payload, weather, and traffic risks than airside GSE.

## Related Repository Docs

- [AeroVect tech stack](../aerovect/tech-stack.md)
- [Moonware HALO operations](../moonware/halo-operations.md)
- [Changi autonomous GSE programme](../changi-programme/autonomous-gse-programme.md)
- [Competitive landscape](../../market-competitive/competitive-landscape.md)

## Sources

- [DHL Group - 500 Million Picks Milestone Using Locus Robotics AMRs](https://group.dhl.com/en/media-relations/press-releases/2024/dhl-supply-chain-passes-unprecedented-500-million-picks-milestone-using-locus-robotics-autonomous-mobile-robots.html)
- [DHL Delivered - Autonomous Mobile Robots in Action](https://www.dhl.com/global-en/delivered/innovation/autonomous-mobile-robots-in-action.html)
- [DHL Delivered - Robotic Assisted Picking](https://www.dhl.com/global-en/delivered/digitalization/locus-robotics-robotic-picking.html)
