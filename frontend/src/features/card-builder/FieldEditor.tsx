import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CardField, Catalog } from '../../shared/types';
import { fieldTypeLabels, visibilityLabels } from './fields';
import { FieldIcon } from './FieldIcon';
import { FieldSettings } from './FieldSettings';
import { NewFieldPicker } from './NewFieldPicker';

export function FieldEditor({
  fields,
  statuses,
  previousFields,
  onChange,
  selected,
  selectionVersion,
  onSelect,
  busy,
  renderInput,
  onEditStart,
  onEditEnd,
}: {
  fields: CardField[];
  statuses: Catalog[];
  previousFields: CardField[];
  onChange: (fields: CardField[]) => void;
  selected: string | null;
  selectionVersion: number;
  onSelect: (id: string | null) => void;
  busy: boolean;
  renderInput?: (field: CardField) => ReactNode;
  onEditStart: () => void;
  onEditEnd: () => void;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
  const settingsID = useId();
  const [adding, setAdding] = useState(false);
  const previousIDs = new Set(previousFields.map((field) => field.id));
  useEffect(() => {
    if (!selected) return;
    const row = [
      ...(root.current?.querySelectorAll<HTMLElement>('[data-editor-field-id]') ?? []),
    ].find((element) => element.dataset.editorFieldId === selected);
    const container = root.current?.closest<HTMLElement>('.builder-settings');
    if (!row || !container || !container.clientHeight) return;
    const bounds = row.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    if (bounds.top < viewport.top + 64 || bounds.top > viewport.bottom - 80) {
      container.scrollTo({
        top: container.scrollTop + bounds.top - viewport.top - 64,
        behavior: 'instant',
      });
    }
  }, [selected, selectionVersion]);
  function update(id: string, changes: Partial<CardField>) {
    onChange(
      fields.map((field) =>
        field.id === id
          ? {
              ...field,
              layout:
                changes.visibility && changes.visibility !== field.visibility
                  ? undefined
                  : field.layout,
              ...changes,
            }
          : field,
      ),
    );
  }
  return (
    <fieldset
      ref={root}
      className="builder-fields"
      disabled={busy}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          onEditStart();
      }}
      onInputCapture={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          onEditStart();
      }}
      onBlurCapture={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          onEditEnd();
      }}
    >
      <legend className="sr-only">Поля карточки</legend>
      <div className="field-editor-heading">
        <h3>
          Поля{' '}
          <span className="muted">
            {fields.filter((field) => field.visibility !== 'hidden').length}
          </span>
        </h3>
        <button
          type="button"
          className="add-field-button"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          Добавить поле
        </button>
      </div>
      {adding && (
        <NewFieldPicker
          fields={fields}
          onClose={() => setAdding(false)}
          onAdd={(field) => {
            onChange([...fields.filter((entry) => entry.id !== field.id), field]);
            setAdding(false);
            onSelect(field.id);
          }}
        />
      )}
      {fields
        .filter((field) => field.visibility !== 'hidden')
        .map((field) => (
          <div
            key={field.id}
            data-editor-field-id={field.id}
            className={`builder-field ${selected === field.id ? 'is-selected' : ''}`}
          >
            {renderInput && <div className="builder-value">{renderInput(field)}</div>}
            <button
              type="button"
              className="field-select"
              aria-label={renderInput ? `Настроить поле «${field.label}»` : undefined}
              aria-expanded={selected === field.id}
              aria-controls={selected === field.id ? settingsID : undefined}
              onClick={() => onSelect(selected === field.id ? null : field.id)}
            >
              <FieldIcon field={field} />
              <span className="builder-field-name">
                {renderInput ? 'Параметры' : field.label}
                {!renderInput && (
                  <small>
                    {fieldTypeLabels[field.type]}
                    {field.required ? ' · обязательное' : ''}
                  </small>
                )}
              </span>
              <span className="field-visibility">{visibilityLabels[field.visibility]}</span>
              <svg
                className={selected === field.id ? 'is-expanded' : ''}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {selected === field.id && (
              <div id={settingsID}>
                <FieldSettings
                  field={field}
                  fields={fields}
                  statuses={statuses}
                  typeLocked={previousIDs.has(field.id)}
                  busy={busy}
                  onChange={onChange}
                  onUpdate={(changes) => update(field.id, changes)}
                  onRemove={() => {
                    update(field.id, { visibility: 'hidden', required: false });
                    onSelect(null);
                  }}
                />
              </div>
            )}
          </div>
        ))}
    </fieldset>
  );
}
