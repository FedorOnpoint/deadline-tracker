import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Task } from '../../shared/types';

type Drag = { task: Task; x: number; y: number; target: string | null };

export function useTaskDrag(onMove: (task: Task, section: string) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  function start(event: ReactPointerEvent<HTMLElement>, task: Task) {
    if (event.button !== 0 || !event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const handle = target.closest('[data-drag-handle]');
    if (
      !handle &&
      (event.pointerType !== 'mouse' || target.closest('button, select, input, textarea, a'))
    )
      return;
    if (event.pointerType === 'mouse') event.preventDefault();
    cleanup.current();
    const source = event.currentTarget;
    const pointerID = event.pointerId;
    const initialX = event.clientX;
    const initialY = event.clientY;
    let active = false;
    let destination: string | null = null;
    let lastX = initialX;
    let lastY = initialY;
    let frame = 0;
    const previousSelection = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    const suppressClick = (click: MouseEvent) => {
      click.preventDefault();
      click.stopPropagation();
    };
    function hitTest() {
      const tab = document
        .elementFromPoint(lastX, lastY)
        ?.closest<HTMLElement>('[data-task-section]');
      destination = tab?.dataset.taskSection ?? null;
      setDrag((previous) =>
        previous?.x === lastX && previous.y === lastY && previous.target === destination
          ? previous
          : { task, x: lastX, y: lastY, target: destination },
      );
    }
    function scroll() {
      const margin = 48;
      const sections = document
        .elementFromPoint(lastX, lastY)
        ?.closest('.section-navigation.is-dragging .section-tabs');
      if (sections) {
        const bounds = sections.getBoundingClientRect();
        if (lastY < bounds.top + margin) sections.scrollBy(0, -10);
        else if (lastY > bounds.bottom - margin) sections.scrollBy(0, 10);
      } else if (lastY < margin) window.scrollBy(0, -14);
      else if (lastY > window.innerHeight - margin) window.scrollBy(0, 14);
      hitTest();
      frame = requestAnimationFrame(scroll);
    }
    function activate() {
      clearTimeout(timer);
      active = true;
      source.setPointerCapture(pointerID);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.addEventListener('click', suppressClick, true);
      hitTest();
      frame = requestAnimationFrame(scroll);
    }
    const timer = window.setTimeout(activate, 300);
    function stop() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', cancel);
      if (source.hasPointerCapture(pointerID)) source.releasePointerCapture(pointerID);
      if (active) {
        document.body.style.userSelect = previousSelection;
        document.body.style.cursor = previousCursor;
        // The click synthesized after pointerup must not expand the source card.
        window.setTimeout(() => document.removeEventListener('click', suppressClick, true), 0);
      }
      setDrag(null);
      cleanup.current = () => {};
    }
    function move(pointer: PointerEvent) {
      if (pointer.pointerId !== pointerID) return;
      lastX = pointer.clientX;
      lastY = pointer.clientY;
      if (!active) {
        if (Math.hypot(lastX - initialX, lastY - initialY) <= 8) return;
        if (event.pointerType !== 'mouse') {
          stop();
          return;
        }
        activate();
      }
      pointer.preventDefault();
      hitTest();
    }
    function release(pointer: PointerEvent) {
      if (pointer.pointerId !== pointerID) return;
      if (active) {
        lastX = pointer.clientX;
        lastY = pointer.clientY;
        hitTest();
      }
      const section = active ? destination : null;
      stop();
      if (section && section !== task.section) onMove(task, section);
    }
    function cancel() {
      stop();
    }
    function keydown(key: KeyboardEvent) {
      if (key.key === 'Escape') {
        key.preventDefault();
        stop();
      }
    }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', cancel);
    cleanup.current = stop;
  }
  return { drag, start };
}
