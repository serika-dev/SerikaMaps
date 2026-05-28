"use client";

import type { Place } from "@/lib/types";

interface PlaceCardProps {
  place: Place;
  onClose: () => void;
  onDirections: (place: Place) => void;
}

export default function PlaceCard({ place, onClose, onDirections }: PlaceCardProps) {
  return (
    <div className="place-card glass" id="place-card">
      <button
        className="directions-close"
        onClick={onClose}
        style={{ position: "absolute", top: "12px", right: "12px" }}
        aria-label="Close place card"
        id="place-close-btn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="place-name">{place.name}</div>
      <div className="place-address">{place.displayName}</div>
      <div className="place-coords">
        {place.lat.toFixed(6)}, {place.lon.toFixed(6)}
      </div>

      <div className="place-actions">
        <button
          className="place-action-btn place-action-primary"
          onClick={() => onDirections(place)}
          id="place-directions-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          Directions
        </button>
        <button
          className="place-action-btn place-action-secondary"
          onClick={() => {
            const url = `https://maps.serika.dev/?lat=${place.lat}&lon=${place.lon}`;
            navigator.clipboard.writeText(url);
          }}
          id="place-share-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      </div>
    </div>
  );
}
