# Airside Autonomous Vehicle Competitive Landscape

## Head-to-Head Comparison of All Players

---

## 1. Market Position Matrix

| Company | Vehicles Deployed | Airports | Revenue | Funding | Autonomy Level | Safety Operator? |
|---------|------------------|----------|---------|---------|---------------|-----------------|
| **UISEE** | 1,000+ | 21+ | 101% CAGR | ~$262M, ~$1B val | L4 | No (Changi Jan 2026) |
| **TractEasy (EasyMile)** | ~20 | 8 | Undisclosed | JV (TLD+EasyMile) | L4 | No (Changi, Narita) |
| **Aurrigo** | ~10 trial | 9 | £8M total (£2.5M auto) | £14.1M (Sep 2025) | L4 trial | **Yes (all sites)** |
| **AeroVect** | ~5 trial | 2-3 (SFO, ATL) | Pre-revenue | $27.1M | L4 trial | Yes |
| **Fernride** | 100+ (logistics) | 0 (airport planned) | TaaS model | EUR 75M+ | L4 teleop-first | Remote operator |
| **Moonware** | 0 (software only) | 4 (JFK, LAX, Haneda, MEX) | SaaS | $9.5M | N/A (orchestration) | N/A |
| **Assaia** | 0 (software only) | 21 | SaaS | $36M | N/A (monitoring) | N/A |

## 2. Technology Comparison

| Capability | UISEE | TractEasy | Aurrigo | AeroVect | Fernride |
|-----------|-------|-----------|---------|----------|----------|
| **Perception** | 4-8 LiDAR + 6-7 cameras | Multi-LiDAR + cameras + radar | 4-8 LiDAR + 360° cameras | LiDAR + cameras + radar | LiDAR + cameras + radar |
| **ML/AI in perception** | Yes (deep learning) | Unknown (likely classical) | **No (RANSAC only)** | Yes (likely) | Yes |
| **Localization** | RTK + LiDAR SLAM | Centimeter-level (1-5cm) | GTSAM GPU VGICP + RTK | RTK (Point One Navigation) | Undisclosed |
| **Planning** | Proprietary | Waypoint-following | Frenet trajectory gen | HD map following | Progressive autonomy |
| **World model** | **No** | **No** | **No** | **No** | **No** |
| **V2X** | Yes | Yes | Limited | Unknown | Yes (uRLLC) |
| **Fleet management** | Cloud (K8s + MQTT) | EZFleet | Auto-Connect | Proprietary | Fleet management suite |
| **Safety certification** | ISO 26262, TR68, ISO 27001 | CE, ISO 13849-1, ISO 3691-4 | ISO 3691-4 (partial) | Building safety cases | TUV SUD certified |
| **Remote operation** | Cloud-based monitoring | EZFleet supervision | Teleoperation capable | Unknown | **Core competency (<100ms)** |
| **Compute platform** | Automotive-grade (unknown) | Dual-computer safety PLC | RoboSense + NVIDIA GPU | NVIDIA-based (TensorRT) | Linux + QNX dual |

## 3. Deployment Model Comparison

| Aspect | UISEE | TractEasy | Aurrigo | AeroVect | Fernride |
|--------|-------|-----------|---------|----------|----------|
| **Vehicle approach** | Purpose-built + retrofit | Purpose-built (EZTow) | Purpose-built (Auto-DollyTug) | **Retrofit existing GSE** | Retrofit (Terberg tractors) |
| **Business model** | Vehicle + service | Vehicle sales + service | Vehicle sales + trials | **Automation-as-a-Service** | Transportation-as-a-Service |
| **Time to deploy new airport** | Weeks (claimed) | 6-24 months | 6-24 months | <2 hours (mapping) | Weeks (teleoperation) |
| **Geographic focus** | China + expanding global | Europe + global | UK + Europe + US | US | Europe + expanding |
| **Scaling strategy** | Volume manufacturing | Airport-by-airport | Partnership (Swissport 285 airports) | Retrofit existing fleets | Series production (Terberg) |

## 4. Software Platform Comparison

| Aspect | Moonware HALO | Assaia ApronAI | Autonoma AutoVerse |
|--------|--------------|----------------|-------------------|
| **Primary function** | GSE/crew dispatch orchestration | Turnaround monitoring/prediction | Digital twin simulation |
| **Data input** | GPS trackers, smartphones, flight data | **Existing CCTV cameras** | Sensor data, airport models |
| **AI/ML** | Constraint-based optimizer | Computer vision (CV + ML prediction) | Scenario simulation |
| **Key metric** | 20% delay reduction (unverified) | **25% delay reduction (validated, 450K+ turns)** | Validation-first |
| **Scale** | 4 airports | **21 airports** | Delta, US military |
| **Revenue model** | SaaS | SaaS | SaaS/license |
| **Funding** | $9.5M | **$36M** | Undisclosed |
| **Relevance to AV** | Dispatch layer for autonomous GSE | Data source for prediction training | Testing environment |

## 5. Competitive Advantages — Where World Models Win

