import { Annotation } from '../types/annotation.ts';

export interface HistoryState {
  annotations: Annotation[];
  timestamp: number;
  action: string;
}

export class UndoRedoManager {
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  constructor(initialAnnotations: Annotation[] = []) {
    this.saveState(initialAnnotations, 'Initial state');
  }

  saveState(annotations: Annotation[], action: string): void {
    // Remove any states after current index (when we're not at the end)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new state
    const newState: HistoryState = {
      annotations: JSON.parse(JSON.stringify(annotations)), // Deep clone
      timestamp: Date.now(),
      action
    };

    this.history.push(newState);
    this.currentIndex = this.history.length - 1;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo(): Annotation[] | null {
    if (this.canUndo()) {
      this.currentIndex--;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].annotations));
    }
    return null;
  }

  redo(): Annotation[] | null {
    if (this.canRedo()) {
      this.currentIndex++;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].annotations));
    }
    return null;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getCurrentState(): Annotation[] {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].annotations));
    }
    return [];
  }

  getHistoryInfo(): { canUndo: boolean; canRedo: boolean; currentAction: string; totalStates: number } {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      currentAction: this.currentIndex >= 0 ? this.history[this.currentIndex].action : 'Initial state',
      totalStates: this.history.length
    };
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  reset(annotations: Annotation[]): void {
    this.clear();
    this.saveState(annotations, 'Reset');
  }
}
