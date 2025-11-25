import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle, FileText, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

export default function Index() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalLogs: 0,
    totalThreats: 0,
    criticalThreats: 0,
    unreadAlerts: 0,
  });
  const [threatsByType, setThreatsByType] = useState<any[]>([]);
  const [threatsBySeverity, setThreatsBySeverity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user, isAdmin]);

  const fetchDashboardData = async () => {
    try {
      let logsQuery = supabase.from("logs").select("*", { count: "exact", head: true });
      let threatsQuery = supabase.from("threats").select("*");
      let alertsQuery = supabase.from("alerts").select("*", { count: "exact", head: true }).eq("is_read", false);

      if (!isAdmin) {
        logsQuery = logsQuery.eq("user_id", user!.id);
        alertsQuery = alertsQuery.eq("user_id", user!.id);
      }

      const [logsResult, threatsResult, alertsResult] = await Promise.all([
        logsQuery,
        threatsQuery,
        alertsQuery,
      ]);

      const threats = threatsResult.data || [];
      const criticalCount = threats.filter((t) => t.severity === "critical").length;

      setStats({
        totalLogs: logsResult.count || 0,
        totalThreats: threats.length,
        criticalThreats: criticalCount,
        unreadAlerts: alertsResult.count || 0,
      });

      const typeMap: Record<string, number> = {};
      threats.forEach((t) => {
        typeMap[t.threat_type] = (typeMap[t.threat_type] || 0) + 1;
      });

      const severityMap: Record<string, number> = {};
      threats.forEach((t) => {
        severityMap[t.severity] = (severityMap[t.severity] || 0) + 1;
      });

      setThreatsByType(
        Object.entries(typeMap).map(([name, value]) => ({ name, value }))
      );

      setThreatsBySeverity(
        Object.entries(severityMap).map(([name, value]) => ({ name, value }))
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  const COLORS = {
    critical: "hsl(var(--threat-critical))",
    high: "hsl(var(--threat-high))",
    medium: "hsl(var(--threat-medium))",
    low: "hsl(var(--threat-low))",
    info: "hsl(var(--threat-info))",
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-cyber-glow bg-clip-text text-transparent">
            Threat Detection Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time network security monitoring and threat analysis
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Logs Analyzed
              </CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalLogs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <Activity className="w-3 h-3 inline mr-1" />
                Network logs processed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Threats Detected
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.totalThreats}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                AI-powered detection
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Critical Threats
              </CardTitle>
              <Shield className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.criticalThreats}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unread Alerts
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.unreadAlerts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending review
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Threats by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {threatsByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={threatsByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No threat data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Threat Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {threatsBySeverity.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={threatsBySeverity}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {threatsBySeverity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || "hsl(var(--primary))"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No threat data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
