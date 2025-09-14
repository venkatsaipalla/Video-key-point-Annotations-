import { Dot, LineSegment } from '../types/annotation.ts';
import { generateUniqueId } from '../services/idHelperService.ts';

export interface EdgeDetectionOptions {
  threshold: number; // Edge detection sensitivity (0-255)
  blurRadius: number; // Gaussian blur radius for noise reduction
  minEdgeLength: number; // Minimum edge length to consider
  maxKeypoints: number; // Maximum number of keypoints to generate
  simplifyTolerance: number; // Tolerance for edge simplification
}

export const DEFAULT_EDGE_OPTIONS: EdgeDetectionOptions = {
  threshold: 30, // Lower threshold for better edge detection
  blurRadius: 2, // Slightly more blur to reduce noise
  minEdgeLength: 15, // Shorter minimum length for more detail
  maxKeypoints: 100, // More keypoints for better body detection
  simplifyTolerance: 3 // Slightly higher tolerance for cleaner lines
};

export interface EdgePoint {
  x: number;
  y: number;
  magnitude: number;
}

export interface EdgeSegment {
  points: EdgePoint[];
  length: number;
}

/**
 * Extract video frame as ImageData for processing
 */
export function extractVideoFrame(videoElement: HTMLVideoElement, displayWidth: number = 800, displayHeight: number = 450): ImageData | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Use display dimensions instead of video dimensions for coordinate mapping
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    // Draw video scaled to display size
    ctx.drawImage(videoElement, 0, 0, displayWidth, displayHeight);
    return ctx.getImageData(0, 0, displayWidth, displayHeight);
  } catch (error) {
    console.error('Error extracting video frame:', error);
    return null;
  }
}

/**
 * Convert RGB to grayscale
 */
function rgbToGrayscale(imageData: ImageData): number[] {
  const data = imageData.data;
  const grayscale = new Array(data.length / 4);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    grayscale[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  
  return grayscale;
}

/**
 * Apply Gaussian blur to reduce noise
 */
function applyGaussianBlur(grayscale: number[], width: number, height: number, radius: number): number[] {
  const blurred = new Array(grayscale.length);
  const sigma = radius / 3;
  const kernelSize = Math.ceil(radius * 2) + 1;
  const kernel: number[] = [];
  
  // Generate Gaussian kernel
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - Math.floor(kernelSize / 2);
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = value;
    sum += value;
  }
  
  // Normalize kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }
  
  // Apply horizontal blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const kx = x + k - Math.floor(kernelSize / 2);
        if (kx >= 0 && kx < width) {
          value += grayscale[y * width + kx] * kernel[k];
        }
      }
      blurred[y * width + x] = value;
    }
  }
  
  // Apply vertical blur
  const result = new Array(grayscale.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const ky = y + k - Math.floor(kernelSize / 2);
        if (ky >= 0 && ky < height) {
          value += blurred[ky * width + x] * kernel[k];
        }
      }
      result[y * width + x] = value;
    }
  }
  
  return result;
}

/**
 * Calculate gradient magnitude using Sobel operator
 */
function calculateGradient(blurred: number[], width: number, height: number): { magnitude: number[], direction: number[] } {
  const magnitude = new Array(blurred.length);
  const direction = new Array(blurred.length);
  
  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += blurred[idx] * sobelX[kernelIdx];
          gy += blurred[idx] * sobelY[kernelIdx];
        }
      }
      
      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }
  
  return { magnitude, direction };
}

/**
 * Non-maximum suppression to thin edges
 */
function nonMaximumSuppression(magnitude: number[], direction: number[], width: number, height: number): number[] {
  const suppressed = new Array(magnitude.length);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const mag = magnitude[idx];
      const dir = direction[idx];
      
      // Determine neighboring pixels based on gradient direction
      let neighbor1 = 0, neighbor2 = 0;
      
      if ((dir >= -Math.PI/8 && dir < Math.PI/8) || (dir >= 7*Math.PI/8 || dir < -7*Math.PI/8)) {
        // Horizontal
        neighbor1 = magnitude[idx - 1];
        neighbor2 = magnitude[idx + 1];
      } else if ((dir >= Math.PI/8 && dir < 3*Math.PI/8) || (dir >= -7*Math.PI/8 && dir < -5*Math.PI/8)) {
        // Diagonal 1
        neighbor1 = magnitude[(y-1) * width + (x+1)];
        neighbor2 = magnitude[(y+1) * width + (x-1)];
      } else if ((dir >= 3*Math.PI/8 && dir < 5*Math.PI/8) || (dir >= -5*Math.PI/8 && dir < -3*Math.PI/8)) {
        // Vertical
        neighbor1 = magnitude[(y-1) * width + x];
        neighbor2 = magnitude[(y+1) * width + x];
      } else {
        // Diagonal 2
        neighbor1 = magnitude[(y-1) * width + (x-1)];
        neighbor2 = magnitude[(y+1) * width + (x+1)];
      }
      
      suppressed[idx] = (mag >= neighbor1 && mag >= neighbor2) ? mag : 0;
    }
  }
  
  return suppressed;
}

