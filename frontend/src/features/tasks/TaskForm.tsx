import { useState, type FormEvent } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { UnsavedChangesDialog } from '../../shared/ui/UnsavedChangesDialog';
import { FieldEditor } from '../card-builder/FieldEditor';
import { CardPreview } from '../card-builder/CardPreview';
import { BuilderHistory } from '../card-builder/BuilderHistory';
import { TaskSharing } from './TaskSharing';
import { TaskFieldInput } from './TaskFieldInput';
import { useTaskForm, type TaskFormOptions } from './useTaskForm';

export function TaskForm(options: TaskFormOptions) {
  const { task, catalog, sections, onClose, saving, canManage = true } = options;
  const form = useTaskForm(options);
  const { fields, draft } = form.editor;
  const { history, preview, now, template, busy, dirty, error, notice, savingTemplate } = form;
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [tab, setTab] = useState('settings');
  const [discarding, setDiscarding] = useState(false);
  function select(id: string | null) {
    setSelected(id);
    setSelectionVersion((previous) => previous + 1);
  }
  function close() {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clearError();
    const element = event.currentTarget;
    if (!element.checkValidity()) {
      setTab('settings');
      requestAnimationFrame(() => element.reportValidity());
      return;
    }
    await form.save();
  }

  return (
    <Modal
      title={task ? 'Редактировать карточку' : 'Новая карточка'}
      wide
      layout="builder"
      onClose={close}
      onKeyDown={busy ? undefined : history.onKeyDown}
    >
      <form onSubmit={submit} noValidate>
        <div className="builder-command-bar">
          <BuilderHistory history={history} busy={busy} />
          <div className="builder-tabs tabs" role="group" aria-label="Вид редактора">
            <button
              type="button"
              className={tab === 'settings' ? 'active' : ''}
              aria-pressed={tab === 'settings'}
              onClick={() => setTab('settings')}
            >
              Поля
            </button>
            <button
              type="button"
              className={tab === 'preview' ? 'active' : ''}
              aria-pressed={tab === 'preview'}
              onClick={() => setTab('preview')}
            >
              Превью
            </button>
          </div>
        </div>
        <div className={`builder-layout show-${tab}`}>
          <div className="builder-settings">
            <FieldEditor
              statuses={catalog.filter((entry) => entry.kind === 'status')}
              fields={fields}
              previousFields={task?.fields ?? []}
              onChange={form.changeFields}
              selected={selected}
              selectionVersion={selectionVersion}
              onSelect={select}
              busy={busy}
              renderInput={(field) => (
                <TaskFieldInput
                  field={field}
                  catalog={catalog}
                  editor={form.editor}
                  canManage={canManage}
                  onDateChange={form.changeDate}
                  onTimeChange={form.changeTime}
                  onChangeValue={form.changeValue}
                  onAudiencesChange={form.changeAudiences}
                  onAddPlatform={form.addPlatformField}
                />
              )}
              onEditStart={history.begin}
              onEditEnd={history.end}
            />
            {task && canManage && (
              <TaskSharing taskID={task.id} onMembersChange={options.onMembersChange} />
            )}
            <details className="builder-extra">
              <summary>Дополнительно</summary>
              {task && canManage && (
                <label>
                  Раздел
                  <select
                    disabled={busy}
                    value={draft.section}
                    onChange={(event) => form.changeSection(event.target.value)}
                  >
                    {sections.map((section) => (
                      <option key={section.key} value={section.key}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="save-template"
                disabled={busy || !template || !canManage}
                onClick={() => void form.saveTemplate()}
              >
                {savingTemplate ? 'Сохранение…' : 'Сохранить как шаблон'}
              </button>
              <p className="hint">
                Шаблон содержит названия и расположение полей. Введённые значения в него не входят.
              </p>
              {task && (
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={draft.completed}
                    onChange={(event) => form.changeCompleted(event.target.checked)}
                  />
                  Выполнено
                </label>
              )}
            </details>
          </div>
          <CardPreview
            task={preview}
            fields={fields}
            catalog={catalog}
            now={now}
            selected={selected}
            onSelect={select}
            onChange={form.changeFields}
            busy={busy}
            onEditStart={history.begin}
            onEditEnd={history.end}
            onEditField={() => {
              setTab('settings');
              setSelectionVersion((previous) => previous + 1);
            }}
          />
        </div>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {discarding && (
          <UnsavedChangesDialog onContinue={() => setDiscarding(false)} onDiscard={onClose} />
        )}
        <div className="modal-actions">
          {dirty && <span className="builder-save-status">Изменения не сохранены</span>}
          <button type="button" disabled={busy} onClick={close}>
            Отмена
          </button>
          <button className="primary" disabled={busy}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
