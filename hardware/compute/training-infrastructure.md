# Training Infrastructure and MLOps

## Practical Guide for World Model Training Pipeline

---

## 1. GPU Infrastructure Options

### 1.1 Cloud Options (Recommended for Starting)

| Provider | Instance | GPUs | Cost/hr | Best For |
|----------|----------|------|---------|----------|
| **Lambda Labs** | 1x A100 80GB | 1 | ~$1.10 | Prototyping, fine-tuning |
| **Lambda Labs** | 8x A100 80GB | 8 | ~$8.80 | Full training runs |
| **AWS p4d.24xlarge** | 8x A100 40GB | 8 | ~$32 | Production training |
| **AWS p5.48xlarge** | 8x H100 80GB | 8 | ~$98 | Large-scale training |
| **CoreWeave** | 8x A100 80GB | 8 | ~$14 | Good price/performance |
| **RunPod** | 1x A100 80GB | 1 | ~$1.64 | Community, serverless |
| **GCP a3-highgpu-8g** | 8x H100 80GB | 8 | ~$98 | Waymo dataset access |

### 1.2 Training Time Estimates

| Model | Parameters | Dataset | GPUs | Time | Cost |
|-------|-----------|---------|------|------|------|
| PointPillars (nuScenes) | 5M | 28K frames | 4x A100 | ~6h | ~$26 |
| CenterPoint (nuScenes) | 10M | 28K frames | 4x A100 | ~12h | ~$53 |
| VQ-VAE tokenizer | 20M | 28K frames | 4x A100 | ~24h | ~$106 |
| OccWorld transformer | 50-200M | 28K frames | 4x A100 | ~48h | ~$211 |
| OccWorld fine-tune (airside) | 50-200M | 5K frames | 1x A100 | ~12h | ~$13 |
| BEVFusion (full) | 100M | 28K frames | 8x A100 | ~24h | ~$211 |

**Total estimated cost for Phase 0-1:** $500-2,000 in cloud GPU compute.

### 1.3 On-Prem Option

| Config | Cost | Pros | Cons |
|--------|------|------|------|
| 1x RTX 4090 workstation | ~$3,000 | Low cost, good for prototyping | Only 24GB VRAM |
| 1x A6000 workstation | ~$7,000 | 48GB VRAM, sufficient for most training | Single GPU |
| 4x A100 server | ~$50-80K | Production training capability | High upfront cost |

**Recommendation:** Start with Lambda Labs or RunPod for cloud training. Move to on-prem if training becomes continuous (Phase 2+).

---

## 2. Training Pipeline Architecture

### 2.1 Directory Structure

```
world_models/
├── configs/                    # Model configurations
│   ├── bev_encoder/
│   │   ├── pointpillars_airside.yaml
│   │   └── bevfusion_airside.yaml
│   ├── world_model/
│   │   ├── occworld_nuscenes.yaml
│   │   ├── occworld_airside_finetune.yaml
│   │   └── occworld_airside_scratch.yaml
│   └── planning/
│       └── frenet_augmented.yaml
│
├── data/                       # Managed by DVC
│   ├── raw/                    # Raw bags (DVC-tracked, stored on S3/NAS)
│   ├── processed/              # Extracted scenes (Lance format)
│   ├── labels/                 # Auto-labels + human corrections
│   └── splits/                 # train/val/test splits
│
├── src/                        # Training code
│   ├── data/                   # Dataset classes, loaders
│   ├── models/                 # Model definitions
│   ├── training/               # Training loops, optimizers
│   ├── evaluation/             # Metrics, visualization
│   └── deployment/             # ONNX export, TensorRT
│
├── experiments/                # Managed by W&B
│   └── runs/                   # Checkpoints, logs
│
├── scripts/                    # Training scripts
│   ├── train_vqvae.sh
│   ├── train_occworld.sh
│   ├── finetune_airside.sh
│   └── export_tensorrt.sh
│
└── docker/                     # Reproducible environments
    ├── Dockerfile.train        # Training environment
    ├── Dockerfile.inference    # Inference environment (Orin-compatible)
    └── docker-compose.yml
```

### 2.2 Docker Training Environment

```dockerfile
# Dockerfile.train
FROM nvcr.io/nvidia/pytorch:24.01-py3

# OpenPCDet dependencies
RUN pip install spconv-cu120 cumm-cu120
RUN pip install mmcv-full mmdet mmdet3d mmsegmentation

# World model dependencies
RUN pip install einops timm wandb lance

# Data processing
RUN pip install rosbags open3d

WORKDIR /workspace
COPY requirements.txt .
RUN pip install -r requirements.txt

# Entry point
CMD ["python", "src/training/train.py"]
```

