CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpu_load REAL NOT NULL DEFAULT 0,
  memory_usage REAL NOT NULL DEFAULT 0,
  storage_usage REAL NOT NULL DEFAULT 0,
  network_latency REAL NOT NULL DEFAULT 0,
  active_nodes INTEGER NOT NULL DEFAULT 0,
  ai_efficiency REAL NOT NULL DEFAULT 0,
  traditional_efficiency REAL NOT NULL DEFAULT 0,
  telemetry_status TEXT NOT NULL DEFAULT 'offline',
  vision_state TEXT NOT NULL DEFAULT 'unknown',
  data_source TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intersection_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intersection_id TEXT NOT NULL,
  north INTEGER NOT NULL DEFAULT 0,
  south INTEGER NOT NULL DEFAULT 0,
  east INTEGER NOT NULL DEFAULT 0,
  west INTEGER NOT NULL DEFAULT 0,
  weather TEXT NOT NULL DEFAULT 'unknown',
  peak_hour BOOLEAN NOT NULL DEFAULT false,
  density REAL NOT NULL DEFAULT 0,
  optimal_signal_duration REAL,
  mode TEXT NOT NULL DEFAULT 'NORMAL',
  emergency_active BOOLEAN NOT NULL DEFAULT false,
  signal_phase TEXT NOT NULL DEFAULT 'NS_GREEN',
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  data_source TEXT NOT NULL DEFAULT 'unknown',
  telemetry_status TEXT NOT NULL DEFAULT 'offline',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intersection_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read system metrics" ON public.system_metrics;
CREATE POLICY "Public read system metrics"
  ON public.system_metrics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read intersection snapshots" ON public.intersection_snapshots;
CREATE POLICY "Public read intersection snapshots"
  ON public.intersection_snapshots FOR SELECT
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intersection_snapshots;

CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON public.system_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intersection_snapshots_created_at ON public.intersection_snapshots (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intersection_snapshots_intersection_time ON public.intersection_snapshots (intersection_id, created_at DESC);