/**
 * Hysteresis thresholding to connect edge segments
 */
function hysteresisThresholding(suppressed: number[], width: number, height: number, lowThreshold: number, highThreshold: number): boolean[] {
  const edges = new Array(suppressed.length).fill(false);
  const visited = new Array(suppressed.length).fill(false);
  
  // First pass: mark strong edges
  for (let i = 0; i < suppressed.length; i++) {
    if (suppressed[i] >= highThreshold) {
      edges[i] = true;
    }
  }
  
  // Second pass: connect weak edges to strong edges
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (edges[idx] && !visited[idx]) {
        connectEdges(edges, visited, suppressed, width, height, x, y, lowThreshold);
      }
    }
  }
  
  return edges;
}

/**
 * Recursively connect edge pixels
 */
function connectEdges(edges: boolean[], visited: boolean[], suppressed: number[], width: number, height: number, x: number, y: number, lowThreshold: number): void {
  const idx = y * width + x;
  if (visited[idx] || x < 0 || x >= width || y < 0 || y >= height) return;
  
  visited[idx] = true;
  
  if (suppressed[idx] >= lowThreshold) {
    edges[idx] = true;
    
    // Check 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        connectEdges(edges, visited, suppressed, width, height, x + dx, y + dy, lowThreshold);
      }
    }
  }
}

/**
 * Extract edge segments from binary edge map
 */
function extractEdgeSegments(edges: boolean[], width: number, height: number, minLength: number): EdgeSegment[] {
  const visited = new Array(edges.length).fill(false);
  const segments: EdgeSegment[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] && !visited[idx]) {
        const segment = traceEdgeSegment(edges, visited, width, height, x, y);
        if (segment.length >= minLength) {
          segments.push(segment);
        }
      }
    }
  }
  
  return segments;
}

/**
 * Trace a continuous edge segment
 */
function traceEdgeSegment(edges: boolean[], visited: boolean[], width: number, height: number, startX: number, startY: number): EdgeSegment {
  const points: EdgePoint[] = [];
  const stack: {x: number, y: number}[] = [{x: startX, y: startY}];
  
  while (stack.length > 0) {
    const {x, y} = stack.pop()!;
    const idx = y * width + x;
    
    if (visited[idx] || x < 0 || x >= width || y < 0 || y >= height || !edges[idx]) {
      continue;
    }
    
    visited[idx] = true;
    points.push({ x, y, magnitude: 1 }); // Simplified magnitude
    
    // Add 8-connected neighbors to stack
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        const nidx = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && edges[nidx] && !visited[nidx]) {
          stack.push({x: nx, y: ny});
        }
      }
    }
  }
  
  return {
    points,
    length: points.length
  };
}

/**
 * Simplify edge segments using Douglas-Peucker algorithm
 */
function simplifyEdgeSegment(segment: EdgeSegment, tolerance: number): EdgePoint[] {
  if (segment.points.length <= 2) return segment.points;
  
  const simplified: EdgePoint[] = [];
  
  function douglasPeucker(points: EdgePoint[], start: number, end: number): void {
    if (end - start <= 1) return;
    
    let maxDist = 0;
    let maxIndex = start;
    
    const startPoint = points[start];
    const endPoint = points[end];
    
    for (let i = start + 1; i < end; i++) {
      const dist = pointToLineDistance(points[i], startPoint, endPoint);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    
    if (maxDist > tolerance) {
      douglasPeucker(points, start, maxIndex);
      simplified.push(points[maxIndex]);
      douglasPeucker(points, maxIndex, end);
    }
  }
  
  simplified.push(segment.points[0]);
  douglasPeucker(segment.points, 0, segment.points.length - 1);
  simplified.push(segment.points[segment.points.length - 1]);
  
  return simplified;
}

/**
 * Calculate distance from point to line
 */
function pointToLineDistance(point: EdgePoint, lineStart: EdgePoint, lineEnd: EdgePoint): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B);
  
  const param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Filter edge segments to focus on main subject (center-weighted)
 */
