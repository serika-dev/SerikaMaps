"use client";

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "@/lib/types";

export interface MapViewHandle {
  fitBounds: (
    bounds: [[number, number], [number, number]],
    padding?: number
  ) => void;
  getMap: () => maplibregl.Map | null;
}

interface MapViewProps {
  center: [number, number];
  zoom: number;
  markers: Place[];
  routeGeoJSON: GeoJSON.Feature | null;
  userLocation: [number, number] | null;
  userHeading: number | null;
  onMapClick: (lng: number, lat: number) => void;
  lightMode: boolean;
  is3DMode: boolean;
  isNavigating: boolean;
  navigationIcon: "car" | "bike" | "walk" | "train";
  onBearingChange?: (bearing: number) => void;
}

async function buildStyle(light: boolean, is3DMode: boolean): Promise<maplibregl.StyleSpecification> {
  const url = light
    ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const res = await fetch(url);
  const style = await res.json();

  // Dark and Light Mode Purple Palettes
  const pal = light ? {
    bg: "#f4f2fb",
    water: "#d9e3f5",
    building: "#c4b5fd",
    text: "#6d28d9",
    textHalo: "rgba(255,255,255,0.85)"
  } : {
    bg: "#12101c",
    water: "#243056",
    building: "#4c1d95",
    text: "#ddd6fe",
    textHalo: "rgba(18,16,28,0.85)"
  };

  style.layers.forEach((layer: any) => {
    if (!layer.paint) return;
    if (layer.id === "background") {
      layer.paint["background-color"] = pal.bg;
    } else if (layer.id === "water" && layer.type === "fill") {
      layer.paint["fill-color"] = pal.water;
    } else if (layer.type === "symbol") {
      if (layer.paint["text-color"]) layer.paint["text-color"] = pal.text;
      if (layer.paint["text-halo-color"]) layer.paint["text-halo-color"] = pal.textHalo;
    }
  });

  const sources = (style.sources || {}) as Record<string, unknown>;
  const sourceId = sources.protomaps ? "protomaps" : sources.carto ? "carto" : Object.keys(sources)[0];
  (style as any).projection = { type: is3DMode ? "globe" : "mercator" };

  if (is3DMode && sourceId) {
    style.layers.push({
      id: "3d-buildings",
      source: sourceId,
      "source-layer": "buildings",
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": pal.building,
        "fill-extrusion-height": ["coalesce", ["get", "height"], ["*", ["to-number", ["get", "layer"]], 3], 12],
        "fill-extrusion-opacity": 0.85,
      }
    });
  }

  style.sources = style.sources || {};
  style.sources.traffic = {
    type: "raster",
    tiles: [`/api/traffic/flow/{z}/{x}/{y}?theme=${light ? "light" : "dark"}`],
    tileSize: 256,
    attribution: "© TomTom",
  };
  const trafficLayer = {
    id: "traffic-flow",
    type: "raster",
    source: "traffic",
    paint: { "raster-opacity": 0.92 },
  };
  const symbolAt = style.layers.findIndex((layer: { type?: string }) => layer.type === "symbol");
  if (symbolAt >= 0) style.layers.splice(symbolAt, 0, trafficLayer);
  else style.layers.push(trafficLayer);

  return style;
}

/** Build a proper DOM element for the user location dot with pulse ring */
function createLocationDot(): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = "44px";
  container.style.height = "44px";
  container.style.position = "relative";

  // Pulse ring
  const pulse = document.createElement("div");
  pulse.style.cssText = `
    position: absolute; top: 50%; left: 50%;
    width: 44px; height: 44px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    animation: locPulseRing 2s ease-out infinite;
    pointer-events: none;
  `;

  // Inner dot
  const dot = document.createElement("div");
  dot.style.cssText = `
    position: absolute; top: 50%; left: 50%;
    width: 16px; height: 16px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: #8b5cf6;
    border: 3px solid white;
    box-shadow: 0 0 8px rgba(139, 92, 246, 0.6), 0 2px 6px rgba(0,0,0,0.3);
  `;

  container.appendChild(pulse);
  container.appendChild(dot);
  return container;
}

