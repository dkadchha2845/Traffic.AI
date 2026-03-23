import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, KeyRound, CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface TwoFactorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TwoFactorModal({ isOpen, onClose, onSuccess }: TwoFactorModalProps) {
  const [step, setStep] = useState<"loading" | "qr" | "verify" | "success">("loading")
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setStep("loading")
      setError(null)
      setVerificationCode("")
      enrollMFA()
    } else {
      // Cleanup if user closes without finishing
      if (factorId && step !== "success") {
        supabase.auth.mfa.unenroll({ factorId })
      }
    }
  }, [isOpen])

  const enrollMFA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      })

      if (error) throw error

      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStep("qr")
    } catch (err: any) {
      console.error("MFA Enrollment Error:", err)
      setError(err.message || "Failed to initialize 2FA. Please try again.")
      setStep("qr") // So we can show the error state in the modal
    }
  }

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code.")
      return
    }

    if (!factorId) return

    setIsVerifying(true)
    setError(null)

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verificationCode
      })

      if (verify.error) throw verify.error

      setStep("success")
      toast.success("Two-Factor Authentication enabled successfully!")
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)
    } catch (err: any) {
      console.error("MFA Verification Error:", err)
      setError(err.message || "Invalid code. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // If closing manually, we rely on the useEffect cleanup to unenroll incomplete factors
      if (!open && step !== "success") onClose()
    }}>
      <DialogContent className="sm:max-w-md glass border-border/20 text-foreground bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Shield className="w-5 h-5 text-warning" /> 
            Setup Two-Factor Authentication
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enhance your account security using an authenticator app.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <AnimatePresence mode="wait">
            {step === "loading" && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">Generating secure tokens...</p>
              </motion.div>
            )}

            {step === "qr" && !error && qrCode && (
              <motion.div 
                key="qr"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white p-4 rounded-xl shadow-inner w-fit mx-auto border-4 border-muted overflow-hidden flex items-center justify-center">
                  <div dangerouslySetInnerHTML={{ __html: qrCode }} className="[&>svg]:max-w-[200px] [&>svg]:h-auto" />
                </div>
                
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground font-medium">Scan this QR code with your authenticator app</p>
                  <p className="text-xs text-muted-foreground">Supported apps: Google Authenticator, Authy, Microsoft Authenticator, 1Password, etc.</p>
                </div>

                <div className="bg-secondary/50 p-3 rounded-lg border border-border/40 text-center">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-mono">Manual Entry Secret</p>
                  <code className="text-sm font-mono text-primary font-bold break-all select-all">{secret}</code>
                </div>

                <div className="pt-2">
                  <Button onClick={() => setStep("verify")} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl">
                    I have scanned the code
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "verify" && (
              <motion.div 
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2 text-center mb-6">
                  <KeyRound className="w-12 h-12 text-accent mx-auto mb-4 opacity-80" />
                  <p className="text-sm text-foreground font-medium">Enter the 6-digit code</p>
                  <p className="text-xs text-muted-foreground">Please enter the code generated by your authenticator app to verify setup.</p>
                </div>

                <div className="space-y-4">
                  <Input 
                    type="text" 
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d*"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-3xl tracking-[0.5em] font-mono h-16 bg-black/40 border-border/50 focus-visible:ring-accent"
                  />

                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep("qr")} className="w-full border-border/40 hover:bg-secondary/50">
                      Back
                    </Button>
                    <Button 
                      onClick={handleVerify} 
                      disabled={isVerifying || verificationCode.length !== 6}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {error && step === "qr" && (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 gap-4 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Setup Failed</h3>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" onClick={onClose} className="mt-2">Close</Button>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center text-success mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Security Upgraded</h3>
                  <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">Two-Factor Authentication has been successfully enabled for your account.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
