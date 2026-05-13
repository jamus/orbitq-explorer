export type PathData = {
  d: string;
  fill: string;
  id?: string;
  className?: string;
};
export type StageData = { id: string; paths: PathData[] };
export type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

// Regex-based parser — runs at module init before DOMParser is available.
// Extracts all <path> elements and the viewBox from the raw SVG string.
export function parseSvgPaths(svgRaw: string): {
  paths: PathData[];
  viewBox: ViewBox;
} {
  const vbMatch = svgRaw.match(/viewBox="([^"]+)"/);
  if (!vbMatch) throw new Error("SVG missing viewBox attribute");
  const [minX, minY, width, height] = vbMatch[1]
    .trim()
    .split(/\s+/)
    .map(Number);

  const paths: PathData[] = [];
  const pathRe = /<path\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(svgRaw)) !== null) {
    const el = m[0];
    const d = el.match(/\bd="([^"]+)"/)?.[1];
    const fill = el.match(/\bfill="([^"]+)"/)?.[1] ?? "none";
    const id = el.match(/\bid="([^"]+)"/)?.[1];
    const className = el.match(/\bclass="([^"]+)"/)?.[1];
    if (d)
      paths.push({
        d,
        fill,
        ...(id && { id }),
        ...(className && { className }),
      });
  }

  return { paths, viewBox: { minX, minY, width, height } };
}

function parsePathEl(el: Element): PathData | null {
  const d = el.getAttribute("d");
  if (!d) return null;
  const fill = el.getAttribute("fill") ?? "none";
  const id = el.getAttribute("id") ?? undefined;
  const className = el.getAttribute("class") ?? undefined;
  return { d, fill, ...(id && { id }), ...(className && { className }) };
}

function parseStageEl(g: Element): StageData {
  const paths = Array.from(g.querySelectorAll("path"))
    .map(parsePathEl)
    .filter((p): p is PathData => p !== null);
  return { id: (g as SVGGElement).id, paths };
}

// DOM-based parser for stage groups. Selects <g id="Stage-*"> elements and
// collects their paths. Returns [] for diagrams with no stage groups.
export function parseSvgStages(svgRaw: string): StageData[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(svgRaw, "image/svg+xml");
  const stageEls = doc.querySelectorAll('g[id^="Stage-"]');
  console.log(`Found ${stageEls.length} stage groups in SVG`);
  return Array.from(stageEls).map(parseStageEl);
}
