import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

const THRESHOLD = 88;

/** Glisser vers la gauche pour supprimer (au-delà du seuil, relâcher déclenche `onDelete`). */
export function SwipeToDelete({ onDelete, children, ariaLabel }: SwipeToDeleteProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"x" | "y" | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
    setDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!axisRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axisRef.current !== "x") return;
    setDragX(Math.min(0, dx));
  }

  function reset() {
    setDragX(0);
    setDragging(false);
    startRef.current = null;
    axisRef.current = null;
  }

  function handlePointerUp() {
    if (axisRef.current === "x" && dragX < -THRESHOLD) {
      onDelete();
    }
    reset();
  }

  return (
    <div className="swipe-row">
      <div className="swipe-row-bg" aria-hidden="true">
        <Icon name="trash" size={20} />
      </div>
      <div
        className="swipe-row-content"
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 0.2s ease-out" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