### 2.3 Efficient Data Loading

```python
import lance
import torch
from torch.utils.data import Dataset, DataLoader

class AirsideOccupancyDataset(Dataset):
    """Efficient dataset for occupancy world model training."""

    def __init__(self, lance_path: str, context_length: int = 8, prediction_horizon: int = 4):
        self.ds = lance.dataset(lance_path)
        self.context_length = context_length
        self.prediction_horizon = prediction_horizon
        self.total_length = context_length + prediction_horizon

        # Build scene index (which rows belong to which scene)
        self.scene_index = self._build_scene_index()

    def __getitem__(self, idx):
        scene_id, start_frame = self.scene_index[idx]

        # Load sequence of frames
        rows = self.ds.take(range(start_frame, start_frame + self.total_length))

        # Decode occupancy grids
        past_occ = []
        future_occ = []
        for i, row in enumerate(rows):
            occ = np.frombuffer(row['occupancy'], dtype=np.float16).reshape(200, 200, 16)
            if i < self.context_length:
                past_occ.append(occ)
            else:
                future_occ.append(occ)

        # Ego poses for ego-motion compensation
        ego_poses = [np.array(row['ego_pose']).reshape(4, 4) for row in rows]

        return {
            'past_occupancy': torch.from_numpy(np.stack(past_occ)).float(),
            'future_occupancy': torch.from_numpy(np.stack(future_occ)).float(),
            'ego_poses': torch.from_numpy(np.stack([p.flatten() for p in ego_poses])).float(),
        }

    def __len__(self):
        return len(self.scene_index)

# DataLoader with optimal settings
train_loader = DataLoader(
    AirsideOccupancyDataset('data/processed/train.lance'),
    batch_size=4,
    shuffle=True,
    num_workers=8,
    pin_memory=True,
    prefetch_factor=4,
    persistent_workers=True,
)
```

---

## 3. Experiment Management

### 3.1 Weights & Biases Integration

```python
import wandb

def train_occworld(config):
    """Training loop with W&B logging."""
    wandb.init(
        project='airside-world-model',
        config=config,
        tags=['occworld', 'phase1', 'lidar-only'],
    )

    model = OccWorldModel(config)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.lr, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, config.epochs)

    for epoch in range(config.epochs):
        model.train()
        for batch in train_loader:
            loss, metrics = model.training_step(batch)
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 10.0)
            optimizer.step()

            wandb.log({
                'train/loss': loss.item(),
                'train/occupancy_iou': metrics['iou'],
                'train/lr': scheduler.get_last_lr()[0],
            })

        # Validation
        model.eval()
        val_metrics = evaluate(model, val_loader)
        wandb.log({
            'val/occupancy_iou': val_metrics['iou'],
            'val/prediction_error': val_metrics['pred_error'],
            'epoch': epoch,
        })

        # Save checkpoint
        if val_metrics['iou'] > best_iou:
            best_iou = val_metrics['iou']
            torch.save(model.state_dict(), f'experiments/best_model.pth')
            wandb.save('experiments/best_model.pth')

        scheduler.step()

    wandb.finish()
```

### 3.2 Model Registry

```python
# Register best model for deployment
wandb.init(project='airside-world-model')
artifact = wandb.Artifact(
    name='occworld-airside',
    type='model',
    description='OccWorld fine-tuned on airside data',
    metadata={
        'val_iou': 0.65,
        'training_hours': 200,
        'phase': 'phase1',
        'compute': '4x A100, 48h',
    }
)
artifact.add_file('experiments/best_model.pth')
artifact.add_file('configs/occworld_airside_finetune.yaml')
wandb.log_artifact(artifact, aliases=['latest', 'v0.1'])
```

---

## 4. Model Deployment Pipeline

### 4.1 PyTorch → ONNX → TensorRT

```python
# Step 1: Export to ONNX
import torch.onnx

model.eval()
dummy_input = torch.randn(1, 8, 256, 200, 200).cuda()  # (B, T, C, H, W)

torch.onnx.export(
    model,
    dummy_input,
    'occworld.onnx',
    opset_version=17,
    input_names=['past_bev_features'],
    output_names=['future_occupancy'],
    dynamic_axes={
        'past_bev_features': {0: 'batch'},
        'future_occupancy': {0: 'batch'},
    },
)
```

```bash
# Step 2: Build TensorRT engine
trtexec --onnx=occworld.onnx \
    --saveEngine=occworld.engine \
    --fp16 \
    --workspace=8192 \
    --minShapes=past_bev_features:1x8x256x200x200 \
    --optShapes=past_bev_features:1x8x256x200x200 \
    --maxShapes=past_bev_features:1x8x256x200x200

# Step 3: Verify
trtexec --loadEngine=occworld.engine --dumpProfile
# Check: latency, throughput, memory
```

