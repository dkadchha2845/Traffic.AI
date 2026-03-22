import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { User, Mail, Building, Shield, Camera, Save, MapPin, Globe, Briefcase, Lock, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Display name is required").max(100, "Display name must be under 100 characters"),
  department: z.string().trim().max(100, "Department must be under 100 characters"),
  role: z.string().trim().max(100, "Role must be under 100 characters"),
});

const fadeIn = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [role, setRole] = useState(profile?.role || "");
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
      setDepartment(profile.department || "");
      setRole(profile.role || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload avatar");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error("Failed to update profile");
    } else {
      setAvatarUrl(publicUrl);
      await refreshProfile();
      toast.success("Avatar updated!");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    const result = profileSchema.safeParse({
      display_name: displayName,
      department,
      role,
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
    const { error } = await supabase.auth.updateUser({ email: newEmail });
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
          <p className="text-muted-foreground text-sm">Manage your identity and preferences</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-8 text-center">
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
            <p className="text-sm text-primary font-mono">{role || "Traffic Engineer"}</p>
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Level {profile?.access_level || 1} Clearance</span>
            </div>
            {uploading && <p className="text-xs text-primary mt-4 animate-pulse font-mono">Uploading...</p>}
          </motion.div>

          {/* Profile Form */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2 glass rounded-2xl p-8 space-y-6">
            <h3 className="font-heading font-semibold text-foreground tracking-wide flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> PERSONAL INFORMATION
            </h3>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={user?.email || ""} readOnly
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/30 border border-border/30 text-muted-foreground text-sm cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Traffic Engineer"
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2">Department</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Sector 7 HQ"
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary gap-2 font-heading tracking-wider text-xs h-11 px-6">
                <Save className="w-4 h-4" /> {saving ? "SAVING..." : "SAVE PROFILE"}
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
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-[0.15em]">Change Email</h4>
              <p className="text-xs text-muted-foreground">Current: <span className="text-foreground">{user?.email}</span></p>
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
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-[0.15em]">Change Password</h4>
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

        {/* Stats Row */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Role", value: role || "Unassigned", icon: Briefcase },
            { label: "Access", value: `Level ${profile?.access_level || 1}`, icon: Shield },
            { label: "Department", value: department || "Unassigned", icon: MapPin },
            { label: "Email Status", value: user?.email_confirmed_at ? "Verified" : "Pending", icon: Globe },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5 text-center card-hover">
              <s.icon className="w-6 h-6 text-primary mx-auto mb-3" />
              <div className="text-2xl font-heading font-bold text-foreground">{s.value}</div>
              <div className="text-xs font-mono text-muted-foreground tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
