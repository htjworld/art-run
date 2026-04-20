import type { LngLat } from '../util/coord';
import type { RoutingProvider, RouteResult } from './provider';
import { RoutingError } from './provider';
import { cacheGet, cacheSet } from './segmentCache';
import type { LineString, Feature, FeatureCollection } from 'geojson';

const ORS_URL =
  'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

export class OrsClient implements RoutingProvider {
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  async route(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<RouteResult> {
    const cached = cacheGet(from, to);
    if (cached) return cached;

    let res: Response;
    try {
      res = await fetch(ORS_URL, {
        method: 'POST',
        headers: {
          Authorization: this.key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coordinates: [from, to] }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      throw new RoutingError('network', '네트워크 오류가 발생했어요.');
    }

    if (res.status === 429) {
      throw new RoutingError('rate-limit', '요청이 잠시 많아요. 재시도 중...');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (text.includes('Could not find routable point')) {
        throw new RoutingError('no-route', '이 위치에서 경로를 찾을 수 없어요.');
      }
      throw new RoutingError('unknown', `경로 계산 실패 (${res.status})`);
    }

    const json = (await res.json()) as FeatureCollection;
    const feature = json.features?.[0] as Feature<LineString> | undefined;
    if (!feature?.geometry?.coordinates?.length) {
      throw new RoutingError('no-route', '경로를 찾을 수 없어요.');
    }

    const meters: number =
      (feature.properties?.summary?.distance as number | undefined) ?? 0;
    const result: RouteResult = { line: feature.geometry, meters };
    cacheSet(from, to, result);
    return result;
  }
}

/** 지수 백오프 재시도 — network/rate-limit 에러는 최대 3회 */
export async function routeWithRetry(
  provider: RoutingProvider,
  from: LngLat,
  to: LngLat,
  signal?: AbortSignal
): Promise<RouteResult> {
  // no-route는 재시도 무의미, quota(daily)는 당일 불가
  const NO_RETRY_KINDS: string[] = ['no-route', 'quota'];
  const DELAYS = [1200, 3000, 6000];

  let lastErr: unknown;
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      return await provider.route(from, to, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (err instanceof RoutingError && NO_RETRY_KINDS.includes(err.kind)) throw err;
      lastErr = err;
      if (attempt < DELAYS.length) {
        await new Promise<void>(r => setTimeout(r, DELAYS[attempt]));
      }
    }
  }
  throw lastErr;
}
