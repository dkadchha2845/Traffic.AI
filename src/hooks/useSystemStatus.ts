import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetchApi";

export interface SystemZoneSnapshot {
  id: string;
  name: string;
  area: string;
  peak_hours: string;
  lat: number;
  lon: number;
  congestion_pct: number | null;
  vehicle_estimate: number | null;
  level: string;
  current_speed_kmph: number | null;
  free_flow_speed_kmph: number | null;
  recommendations: string[];
  data_source: string;
  available: boolean;
}

export interface SystemNetworkSnapshot {
  active_nodes: number;
  websocket_clients: number;
  telemetry_status: string;
  vision_state: string;
  network_latency_ms: number | null;
  avg_congestion_pct: number | null;
  avg_speed_kmph: number | null;
  zones: SystemZoneSnapshot[];
  updated_at: string;
}

export interface RuntimeDependencyEntry {
  status: string;
  last_success_at?: number | null;
  last_error?: string | null;
  source?: string;
  last_payload_at?: number | null;
}

export interface SystemDependenciesSnapshot {
  traffic_api: RuntimeDependencyEntry;
  weather_api: RuntimeDependencyEntry;
  supabase: RuntimeDependencyEntry;
  vision: RuntimeDependencyEntry;
  rl_model: RuntimeDependencyEntry;
  telemetry: RuntimeDependencyEntry;
  websocket: {
    client_count: number;
    last_connected_at?: number | null;
    last_disconnected_at?: number | null;
  };
  uptime_seconds: number;
}

export interface SystemWeatherSnapshot {
  available: boolean;
  condition: string | null;
  temp: number | null;
  visibility: number | null;
  source: string;
  updated_at: string;
}

export interface SystemCameraSnapshot {
  id: string;
  zone_id: string;
  name: string;
  area: string;
  lat: number | null;
  lon: number | null;
  vehicle_count: number | null;
  congestion: number | null;
  current_speed_kmph: number | null;
  signal_phase: string | null;
  stream_url?: string | null;
  stream_configured?: boolean;
  frame_endpoint?: string | null;
  vision_state: string;
  updated_at: string;
  data_source: string;
  available: boolean;
  primary_stream: boolean;
  telemetry_status: string;
  snapshot_recorded_at: string | null;
}

export interface SystemCameraResponse {
  cameras: SystemCameraSnapshot[];
  count: number;
  active_count: number;
  updated_at: string;
}

export function useSystemNetwork() {
  return useQuery<SystemNetworkSnapshot>({
    queryKey: ["system_network"],
    queryFn: () => fetchApi("/api/system/network"),
    refetchInterval: 15000,
  });
}

export function useSystemDependencies() {
  return useQuery<SystemDependenciesSnapshot>({
    queryKey: ["system_dependencies"],
    queryFn: () => fetchApi("/api/health/dependencies"),
    refetchInterval: 15000,
  });
}

export function useSystemWeather() {
  return useQuery<SystemWeatherSnapshot>({
    queryKey: ["system_weather"],
    queryFn: () => fetchApi("/api/system/weather"),
    refetchInterval: 300000,
  });
}

export function useSystemCameras() {
  return useQuery<SystemCameraResponse>({
    queryKey: ["system_cameras"],
    queryFn: () => fetchApi("/api/system/cameras"),
    refetchInterval: 5000,
  });
}
