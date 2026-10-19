import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import { Modal } from '../../shared/ui/Modal';
import { type Catalog, type Task, type TaskInput } from '../../shared/types';
import { localDateTime, timezone } from './model';

export function TaskForm({ task, catalog, onClose, onSaved, defaultPlatformID = catalog.find(c => c.kind === 'platform' && !c.archived)?.id || 0 }: { task: Task | null; catalog: Catalog[]; onClose: () => void; onSaved: () => Promise<void>; defaultPlatformID?: number }) {
  const initial = task ? localDateTime(task.deadline) : '';
  const [date, setDate] = useState(initial.split('T')[0]);
  const [time, setTime] = useState(initial.split('T')[1] || '');
  const [draft, setDraft] = useState<TaskInput>({
    platform_id: task?.platform_id ?? defaultPlatformID,
    specialty_id: task?.specialty_id ?? null, status_id: task?.status_id ?? null,
    deadline: task?.deadline || '', email_date: task?.email_date || '', topic: task?.topic || '', project: task?.project || '',
    header: task?.header || '', preheader: task?.preheader || '', comment: task?.comment || '', owner: task?.owner || '', completed: task?.completed || false,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setDraft(d => ({ ...d, [key]: value }));
  function options(kind: Catalog['kind'], current: number | null) {
    return catalog.filter(c => c.kind === kind && (!c.archived || c.id === current)).map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (в архиве)' : ''}</option>);
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!draft.topic.trim()) { setError('Укажите тему'); return; }
    const deadline = new Date(`${date}T${time || '23:59'}`);
    if (!Number.isFinite(deadline.getTime()) || deadline.getFullYear() < 1900) { setError('Укажите корректную дату дедлайна'); return; }
    // A non-existent local wall-clock time (DST jump) must not be shifted silently.
    if (localDateTime(deadline.toISOString()) !== `${date}T${time || '23:59'}`) { setError('Это время отсутствует в вашем часовом поясе из-за перевода часов. Выберите другое время.'); return; }
    const unchanged = task && date === initial.split('T')[0] && time === initial.split('T')[1];
    setSaving(true);
    try {
      await api(`/tasks${task ? `/${task.id}` : ''}`, task ? 'PUT' : 'POST', { ...draft, deadline: unchanged ? task.deadline : deadline.toISOString() });
      await onSaved(); onClose();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Modal title={task ? 'Редактировать запись' : 'Новая запись'} onClose={() => { if (!saving) onClose(); }} wide>
    <form onSubmit={submit}>
      <p className="form-intro">Отдельная запись для каждого размещения или отправки. <span className="muted">* Обязательные поля</span></p>
      <label>Тема *<textarea required data-autofocus maxLength={20000} rows={3} value={draft.topic} onChange={e => update('topic', e.target.value)} placeholder="О чём этот материал?" /></label>
      <div className="form-grid">
        <label>Площадка *<select required value={draft.platform_id || ''} onChange={e => update('platform_id', Number(e.target.value))}><option value="" disabled>Выберите площадку</option>{options('platform', draft.platform_id)}</select></label>
        <label>Специальность<select value={draft.specialty_id ?? ''} onChange={e => update('specialty_id', e.target.value ? Number(e.target.value) : null)}><option value="">Не указано</option>{options('specialty', draft.specialty_id)}</select></label>
      </div>
      <fieldset><legend>Срок загрузки в Mhub+ *</legend>
        <div className="form-grid"><label>Дата загрузки<input type="date" min="1900-01-01" max="9999-12-31" required value={date} onChange={e => setDate(e.target.value)} /></label><label>Время (необязательно)<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
        <p className="hint">Часовой пояс: {timezone}. {!time ? 'Без уточнения времени: 23:59 выбранной даты.' : `Время загрузки: ${time}.`}</p>
      </fieldset>
      <div className="form-grid">
        <label>Дата (e-mail)<input type="date" min="1900-01-01" max="9999-12-31" value={draft.email_date} onChange={e => update('email_date', e.target.value)} /></label>
        <label>Рабочий статус<select value={draft.status_id ?? ''} onChange={e => update('status_id', e.target.value ? Number(e.target.value) : null)}><option value="">Не задан</option>{options('status', draft.status_id)}</select></label>
      </div>
      {draft.email_date && date && draft.email_date < date && <p className="warning" role="status">Дата e-mail раньше срока загрузки. Запись можно сохранить.</p>}
      <label>Материал / проект<input maxLength={20000} value={draft.project} onChange={e => update('project', e.target.value)} /></label>
      <div className="form-grid">{(['header', 'preheader'] as const).map((key, i) => <label key={key}>{['Хедер', 'Прехедер'][i]}<textarea rows={3} maxLength={20000} value={draft[key]} onChange={e => update(key, e.target.value)} /></label>)}</div>
      <label>Комментарий<textarea rows={3} maxLength={20000} value={draft.comment} onChange={e => update('comment', e.target.value)} /></label>
      <label>Ответственный<input maxLength={20000} value={draft.owner} onChange={e => update('owner', e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={draft.completed} onChange={e => update('completed', e.target.checked)} />Выполнено <span className="muted">Независимо от рабочего статуса</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" disabled={saving} onClick={onClose}>Отмена</button><button className="primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить запись'}</button></div>
    </form>
  </Modal>;
}
