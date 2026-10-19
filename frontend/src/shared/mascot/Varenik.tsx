import { useEffect, useRef } from 'react';
import { animateVarenik } from './varenikMotion';
import { eyePath } from './varenikPaths';

export function Varenik() {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => animateVarenik(button.current!), []);
  return (
    <button
      ref={button}
      className="auth-mascot"
      type="button"
      aria-label="Вареник: подмигнуть и выпустить пар"
    >
      <svg
        className="auth-mascot-art"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        fill="none"
        width="230"
        height="230"
        aria-hidden="true"
      >
        <g data-steam stroke="#a4e6cf" strokeWidth="4.5" strokeLinecap="round">
          <path data-steam-line d="M80 66c-5-12 5-24 0-38" />
          <path data-steam-line d="M117.5 66c-5-12 5-24 0-38" />
        </g>
        <g data-body>
          <g transform="translate(20 16) scale(2.5)">
            <path
              d="M6 37c-2-4 0-8 4-8-1-5 3-8 7-7 1-5 5-7 9-4 3-4 8-4 11 0 4-3 8-1 9 4 4-1 8 2 7 7 4 0 7 4 5 8-3 14-13 22-26 22S9 51 6 37Z"
              fill="#8bd8ba"
            />
            <path
              d="M12 36c5-10 12-14 20-14s15 4 20 14"
              stroke="#39765e"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="m14 29 3 4m6-10 2 5m7-7v5m9-3-2 5m11 1-3 4"
              stroke="#39765e"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="24" cy="38" r="2" fill="#173628" />
            <path data-eye d={eyePath(0)} fill="#173628" />
            <path d="M26 45q6 6 12 0" stroke="#173628" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M17 43h3m24 0h3" stroke="#39765e" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </button>
  );
}
