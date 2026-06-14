import { reactive, computed } from "vue";

export type NodeOwner = "a" | "b" | "shared";
export type NodeTypeId =
  | "thrust"
  | "overview"
  | "stages"
  | "engine_configuration";

type NodeTypeDef = {
  label: string;
  owner: "a" | "b" | "both";
  affectsDiagram: boolean;
};

const NODE_REGISTRY: Record<NodeTypeId, NodeTypeDef> = {
  thrust: { label: "Thrust", owner: "both", affectsDiagram: true },
  overview: { label: "Overview", owner: "both", affectsDiagram: false },
  stages: { label: "Stages", owner: "both", affectsDiagram: true },
  engine_configuration: {
    label: "Engine Configuration",
    owner: "both",
    affectsDiagram: false,
  },
};

export const NODE_COLUMN_WIDTH = 260;

export function useNodeGrid() {
  // isEnabled: drives CSS column open/close; worldscale for diagram nodes.
  const isEnabled = reactive<Record<NodeTypeId, boolean>>({
    thrust: false,
    overview: false,
    stages: false,
    engine_configuration: false,
  });

  // isVisible: drives actual diagram rendering (plume, spread rockets, etc.).
  // For diagram nodes this is controlled by the state machine.
  // For data nodes isVisible === isEnabled.
  const isVisible = reactive<Record<NodeTypeId, boolean>>({
    thrust: false,
    overview: false,
    stages: false,
    engine_configuration: false,
  });

  function isDiagramNode(typeId: NodeTypeId): boolean {
    return NODE_REGISTRY[typeId].affectsDiagram;
  }

  function enableNode(typeId: NodeTypeId) {
    isEnabled[typeId] = true;
    if (!NODE_REGISTRY[typeId].affectsDiagram) isVisible[typeId] = true;
  }

  function disableNode(typeId: NodeTypeId) {
    isEnabled[typeId] = false;
    isVisible[typeId] = false;
  }

  function showNode(typeId: NodeTypeId) {
    isVisible[typeId] = true;
  }

  function hideNode(typeId: NodeTypeId) {
    isVisible[typeId] = false;
  }

  const nodeList = computed(() =>
    (Object.keys(NODE_REGISTRY) as NodeTypeId[]).map((typeId) => ({
      typeId,
      label: NODE_REGISTRY[typeId].label,
      active: isEnabled[typeId],
      affectsDiagram: NODE_REGISTRY[typeId].affectsDiagram,
    })),
  );

  function nodesForSide(side: "a" | "b") {
    return computed(() =>
      (Object.keys(NODE_REGISTRY) as NodeTypeId[])
        .filter(
          (typeId) =>
            isEnabled[typeId] &&
            (NODE_REGISTRY[typeId].owner === side ||
              NODE_REGISTRY[typeId].owner === "both"),
        )
        .map((typeId) => ({
          typeId,
          label: NODE_REGISTRY[typeId].label,
          owner: side as NodeOwner,
          affectsDiagram: NODE_REGISTRY[typeId].affectsDiagram,
        })),
    );
  }

  const columnANodes = nodesForSide("a");
  const columnBNodes = nodesForSide("b");

  const columnAWidth = computed(() =>
    columnANodes.value.length > 0 ? NODE_COLUMN_WIDTH : 0,
  );
  const columnBWidth = computed(() =>
    columnBNodes.value.length > 0 ? NODE_COLUMN_WIDTH : 0,
  );

  const thrustEnabled = computed(() => isEnabled.thrust);
  const thrustRenderVisible = computed(() => isVisible.thrust);

  return {
    isDiagramNode,
    enableNode,
    disableNode,
    showNode,
    hideNode,
    nodeList,
    columnANodes,
    columnBNodes,
    columnAWidth,
    columnBWidth,
    thrustEnabled,
    thrustRenderVisible,
  };
}
