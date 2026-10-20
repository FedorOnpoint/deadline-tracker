import { WorkStatusBadge } from '../catalog/WorkStatusBadge';
import { type CardField, type Catalog, type Task } from '../../shared/types';
import { formatDate, localDateTime, remaining, timezone, urgency, urgencyLabels } from './model';
import { displayFieldValue } from '../card-builder/fields';

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
}) {
  const findCatalogItem = (id: number | null) => catalog.find((item) => item.id === id);
  const status = findCatalogItem(task.status_id);
  const level = urgency(task, now);
  const topicID = `topic-${preview ? 'preview-' : ''}${task.id}`;
  const warning = task.email_date && task.email_date < localDateTime(task.deadline).slice(0, 10);
  return (
    <article className={`task-card ${level}`} aria-labelledby={topicID} aria-busy={busy}>
      <details className="card-disclosure">
        <summary className="card-summary">
          <div className="card-top">
            <div className="card-kicker">
              <span>{findCatalogItem(task.platform_id)?.name || 'Не указано'}</span>
              <span className="record-id">#{task.id}</span>
            </div>
            <div className="card-badges">
              <span className={`urgency ${level}`}>
                <span aria-hidden="true">●</span>
                {urgencyLabels[level]}
              </span>
              <WorkStatusBadge status={status} compact />
            </div>
          </div>
          <h3 id={topicID}>{task.topic}</h3>
          <div className="summary-meta">
            <dl className="summary-dates configurable-summary">
              {fields
                .filter(
                  (field) =>
                    field.visibility === 'summary' &&
                    field.id !== 'topic' &&
                    field.id !== 'platform_id',
                )
                .map((field) => (
                  <Field
                    key={field.id}
                    label={field.label}
                    value={displayFieldValue(task, field, catalog)}
                  />
                ))}
            </dl>
            <span className="disclosure-hint">
              <span className="when-closed">Подробнее</span>
              <span className="when-open">Свернуть</span>
              <svg
                className="disclosure-arrow"
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m5 7.5 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </summary>
        <div className="card-details">
          <dl className="card-field-grid">
            {fields
              .filter((field) => field.visibility === 'details' || field.id === 'deadline')
              .map((field) =>
                field.id === 'deadline' ? (
                  <div key={field.id} className="field deadline">
                    <dt>{field.label}</dt>
                    <dd>
                      {formatDate(task.deadline, true)}
                      <span className={`time-left ${level}`}>{remaining(task, now)}</span>
                      <small className="muted">{timezone}</small>
                    </dd>
                  </div>
                ) : (
                  <Field
                    key={field.id}
                    label={field.label}
                    value={displayFieldValue(task, field, catalog)}
                  />
                ),
              )}
          </dl>
          {warning && <p className="warning">Дата e-mail раньше срока загрузки</p>}
          {!preview && (
            <div className="card-controls">
              <label className="status-control">
                Рабочий статус
                <WorkStatusBadge status={status} />
                <select
                  className="status-select"
                  disabled={busy}
                  value={task.status_id ?? ''}
                  onChange={(e) =>
                    void onPatch({ status_id: e.target.value ? Number(e.target.value) : null })
                  }
                  aria-label={`Статус записи ${task.id}`}
                >
                  <option value="">Не задан</option>
                  {catalog
                    .filter(
                      (item) =>
                        item.kind === 'status' && (!item.archived || item.id === task.status_id),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.archived ? ' (в архиве)' : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={busy}
                  onChange={(e) => void onPatch({ completed: e.target.checked })}
                />
                Выполнено
              </label>
              <div className="card-buttons">
                <button disabled={busy} onClick={onEdit}>
                  Редактировать
                </button>
                <button className="danger-subtle" disabled={busy} onClick={onDelete}>
                  Удалить
                </button>
              </div>
            </div>
          )}
          {!preview && (
            <dl className="timestamps">
              <Field label="Создано" value={formatDate(task.created_at, true)} />
              <Field label="Изменено" value={formatDate(task.updated_at, true)} />
              {task.completed_at && (
                <Field label="Выполнено" value={formatDate(task.completed_at, true)} />
              )}
            </dl>
          )}
        </div>
      </details>
    </article>
  );
}
