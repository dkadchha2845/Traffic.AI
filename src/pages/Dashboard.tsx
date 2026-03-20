import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, Play, Square, AlertTriangle, CheckCircle2, Cpu, HardDrive,
  CloudRain, Sun, Zap, Ambulance, RefreshCw, BarChart3, Wind, Droplets, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSignalLogs, useInsertPerformanceMetrics, useInsertTrafficData } from "@/hooks/useTrafficDB";
import { useLiveTelemetry, useLiveWeather } from "@/hooks/useLiveTelemetry";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchApi } from "../lib/fetchApi";

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }) };

const agents = [
  { name: "SensorAgent", status: "Active", color: "bg-success" },
  { name: "DecisionAgent", status: "Active", color: "bg-success" },
  { name: "LearningAgent", status: "Training...", color: "bg-accent" },
  { name: "SignalControlAgent", status: "Active", color: "bg-success" },
  { name: "ComparisonAgent", status: "Idle", color: "bg-warning" },
  { name: "AnalyticsAgent", status: "Active", color: "bg-success" },
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

  const { data: telemetry, connected } = useLiveTelemetry();
  const weather = useLiveWeather();

  const density = telemetry.density;
  const vehicleCount = telemetry.vehicle_count;
  const signalPhase = telemetry.signal_phase;
  const cpu = telemetry.cpu_load;
  const memory = telemetry.memory_usage;
  const latency = telemetry.network_latency;

  const wsRef = useRef<WebSocket | null>(null);
  const { data: logs } = useSignalLogs();
  const { mutate: insertMetrics } = useInsertPerformanceMetrics();
  const { mutate: insertTraffic } = useInsertTrafficData();

  // Real-time junction decision state
  const [junctionId, setJunctionId] = useState("silk-board");
  const [junctionData, setJunctionData] = useState<any>(null);
  const [loadingJunction, setLoadingJunction] = useState(false);

  // Fetch real junction data from backend simulation engine
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
    try {
      const resp = await fetchApi("/api/emergency/corridor", {
        method: "POST",
        body: JSON.stringify({ origin_junction: emergencySource.toLowerCase().replace("_", "-"), destination_junction: emergencyDest.toLowerCase().replace("_", "-"), vehicle_type: "Ambulance" })
      });
      setEmergency(true);
      setEmergencyRoute(`Path: ${resp.signal_overrides.map((s: any) => s.junction_name).join(" ➞ ")}`);
      toast.success(resp.message);
    } catch {
      toast.error("Backend unavailable — cannot activate green-wave. Check backend connection.");
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
              <span className={`flex items-center gap-1 text-xs font-mono ${connected ? "text-success" : "text-destructive"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-destructive"}`} />
                {connected ? "LIVE BACKEND" : "OFFLINE — NO DATA"}
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

            {connected ? (
              <div className="space-y-3">
                {/* Live telemetry at a glance */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Vehicle Count", value: telemetry.vehicle_count, unit: "veh", color: "text-primary" },
                    { label: "Congestion", value: `${Math.round(telemetry.density)}%`, unit: "", color: telemetry.density > 70 ? "text-destructive" : "text-success" },
                    { label: "Avg Speed", value: Math.max(5, Math.round(55 * (1 - telemetry.density / 100))), unit: "km/h", color: "text-accent" },
                    { label: "Signal Phase", value: telemetry.signal_phase === "NS_GREEN" ? "N/S" : "E/W", unit: "green", color: "text-success" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-secondary/50 rounded-xl p-3 border border-border/20">
                      <div className="text-xs text-muted-foreground font-mono tracking-wider">{stat.label}</div>
                      <div className={`text-xl font-heading font-bold mt-1 ${stat.color}`}>
                        {stat.value} <span className="text-xs font-normal text-muted-foreground">{stat.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Junction analysis from backend */}
                {junctionData ? (
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/20 space-y-2">
                    <div className="text-xs font-mono text-muted-foreground tracking-wider">BACKEND ANALYSIS · {junctionId.toUpperCase()}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div><span className="text-muted-foreground">Hour:</span> <span className="text-foreground">{junctionData.hour}:00</span></div>
                      <div><span className="text-muted-foreground">Peak:</span> <span className={junctionData.peak_hour ? "text-destructive" : "text-success"}>{junctionData.peak_hour ? "YES" : "NO"}</span></div>
                      <div><span className="text-muted-foreground">Weather:</span> <span className="text-foreground">{junctionData.weather_condition ?? "--"}</span></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Last synced from <code className="text-primary">/api/simulate/autofill</code></div>
                  </div>
                ) : (
                  <div className="bg-secondary/20 rounded-xl p-4 border border-border/20 text-center">
                    <span className="text-xs text-muted-foreground">{loadingJunction ? "Fetching junction data..." : "Junction data temporarily unavailable"}</span>
                  </div>
                )}

                {/* Queue bars */}
                <div className="space-y-2">
                  {[
                    { label: "N/S Queue", value: telemetry.ns_queue, max: Math.max(telemetry.ns_queue, telemetry.ew_queue, 1) },
                    { label: "E/W Queue", value: telemetry.ew_queue, max: Math.max(telemetry.ns_queue, telemetry.ew_queue, 1) },
                  ].map(q => (
                    <div key={q.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-muted-foreground">{q.label}</span>
                        <span className="text-foreground">{q.value} veh</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (q.value / (q.max || 1)) * 100)}%` }} />
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
                <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">No live data — backend WebSocket unavailable.<br/>Start the backend: <code className="text-primary">py main.py</code></p>
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
