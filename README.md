# 🗺️ Serika Maps

**A premium, open-source maps platform — [maps.serika.dev](https://maps.serika.dev)**

> Beautiful dark-mode map interface with real-time navigation, place search, routing, and Android Auto support.

---

## Architecture

| Component | Technology | Port |
|:----------|:-----------|:-----|
| **Web Frontend** | Next.js 16.2.6 + MapLibre GL | `3000` |
| **API Backend** | Elysia.js 1.4.28 on Bun | `4001` |
| **Android Auto** | Kotlin + Car App Library | — |

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.3+)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)
- [Android Studio](https://developer.android.com/studio) (for the Android app)

### Configuration

Copy the example environment file and edit as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|:---------|:--------|:------------|
| `PUBLIC_URL` | `http://localhost:3000` | Public URL of the web frontend |
| `PUBLIC_URL_API` | `http://localhost:4001` | Public URL of the API backend |

Both Docker and the application services read from this single `.env` file.

### Web + API

```bash
# Install dependencies
cd web && bun install
cd ../api && bun install

# Start the API server
cd api && bun run dev

# Start the web app (in a separate terminal)
cd web && bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the map.

### Docker

```bash
# Development (hot-reload)
docker compose --profile dev up

# Production
docker compose up -d --build

# Or pull from GHCR
docker pull ghcr.io/serika-dev/serikamaps:latest
docker run -p 3000:3000 -p 4001:4001 \
  -e PUBLIC_URL=https://maps.serika.dev \
  -e PUBLIC_URL_API=https://api.maps.serika.dev \
  ghcr.io/serika-dev/serikamaps:latest
```

### API Documentation

Visit [http://localhost:4001/swagger](http://localhost:4001/swagger) for the interactive Swagger docs.

### Android Auto

Open the `android/` directory in Android Studio and build the project. Test with the Desktop Head Unit emulator.

Download pre-built APKs from the [Releases](https://github.com/serika-dev/SerikaMaps/releases) page.

---

## Features

### Web App
- 🗺️ Full-screen dark-mode map (MapLibre GL + CARTO tiles)
- 🔍 Place search with autocomplete (Nominatim)
- 🧭 Multi-mode directions (driving, cycling, walking via OSRM)
- 📍 Click-to-explore with reverse geocoding
- 📌 Favorite places
- 📎 Share location links
- 📱 Responsive design (mobile to ultrawide)
- 🎨 Glassmorphism UI with micro-animations

### API
- Forward & reverse geocoding
- Route calculation with turn-by-turn steps
- Nearby POI search
- Favorites CRUD
- Structured navigation data for Android Auto
- Swagger documentation

### Android Auto
- 🚗 Turn-by-turn navigation (NavigationTemplate)
- 🔍 Voice & text search (SearchTemplate)
- 📍 Quick access to saved favorites
- 🎯 Cluster display support

---

## Project Structure

```
SerikaMaps/
├── .env.example  → Environment configuration template
├── web/          → Next.js 16 frontend (TypeScript)
├── api/          → Elysia.js backend (TypeScript/Bun)
├── android/      → Kotlin Android Auto app
├── Dockerfile    → Multi-stage production build
├── docker-compose.yml
└── README.md
```

## Tech Stack

- **Runtime**: Bun
- **Frontend**: Next.js 16.2.6, React 19, MapLibre GL JS
- **Backend**: Elysia.js 1.4.28 with Swagger + CORS
- **Map Data**: OpenStreetMap via CARTO dark tiles
- **Routing**: OSRM (Open Source Routing Machine)
- **Geocoding**: Nominatim
- **Android**: Kotlin, Car App Library, kotlinx.serialization
- **Type Safety**: TypeScript + Eden connector (end-to-end)
- **CI/CD**: GitHub Actions on [Blacksmith](https://blacksmith.sh) runners

---

## License

MIT © Serika
