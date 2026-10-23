import { Fragment } from 'react';
import type { CardField, Catalog, Task } from '../../shared/types';
import { monthKey, monthLabel } from './model';
import { TaskCard } from './TaskCard';
import type { TaskChanges } from './api';

type TaskListProps = {
  tasks: Task[];
  catalog: Catalog[];
  fields: CardField[];
  platforms: Catalog[];
  onCreate: (platformID: number) => void;
  grouped: boolean;
  now: number;
  busyIDs: Set<number>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onPatch: (id: number, changes: TaskChanges) => Promise<void>;
};

export function TaskList({
  tasks,
  catalog,
  fields,
  platforms,
  onCreate,
  grouped,
  now,
  busyIDs,
  onEdit,
  onDelete,
  onPatch,
}: TaskListProps) {
  const groups: { key: string; label: string; tasks: Task[]; platformID?: number }[] = [];
  if (grouped) {
    const unassigned = tasks.filter((task) => !task.platform_id);
    for (const month of [...new Set(unassigned.map(monthKey))].sort()) {
      groups.push({
        key: `unassigned-${month}`,
        label: `Без площадки / ${monthLabel(month)}`,
        tasks: unassigned.filter((task) => monthKey(task) === month),
      });
    }
    for (const platform of platforms) {
      const subset = tasks.filter((task) => task.platform_id === platform.id);
      if (!subset.length && !platform.archived)
        groups.push({
          key: String(platform.id),
          label: platform.name,
          tasks: [],
          platformID: platform.id,
        });
      for (const month of [...new Set(subset.map(monthKey))].sort())
        groups.push({
          key: `${platform.id}-${month}`,
          platformID: platform.archived ? undefined : platform.id,
          label: `${platform.name} / ${monthLabel(month)}`,
          tasks: subset.filter((task) => monthKey(task) === month),
        });
    }
  } else groups.push({ key: 'all', label: '', tasks });
  return (
    <div className="task-list">
      {groups.map((group) => (
        <Fragment key={group.key}>
          {group.label && (
            <h2 className="group-heading">
              {group.label}
              <span className="count">{group.tasks.length}</span>
              {group.platformID !== undefined && (
                <button
                  className="group-create"
                  onClick={() => onCreate(group.platformID!)}
                  aria-label={`Новая запись: ${group.label}`}
                >
                  ＋ Новая запись
                </button>
              )}
            </h2>
          )}
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              catalog={catalog}
              fields={task.fields ?? fields}
              now={now}
              busy={busyIDs.has(task.id)}
              onEdit={() => onEdit(task)}
              onDelete={() => {
                onDelete(task);
              }}
              onPatch={(data) => onPatch(task.id, data)}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
