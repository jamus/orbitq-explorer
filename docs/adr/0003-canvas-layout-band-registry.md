# 0003 — Canvas Layout and Band Registry

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
              + (sum of each active band's frac)   — declared by each band in the registry
```

`baselineY` (where rocket bases touch the canvas, in pixels) is derived from the same fractions:

```
baselineY = canvasHeight × (1 − belowFrac / totalWorldFrac)
belowFrac = BOTTOM_PADDING_FRAC + (sum of each active band's frac)
```

When layers toggle on or off, both `worldScale` and `baselineY` animate simultaneously via an ease-out-cubic `Konva.Animation`. The canvas contracts or expands to accommodate the new layout before band content appears (toggle ON) or immediately after it disappears (toggle OFF).

### Band registry

Bands are **horizontal strips** that sit below the rocket baseline and span the full canvas width. They are not z-axis overlays (Photoshop-style layers); they add vertical height to the canvas. Each rocket column renders its own content at its x-position within a shared band.

Each band is declared as a `BandDef` entry in `BAND_REGISTRY`:

```ts
type BandDef = {
  label: string;
  bandHeightFrac: (rockets: (RocketConfig | null)[], maxLength: number) => number;
};
```

`bandHeightFrac` returns the band's required height as a fraction of `maxLength`, derived from actual rocket geometry rather than a hardcoded guess. The canvas layout system calls this automatically when computing `totalWorldFrac` and `targetBaselineY`.

### Enabled vs visible bands

Two separate reactive records track band state:

- `enabledBands` — logical toggle state; changing it triggers the canvas animation
- `visibleBands` — what is actually rendered; lags behind `enabledBands` during transition

Separating the two enforces the sequencing rule: animate the canvas into its new layout *before* revealing a band (toggle ON), and hide the band *before* animating back (toggle OFF). This prevents content from overflowing its allocated space during the transition.

## How to add a new band

**1. Declare it in `BAND_REGISTRY`:**

```ts
const BAND_REGISTRY = {
  thrust: { ... },       // existing
  massBreakdown: {       // new
    label: "Mass",
    bandHeightFrac: (rockets, maxLength) => {
      // Return the band's height as a fraction of maxLength.
      // Derive from rocket geometry where possible.
      return 0.3;
    },
  },
} satisfies Record<string, BandDef>;
```

**2. Add the key to `enabledBands` and `visibleBands`:**

```ts
const enabledBands  = reactive<Record<BandId, boolean>>({ thrust: true, massBreakdown: false });
const visibleBands = reactive<Record<BandId, boolean>>({ thrust: true, massBreakdown: false });
```

The band checkbox (in the side panel), canvas resize animation, and show/hide sequencing are driven by the registry automatically. No other changes to `AppCanvas.vue` or `CanvasPanel.vue` are needed.

**3. Render the band component conditionally on `visibleBands`:**

```html
<MassBreakdown
  v-if="displayRocketA && visibleBands.massBreakdown"
  :baselineY="animatedBaselineY"
  :worldScale="animatedWorldScale"
  :rocket="displayRocketA"
/>
```

Band components receive `baselineY` and `worldScale` as props and position themselves in world-space relative to the baseline, exactly like `ThrustIndicator`.

## Consequences

- Adding a new below-baseline element requires only a `BAND_REGISTRY` entry and a component — no manual layout arithmetic
- `worldScale` and `baselineY` are always consistent with each other and with active band state
- The human reference figure is unaffected: when no rockets are loaded the canvas returns to a fixed default baseline regardless of band state
- `totalWorldFrac` grows with each active band, so `worldScale` shrinks slightly — rockets appear smaller when more bands are visible. This is correct behavior; the canvas is showing more of the world.
- Bands that derive `bandHeightFrac` from rocket geometry (like thrust) produce correct reservations automatically as different rockets are loaded
