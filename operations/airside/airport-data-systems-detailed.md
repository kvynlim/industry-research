# Airport Data Systems: Detailed API & Integration Reference

Deep technical reference for aviation data systems relevant to autonomous vehicle operations on the airport airside. Covers real API endpoints, authentication mechanisms, data formats, schema examples, and integration patterns.

---

## 1. FAA NOTAM API

The FAA provides a REST API for querying Notices to Air Missions (NOTAMs) through its external API gateway. NOTAMs are critical for airside AV operations because they communicate temporary changes to airport infrastructure -- runway closures, taxiway restrictions, construction zones, lighting outages, and obstacle alerts.

### Registration & Authentication

- **Portal**: https://external-api.faa.gov/ (register for credentials)
- **Auth method**: HTTP header-based credentials (no OAuth2 token exchange needed)
  - `client_id` header: your registered client ID
  - `client_secret` header: your registered client secret

Note: Some wrapper implementations (e.g., the CGI Federal staging environment at `api-staging.cgifederal-aim.com`) use OAuth2 client credentials flow with a `/v1/auth/token` endpoint instead. The production FAA API uses direct header credentials.

### Base URL & Endpoint

```
Base URL: https://external-api.faa.gov/notamapi/v1
Search:   GET /search
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `responseFormat` | string | `aixm`, `geoJson`, or `aidap` (default: `geoJson`) |
| `icaoLocation` | string | ICAO airport code (e.g., `KJFK`, `KATL`) |
| `domesticLocation` | string | FAA domestic code (e.g., `JFK`, `IAD`) |
| `notamType` | string | `N` (New), `R` (Replaced), `C` (Canceled) |
| `classification` | string | `INTL`, `MIL`, `DOM`, `LMIL`, `FDC` |
| `notamNumber` | string | Specific NOTAM identifier |
| `featureType` | string | `RWY`, `TWY`, `APRON`, `AIRSPACE`, etc. |
| `effectiveStartDate` | ISO 8601 | Filter by effective start |
| `effectiveEndDate` | ISO 8601 | Filter by effective end |
| `locationLatitude` | float | Center latitude for geo search |
| `locationLongitude` | float | Center longitude for geo search |
| `locationRadius` | float | Radius in NM (0.1 -- 100) |
| `lastUpdatedDate` | ISO 8601 | Filter by last update |
| `sortBy` | string | Sort field |
| `sortOrder` | string | `Asc` or `Desc` |
| `pageSize` | int | 1--1000 (default 50) |
| `pageNum` | int | Page number (default 1) |

### Example Request

```bash
curl -X GET "https://external-api.faa.gov/notamapi/v1/search?icaoLocation=KJFK&featureType=RWY&responseFormat=geoJson&pageSize=5" \
  -H "client_id: YOUR_CLIENT_ID" \
  -H "client_secret: YOUR_CLIENT_SECRET" \
  -H "Accept: application/json"
```

### Response Format (GeoJSON)

```json
{
  "status": "success",
  "totalNotamCount": 42,
  "pageSize": 5,
  "pageNum": 1,
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [-73.7789, 40.6397]
        },
        "properties": {
          "coreNOTAMData": {
            "notamNumber": "1/2345",
            "notamType": "N",
            "classification": "DOM",
            "accountId": "JFK",
            "icaoLocation": "KJFK",
            "effectiveStart": "2026-03-15T14:00:00Z",
            "effectiveEnd": "2026-04-15T14:00:00Z",
            "text": "RWY 04L/22R CLSD",
            "featureType": "RWY",
            "status": "ACTIVE",
            "translatedText": {
              "translationType": "LOCAL_FORMAT",
              "formattedText": "!JFK 01/234 JFK RWY 04L/22R CLSD 2603151400-2604151400"
            }
          }
        }
      }
    ]
  }
}
```

### NOTAM Categories Relevant to Airside AVs

| Category | Feature Types | Relevance |
|----------|---------------|-----------|
| Movement area | `RWY`, `TWY`, `APRON`, `RAMP` | Direct impact on AV routing |
| Lighting | `LGTD`, `PAPI`, `VASI` | Visibility for perception systems |
| NAVAIDs | `ILS`, `VOR` | Aircraft approach changes affect ground hold |
| Services | `SVC`, `FUEL` | Operational status changes |
| Obstacles | `OBST` | Construction zones, temporary structures |
| Airspace | `AIRSPACE`, `AD` | Broader airport operational status |

---

## 2. EUROCONTROL Network Manager B2B SOAP API

The NM B2B web services provide programmatic access to European air traffic flow and capacity management data. For airside operations, the flight services and flow services provide departure/arrival predictions essential for ground planning.

### Architecture

- **Request/Reply**: SOAP 1.1 over HTTPS with WSDL 1.1 descriptions
- **Publish/Subscribe**: AMQP 1.0 for real-time event streaming
- **Payload format**: XML (all interactions)
- **Encryption**: TLS mandatory

### Authentication

PKI certificate-based authentication:
- Each organization receives digital certificates from EUROCONTROL
- **2 free certificates** per physical location
- Additional certificates: **EUR 200 each**
- Certificates must be registered through EUROCONTROL's access request process
- Secure access via NewPENS (Pan-European Network Service) or public internet with TLS

### Access Requirements

1. Submit eligibility validation request to EUROCONTROL
2. Organizations must demonstrate operational need
3. Flight plan filers must maintain **>95% acknowledgment pass rate**
4. 24/7 operational support; 09:00--17:00 Brussels time for pre-operational environments

### Service Categories & WSDL Endpoints

The B2B services are versioned (current: v27.0.0). WSDL files are accessed through the authenticated NM portal.

**Base endpoint pattern**:
```
https://www.nm.eurocontrol.int/B2B/services/<ServiceName>
```

#### Flight Services
Operations for flight plan management and departure/arrival planning:

| Operation | Description |
|-----------|-------------|
| `queryFlightsByAirspace` | Flights through specified airspace volumes |
| `queryFlightsByAerodrome` | Flights departing/arriving at specific airports |
| `queryFlightsByTrafficVolume` | Flights in traffic volume areas |
| `queryFlightPlans` | Retrieve filed flight plans |
| `flightPlanUpdate` | Submit flight plan modifications |
| `departureSlotAllocation` | ATFCM slot management |

#### Airspace Services
Real-time airspace structure and availability:

| Operation | Description |
|-----------|-------------|
| `queryAirspaceStructure` | Current airspace configuration |
| `queryAirspaceAvailability` | Active/inactive sectors |
| `queryGNSSInterference` | GNSS interference alerts |

#### Flow Services
ATFCM regulation and traffic management:

| Operation | Description |
|-----------|-------------|
| `queryRegulations` | Active flow regulations |
| `queryTrafficCounts` | Sector/airport traffic counts |
| `queryATFCMTacticalUpdates` | Real-time tactical flow changes |

### Data Exchange Standards Used

- **Flight data**: FIXM 4.3 (Flight Information Exchange Model)
- **Airspace data**: AIXM 5.1.1 with NM ADR (AIXM Data Repository) extensions

### Example SOAP Request Envelope

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:flight="eurocontrol/cfmu/b2b/FlightServices">
  <soap:Header>
    <!-- PKI certificate handles authentication at TLS layer -->
  </soap:Header>
  <soap:Body>
    <flight:FlightListByAerodromeRequest>
      <sendTime>2026-03-22T10:00:00Z</sendTime>
      <dataset>
        <type>OPERATIONAL</type>
      </dataset>
      <includeProposalFlights>false</includeProposalFlights>
      <includeForecastFlights>true</includeForecastFlights>
      <trafficType>LOAD</trafficType>
      <trafficWindow>
        <wef>2026-03-22T06:00:00Z</wef>
        <unt>2026-03-22T18:00:00Z</unt>
      </trafficWindow>
      <aerodrome>EHAM</aerodrome>
      <aerodromeRole>DEPARTURE</aerodromeRole>
    </flight:FlightListByAerodromeRequest>
  </soap:Body>
</soap:Envelope>
```

