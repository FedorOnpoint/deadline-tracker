const OPEN_EYE = [
  38, 38, 38, 36.9, 38.9, 36, 40, 36, 41.1, 36, 42, 36.9, 42, 38, 42, 39.1, 41.1, 40, 40, 40, 38.9,
  40, 38, 39.1, 38, 38,
];
const CLOSED_EYE = [
  36.8, 38.4, 38.4, 36.4, 41.6, 36.4, 43.2, 38.4, 43.8, 39.1, 43, 39.9, 42.5, 39.2, 41, 37.8, 39,
  37.8, 37.5, 39.2, 37, 39.9, 36.2, 39.1, 36.8, 38.4,
];
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function smooth(value: number) {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
}
export function eyePath(progress: number) {
  const points = OPEN_EYE.map((value, i) => value + (CLOSED_EYE[i] - value) * progress);
  return (
    `M${points[0]} ${points[1]}` +
    [2, 8, 14, 20].map((i) => `C${points.slice(i, i + 6).join(' ')}`).join('') +
    'Z'
  );
}
export function steamPath(
  x: number,
  bottom: number,
  length: number,
  phase: number,
  amplitude: number,
) {
  const points = Array.from({ length: 9 }, (_, i) => {
    const progress = i / 8;
    return [x + Math.sin(progress * Math.PI * 2.1 - phase) * amplitude, bottom - progress * length];
  });
  let path = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const previous = points[Math.max(0, i - 1)];
    const start = points[i];
    const end = points[i + 1];
    const next = points[Math.min(points.length - 1, i + 2)];
    path += `C${start[0] + (end[0] - previous[0]) / 6} ${start[1] + (end[1] - previous[1]) / 6} ${end[0] - (next[0] - start[0]) / 6} ${end[1] - (next[1] - start[1]) / 6} ${end[0]} ${end[1]}`;
  }
  return path;
}
