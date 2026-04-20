export interface PlaceResult {
  name: string;
  address: string;
  lng: number;
  lat: number;
  category?: string;
}

const BASE = 'https://dapi.kakao.com/v2/local/search';

async function searchKeyword(query: string, key: string): Promise<PlaceResult[]> {
  const res = await fetch(
    `${BASE}/keyword.json?query=${encodeURIComponent(query)}&size=6`,
    { headers: { Authorization: `KakaoAK ${key}` } }
  );
  if (!res.ok) return [];
  const json = await res.json() as { documents: Record<string, string>[] };
  return (json.documents ?? []).map(d => ({
    name: d['place_name'] ?? '',
    address: d['road_address_name'] || d['address_name'] || '',
    lng: parseFloat(d['x'] ?? '0'),
    lat: parseFloat(d['y'] ?? '0'),
    category: d['category_group_name'] || undefined,
  }));
}

async function searchAddress(query: string, key: string): Promise<PlaceResult[]> {
  const res = await fetch(
    `${BASE}/address.json?query=${encodeURIComponent(query)}&size=4`,
    { headers: { Authorization: `KakaoAK ${key}` } }
  );
  if (!res.ok) return [];
  const json = await res.json() as { documents: Record<string, unknown>[] };
  return (json.documents ?? []).map(d => {
    const road = d['road_address'] as Record<string, string> | null;
    return {
      name: d['address_name'] as string ?? '',
      address: road?.['address_name'] ?? d['address_name'] as string ?? '',
      lng: parseFloat(d['x'] as string ?? '0'),
      lat: parseFloat(d['y'] as string ?? '0'),
    };
  });
}

export async function searchPlaces(query: string, key: string): Promise<PlaceResult[]> {
  const [kwRes, addrRes] = await Promise.allSettled([
    searchKeyword(query, key),
    searchAddress(query, key),
  ]);

  const results: PlaceResult[] = [];
  if (kwRes.status === 'fulfilled') results.push(...kwRes.value);
  if (addrRes.status === 'fulfilled') {
    for (const a of addrRes.value) {
      const dup = results.some(
        r => Math.abs(r.lng - a.lng) < 0.0001 && Math.abs(r.lat - a.lat) < 0.0001
      );
      if (!dup) results.push(a);
    }
  }
  return results.slice(0, 8);
}
