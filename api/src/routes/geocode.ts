import { Elysia, t } from "elysia";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export const geocodeRoutes = new Elysia({ prefix: "/api/geocode" })
  .get(
    "/search",
    async ({ query }) => {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query.q)}&limit=${query.limit || 6}&addressdetails=1`,
        { headers: { "User-Agent": "SerikaMaps/1.0" } }
      );
      const data = await res.json();
      return data.map((r: Record<string, unknown>) => ({
        id: String(r.place_id),
        name: String(r.display_name).split(",")[0],
        displayName: r.display_name,
        lat: parseFloat(String(r.lat)),
        lon: parseFloat(String(r.lon)),
        type: r.type || r.class,
        boundingbox: r.boundingbox,
      }));
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 20 })),
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
