import { computed, reactive } from "vue";
import type { RocketConfig } from "@orbitq/graphql";

// ---------------------------------------------------------------------------
// Band registry
//
// Each entry declares how much world-space height it needs below the baseline.
// bandHeightFrac receives the active rockets and maxLength so it can derive
// its true extent from rocket geometry rather than a hardcoded guess.
// ---------------------------------------------------------------------------
type BandDef = {
  label: string;
  bandHeightFrac: (
    rockets: (RocketConfig | null)[],
    maxLength: number,
    worldScale: number,
  ) => number;
};

export type BandId = keyof typeof BAND_REGISTRY;

// 1 metre of plume height per this many kilonewtons of thrust.
// Drives both the canvas layout reservation and ThrustIndicator rendering.
export const KN_PER_PLUME_METRE = 250;

// World-space fraction of the tallest rocket's length reserved for the maiden
// flight timeline band. A fixed fraction keeps the band a predictable size
// regardless of which rockets are loaded.
export const TIMELINE_BAND_FRAC = 0.38;

// Axis sits at this fraction of band height from the top, leaving room above
// for rocket name and date labels. Drives both layout and rendering.
export const TIMELINE_AXIS_Y_FRAC = 0.38;

// Minimum pixel clearance above the axis needed for the tallest above-axis
// label (rocket name). Used by bandHeightFrac to enforce a pixel floor.
export const TIMELINE_ROCKET_NAME_ABOVE_PX = 80;

const BAND_REGISTRY = {
  thrust: {
    label: "Thrust",
    bandHeightFrac: (rockets, maxLength, _worldScale: number) => {
      if (maxLength <= 0) return 0;
      const maxPlumeM = Math.max(
        ...rockets.map((r) => (r?.toThrust ?? 0) / KN_PER_PLUME_METRE),
        0,
      );
      return maxPlumeM / maxLength;
    },
  },
  maidenFlight: {
    label: "Maiden Flight",
    bandHeightFrac: (_rockets, maxLength, worldScale) => {
      if (maxLength <= 0 || worldScale <= 0) return TIMELINE_BAND_FRAC;
      const minFrac =
        TIMELINE_ROCKET_NAME_ABOVE_PX /
        (maxLength * worldScale * TIMELINE_AXIS_Y_FRAC);
      return Math.max(TIMELINE_BAND_FRAC, minFrac);
    },
  },
} satisfies Record<string, BandDef>;

// ---------------------------------------------------------------------------
// Canvas layout
//
// Pure functions that translate world-space geometry into pixel coordinates.
// These depend on enabledBands and BAND_REGISTRY but are layout concerns, not
// band definitions.
// ---------------------------------------------------------------------------

// World-space layout constants, expressed as fractions of the tallest rocket's length.
// The canvas fits: TOP_PADDING + rocket + BOTTOM_PADDING + active layer heights.
// worldScale = canvasHeight / (maxLength × totalWorldFrac()).
const TOP_PADDING_FRAC = 0.14;
const BOTTOM_PADDING_FRAC = 0.25;

