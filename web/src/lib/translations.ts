export type Language = "en" | "ja" | "nl";

export const translations = {
  en: {
    // Settings Tabs
    mapDisplay: "Map Display",
    routingTraffic: "Routing & Traffic",
    voiceTts: "Voice & Text-to-Speech",
    softwareLicenses: "Software Licenses",
    
    // Map Settings
    lightMode: "Light Mode",
    lightModeDesc: "Switch to a brighter map style",
    globeMode: "3D Globe Mode",
    globeModeDesc: "Enable 3D buildings and tilted camera",
    
    // Routing Settings
    googleKey: "Google Maps API Key (Optional)",
    googleKeyDesc: "Enable live traffic & better routes. Stored locally.",
    useGoogleRouting: "Use Google Routing",
    useGoogleRoutingDesc: "Use Google Directions API for premium routes",
    
    // Voice Settings
    voiceNav: "Voice Navigation",
    voiceNavDesc: "Spoken turn-by-turn directions",
    voiceEngine: "Voice Engine",
    browserDefault: "Browser Default",
    fishAudio: "Fish Audio (AI)",
    fishApiKey: "Fish Audio API Key",
    aiVoiceSelection: "AI Voice Selection",
    customVoiceId: "Custom Voice Model ID",
    testVoiceBtn: "Test Voice Navigation",
    sysLanguage: "Language & Voice Language",
    sysLanguageDesc: "Choose interface & navigation voice language",

    // Background Navigation Settings (Android)
    bgNav: "Background Navigation",
    bgNavDesc: "Keep navigation active when app is in background or screen is off",
    bgNavActive: "Active Foreground Service",

    // Panel Directions
    directions: "Directions",
    getRoute: "Get Route",
    startNav: "Start Navigation",
    arriveBy: "Arrive by",
    myLocation: "My Location",
    
    // Toast announcements
    noRoute: "No route found — try different locations",
    offRoute: "Off route! Rerouting...",
    navEnded: "Navigation ended",
    routeFound: "Route found",
    
    // Speech Speech Format
    kilometers: "kilometers",
    meters: "meters",
    minutes: "minutes",
    hours: "hours",
    hour: "hour",
    startingNavSpeech: "Starting navigation",
    arrivedSpeech: "You have arrived at your destination",
    thenPrefix: "Then",
  },
  ja: {
    // Settings Tabs
    mapDisplay: "地図表示",
    routingTraffic: "ルート＆交通",
    voiceTts: "音声＆音声合成 (TTS)",
    softwareLicenses: "ソフトウェアライセンス",
    
    // Map Settings
    lightMode: "ライトモード",
    lightModeDesc: "明るい地図スタイルに切り替えます",
    globeMode: "3D地球儀モード",
    globeModeDesc: "3Dの建物と傾斜カメラを有効にします",
    
    // Routing Settings
    googleKey: "Google Maps APIキー（オプション）",
    googleKeyDesc: "ライブ交通とより良いルートを有効にします。ローカルに保存されます。",
    useGoogleRouting: "Googleのルート案内を使用する",
    useGoogleRoutingDesc: "プレミアムルートのためにGoogle Directions APIを使用する",
    
    // Voice Settings
    voiceNav: "音声ナビゲーション",
    voiceNavDesc: "音声による方向指示アナウンスを行います",
    voiceEngine: "音声エンジン",
    browserDefault: "ブラウザ標準",
    fishAudio: "Fish Audio (AI)",
    fishApiKey: "Fish Audio APIキー",
    aiVoiceSelection: "AI音声の選択",
    customVoiceId: "カスタム音声モデルID",
    testVoiceBtn: "音声ナビゲーションをテスト",
    sysLanguage: "言語と音声の言語",
    sysLanguageDesc: "表示画面とナビゲーション音声の言語を選択します",

    // Background Navigation Settings (Android)
    bgNav: "バックグラウンドナビゲーション",
    bgNavDesc: "アプリを閉じている時や画面オフでもナビと音声を継続します",
    bgNavActive: "フォアグラウンドサービス有効化",
    
    // Panel Directions
    directions: "ルート案内",
    getRoute: "ルートを検索",
    startNav: "ナビを開始する",
    arriveBy: "到着予定時刻",
    myLocation: "現在地",
    
    // Toast announcements
    noRoute: "ルートが見つかりませんでした。別の場所をお試しください",
    offRoute: "ルートから外れました！ルートを再探索しています...",
    navEnded: "ナビゲーションを終了しました",
    routeFound: "ルートが見つかりました",
    
    // Speech Speech Format
    kilometers: "キロメートル",
    meters: "メートル",
    minutes: "分",
    hours: "時間",
    hour: "時間",
    startingNavSpeech: "音声ナビゲーションを開始します",
    arrivedSpeech: "目的地に到着しました。ナビゲーションを終了します",
    thenPrefix: "次に",
  },
  nl: {
    // Settings Tabs
    mapDisplay: "Kaartweergave",
    routingTraffic: "Route & Verkeer",
    voiceTts: "Stem & Tekst-naar-Spraak (TTS)",
    softwareLicenses: "Softwarelicenties",
    
    // Map Settings
    lightMode: "Lichte Modus",
    lightModeDesc: "Schakel over naar een lichtere kaartstijl",
    globeMode: "3D-Globemodus",
    globeModeDesc: "Schakel 3D-gebouwen en gekantelde camera in",
    
    // Routing Settings
    googleKey: "Google Maps API-sleutel (Optioneel)",
    googleKeyDesc: "Schakel live verkeer & betere routes in. Lokaal opgeslagen.",
    useGoogleRouting: "Gebruik Google Routing",
    useGoogleRoutingDesc: "Gebruik Google Directions API voor premium routes",
    
    // Voice Settings
    voiceNav: "Gesproken Navigatie",
    voiceNavDesc: "Gesproken turn-by-turn routebeschrijving",
    voiceEngine: "Stemmotor",
    browserDefault: "Standaardbrowser",
    fishAudio: "Fish Audio (AI)",
    fishApiKey: "Fish Audio API-sleutel",
    aiVoiceSelection: "AI Stemselectie",
    customVoiceId: "Aangepast Stemmodel ID",
    testVoiceBtn: "Test Gesproken Navigatie",
    sysLanguage: "Taal & Stemtaal",
    sysLanguageDesc: "Kies de taal van de interface en de navigatiestem",

    // Background Navigation Settings (Android)
    bgNav: "Achtergrondnavigatie",
    bgNavDesc: "Houd navigatie actief wanneer de app op de achtergrond draait of het scherm uit is",
    bgNavActive: "Actieve voorgrondservice",
    
    // Panel Directions
    directions: "Routebeschrijving",
    getRoute: "Route Ophalen",
    startNav: "Start Navigatie",
    arriveBy: "Aankomst om",
    myLocation: "Mijn Locatie",
    
    // Toast announcements
    noRoute: "Geen route gevonden — probeer andere locaties",
    offRoute: "Van de route af! Herberekenen...",
    navEnded: "Navigatie beëindigd",
    routeFound: "Route gevonden",
    
    // Speech Speech Format
    kilometers: "kilometer",
    meters: "meter",
    minutes: "minuten",
    hours: "uur",
    hour: "uur",
    startingNavSpeech: "Starten van navigatie",
    arrivedSpeech: "Je bent aangekomen op je bestemming",
    thenPrefix: "Daarna"
  }
};

