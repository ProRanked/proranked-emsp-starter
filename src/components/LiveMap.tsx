import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationLite } from '../lib/types.ts';

/** Reject null/undefined and the (0,0) default that ungeocoded rows carry. */
function isValidCoord(lat?: number, lng?: number): lat is number {
  return (
    lat != null && lng != null &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
  );
}

/**
 * Real interactive station map (OpenStreetMap tiles — no API key). Replaces the
 * old decorative "faux map". Each charging site is a branded pin; tapping it opens
 * a popup with a deep link into the site. The map auto-fits to the visible sites.
 */
export function LiveMap({
  locations,
  origin,
  onSelect,
  height = 320,
}: {
  locations: LocationLite[];
  origin: { lat: number; lng: number };
  onSelect: (id: string) => void;
  height?: number;
}) {
  // Valid coords only. Reject null AND the (0,0) "null island" that ungeocoded
  // rows default to, so one bad row can't zoom the whole map out to the ocean.
  const pins = useMemo(
    () => locations.filter((l) => isValidCoord(l.latitude, l.longitude)),
    [locations],
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-line" style={{ height }}>
      <MapContainer
        center={[origin.lat, origin.lng]}
        zoom={12}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', background: '#0b0f14' }}
      >
        {/* Dark-tinted basemap to match the app's dark theme */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* "You are here" */}
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={7}
          pathOptions={{ color: '#2EE6A6', fillColor: '#2EE6A6', fillOpacity: 1, weight: 3, opacity: 0.35 }}
        />

        {pins.map((loc) => (
          <Marker key={loc.id} position={[loc.latitude!, loc.longitude!]} icon={pinIcon(loc.chargerCount)}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{loc.name ?? 'Charging site'}</div>
                <div style={{ color: '#9aa4b2', fontSize: 12, marginBottom: 8 }}>
                  {[loc.address, loc.city].filter(Boolean).join(', ') || 'Address unavailable'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#9aa4b2' }}>
                    {loc.chargerCount != null ? `${loc.chargerCount} charger${loc.chargerCount === 1 ? '' : 's'}` : ''}
                    {loc.distanceKm != null ? ` · ${loc.distanceKm.toFixed(1)} km` : ''}
                  </span>
                  <button
                    onClick={() => onSelect(loc.id)}
                    style={{ background: '#2EE6A6', color: '#06231a', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 9999, padding: '5px 12px', cursor: 'pointer' }}
                  >
                    View
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds pins={pins} origin={origin} />
      </MapContainer>
    </div>
  );
}

/** Branded teardrop pin with a bolt + optional charger-count badge. */
function pinIcon(count?: number) {
  const badge =
    count != null && count > 0
      ? `<div style="position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 4px;background:#06231a;color:#2EE6A6;border:1.5px solid #2EE6A6;border-radius:9999px;font-size:10px;font-weight:800;line-height:13px;text-align:center">${count}</div>`
      : '';
  const html = `
    <div style="position:relative;width:34px;height:34px">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">
        <path d="M12 2c-4.4 0-8 3.4-8 7.6 0 5.4 6.8 11.4 7.4 11.9.3.3.8.3 1.1 0 .7-.5 7.5-6.5 7.5-11.9C20 5.4 16.4 2 12 2z" fill="#2EE6A6"/>
        <path d="M13 6l-4 6h3l-1 5 4-6h-3l1-5z" fill="#06231a"/>
      </svg>
      ${badge}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30] });
}

/** Auto-fit the viewport to all visible pins (plus the user origin). */
function FitBounds({ pins, origin }: { pins: LocationLite[]; origin: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = pins.map((p) => [p.latitude!, p.longitude!]);
    pts.push([origin.lat, origin.lng]);
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts).pad(0.25), { animate: false });
    }
  }, [map, pins, origin]);
  return null;
}
