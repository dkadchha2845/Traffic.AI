import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

// --- Validation Schemas ---

const signalLogSchema = z.object({
  agent_name: z.string(),
  action: z.string(),
  reasoning: z.string(),
  impact: z.enum(["INFO", "WARN", "ERROR", "SUCCESS"]).optional().default("INFO"),
});

const performanceMetricsSchema = z.object({
  cpu_load: z.number().min(0).max(100),
  memory_usage: z.number().min(0).max(100),
  storage_usage: z.number().min(0).max(100),
  network_latency: z.number().min(0).max(10000),
  active_nodes: z.number().int().min(0).max(100000),
  ai_efficiency: z.number().min(0).max(100),
  traditional_efficiency: z.number().min(0).max(100),
});

const trafficDataSchema = z.object({
  intersection_id: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, "Invalid intersection ID format"),
  north: z.number().int().min(0).max(10000),
  south: z.number().int().min(0).max(10000),
  east: z.number().int().min(0).max(10000),
  west: z.number().int().min(0).max(10000),
  weather: z.enum(["clear", "rain", "snow", "fog", "storm"]),
  peak_hour: z.boolean(),
  density: z.number().min(0).max(100),
  mode: z.enum(["NORMAL", "PEAK", "RAIN", "EMERGENCY", "NIGHT"]),
  emergency_active: z.boolean(),
  optimal_signal_duration: z.number().min(0).max(300).optional(),
});

// --- Hooks ---

import { fetchApi } from "@/lib/fetchApi";

export function useSignalLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["signal_logs"],
    queryFn: async () => {
      try {
        const res = await fetchApi("/api/audit/logs?limit=50");
        return res.logs || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

export function useInsertSignalLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (log: z.input<typeof signalLogSchema>) => {
      if (!user) throw new Error("Not authenticated");
      try {
        const validated = signalLogSchema.parse(log);
        const { error } = await supabase.from("signal_logs").insert([{
          agent_name: validated.agent_name,
          action: validated.action,
          reasoning: validated.reasoning,
          impact: validated.impact,
          user_id: user.id,
        }]);
        if (error) console.warn("DB insert log failed:", error.message);
      } catch (e) {
        // swallow silently for demo
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["signal_logs"] }),
  });
}

export function usePerformanceMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["performance_metrics"],
    queryFn: async () => {
      try {
        const res = await fetchApi("/api/system/metrics/history?limit=1");
        return res.rows?.[0] ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

export function useHistoricalPerformanceMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["performance_metrics_historical"],
    queryFn: async () => {
      try {
        const res = await fetchApi("/api/system/metrics/history?limit=20");
        return res.rows || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

export function useInsertPerformanceMetrics() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (metrics: z.infer<typeof performanceMetricsSchema>) => {
      if (!user) throw new Error("Not authenticated");
      try {
        const validated = performanceMetricsSchema.parse(metrics);
        const { error } = await supabase.from("performance_metrics").insert([{
          cpu_load: validated.cpu_load,
          memory_usage: validated.memory_usage,
          storage_usage: validated.storage_usage,
          network_latency: validated.network_latency,
          active_nodes: validated.active_nodes,
          ai_efficiency: validated.ai_efficiency,
          traditional_efficiency: validated.traditional_efficiency,
          user_id: user.id,
        }]);
        if (error) console.warn("DB insert perf failed:", error.message);
      } catch (e) {
        // swallow silently
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["performance_metrics"] }),
  });
}

export function useTrafficData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["traffic_data"],
    queryFn: async () => {
      try {
        const res = await fetchApi("/api/system/intersections/history?limit=50");
        return res.rows || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}

export function useInsertTrafficData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (td: z.infer<typeof trafficDataSchema>) => {
      if (!user) throw new Error("Not authenticated");
      try {
        const validated = trafficDataSchema.parse(td);
        const { error } = await supabase.from("traffic_data").insert([{
          intersection_id: validated.intersection_id,
          north: validated.north,
          south: validated.south,
          east: validated.east,
          west: validated.west,
          weather: validated.weather,
          peak_hour: validated.peak_hour,
          density: validated.density,
          mode: validated.mode,
          emergency_active: validated.emergency_active,
          optimal_signal_duration: validated.optimal_signal_duration,
          user_id: user.id,
        }]);
        if (error) console.warn("DB insert traffic failed:", error.message);
      } catch (e) {
        // swallow silently
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["traffic_data"] }),
  });
}
