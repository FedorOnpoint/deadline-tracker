export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function localDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
