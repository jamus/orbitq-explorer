export type PathData = { d: string; id?: string };
export type EngineData = { id: string; paths: PathData[] };
export type StageData = {
  id: string;
  paths: PathData[];
  engines: EngineData[];
};
export type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

// Regex-based parser — runs at module init before DOMParser is available.
// Extracts the viewBox from the raw SVG string.
export function parseSvgViewBox(svgRaw: string): { viewBox: ViewBox } {
  const vbMatch = svgRaw.match(/viewBox="([^"]+)"/);
  if (!vbMatch) throw new Error("SVG missing viewBox attribute");
  const [minX, minY, width, height] = vbMatch[1]
    .trim()
    .split(/\s+/)
    .map(Number);
  return { viewBox: { minX, minY, width, height } };
}

function parsePathEl(el: Element): PathData | null {
  const d = el.getAttribute("d");
  if (!d) return null;
  const id = el.getAttribute("id") ?? undefined;
  return { d, ...(id && { id }) };
}

function parseEngineEl(g: Element): EngineData {
  const paths = Array.from(g.querySelectorAll("path"))
    .map(parsePathEl)
    .filter((p): p is PathData => p !== null);
  return { id: g.id, paths };
}

function parseStageEl(g: Element): StageData {
  const engineEls = Array.from(g.querySelectorAll(':scope > g[id^="engine_"]'));
  const engines = engineEls.map(parseEngineEl);
  const enginePathSet = new Set(
    engineEls.flatMap((e) => Array.from(e.querySelectorAll("path"))),
  );
  const paths = Array.from(g.querySelectorAll("path"))
    .filter((p) => !enginePathSet.has(p))
    .map(parsePathEl)
    .filter((p): p is PathData => p !== null);
  return { id: (g as SVGGElement).id, paths, engines };
}

// Parser for simple SVGs with no stage structure (e.g. human figure).
// Returns all paths in document order alongside the viewBox.
export function parseSimpleSvg(svgRaw: string): {
  paths: PathData[];
  viewBox: ViewBox;
} {
  const { viewBox } = parseSvgViewBox(svgRaw);
  if (typeof DOMParser === "undefined") return { paths: [], viewBox };
  const doc = new DOMParser().parseFromString(svgRaw, "image/svg+xml");
  const paths = Array.from(doc.querySelectorAll("path"))
    .map(parsePathEl)
    .filter((p): p is PathData => p !== null);
  return { paths, viewBox };
}

// DOM-based parser for stage groups. Selects <g id="stage_*"> elements and
// collects their paths. Throws if no stage groups are found — every rocket
// diagram must have at least one stage. Returns [] only when DOMParser is
// unavailable (build/SSR context).
export function parseSvgStages(svgRaw: string): StageData[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(svgRaw, "image/svg+xml");
  const stageEls = doc.querySelectorAll('g[id^="stage_"]');
  const stages = Array.from(stageEls).map(parseStageEl);
  if (stages.length === 0) throw new Error("Diagram SVG has no stage groups");
  return stages;
}
