import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { CardField } from '../../shared/types';
import {
  CANVAS_COLUMNS,
  CANVAS_GAP,
  CANVAS_ROW,
  adjacentRow,
  defaultFieldSize,
  positionFields,
  placeField,
  type CanvasGroup,
  type PositionedField,
} from './layout';

type DropRow = { y: number; end: number; top: number; bottom: number };
type DropZone = { group: CanvasGroup; bounds: DOMRect };

type Interaction = {
  pointerID: number;
  mode: 'move' | 'resize';
  field: PositionedField;
  original: CardField[];
  grid: HTMLElement;
  group: CanvasGroup;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  dropTargets: Map<CanvasGroup, DropRow[]>;
  dropZones: DropZone[] | null;
  scrollTop: number;
  scrollLeft: number;
};

export function useCanvasInteraction(
  fields: CardField[],
  onChange: (fields: CardField[]) => void,
  onSelect: (id: string) => void,
  busy: boolean,
) {
  const root = useRef<HTMLElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  function begin(
    event: PointerEvent<HTMLButtonElement>,
    field: PositionedField,
    mode: 'move' | 'resize',
  ) {
    if (busy || event.button !== 0) return;
    const grid = event.currentTarget.closest<HTMLElement>('[data-canvas-group]');
    const block = event.currentTarget.closest<HTMLElement>('[data-field-id]');
    if (!grid || !block || !root.current) return;
    event.preventDefault();
    event.stopPropagation();
    root.current.focus({ preventScroll: true });
    const bounds = block.getBoundingClientRect();
    const group = field.visibility === 'details' ? 'details' : 'summary';
    interaction.current = {
      pointerID: event.pointerId,
      mode,
      field,
      original: fields,
      grid,
      group,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      scale: bounds.width / block.offsetWidth,
      dropTargets: new Map([[group, measureRows(grid, fields, group)]]),
      dropZones: null,
      scrollTop: 0,
      scrollLeft: 0,
    };
    root.current.setPointerCapture(event.pointerId);
    onSelect(field.id);
    setActive(field.id);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = interaction.current;
    if (!current || current.pointerID !== event.pointerId || busy) return;
    event.preventDefault();
    const { field } = current;
    const scroller = root.current?.querySelector<HTMLElement>('.preview-viewport');
    if (!current.dropZones) {
      // Keep targets stable while moving a field changes the card's height and empty zones.
      current.dropZones = [];
      const grids = root.current?.querySelectorAll<HTMLElement>('[data-canvas-group]') ?? [];
      for (const grid of grids) {
        const group = grid.dataset.canvasGroup;
        if (group !== 'summary' && group !== 'details') continue;
        current.dropTargets.set(group, measureRows(grid, current.original, group));
        current.dropZones.push({ group, bounds: grid.getBoundingClientRect() });
      }
      current.scrollTop = scroller?.scrollTop ?? 0;
      current.scrollLeft = scroller?.scrollLeft ?? 0;
    }
    const scrollY = (scroller?.scrollTop ?? 0) - current.scrollTop;
    const scrollX = (scroller?.scrollLeft ?? 0) - current.scrollLeft;
    let group = current.group;
    if (current.mode === 'move' && field.id !== 'topic') {
      const target = current.dropZones.find(({ bounds }) => {
        const x = event.clientX + scrollX;
        const y = event.clientY + scrollY;
        return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
      });
      if (target) group = target.group;
    }
    const grid =
      root.current?.querySelector<HTMLElement>(`[data-canvas-group="${group}"]`) ?? current.grid;
    current.grid = grid;
    current.group = group;
    const bounds =
      current.dropZones.find((zone) => zone.group === group)?.bounds ??
      grid.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const column = (bounds.width + gap * current.scale) / CANVAS_COLUMNS;
    const step = CANVAS_ROW + CANVAS_GAP;
    let layout = field.layout;
    if (current.mode === 'resize') {
      layout = {
        ...layout,
        width: Math.min(
          CANVAS_COLUMNS - layout.x,
          layout.width + Math.round((event.clientX - current.startX) / column),
        ),
        height: Math.max(
          defaultFieldSize(field).height,
          layout.height + Math.round((event.clientY - current.startY) / (step * current.scale)),
        ),
      };
    } else {
      let targets = current.dropTargets.get(group);
      if (!targets) {
        targets = measureRows(grid, current.original, group);
        current.dropTargets.set(group, targets);
      }
      layout = {
        ...layout,
        x: Math.round((event.clientX + scrollX - bounds.left - current.offsetX) / column),
        y: dropRow(
          targets,
          event.clientY + scrollY - bounds.top - current.offsetY,
          field.visibility === group ? field.layout.y : undefined,
        ),
      };
    }
    onChange(placeField(current.original, field.id, layout, group));
    const viewport = scroller?.getBoundingClientRect();
    if (viewport && scroller) {
      if (event.clientY > viewport.bottom - 28) scroller.scrollTop += 12;
      if (event.clientY < viewport.top + 28) scroller.scrollTop -= 12;
    }
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = interaction.current;
    if (!current || current.pointerID !== event.pointerId) return;
    interaction.current = null;
    if (root.current?.hasPointerCapture(event.pointerId))
      root.current.releasePointerCapture(event.pointerId);
    if (cancelled) onChange(current.original);
    setAnnouncement(
      cancelled
        ? 'Изменение отменено'
        : `Положение и размер блока «${current.field.label}» изменены`,
    );
    setActive(null);
  }

  function cancel() {
    const current = interaction.current;
    if (!current) return;
    onChange(current.original);
    interaction.current = null;
    if (root.current?.hasPointerCapture(current.pointerID))
      root.current.releasePointerCapture(current.pointerID);
    setActive(null);
    setAnnouncement('Изменение отменено');
  }

  function key(event: KeyboardEvent<HTMLButtonElement>, field: PositionedField, resize: boolean) {
    if (busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft');
    const dy = Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp');
    const layout = { ...field.layout };
    if (resize || event.shiftKey) {
      layout.width = Math.min(CANVAS_COLUMNS - layout.x, layout.width + dx);
      layout.height = Math.max(defaultFieldSize(field).height, layout.height + dy);
    } else {
      layout.x += dx;
      layout.y = dy ? adjacentRow(fields, field, dy) : layout.y;
    }
    onChange(placeField(fields, field.id, layout));
    onSelect(field.id);
    setAnnouncement(
      `Блок «${field.label}» ${resize || event.shiftKey ? 'изменён в размере' : 'перемещён'}`,
    );
  }

  return { root, active, announcement, begin, move, finish, cancel, key };
}

function measureRows(grid: HTMLElement, fields: CardField[], group: CanvasGroup): DropRow[] {
  const origin = grid.getBoundingClientRect();
  const blocks = new Map(
    [...grid.querySelectorAll<HTMLElement>('[data-field-id]')].map((element) => [
      element.dataset.fieldId,
      element,
    ]),
  );
  const rows = new Map<number, DropRow>();
  for (const field of positionFields(fields, group)) {
    const block = blocks.get(field.id);
    if (!block) continue;
    const bounds = block.getBoundingClientRect();
    const previous = rows.get(field.layout.y);
    rows.set(field.layout.y, {
      y: field.layout.y,
      end: Math.max(previous?.end ?? 0, field.layout.y + field.layout.height),
      top: Math.min(previous?.top ?? Infinity, bounds.top - origin.top),
      bottom: Math.max(previous?.bottom ?? 0, bounds.bottom - origin.top),
    });
  }
  return [...rows.values()];
}

function dropRow(rows: DropRow[], top: number, originalY?: number) {
  if (!rows.length) return 0;
  const last = rows.reduce((a, b) => (a.bottom > b.bottom ? a : b));
  if (top > last.bottom) return Math.max(...rows.map((row) => row.end));
  const closest = rows.reduce((a, b) => (Math.abs(a.top - top) < Math.abs(b.top - top) ? a : b));
  if (originalY !== undefined) return closest.y > originalY ? closest.end : closest.y;
  return top > (closest.top + closest.bottom) / 2 ? closest.end : closest.y;
}
