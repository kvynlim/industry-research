# Kalmar Port Automation Tech Stack

**Last updated:** 2026-05-09

## Why It Matters

Kalmar is an incumbent port and terminal automation supplier, so its stack is useful as a mature reference for large-site equipment orchestration. The relevant takeaway is Kalmar One's shift toward a standalone, OEM- and equipment-agnostic automation layer that can sit between terminal systems and automated equipment.

For airside transfer, Kalmar is a systems-pattern reference: one control layer, equipment abstraction, dispatch/routing, digital twin validation, cybersecurity process, and support for mixed fleets.

## Deployment Evidence

**Verified operator evidence:**

- No operator-authored Kalmar One performance case study was used in this page. Kalmar does name operating terminal references, but the cited evidence is Kalmar-authored.

**Vendor product and deployment evidence:**

- In May 2025, Kalmar announced Kalmar One as a standalone automation solution for automated operations, positioned as OEM- and equipment-type agnostic.
- Kalmar says Kalmar One can provide one user interface for the whole terminal rather than separate equipment-vendor subsystems.
- Kalmar's July 2025 standalone article says Kalmar One has been available for several years as part of terminal automation deliveries and is now offered as standalone software.
- Kalmar cites use at major automated terminals, including APM Terminals Pier 400 in Los Angeles, where Kalmar One manages nearly 140 Kalmar AutoStrads with scheduling, dispatching, and routing.

**Vendor claims to separate from operator evidence:**

- Kalmar claims Kalmar One can interface with automated equipment from any OEM and can support automated stacking cranes, automated RTGs, automated terminal tractors, automated straddle carriers, AGVs, and RMGs.
- Kalmar states that Kalmar One supports Terminal Operating System integration through open APIs and can manage charging for battery-powered equipment.
- Kalmar says its automation software development process has IEC 62443-4-1 certification for industrial automation cybersecurity.

## Technical/Operational Pattern

Kalmar One is the orchestration layer. It connects the Terminal Operating System, automated equipment, and other systems, then handles scheduling, dispatching, routing, flow optimization, fleet visibility, and equipment coordination.

The notable architecture choice is equipment abstraction. Kalmar is positioning Kalmar One as the common platform even when terminals use different equipment types or OEMs. That matters for ports and airports because large operators often have mixed fleets and long replacement cycles.

Kalmar also emphasizes digital twin emulation: using the actual automation software before hardware deployment to validate layouts, fleet sizing, equipment choices, and operating scenarios. This is a practical de-risking pattern for constrained, safety-critical sites.

## Airside Transfer

Kalmar One maps most directly to airport-wide autonomy orchestration rather than a single autonomous GSE vehicle. The transferable pattern is a common control layer that can dispatch, route, monitor, and optimize mixed automated equipment while integrating with operational systems.

Airport analogs include baggage tractor fleets, cargo dollies, autonomous tugs, service-road vehicles, and fixed automation in bag halls or cargo terminals. A Kalmar-like approach would need adapters to AODB/BHS/cargo/WMS systems, airside permit rules, stand/gate constraints, charging, and remote operations.

Kalmar AutoTT is also relevant because it pairs Kalmar One fleet management with a factory-built autonomous terminal tractor program using Forterra AutoDrive and a safety-rated drive-by-wire platform. Kalmar says live customer pilots are underway and commercial availability starts with Kalmar Ottawa T2 AutoTT in 2027.

## Caveats

- Kalmar One is port/container-terminal software; airport operating systems and regulatory processes differ.
- The public sources describe capabilities and selected terminal references, but they do not provide full operator-authored performance data, incident data, or cost benchmarks.
- AutoTT is not yet broadly commercial: Kalmar describes live pilots and 2027 commercial availability.
- Equipment-agnostic claims still require practical interface work, site acceptance testing, operational procedures, and cybersecurity approval for each deployment.

## Related Repository Docs

- [Fernride tech stack](../fernride/tech-stack.md)
- [TractEasy production deployment](../tracteasy/production-deployment.md)
- [Changi autonomous GSE programme](../changi-programme/autonomous-gse-programme.md)
- [Regulatory trajectory deep dive](../../regulations/regulatory-trajectory-deep-dive.md)

## Sources

- [Kalmar - Kalmar One as a Standalone Automation Solution](https://www.kalmarglobal.com/news--insights/press_releases/2025/kalmar-introduces-kalmar-one-as-a/)
- [Kalmar - Kalmar One Standalone Software Article](https://www.kalmar.nl/news--insights/articles/2025/kalmar-one-now-available-as-standalone-software-solution/)
- [Kalmar - Kalmar One Automation System](https://www.kalmarglobal.com/automation/kalmar-one-automation-system/)
- [Kalmar - AutoTT](https://www.kalmarglobal.com/equipment/terminal-tractors/autott/)
