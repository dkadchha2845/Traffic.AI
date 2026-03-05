import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Shield,
  Search,
  Crown,
  UserCog,
  User,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type AppRole = "admin" | "moderator" | "user";

interface UserWithRole {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  department: string | null;
  role: string | null;
  created_at: string;
  app_role: AppRole;
  role_id: string | null;
}

const ROLE_CONFIG: Record<AppRole, { icon: typeof Crown; color: string; label: string }> = {
  admin: { icon: Crown, color: "text-amber-400", label: "Admin" },
  moderator: { icon: UserCog, color: "text-blue-400", label: "Moderator" },
  user: { icon: User, color: "text-muted-foreground", label: "User" },
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error || !data) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);

    // Fetch all profiles (admin RLS policy allows this)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      toast.error("Failed to load roles");
      setLoading(false);
      return;
    }

    const roleMap = new Map(roles?.map((r) => [r.user_id, { role: r.role as AppRole, id: r.id }]));

    const merged: UserWithRole[] = (profiles || []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      department: p.department,
      role: p.role,
      created_at: p.created_at,
      app_role: roleMap.get(p.user_id)?.role || "user",
      role_id: roleMap.get(p.user_id)?.id || null,
    }));

    setUsers(merged);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (targetUserId: string, newRole: AppRole) => {
    if (targetUserId === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }

    setUpdatingUserId(targetUserId);
    const target = users.find((u) => u.user_id === targetUserId);

    if (target?.role_id) {
      // Delete existing role, then insert new one
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", target.role_id);

      if (deleteError) {
        toast.error("Failed to update role");
        setUpdatingUserId(null);
        return;
      }
    }

    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({ user_id: targetUserId, role: newRole });

    if (insertError) {
      toast.error("Failed to assign new role");
    } else {
      toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`);
      await fetchUsers();
    }
    setUpdatingUserId(null);
  };

  // Access denied view
  if (isAdmin === false) {
    return (
      <div className="min-h-screen pt-20 pb-8 px-4 flex items-center justify-center">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-12 text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">ACCESS DENIED</h2>
          <p className="text-sm text-muted-foreground mb-6">You need administrator privileges to access this page.</p>
          <Button onClick={() => navigate("/dashboard")} className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading tracking-wider text-xs">
            RETURN TO COMMAND
          </Button>
        </motion.div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen pt-20 pb-8 px-4 flex items-center justify-center">
        <div className="text-primary animate-pulse font-mono text-sm">Verifying clearance...</div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      (u.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.department || "").toLowerCase().includes(search.toLowerCase()) ||
      u.app_role.toLowerCase().includes(search.toLowerCase())
  );

  const roleCounts = {
    admin: users.filter((u) => u.app_role === "admin").length,
    moderator: users.filter((u) => u.app_role === "moderator").length,
    user: users.filter((u) => u.app_role === "user").length,
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 relative">
      <div className="absolute inset-0 starfield opacity-10 pointer-events-none" />
      <div className="container mx-auto max-w-6xl space-y-6 relative z-10">
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <h1 className="text-3xl font-heading font-bold tracking-wide">ADMIN COMMAND</h1>
          <p className="text-muted-foreground text-sm">Manage operators and access levels</p>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-5 text-center card-hover">
            <Users className="w-6 h-6 text-primary mx-auto mb-3" />
            <div className="text-2xl font-heading font-bold text-foreground">{users.length}</div>
            <div className="text-xs font-mono text-muted-foreground tracking-wider mt-1">Total Users</div>
          </div>
          {(["admin", "moderator", "user"] as AppRole[]).map((r) => {
            const cfg = ROLE_CONFIG[r];
            return (
              <div key={r} className="glass rounded-2xl p-5 text-center card-hover">
                <cfg.icon className={`w-6 h-6 ${cfg.color} mx-auto mb-3`} />
                <div className="text-2xl font-heading font-bold text-foreground">{roleCounts[r]}</div>
                <div className="text-xs font-mono text-muted-foreground tracking-wider mt-1">{cfg.label}s</div>
              </div>
            );
          })}
        </motion.div>

        {/* User Table */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="glass rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="font-heading font-semibold text-foreground tracking-wide flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> USER MANAGEMENT
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="h-10 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-56"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={loading}
                className="border-primary/30 text-primary font-heading tracking-wider text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> REFRESH
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs font-mono text-muted-foreground tracking-wider">USER</TableHead>
                  <TableHead className="text-xs font-mono text-muted-foreground tracking-wider hidden md:table-cell">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-mono text-muted-foreground tracking-wider hidden sm:table-cell">JOINED</TableHead>
                  <TableHead className="text-xs font-mono text-muted-foreground tracking-wider">ROLE</TableHead>
                  <TableHead className="text-xs font-mono text-muted-foreground tracking-wider text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-mono text-sm animate-pulse">
                      Loading operators...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-mono text-sm">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const cfg = ROLE_CONFIG[u.app_role];
                    const RoleIcon = cfg.icon;
                    const isSelf = u.user_id === user?.id;

                    return (
                      <TableRow key={u.user_id} className="border-border/20 hover:bg-secondary/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-primary/50" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {u.display_name || "Unknown"}
                                {isSelf && <span className="text-[10px] text-primary ml-2 font-mono">(YOU)</span>}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">{u.role || "—"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {u.department || "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground font-mono">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`gap-1 text-[10px] font-mono tracking-wider border-border/50 ${cfg.color}`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {cfg.label.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={u.app_role}
                            onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}
                            disabled={isSelf || updatingUserId === u.user_id}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs font-mono bg-secondary/50 border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="glass-strong border-border/50">
                              <SelectItem value="admin" className="text-xs font-mono">Admin</SelectItem>
                              <SelectItem value="moderator" className="text-xs font-mono">Moderator</SelectItem>
                              <SelectItem value="user" className="text-xs font-mono">User</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
