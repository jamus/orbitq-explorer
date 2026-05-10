# 0002 — Blueprint Stroke Rendering for Rocket Diagrams

## Status
Implemented

## Context

Rocket diagrams are rendered as scaled images inside a Konva canvas. Each rocket
is displayed at a size proportional to its real-world length, meaning rockets span
a wide range of scale factors. Adding a stroke directly to the SVG fill elements
would cause the stroke to scale with the image — producing thick outlines on large
rockets and thin outlines on small ones, making side-by-side comparisons visually
inconsistent.

## Decision

Render rocket SVG elements as Konva `Path` shapes (via `v-path`) rather than as
loaded images (via `v-image`). Set `strokeScaleEnabled: false` on each path so
Konva maintains a constant pixel-width stroke regardless of the scale factor
applied to the shape.

SVG files remain the authoritative source for rocket geometry. A build-time
utility (`shared/utils/parseSvgPaths.ts`) parses each SVG file and extracts
`<path>` element `d` attributes and the `viewBox`, which are stored alongside
existing metadata in `shared/const/diagrams.ts`.

Fill and stroke styling are controlled entirely by the rendering layer, not the
SVG files. Rockets render with `fill: "transparent"` and a configurable stroke
(default `#eff0f1` / `1.5px`). The human reference figure is an exception: it
renders as solid white with no stroke.

## SVG authoring convention

All rocket SVG files must use only `<path>` elements — no `<rect>`, `<circle>`,
`<ellipse>`, `<line>`, or `<polyline>`. Every shape must be flattened to a path
outline before export from the design tool (Figma: Flatten, Illustrator: Object →
Expand). This is a lossless conversion — any 2D shape can be expressed as a path
without geometric loss.

This convention enables a simple, dependency-free parser and keeps the Konva
rendering layer uniform.

## Consequences

- Consistent stroke width in screen pixels across all rockets at all scales
- Stroke width remains correct during animated scale transitions (Konva handles
  this natively via `strokeScaleEnabled`)
- SVG files remain editable in Figma / Illustrator — they are the source of truth
  for geometry only; colours are not read from SVG at render time
- Designers must flatten shapes to paths before export (one-step convention)
- `RocketImage.vue` accepts optional `stroke` and `strokeWidth` props; defaults
  give the blueprint look without changes at the call site
- `HumanFigure.vue` is hardcoded to solid white fill, no stroke — it is not
  governed by the blueprint stroke convention
- SVG import URLs in `diagrams.ts` are replaced with `?raw` string imports;
  path data is extracted at module initialisation
- A `@shared/utils` path alias was added to `vite.config.ts` and `tsconfig.json`
