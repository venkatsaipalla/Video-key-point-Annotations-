//@ts-nocheck
import * as ort from 'onnxruntime-web';
import { EdgeDetectionOptions, detectEdges, extractVideoFrame } from './edgeDetection.ts';
import { Dot, LineSegment } from '../types/annotation.ts';

export interface YoloBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  classId: number;
  className?: string;
}

export interface YoloOptions {
  modelUrl?: string; // Path in public/, e.g. '/yolov5s.onnx'
  inputSize?: number; // 640 by default
  confThreshold?: number; // e.g. 0.25
  iouThreshold?: number; // e.g. 0.45
  maxDetections?: number; // e.g. 5
  classFilter?: Array<number | string>; // e.g. ['person'] or [0]
}

const DEFAULT_YOLO_OPTIONS: Required<YoloOptions> = {
  modelUrl: '/yolov5s.onnx',
  inputSize: 640,
  confThreshold: 0.25,
  iouThreshold: 0.45,
  maxDetections: 5,
  classFilter: ['person'],
};

// COCO class names for YOLOv5
const COCO_CLASS_NAMES = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'
];

let cachedSessionPromise: Promise<ort.InferenceSession> | null = null;

async function getSession(modelUrl: string): Promise<ort.InferenceSession> {
  if (!cachedSessionPromise) {
    const opts: ort.InferenceSession.SessionOptions = {
      executionProviders: ['wasm'], // 'webgl' can be tried if enabled in env
    } as any;
    cachedSessionPromise = ort.InferenceSession.create(modelUrl, opts);
  }
  return cachedSessionPromise;
}

function letterboxToSquare(
  sourceCanvas: HTMLCanvasElement,
  inputSize: number
): { canvas: HTMLCanvasElement; scale: number; padX: number; padY: number } {
  const iw = sourceCanvas.width;
  const ih = sourceCanvas.height;
  const scale = Math.min(inputSize / iw, inputSize / ih);
  const nw = Math.round(iw * scale);
  const nh = Math.round(ih * scale);
  const padX = Math.floor((inputSize - nw) / 2);
  const padY = Math.floor((inputSize - nh) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = inputSize;
  canvas.height = inputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, scale, padX, padY };
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, inputSize, inputSize);
  ctx.drawImage(sourceCanvas, 0, 0, iw, ih, padX, padY, nw, nh);
  return { canvas, scale, padX, padY };
}

function canvasToTensor(
  canvas: HTMLCanvasElement,
  inputSize: number
): ort.Tensor {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, inputSize, inputSize);
  const floatData = new Float32Array(inputSize * inputSize * 3);
  let di = 0;
  // Convert RGBA -> RGB, CHW layout, normalized 0..1
  // We write channel-wise
  const area = inputSize * inputSize;
  const rOff = 0;
  const gOff = area;
  const bOff = area * 2;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const pix = di++;
    floatData[rOff + pix] = r;
    floatData[gOff + pix] = g;
    floatData[bOff + pix] = b;
  }
  return new ort.Tensor('float32', floatData, [1, 3, inputSize, inputSize]);
}

function iou(a: number[], b: number[]): number {
  const ax1 = a[0], ay1 = a[1], ax2 = a[2], ay2 = a[3];
  const bx1 = b[0], by1 = b[1], bx2 = b[2], by2 = b[3];
  const interX1 = Math.max(ax1, bx1);
  const interY1 = Math.max(ay1, by1);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);
  const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
  const aArea = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const bArea = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  const union = aArea + bArea - interArea + 1e-6;
  return interArea / union;
}

function nonMaxSuppression(
  boxes: number[][],
  scores: number[],
  iouThreshold: number,
  maxDet: number
): number[] {
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const keep: number[] = [];
  for (const i of order) {
    let suppr = false;
    for (const j of keep) {
      if (iou(boxes[i], boxes[j]) > iouThreshold) {
        suppr = true;
        break;
      }
    }
    if (!suppr) {
      keep.push(i);
      if (keep.length >= maxDet) break;
    }
  }
  return keep;
}

function mapToDisplay(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  scale: number,
  padX: number,
  padY: number,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number; width: number; height: number } {
  // Remove padding and scale back to display coordinates
  const nx1 = (x1 - padX) / scale;
  const ny1 = (y1 - padY) / scale;
  const nx2 = (x2 - padX) / scale;
  const ny2 = (y2 - padY) / scale;
  const x = Math.max(0, Math.min(displayWidth - 1, nx1));
  const y = Math.max(0, Math.min(displayHeight - 1, ny1));
  const w = Math.max(0, Math.min(displayWidth - x, nx2 - nx1));
  const h = Math.max(0, Math.min(displayHeight - y, ny2 - ny1));
  return { x, y, width: w, height: h };
}

