import { useState } from 'react';
import { CardCanvas, type CanvasEditor } from '../card-builder/CardCanvas';
import { FieldIcon } from '../card-builder/FieldIcon';
import { WorkStatusBadge } from '../catalog/WorkStatusBadge';
import { type CardField, type Catalog, type Task } from '../../shared/types';
import { formatDate, remaining, timezone, urgency, urgencyLabels } from './model';
import { displayFieldValue, fieldValue, fieldDeadline } from '../card-builder/fields';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={!value ? 'muted' : ''}>{value || 'Не указано'}</dd>
    </div>
  );
}

export function TaskCard({
  task,
  catalog,
  fields,
  now,
  busy,
  preview = false,
  onEdit,
  onDelete,
  onPatch,
  canvasEditor,
}: {
  task: Task;
  catalog: Catalog[];
  fields: CardField[];
  now: number;
  busy: boolean;
  preview?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (data: Partial<Pick<Task, 'completed' | 'status_id'>>) => Promise<void>;
  canvasEditor?: CanvasEditor;
}) {
  const [expanded, setExpanded] = useState(false);
  const open = preview || expanded;
  const status = catalog.find((entry) => entry.id === task.status_id);
  const topicID = `topic-${preview ? 'preview-' : ''}${task.id}`;
  const detailsID = `details-${preview ? 'preview-' : ''}${task.id}`;
  const source = task.deadline_field || 'deadline';
  const sourceField = fields.find((field) => field.id === source);
  const hasDate = sourceField && Boolean(fieldValue(task, sourceField));
  const level = hasDate ? urgency(task, now) : 'neutral';
  const hasStatus = fields.some(
    (field) => field.id === 'status_id' && field.visibility !== 'hidden',
  );
  function fieldContent(field: CardField) {
    if (field.id === 'topic')
      return (
        <h3 className="card-title" id={topicID}>
          <FieldIcon field={field} />
          <span>{task.topic || 'Название карточки'}</span>
        </h3>
      );
    if (field.id === 'status_id')
      return (
        <dl className="field status-field">
          <dt className="field-label">
            <FieldIcon field={field} />
            <span>{field.label}</span>
          </dt>
          <dd>
            {preview ? (
              <WorkStatusBadge status={status} />
            ) : (
              <WorkStatusBadge
                status={status}
                selection={{
                  statuses: catalog.filter(
                    (entry) =>
                      entry.kind === 'status' && (!entry.archived || entry.id === task.status_id),
                  ),
                  disabled: busy,
                  label: `Статус записи ${task.id}`,
                  onChange: (status_id) => void onPatch({ status_id }),
                }}
              />
            )}
          </dd>
        </dl>
      );
    const value = displayFieldValue(task, field, catalog);
    const date =
      (field.type === 'date' || field.type === 'datetime') && value
        ? fieldDeadline(task, field)
        : '';
    const dated = { deadline: date, completed: task.completed };
    const dateLevel = date ? urgency(dated, now) : 'neutral';
    return (
      <dl className={`field ${field.id === source ? 'deadline' : ''}`}>
        <dt className="field-label">
          <FieldIcon field={field} />
          <span>
            {field.label}
            {field.id === source && <span className="deadline-marker"> · главная</span>}
          </span>
        </dt>
        <dd className={!value ? 'muted' : ''}>
          {value || 'Не указано'}
          {date && (
            <span className={`time-left ${dateLevel}`}>
              {remaining(dated, now, field.type === 'date' || field.id === 'deadline')}
            </span>
          )}
        </dd>
      </dl>
    );
  }
  return (
    <article className={`task-card ${level}`} aria-labelledby={topicID} aria-busy={busy}>
      <div className="card-disclosure" data-expanded={open}>
        <div
          className="card-summary"
          onClick={(event) => {
            if (preview) return;
            if (event.target instanceof Element && event.target.closest('select, button')) return;
            setExpanded((previous) => !previous);
          }}
        >
          <div className="card-top">
            <div className="card-kicker">
              <span className="record-id">{task.id ? `#${task.id}` : 'Новая карточка'}</span>
            </div>
            <div className="card-badges">
              {hasDate && (
                <span className={`urgency ${level}`}>
                  <span aria-hidden="true">●</span>
                  {urgencyLabels[level]}
                </span>
              )}
              <button
                type="button"
                className="disclosure-hint"
                aria-expanded={open}
                aria-controls={detailsID}
                tabIndex={preview ? -1 : undefined}
                onClick={() => !preview && setExpanded((previous) => !previous)}
              >
                <span className="when-closed">Подробнее</span>
                <span className="when-open">Свернуть</span>
                <span aria-hidden="true">⌄</span>
              </button>
            </div>
          </div>
          <CardCanvas
            fields={fields}
            visibility="summary"
            renderField={fieldContent}
            editor={canvasEditor}
          />
        </div>
        <div className="card-details" id={detailsID} aria-hidden={!open} inert={!open || undefined}>
          <div className="card-details-content">
            <CardCanvas
              fields={fields}
              visibility="details"
              renderField={fieldContent}
              editor={canvasEditor}
            />
            {hasStatus && status?.reminder_text && (
              <div className="status-reminder">
                <strong>Напоминание · {status.name}</strong>
                <p>{status.reminder_text}</p>
              </div>
            )}
            <div className="card-footer">
              <div className="card-metadata">
                <dl className="timestamps">
                  <Field label="Создано" value={formatDate(task.created_at, true)} />
                  <Field label="Изменено" value={formatDate(task.updated_at, true)} />
                  {task.completed_at && (
                    <Field label="Выполнено" value={formatDate(task.completed_at, true)} />
                  )}
                </dl>
                <small className="muted">Часовой пояс: {timezone}</small>
              </div>
              <div className="card-buttons" inert={preview || undefined}>
                <button
                  type="button"
                  className={`completion-button ${task.completed ? 'is-completed' : ''}`}
                  aria-pressed={task.completed}
                  aria-label={task.completed ? 'Отметить невыполненным' : 'Выполнить'}
                  title={task.completed ? 'Отметить невыполненным' : 'Выполнить'}
                  disabled={busy}
                  onClick={() => !preview && void onPatch({ completed: !task.completed })}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Редактировать"
                  title="Редактировать"
                  disabled={busy}
                  onClick={preview ? undefined : onEdit}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m15 5 4 4M4 15 16 3a2.8 2.8 0 0 1 4 4L8 19l-5 2 1-6Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="danger-subtle"
                  aria-label="Удалить"
                  title="Удалить"
                  disabled={busy}
                  onClick={preview ? undefined : onDelete}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
