import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User, Mail, Camera, Save, Lock, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Display name is required").max(100, "Display name must be under 100 characters"),
});

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Sync local state when profile loads/changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload avatar");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    // Add timestamp for cache busting
    const finalUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: finalUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error("Failed to update profile");
    } else {
      setAvatarUrl(finalUrl);
      await refreshProfile();
      toast.success("Avatar updated!");
    }
    setUploading(false);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', user.id);

    if (error) {
      toast.error("Failed to remove avatar");
    } else {
      setAvatarUrl("");
      await refreshProfile();
      toast.success("Avatar removed");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    const result = profileSchema.safeParse({
      display_name: displayName,
    });

    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Invalid input";
      toast.error(firstError);
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update(result.data)
      .eq('user_id', user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      await refreshProfile();
      toast.success("Profile saved!");
    }
    setSaving(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail) return toast.error("Enter a new email address");
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/auth-verify` }
    );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation sent to both old and new email. Check your inbox.");
      setNewEmail("");
    }
    setChangingEmail(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) return toast.error("Fill in all password fields");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto max-w-4xl space-y-6 relative z-10">
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <h1 className="text-3xl font-heading font-bold tracking-wide">OPERATOR PROFILE</h1>
          <p className="text-muted-foreground text-sm">Manage your identity and security settings</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-8 text-center h-fit">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-32 h-32 rounded-full bg-primary/10 border-2 border-primary/30 overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-primary/50" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors glow-primary"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <h3 className="font-heading font-bold text-foreground tracking-wide">{displayName || "Operator"}</h3>
            <p className="text-sm text-muted-foreground font-mono mt-1">{user?.email}</p>
            {avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="mt-4 text-xs font-mono text-destructive hover:text-destructive/80 transition-colors uppercase tracking-wider block mx-auto py-1 px-2 rounded-lg hover:bg-destructive/5"
              >
                Remove Photo
              </button>
            )}
            {uploading && <p className="text-xs text-primary mt-4 animate-pulse font-mono uppercase tracking-widest">Processing...</p>}
          </motion.div>

          {/* Profile Form */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-8 space-y-6">
            <h3 className="font-heading font-semibold text-foreground tracking-wide flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> ACCOUNT DETAILS
            </h3>

            <div className="grid gap-5">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Login Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={user?.email || ""} readOnly
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/30 border border-border/30 text-muted-foreground text-sm cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-xs h-11 px-6">
                <Save className="w-4 h-4" /> {saving ? "SAVING..." : "SAVE CHANGES"}
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Security Section */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-8 space-y-6">
          <h3 className="font-heading font-semibold text-foreground tracking-wide flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> SECURITY SETTINGS
          </h3>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Change Email */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-[0.15em]">Update Email</h4>
              <p className="text-xs text-muted-foreground">Verification required for changes</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
              </div>
              <Button onClick={handleChangeEmail} disabled={changingEmail} className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-xs h-10 px-5">
                <Mail className="w-4 h-4" /> {changingEmail ? "SENDING..." : "UPDATE EMAIL"}
              </Button>
            </div>

            {/* Change Password */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-[0.15em]">Reset Password</h4>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
              </div>
              <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-xs h-10 px-5">
                <Lock className="w-4 h-4" /> {changingPassword ? "UPDATING..." : "CHANGE PASSWORD"}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
