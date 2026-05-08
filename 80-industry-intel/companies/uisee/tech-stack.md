# UISEE (驭势科技) — Deep Research Report

> Last updated: 2026-03-22

---

## 1. Company Overview

UISEE (驭势科技, full name: Uisee Technology (Beijing) Ltd.) is a Chinese autonomous driving company founded in **February 2016** in Beijing. The company positions itself as a "full-stack driverless solution provider" and "AI Driver for the World," developing L3-L4 autonomous driving systems for airports, factories, logistics hubs, and urban mobility.

As of December 2025, UISEE has accumulated **7.5 million kilometers** of real driverless autonomous driving mileage (5.6M+ accident-free) and operates a fleet of **1,000+ autonomous vehicles** across **21+ airports** globally. The company claims to be "the world's only provider of sustainable, large-scale commercial L4 autonomous driving solutions for airports."

**Key stats:**
- **Founded:** February 2016, Beijing
- **Employees:** ~80% R&D personnel; 50%+ hold Ph.D. or master's degrees
- **Patents:** 700+ (domestic and international)
- **Revenue:** 65M yuan (2022) → 265M yuan (2024), 101.3% CAGR
- **Valuation:** ~RMB 7.3 billion (~$1.01B USD) as of May 2025
- **Total funding:** ~$262M across multiple rounds

---

## 2. Founding Team & Leadership

### Wu Gansha (吴甘沙) — Co-founder, Chairman & CEO

Wu Gansha was **Managing Director of Intel Labs China** and an Intel Principal Engineer before founding UISEE. He joined Intel in 2000 and held positions across the Programming Systems Lab and Embedded Software Lab, leading research in managed runtime, XScale micro-architecture, many-core architecture, data parallel programming, and embedded device driver tools. At Intel Labs China, he led Intel's corporate Technology Strategic Long Range Planning on Big Data and focused the China Labs on three directions: **5G communications, smart computing, and robotics**. During his Intel tenure, he published 10+ research papers and held **28 issued US patents** with 14 pending.

### Co-founders

| Name | Background |
|------|-----------|
| **Zhao Yong (赵勇)** | Previously worked at labs of Nvidia, HP, and Google (including Google Glass). Founded DeepGlint (a computer vision startup backed by Sequoia Capital China, Samsung, Hyundai) |
| **Mei Yanchuan** | Technical co-founder |
| **Peng Progress** | Technical co-founder |
| **Zhou Xin** | Executive Director |
| **Jiang Yan** | Co-founder |

### Board of Directors (as of 2025)
- **Executive Directors:** Gansha Wu (Chairman/CEO), Xin Zhou, Bob Chiang
- **Non-Executive Directors:** Jun Wu, Xiaohu Gao, Jun Zhou
- **Independent Directors:** Zide Du, Mingsheng Zhou

---

## 3. Funding & Investors

### Funding Timeline

| Round | Date | Amount | Lead Investor(s) | Key Participants |
|-------|------|--------|-------------------|------------------|
| **Seed/Angel** | 2016 | Undisclosed | ZhenFund, Sinovation Ventures (Kai-Fu Lee) | CAS Star, Cyanhill Capital |
| **Series B** | Feb 2020 | Undisclosed | Robert Bosch Venture Capital | Shenzhen Capital Group, CICC Capital |
| **Series C** | Jan 2021 | ~$154M (RMB 1B+) | National Manufacturing Transformation & Upgrade Fund (state-backed, $21B fund) | Multiple investors |
| **Series C extension** | Mar 2023 | Undisclosed | Zhongke Holdings | Dongfeng Asset Management, Chongqing Gaoke Group |

**Total raised:** ~$262M from 28 investors (per PitchBook)

### Notable Investors
- **Robert Bosch Venture Capital** — Led Series B (strategic investor, automotive technology synergy)
- **National Manufacturing Transformation & Upgrade Fund** — State-backed fund established May 2020 under China's industrial upgrading initiative
- **Dongfeng Asset Management** — Arm of Dongfeng Motor Group (RoboTaxi partner)
- **CICC Capital** — Investment arm of China International Capital Corporation
- **Sinovation Ventures** — Kai-Fu Lee's AI-focused VC (early investor)
- **ZhenFund** — Prominent Chinese angel fund (early investor)
- **Hongtai Capital Holdings**
- **Shenzhen Qianhai Hongzhao Fund Management**
- **Citic Securities Investment**

