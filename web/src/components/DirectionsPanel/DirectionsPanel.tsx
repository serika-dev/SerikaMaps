"use client";

import type { RouteInfo, TransportMode } from "@/lib/types";

interface DirectionsPanelProps {
  origin: string;
  destination: string;
  onOriginChange: (val: string) => void;
  onDestinationChange: (val: string) => void;
  onClose: () => void;
  onGetRoute: () => void;
  routeInfo: RouteInfo | null;
  transportMode: TransportMode;
  onTransportModeChange: (mode: TransportMode) => void;
  onUseMyLocation: () => void;
  isLoading: boolean;
  onStartNavigation: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function getETA(seconds: number): string {
  const arrival = new Date(Date.now() + seconds * 1000);
  return arrival.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStepIcon(instruction: string): string {
  const lower = instruction.toLowerCase();
  if (lower.includes("head out") || lower.includes("depart")) return "🚀";
  if (lower.includes("arrive")) return "🏁";
  if (lower.includes("turn left") || lower.includes("turn sharp left")) return "↰";
  if (lower.includes("turn right") || lower.includes("turn sharp right")) return "↱";
  if (lower.includes("turn slight left")) return "↖";
  if (lower.includes("turn slight right")) return "↗";
  if (lower.includes("roundabout")) return "🔄";
  if (lower.includes("merge")) return "⤵";
  if (lower.includes("ramp")) return "⤴";
  if (lower.includes("fork")) return "⑂";
  if (lower.includes("end of road")) return "⏹";
  return "→";
}

export default function DirectionsPanel({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onClose,
  onGetRoute,
  routeInfo,
  transportMode,
  onTransportModeChange,
  onUseMyLocation,
  isLoading,
  onStartNavigation,
}: DirectionsPanelProps) {
  return (
    <div className="directions-panel glass" id="directions-panel">
      <div className="directions-header">
        <h2 className="directions-title">Directions</h2>
        <button
          className="directions-close"
          onClick={onClose}
          id="directions-close-btn"
          aria-label="Close directions"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="directions-inputs">
        <div className="direction-input-row">
          <div className="direction-dot origin" />
          <input
            className="direction-input"
            id="direction-origin-input"
            placeholder="Origin"
            value={origin}
            onChange={(e) => onOriginChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onGetRoute()}
          />
          <button
            className="my-location-icon-btn"
            onClick={onUseMyLocation}
            id="use-my-location-btn"
            title="Use my current location"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </button>
        </div>
        <div className="direction-input-row">
          <div className="direction-dot destination" />
          <input
            className="direction-input"
            id="direction-dest-input"
            placeholder="Destination"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onGetRoute()}
          />
        </div>
      </div>

      <div className="transport-modes">
        {(["driving", "cycling", "walking", "transit"] as TransportMode[]).map((mode) => (
          <button
            key={mode}
            className={`transport-mode ${transportMode === mode ? "active" : ""}`}
            onClick={() => onTransportModeChange(mode)}
            id={`transport-${mode}`}
          >
            {mode === "driving" && "🚗"}
            {mode === "cycling" && "🚴"}
            {mode === "walking" && "🚶"}
            {mode === "transit" && "🚇"}
            {" "}
            {mode === "transit" ? "Transit" : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <button
        className="place-action-btn place-action-primary"
        style={{ width: "100%", marginBottom: "var(--space-4)" }}
        onClick={onGetRoute}
        id="get-route-btn"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="loading-spinner" />
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
            Get Route
          </>
        )}
      </button>

      {routeInfo && (
        <>
          <div className="route-summary">
            <div>
              <div className="route-duration">{formatDuration(routeInfo.duration)}</div>
              <div className="route-distance">{formatDistance(routeInfo.distance)}</div>
              <div className="route-eta">Arrive by {getETA(routeInfo.duration)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--text-2xl)" }}>
                {transportMode === "driving" ? "🚗" : transportMode === "cycling" ? "🚴" : transportMode === "transit" ? "🚇" : "🚶"}
              </div>
            </div>
          </div>

          <button className="start-nav-btn" onClick={onStartNavigation} id="start-nav-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Start Navigation
          </button>

          <div className="route-steps">
            {routeInfo.steps.map((step, i) => (
              <div key={i} className="route-step" id={`route-step-${i}`}>
                <div className="step-icon">
                  {getStepIcon(step.instruction)}
                </div>
                <div className="step-text">{step.instruction}</div>
                <div className="step-distance">{formatDistance(step.distance)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
