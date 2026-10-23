import { createPortal } from 'react-dom';
import { Modal } from './Modal';

export function UnsavedChangesDialog({
  onContinue,
  onDiscard,
}: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return createPortal(
    <Modal title="Выйти без сохранения?" onClose={onContinue}>
      <p className="muted">Несохранённые изменения будут потеряны.</p>
      <div className="modal-actions">
        <button type="button" className="primary" data-autofocus onClick={onContinue}>
          Продолжить редактирование
        </button>
        <button type="button" className="danger-subtle" onClick={onDiscard}>
          Выйти без сохранения
        </button>
      </div>
    </Modal>,
    document.body,
  );
}
