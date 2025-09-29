import { Dot } from '../types/annotation';

export function distanceBetweenPoints(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isPointNearDot(pointX: number, pointY: number, dot: Dot, thresholdPx: number): boolean {
  return distanceBetweenPoints(pointX, pointY, dot.x, dot.y) < thresholdPx;
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeSelectionBox(box: SelectionBox): SelectionBox {
  return {
    x: Math.min(box.x, box.x + box.width),
    y: Math.min(box.y, box.y + box.height),
    width: Math.abs(box.width),
    height: Math.abs(box.height),
  };
}

export function isDotInsideBox(dot: Dot, box: SelectionBox): boolean {
  return dot.x >= box.x && dot.x <= box.x + box.width && dot.y >= box.y && dot.y <= box.y + box.height;
}

