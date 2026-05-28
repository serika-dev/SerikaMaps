import { Elysia, t } from "elysia";

// In-memory favorites store (swap for MongoDB in production)
const favorites: Map<string, { id: string; name: string; lat: number; lon: number; addedAt: string }> = new Map();

export const placesRoutes = new Elysia({ prefix: "/api/places" })
  .get(
    "/nearby",
    async ({ query }) => {
      // Uses Nominatim's nearby search (overpass would be better for production)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.type || "restaurant")}&viewbox=${query.lon - 0.02},${query.lat + 0.02},${query.lon + 0.02},${query.lat - 0.02}&bounded=1&limit=10`,
        { headers: { "User-Agent": "SerikaMaps/1.0" } }
      );
      const data = await res.json();
      return data.map((r: Record<string, unknown>) => ({
        id: String(r.place_id),
        name: String(r.display_name).split(",")[0],
        displayName: r.display_name,
        lat: parseFloat(String(r.lat)),
        lon: parseFloat(String(r.lon)),
        type: r.type,
      }));
    },
    {
      query: t.Object({
        lat: t.Numeric(),
        lon: t.Numeric(),
        type: t.Optional(t.String()),
      }),
      detail: { tags: ["Places"], summary: "Search nearby points of interest" },
    }
  )
  .get("/favorites", () => Array.from(favorites.values()), {
    detail: { tags: ["Places"], summary: "List saved favorites" },
  })
  .post(
    "/favorites",
    ({ body }) => {
      const id = `fav_${Date.now()}`;
      const fav = { id, ...body, addedAt: new Date().toISOString() };
      favorites.set(id, fav);
      return fav;
    },
    {
      body: t.Object({
        name: t.String(),
        lat: t.Number(),
        lon: t.Number(),
      }),
      detail: { tags: ["Places"], summary: "Save a favorite place" },
    }
  )
  .delete(
    "/favorites/:id",
    ({ params }) => {
      const deleted = favorites.delete(params.id);
      return { success: deleted };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Places"], summary: "Remove a favorite" },
    }
  );
