import type { Catalog } from '../../shared/types';

type WorkStatusBadgeProps = {
  status: Catalog | undefined;
  compact?: boolean;
  selection?: {
    statuses: Catalog[];
    disabled: boolean;
    label: string;
    onChange: (id: number | null) => void;
  };
};

function textColor(background: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function WorkStatusBadge({ status, compact = false, selection }: WorkStatusBadgeProps) {
  const color = status?.color || '#b4bfcb';
  const style = { backgroundColor: color, color: textColor(color) };
  if (selection)
    return (
      <select
        className="status-badge status-picker"
        style={style}
        disabled={selection.disabled}
        value={status?.id ?? ''}
        aria-label={selection.label}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) =>
          selection.onChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">Не задан</option>
        {selection.statuses.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
            {entry.archived ? ' (в архиве)' : ''}
          </option>
        ))}
      </select>
    );
  return (
    <span className="status-badge" style={style}>
      {compact && <span className="sr-only">Рабочий статус: </span>}
      {status?.name || 'Не задан'}
      {status?.archived ? ' (в архиве)' : ''}
    </span>
  );
}
