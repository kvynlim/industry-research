# Positional Encodings and Coordinate Tokenization

## Why This Page Exists

Attention layers are permutation-invariant unless position is added. AV models need position in several forms: image pixels, BEV cells, LiDAR points, map coordinates, ego-frame poses, timestamps, and trajectory waypoints. A positional encoding mistake can look like a model weakness while the real bug is coordinate representation.

This page complements [Attention and Transformers: First Principles](attention-transformers-first-principles.md) and [Tokenization and Discretization](tokenization-and-discretization-first-principles.md).

## Absolute Positional Encodings

The original transformer used sinusoidal encodings:

```text
PE(pos, 2i)   = sin(pos / 10000^(2i/d))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d))
```

These give each position a deterministic vector. Learned absolute embeddings are also common.

AV caution: learned absolute image positions may not transfer across camera resolution, crop, lens model, or BEV grid size.

## Relative Position

Relative encodings represent distances between tokens:

```text
bias(i, j) = f(position_i - position_j)
```

This is useful for local spatial reasoning. A vehicle 5 meters ahead matters because of relative pose, not because of its absolute token index.

## RoPE

Rotary positional embeddings rotate query and key vectors as a function of position. Dot products then carry relative-position information.

RoPE is common in language and increasingly relevant for long-context multimodal models. For AV, extensions must handle 2D, 3D, and time without accidentally mixing incompatible coordinate axes.

## ALiBi

ALiBi adds a distance-dependent bias to attention scores. It encourages attention to nearby tokens and can extrapolate to longer contexts better than fixed learned embeddings in some settings.

For streaming perception, distance bias can be temporal as well as spatial.

## 2D and 3D Coordinates

Vision and BEV models need more than 1D sequence position.

Common choices:

- separate x/y embeddings,
- Fourier features of continuous coordinates,
- learned BEV cell embeddings,
- 3D point coordinates as features,
- relative offsets between queries and keys,
- ego-motion compensated coordinates.

The coordinate frame must be explicit:

```text
sensor frame, ego frame, map frame, ENU frame, image frame
```

Dynamic-object removal depends on this. A point can appear moving in sensor frame while static in map frame if ego-motion compensation is wrong.

## Time Encoding

Temporal models need timestamps, not only frame indices. Sensors run at different rates and may have dropped frames.

Better representations include:

- continuous time delta,
- sensor capture timestamp,
- ego pose interpolation timestamp,
- age of memory token,
- latency since observation.

For asynchronous perception, a frame index can silently encode the wrong time interval.

## Map and Trajectory Tokens

Map and planning models often tokenize:

- lane polylines,
- crosswalks,
- stop lines,
- stand boundaries,
- routes,
- trajectories,
- occupancy cells.

Each token should preserve coordinate frame, scale, heading, and topology. A polyline token without local orientation can force the model to relearn geometry from raw coordinates.

## Failure Modes

- Resolution changes break learned absolute embeddings.
- Ego-frame and map-frame coordinates are mixed.
- Time index is used where actual timestamp is required.
- Positional encoding wraps or aliases over long contexts.
- BEV cells lose height information needed for obstacles.
- Dynamic/static labels are wrong because motion is computed in the wrong frame.
- Map-change models confuse moved objects with coordinate drift.

## AV Review Checklist

```text
Which frame are coordinates expressed in?
Are coordinates normalized, quantized, or embedded continuously?
How are x, y, z, yaw, and time represented?
Can the model handle variable sensor rates?
Does the encoding transfer across grid sizes and camera crops?
Are relative positions used where interactions matter?
Are map and trajectory tokens tied to versioned map frames?
```

## Sources

- Vaswani et al., "Attention Is All You Need": https://arxiv.org/abs/1706.03762
- Su et al., "RoFormer: Enhanced Transformer with Rotary Position Embedding": https://arxiv.org/abs/2104.09864
- Press et al., "Train Short, Test Long: Attention with Linear Biases": https://arxiv.org/abs/2108.12409
- Tancik et al., "Fourier Features Let Networks Learn High Frequency Functions": https://arxiv.org/abs/2006.10739
- Local companion: [Attention and Transformers: First Principles](attention-transformers-first-principles.md)
