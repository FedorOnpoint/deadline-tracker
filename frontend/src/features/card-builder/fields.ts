import type { CardField, Catalog, TaskInput } from '../../shared/types';
import { formatDate } from '../tasks/model';

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
    case 'topic':
      return task.topic;
    case 'platform_id':
      return String(task.platform_id || '');
    case 'specialty_id':
      return String(task.specialty_id ?? '');
    case 'deadline':
      return task.deadline;
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
    case 'platform_id':
      return { ...task, platform_id: Number(value) };
    case 'specialty_id':
      return { ...task, specialty_id: value ? Number(value) : null };
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
  if (!value) return '';
  if (field.type === 'catalog')
    return catalog.find((entry) => String(entry.id) === value)?.name ?? '';
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'datetime') return formatDate(value, true);
  if (field.type === 'checkbox') return value === 'true' ? 'Да' : 'Нет';
  return value;
}

export function moveField(fields: CardField[], index: number, direction: -1 | 1) {
  const next = [...fields];
  const destination = index + direction;
  if (destination < 0 || destination >= fields.length) return fields;
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}
