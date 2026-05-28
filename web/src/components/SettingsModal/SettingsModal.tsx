"use client";

import { useEffect, useState } from "react";

interface SettingsModalProps {
  lightMode: boolean;
  onToggleLightMode: () => void;
  is3DMode: boolean;
  onToggle3DMode: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  selectedVoiceURI: string;
  onVoiceChange: (uri: string) => void;
  onClose: () => void;
}

export default function SettingsModal({
  lightMode,
  onToggleLightMode,
  is3DMode,
  onToggle3DMode,
  ttsEnabled,
  onToggleTts,
  selectedVoiceURI,
  onVoiceChange,
  onClose,
}: SettingsModalProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showLicenses, setShowLicenses] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [useGoogleRouting, setUseGoogleRouting] = useState(true);
  const [fishAudioApiKey, setFishAudioApiKey] = useState("");
  const [fishAudioModelId, setFishAudioModelId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("googleMapsApiKey");
      if (savedKey) setGoogleApiKey(savedKey);

      const savedUseGoogle = localStorage.getItem("useGoogleRouting");
      if (savedUseGoogle !== null) {
        setUseGoogleRouting(savedUseGoogle === "true");
      } else {
        setUseGoogleRouting(true);
      }

      const savedFishKey = localStorage.getItem("fishAudioApiKey");
      if (savedFishKey) setFishAudioApiKey(savedFishKey);

      const savedFishModel = localStorage.getItem("fishAudioModelId");
      if (savedFishModel) setFishAudioModelId(savedFishModel);
      
      if (window.speechSynthesis) {
        const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const handleApiKeyChange = (val: string) => {
    setGoogleApiKey(val);
    if (val.trim()) {
      localStorage.setItem("googleMapsApiKey", val.trim());
    } else {
      localStorage.removeItem("googleMapsApiKey");
    }
  };

  const handleToggleGoogleRouting = () => {
    const newVal = !useGoogleRouting;
    setUseGoogleRouting(newVal);
    localStorage.setItem("useGoogleRouting", String(newVal));
  };

  const handleFishApiKeyChange = (val: string) => {
    setFishAudioApiKey(val);
    if (val.trim()) {
      localStorage.setItem("fishAudioApiKey", val.trim());
    } else {
      localStorage.removeItem("fishAudioApiKey");
    }
  };

  const handleFishModelIdChange = (val: string) => {
    setFishAudioModelId(val);
    if (val.trim()) {
      localStorage.setItem("fishAudioModelId", val.trim());
    } else {
      localStorage.removeItem("fishAudioModelId");
    }
  };

  const [activeTab, setActiveTab] = useState<"map" | "routing" | "voice" | "about">("map");

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="settings-modal glass" id="settings-modal">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <span className="settings-sidebar-title">Serika Maps</span>
          </div>
          <button 
            className={`settings-tab-btn ${activeTab === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            <span>Map Style</span>
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === "routing" ? "active" : ""}`}
            onClick={() => setActiveTab("routing")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M9 6h6a3 3 0 0 1 3 3v6" />
            </svg>
            <span>Routing & API</span>
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
            <span>Voice & TTS</span>
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Attributions</span>
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="settings-content-wrapper">
          <div className="settings-content-header">
            <h2 className="settings-title" style={{ margin: 0 }}>
              {activeTab === "map" && "Map Display"}
              {activeTab === "routing" && "Routing & Traffic"}
              {activeTab === "voice" && "Voice & Text-to-Speech"}
              {activeTab === "about" && "Software Licenses"}
            </h2>
            <button className="settings-close" onClick={onClose} aria-label="Close settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="settings-content-body">
            {activeTab === "map" && (
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
                    <div className="settings-label">3D Globe Mode</div>
                    <div className="settings-desc">Enable 3D buildings and tilted camera</div>
                  </div>
                  <label className={`toggle ${is3DMode ? "active" : ""}`}>
                    <input type="checkbox" style={{ display: "none" }} checked={is3DMode} onChange={onToggle3DMode} />
                  </label>
                </div>
              </div>
            )}

            {activeTab === "routing" && (
              <div className="settings-body">
                <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <div>
                    <div className="settings-label">Google Maps API Key (Optional)</div>
                    <div className="settings-desc">Enable live traffic & better routes. Stored locally.</div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="AIzaSy..." 
                    value={googleApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "14px"
                    }}
                  />
                </div>

                {googleApiKey && (
                  <div className="settings-row" style={{ marginTop: "12px" }}>
                    <div>
                      <div className="settings-label">Use Google Routing</div>
                      <div className="settings-desc">Use Google Directions API for premium routes</div>
                    </div>
                    <label className={`toggle ${useGoogleRouting ? "active" : ""}`}>
                      <input type="checkbox" style={{ display: "none" }} checked={useGoogleRouting} onChange={handleToggleGoogleRouting} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {activeTab === "voice" && (
              <div className="settings-body">
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
                  <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "8px" }}>
                    <div className="settings-label">System Voice Selection</div>
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

                <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "16px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <div>
                    <div className="settings-label">Fish Audio API Key (Optional)</div>
                    <div className="settings-desc">Generate realistic voice navigation with Fish Audio S2 Pro. Stored locally.</div>
                  </div>
                  <input 
                    type="password" 
                    placeholder="Your fish.audio API key" 
                    value={fishAudioApiKey}
                    onChange={(e) => handleFishApiKeyChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "14px"
                    }}
                  />
                </div>

                {fishAudioApiKey && (
                  <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "12px" }}>
                    <div>
                      <div className="settings-label">Voice Model ID (Optional)</div>
                      <div className="settings-desc">Reference model ID from fish.audio dashboard. Defaults to E-girl.</div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="e.g., 8ef4a238714b45718ce04243307c57a7" 
                      value={fishAudioModelId}
                      onChange={(e) => handleFishModelIdChange(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "var(--bg-tertiary)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="settings-body" style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>MapLibre GL JS</strong>
                  <div>Copyright (c) 2020 MapLibre contributors</div>
                  <div>Licensed under the BSD 3-Clause License.</div>
                  <div style={{ marginTop: "4px" }}>Interactive maps vector rendering engine.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Google Maps Platform</strong>
                  <div>Copyright (c) Google LLC</div>
                  <div style={{ marginTop: "4px" }}>Utilized via user key for traffic-aware routing.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>OpenStreetMap Data</strong>
                  <div>Data © OpenStreetMap contributors</div>
                  <div>Available under the Open Database License (ODbL) 1.0.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>OSRM (Open Source Routing Machine)</strong>
                  <div>Copyright (c) 2017, Project OSRM contributors</div>
                  <div>Licensed under the BSD 2-Clause License.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>OpenRouteService / OSRM-bike / foot</strong>
                  <div>Provided by openstreetmap.de and Heidelberg Institute for Geoinformation Technology.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>CARTO Basemaps</strong>
                  <div>Copyright (c) CARTO. Vector tile data based on OpenStreetMap.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Next.js & React</strong>
                  <div>Copyright (c) Vercel, Inc. and Meta Platforms, Inc. Licensed under the MIT License.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