### Example SOAP Response (abbreviated)

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <flight:FlightListByAerodromeReply>
      <requestReceptionTime>2026-03-22T10:00:01Z</requestReceptionTime>
      <requestId>B2B_REQ_12345</requestId>
      <status>OK</status>
      <data>
        <flights>
          <flight>
            <flightId>
              <id>KLM1234</id>
              <keys>
                <aircraftId>KLM1234</aircraftId>
                <aerodromeOfDeparture>EHAM</aerodromeOfDeparture>
                <aerodromeOfDestination>EGLL</aerodromeOfDestination>
                <estimatedOffBlockTime>2026-03-22T08:30:00Z</estimatedOffBlockTime>
              </keys>
            </flightId>
            <calculatedTakeOffTime>2026-03-22T08:45:00Z</calculatedTakeOffTime>
            <actualOffBlockTime>2026-03-22T08:28:00Z</actualOffBlockTime>
            <cdmInfo>
              <departureProposal>
                <timeAtTarget>2026-03-22T08:42:00Z</timeAtTarget>
              </departureProposal>
            </cdmInfo>
          </flight>
        </flights>
      </data>
    </flight:FlightListByAerodromeReply>
  </soap:Body>
</soap:Envelope>
```

---

## 3. AIXM 5.1 XML Schema for Airport Features

The Aeronautical Information Exchange Model (AIXM) 5.1.1 is the ICAO/EUROCONTROL standard for encoding aeronautical information in XML. It provides the canonical data model for airport geometry that autonomous vehicles need for mapping and navigation.

### Namespace Declarations

```xml
xmlns:aixm="http://www.aixm.aero/schema/5.1.1"
xmlns:message="http://www.aixm.aero/schema/5.1.1/message"
xmlns:gml="http://www.opengis.net/gml/3.2"
xmlns:xlink="http://www.w3.org/1999/xlink"
xmlns:gmd="http://www.isotc211.org/2005/gmd"
xmlns:gco="http://www.isotc211.org/2005/gco"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
```

**Schema download**: https://www.aixm.aero/page/aixm-51-xml-schema-xsd
**Reference dataset**: https://github.com/aixm/Donlon_2022 (fictitious "Donlon" airport, BSD licensed, EUROCONTROL/FAA)

### Document Root Structure

```xml
<message:AIXMBasicMessage gml:id="M0000001"
  xmlns:message="http://www.aixm.aero/schema/5.1.1/message"
  xmlns:aixm="http://www.aixm.aero/schema/5.1.1"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gml:boundedBy>
    <gml:Envelope srsName="urn:ogc:def:crs:EPSG::4326">
      <gml:lowerCorner>-32.0886 -47.0</gml:lowerCorner>
      <gml:upperCorner>57.6908 52.4283</gml:upperCorner>
    </gml:Envelope>
  </gml:boundedBy>
  <message:hasMember>
    <!-- Feature elements here -->
  </message:hasMember>
</message:AIXMBasicMessage>
```

### AirportHeliport Feature

Defines the airport itself with reference point, elevation, and operational properties.

```xml
<aixm:AirportHeliport gml:id="uuid.1b54b2d6-a5ff-4e57-94c2-f4047a381c64">
  <gml:identifier codeSpace="urn:uuid:">1b54b2d6-a5ff-4e57-94c2-f4047a381c64</gml:identifier>
  <aixm:timeSlice>
    <aixm:AirportHeliportTimeSlice gml:id="AHP_EADD">
      <gml:validTime>
        <gml:TimePeriod gml:id="vtEADH1">
          <gml:beginPosition>2009-01-01T00:00:00Z</gml:beginPosition>
          <gml:endPosition indeterminatePosition="unknown"/>
        </gml:TimePeriod>
      </gml:validTime>
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:sequenceNumber>1</aixm:sequenceNumber>
      <aixm:designator>EADD</aixm:designator>
      <aixm:name>DONLON/INTERNATIONAL</aixm:name>
      <aixm:locationIndicatorICAO>EADD</aixm:locationIndicatorICAO>
      <aixm:type>AD</aixm:type>
      <aixm:controlType>CIVIL</aixm:controlType>
      <aixm:fieldElevation uom="M">30</aixm:fieldElevation>
      <aixm:fieldElevationAccuracy uom="M">0.5</aixm:fieldElevationAccuracy>
      <aixm:magneticVariation>-3.0</aixm:magneticVariation>
      <aixm:referenceTemperature uom="C">21.0</aixm:referenceTemperature>
      <aixm:transitionAltitude uom="FT">3500</aixm:transitionAltitude>
      <aixm:ARP>
        <aixm:ElevatedPoint srsName="urn:ogc:def:crs:EPSG::4326" gml:id="elpoint1EADD">
          <gml:pos>52.3655 -31.9850</gml:pos>
        </aixm:ElevatedPoint>
      </aixm:ARP>
    </aixm:AirportHeliportTimeSlice>
  </aixm:timeSlice>
</aixm:AirportHeliport>
```

### Runway Feature

Physical runway with dimensions, surface characteristics, and PCN rating.

```xml
<aixm:Runway gml:id="uuid.9e51668f-bf8a-4f5b-ba6e-27087972b9b8">
  <gml:identifier codeSpace="urn:uuid:">9e51668f-bf8a-4f5b-ba6e-27087972b9b8</gml:identifier>
  <aixm:timeSlice>
    <aixm:RunwayTimeSlice gml:id="RWY_EADD_09L_27R">
      <gml:validTime>
        <gml:TimePeriod gml:id="vtILURU94">
          <gml:beginPosition>2017-07-01T00:00:00Z</gml:beginPosition>
          <gml:endPosition indeterminatePosition="unknown"/>
        </gml:TimePeriod>
      </gml:validTime>
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:designator>09L/27R</aixm:designator>
      <aixm:type>RWY</aixm:type>
      <aixm:nominalLength uom="M">3200.0</aixm:nominalLength>
      <aixm:lengthAccuracy uom="M">1</aixm:lengthAccuracy>
      <aixm:nominalWidth uom="M">45.0</aixm:nominalWidth>
      <aixm:widthAccuracy uom="M">1</aixm:widthAccuracy>
      <aixm:lengthStrip uom="M">3320.0</aixm:lengthStrip>
      <aixm:widthStrip uom="M">300.0</aixm:widthStrip>
      <aixm:surfaceProperties>
        <aixm:SurfaceCharacteristics gml:id="SCH_EADD_RWY_07L_29R">
          <aixm:composition>CONC</aixm:composition>
          <aixm:classPCN>80</aixm:classPCN>
          <aixm:pavementTypePCN>RIGID</aixm:pavementTypePCN>
          <aixm:pavementSubgradePCN>B</aixm:pavementSubgradePCN>
          <aixm:maxTyrePressurePCN>W</aixm:maxTyrePressurePCN>
          <aixm:evaluationMethodPCN>TECH</aixm:evaluationMethodPCN>
        </aixm:SurfaceCharacteristics>
      </aixm:surfaceProperties>
      <aixm:associatedAirportHeliport
        xlink:href="urn:uuid:1b54b2d6-a5ff-4e57-94c2-f4047a381c64"
        xlink:title="AHP_EADD"/>
    </aixm:RunwayTimeSlice>
  </aixm:timeSlice>
