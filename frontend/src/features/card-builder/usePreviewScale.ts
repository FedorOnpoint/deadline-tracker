import { useEffect, useRef, useState } from 'react';

export function usePreviewScale() {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [actualSize, setActualSize] = useState(false);
  const [size, setSize] = useState({ width: 1200, height: 0, available: 600 });

  useEffect(() => {
    // Keep the editing view readable; the full list width is available on demand.
    const main = document.querySelector('main');
    const frame = viewport.current;
    const card = content.current;
    if (!main || !frame || !card) return;
    const measure = () => {
      if (!frame.clientWidth) return;
      const styles = getComputedStyle(main);
      const width =
        main.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      setSize((previous) => {
        const frameStyles = getComputedStyle(frame);
        const available =
          frame.clientWidth -
          parseFloat(frameStyles.paddingLeft) -
          parseFloat(frameStyles.paddingRight);
        const next = { width, height: card.offsetHeight, available };
        return previous.width === next.width &&
          previous.height === next.height &&
          previous.available === next.available
          ? previous
          : next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    observer.observe(frame);
    observer.observe(card);
    measure();
    return () => observer.disconnect();
  }, []);

  const scale = 1;
  return {
    viewport,
    content,
    actualSize,
    setActualSize,
    scale,
    width: actualSize ? size.width : size.available,
    height: size.height,
  };
}
