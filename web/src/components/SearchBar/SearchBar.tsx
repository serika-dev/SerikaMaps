"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Place } from "@/lib/types";

interface SearchBarProps {
  onSelect: (place: Place) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`
      );
      const data: NominatimResult[] = await res.json();
      setResults(
        data.map((r) => ({
          id: String(r.place_id),
          name: r.display_name.split(",")[0],
          displayName: r.display_name,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          type: r.type || r.class,
        }))
      );
      setShowResults(true);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 350);
    },
    [search]
  );

  const handleSelect = useCallback(
    (place: Place) => {
      setQuery(place.name);
      setShowResults(false);
      setResults([]);
      onSelect(place);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      } else if (e.key === "Escape") {
        setShowResults(false);
      }
    },
    [results, activeIndex, handleSelect]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      city: "🏙️", town: "🏘️", village: "🏡", suburb: "🏠",
      road: "🛣️", restaurant: "🍽️", cafe: "☕", hotel: "🏨",
      hospital: "🏥", school: "🏫", park: "🌳", museum: "🏛️",
    };
    return icons[type] || "📍";
  };

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <div className="search-bar glass" id="search-bar">
        {/* Search Icon */}
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          className="search-input"
          id="search-input"
          type="text"
          placeholder="Search places, addresses..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
          autoComplete="off"
        />

        <button
          className={`search-clear ${query ? "visible" : ""}`}
          onClick={() => {
            setQuery("");
            setResults([]);
            setShowResults(false);
          }}
          aria-label="Clear search"
          id="search-clear-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {showResults && results.length > 0 && (
        <div className="search-results glass" id="search-results">
          {results.map((r, i) => (
            <div
              key={r.id}
              className={`search-result-item ${i === activeIndex ? "active" : ""}`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setActiveIndex(i)}
              id={`search-result-${i}`}
            >
              <div className="result-icon">{getTypeIcon(r.type)}</div>
              <div className="result-info">
                <div className="result-name">{r.name}</div>
                <div className="result-address">{r.displayName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
