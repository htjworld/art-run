type SnapPoint = 'peek' | 'half' | 'full';

const SNAP: Record<SnapPoint, string> = {
  peek: 'translateY(calc(100% - 80px))',
  half: 'translateY(55vh)',
  full: 'translateY(10vh)',
};

export function createBottomSheet(container: HTMLElement): {
  el: HTMLElement;
  snap: (point: SnapPoint) => void;
} {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('aria-label', '코스 목록');

  const handle = document.createElement('div');
  handle.className = 'sheet__handle';
  const bar = document.createElement('div');
  bar.className = 'sheet__handle-bar';
  handle.appendChild(bar);
  sheet.appendChild(handle);

  const header = document.createElement('div');
  header.className = 'sheet__header';
  sheet.appendChild(header);

  const content = document.createElement('div');
  content.className = 'sheet__content';
  sheet.appendChild(content);

  container.appendChild(sheet);

  // 드래그 제스처
  let startY = 0;
  let startTranslate = 0;
  let currentSnap: SnapPoint = 'peek';

  const snapValues: Record<SnapPoint, number> = {
    peek: window.innerHeight - 80,
    half: window.innerHeight * 0.55,
    full: window.innerHeight * 0.1,
  };

  function getTranslateY(): number {
    const style = window.getComputedStyle(sheet);
    const matrix = new DOMMatrix(style.transform);
    return matrix.m42;
  }

  function applySnap(point: SnapPoint): void {
    currentSnap = point;
    sheet.style.transition = 'transform 250ms ease-out';
    sheet.style.transform = SNAP[point];
  }

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    startY = e.clientY;
    startTranslate = getTranslateY();
    sheet.style.transition = 'none';
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    const dy = e.clientY - startY;
    const next = Math.max(snapValues.full, Math.min(snapValues.peek, startTranslate + dy));
    sheet.style.transform = `translateY(${next}px)`;
  });

  handle.addEventListener('pointerup', (e: PointerEvent) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    handle.releasePointerCapture(e.pointerId);

    const current = getTranslateY();
    const dy = e.clientY - startY;

    // 스와이프 방향 우선
    if (Math.abs(dy) > 40) {
      if (dy < 0) {
        if (currentSnap === 'peek') applySnap('half');
        else applySnap('full');
      } else {
        if (currentSnap === 'full') applySnap('half');
        else applySnap('peek');
      }
    } else {
      // 가장 가까운 스냅 포인트로
      const distances: [SnapPoint, number][] = [
        ['peek', Math.abs(current - snapValues.peek)],
        ['half', Math.abs(current - snapValues.half)],
        ['full', Math.abs(current - snapValues.full)],
      ];
      const nearest = distances.sort((a, b) => a[1] - b[1])[0][0];
      applySnap(nearest);
    }
  });

  // 초기 상태
  sheet.style.transform = SNAP.peek;

  return {
    el: sheet,
    snap: applySnap,
  };
}
