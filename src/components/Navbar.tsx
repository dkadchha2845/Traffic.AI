import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, Search, Bell, Menu, X, Map, FileText, HelpCircle, User, Settings, LogOut, ChevronDown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = [
  { to: "/dashboard", label: "Command" },
  { to: "/analytics", label: "Analytics" },
  { to: "/agents", label: "Agents" },
  { to: "/bangalore", label: "Bangalore" },
  { to: "/cameras", label: "Cameras" },
  { to: "/map", label: "Map" },
  { to: "/twin", label: "3D Twin" },
  { to: "/predict", label: "Predict" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = location.pathname === "/";
  const isLogin = location.pathname === "/login";
  const { session, user: authUser, profile, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!authUser) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: authUser.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [authUser]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center glow-primary">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <span className="font-logo font-bold text-sm text-foreground tracking-[0.15em]">TRAFFICAI</span>
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {isLanding || isLogin ? (
            <>
              <a href="/#features" className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-heading tracking-wider">FEATURES</a>
              <a href="/#pricing" className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-heading tracking-wider">PRICING</a>
            </>
          ) : (
            navLinks.map((link) => (
              <Link key={link.to} to={link.to}
                className={`px-3 py-2 text-xs font-heading tracking-wider rounded-lg transition-all ${location.pathname === link.to ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                  }`}>{link.label.toUpperCase()}</Link>
            ))
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {session && !isLanding && !isLogin && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search..."
                  className="h-9 pl-9 pr-4 rounded-xl bg-secondary/50 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-40 backdrop-blur-sm" />
              </div>
              <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
              </Link>
              <Link to="/help" className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </Link>
            </>
          )}
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary/50 transition-colors outline-none">
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground hidden lg:block font-mono max-w-[100px] truncate">{profile?.display_name || "Operator"}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground hidden lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 glass-strong border-border/50">
                <div className="px-3 py-2">
                  <p className="text-xs font-heading tracking-wider text-foreground">{profile?.display_name || "Operator"}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{profile?.role || "Traffic Engineer"}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs font-heading tracking-wider">
                  <Link to="/profile"><User className="w-3.5 h-3.5" /> PROFILE</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs font-heading tracking-wider">
                  <Link to="/settings"><Settings className="w-3.5 h-3.5" /> SETTINGS</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs font-heading tracking-wider text-amber-400 focus:text-amber-400">
                    <Link to="/admin"><Shield className="w-3.5 h-3.5" /> ADMIN</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-xs font-heading tracking-wider text-destructive focus:text-destructive">
                  <LogOut className="w-3.5 h-3.5" /> LOGOUT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs font-heading tracking-wider">LOG IN</Button></Link>
              <Link to="/login"><Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary text-xs font-heading tracking-wider h-8">LAUNCH</Button></Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass-strong border-t border-border/30 p-4 space-y-2 animate-fade-in">
          {session ? (
            <>
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2 text-xs font-heading tracking-wider rounded-lg ${location.pathname === link.to ? "text-primary bg-primary/10" : "text-muted-foreground"
                    }`}>{link.label.toUpperCase()}</Link>
              ))}
              <Link to="/notifications" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-xs font-heading tracking-wider text-muted-foreground">NOTIFICATIONS</Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-xs font-heading tracking-wider text-muted-foreground">PROFILE</Link>
              <Link to="/help" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-xs font-heading tracking-wider text-muted-foreground">HELP</Link>
              <Button variant="outline" onClick={handleLogout} className="w-full mt-2 border-primary/30 text-primary font-heading tracking-wider text-xs">LOGOUT</Button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block">
              <Button className="w-full bg-primary text-primary-foreground font-heading tracking-wider text-xs">LAUNCH</Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
