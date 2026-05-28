# CLAUDE.md — Agent Reference & Build Guide

Serika Maps is a high-fidelity, dual-platform mapping and navigation system consisting of a Next.js web application, a Bun/Elysia backend, and a Kotlin-based companion Android / Android Auto app.

---

## 🛠️ Build, Development & Run Commands

### Web Frontend (`/web`)
* **Install Dependencies:** `bun install`
* **Development Server:** `bun run dev` (starts on port `3000`)
* **Production Build:** `bun run build`
* **Production Start:** `bun run start`
* **Linting:** `bun run lint`

### API Backend (`/api`)
* **Install Dependencies:** `bun install`
* **Development Server:** `bun run dev` (starts on port `4001`)
* **Interactive Swagger Docs:** Accessible at `/swagger` on the active API URL.

### Android Application (`/android`)
* **Compile Debug APK:** `./gradlew assembleDebug` inside `/android`
* **Compile Release APK:** `./gradlew assembleRelease` inside `/android`
* **Clean Build Cache:** `./gradlew clean` inside `/android`
* **Lint Kotlin Code:** `./gradlew lint` inside `/android`

---

## 🎨 Architectural Overview & Interop

1. **WebView Android Bridge:**
   The Kotlin application runs a webview rendering the Next.js frontend. Interop is governed by high-performance Javascript interfaces:
   * `window.Android.startBackgroundNavigation(stepsJson, distance, duration, language)`: Activates the Android Foreground Service for speech guidance and lock-screen alerts.
   * `window.Android.stopBackgroundNavigation()`: Disables and clears the active background Foreground Service.
   * `window.updateBackgroundLocation(lon, lat, heading, speed)`: Android-to-JS callback pushing high-precision GPS positioning, heading angle, and speed.
2. **State Persistence:**
   Web app handles memory recovery via `localStorage` boundaries (`isNavigating`, `routeInfo`, `currentStepIndex`, `routeGeoJSON`).

---

## 📐 Code Style, Conventions & Patterns

### TypeScript & React (Next.js)
* **Components:** Use functional components with standard React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
* **Styling:** CSS variables defined in `/web/src/app/globals.css`. Maintain glassmorphism design parameters and micro-animations. Avoid adding ad-hoc Tailwind classes unless requested.
* **Type Safety:** Always type state variables, API interfaces, and props. Make use of shared definitions in `/web/src/lib/types.ts`.
* **State Updates:** Prioritize safe callback patterns for settings restoration (`localStorage` lookups wrapped in mount `useEffect` loops).

### Kotlin & Android Auto
* **Auto Interfaces:** Android Auto templates must use correct Car App Library templates (e.g. `NavigationTemplate`, `SearchTemplate`, `PlaceListMapTemplate`).
* **Asynchronous Scopes:** Manage background coroutine execution blocks safely with UI context cancellation checks tied to lifecycle hooks (`onDestroy`).
* **IPC Serialization:** Share geocoded payloads using strict JSON parsing conventions (`kotlinx.serialization`).
