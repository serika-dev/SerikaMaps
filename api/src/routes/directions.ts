import { Elysia, t } from "elysia";

const OSRM_BASE = "https://router.project-osrm.org";

export const directionsRoutes = new Elysia({ prefix: "/api/directions" }).get(
  "/",
  async ({ query }) => {
    const profile =
      query.mode === "cycling"
        ? "bike"
        : query.mode === "walking"
          ? "foot"
          : "car";

    const res = await fetch(
      `${OSRM_BASE}/route/v1/${profile}/${query.origin_lon},${query.origin_lat};${query.dest_lon},${query.dest_lat}?overview=full&geometries=geojson&steps=true&annotations=true`
    );
    const data = await res.json();

    if (!data.routes?.[0]) {
      return { error: "No route found", routes: [] };
    }

    const route = data.routes[0];
    return {
      duration: route.duration,
      distance: route.distance,
      geometry: route.geometry,
      steps: route.legs[0].steps.map(
        (s: {
          maneuver: { type: string; modifier?: string };
          name: string;
          distance: number;
          duration: number;
          geometry: unknown;
        }) => ({
          instruction: `${s.maneuver.type}${s.maneuver.modifier ? ` ${s.maneuver.modifier}` : ""} on ${s.name || "unnamed road"}`,
          maneuver: s.maneuver.type,
          modifier: s.maneuver.modifier,
          name: s.name,
          distance: s.distance,
          duration: s.duration,
          geometry: s.geometry,
        })
      ),
    };
  },
  {
    query: t.Object({
      origin_lat: t.Numeric(),
      origin_lon: t.Numeric(),
      dest_lat: t.Numeric(),
      dest_lon: t.Numeric(),
      mode: t.Optional(
        t.Union([
          t.Literal("driving"),
          t.Literal("cycling"),
          t.Literal("walking"),
        ])
      ),
    }),
    detail: { tags: ["Directions"], summary: "Calculate route between two points" },
  }
);
