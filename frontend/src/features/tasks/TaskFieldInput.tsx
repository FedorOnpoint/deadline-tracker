import { useState } from 'react';
import type { CardField, Catalog } from '../../shared/types';
import { FieldInput } from '../card-builder/FieldInput';
import { audienceIDs, fieldValue } from '../card-builder/fields';
import type { TaskEditor } from './taskDraft';

export function TaskFieldInput({
  field,
  catalog,
  editor,
  canManage,
  onDateChange,
  onTimeChange,
  onChangeValue,
  onAudiencesChange,
  onAddPlatform,
}: {
  field: CardField;
  catalog: Catalog[];
  editor: TaskEditor;
  canManage: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onChangeValue: (field: CardField, value: string) => void;
  onAudiencesChange: (ids: number[]) => void;
  onAddPlatform: () => void;
}) {
  const { draft, fields, date, time } = editor;
  const [showTime, setShowTime] = useState(false);
  function options(kind: Catalog['kind'], current: number | null) {
    return catalog
      .filter(
        (entry) =>
          entry.kind === kind &&
          (!entry.archived || entry.id === current) &&
          (kind !== 'platform' || entry.section === draft.section),
      )
      .map((entry) => ({
        value: String(entry.id),
        label: entry.name + (entry.archived ? ' (в архиве)' : ''),
      }));
  }

  if (field.id === 'deadline')
    return (
      <fieldset>
        <legend>{field.label} *</legend>
        <div className="form-grid">
          <label>
            Дата
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              required
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
            />
          </label>
          {showTime && (
            <label>
              Время (необязательно)
              <input
                type="time"
                value={time}
                onChange={(event) => onTimeChange(event.target.value)}
              />
            </label>
          )}
        </div>
        <button
          type="button"
          className="reset"
          aria-expanded={showTime}
          onClick={() => setShowTime(!showTime)}
        >
          {showTime ? 'Скрыть время' : 'Указать точное время'}
        </button>
      </fieldset>
    );
  if (field.id === 'platform_id' && !canManage)
    return (
      <fieldset disabled>
        <FieldInput
          field={field}
          value={fieldValue(draft, field)}
          options={options('platform', draft.platform_id)}
          onChange={() => {}}
        />
        <p className="hint">Площадку совместной карточки меняет владелец.</p>
      </fieldset>
    );
  if (field.id === 'specialty_id') {
    const selected = audienceIDs(draft);
    const choices = catalog.filter(
      (entry) =>
        entry.kind === 'specialty' &&
        ((!entry.archived && (entry.platform_ids ?? []).includes(draft.platform_id)) ||
          selected.includes(entry.id)),
    );
    return (
      <fieldset>
        <legend>
          {field.label}
          {field.required ? ' *' : ''}
        </legend>
        {!draft.platform_id && (
          <p className="hint">Выберите площадку, чтобы увидеть её аудитории.</p>
        )}
        {!draft.platform_id &&
          !fields.some((entry) => entry.id === 'platform_id' && entry.visibility !== 'hidden') && (
            <button
              type="button"
              disabled={fields.length >= 60 && !fields.some((entry) => entry.id === 'platform_id')}
              onClick={onAddPlatform}
            >
              Добавить поле «Площадка»
            </button>
          )}
        {draft.platform_id > 0 && choices.length === 0 && (
          <p className="hint">Добавьте аудитории этой площадки в справочниках.</p>
        )}
        <div className="audience-options">
          {choices.map((entry) => (
            <label className="check" key={entry.id}>
              <input
                type="checkbox"
                checked={selected.includes(entry.id)}
                onChange={(event) => {
                  const ids = event.target.checked
                    ? [...selected, entry.id]
                    : selected.filter((id) => id !== entry.id);
                  onAudiencesChange(ids);
                }}
              />
              {entry.name}
              {entry.archived ? ' (архив)' : ''}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  let choices;
  if (field.id === 'platform_id') choices = options('platform', draft.platform_id);
  if (field.id === 'status_id') choices = options('status', draft.status_id);
  return (
    <FieldInput
      field={field}
      value={fieldValue(draft, field)}
      options={choices}
      onChange={(value) => onChangeValue(field, value)}
    />
  );
}
