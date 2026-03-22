import { motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, Loader2, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { fetchApi } from "@/lib/fetchApi";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "alert" | "success" | "info" | "warning";
  time: string;
  read: boolean;
  source: string;
}

const typeConfig = {
  alert: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
  success: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10 border-success/20" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  warning: { icon: Zap, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetchApi("/api/system/notifications?limit=30");
        if (!active) return;
        setNotifications(response.notifications || []);
        setError(null);
      } catch {
        if (!active) return;
        setNotifications([]);
        setError("Unable to load live notifications.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const filtered = filter === "unread" ? notifications.filter((item) => !item.read) : notifications;

  const markAllRead = () => setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  const dismiss = (id: string) => setNotifications((current) => current.filter((item) => item.id !== id));

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
              <p className="text-muted-foreground text-sm">{unreadCount} unread live alerts</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={markAllRead} className="border-border/50 font-heading tracking-wider text-xs">
              Mark All Read
            </Button>
          </div>
        </motion.div>

        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex gap-2">
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-xl text-xs font-heading tracking-wider transition-all ${
                filter === value ? "bg-primary text-primary-foreground glow-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/20"
              }`}
            >
              {value.toUpperCase()} {value === "unread" && unreadCount > 0 && `(${unreadCount})`}
            </button>
          ))}
        </motion.div>

        {loading ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading live notifications...</p>
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
            <p className="text-sm text-warning">{error}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((notification, index) => {
              const config = typeConfig[notification.type];
              const Icon = config.icon;
              return (
                <motion.div
                  key={notification.id}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: index * 0.03 }}
                  className={`glass rounded-2xl p-5 flex items-start gap-4 card-hover ${!notification.read ? "border-l-2 border-l-primary" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-xl ${config.bg} border flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-heading font-semibold text-foreground text-sm tracking-wide">{notification.title}</h4>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{new Date(notification.time).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-[10px] font-mono text-primary mt-2">Source: {notification.source}</p>
                  </div>
                  <button onClick={() => dismiss(notification.id)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0">
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="glass rounded-2xl p-12 text-center">
                <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-mono">No live notifications to display</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
