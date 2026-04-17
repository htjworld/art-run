export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  ms: number
): { (...args: T): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function debounced(...args: T): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
