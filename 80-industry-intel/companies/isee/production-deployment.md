# ISEE Production Deployment

**Last updated:** 2026-05-09

## Why It Matters

ISEE is relevant because autonomous yard trucks sit close to autonomous airside GSE in the operating stack: repetitive moves, mixed traffic, staging areas, trailer/container handling, remote operational oversight, and a safety-critical private-site ODD. Its public materials also show the industry moving from prototype autonomy toward production yard workflows.

The strongest signal is the claimed move from pilots to revenue-generating, full-facility yard deployment. The weakest signal is customer transparency: the cited deployments are not publicly named by the operator.

## Deployment Evidence

**Verified operator evidence:**

- No named operator-authored confirmation was found in the requested public sources. The customer sites are described as Fortune 100 locations, but the operators are not identified.

**Vendor deployment evidence from ISEE:**

- In February 2024, ISEE announced a commercial fleet deployment of autonomous yard trucks at an unnamed Fortune 100 customer site in Texas.
- ISEE described the site as a 1.7 million square foot distribution center with 750 trailer staging bays, operating across shifts, day and night, and in rain or shine conditions.
- ISEE framed the deployment as a transition from pilot/testing to commercialization and said it was recognizing revenue from the customer.

**Vendor/partner claims from 2025 TICO partnership:**

- In April 2025, ISEE and TICO announced a strategic partnership for an OEM-integrated autonomous yard truck that was live at a Fortune 100 logistics service provider hub and handling production moves.
- ISEE claimed fully driverless operations in mixed-traffic yards, multiple autonomous trucks at active customer sites, and hundreds of thousands of autonomous trailer moves.
- The companies said ISEE's autonomy kit components include sensors, computers, and drive-by-wire integration on TICO terminal tractors, with factory and site acceptance testing for each autonomous unit.
- The partnership includes diesel, CNG, and electric platform options, plus a retrofit program for existing TICO fleets.

## Technical/Operational Pattern

ISEE's public pattern is autonomous trailer/container movement within logistics yards. The company emphasizes AI, machine learning, and computer vision for dynamic industrial environments, plus the engineering work needed to integrate autonomy hardware into yard tractor platforms.

A related ISEE 2024 announcement describes AI-powered trailer auto-coupling using a six-axis robotic arm to connect trailer air lines without trailer modifications, adapters, markers, or remote control. That matters because yard autonomy depends on automating the non-driving steps, not only path planning.

## Airside Transfer

ISEE's yard autonomy is a strong analog for airport service roads, baggage/cargo staging zones, and remote stands where vehicles repeatedly move between fixed points in mixed traffic. The lessons are operational: define the ODD, automate the coupling/handoff steps, integrate with dispatch systems, and validate in live operations before scaling.

The transfer is not one-to-one. Airport tractors tow baggage carts, dollies, ULD transporters, and other GSE rather than highway trailers. Airside systems also need aircraft stand rules, FOD controls, radio/ATC-adjacent procedures, and airport authority approval.

## Caveats

- No named customer confirmation was found in the cited public materials; the main deployment evidence is ISEE-authored Business Wire content.
- Claims such as "first," "most experienced," and "hundreds of thousands" are vendor claims and are not independently audited in the public sources reviewed.
- Public sources do not disclose fleet size by site, remote intervention rate, uptime, incident history, or detailed safety case evidence.
- Distribution yards are not airport ramps; transfer requires aviation-specific integration and certification work.

## Related Repository Docs

- [Fernride tech stack](../fernride/tech-stack.md)
- [TractEasy production deployment](../tracteasy/production-deployment.md)
- [AeroVect tech stack](../aerovect/tech-stack.md)
- [Regulatory trajectory deep dive](../../regulations/regulatory-trajectory-deep-dive.md)

## Sources

- [ISEE - Commercially Deploys World's First Fully Autonomous Truck Yard](https://www.isee.ai/news/business-wire-isee-commercially-deploys-worlds-first-fully-autonomous-truck-yard)
- [ISEE - ISEE and TICO Strategic Partnership](https://www.isee.ai/news/business-wire-isee-and-tico-announce-strategic-partnership-to-deliver-industry-first-fully-integrated-autonomous-yard-trucks-to-customer-operations)
- [ISEE - AI-Powered Trailer Auto-Coupling System](https://www.isee.ai/news/business-wire-isee-unveils-ai-powered-trailer-auto-coupling-system)
