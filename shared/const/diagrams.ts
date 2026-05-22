import raw14 from "@shared/assets/images/diagrams/falcon-9v1.1.svg?raw";
// import raw26 from "@shared/assets/images/diagrams/electron.svg?raw";
// import raw128 from "@shared/assets/images/diagrams/128.svg?raw";
// import raw143 from "@shared/assets/images/diagrams/143.svg?raw";
import raw527 from "@shared/assets/images/diagrams/527.svg?raw"; // starship v2
import {
  parseSvgViewBox,
  parseSvgStages,
  type StageData,
  type ViewBox,
} from "../utils/parseSvgPaths";

export type { StageData, ViewBox };

export type DiagramEntry = {
  stages: StageData[];
  viewBox: ViewBox;
  nativeWidth: number;
  nativeHeight: number;
};

function makeDiagramEntry(svgRaw: string): DiagramEntry {
  const { viewBox } = parseSvgViewBox(svgRaw);
  const stages = parseSvgStages(svgRaw);
  return {
    stages,
    viewBox,
    nativeWidth: viewBox.width,
    nativeHeight: viewBox.height,
  };
}

export const diagrams: { [key: number]: DiagramEntry } = {
  14: makeDiagramEntry(raw14),
  // 26: makeDiagramEntry(raw26),
  // 128: makeDiagramEntry(raw128),
  // 143: makeDiagramEntry(raw143),
  527: makeDiagramEntry(raw527),
};
