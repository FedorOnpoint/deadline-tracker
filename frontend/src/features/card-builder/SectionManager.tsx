import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import type { Catalog, SectionDefinition } from '../../shared/types';
import { Modal } from '../../shared/ui/Modal';

export function SectionManager({
  sections,
  catalog,
  defaultSection,
  onClose,
  onSaved,
}: {
  sections: SectionDefinition[];
  catalog: Catalog[];
  defaultSection: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(defaultSection);
  const [label, setLabel] = useState(
    sections.find((section) => section.key === defaultSection)?.label ?? '',
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onSaved();
      setEditing(null);
      setLabel('');
      setDeleting(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const previous = sections.find((section) => section.key === editing);
    await mutate(() =>
      api(`/sections${previous ? `/${previous.key}` : ''}`, previous ? 'PUT' : 'POST', {
        ...previous,
        label: label.trim(),
      }),
    );
  }

  return (
    <Modal
      title="Разделы"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="form-intro">
        Вкладки редакционного плана. Переименование сохраняет записи и шаблон карточки.
      </p>
      <form onSubmit={submit} className="catalog-form">
        <label className="grow">
          {editing ? 'Название раздела' : 'Новый раздел'}
          <input
            data-autofocus
            required
            maxLength={150}
            value={label}
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <button className="primary" disabled={busy || !label.trim()}>
          {editing ? 'Сохранить' : 'Добавить'}
        </button>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setLabel('');
            }}
          >
            Новый раздел
          </button>
        )}
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="catalog-list">
        {sections.map((section, index) => {
          const platforms = catalog.filter(
            (entry) => entry.kind === 'platform' && entry.section === section.key,
          ).length;
          return (
            <div className="catalog-item" key={section.key}>
              <div className="section-description">
                <strong>{section.label}</strong>
                <span className="muted">Площадок: {platforms}</span>
              </div>
              <div className="catalog-actions">
                <button
                  disabled={busy || index === 0}
                  aria-label={`Переместить раздел «${section.label}» вверх`}
                  onClick={() =>
                    void mutate(() =>
                      api(`/sections/${section.key}`, 'PUT', { ...section, position: index - 1 }),
                    )
                  }
                >
                  ↑
                </button>
                <button
                  disabled={busy || index === sections.length - 1}
                  aria-label={`Переместить раздел «${section.label}» вниз`}
                  onClick={() =>
                    void mutate(() =>
                      api(`/sections/${section.key}`, 'PUT', { ...section, position: index + 1 }),
                    )
                  }
                >
                  ↓
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(section.key);
                    setLabel(section.label);
                    setDeleting(null);
                  }}
                >
                  Переименовать
                </button>
                <button
                  className="danger-subtle"
                  disabled={busy || platforms > 0 || sections.length === 1}
                  title={platforms ? 'Сначала перенесите площадки через справочники' : undefined}
                  onClick={() => setDeleting(section.key)}
                >
                  Удалить
                </button>
              </div>
              {deleting === section.key && (
                <div
                  className="section-delete"
                  role="group"
                  aria-label="Подтверждение удаления раздела"
                >
                  <p>Удалить пустой раздел «{section.label}» и его шаблон?</p>
                  <button disabled={busy} onClick={() => setDeleting(null)}>
                    Отмена
                  </button>
                  <button
                    className="danger-subtle"
                    disabled={busy}
                    onClick={() => void mutate(() => api(`/sections/${section.key}`, 'DELETE'))}
                  >
                    Удалить раздел
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="hint">
        Карточки без площадки можно перенести через редактирование. Площадки переносятся через
        «Справочники → Площадки» вместе со связанными карточками. Удалить можно только пустой
        раздел.
      </p>
      <div className="modal-actions">
        <button disabled={busy} onClick={onClose}>
          Готово
        </button>
      </div>
    </Modal>
  );
}
