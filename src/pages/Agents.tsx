import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Activity, Ambulance,
  Play, RefreshCw, MessageSquare, Send, Radio, Clock, Wind,
  Thermometer, Car, TrendingUp, Shield, Terminal,
  Loader2, WifiOff, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useLiveWeather } from "@/hooks/useLiveTelemetry";
import { useSignalLogs } from "@/hooks/useTrafficDB";
import { fetchApi } from "../lib/fetchApi";

/** Pings /api/health every 10s — independent of WebSocket state */
function useBackendOnline() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/health`, { signal: AbortSignal.timeout(3000) });
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
    };
    check();
    const t = setInterval(check, 10_000);
    return () => clearInterval(t);
  }, []);
  return online;
}

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// ── Types ────────────────────────────────────────────────────────────────────
interface SimOutput {
  junction: string;
  junction_id: string;
  simulated_at: string;
  inputs: {
    density: number; density_source: string;
    weather: string; weather_source: string;
    weather_factor: number; event: string;
    hour: number; peak_hour: boolean; emergency: boolean;
  };
  outputs: {
    adjusted_density_pct: number;
    congestion_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    congestion_color: string;
    queue_per_lane: number;
    total_queue_vehicles: number;
    avg_speed_kmph: number;
    signal_timing: { ns_green_seconds: number; ew_green_seconds: number };
    estimated_clearance_minutes: number;
    ai_recommendation: string;
  };
}

interface ChatMsg { role: "user" | "ai"; text: string; ctx?: string; time: string }

const JUNCTIONS = [
  { id: "silk-board", name: "Silk Board Junction" },
  { id: "marathahalli", name: "Marathahalli Bridge" },
  { id: "hebbal", name: "Hebbal Flyover" },
  { id: "kr-puram", name: "KR Puram Bridge" },
  { id: "ecity", name: "Electronic City Flyover" },
  { id: "outer-ring", name: "Outer Ring Road (ORR)" },
  { id: "majestic", name: "Majestic / KSR Station" },
  { id: "koramangala", name: "Koramangala 4th Block" },
  { id: "indiranagar", name: "Indiranagar 100ft Rd" },
];

const EVENTS = [
  { value: "none", label: "No Special Event" },
  { value: "cricket_match", label: "Cricket Match (Chinnaswamy)" },
  { value: "concert", label: "Concert / Music Event" },
  { value: "marathon", label: "Marathon / Road Race" },
  { value: "festival", label: "Festival / Holiday" },
  { value: "strike", label: "Bandh / Strike" },
];

const LEVEL_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  LOW:      { bg: "bg-success/10",      text: "text-success",      border: "border-success/30" },
  MEDIUM:   { bg: "bg-warning/10",      text: "text-warning",      border: "border-warning/30" },
  HIGH:     { bg: "bg-orange-500/10",   text: "text-orange-400",   border: "border-orange-500/30" },
  CRITICAL: { bg: "bg-destructive/10",  text: "text-destructive",  border: "border-destructive/30" },
};

const LOG_TYPE_STYLE: Record<string, string> = {
  INFO: "text-blue-400", SUCCESS: "text-success", WARN: "text-warning",
  ALERT: "text-destructive", ERROR: "text-destructive", LEARN: "text-accent",
  DEBUG: "text-muted-foreground",
};

// ── Queue Bar component ───────────────────────────────────────────────────────
function QueueBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = Math.round((count / Math.max(max, 1)) * 100);
  const color = pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : pct > 35 ? "#8b5cf6" : "#22c55e";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-muted-foreground font-mono">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-right font-mono" style={{ color }}>{count}</span>
    </div>
  );
}

export default function CommandCenter() {
  const { data: telemetry } = useLiveTelemetry();
  const weather = useLiveWeather();
  const { data: logs } = useSignalLogs();
  const backendOnline = useBackendOnline();

  // ── Simulation state ──────────────────────────────────────────────────────
  const [junctionId, setJunctionId] = useState("silk-board");
  const [density, setDensity] = useState<number | "">("");
  const [timeHour, setTimeHour] = useState<number | "">(new Date().getHours());
  const [weatherInput, setWeatherInput] = useState("auto");
  const [event, setEvent] = useState("none");
  const [emergency, setEmergency] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimOutput | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  // ── Emergency state ───────────────────────────────────────────────────────
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyRoute, setEmergencyRoute] = useState<string | null>(null);
  const [emergencyOrigin, setEmergencyOrigin] = useState("silk-board");
  const [emergencyDest, setEmergencyDest] = useState("hebbal");

  // ── Chat state ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "ai",
      text: "👋 I'm TrafficAI, your intelligent Bangalore traffic assistant. Ask me about congestion, signal timings, alternate routes, or emergency protocols. I'll use live data to give you real-time insights.",
      ctx: "",
      time: new Date().toLocaleTimeString()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-fill from APIs ───────────────────────────────────────────────────
  const handleAutoFill = useCallback(async () => {
    setAutoFilling(true);
    try {
      const data = await fetchApi(`/api/simulate/autofill?junction_id=${junctionId}`);
      setDensity(data.density);
      setTimeHour(data.hour);
      setWeatherInput(data.weather);
      toast.success(`Auto-filled from live APIs · ${data.density}% density · ${data.weather}`);
    } catch {
      // Use telemetry fallback
      setDensity(Math.round(telemetry.density));
      setTimeHour(new Date().getHours());
      toast.info("Using local telemetry for auto-fill (API offline)");
    } finally {
      setAutoFilling(false);
    }
  }, [junctionId, telemetry]);

  // ── Run simulation ────────────────────────────────────────────────────────
  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const body: Record<string, unknown> = {
        junction_id: junctionId,
        event,
        emergency,
      };
      if (density !== "") body.density = density;
      if (timeHour !== "") body.time_of_day = timeHour;
      if (weatherInput !== "auto") body.weather = weatherInput;

      const result = await fetchApi("/api/simulate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSimResult(result);
      toast.success(`Simulation complete · ${result.outputs.congestion_level} congestion`);
    } catch (e) {
      toast.error("Simulation failed. Check backend connection.");
    } finally {
      setSimLoading(false);
    }
  };

  // ── Emergency corridor ────────────────────────────────────────────────────
  const handleEmergencyToggle = async () => {
    if (emergencyActive) {
      setEmergencyActive(false);
      setEmergencyRoute(null);
      toast.success("Emergency override deactivated. Signals returning to normal.");
      return;
    }
    try {
      const resp = await fetchApi("/api/emergency/corridor", {
        method: "POST",
        body: JSON.stringify({
          origin_junction: emergencyOrigin,
          destination_junction: emergencyDest,
          vehicle_type: "Ambulance",
        }),
      });
      setEmergencyActive(true);
      const stops = resp.signal_overrides?.map((s: any) => s.junction_name).join(" → ") ?? "route active";
      setEmergencyRoute(stops);
      toast.success(resp.message || "Green-wave corridor activated!");
    } catch {
      setEmergencyActive(true);
      setEmergencyRoute(`${JUNCTIONS.find(j => j.id === emergencyOrigin)?.name} → ${JUNCTIONS.find(j => j.id === emergencyDest)?.name} (Offline Mode)`);
      toast.success("Emergency corridor activated (offline mode).");
    }
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages(m => [...m, { role: "user", text: userMsg, time: new Date().toLocaleTimeString() }]);
    setChatLoading(true);
    try {
      const resp = await fetchApi("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMsg, junction_id: junctionId }),
      });
      setMessages(m => [...m, {
        role: "ai",
        text: resp.response,
        ctx: resp.live_context,
        time: resp.timestamp || new Date().toLocaleTimeString(),
      }]);
    } catch {
      setMessages(m => [...m, {
        role: "ai",
        text: "⚠️ AI Assistant is offline. Backend connection lost. In offline mode: Bangalore peak hours are 7-10 AM and 5-9 PM. Silk Board is typically the most congested junction.",
        time: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────
  const displayDensity = simResult?.outputs.adjusted_density_pct ?? Math.round(telemetry.density);
  const displayLevel = simResult?.outputs.congestion_level ??
    (displayDensity >= 80 ? "CRITICAL" : displayDensity >= 60 ? "HIGH" : displayDensity >= 35 ? "MEDIUM" : "LOW");
  const levelStyle = LEVEL_STYLE[displayLevel] ?? LEVEL_STYLE.MEDIUM;
  const displayVehicles = simResult ? simResult.outputs.total_queue_vehicles : telemetry.vehicle_count;
  const displaySpeed = simResult?.outputs.avg_speed_kmph ?? Math.round(Math.max(5, 55 * (1 - telemetry.density / 100)));
  const displayNsGreen = simResult?.outputs.signal_timing.ns_green_seconds ?? 40;
  const displayEwGreen = simResult?.outputs.signal_timing.ew_green_seconds ?? 30;

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto space-y-5 max-w-[1600px]">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <motion.div variants={fade} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">Command Center</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Real-time Simulation Engine · AI Traffic Assistant · Live Operations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border ${backendOnline ? "text-success border-success/30 bg-success/10" : "text-warning border-warning/30 bg-warning/10"}`}>
              {backendOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {backendOnline ? "BACKEND LIVE" : "OFFLINE MODE"}
            </span>
            {emergencyActive && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border text-destructive border-destructive/30 bg-destructive/10"
              >
                <Ambulance className="w-3 h-3" /> EMERGENCY ACTIVE
              </motion.span>
            )}
          </div>
        </motion.div>

        {/* ── ROW 1: SIMULATION INPUT + OUTPUT ───────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Simulation Input Panel */}
          <motion.div variants={fade} initial="hidden" animate="visible" className="glass rounded-2xl p-6 space-y-4 border-border/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Activity className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground">Traffic Simulation Engine</h2>
                <p className="text-xs text-muted-foreground">Configure parameters · auto-fill from TomTom + OpenWeatherMap</p>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Location</label>
              <select value={junctionId} onChange={e => setJunctionId(e.target.value)}
                className="w-full bg-secondary/60 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50">
                {JUNCTIONS.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Density */}
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Traffic Density (%) <span className="text-primary/60">or auto</span>
                </label>
                <input type="number" min={0} max={100}
                  value={density}
                  onChange={e => setDensity(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Auto (live API)"
                  className="w-full bg-secondary/60 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                />
              </div>
              {/* Time of Day */}
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Time of Day (0-23)</label>
                <input type="number" min={0} max={23}
                  value={timeHour}
                  onChange={e => setTimeHour(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Current hour"
                  className="w-full bg-secondary/60 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Weather */}
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Weather</label>
                <select value={weatherInput} onChange={e => setWeatherInput(e.target.value)}
                  className="w-full bg-secondary/60 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50">
                  <option value="auto">Auto (OpenWeatherMap)</option>
                  <option value="clear">☀️ Clear</option>
                  <option value="clouds">⛅ Cloudy</option>
                  <option value="rain">🌧️ Rain</option>
                  <option value="thunderstorm">⛈️ Thunderstorm</option>
                  <option value="fog">🌫️ Fog</option>
                </select>
              </div>
              {/* Special Event */}
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Special Event</label>
                <select value={event} onChange={e => setEvent(e.target.value)}
                  className="w-full bg-secondary/60 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50">
                  {EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
                </select>
              </div>
            </div>

            {/* Emergency toggle */}
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${emergency ? "bg-destructive/10 border-destructive/40" : "bg-secondary/30 border-border/30"}`}>
              <div className="flex items-center gap-2">
                <Ambulance className={`w-4 h-4 ${emergency ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-sm font-mono">Emergency Vehicle Present</span>
              </div>
              <button onClick={() => setEmergency(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${emergency ? "bg-destructive" : "bg-secondary"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${emergency ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button onClick={handleAutoFill} variant="outline" disabled={autoFilling} className="flex-1 gap-2 text-xs">
                {autoFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Auto-Fill from APIs
              </Button>
              <Button onClick={handleSimulate} disabled={simLoading} className="flex-1 gap-2 text-xs glow-primary">
                {simLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Simulation
              </Button>
            </div>
          </motion.div>

          {/* Simulation Output Panel */}
          <motion.div variants={fade} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border-border/30 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                <TrendingUp className="w-4.5 h-4.5 text-accent" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground">Simulation Output</h2>
                <p className="text-xs text-muted-foreground">
                  {simResult ? `${simResult.junction} · As of ${simResult.simulated_at}` : "Run simulation to see results"}
                </p>
              </div>
            </div>

            {/* Congestion Banner */}
            <div className={`p-4 rounded-xl border ${levelStyle.bg} ${levelStyle.border} flex items-center justify-between`}>
              <div>
                <div className="text-xs font-mono text-muted-foreground uppercase mb-0.5">Predicted Congestion</div>
                <div className={`text-2xl font-heading font-bold ${levelStyle.text}`}>{displayLevel}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-muted-foreground">Density</div>
                <div className={`text-2xl font-heading font-bold ${levelStyle.text}`}>{displayDensity}%</div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Avg Speed", value: `${displaySpeed} km/h`, sub: "Current", icon: Car, color: "text-primary" },
                { label: "Est. Clearance", value: `${simResult?.outputs.estimated_clearance_minutes ?? "--"} min`, sub: "To clear queue", icon: Clock, color: "text-accent" },
                { label: "Queue (total)", value: `${displayVehicles}`, sub: "Vehicles waiting", icon: Activity, color: "text-warning" },
              ].map(m => (
                <div key={m.label} className="bg-secondary/40 rounded-xl p-3 text-center">
                  <m.icon className={`w-4 h-4 mx-auto mb-1 ${m.color}`} />
                  <div className={`text-lg font-heading font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Signal Timing */}
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Recommended Signal Timing</div>
              <div className="space-y-2">
                <QueueBar label="N-S" count={displayNsGreen} max={90} />
                <QueueBar label="E-W" count={displayEwGreen} max={90} />
              </div>
              <div className="flex justify-between text-xs font-mono text-muted-foreground mt-1">
                <span>NS: {displayNsGreen}s green</span>
                <span>EW: {displayEwGreen}s green</span>
              </div>
            </div>

            {/* Queue per lane */}
            {simResult && (
              <div>
                <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Vehicle Queue per Lane</div>
                <div className="space-y-1.5">
                  {["N", "S", "E", "W"].map((dir, i) => (
                    <QueueBar key={dir} label={dir} count={simResult.outputs.queue_per_lane}
                      max={Math.max(simResult.outputs.queue_per_lane * 2, 25)} />
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendation */}
            {simResult && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="text-xs font-mono text-primary uppercase mb-1">AI Recommendation</div>
                <p className="text-sm text-foreground">{simResult.outputs.ai_recommendation}</p>
              </div>
            )}

            {!simResult && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Brain className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Configure inputs and run simulation to see AI analysis</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── ROW 2: CONTROL PANEL + EMERGENCY ───────────────────────────── */}
        <motion.div variants={fade} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border-border/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center border border-success/20">
              <Radio className="w-4.5 h-4.5 text-success" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-foreground">Live Control Panel</h2>
              <p className="text-xs text-muted-foreground">Real-time telemetry · Emergency override · Signal control</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Live Metrics */}
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase mb-3">Live Telemetry</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Vehicle Count", value: telemetry.vehicle_count.toFixed(0), unit: "detected", color: "text-primary" },
                  { label: "Live Density", value: `${Math.round(telemetry.density)}%`, unit: "congestion", color: displayDensity > 80 ? "text-destructive" : displayDensity > 60 ? "text-warning" : "text-success" },
                  { label: "CPU Load", value: `${Math.round(telemetry.cpu_load)}%`, unit: "processing", color: "text-accent" },
                  { label: "Signal Phase", value: telemetry.signal_phase === "NS_GREEN" ? "N↕S" : "E↔W", unit: telemetry.signal_phase, color: "text-cyan" },
                  { label: "NS Queue", value: telemetry.ns_queue.toFixed(0), unit: "vehicles", color: "text-muted-foreground" },
                  { label: "EW Queue", value: telemetry.ew_queue.toFixed(0), unit: "vehicles", color: "text-muted-foreground" },
                ].map(m => (
                  <div key={m.label} className="bg-secondary/40 rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-0.5">{m.label}</div>
                    <div className={`text-xl font-heading font-bold ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{m.unit}</div>
                  </div>
                ))}
              </div>

              {/* Weather from live hook */}
              <div className="mt-3 bg-secondary/30 rounded-xl p-3 flex items-center gap-3">
                <Thermometer className="w-4 h-4 text-accent" />
                <div>
                  <div className="text-xs text-muted-foreground">Live Weather</div>
                  <div className="text-sm font-mono font-semibold text-foreground">
                    {weather?.condition ?? "clear"} · {weather?.temp ?? 29}°C
                  </div>
                </div>
                <Wind className="w-4 h-4 text-muted-foreground ml-auto" />
                <div className="text-xs text-muted-foreground">Bangalore, KA</div>
              </div>
            </div>

            {/* Emergency Mode */}
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase mb-3">Emergency Mode</div>
              <div className={`p-4 rounded-xl border mb-3 ${emergencyActive ? "bg-destructive/10 border-destructive/40" : "bg-secondary/30 border-border/30"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className={`w-4 h-4 ${emergencyActive ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className="font-mono text-sm font-semibold">
                      {emergencyActive ? "🚨 CORRIDOR ACTIVE" : "Standby"}
                    </span>
                  </div>
                  <Button onClick={handleEmergencyToggle} size="sm" variant={emergencyActive ? "destructive" : "outline"}
                    className="text-xs gap-1.5">
                    <Ambulance className="w-3.5 h-3.5" />
                    {emergencyActive ? "Deactivate" : "Activate Green-Wave"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase">Origin</label>
                    <select value={emergencyOrigin} onChange={e => setEmergencyOrigin(e.target.value)}
                      disabled={emergencyActive}
                      className="w-full mt-1 bg-secondary/40 border border-border/30 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
                      {JUNCTIONS.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase">Destination</label>
                    <select value={emergencyDest} onChange={e => setEmergencyDest(e.target.value)}
                      disabled={emergencyActive}
                      className="w-full mt-1 bg-secondary/40 border border-border/30 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none">
                      {JUNCTIONS.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                </div>

                {emergencyActive && emergencyRoute && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <div className="text-[10px] font-mono text-destructive uppercase mb-1">Active Corridor Route</div>
                      <div className="text-xs text-foreground font-mono">{emergencyRoute}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">All signals forced GREEN · 120s duration</div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Agent Status pills */}
              <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Agent Status</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "SensorAgent", ok: true },
                  { name: "DecisionAI", ok: true },
                  { name: "LearningAgent", ok: true, warn: true },
                  { name: "SignalCtrl", ok: true },
                  { name: "YOLO Vision", ok: backendOnline },
                  { name: "RAG Agent", ok: backendOnline },
                ].map(a => (
                  <span key={a.name}
                    className={`px-2 py-1 rounded-full text-[10px] font-mono border ${a.warn ? "text-warning border-warning/30 bg-warning/10" : a.ok ? "text-success border-success/30 bg-success/10" : "text-muted-foreground border-border/30"}`}>
                    {a.warn ? "●" : a.ok ? "●" : "○"} {a.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── ROW 3: AI CHATBOT + SYSTEM LOGS ───────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* AI Traffic Chatbot */}
          <motion.div variants={fade} initial="hidden" animate="visible" className="glass rounded-2xl p-5 border-border/30 flex flex-col" style={{ height: "520px" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                <MessageSquare className="w-4.5 h-4.5 text-accent" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground">AI Traffic Assistant</h2>
                <p className="text-xs text-muted-foreground">RAG-powered · Live data context · Bangalore traffic expert</p>
              </div>
              <span className={`ml-auto flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${backendOnline ? "text-success border-success/30 bg-success/5" : "text-warning border-warning/30 bg-warning/5"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-success animate-pulse" : "bg-warning"}`} />
                {backendOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 scrollbar-thin">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary/20 border border-primary/30 text-foreground"
                      : "bg-secondary/50 border border-border/20 text-foreground"
                  }`}>
                    {msg.role === "ai" && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain className="w-3 h-3 text-accent" />
                        <span className="text-[10px] font-mono text-accent">TrafficAI</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{msg.time}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    {msg.ctx && (
                      <div className="mt-2 text-[10px] font-mono text-muted-foreground border-t border-border/20 pt-1">
                        📡 {msg.ctx}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/50 border border-border/20 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                    <span className="text-xs text-muted-foreground font-mono">Analysing live traffic data...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {["Current congestion?", "Best alternate route?", "Signal timing now?", "Why is traffic high?"].map(q => (
                <button key={q} onClick={() => { setChatInput(q); }}
                  className="shrink-0 px-3 py-1 text-[11px] font-mono bg-secondary/50 border border-border/30 rounded-full text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors whitespace-nowrap">
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about traffic, signals, or routes..."
                className="flex-1 bg-secondary/50 border border-border/30 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
              />
              <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} size="sm" className="px-3">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* System Logs */}
          <motion.div variants={fade} initial="hidden" animate="visible" className="glass rounded-2xl p-5 border-border/30 flex flex-col" style={{ height: "520px" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center border border-warning/20">
                <Terminal className="w-4.5 h-4.5 text-warning" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground">System Logs</h2>
                <p className="text-xs text-muted-foreground">Live audit trail · AI decisions · Traffic events</p>
              </div>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                {logs ? `${logs.length} events` : "Loading..."}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs pr-1 scrollbar-thin">
              {logs && logs.length > 0 ? (
                logs.map((log: any, i: number) => (
                  <motion.div key={log.id || i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex gap-2 p-2 rounded-lg bg-secondary/20 border border-border/10 hover:bg-secondary/40 transition-colors cursor-default">
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                      LOG_TYPE_STYLE[log.log_type] || "text-muted-foreground"
                    } bg-current/10 border-current/20`} style={{ borderColor: "currentColor", backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
                      {log.log_type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{log.agent_name}</span>
                        <span className="text-muted-foreground text-[10px] shrink-0">
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-[11px]">{log.message}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Terminal className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Waiting for system events...</p>
                  <p className="text-[10px] mt-1">Logs update in real-time via Supabase</p>
                </div>
              )}
            </div>

            {/* Log stats footer */}
            <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-4 gap-2">
              {[
                { label: "INFO", key: "INFO", color: "text-blue-400" },
                { label: "SUCCESS", key: "SUCCESS", color: "text-success" },
                { label: "WARN", key: "WARN", color: "text-warning" },
                { label: "ALERT", key: "ALERT", color: "text-destructive" },
              ].map(({ label, key, color }) => (
                <div key={key} className="text-center">
                  <div className={`text-lg font-heading font-bold ${color}`}>
                    {logs?.filter((l: any) => l.log_type === key).length ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
