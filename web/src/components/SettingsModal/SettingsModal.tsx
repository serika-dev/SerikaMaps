"use client";

import { useEffect, useState } from "react";
import { translations, Language } from "@/lib/translations";

const PRECONFIGURED_FISH_VOICES = [
  { id: "8ef4a238714b45718ce04243307c57a7", name: "E-girl (AI)" },
  { id: "802e3bc2b27e49c2995d23ef70e6ac89", name: "Energetic Male (AI)" },
  { id: "933563129e564b19a115bedd57b7406a", name: "Sarah (AI)" },
  { id: "bf322df2096a46f18c579d0baa36f41d", name: "Adrian (AI)" },
  { id: "b347db033a6549378b48d00acb0d06cd", name: "Selene (AI)" },
  { id: "536d3a5e000945adb7038665781a4aca", name: "Ethan (AI)" },
];

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
  onTestVoice: (text: string) => void;
  // Parent Voice & TTS state bindings
  ttsEngine: "system" | "fish";
  onChangeTtsEngine: (engine: "system" | "fish") => void;
  fishAudioApiKey: string;
  onChangeFishApiKey: (key: string) => void;
  fishAudioModelId: string;
  onChangeFishModelId: (modelId: string) => void;
  // Language & Background Nav state bindings
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  bgNavEnabled: boolean;
  onToggleBgNav: () => void;
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
  onTestVoice,
  ttsEngine,
  onChangeTtsEngine,
  fishAudioApiKey,
  onChangeFishApiKey,
  fishAudioModelId,
  onChangeFishModelId,
  language,
  onChangeLanguage,
  bgNavEnabled,
  onToggleBgNav,
}: SettingsModalProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [useGoogleRouting, setUseGoogleRouting] = useState(false);
  const [mobileView, setMobileView] = useState<"menu" | "content">("menu");
  const [activeTab, setActiveTab] = useState<"map" | "routing" | "voice" | "about">("map");

  const t = translations[language] || translations.en;

  const handleTabClick = (tab: "map" | "routing" | "voice" | "about") => {
    setActiveTab(tab);
    setMobileView("content");
  };

  const isPreconfigured = PRECONFIGURED_FISH_VOICES.some(v => v.id === fishAudioModelId);
  const customModelId = isPreconfigured ? "" : fishAudioModelId;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("googleMapsApiKey");
      if (savedKey) setGoogleApiKey(savedKey);

      const savedUseGoogle = localStorage.getItem("useGoogleRouting");
      if (savedUseGoogle !== null) {
        setUseGoogleRouting(savedUseGoogle === "true");
      } else {
        setUseGoogleRouting(false);
      }
      
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

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`settings-modal glass ${mobileView === "content" ? "mobile-show-content" : "mobile-show-menu"}`} id="settings-modal">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="settings-sidebar-title">Serika Maps</span>
            <button className="settings-close mobile-only-close" onClick={onClose} aria-label="Close settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button 
            className={`settings-tab-btn ${activeTab === "map" ? "active" : ""}`}
            onClick={() => handleTabClick("map")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            <span>{t.mapDisplay}</span>
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === "routing" ? "active" : ""}`}
            onClick={() => handleTabClick("routing")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M9 6h6a3 3 0 0 1 3 3v6" />
            </svg>
            <span>{t.routingTraffic}</span>
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => handleTabClick("voice")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
            <span>{t.voiceTts}</span>
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => handleTabClick("about")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{t.softwareLicenses}</span>
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="settings-content-wrapper">
          <div className="settings-content-header">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button 
                className="mobile-back-btn" 
                onClick={() => setMobileView("menu")}
                aria-label="Back to menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h2 className="settings-title" style={{ margin: 0 }}>
                {activeTab === "map" && t.mapDisplay}
                {activeTab === "routing" && t.routingTraffic}
                {activeTab === "voice" && t.voiceTts}
                {activeTab === "about" && t.softwareLicenses}
              </h2>
            </div>
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
                    <div className="settings-label">{t.lightMode}</div>
                    <div className="settings-desc">{t.lightModeDesc}</div>
                  </div>
                  <label className={`toggle ${lightMode ? "active" : ""}`}>
                    <input type="checkbox" style={{ display: "none" }} checked={lightMode} onChange={onToggleLightMode} />
                  </label>
                </div>

                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t.globeMode}</div>
                    <div className="settings-desc">{t.globeModeDesc}</div>
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
                    <div className="settings-label">{t.googleKey}</div>
                    <div className="settings-desc">{t.googleKeyDesc}</div>
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
                      <div className="settings-label">{t.useGoogleRouting}</div>
                      <div className="settings-desc">{t.useGoogleRoutingDesc}</div>
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
                    <div className="settings-label">{t.voiceNav}</div>
                    <div className="settings-desc">{t.voiceNavDesc}</div>
                  </div>
                  <label className={`toggle ${ttsEnabled ? "active" : ""}`}>
                    <input type="checkbox" style={{ display: "none" }} checked={ttsEnabled} onChange={onToggleTts} />
                  </label>
                </div>

                {/* System & Voice Language selection */}
                <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                  <div className="settings-label">{t.sysLanguage}</div>
                  <div className="settings-desc">{t.sysLanguageDesc}</div>
                  <select 
                    value={language} 
                    onChange={(e) => onChangeLanguage(e.target.value as Language)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)"
                    }}
                  >
                    <option value="en">English</option>
                    <option value="ja">日本語 (Japanese)</option>
                    <option value="nl">Nederlands (Dutch)</option>
                  </select>
                </div>

                {/* Android Background Navigation toggle */}
                <div className="settings-row" style={{ marginTop: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                  <div>
                    <div className="settings-label">{t.bgNav}</div>
                    <div className="settings-desc">{t.bgNavDesc}</div>
                  </div>
                  <label className={`toggle ${bgNavEnabled ? "active" : ""}`}>
                    <input type="checkbox" style={{ display: "none" }} checked={bgNavEnabled} onChange={onToggleBgNav} />
                  </label>
                </div>

                {ttsEnabled && (
                  <>
                    <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                      <div className="settings-label">{t.voiceEngine}</div>
                      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <button
                          onClick={() => onChangeTtsEngine("system")}
                          className={`transport-mode ${ttsEngine === "system" ? "active" : ""}`}
                          style={{ flex: 1, padding: "8px" }}
                        >
                          {t.browserDefault}
                        </button>
                        <button
                          onClick={() => onChangeTtsEngine("fish")}
                          className={`transport-mode ${ttsEngine === "fish" ? "active" : ""}`}
                          style={{ flex: 1, padding: "8px" }}
                        >
                          {t.fishAudio}
                        </button>
                      </div>
                    </div>

                    {ttsEngine === "system" && voices.length > 0 && (
                      <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "12px" }}>
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

                    {ttsEngine === "fish" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", marginTop: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div className="settings-label">{t.fishApiKey}</div>
                          <input 
                            type="password" 
                            placeholder="Your fish.audio API key" 
                            value={fishAudioApiKey}
                            onChange={(e) => onChangeFishApiKey(e.target.value)}
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

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div className="settings-label">{t.aiVoiceSelection}</div>
                          <select 
                            value={PRECONFIGURED_FISH_VOICES.some(v => v.id === fishAudioModelId) ? fishAudioModelId : "custom"} 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "custom") {
                                onChangeFishModelId(customModelId || "");
                              } else {
                                onChangeFishModelId(val);
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "8px",
                              background: "var(--bg-tertiary)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border-subtle)"
                            }}
                          >
                            {PRECONFIGURED_FISH_VOICES.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                            <option value="custom">Custom Voice Model ID...</option>
                          </select>
                        </div>

                        {(!PRECONFIGURED_FISH_VOICES.some(v => v.id === fishAudioModelId) || fishAudioModelId === "") && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div className="settings-label">{t.customVoiceId}</div>
                            <input 
                              type="text" 
                              placeholder="e.g., 8ef4a238714b45718ce04243307c57a7" 
                              value={customModelId}
                              onChange={(e) => onChangeFishModelId(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                background: "var(--bg-tertiary)",
                                color: "var(--text-primary)",
                                fontSize: "14px"
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={() => onTestVoice(language === "ja" ? "セリカマップ：目的地への案内を開始します。" : language === "nl" ? "Serika Maps: Routebeschrijving naar bestemming gestart!" : "Serika Maps: Proceeding to route destination!")}
                      className="start-nav-btn"
                      style={{ 
                        marginTop: "20px", 
                        padding: "10px", 
                        fontSize: "14px",
                        background: "linear-gradient(135deg, var(--accent), #a855f7)" 
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                      {t.testVoiceBtn}
                    </button>
                  </>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="settings-body" style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  background: "var(--bg-tertiary)", 
                  padding: "12px", 
                  borderRadius: "12px", 
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "20px"
                }}>
                  <div style={{ fontSize: "24px" }}>🗺️</div>
                  <div>
                    <strong style={{ color: "var(--text-primary)", display: "block" }}>Serika Maps Premium</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Version 1.0.32 (Build 32) • Stable Channel</div>
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Fish Audio SDK</strong>
                  <div>Copyright (c) Fish Audio contributors. Licensed under the MIT License.</div>
                  <div style={{ marginTop: "4px" }}>Advanced, hyper-realistic AI text-to-speech engine for premium voice navigation.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>MapLibre GL JS</strong>
                  <div>Copyright (c) 2020 MapLibre contributors</div>
                  <div>Licensed under the BSD 3-Clause License.</div>
                  <div style={{ marginTop: "4px" }}>High-performance vector tile rendering engine for interactive 2D maps and 3D globe visualization.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Google Maps Platform</strong>
                  <div>Copyright (c) Google LLC</div>
                  <div style={{ marginTop: "4px" }}>Utilized via optional developer API keys for traffic-aware routing.</div>
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
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Nominatim Geocoding API</strong>
                  <div>Powered by OpenStreetMap. Data © OpenStreetMap contributors.</div>
                  <div style={{ marginTop: "4px" }}>Enables rapid and exact address search and reverse-geocoding lookup.</div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "14px", marginBottom: "4px" }}>Lucide Icons</strong>
                  <div>Copyright (c) Lucide contributors. Licensed under the ISC License.</div>
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
