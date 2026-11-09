import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/client';
import type { SectionDefinition } from '../../shared/types';
import { Modal } from '../../shared/ui/Modal';

export function CreateSection({
  parent,
  onClose,
  onCreated,
}: {
  parent: SectionDefinition | null;
  onClose: () => void;
  onCreated: (section: SectionDefinition) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const section = await api<SectionDefinition>('/sections', 'POST', {
        label: label.trim(),
        parent_key: parent?.key ?? '',
      });
      await onCreated(section);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={parent ? 'Новый дочерний раздел' : 'Новый раздел'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        {parent && <p className="muted">В разделе «{parent.label}»</p>}
        <label>
          Название
          <input
            data-autofocus
            required
            maxLength={150}
            value={label}
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="primary" disabled={busy || !label.trim()}>
            {busy ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
