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
  onCreateChild,
}: {
  sections: SectionDefinition[];
  catalog: Catalog[];
  defaultSection: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCreateChild: (parent: SectionDefinition) => void;
}) {
  const [editing, setEditing] = useState<string | null>(defaultSection);
  const [label, setLabel] = useState(
    sections.find((section) => section.key === defaultSection)?.label ?? '',
  );
  const orderedSections = sections
    .filter((section) => !section.parent_key)
    .flatMap((parent) => [parent, ...sections.filter((child) => child.parent_key === parent.key)]);
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
        parent_key: previous?.parent_key ?? '',
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
        Основные разделы и их дочерние. Добавить дочерний можно кнопкой рядом с основным разделом.
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
        {orderedSections.map((section) => {
          const siblings = sections.filter(
            (entry) => (entry.parent_key ?? '') === (section.parent_key ?? ''),
          );
          const index = siblings.findIndex((entry) => entry.key === section.key);
          const parent = sections.find((entry) => entry.key === section.parent_key);
          const childCount = sections.filter((entry) => entry.parent_key === section.key).length;
          const platforms = catalog.filter(
            (entry) => entry.kind === 'platform' && entry.section === section.key,
          ).length;
          return (
            <div className={`catalog-item ${parent ? 'is-child-section' : ''}`} key={section.key}>
              <div className="section-description">
                <strong>{section.label}</strong>
                <span className="muted">
                  {parent ? `В разделе «${parent.label}» · ` : ''}
                  {childCount ? `Подразделов: ${childCount}` : `Площадок: ${platforms}`}
                </span>
              </div>
              <div className="catalog-actions">
                {!parent && (
                  <button disabled={busy} onClick={() => onCreateChild(section)}>
                    Добавить дочерний
                  </button>
                )}
                <button
                  disabled={busy || index === 0}
                  aria-label={`Переместить раздел «${section.label}» вверх`}
                  onClick={() =>
                    void mutate(() =>
                      api(`/sections/${section.key}`, 'PUT', {
                        ...section,
                        position: siblings[index - 1].position,
                      }),
                    )
                  }
                >
                  ↑
                </button>
                <button
                  disabled={busy || index === siblings.length - 1}
                  aria-label={`Переместить раздел «${section.label}» вниз`}
                  onClick={() =>
                    void mutate(() =>
                      api(`/sections/${section.key}`, 'PUT', {
                        ...section,
                        position: siblings[index + 1].position,
                      }),
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
                  Изменить
                </button>
                <button
                  className="danger-subtle"
                  disabled={busy || platforms > 0 || childCount > 0}
                  title={
                    childCount
                      ? 'Сначала удалите дочерние разделы'
                      : platforms
                        ? 'Сначала перенесите площадки через справочники'
                        : undefined
                  }
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
        «Управление данными → Площадки» вместе со связанными карточками. Удалить можно только пустой
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
