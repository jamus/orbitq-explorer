import url14 from "@shared/assets/images/diagrams/14.svg?url";
import url26 from "@shared/assets/images/diagrams/26.svg?url";
import url128 from "@shared/assets/images/diagrams/128.svg?url";
import url143 from "@shared/assets/images/diagrams/143.svg?url";
import url522 from "@shared/assets/images/diagrams/522.svg?url";

export type DiagramEntry = {
  url: string;
  nativeWidth: number;
  nativeHeight: number;
};

export const diagrams: { [key: number]: DiagramEntry } = {
  14: { url: url14, nativeWidth: 36, nativeHeight: 110 },
  26: { url: url26, nativeWidth: 36, nativeHeight: 110 },
  128: { url: url128, nativeWidth: 36, nativeHeight: 110 },
  143: { url: url143, nativeWidth: 36, nativeHeight: 110 },
  522: { url: url522, nativeWidth: 282, nativeHeight: 2139 }, // 159 2160
};
