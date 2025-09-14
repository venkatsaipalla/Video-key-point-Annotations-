import { Annotation } from '../types/annotation.ts';
import { frameToSeconds } from './time.ts';

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function annotationsToDotsCsv(annotations: Annotation[], fps: number): string {
  const header = [
    'annotationId',
    'label',
    'frame',
    'timeSeconds',
    'dotId',
    'x',
    'y',
    'color',
  ];
  const rows: string[] = [header.join(',')];

  annotations.forEach(ann => {
    ann.frames.forEach(frame => {
      const timeSeconds = frameToSeconds(frame.frame, fps);
      frame.dots.forEach(dot => {
        const row = [
          escapeCsv(ann.id),
          escapeCsv(ann.label),
          escapeCsv(frame.frame),
          escapeCsv(timeSeconds.toFixed(3)),
          escapeCsv(dot.id),
          escapeCsv(Math.round(dot.x)),
          escapeCsv(Math.round(dot.y)),
          escapeCsv(dot.color),
        ];
        rows.push(row.join(','));
      });
    });
  });

  return rows.join('\n');
}

export function annotationsToLinesCsv(annotations: Annotation[], fps: number): string {
  const header = [
    'annotationId',
    'label',
    'frame',
    'timeSeconds',
    'lineId',
    'startDotId',
    'endDotId',
    'color',
  ];
  const rows: string[] = [header.join(',')];

  annotations.forEach(ann => {
    ann.frames.forEach(frame => {
      const timeSeconds = frameToSeconds(frame.frame, fps);
      frame.lines.forEach(line => {
        const row = [
          escapeCsv(ann.id),
          escapeCsv(ann.label),
          escapeCsv(frame.frame),
          escapeCsv(timeSeconds.toFixed(3)),
          escapeCsv(line.id),
          escapeCsv(line.startDotId),
          escapeCsv(line.endDotId),
          escapeCsv(line.color),
        ];
        rows.push(row.join(','));
      });
    });
  });

  return rows.join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


