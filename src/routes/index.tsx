import { createFileRoute } from "@tanstack/react-router";
import { Bus, MapPin, Clock, ExternalLink, Download, FileArchive } from "lucide-react";
import { lazy, Suspense } from "react";

const BusMap = lazy(() => import("@/components/BusMap"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ArroyoBus GTFS Realtime" },
      { name: "description", content: "Feed GTFS Realtime de ArroyoBus (Arroyo de la Encomienda) — posiciones de vehículos y estimaciones de llegada en tiempo real." },
    ],
  }),
});

function Index() {
  const endpoints = [
    {
      title: "Trip Updates",
      description: "Estimaciones de llegada en tiempo real para cada parada y viaje activo.",
      pb: "/api/gtfs-rt/trip-updates",
      json: "/api/gtfs-rt/trip-updates?format=json",
      icon: Clock,
    },
    {
      title: "Vehicle Positions",
      description: "Posiciones GPS en tiempo real de los autobuses activos.",
      pb: "/api/gtfs-rt/vehicle-positions",
      json: "/api/gtfs-rt/vehicle-positions?format=json",
      icon: MapPin,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <Bus className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">ArroyoBus GTFS-RT</h1>
        </div>
        <p className="text-muted-foreground mb-12 text-lg">
          Feed GTFS Realtime del servicio de autobuses de Arroyo de la Encomienda (Valladolid).
          Datos actualizados cada consulta desde la API de ActioSAE.
        </p>

        <div className="mb-8">
          <Suspense fallback={<div className="border border-border rounded-xl h-[440px] bg-card animate-pulse" />}>
            <BusMap />
          </Suspense>
        </div>

        <div className="space-y-6">
          {endpoints.map((ep) => (
            <div key={ep.title} className="border border-border rounded-xl p-6 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <ep.icon className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">{ep.title}</h2>
              </div>
              <p className="text-muted-foreground mb-4">{ep.description}</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={ep.pb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Protobuf (.pb) <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={ep.json}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
                >
                  JSON <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="border border-border rounded-xl p-6 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <FileArchive className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">GTFS Static</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Datos estáticos del servicio: paradas, rutas, horarios y calendario en formato GTFS.
          </p>
          <a
            href="/GTFS_Static.zip"
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" /> Descargar GTFS_Static.zip
          </a>
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-xl">
          <h3 className="font-semibold mb-2">Cómo usar</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Añade estas URLs como feeds GTFS-RT en cualquier aplicación compatible
            (Google Maps, Transit App, OpenTripPlanner, etc.):
          </p>
          <div className="space-y-2 font-mono text-xs bg-background p-4 rounded-lg border border-border">
            <p className="break-all">Trip Updates: <span className="text-primary">/api/gtfs-rt/trip-updates</span></p>
            <p className="break-all">Vehicle Positions: <span className="text-primary">/api/gtfs-rt/vehicle-positions</span></p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Añade <code className="bg-background px-1 py-0.5 rounded">?format=json</code> para obtener la respuesta en JSON legible.
          </p>
        </div>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Datos obtenidos de la API pública de ActioSAE · ArroyoBus · Arroyo de la Encomienda
        </footer>
      </div>
    </div>
  );
}
