import { motion } from "framer-motion";
import { FileText, Download, Calendar, TrendingUp, Clock, Filter, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrafficData, useSignalLogs } from "@/hooks/useTrafficDB";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/runtimeConfig";
import { fetchApi } from "@/lib/fetchApi";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };


const severityColors: Record<string, string> = {
  Normal: "text-success bg-success/10 border-success/20",
  High: "text-warning bg-warning/10 border-warning/20",
  Critical: "text-destructive bg-destructive/10 border-destructive/20",
};

export default function Reports() {
  const { data: trafficData } = useTrafficData();
  const { data: logsData } = useSignalLogs();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState("full");
  const [reportTypes, setReportTypes] = useState<{id: string; name: string; description: string}[]>([
    {id: "full", name: "Full Operations Report", description: "Complete system overview with AI analytics, traffic data, and agent decisions"},
    {id: "performance", name: "Performance Report", description: "CPU, memory, latency, and AI efficiency metrics"},
    {id: "incident", name: "Incident Report", description: "Error logs, alerts, and anomaly events"},
    {id: "forecast", name: "Forecast Report", description: "Traffic congestion predictions and trend analysis"},
  ]);

  useEffect(() => {
    fetchApi("/api/report/types").then((res) => {
      if (res?.report_types) setReportTypes(res.report_types);
    }).catch(() => {});
  }, []);

  const API_BASE = API_BASE_URL;

  const downloadPdf = async (filename: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/report/generate?report_type=${selectedReportType}`, { method: "GET" });
      if (!response.ok) throw new Error("Backend returned " + response.status);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded: ${filename}`);
    } catch (e: any) {
      toast.error("Backend offline — start the Python backend to generate PDFs.");
    }
  };

  const handleDownloadReport = async (title: string) => {
    setDownloading(title);
    await downloadPdf(`${title.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
    setDownloading(null);
  };

  const handleNewReport = async () => {
    setGenerating(true);
    await downloadPdf(`TrafficAI_Report_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
    setGenerating(false);
  };

  const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const errorCount = logsData?.filter((l) => l.log_type === "ERROR" && new Date(l.created_at).getTime() >= last24hCutoff).length ?? 0;
  const totalDataPoints = (trafficData?.length ?? 0) + (logsData?.length ?? 0);

  // Build dynamic report list from real DB data
  const dynamicReports = (() => {
    const reports: { title: string; date: string; status: string; type: string; severity: string }[] = [];
    if (trafficData && trafficData.length > 0) {
      const latest = trafficData[0];
      const density = latest.density ?? 0;
      reports.push({
        title: `Traffic Snapshot — ${latest.intersection_id}`,
        date: format(new Date(latest.created_at), "yyyy-MM-dd HH:mm"),
        status: "Complete",
        type: "Auto-generated",
        severity: density > 70 ? "Critical" : density > 40 ? "High" : "Normal",
      });
    }
    if (logsData && logsData.length > 0) {
      const alerts = logsData.filter((l) => l.log_type === "ALERT" || l.log_type === "ERROR");
      if (alerts.length > 0) {
        reports.push({
          title: `Incident Report — ${alerts[0].agent_name}`,
          date: format(new Date(alerts[0].created_at), "yyyy-MM-dd HH:mm"),
          status: "Complete",
          type: "Triggered",
          severity: alerts[0].log_type === "ERROR" ? "Critical" : "High",
        });
      }
      reports.push({
        title: `Agent Audit Log — ${logsData.length} entries`,
        date: format(new Date(logsData[0].created_at), "yyyy-MM-dd HH:mm"),
        status: "Complete",
        type: "Scheduled",
        severity: "Normal",
      });
    }
    return reports;
  })();

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto space-y-6 relative z-10">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">MISSION REPORTS</h1>
            <p className="text-muted-foreground text-sm">Historical traffic analysis and system reports — queried live from Supabase</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="bg-secondary/80 border border-border/50 rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:ring-2 focus:ring-primary/40 outline-none"
            >
              {reportTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="border-border/50 font-heading tracking-wider text-xs gap-1.5">
              <Filter className="w-3 h-3" /> FILTER
            </Button>
            <Button size="sm" onClick={handleNewReport} disabled={generating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-heading tracking-wider text-xs gap-1.5">
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {generating ? "GENERATING..." : "GENERATE REPORT"}
            </Button>
          </div>
        </motion.div>

        {/* Stats — all from real DB */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Reports Generated", value: dynamicReports.length.toString(), icon: FileText },
            { label: "Live Data Points", value: totalDataPoints > 0 ? totalDataPoints.toLocaleString() : "0", icon: TrendingUp },
            { label: "Error Events (24h)", value: errorCount.toString(), icon: Calendar },
            { label: "Status", value: totalDataPoints > 0 ? "Live" : "Offline", icon: Clock },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5 card-hover">
              <s.icon className="w-5 h-5 text-primary mb-3" />
              <div className="text-2xl font-heading font-bold text-foreground">{s.value}</div>
              <div className="text-xs font-mono text-muted-foreground tracking-wider">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Reports Table */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6">
          <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Recent Reports</h3>
          <div className="overflow-x-auto custom-scrollbar pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-mono text-muted-foreground uppercase border-b border-border/30 tracking-wider">
                  <th className="text-left py-3 pr-4">Report</th>
                  <th className="text-left py-3 pr-4">Date</th>
                  <th className="text-left py-3 pr-4">Type</th>
                  <th className="text-left py-3 pr-4">Severity</th>
                  <th className="text-left py-3 pr-4">Status</th>
                  <th className="text-right py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {dynamicReports.map((r, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                    <td className="py-4 pr-4 font-medium text-foreground">{r.title}</td>
                    <td className="py-4 pr-4 font-mono text-muted-foreground text-xs">{r.date}</td>
                    <td className="py-4 pr-4">
                      <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-mono text-xs border border-primary/20">{r.type}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`px-2 py-1 rounded-lg font-mono text-xs border ${severityColors[r.severity]}`}>{r.severity}</span>
                    </td>
                    <td className="py-4 pr-4 font-mono text-xs text-muted-foreground">{r.status}</td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-xs gap-1"
                        onClick={() => handleDownloadReport(r.title)} disabled={downloading === r.title || r.status === "Processing"}>
                        {downloading === r.title ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        {downloading === r.title ? "GEN..." : r.status === "Processing" ? "PENDING" : "PDF"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {dynamicReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Waiting for live reportable data from the backend.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Live Data Timeline — only shown when backend is streaming */}
        {trafficData && trafficData.length > 0 && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
              Live Data Timeline ({trafficData.length} records)
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              {trafficData.slice(0, 15).map((td) => (
                <div key={td.id} className="flex items-center gap-4 bg-secondary/30 rounded-xl px-4 py-3 border border-border/20">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{format(new Date(td.created_at), "HH:mm:ss")}</span>
                  <span className="font-mono text-xs text-primary shrink-0">{td.intersection_id}</span>
                  <span className="text-xs text-foreground">Density: {td.density.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">N:{td.north} S:{td.south} E:{td.east} W:{td.west}</span>
                  <span className={`text-xs ml-auto ${td.emergency_active ? "text-destructive" : "text-success"}`}>
                    {td.emergency_active ? "EMERGENCY" : td.mode}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Signal Log Summary */}
        {logsData && logsData.length > 0 && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Agent Audit Trail ({logsData.length} entries)
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {logsData.slice(0, 10).map((log) => (
                <div key={log.id} className="flex gap-3 text-xs font-mono bg-secondary/20 rounded px-3 py-1.5">
                  <span className="text-muted-foreground shrink-0">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                  <span className={`font-bold shrink-0 ${log.impact === "ERROR" ? "text-destructive" : log.impact === "SUCCESS" ? "text-success" : "text-primary"}`}>
                    [{log.agent_name}]
                  </span>
                  <span className="text-foreground/80 truncate">{log.reasoning || "No reasoning logged."}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
