import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { geocodeRoutes } from "./routes/geocode";
import { directionsRoutes } from "./routes/directions";
import { placesRoutes } from "./routes/places";
import { navigationRoutes } from "./routes/navigation";

// ─── Configuration ──────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "4001", 10);
const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";
const PUBLIC_URL_API = process.env.PUBLIC_URL_API || `http://localhost:${PORT}`;

// Build CORS origins from PUBLIC_URL (always allow localhost for dev)
const corsOrigins = [
  PUBLIC_URL,
  "http://localhost:3000",
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

const app = new Elysia()
  .use(
    cors({
      origin: corsOrigins,
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
        servers: [
          { url: PUBLIC_URL_API, description: "API Server" },
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
  .listen(PORT);

console.log(`🗺️  Serika Maps API running at http://localhost:${app.server?.port}`);
console.log(`   PUBLIC_URL     = ${PUBLIC_URL}`);
console.log(`   PUBLIC_URL_API = ${PUBLIC_URL_API}`);

export type App = typeof app;
