import type { LngLat } from '../util/coord';
import type { LineString } from 'geojson';

export type RoutingProfile = 'foot-walking';

export interface RouteResult {
  line: LineString;
  meters: number;
}

export interface RoutingProvider {
  route(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<RouteResult>;
}

export class RoutingError extends Error {
  constructor(
    public readonly kind: 'quota' | 'no-route' | 'network' | 'unknown',
    message: string
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}
