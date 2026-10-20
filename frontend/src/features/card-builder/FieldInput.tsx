import type { CardField } from '../../shared/types';

export function FieldInput({
  field,
  value,
  options,
  onChange,
}: {
  field: CardField;
  value: string;
  options?: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const label = (
    <>
      {field.label}
      {field.required ? ' *' : ''}
    </>
  );
  if (field.type === 'checkbox')
    return (
      <label className="check">
        <input
          type="checkbox"
          required={field.required}
          checked={value === 'true'}
          onChange={(event) => onChange(String(event.target.checked))}
        />
        {label}
      </label>
    );
  if (field.type === 'select' || field.type === 'catalog') {
    const choices =
      options ?? (field.options ?? []).map((option) => ({ value: option, label: option }));
    return (
      <label>
        {label}
        <select
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{field.required ? 'Выберите значение' : 'Не указано'}</option>
          {value && !choices.some((choice) => choice.value === value) && (
            <option value={value}>{value} (прежнее значение)</option>
          )}
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label>
      {label}
      {field.type === 'textarea' ? (
        <textarea
          data-autofocus={field.id === 'topic' || undefined}
          required={field.required}
          maxLength={20000}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={field.type}
          required={field.required}
          maxLength={20000}
          step={field.type === 'number' ? 'any' : undefined}
          min={field.type === 'date' ? '1900-01-01' : undefined}
          max={field.type === 'date' ? '9999-12-31' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
