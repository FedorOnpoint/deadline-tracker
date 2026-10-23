import type { CardField, Catalog, Task } from '../../shared/types';
import { TaskCard } from '../tasks/TaskCard';
import { CanvasToolbar } from './CanvasToolbar';
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
}: {
  task: Task;
  fields: CardField[];
  catalog: Catalog[];
  now: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (fields: CardField[]) => void;
  busy: boolean;
}) {
  const interaction = useCanvasInteraction(fields, onChange, onSelect, busy);
  const frame = usePreviewScale();
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
          ⠿
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
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M5 13 13 5M10 13l3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
        <h3>Холст карточки</h3>
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
            {frame.actualSize
              ? 'Вписать в окно'
              : `Масштаб ${Math.round(frame.scale * 100)}% · открыть 100%`}
          </button>
        </div>
      </div>
      <CanvasToolbar fields={fields} selected={selected} onChange={onChange} busy={busy} />
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
