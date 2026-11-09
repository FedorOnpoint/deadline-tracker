import { useState } from 'react';
import type { CardField } from '../../shared/types';
import { builtinFields, standardFields, fieldTypeLabels, customFieldTypes } from './fields';

export function NewFieldPicker({
  fields,
  onAdd,
  onClose,
}: {
  fields: CardField[];
  onAdd: (field: CardField) => void;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState('');
  const hidden = fields.filter((field) => field.visibility === 'hidden');
  const presets = [...builtinFields, ...standardFields].filter(
    (field) => !fields.some((entry) => entry.id === field.id),
  );
  const full = fields.length >= 60;
  function addCustom(type: CardField['type']) {
    let label = fieldTypeLabels[type];
    let number = 2;
    while (fields.some((field) => field.label === label))
      label = `${fieldTypeLabels[type]} ${number++}`;
    onAdd({
      id: `custom_${crypto.randomUUID()}`,
      label,
      type,
      required: false,
      visibility: 'summary',
      ...(type === 'select' ? { options: ['Вариант 1', 'Вариант 2'] } : {}),
    });
  }
  return (
    <section className="builder-add" aria-label="Добавление поля">
      <div className="field-picker-heading">
        <h3>Какое поле добавить?</h3>
        <button
          type="button"
          className="reset"
          onClick={onClose}
          aria-label="Закрыть добавление поля"
        >
          Закрыть
        </button>
      </div>
      <div className="field-type-grid">
        {customFieldTypes.map((type) => (
          <button type="button" key={type} disabled={full} onClick={() => addCustom(type)}>
            {fieldTypeLabels[type]}
          </button>
        ))}
      </div>
      <label>
        Готовое поле
        <select value={preset} onChange={(event) => setPreset(event.target.value)}>
          <option value="">Выберите поле</option>
          {hidden.length > 0 && (
            <optgroup label="Убранные поля">
              {hidden.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </optgroup>
          )}
          {presets.length > 0 && (
            <optgroup label="Стандартные поля">
              {presets.map((field) => (
                <option key={field.id} value={field.id} disabled={full}>
                  {field.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <button
        type="button"
        disabled={!preset}
        onClick={() => {
          const field = [...hidden, ...presets].find((field) => field.id === preset);
          if (field)
            onAdd({
              ...structuredClone(field),
              layout: undefined,
              visibility: field.visibility === 'hidden' ? 'summary' : field.visibility,
            });
        }}
      >
        Добавить выбранное поле
      </button>
      {full && (
        <p className="hint">Лимит — 60 полей, включая убранные. Убранные поля можно вернуть.</p>
      )}
    </section>
  );
}
