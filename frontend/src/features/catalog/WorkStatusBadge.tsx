import type { Catalog } from '../../shared/types';
import { ColorDot } from '../../shared/ui/ColorDot';

type WorkStatusBadgeProps = {
  status: Catalog | undefined;
  compact?: boolean;
};

export function WorkStatusBadge({ status, compact = false }: WorkStatusBadgeProps) {
  const color = status?.color || '#b4bfcb';

  return (
    <span className="status-badge">
      <svg className="status-badge-background" aria-hidden="true" width="100%" height="100%">
        <rect rx="9" className="status-badge-base" width="100%" height="100%" />
        <rect rx="9" width="100%" height="100%" fill={color} fillOpacity="0.12" />
        <rect
          rx="9"
          width="100%"
          height="100%"
          fill="none"
          stroke={color}
          strokeOpacity="0.35"
          strokeWidth="2"
        />
      </svg>
      {compact && <span className="sr-only">Рабочий статус: </span>}
      <ColorDot color={color} />
      {status?.name || 'Не задан'}
      {status?.archived ? ' (в архиве)' : ''}
    </span>
  );
}
