import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, TrendingUp, Brain, BarChart3, Clock, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { useHistoricalPerformanceMetrics, useSignalLogs, useTrafficData } from "@/hooks/useTrafficDB";
import { format } from "date-fns";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const heatColors: Record<string, string> = {
  low: "bg-success/30",
  med: "bg-warning/30",
  high: "bg-warning/60",
  critical: "bg-destructive/60",
};

export default function Analytics() {
  const { data: metricsData } = useHistoricalPerformanceMetrics();
  const { data: logsData } = useSignalLogs();
  const { data: trafficData } = useTrafficData();

  // Format historical metrics for charts
  const chartData = (metricsData || []).map((m) => ({
    time: format(new Date(m.created_at), "HH:mm:ss"),
    cpu_load: m.cpu_load,
    memory_usage: m.memory_usage,
    ai_efficiency: m.ai_efficiency,
    traditional_efficiency: m.traditional_efficiency,
    latency: m.network_latency,
  }));

  const latestMetrics = metricsData?.[metricsData.length - 1] || null;
  const avgEfficiencyGain = latestMetrics
    ? (latestMetrics.ai_efficiency - latestMetrics.traditional_efficiency).toFixed(1)
    : "0.0";

  // Generate dynamic heatmap data from traffic table based on geographic quadrants
  const generateHeatmap = () => {
    // 4x7 mock grid mapped from real data intensity
    const intensityLevels = ["low", "low", "med", "high", "critical"];
    const baseGrid = Array(4).fill(null).map(() => Array(7).fill("low"));
    if (trafficData) {
      trafficData.forEach((node, idx) => {
        const row = idx % 4;
        const col = idx % 7;
        let level = "low";
        if (node.density > 80) level = "critical";
        else if (node.density > 60) level = "high";
        else if (node.density > 40) level = "med";

        if (baseGrid[row]) baseGrid[row][col] = level;
      });
    }
    return baseGrid;
  };

  const heatmapData = generateHeatmap();

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Performance Analytics & Comparison</h1>
            <p className="text-muted-foreground text-sm">Cross-validation of Agentic RL models against traditional heuristic control systems.</p>
          </div>
          <div className="flex gap-3">
            <div className="glass rounded-lg px-4 py-2 text-center border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase">Efficiency Gain</div>
              <div className="text-2xl font-heading font-bold text-foreground">
                +{avgEfficiencyGain}% <span className="text-success text-sm">↑</span>
              </div>
            </div>
            <div className="glass rounded-lg px-4 py-2 text-center border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase">AI Confidence</div>
              <div className="text-2xl font-heading font-bold text-foreground">
                {latestMetrics?.ai_efficiency.toFixed(1) || "0.0"}% <span className="text-success text-sm">Opt</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Hardware Telemetry */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground">Edge Hardware Telemetry</h3>
                <p className="text-xs text-muted-foreground">Live CPU and Memory Consumption limits</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> CPU</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> Memory</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 18%)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 18%)", borderRadius: "8px", fontSize: 12 }} />
                <Area type="monotone" dataKey="cpu_load" stroke="hsl(199 89% 48%)" fillOpacity={0.2} fill="url(#colorCpu)" />
                <Area type="monotone" dataKey="memory_usage" stroke="hsl(262 83% 58%)" fillOpacity={0.2} fill="url(#colorMem)" />
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(199 89% 48%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(199 89% 48%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262 83% 58%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Efficiency Comparison */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-semibold text-foreground">Algorithm Efficiency Curve</h3>
                <p className="text-xs text-muted-foreground">Timescale streaming validation (AI vs Heuristic)</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground" /> Traditional</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} /> Smart AI</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 18%)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 18%)", borderRadius: "8px", fontSize: 12 }} />
                <Line type="stepAfter" dataKey="traditional_efficiency" stroke="hsl(215 20% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ai_efficiency" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Heatmap */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-5 border-border/50">
            <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> City Sectors Heatmap
            </h3>
            <div className="space-y-2">
              {heatmapData.map((row, ri) => (
                <div key={ri} className="flex gap-2">
                  {row.map((cell, ci) => (
                    <div key={ci} className={`flex-1 aspect-[4/3] rounded border border-white/5 ${heatColors[cell]} flex items-center justify-center text-[10px] font-mono opacity-80 backdrop-blur-sm transition-all hover:scale-110 hover:opacity-100 cursor-pointer`}>
                      {cell === "critical" && "⚠"}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>Grid Mapping</span>
              <span className="text-warning font-mono">Live Tracking</span>
            </div>
          </motion.div>

          {/* Decision Logs */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-xl p-5 border-border/50 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground">Agent Audit Trail</h3>
              <div className="flex rounded-lg bg-secondary overflow-hidden border border-border/40">
                <button className="px-3 py-1 text-[10px] uppercase tracking-wider font-mono bg-primary text-primary-foreground">Live</button>
                <button className="px-3 py-1 text-[10px] uppercase tracking-wider font-mono text-muted-foreground hover:text-foreground">Archived</button>
              </div>
            </div>
            <div className="overflow-x-auto flex-1 h-[200px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="font-mono text-muted-foreground uppercase border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur">
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Timestamp</th>
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Agent Trace</th>
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Action/Directive</th>
                    <th className="text-left py-2 pr-4 font-normal tracking-wide">Context</th>
                    <th className="text-right py-2 font-normal tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(logsData || []).map((log, i) => {
                    const isError = log.log_type === "ERROR" || log.log_type === "CRITICAL";
                    const isWarn = log.log_type === "WARN" || log.log_type === "ALERT";
                    const isSuccess = log.log_type === "SUCCESS";
                    const colorClass = isError ? "text-destructive" : isWarn ? "text-warning" : isSuccess ? "text-success" : "text-primary";
                    const bgClass = isError ? "bg-destructive/10 border-destructive/20" : isWarn ? "bg-warning/10 border-warning/20" : isSuccess ? "bg-success/10 border-success/20" : "bg-primary/10 border-primary/20";

                    return (
                      <tr key={log.id || i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground/70">{format(new Date(log.created_at), "HH:mm:ss")}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${bgClass} ${colorClass}`}>
                            {log.agent_name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-foreground font-medium">{log.action}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{log.message.substring(0, 45)}{log.message.length > 45 ? '...' : ''}</td>
                        <td className={`py-2.5 text-right font-mono font-bold ${colorClass}`}>{log.log_type}</td>
                      </tr>
                    );
                  })}
                  {(!logsData || logsData.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm font-mono flex-col flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
                        Awaiting agent dispatches...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-center border-t border-border/30 pt-3">
              <a href="#" className="text-xs text-primary/80 hover:text-primary transition-colors flex items-center justify-center gap-1">
                View Immutable TimescaleDB Block <TrendingUp className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
