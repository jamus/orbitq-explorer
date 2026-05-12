import { computed, reactive, ref } from "vue";
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
  ) => number;
};

export type BandId = keyof typeof BAND_REGISTRY;

// 1 metre of plume height per this many kilonewtons of thrust.
// Drives both the canvas layout reservation and ThrustIndicator rendering.
export const KN_PER_PLUME_METRE = 250;

const BAND_REGISTRY = {
  thrust: {
    label: "Thrust",
    bandHeightFrac: (rockets, maxLength) => {
      if (maxLength <= 0) return 0;
      const maxPlumeM = Math.max(
        ...rockets.map((r) => (r?.toThrust ?? 0) / KN_PER_PLUME_METRE),
        0,
      );
      return maxPlumeM / maxLength;
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

export function useBands(canvasHeight: number) {
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
  const enabledBands = reactive<Record<BandId, boolean>>({ thrust: false });
  const visibleBands = reactive<Record<BandId, boolean>>({ thrust: false });

  // Set by toggleBand so the enabledBands watcher knows which band to reveal
  // once the canvas-recenter animation completes (only used for toggle-ON).
  const pendingBandShow = ref<BandId | null>(null);

  function toggleBand(id: BandId): void {
    if (enabledBands[id]) {
      visibleBands[id] = false; // hide immediately
      enabledBands[id] = false; // animate canvas back (watcher fires)
    } else {
      enabledBands[id] = true; // animate canvas forward (watcher fires)
      pendingBandShow.value = id; // watcher will reveal layer in callback
    }
  }

  // Total world height as a multiple of maxLength:
  // TOP_PADDING + 1 (rocket) + BOTTOM_PADDING + active layer heights.
  function totalWorldFrac(
    rockets: (RocketConfig | null)[],
    maxLength: number,
  ): number {
    let frac = 1 + TOP_PADDING_FRAC + BOTTOM_PADDING_FRAC;
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      if (enabledBands[id])
        frac += BAND_REGISTRY[id].bandHeightFrac(rockets, maxLength);
    }
    return frac;
  }

  function targetBaselineY(
    maxLength: number,
    rockets: (RocketConfig | null)[],
  ): number {
    if (maxLength <= 0) return DEFAULT_BASELINE;
    let belowFrac = BOTTOM_PADDING_FRAC;
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      if (enabledBands[id])
        belowFrac += BAND_REGISTRY[id].bandHeightFrac(rockets, maxLength);
    }
    return canvasHeight * (1 - belowFrac / totalWorldFrac(rockets, maxLength));
  }

  function targetScaleForLength(
    maxLength: number,
    rockets: (RocketConfig | null)[],
  ): number {
    return maxLength > 0
      ? canvasHeight / (maxLength * totalWorldFrac(rockets, maxLength))
      : humanOnlyScale;
  }

  // Syncs visibleBands to enabledBands once a layout animation settles.
  // Called after the rocket-data watcher animates to the new scale so that
  // band content appears only when the canvas is already in its final position.
  function syncVisibleBands(maxLength: number): void {
    for (const id of Object.keys(BAND_REGISTRY) as BandId[]) {
      visibleBands[id] = maxLength > 0 && enabledBands[id];
    }
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
    pendingBandShow,
    toggleBand,
    totalWorldFrac,
    targetBaselineY,
    targetScaleForLength,
    syncVisibleBands,
    bandList,
    humanOnlyScale,
    DEFAULT_BASELINE,
  };
}
