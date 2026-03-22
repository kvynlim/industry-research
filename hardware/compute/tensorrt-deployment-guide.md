# TensorRT Deployment on NVIDIA Jetson for Airside AV Perception

Deep practical reference for deploying ML models via the PyTorch -> ONNX -> TensorRT pipeline on Jetson Orin platforms targeting airside autonomous vehicle perception stacks (lidar 3D detection, camera-based detection, BEV fusion).

---

## 1. TensorRT 10.x Feature Landscape

TensorRT 10 (current latest: **10.16.0**) is the inference optimizer and runtime for NVIDIA GPUs and DLA. The 10.x line has shipped 20+ point releases since 10.0.0 EA.

### Key Features by Release

| Version | Notable Additions |
|---------|-------------------|
| 10.0.0 | Major API redesign from 8.x. Explicit batch mode only (implicit batch removed). IPluginV3 interface. ONNX opset 9-20 support. |
| 10.3.0 | FP8 convolution on Ada (SM89). Significantly faster engine builds for large-GEMM networks (transformers). Improved normalization + FP8 fusion. |
| 10.4.0 | STFT-adjacent signal ops (BlackmanWindow, HannWindow, HammingWindow). |
| 10.5.0 | Real-valued STFT ONNX op. FP8 Stable Diffusion validated on Hopper. |
| 10.9.0 | Opset 21 GroupNorm support. Fixed opset-18+ ScatterND. ONNX opset range 9-22. |
| 10.10.0 | Large tensor support across most layers. BF16/FP16 batched small-GEMM improvements. Wider MHA fusion pattern detection. |
| 10.12.0 | Distributive independence for deterministic outputs across distributive axes. |
| 10.13.0 | ONNX opset 9-24 support. |
| 10.16.0 | **IMoELayer** (Mixture of Experts) built-in. Multi-device inference preview (NCCL collectives). API capture/replay for ensemble pipelines. Static library consolidation. |

### Supported ONNX Operators (10.x)

TensorRT 10.x supports ONNX **opset 9 through 24**. Supported data types: DOUBLE (cast to FLOAT), FLOAT32, FLOAT16, BFLOAT16, FP8, FP4, INT32, INT64, INT8, INT4, UINT8, BOOL.

**Commonly used ops with full support:** Conv, ConvTranspose, BatchNormalization, Relu, Sigmoid, Tanh, LeakyRelu, MaxPool, AveragePool, GlobalAveragePool, Gemm, MatMul, Add, Sub, Mul, Div, Concat, Reshape, Transpose, Flatten, Squeeze, Unsqueeze, Softmax, LayerNormalization (opset 17+), GroupNormalization (opset 18+), Resize, Slice, Gather, ReduceMean, ReduceMax, ReduceSum, Clip, Pad, Split, Tile, Expand, Where, TopK, ScatterND (opset 18+, reduction param not supported), NonMaxSuppression, InstanceNormalization, Einsum.

**Operators NOT supported (selection):** QLinearConv, QLinearMatMul, ConvInteger, MatMulInteger, BitShift, bitwise ops, string ops, sequence ops, AffineGrid, Bernoulli, GridSample (partial).

**Key guidance:** For normalization-heavy models (transformers, BEV encoders), target **opset >= 17** for LayerNormalization and **opset >= 18** for GroupNormalization. These map to fused TensorRT kernels with better numerical accuracy than equivalent primitive-op decompositions.

---

## 2. PyTorch to ONNX Export

### Basic Export (TorchScript-based, legacy)

```python
import torch

model.eval()
dummy = torch.randn(1, 3, 640, 640).cuda()

torch.onnx.export(
    model,
    dummy,
    "model.onnx",
    opset_version=17,             # >= 17 for LayerNorm, >= 18 for GroupNorm
    input_names=["images"],
    output_names=["boxes", "scores"],
    dynamic_axes={
        "images":  {0: "batch"},
        "boxes":   {0: "batch"},
        "scores":  {0: "batch"},
    },
)
```

### Modern Export (torch.export-based, recommended for PyTorch >= 2.1)

```python
import torch

model.eval()
dummy = torch.randn(1, 3, 640, 640).cuda()

# dynamo=True enables the torch.export-based path
torch.onnx.export(
    model,
    dummy,
    "model.onnx",
    dynamo=True,
    opset_version=17,
    input_names=["images"],
    output_names=["detections"],
    dynamic_shapes={
        "images": {0: torch.export.Dim("batch", min=1, max=32)},
    },
)
```

### Common Export Pitfalls

#### 1. Dynamic Shapes

**Problem:** The tracer records the shapes of example inputs literally. Any data-dependent control flow (`if x.shape[0] > 5`) or shape arithmetic (`x.view(x.size(0), -1)`) introduces Gather/Shape/Squeeze nodes that bloat the graph and confuse TensorRT, especially on older versions.

**Fix:**
- Always declare `dynamic_axes` (legacy) or `dynamic_shapes` (dynamo) for batch dimensions.
- Keep batch dimension at index 0 and use length -1 (default) to minimize redundant shape-computation ops.
- For opset >= 14 with TensorRT >= 8.2, dynamic batch export is clean. For LayerNorm + dynamic batch, use opset >= 17 with TensorRT >= 8.6.1.
- Avoid conflicting markers where one dimension is marked dynamic and an equivalent dimension is marked static.

#### 2. Custom / Unsupported Operators

**Problem:** Operations like `torch.scatter_`, `tensor[mask] = value`, custom indexing, or einsum variants may not have direct ONNX equivalents or may produce ops TensorRT does not support.

**Fixes:**
- Rewrite indexed assignments (`kps[..., ::2] += xs`) using explicit `torch.index_select`, `torch.cat`, or `torch.where`.
- For complex custom ops, register a custom ONNX symbolic function:

```python
@torch.onnx.symbolic_helper.parse_args("v", "v", "i")
def my_custom_op_symbolic(g, input, weight, dim):
    return g.op("custom_domain::MyOp", input, weight, dim_i=dim)

torch.onnx.register_custom_op_symbolic("myns::my_custom_op", my_custom_op_symbolic, opset_version=17)
```

- Alternatively, implement a TensorRT plugin and map the ONNX custom op to it via the plugin registry.

#### 3. ScatterND Operations

**Problem:** `ScatterND` was historically unsupported or produced incorrect results. TensorRT 10.9+ fixed opset-18+ ScatterND, but the `reduction` parameter is still not supported.