/** Build navigation cursor icon (car / bike / walking person) */
function createNavIcon(
  type: "car" | "bike" | "walk" | "train",
  heading: number
): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = "48px";
  container.style.height = "48px";
  container.style.position = "relative";

  // Direction cone (shows heading)
  const cone = document.createElement("div");
  cone.style.cssText = `
    position: absolute; top: 50%; left: 50%;
    width: 48px; height: 48px;
    transform: translate(-50%, -50%) rotate(${heading}deg);
    pointer-events: none;
  `;
  const coneSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  coneSvg.setAttribute("viewBox", "0 0 48 48");
  coneSvg.setAttribute("width", "48");
  coneSvg.setAttribute("height", "48");
  coneSvg.innerHTML = `<path d="M24 4 L32 20 L24 16 L16 20 Z" fill="#8b5cf6" opacity="0.5"/>`;
  cone.appendChild(coneSvg);

  // Icon circle
  const circle = document.createElement("div");
  circle.style.cssText = `
    position: absolute; top: 50%; left: 50%;
    width: 36px; height: 36px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: #8b5cf6;
    border: 3px solid white;
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.6), 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 18px;
  `;

  const icons: Record<string, string> = {
    car: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
    bike: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`,
    walk: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="m14.5 10-.5 3-4 10"/><path d="m14 13 3 3"/><path d="m14 10-3-4-2.5.5-2.5 3"/><path d="M9 14 6 24"/></svg>`,
    train: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>`,
  };
  circle.innerHTML = icons[type];

  // Pulse ring for nav
  const pulse = document.createElement("div");
  pulse.style.cssText = `
    position: absolute; top: 50%; left: 50%;
    width: 48px; height: 48px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 2px solid rgba(139, 92, 246, 0.3);
    animation: locPulseRing 2s ease-out infinite;
    pointer-events: none;
  `;

  container.appendChild(cone);
  container.appendChild(pulse);
  container.appendChild(circle);
  return container;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    center,
    zoom,
    markers,
    routeGeoJSON,
    userLocation,
    userHeading,
    onMapClick,
    lightMode,
    is3DMode,
    isNavigating,
    navigationIcon,
    onBearingChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const navMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onBearingChangeRef = useRef(onBearingChange);
  onBearingChangeRef.current = onBearingChange;

  useImperativeHandle(ref, () => ({
    fitBounds: (bounds, padding = 80) => {
      mapRef.current?.fitBounds(bounds, {
        padding: {
          top: padding + 60,
          bottom: padding,
          left: padding + 420,
          right: padding,
        },
        duration: 1400,
        maxZoom: 16,
      });
    },
    getMap: () => mapRef.current,
  }));

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: { version: 8, sources: {}, layers: [] },
      center,
      zoom,
      attributionControl: false,
      maxZoom: 19,
      pitch: is3DMode ? 45 : 0,
    });

    map.on("click", (e) => {
      onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    map.on("rotate", () => {
      onBearingChangeRef.current?.(map.getBearing());
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle light/dark tiles and 3D mode
  useEffect(() => {
    if (!mapRef.current) return;
    
    let active = true;
    buildStyle(lightMode, is3DMode).then((style) => {
      const map = mapRef.current;
      if (!active || !map) return;
      const apply = (next: maplibregl.StyleSpecification) => {
        map.setStyle(next);
        map.once("style.load", () => {
          if (!active) return;
          map.setProjection({ type: is3DMode ? "globe" : "mercator" });
          map.setMaxPitch(is3DMode ? 70 : 60);
          setStyleLoaded((s) => !s);
        });
      };
      try {
        apply(style);
      } catch (error) {
        console.error("Map style failed", error);
        const layers = (style.layers || []).filter((layer) => layer.id !== "3d-buildings");
        apply({ ...style, layers });
      }
    }).catch((error) => {
      console.error("Map style failed", error);
    });

    return () => {
      active = false;
    };
  }, [lightMode, is3DMode]);

  // Adjust pitch based on navigation and 3D mode
  useEffect(() => {
    if (!mapRef.current || isNavigating) return;
    mapRef.current.easeTo({ pitch: is3DMode ? 55 : 0, duration: 800 });
  }, [isNavigating, is3DMode]);

  // Update center/zoom (but not during navigation — that's handled by follow mode)
  useEffect(() => {
    if (!mapRef.current || isNavigating) return;
    mapRef.current.flyTo({ center, zoom, duration: 1200 });
  }, [center, zoom, isNavigating]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markers.forEach((place) => {
      const el = document.createElement("div");
      el.className = "marker-animate";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderRadius = "50% 50% 50% 0";
      el.style.transform = "rotate(-45deg)";
      el.style.border = "3px solid white";
      el.style.cursor = "pointer";

      if (place.type === "origin") {
        el.style.background = "#10b981";
        el.style.boxShadow = "0 2px 12px rgba(16,185,129,0.4)";
      } else if (place.type === "destination") {
        el.style.background = "#f43f5e";
        el.style.boxShadow = "0 2px 12px rgba(244,63,94,0.4)";
      } else {
        el.style.background = "linear-gradient(135deg, #8b5cf6, #c084fc)";
        el.style.boxShadow = "0 2px 12px rgba(139,92,246,0.4)";
      }

      const marker = new maplibregl.Marker({ 
        element: el,
        pitchAlignment: "map",
        rotationAlignment: "map"
      })
        .setLngLat([place.lon, place.lat])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [markers]);

  // Route line
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const addRoute = () => {
      try {
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        if (map.getLayer("route-outline")) map.removeLayer("route-outline");
        if (map.getLayer("route-glow")) map.removeLayer("route-glow");
        
        if (map.getLayer("route-traversed-line")) map.removeLayer("route-traversed-line");
        if (map.getLayer("route-traversed-glow")) map.removeLayer("route-traversed-glow");
        
        if (map.getSource("route")) map.removeSource("route");
        if (map.getSource("route-traversed")) map.removeSource("route-traversed");
      } catch {
        /* noop */
      }

      // Add full / remaining route source
      map.addSource("route", { 
        type: "geojson", 
        data: routeGeoJSON || { type: "FeatureCollection", features: [] },
        tolerance: 0,
        buffer: 512,
      });

      // Add traversed route source
      map.addSource("route-traversed", { 
        type: "geojson", 
        data: { type: "FeatureCollection", features: [] },
        tolerance: 0,
        buffer: 512,
      });

      // ── Traversed Route Layers (Greyish Purple Muted Styling) ──
      map.addLayer({
        id: "route-traversed-glow",
        type: "line",
        source: "route-traversed",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#7b6b8f",
          "line-width": 14,
          "line-opacity": 0.08,
          "line-blur": 6,
        },
      });

      map.addLayer({
        id: "route-traversed-line",
        type: "line",
        source: "route-traversed",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#7b6b8f", // Greyish purple traversed path
          "line-width": 5,
          "line-opacity": 0.6,
        },
      });

      // ── Remaining Route Layers (Neon Purple Premium Styling) ──
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#8b5cf6",
          "line-width": 18,
          "line-opacity": 0.1,
          "line-blur": 10,
        },
      });

      map.addLayer({
        id: "route-outline",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": lightMode ? "#4c1d95" : "#1e1040",
          "line-width": 9,
          "line-opacity": 0.5,
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#8b5cf6",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addRoute();
    } else {
      map.once("styledata", () => setTimeout(addRoute, 150));
    }
  }, [routeGeoJSON, lightMode, styleLoaded]);

  // Dynamic Route Splitting for driving traversed path rendering
  useEffect(() => {
    if (!mapRef.current || !styleLoaded) return;
    const map = mapRef.current;

    const source = map.getSource("route") as any;
    const traversedSource = map.getSource("route-traversed") as any;

    if (!routeGeoJSON) {
      if (source) source.setData({ type: "FeatureCollection", features: [] });
      if (traversedSource) traversedSource.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const coords = (routeGeoJSON.geometry as any).coordinates;
    if (!coords || coords.length === 0) return;

    if (isNavigating && navigationIcon === "car" && userLocation) {
      // Find closest index to the user
      let minDistance = Infinity;
      let closestIndex = 0;
      for (let i = 0; i < coords.length; i++) {
        const d = (userLocation[0] - coords[i][0]) ** 2 + (userLocation[1] - coords[i][1]) ** 2;
        if (d < minDistance) {
          minDistance = d;
          closestIndex = i;
        }
      }

      // Slice the coordinates to create remaining and traversed segments
      const traversedCoords = coords.slice(0, closestIndex + 1).concat([userLocation]);
      const remainingCoords = [userLocation].concat(coords.slice(closestIndex + 1));

      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: remainingCoords }
        });
      }
      if (traversedSource) {
        traversedSource.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: traversedCoords }
        });
      }
    } else {
      // If not navigating or not driving, show full route on remaining and clear traversed
      if (source) source.setData(routeGeoJSON);
      if (traversedSource) traversedSource.setData({ type: "FeatureCollection", features: [] });
    }
  }, [routeGeoJSON, userLocation, isNavigating, navigationIcon, styleLoaded]);

  // User location marker (when NOT navigating)
  useEffect(() => {
    if (!mapRef.current || !userLocation || isNavigating) return;

    // Remove nav marker if exists
    if (navMarkerRef.current) {
      navMarkerRef.current.remove();
      navMarkerRef.current = null;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userLocation);
      return;
    }

    const el = createLocationDot();
    userMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: "center",
      pitchAlignment: "map",
      rotationAlignment: "map"
    })
      .setLngLat(userLocation)
      .addTo(mapRef.current);
  }, [userLocation, isNavigating]);

  // Navigation follow mode — car/bike/walk icon that follows GPS
  useEffect(() => {
    if (!mapRef.current || !userLocation || !isNavigating) return;

    // Remove regular location dot
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const coords = routeGeoJSON
      ? ((routeGeoJSON.geometry as GeoJSON.LineString).coordinates as [number, number][])
      : null;
    const along = coords ? bearingAhead(userLocation, coords) : null;
    const heading = along ?? userHeading ?? 0;

    if (navMarkerRef.current) {
      navMarkerRef.current.setLngLat(userLocation);
      navMarkerRef.current.getElement().replaceChildren(
        ...createNavIcon(navigationIcon, 0).children
      );
    } else {
      const el = createNavIcon(navigationIcon, 0);
      navMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport"
      })
        .setLngLat(userLocation)
        .addTo(mapRef.current);
    }

    mapRef.current.easeTo({
      center: userLocation,
      zoom: 17.1,
      bearing: heading,
      pitch: 52,
      padding: { top: 120, bottom: 210, left: 40, right: 40 },
      duration: 700,
    });
  }, [userLocation, isNavigating, userHeading, navigationIcon, routeGeoJSON]);

  // Clean up nav marker when navigation ends
  useEffect(() => {
    if (!isNavigating && navMarkerRef.current) {
      navMarkerRef.current.remove();
      navMarkerRef.current = null;
      // Reset camera
      if (mapRef.current) {
        mapRef.current.easeTo({
          pitch: is3DMode ? 55 : 0,
          bearing: 0,
          padding: { top: 0, bottom: 0, left: 0, right: 0 },
          duration: 800,
        });
      }
    }
  }, [isNavigating, is3DMode]);

  return <div ref={containerRef} className="map-container" />;
});

function bearingAhead(user: [number, number], coords: [number, number][]): number | null {
  if (coords.length < 2) return null;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = (user[0] - coords[i][0]) ** 2 + (user[1] - coords[i][1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const meters = 50;
  let walked = 0;
  let prev = coords[Math.min(best, coords.length - 1)];
  for (let i = best + 1; i < coords.length; i++) {
    const next = coords[i];
    const dLat = (next[1] - prev[1]) * 111320;
    const dLon = (next[0] - prev[0]) * 111320 * Math.cos((user[1] * Math.PI) / 180);
    const step = Math.hypot(dLat, dLon);
    if (walked + step >= meters || i === coords.length - 1) {
      const t = step <= 0 ? 1 : Math.min(1, Math.max(0, (meters - walked) / step));
      const lon2 = prev[0] + (next[0] - prev[0]) * t;
      const lat2 = prev[1] + (next[1] - prev[1]) * t;
      return travelBearing(user[1], user[0], lat2, lon2);
    }
    walked += step;
    prev = next;
  }
  return null;
}

function travelBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export default MapView;
