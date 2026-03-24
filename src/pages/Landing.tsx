import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Zap, BarChart3, Shield, Activity, Rocket, Globe, Satellite, ChevronDown, Map, ActivitySquare, PlayCircle, Eye } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, Suspense, lazy, useEffect, useState } from "react";
import { useSystemDependencies, useSystemNetwork } from "@/hooks/useSystemStatus";

const Starfield = lazy(() => import("@/components/Starfield"));

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.8, ease: "easeOut" as const } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const features = [
  { icon: Brain, title: "Neural Intelligence", desc: "Autonomous agents manage intersections independently, forming a self-healing mesh network across the city grid.", gradient: "from-primary to-nebula" },
  { icon: Zap, title: "Quantum Optimization", desc: "Adaptive signal adjustments powered by predictive models and live telemetry streams across the network.", gradient: "from-cyan to-accent" },
  { icon: BarChart3, title: "Precognitive Modeling", desc: "Forecast congestion ahead using recent traffic, weather, and corridor telemetry.", gradient: "from-accent to-primary" },
  { icon: Shield, title: "Emergency Override", desc: "Instant green-wave corridors for emergency vehicles with AI-coordinated rerouting of all surrounding traffic.", gradient: "from-success to-cyan" },
];

const platformFeatures = [
  { icon: Activity, title: "Command Dashboard", desc: "Centralized live view of Bangalore's traffic health, system status, and recent automated interventions.", color: "text-primary", bg: "bg-primary/10" },
  { icon: Map, title: "Live Network Map", desc: "Interactive geographic visualization of every monitored intersection, congestion level, and active emergency route.", color: "text-cyan", bg: "bg-cyan/10" },
  { icon: Eye, title: "Digital Twin & Camera Feed", desc: "3D representation of traffic lights combined with real-time video feeds from intersection cameras.", color: "text-nebula", bg: "bg-nebula/10" },
  { icon: BarChart3, title: "Predictive Analytics", desc: "AI-driven forecasting models predicting future traffic volumes up to 24 hours in advance.", color: "text-accent", bg: "bg-accent/10" }
];

const techFeatures = [
  { icon: Satellite, title: "Multi-Sensor Fusion", desc: "LiDAR, cameras, radar, and IoT sensors fused into a unified real-time traffic perception layer." },
  { icon: Globe, title: "Edge Computing", desc: "Process decisions close to the roadway while preserving live observability from the control center." },
  { icon: Rocket, title: "Auto-Scaling", desc: "Scale corridor monitoring horizontally as more intersections and sensors come online." },
];

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

function Typewriter({ text, delay = 0, className = "" }: { text: string; delay?: number; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, 80);
    return () => clearTimeout(timer);
  }, [displayed, started, text]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          className="text-primary"
        >
          ▌
        </motion.span>
      )}
    </span>
  );
}

function AnimatedCounter({ value }: { value: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, type: "spring" }}
    >
      {value}
    </motion.span>
  );
}