**Fix:**
- Upgrade to TensorRT >= 10.9 for basic ScatterND.
- If `reduction` is needed (e.g., `ScatterND` with `add`), rewrite the operation in PyTorch before export using explicit tensor operations.
- As a last resort, split the model at the ScatterND boundary and handle it with a custom CUDA kernel.

#### 4. Sparse Convolution (3D Lidar Models)

**Problem:** Standard ONNX has no sparse convolution operator. Models like CenterPoint, PointPillars with VoxelNet backbone, and BEVFusion use `spconv`/`torchsparse`.

**Fix:** Use NVIDIA's Lidar_AI_Solution approach -- export the sparse convolution backbone separately through NVIDIA's custom `libspconv` engine (independent of TensorRT), and export only the dense detection head (RPN, CenterHead) to ONNX/TensorRT. The sparse and dense stages connect via CUDA memory.

#### 5. Post-Export Validation

Always run constant folding and validation before TensorRT conversion:

```bash
# Constant folding with Polygraphy (ships with TensorRT)
polygraphy surgeon sanitize model.onnx --fold-constants -o model_folded.onnx

# Shape inference
python -c "import onnx; model = onnx.load('model_folded.onnx'); onnx.shape_inference.infer_shapes(model); onnx.save(model, 'model_inferred.onnx')"

# Validate
python -c "import onnx; onnx.checker.check_model('model_inferred.onnx')"
```

---

## 3. ONNX to TensorRT Engine Building (trtexec)

`trtexec` is installed on Jetson at `/usr/src/tensorrt/bin/trtexec`. It builds engines, benchmarks inference, and profiles layers.

### Basic Engine Build

```bash
# FP16 engine (most common for Jetson perception)
trtexec \
    --onnx=model.onnx \
    --saveEngine=model_fp16.engine \
    --fp16 \
    --memPoolSize=workspace:4096MiB \
    --buildOnly
```

### Full-Featured Build Command (Reference)

```bash
trtexec \
    --onnx=model.onnx \
    --saveEngine=model.engine \
    --fp16 \
    --int8 \
    --calib=calibration_cache.bin \
    --minShapes=images:1x3x640x640 \
    --optShapes=images:4x3x640x640 \
    --maxShapes=images:8x3x640x640 \
    --memPoolSize=workspace:4096MiB \
    --timingCacheFile=timing.cache \
    --builderOptimizationLevel=5 \
    --profilingVerbosity=detailed \
    --dumpLayerInfo \
    --exportLayerInfo=layer_info.json \
    --exportProfile=profile.json \
    --skipInference \
    --verbose
```

### Key trtexec Flags Reference

| Flag | Purpose |
|------|---------|
| `--onnx=<file>` | Input ONNX model |
| `--saveEngine=<file>` | Output serialized engine (.engine/.plan) |
| `--loadEngine=<file>` | Load pre-built engine for benchmarking |
| `--fp16` | Enable FP16 precision |
| `--bf16` | Enable BF16 precision |
| `--int8` | Enable INT8 precision |
| `--fp8` | Enable FP8 precision |
| `--best` | Let TensorRT select optimal precision per layer |
| `--noTF32` | Disable TF32 (useful for accuracy debugging) |
| `--stronglyTyped` | Strict type constraints (use with explicit Q/DQ) |
| `--minShapes=<spec>` | Min input shapes for dynamic dimensions |
| `--optShapes=<spec>` | Optimal input shapes (tuning target) |
| `--maxShapes=<spec>` | Max input shapes |
| `--memPoolSize=<spec>` | Memory pools: `workspace:X`, `dlaSRAM:X`, `dlaLocalDRAM:X`, `dlaGlobalDRAM:X`, `tacticSharedMem:X` |
| `--useDLACore=N` | Run on DLA core 0 or 1 |
| `--allowGPUFallback` | Let unsupported DLA layers fall back to GPU |
| `--timingCacheFile=<file>` | Load/save timing cache for faster rebuilds |
| `--sparsity=[disable\|enable\|force]` | Structured sparsity: `enable` (if weights qualify), `force` (rewrite weights) |
| `--precisionConstraints=[none\|prefer\|obey]` | How strictly to enforce precision constraints |
| `--layerPrecisions=<spec>` | Per-layer precision, e.g. `*:fp16,layer_3:fp32` |
| `--layerOutputTypes=<spec>` | Per-layer output types |
| `--builderOptimizationLevel=N` | Build intensity (0=fast, 5=thorough) |
| `--profilingVerbosity=[layer_names_only\|detailed\|none]` | Profiling detail level |
| `--dumpProfile` | Print per-layer latency after inference |
| `--dumpLayerInfo` | Print engine layer info |
| `--skipInference` | Build only, do not run inference |
| `--buildOnly` | Equivalent to skipInference |
| `--verbose` | Full logging |
| `--plugins=<file>` | Load plugin shared library |
| `--dynamicPlugins=<file>` | Load plugin and serialize with engine |
| `--inputIOFormats=<spec>` | Input format, e.g. `fp16:chw16` |
| `--outputIOFormats=<spec>` | Output format |
| `--loadInputs=<spec>` | Load test inputs from files |
| `--useCudaGraph` | Capture inference as CUDA graph |
| `--infStreams=N` | Number of parallel inference streams |
| `--noDataTransfers` | Skip H2D/D2H for pure GPU timing |
| `--warmUp=<ms>` | Warm-up duration |
| `--duration=<s>` | Inference measurement duration |
| `--iterations=N` | Minimum inference iterations |
| `--useSpinWait` | Active CPU wait for precise timing |
| `--separateProfileRun` | Separate profiling from timing runs |
| `--stripWeights` | Remove weights for refit-only engines |

### Benchmarking a Built Engine

```bash
trtexec \
    --loadEngine=model_fp16.engine \
    --shapes=images:4x3x640x640 \
    --warmUp=500 \
    --duration=10 \
    --useCudaGraph \
    --noDataTransfers \
    --useSpinWait \
    --dumpProfile \
    --separateProfileRun
```

---

## 4. Quantization: FP16 / INT8 / FP8 / FP4

### FP16 (Half Precision)

The default and most common precision for Jetson deployment. Jetson Orin's Ampere GPU has hardware FP16 Tensor Cores.

```bash
trtexec --onnx=model.onnx --fp16 --saveEngine=model_fp16.engine
```

**Accuracy note:** FP16 can cause NaN/Inf outputs if intermediate activations overflow the FP16 range (max ~65504). Common in Reduce layers and ElementWise Power ops. Fix by forcing those layers to FP32:

```bash
trtexec --onnx=model.onnx --fp16 \
    --layerPrecisions=*:fp16,reduce_layer:fp32,power_layer:fp32 \
    --precisionConstraints=obey \
    --saveEngine=model_fp16_safe.engine
```

