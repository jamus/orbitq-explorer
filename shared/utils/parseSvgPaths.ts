export type PathData = {
  d: string;
  fill: string;
  id?: string;
  className?: string;
};
export type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

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
