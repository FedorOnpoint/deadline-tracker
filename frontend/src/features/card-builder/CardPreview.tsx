import type { CardField, Catalog, Task } from '../../shared/types';
import { TaskCard } from '../tasks/TaskCard';
import { usePreviewScale } from './usePreviewScale';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { PositionedField } from './layout';

export function CardPreview({
  task,
  fields,
  catalog,
  now,
  selected,
  onSelect,
  onChange,
  busy,
  onEditStart,
  onEditEnd,
  onEditField,
}: {
  task: Task;
  fields: CardField[];
  catalog: Catalog[];
  now: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (fields: CardField[]) => void;
  busy: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  onEditField: () => void;
}) {
  const interaction = useCanvasInteraction(
    fields,
    onChange,
    onSelect,
    busy,
    onEditStart,
    onEditEnd,
  );
  const frame = usePreviewScale();
  const selectedField = fields.find(
    (field) => field.id === selected && field.visibility !== 'hidden',
  );
  function tools(field: PositionedField) {
    return (
      <>
        <button
          type="button"
          className="canvas-grip"
          disabled={busy}
          aria-label={`Переместить поле «${field.label}»`}
          aria-pressed={selected === field.id}
          onPointerDown={(event) => interaction.begin(event, field, 'move')}
          onKeyDown={(event) => interaction.key(event, field, false)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(field.id);
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M8 5h1m6 0h1M8 12h1m6 0h1M8 19h1m6 0h1" />
          </svg>
        </button>
        <button
          type="button"
          className="canvas-resize"
          disabled={busy}
          aria-label={`Изменить размер поля «${field.label}»`}
          onPointerDown={(event) => interaction.begin(event, field, 'resize')}
          onKeyDown={(event) => interaction.key(event, field, true)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(field.id);
          }}
        >
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <path d="M23 9v7a7 7 0 0 1-7 7H9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </>
    );
  }

  return (
    <aside
      ref={interaction.root}
      className="builder-preview"
      aria-label="Холст карточки"
      tabIndex={-1}
      onPointerMove={interaction.move}
      onPointerUp={(event) => interaction.finish(event)}
      onPointerCancel={(event) => interaction.finish(event, true)}
      onLostPointerCapture={(event) => interaction.finish(event, true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && interaction.active) {
          event.preventDefault();
          event.stopPropagation();
          interaction.cancel();
        }
      }}
    >
      <div className="builder-preview-heading">
        <h3>Превью карточки</h3>
        <div className="preview-actions">
          <button
            type="button"
            className="reset"
            disabled={busy || !fields.some((field) => field.layout)}
            onClick={() => onChange(fields.map((field) => ({ ...field, layout: undefined })))}
          >
            Автораскладка
          </button>
          <button
            type="button"
            className="reset"
            aria-label="Масштаб превью"
            aria-pressed={frame.actualSize}
            onClick={() => frame.setActualSize(!frame.actualSize)}
          >
            {frame.actualSize ? 'По ширине окна' : 'Реальный размер'}
          </button>
        </div>
      </div>
      {selectedField && (
        <button type="button" className="preview-edit-selected" onClick={onEditField}>
          Настройки выбранного поля
        </button>
      )}
      <div ref={frame.viewport} className="preview-viewport">
        <div
          className="preview-frame"
          style={{ width: frame.width * frame.scale, height: frame.height * frame.scale }}
        >
          <div
            ref={frame.content}
            className="preview-content"
            style={{ width: frame.width, transform: `scale(${frame.scale})` }}
          >
            <TaskCard
              task={task}
              fields={fields}
              catalog={catalog}
              now={now}
              busy={busy}
              preview
              onEdit={() => {}}
              onDelete={() => {}}
              onPatch={async () => {}}
              canvasEditor={{ selected, active: interaction.active, onSelect, tools }}
            />
          </div>
        </div>
        {!fields.some((field) => field.visibility === 'details') && (
          <div className="canvas-empty-target" data-canvas-group="details">
            Перетащите поле сюда, чтобы добавить его в подробности.
          </div>
        )}
      </div>

      <span className="sr-only" role="status">
        {interaction.announcement}
      </span>
    </aside>
  );
}