</aixm:Runway>
```

### RunwayDirection Feature

Directional designation with true bearing and touchdown zone elevation.

```xml
<aixm:RunwayDirection gml:id="uuid.c8455a6b-9319-4bb7-b797-08e644342d64">
  <gml:identifier codeSpace="urn:uuid:">c8455a6b-9319-4bb7-b797-08e644342d64</gml:identifier>
  <aixm:timeSlice>
    <aixm:RunwayDirectionTimeSlice gml:id="RDN_EADD_09L">
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:designator>09L</aixm:designator>
      <aixm:trueBearing>84.28</aixm:trueBearing>
      <aixm:trueBearingAccuracy>0.01</aixm:trueBearingAccuracy>
      <aixm:usedRunway
        xlink:href="urn:uuid:9e51668f-bf8a-4f5b-ba6e-27087972b9b8"
        xlink:title="RWY_EADD_09L_27R"/>
    </aixm:RunwayDirectionTimeSlice>
  </aixm:timeSlice>
</aixm:RunwayDirection>
```

### RunwayCentrelinePoint Feature

Threshold point with precise WGS-84 coordinates, elevation, geoid undulation, and declared distances. This is the most critical feature for AV navigation near runways.

```xml
<aixm:RunwayCentrelinePoint gml:id="uuid.ebccbb64-c1b3-4b27-8e5a-a32d2763208a">
  <gml:identifier codeSpace="urn:uuid:">ebccbb64-c1b3-4b27-8e5a-a32d2763208a</gml:identifier>
  <aixm:timeSlice>
    <aixm:RunwayCentrelinePointTimeSlice gml:id="RCP_EADD_09L">
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:role>THR</aixm:role>
      <aixm:location>
        <aixm:ElevatedPoint srsName="urn:ogc:def:crs:EPSG::4326" gml:id="RCPP0">
          <gml:pos>52.375597222222225 -31.964263888888887</gml:pos>
          <aixm:horizontalAccuracy uom="M">1</aixm:horizontalAccuracy>
          <aixm:elevation uom="M">30.0</aixm:elevation>
          <aixm:geoidUndulation uom="M">11.5</aixm:geoidUndulation>
          <aixm:verticalAccuracy uom="M">0.25</aixm:verticalAccuracy>
        </aixm:ElevatedPoint>
      </aixm:location>
      <aixm:onRunway
        xlink:href="urn:uuid:c8455a6b-9319-4bb7-b797-08e644342d64"
        xlink:title="RDN_EADD_09L"/>
      <aixm:associatedDeclaredDistance>
        <aixm:RunwayDeclaredDistance gml:id="rdd001">
          <aixm:type>TORA</aixm:type>
          <aixm:declaredValue>
            <aixm:RunwayDeclaredDistanceValue gml:id="rddv001">
              <aixm:distance uom="M">3200</aixm:distance>
            </aixm:RunwayDeclaredDistanceValue>
          </aixm:declaredValue>
        </aixm:RunwayDeclaredDistance>
      </aixm:associatedDeclaredDistance>
      <!-- Additional declared distances: TODA, ASDA, LDA -->
    </aixm:RunwayCentrelinePointTimeSlice>
  </aixm:timeSlice>
</aixm:RunwayCentrelinePoint>
```

**RunwayCentrelinePoint roles**: `THR` (threshold), `END` (runway end), `MID` (midpoint), `TDZ` (touchdown zone), `DISTHR` (displaced threshold), `START_RUN` (start of takeoff run)

### Taxiway Feature

```xml
<aixm:Taxiway gml:id="uuid.78396f68-9c03-438a-a6b4-331157b1a79c">
  <gml:identifier codeSpace="urn:uuid:">78396f68-9c03-438a-a6b4-331157b1a79c</gml:identifier>
  <aixm:timeSlice>
    <aixm:TaxiwayTimeSlice gml:id="TWY_EADD_B">
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:designator>B</aixm:designator>
      <aixm:width uom="M">20.0</aixm:width>
      <aixm:surfaceProperties>
        <aixm:SurfaceCharacteristics gml:id="ID_18">
          <aixm:composition>CONC_ASPH</aixm:composition>
          <aixm:classPCN>80</aixm:classPCN>
          <aixm:pavementTypePCN>RIGID</aixm:pavementTypePCN>
          <aixm:pavementSubgradePCN>B</aixm:pavementSubgradePCN>
          <aixm:maxTyrePressurePCN>W</aixm:maxTyrePressurePCN>
          <aixm:evaluationMethodPCN>TECH</aixm:evaluationMethodPCN>
        </aixm:SurfaceCharacteristics>
      </aixm:surfaceProperties>
      <aixm:associatedAirportHeliport
        xlink:href="urn:uuid:1b54b2d6-a5ff-4e57-94c2-f4047a381c64"
        xlink:title="AHP_EADD"/>
    </aixm:TaxiwayTimeSlice>
  </aixm:timeSlice>
</aixm:Taxiway>
```

### TaxiwayElement Feature

Geometric representation of a taxiway section with surface polygon. `type` values include: `NORMAL`, `HOLDING_BAY`, `RAPID_EXIT`, `TURNING_BAY`, `LEAD_IN`, `LEAD_OUT`.

```xml
<aixm:TaxiwayElement gml:id="uuid.f2cd7c2f-2d8a-4a78-a101-b14fdd1e742c">
  <gml:identifier codeSpace="urn:uuid:">f2cd7c2f-2d8a-4a78-a101-b14fdd1e742c</gml:identifier>
  <aixm:timeSlice>
    <aixm:TaxiwayElementTimeSlice gml:id="ID_198">
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:type>HOLDING_BAY</aixm:type>
      <aixm:associatedTaxiway
        xlink:href="urn:uuid:4f71b0f7-524c-4838-a6f8-5383de5c0d95"/>
      <aixm:extent>
        <aixm:ElevatedSurface srsName="urn:ogc:def:crs:EPSG::4326" gml:id="ID_200">
          <gml:patches>
            <gml:PolygonPatch>
              <gml:exterior>
                <gml:Ring>
                  <gml:curveMember>
                    <gml:Curve gml:id="C001114">
                      <gml:segments>
                        <gml:GeodesicString>
                          <gml:posList>52.3700 -31.9259 52.3704 -31.9260 ...</gml:posList>
                        </gml:GeodesicString>
                      </gml:segments>
                    </gml:Curve>
                  </gml:curveMember>
                </gml:Ring>
              </gml:exterior>
            </gml:PolygonPatch>
          </gml:patches>
        </aixm:ElevatedSurface>
      </aixm:extent>
    </aixm:TaxiwayElementTimeSlice>
  </aixm:timeSlice>
</aixm:TaxiwayElement>
```

### ApronElement Feature

Geometric apron area linked to a parent Apron feature.

```xml
<aixm:ApronElement gml:id="uuid.285fd2af-599a-4f9b-b812-fd24a68416c4">
  <gml:identifier codeSpace="urn:uuid:">285fd2af-599a-4f9b-b812-fd24a68416c4</gml:identifier>
  <aixm:timeSlice>
    <aixm:ApronElementTimeSlice gml:id="ID_191">
      <aixm:interpretation>BASELINE</aixm:interpretation>
      <aixm:associatedApron
        xlink:href="urn:uuid:0dac7a5f-4cb6-41a2-b0eb-dac1c555351c"/>
      <aixm:extent>
        <aixm:ElevatedSurface srsName="urn:ogc:def:crs:EPSG::4326" gml:id="ID_193">
          <gml:patches>
            <gml:PolygonPatch>
              <gml:exterior>
                <gml:Ring>
                  <gml:curveMember>
                    <gml:Curve gml:id="C001113">
                      <gml:segments>
                        <gml:GeodesicString>
                          <gml:posList>52.3688 -31.9479 52.3688 -31.9479 ...</gml:posList>
                        </gml:GeodesicString>
                      </gml:segments>
                    </gml:Curve>
                  </gml:curveMember>
                </gml:Ring>
              </gml:exterior>
            </gml:PolygonPatch>
          </gml:patches>
        </aixm:ElevatedSurface>
      </aixm:extent>
    </aixm:ApronElementTimeSlice>
  </aixm:timeSlice>
