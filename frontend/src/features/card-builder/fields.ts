import type { CardField, Catalog, TaskInput } from '../../shared/types';
import { formatDate, localDateTime } from '../tasks/model';

export const builtinFields: CardField[] = [
  { id: 'topic', label: 'Название', type: 'textarea', required: true, visibility: 'summary' },
  { id: 'deadline', label: 'Дата', type: 'datetime', required: true, visibility: 'summary' },
  { id: 'platform_id', label: 'Площадка', type: 'catalog', required: false, visibility: 'summary' },
  {
    id: 'status_id',
    label: 'Рабочий статус',
    type: 'catalog',
    required: false,
    visibility: 'summary',
  },
  { id: 'email_date', label: 'Дата e-mail', type: 'date', required: false, visibility: 'summary' },
  {
    id: 'specialty_id',
    label: 'Аудитории',
    type: 'catalog',
    required: false,
    visibility: 'details',
  },
  { id: 'sms', label: 'SMS', type: 'checkbox', required: false, visibility: 'summary' },
  { id: 'project', label: 'Проект', type: 'text', required: false, visibility: 'summary' },
  { id: 'owner', label: 'Ответственный', type: 'text', required: false, visibility: 'details' },
  { id: 'header', label: 'Хедер', type: 'textarea', required: false, visibility: 'details' },
  { id: 'preheader', label: 'Прехедер', type: 'textarea', required: false, visibility: 'details' },
  { id: 'comment', label: 'Комментарий', type: 'textarea', required: false, visibility: 'details' },
];

export const standardFields: CardField[] = [
  {
    id: 'custom_preset_priority',
    label: 'Приоритет',
    type: 'select',
    required: false,
    visibility: 'summary',
    options: ['Низкий', 'Обычный', 'Высокий', 'Критичный'],
  },
  {
    id: 'custom_preset_start_date',
    label: 'Дата начала',
    type: 'date',
    required: false,
    visibility: 'summary',
  },
  {
    id: 'custom_preset_approval_date',
    label: 'Дата согласования',
    type: 'date',
    required: false,
    visibility: 'summary',
  },
  {
    id: 'custom_preset_publication_date',
    label: 'Дата публикации',
    type: 'date',
    required: false,
    visibility: 'summary',
  },
  {
    id: 'custom_preset_material_link',
    label: 'Ссылка на материал',
    type: 'text',
    required: false,
    visibility: 'details',
  },
  {
    id: 'custom_preset_next_step',
    label: 'Следующий шаг',
    type: 'textarea',
    required: false,
    visibility: 'summary',
  },
  {
    id: 'custom_preset_progress',
    label: 'Прогресс',
    type: 'select',
    required: false,
    visibility: 'summary',
    options: ['0%', '25%', '50%', '75%', '100%'],
  },
  {
    id: 'custom_preset_blocker',
    label: 'Причина блокировки',
    type: 'textarea',
    required: false,
    visibility: 'details',
  },
];

export function defaultFields() {
  return builtinFields.slice(0, 2).map((field) => ({ ...field }));
}

export const fieldTypeLabels: Record<CardField['type'], string> = {
  text: 'Текст',
  textarea: 'Длинный текст',
  number: 'Число',
  date: 'Дата',
  datetime: 'Дата и время',
  select: 'Список',
  checkbox: 'Флажок',
  catalog: 'Справочник',
};

export const visibilityLabels: Record<CardField['visibility'], string> = {
  summary: 'В карточке',
  details: 'В подробностях',
  hidden: 'Скрыто',
};

export function isCustomField(field: CardField) {
  return field.id.startsWith('custom_');
}

export function fieldValue(task: TaskInput, field: CardField): string {
  switch (field.id) {
    case 'sms':
      return String(task.sms ?? false);
    case 'topic':
      return task.topic;
    case 'platform_id':
      return String(task.platform_id || '');
    case 'specialty_id':
      return String(task.specialty_id ?? '');
    case 'status_id':
      return String(task.status_id ?? '');
    case 'deadline':
      return task.base_date ?? task.deadline;
    case 'email_date':
      return task.email_date;
    case 'project':
      return task.project;
    case 'owner':
      return task.owner;
    case 'header':
      return task.header;
    case 'preheader':
      return task.preheader;
    case 'comment':
      return task.comment;
    default:
      return task.custom_fields[field.id] ?? '';
  }
}

export function changeField(task: TaskInput, field: CardField, value: string): TaskInput {
  switch (field.id) {
    case 'sms':
      return { ...task, sms: value === 'true' };
    case 'platform_id':
      return { ...task, platform_id: Number(value) };
    case 'specialty_id':
      return { ...task, specialty_id: value ? Number(value) : null };
    case 'status_id':
      return { ...task, status_id: value ? Number(value) : null };
    case 'deadline':
      return { ...task, base_date: value };
    case 'topic':
    case 'email_date':
    case 'project':
    case 'owner':
    case 'header':
    case 'preheader':
    case 'comment':
      return { ...task, [field.id]: value };
    default:
      return { ...task, custom_fields: { ...task.custom_fields, [field.id]: value } };
  }
}

export function displayFieldValue(task: TaskInput, field: CardField, catalog: Catalog[]): string {
  const value = fieldValue(task, field);
  if (field.id === 'specialty_id')
    return audienceIDs(task)
      .map((id) => catalog.find((entry) => entry.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  if (field.id === 'deadline') return value ? formatDate(localDateTime(value).slice(0, 10)) : '';
  if (!value) return '';
  if (field.type === 'catalog')
    return catalog.find((entry) => String(entry.id) === value)?.name ?? '';
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'datetime') return formatDate(value, true);
  if (field.type === 'checkbox') return value === 'true' ? 'Да' : 'Нет';
  return value;
}

export function dateFields(fields: CardField[]) {
  return fields.filter(
    (field) =>
      field.visibility !== 'hidden' && (field.type === 'date' || field.type === 'datetime'),
  );
}

export function trackedDeadline(task: TaskInput, fields: CardField[]) {
  const field = fields.find((field) => field.id === (task.deadline_field || 'deadline'));
  if (!field) return '';
  const value = fieldValue(task, field);
  if (!value) return '';
  const parsed = new Date(field.type === 'date' ? `${value}T23:59` : value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '';
}

export function dateTimeInput(value: string) {
  return value ? localDateTime(value) : '';
}

export function audienceIDs(task: Pick<TaskInput, 'specialty_id' | 'specialty_ids'>) {
  return task.specialty_ids ?? (task.specialty_id ? [task.specialty_id] : []);
}

export function fieldDeadline(task: TaskInput, field: CardField) {
  const saved = task.date_deadlines?.[field.id];
  if (saved) return saved;
  return trackedDeadline({ ...task, deadline_field: field.id }, [field]);
}