### 4.2 INT8 Quantization (Post-Training)

```python
import tensorrt as trt

def calibrate_int8(onnx_path, calibration_data):
    """Post-training INT8 quantization with calibration."""
    class OccWorldCalibrator(trt.IInt8EntropyCalibrator2):
        def __init__(self, data_loader):
            super().__init__()
            self.data_loader = iter(data_loader)
            self.batch_size = 1
            self.device_input = cuda.mem_alloc(...)

        def get_batch(self, names):
            try:
                batch = next(self.data_loader)
                cuda.memcpy_htod(self.device_input, batch.numpy())
                return [int(self.device_input)]
            except StopIteration:
                return None

    # Use 100-500 calibration samples from airside data
    calibrator = OccWorldCalibrator(calibration_loader)
    # Build engine with INT8
    # Typical accuracy loss: 1-3% IoU
```

---

## 5. DVC for Dataset Versioning

```bash
# Initialize DVC
cd world_models
dvc init
dvc remote add -d storage s3://airside-av-data/dvc

# Track large data files
dvc add data/raw/departure-2025-11-27.bag
dvc add data/processed/train.lance
dvc push  # upload to S3

# Version dataset with git
git add data/raw/departure-2025-11-27.bag.dvc data/.gitignore
git commit -m "Add departure bag for training"

# Reproduce training pipeline
dvc repro  # runs defined pipeline stages
```

### DVC Pipeline Definition

```yaml
# dvc.yaml
stages:
  extract_scenes:
    cmd: python scripts/extract_scenes.py --input data/raw --output data/processed
    deps:
      - scripts/extract_scenes.py
      - data/raw
    outs:
      - data/processed/scenes.lance

  auto_label:
    cmd: python scripts/auto_label.py --input data/processed --output data/labels
    deps:
      - scripts/auto_label.py
      - data/processed/scenes.lance
    outs:
      - data/labels/detections.json

  generate_occupancy:
    cmd: python scripts/generate_occupancy.py --input data/processed --output data/processed
    deps:
      - scripts/generate_occupancy.py
      - data/processed/scenes.lance
    outs:
      - data/processed/occupancy.lance

  train_vqvae:
    cmd: python src/training/train_vqvae.py --config configs/world_model/occworld_airside.yaml
    deps:
      - src/training/train_vqvae.py
      - data/processed/occupancy.lance
    outs:
      - experiments/vqvae/best.pth
    metrics:
      - experiments/vqvae/metrics.json

  train_world_model:
    cmd: python src/training/train_occworld.py --config configs/world_model/occworld_airside.yaml
    deps:
      - src/training/train_occworld.py
      - data/processed/occupancy.lance
      - experiments/vqvae/best.pth
    outs:
      - experiments/occworld/best.pth
    metrics:
      - experiments/occworld/metrics.json
```

---

## 6. CI/CD for ML

### 6.1 GitHub Actions for Model Training

```yaml
# .github/workflows/train.yml
name: Train World Model
on:
  push:
    paths:
      - 'configs/**'
      - 'src/**'

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    container: nvcr.io/nvidia/pytorch:24.01-py3
    steps:
      - uses: actions/checkout@v3
      - name: Install deps
        run: pip install -r requirements.txt
      - name: Smoke test (1 epoch, tiny data)
        run: |
          python src/training/train_occworld.py \
            --config configs/world_model/occworld_smoke_test.yaml \
            --epochs 1 --max-samples 100

  full-training:
    needs: smoke-test
    runs-on: [self-hosted, gpu]  # or cloud GPU runner
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Pull data
        run: dvc pull
      - name: Train
        run: |
          python src/training/train_occworld.py \
            --config configs/world_model/occworld_airside_finetune.yaml
      - name: Evaluate
        run: python src/evaluation/evaluate.py --checkpoint experiments/occworld/best.pth
      - name: Regression check
        run: python src/evaluation/regression_check.py --new experiments/occworld/best.pth
```

---

## Sources

- [DVC (Data Version Control)](https://dvc.org/)
- [Weights & Biases](https://wandb.ai/)
- [Lambda Labs](https://lambdalabs.com/)
- [TensorRT Developer Guide](https://docs.nvidia.com/deeplearning/tensorrt/)
- [PyTorch Distributed Training](https://pytorch.org/tutorials/intermediate/ddp_tutorial.html)
- [NVIDIA NGC Catalog](https://catalog.ngc.nvidia.com/)
