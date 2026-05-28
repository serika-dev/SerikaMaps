"use client";

import { useEffect, useState } from "react";

interface SettingsModalProps {
  lightMode: boolean;
  onToggleLightMode: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  selectedVoiceURI: string;
  onVoiceChange: (uri: string) => void;
  onClose: () => void;
}

export default function SettingsModal({
  lightMode,
  onToggleLightMode,
  ttsEnabled,
  onToggleTts,
  selectedVoiceURI,
  onVoiceChange,
  onClose,
}: SettingsModalProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showLicenses, setShowLicenses] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="settings-modal glass" id="settings-modal">
        <div className="settings-header">
          <h2 className="settings-title">Map Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-row">
            <div>
              <div className="settings-label">Light Mode</div>
              <div className="settings-desc">Switch to a brighter map style</div>
            </div>
            <label className={`toggle ${lightMode ? "active" : ""}`}>
              <input type="checkbox" style={{ display: "none" }} checked={lightMode} onChange={onToggleLightMode} />
            </label>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Voice Navigation</div>
              <div className="settings-desc">Spoken turn-by-turn directions</div>
            </div>
            <label className={`toggle ${ttsEnabled ? "active" : ""}`}>
              <input type="checkbox" style={{ display: "none" }} checked={ttsEnabled} onChange={onToggleTts} />
            </label>
          </div>

          {ttsEnabled && voices.length > 0 && (
            <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
              <div className="settings-label">Voice Selection</div>
              <select 
                value={selectedVoiceURI} 
                onChange={(e) => onVoiceChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                <option value="">Default Voice</option>
                {voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="settings-row" style={{ marginTop: "16px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
            <div>
              <div className="settings-label">Software Licenses</div>
              <div className="settings-desc">View open source attributions</div>
            </div>
            <button 
              onClick={() => setShowLicenses(true)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--surface-hover)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              View
            </button>
          </div>
        </div>
      </div>

      {showLicenses && (
        <>
          <div className="modal-backdrop" onClick={() => setShowLicenses(false)} style={{ zIndex: 3000 }} />
          <div className="settings-modal glass" style={{ zIndex: 3001, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="settings-header" style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <h2 className="settings-title">Software Licenses</h2>
              <button className="settings-close" onClick={() => setShowLicenses(false)} aria-label="Close licenses">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="settings-body" style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-secondary)", overflowY: 'auto', paddingRight: '4px' }}>
              
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>MapLibre GL JS</strong>
                <div>Copyright (c) 2020 MapLibre contributors</div>
                <div>Licensed under the BSD 3-Clause License.</div>
                <div style={{ marginTop: "4px" }}>MapLibre GL JS is a TypeScript library that uses WebGL to render interactive maps from vector tiles and Mapbox styles.</div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>OpenStreetMap Data</strong>
                <div>Data © OpenStreetMap contributors</div>
                <div>Available under the Open Database License (ODbL) 1.0.</div>
                <div style={{ marginTop: "4px" }}>Map data powering the geocoding and routing features is sourced openly by the OSM community.</div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>OSRM (Open Source Routing Machine)</strong>
                <div>Copyright (c) 2017, Project OSRM contributors</div>
                <div>Licensed under the BSD 2-Clause License.</div>
                <div style={{ marginTop: "4px" }}>Provides the high-performance routing API utilized for car directions and metrics.</div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>OpenRouteService / OSRM-bike / foot</strong>
                <div>Provided by openstreetmap.de and Heidelberg Institute for Geoinformation Technology.</div>
                <div style={{ marginTop: "4px" }}>Utilized for the highly precise walking and cycling routing engines.</div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>CARTO Basemaps</strong>
                <div>Copyright (c) CARTO</div>
                <div>Vector tile data based on OpenStreetMap.</div>
                <div style={{ marginTop: "4px" }}>Provides the underlying vector map geometry layer, which is dynamically deep-themed on the client.</div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Next.js & React</strong>
                <div>Copyright (c) Vercel, Inc. and Meta Platforms, Inc.</div>
                <div>Licensed under the MIT License.</div>
                <div style={{ marginTop: "4px" }}>The core UI frameworks for Serika Maps web components and routing.</div>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
