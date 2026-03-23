import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, Shield, KeyRound, Bell, AlertTriangle, BarChart3, Bot, Save, CheckCircle2, Activity, Server, ActivitySquare, TerminalSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSystemNetwork } from "@/hooks/useSystemStatus";
import { TwoFactorModal } from "@/components/Settings/TwoFactorModal";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Settings() {
  const { user, profile } = useAuth();
  const { data: telemetry } = useLiveTelemetry();
  const { data: network } = useSystemNetwork();

  // Security state
  const [twoFA, setTwoFA] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  // Notification toggles (persisted in localStorage for now)
  const [emergencyAlerts, setEmergencyAlerts] = useState(
    () => localStorage.getItem("notif_emergency") !== "false"
  );
  const [systemHealth, setSystemHealth] = useState(
    () => localStorage.getItem("notif_health") !== "false"
  );
  const [decisionLogs, setDecisionLogs] = useState(
    () => localStorage.getItem("notif_decisions") === "true"
  );

  // AI Agent toggles
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [decisionEnabled, setDecisionEnabled] = useState(true);
  const [globalGrid, setGlobalGrid] = useState(false);

  // Audit Logs State
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    // Fetch a few recent logs for the Audit section
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('signal_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(3);
      if (data) setRecentLogs(data);
    };
    fetchLogs();

    // Check if user has MFA enabled
    const checkMFA = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        
        const totpFactor = data.totp.find((factor) => factor.status === 'verified');
        if (totpFactor) {
          setTwoFA(true);
          setFactorId(totpFactor.id);
        }
      } catch (err) {
        console.error("Error checking MFA status:", err);
      }
    };
    checkMFA();
  }, []);

  const handleSaveNotifications = () => {
    localStorage.setItem("notif_emergency", String(emergencyAlerts));
    localStorage.setItem("notif_health", String(systemHealth));
    localStorage.setItem("notif_decisions", String(decisionLogs));
    toast.success("Notification preferences saved successfully.");
  };

  const notifItems = [
    { name: "Emergency Alerts", desc: "Immediate push notifications for critical traffic grid failures.", icon: AlertTriangle, color: "text-destructive", enabled: emergencyAlerts, setEnabled: setEmergencyAlerts },
    { name: "System Health", desc: "Daily reports on sensor uptime, latency, and AI agent performance.", icon: BarChart3, color: "text-accent", enabled: systemHealth, setEnabled: setSystemHealth },
    { name: "Decision Logs", desc: "Receive digests of high-impact AI routing decisions for review.", icon: Bot, color: "text-muted-foreground", enabled: decisionLogs, setEnabled: setDecisionLogs },
  ];

  const agentItems = [
    { name: "Sensor Array", desc: "Data Inputs", icon: "📡", enabled: sensorEnabled, setEnabled: setSensorEnabled },
    { name: "Decision Core", desc: "Route Logic", icon: "🧠", enabled: decisionEnabled, setEnabled: setDecisionEnabled },
    { name: "Global Grid", desc: "Restricted", icon: "🔒", enabled: globalGrid, setEnabled: setGlobalGrid, locked: true },
  ];

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto space-y-6 relative z-10">
        
        {/* Header */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">System Configuration</span>
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">Settings & Audit</h1>
            <p className="text-muted-foreground text-sm">Manage preferences, security modes, and review live system audits.</p>
          </div>
        </motion.div>

        {/* Top Row: Profile + Security (2FA) */}
        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border border-border/20 shadow-xl">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-6"><Shield className="w-5 h-5 text-primary" /> Operator Profile</h3>
            <div className="flex items-center gap-4 mb-6 bg-secondary/30 p-4 rounded-xl border border-border/40">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl shadow-inner border border-primary/20">👩‍💼</div>
              <div>
                <h3 className="text-lg font-heading font-bold text-foreground leading-none mb-1">{profile?.display_name || user?.email?.split("@")[0] || "Operator"}</h3>
                <p className="text-xs text-primary font-mono uppercase tracking-wider">Command Central Operator</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground bg-black/20 p-4 rounded-xl">
              <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-accent" /> {user?.email || "N/A"}</span>
              <span className="flex items-center gap-2 font-mono"><KeyRound className="w-4 h-4 text-accent" /> ID: {user?.id || "N/A"}</span>
            </div>
          </motion.div>

          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border border-border/20 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-warning" /> High-Security Mode</h3>
              <p className="text-sm text-muted-foreground mb-6">Enhance your account security with multi-factor authentication for modifying AI parameters.</p>
            </div>
            
            <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-5 border border-border/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0 border border-warning/20">
                  <Shield className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground mb-1">Two-Factor Authentication</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">Require a time-based code from an authenticator app when overriding AI decisions.</div>
                </div>
              </div>
              <button 
                onClick={async () => { 
                  if (twoFA) {
                    if (factorId) {
                      try {
                        await supabase.auth.mfa.unenroll({ factorId });
                        setTwoFA(false);
                        setFactorId(null);
                        toast.success("2FA has been disabled.");
                      } catch (err: any) {
                        toast.error(err.message || "Failed to disable 2FA. You may need to verify your session first.");
                      }
                    }
                  } else {
                    setIs2FAModalOpen(true);
                  }
                }}
                className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ml-4 ${twoFA ? "bg-warning" : "bg-muted"}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${twoFA ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Middle Row: Agent Override + Notifications */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Agent Override */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border border-border/20 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> Agent Override Protocols</h3>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground uppercase">Live Network:</span>
                <span className="text-cyan font-bold">{network?.active_nodes || 0} Nodes</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Selectively enable or disable autonomous agents. Disabling core agents defaults system to manual traffic patterns.</p>
            
            <div className="space-y-3 flex-1">
              {agentItems.map((a) => (
                <div key={a.name} className={`flex items-center justify-between bg-black/30 rounded-xl px-5 py-4 border ${a.locked ? 'border-destructive/20 opacity-70' : 'border-border/30'}`}>
                  <div className="flex items-center gap-4">
                    <div className="text-2xl w-10 h-10 flex items-center justify-center bg-secondary rounded-lg border border-border/50">{a.icon}</div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        {a.desc} 
                        {a.name === "Decision Core" && <span className="text-primary text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10">{telemetry?.signal_phase || "IDLE"}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={a.locked}
                    onClick={() => !a.locked && a.setEnabled(!a.enabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${a.enabled ? "bg-primary" : "bg-muted"} ${a.locked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${a.enabled ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Notification Center */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border border-border/20 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Bell className="w-5 h-5 text-accent" /> Notification Center</h3>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground uppercase">Latency:</span>
                <span className="text-success font-bold">{network?.network_latency_ms ? `${Math.round(network?.network_latency_ms)}ms` : "OK"}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Configure alerting thresholds for the Command Central web interface and emails.</p>

            <div className="space-y-3 flex-1 mb-6">
              {notifItems.map((n) => (
                <div key={n.name} className="bg-black/30 border border-border/30 rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-secondary border border-border/50 shrink-0`}>
                    <n.icon className={`w-5 h-5 ${n.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-foreground">{n.name}</h4>
                    <p className="text-xs text-muted-foreground leading-snug mt-1">{n.desc}</p>
                  </div>
                  <button onClick={() => n.setEnabled(!n.enabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${n.enabled ? "bg-accent" : "bg-muted"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${n.enabled ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
            
            <Button onClick={handleSaveNotifications} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-bold tracking-wide">
              <Save className="w-4 h-4 mr-2" /> Save Preferences
            </Button>
          </motion.div>
        </div>

        {/* Bottom Row: Audit Log Stream */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6 border border-border/20 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                <TerminalSquare className="w-5 h-5 text-muted-foreground" /> Security & Action Audit Trail
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Live stream of the 3 most recent high-level actions across the traffic grid.</p>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
               <span className="text-[10px] font-mono text-success uppercase tracking-wider">Logging Active</span>
            </div>
          </div>
          
          <div className="space-y-2">
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div key={log.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-black/40 rounded-xl border border-border/20 hover:border-border/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <ActivitySquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{log.action || log.log_type}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">{log.reasoning || log.impact || "System auto-generated event."}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground shrink-0 border-t md:border-t-0 md:border-l border-border/30 pt-3 md:pt-0 md:pl-4">
                    <span className="text-accent bg-accent/10 px-2 py-1 rounded">{log.intersection_id}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl">
                No recent audit logs available. Check the Reports page for deeper history.
              </div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground py-6 font-mono">
          <span>© 2026 TrafficAI Command Systems. Restricted Access.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </div>

      <TwoFactorModal 
        isOpen={is2FAModalOpen} 
        onClose={() => setIs2FAModalOpen(false)} 
        onSuccess={() => {
          setTwoFA(true);
          // Re-fetch factors to get the new factorId
          supabase.auth.mfa.listFactors().then(({ data }) => {
            if (data?.totp) {
              const verified = data.totp.find((f) => f.status === 'verified');
              if (verified) setFactorId(verified.id);
            }
          });
        }} 
      />
    </div>
  );
}