### INT8 Post-Training Quantization (PTQ)

INT8 delivers ~37% throughput uplift over FP16 on Orin AGX for many perception models.

#### Calibration Procedure

1. **Prepare calibration data:** ~500 representative samples (images, point clouds) from the target domain. For airside AV: airport apron imagery, GSE vehicles, aircraft, personnel.

2. **Choose calibrator:**
   - `IInt8EntropyCalibrator2` -- **recommended for CNNs** (detection, segmentation). Calibrates before layer fusion, portable cache.
   - `IInt8MinMaxCalibrator` -- better for NLP/transformers. Also calibrates before fusion with portable cache.
   - `IInt8EntropyCalibrator` -- original entropy, calibrates after fusion.
   - `IInt8LegacyCalibrator` -- fallback with percentile tuning.

3. **Python calibrator implementation:**

```python
import tensorrt as trt
import numpy as np

class AirsideCalibrator(trt.IInt8EntropyCalibrator2):
    def __init__(self, data_loader, cache_file="calibration.cache"):
        super().__init__()
        self.data_loader = iter(data_loader)
        self.cache_file = cache_file
        self.batch_size = data_loader.batch_size
        # Allocate device memory for one batch
        self.device_input = cuda.mem_alloc(
            self.batch_size * 3 * 640 * 640 * np.float32().itemsize
        )

    def get_batch_size(self):
        return self.batch_size

    def get_batch(self, names):
        try:
            batch = next(self.data_loader)
            cuda.memcpy_htod(self.device_input, batch.numpy().ravel())
            return [int(self.device_input)]
        except StopIteration:
            return None

    def read_calibration_cache(self):
        try:
            with open(self.cache_file, "rb") as f:
                return f.read()
        except FileNotFoundError:
            return None

    def write_calibration_cache(self, cache):
        with open(self.cache_file, "wb") as f:
            f.write(cache)
```

4. **Build INT8 engine with calibrator:**

```python
builder = trt.Builder(logger)
network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
parser = trt.OnnxParser(network, logger)
parser.parse_from_file("model.onnx")

config = builder.create_builder_config()
config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 4 << 30)
config.set_flag(trt.BuilderFlag.INT8)
config.set_flag(trt.BuilderFlag.FP16)  # allow FP16 fallback for sensitive layers
config.int8_calibrator = AirsideCalibrator(calib_dataloader)

engine = builder.build_serialized_network(network, config)
with open("model_int8.engine", "wb") as f:
    f.write(engine)
```

5. **Or via trtexec (if calibration cache already exists):**

```bash
trtexec \
    --onnx=model.onnx \
    --int8 --fp16 \
    --calib=calibration.cache \
    --saveEngine=model_int8.engine
```

#### Calibration Cache Portability

Caches from `IInt8EntropyCalibrator2` and `IInt8MinMaxCalibrator` are portable across devices (same TensorRT major version). Caches are **not** portable across TensorRT versions.

### Quantization-Aware Training (QAT)

QAT simulates quantization during training by inserting Q/DQ (QuantizeLinear/DequantizeLinear) nodes. Yields better accuracy than PTQ, especially for complex architectures.

#### Workflow with NVIDIA Model Optimizer (formerly TensorRT Model Optimizer)

```bash
pip install nvidia-modelopt
```

```python
import modelopt.torch.quantization as mtq

# 1. Load pretrained model
model = load_my_model("checkpoint.pth")
model.eval()

# 2. Define quantization config
quant_cfg = mtq.INT8_DEFAULT_CFG  # or FP8_DEFAULT_CFG, W4A8_AWQ_FULL_CFG

# 3. Calibrate (runs forward passes on calibration data)
def forward_loop(model):
    for batch in calib_loader:
        model(batch.cuda())

mtq.quantize(model, quant_cfg, forward_loop)

# 4. Fine-tune (optional but recommended)
# ~10% of original training schedule, annealing LR
optimizer = torch.optim.SGD(model.parameters(), lr=1e-4)
for epoch in range(fine_tune_epochs):
    train_one_epoch(model, train_loader, optimizer)

# 5. Export to ONNX (Q/DQ nodes preserved)
torch.onnx.export(model, dummy_input, "model_qat.onnx", opset_version=17)
```

```bash
# 6. Build TensorRT engine (Q/DQ nodes -> native INT8 kernels)
trtexec --onnx=model_qat.onnx --fp16 --int8 --stronglyTyped --saveEngine=model_qat.engine
```

**Important:** Do NOT provide a calibration table when Q/DQ nodes exist in the ONNX model. TensorRT reads scales directly from the Q/DQ nodes.

#### QAT Q/DQ Placement Best Practices

1. Quantize **all inputs** of weighted operations (Conv, Deconv, GEMM).
2. Quantize **residual inputs** in skip connections to enable element-wise add fusion.
3. Use **per-tensor** quantization for activations, **per-channel** for weights.
4. Do not simulate batch normalization / ReLU quantization -- TensorRT fuses these automatically.
5. Test non-weighted commuting layers (pooling) empirically before quantizing.

### FP8 Quantization

Available on Hopper (SM90) and Ada (SM89) GPUs. Not available on Orin's Ampere (SM87).

- `FP8E4M3`: 4 exponent bits, 3 mantissa bits. Range [-448, 448].
- MXFP8: OCP Microscaling with per-block (block size 32) E8M0 scaling factors.

### FP4 / INT4 Quantization

- **NVFP4** (FP4E2M1): Block quantization only (block size 16). Supported on Blackwell (SM120). Not available on Orin.
- **INT4**: Weight-only quantization for GEMM. Weights stored in 4-bit, compute happens at higher precision. Useful for LLM inference where memory bandwidth dominates.

**Practical Orin guidance:** FP16 and INT8 are the production precisions. FP8/FP4 are datacenter or next-gen Jetson (Thor) features.

### Quantization Accuracy Comparison (PointPillars on KITTI, Jetson Orin)

| Precision | Total Latency | mAP (AP40) | Relative to FP32 |
|-----------|--------------|------------|-------------------|
| FP32 | 32.91 ms | 64.64% | baseline |
| FP16 | 18.27 ms | ~64.5% | -0.14% mAP |
| INT8 (PTQ) | 14.77 ms | 63.84% | -0.80% mAP |
| Mixed FP16+INT8 (QAT) | 18.40 ms | 64.47% | -0.17% mAP |
| Mixed FP16:1 (best) | 14.29 ms | ~64.0% | 2.3x speedup |

