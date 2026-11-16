import { Elysia } from "elysia";

/**
 * Live traffic tiles. The TomTom key is read from TOMTOM_API on the server
 * and is never returned to the client.
 */
const cache = new Map<string, { body: Uint8Array; at: number }>();
const TTL_MS = 60_000;
const MAX_TILES = 400;

function tileNumbers(zRaw: string, xRaw: string, yRaw: string) {
  if (!/^\d{1,2}$/.test(zRaw) || !/^\d{1,7}$/.test(xRaw) || !/^\d{1,7}$/.test(yRaw)) return null;
  const z = Number(zRaw);
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (z > 22) return null;
  const n = 2 ** z;
  if (x >= n || y >= n) return null;
  return { z, x, y };
}

function flowStyle(theme: string | null): "relative0" | "relative0-dark" {
  return theme === "dark" ? "relative0-dark" : "relative0";
}

export async function trafficFlowTile(zRaw: string, xRaw: string, yRaw: string, theme: string | null) {
  const apiKey = process.env.TOMTOM_API;
  if (!apiKey) {
    return Response.json({ error: "Traffic is not configured" }, { status: 503 });
  }
  const tile = tileNumbers(zRaw, xRaw, yRaw);
  if (!tile) {
    return Response.json({ error: "Invalid tile" }, { status: 400 });
  }

  const style = flowStyle(theme);
  const cacheKey = `${style}/${tile.z}/${tile.x}/${tile.y}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return png(hit.body);
  }

  const upstream = new URL(
    `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${tile.z}/${tile.x}/${tile.y}.png`,
  );
  upstream.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(upstream, { headers: { Accept: "image/png" } });
  } catch {
    return Response.json({ error: "Traffic tile unavailable" }, { status: 502 });
  }
  if (!res.ok) {
    return Response.json({ error: "Traffic tile unavailable" }, { status: 502 });
  }

  const body = new Uint8Array(await res.arrayBuffer());
  if (cache.size >= MAX_TILES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, { body, at: Date.now() });
  return png(body);
}

function png(body: Uint8Array) {
  const bytes = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export const trafficRoutes = new Elysia({ prefix: "/api/traffic" }).get(
  "/flow/:z/:x/:y",
  ({ params, request }) => {
    const theme = new URL(request.url).searchParams.get("theme");
    return trafficFlowTile(params.z, params.x, params.y, theme);
  },
);
