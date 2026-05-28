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
import { translations, translateStep, Language } from "@/lib/translations";

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
  const [is3DMode, setIs3DMode] = useState(false); // 2D top-down by default
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [ttsEngine, setTtsEngine] = useState<"system" | "fish">("system");
  const [fishAudioApiKey, setFishAudioApiKey] = useState("");
  const [fishAudioModelId, setFishAudioModelId] = useState("8ef4a238714b45718ce04243307c57a7");
  const [language, setLanguage] = useState<Language>("en");
  const [bgNavEnabled, setBgNavEnabled] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const [userSpeed, setUserSpeed] = useState<number | null>(null);
  const [simulatedSpeed, setSimulatedSpeed] = useState(48);

  const handleResetBearing = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      map.easeTo({ bearing: 0, pitch: 0, duration: 1000 });
      setMapBearing(0);
    }
  }, []);

  const t = translations[language] || translations.en;

  // Load settings and active navigation state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLightMode(localStorage.getItem("lightMode") === "true");
      setTtsEnabled(localStorage.getItem("ttsEnabled") === "true");
      setIs3DMode(localStorage.getItem("is3DMode") === "true");
      const savedVoice = localStorage.getItem("selectedVoiceURI");
      if (savedVoice) setSelectedVoiceURI(savedVoice);
      
      const savedEngine = localStorage.getItem("ttsEngine");
      if (savedEngine === "fish" || savedEngine === "system") {
        setTtsEngine(savedEngine);
      }
      const savedFishKey = localStorage.getItem("fishAudioApiKey");
      if (savedFishKey) setFishAudioApiKey(savedFishKey);
      const savedFishModel = localStorage.getItem("fishAudioModelId");
      if (savedFishModel) setFishAudioModelId(savedFishModel);

      const savedLang = localStorage.getItem("language") as Language;
      if (savedLang) setLanguage(savedLang);

      setBgNavEnabled(localStorage.getItem("bgNavEnabled") === "true");

      // Restore active navigation state
      const savedIsNavigating = localStorage.getItem("isNavigating") === "true";
      if (savedIsNavigating) {
        try {
          const savedOrigin = localStorage.getItem("origin") || "";
          const savedDest = localStorage.getItem("destination") || "";
          const savedMode = localStorage.getItem("transportMode") as TransportMode;
          const savedRouteInfo = localStorage.getItem("routeInfo");
          const savedRouteGeoJSON = localStorage.getItem("routeGeoJSON");
          const savedStepIdx = parseInt(localStorage.getItem("currentStepIndex") || "0", 10);
          const savedMarkers = localStorage.getItem("markers");

          if (savedRouteInfo && savedRouteGeoJSON) {
            setOrigin(savedOrigin);
            setDestination(savedDest);
            if (savedMode) setTransportMode(savedMode);
            setRouteInfo(JSON.parse(savedRouteInfo));
            setRouteGeoJSON(JSON.parse(savedRouteGeoJSON));
            setCurrentStepIndex(savedStepIdx);
            if (savedMarkers) setMarkers(JSON.parse(savedMarkers));
            setIsNavigating(true);
          }
        } catch (e) {
          console.error("Failed to restore navigation state from localStorage:", e);
        }
      }
    }
  }, []);

  // Save settings when changed
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lightMode", lightMode.toString());
      localStorage.setItem("ttsEnabled", ttsEnabled.toString());
      localStorage.setItem("is3DMode", is3DMode.toString());
      localStorage.setItem("selectedVoiceURI", selectedVoiceURI);
      localStorage.setItem("ttsEngine", ttsEngine);
      localStorage.setItem("fishAudioApiKey", fishAudioApiKey);
      localStorage.setItem("fishAudioModelId", fishAudioModelId);
      localStorage.setItem("language", language);
      localStorage.setItem("bgNavEnabled", bgNavEnabled.toString());

      // If Android Interface is available, notify it of background navigation state
      if ((window as any).Android?.setBackgroundNavEnabled) {
        (window as any).Android.setBackgroundNavEnabled(bgNavEnabled);
      }
    }
  }, [lightMode, ttsEnabled, is3DMode, selectedVoiceURI, ttsEngine, fishAudioApiKey, fishAudioModelId, language, bgNavEnabled]);

  // Save active navigation state to localStorage to persist across reloads
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("isNavigating", isNavigating.toString());
      localStorage.setItem("origin", origin);
      localStorage.setItem("destination", destination);
      localStorage.setItem("transportMode", transportMode);
      localStorage.setItem("currentStepIndex", currentStepIndex.toString());
      
      if (routeInfo) {
        localStorage.setItem("routeInfo", JSON.stringify(routeInfo));
      } else {
        localStorage.removeItem("routeInfo");
      }
      
      if (routeGeoJSON) {
        localStorage.setItem("routeGeoJSON", JSON.stringify(routeGeoJSON));
      } else {
        localStorage.removeItem("routeGeoJSON");
      }

      if (markers.length > 0) {
        localStorage.setItem("markers", JSON.stringify(markers));
      } else {
        localStorage.removeItem("markers");
      }
    }
  }, [isNavigating, origin, destination, transportMode, currentStepIndex, routeInfo, routeGeoJSON, markers]);

  // Synchronize background location updates from Android Foreground Service
  useEffect(() => {
    (window as any).updateBackgroundLocation = (lon: number, lat: number, heading?: number, speed?: number) => {
      const loc: [number, number] = [lon, lat];
      setUserLocation(loc);
      if (heading != null && !isNaN(heading)) {
        setUserHeading(heading);
      }
      if (speed != null && !isNaN(speed) && speed > 0) {
        setUserSpeed(Math.round(speed * 3.6));
      } else {
        setUserSpeed(null);
      }
    };
    return () => {
      delete (window as any).updateBackgroundLocation;
    };
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  // Auto-detect location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation((prev) => {
          if (!prev) {
            setMapCenter(loc);
            setMapZoom(14);
          }
          return loc;
        });
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
          setUserHeading(pos.coords.heading);
        }
        if (pos.coords.speed != null && !isNaN(pos.coords.speed) && pos.coords.speed > 0) {
          setUserSpeed(Math.round(pos.coords.speed * 3.6));
        } else {
          setUserSpeed(null);
        }
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // Speedometer fluctuation interval for demo/simulation mode
  useEffect(() => {
    if (!isNavigating) return;
    const interval = setInterval(() => {
      setSimulatedSpeed((s) => {
        const diff = Math.random() > 0.5 ? 1 : -1;
        const next = s + diff;
        return next > 60 ? 58 : next < 40 ? 42 : next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isNavigating]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const playWebSpeech = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    
    // Choose selected voice or match selected language locale
    const voices = window.speechSynthesis.getVoices();
    if (selectedVoiceURI) {
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) {
        u.voice = voice;
      }
    } else {
      const langMatch = language === "ja" ? "ja-JP" : language === "nl" ? "nl-NL" : "en-US";
      const matchedVoice = voices.find(v => v.lang.startsWith(langMatch));
      if (matchedVoice) {
        u.voice = matchedVoice;
      }
    }

    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [selectedVoiceURI, language]);

  const speakText = useCallback((text: string) => {
    if (!ttsEnabled) return;

    if (ttsEngine === "fish" && fishAudioApiKey) {
      setIsSpeaking(true);
      if ((window as any)._currentFishAudio) {
        try {
          (window as any)._currentFishAudio.pause();
        } catch { /* noop */ }
        (window as any)._currentFishAudio = null;
      }

      fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          reference_id: fishAudioModelId || "8ef4a238714b45718ce04243307c57a7",
          apiKey: fishAudioApiKey
        })
      })
      .then(async res => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Status ${res.status}: ${txt}`);
        }
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        (window as any)._currentFishAudio = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.play().catch((err) => {
          console.error("Audio play failed:", err);
          setIsSpeaking(false);
          playWebSpeech(text);
        });
      })
      .catch((err) => {
        console.error("Fish Audio error, falling back to Web Speech:", err);
        showToast(`Fish Audio failed: ${err.message || err}`);
        playWebSpeech(text);
      });
    } else {
      playWebSpeech(text);
    }
  }, [ttsEnabled, playWebSpeech, showToast, ttsEngine, fishAudioApiKey, fishAudioModelId]);

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

  const handleGetRoute = useCallback(async (forceOrigin?: [number, number] | unknown) => {
    const hasForceOrigin = Array.isArray(forceOrigin);
    if ((!origin && !hasForceOrigin) || !destination) { showToast("Enter both origin and destination"); return; }
    setIsLoadingRoute(true);

    try {
      // Resolve origin
      let originLat: number, originLon: number;
      if (hasForceOrigin && Array.isArray(forceOrigin)) {
        [originLon, originLat] = forceOrigin;
      } else if (origin === "My Location" && userLocation) {
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

      const apiKey = localStorage.getItem("googleMapsApiKey");
      const useGoogle = localStorage.getItem("useGoogleRouting") === "true";
      let routeData = null;
      let activeMode = transportMode;

      // Handle transit warning fallback
      if (transportMode === "transit" && !(apiKey && useGoogle)) {
        showToast("Transit routing requires Google Maps API Key. Falling back to walking.");
        activeMode = "walking";
      }

      if (apiKey && useGoogle) {
        try {
          const gMode = activeMode === "driving" ? "driving" : activeMode === "cycling" ? "bicycling" : activeMode === "transit" ? "transit" : "walking";
          const gRes = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLon}&destination=${destLat},${destLon}&mode=${gMode}&departure_time=now&key=${apiKey}`);
          const gData = await gRes.json();
          
          if (gData.status === "OK" && gData.routes && gData.routes.length > 0) {
            const r = gData.routes[0];
            const leg = r.legs[0];
            routeData = {
              code: "Ok",
              routes: [{
                duration: leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value,
                distance: leg.distance.value,
                geometry: { coordinates: decodePolyline(r.overview_polyline.points) },
                legs: [{
                  steps: leg.steps.map((s: any) => ({
                    maneuver: { type: "google", location: [s.start_location.lng, s.start_location.lat] },
                    name: stripHtml(s.html_instructions),
                    distance: s.distance.value,
                    duration: s.duration.value
                  }))
                }]
              }]
            };
          }
        } catch (e) {
          console.error("Google Maps API failed, falling back to OSRM", e);
        }
      }

      if (!routeData) {
        // OSRM fallback:
        const endpoint = activeMode === "driving" 
          ? "https://router.project-osrm.org/route/v1/car"
          : activeMode === "cycling"
          ? "https://routing.openstreetmap.de/routed-bike/route/v1/driving"
          : "https://routing.openstreetmap.de/routed-foot/route/v1/driving";

        const routeRes = await fetch(
          `${endpoint}/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`
        );
        routeData = await routeRes.json();
      }

      if (!routeData?.routes?.[0]) {
        showToast(t.noRoute);
        setIsLoadingRoute(false);
        return;
      }

      processRoute(routeData.routes[0], originLat, originLon, destLat, destLon);
    } catch (err) {
      console.error("Route error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to calculate route: ${msg}`);
    }
    setIsLoadingRoute(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, transportMode, userLocation, speakText, showToast, language]);

  // Extract route processing into helper
  const processRoute = useCallback((route: Record<string, unknown>, originLat: number, originLon: number, destLat: number, destLon: number) => {
    const legs = route.legs as Array<{ steps: Array<{ maneuver: { type: string; modifier?: string; location?: number[] }; name: string; distance: number; duration: number }> }>;
    const rawGeometry = route.geometry as { coordinates: number[][] };
    const steps = legs[0].steps.map((s) => ({
      instruction: translateStep(s.maneuver.type, s.maneuver.modifier, s.name, language),
      distance: s.distance,
      duration: s.duration,
      maneuverType: s.maneuver.type,
      location: s.maneuver.location || (rawGeometry.coordinates?.[0]),
    }));

    setRouteInfo({ duration: route.duration as number, distance: route.distance as number, steps });
    
    // Ensure strictly valid GeoJSON LineString for both OSRM and Google paths
    const geom: GeoJSON.Geometry = {
      type: "LineString",
      coordinates: rawGeometry.coordinates
    };
    setRouteGeoJSON({ type: "Feature", properties: {}, geometry: geom });

    setMarkers([
      { id: "origin", name: "Start", displayName: origin, lat: originLat, lon: originLon, type: "origin" },
      { id: "dest", name: "End", displayName: destination, lat: destLat, lon: destLon, type: "destination" },
    ]);

    // Fit full route on screen
    const coords = rawGeometry.coordinates;
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
    speakText(`${t.routeFound}. ${formatDistanceSpeech(route.distance as number, language)}, ${t.arriveBy} ${formatDurationSpeech(route.duration as number, language)}. ${steps[0]?.instruction || ""}`);

    // If currently navigating, update the Android background navigation service with the new steps!
    if (isNavigating && (window as any).Android?.startBackgroundNavigation) {
      try {
        (window as any).Android.startBackgroundNavigation(
          JSON.stringify(steps),
          route.distance as number,
          route.duration as number,
          language
        );
      } catch (e) {
        console.error("Failed to update background navigation steps on Android:", e);
      }
    }
  }, [origin, destination, speakText, language, t, isNavigating]);

  // Auto-reroute if off path
  useEffect(() => {
    if (!isNavigating || !userLocation || !routeGeoJSON || isLoadingRoute) return;
    const coords = (routeGeoJSON.geometry as any).coordinates as number[][];
    if (!coords || coords.length === 0) return;

    const dist = minDistanceToRoute(userLocation, coords);
    // If deviated by more than 75 meters from the route
    if (dist > 75) {
      showToast(t.offRoute);
      setOrigin("My Location");
      handleGetRoute(userLocation);
    }
  }, [userLocation, isNavigating, routeGeoJSON, isLoadingRoute, handleGetRoute, showToast, t.offRoute]);

  // Start live navigation with GPS following
  const startNavigation = useCallback(() => {
    if (!routeInfo || !navigator.geolocation) return;
    setIsNavigating(true);
    setCurrentStepIndex(0);
    setShowDirections(false);
    
    const startingSpeech = t.startingNavSpeech + ". " + (routeInfo.steps[0]?.instruction || "");
    speakText(startingSpeech);

    // Sync state with Android JavaScript Interface for ongoing Background Location & TTS guidance
    if (bgNavEnabled && (window as any).Android?.startBackgroundNavigation) {
      try {
        (window as any).Android.startBackgroundNavigation(
          JSON.stringify(routeInfo.steps),
          routeInfo.distance,
          routeInfo.duration,
          language
        );
      } catch (e) {
        console.error("Failed to invoke startBackgroundNavigation on Android", e);
      }
    }

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
  }, [routeInfo, speakText, bgNavEnabled, language, t.startingNavSpeech]);

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
    showToast(t.navEnded);

    // Stop background service in companion app
    if ((window as any).Android?.stopBackgroundNavigation) {
      try {
        (window as any).Android.stopBackgroundNavigation();
      } catch (e) {
        console.error("Failed to invoke stopBackgroundNavigation on Android", e);
      }
    }
  }, [showToast, t.navEnded]);

  // Track step changes and notify the background service
  useEffect(() => {
    if (isNavigating && (window as any).Android?.updateNavigationState) {
      try {
        (window as any).Android.updateNavigationState(currentStepIndex);
      } catch (e) {
        console.error("Failed to send step update to Android", e);
      }
    }
  }, [currentStepIndex, isNavigating]);

  // Dynamic step advancement based on distance to the next maneuver location
  useEffect(() => {
    if (!isNavigating || !userLocation || !routeInfo) return;
    const nextStep = routeInfo.steps[currentStepIndex + 1];
    if (!nextStep || !nextStep.location) return;

    const [nextLon, nextLat] = nextStep.location;
    const distToNextManeuver = getDistance(userLocation[0], userLocation[1], nextLon, nextLat);

    if (distToNextManeuver < 30) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      speakText(nextStep.instruction);
    }
  }, [userLocation, isNavigating, currentStepIndex, routeInfo, speakText]);

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

  const navIcon = transportMode === "driving" 
    ? "car" as const 
    : transportMode === "cycling" 
    ? "bike" as const 
    : transportMode === "transit" 
    ? "train" as const 
    : "walk" as const;

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
        is3DMode={is3DMode}
        isNavigating={isNavigating}
        navigationIcon={navIcon}
        onBearingChange={setMapBearing}
      />

      <Brand />

      {!showDirections && !isNavigating && (
        <SearchBar
          onSelectPlace={handleSearchSelect}
          onOpenSettings={() => setIsSettingsOpen(true)}
          placeholder={language === "ja" ? "目的地を検索..." : language === "nl" ? "Zoek een bestemming..." : "Search a destination..."}
        />
      )}

      {showDirections && !isNavigating && (
        <DirectionsPanel
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onClose={() => {
            setShowDirections(false);
            setRouteInfo(null);
            setRouteGeoJSON(null);
            setMarkers([]);
          }}
          onGetRoute={handleGetRoute}
          routeInfo={routeInfo}
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
          onUseMyLocation={handleUseMyLocation}
          isLoading={isLoadingRoute}
          onStartNavigation={startNavigation}
        />
      )}

      {isNavigating && currentStep && (
        <div className="nav-guidance-card glass" id="guidance-card">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className="guidance-icon">
              {transportMode === "driving" && "🚗"}
              {transportMode === "cycling" && "🚴"}
              {transportMode === "walking" && "🚶"}
              {transportMode === "transit" && "🚇"}
            </div>
            <div style={{ flex: 1 }}>
              <div className="guidance-instruction" id="guidance-instruction-text">{currentStep.instruction}</div>
              <div className="guidance-distance" id="guidance-distance-text">
                {language === "ja" ? "残り " : ""}
                {currentStep.distance >= 1000 
                  ? `${(currentStep.distance / 1000).toFixed(1)} km` 
                  : `${Math.round(currentStep.distance)} m`}
              </div>
            </div>
            <button 
              className="end-nav-btn-icon" 
              onClick={stopNavigation} 
              id="stop-nav-btn"
              aria-label="End navigation"
            >
              ❌
            </button>
          </div>

          {/* Up Next Widget */}
          {routeInfo && routeInfo.steps && routeInfo.steps[currentStepIndex + 1] && (
            <div className="up-next-widget" id="up-next-container">
              <span className="up-next-label" id="up-next-label">
                {t.thenPrefix || "Then"}:
              </span>
              <span className="up-next-instruction" id="up-next-instruction">
                {routeInfo.steps[currentStepIndex + 1].instruction}
              </span>
            </div>
          )}
        </div>
      )}

      {selectedPlace && !showDirections && !isNavigating && (
        <PlaceCard
          place={selectedPlace}
          onClose={() => {
            setSelectedPlace(null);
            setMarkers([]);
          }}
          onDirections={() => handleDirections(selectedPlace)}
        />
      )}

      <MapControls
        onLocate={handleLocate}
        onZoomIn={() => setMapZoom((z) => Math.min(z + 1, 20))}
        onZoomOut={() => setMapZoom((z) => Math.max(z - 1, 2))}
        onOpenSettings={() => setIsSettingsOpen(true)}
        bearing={mapBearing}
        onResetBearing={handleResetBearing}
      />

      {isNavigating && routeInfo && (
        <>
          {/* Circular speedometer badge with halo */}
          <div className="speedometer-widget glass" id="speedometer">
            <span className="speedometer-value" id="speedometer-value">
              {userSpeed !== null ? userSpeed : simulatedSpeed}
            </span>
            <span className="speedometer-unit">km/h</span>
          </div>

          {/* Premium Bottom Dashboard Panel */}
          <div className="nav-bottom-panel glass" id="nav-bottom-dashboard">
            <div className="nav-bottom-metrics">
              <div className="nav-bottom-duration" id="nav-total-duration">
                {formatDurationDisplay(routeInfo.duration, language)}
              </div>
              <div className="nav-bottom-details">
                <span id="nav-total-distance">
                  {formatDistanceDisplay(routeInfo.distance, language)}
                </span>
                <span className="nav-bottom-dot"></span>
                <span id="nav-eta">
                  {getETADisplay(routeInfo.duration, language)}
                </span>
              </div>
            </div>
            
            <button 
              className="nav-exit-btn animate-fadeIn" 
              onClick={stopNavigation}
              id="bottom-exit-nav-btn"
            >
              {t.exitNav || "Exit Route"}
            </button>
          </div>
        </>
      )}

      {isSettingsOpen && (
        <SettingsModal
          lightMode={lightMode}
          onToggleLightMode={() => setLightMode(!lightMode)}
          is3DMode={is3DMode}
          onToggle3DMode={() => setIs3DMode(!is3DMode)}
          ttsEnabled={ttsEnabled}
          onToggleTts={() => setTtsEnabled(!ttsEnabled)}
          selectedVoiceURI={selectedVoiceURI}
          onVoiceChange={(uri) => {
            setSelectedVoiceURI(uri);
            localStorage.setItem("selectedVoiceURI", uri);
          }}
          onClose={() => setIsSettingsOpen(false)}
          onTestVoice={speakText}
          ttsEngine={ttsEngine}
          onChangeTtsEngine={setTtsEngine}
          fishAudioApiKey={fishAudioApiKey}
          onChangeFishApiKey={setFishAudioApiKey}
          fishAudioModelId={fishAudioModelId}
          onChangeFishModelId={setFishAudioModelId}
          language={language}
          onChangeLanguage={setLanguage}
          bgNavEnabled={bgNavEnabled}
          onToggleBgNav={() => setBgNavEnabled(!bgNavEnabled)}
        />
      )}

      {toast && <div className="toast-notification" id="toast-message">{toast}</div>}
    </>
  );
}

