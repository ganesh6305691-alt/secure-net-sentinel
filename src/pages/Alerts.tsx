import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });

  useEffect(() => {
    if (!user) return;
    fetchAlerts();

    const channel = supabase
      .channel("alerts-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAlerts(data);
      
      // Calculate stats
      const newStats = {
        total: data.length,
        unread: data.filter(a => !a.is_read).length,
        critical: data.filter(a => a.severity === 'critical').length,
        high: data.filter(a => a.severity === 'high').length,
        medium: data.filter(a => a.severity === 'medium').length,
        low: data.filter(a => a.severity === 'low').length
      };
      setStats(newStats);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;

      toast.success("Alert marked as read");
      fetchAlerts();
    } catch (error: any) {
      console.error("Error marking alert as read:", error);
      toast.error(error.message);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-threat-critical",
      high: "bg-threat-high",
      medium: "bg-threat-medium",
      low: "bg-threat-low",
      info: "bg-threat-info",
    };
    return colors[severity] || "bg-muted";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
            Security Alerts
          </h1>
          <p className="text-muted-foreground">
            Real-time notifications for ALL detected threats and anomalies
          </p>
        </div>

        {/* Alert Statistics */}
        {!isLoading && alerts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Alerts</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.unread}</div>
                <div className="text-xs text-muted-foreground">Unread</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-critical/10 to-threat-critical/5 border-threat-critical/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-threat-critical">{stats.critical}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-high/10 to-threat-high/5 border-threat-high/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-threat-high">{stats.high}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-medium/10 to-threat-medium/5 border-threat-medium/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-threat-medium">{stats.medium}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-threat-low/10 to-threat-low/5 border-threat-low/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-threat-low">{stats.low}</div>
                <div className="text-xs text-muted-foreground">Low</div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">No alerts yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card
                key={alert.id}
                className={`bg-gradient-to-br from-card to-card/50 border-border/50 ${
                  !alert.is_read ? "ring-2 ring-primary/20" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        {!alert.is_read && (
                          <Badge variant="outline" className="border-primary text-primary">
                            New
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{alert.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(alert.created_at), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsRead(alert.id)}
                        className="gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Mark Read
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{alert.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