async function yoloDetect(
  videoElement: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  options: Required<YoloOptions>
): Promise<YoloBox[]> {
  // Draw current frame at display size
  const frame = extractVideoFrame(videoElement, displayWidth, displayHeight);
  if (!frame) return [];

  const canvas = document.createElement('canvas');
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  // Put ImageData onto canvas
  ctx.putImageData(frame, 0, 0);

  // Letterbox to model input size
  const { canvas: inputCanvas, scale, padX, padY } = letterboxToSquare(canvas, options.inputSize);
  const inputTensor = canvasToTensor(inputCanvas, options.inputSize);

  const session = await getSession(options.modelUrl);
  const inputName = session.inputNames[0];
  const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
  const outputs = await session.run(feeds);
  const outputName = session.outputNames[0];
  const out = outputs[outputName];
  const data = out.data as Float32Array;
  const dims = out.dims; // [1, N, 85]
  const num = dims[1];
  const stride = dims[2];

  const boxes: number[][] = [];
  const scores: number[] = [];
  const classIds: number[] = [];

  for (let i = 0; i < num; i++) {
    const off = i * stride;
    const cx = data[off + 0];
    const cy = data[off + 1];
    const w = data[off + 2];
    const h = data[off + 3];
    const obj = data[off + 4];
    // class confidences
    let best = -1;
    let bestScore = 0;
    for (let c = 5; c < stride; c++) {
      const sc = data[off + c];
      if (sc > bestScore) {
        bestScore = sc;
        best = c - 5;
      }
    }
    const conf = obj * bestScore;
    if (conf < options.confThreshold) continue;

    // Optional class filter
    if (options.classFilter && options.classFilter.length > 0) {
      const allowed = options.classFilter.some((f) =>
        typeof f === 'string' ? COCO_CLASS_NAMES[best] === f : best === f
      );
      if (!allowed) continue;
    }

    const x1 = cx - w / 2;
    const y1 = cy - h / 2;
    const x2 = cx + w / 2;
    const y2 = cy + h / 2;
    boxes.push([x1, y1, x2, y2]);
    scores.push(conf);
    classIds.push(best);
  }

  if (boxes.length === 0) return [];

  const keep = nonMaxSuppression(boxes, scores, options.iouThreshold, options.maxDetections);
  const results: YoloBox[] = keep.map((k) => {
    const mapped = mapToDisplay(
      boxes[k][0],
      boxes[k][1],
      boxes[k][2],
      boxes[k][3],
      scale,
      padX,
      padY,
      displayWidth,
      displayHeight
    );
    return {
      ...mapped,
      score: scores[k],
      classId: classIds[k],
      className: COCO_CLASS_NAMES[classIds[k]]
    };
  });

  // Prefer boxes closer to center (main subject) by sorting
  const cx = displayWidth / 2;
  const cy = displayHeight / 2;
  results.sort((a, b) => {
    const da = Math.hypot(a.x + a.width / 2 - cx, a.y + a.height / 2 - cy);
    const db = Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy);
    return da - db;
  });

  return results;
}

export async function detectEdgesWithYolo(
  videoElement: HTMLVideoElement,
  edgeOptions: EdgeDetectionOptions,
  displayWidth: number = 800,
  displayHeight: number = 450,
  yoloOptions?: YoloOptions
): Promise<{ dots: Dot[]; lines: LineSegment[]; boxes: YoloBox[] }> {
  const opts: Required<YoloOptions> = { ...DEFAULT_YOLO_OPTIONS, ...(yoloOptions || {}) } as any;
  const boxes = await yoloDetect(videoElement, displayWidth, displayHeight, opts);
  if (boxes.length === 0) {
    return { dots: [], lines: [], boxes: [] };
  }

  // Run our existing edge detector inside the top-K boxes and merge results
  const maxBoxes = Math.min(opts.maxDetections, boxes.length);
  const allDots: Dot[] = [];
  const allLines: LineSegment[] = [];

  for (let i = 0; i < maxBoxes; i++) {
    const box = boxes[i];
    const { dots, lines } = await detectEdges(
      videoElement,
      edgeOptions,
      displayWidth,
      displayHeight,
      { x: box.x, y: box.y, width: box.width, height: box.height }
    );
    allDots.push(...dots);
    allLines.push(...lines);
  }

  return { dots: allDots, lines: allLines, boxes };
}


