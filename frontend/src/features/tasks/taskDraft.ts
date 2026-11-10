import type { CardField, SectionDefinition, Task, TaskInput } from '../../shared/types';
import { localDateTime, timezone } from '../../shared/dates';
import {
  audienceIDs,
  builtinFields,
  dateFields,
  defaultFields,
  earliestDeadline,
  fieldValue,
} from '../card-builder/fields';

export type TaskEditor = {
  fields: CardField[];
  draft: TaskInput;
  date: string;
  time: string;
};

export function initialTaskEditor(
  task: Task | null,
  sections: SectionDefinition[],
  defaultSection: string,
  defaultPlatformID: number,
): TaskEditor {
  const initialSection = task?.section || defaultSection;
  const template = sections.find((section) => section.key === initialSection);
  const initialFields = structuredClone(task?.fields ?? template?.fields ?? defaultFields());
  if (!task && defaultPlatformID) {
    const field = initialFields.find((field) => field.id === 'platform_id');
    if (field) field.visibility = 'summary';
    else initialFields.push({ ...builtinFields.find((field) => field.id === 'platform_id')! });
  }
  const initialDate = task ? localDateTime(task.base_date || task.deadline) : '';
  const initialDraft: TaskInput = {
    section: initialSection,
    platform_id: task?.platform_id ?? defaultPlatformID,
    specialty_ids: task ? audienceIDs(task) : [],
    sms: task?.sms ?? false,
    specialty_id: task?.specialty_id ?? null,
    status_id: task?.status_id ?? null,
    deadline: task?.deadline || '',
    base_date: task?.base_date || task?.deadline || '',
    deadline_field: 'deadline',
    timezone: task?.timezone || timezone,
    email_date: task?.email_date || '',
    topic: task?.topic || '',
    project: task?.project || '',
    header: task?.header || '',
    preheader: task?.preheader || '',
    comment: task?.comment || '',
    owner: task?.owner || '',
    custom_fields: { ...task?.custom_fields },
    completed: task?.completed || false,
    completed_date_fields: task?.completed_date_fields,
  };

  return {
    fields: initialFields,
    draft: initialDraft,
    date: initialDate.split('T')[0],
    time: initialDate.split('T')[1] || '',
  };
}

export function taskBaseDate(task: Task | null, date: string, time: string) {
  if (!date) return '';
  const initialDate = task ? localDateTime(task.base_date || task.deadline) : '';
  if (task && date === initialDate.split('T')[0] && time === initialDate.split('T')[1])
    return task.base_date || task.deadline;
  const value = `${date}T${time || '23:59'}`;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || localDateTime(parsed.toISOString()) !== value)
    return '';
  return parsed.toISOString();
}

export function taskPreview(
  task: Task | null,
  editor: TaskEditor,
  baseDate: string,
  now: number,
): Task {
  const savedDates: Record<string, string> = {};
  const input = { ...editor.draft, base_date: baseDate, date_deadlines: savedDates };
  for (const field of dateFields(editor.fields)) {
    const saved = task?.date_deadlines?.[field.id];
    if (saved && task && fieldValue(task, field) === fieldValue(input, field))
      savedDates[field.id] = saved;
  }
  const deadline = earliestDeadline(input, editor.fields);
  return {
    ...input,
    fields: editor.fields,
    has_active_deadlines: Boolean(deadline),
    deadline: deadline || new Date(now + 86400000).toISOString(),
    id: task?.id || 0,
    completed_at: task?.completed_at || null,
    created_at: task?.created_at || new Date(now).toISOString(),
    updated_at: task?.updated_at || new Date(now).toISOString(),
  };
}
