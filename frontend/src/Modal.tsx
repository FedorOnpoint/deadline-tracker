import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
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
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={wide ? 'modal wide' : 'modal'} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose(); }}
    onPointerDown={e => { startedOnBackdrop.current = e.target === e.currentTarget && outsideDialog(e.clientX, e.clientY); }}
    onPointerCancel={() => { startedOnBackdrop.current = false; }}
    onClick={e => {
      const close = startedOnBackdrop.current && e.target === e.currentTarget && outsideDialog(e.clientX, e.clientY);
      startedOnBackdrop.current = false;
      if (close) onClose();
    }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Закрыть окно" onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}
