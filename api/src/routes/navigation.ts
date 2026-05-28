import { Elysia, t } from "elysia";

/**
 * Navigation routes for Android Auto companion app.
 * Provides structured turn-by-turn data optimized for the Car App Library.
 */
export const navigationRoutes = new Elysia({ prefix: "/api/navigation" })
  .get(
    "/route",
    async ({ query }) => {
      const profile =
        query.mode === "cycling"
          ? "bike"
          : query.mode === "walking"
            ? "foot"
            : "car";

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${query.origin_lon},${query.origin_lat};${query.dest_lon},${query.dest_lat}?overview=full&geometries=geojson&steps=true&annotations=duration,distance`
      );
      const data = await res.json();

      if (!data.routes?.[0]) {
        return { error: "No route found" };
      }

      const route = data.routes[0];
      const steps = route.legs[0].steps;

      return {
        totalDuration: route.duration,
        totalDistance: route.distance,
        geometry: route.geometry,
        // Structured for Android Auto NavigationTemplate
        maneuvers: steps.map(
          (
            s: {
              maneuver: { type: string; modifier?: string; location: number[] };
              name: string;
              distance: number;
              duration: number;
            },
            i: number
          ) => ({
            index: i,
            type: mapManeuverType(s.maneuver.type),
            modifier: s.maneuver.modifier || null,
            streetName: s.name || "",
            distance: s.distance,
            duration: s.duration,
            location: {
              lat: s.maneuver.location[1],
              lon: s.maneuver.location[0],
            },
            instruction: buildInstruction(s.maneuver.type, s.maneuver.modifier, s.name),
          })
        ),
        // Arrival info
        estimatedArrival: new Date(Date.now() + route.duration * 1000).toISOString(),
      };
    },
    {
      query: t.Object({
        origin_lat: t.Numeric(),
        origin_lon: t.Numeric(),
        dest_lat: t.Numeric(),
        dest_lon: t.Numeric(),
        mode: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Navigation"],
        summary: "Get structured navigation route for Android Auto",
      },
    }
  )
  .get(
    "/step",
    ({ query }) => {
      // In a real implementation, this would track the user's position
      // and return the current/next step. For now, returns a placeholder.
      return {
        currentStep: 0,
        userLat: query.lat,
        userLon: query.lon,
        instruction: "Continue on current road",
        distanceToNext: 0,
        durationToNext: 0,
      };
    },
    {
      query: t.Object({
        lat: t.Numeric(),
        lon: t.Numeric(),
        route_id: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Navigation"],
        summary: "Get current navigation step based on user position",
      },
    }
  );

/** Map OSRM maneuver types to Android Auto-friendly types */
function mapManeuverType(type: string): string {
  const mapping: Record<string, string> = {
    depart: "DEPART",
    arrive: "ARRIVE",
    turn: "TURN",
    "new name": "NAME_CHANGE",
    merge: "MERGE",
    "on ramp": "ON_RAMP",
    "off ramp": "OFF_RAMP",
    fork: "FORK",
    "end of road": "END_OF_ROAD",
    continue: "STRAIGHT",
    roundabout: "ROUNDABOUT",
    rotary: "ROUNDABOUT",
    "roundabout turn": "ROUNDABOUT",
    notification: "NOTIFICATION",
  };
  return mapping[type] || "UNKNOWN";
}

/** Build a human-readable instruction */
function buildInstruction(type: string, modifier?: string, name?: string): string {
  const road = name || "the road";
  const dir = modifier ? ` ${modifier}` : "";

  switch (type) {
    case "depart":
      return `Start on ${road}`;
    case "arrive":
      return "You have arrived at your destination";
    case "turn":
      return `Turn${dir} onto ${road}`;
    case "new name":
      return `Continue onto ${road}`;
    case "merge":
      return `Merge${dir} onto ${road}`;
    case "on ramp":
      return `Take the ramp${dir} onto ${road}`;
    case "off ramp":
      return `Take the exit${dir}`;
    case "fork":
      return `Keep${dir} at the fork onto ${road}`;
    case "roundabout":
    case "rotary":
      return `Enter the roundabout and exit onto ${road}`;
    default:
      return `Continue on ${road}`;
  }
}
