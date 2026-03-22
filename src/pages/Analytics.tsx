import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, TrendingUp, Activity, Zap } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, BarChart, Bar, Cell, Legend,
} from "recharts";
import { useHistoricalPerformanceMetrics, useSignalLogs, useTrafficData } from "@/hooks/useTrafficDB";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { fetchApi } from "@/lib/fetchApi";
import { format } from "date-fns";
import { useSystemCameras } from "@/hooks/useSystemStatus";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const ZONE_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#8b5cf6",
  Low: "#22c55e",
  Unavailable: "#71717a",
};

const CHART_STYLE = {
  contentStyle: { background: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 18%)", borderRadius: "8px", fontSize: 12 },
  axisStyle: { fontSize: 10, fill: "hsl(215 20% 55%)" },
  gridStyle: { strokeDasharray: "3 3", stroke: "hsl(217 33% 18%)", vertical: false },
};

interface CameraSnapshot {
  id: string;
  name: string;
  vehicle_count: number;
  congestion: number | null;
}

export default function Analytics() {
  const { data: metricsData } = useHistoricalPerformanceMetrics();
  const { data: logsData } = useSignalLogs();
  const { data: trafficData } = useTrafficData();
  const { data: telemetry } = useLiveTelemetry();
  const { data: cameraResponse, isError: cameraQueryError } = useSystemCameras();

  const [bangaloreThroughput, setBangaloreThroughput] = useState<{ name: string; vehicles: number; color: string }[]>([]);
  const [zoneError, setZoneError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const zonesResponse = await fetchApi("/api/bangalore/traffic");

        if (!active) return;

        setBangaloreThroughput(
          (zonesResponse.zones || []).map((zone: any) => ({
            name: zone.name.replace(" Junction", "").replace(" Bridge", "").replace(" Flyover", "").replace(" Road (ORR)", ""),
            vehicles: zone.vehicle_estimate || 0,
            color: ZONE_COLORS[zone.level] || "#71717a",
          })),
        );
        setZoneError(null);
      } catch {
        if (!active) return;
        setBangaloreThroughput([]);
        setZoneError("Live Bangalore throughput data is unavailable.");
      }
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const cameraSnapshots = useMemo<CameraSnapshot[]>(
    () => (cameraResponse?.cameras || [])
      .filter((camera) => camera.available)
      .map((camera) => ({
        id: camera.id,
        name: camera.name,
        vehicle_count: camera.vehicle_count ?? 0,
        congestion: camera.congestion,
      })),
    [cameraResponse],
  );

  const cameraError = cameraQueryError
    ? "Live camera telemetry data is unavailable."
    : (cameraResponse && cameraResponse.active_count === 0 ? "Camera locations are online, but no live camera telemetry source is reporting yet." : null);

  const chartData = useMemo(() => (
    (metricsData || []).map((metric: any) => ({
      time: format(new Date(metric.created_at), "HH:mm"),
      ai_efficiency: metric.ai_efficiency,
      traditional_efficiency: metric.traditional_efficiency,
      density: 100 - metric.ai_efficiency,
      cpu_load: metric.cpu_load,
      memory_usage: metric.memory_usage,
      latency: metric.network_latency,
    }))
  ), [metricsData]);

  const latestPoint = chartData[chartData.length - 1] || null;
  const avgAI = chartData.length ? parseFloat((chartData.reduce((sum, point) => sum + point.ai_efficiency, 0) / chartData.length).toFixed(1)) : 0;
  const avgTrad = chartData.length ? parseFloat((chartData.reduce((sum, point) => sum + point.traditional_efficiency, 0) / chartData.length).toFixed(1)) : 0;
  const effGain = (avgAI - avgTrad).toFixed(1);

  const latestTraffic = trafficData?.[0];
  const queues = latestTraffic ? {
    north: latestTraffic.north,
    south: latestTraffic.south,
    east: latestTraffic.east,
    west: latestTraffic.west,
  } : {
    north: telemetry.ns_queue / 2,
    south: telemetry.ns_queue / 2,
    east: telemetry.ew_queue / 2,
    west: telemetry.ew_queue / 2,
  };

  const liveCameraVolumes = useMemo(() => {
    return cameraSnapshots.map((camera, index) => ({
      name: camera.name.replace(" Junction", "").replace(" Bridge", "").replace(" Flyover", ""),
      vehicles: camera.vehicle_count,
      congestion: camera.congestion,
      fill: [
        "hsl(199 89% 48%)",
        "hsl(262 83% 58%)",
        "hsl(43 96% 56%)",
        "hsl(153 72% 40%)",
      ][index % 4],
    }));
  }, [cameraSnapshots]);

  const trafficVolumeSeries = useMemo(() => (
    (trafficData || []).slice(0, 10).reverse().map((entry: any) => ({
      time: format(new Date(entry.created_at), "HH:mm"),
      North: entry.north,
      South: entry.south,
      East: entry.east,
      West: entry.west,
    }))
  ), [trafficData]);

  const sourceLabel = chartData.length > 0 ? "Live system telemetry + live system snapshots" : "Waiting for live system metrics";
  const sourceDot = chartData.length > 0 ? "bg-success" : "bg-warning";

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto space-y-6">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Performance Analytics</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${sourceDot} animate-pulse`} />
              {sourceLabel}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="glass rounded-lg px-4 py-2 text-center border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase">AI Gain</div>
              <div className="text-2xl font-heading font-bold text-success">{chartData.length > 0 ? `+${effGain}%` : "—"}</div>
            </div>
            <div className="glass rounded-lg px-4 py-2 text-center border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase">AI Efficiency</div>
              <div className="text-2xl font-heading font-bold text-primary">{latestPoint ? `${latestPoint.ai_efficiency.toFixed(1)}%` : "—"}</div>
            </div>
            <div className="glass rounded-lg px-4 py-2 text-center border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase">Live Density</div>
              <div className="text-2xl font-heading font-bold text-warning">{telemetry.density ? `${telemetry.density.toFixed(1)}%` : "—"}</div>
            </div>
          </div>
        </motion.div>

        {zoneError && (
          <div className="glass rounded-xl p-4 border border-warning/20 text-warning text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {zoneError}
          </div>
        )}

        {cameraError && (
          <div className="glass rounded-xl p-4 border border-warning/20 text-warning text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {cameraError}
          </div>
        )}

        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Avg AI Efficiency", value: chartData.length ? `${avgAI}%` : "—", color: "text-success", icon: Zap },
            { label: "Avg Traditional", value: chartData.length ? `${avgTrad}%` : "—", color: "text-muted-foreground", icon: Activity },
            { label: "Error Events", value: (logsData?.filter((log: any) => log.log_type === "ERROR" || log.log_type === "ALERT").length ?? 0).toString(), color: "text-destructive", icon: AlertTriangle },
            { label: "Log Entries", value: (logsData?.length ?? 0).toLocaleString(), color: "text-primary", icon: TrendingUp },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl p-4 card-hover">
              <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
              <div className={`text-xl font-heading font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs font-mono text-muted-foreground tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground">Edge Hardware Telemetry</h3>
                <p className="text-xs text-muted-foreground">CPU and memory usage from system metrics</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid {...CHART_STYLE.gridStyle} />
                  <XAxis dataKey="time" tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Area type="monotone" dataKey="cpu_load" name="CPU %" stroke="hsl(199 89% 48%)" fillOpacity={0.15} fill="hsl(199 89% 48%)" />
                  <Area type="monotone" dataKey="memory_usage" name="Memory %" stroke="hsl(262 83% 58%)" fillOpacity={0.15} fill="hsl(262 83% 58%)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Waiting for live system metrics...</div>
            )}
          </motion.div>

          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground">Algorithm Efficiency Curve</h3>
                <p className="text-xs text-muted-foreground">Historical live AI efficiency vs baseline</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid {...CHART_STYLE.gridStyle} />
                  <XAxis dataKey="time" tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Line type="stepAfter" dataKey="traditional_efficiency" name="Traditional %" stroke="hsl(215 20% 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ai_efficiency" name="AI %" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Waiting for live efficiency history...</div>
            )}
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="mb-4">
              <h3 className="font-heading font-semibold text-foreground">Traffic Density Trend</h3>
              <p className="text-xs text-muted-foreground">Observed density from stored live system metrics</p>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid {...CHART_STYLE.gridStyle} />
                  <XAxis dataKey="time" tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Area type="monotone" dataKey="density" name="Density %" stroke="#ef4444" fillOpacity={0.15} fill="#ef4444" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Waiting for live density history...</div>
            )}
          </motion.div>

          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="mb-4">
              <h3 className="font-heading font-semibold text-foreground">Intersection Throughput</h3>
              <p className="text-xs text-muted-foreground">Live vehicle estimates by Bangalore zone</p>
            </div>
            {bangaloreThroughput.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bangaloreThroughput} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 18%)" horizontal={false} />
                  <XAxis type="number" tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} width={85} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Bar dataKey="vehicles" radius={[0, 4, 4, 0]}>
                    {bangaloreThroughput.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Waiting for live throughput data...</div>
            )}
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="mb-2">
              <h3 className="font-heading font-semibold text-foreground">Camera Vehicle Totals</h3>
              <p className="text-xs text-muted-foreground">Per-location vehicle counts from live camera telemetry</p>
            </div>
            {liveCameraVolumes.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={liveCameraVolumes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 18%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                  <Bar dataKey="vehicles" name="Vehicles" radius={[4, 4, 0, 0]}>
                    {liveCameraVolumes.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Waiting for live camera telemetry...</div>
            )}
          </motion.div>

          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="mb-2">
              <h3 className="font-heading font-semibold text-foreground">Directional Volume Over Time</h3>
              <p className="text-xs text-muted-foreground">Stored directional counts from live intersection snapshots</p>
            </div>
            {trafficVolumeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trafficVolumeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 18%)" vertical={false} />
                  <XAxis dataKey="time" tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                  <Bar dataKey="North" stackId="a" fill="hsl(199 89% 48%)" />
                  <Bar dataKey="South" stackId="a" fill="hsl(262 83% 58%)" />
                  <Bar dataKey="East" stackId="a" fill="hsl(43 96% 56%)" />
                  <Bar dataKey="West" stackId="a" fill="hsl(0 84% 60%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Waiting for live directional history...</div>
            )}
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Quad-Directional Flow
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(queues).map(([direction, value]) => (
                <div key={direction} className="flex flex-col items-center justify-center p-4 bg-primary/10 rounded border border-primary/20">
                  <span className="text-xs text-muted-foreground uppercase mb-1">{direction}</span>
                  <span className="text-2xl font-mono">{Math.round(Number(value))}</span>
                  <div className="w-full h-1 bg-secondary/50 rounded mt-2">
                    <div className="h-full bg-primary rounded" style={{ width: `${Math.min(100, Number(value) * 4)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
              <span>Node: BLR-CORE-1</span>
              <span className="text-success font-mono">{telemetry.data_source || "Live"}</span>
            </div>
          </motion.div>

          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-xl p-5 border-border/50 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Agent Audit Trail</h3>
              <div className="flex rounded-lg bg-secondary overflow-hidden border border-border/40">
                <button className="px-3 py-1 text-[10px] uppercase tracking-wider font-mono bg-primary text-primary-foreground">Live</button>
              </div>
            </div>
            <div className="overflow-x-auto flex-1 h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="font-mono text-muted-foreground uppercase border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur">
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Timestamp</th>
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Agent</th>
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Action</th>
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Message</th>
                    <th className="text-right py-2 font-normal tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(logsData || []).map((log: any, index: number) => (
                    <tr key={log.id || index} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-muted-foreground/70">{format(new Date(log.created_at), "HH:mm:ss")}</td>
                      <td className="py-2.5 pr-4">{log.agent_name}</td>
                      <td className="py-2.5 pr-4 text-foreground font-medium">{log.action}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{log.reasoning || "No reasoning logged."}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{log.impact || "-"}</td>
                    </tr>
                  ))}
                  {(!logsData || logsData.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm font-mono">
                        <RefreshCw className="w-5 h-5 animate-spin opacity-50 mx-auto mb-2" />
                        Awaiting live audit data...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
