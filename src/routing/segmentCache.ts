import type { LineString } from 'geojson';
import type { LngLat } from '../util/coord';
import { coordKey } from '../util/coord';

const MEM_CAPACITY = 500;
const LS_KEY = 'artrun_segment_cache_v1';
const LS_CAPACITY = 500;

interface CacheEntry {
  line: LineString;
  meters: number;
}

// In-memory LRU using insertion-order Map
const memCache = new Map<string, CacheEntry>();

function memGet(key: string): CacheEntry | undefined {
  const entry = memCache.get(key);
  if (!entry) return undefined;
  // LRU: 재접근 시 뒤로 이동
  memCache.delete(key);
  memCache.set(key, entry);
  return entry;
}

function memSet(key: string, entry: CacheEntry): void {
  if (memCache.has(key)) memCache.delete(key);
  if (memCache.size >= MEM_CAPACITY) {
    memCache.delete(memCache.keys().next().value!);
  }
  memCache.set(key, entry);
}

// LocalStorage 캐시
type LSStore = Record<string, { entry: CacheEntry; ts: number }>;

function lsLoad(): LSStore {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as LSStore;
  } catch {
    return {};
  }
}

function lsSave(store: LSStore): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // 저장 실패 시 무시 (용량 초과 등)
  }
}

function lsGet(key: string): CacheEntry | undefined {
  const store = lsLoad();
  return store[key]?.entry;
}

function lsSet(key: string, entry: CacheEntry): void {
  const store = lsLoad();
  store[key] = { entry, ts: Date.now() };
  // LRU: 용량 초과 시 오래된 항목 제거
  const entries = Object.entries(store).sort((a, b) => a[1].ts - b[1].ts);
  while (entries.length > LS_CAPACITY) entries.shift();
  const trimmed = Object.fromEntries(entries);
  lsSave(trimmed);
}

export function cacheGet(from: LngLat, to: LngLat): CacheEntry | undefined {
  const key = coordKey(from, to);
  return memGet(key) ?? lsGet(key);
}

export function cacheSet(from: LngLat, to: LngLat, entry: CacheEntry): void {
  const key = coordKey(from, to);
  memSet(key, entry);
  lsSet(key, entry);
}