export function useCanvasBands(canvasHeight: number) {
  // When no rockets are loaded, fall back to a scale where the human fills ~40% of
  // the canvas — keeping it visible as a standing reference figure.
  const humanOnlyScale = (canvasHeight * 0.4) / 1.75;

  // Initialise from the no-content default, not baselineY.value — at startup there
  // are no rockets so active layer costs shouldn't apply yet.
  const DEFAULT_BASELINE =
    canvasHeight *
    (1 - BOTTOM_PADDING_FRAC / (1 + TOP_PADDING_FRAC + BOTTOM_PADDING_FRAC));

  // enabledBands: logical toggle state — drives computed targets (scale, baselineY).
  // visibleBands: what's actually rendered — lags behind enabledBands during transition.
  // Separating the two lets us animate the canvas into its new layout before a band
  // appears (toggle ON) or immediately after it disappears (toggle OFF).
  const enabledBands = reactive<Record<BandId, boolean>>({
    thrust: false,
    maidenFlight: true,
  });
  const visibleBands = reactive<Record<BandId, boolean>>({
    thrust: false,
    maidenFlight: false,
  });

  function toggleBand(id: BandId) {
    if (enabledBands[id]) {
      visibleBands[id] = false;
      enabledBands[id] = false;
    } else {
      enabledBands[id] = true;
    }
  }

  function showBands(ids: BandId[]) {
    for (const id of ids) visibleBands[id] = true;
  }

  function hideBand(id: BandId) {
    visibleBands[id] = false;
  }

  function disableAllBands() {
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      visibleBands[id] = false;
      enabledBands[id] = false;
    }
  }

  // Total world height as a multiple of maxLength:
  // TOP_PADDING + 1 (rocket) + BOTTOM_PADDING + active layer heights.
  // worldScale defaults to 0, which skips the pixel-minimum floor in each band
  // (returns the base fractional size). Pass the real worldScale to get the
  // pixel-minimum-aware fractions.
  function totalWorldFrac(
    rockets: (RocketConfig | null)[],
    maxLength: number,
    worldScale = 0,
  ) {
    let frac = 1 + TOP_PADDING_FRAC + BOTTOM_PADDING_FRAC;
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      if (enabledBands[id])
        frac += BAND_REGISTRY[id].bandHeightFrac(
          rockets,
          maxLength,
          worldScale,
        );
    }
    return frac;
  }

  // Two passes resolve the circular dependency: pass 1 gives an initial
  // worldScale using base fractions; pass 2 applies the pixel-minimum floor
  // with that scale to get the final result.
  function targetScaleForLength(
    maxLength: number,
    rockets: (RocketConfig | null)[],
  ) {
    if (maxLength <= 0) return humanOnlyScale;
    const ws0 = canvasHeight / (maxLength * totalWorldFrac(rockets, maxLength));
    return canvasHeight / (maxLength * totalWorldFrac(rockets, maxLength, ws0));
  }

  function targetBaselineY(
    maxLength: number,
    rockets: (RocketConfig | null)[],
  ) {
    if (maxLength <= 0) return DEFAULT_BASELINE;
    const ws = targetScaleForLength(maxLength, rockets);
    let belowFrac = BOTTOM_PADDING_FRAC;
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      if (enabledBands[id])
        belowFrac += BAND_REGISTRY[id].bandHeightFrac(rockets, maxLength, ws);
    }
    return (
      canvasHeight * (1 - belowFrac / totalWorldFrac(rockets, maxLength, ws))
    );
  }

  // Cumulative Y offsets for each band as fractions of maxLength.
  // Band N starts at baselineY + offsets[N] * maxLength * worldScale.
  function bandOffsetFracs(
    rockets: (RocketConfig | null)[],
    maxLength: number,
    worldScale: number,
  ): Record<BandId, number> {
    const offsets = {} as Record<BandId, number>;
    let cumulative = 0;
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      offsets[id] = cumulative;
      if (enabledBands[id]) {
        cumulative += BAND_REGISTRY[id].bandHeightFrac(
          rockets,
          maxLength,
          worldScale,
        );
      }
    }
    return offsets;
  }

  // Pixel height of a single band at the given worldScale.
  function bandHeightPx(
    id: BandId,
    rockets: (RocketConfig | null)[],
    maxLength: number,
    worldScale: number,
  ): number {
    if (!enabledBands[id] || maxLength <= 0 || worldScale <= 0) return 0;
    return (
      BAND_REGISTRY[id].bandHeightFrac(rockets, maxLength, worldScale) *
      maxLength *
      worldScale
    );
  }

  // Syncs visibleBands to enabledBands once a layout animation settles.
  // Called after the rocket-data watcher animates to the new scale so that
  // band content appears only when the canvas is already in its final position.
  function syncVisibleBands(maxLength: number) {
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      visibleBands[id] = maxLength > 0 && enabledBands[id];
    }
  }

  // Returns the IDs of currently-enabled bands that are ordered after `id` in
  // the registry. Used to hide bands that would visibly jump during a layout
  // animation triggered by toggling `id`.
  function bandsBelow(id: BandId): BandId[] {
    const ids = Object.keys(BAND_REGISTRY) as BandId[];
    return ids.slice(ids.indexOf(id) + 1).filter((bid) => enabledBands[bid]);
  }

  const bandList = computed(() =>
    (Object.keys(BAND_REGISTRY) as BandId[]).map((id) => ({
      id,
      label: BAND_REGISTRY[id].label,
      active: enabledBands[id],
    })),
  );

  return {
    enabledBands,
    visibleBands,
    toggleBand,
    showBands,
    hideBand,
    disableAllBands,
    totalWorldFrac,
    targetBaselineY,
    targetScaleForLength,
    bandOffsetFracs,
    bandHeightPx,
    syncVisibleBands,
    bandsBelow,
    bandList,
    humanOnlyScale,
    DEFAULT_BASELINE,
  };
}