function filterMainSubjectSegments(segments: EdgeSegment[], width: number, height: number): EdgeSegment[] {
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Calculate distance from center for each segment and sort by proximity
  const segmentsWithDistance = segments.map(segment => {
    const avgX = segment.points.reduce((sum, p) => sum + p.x, 0) / segment.points.length;
    const avgY = segment.points.reduce((sum, p) => sum + p.y, 0) / segment.points.length;
    const distanceFromCenter = Math.sqrt((avgX - centerX) ** 2 + (avgY - centerY) ** 2);
    return { segment, distanceFromCenter };
  });
  
  // Sort by distance from center (closer segments first)
  segmentsWithDistance.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);
  
  // Take the closest 70% of segments to focus on main subject
  const filteredCount = Math.max(1, Math.floor(segmentsWithDistance.length * 0.7));
  return segmentsWithDistance.slice(0, filteredCount).map(item => item.segment);
}

/**
 * Convert edge segments to keypoints and lines
 */
function edgeSegmentsToAnnotations(segments: EdgeSegment[], maxKeypoints: number, width: number, height: number): { dots: Dot[], lines: LineSegment[] } {
  const dots: Dot[] = [];
  const lines: LineSegment[] = [];
  const dotMap = new Map<string, string>(); // Map position to dot ID
  
  // Filter segments to focus on main subject
  const filteredSegments = filterMainSubjectSegments(segments, width, height);
  
  // Limit number of segments to process
  const limitedSegments = filteredSegments.slice(0, Math.min(filteredSegments.length, maxKeypoints / 5));
  
  for (const segment of limitedSegments) {
    const simplifiedPoints = simplifyEdgeSegment(segment, 2);
    
    for (let i = 0; i < simplifiedPoints.length; i++) {
      const point = simplifiedPoints[i];
      const key = `${Math.round(point.x)},${Math.round(point.y)}`;
      
      if (!dotMap.has(key)) {
        const dotId = generateUniqueId();
        dots.push({
          id: dotId,
          x: point.x,
          y: point.y,
          color: 'blue' // Auto-detected edges in blue
        });
        dotMap.set(key, dotId);
      }
      
      // Connect consecutive points in the segment
      if (i > 0) {
        const prevPoint = simplifiedPoints[i - 1];
        const prevKey = `${Math.round(prevPoint.x)},${Math.round(prevPoint.y)}`;
        const currentKey = key;
        
        const startDotId = dotMap.get(prevKey);
        const endDotId = dotMap.get(currentKey);
        
        if (startDotId && endDotId) {
          lines.push({
            id: generateUniqueId(),
            startDotId,
            endDotId,
            color: '#0066cc' // Auto-detected lines in blue
          });
        }
      }
    }
  }
  
  return { dots, lines };
}

/**
 * Main edge detection function
 */
export function detectEdges(
  videoElement: HTMLVideoElement, 
  options: EdgeDetectionOptions = DEFAULT_EDGE_OPTIONS, 
  displayWidth: number = 800, 
  displayHeight: number = 450,
  boundingBox?: {x: number, y: number, width: number, height: number}
): { dots: Dot[], lines: LineSegment[] } {
  const imageData = extractVideoFrame(videoElement, displayWidth, displayHeight);
  if (!imageData) {
    console.error('Failed to extract video frame');
    return { dots: [], lines: [] };
  }
  
  let { width, height } = imageData;
  let grayscale = rgbToGrayscale(imageData);
  
  // If bounding box is provided, crop the image
  if (boundingBox) {
    const { x, y, w, h } = {
      x: Math.max(0, Math.floor(boundingBox.x)),
      y: Math.max(0, Math.floor(boundingBox.y)),
      w: Math.min(width - Math.floor(boundingBox.x), Math.floor(boundingBox.width)),
      h: Math.min(height - Math.floor(boundingBox.y), Math.floor(boundingBox.height))
    };
    
    // Crop the grayscale array
    const croppedGrayscale = [];
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        croppedGrayscale.push(grayscale[row * width + col]);
      }
    }
    
    grayscale = croppedGrayscale;
    width = w;
    height = h;
  }
  
  // Apply Gaussian blur
  const blurred = applyGaussianBlur(grayscale, width, height, options.blurRadius);
  
  // Calculate gradient
  const { magnitude, direction } = calculateGradient(blurred, width, height);
  
  // Non-maximum suppression
  const suppressed = nonMaximumSuppression(magnitude, direction, width, height);
  
  // Hysteresis thresholding
  const lowThreshold = options.threshold * 0.5;
  const highThreshold = options.threshold;
  const edges = hysteresisThresholding(suppressed, width, height, lowThreshold, highThreshold);
  
  // Extract edge segments
  const segments = extractEdgeSegments(edges, width, height, options.minEdgeLength);
  
  // Convert to annotations
  const result = edgeSegmentsToAnnotations(segments, options.maxKeypoints, width, height);
  
  // Adjust coordinates if bounding box was used
  if (boundingBox) {
    result.dots = result.dots.map(dot => ({
      ...dot,
      x: dot.x + boundingBox.x,
      y: dot.y + boundingBox.y
    }));
  }
  
  return result;
}
