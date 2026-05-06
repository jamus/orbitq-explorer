# Konva + D3 for canvas rendering

The rocket comparison canvas is built with react-konva (Konva.js React bindings) for rendering and d3-scale / d3-shape as pure math layers — not SVG or a charting library.

SVG was the obvious alternative for a two-rocket visualisation, but pan/zoom on an SVG tree degrades at fine detail and silhouette complexity. Konva renders to an HTML Canvas element, which scales cleanly under zoom regardless of shape complexity. WebGL was ruled out as disproportionate — the scene is simple enough that Canvas 2D is sufficient.

D3 is used only for its math modules (scale computation, path generation). It does not touch the DOM. This separation — D3 for geometry, Konva for rendering — keeps each layer testable in isolation and is the intended usage pattern for both libraries in a React context.

## Considered Options

- **SVG + React** — simpler mental model, but pan/zoom requires manual transform management and performance degrades with complex paths
- **Plain Canvas 2D** — viable but loses react-konva's declarative component model and built-in hit detection
- **WebGL / Three.js** — overkill for a 2D poster canvas with at most two silhouettes

## Consequences

react-konva is a meaningful dependency: Konva shapes are not React DOM elements, so standard React tooling (CSS, layout, accessibility) does not apply inside the Stage. Annotations and overlays must be Konva shapes or absolutely-positioned HTML layered over the canvas.
