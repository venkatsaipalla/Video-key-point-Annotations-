import { Dot, LineSegment } from '../types/annotation.ts';
import { generateUniqueId } from '../services/idHelperService.ts';

export interface SkeletonTemplate {
  id: string;
  name: string;
  description: string;
  dots: Array<{ id: string; x: number; y: number; label: string }>;
  lines: Array<{ startDotId: string; endDotId: string; label?: string }>;
}

export const SKELETON_TEMPLATES: SkeletonTemplate[] = [
  {
    id: 'human-pose',
    name: 'Human Pose',
    description: '17-point human body pose (COCO format)',
    dots: [
      { id: 'nose', x: 400, y: 100, label: 'Nose' },
      { id: 'left-eye', x: 390, y: 90, label: 'Left Eye' },
      { id: 'right-eye', x: 410, y: 90, label: 'Right Eye' },
      { id: 'left-ear', x: 380, y: 95, label: 'Left Ear' },
      { id: 'right-ear', x: 420, y: 95, label: 'Right Ear' },
      { id: 'left-shoulder', x: 350, y: 150, label: 'Left Shoulder' },
      { id: 'right-shoulder', x: 450, y: 150, label: 'Right Shoulder' },
      { id: 'left-elbow', x: 320, y: 200, label: 'Left Elbow' },
      { id: 'right-elbow', x: 480, y: 200, label: 'Right Elbow' },
      { id: 'left-wrist', x: 290, y: 250, label: 'Left Wrist' },
      { id: 'right-wrist', x: 510, y: 250, label: 'Right Wrist' },
      { id: 'left-hip', x: 370, y: 300, label: 'Left Hip' },
      { id: 'right-hip', x: 430, y: 300, label: 'Right Hip' },
      { id: 'left-knee', x: 360, y: 380, label: 'Left Knee' },
      { id: 'right-knee', x: 440, y: 380, label: 'Right Knee' },
      { id: 'left-ankle', x: 350, y: 450, label: 'Left Ankle' },
      { id: 'right-ankle', x: 450, y: 450, label: 'Right Ankle' }
    ],
    lines: [
      { startDotId: 'nose', endDotId: 'left-eye', label: 'Face' },
      { startDotId: 'nose', endDotId: 'right-eye', label: 'Face' },
      { startDotId: 'left-eye', endDotId: 'left-ear', label: 'Face' },
      { startDotId: 'right-eye', endDotId: 'right-ear', label: 'Face' },
      { startDotId: 'nose', endDotId: 'left-shoulder', label: 'Torso' },
      { startDotId: 'nose', endDotId: 'right-shoulder', label: 'Torso' },
      { startDotId: 'left-shoulder', endDotId: 'right-shoulder', label: 'Torso' },
      { startDotId: 'left-shoulder', endDotId: 'left-elbow', label: 'Left Arm' },
      { startDotId: 'left-elbow', endDotId: 'left-wrist', label: 'Left Arm' },
      { startDotId: 'right-shoulder', endDotId: 'right-elbow', label: 'Right Arm' },
      { startDotId: 'right-elbow', endDotId: 'right-wrist', label: 'Right Arm' },
      { startDotId: 'left-shoulder', endDotId: 'left-hip', label: 'Torso' },
      { startDotId: 'right-shoulder', endDotId: 'right-hip', label: 'Torso' },
      { startDotId: 'left-hip', endDotId: 'right-hip', label: 'Torso' },
      { startDotId: 'left-hip', endDotId: 'left-knee', label: 'Left Leg' },
      { startDotId: 'left-knee', endDotId: 'left-ankle', label: 'Left Leg' },
      { startDotId: 'right-hip', endDotId: 'right-knee', label: 'Right Leg' },
      { startDotId: 'right-knee', endDotId: 'right-ankle', label: 'Right Leg' }
    ]
  },
  {
    id: 'hand-pose',
    name: 'Hand Pose',
    description: '21-point hand keypoints',
    dots: [
      { id: 'wrist', x: 400, y: 300, label: 'Wrist' },
      { id: 'thumb-cmc', x: 420, y: 320, label: 'Thumb CMC' },
      { id: 'thumb-mcp', x: 440, y: 340, label: 'Thumb MCP' },
      { id: 'thumb-ip', x: 460, y: 360, label: 'Thumb IP' },
      { id: 'thumb-tip', x: 480, y: 380, label: 'Thumb Tip' },
      { id: 'index-mcp', x: 380, y: 320, label: 'Index MCP' },
      { id: 'index-pip', x: 360, y: 340, label: 'Index PIP' },
      { id: 'index-dip', x: 340, y: 360, label: 'Index DIP' },
      { id: 'index-tip', x: 320, y: 380, label: 'Index Tip' },
      { id: 'middle-mcp', x: 400, y: 320, label: 'Middle MCP' },
      { id: 'middle-pip', x: 400, y: 340, label: 'Middle PIP' },
      { id: 'middle-dip', x: 400, y: 360, label: 'Middle DIP' },
      { id: 'middle-tip', x: 400, y: 380, label: 'Middle Tip' },
      { id: 'ring-mcp', x: 420, y: 320, label: 'Ring MCP' },
      { id: 'ring-pip', x: 440, y: 340, label: 'Ring PIP' },
      { id: 'ring-dip', x: 460, y: 360, label: 'Ring DIP' },
      { id: 'ring-tip', x: 480, y: 380, label: 'Ring Tip' },
      { id: 'pinky-mcp', x: 440, y: 320, label: 'Pinky MCP' },
      { id: 'pinky-pip', x: 460, y: 340, label: 'Pinky PIP' },
      { id: 'pinky-dip', x: 480, y: 360, label: 'Pinky DIP' },
      { id: 'pinky-tip', x: 500, y: 380, label: 'Pinky Tip' }
    ],
    lines: [
      { startDotId: 'wrist', endDotId: 'thumb-cmc', label: 'Thumb' },
      { startDotId: 'thumb-cmc', endDotId: 'thumb-mcp', label: 'Thumb' },
      { startDotId: 'thumb-mcp', endDotId: 'thumb-ip', label: 'Thumb' },
      { startDotId: 'thumb-ip', endDotId: 'thumb-tip', label: 'Thumb' },
      { startDotId: 'wrist', endDotId: 'index-mcp', label: 'Index' },
      { startDotId: 'index-mcp', endDotId: 'index-pip', label: 'Index' },
      { startDotId: 'index-pip', endDotId: 'index-dip', label: 'Index' },
      { startDotId: 'index-dip', endDotId: 'index-tip', label: 'Index' },
      { startDotId: 'wrist', endDotId: 'middle-mcp', label: 'Middle' },
      { startDotId: 'middle-mcp', endDotId: 'middle-pip', label: 'Middle' },
      { startDotId: 'middle-pip', endDotId: 'middle-dip', label: 'Middle' },
      { startDotId: 'middle-dip', endDotId: 'middle-tip', label: 'Middle' },
      { startDotId: 'wrist', endDotId: 'ring-mcp', label: 'Ring' },
      { startDotId: 'ring-mcp', endDotId: 'ring-pip', label: 'Ring' },
      { startDotId: 'ring-pip', endDotId: 'ring-dip', label: 'Ring' },
      { startDotId: 'ring-dip', endDotId: 'ring-tip', label: 'Ring' },
      { startDotId: 'wrist', endDotId: 'pinky-mcp', label: 'Pinky' },
      { startDotId: 'pinky-mcp', endDotId: 'pinky-pip', label: 'Pinky' },
      { startDotId: 'pinky-pip', endDotId: 'pinky-dip', label: 'Pinky' },
      { startDotId: 'pinky-dip', endDotId: 'pinky-tip', label: 'Pinky' }
    ]
  },
  {
    id: 'face-landmarks',
    name: 'Face Landmarks',
    description: 'Basic facial keypoints',
    dots: [
      { id: 'nose-tip', x: 400, y: 200, label: 'Nose Tip' },
      { id: 'left-eye-inner', x: 380, y: 180, label: 'Left Eye Inner' },
      { id: 'left-eye-outer', x: 360, y: 180, label: 'Left Eye Outer' },
      { id: 'right-eye-inner', x: 420, y: 180, label: 'Right Eye Inner' },
      { id: 'right-eye-outer', x: 440, y: 180, label: 'Right Eye Outer' },
      { id: 'left-mouth', x: 370, y: 220, label: 'Left Mouth' },
      { id: 'right-mouth', x: 430, y: 220, label: 'Right Mouth' },
      { id: 'chin', x: 400, y: 240, label: 'Chin' }
    ],
    lines: [
      { startDotId: 'left-eye-inner', endDotId: 'left-eye-outer', label: 'Left Eye' },
      { startDotId: 'right-eye-inner', endDotId: 'right-eye-outer', label: 'Right Eye' },
      { startDotId: 'left-mouth', endDotId: 'right-mouth', label: 'Mouth' },
      { startDotId: 'nose-tip', endDotId: 'chin', label: 'Face Center' }
    ]
  }
];

export function applySkeletonTemplate(template: SkeletonTemplate, centerX: number = 400, centerY: number = 300): { dots: Dot[], lines: LineSegment[] } {
  // Calculate offset to center the template
  const templateCenterX = template.dots.reduce((sum, dot) => sum + dot.x, 0) / template.dots.length;
  const templateCenterY = template.dots.reduce((sum, dot) => sum + dot.y, 0) / template.dots.length;
  const offsetX = centerX - templateCenterX;
  const offsetY = centerY - templateCenterY;

  // Create dots with unique IDs and adjusted positions
  const dots: Dot[] = template.dots.map(dot => ({
    id: generateUniqueId(),
    x: dot.x + offsetX,
    y: dot.y + offsetY,
    color: 'red'
  }));

  // Create lines with references to the new dot IDs
  const dotIdMap = new Map(template.dots.map((dot, index) => [dot.id, dots[index].id]));
  const lines: LineSegment[] = template.lines.map(line => ({
    id: generateUniqueId(),
    startDotId: dotIdMap.get(line.startDotId) || '',
    endDotId: dotIdMap.get(line.endDotId) || '',
    color: '#000000'
  }));

  return { dots, lines };
}
