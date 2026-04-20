type LocationCallback = (lng: number, lat: number) => void;

let watchId: number | null = null;
let currentPos: [number, number] | null = null;
const listeners = new Set<LocationCallback>();

export function startLocationWatch(): void {
  if (!navigator.geolocation || watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(
    pos => {
      currentPos = [pos.coords.longitude, pos.coords.latitude];
      listeners.forEach(fn => fn(currentPos![0], currentPos![1]));
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 30000 },
  );
}

export function getLastPosition(): [number, number] | null {
  return currentPos;
}

export function onLocationUpdate(fn: LocationCallback): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
