import { ColorDot } from '../../shared/ui/ColorDot';
import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import { Modal } from '../../shared/ui/Modal';
import {
  type SectionDefinition,
  type TaskSection,
  type Catalog,
  type CatalogKind,
} from '../../shared/types';

const kinds: { key: CatalogKind; label: string }[] = [
  { key: 'status', label: 'Статусы' },
  { key: 'platform', label: 'Площадки' },
  { key: 'specialty', label: 'Специальности' },
];
export function CatalogManager({
  catalog,
  sections,
  defaultSection,
  initialKind = 'status',
  onClose,
  onSaved,
}: {
  catalog: Catalog[];
  sections: SectionDefinition[];
  defaultSection: string;
  initialKind?: CatalogKind;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<CatalogKind>(initialKind);
  const [editing, setEditing] = useState<Catalog | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#aac4d6');
  const [section, setSection] = useState<TaskSection>(defaultSection);
  const [platformIDs, setPlatformIDs] = useState<number[]>([]);
  const [reminderText, setReminderText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const items = catalog.filter((item) => item.kind === kind);
  async function save(item: Partial<Catalog> & { name: string }) {
    setBusy(true);
    setError('');
    try {
      await api(`/catalog${item.id ? `/${item.id}` : ''}`, item.id ? 'PUT' : 'POST', {
        kind,
        color,
        position: 0,
        archived: false,
        ...item,
      });
      await onSaved();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await save({
        ...editing,
        name: name.trim(),
        color,
        section,
        platform_ids: kind === 'specialty' ? platformIDs : [],
        reminder_text: kind === 'status' ? reminderText : '',
      })
    ) {
      setEditing(null);
      setName('');
      setColor('#aac4d6');
      setSection(defaultSection);
      setPlatformIDs([]);
      setReminderText('');
    }
  }
  function edit(item: Catalog) {
    setEditing(item);
    setName(item.name);
    setColor(item.color);
    setSection(item.section);
    setPlatformIDs(item.platform_ids ?? []);
    setReminderText(item.reminder_text ?? '');
  }
  return (
    <Modal
      title="Справочники"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <p className="form-intro">
        Переименование сохраняет связи. Архивные значения остаются в существующих записях.
      </p>
      <div className="tabs" role="group" aria-label="Тип справочника">
        {kinds.map((k) => (
          <button
            key={k.key}
            disabled={busy}
            aria-pressed={kind === k.key}
            className={kind === k.key ? 'active' : ''}
            onClick={() => {
              setKind(k.key);
              setEditing(null);
              setName('');
              setSection(defaultSection);
              setPlatformIDs([]);
              setReminderText('');
              setError('');
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="catalog-form">
        <label className="grow">
          {editing ? 'Новое название' : 'Добавить значение'}
          <input
            data-autofocus
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {kind === 'status' && (
          <label>
            Цвет бейджа
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        )}
        {kind === 'platform' && (
          <label>
            Раздел задач
            <select value={section} onChange={(e) => setSection(e.target.value as TaskSection)}>
              {sections.map((taskSection) => (
                <option key={taskSection.key} value={taskSection.key}>
                  {taskSection.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'specialty' && (
          <fieldset className="catalog-extra">
            <legend>Площадки аудитории</legend>
            <p className="hint">Аудитория доступна только на отмеченных площадках.</p>
            <div className="audience-options">
              {catalog
                .filter(
                  (entry) =>
                    entry.kind === 'platform' &&
                    (!entry.archived || platformIDs.includes(entry.id)),
                )
                .map((entry) => (
                  <label className="check" key={entry.id}>
                    <input
                      type="checkbox"
                      checked={platformIDs.includes(entry.id)}
                      onChange={(event) =>
                        setPlatformIDs(
                          event.target.checked
                            ? [...platformIDs, entry.id]
                            : platformIDs.filter((id) => id !== entry.id),
                        )
                      }
                    />
                    {entry.name}
                    {entry.archived ? ' (архив)' : ''}
                  </label>
                ))}
            </div>
          </fieldset>
        )}
        {kind === 'status' && (
          <label className="catalog-extra">
            Текст напоминания
            <textarea
              rows={3}
              maxLength={2000}
              value={reminderText}
              onChange={(event) => setReminderText(event.target.value)}
              placeholder="Например: согласуйте материал с редактором"
            />
            <small>Показывается в подробностях карточки с этим статусом.</small>
          </label>
        )}
        <button className="primary" disabled={busy || !name.trim()}>
          {editing ? 'Сохранить' : 'Добавить'}
        </button>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setName('');
              setColor('#aac4d6');
              setSection(defaultSection);
              setPlatformIDs([]);
              setReminderText('');
            }}
          >
            Отмена
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="catalog-list">
        {items.length === 0 && <p className="muted">Пока нет значений. Добавьте первое.</p>}
        {items.map((item, i) => (
          <div className={`catalog-item ${item.archived ? 'archived' : ''}`} key={item.id}>
            <span className="catalog-name">
              {kind === 'status' && <ColorDot color={item.color} />}
              {item.name}
              {kind === 'platform' && (
                <small>
                  {sections.find((taskSection) => taskSection.key === item.section)?.label}
                </small>
              )}
              {kind === 'specialty' && (
                <small>
                  {(item.platform_ids ?? [])
                    .map((id) => catalog.find((entry) => entry.id === id)?.name)
                    .filter(Boolean)
                    .join(', ') || 'Площадки не выбраны'}
                </small>
              )}
              {kind === 'status' && item.reminder_text && <small>{item.reminder_text}</small>}
              {item.archived && <small>В архиве</small>}
            </span>
            <div className="catalog-actions">
              <button
                aria-label={`Поднять ${item.name}`}
                disabled={busy || i === 0}
                onClick={() => void save({ ...item, position: items[i - 1].position })}
              >
                ↑
              </button>
              <button
                aria-label={`Опустить ${item.name}`}
                disabled={busy || i === items.length - 1}
                onClick={() => void save({ ...item, position: items[i + 1].position })}
              >
                ↓
              </button>
              <button disabled={busy} onClick={() => edit(item)}>
                Изменить
              </button>
              <button
                disabled={busy}
                onClick={() => void save({ ...item, archived: !item.archived })}
              >
                {item.archived ? 'Восстановить' : 'В архив'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
