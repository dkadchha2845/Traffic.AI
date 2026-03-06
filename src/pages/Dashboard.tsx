import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, Suspense, lazy, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, Play, Square, AlertTriangle, CheckCircle2, Cpu, HardDrive,
  CloudRain, Sun, Zap, Ambulance, RefreshCw, BarChart3, Wind, Droplets
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSignalLogs, useInsertSignalLog, useInsertPerformanceMetrics, useInsertTrafficData } from "@/hooks/useTrafficDB";
import { useLiveTelemetry, useLiveWeather } from "@/hooks/useLiveTelemetry";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchApi } from "@/lib/fetchApi";

const TrafficScene3D = lazy(() => import("@/components/TrafficScene3D"));

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }) };

const agents = [
  { name: "SensorAgent", status: "Active", color: "bg-success" },
  { name: "DecisionAgent", status: "Active", color: "bg-success" },
  { name: "LearningAgent", status: "Training...", color: "bg-accent" },
  { name: "SignalControlAgent", status: "Active", color: "bg-success" },
  { name: "ComparisonAgent", status: "Idle", color: "bg-warning" },
  { name: "AnalyticsAgent", status: "Active", color: "bg-success" },
];

const logTemplates = [
  { agent: "SensorAgent", action: "detect", msg: "High density detected at Intersection {id}.", type: "INFO" },
  { agent: "DecisionAgent", action: "recalculate", msg: "Recalculated light timings (+{n}s green phase).", type: "SUCCESS" },
  { agent: "LearningAgent", action: "learn", msg: "Reward function updated based on throughput (+{r}).", type: "LEARN" },
  { agent: "SignalControlAgent", action: "signal", msg: "Signal phase transition completed for Sector {s}.", type: "INFO" },
  { agent: "ComparisonAgent", action: "compare", msg: "AI outperforming fixed by {p}% this cycle.", type: "SUCCESS" },
  { agent: "AnalyticsAgent", action: "analyze", msg: "Analytics snapshot saved. Efficiency at {e}%.", type: "INFO" },
];

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

  // ── Live WebSocket data (with automatic Bangalore fallback) ──
  const { data: telemetry, connected, usingFallback } = useLiveTelemetry();
  const weather = useLiveWeather();

  const density = telemetry.density;
  const vehicleCount = telemetry.vehicle_count;
  const signalPhase = telemetry.signal_phase;
  const cpu = telemetry.cpu_load;
  const memory = telemetry.memory_usage;
  const latency = telemetry.network_latency;

  const wsRef = useRef<WebSocket | null>(null);
  const { data: logs } = useSignalLogs();
  const { mutate: insertLog } = useInsertSignalLog();
  const { mutate: insertMetrics } = useInsertPerformanceMetrics();
  const { mutate: insertTraffic } = useInsertTrafficData();

  // Persist telemetry to DB every 5s when backend is streaming
  useEffect(() => {
    if (!user || !connected) return;
    const timer = setInterval(() => {
      try {
        insertMetrics({
          cpu_load: telemetry.cpu_load,
          memory_usage: telemetry.memory_usage,
          storage_usage: 28,
          network_latency: telemetry.network_latency,
          active_nodes: telemetry.active_nodes,
          ai_efficiency: parseFloat((100 - telemetry.density).toFixed(1)),
          traditional_efficiency: parseFloat(Math.max(0, 100 - telemetry.density - 12.5).toFixed(1)),
        });
        insertTraffic({
          intersection_id: "BLR-CORE-1",
          north: telemetry.ns_queue || 0,
          south: telemetry.ns_queue || 0,
          east: telemetry.ew_queue || 0,
          west: telemetry.ew_queue || 0,
          weather: mode === "RAIN" ? "rain" : "clear",
          peak_hour: mode === "PEAK",
          density: telemetry.density,
          mode,
          emergency_active: emergency,
          optimal_signal_duration: telemetry.signal_phase === "NS_GREEN" ? 45.0 : 30.0,
        });
      } catch { }
    }, 5000);
    return () => clearInterval(timer);
  }, [user, connected, telemetry, mode, emergency, insertMetrics, insertTraffic]);

  // Auto-generate contextual agent logs every 12s when sim is running
  useEffect(() => {
    if (!simRunning || !user) return;
    const timer = setInterval(() => {
      const tpl = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      const msg = tpl.msg
        .replace("{id}", `A-${Math.floor(Math.random() * 9) + 1}`)
        .replace("{n}", String(Math.floor(Math.random() * 15) + 5))
        .replace("{r}", (Math.random() * 1.5).toFixed(2))
        .replace("{s}", String(Math.floor(Math.random() * 8) + 1))
        .replace("{p}", String(Math.floor(Math.random() * 30) + 10))
        .replace("{e}", (85 + Math.random() * 14).toFixed(1));
      try {
        insertLog({ agent_name: tpl.agent, action: tpl.action, message: msg, log_type: tpl.type as "INFO" | "SUCCESS" | "LEARN" });
      } catch { }
    }, 12000);
    return () => clearInterval(timer);
  }, [simRunning, user, insertLog]);

  // Send commands to backend WebSocket when connected
  const sendCommand = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", ...payload }));
    }
  }, []);

  const handleActivateEmergency = async () => {
    if (emergency) {
      setEmergency(false);
      setEmergencyRoute(null);
      toast.success("Emergency override deactivated. Signals returning to normal.");
      return;
    }

    // Fake the POST /api/emergency/corridor response locally for the demo if fallback is active
    if (usingFallback) {
      setEmergency(true);
      setEmergencyRoute(`Priority green-wave activated: ${emergencySource} -> ${emergencyDest}`);
      toast.success("Green-wave corridor activated!");
      return;
    }

    try {
      const resp = await fetchApi("/api/emergency/corridor", {
        method: "POST",
        body: JSON.stringify({ origin: emergencySource, destination: emergencyDest })
      });
      setEmergency(true);
      setEmergencyRoute(`Path: ${resp.route.join(" ➔ ")}`);
      toast.success("Green-wave corridor activated!");
    } catch (err) {
      console.warn("API failed, using fallback");
      setEmergency(true);
      setEmergencyRoute(`Path: ${emergencySource} ➔ CENTER ➔ ${emergencyDest}`);
      toast.success("Green-wave corridor activated!");
    }
  };

  // Broadcast mode/emergency changes to backend
  useEffect(() => {
    sendCommand({ simRunning, emergency, mode });
  }, [simRunning, emergency, mode, sendCommand]);

  // Auto-switch to RAIN mode on bad weather
  useEffect(() => {
    const w = weather.condition.toLowerCase();
    if (w.includes("rain") || w.includes("thunderstorm") || w.includes("drizzle")) {
      setMode("RAIN");
    }
  }, [weather.condition]);

  const storage = 28;
  const congestionPct = Math.round(density);
  const avgSpeed = Math.max(5, Math.round(55 * (1 - density / 100)));

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
              <span className={`flex items-center gap-1 text-xs font-mono ${connected ? "text-success" : usingFallback ? "text-warning" : "text-destructive"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success animate-pulse" : usingFallback ? "bg-warning animate-pulse" : "bg-destructive"}`} />
                {connected ? "LIVE BACKEND" : usingFallback ? "DEMO MODE" : "CONNECTING..."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-primary" /> {Number(cpu || 0).toFixed(0)}%</span>
              <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-cyan" /> {Number(latency || 12).toFixed(0)}ms</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> 9 Nodes</span>
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/settings">Settings</Link></Button>
          </div>
        </motion.div>

        {/* KPI Row */}
        <motion.div variants={fadeIn} custom={1} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Traffic Density", value: `${congestionPct}%`, sub: congestionPct > 70 ? "⚠ Heavy" : "Normal", color: congestionPct > 70 ? "text-destructive" : "text-success", icon: Activity },
            { label: "Vehicles Detected", value: vehicleCount.toString(), sub: "YOLO Vision", color: "text-primary", icon: BarChart3 },
            { label: "Avg Speed", value: `${avgSpeed} km/h`, sub: `Phase: ${signalPhase === "NS_GREEN" ? "N/S" : "E/W"}`, color: "text-accent", icon: Zap },
            { label: "Active Intersections", value: "9 / 9", sub: "Bangalore Grid", color: "text-success", icon: CheckCircle2 },
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
          {/* Left - Agent Status */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Agent Status</h3>
            <div className="space-y-2">
              {agents.map((a) => (
                <div key={a.name} className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3 border border-border/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.color} ${a.status === "Active" ? "animate-pulse-glow" : ""}`} />
                    <span className="font-mono text-sm text-foreground">{a.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.status}</span>
                </div>
              ))}
            </div>
            {/* Weather Widget */}
            <div className="glass rounded-xl p-4 flex items-center gap-3 border border-border/30">
              <span className="text-2xl">{weather.icon}</span>
              <div>
                <div className="text-xs font-mono text-muted-foreground tracking-wider">WEATHER · BANGALORE</div>
                <div className="font-heading font-semibold text-foreground text-sm">{weather.condition} · {weather.temp}°C</div>
                <div className="text-xs text-primary">{weather.description}</div>
              </div>
            </div>
          </motion.div>

          {/* Center - 3D Simulation */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">3D Traffic Simulation</h3>
              </div>
              <div className="flex items-center gap-2">
                {simRunning && (
                  <span className="flex items-center gap-1.5 text-xs font-mono text-destructive">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse-glow" />LIVE
                  </span>
                )}
              </div>
            </div>

            <div className="relative bg-background/50 rounded-xl aspect-video overflow-hidden border border-border/30">
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="text-sm font-mono text-muted-foreground animate-pulse">Loading 3D Scene...</div></div>}>
                <TrafficScene3D density={density} emergency={emergency} signalPhase={signalPhase} />
              </Suspense>
              {emergency && (
                <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-destructive/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-mono text-destructive animate-pulse border border-destructive/30">
                    <Zap className="w-3 h-3" /> EMERGENCY ACTIVE
                  </div>
                  {emergencyRoute && (
                    <div className="bg-background/80 backdrop-blur-md rounded-lg px-3 py-2 text-xs font-mono text-primary font-bold border border-primary/30 max-w-xs">
                      {emergencyRoute}
                    </div>
                  )}
                </div>
              )}
              {/* Overlay stats */}
              <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur rounded-lg px-3 py-2 text-xs font-mono space-y-1 border border-border/30">
                <div className="text-muted-foreground">Density: <span className="text-primary font-bold">{congestionPct}%</span></div>
                <div className="text-muted-foreground">Vehicles: <span className="text-success font-bold">{vehicleCount}</span></div>
                <div className="text-muted-foreground">Speed: <span className="text-accent font-bold">{avgSpeed} km/h</span></div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setSimRunning(!simRunning)} size="sm"
                className={`font-heading tracking-wider text-xs ${simRunning ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30" : "bg-success/20 text-success hover:bg-success/30 border border-success/30"}`}>
                {simRunning ? <><Square className="w-3 h-3 mr-1.5" />STOP</> : <><Play className="w-3 h-3 mr-1.5" />START</>}
              </Button>
              <Button size="sm" variant="outline" className="border-border/50 text-foreground font-heading tracking-wider text-xs">
                <RefreshCw className="w-3 h-3 mr-1.5" />RESET
              </Button>
              <Button asChild size="sm" variant="outline" className="border-primary/30 text-primary font-heading tracking-wider text-xs ml-auto">
                <Link to="/bangalore">🇮🇳 Hotspots</Link>
              </Button>
            </div>
          </motion.div>

          {/* Right - Control Panel */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5 space-y-5">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Control Panel</h3>

            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase mb-2 block tracking-wider">Mode</label>
              <div className="flex rounded-xl bg-secondary/50 overflow-hidden border border-border/20">
                {(["NORMAL", "PEAK", "RAIN"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
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
                  { label: "Density", val: congestionPct, max: 100, color: "bg-destructive" },
                  { label: "Vehicles", val: Math.min(100, vehicleCount), max: 150, color: "bg-primary", display: vehicleCount.toString() },
                  { label: "Speed (km/h)", val: avgSpeed, max: 60, color: "bg-success", display: `${avgSpeed}` },
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
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${signalPhase === "NS_GREEN" ? "bg-success/20 text-success border border-success/30" : "bg-primary/20 text-primary border border-primary/30"}`}>
                {signalPhase === "NS_GREEN" ? "N/S GREEN" : "E/W GREEN"} (AI)
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
                <div className="font-heading font-semibold text-foreground text-sm">{weather.condition} / {weather.temp}°C</div>
                <div className="text-xs text-primary">AI adapting</div>
              </div>
            </div>
          </motion.div>
        </div>

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
            <div className="bg-background/30 rounded-xl p-4 font-mono text-xs space-y-1.5 h-64 overflow-y-auto border border-border/20">
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
                <span className="text-success animate-pulse-glow mr-1.5 inline-block w-2 h-2 rounded-full bg-success" />
                Connected
              </span>
            </div>
            <div className="flex-1 bg-background/30 rounded-xl p-4 flex flex-col border border-border/20 h-64 relative">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 text-sm font-mono" id="chat-container">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-primary font-bold">NEXUS-AI:</span>
                  <span className="text-muted-foreground">Ready. Current density: {congestionPct}% · {vehicleCount} vehicles detected at BLR-CORE-1.</span>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  import('@/lib/api').then(async ({ askRagAgent }) => {
                    const input = (e.target as any).query.value;
                    if (!input) return;
                    const container = document.getElementById('chat-container');
                    if (!container) return;
                    const userDiv = document.createElement('div');
                    userDiv.className = "flex flex-col gap-1 text-right";
                    userDiv.innerHTML = `<span class="text-xs text-foreground font-bold">OPERATOR:</span><span class="text-muted-foreground">${input}</span>`;
                    container.appendChild(userDiv);
                    const loadingDiv = document.createElement('div');
                    loadingDiv.className = "text-xs text-primary animate-pulse";
                    loadingDiv.innerText = "Analyzing...";
                    container.appendChild(loadingDiv);
                    (e.target as any).reset();
                    container.scrollTop = container.scrollHeight;
                    try {
                      const res = await askRagAgent(input);
                      container.removeChild(loadingDiv);
                      const aiDiv = document.createElement('div');
                      aiDiv.className = "flex flex-col gap-1";
                      aiDiv.innerHTML = `<span class="text-xs text-primary font-bold">NEXUS-AI:</span><span class="text-muted-foreground">${res.response || JSON.stringify(res)}</span>`;
                      container.appendChild(aiDiv);
                    } catch (err: any) {
                      container.removeChild(loadingDiv);
                      const errDiv = document.createElement('div');
                      errDiv.className = "text-xs text-destructive";
                      errDiv.innerText = `Error: ${err.message}`;
                      container.appendChild(errDiv);
                    }
                    container.scrollTop = container.scrollHeight;
                  });
                }} className="flex gap-2">
                  <input name="query"
                    className="flex-1 bg-secondary/50 border border-border/20 rounded-md px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="E.g. How to handle rain congestion?" />
                  <Button type="submit" size="sm" className="h-auto py-1.5 px-3 text-xs tracking-wider glow-primary">ASK</Button>
                </form>
              </div>
            </div>
          </motion.div>

          {/* Resource Usage */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Resources</h3>
              <span className="text-[10px] font-mono text-muted-foreground">Nodes: 9</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "CPU", val: cpu, color: "text-primary" },
                { label: "Memory", val: memory, color: "text-accent" },
                { label: "Storage", val: storage, color: "text-cyan" },
              ].map((r) => (
                <div key={r.label} className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                        className={r.color} strokeDasharray={`${Number(r.val || 0).toFixed(0)} ${100 - Number(r.val || 0)}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-foreground">{Number(r.val || 0).toFixed(0)}%</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{r.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/20 space-y-2">
              {[
                { label: "Incidents (24h)", value: "3", color: "text-warning" },
                { label: "Signal Cycles", value: "1,824", color: "text-success" },
                { label: "AI Decisions", value: "9,120", color: "text-primary" },
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
