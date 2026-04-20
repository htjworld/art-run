import type { GeoJSONSource } from 'maplibre-gl';
import type { LineString } from 'geojson';
import { getMap } from './mapView';

const SRC = 'route-anim-dot';
const LYR = 'route-anim-dot';

const TRAVEL_MS = 3800; // 시작 → 끝 이동 시간
const PAUSE_MS = 1000;  // 양 끝 대기 시간

let rafId: number | null = null;

export function initRouteAnimator(): void {
  const map = getMap();
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: LYR,
    type: 'circle',
    source: SRC,
    paint: {
      'circle-color': '#BDEFFC',
      'circle-radius': 9,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 3,
    },
  });
}

export function startRouteAnimation(route: LineString): void {
  stopRouteAnimation();

  const coords = route.coordinates as [number, number][];
  if (coords.length < 2) return;

  // 누적 거리 (애니메이션용 유클리드)
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const total = cum[cum.length - 1];

  function lerp(t: number): [number, number] {
    const d = t * total;
    let lo = 0, hi = coords.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo];
    const f = seg === 0 ? 0 : (d - cum[lo]) / seg;
    return [
      coords[lo][0] + f * (coords[hi][0] - coords[lo][0]),
      coords[lo][1] + f * (coords[hi][1] - coords[lo][1]),
    ];
  }

  function setPos(lng: number, lat: number): void {
    const src = getMap().getSource(SRC) as GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }],
    });
  }

  // phase: 0 = pause-start, 1 = travel, 2 = pause-end
  let phase = 0;
  let phaseStart = performance.now();

  function tick(now: number): void {
    const elapsed = now - phaseStart;

    if (phase === 0) {
      setPos(coords[0][0], coords[0][1]);
      if (elapsed >= PAUSE_MS) { phase = 1; phaseStart = now; }
    } else if (phase === 1) {
      const t = Math.min(elapsed / TRAVEL_MS, 1);
      const [lng, lat] = lerp(t);
      setPos(lng, lat);
      if (t >= 1) { phase = 2; phaseStart = now; }
    } else {
      setPos(coords[coords.length - 1][0], coords[coords.length - 1][1]);
      if (elapsed >= PAUSE_MS) { phase = 0; phaseStart = now; }
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

export function stopRouteAnimation(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  try {
    const src = getMap().getSource(SRC) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
  } catch { /* map 미준비 */ }
}
