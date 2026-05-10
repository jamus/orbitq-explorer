import raw14 from "@shared/assets/images/diagrams/falcon-9v1.1.svg?raw";
import raw26 from "@shared/assets/images/diagrams/electron.svg?raw";
import raw128 from "@shared/assets/images/diagrams/128.svg?raw";
import raw143 from "@shared/assets/images/diagrams/143.svg?raw";
import raw522 from "@shared/assets/images/diagrams/starship-v3.svg?raw";
import {
  parseSvgPaths,
  type PathData,
  type ViewBox,
} from "../utils/parseSvgPaths";

export type { PathData, ViewBox };

export type DiagramEntry = {
  paths: PathData[];
  viewBox: ViewBox;
  nativeWidth: number;
  nativeHeight: number;
};

function makeDiagramEntry(svgRaw: string): DiagramEntry {
  const { paths, viewBox } = parseSvgPaths(svgRaw);
  return {
    paths,
    viewBox,
    nativeWidth: viewBox.width,
    nativeHeight: viewBox.height,
  };
}

export const diagrams: { [key: number]: DiagramEntry } = {
  14: makeDiagramEntry(raw14),
  26: makeDiagramEntry(raw26),
  128: makeDiagramEntry(raw128),
  143: makeDiagramEntry(raw143),
  522: makeDiagramEntry(raw522),
};
