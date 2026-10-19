export function ColorDot({ color }: { color: string }) {
  return (
    <svg className="color-dot" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}
