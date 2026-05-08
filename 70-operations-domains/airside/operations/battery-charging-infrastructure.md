# Battery and Charging Infrastructure for Autonomous Electric GSE Fleets

## Power Management for Airport Airside Operations

---

## 1. Electric GSE Battery Specifications

### 1.1 Battery Chemistry

| Chemistry | Voltage | Energy Density | Cycle Life | Temp Range | Cost | Used By |
|-----------|---------|---------------|------------|-----------|------|---------|
| **LiFePO4** (LFP) | 3.2V/cell | 90-120 Wh/kg | 4,000-6,000 | -20 to +60°C | Lower | Most GSE (dominant) |
| **NMC** (Lithium Nickel Manganese Cobalt) | 3.7V/cell | 150-220 Wh/kg | 1,000-2,000 | -20 to +45°C | Higher | Some premium GSE |
| **Lead-acid** (legacy) | 2V/cell | 30-50 Wh/kg | 500-800 | -15 to +50°C | Lowest | Legacy, being replaced |

**LiFePO4 dominates** for GSE because:
- Higher cycle life (4,000-6,000 vs 1,000-2,000 for NMC) = longer battery lifetime
- Better thermal stability (safer, no thermal runaway risk)
- Wider temperature range (important for outdoor airport operation)
- Lower cost per kWh over lifetime

### 1.2 Battery Specs by GSE Type

| GSE Type | Typical Capacity | Voltage | Weight | Runtime | Charge Time |
|----------|-----------------|---------|--------|---------|-------------|
| Baggage tractor (TractEasy EZTow) | 30-60 kWh | 48-80V | 300-600kg | 6-8 hours | 4-6h (AC), 1-2h (DC) |
| Belt loader | 20-40 kWh | 48V | 200-400kg | 4-6 hours | 3-5h (AC) |
| Pushback tug (electric) | 66-165 kWh | 400-700V | 500-1500kg | 4-8 hours | 30min-2h (DC fast) |
| Fuel truck (electric) | 80-150 kWh | 400V | 800-1200kg | 6-10 hours | 2-4h (DC) |
| Catering truck | 60-100 kWh | 400V | 600-900kg | 6-8 hours | 2-3h (DC) |
| Ground power unit (eGPU) | 40-80 kWh | 400V | 400-700kg | 4-6 hours | 2-3h (DC) |
| Autonomous compute overhead | ~0.06 kWh/h (Orin 60W) | 12V from main battery | <0.5kg | Negligible | N/A |

**Key insight:** The autonomous compute (Orin at 60W) consumes **<0.1% of battery capacity per hour** for a typical 60 kWh GSE. Autonomy does NOT meaningfully impact vehicle range.

---

## 2. Charging Strategies

### 2.1 Depot Charging (Overnight)

```
When: Between shifts (typically 22:00-06:00)
Where: Centralized charging depot near GSE parking area
Power: AC Level 2 (7-22 kW per vehicle)
Duration: 6-8 hours (full charge from 20% to 100%)
Cost: Lowest $/kWh (off-peak electricity rates)

For fleet of 24 vehicles:
  Total power needed: 24 × 15 kW = 360 kW peak
  Energy per night: 24 × 50 kWh × 0.8 (from 20% to 100%) = 960 kWh
  Cost at $0.10/kWh: $96/night ≈ $35K/year

Pros: Simple, lowest cost, full charge every day
Cons: All vehicles unavailable during charging, limited for 24/7 operations
```

### 2.2 Opportunity Charging (Between Tasks)

```
When: During idle time between turnarounds (15-45 minutes typical)
Where: Charging points distributed around apron/ramp area
Power: DC fast charge (50-150 kW per point)
Duration: 15-30 minutes (partial charge, 20-50% SOC gain)

Placement strategy:
  - At GSE staging areas near terminal
  - At vehicle queuing positions
  - Near high-traffic stands (vehicles wait here between tasks)

Energy per session: 15 min × 100 kW = 25 kWh (adds ~2 hours of runtime)

Pros: Vehicles available 24/7, extends range indefinitely
Cons: Higher infrastructure cost, more charge points needed, wear on battery
```

