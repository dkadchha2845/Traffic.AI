import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Clock, TrendingUp, AlertTriangle, ShieldAlert } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { fetchApi } from "../lib/fetchApi";

// Helper to add minutes to time string "HH:MM"
function addMinutesAndFormat(date: Date, minutes: number) {
    const d = new Date(date.getTime() + minutes * 60000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function TrafficPrediction() {
    const { data: telemetry } = useLiveTelemetry();
    const [predictionData, setPredictionData] = useState<any[]>([]);
    const [hotspots, setHotspots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPredictions = async () => {
            setLoading(true);
            try {
                const resp = await fetchApi(`/api/predict?current_congestion=${telemetry?.density || 60}&horizon_minutes=30`);
                const forecast = [
                    { time: "Now", density: resp.current_congestion_pct, predicted: false },
                    ...resp["5min_intervals"].map((f: any) => ({
                        time: f.time,
                        density: f.congestion_pct,
                        predicted: true
                    }))
                ];
                setPredictionData(forecast);
                setHotspots(resp.junction_forecasts || []);
                setLoading(false);
            } catch {
                // API unavailable — show empty state, never fake data
                setPredictionData([]);
                setLoading(false);
            }
        };
        const t = setTimeout(fetchPredictions, 800);
        return () => clearTimeout(t);
    }, [telemetry?.density]);

    const isPeakSoon = predictionData.length > 0 && predictionData[predictionData.length - 1].density > 80;

    return (
        <div className="min-h-screen pt-20 pb-8 px-4">
            <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />

            <div className="container mx-auto space-y-6 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold tracking-wide">TRAFFIC PREDICTION</h1>
                        <p className="text-muted-foreground text-sm">30-Minute Deep Learning Forecast (AutoARIMA/Transformer)</p>
                    </div>
                </div>

                {isPeakSoon && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-destructive/20 border border-destructive/50 rounded-xl p-4 flex items-start gap-4 backdrop-blur-sm">
                        <ShieldAlert className="w-8 h-8 text-destructive shrink-0 mt-1 animate-pulse" />
                        <div>
                            <h3 className="font-heading font-bold text-destructive text-lg">PEAK CONGESTION INBOUND</h3>
                            <p className="text-sm font-mono text-destructive/80 mt-1">
                                Forecasting model predicts network density to exceed 80% within the next 30 minutes.
                                Recommending early activation of dynamic pricing lanes and green-wave on major arterial routes.
                            </p>
                        </div>
                    </motion.div>
                )}

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Chart */}
                    <div className="lg:col-span-2 glass rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground">30-Minute Network Forecast</h3>
                        </div>

                        <div className="h-[400px] w-full">
                            {loading ? (
                                <div className="w-full h-full flex items-center justify-center font-mono text-muted-foreground animate-pulse">
                                    Simulating Future Timesteps...
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={predictionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="time" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                                        <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} domain={[0, 100]} />
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                                            labelStyle={{ color: '#e4e4e7', fontWeight: 'bold' }}
                                            formatter={(val: number) => [`${val.toFixed(1)}%`, 'Density']}
                                        />
                                        <Area type="monotone" dataKey="density" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorDensity)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Regional Breakdowns */}
                    <div className="space-y-4">
                        <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground ml-2">Hotspot Forecasting</h3>

                        {hotspots.length > 0 ? hotspots.slice(0, 4).map((node, i) => {
                            const isRising = node.predicted_congestion_pct > 65;
                            const volText = isRising ? "+ High Vol" : "- Stable";

                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                    key={node.name} className="glass rounded-xl p-4 border border-border/20"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-heading font-semibold text-foreground truncate max-w-[150px]" title={node.name}>{node.name}</div>
                                        <div className={`text-xs whitespace-nowrap font-mono px-2 py-0.5 rounded-full ${isRising ? "bg-destructive/20 text-destructive border border-destructive/30" : "bg-success/20 text-success border border-success/30"}`}>
                                            {volText}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground font-mono mb-1">STATUS</div>
                                            <div className="text-sm font-bold font-mono text-foreground/80">{node.level.toUpperCase()}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground font-mono mb-1">+30 MINS</div>
                                            <div className={`text-lg font-mono font-bold ${isRising ? "text-destructive" : "text-success"}`}>
                                                {node.predicted_congestion_pct.toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        }) : (
                            <div className="text-sm text-muted-foreground italic px-2">Backend nodes offline. Showing primary region limit.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
