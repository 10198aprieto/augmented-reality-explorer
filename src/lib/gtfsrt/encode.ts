// Manual GTFS-RT protobuf encoder (no native deps needed)
// Based on GTFS-realtime.proto spec

import type { ArrivalData } from "./fetch-arrivals";

// Protobuf wire types
const VARINT = 0;
const LENGTH_DELIMITED = 2;
const FIXED64 = 1;
const FIXED32 = 5;

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return bytes;
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeString(fieldNumber: number, value: string): number[] {
  const encoded = new TextEncoder().encode(value);
  return [
    ...encodeTag(fieldNumber, LENGTH_DELIMITED),
    ...encodeVarint(encoded.length),
    ...encoded,
  ];
}

function encodeUint32(fieldNumber: number, value: number): number[] {
  return [...encodeTag(fieldNumber, VARINT), ...encodeVarint(value)];
}

function encodeUint64(fieldNumber: number, value: number): number[] {
  return [...encodeTag(fieldNumber, VARINT), ...encodeVarint(value)];
}

function encodeFloat(fieldNumber: number, value: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  return [
    ...encodeTag(fieldNumber, FIXED32),
    ...new Uint8Array(buf),
  ];
}

function encodeMessage(fieldNumber: number, content: number[]): number[] {
  return [
    ...encodeTag(fieldNumber, LENGTH_DELIMITED),
    ...encodeVarint(content.length),
    ...content,
  ];
}

function encodeFeedHeader(timestamp: number): number[] {
  // FeedHeader: gtfs_realtime_version (1), timestamp (4)
  const content = [
    ...encodeString(1, "2.0"),
    // incrementality = FULL_DATASET (0)
    ...encodeUint32(2, 0),
    ...encodeUint64(4, timestamp),
  ];
  return content;
}

// --- Trip Updates ---

function encodeStopTimeUpdate(stopId: string, arrivalTime: number): number[] {
  // StopTimeEvent for arrival (field 1)
  const arrivalEvent = encodeUint64(2, arrivalTime); // time field
  const content = [
    ...encodeMessage(1, arrivalEvent), // arrival
    ...encodeString(4, stopId), // stop_id
  ];
  return content;
}

function encodeTripUpdate(arrival: ArrivalData): number[] {
  // TripDescriptor (field 1)
  const tripDescriptor = [
    ...encodeString(1, arrival.tripId),
    ...encodeString(5, arrival.routeId),
  ];

  // VehicleDescriptor (field 3)
  const vehicleDescriptor = encodeString(1, arrival.vehicleId);

  // StopTimeUpdate (field 2)
  const stopTimeUpdate = encodeStopTimeUpdate(arrival.stopId, arrival.estimatedArrival);

  const content = [
    ...encodeMessage(1, tripDescriptor),
    ...encodeMessage(2, stopTimeUpdate),
    ...encodeMessage(3, vehicleDescriptor),
    ...encodeUint64(4, Math.floor(Date.now() / 1000)),
  ];
  return content;
}

// --- Vehicle Positions ---

function encodeVehiclePosition(arrival: ArrivalData): number[] {
  // Position (field 2)
  const position = [
    ...encodeFloat(1, arrival.lat),
    ...encodeFloat(2, arrival.lon),
    ...(arrival.bearing != null ? encodeFloat(3, arrival.bearing) : []),
    ...(arrival.speed != null ? encodeFloat(4, arrival.speed) : []),
  ];

  // TripDescriptor (field 1)
  const tripDescriptor = [
    ...encodeString(1, arrival.tripId),
    ...encodeString(5, arrival.routeId),
  ];

  // VehicleDescriptor (field 8)
  const vehicleDescriptor = encodeString(1, arrival.vehicleId);

  const content = [
    ...encodeMessage(1, tripDescriptor),
    ...encodeMessage(2, position),
    ...encodeMessage(8, vehicleDescriptor),
    ...encodeUint64(5, Math.floor(Date.now() / 1000)),
  ];
  return content;
}

