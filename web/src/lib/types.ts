export interface Place {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  location?: number[];
}

export interface RouteInfo {
  duration: number;
  distance: number;
  steps: RouteStep[];
}

export type TransportMode = "driving" | "cycling" | "walking" | "transit";
