import { useState } from 'react';
import { api } from '../../shared/api/client';
import type { CardField, Catalog, SectionDefinition, Task, TaskInput } from '../../shared/types';
import { timezone } from '../../shared/dates';
import { audienceIDs, builtinFields, changeField, earliestDeadline } from '../card-builder/fields';
import { useEditorHistory } from '../card-builder/useEditorHistory';
import { initialTaskEditor, taskBaseDate, taskPreview } from './taskDraft';

export type TaskFormOptions = {
  task: Task | null;
  catalog: Catalog[];
  sections: SectionDefinition[];
  defaultSection: string;
  defaultPlatformID?: number;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<Task>;
  onTemplateSaved: () => Promise<void>;
  saving: boolean;
  canManage?: boolean;
};

export function useTaskForm({
  task,
  catalog,
  sections,
  defaultSection,
  defaultPlatformID = 0,
  onClose,
  onSave,
  onTemplateSaved,
  saving,
}: TaskFormOptions) {
  const [editor, setEditor, history] = useEditorHistory(() =>
    initialTaskEditor(task, sections, defaultSection, defaultPlatformID),
  );
  const [initialValues] = useState(() => JSON.stringify(editor));
  const [now] = useState(Date.now);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const initialSection = task?.section || defaultSection;
  const template = sections.find((section) => section.key === initialSection);
  const baseDate = taskBaseDate(task, editor.date, editor.time);
  const preview = taskPreview(task, editor, baseDate, now);
  const deadline = earliestDeadline(preview, editor.fields);
  const busy = saving || savingTemplate;
  const dirty = JSON.stringify(editor) !== initialValues;

  function changeFields(fields: CardField[]) {
    setEditor((previous) => ({ ...previous, fields }));
  }
  function changeDate(date: string) {
    setEditor((previous) => ({ ...previous, date }));
  }
  function changeTime(time: string) {
    setEditor((previous) => ({ ...previous, time }));
  }
  function changeCompleted(completed: boolean) {
    setEditor((previous) => ({ ...previous, draft: { ...previous.draft, completed } }));
  }
  function changeSection(section: string) {
    setEditor((previous) => ({
      ...previous,
      draft: { ...previous.draft, section, platform_id: 0, specialty_ids: [], specialty_id: null },
    }));
  }
  function changeAudiences(ids: number[]) {
    setEditor((previous) => ({
      ...previous,
      draft: { ...previous.draft, specialty_ids: ids, specialty_id: ids[0] ?? null },
    }));
  }
  function changeValue(field: CardField, value: string) {
    setEditor((previous) => {
      const draft = changeField(previous.draft, field, value);
      if (field.id === 'platform_id' && draft.platform_id !== previous.draft.platform_id) {
        draft.specialty_ids = audienceIDs(previous.draft).filter((id) =>
          catalog.find((entry) => entry.id === id)?.platform_ids?.includes(draft.platform_id),
        );
        draft.specialty_id = draft.specialty_ids[0] ?? null;
      }
      return { ...previous, draft };
    });
  }
  function addPlatformField() {
    const preset = builtinFields.find((field) => field.id === 'platform_id');
    if (preset)
      setEditor((previous) => ({
        ...previous,
        fields: [...previous.fields.filter((field) => field.id !== preset.id), { ...preset }],
      }));
  }
  async function save() {
    setError('');
    if (!baseDate) {
      setError('Укажите корректную дату и время в вашем часовом поясе.');
      return;
    }
    if (!deadline) {
      setError('Укажите корректную дату.');
      return;
    }
    try {
      await onSave({
        ...editor.draft,
        fields: editor.fields,
        base_date: baseDate,
        deadline,
        timezone: task?.timezone || timezone,
      });
      onClose();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function saveTemplate() {
    const destination = sections.find((section) => section.key === editor.draft.section);
    if (!destination) return;
    setSavingTemplate(true);
    setError('');
    setNotice('');
    try {
      await api(`/sections/${destination.key}`, 'PUT', {
        ...destination,
        fields: editor.fields,
        deadline_field: editor.draft.deadline_field,
      });
      setNotice(
        `Шаблон раздела «${destination.label}» сохранён. Новые карточки получат этот набор полей.`,
      );
      await onTemplateSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSavingTemplate(false);
    }
  }
  return {
    editor,
    history,
    preview,
    now,
    template,
    busy,
    dirty,
    error,
    notice,
    savingTemplate,
    clearError: () => setError(''),
    changeFields,
    changeDate,
    changeTime,
    changeCompleted,
    changeSection,
    changeAudiences,
    changeValue,
    addPlatformField,
    save,
    saveTemplate,
  };
}
