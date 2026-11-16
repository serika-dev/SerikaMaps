"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Place } from "@/lib/types";

interface SearchBarProps {
  onSelect?: (place: Place) => void;
  onSelectPlace?: (place: Place) => void;
  userLocation?: [number, number] | null;
  mapCenter?: [number, number] | null;
  onOpenSettings?: () => void;
  placeholder?: string;
}

interface SearchHit extends Place {
  category: string;
  distanceMeters: number | null;
}

const RECENT_KEY = "serika.recent-searches";

function readRecent(): SearchHit[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as SearchHit[]) : [];
  } catch {
    return [];
  }
}

function remember(place: SearchHit) {
  const next = [place, ...readRecent().filter((item) => item.id !== place.id)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export default function SearchBar({
  onSelect,
  onSelectPlace,
  userLocation,
  mapCenter,
  onOpenSettings,
  placeholder,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const bias = userLocation || mapCenter || null;

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setOpen(true);
    try {
      const params = new URLSearchParams({ q: trimmed });
      if (bias) {
        params.set("lon", String(bias[0]));
        params.set("lat", String(bias[1]));
      }
      const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results?: SearchHit[] };
      const hits = data.results ?? [];
      setResults(hits);
      setStatus(hits.length ? "idle" : "empty");
      setActiveIndex(hits.length ? 0 : -1);
      setOpen(true);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setResults([]);
      setStatus("error");
      setOpen(true);
    }
  }, [bias]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 250);
    },
    [search]
  );

  const choose = useCallback(
    (place: SearchHit) => {
      setQuery(place.name);
      setOpen(false);
      setResults([]);
      setStatus("idle");
      remember(place);
      setRecent(readRecent());
      if (onSelect) onSelect(place);
      if (onSelectPlace) onSelectPlace(place);
    },
    [onSelect, onSelectPlace]
  );

  const visible = query.trim().length >= 2 ? results : recent;
  const showingRecent = query.trim().length < 2 && recent.length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const list = query.trim().length >= 2 ? results : recent;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => Math.min(i + 1, list.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = list[activeIndex] || list[0];
        if (pick) choose(pick);
        else if (query.trim().length >= 2) search(query);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [results, recent, query, activeIndex, choose, search]
  );

  useEffect(() => {
    setRecent(readRecent());
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      abortRef.current?.abort();
    };
  }, []);

  const showPanel = open && (showingRecent || status !== "idle" || results.length > 0);

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <div className="search-bar glass" id="search-bar">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          className="search-input"
          id="search-input"
          type="text"
          placeholder={placeholder || "Search places, addresses..."}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-results"
          aria-autocomplete="list"
        />

        <button
          type="button"
          className={`search-clear ${query ? "visible" : ""}`}
          onClick={() => {
            setQuery("");
            setResults([]);
            setStatus("idle");
            setOpen(false);
          }}
          aria-label="Clear search"
          id="search-clear-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {onOpenSettings && (
          <button
            type="button"
            className="search-settings-btn"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            id="settings-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
      </div>

      {showPanel && (
        <div className="search-results glass" id="search-results" role="listbox">
          {showingRecent && <div className="search-section-label">Recent</div>}
          {status === "loading" && <div className="search-status">Searching…</div>}
          {status === "empty" && <div className="search-status">No places match that search.</div>}
          {status === "error" && <div className="search-status">Search is unavailable. Try again.</div>}
          {status !== "loading" && visible.map((place, i) => (
            <button
              type="button"
              key={place.id}
              className={`search-result-item ${i === activeIndex ? "active" : ""}`}
              onClick={() => choose(place)}
              onMouseEnter={() => setActiveIndex(i)}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === activeIndex}
            >
              <div className="result-icon" aria-hidden="true">{place.category.slice(0, 2)}</div>
              <div className="result-info">
                <div className="result-name">{place.name}</div>
                <div className="result-address">{place.displayName}</div>
              </div>
              <div className="result-meta">
                {place.distanceMeters != null && <span>{formatDistance(place.distanceMeters)}</span>}
                <span>{place.category}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