</aixm:ApronElement>
```

### Additional AIXM Airport Features

| Feature | Description | AV Relevance |
|---------|-------------|---------------|
| `GuidanceLine` | Taxiway centerline/guidance markings | Path planning reference |
| `GuidanceLineMarking` | Marking details for guidance lines | Visual detection targets |
| `TouchDownLiftOff` | Helipad TLOF areas | Avoidance zones |
| `Apron` | Named apron area (parent of ApronElements) | Zone classification |
| `StandArea` | Aircraft parking stand areas | Vehicle staging zones |
| `RunwayElement` | Physical runway surface geometry | Critical avoidance area |

### AIXM Temporality Model

AIXM 5.1 uses a temporal model where every feature has `TimeSlice` elements with:
- `BASELINE`: Permanent state of the feature
- `TEMPDELTA`: Temporary change (used for Digital NOTAMs)
- `PERMDELTA`: Permanent change (amendments)

This allows expressing "Taxiway B closed from 2026-03-25 to 2026-04-01" as a TEMPDELTA on the TaxiwayTimeSlice.

---

## 4. AMDB / AMXM Data Availability

The Aerodrome Mapping Database (AMDB) provides high-precision aerodrome surface data at centimeter-level accuracy, far exceeding what AIXM provides. It is the gold standard for airside AV HD maps.

### Specifications

- **RTCA DO-272D** / **EUROCAE ED-99D**: Joint specification for AMDB data
- **ARINC 816**: Industry standard for AMDB data exchange format
- **AMXM**: Airport Mapping eXchange Model -- XML/GML-based exchange format derived from the AMDB specification

### AMDB Feature Types (ARINC 816)

| Feature Code | Feature Name | Geometry | Description |
|---|---|---|---|
| `RunwayCentreLinePoint` | RWY centerline | Point | Threshold, end, midpoints |
| `RunwayElement` | RWY surface | Polygon | Physical runway pavement |
| `RunwayIntersection` | RWY intersection | Point | Where runways cross |
| `RunwayMarking` | RWY markings | Line/Polygon | Centerline, threshold markings |
| `TaxiwayCentreLinePoint` | TWY guidance point | Point | Nodes in taxi guidance network |
| `TaxiwayElement` | TWY surface | Polygon | Physical taxiway pavement |
| `TaxiwayGuidanceLine` | TWY centerline | Line | Guidance/centerline path |
| `TaxiwayHoldingPosition` | Holding point | Point/Line | CAT I/II/III hold positions |
| `TaxiwayIntersectionMarking` | TWY intersection | Polygon | Intersection paint markings |
| `ApronElement` | Apron surface | Polygon | Apron/ramp pavement |
| `StandGuidanceLine` | Stand lead-in | Line | Aircraft parking guidance |
| `ParkingStandArea` | Stand area | Polygon | Individual stand footprint |
| `ParkingStandLocation` | Stand reference | Point | Stand reference point |
| `DeicingArea` | De-icing pad | Polygon | De-icing zones |
| `ConstructionArea` | Construction zone | Polygon | Active construction |
| `FrequencyArea` | Radio frequency area | Polygon | Communication zones |
| `VerticalPolygonalStructure` | Vertical obstacle | Polygon | Buildings, hangars |
| `VerticalPointStructure` | Vertical obstacle | Point | Towers, poles |
| `VerticalLineStructure` | Vertical obstacle | Line | Fences, walls |
| `SurveyControlPoint` | Survey marker | Point | Geodetic control network |

### Data Providers

| Provider | Coverage | Notes |
|----------|----------|-------|
| **Jeppesen (Boeing)** | 700+ airports worldwide | Primary commercial provider; data licensed per airport |
| **EUROCONTROL** | European airports via EAD | Available to member states |
| **ICAO AMDB Programme** | Growing global coverage | Coordinated through ICAO AIS panel |
| **National AIPs** | Varies by state | Some states publish AMDB data in eAIP |
| **Airport operators** | Individual airports | Some airports commission their own surveys |

### How to Obtain AMDB Data

1. **Jeppesen/Boeing**: Contact Jeppesen Industry Solutions sales. Pricing is per-airport, per-year license. Typical cost ranges from USD 5,000--20,000 per airport per year depending on airport complexity and update frequency.

2. **EUROCONTROL EAD**: European member state organizations can request access through the European AIS Database. Some AMDB data is freely available to authorized users.

3. **ICAO programme**: Contact your national civil aviation authority. ICAO is coordinating global AMDB coverage under Annex 15 requirements. As of 2024, ICAO Annex 15 Amendment 41 requires states to make AMDB data available for airports with paved runways >= 1200m.

4. **Direct survey**: Commission a survey company to create AMDB data for a specific airport. Cost: USD 50,000--200,000+ depending on airport size. Survey companies include NAVBLUE (Airbus), Searidge Technologies, and specialized geodetic firms.

### AMXM Format

The Airport Mapping eXchange Model uses GML 3.2.1 encoding with AIXM-compatible schema structure. Key namespaces:

```xml
xmlns:amxm="http://www.eurocontrol.int/amxm/1.0"
xmlns:gml="http://www.opengis.net/gml/3.2"
```

AMXM includes accuracy metadata for every coordinate point, enabling AV systems to reason about position uncertainty in their planning.

---

## 5. ADS-B Data Sources

ADS-B (Automatic Dependent Surveillance-Broadcast) provides real-time aircraft position data critical for airside AV situational awareness -- knowing where aircraft are on the surface and on approach.

### 5.1 OpenSky Network API

Open-source, research-friendly ADS-B data aggregation network.

**Base URL**: `https://opensky-network.org/api`

#### Authentication (as of March 2026)

OAuth2 Client Credentials flow (basic auth deprecated):
1. Create API client at https://opensky-network.org (Account page)
2. Obtain `client_id` and `client_secret`
3. Request token from:
   ```
   POST https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token
   ```
4. Include `Authorization: Bearer $TOKEN` in API requests
5. Tokens expire after 30 minutes

#### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/states/all` | GET | All aircraft state vectors (global or bounded) |
| `/states/own` | GET | State vectors from your own receivers (no rate limit) |
| `/flights/all` | GET | All flights in a time interval (max 2h window) |
| `/flights/aircraft` | GET | Flights for a specific ICAO24 address (max 2d) |
| `/flights/arrival` | GET | Arrivals at an airport (max 2d window) |
| `/flights/departure` | GET | Departures from an airport (max 2d window) |
| `/tracks` | GET | Waypoint track for an aircraft (max 30d history) |

#### State Vector Fields (18 per aircraft)

| Index | Field | Type | Description |
|-------|-------|------|-------------|
| 0 | `icao24` | string | ICAO 24-bit hex address |
| 1 | `callsign` | string | Callsign (8 chars max) |
| 2 | `origin_country` | string | Country of registration |
| 3 | `time_position` | int | Unix timestamp of last position |
| 4 | `last_contact` | int | Unix timestamp of last message |
| 5 | `longitude` | float | WGS-84 longitude (degrees) |
| 6 | `latitude` | float | WGS-84 latitude (degrees) |
| 7 | `baro_altitude` | float | Barometric altitude (m) |
| 8 | `on_ground` | bool | Whether aircraft is on ground |
| 9 | `velocity` | float | Ground speed (m/s) |
| 10 | `true_track` | float | Track angle (degrees, 0=North) |
| 11 | `vertical_rate` | float | Vertical rate (m/s) |
| 12 | `sensors` | int[] | Receiver IDs (own state only) |
| 13 | `geo_altitude` | float | Geometric/GPS altitude (m) |
| 14 | `squawk` | string | Transponder squawk code |
| 15 | `spi` | bool | Special position indicator |
| 16 | `position_source` | int | 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM |
| 17 | `category` | int | Aircraft category (0--21) |