### IPO Plans

UISEE filed a **preliminary prospectus with the Hong Kong Stock Exchange** on May 28, 2025 under **Chapter 18C** regulations (specialist technology companies listing framework). Chapter 18C allows listing of companies engaged in R&D and commercialization of specialist technologies including autonomous driving. A Hong Kong dual-listing has been publicly discussed by leadership.

### Financial Performance
- **Revenue:** 65M yuan (2022) → 265M yuan (2024) — 101.3% CAGR
- **Adjusted net losses:** Narrowing from 227M yuan (2022) to 161M yuan (2024)

---

## 4. U-Drive System Architecture

UISEE's core technology platform is the **U-Drive®** intelligent driving system, now in its **fifth generation**. It is described as an "automotive-grade" platform "ready for mass commercialization" that enables scalable L3-L4 autonomous driving across multiple vehicle types and scenarios.

### Three Core Modules

```
┌─────────────────────────────────────────────────────┐
│                   U-Drive® Platform                 │
├─────────────────┬─────────────────┬─────────────────┤
│   Intelligent   │   AI Algorithm  │   Cloud-based   │
│    Driving      │     Engine      │   Intelligent   │
│   Controller    │                 │      Brain      │
├─────────────────┼─────────────────┼─────────────────┤
│ - Automotive-   │ - Perception    │ - Remote        │
│   grade ECU     │ - Localization  │   monitoring    │
│ - Sensor fusion │ - Planning      │ - Fleet mgmt   │
│ - Real-time     │ - Control       │ - Data platform │
│   processing    │ - Deep learning │ - OTA updates   │
│ - Redundancy    │                 │ - Big data      │
│   mechanisms    │                 │   analytics     │
└─────────────────┴─────────────────┴─────────────────┘
```

### Key Design Principles
1. **Cross-scenario platform:** Single technology platform deployable across airports, factories, ports, urban mobility, and passenger vehicles
2. **Full-stack self-developed:** Complete IP ownership across algorithms, controllers, and cloud platform
3. **"Full-scenario, True Driverless, All-weather"** — The company's defining capability claim
4. **Continuous learning:** Cloud-based big data platform enables continuous OTA upgrades

---

## 5. Sensor Suite

UISEE uses a multi-sensor fusion approach combining LiDAR, cameras, GNSS/RTK, and inertial navigation.

### LiDAR Partners & Models

**Hesai Technology (Strategic Partner)**
- **Hesai XT** — Primary LiDAR for T05 series logistics vehicles and K10 unmanned light trucks
  - Ranging accuracy: 1-sigma of **5 mm**
  - Maximum range: **120 m**
  - Zero blind range (objects touching the enclosure can still be detected)
  - Designed for **30,000+ hours** service life
  - Selected for advantages in "complex weather and light conditions while maintaining high-precision measurement capabilities"

**Seyond (Strategic Partner, April 2025)**
- **Robin W** ultra-wide-angle LiDAR — Selected as primary forward-facing sensor for airport driverless buses and UiBox models
  - Near-zero blind spots
  - High resolution + long-range detection
  - Enhanced performance in nighttime, fog, and crowded spaces

### Sensor Configuration by Vehicle

**T30AL (Beijing Daxing Airport deployment):**
- **4x LiDAR sensors**
- **6x HD cameras**
- **RTK high-precision positioning system**
- **Inertial navigation system (INS)**

**Autonomous electric tractor (general airport configuration):**
- **8x HD cameras** (mounted on sides)
- **3x LiDAR sensors**
- GPS/GNSS positioning
- Redundant sensor arrays

**Effective sensing distance:** 70+ meters
**Positioning precision:** Centimeter-level

### Sensor Fusion Approach
The combination of HD cameras and LiDAR achieves real-time environmental perception and centimeter-level high-precision positioning. UISEE treats high-precision sensors as "integral parts of the U-Drive® system," suggesting tight integration and multi-modal fusion rather than isolated sensor processing. The system achieves 360-degree 3D sensing.

---

## 6. Software Stack

### Perception
UISEE's perception system handles object detection, environment perception, and obstacle classification. While specific neural network architectures are not publicly detailed, the system:
- Processes data from multiple HD cameras and LiDAR sensors simultaneously
- Achieves real-time environmental perception
- Operates in all weather conditions (rain, fog, extreme heat, sandstorms, typhoons)
- Handles complex airside environments with mixed vehicle/personnel/aircraft traffic

