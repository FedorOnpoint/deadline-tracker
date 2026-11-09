import { localDateTime, timezone } from '../../shared/dates';
import { workingDaysBetween } from './russianCalendar';
import type { DeadlineCalendar, Task } from '../../shared/types';

export type Urgency = 'done' | 'overdue' | 'urgent' | 'soon' | 'neutral';
export const DAY = 24 * 60 * 60 * 1000;
type DatedTask = Pick<Task, 'deadline' | 'completed' | 'timezone'>;

export function urgency(
  task: DatedTask,
  now: number,
  calendar: DeadlineCalendar = 'calendar',
): Urgency {
  if (task.completed) return 'done';
  const left = new Date(task.deadline).getTime() - now;
  if (left <= 0) return 'overdue';
  const days =
    calendar === 'ru'
      ? workingDaysBetween(now, new Date(task.deadline).getTime(), task.timezone || timezone)
      : null;
  if (days !== null) {
    if (days < 7) return 'urgent';
    if (days <= 14) return 'soon';
    return 'neutral';
  }
  if (left < 7 * DAY) return 'urgent';
  if (left <= 14 * DAY) return 'soon';
  return 'neutral';
}
export const urgencyLabels: Record<Urgency, string> = {
  done: 'Выполнено',
  overdue: 'Просрочено',
  urgent: 'Меньше недели',
  soon: '7–14 дней',
  neutral: 'В запасе',
};
export function remaining(
  task: DatedTask,
  now: number,
  daysOnly = false,
  calendar: DeadlineCalendar = 'calendar',
): string {
  if (task.completed) return 'Работа завершена';
  const delta = new Date(task.deadline).getTime() - now;
  if (calendar === 'ru') {
    const days = workingDaysBetween(
      now,
      new Date(task.deadline).getTime(),
      task.timezone || timezone,
    );
    if (days !== null)
      return delta <= 0 ? `Просрочено на ${Math.abs(days)} раб. д.` : `Осталось ${days} раб. д.`;
    const count = Math.max(1, Math.ceil(Math.abs(delta) / DAY));
    return delta <= 0 ? `Просрочено на ${count} кал. д.` : `Осталось ${count} кал. д.`;
  }
  if (daysOnly) {
    if (delta <= 0) return `Просрочено на ${Math.max(1, Math.ceil(Math.abs(delta) / DAY))} д.`;
    const days = Math.ceil(delta / DAY);
    return `Осталось ${days} д.`;
  }
  const minutes = Math.max(1, Math.ceil(Math.abs(delta) / 60000));
  let value: string;
  if (minutes < 60) value = `${minutes} мин.`;
  else if (minutes < 1440) value = `${Math.floor(minutes / 60)} ч. ${minutes % 60} мин.`;
  else value = `${Math.floor(minutes / 1440)} д. ${Math.floor((minutes % 1440) / 60)} ч.`;
  return delta <= 0 ? `Просрочено на ${value}` : `Осталось ${value}`;
}
export function monthKey(t: Task) {
  return (t.email_date || localDateTime(t.deadline)).slice(0, 7);
}
export function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00`).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}
export type Filters = {
  query: string;
  platform: string;
  specialty: string;
  status: string;
  completion: string;
  month: string;
  urgency: string;
};
export const emptyFilters: Filters = {
  query: '',
  platform: '',
  specialty: '',
  status: '',
  completion: '',
  month: '',
  urgency: '',
};
export function selectTasks(
  tasks: Task[],
  filters: Filters,
  sort: string,
  now: number,
  calendar: DeadlineCalendar = 'calendar',
) {
  const keywords = filters.query.trim().toLocaleLowerCase('ru-RU').split(/\s+/).filter(Boolean);
  return tasks
    .filter((t) => {
      if (
        keywords.length &&
        !keywords.every((keyword) =>
          [
            t.topic,
            t.project,
            t.header,
            t.preheader,
            t.comment,
            t.owner,
            ...Object.values(t.custom_fields),
          ].some((v) => v.toLocaleLowerCase('ru-RU').includes(keyword)),
        )
      )
        return false;
      if (filters.platform && String(t.platform_id) !== filters.platform) return false;
      if (
        filters.specialty &&
        !(t.specialty_ids ?? (t.specialty_id ? [t.specialty_id] : [])).includes(
          Number(filters.specialty),
        )
      )
        return false;
      if (
        filters.status &&
        (filters.status === 'unset' ? t.status_id !== null : String(t.status_id) !== filters.status)
      )
        return false;
      if (filters.completion && t.completed !== (filters.completion === 'done')) return false;
      if (filters.month && monthKey(t) !== filters.month) return false;
      if (filters.urgency && urgency(t, now, calendar) !== filters.urgency) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      const comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return comparison * (sort.endsWith('desc') ? -1 : 1) || a.id - b.id;
    });
}
