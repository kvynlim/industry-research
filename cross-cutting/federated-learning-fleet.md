# Federated Learning for Fleet-Scale Autonomous Vehicle Training

> Comprehensive technical guide to federated and distributed learning approaches for training perception, prediction, and planning models across a fleet of autonomous vehicles deployed at multiple airports. Covers FL fundamentals (FedAvg through personalized FL), communication efficiency, privacy/security, heterogeneous federation, federated continual learning, multi-airport architecture, practical implementation with Flower/FLARE, and cost modeling. Designed for Aurrigo's ROS Noetic, LiDAR-primary stack scaling from 5-20 vehicles at one airport to 100+ vehicles across 10+ airports.

**Key Takeaway**: Federated learning is not a replacement for centralized training at Aurrigo's current scale (5-20 vehicles, 1-2 airports) -- the overhead exceeds the benefit. But as the fleet crosses ~30 vehicles across 3+ airports, FL becomes essential: raw data upload costs $98K+/year for 10 vehicles (see `cross-cutting/fleet-data-pipeline.md`), airport operators will resist sharing raw sensor data with competitors' infrastructure, and GDPR/data sovereignty requirements make centralized collection legally complex across jurisdictions. The recommended path is a **hybrid architecture**: centralized training on consented/owned data + federated LoRA adapter fine-tuning per airport, reducing communication cost by 97% compared to full-model FL while achieving within 1-2% of centralized accuracy.

---

## Table of Contents

