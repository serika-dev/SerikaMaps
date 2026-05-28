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
}

async function buildStyle(light: boolean, is3DMode: boolean): Promise<maplibregl.StyleSpecification> {
  const url = light
    ? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const res = await fetch(url);
  const style = await res.json();

  // Dark and Light Mode Purple Palettes
  const pal = light ? {
    bg: "#f8f7ff",
    water: "#eeecff",
    land: "#f4f2ff",
    building: "#e4e0ff",
    road: "#dcd8ff",
    text: "#8b5cf6",
    textHalo: "rgba(255,255,255,0.8)"
  } : {
    bg: "#0f0a1d",
    water: "#16102b",
    land: "#110d21",
    building: "#1b1333",
    road: "#291e4a",
    text: "#a78bfa",
    textHalo: "rgba(15,10,29,0.8)"
  };

  style.layers.forEach((layer: any) => {
    if (!layer.paint) return;
    
    // Background
    if (layer.id === "background") {
      layer.paint["background-color"] = pal.bg;
    }
    // Water
    else if (layer.id.includes("water") && layer.type === "fill") {
      layer.paint["fill-color"] = pal.water;
    }
    // Landcover, Parks, etc
    else if (layer.type === "fill" && (layer.id.includes("land") || layer.id.includes("park") || layer.id.includes("aeroway") || layer.id.includes("sand"))) {
      layer.paint["fill-color"] = pal.land;
    }
    // Roads/Lines
    else if (layer.type === "line") {
      if (layer.paint["line-color"]) {
        // Keep water lines slightly darker/lighter
        layer.paint["line-color"] = layer.id.includes("water") ? pal.water : pal.road;
      }
    }
    // Text labels
    else if (layer.type === "symbol") {
      if (layer.paint["text-color"]) layer.paint["text-color"] = pal.text;
      if (layer.paint["text-halo-color"]) layer.paint["text-halo-color"] = pal.textHalo;
    }
  });

  if (is3DMode) {
    // Remove existing flat building layers to make way for 3D
    style.layers = style.layers.filter((l: any) => !l.id.includes("building"));

    // Add 3D buildings layer
    style.layers.push({
      id: "3d-buildings",
      source: "carto",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": pal.building,
        "fill-extrusion-height": ["get", "render_height"],
        "fill-extrusion-base": ["get", "render_min_height"],
        "fill-extrusion-opacity": 0.8,
      }
    });

    // Enable globe projection
    (style as any).projection = { type: "globe" };
  } else {
    // Ensure 2D mercator
    (style as any).projection = { type: "mercator" };
  }

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

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.on("click", (e) => {
      onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
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
      if (active && mapRef.current) {
        mapRef.current.setStyle(style);
        mapRef.current.once("styledata", () => {
          if (active) setStyleLoaded((s) => !s);
        });
      }
    });

    return () => {
      active = false;
    };
  }, [lightMode, is3DMode]);

  // Adjust pitch based on navigation and 3D mode
  useEffect(() => {
    if (!mapRef.current) return;
    if (isNavigating) {
      mapRef.current.easeTo({ pitch: 45, duration: 800 });
    } else {
      mapRef.current.easeTo({ pitch: is3DMode ? 45 : 0, duration: 800 });
    }
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
        if (map.getSource("route")) map.removeSource("route");
      } catch {
        /* noop */
      }

      if (!routeGeoJSON) return;

      map.addSource("route", { 
        type: "geojson", 
        data: routeGeoJSON,
        tolerance: 0,
        buffer: 512,
        lineMetrics: true
      });

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

    const heading = userHeading || 0;

    if (navMarkerRef.current) {
      // Update position and rebuild icon for heading
      navMarkerRef.current.setLngLat(userLocation);
      navMarkerRef.current.getElement().replaceChildren(
        ...createNavIcon(navigationIcon, heading).children
      );
    } else {
      const el = createNavIcon(navigationIcon, heading);
      navMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
        pitchAlignment: "map",
        rotationAlignment: "map"
      })
        .setLngLat(userLocation)
        .addTo(mapRef.current);
    }

    // Follow the user — pan map to keep them centered with route ahead
    mapRef.current.easeTo({
      center: userLocation,
      zoom: 17,
      bearing: heading,
      pitch: 45,
      duration: 800,
    });
  }, [userLocation, isNavigating, userHeading, navigationIcon]);

  // Clean up nav marker when navigation ends
  useEffect(() => {
    if (!isNavigating && navMarkerRef.current) {
      navMarkerRef.current.remove();
      navMarkerRef.current = null;
      // Reset camera
      if (mapRef.current) {
        mapRef.current.easeTo({ pitch: 45, bearing: 0, duration: 800 });
      }
    }
  }, [isNavigating]);

  return <div ref={containerRef} className="map-container" />;
});

export default MapView;
