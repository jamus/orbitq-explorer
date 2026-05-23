import { describe, it, expect } from "vitest";
import {
  parseSvgViewBox,
  parseSvgStages,
  parseSimpleSvg,
} from "./parseSvgPaths.ts";

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

  it("returns empty engines array when stage has no engine_ subgroups", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01"><path d="M0,0" fill="blue"/></g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].engines).toEqual([]);
  });

  it("extracts engine_ subgroups from a stage", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01">
        <path d="M0,0" fill="blue"/>
        <g id="engine_1"><path d="M10,10" fill="red"/></g>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].engines).toHaveLength(1);
    expect(stages[0].engines[0].id).toBe("engine_1");
    expect(stages[0].engines[0].paths).toHaveLength(1);
    expect(stages[0].engines[0].paths[0].d).toBe("M10,10");
  });

  it("excludes engine paths from stage paths", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01">
        <path d="M0,0" fill="blue"/>
        <g id="engine_1"><path d="M10,10" fill="red"/></g>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].paths).toHaveLength(1);
    expect(stages[0].paths[0].d).toBe("M0,0");
  });

  it("handles multiple engines in a stage", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01">
        <path d="M0,0" fill="blue"/>
        <g id="engine_1"><path d="M10,10" fill="red"/></g>
        <g id="engine_2"><path d="M20,20" fill="green"/></g>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].engines).toHaveLength(2);
    expect(stages[0].engines[0].id).toBe("engine_1");
    expect(stages[0].engines[1].id).toBe("engine_2");
    expect(stages[0].paths).toHaveLength(1);
  });

  it("does not pick up nested groups without engine_ prefix as engines", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="stage_01">
        <g id="fairing"><path d="M5,5" fill="gray"/></g>
        <g id="engine_1"><path d="M10,10" fill="red"/></g>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].engines).toHaveLength(1);
    expect(stages[0].engines[0].id).toBe("engine_1");
  });
});

// ---------------------------------------------------------------------------
// parseSimpleSvg
// ---------------------------------------------------------------------------

describe("parseSimpleSvg", () => {
  it("returns viewBox and all paths", () => {
    const svg = `<svg viewBox="0 0 50 80">
      <path d="M0,0" fill="red"/>
      <path d="M1,1" fill="blue"/>
    </svg>`;
    const { viewBox, paths } = parseSimpleSvg(svg);
    expect(viewBox).toEqual({ minX: 0, minY: 0, width: 50, height: 80 });
    expect(paths).toHaveLength(2);
    expect(paths[0].d).toBe("M0,0");
    expect(paths[1].d).toBe("M1,1");
  });

  it("includes paths nested inside groups", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="body"><path d="M5,5" fill="gray"/></g>
    </svg>`;
    const { paths } = parseSimpleSvg(svg);
    expect(paths).toHaveLength(1);
    expect(paths[0].d).toBe("M5,5");
  });

  it("skips paths with no d attribute", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <path fill="red"/>
      <path d="M0,0" fill="blue"/>
    </svg>`;
    const { paths } = parseSimpleSvg(svg);
    expect(paths).toHaveLength(1);
    expect(paths[0].d).toBe("M0,0");
  });

  it("preserves optional id on paths", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <path d="M0,0" fill="red" id="head"/>
    </svg>`;
    const { paths } = parseSimpleSvg(svg);
    expect(paths[0].id).toBe("head");
  });

  it("omits id when not present on a path", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <path d="M0,0" fill="red"/>
    </svg>`;
    const { paths } = parseSimpleSvg(svg);
    expect(paths[0]).not.toHaveProperty("id");
  });

  it("throws when viewBox is absent", () => {
    expect(() => parseSimpleSvg(`<svg><path d="M0,0"/></svg>`)).toThrow(
      "SVG missing viewBox attribute",
    );
  });
});
