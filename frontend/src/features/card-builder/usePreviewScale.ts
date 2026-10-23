import { useEffect, useRef, useState } from 'react';

export function usePreviewScale() {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [actualSize, setActualSize] = useState(false);
  const [size, setSize] = useState({ width: 1200, height: 0, available: 600 });

  useEffect(() => {
    // Render at the live list width; fitting changes only the preview's visual scale.
    const main = document.querySelector('main');
    const frame = viewport.current;
    const card = content.current;
    if (!main || !frame || !card) return;
    const measure = () => {
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

  const scale = actualSize ? 1 : Math.max(0, Math.min(1, size.available / size.width));
  return {
    viewport,
    content,
    actualSize,
    setActualSize,
    scale,
    width: size.width,
    height: size.height,
  };
}
