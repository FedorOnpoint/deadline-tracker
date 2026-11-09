import type { Task } from '../../shared/types';
import type { SharedTask, TaskChanges } from './api';
import { TaskCard } from './TaskCard';

export function SharedTasks({
  entries,
  loading,
  now,
  busyIDs,
  onEdit,
  onPatch,
}: {
  entries: SharedTask[];
  loading: boolean;
  now: number;
  busyIDs: Set<number>;
  onEdit: (task: Task) => void;
  onPatch: (id: number, changes: TaskChanges) => Promise<void>;
}) {
  let content;
  if (loading) content = <p role="status">Загрузка…</p>;
  else if (!entries.length)
    content = <div className="empty">Здесь появятся карточки, которыми с вами поделятся.</div>;
  else
    content = (
      <div className="task-list">
        {entries.map((entry) => (
          <TaskCard
            key={entry.task.id}
            task={entry.task}
            catalog={entry.catalog}
            fields={entry.task.fields ?? entry.section.fields}
            now={now}
            busy={busyIDs.has(entry.task.id)}
            byline={
              <div className="shared-card-byline">
                <span className="shared-card-owner">
                  <span className="shared-owner-avatar" aria-hidden="true">
                    {entry.owner_name.slice(0, 1).toLocaleUpperCase('ru-RU')}
                  </span>
                  <span>
                    <span className="sr-only">Владелец: </span>
                    {entry.owner_name}
                  </span>
                </span>
                <span className="shared-card-section">
                  <span className="sr-only">Раздел: </span>
                  {entry.section.label}
                </span>
              </div>
            }
            onEdit={() => onEdit(entry.task)}
            onPatch={(changes) => onPatch(entry.task.id, changes)}
          />
        ))}
      </div>
    );
  return (
    <section className="shared-tasks" aria-labelledby="records">
      <header className="shared-tasks-header">
        <div className="shared-tasks-heading">
          <h1 id="records" tabIndex={-1}>
            Совместные карточки
          </h1>
          {!loading && (
            <span className="shared-tasks-count" aria-label={`Карточек: ${entries.length}`}>
              {entries.length}
            </span>
          )}
        </div>
        <p className="muted">
          Редактируйте вместе. Доступом и удалением управляет владелец карточки.
        </p>
      </header>
      {content}
    </section>
  );
}
