import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, AlertTriangle, Zap, TrendingUp, RefreshCw, Car, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/fetchApi";


const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

interface TrafficZone {
    id: string;
    name: string;
    area: string;
    peak_hours: string;
    lat: number;
    lon: number;
    congestion_pct: number | null;
    vehicle_estimate: number | null;
    level: "Low" | "Medium" | "High" | "Critical" | "Unavailable";
    current_speed_kmph: number | null;
    free_flow_speed_kmph: number | null;
    recommendations: string[];
    data_source: string;
    available?: boolean;
}

const levelConfig = {
  Low: { color: "text-success", bg: "bg-success/10 border-success/20", dot: "bg-success", bar: "bg-success" },
  Medium: { color: "text-accent", bg: "bg-accent/10 border-accent/20", dot: "bg-accent", bar: "bg-accent" },
  High: { color: "text-warning", bg: "bg-warning/10 border-warning/20", dot: "bg-warning", bar: "bg-warning" },
  Critical: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", dot: "bg-destructive animate-pulse", bar: "bg-destructive" },
  Unavailable: { color: "text-muted-foreground", bg: "bg-secondary/10 border-border/20", dot: "bg-muted-foreground", bar: "bg-secondary" },
};

export default function BangaloreTraffic() {
    const [zones, setZones] = useState<TrafficZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<TrafficZone | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    const fetchZones = async () => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchApi("/api/bangalore/traffic");
            setZones(json.zones ?? []);
            setLastUpdated(new Date().toLocaleTimeString());
            if (json.zones?.length > 0 && !selected) setSelected(json.zones[0]);
        } catch (e: any) {
            setError("Live Bangalore traffic flow is unavailable right now.");
            setZones([]);
            setLastUpdated("");
            setSelected(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
        const timer = setInterval(fetchZones, 60000);
        return () => clearInterval(timer);
    }, []);

    const critical = zones.filter(z => z.level === "Critical").length;
    const highCongestion = zones.filter(z => z.level === "High").length;
    const liveZones = zones.filter((zone) => zone.available);
    const avgSpeed = liveZones.length > 0 ? Math.round(liveZones.reduce((s, z) => s + (z.current_speed_kmph || 0), 0) / liveZones.length) : 0;
    const totalVehicles = liveZones.reduce((s, z) => s + (z.vehicle_estimate || 0), 0);

    return (
        <div className="min-h-screen pt-20 pb-8 px-4">
            <div className="container mx-auto space-y-6">
                {/* Header */}
                <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold tracking-wide">BANGALORE TRAFFIC ZONES</h1>
                        <p className="text-muted-foreground text-sm">Peak congestion monitoring for major junctions — powered by TomTom Flow API</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastUpdated && <span className="text-xs font-mono text-muted-foreground">Updated: {lastUpdated}</span>}
                        <Button variant="outline" size="sm" onClick={fetchZones} disabled={loading} className="border-border/50 font-heading tracking-wider text-xs gap-1.5">
                            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
                        </Button>
                    </div>
                </motion.div>

                {error && (
                    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 text-warning text-xs font-mono flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </motion.div>
                )}

                {/* KPI Row */}
                <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Critical Zones", value: critical.toString(), icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
                        { label: "High Congestion", value: highCongestion.toString(), icon: TrendingUp, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
                        { label: "Avg Speed (km/h)", value: loading ? "—" : avgSpeed.toString(), icon: Gauge, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
                        { label: "Est. Total Vehicles", value: loading ? "—" : totalVehicles.toLocaleString(), icon: Car, color: "text-success", bg: "bg-success/10 border-success/20" },
                    ].map((s) => (
                        <div key={s.label} className={`glass rounded-2xl p-5 border ${s.bg}`}>
                            <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
                            <div className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs font-mono text-muted-foreground tracking-wider mt-1">{s.label}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Main Content */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Zone List */}
                    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-2 lg:col-span-1">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="glass rounded-xl p-4 animate-pulse h-16 border border-border/20" />
                            ))
                        ) : (
                            zones.map((zone) => {
                                const cfg = levelConfig[zone.level];
                                return (
                                    <button key={zone.id} onClick={() => setSelected(zone)}
                                        className={`w-full glass rounded-xl p-4 flex items-center gap-3 text-left transition-all border hover:border-primary/40 ${selected?.id === zone.id ? "border-primary glow-primary" : "border-border/20"}`}>
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-mono text-sm font-semibold text-foreground truncate">{zone.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{zone.area}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold font-mono ${cfg.color}`}>{zone.congestion_pct == null ? "—" : `${zone.congestion_pct}%`}</div>
                                            <div className="text-xs text-muted-foreground">{zone.level}</div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </motion.div>

                    {/* Zone Detail */}
                    {selected && (
                        <motion.div key={selected.id} variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-6 border border-border/20 space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-heading font-bold text-foreground">{selected.name}</h2>
                                    <p className="text-sm text-muted-foreground">{selected.area}</p>
                                    <p className="text-xs font-mono text-muted-foreground mt-1">
                                        <MapPin className="inline w-3 h-3 mr-1" />{selected.lat.toFixed(4)}, {selected.lon.toFixed(4)} · Peak: {selected.peak_hours}
                                    </p>
                                </div>
                                <span className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${levelConfig[selected.level].bg} ${levelConfig[selected.level].color} shrink-0`}>
                                    {selected.level}
                                </span>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: "Congestion", value: selected.congestion_pct == null ? "—" : `${selected.congestion_pct}%`, color: levelConfig[selected.level].color },
                                    { label: "Current Speed", value: selected.current_speed_kmph == null ? "—" : `${selected.current_speed_kmph} km/h`, color: "text-foreground" },
                                    { label: "Est. Vehicles", value: selected.vehicle_estimate == null ? "—" : selected.vehicle_estimate.toString(), color: "text-foreground" },
                                ].map((m) => (
                                    <div key={m.label} className="bg-secondary/50 rounded-xl p-4 text-center border border-border/20">
                                    <div className={`text-2xl font-heading font-bold ${m.color}`}>{m.value}</div>
                                    <div className="text-xs font-mono text-muted-foreground mt-1">{m.label}</div>
                                </div>
                            ))}
                        </div>

                            {/* Congestion Bar */}
                            <div>
                                <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
                                    <span>CONGESTION INDEX</span>
                                    <span>{selected.congestion_pct == null ? "—" : `${selected.congestion_pct}%`} / Free-Flow: {selected.free_flow_speed_kmph ?? "—"} km/h</span>
                                </div>
                                <div className="w-full h-3 bg-secondary/50 rounded-full overflow-hidden border border-border/20">
                                    <div className={`h-full rounded-full transition-all duration-700 ${levelConfig[selected.level].bar}`}
                                        style={{ width: `${selected.congestion_pct ?? 0}%` }} />
                                </div>
                            </div>

                            {/* Recommendations */}
                            <div>
                                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-primary" /> AI TRAFFIC CONTROL RECOMMENDATIONS
                                </h3>
                                <div className="space-y-2">
                                    {selected.recommendations.map((rec, i) => (
                                        <div key={i} className="flex items-start gap-2 bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-sm">
                                            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                            <span className="text-foreground/90">{rec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="text-xs font-mono text-muted-foreground border-t border-border/30 pt-3">
                                Data Source: <span className="text-primary">{selected.data_source}</span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
