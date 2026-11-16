import { NextRequest, NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
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
  addresstype?: string;
  address?: NominatimAddress;
}

function locality(address?: NominatimAddress): string {
  if (!address) return "";
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    ""
  );
}

function titleOf(hit: NominatimHit): string {
  if (hit.name && hit.name.trim()) return hit.name.trim();
  const address = hit.address;
  if (address?.road) {
    return [address.road, address.house_number].filter(Boolean).join(" ");
  }
  const place = locality(address);
  if (place) return place;
  return hit.display_name.split(",")[0]?.trim() || "Place";
}

function subtitleOf(hit: NominatimHit): string {
  const address = hit.address;
  if (!address) return hit.display_name;
  const title = titleOf(hit);
  const parts = [
    address.suburb || address.neighbourhood,
    locality(address),
    address.state,
    address.country,
  ].filter((part): part is string => Boolean(part) && part !== title);
  const unique = [...new Set(parts)];
  return unique.slice(0, 3).join(", ") || hit.display_name;
}

function categoryOf(hit: NominatimHit): string {
  const kind = `${hit.class || ""} ${hit.type || ""} ${hit.addresstype || ""}`.toLowerCase();
  if (/(city|town|village|administrative)/.test(kind)) return "City";
  if (/(road|street|highway|residential)/.test(kind)) return "Street";
  if (/(restaurant|cafe|fast_food|bar|food)/.test(kind)) return "Food";
  if (/(hotel|guest|motel)/.test(kind)) return "Stay";
  if (/(park|garden|forest|nature)/.test(kind)) return "Park";
  if (/(station|stop|bus|rail|subway)/.test(kind)) return "Transit";
  if (/(shop|mall|supermarket)/.test(kind)) return "Shop";
  if (/(hospital|clinic|pharmacy)/.test(kind)) return "Health";
  return "Place";
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const hasBias = Number.isFinite(lat) && Number.isFinite(lon);
  const nearby = hasBias && CATEGORY_QUERIES.has(query.toLowerCase());
  const span = nearby ? 0.08 : 0.4;

  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: "8",
    addressdetails: "1",
    dedupe: "1",
  });
  if (hasBias) {
    params.set("viewbox", `${lon - span},${lat + span},${lon + span},${lat - span}`);
    params.set("bounded", nearby ? "1" : "0");
  }

  const upstream = await fetch(`${NOMINATIM}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": request.headers.get("accept-language") || "en",
    },
    next: { revalidate: 30 },
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Search is unavailable" }, { status: 502 });
  }

  const hits = (await upstream.json()) as NominatimHit[];
  const results = hits.map((hit) => {
    const placeLat = Number(hit.lat);
    const placeLon = Number(hit.lon);
    return {
      id: String(hit.place_id),
      name: titleOf(hit),
      displayName: subtitleOf(hit),
      lat: placeLat,
      lon: placeLon,
      type: hit.type || hit.class || "place",
      category: categoryOf(hit),
      distanceMeters: hasBias ? Math.round(distanceMeters(lat, lon, placeLat, placeLon)) : null,
    };
  });

  if (nearby) {
    results.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }

  return NextResponse.json({ results });
}
