import { el } from '../util/dom';
import { drawStore } from '../draw/drawStore';
import { routeStore } from '../draw/routeComposer';
import { undoStack } from '../draw/undoStack';
import { fitToBounds } from '../map/interactions';
import { openGpxModal, openClearModal } from './modal';
import { formatDistanceShort } from '../util/format';
import { triggerGpxDownload } from '../gpx/export';
import { getComposedLine } from '../draw/routeComposer';
import { flyToPoint } from '../map/mapView';
import { getLastPosition } from '../util/userLocation';

function svgIcon(d: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

const ICONS = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5m5 5H9.5a5.5 5.5 0 0 0 0 11H13',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  fitBounds: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
};

let undoBtn: HTMLButtonElement;
let redoBtn: HTMLButtonElement;
let distanceEl: HTMLSpanElement;

export function createToolbar(container: HTMLElement): HTMLElement {
  const toolbar = el('div', { class: 'toolbar', role: 'toolbar', 'aria-label': '그리기 도구' });

  undoBtn = el('button', {
    class: 'toolbar__btn',
    'aria-label': '실행 취소',
    title: '실행 취소 (Ctrl+Z)',
    disabled: 'true',
  }) as HTMLButtonElement;
  undoBtn.innerHTML = svgIcon(ICONS.undo);

  redoBtn = el('button', {
    class: 'toolbar__btn',
    'aria-label': '다시 실행',
    title: '다시 실행 (Ctrl+Shift+Z)',
    disabled: 'true',
  }) as HTMLButtonElement;
  redoBtn.innerHTML = svgIcon(ICONS.redo);

  const trashBtn = el('button', {
    class: 'toolbar__btn toolbar__btn--danger',
    'aria-label': '모두 지우기',
    title: '모두 지우기',
  }) as HTMLButtonElement;
  trashBtn.innerHTML = svgIcon(ICONS.trash);

  const fitBtn = el('button', {
    class: 'toolbar__btn',
    'aria-label': '경계에 맞추기',
    title: '경계에 맞추기',
  }) as HTMLButtonElement;
  fitBtn.innerHTML = svgIcon(ICONS.fitBounds);

  const locateBtn = el('button', {
    class: 'toolbar__btn',
    'aria-label': '현재 위치로 이동',
    title: '현재 위치로 이동',
  }) as HTMLButtonElement;
  locateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7"/><circle cx="10" cy="10" r="2"/></svg>`;

  const divider = el('div', { class: 'toolbar__divider', role: 'separator' });

  distanceEl = el('span', { class: 'toolbar__distance', 'aria-live': 'polite' }, '0.0 km') as HTMLSpanElement;

  const gpxBtn = el('button', {
    class: 'toolbar__btn toolbar__btn--gpx',
    'aria-label': 'GPX 저장',
    title: 'GPX 저장',
    disabled: 'true',
  }) as HTMLButtonElement;
  gpxBtn.textContent = 'GPX';

  undoBtn.addEventListener('click', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  });
  redoBtn.addEventListener('click', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
  });
  trashBtn.addEventListener('click', () => {
    const pts = drawStore.getState().points;
    if (!pts.length) return;
    openClearModal(() => {
      const prev = [...pts];
      undoStack.push({ t: 'clear', prev });
      drawStore.clear();
      routeStore.clear();
    });
  });
  fitBtn.addEventListener('click', fitToBounds);
  locateBtn.addEventListener('click', () => {
    const pos = getLastPosition();
    if (pos) {
      flyToPoint(pos[0], pos[1], 15);
    } else {
      navigator.geolocation?.getCurrentPosition(
        p => flyToPoint(p.coords.longitude, p.coords.latitude, 15),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  });
  gpxBtn.addEventListener('click', () => {
    const pts = drawStore.getState().points;
    const line = getComposedLine(pts);
    if (!line) return;
    openGpxModal((name, withTimestamp) => {
      void triggerGpxDownload(line, name, withTimestamp);
    });
  });

  toolbar.appendChild(undoBtn);
  toolbar.appendChild(redoBtn);
  toolbar.appendChild(trashBtn);
  toolbar.appendChild(fitBtn);
  toolbar.appendChild(locateBtn);
  toolbar.appendChild(divider);
  toolbar.appendChild(distanceEl);
  toolbar.appendChild(gpxBtn);

  container.appendChild(toolbar);

  // 구독
  undoStack.subscribe(updateUndoRedo);
  routeStore.subscribe(state => {
    const meters = state.totalMeters;
    distanceEl.textContent = meters > 0 ? formatDistanceShort(meters) : '0.0 km';
    const hasDone = [...state.segments.values()].some(s => s.status === 'done');
    gpxBtn.disabled = !hasDone;
    gpxBtn.classList.toggle('active', hasDone);
  });

  return toolbar;
}

function updateUndoRedo(): void {
  undoBtn.disabled = !undoStack.canUndo();
  redoBtn.disabled = !undoStack.canRedo();
}
