export function secondsToFrame(playedSeconds: number, fps: number): number {
  return Math.round(playedSeconds * fps);
}

export function frameToSeconds(frame: number, fps: number): number {
  return frame / fps;
}

export function formatClock(timeSeconds: number): string {
  const minutes = Math.floor(timeSeconds / 60);
  const seconds = Math.floor(timeSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

