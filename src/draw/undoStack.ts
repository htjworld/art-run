import type { Point } from './drawStore';
import type { LngLat } from '../util/coord';

export type Op =
  | { t: 'add'; point: Point }
  | { t: 'move'; id: string; from: LngLat; to: LngLat }
  | { t: 'delete'; index: number; point: Point }
  | { t: 'dragBatch'; points: Point[] }
  | { t: 'clear'; prev: Point[] };

const MAX_HISTORY = 100;

function createUndoStack() {
  const history: Op[] = [];
  let cursor = -1;
  const listeners = new Set<() => void>();

  function notify(): void {
    listeners.forEach(fn => fn());
  }

  return {
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    canUndo(): boolean {
      return cursor >= 0;
    },

    canRedo(): boolean {
      return cursor < history.length - 1;
    },

    push(op: Op): void {
      // redo 스택 제거
      history.splice(cursor + 1);
      history.push(op);
      if (history.length > MAX_HISTORY) history.shift();
      cursor = history.length - 1;
      notify();
    },

    peekUndo(): Op | undefined {
      return history[cursor];
    },

    undo(): Op | undefined {
      if (cursor < 0) return undefined;
      const op = history[cursor--];
      notify();
      return op;
    },

    redo(): Op | undefined {
      if (cursor >= history.length - 1) return undefined;
      const op = history[++cursor];
      notify();
      return op;
    },

    clear(): void {
      history.length = 0;
      cursor = -1;
      notify();
    },
  };
}

export const undoStack = createUndoStack();
