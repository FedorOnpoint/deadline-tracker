import type { Task } from '../../shared/types';
import { urgency } from './model';

type TaskStatsProps = {
  tasks: Task[];
  now: number;
  loading: boolean;
  sectionLabel: string;
  selectedUrgency: string;
  onSelect: (urgency: string) => void;
};

export function TaskStats({
  tasks,
  now,
  loading,
  sectionLabel,
  selectedUrgency,
  onSelect,
}: TaskStatsProps) {
  const stats = [
    { label: 'Всего записей', value: tasks.length, key: '', className: '' },
    {
      label: 'Просрочено',
      value: tasks.filter((task) => urgency(task, now) === 'overdue').length,
      key: 'overdue',
      className: 'red',
    },
    {
      label: 'Дедлайн меньше недели',
      value: tasks.filter((task) => urgency(task, now) === 'urgent').length,
      key: 'urgent',
      className: 'red',
    },
    {
      label: 'Выполнено',
      value: tasks.filter((task) => task.completed).length,
      key: 'done',
      className: 'green',
    },
  ];
  return (
    <section className="stats" aria-label={`Сводка: ${sectionLabel}`}>
      {stats.map((statistic) => (
        <button
          key={statistic.label}
          className={`stat ${statistic.className} ${selectedUrgency === statistic.key && statistic.key ? 'selected' : ''}`}
          onClick={() => onSelect(statistic.key)}
        >
          <span>{statistic.label}</span>
          <strong>{loading ? '—' : statistic.value.toString().padStart(2, '0')}</strong>
          <span className="stat-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
      ))}
    </section>
  );
}
