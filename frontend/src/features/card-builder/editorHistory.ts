export type EditorHistory<T> = { past: T[]; present: T; future: T[]; batchStart: T | null };
export type EditorHistoryAction<T> =
  { type: 'change'; value: T | ((previous: T) => T) } | { type: 'begin' | 'end' | 'undo' | 'redo' };

const same = <T>(first: T, second: T) => JSON.stringify(first) === JSON.stringify(second);
const remember = <T>(past: T[], value: T) => [...past, value].slice(-50);

export function editorHistory<T>(
  state: EditorHistory<T>,
  action: EditorHistoryAction<T>,
): EditorHistory<T> {
  if (action.type === 'begin')
    return state.batchStart === null ? { ...state, batchStart: state.present } : state;
  if (action.type === 'end') {
    if (state.batchStart === null) return state;
    return {
      ...state,
      past: same(state.batchStart, state.present)
        ? state.past
        : remember(state.past, state.batchStart),
      future: same(state.batchStart, state.present) ? state.future : [],
      batchStart: null,
    };
  }
  if (action.type === 'change') {
    const next =
      typeof action.value === 'function'
        ? (action.value as (previous: T) => T)(state.present)
        : action.value;
    if (same(next, state.present)) return state;
    return {
      ...state,
      present: next,
      past: state.batchStart === null ? remember(state.past, state.present) : state.past,
      future: state.batchStart === null ? [] : state.future,
    };
  }
  if (action.type === 'undo') {
    if (state.batchStart !== null && !same(state.batchStart, state.present)) {
      return {
        ...state,
        present: state.batchStart,
        future: [state.present],
        batchStart: null,
      };
    }
    if (!state.past.length) return { ...state, batchStart: null };
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
      batchStart: null,
    };
  }
  if (!state.future.length) return state;
  return {
    past: remember(state.past, state.present),
    present: state.future[0],
    future: state.future.slice(1),
    batchStart: null,
  };
}
