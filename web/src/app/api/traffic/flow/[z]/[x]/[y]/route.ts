import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

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

function png(body: Uint8Array) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
    },
  });
}

/**
 * Same-origin traffic tiles for the website. TOMTOM_API stays on the server.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const apiKey = process.env.TOMTOM_API;
  if (!apiKey) {
    return Response.json({ error: "Traffic is not configured" }, { status: 503 });
  }

  const { z: zRaw, x: xRaw, y: yRaw } = await context.params;
  const tile = tileNumbers(zRaw, xRaw, yRaw);
  if (!tile) {
    return Response.json({ error: "Invalid tile" }, { status: 400 });
  }

  const theme = request.nextUrl.searchParams.get("theme");
  const style = theme === "dark" ? "relative0-dark" : "relative0";
  const cacheKey = `${style}/${tile.z}/${tile.x}/${tile.y}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return png(hit.body);

  const upstream = new URL(
    `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${tile.z}/${tile.x}/${tile.y}.png`,
  );
  upstream.searchParams.set("key", apiKey);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstream, { headers: { Accept: "image/png" } });
  } catch {
    return Response.json({ error: "Traffic tile unavailable" }, { status: 502 });
  }
  if (!upstreamResponse.ok) {
    return Response.json({ error: "Traffic tile unavailable" }, { status: 502 });
  }

  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  if (cache.size >= MAX_TILES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, { body, at: Date.now() });
  return png(body);
}
