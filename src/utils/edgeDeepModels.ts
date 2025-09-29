//@ts-nocheck
import * as ort from 'onnxruntime-web';

export type EdgeDLModel = 'hed' | 'dexined' | 'rindnet';

type SessionCache = { [k in EdgeDLModel]?: Promise<ort.InferenceSession> };
const cache: SessionCache = {};

const MODEL_PATHS: Record<EdgeDLModel, string> = {
  hed: '/hed.onnx',
  dexined: '/dexined.onnx',
  rindnet: '/rindnet.onnx',
};

async function getSession(model: EdgeDLModel): Promise<ort.InferenceSession> {
  if (!cache[model]) {
    cache[model] = ort.InferenceSession.create(MODEL_PATHS[model], { executionProviders: ['wasm'] } as any);
  }
  return cache[model]!;
}

function letterboxToSquareCanvas(frame: ImageData, targetSize: number): { canvas: HTMLCanvasElement; scale: number; padX: number; padY: number } {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = frame.width;
  srcCanvas.height = frame.height;
  const sctx = srcCanvas.getContext('2d')!;
  sctx.putImageData(frame, 0, 0);

  const iw = srcCanvas.width;
  const ih = srcCanvas.height;
  const scale = Math.min(targetSize / iw, targetSize / ih);
  const nw = Math.round(iw * scale);
  const nh = Math.round(ih * scale);
  const padX = Math.floor((targetSize - nw) / 2);
  const padY = Math.floor((targetSize - nh) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(srcCanvas, 0, 0, iw, ih, padX, padY, nw, nh);
  return { canvas, scale, padX, padY };
}

function canvasToCHWFloat(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const area = width * height;
  const out = new Float32Array(area * 3);
  const rOff = 0, gOff = area, bOff = area * 2;
  let pix = 0;
  for (let i = 0; i < data.length; i += 4) {
    out[rOff + pix] = data[i] / 255;
    out[gOff + pix] = data[i + 1] / 255;
    out[bOff + pix] = data[i + 2] / 255;
    pix++;
  }
  return out;
}

function thresholdToBooleanMap(prob: Float32Array, width: number, height: number, thr: number): boolean[] {
  const edges = new Array(width * height).fill(false);
  for (let i = 0; i < prob.length; i++) {
    edges[i] = prob[i] >= thr;
  }
  return edges;
}

export async function runEdgeModel(
  videoElement: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  model: EdgeDLModel,
  probThreshold: number,
  inputSize: number,
  boundingBox?: { x: number; y: number; width: number; height: number }
): Promise<{ edges: boolean[]; width: number; height: number } | null> {
  const canvas = document.createElement('canvas');
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoElement, 0, 0, displayWidth, displayHeight);

  // Crop if needed
  let frame: ImageData;
  if (boundingBox) {
    frame = ctx.getImageData(
      Math.max(0, Math.floor(boundingBox.x)),
      Math.max(0, Math.floor(boundingBox.y)),
      Math.max(1, Math.floor(boundingBox.width)),
      Math.max(1, Math.floor(boundingBox.height))
    );
  } else {
    frame = ctx.getImageData(0, 0, displayWidth, displayHeight);
  }

  const { canvas: inputCanvas, scale, padX, padY } = letterboxToSquareCanvas(frame, inputSize);
  const input = new ort.Tensor('float32', canvasToCHWFloat(inputCanvas), [1, 3, inputSize, inputSize]);

  const session = await getSession(model);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: input };
  const outputs = await session.run(feeds);
  const outTensor = outputs[session.outputNames[0]] as ort.Tensor;
  const dims = outTensor.dims;
  const outH = dims[dims.length - 2];
  const outW = dims[dims.length - 1];
  const data = outTensor.data as Float32Array;

  // Flatten to HxW probability map (use first channel)
  const prob = new Float32Array(outH * outW);
  const copyLen = Math.min(prob.length, data.length);
  for (let i = 0; i < copyLen; i++) prob[i] = data[i];

  // Map back from letterboxed SxS to original frame (crop or full)
  const targetW = frame.width;
  const targetH = frame.height;
  const edges = new Array(targetW * targetH).fill(false);

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const lx = padX + x * scale; // letterboxed X
      const ly = padY + y * scale; // letterboxed Y
      if (lx < 0 || lx >= inputSize || ly < 0 || ly >= inputSize) continue;
      const gx = Math.max(0, Math.min(outW - 1, Math.round((lx / inputSize) * (outW - 1))));
      const gy = Math.max(0, Math.min(outH - 1, Math.round((ly / inputSize) * (outH - 1))));
      const p = prob[gy * outW + gx];
      if (p >= probThreshold) {
        edges[y * targetW + x] = true;
      }
    }
  }

  return { edges, width: targetW, height: targetH };
}


