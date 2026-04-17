import { el } from '../util/dom';

export interface ModalButton {
  label: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  onClick: (close: () => void) => void;
  id?: string;
}

export interface ModalOptions {
  title: string;
  body: HTMLElement | string;
  buttons: ModalButton[];
  onClose?: () => void;
}

export function openModal(options: ModalOptions): () => void {
  const overlay = el('div', { class: 'modal-overlay' });
  const modal = el('div', { class: 'modal' });

  const title = el('div', { class: 'modal__title' }, options.title);
  const body = el('div', { class: 'modal__body' });

  if (typeof options.body === 'string') {
    body.innerHTML = options.body;
  } else {
    body.appendChild(options.body);
  }

  const actions = el('div', { class: 'modal__actions' });
  for (const btn of options.buttons) {
    const b = el('button', { class: `btn btn--${btn.variant}` }, btn.label);
    if (btn.id) b.id = btn.id;
    b.addEventListener('click', () => btn.onClick(close));
    actions.appendChild(b);
  }

  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      options.onClose?.();
    }, 150);
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });

  return close;
}

/** 이름 입력 + 타임스탬프 토글 모달 */
export function openGpxModal(
  onSave: (name: string, withTimestamp: boolean) => void
): void {
  const formEl = el('div', {});

  const nameGroup = el('div', { class: 'form-group' });
  const nameLabel = el('label', { class: 'form-label', for: 'gpx-name' }, '코스 이름');
  const nameInput = el('input', {
    class: 'form-input',
    id: 'gpx-name',
    type: 'text',
    placeholder: '내 아트런',
    'aria-label': '코스 이름',
  }) as HTMLInputElement;
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);

  const toggleRow = el('label', { class: 'form-toggle' });
  const toggleLabel = el('div', { class: 'form-toggle__label' });
  const toggleTitle = el('div', { class: 'form-toggle__title' }, '타임스탬프 포함');
  const toggleCaption = el(
    'div',
    { class: 'form-toggle__caption' },
    'Strava에서 route로 인식되려면 필요해요'
  );
  const toggleInput = el('input', {
    class: 'toggle-switch',
    type: 'checkbox',
    'aria-label': '타임스탬프 포함',
  }) as HTMLInputElement;
  toggleInput.checked = true;

  toggleLabel.appendChild(toggleTitle);
  toggleLabel.appendChild(toggleCaption);
  toggleRow.appendChild(toggleLabel);
  toggleRow.appendChild(toggleInput);

  formEl.appendChild(nameGroup);
  formEl.appendChild(toggleRow);

  openModal({
    title: 'GPX 저장하기',
    body: formEl,
    buttons: [
      {
        label: '취소',
        variant: 'ghost',
        onClick: c => c(),
      },
      {
        label: '저장',
        variant: 'primary',
        id: 'gpx-save-btn',
        onClick: c => {
          onSave(nameInput.value.trim(), toggleInput.checked);
          c();
        },
      },
    ],
  });

  setTimeout(() => nameInput.focus(), 50);
}

/** 전체 삭제 확인 모달 */
export function openClearModal(onConfirm: () => void): void {
  const desc = el(
    'p',
    { class: 'modal__desc' },
    '되돌릴 수 있지만, 한 번에 모두 사라져요.'
  );
  openModal({
    title: '모든 점을 지울까요?',
    body: desc,
    buttons: [
      { label: '취소', variant: 'ghost', onClick: c => c() },
      {
        label: '다 지우기',
        variant: 'danger',
        onClick: c => { onConfirm(); c(); },
      },
    ],
  });
}
