# OrbitQ Explorer

A data exploration tool for visualising and comparing space launch vehicles at true relative scale. The core product is an interactive canvas showing two rockets side-by-side, rendered from curated silhouette geometry and real spec data.

## Language

### Canvas & Rendering

**Silhouette**:
A curated SVG path string representing a rocket's outline, hand-drawn in Figma and stored in the app. Not generated from spec data — drawn for accuracy and visual quality.
_Avoid_: shape, icon, illustration, sprite

**Silhouette Manifest**:
The typed TypeScript module (`silhouettes.ts`) that maps rocket IDs to their silhouette path string and native bounding box. The single source of truth for all curated geometry.
_Avoid_: asset map, path store, sprite sheet

**Native Bounding Box**:
The width and height of a silhouette in its Figma drawing coordinate space — stored in the Silhouette Manifest alongside the path string. Used to compute the path scale factor.
_Avoid_: viewBox, drawing size

**Path Origin Convention**:
The rule all silhouette drawings must follow: the path origin is bottom-centre of the rocket (nozzle at the bottom, nose tip at the top, horizontally centred). Enables baseline alignment without per-rocket anchor metadata.

**World Scale**:
The base pixels-per-metre constant computed on canvas mount. Sized so the taller rocket fills approximately 70% of the viewport height. All shape positions and sizes are baked into canvas pixels using this value.
_Avoid_: zoom level, base scale, pixel density

**Path Scale Factor**:
The per-rocket multiplier applied to a silhouette's Konva `Path` shape: `(rocket.length / nativeHeight) × worldScale`. Derived from the Native Bounding Box and World Scale. Drives uniform scaling — height axis only.
_Avoid_: scale, transform, zoom

**Camera**:
Konva Stage `scale` and `position` together. Starts at `scale = 1.0` with shape positions baked using World Scale. User pan and zoom modify Stage scale and position; they do not affect World Scale or individual shape geometry.
_Avoid_: viewport, zoom state

**Baseline**:
The shared horizontal ground line both rockets sit on. Silhouettes are anchored to it using the Path Origin Convention — no per-rocket Y offset needed.

**Grid**:
A CSS `background-image` repeating gradient on the container div behind the Konva Stage. Decorative only — implies scale visually but does not track metrically with the canvas.
_Avoid_: metric grid, scale grid

### Layout

**Duel**:
A two-rocket comparison — the only layout v1 supports. The canvas is hard-capped at two rockets. The taller rocket is always positioned on the left.
_Avoid_: comparison, side-by-side

**Zone**:
A fixed anchor region relative to a rocket (e.g. outer-mid, outer-lower, below) used to place annotations and overlays. Zones are compositional; the camera fits to their union.

**Thrust Overlay**:
The liftoff thrust (`toThrust`) visualisation rendered below the Baseline, proportional to actual thrust values. The only non-silhouette overlay in v1.

## Relationships

- A **Duel** contains exactly two **Silhouettes**
- Each **Silhouette** is scaled using its **Path Scale Factor**, derived from its **Native Bounding Box** and the shared **World Scale**
- All **Silhouettes** are anchored to the shared **Baseline** via the **Path Origin Convention**
- The **Camera** is independent of **World Scale** — World Scale is set once on mount; the Camera changes on user interaction
- The **Grid** is independent of the **Camera** — it does not pan or zoom with the canvas
- **Zones** are defined relative to each **Silhouette**; the **Camera** fits to their union on mount and on double-click reset

## Example dialogue

> **Dev:** "Should I update World Scale when the user zooms in?"
> **Domain expert:** "No — World Scale is set once on mount and never changes. Zoom is handled entirely by the Camera. World Scale bakes the geometry; the Camera is just a multiplier on top."

> **Dev:** "The Saturn V silhouette looks too narrow — should I scale the X axis independently to match the diameter spec?"
> **Domain expert:** "No. The Path Scale Factor is uniform, driven by height only. The silhouette drawing is the source of truth for proportions. If it looks wrong, fix the drawing."

## Flagged ambiguities

- "scale" is overloaded — resolved into three distinct concepts: **World Scale** (px/m, set on mount), **Path Scale Factor** (per-rocket multiplier), and **Camera** scale (Konva Stage scale, user-controlled).
