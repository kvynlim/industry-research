# Knowledge Base Taxonomy Visuals Design

Date: 2026-05-09

## Context

The current knowledge-base visual rebuild restored one visual per page after the generated figures were removed, but the visual system is too repetitive. The generator uses five broad renderers and a shared frame/palette, so many assets read as the same diagram with different labels.

The next rebuild should keep the coverage and link contract but replace the generic visual grammar with topic-specific diagram forms.

## Goal

Rebuild all 99 knowledge-base visuals so each page has one purpose-built SVG selected from a meaningful diagram taxonomy. Two randomly chosen pages should not usually look like the same layout with renamed labels.

## Non-Goals

- Do not add multiple visuals per page in this pass.
- Do not change public page URLs or Markdown file locations.
- Do not replace SVGs with raster images.
- Do not manually handcraft all 99 SVGs as unrelated one-offs.
- Do not reintroduce old `kb-figure` markers or `_assets/figures` paths.

## Visual Contract

Each knowledge-base Markdown file keeps exactly one block:

```markdown
<!-- kb-visual:start -->
![<page title> curated visual](../_assets/visuals/<asset>.svg)

*Visual: <page-specific caption>.*
<!-- kb-visual:end -->
```

Each SVG remains under `10-knowledge-base/_assets/visuals/` and includes:

- one root `<svg>` element,
- one `<title>`,
- one `<desc>` containing the Markdown visual caption,
- escaped XML text,
- no generic placeholder wording.

## Diagram Taxonomy

The generator should assign each page to a diagram type that matches the page's teaching burden. The taxonomy should include at least these families:

- Measurement geometry: camera rays, LiDAR beams, projection residuals, coordinate frames, geodesy chains.
- Calibration and observability: sensor rigs, targetless constraints, time offsets, factor connections, rank/observability cues.
- Timing and synchronization: timelines, clock offsets, scan/row capture, preintegration, latency budgets.
- Factor graph and inference: variables, factors, messages, beliefs, priors, elimination paths.
- Numerical structure: sparse matrices, spectra, Schur complements, square-root factors, covariance ellipses.
- Optimization landscape: residual construction, linearization, damping, trust regions, accept/reject loops.
- Probability and decision metrics: distributions, gates, thresholds, ROC/PR, reliability diagrams, conformal sets.
- Learning architecture: token grids, attention maps, latent bottlenecks, multi-head losses, world-model rollouts.
- Sequence and generative processes: recurrent state, selective scan, diffusion noising/denoising, sampler trajectories.
- Mapping and planning: occupancy updates, volumetric representations, route/behavior/motion stacks, validation layers.
- Signal and radar processing: chirps, FFT stages, CFAR windows, range-Doppler/angle maps, ambiguity tradeoffs.
- Systems assurance: architecture flows, benchmark split firewalls, weather degradation, error-budget propagation.

The taxonomy may have more families if needed, but it must not collapse back into five broad templates.

## Implementation Shape

Keep `tools/knowledge-base/curated-visuals.mjs` as the deterministic generator, but refactor it around explicit diagram kinds:

1. Parse the existing reassessment note as the content manifest.
2. Attach each page to a diagram kind using an explicit mapping keyed by file path, not only broad regex matching.
3. Render each kind with a distinct composition, not just different labels inside shared boxes.
4. Preserve current asset names so Markdown references remain stable.
5. Replace SVG file contents and update Markdown visual blocks only if captions or paths need normalization.

Shared primitives are acceptable for accessibility, text wrapping, arrows, labels, and colors. They should not force every visual into the same outer composition.

## Testing

Keep the existing content smoke tests that enforce:

- no old generated `kb-figure` placeholders,
- exactly one `kb-visual` block per knowledge-base page,
- SVG existence and metadata.

Add or strengthen tests to prevent regression toward generic sameness:

- every live knowledge-base page has a diagram-kind assignment,
- the number of diagram kinds used across the 99 pages is high enough for real variety,
- every SVG includes a machine-readable diagram-kind marker or metadata value,
- no single diagram kind dominates the corpus beyond a reasonable threshold.

## Review Criteria

The rebuilt visual set is acceptable when:

- all 99 pages still have one visual,
- all tests and the VitePress build pass,
- representative samples from different topic folders visibly differ in structure,
- pages with different teaching burdens use different visual forms,
- the generator remains deterministic and can be rerun safely.
