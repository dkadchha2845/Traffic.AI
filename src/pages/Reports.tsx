import { motion } from "framer-motion";
import { FileText, Download, Calendar, TrendingUp, Clock, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrafficData } from "@/hooks/useTrafficDB";
import { format } from "date-fns";
import { useState } from "react";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Reports() {
  const { data: trafficData } = useTrafficData();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownloadReport = async (title: string) => {
    try {
      setDownloading(title);
      const response = await fetch("http://localhost:8000/api/report/generate", {
        method: "GET"
      });
      if (!response.ok) throw new Error("Failed to generate report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${format(new Date(), "yyyyMMdd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download PDF", e);
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    { title: "Daily Traffic Summary", date: "2026-02-28", status: "Complete", type: "Auto-generated", severity: "Normal" },
    { title: "Peak Hour Analysis", date: "2026-02-27", status: "Complete", type: "Scheduled", severity: "High" },
    { title: "Emergency Response Report", date: "2026-02-26", status: "Complete", type: "Triggered", severity: "Critical" },
    { title: "Weekly AI Performance", date: "2026-02-25", status: "Processing", type: "Scheduled", severity: "Normal" },
    { title: "Intersection A-3 Incident", date: "2026-02-24", status: "Complete", type: "Manual", severity: "High" },
  ];

  const severityColors: Record<string, string> = {
    Normal: "text-success bg-success/10 border-success/20",
    High: "text-warning bg-warning/10 border-warning/20",
    Critical: "text-destructive bg-destructive/10 border-destructive/20",
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto space-y-6 relative z-10">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-wide">MISSION REPORTS</h1>
            <p className="text-muted-foreground text-sm">Historical traffic analysis and system reports</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="border-border/50 font-heading tracking-wider text-xs gap-1.5">
              <Filter className="w-3 h-3" /> FILTER
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-heading tracking-wider text-xs gap-1.5">
              <FileText className="w-3 h-3" /> NEW REPORT
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Reports", value: reports.length.toString(), icon: FileText },
            { label: "Data Points", value: trafficData?.length?.toString() || "0", icon: TrendingUp },
            { label: "This Week", value: "3", icon: Calendar },
            { label: "Avg. Response", value: "2.4s", icon: Clock },
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
          <div className="overflow-x-auto">
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
                {reports.map((r, i) => (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80 text-xs gap-1"
                        onClick={() => handleDownloadReport(r.title)}
                        disabled={downloading === r.title}
                      >
                        {downloading === r.title ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        {downloading === r.title ? "GEN..." : "PDF"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Traffic Data Timeline */}
        {trafficData && trafficData.length > 0 && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6">
            <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Live Data Timeline</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
      </div>
    </div>
  );
}
