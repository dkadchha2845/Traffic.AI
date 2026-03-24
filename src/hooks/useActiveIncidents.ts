import { useState, useEffect, useCallback } from "react";
import { fetchApi } from "@/lib/fetchApi";
import { useLiveTelemetry } from "./useLiveTelemetry";

export interface LiveIncident {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  icon_category: number;
  lat: number | null;
  lon: number | null;
  road_name: string;
  from_road: string;
  to_road: string;
  description: string;
  delay_minutes: number;
  length_km: number;
  magnitude: number;
  timestamp: number;
}

/**
 * Hook that provides enriched real-time incident data.
 * Prefers WebSocket live_incidents when available; falls back to REST polling.
 */
export function useActiveIncidents(pollIntervalMs = 20_000) {
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const { data: telemetry } = useLiveTelemetry();

  // WebSocket incidents (from main.py telemetry broadcast)
  useEffect(() => {
    if (telemetry?.live_incidents && Array.isArray(telemetry.live_incidents) && telemetry.live_incidents.length > 0) {
      // Check if these are the new enriched format (have `severity` field)
      const first = telemetry.live_incidents[0];
      if (first?.severity) {
        setIncidents(telemetry.live_incidents as LiveIncident[]);
        setLastUpdated(Date.now());
      }
    }
  }, [telemetry?.live_incidents]);

  // REST fallback polling
  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/command/active-incidents");
      if (data?.incidents?.length > 0) {
        setIncidents(data.incidents);
        setLastUpdated(Date.now());
      }
    } catch {
      // Backend offline — keep last known incidents
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const t = setInterval(fetchIncidents, pollIntervalMs);
    return () => clearInterval(t);
  }, [fetchIncidents, pollIntervalMs]);

  return {
    incidents,
    loading,
    lastUpdated,
    refetch: fetchIncidents,
    critical: incidents.filter(i => i.severity === "CRITICAL"),
    high: incidents.filter(i => i.severity === "HIGH"),
  };
}
