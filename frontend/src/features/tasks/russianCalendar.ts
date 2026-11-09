export const russianCalendarPeriod = '2025–2027';

const DAY = 86_400_000;
// Federal five-day calendar: https://www.cbr.ru/other/holidays/
// Transfers: decrees 04.10.2024 №1335, 24.09.2025 №1466, 17.09.2026 №1187.
const holidays = new Set([
  '01-01',
  '01-02',
  '01-03',
  '01-04',
  '01-05',
  '01-06',
  '01-07',
  '01-08',
  '02-23',
  '03-08',
  '05-01',
  '05-09',
  '06-12',
  '11-04',
]);
const extraDaysOff = new Set([
  '2025-05-02',
  '2025-05-08',
  '2025-06-13',
  '2025-11-03',
  '2025-12-31',
  '2026-01-09',
  '2026-03-09',
  '2026-05-11',
  '2026-12-31',
  '2027-02-22',
  '2027-05-03',
  '2027-05-10',
  '2027-06-14',
  '2027-11-05',
  '2027-12-31',
]);
const extraWorkingDays = new Set(['2025-11-01', '2027-02-20']);
const firstDay = Date.UTC(2025, 0, 1) / DAY;
const lastDay = Date.UTC(2027, 11, 31) / DAY;
const totals = [0];
for (let day = firstDay; day <= lastDay; day++) {
  const date = new Date(day * DAY);
  const key = date.toISOString().slice(0, 10);
  const weekday = date.getUTCDay();
  const working =
    extraWorkingDays.has(key) ||
    (weekday !== 0 && weekday !== 6 && !holidays.has(key.slice(5)) && !extraDaysOff.has(key));
  totals.push(totals[totals.length - 1] + Number(working));
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function localDay(timestamp: number, timeZone: string) {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  return Date.UTC(value('year'), value('month') - 1, value('day')) / DAY;
}

// The starting date is excluded and the ending date is included, in the card's timezone.
// Unknown years return null so callers can explicitly use calendar days instead.
export function workingDaysBetween(
  start: number,
  end: number,
  timeZone = 'Europe/Moscow',
): number | null {
  const from = localDay(start, timeZone);
  const to = localDay(end, timeZone);
  if (Math.min(from, to) < firstDay || Math.max(from, to) > lastDay) return null;
  return totals[to - firstDay + 1] - totals[from - firstDay + 1];
}
