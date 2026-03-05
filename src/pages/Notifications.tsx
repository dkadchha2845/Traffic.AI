import { motion } from "framer-motion";
import { Bell, AlertTriangle, CheckCircle2, Info, Zap, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "alert" | "success" | "info" | "warning";
  time: string;
  read: boolean;
}

const initialNotifications: Notification[] = [
  { id: "1", title: "Emergency Override Activated", message: "Green wave corridor deployed for Sector 7. All intersections responding.", type: "alert", time: "2 min ago", read: false },
  { id: "2", title: "AI Model Retrained", message: "LearningAgent completed 1000-cycle training. Efficiency improved by 3.2%.", type: "success", time: "15 min ago", read: false },
  { id: "3", title: "Sensor Degradation", message: "Node A-6 reporting intermittent LiDAR readings. Maintenance scheduled.", type: "warning", time: "1 hour ago", read: false },
  { id: "4", title: "Daily Report Generated", message: "Traffic summary for Feb 27 is ready for download.", type: "info", time: "3 hours ago", read: true },
  { id: "5", title: "Peak Hour Detected", message: "Traffic density exceeded 85% threshold. AI agents adjusting signal timing.", type: "warning", time: "5 hours ago", read: true },
  { id: "6", title: "System Update", message: "TrafficAI v2.4.1 deployed successfully. 14 bug fixes, 3 new features.", type: "info", time: "1 day ago", read: true },
  { id: "7", title: "Record Throughput", message: "Intersection A-1 achieved 142% throughput improvement over baseline.", type: "success", time: "1 day ago", read: true },
  { id: "8", title: "Network Latency Spike", message: "Brief latency increase detected on edge nodes. Auto-resolved in 340ms.", type: "alert", time: "2 days ago", read: true },
];

const typeConfig = {
  alert: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  success: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10 border-success/20" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  warning: { icon: Zap, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const dismiss = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto max-w-4xl space-y-6 relative z-10">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-wide">NOTIFICATIONS</h1>
              <p className="text-muted-foreground text-sm">{unreadCount} unread alerts</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={markAllRead} className="border-border/50 font-heading tracking-wider text-xs">
              Mark All Read
            </Button>
            <Button variant="outline" size="sm" className="border-border/50 font-heading tracking-wider text-xs gap-1.5">
              <Settings className="w-3 h-3" /> Settings
            </Button>
          </div>
        </motion.div>

        {/* Filter */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex gap-2">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-heading tracking-wider transition-all ${
                filter === f ? "bg-primary text-primary-foreground glow-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/20"
              }`}>
              {f.toUpperCase()} {f === "unread" && unreadCount > 0 && `(${unreadCount})`}
            </button>
          ))}
        </motion.div>

        {/* Notification List */}
        <div className="space-y-3">
          {filtered.map((n, i) => {
            const config = typeConfig[n.type];
            const Icon = config.icon;
            return (
              <motion.div key={n.id} variants={fadeIn} initial="hidden" animate="visible" transition={{ delay: i * 0.05 }}
                className={`glass rounded-2xl p-5 flex items-start gap-4 card-hover ${!n.read ? "border-l-2 border-l-primary" : ""}`}>
                <div className={`w-10 h-10 rounded-xl ${config.bg} border flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-heading font-semibold text-foreground text-sm tracking-wide">{n.title}</h4>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{n.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                </div>
                <button onClick={() => dismiss(n.id)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0">
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-mono">No notifications to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
