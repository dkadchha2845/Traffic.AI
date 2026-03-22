const isLocal = typeof window !== 'undefined' && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// Priority: 1. Env Var, 2. Localhost fallback, 3. Origin fallback (Vercel)
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 
  (isLocal ? "http://localhost:8000" : (typeof window !== 'undefined' ? window.location.origin : ""))).replace(/\/+$/, "");

function deriveWsUrl(apiUrl: string) {
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace("https://", "wss://") + "/ws/telemetry";
  }
  if (apiUrl.startsWith("http://")) {
    return apiUrl.replace("http://", "ws://") + "/ws/telemetry";
  }
  // If absolute path or relative, use current host
  const proto = typeof window !== 'undefined' && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== 'undefined' ? window.location.host : "localhost:8000";
  return `${proto}//${host}/ws/telemetry`;
}

export const TELEMETRY_WS_URL = import.meta.env.VITE_WS_URL || deriveWsUrl(API_BASE_URL);
