import { useState } from 'react';
import { api } from '../../shared/api/client';
import type { CardField, Catalog, SectionDefinition, Task } from '../../shared/types';
import { Modal } from '../../shared/ui/Modal';
import { UnsavedChangesDialog } from '../../shared/ui/UnsavedChangesDialog';
import { isCustomField, trackedDeadline } from './fields';
import { FieldEditor } from './FieldEditor';
import { CardPreview } from './CardPreview';

function previewTask(fields: CardField[], catalog: Catalog[], section: string, now: number): Task {
  const custom: Record<string, string> = {};
  for (const field of fields.filter(isCustomField)) {
    switch (field.type) {
      case 'datetime':
        custom[field.id] = new Date(now + 3 * 86400000).toISOString();
        break;
      case 'date':
        custom[field.id] = new Date(now).toISOString().slice(0, 10);
        break;
      case 'number':
        custom[field.id] = '125';
        break;
      case 'checkbox':
        custom[field.id] = 'true';
        break;
      case 'select':
        custom[field.id] = field.options?.[0] ?? '';
        break;
      default:
        custom[field.id] = `Пример: ${field.label.toLocaleLowerCase('ru-RU')}`;
    }
  }
  const platform = catalog.find(
    (entry) => entry.kind === 'platform' && entry.section === section && !entry.archived,
  );
  const audiences = catalog
    .filter(
      (entry) =>
        entry.kind === 'specialty' &&
        !entry.archived &&
        entry.platform_ids?.includes(platform?.id ?? 0),
    )
    .slice(0, 2);
  return {
    sms: true,
    specialty_ids: audiences.map((entry) => entry.id),
    id: 0,
    section,
    fields,
    deadline_field: 'deadline',
    platform_id: platform?.id ?? 0,
    specialty_id: audiences[0]?.id ?? null,
    status_id: catalog.find((entry) => entry.kind === 'status')?.id ?? null,
    deadline: new Date(now + 10 * 86400000).toISOString(),
    email_date: new Date(now + 12 * 86400000).toISOString().slice(0, 10),
    topic: 'Как будет выглядеть ваша карточка',
    project: 'Новый материал',
    owner: 'Мария',
    header: 'Заголовок материала',
    preheader: 'Короткое описание',
    comment: 'Здесь будут детали и заметки команды.',
    custom_fields: custom,
    completed: false,
    completed_at: null,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

export function CardBuilder({
  section,
  catalog,
  onClose,
  onSaved,
}: {
  section: SectionDefinition;
  catalog: Catalog[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [fields, setFields] = useState<CardField[]>(() => structuredClone(section.fields));
  const [deadlineField, setDeadlineField] = useState(section.deadline_field || 'deadline');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);
  const [discarding, setDiscarding] = useState(false);
  const [tab, setTab] = useState('settings');
  const dirty =
    JSON.stringify(fields) !== JSON.stringify(section.fields) ||
    deadlineField !== (section.deadline_field || 'deadline');
  const example = previewTask(fields, catalog, section.key, now);
  example.base_date = example.deadline;
  example.deadline_field = deadlineField;
  example.deadline = trackedDeadline(example, fields) || example.deadline;

  function select(id: string | null) {
    setSelected(id);
    setSelectionVersion((previous) => previous + 1);
  }
  function close() {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/sections/${section.key}`, 'PUT', {
        ...section,
        fields,
        deadline_field: deadlineField,
      });
      await onSaved();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Шаблон карточки" wide layout="builder" onClose={close}>
      <p className="form-intro">
        Набор полей для новых карточек раздела «{section.label}». Существующие карточки сохранят
        свои поля.
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
          <FieldEditor
            fields={fields}
            previousFields={section.fields}
            onChange={setFields}
            selected={selected}
            selectionVersion={selectionVersion}
            onSelect={select}
            deadlineField={deadlineField}
            onDeadlineChange={setDeadlineField}
            busy={busy}
          />
        </div>
        <CardPreview
          task={example}
          fields={fields}
          catalog={catalog}
          now={now}
          selected={selected}
          onSelect={select}
          onChange={setFields}
          busy={busy}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {discarding && (
        <UnsavedChangesDialog onContinue={() => setDiscarding(false)} onDiscard={onClose} />
      )}
      <div className="modal-actions">
        <button disabled={busy} onClick={close}>
          Отмена
        </button>
        <button className="primary" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? 'Сохранение…' : 'Сохранить шаблон'}
        </button>
      </div>
    </Modal>
  );
}
