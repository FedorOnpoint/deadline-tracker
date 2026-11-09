import type { CardField } from '../../shared/types';
import { customFieldTypes, fieldTypeLabels } from './fields';
import { CanvasToolbar } from './CanvasToolbar';

export function FieldSettings({
  field,
  fields,
  typeLocked,
  busy,
  onUpdate,
  onChange,
  onRemove,
}: {
  field: CardField;
  fields: CardField[];
  typeLocked: boolean;
  busy: boolean;
  onUpdate: (changes: Partial<CardField>) => void;
  onChange: (fields: CardField[]) => void;
  onRemove: () => void;
}) {
  const core = field.id === 'topic' || field.id === 'deadline';
  const custom = field.id.startsWith('custom_');
  return (
    <div className="builder-field-settings" aria-label={`Настройки поля «${field.label}»`}>
      <label>
        Название поля
        <input
          required
          maxLength={150}
          value={field.label}
          onChange={(event) => onUpdate({ label: event.target.value })}
        />
      </label>
      {field.id !== 'topic' && (
        <label>
          Где показывать
          <select
            value={field.visibility}
            onChange={(event) =>
              onUpdate({ visibility: event.target.value === 'details' ? 'details' : 'summary' })
            }
          >
            <option value="summary">В карточке</option>
            <option value="details">В подробностях</option>
          </select>
        </label>
      )}
      <CanvasToolbar fields={fields} selected={field.id} onChange={onChange} busy={busy} />
      {field.type === 'select' && (
        <label>
          Варианты списка — каждый с новой строки
          <textarea
            rows={3}
            value={(field.options ?? []).join('\n')}
            onChange={(event) => onUpdate({ options: event.target.value.split('\n') })}
          />
        </label>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={field.required}
          disabled={core}
          onChange={(event) => onUpdate({ required: event.target.checked })}
        />
        Обязательное поле
      </label>
      <details className="field-advanced">
        <summary>Тип поля</summary>
        <label>
          Тип поля
          <select
            disabled={!custom || typeLocked}
            value={field.type}
            onChange={(event) => {
              const type = customFieldTypes.find((type) => type === event.target.value);
              if (type)
                onUpdate({
                  type,
                  options: type === 'select' ? ['Вариант 1', 'Вариант 2'] : undefined,
                });
            }}
          >
            {(custom ? customFieldTypes : [field.type]).map((type) => (
              <option key={type} value={type}>
                {fieldTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        {typeLocked && custom && (
          <p className="hint">
            Тип сохранённого поля менять нельзя. Добавьте новое поле нужного типа.
          </p>
        )}
      </details>
      {!core && (
        <button type="button" className="danger-subtle" onClick={onRemove}>
          Убрать поле
        </button>
      )}
    </div>
  );
}