Source: "Mixed Precision PointPillars for Efficient 3D Object Detection with TensorRT" (arXiv:2601.12638)

---

## 5. DLA Deployment

### What is DLA?

The Deep Learning Accelerator is a fixed-function ASIC on Jetson Xavier and Orin, independent of the GPU. Jetson AGX Orin has **2 DLA cores** (DLA0, DLA1). DLA provides **3-5x better power efficiency** than GPU for supported workloads.

### DLA Performance Contribution by Power Mode (Orin AGX)

| Power Mode | Total INT8 TOPs | DLA Contribution | DLA % |
|------------|-----------------|-------------------|-------|
| MAXN | 275 | ~105 | 38% |
| 50W | 200 | ~92 | 46% |
| 30W | 131 | ~90 | 69% |
| 15W | 54 | ~40 | 74% |

At lower power modes, DLA dominates system compute capacity. For airside AV operating on battery or with thermal constraints, DLA is essential.

### Supported Layers on DLA

**Fully supported:**
- Convolution 2D (kernel [1,32], stride [1,8], dilation [1,32], groups [1,8192])
- Deconvolution 2D (kernel [1,32] or special up to [128], no groups/dilation, padding = 0)
- Pooling 2D (Max, Average; window [1,8], stride [1,16])
- Activation (ReLU, Sigmoid, TanH, Clipped ReLU [1,127], Leaky ReLU)
- ElementWise (Sum, Sub, Product, Max, Min, Div, Pow, Equal, Greater, Less)
- Scale (Uniform, Per-Channel, ElementWise; scale + shift only)
- Concatenation (channel axis only, >= 2 inputs)
- Resize (nearest integer scale [1,32]; bilinear integer scale [1,4])
- Slice (static, 4D, CHW dims only)
- Softmax (Orin only, axis dim <= 1024)
- Reduce (MAX only, 4D, CHW dims)
- Shuffle (4D, batch dims cannot participate)
- Parametric ReLU (slope must be build-time constant)
- Unary (ABS; SIN/COS/ATAN require INT8)
- LRN (window 3/5/7/9, ACROSS_CHANNELS)
- Normalize (Orin only)

**NOT supported on DLA:**
- FP32 precision (DLA is FP16/INT8 only)
- 3D or higher spatial operations
- Dynamic/variable shapes (min=opt=max required)
- GroupNormalization
- Any op not in the list above
- Batch size > 4096
- Non-batch dimension > 8192

### DLA Constraints Summary

| Constraint | Limit |
|------------|-------|
| Precision | FP16, INT8 only |
| Max batch size | 4,096 |
| Max non-batch dim | 8,192 |
| Dynamic shapes | Not supported |
| Concurrent loadables/core | 16 max |
| Total loadables (2 DLA) | 20 max |
| SRAM per core (Orin) | 1 MiB (default managed: 0.5 MiB) |

### Building DLA Engines with trtexec

```bash
# Mixed GPU+DLA with GPU fallback (most common for real models)
trtexec \
    --onnx=model.onnx \
    --useDLACore=0 \
    --fp16 \
    --allowGPUFallback \
    --memPoolSize=dlaSRAM:1MiB,dlaLocalDRAM:256MiB,dlaGlobalDRAM:256MiB \
    --saveEngine=model_dla0.engine

# INT8 on DLA
trtexec \
    --onnx=model.onnx \
    --useDLACore=0 \
    --int8 --fp16 \
    --calib=calibration.cache \
    --allowGPUFallback \
    --saveEngine=model_dla0_int8.engine

# DLA standalone loadable (for cuDLA, no GPU involved)
trtexec \
    --onnx=model.onnx \
    --useDLACore=0 \
    --fp16 \
    --safe \
    --inputIOFormats=fp16:chw16 \
    --outputIOFormats=fp16:chw16 \
    --saveEngine=model_dla_standalone.bin
```

### Forcing Layers onto DLA (C++ API)

```cpp
auto config = builder->createBuilderConfig();
config->setDefaultDeviceType(nvinfer1::DeviceType::kDLA);
config->setDLACore(0);
config->setFlag(nvinfer1::BuilderFlag::kFP16);
config->setFlag(nvinfer1::BuilderFlag::kGPU_FALLBACK);

// Check per-layer DLA compatibility
for (int i = 0; i < network->getNbLayers(); i++) {
    auto layer = network->getLayer(i);
    if (builder->canRunOnDLA(layer)) {
        config->setDeviceType(layer, nvinfer1::DeviceType::kDLA);
    }
}
```

### Mixed GPU + DLA Execution Strategy for Airside AV

Run two inference paths concurrently:
- **DLA0 + DLA1:** Camera detection model (ResNet backbone, well-suited to DLA).
- **GPU:** Lidar 3D backbone (sparse convolution, not DLA-compatible) + BEV fusion + transformer heads.

This maximizes hardware utilization. DLA handles the CNN-heavy camera path with 3-5x better power efficiency, while GPU handles the compute-heavy lidar path.

**Measured combined throughput (Orin, NVIDIA data):**

| Model | GPU FPS | DLA FPS | GPU+DLA FPS |
|-------|---------|---------|-------------|
| PeopleNet-ResNet18 (960x544) | 218 | 128 | 346 |
| TrafficCamNet (960x544) | 251 | 174 | 425 |
| DashCamNet (960x544) | 251 | 172 | 423 |
| FaceDetect-IR (384x240) | 1407 | 974 | 2381 |

NVIDIA DRIVE AV reports **2.5x latency reduction** in the perception pipeline by leveraging DLA for DNN workloads.

### Structured Sparsity on DLA (Orin Only)

2:4 sparsity pattern (two zeros per four consecutive values along C dimension):
- INT8 convolution only (non-NHWC formats)
- Channel size > 64
- Quantized weights <= 256K
- Output channels K where `K % 64` in {0, 1, 2, 4, 8, 16, 32}

---

## 6. Multi-Profile Engines for Dynamic Batch Sizes

For airside AV, the number of detected objects or input frames can vary. Multi-profile engines let TensorRT optimize kernels for several batch-size ranges.

### Building Multi-Profile Engines

**With trtexec (single profile with dynamic range):**

```bash
trtexec \
    --onnx=model.onnx \
    --minShapes=images:1x3x640x640 \
    --optShapes=images:4x3x640x640 \
    --maxShapes=images:16x3x640x640 \
    --fp16 \
    --saveEngine=model_dynamic.engine
```

**With Python API (multiple profiles):**

