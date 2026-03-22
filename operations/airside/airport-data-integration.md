# Airport Data Systems Integration for Autonomous Airside Vehicles

> Comprehensive guide to integrating ADS-B, A-CDM, NOTAM, AIXM/AMXM, A-SMGCS, and AODB
> data systems with an autonomous vehicle stack operating on the airport airside.

---

## Table of Contents

1. [ADS-B Integration](#1-ads-b-integration)
2. [A-CDM (Airport Collaborative Decision Making)](#2-a-cdm-airport-collaborative-decision-making)
3. [NOTAM Processing](#3-notam-processing)
4. [AIXM/AMXM Airport Geometry](#4-aixmamxm-airport-geometry)
5. [A-SMGCS Surface Surveillance](#5-a-smgcs-surface-surveillance)
6. [AODB (Airport Operational Database)](#6-aodb-airport-operational-database)
7. [ROS Implementation Architecture](#7-ros-implementation-architecture)

---

## 1. ADS-B Integration

### 1.1 Why ADS-B Matters for Airside AV

ADS-B (Automatic Dependent Surveillance-Broadcast) is the primary mechanism by which aircraft broadcast their position, velocity, and identification on the airport surface. For an autonomous vehicle operating on taxiways, aprons, and service roads, ADS-B provides:

- **Real-time awareness of aircraft position and movement on the surface** — essential for yield/stop decisions when crossing active taxiways.
- **Predictive trajectory estimation** — ground speed and heading allow the AV planner to anticipate aircraft paths.
- **Aircraft identification** — callsign, ICAO hex code, and squawk enable correlation with flight schedule data from AODB/A-CDM.
- **Surface vs. airborne discrimination** — Type Codes 5-8 specifically encode surface position messages, letting the AV distinguish taxiing aircraft from overflights.

### 1.2 Receiver Hardware

#### RTL-SDR Dongles

The most accessible entry point. A USB RTL-SDR dongle with an R820T2 tuner receives 1090 MHz Mode S/ADS-B signals.

| Hardware | Price | Key Feature | Notes |
|----------|-------|-------------|-------|
| Generic RTL-SDR v3 | ~$30 | Wideband 24-1766 MHz | Requires external 1090 MHz bandpass filter for best performance |
| FlightAware Pro Stick | ~$20 | Built-in LNA (low-noise amplifier) | Optimized for 1090 MHz, ~2x range over generic |
| FlightAware Pro Stick Plus | ~$25 | Built-in LNA + 1090 MHz SAW bandpass filter | Best for urban RF-noisy environments, 10-20% range increase over Pro Stick |
| Nooelec NESDR SMArt v5 | ~$25 | TCXO 0.5ppm stability | Good frequency accuracy for MLAT contribution |

**Antenna considerations**: A quarter-wave ground plane antenna (~69mm element) tuned to 1090 MHz, mounted as high as possible on the vehicle roof. For maximum surface coverage at an airport, height is less critical than line-of-sight to taxiways and runways. A collinear antenna (5-6 dBi gain) improves range to ~50-100 NM for airborne, but surface targets are typically within 2-5 km. A simple whip with ground plane is adequate for surface-only coverage.

#### Dedicated ADS-B Receivers

For production deployments, consider purpose-built receivers:

| Device | Interface | Output Format | Notes |
|--------|-----------|---------------|-------|
| FlightAware PiAware (Raspberry Pi + Pro Stick) | Ethernet/WiFi | JSON (aircraft.json), SBS, Beast | Turnkey solution, runs dump1090-fa |
| Ping200X (uAvionix) | Serial/CAN | GDL-90, MAVLink | Aviation-grade, designed for UAS integration |
| GNS 5890 (Garmin) | Bluetooth/USB | GDL-90 | Portable, dual-band (1090/978 UAT) |
| Sagetech MXS | MIL-STD interfaces | ASTERIX, custom | DO-260B certified transponder + receiver |

For the AV use case, the **FlightAware Pro Stick Plus + Raspberry Pi** running readsb is the recommended starting point for development, with a Ping200X or equivalent for production hardening.

### 1.3 Decoder Software: dump1090 and readsb

#### dump1090 (Original by Antirez, Forks by FlightAware, Mictronics)

dump1090 demodulates 1090 MHz Mode S signals from an RTL-SDR and decodes:
- Mode S short/long messages (DF0, DF4, DF5, DF11, DF16, DF17, DF18, DF20, DF21)
- ADS-B Extended Squitter (DF17/DF18)
- Mode A/C transponder replies

**Output protocols** (all served over TCP):

| Port | Protocol | Format | Use Case |
|------|----------|--------|----------|
| 30001 | Raw | AVR hex strings | Low-level debugging |
| 30002 | Raw | AVR with timestamps | Feeding aggregators |
| 30003 | SBS-1 (BaseStation) | CSV text | Easy parsing, human-readable |
| 30005 | Beast | Binary framed | High-fidelity, preferred for inter-process |
| 8080 | HTTP | JSON (aircraft.json) | Web UI, REST-like polling |

#### readsb (Recommended)

readsb is the actively maintained successor/fork, preferred for production. Key advantages:
- Better decoding performance and accuracy
- Native JSON API with comprehensive field set
- Built-in aircraft database lookups (registration, type)
- Network client mode (connect to remote receivers)
- Protobuf output support
- Globe history and heatmap generation

**Installation:**
```bash
sudo apt-get install -y build-essential libusb-1.0-0-dev \
  pkg-config librtlsdr-dev libncurses-dev zlib1g-dev
git clone https://github.com/wiedehopf/readsb.git
cd readsb
make RTLSDR=yes
# Run:
./readsb --device 0 --net --write-json /run/readsb
```

### 1.4 ADS-B Message Types (DF17 Extended Squitter)

The 56-bit ME (Message Element) field in DF17 frames carries the ADS-B payload. The first 5 bits are the Type Code (TC):

| Type Code | BDS | Content | Update Rate |
|-----------|-----|---------|-------------|
| 1-4 | 0,8 | Aircraft identification and category | Every 5s (surface), 10s (airborne) |
| 5-8 | 0,6 | **Surface position** | Every 0.5s (when moving), 5s (stationary) |
| 9-18 | 0,5 | Airborne position (barometric altitude) | Every 0.5s |
| 19 | 0,9 | Airborne velocity | Every 0.5s |
| 20-22 | 0,5 | Airborne position (GNSS altitude) | Every 0.5s |
| 23 | - | Test message | - |
| 28 | 6,1 | Aircraft status (emergency/priority) | Event-driven |
| 29 | 6,2 | Target state and status | 1.3s |
| 31 | 6,5 | Aircraft operational status | 2.4s |

#### Surface Position Messages (TC 5-8) — Critical for Airside AV

These are the most important messages for ground vehicle safety. The ME field structure:

| Field | Bits | Description |
|-------|------|-------------|
| TC | 5 | Type Code (5-8), encodes NIC (Navigation Integrity Category) |
| MOV | 7 | Ground speed (non-linear quantization, finer at low speeds) |
| S | 1 | Ground track status (0=invalid, 1=valid) |
| TRK | 7 | Ground track angle: heading = (360 x TRK) / 128 degrees |
| T | 1 | UTC time synchronization flag |
| F | 1 | CPR format flag (0=even, 1=odd) |
| LAT-CPR | 17 | Compact Position Reporting latitude |
| LON-CPR | 17 | Compact Position Reporting longitude |

**Ground speed encoding** (MOV field) uses non-linear quantization optimized for taxiing speeds:

| MOV Value | Speed Range | Resolution |
|-----------|-------------|------------|
| 0 | Not available | - |
| 1 | Stopped (v < 0.125 kt) | - |
| 2-8 | 0.125-0.875 kt | 0.125 kt |
| 9-12 | 1.0-2.0 kt | 0.25 kt |
| 13-38 | 2.0-15.0 kt | 0.5 kt |
| 39-93 | 15.0-70.0 kt | 1.0 kt |
| 94-108 | 70.0-100.0 kt | 2.0 kt |
| 109-123 | 100.0-175.0 kt | 5.0 kt |
| 124 | >= 175 kt | - |

This non-linear encoding gives the best precision at taxi speeds (0-15 knots) where the AV needs accurate predictions — exactly the regime where aircraft are maneuvering near ground vehicles.

**CPR (Compact Position Reporting) decoding** for surface positions uses zone sizes 4x smaller than airborne messages. Two messages (one even, one odd) are needed for global decode. For local decode (when a reference position is known within 45 NM), a single message suffices — the AV always knows its own position, so local decode is the norm.

### 1.5 readsb aircraft.json API Fields

The JSON output from readsb (served at `http://localhost:8080/data/aircraft.json`) provides a rich per-aircraft object. Key fields for AV integration:

```json
{
  "hex": "A1B2C3",
  "flight": "UAL123  ",
  "alt_baro": "ground",
  "gs": 12.3,
  "track": 247.5,
  "lat": 51.4706,
  "lon": -0.4619,
  "category": "A3",
  "squawk": "2431",
  "emergency": "none",
  "seen_pos": 0.4,
  "seen": 0.1,
  "rssi": -18.2,
  "nic": 8,
  "rc": 25,
  "version": 2,
  "nav_modes": ["autopilot", "vnav"],
  "messages": 4521,
  "r": "N12345",
  "t": "B738",
  "type": "adsb_icao"
}
```

**Critical fields for AV decision-making:**

| Field | Type | Meaning for AV |
|-------|------|----------------|
| `alt_baro` | number or `"ground"` | **When `"ground"`, aircraft is on surface — potential conflict** |
| `gs` | float (knots) | Ground speed — predict closing rate |
| `track` | float (degrees) | Heading — predict trajectory |
| `lat`, `lon` | float (degrees) | Position — distance/bearing to AV |
| `seen_pos` | float (seconds) | Staleness of position — reject if > 5s |
| `category` | string | Emitter category: A1-A5 (light to heavy aircraft), B1-B7 (surface vehicles) |
| `nic` | int (0-8) | Navigation Integrity — higher = more trustworthy position |
| `rc` | float (meters) | Radius of Containment — position uncertainty bound |

**Emitter categories relevant to airside:**
- A0: No info, A1: Light (<15500 lb), A2: Small (15500-75000 lb), A3: Large (75000-300000 lb), A4: High vortex (B757), A5: Heavy (>300000 lb), A6: High performance, A7: Rotorcraft
- B1: Glider, B2: Lighter than air
- **C1: Surface emergency vehicle, C2: Surface service vehicle, C3: Point obstacle (fixed), C4: Cluster obstacle, C5: Line obstacle, C6: Small surface vehicle, C7: Ground obstruction**

Categories C1-C7 identify other ground vehicles and obstacles — directly relevant for AV conflict detection.

### 1.6 Surface Coverage Considerations

ADS-B surface coverage at airports has specific characteristics:

1. **Transponder requirement**: Aircraft must have ADS-B Out transponders enabled on the surface. Under FAA 14 CFR 91.225, ADS-B Out is required in Class B and C airspace (which includes most commercial airports). Surface vehicles at airports may use Vehicle-Mounted ADS-B Transmitters (VMATs) per AC 150/5220-26.

2. **Update rate on surface**: Surface position messages are broadcast every 0.5 seconds when moving, every 5 seconds when stationary — fast enough for AV planning at typical closing speeds.

3. **Multipath**: Airport buildings, hangars, and terminal structures create multipath reflections that degrade position accuracy. The `rc` (Radius of Containment) field should be used as an uncertainty bound in the AV's occupancy grid.

4. **Power output**: On-ground ADS-B transmit power is typically lower than airborne (some transponders reduce power on ground detection). Receiver placement on the vehicle should account for potential line-of-sight obstructions from adjacent aircraft fuselages.

5. **MLAT augmentation**: Many airports operate Multilateration (MLAT) systems that track Mode A/C transponders (which do not broadcast ADS-B) by measuring Time Difference of Arrival across distributed receivers. MLAT achieves 3-7.5m position accuracy. Some receivers (dump1090-fa with FlightAware) participate in MLAT and output MLAT-derived positions in the same aircraft.json feed, with the `mlat` field listing which data items came from MLAT.

### 1.7 Python Integration with pyModeS

For direct message-level decoding (e.g., if receiving raw Beast binary from a serial port):

```python
import pyModeS as pms

# Decode message type
msg = "8D4840D6202CC371C32CE0576098"
tc = pms.adsb.typecode(msg)     # e.g., 5 = surface position
icao = pms.adsb.icao(msg)       # "4840D6"
callsign = pms.adsb.callsign(msg)  # for TC 1-4

# Surface position (TC 5-8) — needs even + odd message pair
pos = pms.adsb.surface_position(
    msg_even, msg_odd,
    t_even, t_odd,
    lat_ref, lon_ref  # AV's own position as reference
)  # Returns (lat, lon)

# Surface velocity
v = pms.adsb.surface_velocity(msg)
# Returns (speed_kt, track_deg, speed_type, track_source)

# Or use single-message local decode with reference position
pos = pms.adsb.position_with_ref(msg, lat_ref, lon_ref)
```

---

## 2. A-CDM (Airport Collaborative Decision Making)

### 2.1 Overview

A-CDM is a joint initiative by ACI EUROPE, EUROCONTROL, IATA, and CANSO that standardizes information sharing between airport stakeholders (airlines, ground handlers, ATC, airport operators, EUROCONTROL Network Manager). For the AV, A-CDM provides **predictive awareness** of aircraft movements — knowing when an aircraft will push back, taxi, or arrive at a stand allows the AV to plan routes that avoid conflicts before they materialize.

### 2.2 The Milestone Approach

A-CDM defines 16 milestones that track each flight from planning through departure. Not all milestones occur sequentially — some may be skipped or occur out of order depending on the operational situation.

| MST# | Milestone | Trigger | Key Time |
|------|-----------|---------|----------|
| 1 | ATC flight plan received | IFPS filing | EOBT (Estimated Off-Block Time) |
| 2 | EOBT - 2 hours | Time-based | First TOBT setting window opens |
| 3 | EOBT - 3 hours (long haul) | Time-based | Earliest ground handling planning |
| 4 | ELDT received | Approach control | ELDT (Estimated Landing Time) |
| 5 | Approach / final | Radar detection in TMA | Updated ELDT |
| 6 | Aircraft landed | Touchdown detection | ALDT (Actual Landing Time) |
| 7 | Aircraft in-block | Arrival at stand | AIBT (Actual In-Block Time) |
| 8 | Ground handling starts | Handler reports | Turnaround begins |
| 9 | TOBT update | AO/handler reports | TOBT (Target Off-Block Time) — **critical for AV** |
| 10 | TSAT issued | ATC calculates | TSAT (Target Start-Up Approval Time) |
| 11 | Boarding starts | AO reports | Boarding confirmation |
| 12 | Aircraft ready | All doors closed, bridge removed | TOBT confirmed |
| 13 | Start-up request | Pilot calls ATC | Start-up request time |
| 14 | Start-up approved | ATC grants | ASAT (Actual Start-Up Approval Time) |
| 15 | Off-block | Push-back begins | AOBT (Actual Off-Block Time) — **AV must clear area** |
| 16 | Airborne | Takeoff | ATOT (Actual Take-Off Time) |

### 2.3 Key Time Parameters

| Abbreviation | Full Name | Description | AV Relevance |
|--------------|-----------|-------------|--------------|
| **EOBT** | Estimated Off-Block Time | From flight plan | Long-range planning |
| **TOBT** | Target Off-Block Time | Set by airline/handler | **Primary AV trigger**: "aircraft will push back at this time" |
| **TSAT** | Target Start-Up Approval Time | Set by ATC, accounts for TOBT + taxi time + CTOT | Engine start ≈ 5-10 min before push |
| **TTOT** | Target Take-Off Time | TSAT + estimated taxi time | Runway occupancy prediction |
| **CTOT** | Calculated Take-Off Time | ATFM slot from NM | Hard constraint, ±5 min window |
| **ELDT** | Estimated Landing Time | From approach control | Predict inbound aircraft at stand |
| **EIBT** | Estimated In-Block Time | ELDT + taxi time | Predict when stand becomes occupied |
| **AOBT** | Actual Off-Block Time | Measured | Aircraft is now moving — AV must react |
| **AIBT** | Actual In-Block Time | Measured | Stand now occupied, turnaround begins |

### 2.4 Turnaround Phase Tracking

The turnaround is the period between AIBT (aircraft arrives at stand) and AOBT (aircraft departs). A-CDM tracks sub-processes:

```
AIBT ──> Chocks On ──> Bridge Connected ──> Doors Open
  │
  ├── Passenger Deplanement
  ├── Cargo/Baggage Unload
  ├── Cabin Cleaning
  ├── Catering Load
  ├── Fuel Load
  ├── Cargo/Baggage Load
  ├── Passenger Boarding
  │
  └──> Doors Closed ──> Bridge Disconnected ──> Chocks Off ──> AOBT
```

**For the AV**, turnaround state determines:
- Which service vehicles are expected at the stand (fuel truck, catering, baggage tugs)
- Whether the apron area around the stand is congested
- When push-back will occur (requiring clearance of the push-back zone)
- Which ground handling equipment will be moving to/from the stand

### 2.5 DPI (Departure Planning Information) Messages

A-CDM airports exchange DPI messages with the EUROCONTROL Network Manager (NM). Five DPI types:

| DPI Type | Trigger | Content |
|----------|---------|---------|
| **E-DPI** (Early) | MST 2 (EOBT-2h) | Initial departure info with TOBT |
| **T-DPI-t** (Target) | TOBT set/updated | Updated TOBT, used for sequencing |
| **T-DPI-s** (Sequenced) | TSAT issued | TOBT + TSAT, pre-departure sequence position |
| **A-DPI** (ATC) | Push-back approved | AOBT — aircraft is now moving |
| **C-DPI** (Cancel) | Flight cancelled | Flight removed from sequence |

### 2.6 Accessing A-CDM Data

#### EUROCONTROL NM B2B Web Services

The Network Manager B2B interface provides system-to-system access via:

- **SOAP Web Services**: Request/Reply pattern using WSDL
- **AMQP 1.0**: Publish/Subscribe for real-time updates via message broker
- **POX (Plain Old XML)**: Simplified Request/Reply

Access requires registration at the EUROCONTROL B2B portal and a signed certificate for authentication.

**Key B2B service endpoints for A-CDM data:**
```
FlightListByAerodromeRequest  → List flights for an airport with milestones
FlightRetrievalRequest        → Get detailed flight data including TOBT/TSAT/CTOT
FlightNotificationRequest     → Subscribe to real-time milestone updates
```

#### Local A-CDM Platform APIs

Many A-CDM implementations expose local REST APIs. Example (Schiphol CDM):

```http
GET /api/v1/flights?airport=EHAM&timeFrom=2026-03-21T10:00Z&timeTo=2026-03-21T12:00Z
Authorization: Bearer <token>

Response:
{
  "flights": [
    {
      "callsign": "KLM1234",
      "registration": "PH-BXA",
      "aircraftType": "B738",
      "stand": "D42",
      "eobt": "2026-03-21T11:30:00Z",
      "tobt": "2026-03-21T11:25:00Z",
      "tsat": "2026-03-21T11:22:00Z",
      "ctot": "2026-03-21T11:45:00Z",
      "eldt": "2026-03-21T10:15:00Z",
      "eibt": "2026-03-21T10:25:00Z",
      "turnaroundState": "BOARDING",
      "milestones": {
        "mst7_aibt": "2026-03-21T10:23:00Z",
        "mst8_groundHandlingStart": "2026-03-21T10:28:00Z",
        "mst9_tobtUpdate": "2026-03-21T11:00:00Z",
        "mst10_tsat": "2026-03-21T11:10:00Z"
      }
    }
  ]
}
```

#### SWIM (System Wide Information Management)

EUROCONTROL SWIM and FAA SWIM provide standardized data exchange:

- **EUROCONTROL SWIM**: Uses AMQP 1.0 messaging via the SWIM Yellow Profile. Digital NOTAM, flight data, and A-CDM milestones are published as topics on AMQP queues. Registration through `eur-registry.swim.aero`.
- **FAA SWIM**: Uses the SWIM Cloud Distribution Service (SCDS) at `scds.faa.gov`. JMS messaging (Solace broker) for NOTAM, TFMS, and TBFM data. Registration required.

---

## 3. NOTAM Processing

### 3.1 Why NOTAMs Matter for Airside AV

NOTAMs (Notices to Air Missions) communicate temporary changes to airport infrastructure that directly affect where an AV can and cannot go:

- **Runway closures** — changes available crossing points
- **Taxiway closures** — requires route replanning
- **Construction/Work in Progress** — new obstacles, restricted zones
- **Temporary obstacles** — cranes, equipment on/near movement area
- **Lighting outages** — affects visibility for any camera-based perception
- **Apron restrictions** — closed stands, partial apron closures
- **Vehicle restrictions** — specific vehicle access limitations

### 3.2 Traditional vs. Digital NOTAM

#### Traditional NOTAM (ICAO Format)

Free-text, semi-structured. Difficult to parse automatically:

```
A0123/26 NOTAMN
Q) EGLL/QMXLC/IV/M/A/000/999/5128N00027W005
A) EGLL
B) 2603210800
C) 2603211800
E) TWY B BTN TWY B1 AND TWY B3 CLSD DUE WIP
```

**Q-code** breakdown: `QMXLC` = Q (qualifier) + MX (taxiway) + LC (closed). The Q-line encodes subject and condition but requires lookup tables.

#### Digital NOTAM (AIXM 5.1)

Machine-readable XML using the AIXM 5.1 Event extension. The same taxiway closure in Digital NOTAM:

```xml
<aixm:Taxiway gml:id="EGLL_TWY_B">
  <aixm:timeSlice>
    <aixm:TaxiwayTimeSlice gml:id="EGLL_TWY_B_TS1">
      <gml:validTime>
        <gml:TimePeriod>
          <gml:beginPosition>2026-03-21T08:00:00Z</gml:beginPosition>
          <gml:endPosition>2026-03-21T18:00:00Z</gml:endPosition>
        </gml:TimePeriod>
      </gml:validTime>
      <aixm:interpretation>TEMPDELTA</aixm:interpretation>
      <aixm:sequenceNumber>1</aixm:sequenceNumber>
      <aixm:designator>B</aixm:designator>
      <aixm:availability>
        <aixm:TaxiwayAvailability>
          <aixm:operationalStatus>CLOSED</aixm:operationalStatus>
          <aixm:annotation>
            <aixm:Note>
              <aixm:purpose>REMARK</aixm:purpose>
              <aixm:translatedNote>
                <aixm:LinguisticNote>
                  <aixm:note>CLOSED DUE TO WORK IN PROGRESS</aixm:note>
                </aixm:LinguisticNote>
              </aixm:translatedNote>
            </aixm:Note>
          </aixm:annotation>
        </aixm:TaxiwayAvailability>
      </aixm:availability>
      <aixm:extent>
        <!-- GML geometry defining the closed section -->
        <aixm:ElevatedSurface srsName="urn:ogc:def:crs:EPSG::4326">
          <gml:patches>
            <gml:PolygonPatch>
              <gml:exterior>
                <gml:LinearRing>
                  <gml:posList>51.4706 -0.4619 51.4708 -0.4615 ...</gml:posList>
                </gml:LinearRing>
              </gml:exterior>
            </gml:PolygonPatch>
          </gml:patches>
        </aixm:ElevatedSurface>
      </aixm:extent>
    </aixm:TaxiwayTimeSlice>
  </aixm:timeSlice>
</aixm:Taxiway>
```

### 3.3 Digital NOTAM Event Types Relevant to Airside AV

The Digital NOTAM Event Specification defines encoding rules for numerous event scenarios. Those most relevant to AV operations:

| Event Code | Description | AV Impact |
|------------|-------------|-----------|
| **RWY.CLS** | Runway closure (full) | Changes crossing availability |
| **RWY.CLS_PORTION** | Partial runway closure | Partial crossing may be possible |
| **TWY.CLS** | Taxiway closure | **Direct route blockage** — requires replanning |
| **APRON.CLS** | Apron closure | Stand access affected |
| **AD.WIP** | Work in progress on aerodrome | Construction zone = geofence |
| **OBS.NEW** | New obstacle | Add to obstacle map |
| **OBS.WDR** | Obstacle withdrawn | Remove from obstacle map |
| **RWY.SFC** | Runway surface condition | Traction/braking implications |
| **TWY.SFC** | Taxiway surface condition | Traction for AV if using taxiway |
| **AD.LIGHTING** | Lighting change | Camera perception affected at night |
| **SVC.VEH** | Vehicle service restriction | Direct AV operational restriction |
| **NAV.UNS** | Navigation aid unserviceable | May affect GPS-dependent aircraft behavior |

### 3.4 FAA NOTAM Data Access

#### FAA SWIM FNS (Federal NOTAM System)

The primary programmatic access path:

1. **Register** at `scds.faa.gov` — create account, request AIM FNS subscription
2. **Initial Load (FIL)**: Download all active NOTAMs via SFTP. This seeds your local database.
3. **Real-time updates**: Subscribe via JMS (Solace) messaging. NOTAM create/update/cancel messages arrive in near-real-time.

The `faa-swim/fns-client` reference implementation (Java) on GitHub demonstrates the full workflow.

#### NASA DIP NOTAMs API

NASA redistributes FAA SWIM NOTAM data via a RESTful API. Easier to integrate than raw JMS:

```http
GET https://dip.nasa.gov/api/v1/notams?location=KJFK&effectiveDate=2026-03-21
Authorization: Bearer <api_key>
```

#### Third-Party NOTAM APIs

| Provider | Format | Auth | Notes |
|----------|--------|------|-------|
| Laminar Data (Cirium) | GeoJSON, AIXM 5.1 | API key | Full v2 API with geometry |
| ICAO API Data Service | AIXM 5.1 XML | Subscription | Official ICAO source |
| Notamify | JSON, GeoJSON | API key | Enriched with geometry |
| EAD (EUROCONTROL) | AIXM 5.1 | EAD account | European NOTAMs |

### 3.5 Converting NOTAMs to Geofences

The core pipeline for AV integration:

```
NOTAM Source ──> Parse ──> Filter (airside-relevant) ──> Extract Geometry ──> Geofence
```

#### Step 1: Filter Relevant NOTAMs

Filter by Q-code second/third letter pairs:

```python
AIRSIDE_RELEVANT_QCODES = {
    'MX': 'taxiway',        # QMXLC = taxiway closed
    'MR': 'runway',         # QMRLC = runway closed
    'MA': 'apron',          # QMALC = apron closed
    'OB': 'obstacle',       # QOBCE = obstacle erected
    'FA': 'aerodrome_facility',
    'LX': 'taxiway_lighting',
    'LR': 'runway_lighting',
    'AH': 'aerodrome_service',
}
```

#### Step 2: Extract or Derive Geometry

For Digital NOTAMs (AIXM 5.1), geometry is embedded in GML elements. For traditional text NOTAMs:

1. **Q-line coordinates**: Latitude/longitude center point + radius in the Q-line (e.g., `5128N00027W005` = 51.47N, 0.45W, radius 5 NM). This gives a coarse circular geofence.
2. **Text parsing**: NLP or regex extraction of taxiway names, runway designators from E-line text. Cross-reference with airport geometry database (AMDB/AIXM) to get precise geometry.
3. **GeoJSON from APIs**: Laminar Data and other providers already compute GeoJSON polygons.

#### Step 3: Create AV Geofence

```python
from shapely.geometry import shape, mapping
import json

def notam_to_geofence(notam_geojson, buffer_meters=5.0):
    """Convert NOTAM GeoJSON to an AV-usable geofence with safety buffer."""
    geom = shape(notam_geojson['geometry'])

    # Buffer geometry by safety margin (in meters, project to local UTM first)
    buffered = geom.buffer(buffer_meters)

    return {
        'id': notam_geojson['properties']['id'],
        'type': notam_geojson['properties']['type'],  # closure, obstacle, WIP
        'geometry': mapping(buffered),
        'effective_start': notam_geojson['properties']['effectiveStart'],
        'effective_end': notam_geojson['properties']['effectiveEnd'],
        'severity': classify_severity(notam_geojson),  # BLOCK, CAUTION, INFO
        'source': 'NOTAM'
    }

def classify_severity(notam):
    """Classify NOTAM impact on AV operations."""
    qcode = notam['properties'].get('qcode', '')
    if 'LC' in qcode or 'CLS' in qcode:  # Closed
        return 'BLOCK'    # Hard geofence — AV must not enter
    elif 'LR' in qcode:  # Restricted
        return 'CAUTION'  # Soft geofence — AV may enter with restrictions
    else:
        return 'INFO'     # Awareness only
```

---

## 4. AIXM/AMXM Airport Geometry

### 4.1 The Need for Airport HD Maps

An autonomous vehicle on the airside needs a high-definition map of the airport surface, analogous to how road AVs use HD maps of highways and streets. This map must include:

- Runway boundaries and centerlines (no-go zones except at designated crossing points)
- Taxiway boundaries, centerlines, and connectivity
- Apron boundaries and surface types
- Aircraft stand/parking positions and their dimensions
- Service road boundaries and lane markings
- Building footprints (terminals, hangars, control tower)
- Vertical structures (light poles, ILS antenna, blast fences)
- Hold lines, stop bars, and painted markings
- Fuel hydrant locations, ground power units, fixed service installations

### 4.2 AIXM 5.1 (Aeronautical Information Exchange Model)

AIXM 5.1 is the international standard for encoding aeronautical information, based on GML 3.2.1 (OGC Geography Markup Language). It models the airport as a collection of features with spatial and temporal properties.

**Key airport feature classes in AIXM 5.1:**

| Feature Class | Geometry Type | Key Attributes |
|---------------|---------------|----------------|
| `AirportHeliport` | Point | ICAO designator, name, reference point, elevation, magnetic variation |
| `Runway` | Surface/Line | Designator, length, width, surface type, PCN strength |
| `RunwayElement` | Surface | Geometry of paved runway surface |
| `RunwayCentrelinePoint` | Point | Threshold, TDZ, midpoint, end |
| `Taxiway` | Surface | Designator, width, surface type |
| `TaxiwayElement` | Surface | Geometry of paved taxiway surface |
| `Apron` | Surface | Name, surface type |
| `ApronElement` | Surface | Geometry of paved apron surface |
| `AircraftStand` | Point/Surface | Stand designator, pier reference, availability |
| `VerticalStructure` | Point/Surface | Height, type (building, tower, crane) |
| `TouchDownLiftOff` | Surface | Helicopter landing areas |
| `GuidanceLine` | Line | Painted taxiway centerlines |

**AIXM 5.1 uses the TimeSlice mechanism** — every feature has a validity period. This naturally supports temporary changes (Digital NOTAMs are AIXM TimeSlice updates with `interpretation="TEMPDELTA"`).

### 4.3 AMXM (Aerodrome Mapping Exchange Model)

AMXM is the exchange format specified by EUROCAE ED-119C / RTCA DO-291C for Aerodrome Mapping Databases (AMDB). It is an XML Schema (GML 3.2.1 profile) specifically designed for detailed airport surface geometry.

**AMDB Feature Catalog (from EUROCAE/RTCA standard):**

| Feature | Geometry | Description |
|---------|----------|-------------|
| RunwayElement | Polygon | Paved runway surface area |
| RunwayIntersection | Polygon | Where runways cross |
| RunwayDisplacedArea | Polygon | Displaced threshold area |
| RunwayShoulderElement | Polygon | Paved shoulder beside runway |
| TaxiwayElement | Polygon | Paved taxiway surface |
| TaxiwayShoulder | Polygon | Taxiway shoulder |
| TaxiwayGuidanceLine | LineString | Painted centerline for taxi |
| TaxiwayHoldingPosition | Point/Line | Hold short line locations |
| TaxiwayIntersectionMarking | Point | Intersection marking locations |
| ApronElement | Polygon | Apron paved surface |
| StandArea | Polygon | Individual aircraft stand area |
| StandGuidanceLine | LineString | Stand entry guidance line |
| DeicingArea | Polygon | Aircraft deicing pad |
| PaintedCenterline | LineString | All painted centerlines |
| LandSurface | Polygon | Unpaved land |
| WaterSurface | Polygon | Water bodies |
| BlastPad | Polygon | Jet blast areas |
| VerticalPolygonalStructure | Polygon | Building footprints with height |
| VerticalPointStructure | Point | Light poles, antennas with height |
| Hotspot | Polygon | Incursion hotspot areas |
| ConstructionArea | Polygon | Active construction zones |

### 4.4 Data Sources

| Source | Coverage | Format | Access |
|--------|----------|--------|--------|
| FAA AIS Data | US airports | Shapefile, GeoJSON, KML | Free: `ais-faa.opendata.arcgis.com` |
| FAA NASR Subscription | US airports | CSV, Shapefile | Free: `faa.gov/air_traffic/flight_info/aeronav` |
| EUROCONTROL EAD | European airports | AIXM 5.1 XML | EAD account required |
| Jeppesen AMDB | Global (500+ airports) | ARINC 816, AMXM | Commercial license |
| Lufthansa Systems Lido AMDB | Global (300+ airports) | AMXM, GeoJSON | Commercial license |
| NAVBLUE AMDB | Global | AMXM | Commercial license |
| OpenStreetMap | Variable quality | OSM XML, GeoJSON | Free: `osm.org` |
| Custom survey | Specific airport | LAS/LAZ, GeoTIFF | LiDAR/photogrammetry survey |

For a production AV deployment at a specific airport, you will typically need to **combine** data:
1. Official AMDB data (Jeppesen/Lufthansa/NAVBLUE) for baseline geometry
2. LiDAR/photogrammetry survey for ground truth and additional detail
3. FAA/EUROCONTROL data for regulatory boundaries
4. Manual annotation for AV-specific features (service roads, vehicle hold lines)

### 4.5 ARINC 816 (Embedded Interchange Format)

ARINC 816 is designed for loading airport maps into avionics (e.g., cockpit moving map displays). It extends AMDB with:
- Tessellated polygons for efficient rendering
- Anchor points for label placement
- LOD (Level of Detail) support
- Compact binary encoding

While ARINC 816 is aviation-specific, its tessellated polygons can be useful as input for AV visualization and obstacle checking.

### 4.6 Conversion to Lanelet2 for AV Planning

Lanelet2 is the HD map framework used by Autoware, Apollo (partially), and many autonomous driving research stacks. It models road networks as:

- **Points**: 3D positions (OSM node format)
- **LineStrings**: Ordered sequences of points (lane boundaries)
- **Lanelets**: Directed lane segments bounded by left/right LineStrings
- **Areas**: Polygonal regions (parking areas, intersections)
- **Regulatory Elements**: Rules attached to lanelets (speed limits, right of way, traffic signs/lights)

**Mapping airport features to Lanelet2 primitives:**

| Airport Feature | Lanelet2 Primitive | Notes |
|-----------------|-------------------|-------|
| Taxiway centerline | Lanelet (left + right boundary) | Width from AMDB TaxiwayElement polygon |
| Taxiway intersection | Area | Multi-way junction area |
| Runway crossing point | Lanelet + Regulatory Element | SpeedLimit=0 (stop), RightOfWay (aircraft priority) |
| Apron driving lane | Lanelet | Derived from StandGuidanceLine + offset |
| Stand approach | Lanelet (dead-end) | Terminates at stand stop point |
| Service road | Lanelet | From custom survey/annotation |
| Hold line | Regulatory Element (TrafficSign) | `subtype=stop_sign` or custom `hold_line` |
| Runway | Area + Regulatory Element | `subtype=no_go_zone` — AV must never enter except at crossing |
| Speed restriction zone | Regulatory Element (SpeedLimit) | Airside speed limits (typically 15-25 km/h) |

**Conversion pipeline:**

```
AMDB/AIXM (Polygon) ──> Extract Centerlines ──> Generate Boundaries
       │                        │                       │
       │                        ▼                       ▼
       │                 Skeletonize         Offset left/right from centerline
       │                 (Voronoi/medial     by half taxiway width
       │                  axis)
       │                        │
       │                        ▼
       │              Lanelet2 primitives
       │                        │
       ▼                        ▼
 Regulatory Elements     .osm XML output
 (from hold lines,       (Lanelet2 map file)
  speed limits,
  crossing rules)
```

**Key conversion challenges:**
1. **Centerline extraction**: AMDB provides polygons, not centerlines. Medial axis / Voronoi skeleton extraction from taxiway polygons gives centerlines, but requires cleanup for complex geometries.
2. **Connectivity**: Ensuring topological connectivity at taxiway intersections. AMDB TaxiwayIntersection features help, but manual verification is needed.
3. **Directionality**: Taxiways are typically bidirectional, but Lanelets are directed. Create two opposing Lanelets or annotate as bidirectional.
4. **Regulatory elements**: Airport rules (hold lines, give-way to aircraft) need custom Lanelet2 regulatory element types.

**GeoJSON intermediate format** is practical for visualization and debugging:

```python
import geopandas as gpd
from shapely.ops import voronoi_diagram, unary_union

# Load AMDB taxiway polygons
taxiways = gpd.read_file('amdb_taxiway_elements.geojson')

# Extract centerlines via medial axis
for idx, tw in taxiways.iterrows():
    centerline = tw.geometry.representative_point()  # Simple
    # For proper centerline: use skimage.morphology.medial_axis
    # on rasterized polygon, then vectorize

# Write Lanelet2 .osm format
# (Use lanelet2 Python bindings: pip install lanelet2)
import lanelet2
from lanelet2.core import LaneletMap, Point3d, LineString3d, Lanelet
from lanelet2.io import write

lmap = LaneletMap()
# ... create points, linestrings, lanelets, regulatory elements
write("airport_map.osm", lmap, lanelet2.io.Origin(lat_origin, lon_origin))
```

---

## 5. A-SMGCS Surface Surveillance

### 5.1 Overview

A-SMGCS (Advanced Surface Movement Guidance and Control System) is the airport system for tracking all vehicles and aircraft on the movement area (runways + taxiways) and parts of the manoeuvring area (aprons). For the AV, A-SMGCS provides a **centralized, fused track picture** of every target on the airport surface — a surveillance feed far richer than what the AV's onboard sensors alone can provide.

### 5.2 A-SMGCS Levels (ICAO Doc 9830)

| Level | Capability | Sensors | AV Benefit |
|-------|-----------|---------|------------|
| **1 — Surveillance** | Track identification of aircraft and vehicles | SMR, MLAT, ADS-B | Basic position awareness of other targets |
| **2 — Surveillance + Safety Nets** | Runway incursion alerts, restricted area alerts | Level 1 + conflict detection logic | Alerts when AV approaches dangerous zones |
| **3 — Conflict Detection** | Full movement area conflict detection | Level 2 + planning data | Proactive conflict warnings for AV |
| **4 — Automatic Guidance** | Routing, guidance, automatic conflict resolution | Level 3 + lighting control, datalink | AV could receive routing commands directly |

Most major airports operate at Level 1-2. Some (Munich, Paris CDG, Heathrow) have elements of Level 3. Full Level 4 is rare.

### 5.3 A-SMGCS Sensor Components

| Sensor | What It Detects | Update Rate | Accuracy | Range |
|--------|----------------|-------------|----------|-------|
| **SMR** (Surface Movement Radar) | All targets (no transponder needed) | 1 Hz (1 revolution/sec) | 5-15m | 3-5 km radius |
| **MLAT** (Multilateration) | Transponder-equipped targets | 1 Hz | 3-7.5m | Airport area |
| **ADS-B** | ADS-B Out equipped targets | 2 Hz (surface) | GPS-dependent (5-15m) | Airport + approach |
| **SMR + MLAT fusion** | All targets, with ID | 1 Hz | 3-7m | Airport area |
| **Vehicle transponders** | Airport vehicles with transponders | 1 Hz | 3-7m | Airport area |

### 5.4 ASTERIX Data Format

EUROCONTROL's ASTERIX (All Purpose STructured Eurocontrol SuRveillance Information EXchange) is the standard binary protocol for surveillance data exchange. Three categories are relevant:

#### ASTERIX Category 010 — Monosensor Surface Movement Data

Category 010 carries raw target reports from individual surface sensors (SMR, MLAT, ADS-B ground stations).

**Key Data Items:**

| Item | Name | Content |
|------|------|---------|
| I010/010 | Data Source Identifier | SAC (=0 for local) + SIC |
| I010/020 | Target Report Descriptor | Detection type (PSR, SSR, Mode S, ADS-B, magnetic loop) |
| I010/040 | Measured Position in Polar | Range (1/128 NM) + Azimuth |
| I010/041 | Position in WGS-84 | Latitude + Longitude (32-bit, ~0.01m resolution) |
| I010/042 | Position in Cartesian | X, Y in meters from radar |
| I010/060 | Mode-3/A Code | Squawk |
| I010/091 | Measured Height | Height in feet |
| I010/131 | Amplitude of Primary Plot | Signal strength |
| I010/140 | Time of Day | 1/128 sec resolution |
| I010/161 | Track Number | Sensor-local track ID |
| I010/170 | Track Status | Confirmed/tentative, coasted, etc. |
| I010/200 | Calculated Ground Speed | Groundspeed + heading |
| I010/202 | Calculated Velocity (Cartesian) | Vx, Vy in m/s |
| I010/210 | Calculated Acceleration | Ax, Ay in m/s^2 |
| I010/220 | Target Address | 24-bit ICAO address |
| I010/245 | Target Identification | Callsign (8 chars) |
| I010/250 | Mode S MB Data | BDS register contents |
| I010/270 | Target Size and Orientation | Length, width, orientation |
| I010/280 | Presence | List of plot positions contributing to track |
| I010/300 | Vehicle Fleet ID | Vehicle type classification |
| I010/310 | Pre-programmed Message | Emergency, COM failure, etc. |
| I010/500 | Standard Deviation of Position | Position accuracy (sigma x, y) |
| I010/550 | System Status | NOGO, overload, etc. |

#### ASTERIX Category 011 — A-SMGCS Data (Fused Tracks)

Category 011 carries the **fused multi-sensor track picture** — this is the most useful feed for the AV as it combines all sensor data into coherent tracks.

**Key Data Items:**

| Item | Name | Content |
|------|------|---------|
| I011/000 | Message Type | Target report, flight plan correlation, holdbar status |
| I011/010 | Data Source Identifier | SAC + SIC |
| I011/015 | Service Identification | Service type |
| I011/041 | Position in WGS-84 | Lat/Lon (32-bit, ~8.38e-8 deg/LSB ≈ 0.01m) |
| I011/042 | Calculated Position (Cartesian) | X, Y (1m resolution, ±32768m range) |
| I011/060 | Mode-3/A Code | Squawk |
| I011/090 | Measured Flight Level | Altitude |
| I011/140 | Time of Track | 1/128 sec UTC |
| I011/161 | Track Number | Fused track ID |
| I011/170 | Track Status | MON/GBS/MRH/SRC/CNF + extensions |
| I011/202 | Calculated Track Velocity | Vx, Vy (0.25 m/s resolution) |
| I011/210 | Calculated Acceleration | Ax, Ay (0.25 m/s^2 resolution) |
| I011/215 | Calculated Rate of Climb | Vertical rate |
| I011/245 | Target Identification | Callsign/registration (6-bit encoded) |
| I011/270 | Target Size and Orientation | Length, width, heading of target |
| I011/290 | System Track Update Ages | Per-sensor age since last update |
| I011/300 | **Vehicle Fleet Identification** | Vehicle type code (see below) |
| I011/380 | Mode-S/ADS-B Related Data | Full ADS-B and Mode S data |
| I011/390 | Flight Plan Related Data | Callsign, aircraft type, departure/destination |
| I011/430 | Phase of Flight | Unknown, on stand, taxi, lineup, takeoff, etc. |
| I011/500 | Estimated Accuracies | Position, velocity accuracy estimates |

**Vehicle Fleet Identification (I011/300) codes:**

| Code | Vehicle Type |
|------|-------------|
| 0 | Unknown |
| 1 | ATC equipment maintenance |
| 2 | Airport maintenance |
| 3 | Fire |
| 4 | Bird scarer |
| 5 | Snow plough |
| 6 | Runway sweeper |
| 7 | Emergency |
| 8 | Police |
| 9 | Bus |
| 10 | Tug (with/without aircraft) |
| 11 | Grass cutter |
| 12 | Fuel |
| 13 | Baggage |
| 14 | Catering |
| 15 | Aircraft maintenance |
| 16 | Flyco (apron management) |

**Phase of Flight (I011/430) values:**

| Code | Phase |
|------|-------|
| 0 | Unknown |
| 1 | On stand |
| 2 | Taxiing for departure |
| 3 | Taxiing for arrival |
| 4 | Runway lineup |
| 5 | Takeoff roll |
| 6 | On approach/final |

#### ASTERIX Category 062 — System Track Data

Category 062 is the en-route/approach system track. While primarily for airborne surveillance, it is relevant for:
- Tracking aircraft on long final approach (predicting arrivals)
- Correlating with A-CDM ELDT milestones

**Key Data Items:**

| Item | Name | Content |
|------|------|---------|
| I062/010 | Data Source Identifier | SAC + SIC |
| I062/040 | Track Number | System track ID |
| I062/060 | Track Mode 3/A Code | Squawk |
| I062/070 | Time of Track | UTC timestamp |
| I062/100 | Calculated Track Position (Cartesian) | X, Y (0.5m resolution) |
| I062/105 | Calculated Position in WGS-84 | Lat/Lon |
| I062/130 | Calculated Track Geometric Altitude | GNSS altitude |
| I062/135 | Calculated Track Barometric Altitude | Baro altitude |
| I062/185 | Calculated Track Velocity (Cartesian) | Vx, Vy (0.25 m/s) |
| I062/200 | Mode of Movement | Climb, descend, level, cruise |
| I062/210 | Calculated Acceleration | Ax, Ay |
| I062/245 | Target Identification | Callsign |
| I062/270 | Target Size and Orientation | Dimensions |
| I062/340 | Measured Information | Per-sensor measurements |
| I062/380 | Aircraft Derived Data | Full ADS-B/Mode S derived data |
| I062/390 | Flight Plan Related Data | ICAO designator, type, wake category |
| I062/500 | Estimated Accuracies | Position, velocity accuracy bounds |

### 5.5 ASTERIX Decoding Libraries

| Library | Language | Cat 010 | Cat 011 | Cat 062 | License |
|---------|----------|---------|---------|---------|---------|
| CroatiaControlLtd/asterix | C++ | Yes | Yes | Yes | GPL |
| asterix-decoder (PyPI) | Python | Yes | Yes | Yes | MIT |
| pyAsterix (zoranbosnjak) | Python | Yes | Yes | Yes | MIT |
| Wireshark dissector | C (plugin) | Yes | Yes | Yes | GPL |
| libasterix (PyPI) | Python | Yes | Yes | Yes | MIT |

**Example with asterix-decoder:**

```python
from asterix_decoder import AsterixDecoder

decoder = AsterixDecoder()

# Parse raw ASTERIX binary data (e.g., from UDP multicast)
records = decoder.decode(raw_bytes)

for record in records:
    if record.category == 11:  # A-SMGCS fused track
        track_num = record['I011/161']['Track Number']
        lat = record['I011/041']['Latitude']
        lon = record['I011/041']['Longitude']
        vx = record['I011/202']['Vx']
        vy = record['I011/202']['Vy']
        vehicle_type = record.get('I011/300', {}).get('VFI', 'unknown')
        callsign = record.get('I011/245', {}).get('Target Identification', '')
        phase = record.get('I011/430', {}).get('Phase of Flight', 0)

        print(f"Track {track_num}: ({lat:.6f}, {lon:.6f}) "
              f"v=({vx:.1f}, {vy:.1f}) m/s "
              f"type={vehicle_type} cs={callsign} phase={phase}")
```

### 5.6 Accessing A-SMGCS Data

A-SMGCS data is typically distributed within the airport network via:

1. **UDP Multicast**: ASTERIX binary on multicast groups (e.g., 239.x.x.x:port). The AV system joins the multicast group on the airport LAN.
2. **TCP Server**: Some systems expose ASTERIX over TCP connections.
3. **AMQP/JMS**: Modern SWIM-compliant installations may distribute ASTERIX via message broker.
4. **Proprietary APIs**: A-SMGCS vendors (Thales, Indra, Frequentis, SAAB) may offer REST/WebSocket APIs.

**Integration requirements**: The AV must be connected to the airport operational network. This typically requires:
- Dedicated network interface on the AV
- Airport IT security approval and network segmentation
- VPN or encrypted tunnel for wireless connectivity (4G/5G/WiFi)
- Service level agreement (SLA) for data availability

---

## 6. AODB (Airport Operational Database)

### 6.1 What AODB Provides

The AODB is the central repository for all operational data at an airport. It ingests data from dozens of sources and provides a unified, real-time view of airport operations. For the AV, AODB is the **authoritative source for flight schedules, gate/stand assignments, and resource allocations**.

### 6.2 Core Data Elements

#### Flight Record

| Field | Description | AV Use |
|-------|-------------|--------|
| Flight number | IATA/ICAO flight designator | Correlation with ADS-B/A-CDM |
| Airline code | Operating carrier | Service requirements lookup |
| Aircraft type | ICAO type designator (B738, A320, etc.) | Wingspan/dimensions for clearance |
| Registration | Aircraft tail number | Unique aircraft ID |
| Origin/Destination | Airport ICAO codes | Arrival vs. departure determination |
| Status | Scheduled, en-route, landed, boarding, departed | Operational state |
| STA/STD | Scheduled time of arrival/departure | Planning baseline |
| ETA/ETD | Estimated time of arrival/departure | Updated prediction |
| ATA/ATD | Actual time of arrival/departure | Confirmed event |
| Terminal | Terminal designation | Zoning for AV operations |
| Gate | Passenger gate number | Passenger-side reference |
| Stand | Aircraft parking position designation | **Primary AV reference** |
| Runway | Assigned runway | Crossing planning |
| Carousel/Belt | Baggage claim number | Baggage vehicle routing |
| Check-in counters | Assigned counter range | Ground handler activity indicator |

#### Resource Allocation

| Resource | Fields | AV Relevance |
|----------|--------|--------------|
| Stand allocation | Stand ID, allocated time window, aircraft type constraint | **Determines where aircraft will park — AV must route to/from stands** |
| Gate allocation | Gate ID, open/close times | Passenger flow indicator |
| Baggage belt | Belt ID, flight association, active period | Baggage tug routing |
| Bus gate | Bus gate ID, remote stand association | Bus/vehicle movement prediction |
| Deicing pad | Pad ID, allocated time | Deicing vehicle movement |
| Tow assignment | Tow path, aircraft, timing | **Tow tractor will cross taxiways** |

### 6.3 Major AODB Vendors and APIs

| Vendor | Product | API Type | Protocol |
|--------|---------|----------|----------|
| **SITA** | Operations Manager (AMS) | REST | OAuth2 + HTTPS |
| **Amadeus** | AODB | REST + SOAP | OAuth2 + HTTPS |
| **ADB SAFEGATE** | iAODB | REST | API key + HTTPS |
| **TAV Technologies** | AODB | REST + Message Bus | Proprietary |
| **Intersystems** | RapidHub | REST + AMQP | OAuth2 |
| **ProDIGIQ** | AODB | SOAP + REST | API key |

#### SITA Developer APIs

SITA exposes several REST APIs at `developer.aero`:

**Flight Status API:**
```http
GET https://api.developer.aero/flight-status/v2/flights
  ?airport=EGLL
  &direction=departure
  &dateLocal=2026-03-21
Authorization: Bearer <OAuth2_token>

Response:
{
  "flights": [
    {
      "flightNumber": "BA123",
      "airline": { "iata": "BA", "icao": "BAW" },
      "departure": {
        "airport": { "iata": "LHR", "icao": "EGLL" },
        "terminal": "5",
        "gate": "A10",
        "scheduledTime": "2026-03-21T14:30:00Z",
        "estimatedTime": "2026-03-21T14:45:00Z",
        "actualTime": null,
        "status": "BOARDING"
      },
      "aircraft": {
        "model": "Airbus A320",
        "registration": "G-EUUD"
      }
    }
  ]
}
```

**Airport API:**
```http
GET https://api.developer.aero/airport/v1/airports/EGLL
Authorization: Bearer <OAuth2_token>
```

**FIDS API (Flight Information Display):**
```http
GET https://api.developer.aero/fids/v1/flights
  ?airport=EGLL
  &terminal=5
Authorization: Bearer <OAuth2_token>
```

### 6.4 ACARS OOOI Integration

ACARS (Aircraft Communications Addressing and Reporting System) provides the **actual** aircraft movement milestones via automatic sensor detection:

| Event | Trigger Sensor | ACARS Message | AODB Update |
|-------|---------------|---------------|-------------|
| **OUT** | Parking brake released + door closed | Movement message type H1 | ATD (Actual Time of Departure from gate) |
| **OFF** | Weight-on-wheels switches to airborne | Movement message type H2 | ATOT (Actual Take-Off Time) |
| **ON** | Weight-on-wheels switches to ground | Movement message type H3 | ALDT (Actual Landing Time) |
| **IN** | Parking brake set + door opened | Movement message type H4 | ATA (Actual Time of Arrival at gate) |

**OOOI data flow for AV:**
```
Aircraft ACARS ──> Airline Operations Center ──> AODB ──> AV System
                                                  │
                                                  └──> A-CDM Platform
```

The `OUT` event is the most time-critical for the AV: it means the aircraft is actively pushing back and the stand area must be clear. The `IN` event signals the turnaround beginning, predicting service vehicle arrivals.

### 6.5 Common Integration Patterns

#### Message Bus (Recommended)

```
AODB ──> Message Broker (RabbitMQ/Kafka) ──> AV Fleet Management
              │                                       │
              ├── Topic: flights.departure.stand_change
              ├── Topic: flights.arrival.landed
              ├── Topic: flights.departure.pushback
              ├── Topic: resources.stand.allocated
              └── Topic: resources.stand.released
```

#### Polling REST API

```python
import requests
import time

AODB_URL = "https://aodb.airport.local/api/v1"
API_KEY = "..."

def poll_flight_updates(airport_icao, interval_sec=30):
    """Poll AODB for flight updates relevant to AV operations."""
    while True:
        response = requests.get(
            f"{AODB_URL}/flights",
            params={
                'airport': airport_icao,
                'status': 'BOARDING,READY,PUSHBACK,TAXIING',
                'since': last_poll_time,
            },
            headers={'Authorization': f'Bearer {API_KEY}'}
        )
        flights = response.json()['flights']
        for flight in flights:
            if flight['status'] == 'PUSHBACK':
                # CRITICAL: Aircraft pushing back from stand
                publish_pushback_alert(flight['stand'], flight)
            elif flight['status'] == 'TAXIING':
                # Aircraft moving on taxiway
                publish_taxi_alert(flight)
        time.sleep(interval_sec)
```

---

## 7. ROS Implementation Architecture

### 7.1 System Overview

The airport data integration system is implemented as a set of ROS 2 nodes, each responsible for interfacing with one external data source. All nodes publish to standardized topics that the AV's planning and safety systems consume.

```
┌─────────────────────────────────────────────────────────┐
│                    AV Planning Stack                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ Behavior │  │   Route   │  │  Safety / Geofence   │  │
│  │ Planner  │  │  Planner  │  │      Monitor         │  │
│  └────▲─────┘  └─────▲─────┘  └──────────▲───────────┘  │
│       │              │                    │              │
│  ─────┴──────────────┴────────────────────┴──────────── │
│              ROS 2 Topic Layer (DDS)                     │
│  ──────────────────────────────────────────────────────  │
│       │              │           │        │        │     │
│  ┌────┴────┐  ┌──────┴───┐  ┌───┴──┐  ┌──┴──┐  ┌──┴──┐ │
│  │ ADS-B   │  │  A-CDM   │  │NOTAM │  │ASMGCS│  │AODB │ │
│  │  Node   │  │  Node    │  │ Node │  │ Node │  │Node │ │
│  └────┬────┘  └──────┬───┘  └───┬──┘  └──┬──┘  └──┬──┘ │
│       │              │          │        │        │     │
└───────┼──────────────┼──────────┼────────┼────────┼─────┘
        │              │          │        │        │
   ┌────┴────┐  ┌──────┴───┐  ┌──┴───┐ ┌──┴──┐ ┌──┴──┐
   │RTL-SDR  │  │EUROCONTROL│ │FAA   │ │UDP  │ │SITA │
   │readsb   │  │NM B2B    │ │SWIM  │ │MCAST│ │ API │
   └─────────┘  └──────────┘  └──────┘ └─────┘ └─────┘
```

### 7.2 Custom Message Definitions

#### airport_msgs/msg/AircraftState.msg
```
std_msgs/Header header

# Identification
string icao_hex          # 24-bit ICAO address (hex string, e.g., "A1B2C3")
string callsign          # Flight callsign (e.g., "UAL123")
string registration      # Aircraft registration (e.g., "N12345")
string aircraft_type     # ICAO type code (e.g., "B738")
uint8 emitter_category   # ADS-B category (A0-C7)

# Position
float64 latitude         # WGS-84 degrees
float64 longitude        # WGS-84 degrees
float32 altitude_baro    # Barometric altitude, feet (NaN if on ground)
float32 altitude_geo     # Geometric altitude, feet (NaN if unavailable)
bool on_ground           # True if alt_baro == "ground" or surface msg

# Velocity
float32 ground_speed     # Knots
float32 track            # True track, degrees clockwise from north
float32 vertical_rate    # Feet per minute (NaN if unavailable)

# Quality
uint8 nic                # Navigation Integrity Category (0-8)
float32 containment_radius  # Radius of containment, meters
float32 signal_strength  # RSSI in dBFS
float64 position_age     # Seconds since last position update
float64 message_age      # Seconds since any message

# Source
uint8 SOURCE_ADSB=0
uint8 SOURCE_MLAT=1
uint8 SOURCE_TISB=2
uint8 SOURCE_ASMGCS=3
uint8 source_type
```

#### airport_msgs/msg/FlightMilestone.msg
```
std_msgs/Header header

string callsign
string flight_number     # IATA flight number
string aircraft_type
string registration
string stand             # Stand/gate designator
string runway

# A-CDM Times (all as ROS Time, zero if unknown)
builtin_interfaces/Time eobt    # Estimated Off-Block Time
builtin_interfaces/Time tobt    # Target Off-Block Time
builtin_interfaces/Time tsat    # Target Start-Up Approval Time
builtin_interfaces/Time ctot    # Calculated Take-Off Time
builtin_interfaces/Time ttot    # Target Take-Off Time
builtin_interfaces/Time eldt    # Estimated Landing Time
builtin_interfaces/Time eibt    # Estimated In-Block Time

# Actual times (zero if not yet occurred)
builtin_interfaces/Time aobt    # Actual Off-Block Time
builtin_interfaces/Time aibt    # Actual In-Block Time
builtin_interfaces/Time aldt    # Actual Landing Time
builtin_interfaces/Time atot    # Actual Take-Off Time

# Turnaround state
uint8 TURNAROUND_NONE=0
uint8 TURNAROUND_ARRIVED=1
uint8 TURNAROUND_HANDLING=2
uint8 TURNAROUND_BOARDING=3
uint8 TURNAROUND_READY=4
uint8 TURNAROUND_PUSHBACK=5
uint8 turnaround_state

# Current milestone
uint8 current_milestone   # 1-16 per A-CDM spec
```

#### airport_msgs/msg/Geofence.msg
```
std_msgs/Header header

string id                # Unique geofence ID
string source            # "NOTAM", "ASMGCS", "MANUAL"
string description       # Human-readable description

# Severity
uint8 SEVERITY_INFO=0
uint8 SEVERITY_CAUTION=1
uint8 SEVERITY_BLOCK=2
uint8 severity

# Geometry (GeoJSON-encoded polygon)
string geojson_geometry  # GeoJSON geometry string

# Validity period
builtin_interfaces/Time effective_start
builtin_interfaces/Time effective_end

# Speed restriction (if CAUTION)
float32 max_speed_mps    # Maximum speed in m/s (NaN if no restriction)
```

#### airport_msgs/msg/SurfaceTrack.msg
```
std_msgs/Header header

uint32 track_id           # A-SMGCS track number
string callsign           # Callsign or vehicle ID
string icao_hex            # ICAO address if available

# Classification
uint8 TARGET_UNKNOWN=0
uint8 TARGET_AIRCRAFT=1
uint8 TARGET_VEHICLE=2
uint8 TARGET_OBSTACLE=3
uint8 target_type

uint8 vehicle_fleet_id    # I011/300 code (0=unknown, 3=fire, 10=tug, etc.)

# Position
float64 latitude
float64 longitude
float32 x_cartesian       # Meters from airport reference point
float32 y_cartesian       # Meters from airport reference point

# Velocity
float32 vx                # m/s (north component)
float32 vy                # m/s (east component)
float32 ax                # m/s^2 (north acceleration)
float32 ay                # m/s^2 (east acceleration)

# Quality
float32 position_sigma_x  # Position std dev, meters
float32 position_sigma_y  # Position std dev, meters
bool confirmed             # Confirmed vs tentative track
float64 age                # Seconds since last update

# Phase
uint8 PHASE_UNKNOWN=0
uint8 PHASE_ON_STAND=1
uint8 PHASE_TAXI_DEPARTURE=2
uint8 PHASE_TAXI_ARRIVAL=3
uint8 PHASE_LINEUP=4
uint8 PHASE_TAKEOFF=5
uint8 phase
```

#### airport_msgs/msg/StandStatus.msg
```
std_msgs/Header header

string stand_id
string terminal

# Occupancy
bool occupied
string occupying_flight    # Flight number if occupied
string aircraft_type       # ICAO type if occupied
string registration

# Timing
builtin_interfaces/Time occupied_since
builtin_interfaces/Time expected_departure   # TOBT from A-CDM

# Turnaround services active
bool fuel_active
bool catering_active
bool baggage_active
bool cleaning_active
bool boarding_active
bool pushback_imminent     # TOBT - now < threshold (e.g., 10 min)
```

### 7.3 Node Implementations

#### ADS-B Node

```
Node: adsb_receiver_node
─────────────────────────
Subscribes to: (none — external data source)
Publishes to:
  /airport/adsb/aircraft_states    [airport_msgs/AircraftState]  @ varies (per-aircraft)
  /airport/adsb/aircraft_list      [airport_msgs/AircraftStateArray]  @ 1 Hz
  /airport/adsb/diagnostics        [diagnostic_msgs/DiagnosticStatus]  @ 0.2 Hz

Parameters:
  readsb_url: "http://localhost:8080"    # readsb JSON endpoint
  poll_rate_hz: 2.0                       # JSON polling frequency
  max_position_age_sec: 10.0              # Discard stale positions
  airport_lat: 51.4706                    # Airport reference for distance filter
  airport_lon: -0.4619
  max_range_nm: 5.0                       # Only publish targets within range
  surface_only: true                      # Only publish on-ground targets
```

**Implementation approach:**

```python
import rclpy
from rclpy.node import Node
import requests
import math
from airport_msgs.msg import AircraftState, AircraftStateArray

class AdsbReceiverNode(Node):
    def __init__(self):
        super().__init__('adsb_receiver_node')

        # Parameters
        self.declare_parameter('readsb_url', 'http://localhost:8080')
        self.declare_parameter('poll_rate_hz', 2.0)
        self.declare_parameter('max_position_age_sec', 10.0)
        self.declare_parameter('airport_lat', 0.0)
        self.declare_parameter('airport_lon', 0.0)
        self.declare_parameter('max_range_nm', 5.0)
        self.declare_parameter('surface_only', True)

        self.url = self.get_parameter('readsb_url').value
        poll_rate = self.get_parameter('poll_rate_hz').value

        # Publishers
        self.pub_states = self.create_publisher(
            AircraftState, '/airport/adsb/aircraft_states', 10)
        self.pub_list = self.create_publisher(
            AircraftStateArray, '/airport/adsb/aircraft_list', 10)

        # Timer
        self.timer = self.create_timer(1.0 / poll_rate, self.poll_readsb)
        self.get_logger().info(f'ADS-B node started, polling {self.url}')

    def poll_readsb(self):
        try:
            resp = requests.get(
                f'{self.url}/data/aircraft.json', timeout=2.0)
            data = resp.json()
        except Exception as e:
            self.get_logger().warn(f'readsb poll failed: {e}')
            return

        now = data.get('now', 0)
        aircraft_list = []

        for ac in data.get('aircraft', []):
            # Filter: must have position
            if 'lat' not in ac or 'lon' not in ac:
                continue
            # Filter: position freshness
            if ac.get('seen_pos', 999) > self.get_parameter(
                    'max_position_age_sec').value:
                continue
            # Filter: surface only
            if self.get_parameter('surface_only').value:
                if ac.get('alt_baro') != 'ground' and \
                   ac.get('type', '') not in ('adsb_icao',) or \
                   (isinstance(ac.get('alt_baro'), (int, float)) and
                    ac['alt_baro'] > 500):
                    continue
            # Filter: range
            # ... distance check against airport reference ...

            msg = AircraftState()
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.icao_hex = ac.get('hex', '')
            msg.callsign = ac.get('flight', '').strip()
            msg.registration = ac.get('r', '')
            msg.aircraft_type = ac.get('t', '')
            msg.latitude = ac['lat']
            msg.longitude = ac['lon']
            msg.on_ground = (ac.get('alt_baro') == 'ground')
            msg.ground_speed = float(ac.get('gs', 0))
            msg.track = float(ac.get('track', 0))
            msg.nic = int(ac.get('nic', 0))
            msg.containment_radius = float(ac.get('rc', 999))
            msg.signal_strength = float(ac.get('rssi', -50))
            msg.position_age = float(ac.get('seen_pos', 0))
            msg.message_age = float(ac.get('seen', 0))

            self.pub_states.publish(msg)
            aircraft_list.append(msg)

        # Publish consolidated list at lower rate
        list_msg = AircraftStateArray()
        list_msg.header.stamp = self.get_clock().now().to_msg()
        list_msg.aircraft = aircraft_list
        self.pub_list.publish(list_msg)
```

**Error handling:**
- HTTP timeout: Log warning, skip cycle, retry next period. After N consecutive failures, publish diagnostic ERROR status.
- JSON parse error: Log and skip cycle.
- readsb process crash: Implement watchdog that restarts readsb via systemd.
- RTL-SDR device disconnect: readsb will log errors; the node monitors readsb health via its stats.json endpoint.

#### A-CDM Node

```
Node: acdm_node
─────────────────
Subscribes to: (none — external data source)
Publishes to:
  /airport/acdm/flight_milestones  [airport_msgs/FlightMilestone]  @ event-driven
  /airport/acdm/pushback_alerts    [airport_msgs/FlightMilestone]  @ event-driven
  /airport/acdm/stand_status       [airport_msgs/StandStatus]      @ 0.1 Hz (per stand)
  /airport/acdm/diagnostics        [diagnostic_msgs/DiagnosticStatus]  @ 0.2 Hz

Parameters:
  acdm_api_url: "https://acdm.airport.local/api/v1"
  auth_token: "<token>"
  poll_interval_sec: 30
  pushback_alert_threshold_min: 10   # Alert when TOBT is within N minutes
  amqp_enabled: false                # Use AMQP Pub/Sub if available
  amqp_broker_url: "amqp://broker.airport.local:5672"
  amqp_queue: "acdm.milestones"
```

**Key behaviors:**
- Poll A-CDM API every 30 seconds for flight milestone updates.
- When `TOBT - current_time < pushback_alert_threshold_min`, publish a high-priority pushback alert.
- Maintain a local cache of stand status, updated from milestone data.
- If AMQP is available, prefer real-time subscription over polling.

**Update rates:**
- Milestone data changes infrequently (minutes between updates per flight).
- Stand status: publish at 0.1 Hz or on-change.
- Pushback alert: publish immediately when threshold crossed.

#### NOTAM Node

```
Node: notam_node
─────────────────
Subscribes to: (none — external data source)
Publishes to:
  /airport/notam/geofences          [airport_msgs/Geofence]        @ on-change
  /airport/notam/active_geofences   [airport_msgs/GeofenceArray]   @ 0.05 Hz (every 20s)
  /airport/notam/diagnostics        [diagnostic_msgs/DiagnosticStatus]  @ 0.2 Hz

Parameters:
  notam_source: "faa_swim"    # "faa_swim", "laminar_data", "eurocontrol_ead"
  api_url: "https://..."
  api_key: "<key>"
  airport_icao: "KJFK"
  poll_interval_sec: 300       # NOTAMs change slowly — 5 min is fine
  geometry_buffer_meters: 5.0  # Safety buffer around NOTAM areas
  airport_geometry_file: "/opt/av/maps/amdb_kjfk.geojson"  # For text NOTAM geocoding
```

**Processing pipeline:**
1. Fetch active NOTAMs for the airport (poll or subscription).
2. Filter to airside-relevant Q-codes (runway, taxiway, apron, obstacle, WIP).
3. Extract or derive geometry:
   - Digital NOTAM: Parse AIXM 5.1 XML, extract GML geometry.
   - GeoJSON API (Laminar): Use geometry directly.
   - Text NOTAM: Parse taxiway/runway designator from E-line, look up geometry from AMDB reference file.
4. Apply safety buffer.
5. Classify severity (BLOCK / CAUTION / INFO).
6. Publish as Geofence messages.
7. Manage lifecycle: remove expired NOTAMs, add new ones.

**Update rate:** NOTAMs are relatively static (hours to days). Polling every 5 minutes is adequate. The node should check effective_start/effective_end times and only publish currently-active geofences.

#### A-SMGCS Node

```
Node: asmgcs_node
──────────────────
Subscribes to: (none — external data source: UDP multicast)
Publishes to:
  /airport/asmgcs/surface_tracks    [airport_msgs/SurfaceTrack]    @ ~1 Hz per track
  /airport/asmgcs/track_list        [airport_msgs/SurfaceTrackArray] @ 1 Hz
  /airport/asmgcs/diagnostics       [diagnostic_msgs/DiagnosticStatus]  @ 0.2 Hz

Parameters:
  multicast_group: "239.1.1.1"
  multicast_port: 30010
  network_interface: "eth1"        # Airport network interface
  asterix_category: 11             # Cat 011 for fused A-SMGCS tracks
  airport_ref_lat: 51.4706         # For Cartesian-to-WGS84 conversion
  airport_ref_lon: -0.4619
  max_track_age_sec: 5.0           # Drop tracks not updated within N seconds
  publish_vehicles_only: false     # If true, filter to vehicle tracks only
```

**Implementation approach:**

```python
import socket
import struct
from asterix_decoder import AsterixDecoder

class AsmgcsNode(Node):
    def __init__(self):
        super().__init__('asmgcs_node')
        # ... parameter declarations ...

        self.decoder = AsterixDecoder()
        self.tracks = {}  # track_id -> SurfaceTrack

        # Join multicast group
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(('', self.multicast_port))
        mreq = struct.pack(
            '4s4s',
            socket.inet_aton(self.multicast_group),
            socket.inet_aton('0.0.0.0')
        )
        self.sock.setsockopt(
            socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        self.sock.setblocking(False)

        # Publishers
        self.pub_tracks = self.create_publisher(
            SurfaceTrack, '/airport/asmgcs/surface_tracks', 50)
        self.pub_list = self.create_publisher(
            SurfaceTrackArray, '/airport/asmgcs/track_list', 10)

        # Timers
        self.create_timer(0.05, self.read_asterix)  # 20 Hz read loop
        self.create_timer(1.0, self.publish_track_list)  # 1 Hz consolidation
        self.create_timer(1.0, self.prune_stale_tracks)

    def read_asterix(self):
        try:
            data, addr = self.sock.recvfrom(65535)
        except BlockingIOError:
            return

        records = self.decoder.decode(data)
        for record in records:
            if record.category == 11:
                self.process_cat011(record)
            elif record.category == 10:
                self.process_cat010(record)

    def process_cat011(self, record):
        track_id = record.get('I011/161', {}).get('Track Number', 0)
        msg = SurfaceTrack()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.track_id = track_id

        # Position
        if 'I011/041' in record:
            msg.latitude = record['I011/041']['Latitude']
            msg.longitude = record['I011/041']['Longitude']
        if 'I011/042' in record:
            msg.x_cartesian = record['I011/042']['X']
            msg.y_cartesian = record['I011/042']['Y']

        # Velocity
        if 'I011/202' in record:
            msg.vx = record['I011/202']['Vx']
            msg.vy = record['I011/202']['Vy']

        # Acceleration
        if 'I011/210' in record:
            msg.ax = record['I011/210']['Ax']
            msg.ay = record['I011/210']['Ay']

        # Classification
        if 'I011/300' in record:
            msg.vehicle_fleet_id = record['I011/300']['VFI']
            msg.target_type = SurfaceTrack.TARGET_VEHICLE
        else:
            msg.target_type = SurfaceTrack.TARGET_AIRCRAFT

        # Identity
        if 'I011/245' in record:
            msg.callsign = record['I011/245']['Target Identification']
        if 'I011/390' in record:
            msg.callsign = record['I011/390'].get('Callsign', msg.callsign)

        # Phase
        if 'I011/430' in record:
            msg.phase = record['I011/430']['Phase of Flight']

        # Quality
        if 'I011/500' in record:
            msg.position_sigma_x = record['I011/500'].get('Sigma X', 0)
            msg.position_sigma_y = record['I011/500'].get('Sigma Y', 0)
        if 'I011/170' in record:
            msg.confirmed = record['I011/170'].get('CNF', 0) == 0

        self.tracks[track_id] = msg
        self.pub_tracks.publish(msg)
```

**Error handling:**
- Socket timeout/no data: Log warning if no data received for > 5 seconds. Publish diagnostic WARN.
- ASTERIX decode error: Log and skip malformed records. Increment error counter.
- Network disconnect: Detect via absence of data. Attempt to rejoin multicast group.
- Track management: Prune tracks not updated within `max_track_age_sec`. Publish track drop notification.

#### AODB Node

```
Node: aodb_node
────────────────
Subscribes to: (none — external data source)
Publishes to:
  /airport/aodb/flight_updates     [airport_msgs/FlightMilestone]   @ on-change
  /airport/aodb/stand_allocations  [airport_msgs/StandStatus]       @ on-change
  /airport/aodb/diagnostics        [diagnostic_msgs/DiagnosticStatus]  @ 0.2 Hz

Parameters:
  api_url: "https://api.developer.aero/flight-status/v2"
  api_key: "<key>"
  airport_icao: "EGLL"
  poll_interval_sec: 60
  use_message_bus: false
  message_bus_url: "amqp://..."
  message_bus_topics: ["flights.#", "resources.stand.#"]
```

**Key behaviors:**
- Poll SITA/Amadeus API for flight status every 60 seconds.
- Track stand allocation changes — publish when a stand becomes occupied or released.
- Correlate with A-CDM data to enrich flight records with milestones.
- If message bus is available, subscribe to real-time events (preferred over polling).

### 7.4 Topic Architecture Summary

| Topic | Message Type | Rate | Source Node | Primary Consumer |
|-------|-------------|------|-------------|-----------------|
| `/airport/adsb/aircraft_states` | AircraftState | ~2 Hz/aircraft | adsb_receiver_node | Safety monitor, behavior planner |
| `/airport/adsb/aircraft_list` | AircraftStateArray | 1 Hz | adsb_receiver_node | Visualization, fleet manager |
| `/airport/acdm/flight_milestones` | FlightMilestone | On-change | acdm_node | Route planner, stand approach |
| `/airport/acdm/pushback_alerts` | FlightMilestone | Event-driven | acdm_node | **Safety monitor** (high priority) |
| `/airport/acdm/stand_status` | StandStatus | 0.1 Hz/stand | acdm_node | Stand approach planner |
| `/airport/notam/geofences` | Geofence | On-change | notam_node | Route planner, safety monitor |
| `/airport/notam/active_geofences` | GeofenceArray | 0.05 Hz | notam_node | Route planner (periodic refresh) |
| `/airport/asmgcs/surface_tracks` | SurfaceTrack | ~1 Hz/track | asmgcs_node | **Safety monitor, behavior planner** |
| `/airport/asmgcs/track_list` | SurfaceTrackArray | 1 Hz | asmgcs_node | Visualization, prediction |
| `/airport/aodb/flight_updates` | FlightMilestone | On-change | aodb_node | Fleet manager, scheduling |
| `/airport/aodb/stand_allocations` | StandStatus | On-change | aodb_node | Route planner |

### 7.5 QoS Profiles

```python
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy

# Safety-critical: ADS-B states, A-SMGCS tracks, pushback alerts
SAFETY_QOS = QoSProfile(
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.VOLATILE,
    history=HistoryPolicy.KEEP_LAST,
    depth=10,
)

# Planning data: milestones, stand status, geofences
PLANNING_QOS = QoSProfile(
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.TRANSIENT_LOCAL,  # Late joiners get last value
    history=HistoryPolicy.KEEP_LAST,
    depth=5,
)

# Best-effort: aircraft list, track list (consolidated views)
MONITORING_QOS = QoSProfile(
    reliability=ReliabilityPolicy.BEST_EFFORT,
    durability=DurabilityPolicy.VOLATILE,
    history=HistoryPolicy.KEEP_LAST,
    depth=1,
)
```

### 7.6 Data Fusion and Correlation

A critical challenge is correlating data across sources. The same aircraft appears in:
- ADS-B (identified by ICAO hex address + callsign)
- A-CDM (identified by callsign + registration)
- A-SMGCS (identified by track number + callsign)
- AODB (identified by flight number + registration)

**Correlation node:**

```
Node: airport_data_fusion_node
───────────────────────────────
Subscribes to:
  /airport/adsb/aircraft_states     [AircraftState]
  /airport/asmgcs/surface_tracks    [SurfaceTrack]
  /airport/acdm/flight_milestones   [FlightMilestone]
  /airport/aodb/flight_updates      [FlightMilestone]

Publishes to:
  /airport/fused/tracked_objects    [airport_msgs/TrackedAirportObject]  @ 2 Hz
```

**Correlation logic:**
1. **Primary key**: ICAO hex address (unique per aircraft, available in ADS-B and A-SMGCS)
2. **Secondary key**: Callsign (available in all sources, but may have formatting differences — trim whitespace, handle ICAO vs IATA callsign)
3. **Tertiary key**: Registration (available in AODB and sometimes ADS-B database lookup)
4. **Spatial matching**: When identity keys fail, use position proximity (< 50m) and velocity similarity for A-SMGCS-to-ADS-B association.

```python
def correlate(adsb_state, asmgcs_tracks, acdm_flights, aodb_flights):
    """Fuse data from multiple sources for a single aircraft."""
    fused = TrackedAirportObject()

    # Position: prefer A-SMGCS (fused, usually more accurate on surface)
    # Fall back to ADS-B if A-SMGCS track not available
    matching_track = find_asmgcs_match(adsb_state, asmgcs_tracks)
    if matching_track and matching_track.confirmed:
        fused.latitude = matching_track.latitude
        fused.longitude = matching_track.longitude
        fused.vx = matching_track.vx
        fused.vy = matching_track.vy
        fused.position_source = 'ASMGCS'
    else:
        fused.latitude = adsb_state.latitude
        fused.longitude = adsb_state.longitude
        fused.position_source = 'ADSB'

    # Timing: from A-CDM/AODB
    matching_flight = find_acdm_match(adsb_state.callsign, acdm_flights)
    if matching_flight:
        fused.tobt = matching_flight.tobt
        fused.tsat = matching_flight.tsat
        fused.stand = matching_flight.stand
        fused.turnaround_state = matching_flight.turnaround_state

    return fused
```

### 7.7 Error Handling Strategy

| Failure Mode | Detection | Response | Recovery |
|-------------|-----------|----------|----------|
| readsb process dead | No JSON response for > 10s | Publish STALE diagnostic, zero out aircraft list | Systemd auto-restart readsb |
| RTL-SDR device lost | readsb error log / no messages | Publish HARDWARE_FAULT diagnostic | USB re-enumeration, device reconnect |
| A-CDM API unreachable | HTTP timeout/error | Use cached data, mark as STALE | Exponential backoff retry |
| A-CDM data stale | TOBT not updated for > 30 min | Flag affected flights as LOW_CONFIDENCE | Continue with last-known values |
| NOTAM API failure | HTTP error | Continue with cached active geofences | Retry every poll interval |
| A-SMGCS no data | No UDP packets for > 5s | Publish LOST_FEED diagnostic, **critical safety alert** | Attempt multicast rejoin |
| A-SMGCS track loss | Track age > max_track_age_sec | Remove from published track list | Track reacquisition handled by A-SMGCS |
| AODB API failure | HTTP error | Use cached flight/stand data | Exponential backoff retry |
| Network partition | Multiple sources fail simultaneously | **Switch to degraded mode**: rely on onboard sensors only | Network reconnect monitoring |

**Degraded mode hierarchy:**
1. **Full integration**: All sources available — use fused data for planning.
2. **Partial degradation**: One or more sources unavailable — use remaining sources with increased safety margins.
3. **Onboard only**: All external sources lost — **reduce speed, increase following distance, request manual clearance for runway crossings**.

### 7.8 Launch Configuration

```python
# launch/airport_data_integration.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('airport_icao', default_value='EGLL'),
        DeclareLaunchArgument('airport_lat', default_value='51.4706'),
        DeclareLaunchArgument('airport_lon', default_value='-0.4619'),

        Node(
            package='airport_data_integration',
            executable='adsb_receiver_node',
            name='adsb_receiver',
            parameters=[{
                'readsb_url': 'http://localhost:8080',
                'poll_rate_hz': 2.0,
                'airport_lat': LaunchConfiguration('airport_lat'),
                'airport_lon': LaunchConfiguration('airport_lon'),
                'max_range_nm': 5.0,
                'surface_only': True,
            }],
            remappings=[],
        ),

        Node(
            package='airport_data_integration',
            executable='acdm_node',
            name='acdm',
            parameters=[{
                'acdm_api_url': 'https://acdm.airport.local/api/v1',
                'poll_interval_sec': 30,
                'pushback_alert_threshold_min': 10,
            }],
        ),

        Node(
            package='airport_data_integration',
            executable='notam_node',
            name='notam',
            parameters=[{
                'notam_source': 'laminar_data',
                'airport_icao': LaunchConfiguration('airport_icao'),
                'poll_interval_sec': 300,
                'geometry_buffer_meters': 5.0,
            }],
        ),

        Node(
            package='airport_data_integration',
            executable='asmgcs_node',
            name='asmgcs',
            parameters=[{
                'multicast_group': '239.1.1.1',
                'multicast_port': 30010,
                'asterix_category': 11,
                'airport_ref_lat': LaunchConfiguration('airport_lat'),
                'airport_ref_lon': LaunchConfiguration('airport_lon'),
                'max_track_age_sec': 5.0,
            }],
        ),

        Node(
            package='airport_data_integration',
            executable='aodb_node',
            name='aodb',
            parameters=[{
                'api_url': 'https://api.developer.aero/flight-status/v2',
                'airport_icao': LaunchConfiguration('airport_icao'),
                'poll_interval_sec': 60,
            }],
        ),

        Node(
            package='airport_data_integration',
            executable='airport_data_fusion_node',
            name='data_fusion',
            parameters=[{
                'correlation_distance_m': 50.0,
                'publish_rate_hz': 2.0,
            }],
        ),
    ])
```

### 7.9 Testing Without Live Airport Infrastructure

For development and testing without access to actual airport systems:

| Data Source | Simulation Strategy |
|------------|---------------------|
| ADS-B | Record real aircraft.json files at nearby airport. Replay via mock HTTP server. Or use `dump1090 --ifile` with recorded I/Q data. |
| A-CDM | Mock REST API serving scripted milestone progressions. |
| NOTAM | Download real NOTAMs from Laminar Data API. Serve from local file cache. |
| A-SMGCS | Generate synthetic ASTERIX Cat 011 binary data and send via UDP multicast. Use `asterix-tool` for encoding. |
| AODB | Mock API returning flight schedules based on real airline timetables (OAG data). |
| Airport geometry | Download FAA AIS data for any US airport. Use OpenStreetMap for non-US airports. |

---

## References

### Standards and Specifications

- EUROCONTROL ASTERIX Category 010: Monosensor Surface Movement Data, Part 7
- EUROCONTROL ASTERIX Category 011: A-SMGCS Data, Part 8 (Ed. 1.3)
- EUROCONTROL ASTERIX Category 062: System Track Data, Part 9 (Ed. 1.20)
- EUROCONTROL Specification for Airport Collaborative Decision Making (A-CDM), Ed. 1.0 (Jan 2025)
- ICAO Doc 9830: Advanced Surface Movement Guidance and Control Systems (A-SMGCS) Manual
- ICAO Doc 9881: PANS-AIM Aeronautical Information Management
- EUROCAE ED-119C / RTCA DO-291C: AMXM (Aerodrome Mapping Exchange Model)
- ARINC 816: Embedded Interchange Format for Airport Mapping Database
- AIXM 5.1 Specification (aixm.aero)
- Digital NOTAM Event Specification 2.0 (EUROCONTROL/FAA)
- RTCA DO-260B: ADS-B 1090 MHz Extended Squitter

### Data Sources and APIs

- FAA AIS Data Delivery: https://ais-faa.opendata.arcgis.com/
- FAA SWIM Cloud Distribution: https://scds.faa.gov/
- FAA NOTAM System: https://notams.aim.faa.gov/
- EUROCONTROL NM B2B Services: https://www.eurocontrol.int/service/network-manager-business-business-b2b-web-services
- EUROCONTROL SWIM Registry: https://eur-registry.swim.aero/
- SITA Developer Portal: https://developer.aero/
- Laminar Data NOTAM API: https://developer.laminardata.aero/documentation/notamdata/v2
- AIXM Digital NOTAM: https://aixm.aero/page/digital-notam
- AMXM: https://amxm.aero/

### Software and Libraries

- readsb (ADS-B decoder): https://github.com/wiedehopf/readsb
- dump1090-fa (FlightAware fork): https://github.com/flightaware/dump1090
- pyModeS (Python Mode S/ADS-B decoder): https://github.com/junzis/pyModeS
- CroatiaControlLtd/asterix (C++ ASTERIX decoder): https://github.com/CroatiaControlLtd/asterix
- asterix-decoder (Python, PyPI): https://pypi.org/project/asterix-decoder/
- Lanelet2 (HD map framework): https://github.com/fzi-forschungszentrum-informatik/Lanelet2
- CommonRoad Scenario Designer: https://github.com/CommonRoad/commonroad-scenario-designer
- FAA SWIM FNS Client: https://github.com/faa-swim/fns-client
- EUROCONTROL SWIM-TI Prototype: https://github.com/eurocontrol-swim/SWIM-TI-YP-prototype
- ADS-B message decoding reference: https://mode-s.org/decode/
