import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Satellite, User, Phone, KeyRound } from "lucide-react";
import { motion, useSpring } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { toast } from "sonner";

function FloatingOrb({ delay, x, y, size, color }: { delay: number; x: string; y: string; size: string; color: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${color}`}
      style={{ left: x, top: y, width: size, height: size }}
      animate={{
        y: [0, -30, 0, 20, 0],
        x: [0, 15, -10, 5, 0],
        scale: [1, 1.1, 0.95, 1.05, 1],
        opacity: [0.3, 0.5, 0.3, 0.45, 0.3],
      }}
      transition={{ duration: 12, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

type LoginMode = "password" | "email-otp" | "phone-otp";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, session } = useAuth();

  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMouseX((e.clientX / window.innerWidth - 0.5) * 20);
      setMouseY((e.clientY / window.innerHeight - 0.5) * 20);
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const handleOAuthReturn = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const errorMessage = query.get("error_description") || hash.get("error_description") || query.get("error") || hash.get("error");
      if (errorMessage) {
        toast.error(errorMessage);
        return;
      }

      const accessToken = query.get("access_token") || hash.get("access_token");
      const refreshToken = query.get("refresh_token") || hash.get("refresh_token");
      const code = query.get("code");

      if (!code && !(accessToken && refreshToken)) return;

      setSubmitting(true);
      try {
        const result = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.setSession({
              access_token: accessToken as string,
              refresh_token: refreshToken as string,
            });

        if (result.error) {
          toast.error(result.error.message || "Sign-in failed");
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          toast.error("Authentication completed, but session was not established. Please retry.");
          return;
        }

        if (!cancelled) {
          navigate("/dashboard", { replace: true });
        }
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    };

    void handleOAuthReturn();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (session) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, navigate]);

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`
      }
    });
    
    if (error) {
      toast.error(error.message || "Google sign-in failed");
      setSubmitting(false);
      return;
    }
    // If successful, Supabase will redirect the browser
  };

  const handleAppleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/login`
      }
    });
    
    if (error) {
      toast.error(error.message || "Apple sign-in failed");
      setSubmitting(false);
      return;
    }
    // If successful, Supabase will redirect the browser
  };

  const handleSendEmailOtp = async () => {
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setOtpSent(true);
        toast.success("Magic link & OTP code sent to your email!");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!otp || otp.length < 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) {
        toast.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phone) {
      toast.error("Please enter your phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        toast.error(error.message);
      } else {
        setOtpSent(true);
        toast.success("OTP sent to your phone!");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otp || otp.length < 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (error) {
        toast.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitAuth = async () => {
    if (submitting) return;
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created! Check your email to verify, then sign in.");
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === "email-otp") {
      if (otpSent) {
        await handleVerifyEmailOtp();
      } else {
        await handleSendEmailOtp();
      }
    } else if (loginMode === "phone-otp") {
      if (otpSent) {
        await handleVerifyPhoneOtp();
      } else {
        await handleSendPhoneOtp();
      }
    } else {
      await submitAuth();
    }
  };

  const switchMode = (mode: LoginMode) => {
    setLoginMode(mode);
    setOtpSent(false);
    setOtp("");
  };

  const modeTabClass = (mode: LoginMode) =>
    `flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-lg transition-all ${
      loginMode === mode
        ? "bg-primary/20 text-primary border border-primary/30"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
    }`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 starfield opacity-30 pointer-events-none" />

      <div className="pointer-events-none">
        <FloatingOrb delay={0} x="5%" y="15%" size="350px" color="bg-primary/20" />
        <FloatingOrb delay={2} x="75%" y="55%" size="280px" color="bg-cyan/15" />
        <FloatingOrb delay={4} x="60%" y="10%" size="320px" color="bg-nebula/15" />
        <FloatingOrb delay={6} x="90%" y="70%" size="200px" color="bg-accent/10" />
      </div>

      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      {/* Login Form */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-8 relative z-30 isolate pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, x: -40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-md glass rounded-3xl p-8 holographic-border pointer-events-auto"
        >
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center"
              whileHover={{ rotate: 15, scale: 1.1 }}
            >
              <Shield className="w-5 h-5 text-primary" />
            </motion.div>
            <div>
              <h2 className="text-xl font-heading font-bold text-foreground tracking-wide">
                {isSignUp ? "CREATE ACCOUNT" : "WELCOME BACK"}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                {isSignUp ? "Initialize your command profile" : "Access neural traffic command"}
              </p>
            </div>
          </div>

          {/* Mode tabs - only show when not in sign-up mode */}
          {!isSignUp && (
            <div className="flex gap-1.5 mb-5 p-1 rounded-xl bg-secondary/30 border border-border/30">
              <button type="button" onClick={() => switchMode("password")} className={modeTabClass("password")}>
                <Lock className="w-3 h-3 inline mr-1.5" />Password
              </button>
              <button type="button" onClick={() => switchMode("email-otp")} className={modeTabClass("email-otp")}>
                <Mail className="w-3 h-3 inline mr-1.5" />Email OTP
              </button>
              <button type="button" onClick={() => switchMode("phone-otp")} className={modeTabClass("phone-otp")}>
                <Phone className="w-3 h-3 inline mr-1.5" />Phone OTP
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sign-up name field */}
            {isSignUp && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Operator Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Your callsign" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all" />
                </div>
              </motion.div>
            )}

            {/* PASSWORD MODE */}
            {(loginMode === "password" || isSignUp) && (
              <>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Secure Channel</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" placeholder="operator@trafficai.net" value={email} onChange={(e) => setEmail(e.target.value)} required
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Access Code</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                      className="w-full h-12 pl-10 pr-12 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                  {!isSignUp && (
                    <div className="flex justify-end mt-1">
                      <button type="button" onClick={() => navigate("/reset-password")} className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono">
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* EMAIL OTP MODE */}
            {loginMode === "email-otp" && !isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" placeholder="operator@trafficai.net" value={email} onChange={(e) => setEmail(e.target.value)} required
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all" />
                  </div>
                </div>
                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Verification Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" placeholder="Enter 6-digit code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required maxLength={6}
                        className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm font-mono tracking-[0.3em] backdrop-blur-sm transition-all" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Check your email for the code or click the magic link.</p>
                  </motion.div>
                )}
              </>
            )}

            {/* PHONE OTP MODE */}
            {loginMode === "phone-otp" && !isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="tel" placeholder="+1 234 567 8900" value={phone} onChange={(e) => setPhone(e.target.value)} required
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm backdrop-blur-sm transition-all" />
                  </div>
                </div>
                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Verification Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" placeholder="Enter 6-digit code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required maxLength={6}
                        className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm font-mono tracking-[0.3em] backdrop-blur-sm transition-all" />
                    </div>
                  </motion.div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-sm inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none pointer-events-auto"
            >
              {submitting
                ? "AUTHENTICATING..."
                : loginMode === "password"
                  ? isSignUp ? "INITIALIZE" : "AUTHENTICATE"
                  : otpSent ? "VERIFY CODE" : "SEND CODE"
              } <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground font-mono uppercase">or</span></div>
            </div>

            {/* Social login buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground gap-3 font-heading tracking-wider text-sm inline-flex items-center justify-center transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {submitting ? "CONNECTING..." : "CONTINUE WITH GOOGLE"}
              </button>

              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground gap-3 font-heading tracking-wider text-sm inline-flex items-center justify-center transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                {submitting ? "CONNECTING..." : "CONTINUE WITH APPLE"}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isSignUp ? "Already registered?" : "New operator?"}{" "}
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); switchMode("password"); }} className="relative z-30 text-primary font-semibold hover:underline pointer-events-auto">
              {isSignUp ? "Sign In" : "Create Account"}
            </button>
          </p>

          <div className="flex justify-center gap-8 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-primary" /> Encrypted</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-cyan" /> Sub-ms</span>
            <span className="flex items-center gap-1.5"><Satellite className="w-3 h-3 text-success" /> Orbital</span>
          </div>
        </motion.div>
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex w-7/12 items-center justify-center relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
          style={{ x: springX, y: springY }}
          className="relative z-10 max-w-lg text-center px-8"
        >
          <h2 className="text-5xl font-heading font-bold leading-tight mb-6 tracking-tight">
            NEURAL TRAFFIC{" "}
            <motion.span
              className="text-gradient inline-block"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: "200% auto" }}
            >
              COMMAND
            </motion.span>
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Experience the future of urban mobility with autonomous AI agents operating at planetary scale.
          </p>
          <div className="flex justify-center gap-8 text-sm">
            <span className="flex items-center gap-2 text-primary"><Shield className="w-4 h-4" /> LiDAR Fusion</span>
            <span className="flex items-center gap-2 text-cyan"><Zap className="w-4 h-4" /> Autonomous</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
