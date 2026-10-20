import { useState, type FormEvent } from 'react';
import { Modal } from '../../shared/ui/Modal';
import {
  type Catalog,
  type SectionDefinition,
  type Task,
  type TaskInput,
} from '../../shared/types';
import { localDateTime, timezone } from './model';
import { FieldInput } from '../card-builder/FieldInput';
import { changeField, fieldValue, isCustomField } from '../card-builder/fields';

export function TaskForm({
  task,
  catalog,
  sections,
  onClose,
  onSave,
  saving,
  defaultPlatformID = catalog.find((item) => item.kind === 'platform' && !item.archived)?.id || 0,
}: {
  task: Task | null;
  catalog: Catalog[];
  sections: SectionDefinition[];
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<Task>;
  saving: boolean;
  defaultPlatformID?: number;
}) {
  const initial = task ? localDateTime(task.deadline) : '';
  const [date, setDate] = useState(initial.split('T')[0]);
  const [time, setTime] = useState(initial.split('T')[1] || '');
  const [draft, setDraft] = useState<TaskInput>({
    platform_id: task?.platform_id ?? defaultPlatformID,
    specialty_id: task?.specialty_id ?? null,
    status_id: task?.status_id ?? null,
    deadline: task?.deadline || '',
    email_date: task?.email_date || '',
    topic: task?.topic || '',
    project: task?.project || '',
    header: task?.header || '',
    preheader: task?.preheader || '',
    comment: task?.comment || '',
    owner: task?.owner || '',
    custom_fields: task?.custom_fields ?? {},
    completed: task?.completed || false,
  });
  const [error, setError] = useState('');
  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const platform = catalog.find((entry) => entry.id === draft.platform_id);
  const template = sections.find((entry) => entry.key === platform?.section);
  function options(kind: Catalog['kind'], current: number | null) {
    return catalog
      .filter((entry) => entry.kind === kind && (!entry.archived || entry.id === current))
      .map((entry) => ({
        value: String(entry.id),
        label: entry.name + (entry.archived ? ' (в архиве)' : ''),
      }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!template) {
      setError('Выберите площадку с настроенным разделом');
      return;
    }
    if (!draft.topic.trim()) {
      setError('Укажите тему');
      return;
    }
    const deadline = new Date(`${date}T${time || '23:59'}`);
    if (!Number.isFinite(deadline.getTime()) || deadline.getFullYear() < 1900) {
      setError('Укажите корректную дату дедлайна');
      return;
    }
    // A non-existent local wall-clock time (DST jump) must not be shifted silently.
    if (localDateTime(deadline.toISOString()) !== `${date}T${time || '23:59'}`) {
      setError(
        'Это время отсутствует в вашем часовом поясе из-за перевода часов. Выберите другое время.',
      );
      return;
    }
    const unchanged = task && date === initial.split('T')[0] && time === initial.split('T')[1];
    try {
      await onSave({
        ...draft,
        custom_fields: {
          ...task?.custom_fields,
          ...Object.fromEntries(
            template.fields
              .filter(isCustomField)
              .map((field) => [field.id, fieldValue(draft, field)]),
          ),
        },
        deadline: unchanged ? task.deadline : deadline.toISOString(),
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={task ? 'Редактировать запись' : 'Новая запись'}
      onClose={() => {
        if (!saving) onClose();
      }}
      wide
    >
      <form onSubmit={submit}>
        <p className="form-intro">
          Отдельная запись для каждого размещения или отправки.{' '}
          <span className="muted">* Обязательные поля</span>
        </p>
        {template && <p className="template-caption">Шаблон раздела «{template.label}»</p>}
        {template?.fields
          .filter((field) => field.visibility !== 'hidden')
          .map((field) => {
            if (field.id === 'deadline')
              return (
                <fieldset key={field.id}>
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
                    <label>
                      Время (необязательно)
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                      />
                    </label>
                  </div>
                  <p className="hint">
                    Часовой пояс: {timezone}.{' '}
                    {!time && 'Без уточнения времени: 23:59 выбранной даты.'}
                  </p>
                </fieldset>
              );
            let choices;
            if (field.id === 'platform_id') choices = options('platform', draft.platform_id);
            if (field.id === 'specialty_id') choices = options('specialty', draft.specialty_id);
            return (
              <FieldInput
                key={field.id}
                field={field}
                value={fieldValue(draft, field)}
                options={choices}
                onChange={(value) => setDraft((previous) => changeField(previous, field, value))}
              />
            );
          })}
        {!template && (
          <label>
            Площадка *
            <select
              required
              value={draft.platform_id || ''}
              onChange={(event) => update('platform_id', Number(event.target.value))}
            >
              <option value="">Выберите площадку</option>
              {options('platform', draft.platform_id).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="hint">Добавьте площадку для этого раздела в справочниках.</span>
          </label>
        )}
        <label>
          Рабочий статус
          <select
            value={draft.status_id ?? ''}
            onChange={(event) =>
              update('status_id', event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">Не задан</option>
            {options('status', draft.status_id).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {draft.email_date && date && draft.email_date < date && (
          <p className="warning" role="status">
            Дата e-mail раньше срока загрузки. Запись можно сохранить.
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={draft.completed}
            onChange={(e) => update('completed', e.target.checked)}
          />
          Выполнено <span className="muted">Независимо от рабочего статуса</span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button className="primary" disabled={saving || !template}>
            {saving ? 'Сохранение…' : 'Сохранить запись'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