### Localization
UISEE has developed a **LiDAR-based online localization system** incorporating:
- **Road marking detection** using adaptive segmentation techniques to isolate high-reflectance points
- **Registration on HD maps** for precise positioning
- **RTK GNSS + INS** integration for global positioning with centimeter-level accuracy
- Centimeter-level lateral localization accuracy across varied environments and LiDAR sensor types

### Planning & Control
The planning system handles:
- **Autonomous driving** along predefined and dynamic routes
- **Intelligent perception** of surrounding environment
- **Lane changing** in multi-lane airport apron scenarios
- **Obstacle avoidance** with dynamic path re-planning
- **Emergency braking** for safety-critical situations
- **Precise docking** for baggage container coupling/decoupling
- **Geofencing** — electronic boundary enforcement
- **Anti-tampering** protections

### V2X & Vehicle-Road-Cloud Collaboration
- **Road Side Units (RSU)** for infrastructure-to-vehicle communication
- **DCU devices** for data relay
- **4G/5G connectivity** for vehicle-to-cloud communication
- **V2X/Remote Controller** capabilities for teleoperation fallback
- Real-time vehicle monitoring and remote human intervention capability

---

## 7. Cloud Platform & Data Infrastructure

### Architecture Overview

UISEE built its cloud platform on **Kubernetes** to handle the diverse and fluctuating data processing demands of autonomous vehicles.

### Key Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Container orchestration** | Kubernetes | Foundation for all cloud services |
| **Serverless compute** | OpenFunction (CNCF FaaS) | Sync and async workload processing |
| **Sync runtime** | Knative | Request-driven function execution |
| **Async runtime** | Dapr (Distributed Application Runtime) | Event-driven processing |
| **IoT messaging** | EMQX (MQTT broker) | Vehicle-to-cloud data connectivity |
| **Edge messaging** | NanoMQ | Ultra-lightweight edge broker for AGV dispatch |
| **Time-series DB** | InfluxDB | Vehicle telemetry storage |
| **Observability** | Apache SkyWalking | Monitoring and tracing |

### EMQX MQTT Implementation
- **Protocol:** MQTT over QUIC (reduces latency, addresses head-of-line blocking in weak networks)
- **Data routing:** Client_id hash-based sharding for consistent routing to cloud nodes
- **Data pipeline:** Rule engine stores high-throughput telemetry directly into InfluxDB
- **Availability:** 99.995% service uptime
- **Security:** Multi-layered authentication (credentials + certificates), fine-grained permissions

### Serverless Data Processing (OpenFunction)
- **Sync functions:** Receive requests, distribute tasks
- **Async functions:** Execute sub-tasks (read/write operations on storage, data archiving)
- **Scale-to-zero:** Idle functions consume no resources
- **Cross-language support:** Teams can code in preferred languages
- **CRD-based deployment:** Enables deployment to multiple runtimes

### Cloud Platform Functional Layers (Airport)
1. **Operation Monitoring:** Real-time vehicle state, remote video feeds, exception notifications, remote human intervention
2. **Operation Management:** Vehicle management, route management, operational reporting
3. **Network Infrastructure:** RSU integration, DCU devices, 4G/5G connectivity

### Performance Metrics
- **20% improved data accuracy** in weak network scenarios (MQTT over QUIC)
- **5% development efficiency gains** from rule engine reducing custom development
- **99.995% service availability**

---

## 8. Safety Certification & Functional Safety

### Certifications Obtained

| Certification | Scope |
|--------------|-------|
| **ISO 26262** | Road Vehicles Functional Safety |
| **ISO/SAE 21434** | Road Vehicle Cybersecurity Process |
| **ISO 27001** | Information Security Management |
| **IATF 16949** | Automotive Quality Management System |
| **ISO 9001** | Quality Management System |
| **ISO/IEC Level 3** | Classified Protection (China) |
| **Singapore TR68** | Technical Reference for Autonomous Vehicles (vehicle behavior, functional safety, cybersecurity, data formats) |