#### Rate Limits & API Credits

| User Type | Time Resolution | History | Daily Credits |
|-----------|----------------|---------|---------------|
| Anonymous | 10 seconds | Current only | 400 |
| Registered | 5 seconds | 1 hour | 4,000 |
| Contributing (30%+ uptime) | 5 seconds | 1 hour | 8,000 |

Credit cost per `/states/all` query:
- <500x500 km area: 1 credit
- <1000x1000 km: 2 credits
- <2000x2000 km: 3 credits
- Global query: 4 credits

#### Example: Get Aircraft Near an Airport

```bash
# Bounding box around KJFK (approx 10km radius)
curl "https://opensky-network.org/api/states/all?lamin=40.59&lomin=-73.85&lamax=40.69&lomax=-73.71" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "time": 1711108800,
  "states": [
    ["a12345", "DAL1234 ", "United States", 1711108798, 1711108800,
     -73.7821, 40.6413, 0, true, 8.23, 85.3, 0, null, 4.0,
     "1200", false, 0, 0]
  ]
}
```

### 5.2 ADS-B Exchange API

Unfiltered ADS-B data (does not suppress military/government aircraft like some providers). Maintained by a community of volunteer feeders.

#### Access Tiers

| Tier | Access Method | Use Case |
|------|--------------|----------|
| **API Lite** | Via RapidAPI marketplace | Personal/non-commercial use |
| **Enterprise API** | Direct (contact sales) | Commercial applications |
| **Historical Data** | Secure download (JSON) | Research, replay, analysis |

#### Enterprise API Documentation

- **Spec/docs**: https://gateway.adsbexchange.com/api/aircraft/v2/docs/
- **Field reference**: https://www.adsbexchange.com/version-2-api
- **Demo key**: Available via request form on product page
- **Coverage**: 15,000+ aircraft from 14,000+ active feeds worldwide
- **Update rate**: Up to 2 Hz (twice per second)

#### V2 API Response Fields

**Status fields**:
- `msg`: Error indicator (default: "No error")
- `now`: File generation time (ms since epoch)
- `total`: Number of aircraft returned
- `ctime`: Cache time (seconds since epoch)
- `ptime`: Server processing time (ms)

**Per-aircraft fields**:

| Field | Description |
|-------|-------------|
| `hex` | 24-bit ICAO identifier (6 hex digits; `~` prefix = non-ICAO) |
| `r` | Aircraft registration from database |
| `t` | ICAO aircraft type code |
| `flight` | Callsign or registration (8 chars max) |
| `lat`, `lon` | Decimal degree coordinates |
| `alt_baro` | Barometric altitude (ft) or `"ground"` |
| `alt_geom` | Geometric/GNSS altitude (WGS-84 ref, ft) |
| `gs` | Ground speed (knots) |
| `track` | True track (0--359 degrees) |
| `baro_rate` | Barometric vertical rate (ft/min) |
| `geom_rate` | Geometric vertical rate (ft/min) |
| `squawk` | Transponder squawk code |
| `emergency` | Emergency status |
| `nic` | Navigation Integrity Category |
| `rc` | Radius of Containment (meters) |
| `rssi` | Signal strength (dBFS, negative value) |
| `seen` | Seconds since last message |
| `type` | Source: `adsb_icao`, `mlat`, `tisb_icao`, `mode_s`, etc. |
| `messages` | Total Mode S messages received |

#### Example Enterprise API Request

```bash
# Get aircraft within radius of a point (lat/lon/radius in NM)
curl "https://gateway.adsbexchange.com/api/aircraft/v2/lat/40.64/lon/-73.78/dist/10/" \
  -H "api-auth: YOUR_API_KEY" \
  -H "Accept: application/json"
```

### 5.3 FlightAware AeroAPI

Commercial-grade aviation data API with 60+ endpoints, global coverage since 2011.

**Base URL**: `https://aeroapi.flightaware.com/aeroapi`

#### Authentication

API key in header: `x-apikey: YOUR_API_KEY`

#### Pricing Tiers

| Tier | Cost | Rate Limit | Features |
|------|------|------------|----------|
| **Personal** | Free ($5/mo allowance) | 10 results/min | Current status, tracks |
| **Standard** | $100/mo minimum | 5 results/sec | + Historical, alerts, email support |
| **Premium** | $1,000/mo minimum | 100 results/sec | + Aireon ADS-B, Foresight predictions, 99.5% SLA |

Per-query costs: $0.001--$0.140 per result set (15 records = 1 result set). Volume discounts up to 94% for >$64K/month usage.

#### Key Endpoints for Airside Operations

```
GET /airports/{id}/flights              # Current flights at airport
GET /airports/{id}/flights/arrivals     # Arrivals
GET /airports/{id}/flights/departures   # Departures
GET /airports/{id}/flights/scheduled    # Scheduled flights
GET /flights/{id}/position              # Current flight position
GET /flights/{id}/track                 # Full flight track
GET /flights/{id}                       # Flight details
```

#### Example Request

```bash
curl "https://aeroapi.flightaware.com/aeroapi/airports/KJFK/flights" \
  -H "x-apikey: YOUR_AEROAPI_KEY"
```

### 5.4 FlightAware Firehose

Streaming data feed for real-time position ingestion (as opposed to the request/reply AeroAPI).

- **Protocol**: TCP-based, SSL-secured streaming
- **Format**: JSON Lines (one JSON object per line)
- **Data rate**: >10,000 aircraft positions per second
- **Pricing**: Custom per-customer, fixed monthly fee
- **Sources**: 41,000+ terrestrial receivers + Aireon space-based ADS-B
- **Features**: Point-in-Time Recovery (PITR) for data replay
- **Coverage**: Airborne + surface ADS-B positions, flight status/block events, operational event detection (holds, go-arounds), weather, geofence events

Data layers can be selected by geographic scope, operator, and data type.

---

## 6. pyModeS Library for ADS-B Decoding

pyModeS is a Python library for decoding raw Mode-S and ADS-B messages, essential for processing data from your own ADS-B receivers on the airfield.

**Repository**: https://github.com/junzis/pyModeS
**License**: GPLv3
**Author**: Junzi Sun (TU Delft)
**Reference**: "The 1090 Megahertz Riddle" -- https://mode-s.org/1090mhz (open access, CC BY-NC-SA 4.0)

### Installation

```bash
pip install pyModeS                     # Stable release
conda install -c conda-forge pymodes    # With compiled C extensions (faster)
pip install pyrtlsdr                    # Optional: RTL-SDR receiver support
```

### ADS-B Message Structure

ADS-B is transmitted on 1090 MHz in DF17/DF18 (Downlink Format) messages. The 112-bit message contains:

```
|  DF (5)  |  CA (3)  |  ICAO (24)  |  ME (56)  |  PI (24)  |
```

The ME (Message Extended) field is decoded based on Type Code (TC, first 5 bits of ME):

| TC Range | Message Type | Content |
|----------|-------------|---------|
| 1--4 | Aircraft Identification | Callsign |
| 5--8 | **Surface Position** | Ground position, speed, track |
| 9--18 | Airborne Position (baro alt) | Lat/lon, barometric altitude |
| 19 | Airborne Velocity | Speed, heading, vertical rate |
| 20--22 | Airborne Position (GNSS alt) | Lat/lon, geometric altitude |
| 23--27 | Reserved | -- |
| 28 | Aircraft Status | Emergency, SPI |
| 29 | Target State & Status | Autopilot, VNAV, approach mode |
| 31 | Operational Status | ADS-B version, NIC, NACp |