### 2.3 DC Fast Charging

```
When: Scheduled mid-shift charge (30-60 minutes)
Where: Dedicated fast-charge stations
Power: 150-400 kW
Duration: 30 minutes (20% to 80% for 60 kWh battery)

Infrastructure:
  - Goldhofer PHOENIX E: 150 kW DC fast charge, 30-min quick charge
  - CCS (Combined Charging System) standard for high-voltage GSE
  - CHAdeMO (less common for new installations)

Cost per station: $50-150K installed (including transformer, cabling)

Pros: Full charge in <1 hour, minimal downtime
Cons: High infrastructure cost, battery degradation from repeated fast charging
```

### 2.4 Autonomous Self-Charging

```
For autonomous GSE, the vehicle manages its own charging:

Algorithm:
  if battery_soc < 30% and no_urgent_tasks:
      navigate_to_nearest_charger()
      dock_with_charger()  # auto-alignment via camera/ultrasonic
      charge_until(soc=80% or next_task_assigned)
      undock_and_return_to_duty()

Automatic docking:
  - Camera-based alignment to charge port (±2cm accuracy needed)
  - Ultrasonic proximity sensing for final approach
  - Robotic charging arm (Rocsys, Eaton, ABB) — connects automatically
  - OR wireless/inductive charging pad (no docking needed, 85-92% efficiency)
```

---

## 3. Charging Infrastructure Vendors

| Vendor | Products | Power Range | Airport Deployments |
|--------|----------|-------------|-------------------|
| **PosiCharge** (EnerSys) | ProCore, Fast, EQ/IQ | 3-80 kW | Multiple airports |
| **Delta Electronics** | AC/DC chargers | 7-350 kW | Data center/fleet |
| **ABB** | Terra series | 50-360 kW | Some airports |
| **ITW GSE** | AXA Power chargers | 28-400V DC | Airport-focused (eGPU) |
| **Ravin Energy** | Smart charging platform | Various | Fleet management |
| **Fastcharge GSE** | GSE-specific chargers | Various | Airport-focused |
| **Kempower** | Satellite chargers | 40-600 kW | Scalable, distributed |
| **Rocsys** | Robotic charging | Auto-connect | Autonomous fleet charging |

---

## 4. Fleet Charging Optimization

### 4.1 Smart Scheduling

```python
class FleetChargingOptimizer:
    def optimize(self, vehicles, chargers, tasks, electricity_prices):
        """
        Optimize charging schedule to minimize cost while
        ensuring all vehicles are available for tasks.
        """
        for vehicle in vehicles:
            # Predict energy needs from upcoming task schedule
            energy_needed = self.predict_energy(vehicle, tasks)

            # Find optimal charging window
            window = self.find_cheapest_window(
                vehicle=vehicle,
                energy_needed=energy_needed,
                chargers=chargers,
                prices=electricity_prices,
                constraint=vehicle.next_task_time,  # must be charged by then
            )

            schedule.add(vehicle, window)

        # Load balancing: don't exceed site power capacity
        schedule = self.balance_load(schedule, max_site_power=500)  # kW

        return schedule
```

### 4.2 Key Optimization Metrics

```
Fleet charging KPIs:
  - Vehicle availability: >95% (vehicles ready for dispatch)
  - Peak power demand: minimize (electricity demand charges)
  - Battery health: maintain >80% capacity at year 5
  - Charger utilization: 60-80% (neither idle nor congested)
  - Energy cost per km: target <$0.05/km

Published finding: 5% of fleet size in charger count is optimal
  24 vehicles → 1-2 charger stations (with multiple ports)
```

---

## 5. Airport Power Infrastructure

### 5.1 Available Power