```python
profile_1 = builder.create_optimization_profile()
profile_1.set_shape("images", min=(1,3,640,640), opt=(1,3,640,640), max=(1,3,640,640))
config.add_optimization_profile(profile_1)

profile_2 = builder.create_optimization_profile()
profile_2.set_shape("images", min=(1,3,640,640), opt=(4,3,640,640), max=(8,3,640,640))
config.add_optimization_profile(profile_2)

profile_3 = builder.create_optimization_profile()
profile_3.set_shape("images", min=(1,3,640,640), opt=(16,3,640,640), max=(16,3,640,640))
config.add_optimization_profile(profile_3)
```

**Runtime profile selection:**

```python
context = engine.create_execution_context()
context.set_optimization_profile_async(profile_index, stream)
context.set_input_shape("images", (batch_size, 3, 640, 640))
```

### Practical Guidance

- Create profiles for batch sizes you actually use (e.g., 1 for real-time, 4-8 for batched processing).
- The `opt` shape is what TensorRT optimizes kernel selection for -- set it to your most common batch size.
- First `enqueueV3()` after a shape or profile change is slower (internal recomputation). Warm up each profile at startup.
- DLA does **not** support dynamic shapes. For DLA, min=opt=max.

---

## 7. Engine Caching and Serialization

### Engine File Properties

- Engines are **GPU-specific** (tied to SM version). An engine built on Orin (SM87) will not run on Xavier (SM72) or desktop GPUs.
- Engines are **TensorRT-version-specific**. Rebuild when upgrading TensorRT/JetPack.
- Engines are **OS-specific**. Cross-platform support (Linux to Windows x86) is experimental in 10.3+.
- File extension convention: `.engine` or `.plan`.

### Timing Cache

The timing cache records per-tactic latencies and persists across builds:

```bash
# First build: creates timing cache
trtexec --onnx=model.onnx --fp16 \
    --timingCacheFile=timing.cache \
    --saveEngine=model.engine

# Subsequent builds: reuses cache (much faster)
trtexec --onnx=model_v2.onnx --fp16 \
    --timingCacheFile=timing.cache \
    --saveEngine=model_v2.engine
```

**Cache portability rules:**
- Same GPU model, same CUDA version, same TensorRT version = portable.
- Different GPU SM version = not portable.
- Different TensorRT version = not portable.

### Version-Compatible Engines

Build with the version-compatible flag to run engines across TensorRT minor versions within the same major:

```cpp
config->setFlag(BuilderFlag::kVERSION_COMPATIBLE);
```

### Refittable Engines

Build with `kREFIT` to swap weights without rebuilding the engine (useful for model updates):

```cpp
config->setFlag(BuilderFlag::kREFIT);
```

```python
refitter = trt.Refitter(engine, logger)
refitter.set_weights("conv1_weight", trt.Weights(new_weights))
refitter.refit_cuda_engine()
```

### Deployment Strategy for Airside AV

1. Build engines on the target Jetson hardware during initial setup or OTA update.
2. Serialize to `.engine` files and persist on disk.
3. At boot, deserialize (fast, ~100ms) instead of rebuilding (slow, minutes).
4. Ship timing caches with OTA updates to speed up rebuilds on fleet vehicles.
5. If the model weights change but architecture does not, use refittable engines.

---

## 8. Triton Inference Server on Jetson

### Overview

NVIDIA Triton Inference Server (renamed to "NVIDIA Dynamo Triton" as of March 2025) enables model serving with dynamic batching, model ensembles, and concurrent model execution. On Jetson, the **C API** is recommended over HTTP/gRPC for latency-sensitive edge inference.

### Installation on Jetson

```bash
# Download Triton for Jetson from NVIDIA release page
# (JetPack 5.x / 6.x specific tar file from "Jetson JetPack Support" section)
wget <triton-jetson-release-url> -O triton_jetson.tar.gz
tar xzf triton_jetson.tar.gz

# Launch
./tritonserver \
    --model-repository=/path/to/model_repo \
    --backend-directory=/path/to/tritonserver/backends
```

### Supported Features on Jetson

- GPU and **NVDLA** model execution
- Concurrent model execution
- Dynamic batching
- Model pipelines (ensembles)
- HTTP/REST and gRPC protocols
- C API (recommended for edge, eliminates network overhead)

### Limitations on Jetson

- CUDA IPC (shared memory) not supported (system shared memory works)
- GPU metrics, cloud storage (GCS/S3/Azure) not supported
- Python backend: no GPU tensors, no async BLS
- Model Analyzer not available (Perf Analyzer works)

### Model Repository Structure

```
model_repository/
├── camera_detector/
│   ├── config.pbtxt
│   └── 1/
│       └── model.plan          # TensorRT engine
├── lidar_detector/
│   ├── config.pbtxt
│   └── 1/
│       └── model.plan
├── postprocess/
│   ├── config.pbtxt
│   └── 1/
│       └── model.py            # Python backend
└── perception_ensemble/
    ├── config.pbtxt
    └── 1/
        └── (empty)             # Ensemble has no model file
```

### TensorRT Model Configuration (config.pbtxt)

```protobuf
name: "camera_detector"
platform: "tensorrt_plan"
max_batch_size: 8

input [
  {
    name: "images"
    data_type: TYPE_FP16
    dims: [ 3, 640, 640 ]
  }
]
output [
  {
    name: "boxes"
    data_type: TYPE_FP16
    dims: [ 100, 7 ]
  },
  {
    name: "scores"
    data_type: TYPE_FP16
    dims: [ 100 ]
  }
]

instance_group [
  {
    count: 1
    kind: KIND_GPU
    gpus: [ 0 ]
  }
]

dynamic_batching {
  preferred_batch_size: [ 1, 4 ]
  max_queue_delay_microseconds: 5000
}
```

### DLA Model Configuration

```protobuf
name: "camera_backbone_dla"
platform: "tensorrt_plan"
max_batch_size: 1

instance_group [
  {
    count: 1
    kind: KIND_GPU
    gpus: [ 0 ]
  }
]

# The DLA core is baked into the engine file at build time.
# Build the engine with --useDLACore=0 before placing here.
```

### Ensemble Pipeline Configuration

