"use client";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  onOpenSettings: () => void;
  bearing?: number;
  onResetBearing?: () => void;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  onOpenSettings,
  bearing = 0,
  onResetBearing,
}: MapControlsProps) {
  return (
    <div className="map-controls">
      {/* Dynamic Compass Rose Needle */}
      {bearing !== 0 && (
        <button
          className="map-control-btn glass-sm compass-btn animate-fadeIn"
          onClick={onResetBearing}
          aria-label="Reset North"
          id="compass-btn"
          title="Reset North"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: `rotate(${-bearing}deg)`,
              transition: "transform 0.15s ease-out"
            }}
          >
            <path d="M12 2L15 9H9L12 2Z" fill="#ef4444" stroke="#ef4444" />
            <path d="M12 22L9 15H15L12 22Z" fill="#94a3b8" stroke="#94a3b8" />
          </svg>
        </button>
      )}

      {/* Zoom In */}
      <button className="map-control-btn glass-sm" onClick={onZoomIn} aria-label="Zoom in" id="zoom-in-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Zoom Out */}
      <button className="map-control-btn glass-sm" onClick={onZoomOut} aria-label="Zoom out" id="zoom-out-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* My Location */}
      <button className="map-control-btn glass-sm" onClick={onLocate} aria-label="My location" id="locate-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
      </button>

      {/* Settings */}
      <button
        className="map-control-btn glass-sm"
        onClick={onOpenSettings}
        aria-label="Open settings"
        id="settings-btn"
        title="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