// --- Feed Entity ---

function encodeFeedEntity(id: string, entityContent: number[], fieldNumber: number): number[] {
  const content = [
    ...encodeString(1, id), // entity id
    ...encodeMessage(fieldNumber, entityContent),
  ];
  return content;
}

// --- Public API ---

export function buildTripUpdatesFeed(arrivals: ArrivalData[]): Uint8Array {
  const timestamp = Math.floor(Date.now() / 1000);
  const header = encodeFeedHeader(timestamp);

  // Dedupe by tripId+stopId
  const seen = new Set<string>();
  const parts: number[] = [...encodeMessage(1, header)];

  for (const arrival of arrivals) {
    const key = `${arrival.tripId}-${arrival.stopId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tripUpdate = encodeTripUpdate(arrival);
    const entity = encodeFeedEntity(key, tripUpdate, 3); // field 3 = trip_update
    parts.push(...encodeMessage(2, entity)); // field 2 = entity
  }

  return new Uint8Array(parts);
}

export function buildVehiclePositionsFeed(arrivals: ArrivalData[]): Uint8Array {
  const timestamp = Math.floor(Date.now() / 1000);
  const header = encodeFeedHeader(timestamp);

  // Dedupe by vehicleId — keep the entry with the closest arrival time
  const vehicleMap = new Map<string, ArrivalData>();
  for (const arrival of arrivals) {
    if (arrival.lat !== 0 && arrival.lon !== 0) {
      const existing = vehicleMap.get(arrival.vehicleId);
      if (!existing || Math.abs(arrival.estimatedArrival - timestamp) < Math.abs(existing.estimatedArrival - timestamp)) {
        vehicleMap.set(arrival.vehicleId, arrival);
      }
    }
  }

  const parts: number[] = [...encodeMessage(1, header)];

  for (const [vehicleId, arrival] of vehicleMap) {
    const vp = encodeVehiclePosition(arrival);
    const entity = encodeFeedEntity(`vehicle-${vehicleId}`, vp, 4); // field 4 = vehicle
    parts.push(...encodeMessage(2, entity));
  }

  return new Uint8Array(parts);
}

export function buildTripUpdatesJson(arrivals: ArrivalData[]) {
  const seen = new Set<string>();
  const entities = [];

  for (const a of arrivals) {
    const key = `${a.tripId}-${a.stopId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entities.push({
      id: key,
      tripUpdate: {
        trip: { tripId: a.tripId, routeId: a.routeId },
        vehicle: { id: a.vehicleId },
        stopTimeUpdate: [{
          stopId: a.stopId,
          arrival: { time: a.estimatedArrival },
        }],
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
  }

  return {
    header: {
      gtfsRealtimeVersion: "2.0",
      incrementality: "FULL_DATASET",
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: entities,
  };
}

export function buildVehiclePositionsJson(arrivals: ArrivalData[]) {
  const now = Math.floor(Date.now() / 1000);
  const vehicleMap = new Map<string, ArrivalData>();
  for (const a of arrivals) {
    if (a.lat !== 0 && a.lon !== 0) {
      const existing = vehicleMap.get(a.vehicleId);
      if (!existing || Math.abs(a.estimatedArrival - now) < Math.abs(existing.estimatedArrival - now)) {
        vehicleMap.set(a.vehicleId, a);
      }
    }
  }

  const entities = [];
  for (const [vehicleId, a] of vehicleMap) {
    entities.push({
      id: `vehicle-${vehicleId}`,
      vehicle: {
        trip: { tripId: a.tripId, routeId: a.routeId },
        position: {
          latitude: a.lat,
          longitude: a.lon,
          ...(a.bearing != null && { bearing: a.bearing }),
          ...(a.speed != null && { speed: a.speed }),
        },
        vehicle: { id: vehicleId },
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
  }

  return {
    header: {
      gtfsRealtimeVersion: "2.0",
      incrementality: "FULL_DATASET",
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: entities,
  };
}
