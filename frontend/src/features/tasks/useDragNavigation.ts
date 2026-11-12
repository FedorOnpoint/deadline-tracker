import { useLayoutEffect, useRef } from 'react';

export function useDragNavigation(dragging: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useRef(0);
  const animation = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const panel = ref.current!;
    const observer = new ResizeObserver(() => {
      if (animation.current?.playState !== 'running') height.current = panel.offsetHeight;
    });
    observer.observe(panel);
    return () => {
      observer.disconnect();
      animation.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    const panel = ref.current!;
    const previous =
      animation.current?.playState === 'running'
        ? panel.getBoundingClientRect().height
        : height.current;
    animation.current?.cancel();
    const next = panel.offsetHeight;
    height.current = next;
    if (
      !previous ||
      previous === next ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    // Animate the space occupied by the panel together with its visible contents.
    animation.current = panel.animate(
      [
        { height: `${previous}px`, overflow: 'clip' },
        { height: `${next}px`, overflow: 'clip' },
      ],
      { duration: 180, easing: 'ease-out' },
    );
  }, [dragging]);

  return ref;
}
