import type { CardField, CardFieldLayout } from '../../shared/types';

export const CANVAS_COLUMNS = 12;
export const CANVAS_ROW = 24;
export const CANVAS_GAP = 8;
export const CANVAS_MAX_ROWS = 4096;
export type CanvasGroup = 'summary' | 'details';
export type PositionedField = CardField & { layout: CardFieldLayout };

function overlaps(first: CardFieldLayout, second: CardFieldLayout) {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

function bounded(layout: CardFieldLayout): CardFieldLayout {
  const width = Math.max(3, Math.min(CANVAS_COLUMNS, Math.round(layout.width)));
  const height = Math.max(2, Math.min(24, Math.round(layout.height)));
  return {
    x: Math.max(0, Math.min(CANVAS_COLUMNS - width, Math.round(layout.x))),
    y: Math.max(0, Math.min(CANVAS_MAX_ROWS - height, Math.round(layout.y))),
    width,
    height,
  };
}

export function defaultFieldSize(field: CardField) {
  if (field.id === 'topic') return { width: 12, height: 2 };
  if (field.type === 'textarea') return { width: 12, height: 4 };
  if (field.type === 'date' || field.type === 'datetime') return { width: 6, height: 3 };
  if (field.type === 'number' || field.type === 'checkbox') return { width: 3, height: 2 };
  return { width: 6, height: 2 };
}

function firstSpace(
  size: { width: number; height: number },
  occupied: CardFieldLayout[],
): CardFieldLayout {
  for (let y = 0; y <= CANVAS_MAX_ROWS - size.height; y++) {
    for (let x = 0; x <= CANVAS_COLUMNS - size.width; x++) {
      const box = { x, y, width: size.width, height: size.height };
      if (!occupied.some((other) => overlaps(box, other))) return box;
    }
  }
  throw new Error('На холсте не осталось свободного места');
}

function pushDown(layout: CardFieldLayout, occupied: CardFieldLayout[]) {
  const box = { ...layout };
  let collision = occupied.find((other) => overlaps(box, other));
  while (collision) {
    box.y = collision.y + collision.height;
    if (box.y + box.height > CANVAS_MAX_ROWS) return firstSpace(box, occupied);
    collision = occupied.find((other) => overlaps(box, other));
  }
  return box;
}

export function positionFields(fields: CardField[], group: CanvasGroup): PositionedField[] {
  const visible = fields.filter((field) => field.visibility === group);
  const placed = new Map<string, CardFieldLayout>();
  const occupied: CardFieldLayout[] = [];
  for (const field of visible.filter((field) => field.layout)) {
    const box = pushDown(bounded(field.layout!), occupied);
    placed.set(field.id, box);
    occupied.push(box);
  }
  for (const field of visible.filter((field) => !field.layout)) {
    const box = firstSpace(defaultFieldSize(field), occupied);
    placed.set(field.id, box);
    occupied.push(box);
  }
  return visible.map((field) => ({ ...field, layout: placed.get(field.id)! }));
}

export function materializeLayout(fields: CardField[]): CardField[] {
  const placed = new Map(
    [...positionFields(fields, 'summary'), ...positionFields(fields, 'details')].map((field) => [
      field.id,
      field.layout,
    ]),
  );
  return fields.map((field) =>
    placed.has(field.id) ? { ...field, layout: placed.get(field.id) } : field,
  );
}

export function placeField(
  fields: CardField[],
  id: string,
  layout: CardFieldLayout,
  group?: CanvasGroup,
): CardField[] {
  const resolved = materializeLayout(fields);
  const field = resolved.find((field) => field.id === id);
  if (!field) return fields;
  const visibility = field.id === 'topic' ? 'summary' : (group ?? field.visibility);
  const box = bounded(layout);
  const positions = new Map<string, CardFieldLayout>([[id, box]]);
  const occupied = [box];
  const neighbors = resolved.filter((other) => other.id !== id && other.visibility === visibility);
  neighbors.sort(
    (first, second) => first.layout!.y - second.layout!.y || first.layout!.x - second.layout!.x,
  );
  for (const neighbor of neighbors) {
    const next = pushDown(neighbor.layout!, occupied);
    occupied.push(next);
    positions.set(neighbor.id, next);
  }
  return resolved.map((other) => {
    if (other.id === id) return { ...other, visibility, layout: box };
    const next = positions.get(other.id);
    return next ? { ...other, layout: next } : other;
  });
}

export function extraFieldHeight(field: PositionedField) {
  return (
    Math.max(0, field.layout.height - defaultFieldSize(field).height) * (CANVAS_ROW + CANVAS_GAP)
  );
}

export function adjacentRow(fields: CardField[], field: PositionedField, direction: number) {
  const placed = positionFields(fields, field.visibility === 'details' ? 'details' : 'summary');
  const rows = [...new Set(placed.map((entry) => entry.layout.y))].sort((a, b) => a - b);
  const next = rows[rows.indexOf(field.layout.y) + direction];
  if (next === undefined) return field.layout.y;
  if (direction < 0) return next;
  return Math.max(
    ...placed
      .filter((entry) => entry.layout.y === next)
      .map((entry) => entry.layout.y + entry.layout.height),
  );
}
