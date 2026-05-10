# Robust Losses Knowledge Base Design

Date: 2026-05-10

## Context

The repository already mentions Huber, Cauchy, Tukey, and Geman-McClure robust losses in several places. The main first-principles coverage is currently folded into `10-knowledge-base/probability-statistics/robust-statistics-ransac-hypothesis-testing.md`, while application-level references appear in GTSAM, ICP, GraphSLAM, robust PGO/GNC, bundle adjustment, and perception-related pages.

That coverage is useful but diffuse. Readers who are trying to understand SLAM and perception residuals do not yet have one canonical page explaining robust loss functions comparatively: M-estimation, influence functions, IRLS weights, whitening, convexity, redescending behavior, tuning, and deployment failure modes.

## Goal

Add a dedicated knowledge-base page for robust loss functions and M-estimators, then update targeted cross-links from SLAM, perception, and optimization pages so the concept is discoverable from both first-principles and applied-method paths.

## Non-Goals

- Do not split Huber, Cauchy, Tukey, and Geman-McClure into separate pages.
- Do not replace the existing robust statistics, RANSAC, and hypothesis testing page.
- Do not rewrite method-level SLAM or perception pages beyond targeted links and short context sentences.
- Do not change public directory structure or page URLs outside the new page.

## New Page

Create:

`10-knowledge-base/probability-statistics/robust-losses-m-estimators-huber-cauchy-tukey-geman-mcclure.md`

The page should cover:

1. Why squared loss fails for autonomy residuals.
2. Residual whitening before robustification.
3. M-estimator objective, influence function, and IRLS weight function.
4. Side-by-side treatment of Huber, Cauchy, Tukey bisquare, and Geman-McClure.
5. Convex versus nonconvex and redescending behavior.
6. Practical use cases in ICP, point-to-plane registration, visual reprojection, bundle adjustment, pose graph loop closure, GNSS multipath, radar multipath, and perception/tracking losses.
7. Tuning guidance in whitened units.
8. Failure modes: wrong scale, over-robustifying all factors, poor initialization, ignored informative residuals, and robust losses masking bad models.
9. Sources from primary or authoritative references, including solver documentation where relevant.

The existing `robust-statistics-ransac-hypothesis-testing.md` page remains the broader page for gates, RANSAC, and hypothesis testing. It should link to the new page for robust-loss-specific depth.

## Visual Contract

Because every knowledge-base page must have one curated visual, the new page needs:

- One `kb-visual` block in the Markdown page.
- One SVG asset under `10-knowledge-base/_assets/visuals/`.
- One explicit taxonomy assignment in `tools/knowledge-base/visual-taxonomy.mjs`.
- A renderer entry in `tools/knowledge-base/curated-visuals.mjs` if the selected diagram kind is new.

The visual should teach the comparison directly: residual magnitude on one axis, loss/influence/weight behavior for squared, Huber, Cauchy, Tukey, and Geman-McClure on the other. If the existing taxonomy already has a suitable optimization/probability diagram kind, reuse it instead of adding a new kind.

## Cross-Link Targets

Update targeted references from:

- `10-knowledge-base/probability-statistics/robust-statistics-ransac-hypothesis-testing.md`
- `10-knowledge-base/probability-statistics/likelihood-map-mle-least-squares.md`
- `10-knowledge-base/optimization/nonlinear-least-squares-first-principles.md`
- `10-knowledge-base/optimization/factor-graph-solver-patterns-ceres-gtsam-g2o.md`
- `10-knowledge-base/state-estimation/gtsam-factor-graphs.md`
- `30-autonomy-stack/localization-mapping/slam-methods/icp.md`
- `30-autonomy-stack/localization-mapping/slam-methods/point-to-plane-icp.md`
- `30-autonomy-stack/localization-mapping/slam-methods/graphslam-pose-graph-optimization.md`
- `30-autonomy-stack/localization-mapping/slam-methods/bundle-adjustment-slam.md`
- `30-autonomy-stack/localization-mapping/slam-methods/robust-pgo-gnc-risam.md`

Also add one or two perception links only where robust losses are already part of the discussion, rather than forcing the link into unrelated perception pages.

## Data Flow

The implementation should follow the repository's Markdown-first flow:

1. Add the new Markdown page with the standard knowledge-base visual block and related-doc links.
2. Add or regenerate the visual asset.
3. Register the new page in the visual taxonomy.
4. Update targeted source pages with links to the new canonical page.
5. Let generated VitePress navigation include the page through the existing directory sidebar.

No separate index file is required for `10-knowledge-base/probability-statistics/`, because the repo currently relies on generated navigation plus root `README.md` and `INDEX.md` entry points.

## Error Handling

The main risks are content drift and test failures:

- If visual taxonomy tests fail, the new page likely lacks an assignment or asset metadata.
- If link checks fail, adjust relative paths from each cross-link target.
- If the docs build fails, inspect Markdown tables, special characters, and VitePress parsing of formulas.
- If the page duplicates the broader robust-statistics page too much, keep the new page focused on loss functions and move only comparative robust-loss detail there.

## Testing

Run:

```text
npm test
npm run priority:check
npm run docs:build
```

If time is constrained during implementation, run `npm test` first because it exercises content smoke tests, visual taxonomy coverage, and navigation behavior. Run the full `npm run verify` before claiming completion.

## Review Criteria

The change is acceptable when:

- The new page exists and is a complete research note, not a stub.
- Huber, Cauchy, Tukey, and Geman-McClure are explained comparatively.
- The page clearly connects robust losses to SLAM and perception residuals.
- The existing robust-statistics page links to the new page without losing its RANSAC/gating role.
- Targeted method and optimization pages link to the canonical page.
- Every knowledge-base visual and taxonomy test still passes.
- The VitePress docs build succeeds.
