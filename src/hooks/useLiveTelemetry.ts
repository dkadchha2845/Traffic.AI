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

// ── Demo Safety Fallback: Calibrated Bangalore traffic patterns ──────────────
function getBangaloreFallback(): TelemetryPayload {
    const hour = new Date().getHours();
    const isPeakMorning = hour >= 7 && hour <= 10;
    const isPeakEvening = hour >= 17 && hour <= 21;
    const isPeak = isPeakMorning || isPeakEvening;

    const baseDensity = isPeak ? 68 + Math.floor(Math.random() * 15) : 35 + Math.floor(Math.random() * 20);
    const vehicleCount = Math.round(baseDensity * 1.4 + 10);

    return {
        type: "telemetry",
        cpu_load: 22 + Math.random() * 18,
        memory_usage: 55 + Math.random() * 20,
        network_latency: 8 + Math.random() * 12,
        active_nodes: 9,
        density: baseDensity,
        vehicle_count: vehicleCount,
        signal_phase: Math.random() > 0.5 ? "NS_GREEN" : "EW_GREEN",
        ns_queue: Math.round(vehicleCount * 0.55),
        ew_queue: Math.round(vehicleCount * 0.45),
        grid_congestion: {
            "BLR-1": isPeak ? 82 : 45,
            "BLR-2": isPeak ? 70 : 38,
            "BLR-3": isPeak ? 65 : 33,
            "BLR-4": isPeak ? 60 : 30,
            "BLR-5": isPeak ? 73 : 42,
            "BLR-6": isPeak ? 55 : 28,
            "BLR-7": isPeak ? 68 : 40,
            "BLR-8": isPeak ? 71 : 36,
            "BLR-9": isPeak ? 78 : 44,
        },
        live_incidents: [],
    };
}

export function useLiveTelemetry() {
    const [data, setData] = useState<TelemetryPayload>(getBangaloreFallback());
    const [connected, setConnected] = useState(false);
    const [usingFallback, setUsingFallback] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startFallback = useCallback(() => {
        setUsingFallback(true);
        setConnected(false);
        if (fallbackRef.current) return; // already running
        // Update every 5 seconds with realistic Bangalore variation
        fallbackRef.current = setInterval(() => {
            setData(getBangaloreFallback());
        }, 5000);
    }, []);

    const stopFallback = useCallback(() => {
        if (fallbackRef.current) {
            clearInterval(fallbackRef.current);
            fallbackRef.current = null;
        }
        setUsingFallback(false);
    }, []);

    useEffect(() => {
        let retryTimer: ReturnType<typeof setTimeout>;
        let attempts = 0;
        const MAX_ATTEMPTS = 3;

        const connect = () => {
            if (wsRef.current) wsRef.current.close();

            try {
                const ws = new WebSocket("ws://localhost:8000/ws/telemetry");
                wsRef.current = ws;

                ws.onopen = () => {
                    setConnected(true);
                    stopFallback();
                    attempts = 0;
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
                    attempts++;
                    if (attempts >= MAX_ATTEMPTS) {
                        startFallback();
                    } else {
                        retryTimer = setTimeout(connect, 3000);
                    }
                };
            } catch {
                startFallback();
            }
        };

        connect();

        return () => {
            clearTimeout(retryTimer);
            if (wsRef.current) wsRef.current.close();
            if (fallbackRef.current) clearInterval(fallbackRef.current);
        };
    }, [startFallback, stopFallback]);

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