No competitor uses world models, learned perception, or VLAs. This represents a generational technology gap:

| Current Competitor Capability | World Model Advantage | Impact |
|------------------------------|----------------------|--------|
| Classical perception (RANSAC, rules-based) | Learned perception (CenterPoint, open-vocab) | Detect 10+ object types vs 3 |
| No prediction | 4D occupancy prediction (2-4s ahead) | Anticipate conflicts, not just react |
| Per-airport HD maps | Online mapping (MapTRv2) + world model | Deploy to new airports without re-mapping |
| No explainability | VLA reasoning traces | Regulatory compliance, debugging |
| Fixed safety rules | Learned safety (SafeDreamer) + RSS | Adaptive safety margins |
| Manual scenario testing | World model imagination + 3DGS digital twin | 10,000x more test scenarios |
| No weather adaptation | 4D radar + learned robustness | Operate in rain, fog, de-icing |
| No fleet intelligence | Shared world model + A-CDM integration | Just-in-time GSE dispatch |

## 6. Risk Assessment

| Company | Key Risk | Likelihood | Mitigation |
|---------|----------|-----------|------------|
| **UISEE** | Geopolitical (Chinese company at Western airports) | Medium | Hong Kong HQ, partnerships |
| **UISEE** | Technology lead maintained through scale | High | First-mover, but classical tech |
| **TractEasy** | EasyMile financial health | Medium | TLD partnership provides stability |
| **Aurrigo** | Loss-making, slow certification | High | Swissport 285-airport pipeline |
| **AeroVect** | Small team, unproven at scale | High | Retrofit model reduces capital risk |
| **Fernride** | Defense pivot may dilute airport focus | Medium | Quantum Systems acquisition |
| **Moonware** | Unverified claims, small funding | High | First to deploy loses |
| **Assaia** | Camera-only limits to monitoring, not control | Low | Complementary to AV, not competitive |

## 7. Strategic Positioning for World-Model-Based Airside AV

```
                    TECHNOLOGY SOPHISTICATION →
                    Low                              High
              ┌─────────────────────────────────────────────┐
    High      │                    │                         │
              │   UISEE            │                         │
              │   (scale leader)   │    [YOUR POSITION]      │
    MARKET    │                    │    World model +         │
    PRESENCE  │   TractEasy        │    learned perception    │
              │   (safety leader)  │    + VLA reasoning       │
              │                    │                         │
    ↓         │   Aurrigo          │                         │
              │   (partnership)    │                         │
    Low       │                    │    AeroVect             │
              │   Fernride         │    (retrofit + ML)      │
              │   (teleop)         │                         │
              └─────────────────────────────────────────────┘

Quadrant analysis:
  Top-left: Scale with classical tech (UISEE, TractEasy)
  Top-right: OPEN — nobody occupies this position yet
  Bottom-left: Emerging players (Fernride, teleop-first)
  Bottom-right: ML-aware but small (AeroVect)

The top-right quadrant (high technology + high market presence) is VACANT.
This is the target position for a world-model-powered airside AV.
```

## 8. Competitive Timeline

```
2024  UISEE: 1000+ vehicles, 21 airports
      TractEasy: 8 airports, L4 at Toulouse
      Aurrigo: Trials at 9 airports (all with safety operators)
      AeroVect: SFO, ATL trials

2025  UISEE: HKEX IPO filing, Seyond LiDAR partnership
      TractEasy: Narita L4 launch (Dec), DWC Dubai scaling
      Aurrigo: Swissport Phase 1 (Zurich sim), £14.1M raise
      Fernride: Quantum Systems acquisition, EUR 75M+ total

2026  UISEE: Changi fully driverless (Jan), 24 vehicles by 2027
      TractEasy: Changi + Narita operational
      Aurrigo: NUIC safety-operator-removal study with IAG
      AeroVect: Explorer mapping half of top 10 US airports
      [YOU]: POCs demonstrating world model advantage

2027  UISEE: 24 vehicles at Changi, international expansion
      TractEasy: DWC L4, potential Europe expansion
      Aurrigo: First unattended operations? (if NUIC succeeds)
      [YOU]: Shadow mode at first airport, world model validated

2028+ Regulatory frameworks solidifying (FAA AC, EASA AMC)
      [YOU]: Production deployment with world model advantage
```

---

*Sources: All data from company-specific research documents in `companies/` directory and operations reports.*

## Related Documents

| Document | Relevance |
|----------|-----------|
| `synthesis/poc-proposals.md` | What to build to capture the technology advantage |
| `synthesis/technology-readiness.md` | How ready each POC is for execution |
| `synthesis/risk-register.md` | Risks to execution including competitive risks (R13) |
| `companies/uisee/tech-stack.md` | Deep dive on the market leader (1,000+ vehicles) |
| `companies/tracteasy/production-deployment.md` | Deep dive on the safety leader (zero accidents) |
| `companies/aurrigo/tech-stack.md` | Your current stack — technology gaps identified |
| `70-operations-domains/airside/operations/aviation-ground-ops-ecosystem.md` | Full market context and business case |
