import { useState, useCallback, useRef } from "react";

/**
 * useDraggableNodes
 * Manages positions of nodes on the strategy map canvas.
 * Supports both node dragging and canvas panning.
 */
export function useDraggableNodes(initialNodes) {
  const [nodes, setNodes] = useState(initialNodes);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const dragging = useRef(null);   // { id, startMouseX, startMouseY, startNodeX, startNodeY }
  const panning  = useRef(null);   // { startMouseX, startMouseY, startPanX, startPanY }

  // ── node drag ──────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find((n) => n.id === id);
    dragging.current = {
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    };

    const onMove = (me) => {
      if (!dragging.current) return;
      const { id, startMouseX, startMouseY, startNodeX, startNodeY } = dragging.current;
      const dx = me.clientX - startMouseX;
      const dy = me.clientY - startMouseY;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, x: startNodeX + dx, y: startNodeY + dy }
            : n
        )
      );
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [nodes]);

  // ── canvas pan ─────────────────────────────────────────────────
  const onCanvasMouseDown = useCallback((e) => {
    if (dragging.current) return;
    panning.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };

    const onMove = (me) => {
      if (!panning.current) return;
      const dx = me.clientX - panning.current.startMouseX;
      const dy = me.clientY - panning.current.startMouseY;
      setPan({ x: panning.current.startPanX + dx, y: panning.current.startPanY + dy });
    };

    const onUp = () => {
      panning.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pan]);

  const resetLayout = useCallback(() => {
    setNodes(initialNodes);
    setPan({ x: 0, y: 0 });
  }, [initialNodes]);

  return { nodes, pan, onNodeMouseDown, onCanvasMouseDown, resetLayout };
}