export function translateStep(type: string, modifier: string | undefined, roadName: string | undefined, lang: Language): string {
  const road = roadName || (lang === "ja" ? "道路" : lang === "nl" ? "de weg" : "the road");
  const dir = modifier || "";
  
  if (type === "google") {
    return roadName || "";
  }

  if (lang === "ja") {
    const dirMap: Record<string, string> = {
      left: "左折",
      right: "右折",
      "slight left": "ななめ左",
      "slight right": "ななめ右",
      "sharp left": "大きく左折",
      "sharp right": "大きく右折",
      straight: "直進",
    };
    const translatedDir = dirMap[dir] || dir;

    switch (type) {
      case "depart": return `${road}を進みます`;
      case "arrive": return `目的地に到着しました`;
      case "turn": return `${road}を${translatedDir}します`;
      case "new name": return `${road}を進み続けます`;
      case "merge": return `${road}に合流します`;
      case "on ramp": return `${road}のランプに入ります`;
      case "off ramp": return `出口を出ます`;
      case "fork": return `分岐を${dir === "left" ? "左" : "右"}方向に進み、${road}に入ります`;
      case "roundabout": case "rotary": return `ラウンドアバウトに入り、${road}へ出ます`;
      case "end of road": return `突き当たりを${dir === "left" ? "左折" : "右折"}し、${road}に入ります`;
      case "ferry": return `フェリーで${road}を渡ります`;
      default: return `${road}を進みます`;
    }
  }

  if (lang === "nl") {
    const dirMap: Record<string, string> = {
      left: " linksaf",
      right: " rechtsaf",
      "slight left": " flauw linksaf",
      "slight right": " flauw rechtsaf",
      "sharp left": " scherp linksaf",
      "sharp right": " scherp rechtsaf",
      straight: " rechtdoor",
    };
    const translatedDir = dirMap[dir] || (dir ? ` ${dir}` : "");

    switch (type) {
      case "depart": return `Vertrek op ${road}`;
      case "arrive": return `Je bent aangekomen op je bestemming`;
      case "turn": return `Sla${translatedDir} naar ${road}`;
      case "new name": return `Ga verder op ${road}`;
      case "merge": return `Voeg in op ${road}`;
      case "on ramp": return `Neem de oprit naar ${road}`;
      case "off ramp": return `Neem de afrit`;
      case "fork": return `Houd${translatedDir === " linksaf" ? " links" : " rechts"} aan bij de splitsing naar ${road}`;
      case "roundabout": case "rotary": return `Neem op de rotonde de afslag naar ${road}`;
      case "end of road": return `Sla aan het einde${translatedDir} naar ${road}`;
      case "ferry": return `Neem de veerboot over ${road}`;
      default: return `Ga verder op ${road}`;
    }
  }

  // English default
  const dirStr = dir ? ` ${dir}` : "";
  switch (type) {
    case "depart": return `Head out on ${road}`;
    case "arrive": return `You have arrived at your destination`;
    case "turn": return `Turn${dirStr} onto ${road}`;
    case "new name": return `Continue onto ${road}`;
    case "merge": return `Merge${dirStr} onto ${road}`;
    case "on ramp": return `Take the ramp${dirStr} onto ${road}`;
    case "off ramp": return `Take the exit`;
    case "fork": return `Keep${dirStr} at the fork onto ${road}`;
    case "roundabout": case "rotary": return `At the roundabout, exit onto ${road}`;
    case "end of road": return `At the end, turn${dirStr} onto ${road}`;
    case "ferry": return `Take the ferry across ${road}`;
    default: return `Continue on ${road}`;
  }
}
