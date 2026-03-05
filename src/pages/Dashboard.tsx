import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, Suspense, lazy, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity, Play, Square, AlertTriangle, CheckCircle2, Cpu, HardDrive,
  CloudRain, Sun, Zap, Ambulance, RefreshCw, BarChart3
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSignalLogs, useInsertSignalLog,
  usePerformanceMetrics, useInsertPerformanceMetrics,
  useInsertTrafficData,
} from "@/hooks/useTrafficDB";
import { format } from "date-fns";

const TrafficScene3D = lazy(() => import("@/components/TrafficScene3D"));

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }) };
const scaleIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } } };

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
  INFO: "text-foreground",
  SUCCESS: "text-success",
  LEARN: "text-accent",
  WARN: "text-warning",
  DEBUG: "text-muted-foreground",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [simRunning, setSimRunning] = useState(false);
  const [mode, setMode] = useState<"NORMAL" | "PEAK" | "RAIN">("NORMAL");
  const [emergency, setEmergency] = useState(false);
  const [density, setDensity] = useState(65);
  const [localCpu, setLocalCpu] = useState(24);
  const [localMemory, setLocalMemory] = useState(72);
  const [localStorage, setLocalStorage] = useState(28);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [signalPhase, setSignalPhase] = useState("NS_GREEN");

  const wsRef = useRef<WebSocket | null>(null);

  const { data: logs } = useSignalLogs();
  const { data: metrics } = usePerformanceMetrics();
  const insertLog = useInsertSignalLog();
  const insertMetrics = useInsertPerformanceMetrics();
  const insertTraffic = useInsertTrafficData();

  const cpu = metrics?.cpu_load ?? localCpu;
  const memory = metrics?.memory_usage ?? localMemory;
  const storage = metrics?.storage_usage ?? localStorage;

  const generateLog = useCallback(() => {
    const tpl = logTemplates[Math.floor(Math.random() * logTemplates.length)];
    const msg = tpl.msg
      .replace("{id}", `A-${Math.floor(Math.random() * 9) + 1}`)
      .replace("{n}", String(Math.floor(Math.random() * 15) + 5))
      .replace("{r}", (Math.random() * 1.5).toFixed(2))
      .replace("{s}", String(Math.floor(Math.random() * 8) + 1))
      .replace("{p}", String(Math.floor(Math.random() * 30) + 10))
      .replace("{e}", (85 + Math.random() * 14).toFixed(1));

    insertLog.mutate({ agent_name: tpl.agent, action: tpl.action, message: msg, log_type: tpl.type as "INFO" | "SUCCESS" | "LEARN" });
  }, [insertLog]);

  useEffect(() => {
    if (!user) return;

    // Log the initiation of the real telemetry stream
    insertLog.mutate({ agent_name: "SensorAgent", action: "connect", message: "Established Bi-Directional WebSocket to Bangalore CityOS Feed.", log_type: "INFO" });

    // Connect to the Python Backend's live bi-directional WebSocket telemetry stream
    const ws = new WebSocket("ws://localhost:8000/ws/telemetry");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "telemetry") {
          // Stream metrics natively into the React UI components
          setLocalCpu(data.cpu_load);
          setLocalMemory(data.memory_usage);
          setDensity(data.density);
          if (data.vehicle_count !== undefined) setVehicleCount(data.vehicle_count);
          if (data.signal_phase) setSignalPhase(data.signal_phase);

          // We insert into Supabase for analytical historic charting, using pure telemetry
          const currentThroughput = data.vehicle_count > 0 ? (100 - data.density) : 100;

          insertMetrics.mutate({
            cpu_load: data.cpu_load,
            memory_usage: data.memory_usage,
            storage_usage: localStorage,
            network_latency: data.network_latency,
            active_nodes: data.active_nodes,
            ai_efficiency: parseFloat(currentThroughput.toFixed(1)),
            traditional_efficiency: 50.0, // Baseline static
          });

          // Insert density reading for historic traffic using real YOLO state
          insertTraffic.mutate({
            intersection_id: "BLR-CORE-1", // Map to the primary camera node
            north: data.ns_queue || 0,
            south: data.ns_queue || 0,
            east: data.ew_queue || 0,
            west: data.ew_queue || 0,
            weather: mode === "RAIN" ? "rain" : "clear",
            peak_hour: mode === "PEAK",
            density: data.density,
            mode,
            emergency_active: emergency,
            optimal_signal_duration: data.signal_phase === "NS_GREEN" ? 45.0 : 30.0,
          });
        }
      } catch (e) {
        console.error("Error parsing telemetry stream", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket stream error", error);
      ws.close();
    };

    return () => {
      ws.close();
      wsRef.current = null;
      insertLog.mutate({ agent_name: "SensorAgent", action: "disconnect", message: "WebSocket stream terminated.", log_type: "WARN" });
    };
  }, [user, mode, insertMetrics, insertTraffic, localStorage, insertLog]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "command",
        simRunning,
        emergency,
      }));
    }
  }, [simRunning, emergency]);

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="absolute inset-0 gradient-mesh opacity-10 pointer-events-none" />
      <div className="container mx-auto space-y-6 relative z-10">
        {/* Header */}
        <motion.div variants={fadeIn} custom={0} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">COMMAND CENTER</h1>
            <p className="text-muted-foreground text-sm">Real-time neural traffic monitoring and control</p>
            <p className="text-xs text-muted-foreground mt-1">Logged in as {user?.email ?? "operator"}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-primary" /> {Number(cpu || 0).toFixed(0)}%</span>
              <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-cyan" /> {Number(metrics?.network_latency || 12).toFixed(0)}ms</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> {Number(metrics?.uptime || 99.9).toFixed(1)}%</span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">Profile Settings</Link>
            </Button>
          </div>
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
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-sm font-mono text-muted-foreground animate-pulse">Loading 3D Scene...</div>
                </div>
              }>
                <TrafficScene3D density={density} emergency={emergency} signalPhase={signalPhase} />
              </Suspense>
              {emergency && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-destructive/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-mono text-destructive animate-pulse border border-destructive/30">
                  <Zap className="w-3 h-3" /> EMERGENCY ACTIVE
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setSimRunning(!simRunning)} size="sm"
                className={`font-heading tracking-wider text-xs ${simRunning ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30" : "bg-success/20 text-success hover:bg-success/30 border border-success/30"}`}>
                {simRunning ? <><Square className="w-3 h-3 mr-1.5" />STOP</> : <><Play className="w-3 h-3 mr-1.5" />START</>}
              </Button>
              <Button size="sm" variant="outline" className="border-border/50 text-foreground font-heading tracking-wider text-xs">
                <RefreshCw className="w-3 h-3 mr-1.5" />RESET
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
                <span className="text-muted-foreground tracking-wider">DENSITY</span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">VEHICLES: <span className="text-foreground">{vehicleCount || 0}</span></span>
                  <span className="text-primary font-bold">{Number(density || 0).toFixed(0)}%</span>
                </span>
              </div>
              <input type="range" min={10} max={95} value={density} onChange={(e) => setDensity(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>

            <div className="flex justify-between items-center bg-secondary/30 border border-border/20 rounded-xl p-3">
              <span className="text-xs font-mono text-muted-foreground tracking-wider">ACTIVE PHASE:</span>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${signalPhase === "NS_GREEN" ? "bg-success/20 text-success border border-success/30" : "bg-primary/20 text-primary border border-primary/30"}`}>
                {signalPhase === "NS_GREEN" ? "N/S GREEN" : "E/W GREEN"} (AI CONTROL)
              </span>
            </div>

            <button onClick={() => setEmergency(!emergency)}
              className={`w-full py-4 rounded-xl font-heading text-sm font-bold flex items-center justify-center gap-2 transition-all tracking-wider ${emergency ? "bg-destructive text-destructive-foreground glow-primary animate-pulse" : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                }`}>
              <Ambulance className="w-5 h-5" />
              EMERGENCY
            </button>

            <div className="glass rounded-xl p-4 flex items-center gap-3">
              {mode === "RAIN" ? <CloudRain className="w-8 h-8 text-accent" /> : <Sun className="w-8 h-8 text-warning" />}
              <div>
                <div className="text-xs font-mono text-muted-foreground tracking-wider">CONDITION</div>
                <div className="font-heading font-semibold text-foreground text-sm">{mode === "RAIN" ? "Rain / 14°C" : "Clear / 22°C"}</div>
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
              <span className="text-xs font-mono text-muted-foreground">
                {simRunning ? "Recording..." : "Start sim..."}
              </span>
            </div>
            <div className="bg-background/30 rounded-xl p-4 font-mono text-xs space-y-1.5 h-64 overflow-y-auto border border-border/20">
              {logs && logs.length > 0 ? logs.map((log) => {
                const logDate = log.created_at ? new Date(log.created_at) : new Date();
                const isValidDate = !isNaN(logDate.getTime());
                return (
                  <div key={log.id} className="flex gap-3">
                    <span className="text-muted-foreground shrink-0">
                      [{isValidDate ? format(logDate, "HH:mm:ss") : "--:--:--"}]
                    </span>
                    <span className={`font-bold shrink-0 ${logTypeColors[log.log_type] || "text-foreground"}`}>{log.log_type || "LOG"}:</span>
                    <span className="text-foreground">{log.message}</span>
                  </div>
                );
              }) : (
                <p className="text-muted-foreground">No logs yet. Start simulation to generate real-time logs.</p>
              )}
            </div>
          </motion.div>

          {/* AI Copilot (RAG Agent) */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <Cpu className="w-4 h-4" /> AI Copilot
              </h3>
              <span className="text-xs font-mono text-muted-foreground">
                <span className="text-success animate-pulse-glow mr-1.5 inline-block w-2 h-2 rounded-full bg-success"></span>
                Connected
              </span>
            </div>

            <div className="flex-1 bg-background/30 rounded-xl p-4 flex flex-col border border-border/20 h-64 relative">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 text-sm font-mono" id="chat-container">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-primary font-bold">NEXUS-AI:</span>
                  <span className="text-muted-foreground">Ready. Awaiting traffic scenario query...</span>
                </div>
                {/* Chat messages will be dynamically injected here in a moment */}
              </div>

              <div className="absolute bottom-4 left-4 right-4">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    import('@/lib/api').then(async ({ askRagAgent }) => {
                      const input = (e.target as any).query.value;
                      if (!input) return;

                      const container = document.getElementById('chat-container');
                      if (!container) return;

                      // Append User message
                      const userDiv = document.createElement('div');
                      userDiv.className = "flex flex-col gap-1 text-right";
                      userDiv.innerHTML = `<span class="text-xs text-foreground font-bold">OPERATOR:</span><span class="text-muted-foreground">${input}</span>`;
                      container.appendChild(userDiv);

                      // Append Loading
                      const loadingDiv = document.createElement('div');
                      loadingDiv.className = "text-xs text-primary animate-pulse";
                      loadingDiv.innerText = "Analyzing Vector Matrix...";
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
                        errDiv.className = "flex flex-col gap-1";
                        errDiv.innerHTML = `<span class="text-xs text-destructive font-bold">ERROR:</span><span class="text-muted-foreground">${err.message}</span>`;
                        container.appendChild(errDiv);
                      }
                      container.scrollTop = container.scrollHeight;
                    });
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="query"
                    className="flex-1 bg-secondary/50 border border-border/20 rounded-md px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="E.g. How to handle rain congestion?"
                  />
                  <Button type="submit" size="sm" className="h-auto py-1.5 px-3 text-xs tracking-wider glow-primary">ASK</Button>
                </form>
              </div>
            </div>
          </motion.div>

          {/* Resource Usage */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Resources</h3>
              {metrics && <span className="text-[10px] font-mono text-muted-foreground">Nodes: {metrics.active_nodes}</span>}
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
