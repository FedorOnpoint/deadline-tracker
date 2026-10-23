import type { CardField } from '../../shared/types';
import {
  CANVAS_GAP,
  CANVAS_ROW,
  adjacentRow,
  defaultFieldSize,
  extraFieldHeight,
  placeField,
  positionFields,
  type CanvasGroup,
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
  const step = CANVAS_ROW + CANVAS_GAP;
  if (!field) return null;
  function shift(dx: number, dy: number) {
    if (!field) return;
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
      <legend>{field.label}</legend>
      <>
        <div className="canvas-dimensions">
          <label>
            Ширина
            <select
              aria-label="Ширина блока"
              value={field.layout.width}
              onChange={(event) =>
                onChange(
                  placeField(fields, field.id, {
                    ...field.layout,
                    width: Number(event.target.value),
                  }),
                )
              }
            >
              {Array.from({ length: 10 }, (_, index) => index + 3).map((width) => (
                <option key={width} value={width}>
                  {Math.round((width / 12) * 100)}%
                </option>
              ))}
            </select>
          </label>
          <label>
            Доп. высота, px
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
          <label>
            Область
            <select
              aria-label="Область блока"
              disabled={field.id === 'topic'}
              value={field.visibility}
              onChange={(event) =>
                onChange(
                  placeField(
                    fields,
                    field.id,
                    { ...field.layout, x: 0, y: 0 },
                    event.target.value as CanvasGroup,
                  ),
                )
              }
            >
              <option value="summary">В карточке</option>
              <option value="details">В подробностях</option>
            </select>
          </label>
        </div>
        <div
          className="canvas-position-buttons"
          role="group"
          aria-label="Перемещение выбранного блока"
        >
          <button
            type="button"
            aria-label="Переместить блок влево"
            disabled={field.layout.x === 0}
            onClick={() => shift(-1, 0)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Переместить блок вверх"
            disabled={adjacentRow(fields, field, -1) === field.layout.y}
            onClick={() => shift(0, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Переместить блок вниз"
            disabled={adjacentRow(fields, field, 1) === field.layout.y}
            onClick={() => shift(0, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Переместить блок вправо"
            disabled={field.layout.x + field.layout.width === 12}
            onClick={() => shift(1, 0)}
          >
            →
          </button>
        </div>
      </>
    </fieldset>
  );
}
