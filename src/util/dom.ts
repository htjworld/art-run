export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') e.appendChild(document.createTextNode(child));
    else e.appendChild(child);
  }
  return e;
}

export function qs<E extends Element = Element>(
  selector: string,
  root: ParentNode = document
): E {
  const found = root.querySelector<E>(selector);
  if (!found) throw new Error(`Element not found: ${selector}`);
  return found;
}

export function qsAll<E extends Element = Element>(
  selector: string,
  root: ParentNode = document
): NodeListOf<E> {
  return root.querySelectorAll<E>(selector);
}

export function on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement,
  type: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  el.addEventListener(type, handler as EventListener, options);
  return () => el.removeEventListener(type, handler as EventListener, options);
}
