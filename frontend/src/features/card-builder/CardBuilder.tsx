import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import type { CardField, Catalog, SectionDefinition, Task } from '../../shared/types';
import { Modal } from '../../shared/ui/Modal';
import { TaskCard } from '../tasks/TaskCard';
import { fieldTypeLabels, isCustomField, moveField, visibilityLabels } from './fields';

const customTypes: CardField['type'][] = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'checkbox',
];

function previewTask(fields: CardField[], catalog: Catalog[], section: string, now: number): Task {
  const custom: Record<string, string> = {};
  for (const field of fields.filter(isCustomField)) {
    switch (field.type) {
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
  return {
    id: 0,
    platform_id:
      catalog.find((entry) => entry.kind === 'platform' && entry.section === section)?.id ?? 0,
    specialty_id: catalog.find((entry) => entry.kind === 'specialty')?.id ?? null,
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
  const [fields, setFields] = useState<CardField[]>(() =>
    section.fields.map((field) => ({
      ...field,
      options: field.options ? [...field.options] : undefined,
    })),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<CardField['type']>('text');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);
  const [discarding, setDiscarding] = useState(false);
  const dirty = JSON.stringify(fields) !== JSON.stringify(section.fields);
  const savedIDs = new Set(section.fields.map((field) => field.id));

  function update(id: string, changes: Partial<CardField>) {
    setFields((previous) =>
      previous.map((field) => (field.id === id ? { ...field, ...changes } : field)),
    );
  }

  function close() {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (!newLabel.trim() || fields.length >= 60) return;
    const field: CardField = {
      id: `custom_${crypto.randomUUID()}`,
      label: newLabel.trim(),
      type: newType,
      required: false,
      visibility: 'details',
    };
    if (newType === 'select') field.options = ['Вариант 1', 'Вариант 2'];
    setFields((previous) => [...previous, field]);
    setExpanded(field.id);
    setNewLabel('');
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/sections/${section.key}`, 'PUT', { ...section, fields });
      await onSaved();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Конструктор карточки" wide onClose={close}>
      <div className="builder-heading">
        <span className="builder-section">{section.label}</span>
        <span className="muted">{fields.length} / 60 полей</span>
      </div>
      <p className="form-intro">
        Настройте поля для всех записей раздела. Порядок применяется и к форме заполнения. Тема и
        площадка остаются в шапке карточки.
      </p>
      <div className="builder-legend">
        <span>В карточке</span>
        <span>В подробностях</span>
        <span>Скрыто</span>
      </div>
      <fieldset className="builder-fields" disabled={busy}>
        <legend className="sr-only">Поля карточки</legend>
        {fields.map((field, index) => {
          const custom = isCustomField(field);
          const core = ['topic', 'platform_id', 'deadline'].includes(field.id);
          const inHeader = field.id === 'topic' || field.id === 'platform_id';
          return (
            <details
              className={`builder-field ${field.visibility === 'hidden' ? 'is-hidden' : ''}`}
              key={field.id}
              open={expanded === field.id}
            >
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setExpanded(expanded === field.id ? null : field.id);
                }}
              >
                <span className="builder-field-number">{index + 1}</span>
                <span className="builder-field-name">
                  {field.label || 'Без названия'}
                  {field.required && <span className="accent"> *</span>}
                  <small>
                    {fieldTypeLabels[field.type]}
                    {!custom && ' · основное поле'}
                  </small>
                </span>
                <span className={`field-visibility ${field.visibility}`}>
                  {visibilityLabels[field.visibility]}
                </span>
                <span aria-hidden="true">{expanded === field.id ? '−' : '+'}</span>
              </summary>
              <div className="builder-field-settings">
                <label>
                  Название поля
                  <input
                    required
                    maxLength={150}
                    value={field.label}
                    onChange={(event) => update(field.id, { label: event.target.value })}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Тип поля
                    <select
                      disabled={!custom || savedIDs.has(field.id)}
                      value={field.type}
                      onChange={(event) => {
                        const type = event.target.value as CardField['type'];
                        update(field.id, {
                          type,
                          options: type === 'select' ? ['Вариант 1', 'Вариант 2'] : undefined,
                        });
                      }}
                    >
                      {custom ? (
                        customTypes.map((type) => (
                          <option key={type} value={type}>
                            {fieldTypeLabels[type]}
                          </option>
                        ))
                      ) : (
                        <option value={field.type}>{fieldTypeLabels[field.type]}</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Отображение
                    <select
                      disabled={inHeader}
                      value={field.visibility}
                      onChange={(event) => {
                        const visibility = event.target.value as CardField['visibility'];
                        update(field.id, {
                          visibility,
                          required: visibility === 'hidden' ? false : field.required,
                        });
                      }}
                    >
                      <option value="summary">В свёрнутой карточке</option>
                      <option value="details">В подробностях</option>
                      {!core && <option value="hidden">Скрыть в карточке и форме</option>}
                    </select>
                  </label>
                </div>
                {field.type === 'select' && (
                  <label>
                    Варианты списка — каждый с новой строки
                    <textarea
                      rows={4}
                      value={(field.options ?? []).join('\n')}
                      onChange={(event) =>
                        update(field.id, { options: event.target.value.split('\n') })
                      }
                    />
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={core || field.visibility === 'hidden'}
                    onChange={(event) => update(field.id, { required: event.target.checked })}
                  />
                  Обязательное поле
                </label>
                <div className="builder-field-actions">
                  <button
                    disabled={index === 0}
                    aria-label={`Поле «${field.label}» выше`}
                    onClick={() => {
                      setFields(moveField(fields, index, -1));
                    }}
                  >
                    ↑ Выше
                  </button>
                  <button
                    disabled={index === fields.length - 1}
                    aria-label={`Поле «${field.label}» ниже`}
                    onClick={() => {
                      setFields(moveField(fields, index, 1));
                    }}
                  >
                    ↓ Ниже
                  </button>
                  {custom && !savedIDs.has(field.id) && (
                    <button
                      className="danger-subtle"
                      onClick={() => {
                        setFields(fields.filter((entry) => entry.id !== field.id));
                      }}
                    >
                      Удалить поле
                    </button>
                  )}
                </div>
                {custom && savedIDs.has(field.id) && (
                  <p className="hint">
                    Тип сохранённого поля закреплён. Ненужное поле можно скрыть — введённые значения
                    сохранятся.
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </fieldset>
      <form className="builder-add" onSubmit={add}>
        <div className="form-grid">
          <label>
            Новое поле
            <input
              maxLength={150}
              value={newLabel}
              disabled={busy || fields.length >= 60}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Например, бюджет или дата согласования"
            />
          </label>
          <label>
            Тип
            <select
              disabled={busy}
              value={newType}
              onChange={(event) => setNewType(event.target.value as CardField['type'])}
            >
              {customTypes.map((type) => (
                <option key={type} value={type}>
                  {fieldTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy || !newLabel.trim() || fields.length >= 60}>
          ＋ Добавить поле
        </button>
      </form>
      <section className="builder-preview" aria-label="Предпросмотр карточки">
        <div className="builder-preview-heading">
          <h3>Предпросмотр</h3>
          <span className="muted">Пример данных</span>
        </div>
        <TaskCard
          task={previewTask(fields, catalog, section.key, now)}
          catalog={catalog}
          fields={fields}
          now={now}
          busy={false}
          preview
          onEdit={() => {}}
          onDelete={() => {}}
          onPatch={async () => {}}
        />
        <p className="hint">Нажмите на карточку, чтобы посмотреть подробности.</p>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {discarding && (
        <div className="builder-discard" role="alert">
          <p>Закрыть без сохранения изменений?</p>
          <button disabled={busy} onClick={() => setDiscarding(false)}>
            Продолжить настройку
          </button>
          <button className="danger-subtle" disabled={busy} onClick={onClose}>
            Не сохранять
          </button>
        </div>
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
