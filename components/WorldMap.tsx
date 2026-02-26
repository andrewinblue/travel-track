'use client';

import { useEffect, useState, useRef } from 'react';
import type { Trip } from '@/types';

interface GeocodedTrip extends Trip {
  lat: number;
  lng: number;
}

async function geocode(destination: string, country: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${destination}, ${country}`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // silent
  }
  return null;
}

const STATUS_COLORS = {
  planned: '#3b82f6',    // blue
  ongoing: '#10b981',    // emerald
  completed: '#f59e0b',  // amber
};

interface WorldMapProps {
  trips: Trip[];
}

export function WorldMap({ trips }: WorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<import('leaflet').Map | null>(null);
  const [geocoded, setGeocodedTrips] = useState<GeocodedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  // Geocode all trips
  useEffect(() => {
    if (trips.length === 0) {
      setLoading(false);
      return;
    }
    const run = async () => {
      const results: GeocodedTrip[] = [];
      for (const trip of trips) {
        const coords = await geocode(trip.destination, trip.country);
        if (coords) results.push({ ...trip, ...coords });
        // Respect Nominatim rate limit (1 req/sec)
        await new Promise((r) => setTimeout(r, 1100));
      }
      setGeocodedTrips(results);
      setLoading(false);
    };
    run();
  }, [trips]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      const map = L.map(mapRef.current!, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1.0,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        noWrap: true,
      }).addTo(map);

      leafletMapRef.current = map;
    };

    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Add markers once geocoding is done and map is ready
  useEffect(() => {
    if (!leafletMapRef.current || geocoded.length === 0) return;

    const addMarkers = async () => {
      const L = (await import('leaflet')).default;
      const map = leafletMapRef.current!;

      geocoded.forEach((trip) => {
        const color = STATUS_COLORS[trip.status];

        // Custom circle marker with SVG
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 32px; height: 32px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              cursor: pointer;
            "></div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([trip.lat, trip.lng], { icon });

        const statusLabel = trip.status.charAt(0).toUpperCase() + trip.status.slice(1);
        const startYear = new Date(trip.startDate + 'T00:00:00').getFullYear();

        marker.bindPopup(`
          <div style="min-width:180px; font-family: system-ui, sans-serif;">
            ${trip.coverPhotoUrl
              ? `<img src="${trip.coverPhotoUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />`
              : ''}
            <div style="font-weight:700;font-size:14px;color:#111;margin-bottom:2px;">${trip.title}</div>
            <div style="font-size:12px;color:#555;margin-bottom:6px;">📍 ${trip.destination}, ${trip.country}</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="
                background:${color}20;color:${color};
                padding:2px 8px;border-radius:999px;
                font-size:11px;font-weight:600;
              ">${statusLabel}</span>
              <span style="font-size:11px;color:#888;">${startYear}</span>
            </div>
          </div>
        `, {
          maxWidth: 220,
        });

        marker.on('click', () => {
          map.flyTo([trip.lat, trip.lng], 8, { duration: 1.2 });
        });

        marker.addTo(map);
      });

      // Fit map to show all markers
      if (geocoded.length > 0) {
        const bounds = L.latLngBounds(geocoded.map((t) => [t.lat, t.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
      }
    };

    addMarkers();
  }, [geocoded]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {/* Loading overlay */}
      {loading && trips.length > 0 && (
        <div className="absolute inset-0 bg-gray-900/80 rounded-2xl flex flex-col items-center justify-center gap-3 z-[1000]">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-300">Locating your destinations…</p>
        </div>
      )}

      {/* Legend */}
      {!loading && geocoded.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur rounded-xl p-3 z-[1000] border border-gray-700">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Status</p>
          {(['planned', 'ongoing', 'completed'] as const).map((s) => (
            <div key={s} className="flex items-center gap-2 text-xs text-gray-300 mb-1 last:mb-0">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: STATUS_COLORS[s] }}
              />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
