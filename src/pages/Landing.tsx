import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Zap, BarChart3, Shield, Check, Activity, Rocket, Globe, Satellite, ChevronDown, Quote, Star } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, Suspense, lazy, useEffect, useState } from "react";

const Starfield = lazy(() => import("@/components/Starfield"));
const Globe3D = lazy(() => import("@/components/Globe3D"));

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.8, ease: "easeOut" as const } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const stats = [
  { value: "99.9%", label: "UPTIME", icon: "🟢" },
  { value: "10k+", label: "ACTIVE NODES", icon: "⚡" },
  { value: "0.02s", label: "RESPONSE", icon: "🔮" },
  { value: "45%", label: "REDUCTION", icon: "📉" },
];

const features = [
  { icon: Brain, title: "Neural Intelligence", desc: "Autonomous agents manage intersections independently, forming a self-healing mesh network across the city grid.", gradient: "from-primary to-nebula" },
  { icon: Zap, title: "Quantum Optimization", desc: "Sub-millisecond signal adjustments powered by predictive models analyzing 50+ real-time data streams.", gradient: "from-cyan to-accent" },
  { icon: BarChart3, title: "Precognitive Modeling", desc: "Forecast congestion 60 minutes ahead using temporal pattern analysis and generative traffic simulations.", gradient: "from-accent to-primary" },
  { icon: Shield, title: "Emergency Override", desc: "Instant green-wave corridors for emergency vehicles with AI-coordinated rerouting of all surrounding traffic.", gradient: "from-success to-cyan" },
];

const plans = [
  { name: "Colony", price: "$499", features: ["5 Smart Intersections", "Basic Traffic Analytics", "Email Support"], cta: "Get Started", popular: false },
  { name: "Metropolis", price: "$1,499", features: ["50 Smart Intersections", "Predictive AI Models", "Priority 24/7 Support", "Full API Access"], cta: "Deploy Now", popular: true },
  { name: "Orbital", price: "$4,999", features: ["Unlimited Intersections", "Custom AI Training", "Dedicated Engineer", "White-label Solution"], cta: "Contact Sales", popular: false },
];

