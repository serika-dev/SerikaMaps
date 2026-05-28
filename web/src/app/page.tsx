"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import MapView, { type MapViewHandle } from "@/components/Map/MapView";
import SearchBar from "@/components/SearchBar/SearchBar";
import DirectionsPanel from "@/components/DirectionsPanel/DirectionsPanel";
import PlaceCard from "@/components/PlaceCard/PlaceCard";
import MapControls from "@/components/MapControls/MapControls";
import Brand from "@/components/Brand/Brand";
import SettingsModal from "@/components/SettingsModal/SettingsModal";
import type { Place, RouteInfo, TransportMode } from "@/lib/types";

export default function Home() {
  const mapRef = useRef<MapViewHandle>(null);
  const watchIdRef = useRef<number | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.Feature | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>("driving");
  const [mapCenter, setMapCenter] = useState<[number, number]>([2.3522, 48.8566]);
  const [mapZoom, setMapZoom] = useState(12);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [markers, setMarkers] = useState<Place[]>([]);
  const [lightMode, setLightMode] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [toast, setToast] = useState("");

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  // Auto-detect location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(loc);
        setMapCenter(loc);
        setMapZoom(14);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    
    if (selectedVoiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) u.voice = voice;
    }

    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [ttsEnabled, selectedVoiceURI]);

  const handleSearchSelect = useCallback((place: Place) => {
    setSelectedPlace(place);
    setMapCenter([place.lon, place.lat]);
    setMapZoom(15);
    setMarkers([place]);
  }, []);

  const handleMapClick = useCallback(async (lng: number, lat: number) => {
    if (showDirections || isNavigating) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "SerikaMaps/1.0" } }
      );
      const data = await res.json();
      const place: Place = {
        id: `${lng}-${lat}`,
        name: data.display_name?.split(",")[0] || "Dropped Pin",
        displayName: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        lat, lon: lng, type: data.type || "place",
      };
      setSelectedPlace(place);
      setMarkers([place]);
    } catch {
      const place: Place = { id: `${lng}-${lat}`, name: "Dropped Pin", displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lon: lng, type: "pin" };
      setSelectedPlace(place);
      setMarkers([place]);
    }
  }, [showDirections, isNavigating]);

  const handleDirections = useCallback((place: Place) => {
    if (userLocation) setOrigin("My Location");
    setDestination(place.displayName || place.name);
    setShowDirections(true);
    setSelectedPlace(null);
  }, [userLocation]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) { showToast("Geolocation not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        setOrigin("My Location");
        showToast("Using your current location");
      },
      () => showToast("Could not get your location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [showToast]);

  const handleGetRoute = useCallback(async () => {
    if (!origin || !destination) { showToast("Enter both origin and destination"); return; }
    setIsLoadingRoute(true);

    try {
      // Resolve origin
      let originLat: number, originLon: number;
      if (origin === "My Location" && userLocation) {
        [originLon, originLat] = userLocation;
      } else {
        const oRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origin)}&limit=1`, { headers: { "User-Agent": "SerikaMaps/1.0" } });
        const oData = await oRes.json();
        if (!oData[0]) { showToast("Could not find origin"); setIsLoadingRoute(false); return; }
        originLat = parseFloat(oData[0].lat);
        originLon = parseFloat(oData[0].lon);
      }

      // Resolve destination
      const dRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`, { headers: { "User-Agent": "SerikaMaps/1.0" } });
      const dData = await dRes.json();
      if (!dData[0]) { showToast("Could not find destination"); setIsLoadingRoute(false); return; }
      const destLat = parseFloat(dData[0].lat);
      const destLon = parseFloat(dData[0].lon);

      // OSRM profile endpoints:
      const endpoint = transportMode === "driving" 
        ? "https://router.project-osrm.org/route/v1/car"
        : transportMode === "cycling"
        ? "https://routing.openstreetmap.de/routed-bike/route/v1/driving"
        : "https://routing.openstreetmap.de/routed-foot/route/v1/driving";

      const routeRes = await fetch(
        `${endpoint}/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`
      );
      const routeData = await routeRes.json();

      if (routeData.code !== "Ok" || !routeData.routes?.[0]) {
        showToast("No route found — try different locations");
        setIsLoadingRoute(false);
        return;
      }

      processRoute(routeData.routes[0], originLat, originLon, destLat, destLon);
    } catch (err) {
      console.error("Route error:", err);
      showToast("Failed to calculate route");
    }
    setIsLoadingRoute(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, transportMode, userLocation, speakText, showToast]);

  // Extract route processing into helper
  const processRoute = useCallback((route: Record<string, unknown>, originLat: number, originLon: number, destLat: number, destLon: number) => {
    const legs = route.legs as Array<{ steps: Array<{ maneuver: { type: string; modifier?: string }; name: string; distance: number; duration: number }> }>;
    const geometry = route.geometry as { coordinates: number[][] };
    const steps = legs[0].steps.map((s) => ({
      instruction: buildStepInstruction(s.maneuver.type, s.maneuver.modifier, s.name),
      distance: s.distance,
      duration: s.duration,
      maneuverType: s.maneuver.type,
    }));

    setRouteInfo({ duration: route.duration as number, distance: route.distance as number, steps });
    setRouteGeoJSON({ type: "Feature", properties: {}, geometry: geometry as GeoJSON.Geometry });

    setMarkers([
      { id: "origin", name: "Start", displayName: origin, lat: originLat, lon: originLon, type: "origin" },
      { id: "dest", name: "End", displayName: destination, lat: destLat, lon: destLon, type: "destination" },
    ]);

    // Fit full route on screen
    const coords = geometry.coordinates;
    let minLng = Infinity, minLat = Infinity;
    let maxLng = -Infinity, maxLat = -Infinity;
    for (let i = 0; i < coords.length; i++) {
      const lng = coords[i][0];
      const lat = coords[i][1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const sw: [number, number] = [minLng, minLat];
    const ne: [number, number] = [maxLng, maxLat];
    setTimeout(() => mapRef.current?.fitBounds([sw, ne], 60), 150);

    // TTS
    speakText(`Route found. ${formatDistanceSpeech(route.distance as number)}, estimated ${formatDurationSpeech(route.duration as number)}. ${steps[0]?.instruction || ""}`);
  }, [origin, destination, speakText]);

  // Auto-reroute if off path
  useEffect(() => {
    if (!isNavigating || !userLocation || !routeGeoJSON || isLoadingRoute) return;
    const coords = (routeGeoJSON.geometry as any).coordinates as number[][];
    if (!coords || coords.length === 0) return;

    const dist = minDistanceToRoute(userLocation, coords);
    // If deviated by more than 75 meters from the route
    if (dist > 75) {
      showToast("Off route! Rerouting...");
      setOrigin("My Location");
      handleGetRoute();
    }
  }, [userLocation, isNavigating, routeGeoJSON, isLoadingRoute, handleGetRoute, showToast]);

  // Start live navigation with GPS following
  const startNavigation = useCallback(() => {
    if (!routeInfo || !navigator.geolocation) return;
    setIsNavigating(true);
    setCurrentStepIndex(0);
    setShowDirections(false);
    speakText(routeInfo.steps[0]?.instruction || "Starting navigation");

    // Start watching position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(loc);
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
          setUserHeading(pos.coords.heading);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }, [routeInfo, speakText]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setCurrentStepIndex(0);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setRouteInfo(null);
    setRouteGeoJSON(null);
    setMarkers([]);
    showToast("Navigation ended");
  }, [showToast]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) { showToast("Geolocation not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(loc);
        setMapCenter(loc);
        setMapZoom(15);
      },
      () => showToast("Could not get your location"),
      { enableHighAccuracy: true }
    );
  }, [showToast]);

  const navIcon = transportMode === "driving" ? "car" as const : transportMode === "cycling" ? "bike" as const : "walk" as const;
  const currentStep = routeInfo?.steps[currentStepIndex];

  return (
    <>
      <MapView
        ref={mapRef}
        center={mapCenter}
        zoom={mapZoom}
        markers={markers}
        routeGeoJSON={routeGeoJSON}
        userLocation={userLocation}
        userHeading={userHeading}
        onMapClick={handleMapClick}
        lightMode={lightMode}
        isNavigating={isNavigating}
        navigationIcon={navIcon}
      />

      {/* Normal mode UI */}
      {!showDirections && !isNavigating && (
        <>
          <Brand />
          <SearchBar onSelect={handleSearchSelect} />
        </>
      )}

      {/* Directions panel */}
      {showDirections && !isNavigating && (
        <DirectionsPanel
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onClose={() => { setShowDirections(false); setRouteInfo(null); setRouteGeoJSON(null); setMarkers([]); }}
          onGetRoute={handleGetRoute}
          routeInfo={routeInfo}
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
          onUseMyLocation={handleUseMyLocation}
          isLoading={isLoadingRoute}
          onStartNavigation={startNavigation}
        />
      )}

      {/* Live navigation banner */}
      {isNavigating && currentStep && (
        <div className="nav-banner glass" id="nav-banner">
          <div className="nav-banner-icon">
            {getStepEmoji(currentStep.instruction)}
          </div>
          <div className="nav-banner-info">
            <div className="nav-banner-instruction">{currentStep.instruction}</div>
            <div className="nav-banner-meta">
              {formatDistance(currentStep.distance)} · {formatDuration(currentStep.duration)}
            </div>
          </div>
          <button className="nav-stop-btn" onClick={stopNavigation} id="nav-stop-btn">
            Stop
          </button>
        </div>
      )}

      {/* Place card */}
      {selectedPlace && !showDirections && !isNavigating && (
        <PlaceCard
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onDirections={handleDirections}
        />
      )}

      <MapControls
        onZoomIn={() => setMapZoom((z) => Math.min(z + 1, 20))}
        onZoomOut={() => setMapZoom((z) => Math.max(z - 1, 1))}
        onLocate={handleLocate}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {isSettingsOpen && (
        <SettingsModal
          lightMode={lightMode}
          onToggleLightMode={() => setLightMode((v) => !v)}
          ttsEnabled={ttsEnabled}
          onToggleTts={() => {
            setTtsEnabled((v) => {
              showToast(!v ? "Voice navigation enabled" : "Voice navigation disabled");
              if (v) window.speechSynthesis?.cancel();
              return !v;
            });
          }}
          selectedVoiceURI={selectedVoiceURI}
          onVoiceChange={setSelectedVoiceURI}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}

/* ── Helpers ── */
function buildStepInstruction(type: string, modifier?: string, name?: string): string {
  const road = name || "the road";
  const dir = modifier ? ` ${modifier}` : "";
  switch (type) {
    case "depart": return `Head out on ${road}`;
    case "arrive": return "You have arrived at your destination";
    case "turn": return `Turn${dir} onto ${road}`;
    case "new name": return `Continue onto ${road}`;
    case "merge": return `Merge${dir} onto ${road}`;
    case "on ramp": return `Take the ramp${dir} onto ${road}`;
    case "off ramp": return `Take the exit${dir}`;
    case "fork": return `Keep${dir} at the fork onto ${road}`;
    case "roundabout": case "rotary": return `At the roundabout, exit onto ${road}`;
    case "end of road": return `At the end, turn${dir} onto ${road}`;
    case "ferry": return `Take the ferry across ${road}`;
    default: return `Continue on ${road}`;
  }
}

function getStepEmoji(instruction: string): string {
  const l = instruction.toLowerCase();
  if (l.includes("head out")) return "🚀";
  if (l.includes("arrived")) return "🏁";
  if (l.includes("left")) return "⬅️";
  if (l.includes("right")) return "➡️";
  if (l.includes("roundabout")) return "🔄";
  if (l.includes("ramp") || l.includes("merge")) return "⤴️";
  if (l.includes("fork")) return "↗️";
  if (l.includes("ferry")) return "⛴️";
  return "⬆️";
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDurationSpeech(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} hour${h > 1 ? "s" : ""} ${m} minutes` : `${m} minutes`;
}

function formatDistanceSpeech(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} kilometers` : `${Math.round(m)} meters`;
}

// Distance helper using Haversine formula
function getDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate minimum distance from a point to a path
function minDistanceToRoute(loc: [number, number], coords: number[][]): number {
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToLineDistance(loc, coords[i], coords[i+1]);
    if (d < min) min = d;
  }
  return min;
}

// Distance from point p to line segment v-w
function pointToLineDistance(p: [number, number], v: [number, number], w: [number, number]): number {
  const l2 = dist2(v, w);
  if (l2 === 0) return getDistance(p[0], p[1], v[0], v[1]);
  
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const proj: [number, number] = [
    v[0] + t * (w[0] - v[0]),
    v[1] + t * (w[1] - v[1])
  ];
  return getDistance(p[0], p[1], proj[0], proj[1]);
}

function dist2(v: [number, number], w: [number, number]) {
  return (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
}