### Core Decoding Examples

```python
import pyModeS as pms

msg = "8D40621D58C382D690C8AC2863A7"

# Basic message info
pms.df(msg)                    # -> 17 (ADS-B)
pms.icao(msg)                  # -> '40621D'
pms.crc(msg, encode=False)     # -> 0 (valid)
pms.adsb.typecode(msg)         # -> 11 (airborne position, baro)

# Aircraft identification (TC 1-4)
msg_id = "8D406B902015A678D4D220AA4BDA"
pms.adsb.callsign(msg_id)     # -> 'EZY85MH_'

# Altitude (TC 9-18)
pms.adsb.altitude(msg)        # -> 38000 (feet)
```

### Position Decoding (CPR Algorithm)

ADS-B positions use Compact Position Reporting (CPR) which requires two messages (even/odd) for global decoding, or one message plus a reference position for local decoding.

```python
# Global position decoding (requires even + odd message pair)
msg_even = "8D40621D58C382D690C8AC2863A7"
msg_odd  = "8D40621D58C386435CC412692AD6"
t_even = 1457996400
t_odd  = 1457996402

lat, lon = pms.adsb.position(msg_even, msg_odd, t_even, t_odd)
# -> (52.2572, 3.9194)

# Airborne position specifically
lat, lon = pms.adsb.airborne_position(msg_even, msg_odd, t_even, t_odd)

# Local position decoding (single message + reference)
lat, lon = pms.adsb.position_with_ref(msg, lat_ref=52.25, lon_ref=3.92)
```

### Surface Position Decoding (TC 5-8)

Critical for tracking aircraft on the ground at the airport. Surface messages have different encoding from airborne messages.

**Surface message ME field structure**:

| Field | Bits | Description |
|-------|------|-------------|
| TC | 5 | Type Code (5--8) |
| MOV | 7 | Ground speed (non-linear encoding) |
| S | 1 | Ground track validity flag |
| TRK | 7 | Ground track angle (360/128 degree resolution) |
| T | 1 | Time indicator |
| F | 1 | CPR format (even=0, odd=1) |
| LAT-CPR | 17 | Encoded latitude |
| LON-CPR | 17 | Encoded longitude |

**Ground speed decoding** (non-linear quantization for precision at low speeds):
- 0: unavailable
- 1: stopped (<0.125 kt)
- 2--8: 0.125--0.999 kt (0.125 kt steps)
- 39--93: 15--69 kt (1 kt steps)
- 109--123: 100--174 kt (5 kt steps)
- 124+: >= 175 kt

**Track angle**: When status bit S=1, heading = (360 * n) / 128 degrees

**Position**: CPR with latitude zones 4x smaller than airborne; requires reference position within 45 NM.

```python
# Surface position decoding
msg_even_sfc = "8C4841753AAB238733B8AA000000"
msg_odd_sfc  = "8C4841753A8B246F33B8AA000000"
t_even = 1457996410
t_odd  = 1457996412

# Reference position (airport coordinates)
lat_ref, lon_ref = 51.9900, 4.3750  # EHAM

lat, lon = pms.adsb.surface_position(
    msg_even_sfc, msg_odd_sfc,
    t_even, t_odd,
    lat_ref, lon_ref
)

# Single-message surface position with reference
lat, lon = pms.adsb.surface_position_with_ref(
    msg_even_sfc, lat_ref, lon_ref
)

# Surface velocity
spd, trk, _, _ = pms.adsb.surface_velocity(msg_even_sfc)
# spd in knots, trk in degrees
```

### Velocity Decoding (TC 19)

```python
msg_vel = "8D485020994409940838175B284F"

# Full velocity info
spd, trk, vr, spd_type = pms.adsb.velocity(msg_vel)
# spd: speed in knots
# trk: track angle in degrees
# vr: vertical rate in ft/min
# spd_type: 'GS' (ground speed) or 'TAS' (true airspeed)

# Separate speed and heading
spd, hdg = pms.adsb.speed_heading(msg_vel)
```

### Mode-S Enhanced Surveillance (EHS)

Useful for additional aircraft state data beyond ADS-B:

```python
# BDS 4,0 - Selected Vertical Intention (autopilot settings)
pms.commb.selalt40mcp(msg)    # MCP/FCU selected altitude (ft)
pms.commb.selalt40fms(msg)    # FMS selected altitude (ft)
pms.commb.p40baro(msg)        # Barometric pressure setting (mb)

# BDS 5,0 - Track and Turn Report
pms.commb.roll50(msg)         # Roll angle (degrees)
pms.commb.trk50(msg)          # True track angle (degrees)
pms.commb.gs50(msg)           # Ground speed (knots)
pms.commb.tas50(msg)          # True airspeed (knots)

# BDS 6,0 - Heading and Speed Report
pms.commb.hdg60(msg)          # Magnetic heading (degrees)
pms.commb.ias60(msg)          # Indicated airspeed (knots)
pms.commb.mach60(msg)         # Mach number
pms.commb.vr60baro(msg)       # Barometric vertical rate (ft/min)

# Auto-identify BDS register
pms.bds.infer(msg)            # -> 'BDS50' or 'BDS60' etc.
```

### Live Monitoring from RTL-SDR or Network Feed

```bash
# From RTL-SDR receiver
modeslive --source rtlsdr --latlon 40.64 -73.78

# From dump1090 network feed (raw format)
modeslive --source net --connect localhost 30002 raw --latlon 40.64 -73.78

# From dump1090 Beast binary format
modeslive --source net --connect localhost 30005 beast --latlon 40.64 -73.78 --dumpto ./adsb_log
```

### Custom TCP Client for Integration

```python
import pyModeS as pms
from pyModeS.extra.tcpclient import TcpClient

class AirsideADSBClient(TcpClient):
    def __init__(self, host, port, rawtype, airport_lat, airport_lon):
        super().__init__(host, port, rawtype)
        self.airport_lat = airport_lat
        self.airport_lon = airport_lon

    def handle_messages(self, messages):
        for msg, ts in messages:
            if pms.df(msg) != 17 or pms.crc(msg) != 0:
                continue

            icao = pms.adsb.icao(msg)
            tc = pms.adsb.typecode(msg)

            # Surface position messages (aircraft on ground)
            if 5 <= tc <= 8:
                # Decode with airport as reference
                pos = pms.adsb.surface_position_with_ref(
                    msg, self.airport_lat, self.airport_lon
                )
                if pos:
                    lat, lon = pos
                    spd, trk, _, _ = pms.adsb.surface_velocity(msg)
                    print(f"[SURFACE] {icao} @ ({lat:.6f}, {lon:.6f}) "
                          f"GS={spd} kt TRK={trk} deg")

client = AirsideADSBClient(
    'localhost', 30005, 'beast',
    airport_lat=40.6413, airport_lon=-73.7781  # KJFK
)
client.run()
```

---

## 7. ACRIS Semantic Model for AODB Integration

The Airport Community Recommended Information Services (ACRIS) standard, developed by ACI (Airports Council International), defines a semantic data model for airport operational databases (AODBs). It standardizes the data exchange between airport systems and external consumers.

### Overview

ACRIS provides a vendor-neutral abstraction over the heterogeneous AODB systems deployed across airports. Major AODB vendors include SITA, Amadeus (formerly UFIS), ARINC (Collins Aerospace), ADB SAFEGATE, and Ultra Electronics. Each implements proprietary data models. ACRIS bridges this gap.

### Semantic Model Data Domains

The ACRIS Semantic Model (current version 3.3, published October 2019) organizes airport operational data into these domains:

