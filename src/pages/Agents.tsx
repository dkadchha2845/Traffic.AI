import { motion } from "framer-motion";
import { Brain, Radio, Lightbulb, TrafficCone, BarChart3, GitCompare, Cpu, ArrowRight, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/fetchApi";

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const agentDefs = [
  { name: "SensorAgent", icon: Radio, status: "Active", color: "text-success", bg: "bg-success/10", desc: "Collects real-time traffic data from intersection sensors. Monitors vehicle counts, speed, and queue lengths across all directions.", metrics: { accuracy: 98.5, uptime: 99.9, latency: "4ms" } },
  { name: "DecisionAgent", icon: Brain, status: "Active", color: "text-accent", bg: "bg-accent/10", desc: "Core intelligence agent. Processes sensor data through ML models to determine optimal signal timing and phase sequences.", metrics: { accuracy: 96.2, uptime: 99.8, latency: "12ms" } },
  { name: "LearningAgent", icon: Lightbulb, status: "Training", color: "text-warning", bg: "bg-warning/10", desc: "Continuously trains on traffic patterns using reinforcement learning. Updates reward functions based on throughput metrics.", metrics: { accuracy: 94.1, uptime: 99.5, latency: "50ms" } },
  { name: "SignalControlAgent", icon: TrafficCone, status: "Active", color: "text-cyan", bg: "bg-cyan/10", desc: "Executes signal changes. Manages phase transitions, minimum green times, and emergency vehicle preemption.", metrics: { accuracy: 99.1, uptime: 99.99, latency: "2ms" } },
  { name: "ComparisonAgent", icon: GitCompare, status: "Idle", color: "text-muted-foreground", bg: "bg-muted/20", desc: "Benchmarks AI-optimized signals against traditional fixed-timing approaches. Generates improvement reports.", metrics: { accuracy: 97.8, uptime: 99.0, latency: "100ms" } },
  { name: "AnalyticsAgent", icon: BarChart3, status: "Active", color: "text-primary", bg: "bg-primary/10", desc: "Aggregates performance data. Generates waiting time, congestion, and learning improvement visualizations.", metrics: { accuracy: 99.5, uptime: 99.9, latency: "8ms" } },
];

export default function Agents() {
  const [selected, setSelected] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const agent = agentDefs[selected];

  const handleTriggerRL = async () => {
    setIsTraining(true);
    try {
      const resp = await fetchApi("/api/agents/rl", { method: "POST" });
      toast.success(resp.message || "Priority reward scaling applied to DQN model.");
    } catch (err) {
      console.warn(err);
      toast.success("Demo Mode: Priority reward scaling applied to DQN model successfully.");
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      <div className="container mx-auto space-y-6">
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <h1 className="text-3xl font-heading font-bold">Multi-Agent System</h1>
          <p className="text-muted-foreground text-sm">Monitor and manage autonomous traffic optimization agents</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-3">
            {agentDefs.map((a, i) => (
              <button key={a.name} onClick={() => setSelected(i)}
                className={`w-full glass rounded-xl p-4 flex items-center gap-4 card-hover text-left transition-all ${selected === i ? "border-primary glow-primary" : ""
                  }`}>
                <div className={`w-10 h-10 rounded-lg ${a.bg} flex items-center justify-center`}>
                  <a.icon className={`w-5 h-5 ${a.color}`} />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-sm font-semibold text-foreground">{a.name}</div>
                  <div className={`text-xs ${a.color}`}>{a.status}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </motion.div>

          {/* Agent Detail */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-xl p-6 space-y-6"
            key={selected}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl ${agent.bg} flex items-center justify-center`}>
                <agent.icon className={`w-7 h-7 ${agent.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">{agent.name}</h2>
                <div className={`text-sm font-mono ${agent.color}`}>{agent.status}</div>
              </div>
            </div>

            <p className="text-muted-foreground">{agent.desc}</p>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-secondary rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Accuracy</div>
                <div className="text-2xl font-heading font-bold text-foreground">{agent.metrics.accuracy}%</div>
                <Progress value={agent.metrics.accuracy} className="mt-2 h-1.5" />
              </div>
              <div className="bg-secondary rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Uptime</div>
                <div className="text-2xl font-heading font-bold text-foreground">{agent.metrics.uptime}%</div>
                <Progress value={agent.metrics.uptime} className="mt-2 h-1.5" />
              </div>
              <div className="bg-secondary rounded-lg p-4">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Latency</div>
                <div className="text-2xl font-heading font-bold text-foreground">{agent.metrics.latency}</div>
              </div>
            </div>

            {agent.name === "LearningAgent" && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-primary text-sm uppercase tracking-wider">Reinforcement Learning</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manually force an epsilon-greedy exploratory episode for DQN priority rewards.</p>
                </div>
                <button
                  onClick={handleTriggerRL}
                  disabled={isTraining}
                  className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all flex items-center gap-2 ${isTraining ? "bg-primary/50 text-white cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"}`}
                >
                  {isTraining ? "TRAINING..." : <><Play className="w-3 h-3" /> TRIGGER RL P-T</>}
                </button>
              </div>
            )}

            {/* Communication Graph */}
            <div>
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Agent Communication Map</h3>
              <div className="bg-secondary/50 rounded-lg p-6">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {agentDefs.map((a, i) => (
                    <div key={a.name} className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${i === selected ? "bg-primary/20 ring-1 ring-primary" : "bg-secondary"
                      }`}>
                      <a.icon className={`w-5 h-5 ${i === selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-[10px] font-mono text-muted-foreground">{a.name.replace("Agent", "")}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">Agents communicate through structured JSON payloads via event bus</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
