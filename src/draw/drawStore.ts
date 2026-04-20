import type { LngLat } from '../util/coord';

export type DrawMode = 'idle' | 'point' | 'draw';

export interface Point {
  id: string;
  lng: number;
  lat: number;
}

export interface DrawState {
  mode: DrawMode;
  points: Point[];
  isDragging: boolean;
  dragCapture: LngLat[];
}

type Listener = (state: DrawState) => void;

function createDrawStore() {
  let state: DrawState = {
    mode: 'idle',
    points: [],
    isDragging: false,
    dragCapture: [],
  };

  const listeners = new Set<Listener>();

  function notify(): void {
    listeners.forEach(fn => fn(state));
  }

  return {
    getState: (): DrawState => state,

    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    setMode(mode: DrawMode): void {
      state = { ...state, mode };
      notify();
    },

    addPoint(point: Point): void {
      state = { ...state, points: [...state.points, point] };
      notify();
    },

    updatePoint(id: string, lng: number, lat: number): void {
      state = {
        ...state,
        points: state.points.map(p => (p.id === id ? { ...p, lng, lat } : p)),
      };
      notify();
    },

    removePoint(id: string): void {
      state = { ...state, points: state.points.filter(p => p.id !== id) };
      notify();
    },

    setPoints(points: Point[]): void {
      state = { ...state, points: [...points] };
      notify();
    },

    clear(): void {
      state = { ...state, points: [], dragCapture: [], isDragging: false };
      notify();
    },

    startDrag(): void {
      state = { ...state, isDragging: true, dragCapture: [] };
      notify();
    },

    addDragCapture(pt: LngLat): void {
      state = { ...state, dragCapture: [...state.dragCapture, pt] };
      notify();
    },

    setDragCapture(coords: LngLat[]): void {
      state = { ...state, dragCapture: [...coords] };
      notify();
    },

    endDrag(): void {
      state = { ...state, isDragging: false, dragCapture: [] };
      notify();
    },
  };
}

export const drawStore = createDrawStore();
