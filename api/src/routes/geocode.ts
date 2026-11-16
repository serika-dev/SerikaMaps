import { Elysia, t } from "elysia";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "SerikaMaps/1.0 (https://maps.serika.dev)";

const CATEGORY_QUERIES = new Set([
  "restaurant", "restaurants", "cafe", "cafes", "coffee", "hotel", "hotels",
  "park", "parks", "hospital", "pharmacy", "gas", "fuel", "station",
  "supermarket", "grocery", "atm", "parking", "bar", "museum", "school",
]);

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  country?: string;
}

interface NominatimHit {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  boundingbox?: string[];
  address?: NominatimAddress;
}

function readablePlace(hit: NominatimHit): { name: string; displayName: string } {
  const address = hit.address;
  const parts = hit.display_name.split(",").map((part) => part.trim()).filter(Boolean);
  const house = address?.house_number || (parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : "");
  const road = address?.road || "";
  const named = hit.name?.trim() || "";
  const name = named && !/^\d+$/.test(named)
    ? named
    : road
      ? [road, house].filter(Boolean).join(" ")
      : house && parts[1]
        ? `${parts[1]} ${house}`
        : parts[0] || "Place";
  const locality = [
    address?.suburb || address?.neighbourhood,
    address?.city || address?.town || address?.village || address?.hamlet,
    address?.state,
    address?.country,
  ].filter((part): part is string => Boolean(part) && part !== name);
  const displayName = [...new Set(locality)].slice(0, 3).join(", ")
    || parts.filter((part) => part !== name).slice(0, 3).join(", ");
  return { name, displayName };
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const geocodeRoutes = new Elysia({ prefix: "/api/geocode" })
  .get(
    "/search",
    async ({ query, set }) => {
      const nearby = query.lat != null && query.lon != null && CATEGORY_QUERIES.has(query.q.trim().toLowerCase());
      const span = nearby ? 0.08 : 0.45;
      const params = new URLSearchParams({
        format: "jsonv2",
        q: query.q.trim(),
        limit: String(query.limit || 8),
        addressdetails: "1",
        dedupe: "1",
      });
      if (query.lat != null && query.lon != null) {
        params.set("viewbox", `${query.lon - span},${query.lat + span},${query.lon + span},${query.lat - span}`);
        params.set("bounded", nearby ? "1" : "0");
      }

      const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      });
      if (!res.ok) {
        set.status = 502;
        return { error: "Search is unavailable" };
      }

      const data = (await res.json()) as NominatimHit[];
      const mapped = data.map((hit) => {
        const place = readablePlace(hit);
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        return {
          id: String(hit.place_id),
          name: place.name,
          displayName: place.displayName,
          lat,
          lon,
          type: hit.type || hit.class || "place",
          boundingbox: hit.boundingbox,
          distanceMeters: query.lat != null && query.lon != null
            ? Math.round(distanceMeters(query.lat, query.lon, lat, lon))
            : null,
        };
      });

      const unique = mapped.filter((place, index) => !mapped.slice(0, index).some((earlier) =>
        earlier.name.toLowerCase() === place.name.toLowerCase() &&
        distanceMeters(earlier.lat, earlier.lon, place.lat, place.lon) < 800
      ));

      if (nearby) {
        unique.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
      }
      return unique;
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 20 })),
        lat: t.Optional(t.Numeric()),
        lon: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["Geocode"], summary: "Forward geocode (search)" },
    }
  )
  .get(
    "/reverse",
    async ({ query }) => {
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?format=json&lat=${query.lat}&lon=${query.lon}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "SerikaMaps/1.0" } }
      );
      const data = await res.json();
      return {
        id: String(data.place_id),
        name: String(data.display_name).split(",")[0],
        displayName: data.display_name,
        lat: parseFloat(String(data.lat)),
        lon: parseFloat(String(data.lon)),
        type: data.type,
        address: data.address,
      };
    },
    {
      query: t.Object({
        lat: t.Numeric(),
        lon: t.Numeric(),
      }),
      detail: { tags: ["Geocode"], summary: "Reverse geocode (coordinates to address)" },
    }
  );
