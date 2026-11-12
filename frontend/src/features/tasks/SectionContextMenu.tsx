import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../shared/api/client';
import type { SectionDefinition } from '../../shared/types';
import { Modal } from '../../shared/ui/Modal';

export type SectionMenuTarget = {
  section: SectionDefinition;
  x: number;
  y: number;
  trigger: HTMLElement;
};

export function SectionContextMenu({
  target,
  blockedReason,
  onClose,
  onDeleted,
}: {
  target: SectionMenuTarget;
  blockedReason: string;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (confirming) return;
    const menu = menuRef.current!;
    (menu.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? menu).focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.contains(event.target)) onClose();
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        onClose();
        target.trigger.focus({ preventScroll: true });
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [confirming, onClose, target]);

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(`/sections/${target.section.key}`, 'DELETE');
      await onDeleted();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <Modal
        title="Удалить раздел?"
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <p>Удалить пустой раздел «{target.section.label}» и его шаблон?</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="danger" disabled={busy} onClick={() => void remove()}>
            {busy ? 'Удаление…' : 'Удалить раздел'}
          </button>
        </div>
      </Modal>
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className="section-context-menu"
      role="menu"
      aria-label={`Действия с разделом «${target.section.label}»`}
      tabIndex={-1}
      style={{
        left: Math.max(8, Math.min(target.x, window.innerWidth - 288)),
        top: Math.max(8, Math.min(target.y, window.innerHeight - 180)),
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className="danger-subtle"
        disabled={Boolean(blockedReason)}
        aria-describedby={blockedReason ? 'section-delete-reason' : undefined}
        onClick={() => setConfirming(true)}
      >
        Удалить раздел
      </button>
      {blockedReason && <p id="section-delete-reason">{blockedReason}</p>}
    </div>,
    document.body,
  );
}
