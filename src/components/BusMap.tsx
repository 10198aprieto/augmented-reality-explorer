import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RefreshCw } from "lucide-react";

interface VehicleEntity {
  id: string;
  vehicle?: {
    trip?: { tripId?: string; routeId?: string };
    position?: { latitude?: number; longitude?: number; speed?: number; bearing?: number };
    vehicle?: { id?: string; label?: string };
    timestamp?: number;
  };
}

interface FeedResponse {
  header?: { timestamp?: number };
  entity?: VehicleEntity[];
}

const ARROYO_CENTER: [number, number] = [41.6167, -4.7836];
const REFRESH_INTERVAL = 15_000;

const busIcon = L.divIcon({
  html: `<div style="background:hsl(221,83%,53%);width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/><path d="M18 18H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
  </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

export default function BusMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/gtfs-rt/vehicle-positions?format=json");
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      const entities = data.entity ?? [];

      const map = mapRef.current;
      if (!map) return;

      const activeIds = new Set<string>();

      for (const e of entities) {
        const pos = e.vehicle?.position;
        if (!pos?.latitude || !pos?.longitude) continue;

        const id = e.id;
        activeIds.add(id);
        const latlng: [number, number] = [pos.latitude, pos.longitude];

        const label = e.vehicle?.vehicle?.label || e.vehicle?.vehicle?.id || id;
        const route = e.vehicle?.trip?.routeId || "—";
        const speed = pos.speed != null ? `${(pos.speed * 3.6).toFixed(0)} km/h` : "—";

        const popupContent = `
          <div style="font-family:system-ui;font-size:13px;line-height:1.5">
            <strong>🚍 ${label}</strong><br/>
            Ruta: <strong>${route}</strong><br/>
            Velocidad: ${speed}
          </div>`;

        const existing = markersRef.current.get(id);
        if (existing) {
          existing.setLatLng(latlng);
          existing.setPopupContent(popupContent);
        } else {
          const marker = L.marker(latlng, { icon: busIcon })
            .bindPopup(popupContent)
            .addTo(map);
          markersRef.current.set(id, marker);
        }
      }

      // Remove stale markers
      for (const [id, marker] of markersRef.current) {
        if (!activeIds.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }

      setCount(activeIds.size);
      setLastUpdate(new Date().toLocaleTimeString("es-ES"));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: ARROYO_CENTER,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    fetchVehicles();

    const interval = setInterval(fetchVehicles, REFRESH_INTERVAL);
    return () => {
      clearInterval(interval);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [fetchVehicles]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">
            {loading ? "Cargando…" : `${count} bus${count !== 1 ? "es" : ""} activo${count !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Actualizado: {lastUpdate}
            </span>
          )}
          <button
            onClick={fetchVehicles}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-[400px] w-full" />
    </div>
  );
}
