import { Link } from "react-router-dom";
import SmartRecommendations from "@/components/SmartRecommendations";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, Play, Square, AlertTriangle, CheckCircle2, Cpu, HardDrive,
  CloudRain, Sun, Zap, Ambulance, RefreshCw, BarChart3, Wind, Droplets, Loader2, Send
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePerformanceMetrics, useSignalLogs } from "@/hooks/useTrafficDB";
import { useLiveTelemetry, useLiveWeather } from "@/hooks/useLiveTelemetry";
import { useSystemDependencies, useSystemNetwork } from "@/hooks/useSystemStatus";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchApi } from "../lib/fetchApi";
import { TELEMETRY_WS_URL } from "@/lib/runtimeConfig";

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }) };

const logTypeColors: Record<string, string> = {
  INFO: "text-foreground", SUCCESS: "text-success", LEARN: "text-accent",
  WARN: "text-warning", DEBUG: "text-muted-foreground",
};


export default function Dashboard() {
  const { user } = useAuth();
  const [simRunning, setSimRunning] = useState(false);
  const [mode, setMode] = useState<"NORMAL" | "PEAK" | "RAIN">("NORMAL");
  const [emergency, setEmergency] = useState(false);
  const [emergencyRoute, setEmergencyRoute] = useState<string | null>(null);
  const [emergencySource, setEmergencySource] = useState<string>("SILK_BOARD");
  const [emergencyDest, setEmergencyDest] = useState<string>("HEBBAL");

  const { data: telemetry, connected } = useLiveTelemetry();
  const weather = useLiveWeather();
  const { data: network } = useSystemNetwork();
  const { data: dependencies } = useSystemDependencies();
  const { data: performanceMetrics } = usePerformanceMetrics();

  const density = telemetry.density;
  const vehicleCount = telemetry.vehicle_count;
  const signalPhase = telemetry.signal_phase;
  const cpu = telemetry.cpu_load;
  const memory = telemetry.memory_usage;
  const latency = telemetry.network_latency;

  // REST fallback state — used when WebSocket is offline
  const [restStatus, setRestStatus] = useState<any>(null);

  // Poll /api/command/status every 5s when WebSocket is offline
  useEffect(() => {
    if (connected) return; // WS handles it
    const poll = async () => {
      try {
        const s = await fetchApi("/api/command/status");
        setRestStatus(s);
      } catch { /* backend offline */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [connected]);

  // Effective values — prefer WebSocket, then REST. Null means unavailable.
  const effectiveDensity      = connected ? density      : (restStatus?.density_pct   ?? null);
  const effectiveVehicles     = connected ? vehicleCount : (restStatus?.vehicle_count  ?? null);
  const effectiveSignalPhase  = connected ? signalPhase  : (restStatus?.signal_phase   ?? null);
  const effectiveCpu          = connected ? cpu          : (restStatus?.cpu_load       ?? null);
  const effectiveMemory       = connected ? memory       : (restStatus?.memory_usage   ?? null);
  const effectiveLatency      = connected ? latency      : (restStatus?.network_latency_ms ?? null);
  const effectiveNsQueue      = connected ? telemetry.ns_queue : (restStatus?.ns_queue ?? null);
  const effectiveEwQueue      = connected ? telemetry.ew_queue : (restStatus?.ew_queue ?? null);
  const effectiveTelemetryStatus = connected ? telemetry.telemetry_status : (restStatus?.telemetry_status ?? "offline");
  const effectiveVisionState = connected ? telemetry.vision_state : (restStatus?.vision_state ?? "unknown");
  const effectiveDataSource = connected ? (telemetry.data_source || "Unknown") : (restStatus?.data_source ?? "Unavailable");

  const wsRef = useRef<WebSocket | null>(null);
  const { data: logs } = useSignalLogs();

  // Chat messages state
  const [chatMessages, setChatMessages] = useState<{role: "ai"|"user"; text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialise chatbot with live context once backend connects
  useEffect(() => {
    if (connected && chatMessages.length === 0 && effectiveDensity != null && effectiveVehicles != null && effectiveSignalPhase) {
      setChatMessages([{ role: "ai", text: `Ready. Density: ${Math.round(effectiveDensity)}% · ${effectiveVehicles} vehicles at BLR-CORE-1. Signal: ${effectiveSignalPhase === "NS_GREEN" ? "N/S" : "E/W"} GREEN.` }]);
    }
  }, [connected, chatMessages.length, effectiveDensity, effectiveSignalPhase, effectiveVehicles]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages]);

  // Real-time junction decision state
  const [junctionId, setJunctionId] = useState("silk-board");
  const [junctionData, setJunctionData] = useState<any>(null);
  const [loadingJunction, setLoadingJunction] = useState(false);

  // Fetch live junction data from backend analysis endpoint
  useEffect(() => {
    const fetchJunction = async () => {
      setLoadingJunction(true);
      try {
        const data = await fetchApi(`/api/simulate/autofill?junction_id=${junctionId}`);
        setJunctionData(data);
      } catch {
        setJunctionData(null);
      } finally {
        setLoadingJunction(false);
      }
    };
    fetchJunction();
    const t = setInterval(fetchJunction, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, [junctionId]);

  useEffect(() => {
    const ws = new WebSocket(TELEMETRY_WS_URL);
    wsRef.current = ws;
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
    return () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      ws.close();
    };
  }, []);

  // Send commands to backend WebSocket when connected
  const sendCommand = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", ...payload }));
    }
  }, []);

  // POST to /api/command/control for REST-based control (always works, WS or not)
  const postControl = useCallback(async (patch: Record<string, any>) => {
    try {
      await fetchApi("/api/command/control", { method: "POST", body: JSON.stringify(patch) });
    } catch {
      // Backend offline — WS command is best-effort
    }
  }, []);

  const handleModeChange = useCallback((newMode: "NORMAL" | "PEAK" | "RAIN") => {
    setMode(newMode);
    postControl({ mode: newMode });
    sendCommand({ simRunning, emergency, mode: newMode });
  }, [simRunning, emergency, postControl, sendCommand]);

  const handleActivateEmergency = async () => {
    if (emergency) {
      setEmergency(false);
      setEmergencyRoute(null);
      postControl({ emergency: false });
      sendCommand({ simRunning, emergency: false, mode });
      toast.success("Emergency override deactivated. Signals returning to normal.");
      return;
    }
    try {
      const resp = await fetchApi("/api/command/emergency/corridor", {
        method: "POST",
        body: JSON.stringify({ origin: emergencySource.toLowerCase().replace("_", "-"), destination: emergencyDest.toLowerCase().replace("_", "-"), vehicle_type: "Ambulance" })
      });
      setEmergency(true);
      setEmergencyRoute(`Path: ${(resp.path || resp.signal_overrides?.map((s: any) => s.junction_name) || []).join(" ➞ ")}`);
      postControl({ emergency: true });
      sendCommand({ simRunning, emergency: true, mode });
      toast.success(resp.message || `Emergency corridor activated: ${(resp.path || []).join(" → ")}`);
    } catch {
      // Activate emergency locally even if corridor API is unavailable
      setEmergency(true);
      postControl({ emergency: true });
      sendCommand({ simRunning, emergency: true, mode });
      toast.warning("Emergency mode activated. Corridor API unavailable — AI forcing priority phase.");
    }
  };

  // Broadcast mode/emergency changes to backend
  useEffect(() => {
    sendCommand({ simRunning, emergency, mode });
  }, [simRunning, emergency, mode, sendCommand]);

  // Auto-switch to RAIN mode on bad weather
  useEffect(() => {
    if (!weather.available) {
      return;
    }
    const w = weather.condition.toLowerCase();
    if (w.includes("rain") || w.includes("thunderstorm") || w.includes("drizzle")) {
      setMode("RAIN");
    }
  }, [weather.available, weather.condition]);

  const storage = typeof performanceMetrics?.storage_usage === "number" ? performanceMetrics.storage_usage : null;
  const congestionPct = effectiveDensity != null ? Math.round(effectiveDensity) : null;
  const avgSpeed = effectiveDensity != null ? Math.max(5, Math.round(55 * (1 - effectiveDensity / 100))) : null;
  const subsystemStatuses = [
    { name: "Telemetry", status: dependencies?.telemetry?.status ?? effectiveTelemetryStatus, color: "bg-primary" },
    { name: "Vision", status: dependencies?.vision?.status ?? effectiveVisionState, color: "bg-cyan" },
    { name: "Traffic API", status: dependencies?.traffic_api?.status ?? "unknown", color: "bg-success" },
    { name: "Weather API", status: dependencies?.weather_api?.status ?? "unknown", color: "bg-accent" },
    { name: "RL Model", status: dependencies?.rl_model?.status ?? "unknown", color: "bg-warning" },
    { name: "Supabase", status: dependencies?.supabase?.status ?? "unknown", color: "bg-success" },
  ];

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="absolute inset-0 gradient-mesh opacity-10 pointer-events-none" />
      <div className="container mx-auto space-y-6 relative z-10">
        {/* Header */}
        <motion.div variants={fadeIn} custom={0} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">COMMAND CENTER</h1>
            <p className="text-muted-foreground text-sm">Real-time neural traffic monitoring and control — Bangalore CityOS</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">Operator: {user?.email ?? "–"}</span>
              <span className={`flex items-center gap-1 text-xs font-mono ${effectiveTelemetryStatus === "live" ? "text-success" : effectiveTelemetryStatus === "offline" ? "text-destructive" : "text-warning"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${effectiveTelemetryStatus === "live" ? "bg-success animate-pulse" : effectiveTelemetryStatus === "offline" ? "bg-destructive" : "bg-warning"}`} />
                {connected ? `WS ${effectiveTelemetryStatus.toUpperCase()}` : restStatus ? `REST ${String(effectiveTelemetryStatus).toUpperCase()}` : "OFFLINE — NO DATA"}
              </span>
              <span className="text-xs text-muted-foreground">Vision: {effectiveVisionState === "active" ? "Camera Active" : effectiveVisionState === "api_sensing" ? "API Sensing" : effectiveVisionState === "disconnected" ? "No Camera" : effectiveVisionState}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-primary" /> {effectiveCpu != null ? `${Number(effectiveCpu).toFixed(0)}%` : "—"}</span>
              <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-cyan" /> {effectiveLatency != null ? `${Number(effectiveLatency).toFixed(0)}ms` : "—"}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> {network ? `${network.active_nodes}/${network.zones.length} Nodes` : "—"}</span>
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/settings">Settings</Link></Button>
          </div>
        </motion.div>

        {/* KPI Row */}
        <motion.div variants={fadeIn} custom={1} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Traffic Density", value: congestionPct != null ? `${congestionPct}%` : "—", sub: congestionPct == null ? "Unavailable" : congestionPct > 70 ? "Heavy" : "Normal", color: congestionPct != null && congestionPct > 70 ? "text-destructive" : "text-success", icon: Activity },
            { label: "Vehicles Detected", value: effectiveVehicles != null ? effectiveVehicles.toString() : "—", sub: effectiveDataSource, color: "text-primary", icon: BarChart3 },
            { label: "Avg Speed", value: avgSpeed != null ? `${avgSpeed} km/h` : "—", sub: effectiveSignalPhase ? `Phase: ${effectiveSignalPhase === "NS_GREEN" ? "N/S" : "E/W"}` : "Phase unavailable", color: "text-accent", icon: Zap },
            { label: "Active Intersections", value: network ? `${network.active_nodes}/${network.zones.length}` : "—", sub: network?.telemetry_status || "Unavailable", color: "text-success", icon: CheckCircle2 },
          ].map((kpi) => (
            <div key={kpi.label} className="glass rounded-2xl p-5 card-hover">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-3`} />
              <div className={`text-2xl font-heading font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs font-mono text-muted-foreground tracking-wider mt-1">{kpi.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left - Subsystem Status */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Subsystem Status</h3>
            <div className="space-y-2">
              {subsystemStatuses.map((a) => (
                <div key={a.name} className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3 border border-border/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.color} ${a.status === "live" || a.status === "active" ? "animate-pulse-glow" : ""}`} />
                    <span className="font-mono text-sm text-foreground">{a.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground uppercase">{a.status}</span>
                </div>
              ))}
            </div>
            {/* Weather Widget */}
            <div className="glass rounded-xl p-4 flex items-center gap-3 border border-border/30">
              <span className="text-2xl">{weather.icon}</span>
              <div>
                <div className="text-xs font-mono text-muted-foreground tracking-wider">WEATHER · BANGALORE</div>
                <div className="font-heading font-semibold text-foreground text-sm">{weather.condition}{weather.temp != null ? ` · ${weather.temp}°C` : ""}</div>
                <div className="text-xs text-primary">{weather.description}</div>
              </div>
            </div>
          </motion.div>

          {/* Center - Real Traffic Decision Panel */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Traffic Decision Panel</h3>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={junctionId}
                  onChange={e => setJunctionId(e.target.value)}
                  className="text-xs font-mono bg-secondary border border-border/30 rounded-lg px-2 py-1 text-foreground focus:outline-none"
                >
                  {["silk-board","marathahalli","hebbal","kr-puram","ecity","majestic","indiranagar","koramangala","whitefield"].map(j => (
                    <option key={j} value={j}>{j.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
                {loadingJunction && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {connected || restStatus ? (
              <div className="space-y-3">
                {/* Live telemetry at a glance */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Vehicle Count", value: effectiveVehicles ?? "—", unit: effectiveVehicles != null ? "veh" : "", color: "text-primary" },
                    { label: "Congestion", value: effectiveDensity != null ? `${Math.round(effectiveDensity)}%` : "—", unit: "", color: effectiveDensity != null && effectiveDensity > 70 ? "text-destructive" : "text-success" },
                    { label: "Avg Speed", value: avgSpeed ?? "—", unit: avgSpeed != null ? "km/h" : "", color: "text-accent" },
                    { label: "Signal Phase", value: effectiveSignalPhase ? (effectiveSignalPhase === "NS_GREEN" ? "N/S" : "E/W") : "—", unit: effectiveSignalPhase ? "green" : "", color: "text-success" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-secondary/50 rounded-xl p-3 border border-border/20">
                      <div className="text-xs text-muted-foreground font-mono tracking-wider">{stat.label}</div>
                      <div className={`text-xl font-heading font-bold mt-1 ${stat.color}`}>
                        {stat.value} <span className="text-xs font-normal text-muted-foreground">{stat.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Source badge */}
                <div className="text-xs font-mono text-muted-foreground px-1">
                  Data via: <span className={`font-bold ${connected ? "text-success" : "text-warning"}`}>{connected ? "WebSocket (live)" : "REST polling — refreshes every 5s"}</span>
                </div>

                {/* Junction analysis from backend */}
                {junctionData ? (
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/20 space-y-2">
                    <div className="text-xs font-mono text-muted-foreground tracking-wider">BACKEND ANALYSIS · {junctionId.toUpperCase()}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      <div><span className="text-muted-foreground">Density:</span> <span className="text-foreground">{junctionData.density != null ? `${junctionData.density}%` : "—"}</span></div>
                      <div><span className="text-muted-foreground">Speed:</span> <span className="text-foreground">{junctionData.current_speed_kmph != null ? `${junctionData.current_speed_kmph} km/h` : "—"}</span></div>
                      <div><span className="text-muted-foreground">Weather:</span> <span className="text-foreground">{junctionData.weather ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{junctionData.data_status ?? "—"}</span></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      <div><span className="text-muted-foreground">Vehicles:</span> <span className="text-foreground">{junctionData.vehicle_count ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Signal:</span> <span className="text-foreground">{junctionData.signal_phase ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Snapshot:</span> <span className="text-foreground">{junctionData.snapshot_recorded_at ? new Date(junctionData.snapshot_recorded_at).toLocaleTimeString() : "—"}</span></div>
                      <div><span className="text-muted-foreground">Traffic API:</span> <span className="text-foreground">{junctionData.traffic_source ?? "—"}</span></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Last synced from <code className="text-primary">/api/simulate/autofill</code> using live backend sources only</div>
                  </div>
                ) : (
                  <div className="bg-secondary/20 rounded-xl p-4 border border-border/20 text-center">
                    <span className="text-xs text-muted-foreground">{loadingJunction ? "Fetching junction data..." : "Junction data temporarily unavailable"}</span>
                  </div>
                )}

                {/* Queue bars */}
                <div className="space-y-2">
                  {[
                    { label: "N/S Queue", value: effectiveNsQueue, max: Math.max(effectiveNsQueue, effectiveEwQueue, 1) },
                    { label: "E/W Queue", value: effectiveEwQueue, max: Math.max(effectiveNsQueue, effectiveEwQueue, 1) },
                  ].map(q => (
                    <div key={q.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-muted-foreground">{q.label}</span>
                        <span className="text-foreground">{q.value != null ? `${q.value} veh` : "—"}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${q.value != null ? Math.min(100, (q.value / (q.max || 1)) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {emergency && emergencyRoute && (
                  <div className="flex items-center gap-2 bg-destructive/20 rounded-lg px-3 py-2 text-xs font-mono text-destructive border border-destructive/30 animate-pulse">
                    <Zap className="w-3 h-3" /> EMERGENCY: {emergencyRoute}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground text-center">Connecting to backend...<br/>Ensure backend is running: <code className="text-primary">cd backend &amp;&amp; python main.py</code></p>
              </div>
            )}
          </motion.div>



          {/* Right - Control Panel */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5 space-y-5">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Control Panel</h3>

            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase mb-2 block tracking-wider">Mode</label>
              <div className="flex rounded-xl bg-secondary/50 overflow-hidden border border-border/20">
                {(["NORMAL", "PEAK", "RAIN"] as const).map((m) => (
                  <button key={m} onClick={() => handleModeChange(m)}
                    className={`flex-1 py-2.5 text-xs font-heading tracking-wider transition-all ${mode === m ? "bg-primary text-primary-foreground glow-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-muted-foreground tracking-wider">LIVE METRICS</span>
              </div>
              <div className="space-y-2">
                {[
                { label: "Density", val: congestionPct ?? 0, max: 100, color: "bg-destructive", display: congestionPct != null ? `${congestionPct}%` : "—" },
                { label: "Vehicles", val: effectiveVehicles != null ? Math.min(effectiveVehicles, 150) : 0, max: 150, color: "bg-primary", display: effectiveVehicles != null ? effectiveVehicles.toString() : "—" },
                { label: "Speed (km/h)", val: avgSpeed ?? 0, max: 60, color: "bg-success", display: avgSpeed != null ? `${avgSpeed}` : "—" },
              ].map(r => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-mono font-bold">{r.display ?? `${r.val}%`}</span>
                    </div>
                    <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div className={`h-full ${r.color} rounded-full transition-all duration-700`} style={{ width: `${(r.val / r.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center bg-secondary/30 border border-border/20 rounded-xl p-3">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">ACTIVE PHASE:</span>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${effectiveSignalPhase === "NS_GREEN" ? "bg-success/20 text-success border border-success/30" : "bg-primary/20 text-primary border border-primary/30"}`}>
                {effectiveSignalPhase ? `${effectiveSignalPhase === "NS_GREEN" ? "N/S GREEN" : "E/W GREEN"} (AI)` : "UNAVAILABLE"}
              </span>
            </div>

            <div className="pt-4 border-t border-border/20 space-y-3">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">EMERGENCY CORRIDOR</label>
              <div className="flex gap-2">
                <select value={emergencySource} onChange={(e) => setEmergencySource(e.target.value)} className="w-1/2 bg-background border border-border/20 rounded-lg text-xs p-2 text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                  <option value="SILK_BOARD">Silk Board</option>
                  <option value="HEBBAL">Hebbal</option>
                  <option value="KORAMANGALA">Koramangala</option>
                  <option value="INDIRANAGAR">Indiranagar</option>
                </select>
                <select value={emergencyDest} onChange={(e) => setEmergencyDest(e.target.value)} className="w-1/2 bg-background border border-border/20 rounded-lg text-xs p-2 text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none">
                  <option value="HEBBAL">Hebbal</option>
                  <option value="SILK_BOARD">Silk Board</option>
                  <option value="OUTER_RING">Outer Ring Road</option>
                  <option value="MAJESTIC">Majestic</option>
                </select>
              </div>

              <button onClick={handleActivateEmergency}
                className={`w-full py-3 rounded-xl font-heading text-sm font-bold flex items-center justify-center gap-2 transition-all tracking-wider ${emergency ? "bg-destructive text-destructive-foreground glow-primary animate-pulse" : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"}`}>
                <Ambulance className="w-5 h-5" />
                {emergency ? "DEACTIVATE EMERGENCY" : "ACTIVATE GREEN WAVE"}
              </button>
            </div>

            <div className="glass rounded-xl p-4 flex items-center gap-3">
              {mode === "RAIN" ? <CloudRain className="w-8 h-8 text-accent" /> : <Sun className="w-8 h-8 text-warning" />}
              <div>
                <div className="text-xs font-mono text-muted-foreground tracking-wider">CONDITION</div>
                <div className="font-heading font-semibold text-foreground text-sm">{weather.condition}{weather.temp != null ? ` / ${weather.temp}°C` : ""}</div>
                <div className="text-xs text-primary">{weather.available ? "AI adapting to live weather" : "Waiting for live weather"}</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* AI Control Hub */}
        <SmartRecommendations />

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* System Logs */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> System Logs {logs?.length ? `(${logs.length})` : ""}
              </h3>
              <span className="text-xs font-mono text-muted-foreground">{simRunning ? "Recording..." : "Start sim..."}</span>
            </div>
            <div className="bg-background/30 rounded-xl p-4 font-mono text-xs space-y-1.5 h-64 overflow-y-auto custom-scrollbar pr-2 border border-border/20">
              {logs && logs.length > 0 ? logs.map((log) => {
                const logDate = log.created_at ? new Date(log.created_at) : new Date();
                return (
                  <div key={log.id} className="flex gap-3">
                    <span className="text-muted-foreground shrink-0">[{format(logDate, "HH:mm:ss")}]</span>
                    <span className={`font-bold shrink-0 ${logTypeColors[log.log_type] || "text-foreground"}`}>{log.log_type}:</span>
                    <span className="text-foreground">{log.message}</span>
                  </div>
                );
              }) : (
                <p className="text-muted-foreground">No logs yet. Start simulation to generate real-time logs.</p>
              )}
            </div>
          </motion.div>

          {/* AI Copilot */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <Cpu className="w-4 h-4" /> AI Copilot
              </h3>
              <span className="text-xs font-mono text-muted-foreground">
                <span className={`mr-1.5 inline-block w-2 h-2 rounded-full ${connected || restStatus ? "bg-success animate-pulse-glow" : "bg-destructive"}`} />
                {connected ? "Live" : restStatus ? "REST" : "Offline"}
              </span>
            </div>
            <div className="flex-1 bg-background/30 rounded-xl flex flex-col border border-border/20 h-64 overflow-hidden">
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 text-sm font-mono">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-primary font-bold">NEXUS-AI:</span>
                    <span className="text-muted-foreground">Connecting to backend... Density: {congestionPct != null ? `${congestionPct}%` : "—"} · {effectiveVehicles != null ? effectiveVehicles : "—"} vehicles detected.</span>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <span className={`text-xs font-bold ${msg.role === "user" ? "text-foreground" : "text-primary"}`}>
                      {msg.role === "user" ? "OPERATOR" : "NEXUS-AI"}:
                    </span>
                    <span className={`text-xs leading-relaxed ${msg.role === "user" ? "text-foreground/80 text-right" : "text-muted-foreground"}`}>{msg.text}</span>
                  </div>
                ))}
                {chatLoading && <div className="text-xs text-primary animate-pulse">Analyzing traffic data...</div>}
              </div>
              <div className="border-t border-border/20 p-3">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatInput.trim() || chatLoading) return;
                  const query = chatInput.trim();
                  setChatInput("");
                  setChatMessages(prev => [...prev, { role: "user", text: query }]);
                  setChatLoading(true);
                  try {
                    const res = await fetchApi("/api/chat", {
                      method: "POST",
                      body: JSON.stringify({ query, user_id: user?.id || "anonymous", mode: "rag" }),
                    });
                    setChatMessages(prev => [...prev, { role: "ai", text: res.response || "No response from AI." }]);
                  } catch (err: any) {
                    setChatMessages(prev => [...prev, { role: "ai", text: `Error: ${err.message}. Check backend connection.` }]);
                  } finally {
                    setChatLoading(false);
                  }
                }} className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1 bg-secondary/50 border border-border/20 rounded-md px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="E.g. How to handle rain congestion?" />
                  <Button type="submit" size="sm" disabled={chatLoading} className="h-auto py-1.5 px-3 text-xs tracking-wider glow-primary">
                    {chatLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  </Button>
                </form>
              </div>
            </div>
          </motion.div>

          {/* Resource Usage */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Resources</h3>
              <span className="text-[10px] font-mono text-muted-foreground">Nodes: {network ? `${network.active_nodes}/${network.zones.length}` : "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "CPU", val: effectiveCpu, color: "text-primary" },
                { label: "Memory", val: effectiveMemory, color: "text-accent" },
                { label: "Storage", val: storage, color: "text-cyan" },
              ].map((r) => (
                <div key={r.label} className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                        className={r.color} strokeDasharray={`${Number(r.val || 0).toFixed(0)} ${100 - Number(r.val || 0)}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-foreground">{r.val != null ? `${Number(r.val).toFixed(0)}%` : "—"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{r.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/20 space-y-2">
              {[
                { label: "Incidents (24h)", value: (logs?.filter((l: any) => l.log_type === "ALERT" || l.log_type === "ERROR")?.length ?? 0).toString(), color: "text-warning" },
                { label: "Log Entries", value: logs?.length ? logs.length.toLocaleString() : "—", color: "text-success" },
                { label: "WS Clients", value: network?.websocket_clients != null ? network.websocket_clients.toString() : "—", color: "text-primary" },
              ].map(s => (
                <div key={s.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={`font-mono font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
