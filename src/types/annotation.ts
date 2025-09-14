export interface Dot {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface LineSegment {
  id: string;
  startDotId: string;
  endDotId: string;
  color: string;
}

export interface AnnotationFrame {
  frame: number;
  dots: Dot[];
  lines: LineSegment[];
}

export interface Annotation {
  id: string;
  label: string;
  frames: AnnotationFrame[];
}

export type AnnotationId = string;
export type DotId = string;
export type LineId = string;

