import { useReducer, type KeyboardEvent, type SetStateAction } from 'react';
import { editorHistory, type EditorHistory } from './editorHistory';

export function useEditorHistory<T>(initial: () => T) {
  const [state, dispatch] = useReducer(editorHistory<T>, undefined, (): EditorHistory<T> => ({
    past: [],
    present: initial(),
    future: [],
    batchStart: null,
  }));
  const change = (value: SetStateAction<T>) => dispatch({ type: 'change', value });
  const history = {
    canUndo:
      state.past.length > 0 ||
      (state.batchStart !== null &&
        JSON.stringify(state.batchStart) !== JSON.stringify(state.present)),
    canRedo:
      state.future.length > 0 &&
      (state.batchStart === null ||
        JSON.stringify(state.batchStart) === JSON.stringify(state.present)),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    begin: () => dispatch({ type: 'begin' }),
    end: () => dispatch({ type: 'end' }),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      let key = event.key.toLowerCase();
      if (event.code === 'KeyZ') key = 'z';
      if (event.code === 'KeyY') key = 'y';
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' });
    },
  };
  return [state.present, change, history] as const;
}
