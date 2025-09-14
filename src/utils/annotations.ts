import { Annotation, AnnotationFrame, Dot, LineSegment, AnnotationId, DotId, LineId } from '../types/annotation';

export function findAnnotationById(annotations: Annotation[], id: AnnotationId): Annotation | undefined {
  return annotations.find(a => a.id === id);
}

export function getFrame(ann: Annotation, frameNumber: number): AnnotationFrame | undefined {
  return ann.frames.find(f => f.frame === frameNumber);
}

export function upsertFrame(ann: Annotation, frameNumber: number): AnnotationFrame {
  let frame = getFrame(ann, frameNumber);
  if (!frame) {
    frame = { frame: frameNumber, dots: [], lines: [] };
    ann.frames = [...ann.frames, frame];
  }
  return frame;
}

export function removeFrame(ann: Annotation, frameNumber: number): void {
  ann.frames = ann.frames.filter(f => f.frame !== frameNumber);
}

export function removeAnnotationById(annotations: Annotation[], id: AnnotationId): Annotation[] {
  return annotations.filter(a => a.id !== id);
}

export function removeDotFromFrame(frame: AnnotationFrame, dotId: DotId): void {
  frame.dots = frame.dots.filter(d => d.id !== dotId);
  frame.lines = frame.lines.filter(l => l.startDotId !== dotId && l.endDotId !== dotId);
}

export function addDotToFrame(frame: AnnotationFrame, dot: Dot): void {
  frame.dots = [...frame.dots, dot];
}

export function addLineToFrame(frame: AnnotationFrame, line: LineSegment): void {
  frame.lines = [...frame.lines, line];
}

export function removeLineFromFrame(frame: AnnotationFrame, lineId: LineId): void {
  frame.lines = frame.lines.filter(l => l.id !== lineId);
}

export function filterEmptyFrames(ann: Annotation, currentFrame: number): Annotation | null {
  const remaining = ann.frames.filter(f => f.dots.length > 0 || f.frame !== currentFrame);
  if (remaining.length === 0) return null;
  return { ...ann, frames: remaining };
}

export function getDotById(ann: Annotation, frameNumber: number, id: DotId): Dot | undefined {
  return getFrame(ann, frameNumber)?.dots.find(d => d.id === id);
}

export function cloneFrame(frame: AnnotationFrame): AnnotationFrame {
  return {
    frame: frame.frame,
    dots: frame.dots.map(d => ({ ...d })),
    lines: frame.lines.map(l => ({ ...l })),
  };
}

