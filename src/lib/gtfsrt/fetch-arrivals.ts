import { STOP_IDS } from "./stops";

export interface ArrivalData {
  tripId: string;
  vehicleId: string;
  routeId: string;
  routeName: string;
  stopId: string;
  stopName: string;
  estimatedArrival: number; // unix timestamp seconds
  lat: number;
  lon: number;
  speed?: number;
  bearing?: number;
}

const BASE_URL = "https://arroyo.actiosae.com/bff/mobile/arrivals";

async function fetchStopArrivals(stopId: string): Promise<ArrivalData[]> {
  try {
    const res = await fetch(`${BASE_URL}/${stopId}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "ArroyoBus-GTFSRT/1.0",
      },
    });
    if (!res.ok) return [];
    const json = await res.json() as any;

    const arrivals: ArrivalData[] = [];
    const lines = json?.lines || [];

    for (const line of lines) {
      const destinations = line?.destinations || [];
      for (const dest of destinations) {
        const trips = dest?.trips || [];
        for (const trip of trips) {
          if (trip.tripId && trip.vehicleId) {
            arrivals.push({
              tripId: String(trip.tripId),
              vehicleId: String(trip.vehicleId),
              routeId: String(line.lineId || line.id || ""),
              routeName: String(line.name || ""),
              stopId,
              stopName: String(json.stopName || json.name || ""),
              estimatedArrival: trip.estimatedArrival
                ? Math.floor(new Date(trip.estimatedArrival).getTime() / 1000)
                : Math.floor(Date.now() / 1000),
              lat: trip.lat ?? trip.latitude ?? 0,
              lon: trip.lon ?? trip.longitude ?? 0,
              speed: trip.speed,
              bearing: trip.bearing,
            });
          }
        }
      }
    }
    return arrivals;
  } catch {
    return [];
  }
}

export async function fetchAllArrivals(): Promise<ArrivalData[]> {
  // Fetch in batches of 10 to avoid overwhelming the API
  const allArrivals: ArrivalData[] = [];
  const batchSize = 10;

  for (let i = 0; i < STOP_IDS.length; i += batchSize) {
    const batch = STOP_IDS.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchStopArrivals));
    for (const r of results) allArrivals.push(...r);
  }

  return allArrivals;
}
