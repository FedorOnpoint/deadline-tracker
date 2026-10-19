import { Fragment } from 'react';
import type { Catalog, Task } from '../../shared/types';
import { monthKey, monthLabel } from './model';
import { TaskCard } from './TaskCard';
import type { TaskChanges } from './api';

type TaskListProps = {
  tasks: Task[];
  catalog: Catalog[];
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
  grouped,
  now,
  busyIDs,
  onEdit,
  onDelete,
  onPatch,
}: TaskListProps) {
  const groups: { key: string; label: string; tasks: Task[] }[] = [];
  if (grouped) {
    for (const platform of catalog.filter((item) => item.kind === 'platform')) {
      const subset = tasks.filter((task) => task.platform_id === platform.id);
      for (const month of [...new Set(subset.map(monthKey))].sort())
        groups.push({
          key: `${platform.id}-${month}`,
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
            </h2>
          )}
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              catalog={catalog}
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
