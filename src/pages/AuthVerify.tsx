import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeIn = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } } };

export default function AuthVerify() {
  const navigate = useNavigate();

  // Optionally, we could read hash parameters here to check for access_token,
  // but Supabase client handles the session automatically on load.

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative flex items-center justify-center">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="relative z-10 w-full max-w-md">
        <div className="glass rounded-2xl p-10 text-center shadow-xl border border-success/30 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-success/20 blur-[50px] rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/20 blur-[50px] rounded-full" />
          
          <div className="relative z-10 space-y-6">
            <div className="w-24 h-24 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">Verification Successful</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your email address has been successfully verified. Your security profile is now updated and synced with the active traffic grid network.
              </p>
            </div>
            
            <div className="pt-6">
              <Button onClick={() => navigate("/dashboard")} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl text-md group">
                Proceed to Dashboard <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
