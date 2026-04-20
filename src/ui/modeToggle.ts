import { el } from '../util/dom';
import { drawStore, type DrawMode } from '../draw/drawStore';
import { setDragOverlayActive } from '../draw/dragMode';

const MODES: { id: DrawMode; label: string }[] = [
  { id: 'point', label: '점' },
  { id: 'draw', label: '그리기' },
  { id: 'idle', label: '선택' },
];

export function createModeToggle(container: HTMLElement): HTMLElement {
  const wrap = el('div', {
    class: 'mode-toggle',
    role: 'group',
    'aria-label': '그리기 모드',
  });

  const buttons: Map<DrawMode, HTMLButtonElement> = new Map();

  for (const { id, label } of MODES) {
    const btn = el('button', {
      class: 'mode-toggle__btn',
      'aria-label': `${label} 모드`,
      'data-mode': id,
    }) as HTMLButtonElement;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      drawStore.setMode(id);
    });
    wrap.appendChild(btn);
    buttons.set(id, btn);
  }

  function update(mode: DrawMode): void {
    buttons.forEach((btn, m) => {
      btn.classList.toggle('active', m === mode);
      btn.setAttribute('aria-pressed', String(m === mode));
    });
    // 드래그 오버레이 활성화
    setDragOverlayActive(mode === 'draw');
  }

  drawStore.subscribe(state => update(state.mode));
  update(drawStore.getState().mode);

  container.appendChild(wrap);
  return wrap;
}
