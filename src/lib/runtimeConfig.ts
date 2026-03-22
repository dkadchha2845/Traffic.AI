const isLocal = typeof window !== 'undefined' && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const DEFAULT_API_URL = isLocal ? "http://localhost:8000" : (typeof window !== 'undefined' ? window.location.origin : "");
const DEFAULT_WS_URL = isLocal ? "ws://localhost:8000/ws/telemetry" : (typeof window !== 'undefined' ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/telemetry` : "");

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function deriveWsUrl(apiUrl: string) {
  const normalized = normalizeBaseUrl(apiUrl);
  if (normalized.startsWith("https://")) {
    return normalized.replace("https://", "wss://") + "/ws/telemetry";
  }
  if (normalized.startsWith("http://")) {
    return normalized.replace("http://", "ws://") + "/ws/telemetry";
  }
  return DEFAULT_WS_URL;
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL || DEFAULT_API_URL,
);

export const TELEMETRY_WS_URL = normalizeBaseUrl(
  import.meta.env.VITE_WS_URL || deriveWsUrl(API_BASE_URL),
);
