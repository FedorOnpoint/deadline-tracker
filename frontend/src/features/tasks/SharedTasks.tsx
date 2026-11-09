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
          <div key={entry.task.id}>
            <p className="hint">
              {entry.owner_name} · {entry.section.label}
            </p>
            <TaskCard
              task={entry.task}
              catalog={entry.catalog}
              fields={entry.task.fields ?? entry.section.fields}
              now={now}
              busy={busyIDs.has(entry.task.id)}
              onEdit={() => onEdit(entry.task)}
              onPatch={(changes) => onPatch(entry.task.id, changes)}
            />
          </div>
        ))}
      </div>
    );
  return (
    <section aria-labelledby="records">
      <h1 id="records" tabIndex={-1}>
        Совместные карточки
      </h1>
      <p className="muted">
        Карточки, к которым вам открыли доступ. Удалять их и управлять участниками может владелец.
      </p>
      {content}
    </section>
  );
}