```
Existing airport power:
  - 400Hz ground power (for aircraft) — NOT suitable for GSE charging
  - 50/60Hz standard grid power — used for GSE charging
  - Typical substation capacity: 2-10 MVA per terminal
  - Available headroom for EV charging: varies widely by airport

Power for 24-vehicle fleet:
  Depot charging (overnight): ~360 kW peak
  Opportunity charging (daytime): ~200 kW peak (2-3 fast chargers)
  Total site addition: ~560 kW (well within most airport substations)
```

### 5.2 Sustainability Mandates Driving Electrification

| Regulation/Target | Requirement | Timeline |
|-------------------|-------------|----------|
| **CARB (California)** | Zero-emission GSE at major airports | By 2034 (LAX by 2033) |
| **ACI Europe** | Net-zero carbon | 303 airports by 2050, 118 by 2030 |
| **EU Green Deal** | Sustainable aviation fuel + ground ops | Progressive through 2030 |
| **IATA** | 35-52% CO2 reduction per turnaround | 2030 target |
| **Individual airports** | DFW, Schiphol, Changi — own targets | Various |

---

## 6. Cost Model

### 6.1 Charging Infrastructure Cost

| Component | Cost Range | Notes |
|-----------|-----------|-------|
| AC Level 2 charger (per port) | $3-8K | Depot charging |
| DC fast charger (50-150 kW) | $30-80K | Including installation |
| DC fast charger (150-350 kW) | $80-200K | For high-voltage GSE |
| Transformer/switchgear | $50-200K | If power upgrade needed |
| Cabling and trenching | $20-50K | Per charging location |
| Robotic charging arm (Rocsys) | $50-100K | For autonomous self-charging |
| Wireless charging pad (50 kW) | $40-80K | 85-92% efficiency |
| Charging management software | $5-20K/year | Fleet optimization |

### 6.2 Operating Cost Comparison

| Item | Diesel GSE | Electric GSE | Savings |
|------|-----------|-------------|---------|
| Fuel/energy per vehicle/year | $8-15K | $1.5-3K | 70-80% |
| Maintenance per vehicle/year | $5-8K | $2-4K | 40-60% |
| Battery replacement (amortized) | N/A | $2-4K/year | New cost |
| **Net operating cost** | **$13-23K** | **$5.5-11K** | **50-60% savings** |

**SeaTac (Seattle) result:** $2.8M/year fuel savings from GSE electrification.

### 6.3 TCO for 24-Vehicle Autonomous Electric Fleet

```
Year 1:
  Vehicles (24 × $80K): $1,920K
  Autonomy hardware (24 × $30K sensors+compute): $720K
  Charging infrastructure (2 DC fast + 24 AC depot): $250K
  Charging management software: $20K
  Installation and commissioning: $100K
  Total Year 1 CAPEX: ~$3,010K

Annual OPEX:
  Electricity: 24 × $2K = $48K
  Maintenance: 24 × $3K = $72K
  Battery replacement reserve: 24 × $3K = $72K
  Software licenses: $50K
  Insurance: 24 × $5K = $120K
  Total annual OPEX: ~$362K

Savings vs manual diesel:
  Driver labor eliminated: 24 × 3 shifts × $50K = $3,600K/year
  Fuel savings: 24 × $10K = $240K/year
  Maintenance savings: 24 × $4K = $96K/year
  Total annual savings: ~$3,936K/year

Payback period: $3,010K / ($3,936K - $362K) = 0.84 years
ROI Year 1: 119%
5-year NPV: ~$14.7M
```

---

## Sources

- EnerSys PosiCharge product documentation
- Goldhofer PHOENIX E specifications
- CARB zero-emission GSE regulations
- ACI Europe net-zero commitment data
- SeaTac electrification case study
- ITW GSE airport charging solutions
- Rocsys robotic charging specifications
- Airport Cooperative Research Program (ACRP) electrification reports