### Safety Architecture
UISEE has designed a **multi-level failure monitoring and response mechanism** for unmanned vehicles containing:
- **100+ safety strategies**
- Coverage of **~1,000 potential risk scenarios**
- Redundant sensor arrays for fail-operational capability
- Remote monitoring with human intervention fallback
- Failure reporting systems
- Electronic geofencing
- Anti-tampering protections
- Emergency braking systems

### National Recognition
- Designated **national key special "Little Giant" enterprise** by Chinese government (recognition for innovative SMEs in strategic sectors)

---

## 9. Product Lineup

### Airport & Logistics Vehicles

| Model | Type | Key Features |
|-------|------|-------------|
| **T30AL** | L4 Autonomous Tractor | 4 LiDAR, 6 HD cameras, RTK+INS, autonomous coupling/decoupling, auto-charging, 24/7 operation |
| **T05** | L4 Autonomous Logistics Vehicle | Hesai XT LiDAR, centralized dispatch, dynamic route allocation matched to production takt time |
| **B13** | L4 Autonomous Minibus | All-solid-state LiDAR, full-stack U-Drive platform, shuttle services for airport/park personnel |
| **UiBox** | L4 Autonomous Delivery Vehicle | Modular compartments, last-5-km delivery, supports unmanned delivery/retail/inspection/cleaning |
| **UPS** | Autonomous Delivery Vehicle | Deployed at Qatar Science & Technology Park |
| **TH10** | Autonomous Tractor | Published 2023, airport logistics focus |

### Passenger Vehicles
| Model | Type | Key Features |
|-------|------|-------------|
| **U-Pilot** | Personal Mobility System | L3-L4 autonomous driving for passenger vehicles, Chongqing HQ |
| **Dongfeng Aeolus E70 RoboTaxi** | L4 RoboTaxi | Co-developed with Dongfeng Motor, 42 vehicles in Wuhan |

### Platform Products
| Product | Description |
|---------|------------|
| **U-Drive® System** | Automotive-grade intelligent driving platform, licensable to OEMs |
| **Cloud Management Platform** | Fleet monitoring, dispatch, route management, remote intervention |

---

## 10. Relationship with Changi Airport

### Timeline
- **2023:** Autonomous baggage tractor trials begin at Changi Airport
- **~2025:** Nearly one year of testing, 5,000+ trial runs completed
- **January 20, 2026:** Official commercial launch of first fully autonomous tractor fleet

### Deployment Details
- **Current fleet:** 2 autonomous tractors (initial deployment)
- **Planned expansion:** 20+ vehicles
- **Route:** 7 km between Terminal 1 and Terminal 4 (baggage transfer)
- **Capacity:** Each tractor tows up to 4 baggage containers, combined weight up to **10 tonnes**
- **Safety record:** 20,000+ km of accident-free operation

### Regulatory Compliance for Singapore
- ISO 21434 (cybersecurity)
- ISO 27001 (information security)
- Singapore Technical Reference TR68 (comprehensive AV safety standard covering vehicle behavior, functional safety, cybersecurity, and data formats)

### Significance
Changi Airport (ranked among top airports globally by Skytrax) represents UISEE's highest-profile international deployment and a critical reference customer for further international expansion. The deployment validates UISEE's ability to meet stringent international safety and regulatory standards.

---

## 11. Airport Deployments (21+ Airports)

### Confirmed Airport Deployments

| Airport | Country | Status | Vehicle Types | Notable Details |
|---------|---------|--------|---------------|-----------------|
| **Hong Kong International (HKIA)** | Hong Kong | Operational since 2019 | Baggage tractors, patrol cars, shuttle buses | 50+ vehicles, 700K+ km driverless, 1,000+ days continuous operation, won over German/Japanese competitors |
| **Singapore Changi** | Singapore | Commercial launch Jan 2026 | Autonomous tractors | 2 vehicles (expanding to 20+), 7 km T1-T4 route, 10-tonne towing capacity |
| **Guangzhou Baiyun** | China | Operational | Logistics vehicles | Benchmark deployment |
| **Urumqi** | China | Operational | Logistics vehicles | Benchmark deployment |
| **Beijing Daxing** | China | Pilot (2025) | T30AL tractors | First airline-led apron AV pilot (China Southern Airlines), indoor + mixed routes |
| **Hamad International** | Qatar | Pilot (2024-2025) | Self-driving bus, logistics tractor | First AV deployment in Middle East, partnership with Qatar Airways Services |
| **Hangzhou** | China | Operational | Logistics vehicles | — |
| **Additional 14+ airports** | China | Operational | Various | Names not individually confirmed in public sources |

