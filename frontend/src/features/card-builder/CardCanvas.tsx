import type { ReactNode } from 'react';
import type { CardField } from '../../shared/types';
import { extraFieldHeight, positionFields, type CanvasGroup, type PositionedField } from './layout';

export type CanvasEditor = {
  selected: string | null;
  active: string | null;
  onSelect: (id: string) => void;
  tools: (field: PositionedField) => ReactNode;
};

export function CardCanvas({
  fields,
  visibility,
  renderField,
  editor,
}: {
  fields: CardField[];
  visibility: CanvasGroup;
  renderField: (field: CardField) => ReactNode;
  editor?: CanvasEditor;
}) {
  const placed = positionFields(fields, visibility);
  if (!placed.length) return null;
  const ordered = [...placed].sort(
    (first, second) => first.layout.y - second.layout.y || first.layout.x - second.layout.x,
  );

  const contentRows = new Map(
    [...new Set(ordered.map((field) => field.layout.y))].map((row, index) => [row, index + 1]),
  );

  return (
    <section
      className="canvas-section"
      aria-label={visibility === 'summary' ? 'В карточке' : 'В подробностях'}
    >
      <div
        className={`card-canvas is-compact ${editor ? 'is-editable' : ''}`}
        data-canvas-group={visibility}
      >
        {ordered.map((field) => (
          <div
            key={field.id}
            data-field-id={field.id}
            className={`canvas-block ${editor?.selected === field.id ? 'is-selected' : ''} ${editor?.active === field.id ? 'is-active' : ''}`}
            style={{
              gridColumn: `${field.layout.x + 1} / span ${field.layout.width}`,
              gridRow: String(contentRows.get(field.layout.y)),
            }}
            onClick={
              editor
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    editor.onSelect(field.id);
                  }
                : undefined
            }
          >
            <div className="canvas-content" style={{ paddingBottom: extraFieldHeight(field) }}>
              {renderField(field)}
            </div>
            {editor?.tools(field)}
          </div>
        ))}
      </div>
    </section>
  );
}
