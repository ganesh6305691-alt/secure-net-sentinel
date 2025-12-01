import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Shield, Home, Upload, AlertTriangle, Users, LogOut, Bell, Lightbulb, Scan } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadAlerts = async () => {
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setUnreadAlerts(count || 0);
    };

    fetchUnreadAlerts();

    const channel = supabase
      .channel("alerts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <span className="font-bold text-xl bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
                  ThreatGuard
                </span>
              </div>

              <div className="hidden md:flex items-center gap-1">
                <NavLink
                  to="/"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  activeClassName="text-foreground bg-muted"
                >
                  <Home className="w-4 h-4 inline-block mr-2" />
                  Dashboard
                </NavLink>

                <NavLink
                  to="/upload"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  activeClassName="text-foreground bg-muted"
                >
                  <Upload className="w-4 h-4 inline-block mr-2" />
                  Upload Logs
                </NavLink>

                <NavLink
                  to="/threats"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  activeClassName="text-foreground bg-muted"
                >
                  <AlertTriangle className="w-4 h-4 inline-block mr-2" />
                  Threats
                </NavLink>

                <NavLink
                  to="/alerts"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors relative"
                  activeClassName="text-foreground bg-muted"
                >
                  <Bell className="w-4 h-4 inline-block mr-2" />
                  Alerts
                  {unreadAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadAlerts}
                    </span>
                  )}
                </NavLink>

                <NavLink
                  to="/solutions"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  activeClassName="text-foreground bg-muted"
                >
                  <Lightbulb className="w-4 h-4 inline-block mr-2" />
                  Solutions
                </NavLink>

                <NavLink
                  to="/auto-scan"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  activeClassName="text-foreground bg-muted"
                >
                  <Scan className="w-4 h-4 inline-block mr-2" />
                  Auto-Scan
                </NavLink>

                {isAdmin && (
                  <NavLink
                    to="/admin"
                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    activeClassName="text-foreground bg-muted"
                  >
                    <Users className="w-4 h-4 inline-block mr-2" />
                    Admin
                  </NavLink>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
