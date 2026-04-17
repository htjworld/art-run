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
      throw new RoutingError('quota', '오늘의 경로 요청 한도에 도달했어요. 내일 다시 시도해 주세요.');
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

/** 지수 백오프 1회 재시도 (500ms) */
export async function routeWithRetry(
  provider: RoutingProvider,
  from: LngLat,
  to: LngLat,
  signal?: AbortSignal
): Promise<RouteResult> {
  try {
    return await provider.route(from, to, signal);
  } catch (err) {
    if (err instanceof RoutingError && err.kind === 'network') {
      await new Promise(r => setTimeout(r, 500));
      return provider.route(from, to, signal);
    }
    throw err;
  }
}
