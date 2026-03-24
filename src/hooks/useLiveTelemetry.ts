/**
 * useLiveTelemetry.ts — Real-time WebSocket hook for backend telemetry
 *
 * Connects to the backend telemetry stream and publishes only backend-provided
 * metrics. No synthetic fallback data is injected on the client.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { TELEMETRY_WS_URL } from "@/lib/runtimeConfig";
import { useSystemWeather } from "@/hooks/useSystemStatus";

export interface TelemetryPayload {
    type: "telemetry";
    cpu_load: number;
    memory_usage: number;
    network_latency: number;
    active_nodes: number;
    density: number;
    vehicle_count: number;
    signal_phase: "NS_GREEN" | "EW_GREEN";
    ns_queue: number;
    ew_queue: number;
    grid_congestion: Record<string, number>;
    live_incidents: any[];
    telemetry_status: "live" | "stale" | "degraded" | "offline";
    data_source: string;
    data_freshness_ms: number;
    vision_state: "active" | "degraded" | "disconnected" | "not_installed" | "api_sensing";
    backend_online: boolean;
    last_updated: number;
}

// Zero-state payload — displayed while WebSocket is connecting
// All real values come exclusively from the backend WebSocket
const EMPTY_TELEMETRY: TelemetryPayload = {
    type: "telemetry",
    cpu_load: 0,
    memory_usage: 0,
    network_latency: 0,
    active_nodes: 0,
    density: 0,
    vehicle_count: 0,
    signal_phase: "NS_GREEN",
    ns_queue: 0,
    ew_queue: 0,
    grid_congestion: {},
    live_incidents: [],
    telemetry_status: "offline",
    data_source: "unavailable",
    data_freshness_ms: 0,
    vision_state: "api_sensing",
    backend_online: false,
    last_updated: 0,
};


export function useLiveTelemetry() {
    const [data, setData] = useState<TelemetryPayload>(EMPTY_TELEMETRY);
    const [connected, setConnected] = useState(false);
    // usingFallback is always false — the system no longer uses fake data
    const usingFallback = false;
    const wsRef = useRef<WebSocket | null>(null);

    const stopFallback = useCallback(() => {
        // No-op: fallback system removed for production mode
    }, []);

    useEffect(() => {
        let retryTimer: ReturnType<typeof setTimeout>;

        const connect = () => {
            if (wsRef.current) wsRef.current.close();

            try {
                const ws = new WebSocket(TELEMETRY_WS_URL);
                wsRef.current = ws;

                let pingTimer: ReturnType<typeof setInterval>;

                ws.onopen = () => {
                    setConnected(true);
                    stopFallback();
                    // Send keepalive ping every 15s to prevent silent disconnects
                    pingTimer = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "ping" }));
                        }
                    }, 15000);
                };

                ws.onmessage = (evt) => {
                    try {
                        const payload = JSON.parse(evt.data);
                        if (payload.type === "telemetry") {
                            setData(payload);
                        }
                    } catch { }
                };

                ws.onerror = () => {
                    ws.close();
                };

                ws.onclose = () => {
                    clearInterval(pingTimer);
                    setConnected(false);
                    wsRef.current = null;
                    retryTimer = setTimeout(connect, 3000); // retry every 3s
                };
            } catch {
                retryTimer = setTimeout(connect, 3000);
            }
        };

        connect();

        return () => {
            clearTimeout(retryTimer);
            if (wsRef.current) wsRef.current.close();
        };
    }, [stopFallback]);

    return { data, connected, usingFallback };
}

/** Weather state sourced from the backend weather endpoint */
export interface WeatherState {
    available: boolean;
    condition: string;
    temp: number | null;
    description: string;
    icon: string;
}

const WEATHER_ICON_MAP: Record<string, string> = {
    clear: "☀️", clouds: "⛅", rain: "🌧️", drizzle: "🌦️",
    thunderstorm: "⛈️", snow: "❄️", mist: "🌫️", fog: "🌫️", haze: "🌫️",
};

export function useLiveWeather() {
    const { data } = useSystemWeather();
    const condition = data?.condition ? String(data.condition) : "Unavailable";
    const normalized = condition.toLowerCase();

    return {
        available: Boolean(data?.available),
        condition,
        temp: typeof data?.temp === "number" ? Math.round(data.temp) : null,
        description: data?.available ? `${data.source} live weather` : "Live weather unavailable",
        icon: WEATHER_ICON_MAP[normalized] ?? "🌡️",
    };
}