```protobuf
name: "perception_ensemble"
platform: "ensemble"
max_batch_size: 1

input [
  {
    name: "camera_image"
    data_type: TYPE_FP16
    dims: [ 3, 640, 640 ]
  },
  {
    name: "lidar_points"
    data_type: TYPE_FP32
    dims: [ -1, 5 ]
  }
]
output [
  {
    name: "final_detections"
    data_type: TYPE_FP32
    dims: [ -1, 9 ]
  }
]

ensemble_scheduling {
  step [
    {
      model_name: "camera_detector"
      model_version: 1
      input_map {
        key: "images"
        value: "camera_image"
      }
      output_map {
        key: "boxes"
        value: "camera_boxes"
      }
      output_map {
        key: "scores"
        value: "camera_scores"
      }
    },
    {
      model_name: "lidar_detector"
      model_version: 1
      input_map {
        key: "points"
        value: "lidar_points"
      }
      output_map {
        key: "detections_3d"
        value: "lidar_detections"
      }
    },
    {
      model_name: "postprocess"
      model_version: 1
      input_map {
        key: "camera_boxes"
        value: "camera_boxes"
      }
      input_map {
        key: "camera_scores"
        value: "camera_scores"
      }
      input_map {
        key: "lidar_detections"
        value: "lidar_detections"
      }
      output_map {
        key: "OUTPUT0"
        value: "final_detections"
      }
    }
  ]
}
```

### Performance Benchmarking on Jetson

```bash
# perf_analyzer (supported on Jetson)
perf_analyzer \
    -m camera_detector \
    --shape images:1,3,640,640 \
    -i grpc \
    --concurrency-range 1:4 \
    -f results.csv

# C API benchmarking
perf_analyzer \
    -m camera_detector \
    --service-kind triton_c_api \
    --model-repository /path/to/model_repo
```

---

## 9. Measured Latency and Benchmark Comparisons

### MLPerf Inference Results on Jetson AGX Orin (v3.1)

| Model | Task | Latency (ms) | Offline (Samples/s) |
|-------|------|-------------|---------------------|
| ResNet-50 | Image Classification | 0.64 | 6,423 |
| RetinaNet | Object Detection | 11.67 | 149 |
| 3D-UNet | Medical Imaging | 4,371 | 0.51 |
| RNN-T | Speech-to-Text | 94.01 | 1,170 |
| BERT-Large | NLP | 5.71 | 554 |

Config: JetPack 5.1.1, TensorRT 8.5.2/9.0.1, CUDA 11.4

### Jetson Orin NX (MLPerf v3.1)

| Model | Offline (Samples/s) |
|-------|---------------------|
| ResNet-50 | 2,641 |
| RetinaNet | 67 |
| 3D-UNet | 0.2 |
| RNN-T | 432 |
| BERT-Large | 195 |

### Jetson AGX Orin (MLPerf v4.0)

| Model | Latency (ms) | Offline (Samples/s) |
|-------|-------------|---------------------|
| GPT-J 6B (LLM) | 10,205 | 0.15 |
| Stable Diffusion XL | 12,942 | 0.08 |

### PointPillars 3D Detection (Jetson Orin)

From arXiv:2601.12638 (Mixed Precision PointPillars):

| Precision | Total Latency | FPS | mAP (KITTI AP40) |
|-----------|--------------|-----|-------------------|
| FP32 | 32.91 ms | 30 | 64.64% |
| FP16 | 18.27 ms | 55 | ~64.5% |
| INT8 | 14.77 ms | 68 | 63.84% |
| Best mixed (FP16:1) | 14.29 ms | 70 | ~64.0% |

Per-layer latency examples on Orin:

| Layer | FP32 | FP16 | INT8 |
|-------|------|------|------|
| backbone.blocks.0.0 (Conv) | 1.382 ms | 0.561 ms | 0.376 ms |
| backbone.blocks.1.7 (Conv) | 1.014 ms | 0.494 ms | 0.175 ms |
| neck.deblocks.2.0 (DeConv) | 1.666 ms | 0.711 ms | 0.572 ms |

### CenterPoint 3D Detection (Jetson Orin, NVIDIA Lidar_AI_Solution)

| Component | FP16 Latency | INT8 Latency |
|-----------|-------------|-------------|
| Voxelization (CUDA) | 1.36 ms | 1.36 ms |
| 3D Backbone (spconv) | 22.3 ms | 22.3 ms |
| RPN + Head (TRT) | 11.3 ms | 7.0 ms |
| Decode + NMS (CUDA) | 4.4 ms | 4.4 ms |
| **Total** | **40.0 ms (25 FPS)** | **35.7 ms (28 FPS)** |

Accuracy: 57.57 mAP, 65.64 NDS on nuScenes validation.

### BEVFusion (Jetson Orin, NVIDIA Lidar_AI_Solution)

| Configuration | Precision | mAP | NDS | FPS |
|---------------|-----------|-----|-----|-----|
| ResNet50 (TRT) | FP16 | 67.89 | 70.98 | 18 |
| ResNet50-PTQ | FP16+INT8 | 67.66 | 70.81 | 25 |

PTQ achieves **39% FPS improvement** with only 0.23 mAP drop.

### YOLO Detection Models on Jetson (TensorRT)

| Model | Device | FP16 FPS | INT8 FPS |
|-------|--------|----------|----------|
| YOLOv8n | AGX Orin 64GB | ~300 | ~400 |
| YOLOv8s | AGX Orin 64GB | ~200 | ~280 |
| YOLOv8x | AGX Orin 32GB | ~55 | ~75 |
| YOLOv8n | Orin Nano 8GB | ~35 (FP32) | ~43 (INT8) |

---

## 10. Common Deployment Failures and Fixes

### 1. ONNX Parser Errors

**Error:** `"<X> must be an initializer!"`
**Cause:** Dynamic values where TensorRT expects constants.
**Fix:** `polygraphy surgeon sanitize model.onnx --fold-constants -o model_fixed.onnx`

**Error:** `"getPluginCreator() could not find Plugin <operator name>"`
**Cause:** Custom op without registered TensorRT plugin.
**Fix:** Implement `IPluginV3`, compile as shared library, load with `--plugins=myplugin.so`.

### 2. Engine Build Failures

**Error:** `"could not find any implementation for node <name>"`
**Cause:** Insufficient workspace memory or unsupported layer configuration.
**Fix:** Increase `--memPoolSize=workspace:8192MiB`. If persists on Jetson, try reducing max batch size.

**Error:** `"network needs native FP16, platform does not have native FP16"`
**Cause:** Building on a platform without FP16 hardware support.
**Fix:** Build on the target Jetson device, not on the host CPU.

**Error:** Build failure with FP8-Q/DQ before convolution where channels are not multiples of 16.
**Fix:** Pad channels to multiples of 16 or avoid FP8 for those layers.

### 3. Accuracy / Numerical Issues

