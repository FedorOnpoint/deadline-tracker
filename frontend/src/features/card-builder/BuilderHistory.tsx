export function BuilderHistory({
  history,
  busy,
}: {
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
  busy: boolean;
}) {
  return (
    <div className="builder-history" role="group" aria-label="История изменений">
      <button
        type="button"
        disabled={busy || !history.canUndo}
        onClick={history.undo}
        title="Отменить (Ctrl/Cmd+Z)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12" />
        </svg>
        Отменить
      </button>
      <button
        type="button"
        disabled={busy || !history.canRedo}
        onClick={history.redo}
        title="Повторить (Ctrl/Cmd+Shift+Z)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12" />
        </svg>
        Повторить
      </button>
    </div>
  );
}