### Aggregate Airport Metrics
- **21+ airports** globally with fully autonomous commercialization (no onboard safety operators)
- **1,000+ autonomous vehicles** in fleet
- **2+ million kilometers** of autonomous apron driving
- **7.5 million kilometers** total real driverless mileage (all scenarios, as of Dec 2025)

---

## 12. Non-Airport Applications

### Factory Logistics

**SAIC-GM-Wuling (SGMW) Partnership:**
- Fleet of **100+ electric vehicles** transporting auto parts in SGMW plant in Guangxi province
- **300,000+ kilometers** logged unmanned within 15 months (as of Jan 2021)
- China's first logistics route specifically designed for autonomous vehicles
- L4 autonomous driving with centimeter-level perception and monitoring

**SANY Partnership:**
- Autonomous logistics at SANY manufacturing parks
- Cost optimization and efficiency gains demonstrated

**Other Factory Customers:**
- FAW Logistics (First Automobile Works)
- BASF (chemicals)
- SAIC Volkswagen
- Chongqing Changan Minsheng APLL Logistics
- Claims **56% operational cost reduction** vs. traditional logistics

**Tobacco Industry:**
- First autonomous driving application in China's tobacco industry

### Urban Mobility / RoboTaxi

**Dongfeng Motor Partnership:**
- Co-developed Dongfeng Aeolus E70 RoboTaxi
- **42 robotaxis** operating in Wuhan Economic and Technological Development Zone
- **22 main stops** with mobile app booking
- **100,000+ km** cumulative autonomous driving

### Smart City Services
- Unmanned delivery (UiBox)
- Unmanned retail
- Unmanned inspection/patrol
- Unmanned cleaning

### Personal Mobility (U-Pilot)
- Established personal mobility business headquarters in **Chongqing**
- L3-L4 autonomous driving systems for OEM integration into passenger vehicles

---

## 13. International Expansion

### Strategy: "Beijing DNA with Hong Kong Bloodline, China Standard for Global Products"

UISEE's international expansion follows a deliberate geographic progression:

```
Hong Kong (2018) → Singapore (2023) → Qatar (2024) → [Dubai, Istanbul, Riyadh, Abu Dhabi, Europe, Australia, US]
```

### Hong Kong — International Headquarters (Feb 2024)

- **Role:** International HQ, R&D center, corporate treasury center
- **Rationale:** Strategic location, global business network, international financial hub, IPO venue
- **HKIA as springboard:** Won the Hong Kong International Airport project in 2018 over competitors from Germany, Japan, and mainland China. This became the proving ground for international credibility.
- **Government support:** InvestHK and Office for Attracting Strategic Enterprises facilitating setup

### Singapore

- **Changi Airport** commercial deployment (Jan 2026) — highest-profile international reference
- Compliance with Singapore's stringent TR68 autonomous vehicle standards

### Qatar — First Middle East Presence (Oct 2024)

