import { useState, type FormEvent } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { UnsavedChangesDialog } from '../../shared/ui/UnsavedChangesDialog';
import { api } from '../../shared/api/client';
import type { CardField, Catalog, SectionDefinition, Task, TaskInput } from '../../shared/types';
import { localDateTime, timezone } from './model';
import { FieldInput } from '../card-builder/FieldInput';
import {
  audienceIDs,
  builtinFields,
  changeField,
  defaultFields,
  fieldValue,
  trackedDeadline,
} from '../card-builder/fields';
import { FieldEditor } from '../card-builder/FieldEditor';
import { CardPreview } from '../card-builder/CardPreview';

export function TaskForm({
  task,
  catalog,
  sections,
  defaultSection,
  defaultPlatformID = 0,
  onClose,
  onSave,
  onTemplateSaved,
  saving,
}: {
  task: Task | null;
  catalog: Catalog[];
  sections: SectionDefinition[];
  defaultSection: string;
  defaultPlatformID?: number;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<Task>;
  onTemplateSaved: () => Promise<void>;
  saving: boolean;
}) {
  const initialSection = task?.section || defaultSection;
  const template = sections.find((section) => section.key === initialSection);
  const initialFields = structuredClone(task?.fields ?? template?.fields ?? defaultFields());
  if (!task && defaultPlatformID) {
    const field = initialFields.find((field) => field.id === 'platform_id');
    if (field) field.visibility = 'summary';
    else initialFields.push({ ...builtinFields.find((field) => field.id === 'platform_id')! });
  }
  const initialDate = task ? localDateTime(task.base_date || task.deadline) : '';
  const [date, setDate] = useState(initialDate.split('T')[0]);
  const [showTime, setShowTime] = useState(false);
  const [time, setTime] = useState(initialDate.split('T')[1] || '');
  const [fields, setFields] = useState<CardField[]>(() => structuredClone(initialFields));
  const [draft, setDraft] = useState<TaskInput>({
    section: initialSection,
    platform_id: task?.platform_id ?? defaultPlatformID,
    specialty_ids: task ? audienceIDs(task) : [],
    sms: task?.sms ?? false,
    specialty_id: task?.specialty_id ?? null,
    status_id: task?.status_id ?? null,
    deadline: task?.deadline || '',
    base_date: task?.base_date || task?.deadline || '',
    deadline_field: task?.deadline_field || template?.deadline_field || 'deadline',
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
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [tab, setTab] = useState('settings');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [now] = useState(Date.now);
  const busy = saving || savingTemplate;
  const [initialValues] = useState(() => JSON.stringify({ draft, fields, date, time }));
  const dirty = JSON.stringify({ draft, fields, date, time }) !== initialValues;
  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  function select(id: string | null) {
    setSelected(id);
    setSelectionVersion((previous) => previous + 1);
  }
  function close() {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }

  function baseDate() {
    if (!date) return '';
    if (task && date === initialDate.split('T')[0] && time === initialDate.split('T')[1])
      return task.base_date || task.deadline;
    const value = `${date}T${time || '23:59'}`;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || localDateTime(parsed.toISOString()) !== value)
      return '';
    return parsed.toISOString();
  }
  const previewInput = { ...draft, base_date: baseDate() };
  const sourceField = fields.find((field) => field.id === draft.deadline_field);
  const keepTrackedDate =
    task &&
    sourceField?.type === 'date' &&
    task.deadline_field === draft.deadline_field &&
    fieldValue(task, sourceField) === fieldValue(draft, sourceField);
  const deadline = keepTrackedDate ? task.deadline : trackedDeadline(previewInput, fields);
  const deadlineTimezone = task?.timezone || timezone;
  const preview: Task = {
    ...previewInput,
    date_deadlines: undefined,
    fields,
    deadline: deadline || new Date(now + 86400000).toISOString(),
    id: task?.id || 0,
    completed_at: task?.completed_at || null,
    created_at: task?.created_at || new Date(now).toISOString(),
    updated_at: task?.updated_at || new Date(now).toISOString(),
  };

  function options(kind: Catalog['kind'], current: number | null) {
    return catalog
      .filter(
        (entry) =>
          entry.kind === kind &&
          (!entry.archived || entry.id === current) &&
          (kind !== 'platform' || entry.section === draft.section),
      )
      .map((entry) => ({
        value: String(entry.id),
        label: entry.name + (entry.archived ? ' (в архиве)' : ''),
      }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!baseDate()) {
      setError('Укажите корректную основную дату и время в вашем часовом поясе.');
      return;
    }
    if (!deadline) {
      setError('Заполните выбранную дату для отсчёта дедлайна.');
      return;
    }
    try {
      await onSave({
        ...draft,
        fields,
        base_date: baseDate(),
        deadline,
        timezone: deadlineTimezone,
      });
      onClose();
    } catch (error) {
      setError((error as Error).message);
    }
  }

  async function saveTemplate() {
    const destination = sections.find((section) => section.key === draft.section);
    if (!destination) return;
    setSavingTemplate(true);
    setError('');
    setNotice('');
    try {
      await api(`/sections/${destination.key}`, 'PUT', {
        ...destination,
        fields,
        deadline_field: draft.deadline_field,
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

  function input(field: CardField) {
    if (field.id === 'deadline')
      return (
        <fieldset>
          <legend>{field.label} *</legend>
          <div className="form-grid">
            <label>
              Дата
              <input
                type="date"
                min="1900-01-01"
                max="9999-12-31"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            {showTime && (
              <label>
                Время (необязательно)
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              </label>
            )}
          </div>
          <button
            type="button"
            className="reset"
            aria-expanded={showTime}
            onClick={() => setShowTime(!showTime)}
          >
            {showTime ? 'Скрыть время' : 'Указать точное время'}
          </button>
        </fieldset>
      );
    if (field.id === 'specialty_id') {
      const selected = audienceIDs(draft);
      const choices = catalog.filter(
        (entry) =>
          entry.kind === 'specialty' &&
          ((!entry.archived && (entry.platform_ids ?? []).includes(draft.platform_id)) ||
            selected.includes(entry.id)),
      );
      return (
        <fieldset>
          <legend>
            {field.label}
            {field.required ? ' *' : ''}
          </legend>
          {!draft.platform_id && (
            <p className="hint">Выберите площадку, чтобы увидеть её аудитории.</p>
          )}
          {!draft.platform_id &&
            !fields.some(
              (entry) => entry.id === 'platform_id' && entry.visibility !== 'hidden',
            ) && (
              <button
                type="button"
                disabled={
                  fields.length >= 60 && !fields.some((entry) => entry.id === 'platform_id')
                }
                onClick={() => {
                  const preset = builtinFields.find((entry) => entry.id === 'platform_id');
                  if (preset)
                    setFields((previous) => [
                      ...previous.filter((entry) => entry.id !== preset.id),
                      { ...preset },
                    ]);
                }}
              >
                Добавить поле «Площадка»
              </button>
            )}
          {draft.platform_id > 0 && choices.length === 0 && (
            <p className="hint">Добавьте аудитории этой площадки в справочниках.</p>
          )}
          <div className="audience-options">
            {choices.map((entry) => (
              <label className="check" key={entry.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(entry.id)}
                  onChange={(event) => {
                    const ids = event.target.checked
                      ? [...selected, entry.id]
                      : selected.filter((id) => id !== entry.id);
                    setDraft((previous) => ({
                      ...previous,
                      specialty_ids: ids,
                      specialty_id: ids[0] ?? null,
                    }));
                  }}
                />
                {entry.name}
                {entry.archived ? ' (архив)' : ''}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    let choices;
    if (field.id === 'platform_id') choices = options('platform', draft.platform_id);
    if (field.id === 'status_id') choices = options('status', draft.status_id);
    return (
      <FieldInput
        field={field}
        value={fieldValue(draft, field)}
        options={choices}
        onChange={(value) =>
          setDraft((previous) => {
            const next = changeField(previous, field, value);
            if (field.id === 'platform_id' && next.platform_id !== previous.platform_id) {
              next.specialty_ids = audienceIDs(previous).filter((id) =>
                catalog.find((entry) => entry.id === id)?.platform_ids?.includes(next.platform_id),
              );
              next.specialty_id = next.specialty_ids[0] ?? null;
            }
            return next;
          })
        }
      />
    );
  }

  return (
    <Modal
      title={task ? 'Редактировать карточку' : 'Новая карточка'}
      wide
      layout="builder"
      onClose={close}
    >
      <form onSubmit={submit}>
        <p className="form-intro">
          Название и дата — всё, что нужно для начала. Остальные поля добавляйте по необходимости.
        </p>
        <div className="builder-tabs tabs" role="group" aria-label="Вид редактора">
          <button
            type="button"
            className={tab === 'settings' ? 'active' : ''}
            aria-pressed={tab === 'settings'}
            onClick={() => setTab('settings')}
          >
            Настройки
          </button>
          <button
            type="button"
            className={tab === 'preview' ? 'active' : ''}
            aria-pressed={tab === 'preview'}
            onClick={() => setTab('preview')}
          >
            Превью
          </button>
        </div>
        <div className={`builder-layout show-${tab}`}>
          <div className="builder-settings">
            {task && (
              <label>
                Раздел
                <select
                  disabled={busy}
                  value={draft.section}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      section: event.target.value,
                      platform_id: 0,
                      specialty_ids: [],
                      specialty_id: null,
                    }))
                  }
                >
                  {sections.map((section) => (
                    <option key={section.key} value={section.key}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <FieldEditor
              fields={fields}
              previousFields={task?.fields ?? []}
              onChange={setFields}
              selected={selected}
              selectionVersion={selectionVersion}
              onSelect={select}
              deadlineField={draft.deadline_field || 'deadline'}
              onDeadlineChange={(value) => update('deadline_field', value)}
              busy={busy}
              renderInput={input}
            />
            <button
              type="button"
              className="save-template"
              disabled={busy || !template}
              onClick={() => void saveTemplate()}
            >
              {savingTemplate ? 'Сохранение…' : 'Сохранить набор как шаблон раздела'}
            </button>
            <p className="hint">
              Шаблон содержит названия и расположение полей. Введённые значения в него не входят.
            </p>
            {task && (
              <label className="check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={draft.completed}
                  onChange={(event) => update('completed', event.target.checked)}
                />
                Выполнено
              </label>
            )}
          </div>
          <CardPreview
            task={preview}
            fields={fields}
            catalog={catalog}
            now={now}
            selected={selected}
            onSelect={select}
            onChange={setFields}
            busy={busy}
          />
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {discarding && (
          <UnsavedChangesDialog onContinue={() => setDiscarding(false)} onDiscard={onClose} />
        )}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={close}>
            Отмена
          </button>
          <button className="primary" disabled={busy}>
            {saving ? 'Сохранение…' : 'Сохранить карточку'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
