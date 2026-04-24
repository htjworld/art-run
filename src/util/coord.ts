/** [longitude, latitude] — GeoJSON 순서 */
export type LngLat = [number, number];

/** GPX trkpt 포인트 */
export interface GpxPt {
  lat: number;
  lon: number;
  time?: string;
}

export function lngLatToGpxPt(ll: LngLat): GpxPt {
  return { lat: ll[1], lon: ll[0] };
}


/** 세그먼트 캐시 키 — 소수점 5자리 반올림 */
export function coordKey(a: LngLat, b: LngLat): string {
  return `${round5(a[0])},${round5(a[1])}|${round5(b[0])},${round5(b[1])}`;
}

export function round5(v: number): number {
  return Math.round(v * 100000) / 100000;
}

export function lngLatFromMapLibre(ll: { lng: number; lat: number }): LngLat {
  return [ll.lng, ll.lat];
}
