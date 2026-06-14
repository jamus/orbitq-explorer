import raw14 from "@shared/assets/images/diagrams/falcon-9v1.1.svg?raw";
import raw26 from "@shared/assets/images/diagrams/electron.svg?raw";
// import raw128 from "@shared/assets/images/diagrams/128.svg?raw";
import raw205 from "@shared/assets/images/diagrams/205.svg?raw"; // SLS Block 1B
import raw527 from "@shared/assets/images/diagrams/527.svg?raw"; // starship v2
import {
  parseSvgViewBox,
  parseSvgStages,
  type StageData,
  type EngineData,
  type ViewBox,
} from "../utils/parseSvgPaths";

export type { StageData, EngineData, ViewBox };

export type DiagramEntry = {
  stages: StageData[];
  viewBox: ViewBox;
  nativeWidth: number;
  nativeHeight: number;
};

function makeDiagramEntry(svgRaw: string): DiagramEntry {
  // console.log("makeDiagramEntry", svgRaw);
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
  26: makeDiagramEntry(raw26),
  // 128: makeDiagramEntry(raw128),
  205: makeDiagramEntry(raw205),
  527: makeDiagramEntry(raw527),
};