| Domain | Key Entities | Description |
|--------|-------------|-------------|
| **Flight Information** | Flight, FlightLeg, CodeshareInfo | Scheduled & actual flight status, airline, routing |
| **Aircraft** | Aircraft, AircraftType, AircraftConfiguration | Registration, type, seating config |
| **Airport Resources** | Gate, Stand, Carousel, CheckInDesk, Runway | Physical airport resources assigned to flights |
| **Passenger** | Passenger, PassengerCount, LoadInfo | Pax counts, load factors |
| **Baggage** | BaggageClaim, BaggageInfo | Carousel assignments, bag counts |
| **Ground Handling** | HandlingAgent, Service | Ground handler assignments |
| **Time References** | ScheduledTime, EstimatedTime, ActualTime | Multi-layered time model |
| **Irregularity** | Delay, Diversion, Cancellation | Disruption tracking with IATA delay codes |
| **Airport Status** | OperationalStatus, CapacityInfo | Airport-wide operational state |

### ACRIS Data Exchange Patterns

ACRIS defines both REST and messaging-based access:

1. **REST API pattern** (ACRIS Recommended):
   ```
   GET /flights?airport=KJFK&direction=ARR&from=2026-03-22T00:00:00Z&to=2026-03-22T23:59:59Z
   ```

2. **AMQP/JMS messaging**: Publish/subscribe for real-time updates

3. **SOAP/XML**: Legacy pattern still used by some implementations

### ACRIS Flight Information Object (Simplified)

```json
{
  "flightId": {
    "airlineIATA": "DL",
    "flightNumber": "405",
    "scheduledDate": "2026-03-22",
    "departureAirport": "KATL",
    "arrivalAirport": "KJFK"
  },
  "flightStatus": "ARRIVED",
  "aircraftType": {
    "icaoCode": "B739",
    "iataCode": "739"
  },
  "aircraftRegistration": "N839DN",
  "times": {
    "scheduledArrival": "2026-03-22T14:30:00-04:00",
    "estimatedArrival": "2026-03-22T14:22:00-04:00",
    "actualOnBlock": "2026-03-22T14:25:00-04:00",
    "actualTouchdown": "2026-03-22T14:18:00-04:00"
  },
  "resources": {
    "arrivalGate": "B42",
    "arrivalStand": "B42R",
    "baggageClaim": "4",
    "arrivalRunway": "31L"
  },
  "passengerInfo": {
    "totalPassengers": 168,
    "transferPassengers": 24
  }
}
```

### ACRIS Resource Assignment Object

```json
{
  "resourceType": "STAND",
  "resourceId": "B42R",
  "resourceArea": "TERMINAL_B",
  "assignedFlight": {
    "airlineIATA": "DL",
    "flightNumber": "405",
    "scheduledDate": "2026-03-22"
  },
  "assignmentTimes": {
    "scheduledStart": "2026-03-22T14:20:00-04:00",
    "scheduledEnd": "2026-03-22T15:45:00-04:00",
    "actualStart": "2026-03-22T14:25:00-04:00",
    "actualEnd": null
  },
  "status": "OCCUPIED"
}
```

### AODB Integration for Airside AVs

For an AV operating airside, the AODB (via ACRIS) provides:

1. **Stand assignments**: Which stand an aircraft will occupy, and when -- essential for routing baggage tugs, pushback tractors, and autonomous vehicles to the correct position.

2. **Gate/stand timing**: Estimated on-block and off-block times drive the scheduling of all ground handling activities.

3. **Aircraft type**: Determines jet blast zones, wingspan clearance requirements, and pushback equipment needed.

4. **Flight status**: Real-time status changes (delayed, diverted, cancelled) trigger replanning of ground operations.

5. **Runway-in-use**: Which runway is active for arrivals/departures affects taxiway crossing patterns.

---

## 8. A-CDM and DPI Messages

Airport Collaborative Decision Making (A-CDM) is a EUROCONTROL initiative that synchronizes airport stakeholders (airport operator, airlines, ground handlers, ATC, Network Manager) around shared departure and arrival planning information. DPI (Departure Planning Information) messages are the primary data exchange mechanism.

### A-CDM Implemented Airports (34 European airports as of 2026)

Amsterdam (EHAM), Barcelona (LEBL), Bergamo (LIME), Berlin Brandenburg (EDDB), Brussels (EBBR), Copenhagen (EKCH), Dusseldorf (EDDL), Frankfurt (EDDF), Geneva (LSGG), Hamburg (EDDH), Helsinki (EFHK), Lisbon (LPPT), London Heathrow (EGLL), London Gatwick (EGKK), Lyon (LFLL), Madrid (LEMD), Malaga (LEMG), Milan Linate (LIML), Milan Malpensa (LIMC), Munich (EDDM), Naples (LIRN), Nice (LFMN), Oslo (ENGM), Palma de Mallorca (LEPA), Paris CDG (LFPG), Paris Orly (LFPO), Prague (LKPR), Riga (EVRA), Rome Fiumicino (LIRF), Stuttgart (EDDS), Venice (LIPZ), Vienna (LOWW), Zurich (LSZH), Alicante (LEAL)

### A-CDM Milestone Approach

The milestone approach defines key events in the turnaround/departure process that trigger information updates:

| # | Milestone | Abbreviation | Description |
|---|-----------|-------------|-------------|
| 1 | ATC Flight Plan Activation | -- | FPL processed by NM |
| 2 | EOBT Update | EOBT | Estimated Off-Block Time from flight plan |
| 3 | Take-Off from Outstation | -- | Inbound flight departs origin |
| 4 | Landing (ALDT) | ALDT | Actual landing at this airport |
| 5 | In-Block (AIBT) | AIBT | Aircraft on-blocks at stand |
| 6 | Ground Handling Starts | AGHT | Actual ground handling start |
| 7 | TOBT Update | TOBT | Target Off-Block Time set by handler |
| 8 | TSAT Issuance | TSAT | Target Start-up Approval Time from ATC |
| 9 | CTOT Allocation | CTOT | Calculated Take-Off Time from NM |
| 10 | Boarding Starts | -- | Passenger boarding commences |
| 11 | Aircraft Ready | ARDT | Aircraft ready for departure |
| 12 | Start-up Request | ASRT | Actual start-up request time |
| 13 | Start-up Approved | ASAT | Actual start-up approval time |
| 14 | Off-Block (AOBT) | AOBT | Actual off-block time |
| 15 | Wheels-Off (ATOT) | ATOT | Actual take-off time |
| 16 | Cancellation | -- | Flight cancelled |

### DPI Message Types

DPI messages flow from the airport CDM system to the EUROCONTROL Network Manager:

| DPI Type | Full Name | Trigger | Key Data |
|----------|-----------|---------|----------|
| **E-DPI** | Early DPI | Flight plan activated or EOBT updated | EOBT, airport, aircraft type |
| **T-DPI-t** | Target DPI (target) | TOBT set/updated | TOBT, TSAT, taxi time |
| **T-DPI-s** | Target DPI (sequenced) | TSAT issued by ATC | TSAT, TTOT, SID, runway |
| **ATC-DPI** | ATC DPI | Start-up approved | ASAT, taxi time, de-icing |
| **A-DPI** | Actual DPI | Aircraft off-blocks | AOBT, actual taxi time |
| **C-DPI** | Cancel DPI | Flight cancelled | Cancellation reason |

### DPI Message Data Elements

A T-DPI-s message (the most data-rich) includes:

| Field | Description | Example |
|-------|-------------|---------|
| `IFPLID` | Integrated Flight Plan Identifier | `AA12345678` |
| `ADEP` | Departure aerodrome (ICAO) | `EHAM` |
| `ADES` | Destination aerodrome (ICAO) | `EGLL` |
| `EOBT` | Estimated Off-Block Time | `2026-03-22T08:30:00Z` |
| `TOBT` | Target Off-Block Time | `2026-03-22T08:25:00Z` |
| `TSAT` | Target Start-up Approval Time | `2026-03-22T08:28:00Z` |
| `TTOT` | Target Take-Off Time | `2026-03-22T08:43:00Z` |
| `CTOT` | Calculated Take-Off Time (if slot) | `2026-03-22T08:45:00Z` |
| `EXOT` | Estimated taxi-out time (minutes) | `15` |
| `SID` | Standard Instrument Departure | `PAMPUS1A` |
| `RWY` | Departure runway | `24` |
| `REG` | Aircraft registration | `PH-BXA` |
| `ARCTYP` | Aircraft ICAO type | `B738` |
| `TAXITIME` | Estimated taxi time | `12` |
| `DEICE` | De-icing required | `YES` / `NO` |

### Example DPI Message (XML)

```xml
<!-- T-DPI-s: Target DPI (Sequenced) -->
<dpi:DepartureMessage xmlns:dpi="eurocontrol/cfmu/b2b/DPIServices">
  <messageType>T-DPI-s</messageType>
  <sendTime>2026-03-22T08:20:00Z</sendTime>
  <flightIdentification>
    <ifplId>AA12345678</ifplId>
    <aircraftId>KLM1234</aircraftId>
    <adep>EHAM</adep>
    <ades>EGLL</ades>
    <eobt>2026-03-22T08:30:00Z</eobt>
  </flightIdentification>
  <cdmData>
    <tobt>2026-03-22T08:25:00Z</tobt>
    <tsat>2026-03-22T08:28:00Z</tsat>
    <ttot>2026-03-22T08:43:00Z</ttot>
    <ctot>2026-03-22T08:45:00Z</ctot>
    <taxiTime>PT12M</taxiTime>
    <sid>PAMPUS1A</sid>
    <runway>24</runway>
    <deIceRequired>false</deIceRequired>
  </cdmData>
  <aircraftData>
    <registration>PH-BXA</registration>
    <aircraftType>B738</aircraftType>
  </aircraftData>
</dpi:DepartureMessage>
```

### FUM (Flight Update Message) -- NM to Airport

The reverse flow uses FUM messages from the Network Manager back to the airport:

| Field | Description |
|-------|-------------|
| `CTOT` | Slot time allocated by NM |
| `STAM` | Slot tolerance window (not before/not after) |
| `SIP` | Slot improvement proposal |
| `RegulationId` | Active regulation causing the slot |
| `MostPenalisingRegulation` | Primary constraint identifier |

### Relevance to Airside AVs

A-CDM data drives predictive ground operations:
- **TOBT/TSAT** determines when pushback equipment needs to be at the stand
- **TTOT/CTOT** predicts when the aircraft will taxi and which taxiways will be occupied
- **Turnaround milestones** trigger sequencing of baggage, fuel, catering vehicles
- **De-icing flag** indicates whether aircraft will route via de-icing pad
- **SID/Runway** predicts taxi route from stand to departure runway

---

## 9. Laminar Data API

Laminar Data (operated by EUROCONTROL) provided a REST API for European aviation data. Note: As of late 2025, the service appears to have been discontinued or consolidated into other EUROCONTROL services.

### Historical API Details (v2)

**Base URL**: `https://api.laminardata.aero/v2`

**Authentication**: API key via query parameter or header

**Data provided**:
- Real-time flight positions (EUROCONTROL radar/ADS-B feed)
- Flight plan data (filed & updated)
- Airport information
- Airspace data

**Key endpoints** (when operational):
```
GET /flights                    # Active flights
GET /flights/{id}               # Specific flight details
GET /flights/{id}/track         # Flight track/trajectory
GET /airports/{icao}            # Airport information
GET /airports/{icao}/flights    # Flights at airport
```

**Alternatives for European data**:
- EUROCONTROL NM B2B services (see section 2)
- OpenSky Network (see section 5.1)
- EUROCONTROL DDR2 (Demand Data Repository) for historical analysis

---

## 10. Integration Architecture for Airside AVs

Recommended data integration stack for an autonomous vehicle operating on the airport airside:

### Real-Time Layer (< 1 second latency)

| Data Source | Purpose | Update Rate |
|-------------|---------|-------------|
| Local ADS-B receiver + pyModeS | Aircraft surface positions | 1--2 Hz |
| ADS-B Exchange Enterprise API | Redundant aircraft tracking | 2 Hz |
| Airport ATC radio (speech-to-text) | Taxi clearances, hold instructions | Continuous |
| Vehicle sensors (LiDAR, camera, radar) | Local environment | 10+ Hz |

### Operational Layer (1--60 second latency)

| Data Source | Purpose | Update Rate |
|-------------|---------|-------------|
| AODB via ACRIS API | Stand assignments, flight status | 5--30 sec |
| A-CDM DPI messages | Departure sequence, TOBT/TSAT | Event-driven |
| FAA NOTAM API / EUROCONTROL B2B | Closures, restrictions | 5 min poll |
| FlightAware AeroAPI | Arrival predictions, ETA | 15--60 sec |

### Static/Planning Layer (daily--monthly updates)

| Data Source | Purpose | Update Rate |
|-------------|---------|-------------|
| AMDB data (Jeppesen/survey) | HD map base layer | 28--56 days |
| AIXM 5.1 from eAIP | Airport feature catalog | 28 days (AIRAC) |
| FAA NASR 28-day subscription | US airport data & obstacles | 28 days |
| Airport-specific GIS data | Infrastructure, construction | As needed |

### Data Flow Example: Aircraft Arrival

```
1. FlightAware AeroAPI: ETA update -> DL405 landing KJFK 14:18
2. AODB/ACRIS:          Stand assignment -> B42R
3. ADS-B (approach):    Aircraft on final RWY 31L, 5 NM out
4. AV Planner:          Pre-position baggage tug near B42R
5. ADS-B (surface):     Aircraft exits RWY 31L onto TWY A
6. ADS-B (surface):     Aircraft taxiing TWY A -> TWY B
7. AV Planner:          Clear path from TWY B to Stand B42R
8. AODB/ACRIS:          AIBT = 14:25 (actual in-block time)
9. AV Planner:          Start turnaround sequence at B42R
```

---

## Appendix A: Key URLs & Resources

| Resource | URL |
|----------|-----|
| FAA NOTAM API Portal | https://external-api.faa.gov/ |
| FAA NASR 28-Day Subscription | https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/ |
| EUROCONTROL NM B2B Access | https://www.eurocontrol.int/service/network-manager-business-business-b2b-web-services |
| EUROCONTROL A-CDM Portal | https://www.eurocontrol.int/concept/airport-collaborative-decision-making |
| AIXM 5.1 Specification | https://www.aixm.aero/page/aixm-51-specification |
| AIXM Donlon Sample Dataset | https://github.com/aixm/Donlon_2022 |
| OpenSky Network API | https://opensky-network.org/api |
| OpenSky Auth Portal | https://auth.opensky-network.org/ |
| ADS-B Exchange Enterprise | https://www.adsbexchange.com/products/enterprise-api/ |
| ADS-B Exchange V2 Fields | https://www.adsbexchange.com/version-2-api |
| FlightAware AeroAPI | https://flightaware.com/commercial/aeroapi/ |
| FlightAware Firehose | https://flightaware.com/commercial/firehose/ |
| pyModeS GitHub | https://github.com/junzis/pyModeS |
| pyModeS Decoding Guide | https://mode-s.org/1090mhz |
| ACI ACRIS | https://aci.aero/ (search for ACRIS) |
| AMDB Spec (RTCA DO-272D) | Available through RTCA (https://www.rtca.org/) |
| AMDB Spec (EUROCAE ED-99D) | Available through EUROCAE (https://www.eurocae.net/) |