export default function Landing() {
  const { data: network } = useSystemNetwork();
  const { data: dependencies } = useSystemDependencies();
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const bangaloreRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  const { scrollYProgress: featuresProgress } = useScroll({ target: featuresRef, offset: ["start end", "end start"] });
  const featuresParallax = useTransform(featuresProgress, [0, 1], [60, -60]);

  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMouseX((e.clientX / window.innerWidth - 0.5) * 30);
      setMouseY((e.clientY / window.innerHeight - 0.5) * 30);
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const liveStats = [
    { value: dependencies ? `${Math.round(dependencies.uptime_seconds / 60)}m` : "—", label: "UPTIME", icon: "🟢" },
    { value: network ? network.active_nodes.toString() : "—", label: "ACTIVE NODES", icon: "⚡" },
    { value: network?.network_latency_ms != null ? `${Math.round(network.network_latency_ms)}ms` : "—", label: "LATENCY", icon: "🔮" },
    { value: network?.telemetry_status ? network.telemetry_status.toUpperCase() : "—", label: "TELEMETRY", icon: "📉" },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated background layers */}
        <motion.div style={{ y: bgY }} className="absolute inset-0 gradient-mesh" />
        <div className="absolute inset-0 starfield opacity-40" />
        
        {/* Floating orbs for depth */}
        <FloatingOrb delay={0} x="10%" y="20%" size="400px" color="bg-primary/20" />
        <FloatingOrb delay={2} x="70%" y="60%" size="300px" color="bg-cyan/15" />
        <FloatingOrb delay={4} x="50%" y="10%" size="350px" color="bg-nebula/15" />
        <FloatingOrb delay={6} x="85%" y="30%" size="250px" color="bg-accent/10" />

        <Suspense fallback={null}>
          <Starfield className="opacity-40" />
        </Suspense>

        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, scale: heroScale, x: springX, rotateY: useTransform(springX, [-15, 15], [-1, 1]) }} className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-mono mb-10 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                {network?.telemetry_status ? `TELEMETRY ${network.telemetry_status.toUpperCase()}` : "AWAITING BACKEND"}
                <span className="w-px h-4 bg-primary/30" />
                <span className="text-muted-foreground">{dependencies?.vision?.status ? `VISION ${dependencies.vision.status.toUpperCase()}` : "SYSTEM STATUS PENDING"}</span>
              </div>
            </motion.div>

            <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
              className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold leading-[0.9] mb-8 tracking-tight uppercase">
              <motion.span className="block" style={{ y: springY }}>
                <Typewriter text="AI-POWERED SMART" delay={800} />
              </motion.span>
              <motion.span 
                className="block text-gradient mt-2"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% auto" }}
              >
                <Typewriter text="TRAFFIC MANAGEMENT" delay={2000} />
              </motion.span>
            </motion.h1>

            <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed font-body">
              Nexus Grid Logic provides a next-generation real-time traffic monitoring, predictive analysis, and intelligent signal routing platform designed exclusively for Bangalore.
            </motion.p>

            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="flex flex-wrap justify-center gap-4 mb-20">
              <Link to="/login">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 h-14 px-10 text-base font-heading tracking-wider group">
                  LAUNCH PLATFORM
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </Button>
              </Link>
              <a href="#preview">
                <Button size="lg" variant="outline" className="border-border/50 text-foreground hover:bg-secondary/50 h-14 px-10 text-base backdrop-blur-sm font-heading tracking-wider">
                  EXPLORE FEATURES
                </Button>
              </a>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {liveStats.map((s, i) => (
                <motion.div key={s.label} variants={fadeUp} custom={i + 4}
                  className="glass rounded-2xl p-5 text-center card-hover"
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <div className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-1">
                    <AnimatedCounter value={s.value} />
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground tracking-[0.25em]">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-muted-foreground"
        >
          <span className="text-[10px] font-mono tracking-[0.3em] uppercase">Scroll</span>
          <ChevronDown className="w-5 h-5 text-primary" />
        </motion.div>
      </section>

      {/* Tech Features Strip with parallax */}
      <section className="py-20 border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-30" />
        <motion.div style={{ y: featuresParallax }} className="absolute inset-0 starfield opacity-10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-3 gap-10">
            {techFeatures.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeUp} custom={i}
                className="flex items-start gap-5 group"
                whileHover={{ x: 8 }}
              >
                <motion.div 
                  className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"
                  whileHover={{ rotate: 10, scale: 1.1 }}
                >
                  <f.icon className="w-7 h-7 text-primary" />
                </motion.div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground text-base tracking-wide mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bangalore Intelligence Section */}
      <section ref={bangaloreRef} id="bangalore" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-20" />
        <FloatingOrb delay={1} x="60%" y="20%" size="450px" color="bg-cyan/10" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <span className="text-xs font-mono text-cyan tracking-[0.3em] uppercase mb-4 block">Hyper-Local Context</span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight uppercase">BANGALORE TRAFFIC Intelligence</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Custom-tuned to handle the unique mobility challenges of Bangalore. From Silk Board congestion to Outer Ring Road snarls, the AI continuously ingests city-wide telemetry to orchestrate movement.</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="max-w-4xl mx-auto glass rounded-3xl p-8 relative holographic-border"
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan/20 border border-cyan/30 flex items-center justify-center">
                    <Map className="w-6 h-6 text-cyan" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-xl text-foreground">City Grid Integration</h3>
                    <p className="text-sm text-muted-foreground">Mapping & monitoring major arteries</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Our system is deployed specifically for Bangalore's topology, integrating data from pivotal junctions including: 
                  <span className="text-foreground font-semibold"> Silk Board Junction, KR Puram, Electronic City, and the Outer Ring Road</span>.
                </p>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
                  <div>
                    <div className="text-2xl font-bold font-heading text-foreground block">3.2M+</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Vehicles Tracked</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-heading text-success block">-24%</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Wait Time</div>
                  </div>
                </div>
              </div>
              <div className="relative h-64 md:h-full min-h-[300px] rounded-2xl overflow-hidden border border-border/50 bg-black/40 flex flex-col items-center justify-center p-6 text-center">
                <ActivitySquare className="w-16 h-16 text-cyan mb-4 animate-pulse opacity-80" />
                <h4 className="font-heading font-bold text-lg text-foreground mb-2">Live Topography Mapping</h4>
                <p className="text-sm text-muted-foreground">The platform visualizes the Bangalore grid dynamically, applying generative insights to real-world traffic intersections.</p>
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-cyan shadow-[0_0_10px_rgba(0,255,255,0.8)]"
                    animate={{ width: ["10%", "90%", "10%"] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Platform Features Preview */}
      <section ref={previewRef} id="preview" className="py-32 relative overflow-hidden bg-secondary/5">
        <div className="absolute inset-0 starfield opacity-15" />
        <FloatingOrb delay={2} x="10%" y="10%" size="600px" color="bg-primary/5" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-24">
            <motion.span className="inline-block text-xs font-mono text-primary tracking-[0.3em] uppercase mb-4">Platform Capabilities</motion.span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight uppercase">WHAT'S INSIDE</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Log in to unlock a comprehensive suite of AI management tools engineered exclusively for urban mobility coordinators.</p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {platformFeatures.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeUp} custom={i}
                className="glass rounded-3xl p-8 card-hover flex flex-col h-full relative group overflow-hidden border border-border/40 hover:border-primary/30 transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl ${f.bg} border border-[currentcolor]/20 flex items-center justify-center mb-6 ${f.color} group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className="w-7 h-7" />
                </div>
                <h3 className="font-heading font-bold text-foreground text-xl mb-3 tracking-wide">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm flex-grow">{f.desc}</p>
                <div className="mt-8 flex items-center gap-2 text-xs font-heading tracking-widest text-[#888] group-hover:text-foreground transition-colors uppercase">
                  Explore <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <Link to="/login">
              <Button size="lg" className="bg-transparent border border-primary text-primary hover:bg-primary/10 transition-all duration-300 glow-primary h-14 px-10 text-sm font-heading tracking-widest uppercase">
                Access Platform <PlayCircle className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Outline */}
      <section ref={featuresRef} id="features" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 starfield opacity-15" />
        <FloatingOrb delay={3} x="80%" y="20%" size="250px" color="bg-cyan/10" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-24">
            <motion.span className="inline-block text-xs font-mono text-primary tracking-[0.3em] uppercase mb-4">Core Technology</motion.span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight uppercase">NEURAL CAPABILITIES</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg">Core control, prediction, sensing, and emergency-response capabilities operating from live data.</p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeUp} custom={i}
                className="glass rounded-3xl p-10 card-hover group relative overflow-hidden"
                whileHover={{ y: -8 }}
              >
                <motion.div 
                  className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${f.gradient} opacity-40 group-hover:opacity-100 transition-opacity duration-500`}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.15 }}
                  style={{ transformOrigin: "left" }}
                />
                <motion.div 
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 group-hover:glow-primary transition-shadow duration-500"
                  whileHover={{ rotate: 15, scale: 1.1 }}
                >
                  <f.icon className="w-8 h-8 text-primary" />
                </motion.div>
                <h3 className="font-heading font-bold text-foreground text-xl mb-4 tracking-wide uppercase">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-base">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative overflow-hidden border-t border-border/20">
        <div className="absolute inset-0 starfield opacity-30" />
        <FloatingOrb delay={0} x="40%" y="30%" size="500px" color="bg-primary/15" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-5xl md:text-7xl font-heading font-bold mb-8 tracking-tight uppercase">
              READY TO <span className="text-gradient">TAKE CONTROL?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
              Step into the command center and revolutionize how city intersections operate.
            </p>
            <Link to="/login">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-3 h-16 px-12 text-lg font-heading tracking-wider">
                  <Rocket className="w-6 h-6" /> ACCESS COMMAND SYSTEM
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 relative">
        <div className="absolute inset-0 gradient-mesh opacity-15" />
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted-foreground relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <span className="font-logo font-bold text-foreground tracking-wider text-lg">NEXUS GRID LOGIC</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-foreground transition-colors uppercase font-heading text-xs tracking-wider">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors uppercase font-heading text-xs tracking-wider">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors uppercase font-heading text-xs tracking-wider">Documentation</a>
          </div>
          <p className="font-mono text-xs">© 2026 Nexus Grid Logic</p>
        </div>
      </footer>
    </div>
  );
}
