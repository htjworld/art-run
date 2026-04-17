import type { LineString } from 'geojson';

export type CourseType = 'scenic' | 'artrun';

export interface Course {
  id: string;
  type: CourseType;
  name: string;
  distanceKm: number;
  region: string;
  description: string;
  thumbnail: string;
  center: [number, number];
  zoom: number;
  waypoints: [number, number][];
  route: LineString | null;
  routeSimplified: LineString | null;
}
