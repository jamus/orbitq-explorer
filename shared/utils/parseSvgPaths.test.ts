import { describe, it, expect } from "vitest";
import { parseSvgPaths, parseSvgStages } from "./parseSvgPaths.ts";

// ---------------------------------------------------------------------------
// parseSvgPaths
// ---------------------------------------------------------------------------

describe("parseSvgPaths", () => {
  it("parses viewBox into numeric fields", () => {
    const svg = `<svg viewBox="0 0 100 200"><path d="M0,0" fill="red"/></svg>`;
    const { viewBox } = parseSvgPaths(svg);
    expect(viewBox).toEqual({ minX: 0, minY: 0, width: 100, height: 200 });
  });

  it("parses viewBox with non-zero origin", () => {
    const svg = `<svg viewBox="-10 -20 300 400"><path d="M0,0" fill="red"/></svg>`;
    const { viewBox } = parseSvgPaths(svg);
    expect(viewBox).toEqual({ minX: -10, minY: -20, width: 300, height: 400 });
  });

  it("extracts path d attribute", () => {
    const svg = `<svg viewBox="0 0 10 10"><path d="M1,2 L3,4" fill="blue"/></svg>`;
    const { paths } = parseSvgPaths(svg);
    expect(paths).toHaveLength(1);
    expect(paths[0].d).toBe("M1,2 L3,4");
  });

  it("extracts optional id attribute", () => {
    const svg = `<svg viewBox="0 0 10 10"><path d="M0,0" fill="red" id="myPath"/></svg>`;
    const { paths } = parseSvgPaths(svg);
    expect(paths[0].id).toBe("myPath");
  });

  it("extracts optional class attribute as className", () => {
    const svg = `<svg viewBox="0 0 10 10"><path d="M0,0" fill="red" class="foo bar"/></svg>`;
    const { paths } = parseSvgPaths(svg);
    expect(paths[0].className).toBe("foo bar");
  });

  it("omits id and className when absent", () => {
    const svg = `<svg viewBox="0 0 10 10"><path d="M0,0" fill="red"/></svg>`;
    const { paths } = parseSvgPaths(svg);
    expect(paths[0]).not.toHaveProperty("id");
    expect(paths[0]).not.toHaveProperty("className");
  });

  it("skips path elements without a d attribute", () => {
    const svg = `<svg viewBox="0 0 10 10"><path fill="red"/></svg>`;
    const { paths } = parseSvgPaths(svg);
    expect(paths).toHaveLength(0);
  });

  it("handles multiple paths", () => {
    const svg = `<svg viewBox="0 0 10 10">
      <path d="M0,0" fill="red"/>
      <path d="M1,1" fill="blue"/>
    </svg>`;
    const { paths } = parseSvgPaths(svg);
    expect(paths).toHaveLength(2);
  });

  it("throws when viewBox attribute is absent", () => {
    expect(() => parseSvgPaths(`<svg><path d="M0,0"/></svg>`)).toThrow(
      "SVG missing viewBox attribute",
    );
  });
});

// ---------------------------------------------------------------------------
// parseSvgStages
// ---------------------------------------------------------------------------

describe("parseSvgStages", () => {
  it("returns [] when no Stage- groups are present", () => {
    const svg = `<svg viewBox="0 0 100 200"><path d="M0,0" fill="red"/></svg>`;
    expect(parseSvgStages(svg)).toEqual([]);
  });

  it("extracts a single stage group with its paths", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="Stage-1">
        <path d="M0,0" fill="blue"/>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages).toHaveLength(1);
    expect(stages[0].id).toBe("Stage-1");
    expect(stages[0].paths).toHaveLength(1);
    expect(stages[0].paths[0].d).toBe("M0,0");
  });

  it("handles multiple stage groups", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="Stage-1"><path d="M0,0" fill="red"/></g>
      <g id="Stage-2"><path d="M1,1" fill="green"/></g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages).toHaveLength(2);
    expect(stages[0].id).toBe("Stage-1");
    expect(stages[1].id).toBe("Stage-2");
  });

  it("ignores paths inside stage groups that have no d attribute", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="Stage-1">
        <path fill="red"/>
        <path d="M5,5" fill="blue"/>
      </g>
    </svg>`;
    const stages = parseSvgStages(svg);
    expect(stages[0].paths).toHaveLength(1);
    expect(stages[0].paths[0].d).toBe("M5,5");
  });

  it("does not pick up groups whose id does not start with Stage-", () => {
    const svg = `<svg viewBox="0 0 100 200">
      <g id="Booster-1"><path d="M0,0" fill="red"/></g>
    </svg>`;
    expect(parseSvgStages(svg)).toHaveLength(0);
  });
});
