import { describe, it, expect } from "vitest";
import { useCanvasBands, KN_PER_PLUME_METRE } from "./useCanvasBands.ts";
import type { RocketConfig } from "@orbitq/graphql";

const CANVAS_HEIGHT = 800;

// Minimal RocketConfig stub with just the fields useCanvasBands reads.
function makeRocket(overrides: Partial<RocketConfig> = {}): RocketConfig {
  return {
    id: "r1",
    fullName: "Test Rocket",
    length: 70,
    toThrust: 0,
    ...overrides,
  } as RocketConfig;
}

describe("useCanvasBands", () => {
  describe("toggleBand", () => {
    it("first call enables the band (enabledBands only, not visibleBands)", () => {
      const { enabledBands, visibleBands, toggleBand } =
        useCanvasBands(CANVAS_HEIGHT);
      toggleBand("thrust");
      expect(enabledBands.thrust).toBe(true);
      expect(visibleBands.thrust).toBe(false);
    });

    it("second call disables the band and clears visibleBands", () => {
      const { enabledBands, visibleBands, toggleBand, showBands } =
        useCanvasBands(CANVAS_HEIGHT);
      toggleBand("thrust");
      showBands(["thrust"]); // simulate animation completing
      toggleBand("thrust");
      expect(enabledBands.thrust).toBe(false);
      expect(visibleBands.thrust).toBe(false);
    });
  });

  describe("showBands", () => {
    it("sets visibleBands for the given ids", () => {
      const { visibleBands, showBands } = useCanvasBands(CANVAS_HEIGHT);
      showBands(["thrust"]);
      expect(visibleBands.thrust).toBe(true);
    });
  });

  describe("hideBand", () => {
    it("clears visibleBands for the given id", () => {
      const { visibleBands, showBands, hideBand } =
        useCanvasBands(CANVAS_HEIGHT);
      showBands(["thrust"]);
      hideBand("thrust");
      expect(visibleBands.thrust).toBe(false);
    });
  });

  describe("disableAllBands", () => {
    it("clears all enabled and visible state", () => {
      const {
        enabledBands,
        visibleBands,
        toggleBand,
        showBands,
        disableAllBands,
      } = useCanvasBands(CANVAS_HEIGHT);
      toggleBand("thrust");
      showBands(["thrust"]);
      disableAllBands();
      expect(enabledBands.thrust).toBe(false);
      expect(visibleBands.thrust).toBe(false);
    });
  });

  describe("totalWorldFrac", () => {
    it("no bands active returns base padding fraction (≈ 1.39)", () => {
      const { totalWorldFrac } = useCanvasBands(CANVAS_HEIGHT);
      const result = totalWorldFrac([], 70);
      // 1 + 0.14 + 0.25 = 1.39
      expect(result).toBeCloseTo(1.39);
    });

    it("thrust band active adds plume height fraction for rocket with thrust", () => {
      const { totalWorldFrac, toggleBand } = useCanvasBands(CANVAS_HEIGHT);
      toggleBand("thrust");

      const maxLength = 70;
      const toThrust = 7000; // kN → 7000/250 = 28m plume
      const rocket = makeRocket({ length: maxLength, toThrust });

      const noThrust = 1.39;
      const plumeM = toThrust / KN_PER_PLUME_METRE;
      const plumeFrac = plumeM / maxLength;
      const expected = noThrust + plumeFrac;

      expect(totalWorldFrac([rocket], maxLength)).toBeCloseTo(expected);
    });
  });

  describe("targetBaselineY", () => {
    it("returns DEFAULT_BASELINE when maxLength is 0", () => {
      const { targetBaselineY, DEFAULT_BASELINE } =
        useCanvasBands(CANVAS_HEIGHT);
      expect(targetBaselineY(0, [])).toBe(DEFAULT_BASELINE);
    });

    it("returns DEFAULT_BASELINE when maxLength is negative", () => {
      const { targetBaselineY, DEFAULT_BASELINE } =
        useCanvasBands(CANVAS_HEIGHT);
      expect(targetBaselineY(-1, [])).toBe(DEFAULT_BASELINE);
    });

    it("returns a value within canvas bounds when maxLength is positive", () => {
      const { targetBaselineY } = useCanvasBands(CANVAS_HEIGHT);
      const result = targetBaselineY(70, [makeRocket()]);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(CANVAS_HEIGHT);
    });
  });

  describe("targetScaleForLength", () => {
    it("returns humanOnlyScale when maxLength is 0", () => {
      const { targetScaleForLength, humanOnlyScale } =
        useCanvasBands(CANVAS_HEIGHT);
      expect(targetScaleForLength(0, [])).toBe(humanOnlyScale);
    });

    it("returns canvasHeight / (maxLength × totalWorldFrac) when maxLength is positive", () => {
      const { targetScaleForLength, totalWorldFrac } =
        useCanvasBands(CANVAS_HEIGHT);
      const maxLength = 70;
      const rockets = [makeRocket({ length: maxLength })];
      const expected =
        CANVAS_HEIGHT / (maxLength * totalWorldFrac(rockets, maxLength));
      expect(targetScaleForLength(maxLength, rockets)).toBeCloseTo(expected);
    });
  });

  describe("syncVisibleBands", () => {
    it("copies enabledBands to visibleBands when maxLength > 0", () => {
      const { enabledBands, visibleBands, toggleBand, syncVisibleBands } =
        useCanvasBands(CANVAS_HEIGHT);
      toggleBand("thrust");
      expect(visibleBands.thrust).toBe(false);
      syncVisibleBands(70);
      expect(visibleBands.thrust).toBe(enabledBands.thrust);
    });

    it("clears visibleBands when maxLength is 0 (no rockets)", () => {
      const { visibleBands, showBands, syncVisibleBands } =
        useCanvasBands(CANVAS_HEIGHT);
      showBands(["thrust"]);
      syncVisibleBands(0);
      expect(visibleBands.thrust).toBe(false);
    });
  });

  describe("bandList", () => {
    it("returns initial list with thrust inactive", () => {
      const { bandList } = useCanvasBands(CANVAS_HEIGHT);
      expect(bandList.value).toEqual([
        { id: "thrust", label: "Thrust", active: false },
        { id: "maidenFlight", label: "Maiden Flight", active: false },
      ]);
    });

    it("reflects enabled state reactively", () => {
      const { bandList, toggleBand } = useCanvasBands(CANVAS_HEIGHT);
      toggleBand("thrust");
      expect(bandList.value[0].active).toBe(true);
    });
  });
});
