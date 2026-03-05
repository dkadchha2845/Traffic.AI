
-- Traffic data table
CREATE TABLE public.traffic_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intersection_id TEXT NOT NULL DEFAULT 'A-1',
  north INTEGER NOT NULL DEFAULT 0,
  south INTEGER NOT NULL DEFAULT 0,
  east INTEGER NOT NULL DEFAULT 0,
  west INTEGER NOT NULL DEFAULT 0,
  weather TEXT NOT NULL DEFAULT 'clear',
  peak_hour BOOLEAN NOT NULL DEFAULT false,
  density REAL NOT NULL DEFAULT 0,
  optimal_signal_duration REAL,
  mode TEXT NOT NULL DEFAULT 'NORMAL',
  emergency_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traffic data"
  ON public.traffic_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own traffic data"
  ON public.traffic_data FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Signal logs table
CREATE TABLE public.signal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  log_type TEXT NOT NULL DEFAULT 'INFO',
  intersection_id TEXT DEFAULT 'A-1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signal logs"
  ON public.signal_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own signal logs"
  ON public.signal_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Performance metrics table
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cpu_load REAL NOT NULL DEFAULT 0,
  memory_usage REAL NOT NULL DEFAULT 0,
  storage_usage REAL NOT NULL DEFAULT 0,
  network_latency REAL NOT NULL DEFAULT 0,
  uptime REAL NOT NULL DEFAULT 99.9,
  active_nodes INTEGER NOT NULL DEFAULT 0,
  ai_efficiency REAL NOT NULL DEFAULT 0,
  traditional_efficiency REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON public.performance_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metrics"
  ON public.performance_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable realtime for signal_logs and performance_metrics
ALTER PUBLICATION supabase_realtime ADD TABLE public.signal_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_metrics;