const techFeatures = [
  { icon: Satellite, title: "Multi-Sensor Fusion", desc: "LiDAR, cameras, radar, and IoT sensors fused into a unified real-time traffic perception layer." },
  { icon: Globe, title: "Edge Computing", desc: "Process decisions at the edge with <5ms latency. No cloud dependency for critical operations." },
  { icon: Rocket, title: "Auto-Scaling", desc: "From 5 intersections to 50,000. Our architecture scales horizontally with zero downtime." },
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
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
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

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, scale: heroScale, x: springX, rotateY: useTransform(springX, [-15, 15], [-1, 1]) }} className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-mono mb-10 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                NEURAL NETWORK ONLINE
                <span className="w-px h-4 bg-primary/30" />
                <span className="text-muted-foreground">SYSTEMS OPERATIONAL</span>
              </div>
            </motion.div>

            <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
              className="text-6xl md:text-8xl lg:text-9xl font-heading font-bold leading-[0.85] mb-8 tracking-tight">
              <motion.span className="block" style={{ y: springY }}>
                <Typewriter text="TRAFFIC" delay={800} />
              </motion.span>
              <motion.span 
                className="block text-gradient"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% auto" }}
              >
                <Typewriter text="REIMAGINED" delay={1500} />
              </motion.span>
            </motion.h1>

            <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed font-body">
              Orchestrate city movement with autonomous agentic AI. Reduce congestion by 45% and unlock real-time efficiency at planetary scale.
            </motion.p>

            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="flex flex-wrap justify-center gap-4 mb-20">
              <Link to="/dashboard">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 h-14 px-10 text-base font-heading tracking-wider group">
                  LAUNCH COMMAND 
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </Button>
              </Link>
              <Link to="/analytics">
                <Button size="lg" variant="outline" className="border-border/50 text-foreground hover:bg-secondary/50 h-14 px-10 text-base backdrop-blur-sm font-heading tracking-wider">
                  VIEW DEMO
                </Button>
              </Link>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((s, i) => (
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

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-muted-foreground"
        >
          <span className="text-[10px] font-mono tracking-[0.3em] uppercase">Explore</span>
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

      {/* Interactive 3D Globe */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-20" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <span className="text-xs font-mono text-primary tracking-[0.3em] uppercase mb-4 block">Global Network</span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight">PLANETARY COVERAGE</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg">Real-time traffic intelligence deployed across 12 major metropolitan areas.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-[380px] md:h-[450px] max-w-3xl mx-auto"
          >
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              </div>
            }>
              <Globe3D />
            </Suspense>
          </motion.div>
        </div>
      </section>

      {/* Features with staggered parallax */}
      <section ref={featuresRef} id="features" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 starfield opacity-15" />
        <FloatingOrb delay={1} x="5%" y="50%" size="300px" color="bg-nebula/10" />
        <FloatingOrb delay={3} x="80%" y="20%" size="250px" color="bg-cyan/10" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-24">
            <motion.span 
              className="inline-block text-xs font-mono text-primary tracking-[0.3em] uppercase mb-4"
              initial={{ opacity: 0, letterSpacing: "0.1em" }}
              whileInView={{ opacity: 1, letterSpacing: "0.3em" }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              What We Offer
            </motion.span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight">NEURAL CAPABILITIES</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg">Four autonomous systems working in concert to transform urban mobility.</p>
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
                <h3 className="font-heading font-bold text-foreground text-xl mb-4 tracking-wide">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-base">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <FloatingOrb delay={2} x="20%" y="70%" size="350px" color="bg-primary/10" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-24">
            <span className="text-xs font-mono text-primary tracking-[0.3em] uppercase mb-4 block">Pricing</span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight">DEPLOYMENT TIERS</h2>
            <p className="text-muted-foreground text-lg">Scale from a single district to a full planetary infrastructure.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={plan.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className={`glass rounded-3xl p-10 card-hover relative ${plan.popular ? "holographic-border glow-primary" : ""}`}
                whileHover={{ y: -10, scale: 1.02 }}
              >
                {plan.popular && (
                  <motion.span 
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-heading font-bold tracking-wider"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    RECOMMENDED
                  </motion.span>
                )}
                <h3 className="font-heading font-bold text-foreground text-lg mb-3 tracking-wider">{plan.name}</h3>
                <div className="mb-10">
                  <span className="text-5xl font-heading font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <ul className="space-y-4 mb-12">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button className={`w-full h-12 font-heading tracking-wider ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 starfield opacity-10" />
        <FloatingOrb delay={1} x="75%" y="40%" size="300px" color="bg-cyan/10" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-24">
            <span className="text-xs font-mono text-primary tracking-[0.3em] uppercase mb-4 block">Social Proof</span>
            <h2 className="text-4xl md:text-6xl font-heading font-bold mb-5 tracking-tight">TRUSTED WORLDWIDE</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">Traffic engineers and city planners across 12 countries rely on our platform.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Dr. Sarah Chen", role: "Chief Traffic Engineer, Singapore", quote: "TrafficAI reduced our average commute by 23 minutes during peak hours. It's nothing short of revolutionary.", avatar: "SC", stars: 5 },
              { name: "Marcus Hoffmann", role: "Smart City Director, Berlin", quote: "The neural prediction engine is eerily accurate. We prevented 340 potential gridlocks last quarter before they even formed.", avatar: "MH", stars: 5 },
              { name: "Aisha Patel", role: "Urban Mobility Lead, Mumbai", quote: "Deploying across 200+ intersections was seamless. Our emergency vehicle response time dropped by 45%.", avatar: "AP", stars: 5 },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="glass rounded-3xl p-8 card-hover relative group"
                whileHover={{ y: -8 }}
              >
                <Quote className="w-8 h-8 text-primary/20 mb-4" />
                <p className="text-muted-foreground leading-relaxed mb-8 text-sm">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: t.stars }).map((_, si) => (
                    <Star key={si} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm font-heading font-bold text-primary">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-heading font-semibold text-foreground text-sm tracking-wide">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
                <motion.div
                  className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-cyan opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-t-3xl"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 starfield opacity-30" />
        <FloatingOrb delay={0} x="40%" y="30%" size="500px" color="bg-primary/15" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-5xl md:text-7xl font-heading font-bold mb-8 tracking-tight">
              READY TO <span className="text-gradient">LAUNCH?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
              Join the next generation of smart city infrastructure. Deploy in minutes, not months.
            </p>
            <Link to="/login">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-3 h-16 px-12 text-lg font-heading tracking-wider">
                  <Rocket className="w-6 h-6" /> GET STARTED FREE
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
            <span className="font-logo font-bold text-foreground tracking-wider text-lg">TRAFFICAI</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
          </div>
          <p className="font-mono text-xs">© 2026 TrafficAI Systems</p>
        </div>
      </footer>
    </div>
  );
}