/* ── Helpers ── */
function formatDurationSpeech(s: number, lang: Language): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const t = translations[lang] || translations.en;
  if (lang === "ja") {
    return h > 0 ? `${h}${t.hours}${m}${t.minutes}` : `${m}${t.minutes}`;
  }
  if (lang === "nl") {
    return h > 0 ? `${h} ${h > 1 ? "uren" : "uur"} en ${m} ${t.minutes}` : `${m} ${t.minutes}`;
  }
  return h > 0 ? `${h} hour${h > 1 ? "s" : ""} and ${m} minutes` : `${m} minutes`;
}

function formatDistanceSpeech(m: number, lang: Language): string {
  const t = translations[lang] || translations.en;
  if (m >= 1000) {
    const km = (m / 1000).toFixed(1);
    if (lang === "ja") return `${km}${t.kilometers}`;
    return `${km} ${t.kilometers}`;
  }
  const meters = Math.round(m);
  if (lang === "ja") return `${meters}${t.meters}`;
  return `${meters} ${t.meters}`;
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
function pointToLineDistance(p: [number, number], v: number[], w: number[]): number {
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

function dist2(v: number[], w: number[]) {
  return (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
}

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }
  return html.replace(/<[^>]*>?/gm, "");
}

function decodePolyline(encoded: string): number[][] {
  let index = 0, lat = 0, lng = 0;
  const coords: number[][] = [];
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

function formatDurationDisplay(s: number, lang: Language): string {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  if (lang === "ja") {
    return h > 0 ? `${h}時間${m}分` : `${m}分`;
  }
  if (lang === "nl") {
    return h > 0 ? `${h} u ${m} min` : `${m} min`;
  }
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}

function formatDistanceDisplay(m: number, lang: Language): string {
  if (m >= 1000) {
    return `${(m / 1000).toFixed(1)} km`;
  }
  return `${Math.round(m)} m`;
}

function getETADisplay(durationSeconds: number, lang: Language): string {
  const arrivalDate = new Date(Date.now() + durationSeconds * 1000);
  const hours = arrivalDate.getHours();
  const minutes = arrivalDate.getMinutes().toString().padStart(2, "0");
  
  if (lang === "ja") {
    return `${hours}:${minutes} 到着予定`;
  }
  
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  
  if (lang === "nl") {
    return `Aankomst: ${hours.toString().padStart(2, "0")}:${minutes}`;
  }
  
  return `ETA: ${displayHours}:${minutes} ${ampm}`;
}
