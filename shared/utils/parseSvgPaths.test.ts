import { describe, it, expect } from "vitest";
import { parseSvgViewBox, parseSvgStages } from "./parseSvgPaths.ts";

// ---------------------------------------------------------------------------
// parseSvgViewBox
// ---------------------------------------------------------------------------

describe("parseSvgViewBox", () => {
  it("parses viewBox into numeric fields", () => {
    const svg = `<svg viewBox="0 0 100 200"><path d="M0,0" fill="red"/></svg>`;
    const { viewBox } = parseSvgViewBox(svg);
    expect(viewBox).toEqual({ minX: 0, minY: 0, width: 100, height: 200 });
  });

  it("parses viewBox with non-zero origin", () => {
    const svg = `<svg viewBox="-10 -20 300 400"><path d="M0,0" fill="red"/></svg>`;
    const { viewBox } = parseSvgViewBox(svg);
    expect(viewBox).toEqual({ minX: -10, minY: -20, width: 300, height: 400 });
  });

  it("throws when viewBox attribute is absent", () => {
    expect(() => parseSvgViewBox(`<svg><path d="M0,0"/></svg>`)).toThrow(
      "SVG missing viewBox attribute",
    );
  });
});

// ---------------------------------------------------------------------------
// parseSvgStages
// ---------------------------------------------------------------------------

describe("parseSvgStages", () => {
  it("throws when diagram has no stage groups", () => {
    const svg = `<svg viewBox="0 0 100 200"><path d="M0,0" fill="red"/></svg>`;
    expect(() => parseSvgStages(svg)).toThrow(
      "Diagram SVG has no stage groups",
    );
  });

  it("extracts a single stage group with its paths", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01">
        <path d="M0,0" fill="blue"/>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages).toHaveLength(1);
    expect(stages[0].id).toBe("stage_01");
    expect(stages[0].paths).toHaveLength(1);
    expect(stages[0].paths[0].d).toBe("M0,0");
  });

  it("handles multiple stage groups", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01"><path d="M0,0" fill="red"/></g>
      <g id="stage_02"><path d="M1,1" fill="green"/></g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages).toHaveLength(2);
    expect(stages[0].id).toBe("stage_01");
    expect(stages[1].id).toBe("stage_02");
  });

  it("ignores paths inside stage groups that have no d attribute", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01">
        <path fill="red"/>
        <path d="M5,5" fill="blue"/>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].paths).toHaveLength(1);
    expect(stages[0].paths[0].d).toBe("M5,5");
  });

  it("throws when no groups match stage_ prefix", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="Booster-1"><path d="M0,0" fill="red"/></g>
    </svg>`;
    expect(() => parseSvgStages(svg)).toThrow(
      "Diagram SVG has no stage groups",
    );
  });

  it("ignores paths outside stage groups", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <path d="M99,99" fill="red"/>
      <g id="stage_01"><path d="M0,0" fill="blue"/></g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages).toHaveLength(1);
    expect(stages[0].paths).toHaveLength(1);
    expect(stages[0].paths[0].d).toBe("M0,0");
  });
});
