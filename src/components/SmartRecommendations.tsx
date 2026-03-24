import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowRightLeft, Ambulance, CloudRain,
  ChevronDown, ChevronUp, CheckCircle2, Loader2, Zap, Shield
} from "lucide-react";
import { fetchApi } from "@/lib/fetchApi";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  type: "SIGNAL_EXTENSION" | "DIVERSION" | "EMERGENCY" | "SPEED_ADVISORY";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  junction_id: string;
  junction_name: string;
  title: string;
  description: string;
  action_data: Record<string, any>;
  reasoning: string;
  is_applied: boolean;
  created_at: string;
}

const typeIcons: Record<string, any> = {
  SIGNAL_EXTENSION: Zap,
  DIVERSION: ArrowRightLeft,
  EMERGENCY: Ambulance,
  SPEED_ADVISORY: CloudRain,
};

const priorityStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CRITICAL: { bg: "bg-destructive/5", border: "border-destructive/30", text: "text-destructive", badge: "bg-destructive/20 text-destructive border-destructive/40" },
  HIGH: { bg: "bg-warning/5", border: "border-warning/30", text: "text-warning", badge: "bg-warning/20 text-warning border-warning/40" },
  MEDIUM: { bg: "bg-primary/5", border: "border-primary/30", text: "text-primary", badge: "bg-primary/20 text-primary border-primary/40" },
  LOW: { bg: "bg-muted/5", border: "border-muted/30", text: "text-muted-foreground", badge: "bg-muted/20 text-muted-foreground border-muted/40" },
};

export default function SmartRecommendations() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApi("/api/command/recommendations");
      setRecs(data.recommendations || []);
    } catch {
      // Backend offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
    const t = setInterval(fetchRecs, 15_000); // Refresh every 15s
    return () => clearInterval(t);
  }, [fetchRecs]);

  const handleApply = async (rec: Recommendation) => {
    setApplying(rec.id);
    try {
      const resp = await fetchApi("/api/command/apply-recommendation", {
        method: "POST",
        body: JSON.stringify({
          recommendation_id: rec.id,
          action: rec.action_data.action,
          junction_id: rec.junction_id,
          extension_seconds: rec.action_data.extension_seconds,
        }),
      });
      toast.success(resp.message || "Recommendation applied.");
      // Mark as applied locally
      setRecs(prev => prev.map(r => r.id === rec.id ? { ...r, is_applied: true } : r));
    } catch {
      toast.error("Failed to apply recommendation. Check backend.");
    } finally {
      setApplying(null);
    }
  };

  const critical = recs.filter(r => r.priority === "CRITICAL").length;
  const high = recs.filter(r => r.priority === "HIGH").length;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
      initial="hidden"
      animate="visible"
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> AI Control Hub
          {critical > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-destructive/20 text-destructive border border-destructive/30 animate-pulse">
              {critical} CRITICAL
            </span>
          )}
          {high > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-warning/20 text-warning border border-warning/30">
              {high} HIGH
            </span>
          )}
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          {recs.length} active · Auto-refresh 15s
        </span>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {loading && recs.length === 0 && (
          <div className="flex items-center justify-center h-24 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Analyzing live traffic data...</span>
          </div>
        )}

        {!loading && recs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <CheckCircle2 className="w-6 h-6 text-success" />
            <p className="text-xs text-muted-foreground text-center">
              All clear. No active recommendations at this time.
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {recs.map((rec) => {
            const Icon = typeIcons[rec.type] || AlertTriangle;
            const style = priorityStyles[rec.priority] || priorityStyles.LOW;
            const isExpanded = expanded === rec.id;

            return (
              <motion.div
                key={rec.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-xl border ${style.border} ${style.bg} p-3 transition-all ${rec.priority === "CRITICAL" && !rec.is_applied ? "animate-pulse-slow" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${style.bg} border ${style.border}`}>
                    <Icon className={`w-4 h-4 ${style.text}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${style.badge}`}>
                        {rec.priority}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {rec.type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{rec.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{rec.description}</p>

                    {/* Expanded reasoning */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-2 rounded-lg bg-background/50 border border-border/20">
                            <span className="text-[10px] font-mono text-primary uppercase tracking-wider">Reasoning</span>
                            <p className="text-[11px] text-muted-foreground mt-1">{rec.reasoning}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!rec.is_applied && rec.type !== "EMERGENCY" && (
                      <button
                        onClick={() => handleApply(rec)}
                        disabled={applying === rec.id}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          applying === rec.id
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                        }`}
                      >
                        {applying === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                      </button>
                    )}
                    {rec.is_applied && (
                      <span className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/30">
                        Applied
                      </span>
                    )}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : rec.id)}
                      className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
