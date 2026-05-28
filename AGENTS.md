# 🛠️ Serika Maps — Technical Documentation & Architecture

Welcome to the internal engineering guide and design documentation for **Serika Maps**. This file outlines the system's runtime architecture, communication interfaces, data rendering methods, and session management boundaries.

---

## 🗺️ Architectural Topology

Serika Maps operates as a fully integrated, high-accuracy navigation network:

```mermaid
graph TD
    subgraph Web App (Next.js 16)
        Maplibre["MapLibre GL Map Canvas"]
        ReactState["React Context & State Manager"]
        LocalStorage["localStorage Session Store"]
    end

    subgraph Native App (Kotlin)
        WebInterface["WebView & JS Bridge"]
        ForegroundService["Foreground Navigation Service"]
        AutoScreen["Android Auto Navigation Template"]
    end

    subgraph External APIs
        OSRM["OSRM Route API"]
        Nominatim["OSM Nominatim Geocoder"]
    end

    Maplibre -->|User Actions| ReactState
    ReactState -->|Auto-saves| LocalStorage
    ReactState -->|startBackgroundNavigation| WebInterface
    WebInterface -->|IPC Channels| ForegroundService
    ForegroundService -->|Visual Maneuvers| AutoScreen
    ReactState -->|Routing Query| OSRM
    ReactState -->|Geocoding Query| Nominatim
    ForegroundService -->|Position Sync| WebInterface
```

---

## 📡 JavaScript-to-Kotlin Android Bridge

The communication boundary between the Next.js single-page application and the Native Kotlin app is governed by active IPC functions bound to the global window interface:

### 1. Web to Native Actions
* **`window.Android.startBackgroundNavigation(stepsJson: String, distance: Double, duration: Double, language: String)`**
  * **Payload:** A serialized JSON string containing route steps (`[{"instruction": "...", "distance": 12.0, "duration": 5.0}]`), total distance in meters, total duration in seconds, and active translation language code (`"en"`, `"ja"`, or `"nl"`).
  * **Function:** Registers the foreground service notifications with custom turn-by-turn prompts and launches the system lock-screen navigation panel.
* **`window.Android.stopBackgroundNavigation()`**
  * **Function:** Instantly cleans the native service, terminates speech threads, and clears ongoing active system notifications.

### 2. Native to Web Feedbacks
* **`window.updateBackgroundLocation(lon: Double, lat: Double, heading: Double?, speed: Double?)`**
  * **Payload:** Precise GPS coordinates, active orientation angle (in degrees), and speed (in meters per second).
  * **Function:** Relayed by Javascript directly to the Map canvas and React state. The speedometer converts raw `m/s` coordinates to `km/h` using `Math.round(speed * 3.6)` and updates real-time map rendering indices.

---

## 🚗 Advanced Premium Navigation Mechanics

### 1. Greyish-Purple Traversed Route Slicing
To emulate professional high-end dashboard interfaces, the map polyline color separates behind and in front of the vehicle:
* **Geometry Splitting:** A vector geometry utility determines the user's coordinate indices along the route polyline.
* **Layers Created:**
  * `route-traversed-line`: Displayed behind the user location in **greyish-purple (`#7b6b8f` at 60% opacity)**.
  * `route-line`: Displayed in front of the user in vibrant **neon purple (`#8b5cf6`)**.
* **Transition:** Handled in real-time inside `MapView.tsx` during user positioning changes.

### 2. Up Next Guidance Widget
* **Visual Structure:** A sleek, glassmorphic panel displays upcoming turn previews directly beneath the current maneuvers.
* **Step Lookahead:** Reads `routeInfo.steps[currentStepIndex + 1]` dynamically to preview what lane shifts or turn actions will be required next.
* **Multi-lingual Context:** Automatically translates directions using localized `thenPrefix` headers for English (`Then:`), Japanese (`次に:`), and Dutch (`Daarna:`).

### 3. Persistent Navigation Memory
To counter runtime garbage collection or operating system restarts:
* React context hooks intercept changes to `isNavigating`, `routeInfo`, `currentStepIndex`, and `routeGeoJSON`.
* Staged navigation coordinates are written to client-side `localStorage`.
* During page mounting, state parameters are safely parsed and re-hydrated. The UI automatically resumes guidance vectors and camera pitching without losing the user's active progress.
