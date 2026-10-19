import { clamp, eyePath, smooth, steamPath } from './varenikPaths';

const WINK_COOLDOWN_SECONDS = 2.2;

export function animateVarenik(button: HTMLButtonElement) {
  const body = button.querySelector<SVGGElement>('[data-body]')!;
  const steam = button.querySelector<SVGGElement>('[data-steam]')!;
  const eye = button.querySelector<SVGPathElement>('[data-eye]')!;
  const steamPaths = [...button.querySelectorAll<SVGPathElement>('[data-steam-line]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let elapsedSeconds = 0;
  let previousFrameAt = performance.now();
  let winkStartedAt = -20;
  let animationFrame = 0;
  function render() {
    const time = reducedMotion.matches ? 0 : elapsedSeconds;
    const verticalOffset = 2.1 * Math.sin(time * 0.96) + 0.65 * Math.sin(time * 1.64 + 0.7);
    const horizontalOffset = 2.4 * Math.sin(time * 0.44) + 0.5 * Math.sin(time * 1.03);
    const rotation = 2.8 * Math.sin(time * 0.96 - 0.8) + 0.7 * Math.sin(time * 0.44 + 1.1);
    body.setAttribute(
      'transform',
      `translate(${horizontalOffset} ${verticalOffset}) rotate(${rotation} 100 113)`,
    );
    const winkAge = reducedMotion.matches ? 20 : time - winkStartedAt;
    let wink = 0;
    if (winkAge >= 0 && winkAge < 0.16) wink = smooth(winkAge / 0.16);
    else if (winkAge >= 0.16 && winkAge < 0.36) wink = 1;
    else if (winkAge >= 0.36 && winkAge < 0.7) wink = 1 - smooth((winkAge - 0.36) / 0.34);
    eye.setAttribute('d', eyePath(wink));
    steam.setAttribute(
      'transform',
      `translate(${horizontalOffset * 0.7} ${verticalOffset * 0.25})`,
    );
    renderSteam(time, winkAge);
  }

  function renderSteam(time: number, winkAge: number) {
    steamPaths.forEach((line, i) => {
      const steamProgress = (winkAge - i * 0.12) / 2.05;
      let bottom = 66,
        length = 38,
        opacity = 0.8,
        phase = time * 0.65 + i * 1.8,
        amplitude = 2.7;
      if (steamProgress >= 0 && steamProgress < 1) {
        if (steamProgress < 0.78) {
          const riseProgress = steamProgress / 0.78;
          bottom = 66 - 52 * riseProgress * riseProgress;
          length = 38 + 20 * Math.sin(riseProgress * Math.PI);
          phase = time * 4.2 + i * 1.8;
          amplitude = 3.2 + riseProgress * 1.7;
          opacity = 1 - clamp((riseProgress - 0.65) / 0.35);
        } else opacity = clamp((steamProgress - 0.78) / 0.22) * 0.8;
      }
      line.setAttribute('d', steamPath(i ? 117.5 : 80, bottom, length, phase, amplitude));
      line.setAttribute('opacity', String(opacity));
    });
  }
  function trigger() {
    if (reducedMotion.matches || elapsedSeconds - winkStartedAt < WINK_COOLDOWN_SECONDS) return;
    winkStartedAt = elapsedSeconds;
    render();
  }
  function enter(event: PointerEvent) {
    if (event.pointerType === 'mouse') trigger();
  }
  function click(event: MouseEvent) {
    if (event.detail === 0 || ('pointerType' in event && event.pointerType !== 'mouse')) trigger();
  }
  function frame(now: number) {
    elapsedSeconds += Math.min((now - previousFrameAt) / 1000, 0.05);
    previousFrameAt = now;
    render();
    animationFrame = requestAnimationFrame(frame);
  }
  function updatePlayback() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (reducedMotion.matches) {
      winkStartedAt = -20;
      render();
    } else if (!document.hidden) {
      previousFrameAt = performance.now();
      animationFrame = requestAnimationFrame(frame);
    }
  }
  button.addEventListener('pointerenter', enter);
  button.addEventListener('click', click);
  reducedMotion.addEventListener('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  render();
  updatePlayback();
  return () => {
    cancelAnimationFrame(animationFrame);
    button.removeEventListener('pointerenter', enter);
    button.removeEventListener('click', click);
    reducedMotion.removeEventListener('change', updatePlayback);
    document.removeEventListener('visibilitychange', updatePlayback);
  };
}
