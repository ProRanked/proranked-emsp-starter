// Keyless geo helpers — Nominatim for geocoding (already used by the app) and the public
// OSRM demo server for driving routes. No API key, same model as the OSM map tiles.

export interface LatLng { lat: number; lng: number }

/** Reject null/undefined and the (0,0) "null island" default that ungeocoded rows carry. */
export function isValidLatLng(lat?: number, lng?: number): lat is number {
  return (
    lat != null && lng != null &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
  );
}

export async function geocode(q: string): Promise<(LatLng & { label: string }) | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data?.length) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name };
}

export interface RoutePlan {
  /** Route geometry as [lat, lng] pairs (Leaflet order). */
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
}

export async function planRoute(a: LatLng, b: LatLng): Promise<RoutePlan | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const r = data?.routes?.[0];
  if (!r) return null;
  // OSRM/GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
  const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  return { coords, distanceKm: r.distance / 1000, durationMin: r.duration / 60 };
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Approximate shortest distance from a point to the route (min over its dense vertices). */
export function distToRouteKm(p: LatLng, route: [number, number][]): number {
  let min = Infinity;
  for (const [lat, lng] of route) {
    const d = haversineKm(p, { lat, lng });
    if (d < min) min = d;
  }
  return min;
}
