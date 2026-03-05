import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User, Mail, Building, Shield, Key, Bell, AlertTriangle, BarChart3, Bot, Copy, Eye, EyeOff, Save } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const agentOverrides = [
  { name: "Sensor Array", desc: "Data Inputs", icon: "📡", enabled: true },
  { name: "Decision Core", desc: "Route Logic", icon: "🧠", enabled: true },
  { name: "Global Grid", desc: "Restricted", icon: "🔒", enabled: false },
];

const notifications = [
  { name: "Emergency Alerts", desc: "Immediate push notifications for critical traffic grid failures.", icon: AlertTriangle, color: "text-destructive", enabled: true },
  { name: "System Health", desc: "Daily reports on sensor uptime, latency, and AI agent performance.", icon: BarChart3, color: "text-accent", enabled: true },
  { name: "Decision Logs", desc: "Receive digests of high-impact AI routing decisions for review.", icon: Bot, color: "text-muted-foreground", enabled: false },
];

export default function Settings() {
  const [showKey1, setShowKey1] = useState(false);
  const [twoFA, setTwoFA] = useState(false);
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Account & Security</h1>
            <p className="text-muted-foreground text-sm">Manage your credentials, API keys, and system permissions.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="border-border text-foreground gap-1"><Shield className="w-3 h-3" /> Audit Log</Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1"><Save className="w-3 h-3" /> Save Changes</Button>
          </div>
        </motion.div>

        {/* Top Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Profile */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">👩‍💼</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-heading font-bold text-foreground">{profile?.display_name || "User"}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/20 text-accent">LEVEL {profile?.access_level || 1} ACCESS</span>
                </div>
                <p className="text-sm text-primary">{profile?.role || "Traffic Engineer"} | TrafficAI Command Central</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> ID: {profile?.id?.slice(0, 8) || "N/A"}</span>
              <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user?.email || "N/A"}</span>
              <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> {profile?.department || "Sector 7 HQ"}</span>
            </div>
          </motion.div>

          {/* Agent Override */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Bot className="w-5 h-5" /> Agent Override</h3>
              <span className="text-xs font-mono text-muted-foreground uppercase">Authority</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Select AI agents you are authorized to manually override during emergencies.</p>
            <div className="space-y-3">
              {agentOverrides.map((a) => (
                <div key={a.name} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{a.icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${a.enabled ? "bg-accent text-accent-foreground" : "bg-muted"}`}>
                    {a.enabled && "✓"}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Middle Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Security */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6 space-y-5">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Shield className="w-5 h-5" /> Security & Authentication</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase mb-2 block">Current Password</label>
                <input type="password" value="••••••••••" readOnly className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase mb-2 block">New Password</label>
                <input type="password" placeholder="New secure password" className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent" />
                <div>
                  <div className="font-semibold text-sm text-foreground">Two-Factor Authentication</div>
                  <div className="text-xs text-muted-foreground">Secure your account with an authenticator app.</div>
                </div>
              </div>
              <button onClick={() => setTwoFA(!twoFA)} className={`w-10 h-6 rounded-full transition-colors ${twoFA ? "bg-primary" : "bg-muted"}`}>
                <div className={`w-4 h-4 rounded-full bg-foreground transition-transform ${twoFA ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </div>
          </motion.div>

          {/* API Access */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-foreground flex items-center gap-2"><Key className="w-5 h-5" /> API Access</h3>
              <Button size="sm" className="bg-success/20 text-success hover:bg-success/30 text-xs">+ Generate New Token</Button>
            </div>
            <div className="space-y-3">
              <div className="bg-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-sm font-semibold text-foreground">Production Read-Only</span>
                </div>
                <div className="font-mono text-xs text-cyan mb-1">tf_live_8923_x99a_kz2m_p00l_vance_auth_token</div>
                <div className="text-xs text-muted-foreground">Last used: 2 mins ago</div>
              </div>
              <div className="bg-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-sm font-semibold text-foreground">Dev Sandbox</span>
                </div>
                <div className="font-mono text-xs text-cyan mb-1">tf_test_0021_b22c_mq9x_sandbox_key_v2</div>
                <div className="text-xs text-muted-foreground">Created: Oct 24, 2023</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Use these keys to authenticate with the TrafficAI CLI or REST API. Do not share your keys.</p>
          </motion.div>
        </div>

        {/* Notification Center */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-xl p-6">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-4"><Bell className="w-5 h-5" /> Notification Center</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {notifications.map((n) => (
              <div key={n.name} className="bg-secondary rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <n.icon className={`w-6 h-6 ${n.color}`} />
                  <button className={`w-10 h-6 rounded-full transition-colors ${n.enabled ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-4 h-4 rounded-full bg-foreground transition-transform ${n.enabled ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </div>
                <h4 className="font-semibold text-sm text-foreground mb-1">{n.name}</h4>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground py-4 border-t border-border">
          <span>© 2025 TrafficAI Command Systems. Restricted Access.</span>
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
