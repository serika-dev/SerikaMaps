# 🗺️ Serika Maps

**An ultra-premium, open-source maps & navigation platform — [maps.serika.dev](https://maps.serika.dev)**

> A stunning, glassmorphism-styled map interface featuring real-time turn-by-turn navigation, advanced vector route rendering, dynamic companion dashboard widgets, multi-lingual voice guidance, and premium Android Auto integration.

---

## 🚀 Advanced Premium Features

Serika Maps goes far beyond basic maps with high-fidelity UI elements and rich automotive-grade widgets:

### 📱 Premium Web Experience
* **Automotive-Grade Guidance:** 
  * **Up Next Widget:** Dynamic maneuver previews showing upcoming road changes (e.g. `Then: Turn right onto Rue de Rivoli` or `Daarna: Sla rechtsaf naar...`) supporting localized headers for **English (`Then`)**, **Japanese (`次に`)**, and **Dutch (`Daarna`)**.
  * **Interactive Compass Rose:** Real-time rotating compass needle that aligns to true North as you tilt, gesture, or rotate the map canvas. Tap it to execute a smooth camera rotation and pitch reset back to North (2D).
  * **Pulsing Speedometer Badge:** Circular speed readout that converts raw GPS coordinates to `km/h` in real-time. Fluctuates intelligently with a pulsing halo on desktop mockups to demonstrate active state.
  * **Bottom Dashboard Panel:** Immersive glassmorphic bottom bar featuring safe-area-inset spacing, travel ETA clocks, total trip distance/duration metrics, and a prominent red pill-shaped exit navigation button.
* **Vector Route Slicing:** As you drive, the path *behind* you automatically turns **greyish-purple (`#7b6b8f` at 60% opacity)** to represent traversed segments, while the path *ahead* continues to glow in sharp, high-contrast **neon purple (`#8b5cf6`)**.
* **Failure-Proof State Persistence:** State-tracking hooks continuously back up your active route, navigation progress, active markers, and settings to `localStorage`. If the app or WebView process is recycled or restarted by the operating system, it seamlessly resumes navigation without missing a single turn.

### 🚗 Android Auto & Native Bridge
* **Foreground Service Sync:** Background processes keep track of guidance events even when the phone screen is locked or the application is minimized, using a direct WebView Javascript-to-Kotlin IPC bridge.
* **High-Accuracy IPC updates:** Broadcasts precise GPS locations, headings, and velocities continuously back to the UI.
* **Fully Featured Templates:** Offers high-fidelity support for Android Auto's `NavigationTemplate` and `SearchTemplate` for standard in-car media consoles.

---

## 📐 Architecture & Technology Stack

| Component | Technology | Port |
|:----------|:-----------|:-----|
| **Web Frontend** | Next.js 16.2.6 + MapLibre GL JS + CSS Variables | `3000` |
| **API Backend** | Elysia.js 1.4.28 on Bun Runtime | `4001` |
| **Android Auto** | Kotlin + Android Car App Library | — |

---

## 🛠️ Quick Start Guide

### Prerequisites
* [Bun](https://bun.sh/) (v1.3+)
* [Android Studio](https://developer.android.com/studio) (for Kotlin compilation)

### Environment Configuration

Copy the sample environment file to `.env` and fill out your variables:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|:---------|:--------|:------------|
| `PUBLIC_URL` | `http://localhost:3000` | Public address of Next.js frontend |
| `PUBLIC_URL_API` | `http://localhost:4001` | Public address of Bun API backend |

### Run Locally

1. **Install Dependencies:**
   ```bash
   cd web && bun install
   cd ../api && bun install
   ```

2. **Start API Server:**
   ```bash
   cd api && bun run dev
   ```

3. **Start Web Interface:**
   ```bash
   cd web && bun run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to explore the map.

### Production Docker Deployment

```bash
# Production Multi-Stage Build
docker compose up -d --build
```

---

## 📂 Project Directory Structure

```
SerikaMaps/
├── .github/          → CI/CD release action pipelines
├── android/          → Native Kotlin Android & Android Auto Application
├── api/              → Elysia.js REST API Backend
├── web/              → Next.js 16 Glassmorphism Frontend (TypeScript)
├── AGENTS.md         → Engineering & Architecture Specifications
├── CLAUDE.md         → Build & Agent Reference CLI cheat sheet
├── LICENSE           → MIT License
└── README.md         → General Product Overview
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

MIT © [Serika](https://github.com/serika-dev)