- **UISEE QATAR** established at Qatar Science & Technology Park (QSTP) — first autonomous driving company registered in Qatar
- **Products deployed:** B13 autonomous minibus, UPS delivery vehicle at QSTP
- **Airport pilot:** Hamad International Airport (Skytrax #1 globally in 2024) with Qatar Airways Services
- **R&D center** in Qatar to localize products for extreme heat and sandstorms
- Completed pilot in under one year from initial negotiations

### Expansion Pipeline
- In discussions with airports in **Dubai, Istanbul, Riyadh, and Abu Dhabi** (all top-ranked Skytrax airports)
- Targeting expansion into **Europe, Australia, and the United States**
- Vision: "zero-time-difference overseas expansion" through products refined to international standards

---

## 14. Competitive Advantages

### 1. Unmatched Airport Domain Expertise
UISEE has the largest airport autonomous driving deployment globally — 21+ airports with 1,000+ vehicles. No competitor approaches this scale. The 7+ years of airport operational data since the 2019 HKIA deployment creates a significant moat.

### 2. Full-Stack Platform Architecture
The U-Drive platform's cross-scenario design allows rapid deployment to new vehicle types and environments (airports, factories, cities) without rebuilding the technology stack. This contrasts with competitors who typically target a single vertical.

### 3. Scale of Real-World Driverless Operations
7.5 million kilometers of truly driverless operation (no safety driver onboard) across diverse environments provides training data and edge-case coverage that cannot be replicated in simulation alone.

### 4. Regulatory Track Record
Having obtained certifications including ISO 26262, ISO 21434, ISO 27001, IATF 16949, and Singapore TR68 compliance, UISEE has demonstrated ability to meet multiple international regulatory frameworks — critical for airport operators who require the highest safety assurance.

### 5. Strategic Investor Network
Bosch (automotive supplier), Dongfeng Motor (OEM), SAIC-GM-Wuling (OEM), and Chinese state funds provide both capital and industry access.

### 6. Cost Advantage
Claims to "reduce costs of mobility and logistics by 1/3" with demonstrated 56% operational cost reduction in factory logistics.

### 7. Rapid International Deployment Capability
Proved ability to complete Qatar pilot from negotiation to deployment in under one year. Hong Kong headquarters enables compliance with international standards and serves as a trusted launchpad for non-Chinese markets.

### Competitive Landscape

| Competitor | Focus | Deployment Scale | Key Difference |
|-----------|-------|-----------------|----------------|
| **TractEasy/EasyMile (EZTow)** | Airport baggage tractors | 20+ vehicles globally (self-reported "most deployed") | France-based; L4 at Toulouse, Greenville-Spartanburg, Japan |
| **Gaussin (Autonom Tract AT135)** | Airport tractors | Trial phase (Frankfurt Airport) | Partnership with Charlatte Manutention; not yet at commercial scale |
| **IDRIVERPLUS** | Commercial/industrial vehicles | Autonomous sweepers, backed by Baidu/JD.com | Beijing-based; different vehicle focus |
| **TRUNKTECH** | Port/industrial park trucks | Trunk road solutions | R&D partners include Bosch, CNHTC |

UISEE's primary advantage over Western competitors (TractEasy, Gaussin) is **scale of deployment** (1,000+ vehicles vs. ~20) and the breadth of the platform (tractors + buses + delivery + patrol vs. single vehicle type).

---

## 15. Global Offices

| Location | Function |
|----------|----------|
| **Beijing** | Global headquarters, primary R&D base |
| **Shanghai** | R&D center |
| **Jiashan** | Testing and innovation center |
| **Hong Kong** | International headquarters, R&D center, corporate treasury |
| **Singapore** | Operations (Changi deployment) |
| **Qatar (Doha)** | R&D and operations center at QSTP |
| **Shenzhen** | Office |
| **Wuhan** | Office (RoboTaxi operations) |
| **Chongqing** | Personal mobility business HQ |

---

## 16. Key Milestones Timeline

| Year | Milestone |
|------|-----------|
| **2016** | Founded in Beijing by Wu Gansha and co-founders |
| **2018** | Expanded to Hong Kong; won HKIA autonomous vehicle project |
| **2019** | World's first unmanned logistics vehicle project at HKIA; daily "No-Safety-Driver" operations begin |
| **2020 (Feb)** | Series B led by Robert Bosch Venture Capital |
| **2020** | COVID pivot — accelerated focus on autonomous logistics/delivery over RoboTaxi |
| **2021 (Jan)** | Series C — $154M round from National Manufacturing Transformation Fund |
| **2021 (Nov)** | "Truly unmanned" commercial operating mileage exceeds 1 million km |
| **2022** | Launched autonomous delivery vehicles; revenue ~65M yuan |
| **2023** | Published TH10 tractor and B13 minibus; Series C extension; began Changi trials |
| **2024 (Feb)** | Established international HQ in Hong Kong |
| **2024 (Oct)** | Established UISEE QATAR; first AV company registered in Qatar |
| **2024** | Revenue reaches ~265M yuan |
| **2025 (Mar)** | 5.4M+ km accumulated autonomous driving mileage |
| **2025 (Apr)** | Strategic partnership with Seyond (Robin W LiDAR) |
| **2025 (May)** | Filed preliminary prospectus with HKEX under Chapter 18C |
| **2025 (Dec)** | 7.5M km of real driverless mileage |
| **2026 (Jan 20)** | Commercial launch of autonomous tractor fleet at Singapore Changi Airport |

---

## 17. Key Partnerships

| Partner | Nature of Partnership |
|---------|-----------------------|
| **Hesai Technology** | Strategic LiDAR supplier (Hesai XT series) |
| **Seyond** | Strategic LiDAR supplier (Robin W ultra-wide-angle) |
| **Robert Bosch** | Strategic investor (Series B lead) and automotive technology partner |
| **SAIC-GM-Wuling (SGMW)** | Factory autonomous logistics (100+ vehicles, 300K+ km) |
| **Dongfeng Motor** | RoboTaxi co-development (42 vehicles in Wuhan) |
| **Changi Airport Group** | Commercial autonomous tractor deployment |
| **Hong Kong Airport Authority** | 50+ vehicles, longest-running airport AV deployment globally |
| **Qatar Airways Services** | Hamad International Airport pilot |
| **SANY** | Manufacturing park autonomous logistics |
| **FAW (First Automobile Works)** | Factory logistics autonomous vehicles |
| **BASF** | Chemical plant autonomous logistics |
| **China Southern Airlines** | Beijing Daxing Airport apron pilot |
| **EMQX** | IoT/MQTT connectivity platform |

---

## Sources

- [UISEE Official Website](https://www.uisee.com/en/)
- [UISEE About Us](https://www.uisee.com/en/about.html)
- [UISEE Airport Solutions](https://www.uisee.com/en/solution-airports.html)
- [UISEE Changi Airport Launch Announcement](https://www.uisee.com/en/article226-cases1.html)
- [UISEE Qatar R&D Center Announcement](https://www.uisee.com/en/article164-news1.html)
- [Hesai: How Does UISEE Become the AI Driver of the World?](https://www.hesaitech.com/how-does-uisee-become-the-ai-driver-of-the-world/)
- [Hesai-UISEE Strategic Partnership](https://www.hesaitech.com/hesai-and-uisee-reached-strategic-partnership-expanding-autonomous-driving-ecosystem/)
- [CNCF Case Study: UISEE](https://www.cncf.io/case-studies/uisee/)
- [EMQX Customer: UISEE](https://www.emqx.com/en/customers/uisee)
- [TechCrunch: Uisee $150M Round](https://techcrunch.com/2021/01/24/uisee-150-million-round/)
- [EqualOcean: UISEE Transformation](https://equalocean.com/analysis/2020060214048)
- [SCMP: Hong Kong International HQ](https://www.scmp.com/business/china-business/article/3252851/hong-kong-picked-chinese-ai-driverless-vehicle-firm-uisees-international-headquarters-research)
- [SCMP: Middle East Expansion via Hong Kong](https://www.scmp.com/news/hong-kong/hong-kong-economy/article/3309891/how-hong-kong-helped-mainland-chinese-driverless-tech-firm-expand-mideast)
- [InvestHK: UISEE Hong Kong Setup](https://www.investhk.gov.hk/en/news/ai-driverless-technology-company-uisee-to-set-up-international-headquarters-rd-centre-and-corporate-treasury-centre-in-hong-kong/)
- [KrASIA: UISEE $150M Financing](https://kr-asia.com/ev-startup-uisee-gains-state-support-in-usd-150-million-financing-round)
- [Gasgoo: UISEE-Seyond Partnership](https://autonews.gasgoo.com/icv/70036741.html)
- [Gasgoo: Beijing Daxing Airport Pilot](https://autonews.gasgoo.com/icv/70036759.html)
- [Gasgoo: Hamad International Airport](https://autonews.gasgoo.com/icv/70036036.html)
- [Tracxn: UISEE Funding](https://tracxn.com/d/companies/uisee/__nFfmdLMBNu9A4UVYobeAvpW2VMglTeOUlnRKIGuqUk4/funding-and-investors)
- [CanvasBusinessModel: UISEE Ownership](https://businessmodelcanvastemplate.com/blogs/owners/uisee-technology-who-owns)
- [GreyB: UISEE Patents](https://insights.greyb.com/uisee-technology-patents/)
- [VnExpress: World's Best Airport Deploys AI Tractors](https://e.vnexpress.net/news/tech/tech-news/world-s-best-airport-deploys-ai-powered-autonomous-baggage-tractors-5007890.html)
- [Xinhua: Autonomous Driving Innovation](https://english.news.cn/20250624/b32f3bb703e644cab67f954cb0aa050b/c.html)
