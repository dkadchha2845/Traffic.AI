import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { z } from "zod";

// --- Validation Schemas ---

const signalLogSchema = z.object({
  agent_name: z.string().trim().min(1).max(100),
  action: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500),
  log_type: z.enum(["INFO", "WARN", "ERROR", "SUCCESS", "ALERT", "LEARN", "DEBUG"]),
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

export function useSignalLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["signal_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("signal_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signal_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["signal_logs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return query;
}

export function useInsertSignalLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (log: z.input<typeof signalLogSchema>) => {
      if (!user) throw new Error("Not authenticated");
      const validated = signalLogSchema.parse(log);
      const { error } = await supabase.from("signal_logs").insert([{
        agent_name: validated.agent_name,
        action: validated.action,
        message: validated.message,
        log_type: validated.log_type,
        user_id: user.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["signal_logs"] }),
  });
}

export function usePerformanceMetrics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["performance_metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("performance_metrics_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "performance_metrics" }, () => {
        queryClient.invalidateQueries({ queryKey: ["performance_metrics"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return query;
}

export function useHistoricalPerformanceMetrics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["performance_metrics_historical"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ? [...data].reverse() : [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("performance_metrics_historical_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "performance_metrics" }, () => {
        queryClient.invalidateQueries({ queryKey: ["performance_metrics_historical"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return query;
}

export function useInsertPerformanceMetrics() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (metrics: z.infer<typeof performanceMetricsSchema>) => {
      if (!user) throw new Error("Not authenticated");
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
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["performance_metrics"] }),
  });
}

export function useTrafficData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["traffic_data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_data")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
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
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["traffic_data"] }),
  });
}
