import type { Task } from '../../shared/types';

export type Urgency = 'done' | 'overdue' | 'urgent' | 'soon' | 'neutral';
export const DAY = 24 * 60 * 60 * 1000;
export function urgency(task: Pick<Task, 'deadline' | 'completed'>, now: number): Urgency {
  if (task.completed) return 'done';
  const left = new Date(task.deadline).getTime() - now;
  if (left <= 0) return 'overdue';
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
export function remaining(task: Task, now: number): string {
  if (task.completed) return 'Работа завершена';
  const delta = new Date(task.deadline).getTime() - now;
  const minutes = Math.max(1, Math.ceil(Math.abs(delta) / 60000));
  let value: string;
  if (minutes < 60) value = `${minutes} мин.`;
  else if (minutes < 1440) value = `${Math.floor(minutes / 60)} ч. ${minutes % 60} мин.`;
  else value = `${Math.floor(minutes / 1440)} д. ${Math.floor((minutes % 1440) / 60)} ч.`;
  return delta <= 0 ? `Просрочено на ${value}` : `Осталось ${value}`;
}
export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function localDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
export function formatDate(value: string, withTime = false) {
  if (!value) return 'Не указано';
  return new Date(withTime ? value : `${value}T12:00:00`).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
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
export function selectTasks(tasks: Task[], filters: Filters, sort: string, now: number) {
  const q = filters.query.trim().toLocaleLowerCase('ru-RU');
  return tasks
    .filter((t) => {
      if (
        q &&
        ![
          t.topic,
          t.project,
          t.header,
          t.preheader,
          t.comment,
          t.owner,
          ...Object.values(t.custom_fields),
        ].some((v) => v.toLocaleLowerCase('ru-RU').includes(q))
      )
        return false;
      if (filters.platform && String(t.platform_id) !== filters.platform) return false;
      if (filters.specialty && String(t.specialty_id) !== filters.specialty) return false;
      if (
        filters.status &&
        (filters.status === 'unset' ? t.status_id !== null : String(t.status_id) !== filters.status)
      )
        return false;
      if (filters.completion && t.completed !== (filters.completion === 'done')) return false;
      if (filters.month && monthKey(t) !== filters.month) return false;
      if (filters.urgency && urgency(t, now) !== filters.urgency) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      const isEmail = sort.startsWith('email');
      if (isEmail && !a.email_date !== !b.email_date) return a.email_date ? -1 : 1;
      const av = isEmail ? a.email_date : a.deadline;
      const bv = isEmail ? b.email_date : b.deadline;
      const comparison = isEmail
        ? av.localeCompare(bv)
        : new Date(av).getTime() - new Date(bv).getTime();
      return comparison * (sort.endsWith('desc') ? -1 : 1) || a.id - b.id;
    });
}
