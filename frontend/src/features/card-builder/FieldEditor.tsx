import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CardField } from '../../shared/types';
import {
  builtinFields,
  standardFields,
  dateFields,
  fieldTypeLabels,
  visibilityLabels,
} from './fields';

const customTypes: CardField['type'][] = [
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'select',
  'checkbox',
];

export function FieldEditor({
  fields,
  previousFields,
  onChange,
  selected,
  selectionVersion,
  onSelect,
  deadlineField,
  onDeadlineChange,
  busy,
  renderInput,
}: {
  fields: CardField[];
  previousFields: CardField[];
  onChange: (fields: CardField[]) => void;
  selected: string | null;
  selectionVersion: number;
  onSelect: (id: string | null) => void;
  deadlineField: string;
  onDeadlineChange: (id: string) => void;
  busy: boolean;
  renderInput?: (field: CardField) => ReactNode;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!selected) return;
    const container = root.current?.closest<HTMLElement>('.builder-settings');
    if (!container) return;
    const reveal = () => {
      if (!container.clientHeight) return;
      const field = [
        ...(root.current?.querySelectorAll<HTMLElement>('[data-editor-field-id]') ?? []),
      ].find((element) => element.dataset.editorFieldId === selected);
      if (!field) return;
      const top =
        field.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        8;
      container.scrollTo({
        top,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
  }, [selected, selectionVersion]);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CardField['type']>('text');
  const [preset, setPreset] = useState('custom');
  const previousIDs = new Set(previousFields.map((field) => field.id));
  const hiddenFields = fields.filter((field) => field.visibility === 'hidden');
  const presets = [...builtinFields, ...standardFields].filter(
    (field) => !fields.some((entry) => entry.id === field.id),
  );
  const available = [...hiddenFields, ...presets];

  function update(id: string, changes: Partial<CardField>) {
    onChange(
      fields.map((field) => {
        if (field.id !== id) return field;
        const layout =
          changes.visibility && changes.visibility !== field.visibility ? undefined : field.layout;
        return { ...field, layout, ...changes };
      }),
    );
  }

  function add() {
    if (fields.length >= 60 && !fields.some((field) => field.id === preset)) return;
    let field: CardField;
    if (preset === 'custom') {
      if (!label.trim()) return;
      field = {
        id: `custom_${crypto.randomUUID()}`,
        label: label.trim(),
        type,
        required: false,
        visibility: 'summary',
      };
      if (type === 'select') field.options = ['Вариант 1', 'Вариант 2'];
    } else {
      const presetField = available.find((field) => field.id === preset);
      if (!presetField) return;
      field = {
        ...structuredClone(presetField),
        visibility: presetField.visibility === 'hidden' ? 'summary' : presetField.visibility,
        layout: undefined,
      };
    }
    onChange([...fields.filter((entry) => entry.id !== field.id), field]);
    onSelect(field.id);
    setLabel('');
    setPreset('custom');
  }

  return (
    <fieldset ref={root} className="builder-fields" disabled={busy}>
      <legend className="sr-only">Поля карточки</legend>
      {dateFields(fields).length > 1 && (
        <label className="deadline-source">
          Считать дедлайн по
          <select value={deadlineField} onChange={(event) => onDeadlineChange(event.target.value)}>
            {dateFields(fields).map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
          <span className="hint">
            У каждой даты свой отсчёт. Главная дата определяет общую срочность и сортировку
            карточки.
          </span>
        </label>
      )}
      {fields.map((field, index) => {
        if (field.visibility === 'hidden') return null;
        const core = field.id === 'topic' || field.id === 'deadline';
        const custom = field.id.startsWith('custom_');
        const tracked = field.id === deadlineField;
        return (
          <div
            key={field.id}
            data-editor-field-id={field.id}
            className={`builder-field ${selected === field.id ? 'is-selected' : ''}`}
          >
            {renderInput && (
              <div className="builder-value">
                {renderInput({ ...field, required: field.required || tracked })}
              </div>
            )}
            <details open={selected === field.id}>
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(selected === field.id ? null : field.id);
                }}
              >
                <span className="builder-field-number">{index + 1}</span>
                <span className="builder-field-name">
                  {renderInput ? `Настроить: ${field.label}` : field.label}
                  {tracked && <small>Дата отсчёта</small>}
                  {!renderInput && (
                    <small>
                      {fieldTypeLabels[field.type]}
                      {field.required && ' · обязательное'}
                    </small>
                  )}
                </span>
                <span className={`field-visibility ${field.visibility}`}>
                  {visibilityLabels[field.visibility]}
                </span>
                <span aria-hidden="true">{selected === field.id ? '−' : '+'}</span>
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
                      disabled={!custom || previousIDs.has(field.id)}
                      value={field.type}
                      onChange={(event) => {
                        const next = event.target.value as CardField['type'];
                        update(field.id, {
                          type: next,
                          options: next === 'select' ? ['Вариант 1', 'Вариант 2'] : undefined,
                        });
                        if (tracked && next !== 'date' && next !== 'datetime')
                          onDeadlineChange('deadline');
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
                      disabled={field.id === 'topic'}
                      value={field.visibility}
                      onChange={(event) => {
                        const visibility = event.target.value as CardField['visibility'];
                        update(field.id, {
                          visibility,
                          required: visibility === 'hidden' ? false : field.required,
                        });
                      }}
                    >
                      <option value="summary">В карточке</option>
                      <option value="details">В подробностях</option>
                      {!core && !tracked && <option value="hidden">Скрыто</option>}
                    </select>
                  </label>
                </div>
                {field.type === 'select' && (
                  <label>
                    Варианты списка — каждый с новой строки
                    <textarea
                      rows={3}
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
                    checked={field.required || tracked}
                    disabled={core || tracked}
                    onChange={(event) => update(field.id, { required: event.target.checked })}
                  />
                  Обязательное поле
                </label>
                <div className="builder-field-actions">
                  {!core && (
                    <button
                      type="button"
                      className="danger-subtle"
                      onClick={() => {
                        update(field.id, { visibility: 'hidden', required: false });
                        if (tracked) onDeadlineChange('deadline');
                        onSelect(null);
                      }}
                    >
                      Убрать поле
                    </button>
                  )}
                </div>
                {!core && (
                  <p className="hint">
                    Поле убирается из карточки. Введённое значение сохранится, если добавить его
                    обратно.
                  </p>
                )}
              </div>
            </details>
          </div>
        );
      })}
      <div className="builder-add">
        <h3>Добавить поле</h3>
        <label>
          Поле
          <select value={preset} onChange={(event) => setPreset(event.target.value)}>
            <option value="custom">Своё поле</option>
            {hiddenFields.length > 0 && (
              <optgroup label="Вернуть убранное поле">
                {hiddenFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </optgroup>
            )}
            {presets.length > 0 && (
              <optgroup label="Стандартные поля">
                {presets.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {preset === 'custom' && (
          <div className="form-grid">
            <label>
              Название
              <input
                maxLength={150}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Например, загрузка на платформу"
              />
            </label>
            <label>
              Тип
              <select
                value={type}
                onChange={(event) => setType(event.target.value as CardField['type'])}
              >
                {customTypes.map((type) => (
                  <option key={type} value={type}>
                    {fieldTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <button
          type="button"
          disabled={
            (fields.length >= 60 && !fields.some((field) => field.id === preset)) ||
            (preset === 'custom' && !label.trim())
          }
          onClick={add}
        >
          ＋ Добавить поле
        </button>
        <span className="hint">{fields.length} / 60 полей</span>
      </div>
    </fieldset>
  );
}
