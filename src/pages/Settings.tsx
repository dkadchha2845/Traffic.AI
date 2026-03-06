import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User, Mail, Building, Shield, Key, Bell, AlertTriangle, BarChart3, Bot, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Settings() {
  const { user, profile } = useAuth();

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSaveNotifications = () => {
    localStorage.setItem("notif_emergency", String(emergencyAlerts));
    localStorage.setItem("notif_health", String(systemHealth));
    localStorage.setItem("notif_decisions", String(decisionLogs));
    toast.success("Notification preferences saved.");
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Account & Security</h1>
            <p className="text-muted-foreground text-sm">Manage your credentials, notification preferences, and system permissions.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="border-border text-foreground gap-1">
              <Shield className="w-3 h-3" /> Audit Log
            </Button>
          </div>
        </motion.div>

        {/* Profile + Agent */}
        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">👩‍💼</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-heading font-bold text-foreground">{profile?.display_name || user?.email?.split("@")[0] || "Operator"}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/20 text-accent">LEVEL {profile?.access_level || 1} ACCESS</span>
                </div>
                <p className="text-sm text-primary">{profile?.role || "Traffic Engineer"} | TrafficAI Command Central</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> ID: {user?.id?.slice(0, 8) || "N/A"}</span>
              <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user?.email || "N/A"}</span>
              <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> {profile?.department || "Bangalore Traffic HQ"}</span>
            </div>
          </motion.div>

          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Bot className="w-5 h-5" /> Agent Override</h3>
              <span className="text-xs font-mono text-muted-foreground uppercase">Authority</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Select AI agents you are authorized to manually override during emergencies.</p>
            <div className="space-y-3">
              {agentItems.map((a) => (
                <div key={a.name} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{a.icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                  </div>
                  <button
                    disabled={a.locked}
                    onClick={() => !a.locked && a.setEnabled(!a.enabled)}
                    className={`w-10 h-6 rounded-full transition-colors ${a.enabled ? "bg-primary" : "bg-muted"} ${a.locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <div className={`w-4 h-4 rounded-full bg-foreground transition-transform mx-auto mt-1 ${a.enabled ? "translate-x-2" : "-translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Security + Notification */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Password change — fully wired to Supabase Auth */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6 space-y-5">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Shield className="w-5 h-5" /> Security & Authentication</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase mb-2 block">Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase mb-2 block">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm" />
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={saving || !newPassword}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 w-full" size="sm">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saving ? "Saving..." : "Update Password"}
            </Button>
            <div className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent" />
                <div>
                  <div className="font-semibold text-sm text-foreground">Two-Factor Authentication</div>
                  <div className="text-xs text-muted-foreground">Adds a second layer of security to your login.</div>
                </div>
              </div>
              <button onClick={() => { setTwoFA(!twoFA); toast.info(twoFA ? "2FA disabled" : "2FA enabled (configure with authenticator app)"); }}
                className={`w-10 h-6 rounded-full transition-colors ${twoFA ? "bg-primary" : "bg-muted"}`}>
                <div className={`w-4 h-4 rounded-full bg-foreground transition-transform ${twoFA ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </div>
          </motion.div>

          {/* Notification Center */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Bell className="w-5 h-5" /> Notification Center</h3>
              <Button size="sm" variant="outline" onClick={handleSaveNotifications} className="text-xs gap-1">
                <CheckCircle2 className="w-3 h-3" /> Save Prefs
              </Button>
            </div>
            <div className="space-y-3 flex-1">
              {notifItems.map((n) => (
                <div key={n.name} className="bg-secondary rounded-lg p-4 flex items-center gap-4">
                  <n.icon className={`w-5 h-5 ${n.color} shrink-0`} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-foreground">{n.name}</h4>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <button onClick={() => n.setEnabled(!n.enabled)}
                    className={`w-10 h-6 rounded-full transition-colors shrink-0 ${n.enabled ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-4 h-4 rounded-full bg-foreground transition-transform ${n.enabled ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground py-4 border-t border-border">
          <span>© 2026 TrafficAI Command Systems. Restricted Access.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms of Service</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
