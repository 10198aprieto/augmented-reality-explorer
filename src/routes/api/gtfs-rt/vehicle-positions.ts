import { createFileRoute } from "@tanstack/react-router";
import { fetchAllArrivals } from "@/lib/gtfsrt/fetch-arrivals";
import { buildVehiclePositionsFeed, buildVehiclePositionsJson } from "@/lib/gtfsrt/encode";

export const Route = createFileRoute("/api/gtfs-rt/vehicle-positions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const format = url.searchParams.get("format");

        const arrivals = await fetchAllArrivals();

        if (format === "json") {
          return Response.json(buildVehiclePositionsJson(arrivals), {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=15",
            },
          });
        }

        const pb = buildVehiclePositionsFeed(arrivals);
        return new Response(pb.buffer as ArrayBuffer, {
          headers: {
            "Content-Type": "application/x-protobuf",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=15",
          },
        });
      },
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
    },
  },
});
