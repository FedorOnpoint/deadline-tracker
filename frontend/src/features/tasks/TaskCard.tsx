import { WorkStatusBadge } from '../catalog/WorkStatusBadge';
import { type Catalog, type Task } from '../../shared/types';
import { formatDate, localDateTime, remaining, timezone, urgency, urgencyLabels } from './model';

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
  now,
  busy,
  onEdit,
  onDelete,
  onPatch,
}: {
  task: Task;
  catalog: Catalog[];
  now: number;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (data: Partial<Pick<Task, 'completed' | 'status_id'>>) => Promise<void>;
}) {
  const findCatalogItem = (id: number | null) => catalog.find((item) => item.id === id);
  const status = findCatalogItem(task.status_id);
  const level = urgency(task, now);
  const warning = task.email_date && task.email_date < localDateTime(task.deadline).slice(0, 10);
  return (
    <article className={`task-card ${level}`} aria-labelledby={`topic-${task.id}`} aria-busy={busy}>
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
          <h3 id={`topic-${task.id}`}>{task.topic}</h3>
          {task.project && <p className="card-project">{task.project}</p>}
          <div className="summary-meta">
            <dl className="summary-dates">
              <div className="summary-date">
                <dt>
                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
                    <rect
                      x="3"
                      y="4.5"
                      width="14"
                      height="12.5"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M6.5 3v3M13.5 3v3M3 8.5h14"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Загрузка в Mhub+
                </dt>
                <dd>
                  <time dateTime={task.deadline}>{formatDate(task.deadline, true)}</time>
                </dd>
              </div>
              <div className="summary-date">
                <dt>
                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
                    <rect
                      x="2.5"
                      y="4.5"
                      width="15"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="m3.5 6 6.5 5 6.5-5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Дата e-mail
                </dt>
                <dd>
                  {task.email_date ? (
                    <time dateTime={task.email_date}>{formatDate(task.email_date)}</time>
                  ) : (
                    <span className="muted">Не указано</span>
                  )}
                </dd>
              </div>
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
          <dl className="attributes">
            <div className="field deadline">
              <dt>Срок загрузки в Mhub+</dt>
              <dd>
                {formatDate(task.deadline, true)}
                <span className={`time-left ${level}`}>{remaining(task, now)}</span>
                <small className="muted">{timezone}</small>
              </dd>
            </div>
            <Field
              label="Дата (e-mail)"
              value={task.email_date ? formatDate(task.email_date) : ''}
            />
            <Field label="Специальность" value={findCatalogItem(task.specialty_id)?.name || ''} />
            <Field label="Материал / проект" value={task.project} />
            <Field label="Ответственный" value={task.owner} />
          </dl>
          {warning && <p className="warning">Дата e-mail раньше срока загрузки</p>}
          <dl className="text-fields">
            <Field label="Хедер" value={task.header} />
            <Field label="Прехедер" value={task.preheader} />
            <Field label="Комментарий" value={task.comment} />
          </dl>
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
          <dl className="timestamps">
            <Field label="Создано" value={formatDate(task.created_at, true)} />
            <Field label="Изменено" value={formatDate(task.updated_at, true)} />
            {task.completed_at && (
              <Field label="Выполнено" value={formatDate(task.completed_at, true)} />
            )}
          </dl>
        </div>
      </details>
    </article>
  );
}