1. [Why Federated Learning for Autonomous Fleets](#1-why-federated-learning-for-autonomous-fleets)
2. [Federated Learning Fundamentals](#2-federated-learning-fundamentals)
3. [Federated Learning for Perception](#3-federated-learning-for-perception)
4. [Communication Efficiency](#4-communication-efficiency)
5. [Privacy and Security](#5-privacy-and-security)
6. [Heterogeneous Federated Learning](#6-heterogeneous-federated-learning)
7. [Federated Continual Learning](#7-federated-continual-learning)
8. [Multi-Airport Federation Architecture](#8-multi-airport-federation-architecture)
9. [Practical Implementation](#9-practical-implementation)
10. [Comparison: Centralized vs Federated vs Hybrid](#10-comparison-centralized-vs-federated-vs-hybrid)
11. [Key Takeaways](#11-key-takeaways)
12. [References](#12-references)

---

## 1. Why Federated Learning for Autonomous Fleets

### 1.1 The Data Problem at Scale

Aurrigo's fleet data pipeline (see `cross-cutting/fleet-data-pipeline.md`) generates massive volumes per vehicle:

| Data Source | Per-Vehicle/Day (8h shift) | 10 Vehicles | 50 Vehicles | 100 Vehicles |
|---|---|---|---|---|
| LiDAR (4 RSHELIOS + 4 RSBP) | ~210 GB raw | 2.1 TB | 10.5 TB | 21 TB |
| LiDAR (Zstd compressed) | ~125 GB | 1.25 TB | 6.25 TB | 12.5 TB |
| Cameras (if added, 6x 720p) | ~336 GB | 3.36 TB | 16.8 TB | 33.6 TB |
| Telemetry + events | ~7 GB | 70 GB | 350 GB | 700 GB |
| **Daily total (LiDAR-only)** | **~132 GB** | **1.32 TB** | **6.6 TB** | **13.2 TB** |
| **Monthly total (LiDAR-only)** | **~2.9 TB** | **29 TB** | **145 TB** | **290 TB** |

Even with trigger-based collection (uploading only ~50 GB/day of high-value data per vehicle, as described in `cross-cutting/data-flywheel-airside.md`), a 100-vehicle fleet generates **5 TB/day** of uploaded data -- $180K/year in S3 storage alone, before transfer costs.

### 1.2 Five Barriers to Centralized Training at Scale

#### Barrier 1: Data Silos Between Airports

Airports operate as independent entities with distinct commercial interests. An airport operator (e.g., Changi Airport Group, Heathrow Airport Holdings) has zero incentive to share raw sensor data with a vehicle vendor who also serves competing airports. The data captures:
- Apron layouts and stand configurations (operational intelligence)
- Airline ground handling procedures (commercially sensitive)
- Security zone boundaries and patrol patterns (security-critical)
- Staffing levels and efficiency metrics (labor relations)

**Real-world precedent**: In the connected/autonomous vehicle industry, OEMs have repeatedly refused data-sharing agreements even within the same alliance (e.g., Renault-Nissan-Mitsubishi failed to create a shared driving dataset despite being partners). Airport operators are even more protective.

#### Barrier 2: Bandwidth and Transfer Cost

Airport 5G networks (see `20-av-platform/networking-connectivity/airport-5g-cbrs.md`) provide ~100 Mbps upload per vehicle. This sets a hard ceiling:

```
Upload capacity per vehicle:  100 Mbps = 12.5 MB/s = 45 GB/hour = 360 GB/8h shift
LiDAR raw data per vehicle:   210 GB/8h shift
LiDAR + cameras:              546 GB/8h shift
```

LiDAR-only data fits within the upload budget, but barely. Add cameras and it exceeds capacity. And this assumes dedicated bandwidth -- shared with other airport IT needs, the realistic allocation might be 20-30 Mbps per vehicle.

**Transfer cost at scale**:

| Fleet Size | Daily Upload (triggered) | Monthly Transfer Cost (AWS) | Annual Transfer Cost |
|---|---|---|---|
| 10 vehicles | 500 GB/day | ~$1,350 | ~$16,200 |
| 50 vehicles | 2.5 TB/day | ~$6,750 | ~$81,000 |
| 100 vehicles | 5 TB/day | ~$13,500 | ~$162,000 |

These are transfer costs alone. Add storage ($0.023/GB S3 Standard), and a 100-vehicle fleet's annual raw data cost approaches **$500K+/year**.

#### Barrier 3: Data Sovereignty and Regulation

Multi-airport deployment crosses jurisdictional boundaries:

| Regulation | Jurisdiction | Impact on Centralized Training |
|---|---|---|
| **GDPR** | EU/EEA | Personal data (worker images, faces) cannot leave EU without adequate protection |
| **UK GDPR** | UK | Post-Brexit separate framework, additional compliance burden |
| **FAA CertAlert 24-02** | USA | Testing data from FAA-controlled airspace subject to federal oversight |
| **Airport security regulations** | Per-airport | Camera feeds of security zones often cannot be stored off-premises |
| **Airline data agreements** | Per-airline | Ground handling data may be contractually restricted |
| **EU PLD 2024/2853** | EU | Software/AI data governance requirements for product liability (see `operations/safety/regulatory-trajectory.md`) |

A vehicle operating at Frankfurt (GDPR), Heathrow (UK GDPR), and Dallas-Fort Worth (FAA + Texas state law) faces three overlapping regulatory regimes. Centralizing raw sensor data from all three into a single training cluster is legally complex and expensive to maintain compliance.

#### Barrier 4: Latency to Improvement

Centralized training requires the full data pipeline to execute:

```
Vehicle → Upload (hours) → Storage → Labeling (days) → Training (hours) → Validation (days) → OTA deploy
                                Total: 1-4 weeks from data collection to improved model
```

Federated learning enables local model improvement within hours:

```
Vehicle → Local training (minutes-hours) → Upload model update (seconds) → Aggregate → Deploy
                                Total: hours to 1 day
```

For safety-critical scenarios (new hazard type discovered at one airport), FL can disseminate knowledge to the entire fleet within a single day vs. weeks for centralized pipelines.

#### Barrier 5: Single Point of Failure

Centralized training creates operational risk:
- Cloud outage halts all model training
- Central data breach exposes all fleet data simultaneously
- Single labeling pipeline bottleneck limits fleet-wide throughput

FL distributes risk: if one airport's edge server fails, other airports continue training independently.

### 1.3 When FL Makes Sense vs. When It Does Not

| Factor | Centralized Better | Federated Better |
|---|---|---|
| Fleet size | <20 vehicles, 1-2 airports | >30 vehicles, 3+ airports |
| Data ownership | All data owned by Aurrigo | Airport/airline retains data rights |
| Connectivity | High bandwidth, low cost | Limited bandwidth or high cost |
| Regulatory | Single jurisdiction | Multi-jurisdiction deployment |
| Data sensitivity | Low (no cameras, no PII) | High (cameras, PII, security zones) |
| Model complexity | Large models, long training | Adapter fine-tuning, incremental updates |
| Label availability | Centralized labeling team | Distributed annotation or auto-labeling |

**Aurrigo's trajectory**: Currently LiDAR-only at 1-2 airports (centralized is fine). Adding cameras + scaling to 5+ airports (hybrid FL becomes necessary). At 10+ airports across multiple countries (FL is essential).

### 1.4 Comparison with Centralized Data Flywheel

The data flywheel approach (detailed in `cross-cutting/data-flywheel-airside.md`) is not replaced by FL -- it is complemented:

| Aspect | Centralized Flywheel | Federated Learning | Hybrid (Recommended) |
|---|---|---|---|
| Data collection | Trigger-based upload to cloud | Data stays on-vehicle/airport | Triggered data to cloud + local data for FL |
| Labeling | Centralized auto-label + QA | On-vehicle auto-label or no labels (SSL) | Cloud labeling for critical data, FL for incremental |
| Training | GPU cluster (8-64 GPUs) | On-vehicle/edge (Orin 275 TOPS) | Base model centralized, adapters federated |
| Model distribution | OTA push to fleet | Aggregated model push to fleet | Base model OTA + adapter FL |
| Privacy | All data visible to Aurrigo | Data never leaves airport | Safety-critical data centralized, bulk federated |
| Cost (100 vehicles) | $500K+/year data infrastructure | $80K+/year FL infrastructure | $200K+/year hybrid |

---

## 2. Federated Learning Fundamentals

### 2.1 FedAvg: The Foundation

FedAvg (McMahan et al., 2017) is the canonical FL algorithm. It works by having each client train a local model copy and then averaging the resulting weights:

```python
def federated_averaging(
    global_model: nn.Module,
    clients: List[Client],
    num_rounds: int = 100,
    local_epochs: int = 5,
    client_fraction: float = 0.3,  # fraction of clients per round
    learning_rate: float = 0.01,
):
    """
    FedAvg: McMahan et al., "Communication-Efficient Learning of Deep Networks
    from Decentralized Data" (AISTATS 2017).
    
    Each round:
      1. Server selects a subset of clients
      2. Each selected client trains for E local epochs on its data
      3. Clients send updated weights to server
      4. Server averages weights, weighted by dataset size
    """
    for round_idx in range(num_rounds):
        # Select random subset of clients
        num_selected = max(1, int(client_fraction * len(clients)))
        selected = random.sample(clients, num_selected)
        
        # Distribute global model to selected clients
        global_weights = global_model.state_dict()
        
        client_updates = []
        client_sizes = []
        
        for client in selected:
            # Client receives global model
            local_model = copy.deepcopy(global_model)
            local_model.load_state_dict(global_weights)
            
            # Client trains locally
            optimizer = torch.optim.SGD(
                local_model.parameters(), lr=learning_rate
            )
            for epoch in range(local_epochs):
                for batch in client.dataloader:
                    loss = client.compute_loss(local_model, batch)
                    loss.backward()
                    optimizer.step()
                    optimizer.zero_grad()
            
            # Client sends updated weights
            client_updates.append(local_model.state_dict())
            client_sizes.append(len(client.dataset))
        
        # Server aggregates: weighted average by dataset size
        total_size = sum(client_sizes)
        new_weights = {}
        for key in global_weights.keys():
            new_weights[key] = sum(
                client_updates[i][key] * (client_sizes[i] / total_size)
                for i in range(len(selected))
            )
        
        global_model.load_state_dict(new_weights)
        
        # Evaluate global model
        if round_idx % 10 == 0:
            metrics = evaluate_global_model(global_model, validation_set)
            print(f"Round {round_idx}: {metrics}")
    
    return global_model
```

**Convergence properties**:
- IID data: converges to the same solution as centralized SGD
- Non-IID data: converges to a neighborhood of the optimum, with gap proportional to data heterogeneity
- Communication: O(R) rounds, each transmitting the full model size
- Local computation: O(R x E x B) gradient steps per client

**Limitations for AV fleets**:
1. **Non-IID data**: Airport A has 80% wide-body aircraft, Airport B has 90% narrow-body. The resulting local models have very different detection biases.
2. **Heterogeneous compute**: Orin (275 TOPS) vs. Xavier (30 TOPS) -- vehicles complete local training at very different rates.
3. **Stale updates**: Vehicles with intermittent connectivity send updates from many rounds ago.
4. **Communication cost**: Full model weights for PointPillars (~5M params = ~20 MB FP32) or BEVFormer (~60M params = ~240 MB FP32) must be transmitted each round.

### 2.2 FedProx: Handling Data Heterogeneity

FedProx (Li et al., 2020) adds a proximal term to the local objective, preventing any single client from diverging too far from the global model:

```python
def fedprox_local_training(
    local_model: nn.Module,
    global_model: nn.Module,
    client_dataloader: DataLoader,
    local_epochs: int = 5,
    learning_rate: float = 0.01,
    mu: float = 0.01,  # proximal term weight
):
    """
    FedProx: Li et al., "Federated Optimization in Heterogeneous Networks"
    (MLSys 2020).
    
    Local objective: h_k(w; w^t) = F_k(w) + (mu/2) * ||w - w^t||^2
    
    The proximal term penalizes local models that drift far from the
    global model, improving convergence under non-IID data.
    """
    global_weights = {
        name: param.clone().detach()
        for name, param in global_model.named_parameters()
    }
    optimizer = torch.optim.SGD(local_model.parameters(), lr=learning_rate)
    
    for epoch in range(local_epochs):
        for batch in client_dataloader:
            # Standard task loss
            loss = compute_detection_loss(local_model, batch)
            
            # Proximal regularization term
            proximal_term = 0.0
            for name, param in local_model.named_parameters():
                proximal_term += ((param - global_weights[name]) ** 2).sum()
            
            total_loss = loss + (mu / 2.0) * proximal_term
            
            total_loss.backward()
            optimizer.step()
            optimizer.zero_grad()
    
    return local_model
```

**Key tuning**: The `mu` parameter controls the stability-plasticity tradeoff:
- `mu = 0`: Reduces to FedAvg (maximum local adaptation, risk of divergence)
- `mu = 0.001-0.01`: Recommended for moderate heterogeneity (different airports, same country)
- `mu = 0.1-1.0`: Strong regularization (different continents, very different distributions)
- `mu → infinity`: All clients remain at the global model (no local learning)

**Empirical results** (Li et al.): On FEMNIST with non-IID partitioning, FedProx with mu=0.01 achieved 2-3% higher accuracy than FedAvg and converged in 30% fewer rounds.

### 2.3 SCAFFOLD: Variance Reduction via Control Variates

SCAFFOLD (Karimireddy et al., 2020) addresses the client drift problem more directly by maintaining control variates that correct for the difference between each client's local gradient and the global average gradient:

```python
class SCAFFOLDClient:
    """
    SCAFFOLD: Karimireddy et al., "SCAFFOLD: Stochastic Controlled Averaging
    for Federated Learning" (ICML 2020).
    
    Key idea: maintain a control variate c_i for each client that tracks
    the difference between local and global gradients. This corrects
    client drift without the blunt proximal penalty of FedProx.
    """
    def __init__(self, model, dataset, lr=0.01):
        self.model = model
        self.dataset = dataset
        self.lr = lr
        # Control variates (initialized to zero)
        self.c_local = {name: torch.zeros_like(param)
                        for name, param in model.named_parameters()}
    
    def local_train(self, global_model, c_global, local_epochs=5):
        """Train locally with variance-corrected gradients."""
        # Load global model weights
        self.model.load_state_dict(global_model.state_dict())
        
        for epoch in range(local_epochs):
            for batch in DataLoader(self.dataset, batch_size=32):
                loss = compute_loss(self.model, batch)
                loss.backward()
                
                # Correct gradient using control variates
                with torch.no_grad():
                    for name, param in self.model.named_parameters():
                        # g_corrected = g_local - c_local + c_global
                        correction = c_global[name] - self.c_local[name]
                        param.grad.add_(correction)
                        param.data -= self.lr * param.grad
                
                self.model.zero_grad()
        
        # Update local control variate
        new_c_local = {}
        for name, param in self.model.named_parameters():
            global_param = global_model.state_dict()[name]
            # c_i_new = c_i - c + (1/(K*lr)) * (x - y_i)
            new_c_local[name] = (
                self.c_local[name] - c_global[name] +
                (global_param - param.data) / (local_epochs * self.lr)
            )
        
        # Compute delta for server
        delta_model = {
            name: param.data - global_model.state_dict()[name]
            for name, param in self.model.named_parameters()
        }
        delta_control = {
            name: new_c_local[name] - self.c_local[name]
            for name in self.c_local
        }
        
        self.c_local = new_c_local
        return delta_model, delta_control
```

**Convergence guarantee**: SCAFFOLD matches the convergence rate of centralized SGD (O(1/T)) even with non-IID data, compared to FedAvg's O(1/T^{2/3}) under heterogeneity.

**Communication overhead**: 2x per round (model delta + control variate delta), but requires ~3-10x fewer rounds to converge under non-IID data, yielding a net reduction in total communication.

### 2.4 FedNova: Normalized Averaging

FedNova (Wang et al., 2020) addresses the problem of heterogeneous local computation -- when different clients perform different numbers of local gradient steps (e.g., an Orin completing 100 steps while a Xavier completes 20 in the same wall-clock time):

```
Standard FedAvg aggregation:  w_global = sum(n_i * w_i) / sum(n_i)
FedNova aggregation:          w_global = w_t - sum(n_i * tau_eff_i * d_i) / sum(n_i * tau_eff_i)
```

Where `tau_eff_i` is the effective number of local steps (normalized by momentum, weight decay, etc.) and `d_i` is the normalized gradient direction. This prevents clients with more compute from dominating the aggregation.

**Impact**: Without normalization, a single Orin vehicle running 5x more local epochs than Xavier vehicles would disproportionately bias the global model toward its local data distribution. FedNova eliminates this bias while allowing each vehicle to fully utilize its available compute.

### 2.5 Personalized Federated Learning Methods

For multi-airport deployment, a single global model is often insufficient -- each airport has site-specific characteristics that benefit from local specialization. Personalized FL methods produce both global shared knowledge and per-client specializations.

#### Per-FedAvg (Fallah et al., 2020)

Combines FL with Model-Agnostic Meta-Learning (MAML). The global model is trained to be a good initialization for local fine-tuning, rather than being directly deployed:

```python
def per_fedavg_local_update(
    model: nn.Module,
    dataloader: DataLoader,
    alpha: float = 0.01,   # inner learning rate (local fine-tune)
    beta: float = 0.001,   # outer learning rate (meta-update)
    local_steps: int = 5,
):
    """
    Per-FedAvg: Fallah et al., "Personalized Federated Learning with
    Moreau Envelopes" (NeurIPS 2020).
    
    Goal: Learn a global model that can be quickly personalized to each
    client via a few gradient steps. Uses MAML-style bi-level optimization.
    """
    for step in range(local_steps):
        # Sample support and query sets
        support_batch = next(iter(dataloader))
        query_batch = next(iter(dataloader))
        
        # Inner loop: take one gradient step on support set
        loss_support = compute_loss(model, support_batch)
        grads = torch.autograd.grad(loss_support, model.parameters())
        
        # Create adapted model (one step of fine-tuning)
        adapted_params = [
            p - alpha * g for p, g in zip(model.parameters(), grads)
        ]
        
        # Outer loop: evaluate adapted model on query set
        loss_query = compute_loss_with_params(model, adapted_params, query_batch)
        
        # Update model parameters using query loss
        loss_query.backward()
        with torch.no_grad():
            for param in model.parameters():
                param -= beta * param.grad
                param.grad.zero_()
    
    return model
```

**Relevance to airports**: The global model learned by Per-FedAvg is specifically optimized to be easily fine-tunable. When deploying to a new airport, 5-10 gradient steps on local data produces a personalized model -- much faster than training from scratch.

#### pFedMe (Dinh et al., 2020)

Uses the Moreau envelope to decouple personalization from global model learning:

```
Local objective: min_theta  F_i(theta) + (lambda/2) * ||theta - w||^2
Global objective: min_w     sum(p_i * [F_i(theta_i*) + (lambda/2) * ||theta_i* - w||^2])
```

Where `theta_i` is the personalized model for client i and `w` is the global model. This cleanly separates what is shared (w) from what is local (theta_i).

**Advantage over Per-FedAvg**: pFedMe does not require MAML's second-order gradients, making it computationally cheaper on edge hardware (important for Orin where training budget is limited).

#### FedBN (Li et al., 2021)

FedBN keeps batch normalization layers local while sharing all other layers globally:

```python
def fedbn_aggregation(global_model, client_models, client_sizes):
    """
    FedBN: Li et al., "FedBN: Federated Learning on Non-IID Features
    via Local Batch Normalization" (ICLR 2021).
    
    Key insight: BN statistics (running_mean, running_var) encode
    domain-specific information. Sharing them hurts under domain shift.
    Keep BN local, share everything else.
    """
    total_size = sum(client_sizes)
    new_global_weights = {}
    
    for key in global_model.state_dict().keys():
        # Skip batch norm parameters -- they stay local
        if "bn" in key or "norm" in key:
            continue
        
        # Average all other parameters
        new_global_weights[key] = sum(
            client_models[i].state_dict()[key] * (client_sizes[i] / total_size)
            for i in range(len(client_models))
        )
    
    # Update global model (BN layers unchanged)
    global_state = global_model.state_dict()
    global_state.update(new_global_weights)
    global_model.load_state_dict(global_state)
    
    return global_model
```

**Critical for airside**: LiDAR point cloud distributions vary significantly across airports (different ground reflectivity, different sensor mounting heights across vehicle types like ADT3 vs. STL2 vs. POD). BN statistics encode these sensor/environment characteristics. FedBN allows the backbone features to be shared globally while maintaining domain-specific normalization -- exactly the right split for multi-airport perception.

### 2.6 Convergence Analysis for Non-IID Data

| Algorithm | IID Convergence | Non-IID Convergence | Communication Rounds (CIFAR-10 non-IID) | Extra Storage |
|---|---|---|---|---|
| **FedAvg** | O(1/T) | O(1/T^{2/3}) + divergence term | ~500 | None |
| **FedProx** | O(1/T) | O(1/T) with bounded heterogeneity | ~350 | None |
| **SCAFFOLD** | O(1/T) | O(1/T) always | ~150-200 | 2x model size (control variates) |
| **FedNova** | O(1/T) | O(1/T) with normalized steps | ~400 | None |
| **Per-FedAvg** | N/A (personalized) | Per-client: O(1/T) + fine-tune | ~300 | Second-order gradients |
| **pFedMe** | N/A (personalized) | Per-client: O(1/sqrt(T)) | ~250 | Personalized model copy |
| **FedBN** | O(1/T) | O(1/T) for non-BN layers | ~300 | Local BN params only |

**Recommendation for Aurrigo**: Start with FedProx (simplest, good enough for moderate heterogeneity). Move to SCAFFOLD if convergence is too slow. Use FedBN universally for perception models (cheap, always helps).

### 2.7 Communication Rounds Analysis

For a perception model like PointPillars (~5M parameters, 20 MB in FP32):

| Configuration | Bytes/Round | Rounds to Converge | Total Communication | Wall-Clock Time (100 Mbps) |
|---|---|---|---|---|
| FedAvg, full model | 20 MB | 500 | 10 GB | ~14 min |
| FedProx, full model | 20 MB | 350 | 7 GB | ~10 min |
| SCAFFOLD, model + control | 40 MB | 175 | 7 GB | ~10 min |
| FedAvg + Top-K (1%) | 200 KB | 1,500 | 300 MB | ~24 sec |
| FedAvg + LoRA (rank 16) | 600 KB | 300 | 180 MB | ~15 sec |

For BEVFormer (~60M parameters, 240 MB):

| Configuration | Bytes/Round | Rounds to Converge | Total Communication | Wall-Clock Time (100 Mbps) |
|---|---|---|---|---|
| FedAvg, full model | 240 MB | 500 | 120 GB | ~2.7 hr |
| FedProx, full model | 240 MB | 350 | 84 GB | ~1.9 hr |
| FedAvg + LoRA (rank 32) | 3.5 MB | 300 | 1.05 GB | ~1.4 min |

**Key insight**: Full-model FL is feasible for small models (PointPillars) but impractical for large perception models over airport 5G. LoRA-based federated learning (Section 4) reduces communication by 50-100x, making FL practical for any model size.

---

## 3. Federated Learning for Perception

### 3.1 Federated Object Detection

Federated object detection has been explored in several works targeting autonomous driving:

**FedDet (Chen et al., 2023)**: Federated training of anchor-based 2D object detectors. Key finding: non-IID class distributions cause severe regression in rare-class detection. Their solution: a class-balanced sampling strategy during local training that over-samples underrepresented classes.

**FedVision (Liu et al., 2020)**: An FL platform specifically for visual tasks including object detection. Demonstrated that FedAvg achieves 89.2% of centralized mAP on federated COCO splits.

**For 3D LiDAR detection** (directly relevant to Aurrigo):

```python
class FederatedPointPillarsTrainer:
    """
    Federated training for PointPillars 3D object detection.
    
    Each airport runs PointPillars locally on Orin or edge GPU.
    Model updates are aggregated at a central server.
    
    Architecture: PointPillars (see foundations/pointpillars-technical.md)
    - Pillar Feature Net: learned point cloud encoding
    - 2D Backbone: pseudo-image feature extraction
    - Detection Head: class, bbox, orientation prediction
    
    FL strategy: FedBN + FedProx hybrid
    - Share backbone + detection head globally
    - Keep batch normalization local (domain-specific)
    - Proximal regularization prevents divergence
    """
    
    def __init__(self, config):
        self.global_model = PointPillars(
            num_classes=config.num_classes,  # 18-class airside taxonomy
            point_cloud_range=config.pcr,
            voxel_size=config.voxel_size,
        )
        self.airport_clients = {}
        self.round_idx = 0
        
    def register_airport(self, airport_id, num_vehicles, compute_type="orin"):
        """Register an airport as a federated client."""
        client = AirportFLClient(
            airport_id=airport_id,
            num_vehicles=num_vehicles,
            compute_type=compute_type,
            local_model=copy.deepcopy(self.global_model),
            mu=0.01,  # FedProx regularization
        )
        self.airport_clients[airport_id] = client
        
    def run_round(self):
        """Execute one round of federated training."""
        self.round_idx += 1
        
        # 1. Distribute global model (excluding BN layers)
        global_weights = {
            k: v for k, v in self.global_model.state_dict().items()
            if "bn" not in k and "norm" not in k
        }
        
        # 2. Each airport trains locally
        updates = {}
        for airport_id, client in self.airport_clients.items():
            # Client receives non-BN global weights
            client.receive_global_weights(global_weights)
            
            # Client trains for local_epochs on its data
            update, num_samples = client.local_train(
                local_epochs=5,
                lr=0.001,
            )
            updates[airport_id] = (update, num_samples)
        
        # 3. Aggregate (weighted by dataset size, excluding BN)
        total_samples = sum(n for _, n in updates.values())
        new_global = {}
        for key in global_weights.keys():
            new_global[key] = sum(
                updates[aid][0][key] * (updates[aid][1] / total_samples)
                for aid in updates
            )
        
        # 4. Update global model
        state = self.global_model.state_dict()
        state.update(new_global)
        self.global_model.load_state_dict(state)
        
        return self.evaluate()
```

### 3.2 Federated LiDAR Point Cloud Learning

LiDAR-based FL faces unique challenges compared to image-based FL:

**Point density heterogeneity**: Different sensor configs produce different point densities. Aurrigo uses RSHELIOS (32-beam, ~30K points/scan) and RSBP (16-beam, ~16K points/scan). Other fleet vehicles or partner deployments may use different sensors entirely (see `hardware/sensors/` for specifications). The pillar/voxel feature encoding must be robust to these variations.

**Coordinate system differences**: Different vehicle types (ADT3 with Ackermann, POD, STL2) have different sensor mounting positions and orientations. The ego-to-sensor transform differs per vehicle, affecting the point cloud distribution even for identical scenes.

**Scale differences**: Aircraft wingspan 30-65m; personnel 0.5m. Object scale distributions vary dramatically by airport type (hub vs. regional) and by the aircraft mix each airport handles.

**Federated pre-training strategy** (extending SSL concepts from `cross-cutting/ssl-pretraining.md`):

```
Phase 1: Self-supervised pre-training (centralized, on road datasets)
   └── Use nuScenes/Waymo for MAE/contrastive pre-training of backbone
   └── No labels needed, so no privacy concern
   └── Cost: ~$5-15K compute (see cross-cutting/ssl-pretraining.md)

Phase 2: Supervised fine-tuning (centralized, on first airport data)
   └── First airport provides labeled data under Aurrigo's full control
   └── Train full detection head with airside taxonomy
   └── Cost: ~$15-30K labeling + $5K training

Phase 3: Federated adaptation (distributed, per-airport)
   └── New airports fine-tune via FL, sharing only model updates
   └── LoRA adapters keep communication minimal
   └── FedBN preserves domain-specific normalization
   └── Cost: ~$5K infrastructure + near-zero marginal per airport
```

This three-phase approach combines the data efficiency of centralized pre-training with the privacy benefits of federated fine-tuning. It aligns with the transfer learning pipeline described in `cross-cutting/transfer-learning.md`, adding FL as the mechanism for multi-airport adaptation.

### 3.3 Federated BEV Perception

If Aurrigo adds cameras and moves toward BEV perception (see `30-autonomy-stack/perception/overview/bev-encoding.md`), federated BEV training introduces additional challenges:

**Camera intrinsic heterogeneity**: Different camera configurations across vehicle types produce different image resolutions, field-of-view, and distortion characteristics. BEV transformers use these intrinsics in the view transform, so models must handle heterogeneous inputs.

**Depth estimation variability**: Mono-depth models produce different error profiles depending on training data. Federated training of the depth estimation component risks averaging out learned depth priors.

**Solution -- modular FL**:

| Component | FL Strategy | Rationale |
|---|---|---|
| Image backbone (DINOv2/ResNet) | Global + FedBN | General features transfer well; BN captures domain-specific intensity |
| View transform (LSS/BEVFormer) | Global | Geometric projection is physics-based, transfers directly |
| Depth estimation | Local (not federated) | Too sensitive to camera calibration and mounting |
| BEV encoder | Global | Shared spatial reasoning |
| Detection head | Global + per-airport LoRA | Class distributions differ; LoRA adapts cheaply |

### 3.4 Non-IID Challenges in Airside FL

The non-IID problem is especially severe for airside operations:

#### Label Distribution Skew

| Airport Type | Wide-body % | Narrow-body % | Cargo % | Regional % | Dominant GSE |
|---|---|---|---|---|---|
| Major hub (LHR, FRA) | 40% | 45% | 10% | 5% | Large belt loaders, hi-loaders |
| Regional (BHX, EMA) | 5% | 60% | 5% | 30% | Small baggage tractors |
| Cargo hub (MEM, LEJ) | 10% | 15% | 70% | 5% | Cargo loaders, forklifts |
| Resort/seasonal (PMI, TFS) | 20% | 70% | 2% | 8% | Standard ground handlers |

A model trained only at Memphis (cargo hub) would have poor narrow-body aircraft detection at Birmingham (regional). FedAvg would under-weight rare classes; per-airport LoRA maintains local class balance.

#### Feature Distribution Shift

| Shift Source | Description | Mitigation |
|---|---|---|
| LiDAR reflectivity | Concrete vs. asphalt, wet vs. dry | FedBN (local normalization) |
| Scan geometry | Different mounting heights across vehicles | Coordinate normalization preprocessing |
| Weather | Snow cover, rain scatter, heat shimmer | Domain-specific augmentation |
| Lighting | Night operations (some airports), 24/7 vs. daytime | Not relevant for LiDAR-only (critical if cameras added) |
| Object density | Hub: 20+ GSE per stand; regional: 3-5 | Class-balanced local sampling |

### 3.5 Federated Pre-training + Local Fine-tuning Hybrid

The most practical approach for Aurrigo combines centralized pre-training with federated fine-tuning:

```
┌──────────────────────────────────────────────────────────────┐
│                   HYBRID FL ARCHITECTURE                      │
│                                                               │
│  CENTRALIZED (Cloud, 8-64 GPUs)                              │
│  ┌────────────────────────────────────┐                      │
│  │  1. SSL pre-train on road data      │                      │
│  │  2. Supervised train on Airport 1   │                      │
│  │  3. Aggregate FL updates            │                      │
│  │  4. Periodic full retraining        │                      │
│  └────────────────┬───────────────────┘                      │
│                   │                                           │
│         Model push│  Adapter pull                             │
│                   │                                           │
│  FEDERATED (Per-airport edge server)                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │Airport A │  │Airport B │  │Airport C │  │Airport D │       │
│  │LoRA fine-│  │LoRA fine-│  │LoRA fine-│  │LoRA fine-│       │
│  │tune on   │  │tune on   │  │tune on   │  │tune on   │       │
│  │local data│  │local data│  │local data│  │local data│       │
│  │FedBN     │  │FedBN     │  │FedBN     │  │FedBN     │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       │            │            │            │               │
│       └────────────┴──────┬─────┴────────────┘               │
│                           │                                   │
│              Adapter updates (600 KB each)                    │
│              aggregated at cloud server                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

This architecture achieves:
- **Centralized accuracy** for the base model (no FL accuracy penalty on shared features)
- **Per-airport specialization** via LoRA adapters (no data sharing required)
- **97% communication reduction** vs. full-model FL (LoRA rank-16 for PointPillars: ~600 KB vs. ~20 MB)
- **Compliance** with data sovereignty requirements (only adapter weights leave the airport)

---

## 4. Communication Efficiency

### 4.1 Gradient Compression

Full model transmission is the dominant cost in FL. Compression techniques reduce this:

#### Top-K Sparsification

Only transmit the K largest gradient components:

```python
def topk_sparsify(gradient_dict, k_fraction=0.01):
    """
    Top-K sparsification: transmit only the top 1% of gradient values.
    
    Stich et al., "Sparsified SGD with Memory" (NeurIPS 2018):
    Top-0.1% sparsification achieves same convergence as dense SGD
    with error feedback (memory of accumulated residuals).
    """
    sparse_update = {}
    residual = {}
    
    for name, grad in gradient_dict.items():
        flat = grad.flatten()
        k = max(1, int(len(flat) * k_fraction))
        
        # Find top-K values
        topk_values, topk_indices = torch.topk(flat.abs(), k)
        
        # Create sparse representation
        sparse_update[name] = {
            'indices': topk_indices,
            'values': flat[topk_indices],
            'shape': grad.shape,
        }
        
        # Accumulate residual for next round (error feedback)
        mask = torch.zeros_like(flat)
        mask[topk_indices] = 1.0
        residual[name] = flat * (1 - mask)  # un-transmitted components
    
    return sparse_update, residual
```

**Compression ratio**: Top-1% achieves 100x compression with <1% accuracy loss when combined with error feedback (accumulated residuals are added to the next round's gradients).

**Bandwidth impact for PointPillars** (5M params, 20 MB FP32):
- Top-1%: 200 KB/round (indices + values)
- Top-0.1%: 40 KB/round
- With error feedback: converges in ~2x more rounds, but net communication is 50x lower

#### Random Sparsification

Transmit a random subset of gradient components. Simpler than Top-K but requires more rounds:

```python
def random_sparsify(gradient_dict, keep_fraction=0.01, seed=None):
    """Random sparsification with unbiased estimation."""
    rng = torch.Generator()
    if seed:
        rng.manual_seed(seed)
    
    sparse_update = {}
    for name, grad in gradient_dict.items():
        mask = torch.bernoulli(
            torch.full_like(grad, keep_fraction), generator=rng
        )
        # Scale to maintain unbiased estimate: E[scaled_grad] = grad
        sparse_update[name] = grad * mask / keep_fraction
    
    return sparse_update
```

**Advantage**: No sorting needed (O(n) vs. O(n log K) for Top-K). Better for resource-constrained clients.

### 4.2 Quantized Gradients

Reduce the precision of transmitted gradients:

| Method | Bits/Value | Compression vs FP32 | Accuracy Impact | Reference |
|---|---|---|---|---|
| **FP16 gradients** | 16 | 2x | <0.1% | Standard practice |
| **QSGD** | 2-8 | 4-16x | 0.5-1% | Alistarh et al., NeurIPS 2017 |
| **TernGrad** | 2 (ternary: -1, 0, 1) | 16x | 1-2% | Wen et al., NeurIPS 2017 |
| **1-bit SGD** | 1 | 32x | 1-3% | Seide et al., Interspeech 2014 |
| **Stochastic quantization** | 1-4 | 8-32x | 0.3-1.5% | Various |

**Combined with sparsification**: Top-1% + 8-bit quantization achieves **400x compression** (20 MB FP32 model → 50 KB update).

```python
def quantize_gradients(gradient_dict, num_bits=8):
    """
    QSGD: Quantized Stochastic Gradient Descent.
    Alistarh et al., "QSGD: Communication-Efficient SGD via Gradient
    Quantization and Encoding" (NeurIPS 2017).
    """
    quantized = {}
    for name, grad in gradient_dict.items():
        # Normalize to [-1, 1]
        norm = grad.norm()
        if norm == 0:
            quantized[name] = {'norm': 0, 'signs': None, 'levels': None}
            continue
        
        normalized = grad / norm
        
        # Stochastic quantization to s levels
        s = 2 ** num_bits - 1
        abs_normalized = normalized.abs()
        level = (abs_normalized * s).floor()
        
        # Stochastic rounding
        prob = abs_normalized * s - level
        level += torch.bernoulli(prob)
        level = level.clamp(max=s)
        
        quantized[name] = {
            'norm': norm.item(),          # 1 float
            'signs': (normalized > 0),     # 1 bit per element
            'levels': level.to(torch.uint8),  # num_bits per element
            'shape': grad.shape,
        }
    
    return quantized
```

### 4.3 LoRA-Based Federated Learning

The most practical approach for large perception models: only train and transmit Low-Rank Adapter weights.

```python
class FederatedLoRA:
    """
    Federated LoRA: only train and transmit low-rank adapter weights.
    
    For a PointPillars backbone with 5M params:
    - Full model FL: 20 MB per round
    - LoRA rank-16: ~600 KB per round (33x reduction)
    - LoRA rank-8: ~300 KB per round (67x reduction)
    
    For BEVFormer with 60M params:
    - Full model FL: 240 MB per round
    - LoRA rank-32: ~3.5 MB per round (69x reduction)
    - LoRA rank-16: ~1.75 MB per round (137x reduction)
    
    Combined with INT8 quantization: additional 4x reduction.
    """
    
    def __init__(self, base_model, lora_rank=16, lora_alpha=32):
        self.base_model = base_model
        self.base_model.requires_grad_(False)  # Freeze base
        
        # Add LoRA to attention/conv layers
        self.lora_modules = {}
        for name, module in base_model.named_modules():
            if isinstance(module, (nn.Linear, nn.Conv2d)):
                lora = LoRAAdapter(module, rank=lora_rank, alpha=lora_alpha)
                self.lora_modules[name] = lora
        
        # Count trainable parameters
        total_params = sum(p.numel() for p in base_model.parameters())
        lora_params = sum(
            m.lora_A.numel() + m.lora_B.numel()
            for m in self.lora_modules.values()
        )
        self.compression_ratio = total_params / lora_params
        # Typically 30-150x depending on model and rank
    
    def get_lora_state(self):
        """Extract only LoRA weights for transmission."""
        return {
            name: {
                'A': module.lora_A.data,
                'B': module.lora_B.data,
            }
            for name, module in self.lora_modules.items()
        }
    
    def set_lora_state(self, state):
        """Load LoRA weights received from server."""
        for name, weights in state.items():
            self.lora_modules[name].lora_A.data = weights['A']
            self.lora_modules[name].lora_B.data = weights['B']
    
    def get_transmission_size_bytes(self):
        """Calculate bytes needed to transmit LoRA update."""
        total = 0
        for module in self.lora_modules.values():
            total += module.lora_A.numel() * 4  # FP32
            total += module.lora_B.numel() * 4
        return total
```

**LoRA FL is the recommended approach** for Aurrigo because:
1. PointLoRA (CVPR 2025) already demonstrated effectiveness for LiDAR point cloud fine-tuning (see `30-autonomy-stack/perception/overview/lidar-foundation-models.md`)
2. 500 labeled frames sufficient for same-cluster transfer with 1-3% mAP gap (see `operations/deployment/multi-airport-adaptation.md`)
3. Communication overhead is negligible over airport 5G

### 4.4 Bandwidth Budget Analysis for Airport 5G

Assuming a realistic 20-30 Mbps upload allocation per vehicle on airport 5G (shared with telemetry, remote monitoring, etc.):

| FL Configuration | Update Size | Upload Time (25 Mbps) | Rounds/Hour | Rounds/Day (8h) |
|---|---|---|---|---|
| Full PointPillars (FP32) | 20 MB | 6.4 sec | 562 | 4,500 |
| Full BEVFormer (FP32) | 240 MB | 77 sec | 47 | 374 |
| LoRA-16 PointPillars (FP32) | 600 KB | 0.2 sec | 18,000 | 144,000 |
| LoRA-32 BEVFormer (FP32) | 3.5 MB | 1.1 sec | 3,272 | 26,180 |
| LoRA-16 + INT8 quantization | 150 KB | 0.05 sec | 72,000 | 576,000 |

Even full model FL is feasible for small models on airport 5G. For large models, LoRA-based FL fits comfortably.

**Total bandwidth consumption per day** (100 rounds, 10 vehicles, LoRA-16 PointPillars):
```
10 vehicles × 100 rounds × 600 KB bidirectional = 1.2 GB/day
vs. trigger-based data upload: 500 GB/day
FL overhead: 0.24% of data upload bandwidth
```

### 4.5 Communication Frequency vs. Accuracy

| Communication Frequency | Local Epochs Before Sync | Convergence (rounds) | Final Accuracy (relative) | Best For |
|---|---|---|---|---|
| Every batch | 0 (distributed SGD) | Fastest | 100% (centralized equivalent) | Not feasible over WAN |
| Every 1 epoch | 1 | Fast | 99-100% | High-bandwidth, few clients |
| Every 5 epochs | 5 | Moderate | 97-99% | Standard FL, airport 5G |
| Every 20 epochs | 20 | Slow | 93-97% | Low-bandwidth, many clients |
| Daily sync | ~50-100 | Very slow | 90-95% | Intermittent connectivity |

**Recommendation**: Sync every 5 local epochs. At a local training rate of ~10 epochs/hour on Orin (PointPillars), this means syncing every 30 minutes.

### 4.6 Asynchronous FL for Intermittent Connectivity

Some airports may have connectivity gaps (e.g., vehicles in underground maintenance areas, airports with unreliable 5G). Asynchronous FL methods handle stale updates:

**FedAsync (Xie et al., 2019)**: Server aggregates each client's update immediately upon arrival, weighted by staleness:

```python
def fedasync_aggregate(global_model, client_update, staleness, alpha=0.5):
    """
    FedAsync: asynchronous federated learning with staleness weighting.
    
    alpha(tau) = alpha * (staleness + 1)^(-0.5)
    
    More stale updates receive less weight, preventing them from
    overwriting fresher global knowledge.
    """
    weight = alpha * (staleness + 1) ** (-0.5)
    
    global_state = global_model.state_dict()
    for key in client_update:
        global_state[key] = (
            (1 - weight) * global_state[key] +
            weight * client_update[key]
        )
    global_model.load_state_dict(global_state)
    return global_model
```

**FedBuff (Nguyen et al., 2022)**: Buffers K client updates before aggregating, reducing variance from individual stale updates. Recommended buffer size: K = sqrt(N) where N is total clients.

---

## 5. Privacy and Security

### 5.1 Differential Privacy in FL

Differential privacy (DP) provides a mathematical guarantee that no individual training example can be inferred from the model updates. This is critical when sensor data captures personnel, aircraft registration numbers, or airline operational patterns.

#### DP-FedAvg (McMahan et al., 2018)

```python
def dp_fedavg_round(
    global_model: nn.Module,
    client_updates: List[Dict],
    clip_norm: float = 1.0,     # gradient clipping bound (S)
    noise_multiplier: float = 1.0,  # sigma = noise_multiplier * S / sqrt(n)
    num_clients_sampled: int = 10,
):
    """
    DP-FedAvg: Differentially private federated averaging.
    
    McMahan et al., "Learning Differentially Private Recurrent Language
    Models" (ICLR 2018), extended to FL setting.
    
    Privacy guarantee: (epsilon, delta)-DP where:
      epsilon = O(q * sqrt(T * log(1/delta)) / (sigma * sqrt(n)))
      q = client sampling rate
      T = number of rounds
      n = clients per round
    """
    # Step 1: Clip each client's update to bound sensitivity
    clipped_updates = []
    for update in client_updates:
        # Compute L2 norm of the entire update
        update_norm = 0.0
        for key in update:
            update_norm += (update[key] ** 2).sum().item()
        update_norm = update_norm ** 0.5
        
        # Clip if necessary
        clip_factor = min(1.0, clip_norm / (update_norm + 1e-8))
        clipped = {key: val * clip_factor for key, val in update.items()}
        clipped_updates.append(clipped)
    
    # Step 2: Aggregate (average)
    n = len(clipped_updates)
    aggregated = {}
    for key in clipped_updates[0]:
        aggregated[key] = sum(u[key] for u in clipped_updates) / n
    
    # Step 3: Add calibrated Gaussian noise
    noise_std = noise_multiplier * clip_norm / n
    noised_update = {}
    for key in aggregated:
        noise = torch.randn_like(aggregated[key]) * noise_std
        noised_update[key] = aggregated[key] + noise
    
    # Step 4: Apply to global model
    state = global_model.state_dict()
    for key in noised_update:
        state[key] = state[key] + noised_update[key]
    global_model.load_state_dict(state)
    
    return global_model
```

### 5.2 Privacy Budget vs. Accuracy Tradeoff

The privacy parameter epsilon (lower = more private) directly impacts model utility:

| Epsilon | Privacy Level | Noise Magnitude | Accuracy Impact (typical) | Suitable For |
|---|---|---|---|---|
| 0.1-1.0 | Very strong | Very high | -15-30% mAP | Strict PII protection |
| 1.0-5.0 | Strong | High | -5-15% mAP | Regulatory compliance |
| 5.0-10.0 | Moderate | Moderate | -2-5% mAP | Commercial sensitivity |
| 10.0-50.0 | Weak | Low | -0.5-2% mAP | Internal data governance |
| Infinity | None | None | 0% (no DP) | Single-tenant deployment |

**For airside operations**: The primary privacy concern is airport operational data, not individual PII (LiDAR doesn't capture faces). An epsilon of 10-50 is likely sufficient, imposing only 0.5-2% accuracy loss.

**With LoRA-based FL**: DP noise is added to a much smaller parameter space (600 KB vs. 20 MB), so the signal-to-noise ratio is better. Empirically, LoRA FL with epsilon=10 achieves only 0.3-0.8% accuracy loss vs. non-private LoRA FL.

### 5.3 Secure Aggregation

Secure aggregation (SecAgg) ensures the server can compute the aggregate without seeing individual client updates:

**Protocol overview** (Bonawitz et al., 2017):
1. Each pair of clients (i, j) agrees on a shared random mask via Diffie-Hellman key exchange
2. Client i adds mask(i,j) to its update; client j subtracts mask(i,j)
3. When server sums all updates, masks cancel out: sum(mask(i,j) - mask(i,j)) = 0
4. Server sees only the aggregate, not individual contributions

**Computational cost**: O(n^2) key agreement for n clients. Practical for n < 1,000 (well within fleet size).

**Implementation**: Both Flower and NVIDIA FLARE include SecAgg implementations. Google's open-source SecAgg library handles the crypto.

### 5.4 Byzantine-Robust Aggregation

In a fleet setting, a compromised vehicle or a vehicle with severely corrupted data could send malicious updates. Byzantine-robust aggregation defends against this:

| Method | Mechanism | Corruption Tolerance | Overhead | Reference |
|---|---|---|---|---|
| **Krum** | Select the update closest to the majority | Up to 33% malicious | O(n^2 d) | Blanchard et al., NeurIPS 2017 |
| **Trimmed Mean** | Remove top/bottom beta fraction, average rest | Up to beta fraction | O(n d log d) | Yin et al., ICML 2018 |
| **Median** | Coordinate-wise median | Up to 50% malicious | O(n d) | Yin et al., ICML 2018 |
| **FLTrust** | Server maintains a small trusted dataset; scores clients by cosine similarity to trusted gradient | Unlimited (with trust anchor) | O(n d) | Cao et al., NDSS 2021 |
| **Robust FL with Reputation** | Track historical quality per client; weight by reputation | Adaptive | O(n d) | Various |

**Recommendation for Aurrigo**: FLTrust is most practical. The central server maintains a small validation dataset from each airport (100-500 labeled frames per airport, provided during onboarding). Client updates are scored by cosine similarity to the gradient computed on this trusted data. Updates that diverge significantly are down-weighted.

```python
def fltrust_aggregate(
    server_gradient: Dict,   # computed on trusted validation data
    client_updates: List[Dict],
    epsilon: float = 1e-8,
):
    """
    FLTrust: Cao et al., "FLTrust: Byzantine-Robust Federated Learning
    via Trust Bootstrapping" (NDSS 2021).
    
    Key idea: server computes a reference gradient on its own small
    trusted dataset. Client updates are scored by cosine similarity
    to this reference. Malicious updates (opposite direction) get
    zero weight.
    """
    # Flatten server gradient
    server_flat = torch.cat([v.flatten() for v in server_gradient.values()])
    server_norm = server_flat.norm() + epsilon
    
    # Score each client
    scores = []
    for update in client_updates:
        client_flat = torch.cat([v.flatten() for v in update.values()])
        
        # Cosine similarity with server gradient
        cos_sim = torch.dot(server_flat, client_flat) / (
            server_norm * (client_flat.norm() + epsilon)
        )
        
        # ReLU: negative similarity gets zero weight
        trust_score = max(0.0, cos_sim.item())
        scores.append(trust_score)
    
    # Normalize scores
    total_score = sum(scores) + epsilon
    weights = [s / total_score for s in scores]
    
    # Weighted aggregation with normalized client updates
    aggregated = {}
    for key in client_updates[0]:
        aggregated[key] = sum(
            weights[i] * client_updates[i][key] *
            (server_gradient[key].norm() / (client_updates[i][key].norm() + epsilon))
            for i in range(len(client_updates))
        )
    
    return aggregated
```

### 5.5 Attack Vectors and Defenses

| Attack | Description | Airside Risk | Defense |
|---|---|---|---|
| **Model inversion** | Reconstruct training data from model updates | Medium (reconstruct airport layout) | DP noise, SecAgg |
| **Gradient leakage** | Reconstruct individual training images from gradients | Low (LiDAR-only, no images) | Gradient compression, DP |
| **Data poisoning** | Inject mislabeled data to degrade model | Medium (false negatives for personnel) | FLTrust, anomaly detection |
| **Model poisoning** | Send malicious updates to backdoor global model | High (could suppress obstacle detection) | Krum, FLTrust, gradient inspection |
| **Free-riding** | Client sends random updates without training | Low (degrades model quality) | Contribution validation |
| **Sybil attack** | Create fake clients to dominate aggregation | Low (fleet is authenticated) | Device attestation |

**Gradient leakage specifics**: DLG (Deep Leakage from Gradients, Zhu et al. 2019) and subsequent works can reconstruct images from gradients. For LiDAR point clouds, reconstruction is harder (sparse, 3D) but not impossible. DP with epsilon >= 10 effectively prevents gradient leakage for point cloud data.

### 5.6 Airport-Specific Privacy Considerations

| Data Type | Sensitivity | Appears in Gradients? | Mitigation |
|---|---|---|---|
| Aircraft registration (tail numbers) | Medium -- airline identity | Not from LiDAR | N/A for LiDAR-only |
| Airline ground operations patterns | High -- competitive | Indirectly (temporal patterns) | DP + temporal decorrelation |
| Security zone boundaries | High -- security | Yes (spatial features) | DP + spatial masking of gradients |
| Personnel positions/movements | Medium -- privacy | Yes (detection features) | DP with epsilon <= 10 |
| Airport layout | Low (publicly available) | Yes | No mitigation needed |
| Aircraft maintenance activities | Medium -- airline ops | Indirectly | DP |

---

## 6. Heterogeneous Federated Learning

### 6.1 Types of Heterogeneity in Fleet Deployment

Aurrigo's fleet is heterogeneous across three dimensions:

#### System Heterogeneity

| Vehicle Type | Compute | TOPS | Training Capacity | Battery for Training |
|---|---|---|---|---|
| ADT3 (Ackermann) | Orin AGX | 275 | Full local training | 8-12h operational + charge |
| STL2 | Orin AGX | 275 | Full local training | 8-12h operational + charge |
| POD | Orin NX or Xavier | 100-275 | Limited local training | Shorter battery life |
| ACA1 | Xavier or Orin NX | 30-100 | Inference only | Cannot train locally |
| Future vehicles | Thor | 1,000+ | Full training + world models | Extended capability |

Vehicles with Xavier (30 TOPS) cannot perform full local training in reasonable time. They should either:
1. Not participate in FL (inference only), or
2. Participate via on-vehicle inference + off-vehicle training on airport edge server, or
3. Use knowledge distillation (send predictions, not gradients)

#### Data Heterogeneity

Each airport produces a different data distribution (see Section 3.4). Within an airport, different vehicle types see different perspectives:
- ADT3 (low, ackermann): ground-level view, narrow FOV
- STL2 (higher platform): broader view, different occlusion patterns
- POD (passenger vehicle): different routes, different speeds

#### Model Heterogeneity

Different vehicle types may run different model architectures optimized for their compute:
- Orin: Full PointPillars + BEV transformer
- Xavier: Lightweight PointPillars (reduced channels)
- Future Thor: Full world model + neural planner

Standard FL (FedAvg, FedProx) requires identical model architectures. Heterogeneous FL methods address this.

### 6.2 Federated Distillation (FedDF)

FedDF (Lin et al., 2020) allows heterogeneous models to participate in FL by exchanging predictions instead of parameters:

```python
class FederatedDistillation:
    """
    FedDF: Lin et al., "Ensemble Distillation for Robust Model Fusion
    in Federated Learning" (NeurIPS 2020).
    
    Key idea: clients train heterogeneous local models. Instead of
    averaging parameters, the server distills knowledge from an
    ensemble of client models into a new global model using an
    unlabeled public dataset.
    
    For airside: public dataset = nuScenes/Waymo (road data, no
    privacy concern). Client models = different architectures per
    vehicle type. Global model = standard architecture for deployment.
    """
    
    def __init__(self, public_dataset, server_model):
        self.public_dataset = public_dataset  # e.g., nuScenes point clouds
        self.server_model = server_model
        
    def aggregate_via_distillation(
        self,
        client_models: List[nn.Module],
        distill_epochs: int = 10,
        temperature: float = 3.0,
    ):
        """
        Server-side ensemble distillation.
        
        1. Each client model makes predictions on public dataset
        2. Predictions are averaged (ensemble)
        3. Server model is trained to match ensemble predictions
        """
        # Step 1: Collect soft predictions from all clients
        all_predictions = []
        for model in client_models:
            model.eval()
            preds = []
            with torch.no_grad():
                for batch in DataLoader(self.public_dataset, batch_size=16):
                    pred = model(batch)
                    preds.append(pred)
            all_predictions.append(torch.cat(preds))
        
        # Step 2: Ensemble average
        ensemble_preds = torch.stack(all_predictions).mean(dim=0)
        
        # Step 3: Distill into server model
        optimizer = torch.optim.Adam(self.server_model.parameters(), lr=1e-4)
        
        for epoch in range(distill_epochs):
            for i, batch in enumerate(DataLoader(self.public_dataset, batch_size=16)):
                student_pred = self.server_model(batch)
                
                # KL divergence between student and ensemble teacher
                loss = F.kl_div(
                    F.log_softmax(student_pred / temperature, dim=-1),
                    F.softmax(ensemble_preds[i*16:(i+1)*16] / temperature, dim=-1),
                    reduction='batchmean'
                ) * (temperature ** 2)
                
                loss.backward()
                optimizer.step()
                optimizer.zero_grad()
        
        return self.server_model
```

**Communication**: Each client sends predictions on the public dataset (much smaller than model weights for small public sets). A public dataset of 1,000 LiDAR frames with predictions is ~50 MB regardless of model size.

**Limitation**: Requires a public dataset that is representative enough. nuScenes road data works for general 3D features but misses airside-specific objects. A small shared airside calibration set (de-identified, non-sensitive) could supplement.

### 6.3 HEAL: Heterogeneous Agent Learning

HEAL (Lu et al., 2024) enables heterogeneous agents in cooperative perception to align their feature spaces via learned alignment modules:

```
Agent 1 (PointPillars) → Features → Alignment Module → Shared Feature Space ─┐
Agent 2 (BEVFormer)    → Features → Alignment Module → Shared Feature Space ──┤→ Aggregation
Agent 3 (CenterPoint)  → Features → Alignment Module → Shared Feature Space ─┘
```

**Relevance**: In the fleet perception context (see `cross-cutting/collaborative-fleet-perception.md`), different vehicle types produce features in different spaces. HEAL's approach -- lightweight learned projection layers that map heterogeneous features to a shared space -- applies directly to heterogeneous FL.

### 6.4 Split Learning

Split learning (Gupta and Raskar, 2018) splits the model between client and server:

```
Client side (on Orin):
  Input → [Layers 1-K] → Intermediate features (split layer activations)
                            ↓ Upload activations (not gradients)
Server side (cloud GPU):
  Activations → [Layers K+1 to N] → Loss → Backprop to split layer
                            ↓ Download gradients at split layer
Client side (on Orin):
  Gradient at split → Backprop [Layers K-1 to 1]
```

**Advantages**:
- Client only trains early layers (less compute needed)
- Server never sees raw data (only intermediate activations)
- Different clients can have different early architectures (different sensors)

**Disadvantages**:
- Requires synchronous communication per batch (high latency)
- Intermediate activations may leak information (SplitFed attack papers)
- Not practical for intermittent connectivity

**Verdict for Aurrigo**: Split learning is impractical for on-vehicle training (latency too high for each batch). Better suited for edge server + vehicle split within an airport (low latency LAN/5G).

### 6.5 Knowledge Distillation as Communication

For vehicles that cannot train locally (Xavier-based, limited compute), they can still contribute via inference:

```python
class InferenceOnlyFLClient:
    """
    Client that contributes to FL without local training.
    
    Instead of sending model updates, it sends:
    1. Soft predictions (logits) on its local data
    2. Feature embeddings for hard examples
    3. Uncertainty estimates (epistemic + aleatoric)
    
    The server uses these to update the global model via
    knowledge distillation, without ever seeing raw data.
    """
    
    def __init__(self, model, vehicle_id):
        self.model = model  # inference-only copy
        self.vehicle_id = vehicle_id
        
    def collect_soft_labels(self, dataloader, max_samples=1000):
        """Run inference and collect soft predictions."""
        self.model.eval()
        soft_labels = []
        
        with torch.no_grad():
            for batch in dataloader:
                logits = self.model(batch['point_cloud'])
                
                # Include metadata (no raw data)
                soft_labels.append({
                    'class_logits': logits['cls'].cpu(),
                    'bbox_preds': logits['bbox'].cpu(),
                    'confidence': logits['confidence'].cpu(),
                    'uncertainty': self.estimate_uncertainty(batch),
                    'scene_embedding': self.model.get_bev_features(batch).mean(dim=[2,3]).cpu(),
                    'timestamp': batch['timestamp'],
                    'ego_pose': batch['ego_pose'],
                    # NOTE: no point cloud, no images transmitted
                })
                
                if len(soft_labels) >= max_samples:
                    break
        
        return soft_labels
    
    def estimate_uncertainty(self, batch, mc_samples=5):
        """Monte Carlo dropout for uncertainty."""
        self.model.train()  # enable dropout
        predictions = []
        with torch.no_grad():
            for _ in range(mc_samples):
                pred = self.model(batch['point_cloud'])
                predictions.append(pred['cls'])
        self.model.eval()
        
        # Epistemic uncertainty = variance of predictions
        stacked = torch.stack(predictions)
        return stacked.var(dim=0).mean(dim=-1)
```

---

## 7. Federated Continual Learning

### 7.1 The Compounded Challenge

Federated continual learning (FCL) sits at the intersection of two hard problems (see `cross-cutting/continual-learning.md` for the continual learning perspective):

1. **Federated**: Non-IID data across clients, communication constraints, privacy
2. **Continual**: Catastrophic forgetting, new classes/domains over time

For airside fleets, the temporal dimension is significant:
- **New GSE types**: Airports acquire new equipment (electric GSE transition is underway)
- **New aircraft**: Airbus A321XLR, Boeing 777X entering service
- **Seasonal changes**: Snow, de-icing operations appear/disappear seasonally
- **New airports**: Fleet expanding to new sites with different characteristics
- **Regulatory changes**: New restricted zones, speed limit changes

### 7.2 Federated Class-Incremental Learning (FCIL)

When new object classes need to be added to the detection model (e.g., a new type of electric GSE), FCIL must:
1. Learn the new class across the fleet
2. Not forget existing classes
3. Handle the fact that different airports encounter the new class at different times

```python
class FederatedClassIncrementalLearner:
    """
    Federated class-incremental learning for airside detection.
    
    Scenario: Airport A encounters a new electric cargo loader.
    Airport B hasn't seen it yet. The model must learn the new class
    from A's data without forgetting existing classes, and the
    knowledge must propagate to B for when it encounters the same
    equipment.
    
    Combines:
    - EWC (Elastic Weight Consolidation) for forgetting prevention
    - FedProx for federated stability
    - Prototype replay for class-balanced learning
    """
    
    def __init__(self, global_model, num_existing_classes=18):
        self.global_model = global_model
        self.num_classes = num_existing_classes
        self.class_prototypes = {}  # class -> mean feature vector
        self.fisher_diagonals = {}  # parameter importance
        
    def add_new_class(self, class_name, class_id):
        """Register a new class discovered in the fleet."""
        self.num_classes += 1
        # Expand detection head to include new class
        expand_detection_head(self.global_model, self.num_classes)
        
    def federated_incremental_round(
        self,
        clients: List,
        new_class_clients: List,
        lambda_ewc: float = 100.0,
        mu_fedprox: float = 0.01,
    ):
        """
        One round of federated class-incremental learning.
        
        clients: all clients (train on existing + new classes)
        new_class_clients: clients that have data for the new class
        """
        updates = []
        
        for client in clients:
            local_model = copy.deepcopy(self.global_model)
            
            # Local training with combined regularization
            for batch in client.dataloader:
                # Task loss (detection)
                loss = detection_loss(local_model, batch)
                
                # EWC: prevent forgetting important parameters
                ewc_loss = 0.0
                for name, param in local_model.named_parameters():
                    if name in self.fisher_diagonals:
                        ewc_loss += (
                            self.fisher_diagonals[name] *
                            (param - self.global_model.state_dict()[name]) ** 2
                        ).sum()
                loss += (lambda_ewc / 2.0) * ewc_loss
                
                # FedProx: prevent divergence from global
                proximal = sum(
                    ((p - gp) ** 2).sum()
                    for p, gp in zip(
                        local_model.parameters(),
                        self.global_model.parameters()
                    )
                )
                loss += (mu_fedprox / 2.0) * proximal
                
                loss.backward()
                # ... optimizer step
            
            # Prototype replay: send class prototypes, not raw data
            if client in new_class_clients:
                prototype = compute_class_prototype(
                    local_model, client.new_class_data
                )
                updates.append((local_model.state_dict(), prototype))
            else:
                updates.append((local_model.state_dict(), None))
        
        # Aggregate
        self.aggregate_incremental(updates)
        
        # Update Fisher information for EWC
        self.update_fisher()
```

### 7.3 EWC + FL: Federated Elastic Weight Consolidation

Combining EWC with FL requires careful handling of the Fisher Information Matrix (FIM):

**Per-client FIM**: Each client computes its local FIM on its data.
**Global FIM**: Average of local FIMs, weighted by dataset size.
**Challenge**: FIM computed on non-IID data may not be representative of global importance.

**Federated Online EWC**:
```
After each FL round:
  1. Each client computes local Fisher diagonal F_k on its latest data
  2. Clients send F_k to server (same size as model, but can be sparsified)
  3. Server computes global Fisher: F_global = sum(n_k * F_k) / sum(n_k)
  4. EWC penalty in next round uses F_global
```

**Communication overhead**: One additional model-sized vector per round. With FP16 + sparsification (top-10% of Fisher values), this is manageable.

### 7.4 Federated Replay Buffers

Replay buffers store examples from previous tasks to prevent forgetting. In FL, raw data cannot be shared, so alternatives are needed:

| Replay Strategy | Privacy | Storage | Communication | Forgetting Prevention |
|---|---|---|---|---|
| **Raw replay** (local only) | Preserved | High (per client) | None | Good (local) |
| **Prototype replay** | Preserved | Low | Prototype vectors | Moderate |
| **Generative replay** | Preserved | Model storage | Generator weights | Good |
| **Feature replay** | Moderate risk | Moderate | Feature vectors | Good |
| **Federated distillation replay** | Preserved | Public dataset | Soft labels | Good |

**Generative replay for LiDAR**: Train a small LiDAR point cloud generator (e.g., a lightweight version of LidarDM, see `30-autonomy-stack/world-models/lidar-native-world-models.md`) that can regenerate representative point cloud scenes from past airports. Only the generator weights are shared, not the generated data.

```python
class FederatedGenerativeReplay:
    """
    Federated generative replay: share generator, not data.
    
    Each client trains a small VAE/diffusion model on its local data.
    Generator weights are federated (small model, low communication).
    During training, generated past-domain data prevents forgetting.
    """
    
    def __init__(self, generator, perception_model):
        self.generator = generator  # small point cloud VAE
        self.perception = perception_model
        
    def train_with_replay(self, real_dataloader, replay_ratio=0.3):
        """Train on real data + generated replay data."""
        for batch in real_dataloader:
            # Real data loss
            real_loss = detection_loss(self.perception, batch)
            
            # Generate replay data from previous domains
            with torch.no_grad():
                replay_batch = self.generator.sample(
                    n=int(len(batch) * replay_ratio),
                    # Sample from all previously learned domains
                    domain_ids=self.generator.learned_domains,
                )
            
            # Replay loss (prevents forgetting)
            replay_loss = detection_loss(self.perception, replay_batch)
            
            total_loss = real_loss + replay_loss
            total_loss.backward()
            # ... optimizer step
```

### 7.5 Relevance to Airside Operations

| Scenario | Continual Learning Challenge | FCL Approach |
|---|---|---|
| New electric GSE type at Airport A | Class-incremental: add detection class | FCIL with prototype replay |
| New airport added to fleet | Domain-incremental: adapt to new layout/conditions | FedBN + EWC |
| Seasonal change (winter) | Distribution shift: snow, de-icing | TTA (test-time adaptation) + federated model update |
| Aircraft livery change | Appearance shift within existing classes | Fine-tune with replay buffer |
| New restricted zone | Task-incremental: new geofence boundary | Map update + planning adaptation (not perception) |
| Night operations added | Distribution shift: lighting conditions | Domain-specific BN + local adapter |

---

## 8. Multi-Airport Federation Architecture

### 8.1 Architecture Options

#### Option A: Hub-and-Spoke (Centralized Server)

```
                    ┌─────────────────┐
                    │  Central Server   │
                    │  (Cloud GPU)      │
                    │  - Aggregation    │
                    │  - Global model   │
                    │  - Validation     │
                    └────────┬──────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     ┌──────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
     │  Airport A   │  │  Airport B  │  │  Airport C  │
     │  (5 vehicles)│  │  (10 veh.) │  │  (3 veh.)  │
     │  Edge server │  │  Edge server│  │  Edge server│
     └─────────────┘  └────────────┘  └────────────┘
```

**Pros**: Simple, single aggregation point, easy to validate global model.
**Cons**: Single point of failure, all communication routes through cloud, privacy concentrated at one server.
**Best for**: Small fleet (5-30 vehicles), 1-5 airports, trusted central operator (Aurrigo owns the server).

#### Option B: Hierarchical (Two-Level Aggregation)

```
                    ┌─────────────────┐
                    │  Global Server    │
                    │  (Cloud)          │
                    └────────┬──────────┘
                             │
               ┌─────────────┼─────────────┐
               │                           │
        ┌──────┴──────┐             ┌──────┴──────┐
        │  Regional    │             │  Regional    │
        │  Server (EU) │             │  Server (US) │
        └──────┬──────┘             └──────┬──────┘
               │                           │
         ┌─────┼─────┐              ┌──────┼──────┐
         │     │     │              │      │      │
        LHR   FRA   AMS           DFW    LAX    JFK
```

**Pros**: Data stays within region (GDPR compliance), reduces cross-region bandwidth, regional models can be specialized.
**Cons**: More complex, two levels of aggregation delay.
**Best for**: Multi-country deployment (50+ vehicles, 10+ airports), regulatory compliance required.

#### Option C: Peer-to-Peer (Decentralized)

```
     Airport A ←──→ Airport B
         ↕              ↕
     Airport D ←──→ Airport C
```

**Pros**: No central server needed, resilient to single failures, airports communicate directly.
**Cons**: Complex consensus, slow convergence, network topology management, harder to validate.
**Best for**: Consortium of independent operators sharing models (unlikely near-term).

#### Option D: Hybrid (Centralized Base + Federated Adapters) -- RECOMMENDED

```
     ┌──────────────────────────────────────────────────────┐
     │                    CLOUD SERVER                       │
     │                                                       │
     │  Base Model Training (centralized, full GPU cluster)  │
     │  - Pre-train on road data (nuScenes/Waymo)           │
     │  - Train on owned airside data (Airport 1)           │
     │  - Aggregate LoRA adapters from fleet                │
     │  - Periodic full retraining (monthly)                │
     │                                                       │
     │  Adapter Aggregation Server                           │
     │  - Receive LoRA updates from airports                │
     │  - FedBN + FedProx aggregation                       │
     │  - Validate aggregated adapters                      │
     │  - Push improved adapters to fleet                   │
     └──────────────────┬───────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────┴──────┐ ┌───┴───┐ ┌──────┴──────┐
   │  Airport A   │ │Airport│ │  Airport C   │
   │              │ │   B   │ │              │
   │ Base model   │ │ Base  │ │ Base model   │
   │ + LoRA_A     │ │+LoRA_B│ │ + LoRA_C     │
   │ + Local BN   │ │+Lcl BN│ │ + Local BN   │
   │              │ │       │ │              │
   │ Edge server: │ │ Edge: │ │ Edge server: │
   │ local train  │ │ local │ │ local train  │
   │ LoRA only    │ │ train │ │ LoRA only    │
   └─────────────┘ └───────┘ └─────────────┘
```

**How it works**:
1. Cloud server trains full base model (centralized, high quality)
2. Each airport receives the base model and trains LoRA adapters locally
3. LoRA adapters are federated across airports (FedProx + FedBN)
4. Each airport maintains its own BN statistics (never shared)
5. Periodically (monthly), the cloud server retrains the base model incorporating insights from adapter aggregation

**This is the recommended architecture because**:
- Base model quality matches centralized training (no FL accuracy penalty)
- Per-airport specialization via LoRA (cheap, effective)
- Communication cost is minimal (LoRA updates are ~600 KB)
- Data sovereignty is preserved (raw data never leaves airport)
- Compatible with existing data flywheel (`cross-cutting/data-flywheel-airside.md`)

### 8.2 Fleet Topology: Within-Airport vs. Cross-Airport

| Level | Participants | Communication | Aggregation | Purpose |
|---|---|---|---|---|
| **Within-vehicle** | Single vehicle | N/A | N/A | On-device training during idle |
| **Within-airport** | All vehicles at one airport | LAN/5G (<5ms latency) | Every 30 min | Site-specific model, fast convergence |
| **Cross-airport** | All airports in a region | WAN (50-200ms) | Every 4-8 hours | Regional model improvement |
| **Global** | All airports worldwide | WAN (100-500ms) | Every 24 hours | Global model update |

**Within-airport FL is the highest-value layer**: vehicles at the same airport see overlapping but not identical data (different routes, different stands). Within-airport FL converges fast (low latency, similar distributions) and improves the site-specific model rapidly.

**Cross-airport FL is the higher-risk layer**: different airports may have conflicting optima. Use SCAFFOLD or FedBN to manage divergence.

### 8.3 Multi-Airport Federated Training Coordinator

```python
import time
import threading
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import copy
import torch
import torch.nn as nn

class AggregationLevel(Enum):
    WITHIN_AIRPORT = "within_airport"
    CROSS_AIRPORT = "cross_airport"
    GLOBAL = "global"


@dataclass
class AirportNode:
    """Represents one airport in the federation."""
    airport_id: str
    region: str
    num_vehicles: int
    compute_type: str  # "orin", "xavier", "thor"
    local_model: nn.Module = None
    local_bn_stats: Dict = field(default_factory=dict)
    lora_adapter: Dict = field(default_factory=dict)
    dataset_size: int = 0
    last_sync_time: float = 0.0
    training_status: str = "idle"


class MultiAirportFederationCoordinator:
    """
    Orchestrates federated learning across multiple airports.
    
    Architecture: Hybrid (centralized base + federated LoRA adapters)
    
    Aggregation hierarchy:
      1. Within-airport: vehicles aggregate via edge server (every 30 min)
      2. Cross-airport: airports in same region aggregate (every 4 hours)
      3. Global: regions aggregate (every 24 hours)
    
    Integration points:
      - Data flywheel (cross-cutting/data-flywheel-airside.md): FL is
        a parallel path to centralized training, not a replacement
      - Fleet data pipeline (cross-cutting/fleet-data-pipeline.md):
        model updates ride the same 5G infrastructure as data uploads
      - Multi-airport adaptation (operations/deployment/multi-airport-adaptation.md):
        FL replaces the per-airport fine-tuning step with federated fine-tuning
    """
    
    def __init__(
        self,
        global_model: nn.Module,
        aggregation_config: Dict,
    ):
        self.global_model = global_model
        self.airports: Dict[str, AirportNode] = {}
        self.regions: Dict[str, List[str]] = {}  # region -> [airport_ids]
        self.config = aggregation_config
        
        # Aggregation schedules
        self.within_airport_interval = 1800   # 30 minutes
        self.cross_airport_interval = 14400   # 4 hours
        self.global_interval = 86400          # 24 hours
        
        # History for validation
        self.round_history = []
        self.accuracy_history = {}
        
    def register_airport(
        self,
        airport_id: str,
        region: str,
        num_vehicles: int,
        compute_type: str = "orin",
    ):
        """Register a new airport in the federation."""
        node = AirportNode(
            airport_id=airport_id,
            region=region,
            num_vehicles=num_vehicles,
            compute_type=compute_type,
            local_model=copy.deepcopy(self.global_model),
        )
        self.airports[airport_id] = node
        
        if region not in self.regions:
            self.regions[region] = []
        self.regions[region].append(airport_id)
        
        print(
            f"Registered {airport_id} in region {region} "
            f"({num_vehicles} vehicles, {compute_type})"
        )
    
    def distribute_global_model(self):
        """Push global model (excluding BN) to all airports."""
        global_state = {
            k: v.clone()
            for k, v in self.global_model.state_dict().items()
            if "bn" not in k and "norm" not in k
        }
        
        for airport in self.airports.values():
            local_state = airport.local_model.state_dict()
            # Update non-BN layers from global
            for key in global_state:
                if key in local_state:
                    local_state[key] = global_state[key].clone()
            airport.local_model.load_state_dict(local_state)
        
        print(f"Distributed global model to {len(self.airports)} airports")
    
    def aggregate_within_airport(self, airport_id: str, vehicle_updates: List[Dict]):
        """
        Aggregate updates from vehicles within a single airport.
        Fast, low-latency, similar distributions.
        
        Uses simple FedAvg (data is relatively IID within an airport).
        """
        if not vehicle_updates:
            return
        
        airport = self.airports[airport_id]
        
        # Weighted average of vehicle updates
        total_samples = sum(u['num_samples'] for u in vehicle_updates)
        aggregated = {}
        
        for key in vehicle_updates[0]['lora_state']:
            aggregated[key] = sum(
                u['lora_state'][key] * (u['num_samples'] / total_samples)
                for u in vehicle_updates
            )
        
        airport.lora_adapter = aggregated
        airport.dataset_size = total_samples
        airport.last_sync_time = time.time()
        
        return aggregated
    
    def aggregate_cross_airport(self, region: str):
        """
        Aggregate LoRA adapters across airports in a region.
        
        Uses FedProx + FedBN:
        - LoRA weights are averaged with proximal regularization
        - BN statistics are NOT shared (stay local)
        - FLTrust scoring filters anomalous updates
        """
        airport_ids = self.regions.get(region, [])
        if len(airport_ids) < 2:
            return  # Need at least 2 airports to federate
        
        # Collect airport adapters
        adapters = []
        sizes = []
        for aid in airport_ids:
            airport = self.airports[aid]
            if airport.lora_adapter:  # has an update
                adapters.append(airport.lora_adapter)
                sizes.append(airport.dataset_size)
        
        if not adapters:
            return
        
        # FLTrust: score each adapter against validation gradient
        if hasattr(self, 'trust_gradient') and self.trust_gradient is not None:
            weights = self._fltrust_score(adapters)
        else:
            # Fallback to size-weighted averaging
            total = sum(sizes)
            weights = [s / total for s in sizes]
        
        # Weighted aggregation of LoRA adapters
        regional_adapter = {}
        for key in adapters[0]:
            regional_adapter[key] = sum(
                weights[i] * adapters[i][key]
                for i in range(len(adapters))
            )
        
        # Distribute regional adapter back to airports (excl. BN)
        for aid in airport_ids:
            self.airports[aid].lora_adapter = copy.deepcopy(regional_adapter)
        
        print(
            f"Region {region}: aggregated {len(adapters)} airports, "
            f"weights={[f'{w:.3f}' for w in weights]}"
        )
        
        return regional_adapter
    
    def aggregate_global(self):
        """
        Global aggregation across all regions.
        
        Runs every 24 hours. Aggregates regional adapters into
        a global adapter, then optionally merges into the base model.
        """
        regional_adapters = {}
        regional_sizes = {}
        
        for region, airport_ids in self.regions.items():
            # Compute regional aggregate if not already done
            region_adapter = self.aggregate_cross_airport(region)
            if region_adapter:
                regional_adapters[region] = region_adapter
                regional_sizes[region] = sum(
                    self.airports[aid].dataset_size
                    for aid in airport_ids
                )
        
        if not regional_adapters:
            return
        
        # Weight regions by total dataset size
        total = sum(regional_sizes.values())
        global_adapter = {}
        for key in list(regional_adapters.values())[0]:
            global_adapter[key] = sum(
                (regional_sizes[r] / total) * regional_adapters[r][key]
                for r in regional_adapters
            )
        
        # Validate global adapter before deployment
        validation_metrics = self._validate_adapter(global_adapter)
        
        if validation_metrics['mAP'] >= self.config.get('min_mAP_threshold', 0.60):
            # Accept the global adapter
            self._apply_adapter_to_global(global_adapter)
            self.distribute_global_model()
            
            self.round_history.append({
                'timestamp': time.time(),
                'metrics': validation_metrics,
                'num_airports': len(self.airports),
                'status': 'accepted',
            })
            
            print(f"Global aggregation accepted: mAP={validation_metrics['mAP']:.3f}")
        else:
            # Reject: adapter degraded the model
            self.round_history.append({
                'timestamp': time.time(),
                'metrics': validation_metrics,
                'status': 'rejected',
                'reason': f"mAP {validation_metrics['mAP']:.3f} below threshold",
            })
            print(f"Global aggregation REJECTED: mAP={validation_metrics['mAP']:.3f}")
    
    def _fltrust_score(self, adapters: List[Dict]) -> List[float]:
        """Score adapters by cosine similarity to trust gradient."""
        trust_flat = torch.cat([v.flatten() for v in self.trust_gradient.values()])
        trust_norm = trust_flat.norm() + 1e-8
        
        scores = []
        for adapter in adapters:
            adapter_flat = torch.cat([v.flatten() for v in adapter.values()])
            cos_sim = torch.dot(trust_flat, adapter_flat) / (
                trust_norm * (adapter_flat.norm() + 1e-8)
            )
            scores.append(max(0.0, cos_sim.item()))
        
        total = sum(scores) + 1e-8
        return [s / total for s in scores]
    
    def _validate_adapter(self, adapter: Dict) -> Dict:
        """Validate adapter on held-out data from each airport."""
        # Apply adapter to a copy of the global model
        test_model = copy.deepcopy(self.global_model)
        # ... apply LoRA adapter ...
        
        # Evaluate on validation sets from each airport
        results = {}
        for aid, airport in self.airports.items():
            if hasattr(airport, 'validation_set'):
                airport_metrics = evaluate_model(test_model, airport.validation_set)
                results[aid] = airport_metrics
        
        # Aggregate: weighted average mAP across airports
        total_samples = sum(r.get('num_samples', 1) for r in results.values())
        avg_mAP = sum(
            r['mAP'] * r.get('num_samples', 1) / total_samples
            for r in results.values()
        )
        
        return {
            'mAP': avg_mAP,
            'per_airport': results,
            'num_airports_evaluated': len(results),
        }
    
    def _apply_adapter_to_global(self, adapter: Dict):
        """Merge LoRA adapter into global model base weights."""
        # LoRA merge: W_new = W_base + alpha * B @ A
        # This periodically "absorbs" the adapter into the base
        # model, resetting the adapter for the next round of FL.
        pass  # Implementation depends on LoRA architecture
    
    def get_status(self) -> Dict:
        """Return federation status for monitoring dashboard."""
        return {
            'num_airports': len(self.airports),
            'num_regions': len(self.regions),
            'total_vehicles': sum(a.num_vehicles for a in self.airports.values()),
            'total_training_samples': sum(a.dataset_size for a in self.airports.values()),
            'last_global_round': (
                self.round_history[-1] if self.round_history else None
            ),
            'airports': {
                aid: {
                    'region': a.region,
                    'vehicles': a.num_vehicles,
                    'samples': a.dataset_size,
                    'last_sync': a.last_sync_time,
                    'status': a.training_status,
                }
                for aid, a in self.airports.items()
            },
        }


# Example usage
if __name__ == "__main__":
    # Initialize
    model = PointPillars(num_classes=18)
    coordinator = MultiAirportFederationCoordinator(
        global_model=model,
        aggregation_config={'min_mAP_threshold': 0.60},
    )
    
    # Register airports
    coordinator.register_airport("LHR", region="EU", num_vehicles=10, compute_type="orin")
    coordinator.register_airport("FRA", region="EU", num_vehicles=8, compute_type="orin")
    coordinator.register_airport("DFW", region="US", num_vehicles=5, compute_type="orin")
    coordinator.register_airport("BHX", region="EU", num_vehicles=3, compute_type="xavier")
    
    # Distribute initial model
    coordinator.distribute_global_model()
    
    # Simulation: run FL rounds
    for day in range(30):
        # Within-airport aggregation (every 30 min, simulated once per day)
        for aid in coordinator.airports:
            vehicle_updates = simulate_local_training(coordinator.airports[aid])
            coordinator.aggregate_within_airport(aid, vehicle_updates)
        
        # Cross-airport aggregation (every 4 hours, simulated once per day)
        for region in coordinator.regions:
            coordinator.aggregate_cross_airport(region)
        
        # Global aggregation (daily)
        coordinator.aggregate_global()
        
        print(f"Day {day+1}: {coordinator.get_status()}")
```

### 8.4 Integration with Existing Infrastructure

The FL system integrates with Aurrigo's existing and planned infrastructure:

| Existing Component | FL Integration Point | Details |
|---|---|---|
| **ROS Noetic stack** | On-vehicle training node | ROS node wraps PyTorch training, subscribes to sensor topics |
| **GTSAM localization** | Provides ego-pose for training data | Geo-tagged training samples enable location-aware FL |
| **Frenet planner** | Planning model not federated (safety-critical) | Only perception models are federated; planner stays classical |
| **OTA update system** | Model distribution channel | FL model updates use same OTA infrastructure as software updates |
| **Fleet data pipeline** | Trigger engine selects training data | FL uses same triggered data that would otherwise be uploaded |
| **Airport 5G** | Communication channel | FL updates share bandwidth with data uploads and teleoperation |
| **DVC** | Model version tracking | Each FL round creates a DVC-tracked model version |
| **W&B** | Experiment tracking | FL metrics logged alongside centralized training experiments |

---

## 9. Practical Implementation

### 9.1 FL Framework Comparison

| Framework | Maturity | Key Features | Language | License | Airside Suitability |
|---|---|---|---|---|---|
| **Flower** | Production-ready | Modular, supports any ML framework, gRPC/REST, built-in strategies | Python | Apache 2.0 | Best overall |
| **NVIDIA FLARE** | Production-ready | NVIDIA ecosystem integration, TensorRT aware, medical/auto focus | Python | Apache 2.0 | Best for Orin integration |
| **PySyft** | Research-grade | Privacy-first (DP, MPC, HE built-in), Duet for 2-party | Python | Apache 2.0 | Best for privacy research |
| **FedML** | Research-to-production | MLOps integration, distributed training, cross-platform | Python | Apache 2.0 | Good for large-scale |
| **TensorFlow Federated** | Research-grade | TF ecosystem, strong simulation, Google-backed | Python | Apache 2.0 | Limited (TF not primary) |
| **OpenFL** | Production-ready | Intel-backed, healthcare focus, certification-oriented | Python | Apache 2.0 | Good for regulated use |

**Recommendation: Flower for development + NVIDIA FLARE for production on Orin**.

Flower is the most flexible framework for rapid experimentation. Its strategy pattern makes it trivial to swap FedAvg for FedProx, SCAFFOLD, etc. For production deployment on Orin, NVIDIA FLARE provides tighter integration with TensorRT, CUDA, and the Orin ecosystem.

### 9.2 Flower Implementation Skeleton

```python
"""
Flower-based federated learning for airside perception.

Server: runs in cloud or regional edge server
Client: runs on Orin (per-vehicle) or airport edge server (per-airport)

Integration:
  - Training data from fleet data pipeline (cross-cutting/fleet-data-pipeline.md)
  - Model architecture from perception stack (technology/perception/)
  - Deployment via OTA (operations/deployment/ota-fleet-management.md)
"""

import flwr as fl
from flwr.common import (
    FitIns, FitRes, EvaluateIns, EvaluateRes,
    Parameters, Scalar, ndarrays_to_parameters,
    parameters_to_ndarrays,
)
from typing import Dict, List, Optional, Tuple
import torch
import numpy as np


# ─── CLIENT ────────────────────────────────────────────────────────

class AirportFlowerClient(fl.client.NumPyClient):
    """
    Flower client for one airport (or one vehicle).
    
    Runs on Orin AGX (275 TOPS) or airport edge GPU.
    Trains PointPillars + LoRA locally on airport's data.
    """
    
    def __init__(
        self,
        airport_id: str,
        model: torch.nn.Module,
        train_loader: torch.utils.data.DataLoader,
        val_loader: torch.utils.data.DataLoader,
        device: str = "cuda",
    ):
        self.airport_id = airport_id
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        
        # Only LoRA parameters are trainable
        self.trainable_params = [
            p for p in model.parameters() if p.requires_grad
        ]
        
    def get_parameters(self, config: Dict) -> List[np.ndarray]:
        """Return only LoRA adapter weights (not full model)."""
        return [
            p.cpu().detach().numpy()
            for p in self.trainable_params
        ]
    
    def set_parameters(self, parameters: List[np.ndarray]):
        """Load LoRA adapter weights from server."""
        for param, new_val in zip(self.trainable_params, parameters):
            param.data = torch.tensor(new_val).to(self.device)
    
    def fit(
        self,
        parameters: List[np.ndarray],
        config: Dict[str, Scalar],
    ) -> Tuple[List[np.ndarray], int, Dict[str, Scalar]]:
        """Local training round."""
        self.set_parameters(parameters)
        
        local_epochs = int(config.get("local_epochs", 5))
        lr = float(config.get("learning_rate", 0.001))
        mu = float(config.get("fedprox_mu", 0.01))
        
        # Save global parameters for FedProx
        global_params = [p.clone().detach() for p in self.trainable_params]
        
        optimizer = torch.optim.AdamW(self.trainable_params, lr=lr)
        
        num_samples = 0
        total_loss = 0.0
        
        for epoch in range(local_epochs):
            for batch in self.train_loader:
                batch = {k: v.to(self.device) for k, v in batch.items()}
                
                # Forward pass
                loss = self.model.compute_loss(batch)
                
                # FedProx proximal term
                if mu > 0:
                    proximal = sum(
                        ((p - gp) ** 2).sum()
                        for p, gp in zip(self.trainable_params, global_params)
                    )
                    loss += (mu / 2.0) * proximal
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                
                # Gradient clipping (for stability + DP preparation)
                torch.nn.utils.clip_grad_norm_(self.trainable_params, max_norm=1.0)
                
                optimizer.step()
                
                total_loss += loss.item()
                num_samples += len(batch['point_cloud'])
        
        # Return updated LoRA parameters
        return (
            self.get_parameters(config={}),
            num_samples,
            {"train_loss": total_loss / max(1, num_samples),
             "airport_id": self.airport_id},
        )
    
    def evaluate(
        self,
        parameters: List[np.ndarray],
        config: Dict[str, Scalar],
    ) -> Tuple[float, int, Dict[str, Scalar]]:
        """Evaluate global model on local validation data."""
        self.set_parameters(parameters)
        self.model.eval()
        
        total_loss = 0.0
        num_samples = 0
        all_preds = []
        all_gts = []
        
        with torch.no_grad():
            for batch in self.val_loader:
                batch = {k: v.to(self.device) for k, v in batch.items()}
                loss = self.model.compute_loss(batch)
                preds = self.model.predict(batch)
                
                total_loss += loss.item() * len(batch['point_cloud'])
                num_samples += len(batch['point_cloud'])
                all_preds.extend(preds)
                all_gts.extend(batch['annotations'])
        
        avg_loss = total_loss / max(1, num_samples)
        mAP = compute_mAP(all_preds, all_gts)
        
        return avg_loss, num_samples, {
            "mAP": mAP,
            "airport_id": self.airport_id,
        }


# ─── SERVER STRATEGY ───────────────────────────────────────────────

class AirsideFedProxBN(fl.server.strategy.FedProx):
    """
    Custom Flower strategy combining FedProx + FedBN + FLTrust.
    
    - FedProx: proximal regularization for non-IID stability
    - FedBN: BN layers excluded from aggregation
    - FLTrust: trust-scored aggregation for Byzantine robustness
    """
    
    def __init__(
        self,
        trust_validation_set=None,
        trust_model=None,
        min_mAP_threshold: float = 0.55,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.trust_validation_set = trust_validation_set
        self.trust_model = trust_model
        self.min_mAP = min_mAP_threshold
        self.best_mAP = 0.0
        self.best_parameters = None
    
    def aggregate_fit(
        self,
        server_round: int,
        results: List[Tuple[fl.server.client_proxy.ClientProxy, FitRes]],
        failures: List,
    ) -> Tuple[Optional[Parameters], Dict[str, Scalar]]:
        """Aggregate with FLTrust scoring."""
        if not results:
            return None, {}
        
        # Extract client updates and metadata
        updates = []
        num_samples_list = []
        airport_ids = []
        
        for client, fit_res in results:
            params = parameters_to_ndarrays(fit_res.parameters)
            updates.append(params)
            num_samples_list.append(fit_res.num_examples)
            airport_ids.append(fit_res.metrics.get("airport_id", "unknown"))
        
        # Compute trust scores if trust model available
        if self.trust_model is not None:
            weights = self._compute_trust_weights(updates)
        else:
            total = sum(num_samples_list)
            weights = [n / total for n in num_samples_list]
        
        # Weighted aggregation
        aggregated = [
            sum(w * u[i] for w, u in zip(weights, updates))
            for i in range(len(updates[0]))
        ]
        
        metrics = {
            "num_clients": len(results),
            "airports": str(airport_ids),
            "trust_weights": str([f"{w:.3f}" for w in weights]),
        }
        
        return ndarrays_to_parameters(aggregated), metrics
    
    def _compute_trust_weights(self, updates):
        """Compute FLTrust weights based on trusted gradient."""
        # Compute reference gradient on trusted validation set
        ref_grad = compute_gradient(self.trust_model, self.trust_validation_set)
        ref_flat = np.concatenate([g.flatten() for g in ref_grad])
        ref_norm = np.linalg.norm(ref_flat) + 1e-8
        
        scores = []
        for update in updates:
            update_flat = np.concatenate([u.flatten() for u in update])
            cos_sim = np.dot(ref_flat, update_flat) / (
                ref_norm * (np.linalg.norm(update_flat) + 1e-8)
            )
            scores.append(max(0.0, cos_sim))
        
        total = sum(scores) + 1e-8
        return [s / total for s in scores]


# ─── MAIN ──────────────────────────────────────────────────────────

def start_fl_server(
    num_rounds: int = 100,
    min_clients: int = 3,
    min_mAP: float = 0.55,
):
    """Start the Flower FL server."""
    strategy = AirsideFedProxBN(
        fraction_fit=0.8,        # 80% of clients per round
        fraction_evaluate=1.0,   # all clients evaluate
        min_fit_clients=min_clients,
        min_evaluate_clients=min_clients,
        min_available_clients=min_clients,
        proxmul=0.01,            # FedProx mu
        min_mAP_threshold=min_mAP,
    )
    
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=fl.server.ServerConfig(num_rounds=num_rounds),
        strategy=strategy,
    )


def start_fl_client(airport_id: str, server_address: str):
    """Start a Flower FL client at an airport."""
    model = load_pointpillars_with_lora(rank=16)
    train_loader = load_airport_data(airport_id, split="train")
    val_loader = load_airport_data(airport_id, split="val")
    
    client = AirportFlowerClient(
        airport_id=airport_id,
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
    )
    
    fl.client.start_numpy_client(
        server_address=server_address,
        client=client,
    )
```

### 9.3 NVIDIA FLARE for Orin Deployment

For production on Orin, NVIDIA FLARE provides tighter hardware integration:

```python
"""
NVIDIA FLARE configuration for Orin-based federated learning.

FLARE provides:
- TensorRT-aware training (can optimize model during FL)
- CUDA memory management for constrained devices (Orin: 32-64 GB)
- Built-in secure aggregation (ECDH + AES)
- Health monitoring for edge devices
"""

# FLARE job config (JSON-like, simplified)
flare_job_config = {
    "format_version": 2,
    "min_clients": 3,
    "num_rounds": 100,
    
    "server": {
        "heart_beat_timeout": 600,
        "task_timeout": 3600,
        "aggregator": {
            "name": "InTimeAccumulateWeightedAggregator",
            "expected_data_kind": "WEIGHT_DIFF",
            "aggregation_weights": {
                # Per-airport weighting (by dataset size)
                "airport_lhr": 1.0,
                "airport_fra": 0.8,
                "airport_dfw": 0.5,
                "airport_bhx": 0.3,
            },
        },
        "model_selector": {
            # Only accept models that improve validation mAP
            "name": "IntimeModelSelector",
            "key_metric": "val_mAP",
            "select_best": True,
        },
    },
    
    "client": {
        "training": {
            "epochs_per_round": 5,
            "batch_size": 8,  # Orin memory constraint
            "learning_rate": 0.001,
            "optimizer": "AdamW",
            "lora_rank": 16,
            "lora_alpha": 32,
        },
        "resource_limits": {
            "gpu_memory_fraction": 0.7,  # Reserve 30% for inference
            "max_training_time_seconds": 1800,  # 30 min max per round
        },
    },
}
```

### 9.4 On-Vehicle Training Feasibility (Orin)

Can Orin (275 TOPS, 32-64 GB shared memory) actually train models on-vehicle?

| Model | Forward Pass (ms) | Backward Pass (ms) | Memory (Training) | Batch Size (32 GB) | Training Speed |
|---|---|---|---|---|---|
| PointPillars (full) | 6.8 | ~20 | ~4 GB | 8 | ~40 samples/sec |
| PointPillars (LoRA-16) | 6.8 | ~8 | ~2.5 GB | 16 | ~80 samples/sec |
| CenterPoint (full) | ~15 | ~45 | ~8 GB | 4 | ~15 samples/sec |
| CenterPoint (LoRA-16) | ~15 | ~18 | ~5 GB | 8 | ~35 samples/sec |
| BEVFormer-Tiny (full) | ~50 | ~150 | ~16 GB | 2 | ~3 samples/sec |
| BEVFormer-Tiny (LoRA-32) | ~50 | ~40 | ~10 GB | 4 | ~8 samples/sec |

**With LoRA on Orin**:
- PointPillars: 80 samples/sec = ~1,000 samples in 12.5 seconds. One local epoch on 1,000 frames takes ~12.5 sec. Five local epochs = ~63 sec.
- CenterPoint: 35 samples/sec = ~1,000 samples in 28.5 sec. Five epochs = ~143 sec.

**Training during idle time**: Vehicles are idle during charging (4-8 hours, depending on battery). On Orin, 5 local epochs of LoRA fine-tuning on 1,000 frames takes 1-3 minutes. Even with just 30 minutes of idle training time, a vehicle can complete 10-30 local epochs.

**Memory constraint**: The Orin must also run inference (perception, planning) during training if the vehicle is in supervised autonomous mode. Reserve 30-50% of GPU memory for inference, leaving 16-35 GB for training. LoRA fine-tuning of PointPillars fits comfortably.

### 9.5 Edge Server Architecture (Per-Airport)

For airports where on-vehicle training is impractical (Xavier-based vehicles, battery constraints), an airport edge server provides the compute:

| Component | Specification | Cost |
|---|---|---|
| GPU | NVIDIA A4000 (16 GB) or RTX 4090 (24 GB) | $1,000-1,600 |
| CPU | AMD EPYC 7313P (16 cores) or equivalent | $800 |
| RAM | 64 GB DDR4 ECC | $200 |
| Storage | 2 TB NVMe (training data) + 4 TB HDD (archival) | $300 |
| Network | 10 GbE to airport 5G core | $100 |
| UPS | 1.5 kVA battery backup | $300 |
| Enclosure | Rack-mounted, airport-grade | $500 |
| **Total per airport** | | **$3,200-4,000** |

The edge server:
1. Receives triggered data from vehicles via airport 5G
2. Performs local training (LoRA fine-tuning)
3. Aggregates within-airport vehicle updates
4. Communicates with the cloud aggregation server

### 9.6 Deployment Timeline

| Phase | Duration | Activities | Fleet Coverage |
|---|---|---|---|
| **Phase 0: Research** | 3 months | FL framework evaluation, simulation on nuScenes, algorithm selection | Simulation only |
| **Phase 1: Single-airport FL** | 3 months | Deploy FL at Airport 1 (3-5 vehicles), validate on-vehicle LoRA training, compare FL vs. centralized | 1 airport |
| **Phase 2: Two-airport FL** | 3 months | Add Airport 2, test cross-airport federation, FedBN + FedProx, measure accuracy gap vs. centralized | 2 airports |
| **Phase 3: Multi-airport** | 6 months | Scale to 5+ airports, hierarchical aggregation, privacy features (DP, SecAgg), production hardening | 5+ airports |
| **Phase 4: Full fleet** | Ongoing | 10+ airports, continual FL, automated monitoring, regulatory compliance | Full fleet |

**Total time to production FL**: ~15 months from start. Phase 0 can begin immediately with existing nuScenes data and Flower framework.

### 9.7 Cost Model

#### FL Infrastructure Cost

| Component | One-Time | Annual | Notes |
|---|---|---|---|
| **Cloud aggregation server** | $2,000 | $12,000 | Cloud GPU instance for aggregation + validation |
| **Edge server per airport** | $3,500 | $2,000 | Hardware + maintenance + power |
| **Flower/FLARE licensing** | $0 | $0 | Apache 2.0, open source |
| **5G bandwidth for FL updates** | $0 | $500 | Negligible vs. data upload bandwidth |
| **Engineering (Phase 0-2)** | $150,000 | $0 | 2 engineers x 6 months |
| **Engineering (ongoing)** | $0 | $75,000 | 1 engineer x 50% time |
| **Monitoring/MLOps** | $5,000 | $6,000 | W&B, DVC, dashboard |

#### Total Cost of Ownership (5-year, scaling from 5 to 50 airports)

| Year | Airports | Vehicles | One-Time | Annual | Cumulative |
|---|---|---|---|---|---|
| Year 1 | 2 | 15 | $164,000 | $27,000 | $191,000 |
| Year 2 | 5 | 35 | $10,500 | $37,500 | $239,000 |
| Year 3 | 10 | 60 | $17,500 | $52,000 | $308,500 |
| Year 4 | 20 | 100 | $35,000 | $72,000 | $415,500 |
| Year 5 | 50 | 200 | $105,000 | $132,000 | $652,500 |

#### FL vs. Centralized Cost Comparison

| Cost Category | Centralized (50 airports) | Federated (50 airports) | Savings |
|---|---|---|---|
| Data transfer/storage | $500K+/year | $30K/year (FL updates only) | $470K/year |
| Training compute | $200K/year (GPU cluster) | $80K/year (distributed + edge) | $120K/year |
| Labeling | $300K/year (centralized) | $100K/year (auto-label + minimal manual) | $200K/year |
| Infrastructure | $50K/year | $132K/year (edge servers) | -$82K/year |
| Engineering | $150K/year | $75K/year | $75K/year |
| Privacy/compliance | $100K+/year (legal, DPO) | $20K/year (FL handles most) | $80K/year |
| **Total** | **$1.3M+/year** | **$437K/year** | **$863K/year** |

**Break-even point**: FL infrastructure pays for itself at ~10 airports (Year 3), primarily through reduced data transfer and privacy compliance costs.

---

## 10. Comparison: Centralized vs. Federated vs. Hybrid

### 10.1 Accuracy Comparison

| Approach | Expected mAP (airside detection) | Gap vs. Best | Notes |
|---|---|---|---|
| **Centralized (all data)** | 70-75% | Baseline (0%) | Upper bound, all data accessible |
| **Federated (FedAvg, full model)** | 65-70% | -3-7% | Non-IID degradation |
| **Federated (FedProx + FedBN)** | 67-72% | -2-5% | Better non-IID handling |
| **Federated (SCAFFOLD)** | 68-73% | -1-4% | Best convergence |
| **Hybrid (centralized base + federated LoRA)** | 69-74% | -0.5-2% | Recommended |
| **Per-airport centralized** | 60-65% | -8-12% | No cross-airport knowledge sharing |
| **No ML (classical only)** | N/A | N/A | Current Aurrigo approach |

**Key insight**: The accuracy gap between hybrid FL and fully centralized is only 0.5-2%, while the cost and privacy advantages are enormous. The real comparison is not "FL vs. centralized" but "hybrid FL vs. per-airport isolated training," where FL wins by 5-10% mAP through cross-airport knowledge sharing.

### 10.2 Multi-Dimensional Comparison

| Dimension | Centralized | Federated | Hybrid (Recommended) |
|---|---|---|---|
| **Model quality** | Best | Good (-2-5%) | Very good (-0.5-2%) |
| **Data privacy** | Poor (all data centralized) | Excellent (data stays local) | Good (base data centralized, bulk federated) |
| **Communication cost** | Very high ($500K+/yr @ 50 airports) | Low ($30K/yr FL updates) | Medium ($200K/yr) |
| **Latency to improvement** | Days-weeks | Hours | Hours (adapters), days (base model) |
| **GDPR compliance** | Difficult (cross-border transfers) | Easy (data stays in jurisdiction) | Good (minimal cross-border) |
| **Single point of failure** | Yes (cloud outage) | No (distributed) | Partial (base model centralized) |
| **Engineering complexity** | Low | High | Medium |
| **Scalability** | Linear cost increase | Sub-linear cost increase | Sub-linear |
| **Labeling requirement** | All data labeled centrally | Local auto-labeling sufficient | Centralized for base, local for adapters |
| **New airport onboarding** | 8 weeks, $75-150K | 2-4 weeks, $30-50K | 4-6 weeks, $50-100K |
| **Regulatory readiness** | Needs per-jurisdiction DPA | Built-in compliance | Balanced approach |

### 10.3 Decision Framework for Aurrigo

```
Fleet size < 20 vehicles, 1-2 airports:
  → Use CENTRALIZED training
  → Data volumes manageable, single-jurisdiction
  → FL overhead not justified

Fleet size 20-50 vehicles, 2-5 airports:
  → Begin HYBRID transition
  → Centralized base model + federated LoRA for new airports
  → Phase 1-2 of FL deployment

Fleet size 50+ vehicles, 5+ airports:
  → Full HYBRID architecture
  → Hierarchical federation with regional servers
  → Phase 3-4 of FL deployment

Fleet size 100+ vehicles, 10+ airports, multi-country:
  → HYBRID with full privacy stack
  → DP, SecAgg, Byzantine-robust aggregation
  → Regulatory compliance built in
  → Phase 4 with continuous operation
```

### 10.4 Risk Assessment

| Risk | Centralized | Federated | Hybrid | Mitigation |
|---|---|---|---|---|
| Data breach (all fleet data) | HIGH | LOW | MEDIUM | Encryption, access control, DP |
| Model poisoning | LOW (controlled data) | MEDIUM | LOW-MEDIUM | FLTrust, validation gates |
| Regulatory non-compliance | HIGH (multi-jurisdiction) | LOW | LOW | FL by design |
| Accuracy degradation | LOW | MEDIUM | LOW | Validation gates, rollback |
| Infrastructure failure | HIGH (single point) | LOW | LOW | Distributed architecture |
| Engineering talent scarcity | LOW (common stack) | HIGH (specialized FL) | MEDIUM | Flower/FLARE abstract complexity |
| Vendor lock-in | LOW | MEDIUM (framework choice) | MEDIUM | Use open-source FL frameworks |

---

## 11. Key Takeaways

1. **FL is not needed today but will be essential at scale**: At Aurrigo's current 5-20 vehicles at 1-2 airports, centralized training is simpler and more effective. At 30+ vehicles across 3+ airports, the data transfer cost ($500K+/year for 50 airports), privacy constraints (GDPR, airport security), and airport operators' refusal to share raw data make FL necessary.

2. **Hybrid architecture is optimal**: Centralized pre-training + supervised training for the base model, federated LoRA fine-tuning for per-airport adaptation. This achieves within 0.5-2% of fully centralized accuracy while reducing communication cost by 97% and preserving data sovereignty.

3. **LoRA-based FL reduces communication by 30-150x**: For PointPillars (5M params), LoRA rank-16 reduces per-round communication from 20 MB to 600 KB. For BEVFormer (60M params), from 240 MB to 3.5 MB. Combined with INT8 quantization, full FL training communication is <1 GB total.

4. **FedBN is mandatory for multi-airport perception**: Batch normalization statistics encode domain-specific information (ground reflectivity, sensor mounting, weather patterns). Sharing BN across airports degrades accuracy. Keeping BN local adds no communication overhead and consistently improves convergence.

5. **FedProx with mu=0.01 is the right starting algorithm**: Simple, effective for moderate heterogeneity (airports within same climate/region), and adds minimal overhead to FedAvg. Upgrade to SCAFFOLD only if cross-airport convergence is problematic.

6. **On-vehicle LoRA training on Orin is feasible**: 5 local epochs of LoRA fine-tuning on 1,000 LiDAR frames takes ~1-3 minutes on Orin AGX. Training can occur during charging or idle periods without impacting real-time inference.

7. **Airport 5G supports FL without dedicated bandwidth**: FL updates (600 KB per round for LoRA PointPillars) consume 0.24% of the bandwidth used for triggered data upload. Even full-model FL for small models fits within airport 5G capacity.

8. **Privacy requirements are moderate for LiDAR-only**: LiDAR point clouds contain minimal PII (no faces, no license plates). DP with epsilon=10-50 provides adequate protection against gradient leakage at <2% accuracy cost. If cameras are added, epsilon must tighten to 1-10.

9. **Byzantine-robust aggregation (FLTrust) is essential for production**: Fleet vehicles can have sensor degradation, corrupted data, or even supply-chain compromise. FLTrust requires maintaining a small trusted validation set per airport (100-500 labeled frames, provided during onboarding -- already part of the multi-airport adaptation process in `operations/deployment/multi-airport-adaptation.md`).

10. **Federated continual learning handles fleet evolution**: New GSE types, new aircraft, seasonal changes, and new airports all require the model to adapt without forgetting. EWC + FedProx prevents forgetting in the federated setting, while generative replay enables sharing knowledge of past domains without transmitting raw data.

11. **Edge servers cost $3,500 per airport**: A single NVIDIA A4000 or RTX 4090 server at each airport handles local training, within-airport aggregation, and model distribution. This is a negligible cost compared to vehicle hardware ($200K+) and airport onboarding ($75-150K from `operations/deployment/multi-airport-adaptation.md`).

12. **FL break-even occurs at ~10 airports (Year 3)**: FL infrastructure investment of ~$300K over 3 years saves $470K/year in data transfer and $200K/year in labeling compared to fully centralized training at 10+ airports. Cumulative savings exceed $1M by Year 5.

13. **Hierarchical aggregation matches organizational structure**: Within-airport FL (every 30 min) provides fast site-specific improvement. Cross-airport regional FL (every 4 hours) shares knowledge within regulatory zones. Global FL (daily) creates the universal base model. This maps naturally to airport groups, regulatory jurisdictions, and Aurrigo's deployment regions.

14. **Knowledge distillation enables Xavier-class vehicles to participate**: Vehicles with insufficient compute for local training (Xavier NX: 30 TOPS) can contribute by sending soft predictions on local data instead of gradients. The server distills this knowledge into the global model, ensuring no fleet data is wasted.

15. **Federated distillation (FedDF) solves model heterogeneity**: Different vehicle types (ADT3, STL2, POD) may run different model architectures optimized for their compute. FedDF allows heterogeneous models to participate in the same federation by exchanging predictions on a small public dataset rather than parameters.

16. **FL framework recommendation: Flower for development, NVIDIA FLARE for production**: Flower's strategy pattern enables rapid algorithm prototyping (swap FedAvg/FedProx/SCAFFOLD with one line). NVIDIA FLARE provides Orin-optimized training, built-in SecAgg, and TensorRT integration for production deployment.

17. **Start Phase 0 immediately**: FL research and simulation on nuScenes data using Flower can begin now with zero infrastructure investment. This de-risks the technology and trains the engineering team before FL is actually needed at scale.

18. **The FL accuracy gap narrows with fleet size**: With 3 airports and homogeneous data, FL may underperform centralized by 3-5%. With 20+ diverse airports, FL approaches centralized accuracy (0.5-1% gap) because the diversity of federated data compensates for the aggregation approximation.

19. **Complementary to the data flywheel, not a replacement**: FL handles incremental model improvement across the fleet. The centralized data flywheel (`cross-cutting/data-flywheel-airside.md`) handles major model retraining, scenario mining, synthetic data generation, and long-tail analysis. Both systems feed into the same model deployment pipeline.

20. **Total cost of ownership for 50-airport FL: ~$130K/year ongoing after Year 3 setup**: Compared to $1.3M+/year for fully centralized training at the same scale. The 10x cost reduction enables faster fleet expansion and lower per-airport onboarding cost ($30-50K FL-based vs. $75-150K centralized from `operations/deployment/multi-airport-adaptation.md`).

---

## 12. References

### Federated Learning Foundations
- McMahan et al., "Communication-Efficient Learning of Deep Networks from Decentralized Data" (AISTATS 2017) -- FedAvg
- Li et al., "Federated Optimization in Heterogeneous Networks" (MLSys 2020) -- FedProx
- Karimireddy et al., "SCAFFOLD: Stochastic Controlled Averaging for Federated Learning" (ICML 2020)
- Wang et al., "Tackling the Objective Inconsistency Problem in Heterogeneous Federated Optimization" (NeurIPS 2020) -- FedNova
- Fallah et al., "Personalized Federated Learning with Moreau Envelopes" (NeurIPS 2020) -- Per-FedAvg
- Dinh et al., "Personalized Federated Learning with Moreau Envelopes" (NeurIPS 2020) -- pFedMe
- Li et al., "FedBN: Federated Learning on Non-IID Features via Local Batch Normalization" (ICLR 2021)

### Federated Learning for Autonomous Driving
- "Federated Learning for Connected and Automated Vehicles: A Survey of Existing Approaches and Challenges" (IEEE TVT 2023)
- "FLAD: Federated Learning for LLM-based Autonomous Driving" (arXiv 2511.09025, 2025)
- "FLAV: Federated Learning for Autonomous Vehicle Privacy Protection" (Ad Hoc Networks 2024)
- "Personalized FL for Autonomous Driving with Correlated DP" (PMC 2024)
- FedLGA (2024): Taylor-expansion-based local gradient approximation for resource-constrained clients

### Communication Efficiency
- Alistarh et al., "QSGD: Communication-Efficient SGD via Gradient Quantization and Encoding" (NeurIPS 2017)
- Wen et al., "TernGrad: Ternary Gradients to Reduce Communication in Distributed Deep Learning" (NeurIPS 2017)
- Stich et al., "Sparsified SGD with Memory" (NeurIPS 2018)
- Seide et al., "1-Bit Stochastic Gradient Descent and its Application to Data-Parallel Distributed Training of Speech DNNs" (Interspeech 2014)

### Privacy and Security
- McMahan et al., "Learning Differentially Private Recurrent Language Models" (ICLR 2018) -- DP-FedAvg
- Bonawitz et al., "Practical Secure Aggregation for Privacy-Preserving Machine Learning" (CCS 2017)
- Blanchard et al., "Machine Learning with Adversaries: Byzantine Tolerant Gradient Descent" (NeurIPS 2017) -- Krum
- Yin et al., "Byzantine-Robust Distributed Learning: Towards Optimal Statistical Rates" (ICML 2018) -- Trimmed Mean
- Cao et al., "FLTrust: Byzantine-Robust Federated Learning via Trust Bootstrapping" (NDSS 2021)
- Zhu et al., "Deep Leakage from Gradients" (NeurIPS 2019)

### Heterogeneous and Personalized FL
- Lin et al., "Ensemble Distillation for Robust Model Fusion in Federated Learning" (NeurIPS 2020) -- FedDF
- Lu et al., "HEAL: An Extensible Framework for Open Heterogeneous Collaborative Perception" (ICLR 2024)
- Gupta and Raskar, "Distributed Learning of Deep Neural Network over Multiple Agents" (JMLR 2018) -- Split Learning

### Federated Continual Learning
- Kirkpatrick et al., "Overcoming Catastrophic Forgetting in Neural Networks" (PNAS 2017) -- EWC
- Shin et al., "Continual Learning with Deep Generative Replay" (NeurIPS 2017)
- Yoon et al., "Federated Continual Learning with Weighted Inter-client Transfer" (ICML 2021)
- Dong et al., "Federated Class-Incremental Learning" (CVPR 2022)

### FL Frameworks
- Beutel et al., "Flower: A Friendly Federated Learning Framework" (arXiv 2007.14390, 2020)
- "NVIDIA FLARE: An Open-Source Framework for Federated Learning" (NVIDIA 2022)
- Ziller et al., "PySyft: A Library for Easy Federated Learning" (FL workshop @ NeurIPS 2021)
- He et al., "FedML: A Research Library for Federated Machine Learning" (NeurIPS 2020 workshop)

### Asynchronous FL
- Xie et al., "Asynchronous Federated Optimization" (OPT workshop @ NeurIPS 2019) -- FedAsync
- Nguyen et al., "Federated Learning with Buffered Asynchronous Aggregation" (AISTATS 2022) -- FedBuff

### Cross-References (This Repository)
- `cross-cutting/data-flywheel-airside.md` -- Centralized data flywheel architecture
- `cross-cutting/fleet-data-pipeline.md` -- Data infrastructure from vehicle to training cluster
- `cross-cutting/transfer-learning.md` -- Road-to-airside domain adaptation
- `cross-cutting/continual-learning.md` -- Continual learning fundamentals and Section 9 on FL
- `cross-cutting/collaborative-fleet-perception.md` -- V2V cooperative perception
- `operations/deployment/multi-airport-adaptation.md` -- Multi-airport onboarding playbook
- `30-autonomy-stack/perception/overview/lidar-foundation-models.md` -- PointLoRA and LiDAR pre-training
- `30-autonomy-stack/perception/overview/bev-encoding.md` -- BEV perception architecture
- `20-av-platform/networking-connectivity/airport-5g-cbrs.md` -- Airport 5G infrastructure
- `20-av-platform/compute/nvidia-orin-technical.md` -- Orin compute specifications
- `foundations/pointpillars-technical.md` -- PointPillars architecture details
