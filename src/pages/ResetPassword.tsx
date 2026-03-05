import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight, Shield, Mail, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type View = "request" | "update" | "success";

export default function ResetPassword() {
  const [view, setView] = useState<View>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setView("update");
    }
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setView("success");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully!");
        navigate("/dashboard", { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
    >
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 starfield opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-md glass rounded-3xl p-8 holographic-border relative z-10"
      >
        {view === "request" && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground tracking-wide">PASSWORD RECOVERY</h2>
                <p className="text-xs text-muted-foreground font-mono">Reset your access credentials</p>
              </div>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-5">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Registered Channel</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="operator@trafficai.net"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-sm inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? "TRANSMITTING..." : "SEND RECOVERY LINK"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Remember your credentials?{" "}
              <button type="button" onClick={() => navigate("/login")} className="text-primary font-semibold hover:underline">
                Sign In
              </button>
            </p>
          </>
        )}

        {view === "update" && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground tracking-wide">NEW ACCESS CODE</h2>
                <p className="text-xs text-muted-foreground font-mono">Set your new credentials</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">New Access Code</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-12 pl-10 pr-12 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Confirm Access Code</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-sm inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? "UPDATING..." : "UPDATE ACCESS CODE"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

        {view === "success" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-success/20 border border-success/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground tracking-wide">LINK TRANSMITTED</h2>
            <p className="text-sm text-muted-foreground">
              A recovery link has been sent to <span className="text-foreground font-mono">{email}</span>. Check your inbox and follow the link to reset your access code.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-4 text-primary font-semibold hover:underline text-sm font-heading tracking-wider"
            >
              BACK TO LOGIN
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
