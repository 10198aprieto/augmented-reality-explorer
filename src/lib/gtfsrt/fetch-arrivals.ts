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
  directionId?: string;
  tripHeadsign?: string;
  routeShortName?: string;
  routeColor?: string;
  isEstimated?: boolean;
}

const BASE_URL = "https://arroyo.actiosae.com/bff/mobile/arrivals";
const FEED_ID = "arroyo";

function getApiKey(): string {
  return process.env.ACTIOSAE_API_KEY || "";
}

async function fetchStopArrivals(stopId: string): Promise<ArrivalData[]> {
  try {
    const apiKey = getApiKey();
    const url = `${BASE_URL}/${stopId}?feedId=${FEED_ID}${apiKey ? `&key=${apiKey}` : ""}`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "ArroyoBus-GTFSRT/1.0",
      },
    });
    if (!res.ok) return [];
    const json = await res.json() as any[];

    if (!Array.isArray(json)) return [];

    const arrivals: ArrivalData[] = [];

    for (const item of json) {
      if (item.tripId && item.vehicleId) {
        arrivals.push({
          tripId: String(item.tripId),
          vehicleId: String(item.vehicleId),
          routeId: String(item.route?.routeId || ""),
          routeName: String(item.route?.routeName || ""),
          routeShortName: item.route?.routeShortName,
          routeColor: item.route?.color,
          stopId: String(item.stopId || stopId),
          stopName: String(item.stopName || ""),
          estimatedArrival: item.arrivalTime
            ? Math.floor(new Date(item.arrivalTime).getTime() / 1000)
            : Math.floor(Date.now() / 1000),
          lat: item.lat ?? 0,
          lon: item.lon ?? 0,
          speed: item.speed,
          bearing: item.bearing,
          directionId: item.directionId,
          tripHeadsign: item.tripHeadsign,
          isEstimated: item.isEstimated,
        });
      }
    }
    return arrivals;
  } catch {
    return [];
  }
}

// In-memory cache to prevent upstream API abuse
let cachedArrivals: ArrivalData[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15_000; // 15 seconds

export async function fetchAllArrivals(): Promise<ArrivalData[]> {
  const now = Date.now();
  if (cachedArrivals && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedArrivals;
  }

  const allArrivals: ArrivalData[] = [];
  const batchSize = 10;

  for (let i = 0; i < STOP_IDS.length; i += batchSize) {
    const batch = STOP_IDS.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchStopArrivals));
    for (const r of results) allArrivals.push(...r);
  }

  cachedArrivals = allArrivals;
  cacheTimestamp = now;
  return allArrivals;
}
