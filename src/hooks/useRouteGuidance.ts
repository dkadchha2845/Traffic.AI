import { useState, useEffect, useCallback } from "react";
import { fetchApi } from "@/lib/fetchApi";

export interface DiversionRoute {
  id: string;
  junction_id: string;
  junction_name: string;
  title: string;
  description: string;
  diversion_via: string;
  time_saved: string | number;
  polyline: [number, number][][];  // MultiPolyline format for Leaflet
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Hook that fetches active diversion routes from the recommendation engine.
 */
export function useRouteGuidance(pollIntervalMs = 20_000) {
  const [routes, setRoutes] = useState<DiversionRoute[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/command/route-guidance");
      setRoutes(data?.routes || []);
    } catch {
      // Backend offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
    const t = setInterval(fetchRoutes, pollIntervalMs);
    return () => clearInterval(t);
  }, [fetchRoutes, pollIntervalMs]);

  return { routes, loading, refetch: fetchRoutes };
}
