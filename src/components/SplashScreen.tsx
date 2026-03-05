import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-6"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      onAnimationComplete={undefined}
    >
      {/* Background effects */}
      <div className="absolute inset-0 gradient-mesh opacity-60" />
      <div className="absolute inset-0 starfield opacity-40" />

      {/* Logo */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-5"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center glow-primary"
          animate={{ rotate: [0, 90, 180, 270, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Activity className="w-10 h-10 text-primary" />
        </motion.div>

        <motion.h1
          className="text-3xl font-logo font-bold tracking-wider text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          TRAFFICAI
        </motion.h1>

        {/* Loading bar */}
        <motion.div
          className="w-48 h-1 rounded-full bg-secondary overflow-hidden mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-cyan to-nebula rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.8, delay: 0.6, ease: "easeInOut" }}
            onAnimationComplete={onComplete}
          />
        </motion.div>

        <motion.p
          className="text-xs font-mono text-muted-foreground tracking-[0.2em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0.5, 1] }}
          transition={{ delay: 0.7, duration: 2, repeat: Infinity }}
        >
          INITIALIZING NEURAL NETWORK
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
