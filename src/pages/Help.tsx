import { motion } from "framer-motion";
import { BookOpen, Search, ExternalLink, ChevronRight, Cpu, Brain, BarChart3, Shield, Zap, Globe } from "lucide-react";
import { useState } from "react";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const categories = [
  {
    title: "Getting Started",
    icon: Zap,
    articles: [
      { title: "Quick Start Guide", desc: "Launch your first traffic simulation in under 5 minutes." },
      { title: "Understanding the Dashboard", desc: "Overview of all command center components and real-time data." },
      { title: "Setting Up Your Profile", desc: "Configure your operator credentials and notification preferences." },
    ]
  },
  {
    title: "AI Agents",
    icon: Brain,
    articles: [
      { title: "Multi-Agent Architecture", desc: "How our 6 specialized agents work together to optimize traffic." },
      { title: "Training the LearningAgent", desc: "Configure reward functions and training cycles for your model." },
      { title: "Agent Communication Protocol", desc: "Understanding JSON payload exchange between autonomous agents." },
    ]
  },
  {
    title: "Analytics & Reports",
    icon: BarChart3,
    articles: [
      { title: "Reading the Heatmap", desc: "Interpret congestion patterns across your city grid." },
      { title: "AI vs Traditional Comparison", desc: "How we benchmark agentic RL models against fixed-timing controls." },
      { title: "Exporting Reports", desc: "Generate PDF reports for stakeholders and city planners." },
    ]
  },
  {
    title: "System Administration",
    icon: Shield,
    articles: [
      { title: "API Key Management", desc: "Generate, rotate, and revoke API tokens for secure integration." },
      { title: "Emergency Override Protocol", desc: "Procedures for activating green-wave corridors." },
      { title: "Sensor Calibration", desc: "Maintain LiDAR, camera, and radar sensor accuracy." },
    ]
  },
];

const faqs = [
  { q: "How does the AI decide signal timing?", a: "Our DecisionAgent uses reinforcement learning with a reward function optimized for throughput, waiting time, and fuel efficiency. It processes real-time sensor data and historical patterns to make sub-millisecond adjustments." },
  { q: "Can I override AI decisions manually?", a: "Yes. Authorized operators can trigger Emergency Override from the dashboard. The system provides green-wave corridors while maintaining safe signal transitions at surrounding intersections." },
  { q: "How accurate are traffic predictions?", a: "Our AnalyticsAgent achieves 94% accuracy for 30-minute predictions and 87% for 60-minute forecasts, trained on your city's specific traffic patterns." },
  { q: "Is the data encrypted?", a: "All data is encrypted at rest and in transit using AES-256. Row-level security ensures operators only see data from their authorized sectors." },
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto max-w-5xl space-y-8 relative z-10">
        {/* Header */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="text-center pt-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-heading font-bold tracking-wide mb-3">DOCUMENTATION</h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">Everything you need to master the neural traffic command system.</p>

          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" placeholder="Search documentation..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-2xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm backdrop-blur-sm" />
          </div>
        </motion.div>

        {/* Categories */}
        <div className="grid md:grid-cols-2 gap-6">
          {categories.map((cat, ci) => (
            <motion.div key={cat.title} variants={fadeIn} initial="hidden" whileInView="visible" viewport={{ once: true }}
              transition={{ delay: ci * 0.1 }}
              className="glass rounded-2xl p-6 card-hover">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <cat.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-foreground tracking-wide">{cat.title}</h3>
              </div>
              <div className="space-y-3">
                {cat.articles.map((article) => (
                  <button key={article.title} className="w-full text-left flex items-center gap-3 bg-secondary/30 rounded-xl px-4 py-3 border border-border/20 hover:border-primary/30 hover:bg-secondary/50 transition-all group">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{article.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{article.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <motion.div variants={fadeIn} initial="hidden" whileInView="visible" viewport={{ once: true }} className="glass rounded-2xl p-8">
          <h2 className="text-2xl font-heading font-bold tracking-wide mb-6">FAQ</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-border/20 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                  <span className="font-medium text-foreground text-sm">{faq.q}</span>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/10 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
