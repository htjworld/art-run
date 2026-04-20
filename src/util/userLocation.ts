type LocationCallback = (lng: number, lat: number) => void;

let currentPos: [number, number] | null = null;
const listeners = new Set<LocationCallback>();

/** GeolocateControl 등 사용자 제스처로 얻은 위치를 모듈에 반영 */
export function updatePosition(lng: number, lat: number): void {
  currentPos = [lng, lat];
  listeners.forEach(fn => fn(lng, lat));
}

export function getLastPosition(): [number, number] | null {
  return currentPos;
}

export function onLocationUpdate(fn: LocationCallback): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
