const OPEN_EYE = [38, 38, 38, 36.9, 38.9, 36, 40, 36, 41.1, 36, 42, 36.9, 42, 38, 42, 39.1, 41.1, 40, 40, 40, 38.9, 40, 38, 39.1, 38, 38];
const CLOSED_EYE = [36.8, 38.4, 38.4, 36.4, 41.6, 36.4, 43.2, 38.4, 43.8, 39.1, 43, 39.9, 42.5, 39.2, 41, 37.8, 39, 37.8, 37.5, 39.2, 37, 39.9, 36.2, 39.1, 36.8, 38.4];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function smooth(value: number) { const p = clamp(value); return p * p * (3 - 2 * p); }
export function eyePath(progress: number) {
  const points = OPEN_EYE.map((value, i) => value + (CLOSED_EYE[i] - value) * progress);
  return `M${points[0]} ${points[1]}` + [2, 8, 14, 20].map(i => `C${points.slice(i, i + 6).join(' ')}`).join('') + 'Z';
}
function steamPath(x: number, bottom: number, length: number, phase: number, amplitude: number) {
  const points = Array.from({ length: 9 }, (_, i) => {
    const p = i / 8;
    return [x + Math.sin(p * Math.PI * 2.1 - phase) * amplitude, bottom - p * length];
  });
  let path = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    path += `C${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6} ${c[0] - (d[0] - b[0]) / 6} ${c[1] - (d[1] - b[1]) / 6} ${c[0]} ${c[1]}`;
  }
  return path;
}

export function animateVarenik(button: HTMLButtonElement) {
  const body = button.querySelector<SVGGElement>('[data-body]')!;
  const steam = button.querySelector<SVGGElement>('[data-steam]')!;
  const eye = button.querySelector<SVGPathElement>('[data-eye]')!;
  const steamPaths = [...button.querySelectorAll<SVGPathElement>('[data-steam-line]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let time = 0, previous = performance.now(), winkTime = -20, frameID = 0;
  function render() {
    const t = reduced.matches ? 0 : time;
    const heave = 2.1 * Math.sin(t * .96) + .65 * Math.sin(t * 1.64 + .7);
    const drift = 2.4 * Math.sin(t * .44) + .5 * Math.sin(t * 1.03);
    const roll = 2.8 * Math.sin(t * .96 - .8) + .7 * Math.sin(t * .44 + 1.1);
    body.setAttribute('transform', `translate(${drift} ${heave}) rotate(${roll} 100 113)`);
    const age = reduced.matches ? 20 : t - winkTime;
    let wink = 0;
    if (age >= 0 && age < .16) wink = smooth(age / .16);
    else if (age >= .16 && age < .36) wink = 1;
    else if (age >= .36 && age < .7) wink = 1 - smooth((age - .36) / .34);
    eye.setAttribute('d', eyePath(wink));
    steam.setAttribute('transform', `translate(${drift * .7} ${heave * .25})`);
    steamPaths.forEach((line, i) => {
      const p = (age - i * .12) / 2.05;
      let bottom = 66, length = 38, opacity = .8, phase = t * .65 + i * 1.8, amplitude = 2.7;
      if (p >= 0 && p < 1) {
        if (p < .78) {
          const q = p / .78;
          bottom = 66 - 52 * q * q; length = 38 + 20 * Math.sin(q * Math.PI);
          phase = t * 4.2 + i * 1.8; amplitude = 3.2 + q * 1.7; opacity = 1 - clamp((q - .65) / .35);
        } else opacity = clamp((p - .78) / .22) * .8;
      }
      line.setAttribute('d', steamPath(i ? 117.5 : 80, bottom, length, phase, amplitude));
      line.setAttribute('opacity', String(opacity));
    });
  }
  function trigger() {
    if (reduced.matches || time - winkTime < 2.2) return;
    winkTime = time; render();
  }
  function enter(event: PointerEvent) { if (event.pointerType === 'mouse') trigger(); }
  function click(event: MouseEvent) {
    if (event.detail === 0 || ('pointerType' in event && event.pointerType !== 'mouse')) trigger();
  }
  function frame(now: number) {
    time += Math.min((now - previous) / 1000, .05); previous = now;
    render(); frameID = requestAnimationFrame(frame);
  }
  function updatePlayback() {
    cancelAnimationFrame(frameID); frameID = 0;
    if (reduced.matches) { winkTime = -20; render(); }
    else if (!document.hidden) { previous = performance.now(); frameID = requestAnimationFrame(frame); }
  }
  button.addEventListener('pointerenter', enter);
  button.addEventListener('click', click);
  reduced.addEventListener('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  render(); updatePlayback();
  return () => {
    cancelAnimationFrame(frameID);
    button.removeEventListener('pointerenter', enter);
    button.removeEventListener('click', click);
    reduced.removeEventListener('change', updatePlayback);
    document.removeEventListener('visibilitychange', updatePlayback);
  };
}
