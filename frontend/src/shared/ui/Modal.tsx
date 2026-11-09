import { useEffect, useId, useRef, type ReactNode, type KeyboardEventHandler } from 'react';

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  layout,
  onKeyDown,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  layout?: 'builder';
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleID = useId();
  const startedOnBackdrop = useRef(false);
  function outsideDialog(x: number, y: number) {
    const bounds = ref.current!.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      dialog.close();
      // Restore focus after any nested dialogs have also finished unmounting.
      queueMicrotask(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' wide' : ''}${layout === 'builder' ? ' builder-modal' : ''}`}
      aria-labelledby={titleID}
      onKeyDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('dialog') === event.currentTarget
        )
          onKeyDown?.(event);
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        startedOnBackdrop.current =
          e.target === e.currentTarget && outsideDialog(e.clientX, e.clientY);
      }}
      onPointerCancel={() => {
        startedOnBackdrop.current = false;
      }}
      onClick={(e) => {
        e.stopPropagation();
        const close =
          startedOnBackdrop.current &&
          e.target === e.currentTarget &&
          outsideDialog(e.clientX, e.clientY);
        startedOnBackdrop.current = false;
        if (close) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleID}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Закрыть окно" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
