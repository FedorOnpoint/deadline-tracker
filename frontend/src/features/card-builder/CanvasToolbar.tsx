import type { CardField } from '../../shared/types';
import {
  CANVAS_GAP,
  CANVAS_ROW,
  adjacentRow,
  defaultFieldSize,
  extraFieldHeight,
  placeField,
  positionFields,
} from './layout';

export function CanvasToolbar({
  fields,
  selected,
  onChange,
  busy,
}: {
  fields: CardField[];
  selected: string | null;
  onChange: (fields: CardField[]) => void;
  busy: boolean;
}) {
  const field = [...positionFields(fields, 'summary'), ...positionFields(fields, 'details')].find(
    (field) => field.id === selected,
  );
  if (!field) return null;
  const step = CANVAS_ROW + CANVAS_GAP;
  function resize(width: number) {
    if (field) onChange(placeField(fields, field.id, { ...field.layout, width }));
  }
  function shift(dx: number, dy: number) {
    if (field)
      onChange(
        placeField(fields, field.id, {
          ...field.layout,
          x: field.layout.x + dx,
          y: dy ? adjacentRow(fields, field, dy) : field.layout.y,
        }),
      );
  }
  return (
    <fieldset className="canvas-toolbar" disabled={busy}>
      <legend>Размер и положение</legend>
      <div className="field-width-presets" role="group" aria-label="Ширина поля">
        {[
          { width: 12, label: 'Вся ширина' },
          { width: 6, label: 'Половина' },
          { width: 4, label: 'Треть' },
        ].map(({ width, label }) => (
          <button
            type="button"
            key={width}
            aria-pressed={field.layout.width === width}
            onClick={() => resize(width)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="canvas-position-buttons"
        role="group"
        aria-label="Перемещение выбранного блока"
      >
        {[
          {
            dx: -1,
            dy: 0,
            label: 'Влево',
            path: 'm10 6-6 6 6 6M4 12h16',
            disabled: field.layout.x === 0,
          },
          {
            dx: 0,
            dy: -1,
            label: 'Выше',
            path: 'm6 10 6-6 6 6M12 4v16',
            disabled: adjacentRow(fields, field, -1) === field.layout.y,
          },
          {
            dx: 0,
            dy: 1,
            label: 'Ниже',
            path: 'm6 14 6 6 6-6M12 4v16',
            disabled: adjacentRow(fields, field, 1) === field.layout.y,
          },
          {
            dx: 1,
            dy: 0,
            label: 'Вправо',
            path: 'm14 6 6 6-6 6M4 12h16',
            disabled: field.layout.x + field.layout.width === 12,
          },
        ].map(({ dx, dy, label, path, disabled }) => (
          <button
            type="button"
            key={label}
            title={label}
            aria-label={`Переместить поле: ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => shift(dx, dy)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
      <details className="field-advanced">
        <summary>Точная настройка</summary>
        <div className="canvas-dimensions">
          <label>
            Ширина
            <select
              aria-label="Ширина блока"
              value={field.layout.width}
              onChange={(event) => resize(Number(event.target.value))}
            >
              {Array.from({ length: 10 }, (_, index) => index + 3).map((width) => (
                <option key={width} value={width}>
                  {Math.round((width / 12) * 100)}%
                </option>
              ))}
            </select>
          </label>
          <label>
            Дополнительная высота
            <input
              type="number"
              aria-label="Дополнительная высота блока"
              min={0}
              max={(24 - defaultFieldSize(field).height) * step}
              step={step}
              value={extraFieldHeight(field)}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value))
                  onChange(
                    placeField(fields, field.id, {
                      ...field.layout,
                      height: defaultFieldSize(field).height + Math.round(value / step),
                    }),
                  );
              }}
            />
          </label>
        </div>
      </details>
    </fieldset>
  );
}