**Symptom:** NaN or Inf in FP16 engine outputs.
**Cause:** Intermediate layer activations overflow FP16 range (~65504 max).
**Fix:**
```bash
# Force overflow-prone layers to FP32
trtexec --onnx=model.onnx --fp16 \
    --layerPrecisions=reduce_mean:fp32,elementwise_pow:fp32 \
    --precisionConstraints=obey \
    --saveEngine=model_safe.engine
```

**Symptom:** Significant accuracy drop with INT8.
**Cause:** Poor calibration data or layers sensitive to quantization.
**Fix:**
- Use more representative calibration data (500+ samples from target domain).
- Try `IInt8MinMaxCalibrator` if `IInt8EntropyCalibrator2` gives poor results.
- Use per-layer precision control to keep sensitive layers in FP16.
- Switch to QAT for better accuracy recovery.

**Warning:** `"Tensor <X> is uniformly zero"` during INT8 calibration.
**Cause:** All-zero activations from dead ReLUs or constant tensors.
**Fix:** Verify input preprocessing matches training. Check preceding layer outputs.

**Known issue (TensorRT 10.x):** Accuracy issue in `fc-xelu-bias` and `conv-xelu-bias` patterns when bias follows xelu. Monitor release notes for fix.

### 4. Memory Issues on Jetson

**Symptom:** OOM during engine build or inference.
**Fix:**
```bash
# Add swap space
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Reduce workspace
trtexec --onnx=model.onnx --fp16 --memPoolSize=workspace:2048MiB --saveEngine=model.engine
```

- Reduce `--builderOptimizationLevel` (default 3; try 2 or 1 for faster/smaller builds).
- Use `--stripWeights` for refit-only engines to reduce plan file size.
- Monitor unified memory with `tegrastats` during build and inference.

### 5. DLA-Specific Failures

**Error:** `"Layer <name> is not supported on DLA"`
**Cause:** Operation type, kernel size, channel count, or data format not supported by DLA.
**Fix:** Add `--allowGPUFallback`. Check layer support with `builder->canRunOnDLA(layer)`.

**Error:** DLA engine fails with dynamic shapes.
**Cause:** DLA requires static shapes. min=opt=max.
**Fix:** Set identical values for `--minShapes`, `--optShapes`, `--maxShapes`.

**Symptom:** DLA engine builds but is slower than GPU-only.
**Cause:** DLA optimizes for energy efficiency, not latency. Too many GPU fallback reformats.
**Fix:** Profile with `--dumpProfile` to identify reformat layers. Consider GPU-only for latency-critical paths.

### 6. Version / Compatibility Failures

**Error:** `"engine plan file not compatible with this version of TensorRT"`
**Fix:** Rebuild engine with matching TensorRT version. Always rebuild after JetPack upgrades.

**Error:** `"engine plan file generated on incompatible device"`
**Fix:** Build on the exact target GPU/DLA. SM87 (Orin) engines do not run on SM72 (Xavier).

### 7. ScatterND / Gather Runtime Errors

**Error:** Incorrect outputs from ScatterND on TensorRT < 10.9.
**Fix:** Upgrade to TensorRT >= 10.9. If stuck on older version, rewrite the operation as explicit tensor ops before ONNX export.

### Diagnostic Workflow

```bash
# 1. Validate ONNX
polygraphy surgeon sanitize model.onnx --fold-constants -o model_clean.onnx

# 2. Build with verbose logging
trtexec --onnx=model_clean.onnx --fp16 --verbose 2>&1 | tee build.log

# 3. Check for unsupported ops
grep -i "unsupported\|error\|warning\|fallback" build.log

# 4. Profile per-layer
trtexec --loadEngine=model.engine --dumpProfile --separateProfileRun --profilingVerbosity=detailed

# 5. Compare outputs with Polygraphy
polygraphy run model.onnx --trt --onnxrt --val-range images:[0,1] --atol 1e-2 --rtol 1e-2

# 6. Identify accuracy-sensitive layers
polygraphy run model.onnx --trt --onnxrt --trt-outputs mark all --onnxrt-outputs mark all
```

---

## 11. NVIDIA Lidar_AI_Solution Pipeline

GitHub: [NVIDIA-AI-IOT/Lidar_AI_Solution](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution)

This is NVIDIA's reference implementation for deploying lidar-based 3D object detection on Jetson Orin. It contains production-ready CUDA+TensorRT pipelines for the key autonomous driving perception models.

### Repository Structure

```
Lidar_AI_Solution/
├── CUDA-PointPillars/       # PointPillars with CUDA voxelization
├── CUDA-CenterPoint/        # CenterPoint with NV spconv
├── CUDA-BEVFusion/          # BEVFusion camera-lidar fusion
├── CUDA-V2XFusion/          # V2X cooperative perception
└── libraries/
    ├── cuOSD/               # CUDA on-screen display
    ├── cuPCL/               # CUDA point cloud library
    └── YUV2RGB/             # CUDA image format conversion
```

### PointPillars Pipeline

Architecture: Voxelization (CUDA) -> 2.5D Backbone (TensorRT) -> Decode + NMS (CUDA)

**Orin performance:**

| Component | Latency |
|-----------|---------|
| Voxelization | 0.18 ms |
| Backbone + Head (TRT FP16) | 4.87 ms |
| Decoder + NMS | 1.79 ms |
| **Total** | **6.84 ms (~146 FPS)** |

### CenterPoint Pipeline

Architecture: Voxelization (CUDA) -> 3D Sparse Backbone (libspconv, not TRT) -> RPN+CenterHead (TensorRT) -> Decode+NMS (CUDA)

**Key detail:** The 3D sparse convolution backbone uses NVIDIA's custom `libspconv` engine, which is independent of TensorRT. This is a tiny inference engine for 3D sparse convolutional networks supporting INT8/FP16, with low memory usage (422 MB for FP16, 426 MB for INT8).

**Build process:**

```bash
git clone --recursive https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution
cd CUDA-CenterPoint

# Build TRT engines and spconv
bash tool/build.trt.sh
mkdir -p build && cd build
cmake .. && make -j$(nproc)

# Prepare data (nuScenes format)
python tool/eval_nusc.py --dump

# Run inference
./centerpoint_infer ../data/nusc_bin/

# Evaluate
python tool/eval_nusc.py --eval
```

**Platform support:** libspconv supports SM80/SM86 (A30, RTX 30xx), SM87 (Orin). Xavier (SM72) is not supported by the latest version.

**Quantization:** Mixed precision -- voxelization in FP32, sparse backbone in FP16, RPN+Head in FP16 or INT8, decode in FP16. QAT solutions provided for `traveller59/spconv` integration.

### BEVFusion Pipeline

