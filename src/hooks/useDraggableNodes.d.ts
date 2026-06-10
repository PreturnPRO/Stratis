import { MouseEvent as ReactMouseEvent } from "react";

export interface NodePosition {
  id: string; x: number; y: number; w: number; h: number;
  label: string; age: string; borderColor: string;
  glow?: boolean;
  tag?: { label: string; color: string };
  tags?: { label: string; color: string }[];
}

export declare function useDraggableNodes(initialNodes: NodePosition[]): {
  nodes: NodePosition[];
  pan: { x: number; y: number };
  onNodeMouseDown: (e: ReactMouseEvent<HTMLDivElement>, id: string) => void;
  onCanvasMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
  resetLayout: () => void;
};