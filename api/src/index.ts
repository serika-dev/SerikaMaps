import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { geocodeRoutes } from "./routes/geocode";
import { directionsRoutes } from "./routes/directions";
import { placesRoutes } from "./routes/places";
import { navigationRoutes } from "./routes/navigation";

const app = new Elysia()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "https://maps.serika.dev",
      ],
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Serika Maps API",
          version: "1.0.0",
          description: "Backend API for Serika Maps — geocoding, routing, places, and navigation.",
        },
        tags: [
          { name: "Geocode", description: "Forward and reverse geocoding" },
          { name: "Directions", description: "Route calculation" },
          { name: "Places", description: "Points of interest" },
          { name: "Navigation", description: "Android Auto navigation data" },
        ],
      },
    })
  )
  .get("/", () => ({
    name: "Serika Maps API",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString(),
  }))
  .use(geocodeRoutes)
  .use(directionsRoutes)
  .use(placesRoutes)
  .use(navigationRoutes)
  .listen(4001);

console.log(`🗺️  Serika Maps API running at http://localhost:${app.server?.port}`);

export type App = typeof app;
