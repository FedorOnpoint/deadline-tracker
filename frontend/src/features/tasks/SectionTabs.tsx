import { useCallback, useEffect, useId, useState, type MouseEvent } from 'react';
import { SectionContextMenu, type SectionMenuTarget } from './SectionContextMenu';
import type { Catalog, SectionDefinition, Task } from '../../shared/types';

export function SectionTabs({
  sections,
  tasks,
  selected,
  onSelect,
  onCreate,
  disabled,
  dragTarget,
  catalog,
  onDeleted,
}: {
  sections: SectionDefinition[];
  catalog: Catalog[];
  onDeleted: () => Promise<void>;
  tasks: Task[];
  selected: string;
  onSelect: (key: string) => void;
  onCreate: (parent: SectionDefinition | null) => void;
  disabled: boolean;
  dragTarget?: string | null;
}) {
  const childID = useId();
  const [menu, setMenu] = useState<SectionMenuTarget | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  function openMenu(event: MouseEvent<HTMLButtonElement>, section: SectionDefinition) {
    event.preventDefault();
    if (disabled || dragTarget !== undefined) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setMenu({
      section,
      x: event.clientX || bounds.left,
      y: event.clientY || bounds.bottom,
      trigger: event.currentTarget,
    });
  }
  let blockedReason = '';
  if (menu) {
    const key = menu.section.key;
    if (sections.some((section) => section.parent_key === key))
      blockedReason = 'Сначала удалите подразделы.';
    else if (tasks.some((task) => task.section === key))
      blockedReason = 'Сначала перенесите карточки в другой подраздел.';
    else if (catalog.some((entry) => entry.kind === 'platform' && entry.section === key))
      blockedReason = 'Сначала перенесите или удалите площадки через управление данными.';
  }
  const [dragSection, setDragSection] = useState<string | null>(null);
  useEffect(() => {
    if (dragTarget === undefined) {
      setDragSection(null);
      return;
    }
    const hovered = sections.find((section) => section.key === dragTarget);
    if (!hovered || hovered.parent_key) return;
    // Crossing another row of sections should not replace the intended drop targets.
    const timer = window.setTimeout(() => setDragSection(hovered.key), 600);
    return () => window.clearTimeout(timer);
  }, [dragTarget, sections]);
  const current = sections.find((section) => section.key === (dragSection ?? selected));
  const parent = sections.find((section) => section.key === current?.parent_key) ?? current;
  const children = sections.filter((section) => section.parent_key === parent?.key);
  const counts = new Map<string, number>();
  for (const task of tasks) counts.set(task.section, (counts.get(task.section) ?? 0) + 1);
  return (
    <div className={`section-navigation${dragTarget !== undefined ? ' is-dragging' : ''}`}>
      {dragTarget !== undefined && (
        <p className="section-drag-hint">
          Задержите карточку над разделом, чтобы раскрыть его. Отпустите над подразделом · Esc —
          отмена
        </p>
      )}
      {menu && (
        <SectionContextMenu
          key={menu.section.key}
          target={menu}
          blockedReason={blockedReason}
          onClose={closeMenu}
          onDeleted={onDeleted}
        />
      )}
      <nav className="section-tabs" aria-label="Разделы задач">
        {sections
          .filter((section) => !section.parent_key)
          .map((section) => {
            const descendants = sections.filter((child) => child.parent_key === section.key);
            const active = parent?.key === section.key;
            const count = descendants.length
              ? descendants.reduce((total, child) => total + (counts.get(child.key) ?? 0), 0)
              : (counts.get(section.key) ?? 0);
            return (
              <button
                key={section.key}
                onContextMenu={(event) => openMenu(event, section)}
                data-task-section={section.key}
                data-drop-target={dragTarget === section.key || undefined}
                type="button"
                className={active ? 'active' : ''}
                aria-pressed={active}
                aria-expanded={descendants.length ? active : undefined}
                aria-controls={descendants.length && active ? childID : undefined}
                onClick={() => onSelect(descendants[0]?.key ?? section.key)}
              >
                <span className="section-label">{section.label}</span>
                <span className="count">{count}</span>
                {descendants.length > 0 && (
                  <svg
                    className={`section-chevron ${active ? 'is-expanded' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </button>
            );
          })}
        <button
          type="button"
          className="section-create"
          disabled={disabled}
          onClick={() => onCreate(null)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Новый раздел</span>
        </button>
      </nav>
      {parent && (
        <nav
          key={parent?.key}
          id={childID}
          className="section-tabs section-tabs-children"
          aria-label={`Подразделы: ${parent?.label}`}
        >
          {children.map((child) => (
            <button
              key={child.key}
              onContextMenu={(event) => openMenu(event, child)}
              data-task-section={child.key}
              data-drop-target={dragTarget === child.key || undefined}
              type="button"
              className={selected === child.key ? 'active' : ''}
              aria-pressed={selected === child.key}
              onClick={() => onSelect(child.key)}
            >
              <span className="section-label">{child.label}</span>
              <span className="count">{counts.get(child.key) ?? 0}</span>
            </button>
          ))}
          <button
            type="button"
            className="section-create"
            disabled={disabled}
            onClick={() => onCreate(parent)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Добавить подраздел</span>
          </button>
        </nav>
      )}
    </div>
  );
}
