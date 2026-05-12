# 0003 — Canvas Layout and Layer Registry

## Status
Implemented

## Context

The canvas previously used a hardcoded `baselineY` (82% down the canvas) and a scale derived from a fixed 70% height fraction. This worked for rendering rockets alone but left no principled way to reserve space below the baseline for additional visual elements (thrust plumes, mass breakdown bars, stage separations, etc.) without manually recalculating every layout constant and re-wiring the animation.

Adding `ThrustIndicator` made this limitation concrete: the plume extends below the baseline and its height varies per rocket (proportional to thrust), so both `worldScale` and `baselineY` needed to shift when it was toggled.

## Decision

### World scale and canvas sizing

Everything on the canvas is positioned in **world units (metres)** and converted to pixels via a single `worldScale` value (pixels per metre).

The canvas fits the tallest rocket by solving:

```
canvasHeight = maxLength × totalWorldFrac × worldScale
→ worldScale = canvasHeight / (maxLength × totalWorldFrac)
```

`totalWorldFrac` is a unitless multiplier describing the full vertical extent of the scene as a fraction of the tallest rocket's length:

```
totalWorldFrac = TOP_PADDING_FRAC   (0.14)  — headroom above nose
              + 1.0                          — the rocket itself
              + BOTTOM_PADDING_FRAC (0.25)  — ground strip below base
              + (sum of each active layer's frac)  — declared by each layer in the registry
```

`baselineY` (where rocket bases touch the canvas, in pixels) is derived from the same fractions:

```
baselineY = canvasHeight × (1 − belowFrac / totalWorldFrac)
belowFrac = BOTTOM_PADDING_FRAC + (sum of each active layer's frac)
```

When layers toggle on or off, both `worldScale` and `baselineY` animate simultaneously via an ease-out-cubic `Konva.Animation`. The canvas contracts or expands to accommodate the new layout before layer content appears (toggle ON) or immediately after it disappears (toggle OFF).

### Layer registry

Each layer is declared as a `LayerDef` entry in `LAYER_REGISTRY`:

```ts
type LayerDef = {
  label: string;
  worldHeightFrac: (rockets: (RocketConfig | null)[], maxLength: number) => number;
};
```

`worldHeightFrac` returns the layer's required height as a fraction of `maxLength`, derived from actual rocket geometry rather than a hardcoded guess. The canvas layout system calls this automatically when computing `totalWorldFrac` and `targetBaselineY`.

### Active vs display layers

Two separate reactive records track layer state:

- `activeLayers` — logical toggle state; changing it triggers the canvas animation
- `displayLayers` — what is actually rendered; lags behind `activeLayers` during transition

Separating the two enforces the sequencing rule: animate the canvas into its new layout *before* revealing a layer (toggle ON), and hide the layer *before* animating back (toggle OFF). This prevents content from overflowing its allocated space during the transition.

## How to add a new layer

**1. Declare it in `LAYER_REGISTRY`:**

```ts
const LAYER_REGISTRY = {
  thrust: { ... },       // existing
  massBreakdown: {       // new
    label: "Mass",
    worldHeightFrac: (rockets, maxLength) => {
      // Return the layer's height as a fraction of maxLength.
      // Derive from rocket geometry where possible.
      return 0.3;
    },
  },
} satisfies Record<string, LayerDef>;
```

**2. Add the key to `activeLayers` and `displayLayers`:**

```ts
const activeLayers  = reactive<Record<LayerId, boolean>>({ thrust: true, massBreakdown: false });
const displayLayers = reactive<Record<LayerId, boolean>>({ thrust: true, massBreakdown: false });
```

The toggle button, canvas resize animation, and show/hide sequencing are driven by the registry automatically. No other changes to `AppCanvas.vue` are needed.

**3. Render the layer component conditionally on `displayLayers`:**

```html
<MassBreakdown
  v-if="displayRocketA && displayLayers.massBreakdown"
  :baselineY="animatedBaselineY"
  :worldScale="animatedWorldScale"
  :rocket="displayRocketA"
/>
```

Layer components receive `baselineY` and `worldScale` as props and position themselves in world-space relative to the baseline, exactly like `ThrustIndicator`.

## Consequences

- Adding a new below-baseline element requires only a `LAYER_REGISTRY` entry and a component — no manual layout arithmetic
- `worldScale` and `baselineY` are always consistent with each other and with active layer state
- The human reference figure is unaffected: when no rockets are loaded the canvas returns to a fixed default baseline regardless of layer state
- `totalWorldFrac` grows with each active layer, so `worldScale` shrinks slightly — rockets appear smaller when more layers are visible. This is correct behaviour; the canvas is showing more of the world.
- Layers that derive `worldHeightFrac` from rocket geometry (like thrust) produce correct reservations automatically as different rockets are loaded
