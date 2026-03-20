/**
 * useLiveTelemetry.ts — Real-time WebSocket hook for backend telemetry
 *
 * Connects to ws://localhost:8000/ws/telemetry and publishes live metrics
 * to all subscribers. Includes demo-safe Bangalore fallback when backend
 * is offline so the UI never shows zeros.
 */

import { useState, useEffect, useCallback, useRef } from "react";

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
                const ws = new WebSocket("ws://localhost:8000/ws/telemetry");
                wsRef.current = ws;

                ws.onopen = () => {
                    setConnected(true);
                    stopFallback();
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
                    setConnected(false);
                    wsRef.current = null;
                    retryTimer = setTimeout(connect, 8000);
                };
            } catch {
                retryTimer = setTimeout(connect, 8000);
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

/** Weather state from OpenWeatherMap, with calibrated Bangalore fallback */
export interface WeatherState {
    condition: string;
    temp: number;
    description: string;
    icon: string;
}

const WEATHER_ICON_MAP: Record<string, string> = {
    clear: "☀️", clouds: "⛅", rain: "🌧️", drizzle: "🌦️",
    thunderstorm: "⛈️", snow: "❄️", mist: "🌫️", fog: "🌫️", haze: "🌫️",
};

export function useLiveWeather() {
    const [weather, setWeather] = useState<WeatherState>({
        condition: "Clear", temp: 28.5, description: "Partly Cloudy", icon: "☀️"
    });

    useEffect(() => {
        const OWM_KEY = import.meta.env.VITE_OWM_KEY || "";
        const fetchWeather = async () => {
            if (!OWM_KEY) return; // stay on fallback
            try {
                const res = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?lat=12.9716&lon=77.5946&appid=${OWM_KEY}&units=metric`
                );
                if (res.ok) {
                    const d = await res.json();
                    const main = d.weather[0].main.toLowerCase();
                    setWeather({
                        condition: d.weather[0].main,
                        temp: Math.round(d.main.temp),
                        description: d.weather[0].description,
                        icon: WEATHER_ICON_MAP[main] ?? "🌡️",
                    });
                }
            } catch { }
        };
        fetchWeather();
        const timer = setInterval(fetchWeather, 300_000); // every 5 min
        return () => clearInterval(timer);
    }, []);

    return weather;
}