Architecture: Camera Encoder (ResNet50/SwinTiny, TensorRT) + Lidar Backbone (spconv) -> BEV Pooling (CUDA) -> Feature Fusion -> Detection Head (TensorRT) -> Decode (CUDA)

**Build process:**

```bash
cd CUDA-BEVFusion

# Configure environment
source tool/environment.sh  # Set TRT, CUDA, CUDNN paths

# Build TRT engines
bash tool/build_trt_engine.sh

# Build and run
bash tool/run.sh
```

**Quantization approach:**
- PTQ: `ResNet50-PTQ` uses INT8 for backbone with FP16 for sensitive layers. 39% FPS improvement (18 -> 25 FPS on Orin) with only 0.23 mAP drop.
- Structured sparsity: `--sparsity=force` for 4:2 pattern via NVIDIA ASP toolkit.
- Full QAT: Refer to `qat/README.md` in the repo.

**Optimization strategies from NVIDIA:**
1. Deploy cuPCL ground removal / range filters to reduce lidar point count before voxelization.
2. Use ResNet34 instead of ResNet50 for lower latency with acceptable accuracy tradeoff.
3. Apply partial quantization -- only quantize layers with minimal accuracy impact.

### V2XFusion Pipeline

Latest addition supporting vehicle-to-everything cooperative perception:
- PointPillars backbone with pre-normalization
- 4:2 structural sparsity support
- NVIDIA DeepStream SDK 7.0 integration
- Designed for multi-agent fusion in connected vehicle scenarios

### Applicability to Airside AV

These pipelines directly apply to airside operations:
- **PointPillars** at 6.84 ms on Orin covers the real-time lidar perception requirement for detecting ground vehicles, aircraft, and personnel on the apron.
- **CenterPoint** at 35-40 ms provides higher-accuracy 3D detection with velocity estimation for tracking moving objects.
- **BEVFusion** at 40-56 ms fuses camera and lidar for comprehensive situational awareness in all lighting and weather conditions.

The CUDA kernel implementations for voxelization, NMS, and BEV pooling are production-grade and can be integrated directly into an airside AV stack.

---

## 12. End-to-End Deployment Checklist for Airside AV on Orin

### Pre-Deployment

- [ ] Train model in PyTorch with representative airside data (aircraft, GSE, personnel, FOD).
- [ ] Run QAT fine-tuning with NVIDIA Model Optimizer if INT8 accuracy matters.
- [ ] Export to ONNX with correct opset (>= 17), dynamic batch axes declared.
- [ ] Validate ONNX with `polygraphy surgeon sanitize --fold-constants`.

### Engine Building

- [ ] Build on the exact target Jetson Orin hardware (SM87).
- [ ] Generate calibration cache with 500+ representative airside frames.
- [ ] Build FP16 engine as baseline.
- [ ] Build INT8 engine and validate accuracy against FP16.
- [ ] Build DLA engine for CNN-heavy paths (camera backbone).
- [ ] Save timing cache for faster rebuilds during OTA updates.

### Integration

- [ ] Profile per-layer latency with `trtexec --dumpProfile`.
- [ ] Allocate DLA0/DLA1 for camera detection, GPU for lidar/fusion.
- [ ] Set up Triton model repository with ensemble pipeline (or use C API directly for lowest latency).
- [ ] Implement CUDA graph capture for steady-state inference.
- [ ] Configure dynamic batching for variable-count inputs.

### Validation

- [ ] Compare TensorRT outputs against PyTorch golden reference (Polygraphy).
- [ ] Stress test under thermal load (Orin thermal throttles at ~85C).
- [ ] Monitor power consumption with `tegrastats` across all power modes.
- [ ] Verify end-to-end latency meets airside safety requirements.
- [ ] Test engine deserialization after simulated power cycle.

---

## Sources

- [TensorRT 10.16.0 Release Notes](https://docs.nvidia.com/deeplearning/tensorrt/latest/getting-started/release-notes.html)
- [TensorRT Command-Line Programs (trtexec)](https://docs.nvidia.com/deeplearning/tensorrt/latest/reference/command-line-programs.html)
- [Working with DLA -- NVIDIA TensorRT](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-with-dla.html)
- [Working with Quantized Types -- NVIDIA TensorRT](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-quantized-types.html)
- [TensorRT Best Practices](https://docs.nvidia.com/deeplearning/tensorrt/latest/performance/best-practices.html)
- [TensorRT Troubleshooting](https://docs.nvidia.com/deeplearning/tensorrt/latest/reference/troubleshooting.html)
- [Working with Dynamic Shapes -- NVIDIA TensorRT](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-dynamic-shapes.html)
- [Maximizing Deep Learning Performance on NVIDIA Jetson Orin with DLA](https://developer.nvidia.com/blog/maximizing-deep-learning-performance-on-nvidia-jetson-orin-with-dla/)
- [Jetson Benchmarks (MLPerf)](https://developer.nvidia.com/embedded/jetson-benchmarks)
- [NVIDIA Lidar_AI_Solution (GitHub)](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution)
- [CUDA-CenterPoint README](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution/blob/master/CUDA-CenterPoint/README.md)
- [CUDA-BEVFusion README](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution/blob/master/CUDA-BEVFusion/README.md)
- [Triton Inference Server on Jetson](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/jetson.html)
- [Serving ML Pipelines with Triton Ensemble Models](https://developer.nvidia.com/blog/serving-ml-model-pipelines-on-nvidia-triton-inference-server-with-ensemble-models/)
- [ONNX-TensorRT Supported Operators](https://github.com/onnx/onnx-tensorrt/blob/main/docs/operators.md)
- [TensorRT Support Matrix](https://docs.nvidia.com/deeplearning/tensorrt/latest/getting-started/support-matrix.html)
- [Achieving FP32 Accuracy for INT8 with QAT (NVIDIA Blog)](https://developer.nvidia.com/blog/achieving-fp32-accuracy-for-int8-inference-using-quantization-aware-training-with-tensorrt/)
- [Torch-TensorRT Quantization Guide](https://docs.pytorch.org/TensorRT/user_guide/shapes_precision/quantization.html)
- [NVIDIA Model Optimizer (GitHub)](https://github.com/NVIDIA/Model-Optimizer)
- [PyTorch ONNX Export Documentation](https://docs.pytorch.org/docs/stable/onnx.html)
- [NVIDIA Jetson DLA Tutorial (GitHub)](https://github.com/NVIDIA-AI-IOT/jetson_dla_tutorial)
- [Mixed Precision PointPillars (arXiv:2601.12638)](https://arxiv.org/html/2601.12638)
